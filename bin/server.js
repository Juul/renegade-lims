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
const backoff = require('backoff');
const ecstatic = require('ecstatic');
const minimist = require('minimist');

const objectsByGUIDView = require('../views/objectsByGUID.js');
const objectsByBarcodeView = require('../views/objectsByBarcode.js');
const swabTubesByFormBarcodeView = require('../views/swabTubesByFormBarcode.js');
const swabsByTimeView = require('../views/swabsByTimestamp.js');
const swabsByUserView = require('../views/swabsByUsername.js');
const platesByTimeView = require('../views/platesByTimestamp.js');
const usersByGUIDView = require('../views/usersByGUID.js');
const usersByNameView = require('../views/usersByName.js');

const LabLocal = require('../lib/lab_local.js');
const tlsUtils = require('../lib/tls.js');
const writer = require('../lib/writer.js');
const userUtils = require('../lib/user.js');
const ntpTester = require('../lib/ntp_tester.js');
const LabDeviceServer = require('../lib/labdevice_server.js');
const DataMatrixScanner = require('../lib/datamatrix_scanner.js');
const settings = require('../settings.js');

const OBJECTS_BY_GUID = 'og'; // everything by GUID
const OBJECTS_BY_BARCODE = 'ob'; // everything by barcode
const SWAB_TUBES_BY_FORM_BARCODE = 'sfb';
const SWABS_BY_TIME = 'st';
const SWABS_BY_USER = 'su';
const PLATES_BY_TIME = 'pt';

const USERS_BY_GUID = 'ug';
const USERS_BY_NAME = 'un';

// ------------------

const argv = minimist(process.argv.slice(2), {
  boolean: [
    'debug'
  ],
  alias: {
    'd': 'debug', // enable debug output
    'i': 'introvert' // don't initiate any outbound connections
  }
});

const labDeviceServer = new LabDeviceServer();

if(!settings.attemptsLog) {
  console.log("Warning: settings.attemptsLog is not set. Login and signup brute forcing prevention is disabled.");
}

fs.ensureDirSync(settings.dataPath, {
  mode: 0o2750
});

const multifeedPath = path.join(settings.dataPath, 'lab_feed');
const labMulti = multifeed(multifeedPath, {valueEncoding: 'json'})
const labCore = kappa(null, {multifeed: labMulti});

const multifeedAdminPath = path.join(settings.dataPath, 'admin_feed');
const adminMulti = multifeed(multifeedAdminPath, {valueEncoding: 'json'})
const adminCore = kappa(null, {multifeed: adminMulti});

const db = level(path.join(settings.dataPath, 'db'), {valueEncoding: 'json'});
const labDB = sublevel(db, 'l', {valueEncoding: 'json'});
const adminDB = sublevel(db, 'a', {valueEncoding: 'json'});
const localDB = sublevel(db, 'lo', {valueEncoding: 'json'}); // never replicated
const labLocal = new LabLocal(localDB, settings.labBarcodePrefix);


labCore.use('objectsByGUID', 1, view(sublevel(labDB, OBJECTS_BY_GUID, {valueEncoding: 'json'}), objectsByGUIDView));
labCore.use('objectsByBarcode', 1, view(sublevel(labDB, OBJECTS_BY_BARCODE, {valueEncoding: 'json'}), objectsByBarcodeView));
labCore.use('objectsByBarcode', 1, view(sublevel(labDB, OBJECTS_BY_BARCODE, {valueEncoding: 'json'}), objectsByBarcodeView));
labCore.use('swabTubesByFormBarcode', 1, view(sublevel(labDB, SWAB_TUBES_BY_FORM_BARCODE, {valueEncoding: 'json'}), swabTubesByFormBarcodeView));
labCore.use('swabsByUser', 1, view(sublevel(labDB, SWABS_BY_USER, {valueEncoding: 'json'} ), swabsByUserView));
labCore.use('platesByTime', 1, view(sublevel(labDB, SWABS_BY_TIME, {valueEncoding: 'json'} ), platesByTimeView));

adminCore.use('usersByGUID', 1, view(sublevel(adminDB, USERS_BY_GUID, {valueEncoding: 'json'} ), usersByGUIDView));
adminCore.use('usersByName', 1, view(sublevel(adminDB, USERS_BY_NAME, {valueEncoding: 'json'} ), usersByNameView));


// Wait for multifeeds to be ready
// before proceeding with initialization
labMulti.ready(function() {
  adminMulti.ready(init);
});

function ensureInitialUser(settings, adminCore, cb) {
  cb = cb || function() {};
  if(!settings.initialUser) return cb();
  const user = settings.initialUser;
  if(!user.name || !user.password) return cb();

  adminCore.api.usersByName.get(user.name, function(err, users) {
    if(!err && users && users.length) return cb();
    
    writer.saveUser(adminCore, {
      name: user.name,
      groups: ['admin', 'user']
    }, user.password, null, true, function(err, user) {
      if(err) {
        console.error("Failed to create initial user:", err);
        return;
      }
      console.log("Created initial user:", user);
      cb(null, user);
    });
  });
    
}

function initWebserver() {

  const dmScanner = startDataMatrixScanner();
  
  var rpcMethods = require('../rpc/public.js')(settings, labDeviceServer, dmScanner, labCore, adminCore);
  
  // methods only available to logged-in users in the 'user' group
  rpcMethods.user = require('../rpc/user.js')(settings, labDeviceServer, dmScanner, labCore, adminCore, labLocal);

  ensureInitialUser(settings, adminCore);
  
  var rpcMethodsAuth = auth({
    userDataAsFirstArgument: true, 
    secret: settings.loginToken.secret,
    login: login
  }, rpcMethods, function(userdata, namespace, functionName, cb) {
    if(!namespace) return cb();
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
  var ws = websocket.createServer({server: server}, function(stream, request) {
    
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

    var remoteIP = null;
    if(settings.behindProxy) {
      if(request.headers['x-forwarded-for']) {
        remoteIP = headers['x-forwarded-for'].split(/\s*,\s*/)[0];
      }
    } else {
      remoteIP = request.connection.remoteAddress;
    }
    console.log("Remote IP:", remoteIP);
    
    // Ensure that all incoming RPC calls
    // will have the IP pre-pended as first argument
    rpcServer.setStaticInArgs(remoteIP);
    
    rpcServer.on('error', function(err) {
      console.error("Connection error (client disconnect?):", err);
    });


    // when we receive a methods list from the other endpoint
    rpcServer.on('methods', function(remote) {
//      console.log("got methods");
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


function labDeviceConnection(peer, socket, peerDesc) {

  labDeviceServer.clientConnected(socket, function(err, clientInfo) {
    if(err) return console.error(err);
    
    peerDesc.id = clientInfo.id;
    peerDesc.name = clientInfo.name;

  });
  
  return peerDesc;
}

function beginReplication(peer, socket) {

  const peerDesc = {
    type: peer.type,
    host: (peer.connect) ? peer.connect.host : socket.remoteAddress,
    port: socket.remotePort
  }
  
  if(peer.type === 'lab-device') {

    return labDeviceConnection(peer, socket, peerDesc);
  }
  
  var labReadAllowed = false;
  var adminWriteAllowed = false;
  
  if(peer.type === 'field') {

    labReadAllowed = false;
    adminWriteAllowed = false;
    
  } else if(peer.type === 'lab' || peer.type === 'server') {
    
    labReadAllowed = true;
    adminWriteAllowed = true;
    
  } else { // not a recognized certificate for any type of device
    console.log("Connection from unknown peer type with a valid certificate");
    socket.destroy();
    return;
  }

  console.log("peer is of type:", peer.type)
  
  const mux = multiplex();
  const labStream = mux.createSharedStream('labStream');
  const adminStream = mux.createSharedStream('adminStream');

  socket.pipe(mux).pipe(socket);

  labStream.pipe(labMulti.replicate(false, {
    download: true,
    upload: labReadAllowed,
    live: true
  })).pipe(labStream);
  
  adminStream.pipe(adminMulti.replicate(false, {
    download: adminWriteAllowed,
    upload: true,
    live: true
  })).pipe(adminStream);

  return peerDesc;
}

function initInbound() {

  const peerCerts = tlsUtils.getPeerCerts(settings.tlsPeers);

  var server = tls.createServer({
    ca: peerCerts,
    key: settings.tlsKey,
    cert: settings.tlsCert,
    requestCert: true,
    rejectUnauthorized: true,
    enableTrace: !!argv.debug
    
  }, function(socket) {
    console.log("Inbound connection");
    
    const peer = tlsUtils.getPeerCertEntry(settings.tlsPeers, socket.getPeerCertificate());
    if(!peer) {
      console.log("Unknown peer with valid certificate connected");
      socket.destroy();
      return;
    }
    const peerDesc = beginReplication(peer, socket);

    console.log("Peer connected:", peerDesc);
  });

  server.on('clientError', (err) => {
    console.error("Client error:", err);
  });
  
  server.on('tlsClientError', (err) => {
    console.error("Client failed to authenticate:", err);
  });
  
  console.log("Replication server listening on", settings.host+':'+settings.port);
  
  server.listen({
    host: settings.host,
    port: settings.port
  });
}

function connectToPeerOnce(peer, cb) {
  
  console.log("Connecting to peer:", peer.connect.host + ':' + peer.connect.port);
  const socket = tls.connect(peer.connect.port, peer.connect.host, {
    ca: peer.cert, // only trust this cert
    key: settings.tlsKey,
    cert: settings.tlsCert,
    rejectUnauthorized: true,
    enableTrace: !!argv.debug,
    checkServerIdentity: function(host, cert) {
      console.log("Checking cert for:", host);
      const res = tls.checkServerIdentity(host, cert);
      console.log("  result:", res);
      return res;
    }
  })
  
  socket.on('secureConnect', function() {
    cb();
    console.log("Connected to peer:", peer.connect.host + ':' + peer.connect.port);

    beginReplication(peer, socket);
  });

  socket.on('close', function() {
    console.log("Disconnected from peer:", peer.connect.host + ':' + peer.connect.port);
    cb(true);
  });
  
  socket.on('error', function(err) {
    console.error(err);
  });
}

function connectToPeer(peer) {
  if(!peer.connect.port || !peer.connect.host) return;


  // Retry with increasing back-off 
  var back = backoff.fibonacci({
    randomisationFactor: 0,
    initialDelay: 3 * 1000, // 3 seconds
    maxDelay: 30 * 1000
  });

  var count = 0;
  function tryConnect() {
    connectToPeerOnce(peer, function(disconnected) {
      if(disconnected) {
        if(count > 0) {
          back.backoff();
          return;
        }
        process.nextTick(tryConnect);
        count++;
      } else {
        count = 0;
        back.reset();
      }
    });
  }
  
  tryConnect();
  
  back.on('backoff', function(number, delay) {
    console.log("Retrying in", Math.round(delay / 1000), "seconds");
  });


  back.on('ready', function(number, delay) {
    tryConnect();
  });
  
}

function initOutbound() {
  if(!settings.tlsPeers) return;
  
  var peer;
  for(peer of settings.tlsPeers) {
    if(!peer.connect) continue;
    connectToPeer(peer);
  }

}

async function init() {
  // Periodically check if system time is to far off from NTP server time
  // this is just an extra check in case of a misconfigured system
  // since we may rely on timestamps for merging data when the same data
  // has been edited by two different users while one or both were offline
  // Ideally we'll use CRDTs in the future but time is of the essence (heh)
  startPeriodicTimeCheck();

  tlsUtils.computeCertHashes(settings.tlsPeers);

  if(settings.host) {
    initInbound();
  }

  if(!argv.introvert) {
    initOutbound();
  } else {
    console.log("Introvert mode enabled. Ignoring settings.tlsPeers");
  }
  
  if(settings.webHost) {
    initWebserver();
  }
  
}


function login(data, cb) {
  
  console.log("Login attempt:", data);

//  antiBruteforce(settings.attemptsLog, remoteIP, null, function(err) {
//    if(err) return cb(err);
  
  adminCore.api.usersByName.get(data.username, function(err, users) {
    if(err) return cb(err);

    if(!users.length) {
      return cb(new Error("No user with that username exists"))
    }

    var user;
    try {
      user = userUtils.verifyAll(users, data.password);
    } catch(err) {
      return cb(err);
    }

    if(!user) {
      return cb(new Error("Incorrect password"));
    }

    console.log("Logged in:", user.name);

    delete user.password;
    cb(null, user.id, user);
  });  
}

function startDataMatrixScanner() {
  var dataMatrixScanner;
  
  if(settings.dataMatrixScanner) {
    dataMatrixScanner = new DataMatrixScanner(settings.dataMatrixScanner);
//    dataMatrixScanner.scan(true, function(err, code) {
//      if(err) return console.error(err)
//      console.log("GOT CODE:", code);
//    });
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
