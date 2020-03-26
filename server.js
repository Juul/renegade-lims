#!/usr/bin/env node
'use strict';

const path = require('path');
const tls = require('tls');
const fs = require('fs-extra');
const multifeed = require('multifeed');
const kappa = require('kappa-core');
const view = require('kappa-view');
const level = require('level');
const sublevel = require('subleveldown');
const through = require('through2');

const json = require('./jsonEncoding.js');
const swabsByTimeView = require('./views/swabsByTimestamp.js');
const swabsByUserView = require('./views/swabsByUsername.js');
const settings = require('./settings.js');

const SWABS_BY_TIME = 'st';
const SWABS_BY_USER = 'su';

async function init() {

  await fs.ensureDir(settings.dataPath, {
    mode: 0o2750
  });

  const multifeedPath = path.join(settings.dataPath, 'serverfeed');
  const multi = multifeed(multifeedPath, {valueEncoding: json})
  const core = kappa(null, {multifeed: multi});

  const db = level(path.join(settings.dataPath, 'db'), {valueEncoding: 'json'});
  
  core.use('swabsByTime', 1, view(sublevel(db, SWABS_BY_TIME, {valueEncoding: 'json'}), swabsByTimeView));
  core.use('swabsByUser', 1, view(sublevel(db, SWABS_BY_USER, {valueEncoding: 'json'} ), swabsByUserView));
  
  multi.ready(function() {

    // Show all swabs by time
    core.api.swabsByTime.read().pipe(through.obj(function(swab, enc, next) {
      console.log("swab:", enc, typeof swab, swab);

      next();
    }));
    
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
