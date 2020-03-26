#!/usr/bin/env node
'use strict';

const uuid = require('uuid').v4;
const fs = require('fs');
const path = require('path');
const tls = require('tls');
const net = require('net');
const http = require('http');
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
    const duplex = mux.createSharedStream('fromServer');
    
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


// serve up user-uploaded static files
var userStatic = ecstatic({
  root: settings.staticFilePath,
  baseDir: 'static',
  gzip: true,
  cache: 0
});

// Static files that require user login
router.addRoute('/static/*', function(req, res, match) {

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

server.listen(8000, 'localhost')
