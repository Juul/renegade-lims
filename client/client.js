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

const settings = require('./settings.js');

const multifeedPath = path.join(settings.dataPath, 'clientfeed');
const multi = multifeed(multifeedPath, {valueEncoding: 'json'})

const multifeedPubPath = path.join(settings.dataPath, 'pubfeed');
const multiPub = multifeed(multifeedPubPath, {valueEncoding: 'json'})

multi.ready(function() {

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
  
  foo: function (curUser, cb) {
    cb(null, "bar");
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

router.addRoute('/*', function(req, res, match) {
  var rs = fs.createReadStream(path.join(settings.staticPath, 'index.html'));
  rs.pipe(res);
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


