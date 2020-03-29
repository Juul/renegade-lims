#!/usr/bin/env node
'use strict';

const uuid = require('uuid').v4;
const fs = require('fs');
const path = require('path');
const tls = require('tls');
const net = require('net');
const http = require('http');
const websocket = require('websocket-stream');
const rpc = require('rpc-multistream'); // rpc and stream multiplexing
const auth = require('rpc-multiauth'); // authentication
const multiplex = require('multiplex');
const multifeed = require('multifeed');
const timestamp = require('monotonic-timestamp');
const router = require('routes')(); // server side router
const ecstatic = require('ecstatic');

const ntpTester = require('../lib/ntp_tester.js');
const labDeviceServer = require('./lib/lab_device_server.js');
const DataMatrixScanner = require('./lib/datamatrix_scanner.js');
const settings = require('./settings.js');

// ------------------

const multifeedPath = path.join(settings.dataPath, 'clientfeed');
const multi = multifeed(multifeedPath, {valueEncoding: 'json'})

const multifeedPubPath = path.join(settings.dataPath, 'pubfeed');
const multiPub = multifeed(multifeedPubPath, {valueEncoding: 'json'})

const dmScanner = startDataMatrixScanner();


labDeviceServer.start(settings, function(err) {
  if(err) return console.error(err);
  
  console.log("Lab device server started");
});

multi.ready(function() {
  
  startPeriodicTimeCheck();
  
  var socket = tls.connect(settings.port, settings.host, {
    ca: settings.serverTLSCert, // only trust this cert
    key: settings.tlsKey,
    cert: settings.tlsCert
  })

  socket.on('error', function(err) {
    console.error(err);
  });
  
  socket.on('secureConnect', function() {
    console.log("connected");

    const mux = multiplex();
    const toServer = mux.createSharedStream('toServer');
    const duplex = mux.createSharedStream('duplex');
    
    socket.pipe(mux).pipe(socket);

    toServer.pipe(multi.replicate(true, {
      download: false,
      upload: true,
      live: true
    })).pipe(toServer);

    duplex.pipe(multiPub.replicate(true, {
      download: true,
      upload: true,
      live: true
    })).pipe(duplex);

    for(let feed of multiPub.feeds()) {
      feed.get(0, function(_, data) {
        console.log("feed:", feed);
        console.log("  data 0:", data);
      })
    }

    // TODO remove debug code
    multi.writer('swabber', function(err, feed) {
      console.log("opened feed");
      
      feed.append({
        type: 'swab',
        id: uuid(),
        createdAt: timestamp(),
        createdBy: 'juul',
        isExternal: false,
        isPriority: false
        
      }, function() {
        console.log("appended");

      })
    });
  });

  socket.on('close', function() {
    console.log("socket closed");
  });
  
});

function login(data, cb) {
  
  // TODO implement

  const uuid = "should be an actual uuid";
  
  cb(null, uuid, {
    id: uuid,
    username: "juul"
  });
  
}

var rpcMethods = {
  
  foo: function(userData, cb) {
    cb(null, "bar");
  },

  // TODO move all of the below to the 'user' namespace

  saveLabel: function(userData, labelData, imageData, doPrint, cb) {

    // TODO validate data
    
    const id = labelData.id;

    // TODO actually save in database
    
    var mtch;
    if(imageData && (mtch = imageData.match(/^data:image\/png;base64,(.*)/))) {

      var imageBuffer = new Buffer(mtch[1], 'base64');
      // TODO size check
      var imagePath = path.join(settings.labDevice.labelImageFilePath, labelData.id+'.png')
      fs.writeFile(imagePath, imageBuffer, function(err) {
        if(err) return cb(err);

        if(doPrint) {
          labDeviceServer.printLabel('qlPrinter', 'examples/label.png', cb);
        } else {
          cb(null, id, imagePath);
        }
        
      });
    } else{
      cb(null, id);
    }
    

  },
  
  getPhysical: function(userData, code, cb) {

  },

  getPhysicalByBarcode: function(userData, code, cb) {

  },
  
  claimDataMatrixScanner: function(userData, cb) {
    if(!dmScanner) return cb(new Error("No Data Matrix scanner configured"));

    // TODO we should unregister when this web client disconnects
    dmScanner.registerCallback(cb);
  },
  
  getOrCreatePlateByBarcode: function(userData, barcode, cb) {
    // TODO implement
    console.log("get/create plate by barcode");
    cb(null, {
      id: uuid(),
      createdBy: 'juul',
      createdAt: new Date(),
      updatedBy: 'juul', 
      updatedAt: new Date(),
      wells: {
        A1: uuid(),
        A2: uuid()
      }
    });
  },

  getPlate: function(userData, id, cb) {
    // TODO implement
    console.log("get plate:", id);
    cb(null, {
      id: uuid(),
      createdBy: 'juul',
      createdAt: new Date(),
      updatedBy: 'juul', 
      updatedAt: new Date(),
      wells: {
        A1: uuid(),
        A2: uuid()
      }
    });
  },
  
  updatePlate: function(userData, plate, cb) {
    // TODO implement
    cb();
  },
  
  // methods only available to logged-in users in the 'user' group
  user: {


  }
}

var rpcMethodsAuth = auth({
  userDataAsFirstArgument: true, 
  secret: settings.loginToken.secret,
  login: login
}, rpcMethods, function(userdata, namespace, functionName, cb) {
  if(!userdata && !namespace) return cb();
  if(!userdata.groups || userdata.groups.indexOf(namespace) < 0) {
    return cb(new Error("User tried to access function in the '"+namespace+"' namespace but is not in the '"+namespace+"' group"));
  }
  cb();
});

var userCookieAuth = auth({
  secret: settings.loginToken.secret,
  cookie: {
    setCookie: true
  }
});

const publicStatic = ecstatic({
  root: settings.staticPath,
  baseDir: 'static',
  gzip: true,
  cache: 0
});

router.addRoute('/static/*', publicStatic);

var userStatic = ecstatic({
  root: settings.staticUserPath,
  baseDir: 'static-user',
  gzip: true,
  cache: 0
});

// Static files that require user login
router.addRoute('/static-user/*', function(req, res, match) {

  userCookieAuth(req, function(err, tokenData) {
    if(err) {
      res.statusCode = 401;
      res.end("Unauthorized: " + err);
      return;
    }
    return userStatic(req, res);
  });
});

router.addRoute('/*', function(req, res, match) {
  var rs = fs.createReadStream(path.join(settings.staticPath, 'index.html'));
  rs.pipe(res);
});

var server = http.createServer(function(req, res) {
  var m = router.match(req.url);
  m.fn(req, res, m);
});


server.on('connection', function(socket) {
  socket.on('error', function(err) {
    console.log("Client socket error:", err);
  });
})

server.on('close', function(err) {
  console.log("Server close:", err);
});


server.on('error', function(err) {
  console.error("Server error:", err);
});

server.on('clientError', function(err) {
  console.error("Client connection error:", err);
});


// start the webserver
console.log("Starting http server on " + (settings.hostname || '*') + " port " + settings.port);


// initialize the websocket server on top of the webserver
var ws = websocket.createServer({server: server}, function(stream) {

  stream.on('error', function(err) {
    console.error("WebSocket stream error:", err);
  });

  stream.on('end', function() {

  });

  // initialize the rpc server on top of the websocket stream
  var rpcServer = rpc(rpcMethodsAuth, {
    objectMode: true, // default to object mode streams
    debug: false
  });

  rpcServer.on('error', function(err) {
    console.error("Connection error (client disconnect?):", err);
  });


  // when we receive a methods list from the other endpoint
  rpcServer.on('methods', function(remote) {
    console.log("got methods");
  });

  rpcServer.pipe(stream).pipe(rpcServer);
});


ws.on('connection', function (socket) {
  socket.on('error', function(err) {
    console.error("WebSocket client error:", err);
  });
});

ws.on('error', function(err) {
  if(err) console.error("WebSocket server error:", err);
});

console.log("Web server listening on", settings.webHost+':'+settings.webPort);
server.listen(settings.webPort, settings.webHost)


function startDataMatrixScanner() {
  var dataMatrixScanner;
  
  if(settings.dataMatrixScanner) {
    dataMatrixScanner = new DataMatrixScanner(settings.dataMatrixScanner);
    dataMatrixScanner.scan(true, function(err, code) {
      if(err) return console.error(err);

      console.log("GOT CODE:", code);
    });
    return dataMatrixScanner;
  }
  return null;
}

function startPeriodicTimeCheck() {
  ntpTester.startPeriodicTimeCheck(settings.ntpServers, settings.checkTimeEvery * 1000, function(err, isTimeAccurate) {
    if(err) {
      // TODO notify sysadmin if this goes on for a long time
      console.error("Warning: Failed to reach an NTP server. Time may be inaccurate.");
      return;
    }
    if(!isTimeAccurate) {
      // TODO notify sysadmin
      console.error("WARNING: Time is unreasonably inaccurate. You are at greater than usual risk of merge errors.");
    }
  });
}
