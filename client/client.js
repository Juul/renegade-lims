#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var tls = require('tls');
var multifeed = require('multifeed');

var net = require('net');
var http = require('http');
var router = require('routes')(); // server side router
var ecstatic = require('ecstatic');

var settings = require('./settings.js');

const multifeedPath = path.join(settings.dataPath, 'clientfeed');
var multi = multifeed(multifeedPath, {valueEncoding: 'json'})

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

    socket.pipe(multi.replicate(true, {
      download: false,
      upload: true,
      live: true
    })).pipe(socket);

    multi.writer('swabber', function(err, w) {
      console.log("opened feed");
      
      w.append({
        foo: 'bar'
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
