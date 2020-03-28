#!/usr/bin/env node
'use strict';

const path = require('path');
const tls = require('tls');
const fs = require('fs-extra');
const crypto = require('crypto');
const multiplex = require('multiplex');
const multifeed = require('multifeed');
const kappa = require('kappa-core');
const view = require('kappa-view');
const level = require('level');
const sublevel = require('subleveldown');
const through = require('through2');

const ntpTester = require('./lib/ntp_tester.js');
const swabsByTimeView = require('./views/swabsByTimestamp.js');
const swabsByUserView = require('./views/swabsByUsername.js');
const settings = require('./settings.js');

const SWABS_BY_TIME = 'st';
const SWABS_BY_USER = 'su';


function sha256(data) {
  const hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

const allClientCerts = settings.tlsClients.map((o) => {
  return o.cert;
});

// remove comments and whitespace from certificate data
function certClean(rawCert) {
  rawCert = rawCert.toString('utf8');
  rawCert = rawCert.replace(/[-]+BEGIN\s+CERTIFICATE[-]+/, '');
  rawCert = rawCert.replace(/[-]+END\s+CERTIFICATE[-]+/, '');
  rawCert = rawCert.replace(/[\s]+/g, '');
  return Buffer.from(rawCert);
}

// takes in settings.tlsClientCerts
function computeCertHashes(tlsClients) {
  for(let o of tlsClients) {
    o.hash = sha256(certClean(o.cert));
  }
}

computeCertHashes(settings.tlsClients);

// takes in settings.tlsClientCerts
function getClientCertEntry(tlsClients, cert) {
  const hash = sha256(cert.raw.toString('base64'));
  
  var entry;
  for(entry of tlsClients) {
    if(entry.hash === hash) {
      return entry
    }
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

async function init() {
  
  await fs.ensureDir(settings.dataPath, {
    mode: 0o2750
  });

  startPeriodicTimeCheck();

  const multifeedPath = path.join(settings.dataPath, 'multifeed');
  const multi = multifeed(multifeedPath, {valueEncoding: 'json'})
  const multifeedPubPath = path.join(settings.dataPath, 'pubfeed');
  const multiPub = multifeed(multifeedPubPath, {valueEncoding: 'json'})
  const core = kappa(null, {multifeed: multi});

  const db = level(path.join(settings.dataPath, 'db'), {valueEncoding: 'json'});
  
  core.use('swabsByTime', 1, view(sublevel(db, SWABS_BY_TIME, {valueEncoding: 'json'}), swabsByTimeView));
  core.use('swabsByUser', 1, view(sublevel(db, SWABS_BY_USER, {valueEncoding: 'json'} ), swabsByUserView));
  
  multi.ready(function() {

    // TODO remove debug code
    multiPub.writer('users', function(err, feed) {
      feed.append({
        type: 'user',
        name: 'cookie cat'
      });
    });
    
    // Show all swabs by time
    core.api.swabsByTime.read().pipe(through.obj(function(swab, enc, next) {
      console.log("swab:", enc, typeof swab, swab);

      next();
    }));
    
    multi.on('feed', function(feed, name) {
      console.log("feed:", name);
    });
    
    var server = tls.createServer({
      ca: allClientCerts,
      key: settings.tlsKey,
      cert: settings.tlsCert,
      requestCert: true,
      rejectUnauthorized: true
      
    }, function(socket) {
      console.log("got connection");
      const mux = multiplex();

      const client = getClientCertEntry(settings.tlsClients, socket.getPeerCertificate());
      if(!client) {
        console.log("Unknown client with valid certificate connected");
        socket.destroy();
        return;
      }
      console.log("New connection from", socket.remoteAddress+':'+socket.remotePort);
      console.log("A", client.type, "client connected:", client.description);
      
      var fullReadPermission;
      
      if(client.type === 'field') {

        fullReadPermission = false;
        
      } else if(client.type === 'lab') {

        fullReadPermission = true;
        
      } else { // not a recognized certificate for any type of device
        console.log("Connection from unknown client type with a valid certificate");
        socket.destroy();
        return;
      }

      const toServer = mux.createSharedStream('toServer');
      const duplex = mux.createSharedStream('duplex');

      socket.pipe(mux).pipe(socket);

      toServer.pipe(multi.replicate(false, {
        download: true,
        upload: false,
        live: true
      })).pipe(toServer);
      
      duplex.pipe(multiPub.replicate(false, {
        download: true,
        upload: fullReadPermission,
        live: true
      })).pipe(duplex);
      
    })
    
    server.listen({
      host: settings.host,
      port: settings.port
    });
    
    console.log('listening on', settings.host+':'+settings.port);
  });

}

init();
