#!/usr/bin/env node
'use strict';

const uuid = require('uuid').v4;
const fs = require('fs-extra');
const path = require('path');
const tls = require('tls');
const net = require('net');
const http = require('http');
const https = require('https');
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
const swabTubesByTimestampView = require('../views/swabTubesByTimestamp.js');
const swabsByTimeView = require('../views/swabsByTimestamp.js');
const swabsByUserView = require('../views/swabsByUsername.js');
const platesByTimestampView = require('../views/platesByTimestamp.js');
const qpcrResultsByTimestampView = require('../views/qpcrResultsByTimestamp.js');
const qpcrResultBySampleBarcodeView = require('../views/qpcrResultBySampleBarcode.js');
const usersByGUIDView = require('../views/usersByGUID.js');
const usersByNameView = require('../views/usersByName.js');

const antiBruteforce = require('../lib/anti_bruteforce.js');
const LabLocal = require('../lib/lab_local.js');
const tlsUtils = require('../lib/tls.js');
const writer = require('../lib/writer.js');
const userUtils = require('../lib/user.js');
const ntpTester = require('../lib/ntp_tester.js');
const migration = require('../lib/migration.js');
const LabDeviceServer = require('../lib/labdevice_server.js');
const DataMatrixScanner = require('../lib/datamatrix_scanner.js');
const settings = require('../settings.js');

const rimbaud = require('../lib/rimbaud.js')(settings);

const OBJECTS_BY_GUID = 'og'; // everything by GUID
const OBJECTS_BY_BARCODE = 'ob'; // everything by barcode
const SWAB_TUBES_BY_FORM_BARCODE = 'sfb';
const SWAB_TUBES_BY_TIMESTAMP = 'stt';
const QPCR_RESULTS_BY_TIMESTAMP = 'qrt';
const QPCR_RESULT_BY_SAMPLE_BARCODE = 'qrsb';
const SWABS_BY_TIME = 'st';
const SWABS_BY_USER = 'su';
const PLATES_BY_TIME = 'pt';

const USERS_BY_GUID = 'ug';
const USERS_BY_NAME = 'un';

// ------------------

const argv = minimist(process.argv.slice(2), {
  boolean: [
    'debug',
    'init', // initialize a new LIMS network
    'introvert',
    'insecure', // don't authenticate anything. only for testing
    'migrate'
  ],
  alias: {
    'd': 'debug', // enable debug output
    'i': 'introvert', // don't initiate any outbound connections
    'D': 'dump' // dump data to CSV
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

const oldLocalDB = sublevel(db, 'lo', {valueEncoding: 'json'});
const localDBPath = path.join(settings.dataPath, 'local_db');
const localDB = level(localDBPath, {valueEncoding: 'json'}); // never replicated
const labLocal = new LabLocal(localDB, settings.labBarcodePrefix);

labCore.use('objectsByGUID', 1, view(sublevel(labDB, OBJECTS_BY_GUID, {valueEncoding: 'json'}), objectsByGUIDView));
labCore.use('objectsByBarcode', 1, view(sublevel(labDB, OBJECTS_BY_BARCODE, {valueEncoding: 'json'}), objectsByBarcodeView));
labCore.use('swabTubesByFormBarcode', 1, view(sublevel(labDB, SWAB_TUBES_BY_FORM_BARCODE, {valueEncoding: 'json'}), swabTubesByFormBarcodeView));
labCore.use('swabTubesByTimestamp', 1, view(sublevel(labDB, SWAB_TUBES_BY_TIMESTAMP, {valueEncoding: 'json'}), swabTubesByTimestampView));
labCore.use('swabsByUser', 1, view(sublevel(labDB, SWABS_BY_USER, {valueEncoding: 'json'} ), swabsByUserView));
labCore.use('platesByTimestamp', 1, view(sublevel(labDB, SWABS_BY_TIME, {valueEncoding: 'json'} ), platesByTimestampView));
labCore.use('qpcrResultsByTimestamp', 1, view(sublevel(labDB, QPCR_RESULTS_BY_TIMESTAMP, {valueEncoding: 'json'} ), qpcrResultsByTimestampView));
labCore.use('qpcrResultBySampleBarcode', 1, view(sublevel(labDB, QPCR_RESULT_BY_SAMPLE_BARCODE, {valueEncoding: 'json'} ), qpcrResultBySampleBarcodeView));

adminCore.use('usersByGUID', 1, view(sublevel(adminDB, USERS_BY_GUID, {valueEncoding: 'json'} ), usersByGUIDView));
adminCore.use('usersByName', 1, view(sublevel(adminDB, USERS_BY_NAME, {valueEncoding: 'json'} ), usersByNameView));


// Wait for multifeeds to be ready
// before proceeding with initialization
labMulti.ready(function() {
  adminMulti.ready(init);
});

function ensureInitialUser(settings, adminCore, cb) {
  cb = cb || function() {};
  if(!settings.initialUser || !settings.initialUser.name || !settings.initialUser.password) {
    console.log("No initial user specified in settings.initialUser");
    return cb();
  }
  const user = settings.initialUser;

  console.log("Attempting to create initial user:", user.name);
  
  adminCore.api.usersByName.get(user.name, function(err, users) {
    if(!err && users && users.length) {
      console.log("User", user.name, "already exists");
      return cb();
    }
    
    writer.saveUser(adminCore, {
      name: user.name,
      groups: ['admin', 'user']
    }, user.password, function(err, user) {
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

  // methods only available to users in the 'admin' group
  rpcMethods.admin = require('../rpc/admin.js')(settings, labDeviceServer, dmScanner, labCore, adminCore, labLocal);
  

  if(argv.init) {
    console.log("Initializing new renegade-lims network");
    ensureInitialUser(settings, adminCore);
  }
  
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

  const certbotStatic = ecstatic({
    root: '.well-known',
    baseDir: './.well-known',
    cache: 0
  });
  router.addRoute('/.well-known/*', certbotStatic);
  
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

  var httpOpts = {};
  var whichHttp;
  if(settings.webTLSKey && settings.webTLSCert) {
    whichHttp = https;
    httpOpts.key = settings.webTLSKey;
    httpOpts.cert = settings.webTLSCert;
  } else {
    whichHttp = http;
  }
  
  var server = whichHttp.createServer(httpOpts, function(req, res) {
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

  if(!settings.webPort) {
    if(settings.webTLSKey && settings.webTLSCert) {
      settings.webPort = 443;
    } else {
      settings.webPort = 80;
    }
  }
    console.log("Web server listening on", settings.webHost+':'+settings.webPort, "using HTTPS:", !!(settings.webTLSKey && settings.webTLSCert));

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

function beginReplication(peer, socket, isInitiator) {

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

  labStream.pipe(labMulti.replicate(isInitiator, {
    download: true,
    upload: labReadAllowed,
    live: true
  })).pipe(labStream);
  
  adminStream.pipe(adminMulti.replicate(isInitiator, {
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
    rejectUnauthorized: !argv.insecure,
    enableTrace: !!argv.debug
    
  }, function(socket) {
    console.log("Inbound connection");
    
    var peer = tlsUtils.getPeerCertEntry(settings.tlsPeers, socket.getPeerCertificate());
    if(!peer) {
      if(!argv.insecure) {
        console.log("Unknown peer with valid certificate connected");
        socket.destroy();
        return;
      }
      peer = {
        type: 'lab',
        description: "insecure test peer",
      }
    }
    const peerDesc = beginReplication(peer, socket, true);

    console.log("Peer connected:", peerDesc);
  });

  server.on('clientError', (err, socket) => {
    console.error("Client error:", socket.remoteAddress, err);
  });
  
  server.on('tlsClientError', (err, socket) => {
    console.error("Client failed to authenticate:", socket.remoteAddress, err);
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
    rejectUnauthorized: !argv.insecure,
    enableTrace: !!argv.debug,
    checkServerIdentity: function(host, cert) {
      console.log("Checking cert for:", host);
      const res = tls.checkServerIdentity(host, cert);
      console.log("  result:", (res === undefined) ? "success" : "certificate invalid");
      return res;
    }
  })
  
  socket.on('secureConnect', function() {
    cb();
    console.log("Connected to peer:", peer.connect.host + ':' + peer.connect.port);

    beginReplication(peer, socket, false);
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

  if(argv.migrate) {
    // Copy the contents of the old localDB sublevel into
    // an a stand-alone leveldb instance
    migration.ensureDBCopy(oldLocalDB, localDB, localDBPath, function(err) {
      if(err) return console.error("Migration failed:", err);

      console.log("Migration completed");
    })
    return;
  }
  
  if(argv.dump) {
    const csv = require('../lib/csv.js');
    if(argv.dump === 'plates') {
      csv.getPlates(labCore, (err, data) => {
        if(err) return console.error(err);

        process.stdout.write(data);
        process.exit(0);
      })
    } else if(argv.dump === 'platesw') {
      csv.getPlatesWrong(labCore, (err, data) => {
        if(err) return console.error(err);

        process.stdout.write(data);
        process.exit(0);
      })
      
    } else if(argv.dump === 'samples') {
      csv.getSamples(labCore, (err, data) => {
        if(err) return console.error(err);

        process.stdout.write(data);
        process.exit(0);
      })
    } else if(argv.dump === 'samplesw') {
      csv.getSamplesWrong(labCore, (err, data) => {
        if(err) return console.error(err);

        process.stdout.write(data);
        process.exit(0);
      })
    } else if(argv.dump === 'all') {
      csv.getAll(labCore, (err, data) => {
        if(err) return console.error(err);

        process.stdout.write(data);
        process.exit(0);
      })
      
    } else if(argv.dump === 'results') {
      csv.getQpcrResults(labCore, (err, data) => {
        if(err) return console.error(err);

        process.stdout.write(data);
        process.exit(0);
      })
    } else {
      console.error("Unknown data dump type");
      process.exit(1);
    }

    return;
  }

  
  // Periodically check if system time is to far off from NTP server time
  // this is just an extra check in case of a misconfigured system
  // since we may rely on timestamps for merging data when the same data
  // has been edited by two different users while one or both were offline
  // Ideally we'll use CRDTs in the future but time is of the essence (heh)
  startPeriodicTimeCheck();

  tlsUtils.computeCertHashes(settings.tlsPeers);

  if(settings.rimbaud && settings.rimbaud.synchronizeOrders) {
    if(!argv.introvert) {
      rimbaud.startOrderSynchronizer(labCore);
    }
  }
  
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


function login(remoteIP, data, cb) {
  
//  console.log("Login attempt:", userData);

  antiBruteforce(settings.attemptsLog, remoteIP, data.username, function(err) {
    if(err) return cb(err);  
  
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
