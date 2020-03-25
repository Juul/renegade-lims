#!/usr/bin/env node
'use strict';

var path = require('path');
var tls = require('tls');
const fs = require('fs-extra');
var multifeed = require('multifeed');

var settings = require('./settings.js');

async function init() {

  await fs.ensureDir(settings.dataPath, {
    mode: 0o2750
  });

  const multifeedPath = path.join(settings.dataPath, 'serverfeed');
  var multi = multifeed(multifeedPath, {valueEncoding: 'json'})

  multi.ready(function() {

    multi.feeds()[0].get(5, function (_, data) {
      console.log("DATA:", data);
    })
    
    multi.on('feed', function(feed, name) {
      console.log("feed:", name);
    });
    
    var server = tls.createServer({
      ca: settings.tlsClientCerts,
      key: settings.tlsKey,
      cert: settings.tlsCert,
      requestCert: true,
      rejectUnauthorized: true
      
    }, function(socket) {
      console.log("got connection");
      
      socket.pipe(multi.replicate(false, {
        download: true,
        upload: false,
        live: true
      })).pipe(socket)
    })
    
    server.listen({
      host: settings.host,
      port: settings.port
    });
    
    console.log('listening on', settings.host+':'+settings.port);
  });

}

init();
