#!/usr/bin/env node
'use strict';

const uuid = require('uuid').v4;
const fs = require('fs-extra');
const path = require('path');
const tls = require('tls');
const net = require('net');
const http = require('http');
const websocket = require('websocket-stream');
const rpc = require('rpc-multistream'); // rpc and stream multiplexing
const auth = require('rpc-multiauth'); // authentication
const multiplex = require('multiplex');
const multifeed = require('multifeed');
const kappa = require('kappa-core');
const view = require('kappa-view');
const level = require('level');
const sublevel = require('subleveldown');
const router = require('routes')(); // server side router
const ecstatic = require('ecstatic');

const objectsByGUIDView = require('../views/objectsByGUID.js');
const swabsByTimeView = require('../views/swabsByTimestamp.js');
const swabsByUserView = require('../views/swabsByUsername.js');
const platesByTimeView = require('../views/platesByTimestamp.js');

const ntpTester = require('../lib/ntp_tester.js');
const labDeviceServer = require('./lib/lab_device_server.js');
const DataMatrixScanner = require('./lib/datamatrix_scanner.js');
const settings = require('./settings.js');

const OBJECTS_BY_GUID = 'og'; // everything by GUID
const SWABS_BY_TIME = 'st';
const SWABS_BY_USER = 'su';
const PLATES_BY_TIME = 'pt';

// ------------------

fs.ensureDirSync(settings.dataPath, {
  mode: 0o2750
});

const multifeedPath = path.join(settings.dataPath, 'labfeed');
const labMulti = multifeed(multifeedPath, {valueEncoding: 'json'})
const labCore = kappa(null, {multifeed: labMulti});

const multifeedAdminPath = path.join(settings.dataPath, 'adminfeed');
const adminMulti = multifeed(multifeedAdminPath, {valueEncoding: 'json'})

const db = level(path.join(settings.dataPath, 'db'), {valueEncoding: 'json'});

labCore.use('objectsByGUID', 1, view(sublevel(db, OBJECTS_BY_GUID, {valueEncoding: 'json'}), objectsByGUIDView));
labCore.use('swabsByTime', 1, view(sublevel(db, SWABS_BY_TIME, {valueEncoding: 'json'}), swabsByTimeView));
labCore.use('swabsByUser', 1, view(sublevel(db, SWABS_BY_USER, {valueEncoding: 'json'} ), swabsByUserView));
labCore.use('platesByTime', 1, view(sublevel(db, SWABS_BY_TIME, {valueEncoding: 'json'} ), platesByTimeView));

// Wait for multifeeds to be ready
// before proceeding with initialization
labMulti.ready(function() {
  adminMulti.ready(init);
});

function initWebClient() {

  const dmScanner = startDataMatrixScanner();
  
  var rpcMethods = require('./rpc/public.js')(settings, labDeviceServer, dmScanner, labCore);
  
  // methods only available to logged-in users in the 'user' group
  rpcMethods.user = {
    // TODO nothing here yet
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

}

function initReplication() {
  
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
      const labStream = mux.createSharedStream('labStream');
      const adminStream = mux.createSharedStream('adminStream');
    
    socket.pipe(mux).pipe(socket);

    labStream.pipe(labMulti.replicate(true, {
      download: true,
      upload: true,
      live: true
    })).pipe(labStream);

    adminStream.pipe(adminMulti.replicate(true, {
      download: true,
      upload: false,
      live: true
    })).pipe(adminStream);

    for(let feed of adminMulti.feeds()) {
      feed.get(0, function(_, data) {
        console.log("feed:", feed);
        console.log("  data 0:", data);
      })
    }

    // TODO remove debug code
    /*
    labMulti.writer('inventory', function(err, feed) {
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
    */
  });

  socket.on('close', function() {
    console.log("socket closed");
  });

}

async function init() {
  // Periodically check if system time is to far off from NTP server time
  // this is just an extra check in case of a misconfigured system
  // since we may rely on timestamps for merging data when the same data
  // has been edited by two different users while one or both were offline
  // Ideally we'll use CRDTs in the future but time is of the essence (heh)
  await startPeriodicTimeCheck();

  // Start the server where a raspi
  // with a scanner and/or printer attached will connect
  labDeviceServer.start(settings, function(err) {
    if(err) return console.error(err);
    
    console.log("Lab device server started");
  });

  initReplication();
  initWebClient();
  
}

function login(data, cb) {
  
  // TODO implement

  const uuid = "should be an actual uuid";
  
  cb(null, uuid, {
    id: uuid,
    username: "juul"
  });
  
}

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
