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
const sublevel = require('subleveldown');

const level = require('level');
const router = require('routes')(); // server side router
const ecstatic = require('ecstatic');
const minimist = require('minimist');

const antiBruteforce = require('../lib/anti_bruteforce.js');
const LabLocal = require('../lib/lab_local.js');
const tlsUtils = require('../lib/tls.js');
const writer = require('../lib/writer.js');
const userUtils = require('../lib/user.js');
const ntpTester = require('../lib/ntp_tester.js');
const migration = require('../lib/migration.js');
const LabDeviceServer = require('../lib/labdevice_server.js');
const DecapperServer = require('../lib/decapper_server.js');
const DataMatrixScanner = require('../lib/datamatrix_scanner.js');
const settings = require('../settings.js');

const rimbaud = require('../lib/rimbaud.js')(settings);


const limsCore = require('renegade-lims-core');

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
const decapperServer = new DecapperServer();

if(!settings.attemptsLog) {
  console.log("Warning: settings.attemptsLog is not set. Login and signup brute forcing prevention is disabled.");
}

fs.ensureDirSync(settings.dataPath, {
  mode: 0o2750
});

const db = level(path.join(settings.dataPath, 'db'), {valueEncoding: 'json'});

const oldLocalDB = sublevel(db, 'lo', {valueEncoding: 'json'});
const localDBPath = path.join(settings.dataPath, 'local_db');
const localDB = level(localDBPath, {valueEncoding: 'json'}); // never replicated
const labLocal = new LabLocal(localDB, settings.labBarcodePrefix);

function ensureInitialUser(settings, adminCore, cb) {
  cb = cb || function() {};
  if(!settings.initialUser || !settings.initialUser.name || !settings.initialUser.password) {
    console.log("No initial user specified in settings.initialUser");
    return cb();
  }
  const user = settings.initialUser;

  console.log("Attempting to create initial user:", user.name);
  
  core.adminCore.api.usersByName.get(user.name, function(err, users) {
    if(!err && users && users.length) {
      console.log("User", user.name, "already exists");
      return cb();
    }
    
    writer.saveUser(core.adminCore, {
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
  
  var rpcMethods = require('../rpc/public.js')(settings, labDeviceServer, dmScanner, core.labCore, core.adminCore);
  
  // methods only available to logged-in users in the 'user' group
  rpcMethods.user = require('../rpc/user.js')(settings, labDeviceServer, dmScanner, core.labCore, core.adminCore, labLocal);

  // methods only available to users in the 'admin' group
  rpcMethods.admin = require('../rpc/admin.js')(settings, labDeviceServer, dmScanner, core.labCore, core.adminCore, labLocal);
  

  if(argv.init) {
    console.log("Initializing new renegade-lims network");
    ensureInitialUser(settings, core.adminCore);
  }
  
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

  if(argv.introvert) {
    settings.introvert = true;
  }

  if(argv.insecure) {
    settings.insecure = true;
  }

  if(argv.debug) {
    settings.debug = true;
  }
  
  if(argv.dump) {
    const csv = require('../lib/csv.js');
    if(argv.dump === 'plates') {
      csv.getPlates(core.labCore, (err, data) => {
        if(err) return console.error(err);

        process.stdout.write(data);
        process.exit(0);
      })
    } else if(argv.dump === 'platesw') {
      csv.getPlatesWrong(core.labCore, (err, data) => {
        if(err) return console.error(err);

        process.stdout.write(data);
        process.exit(0);
      })
      
    } else if(argv.dump === 'samples') {
      csv.getSamples(core.labCore, (err, data) => {
        if(err) return console.error(err);

        process.stdout.write(data);
        process.exit(0);
      })
    } else if(argv.dump === 'samplesw') {
      csv.getSamplesWrong(core.labCore, (err, data) => {
        if(err) return console.error(err);

        process.stdout.write(data);
        process.exit(0);
      })
    } else if(argv.dump === 'all') {
      csv.getAll(core.labCore, (err, data) => {
        if(err) return console.error(err);

        process.stdout.write(data);
        process.exit(0);
      })
      
    } else if(argv.dump === 'results') {
      csv.getQpcrResults(core.labCore, (err, data) => {
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
      rimbaud.startOrderSynchronizer(core.labCore);
    }
  }


    
  if(settings.webHost) {
    initWebserver();
  }
}


function login(remoteIP, data, cb) {
  
//  console.log("Login attempt:", userData);

  antiBruteforce(settings.attemptsLog, remoteIP, data.username, function(err) {
    if(err) return cb(err);  
  
    core.adminCore.api.usersByName.get(data.username, function(err, users) {
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


var core;
limsCore.init(db, settings, function(err, o) {
  if(err) {
    console.error("Failed to start lims core:", err)
    process.exit(1);
  }

  core = o;

  init();
}, function(peer, peerDesc, socket) {
  
  if(peer.type === 'lab-device') {
    labDeviceConnection(peer, socket, peerDesc);
    
  } else if(peer.type === 'decapper') {

    console.log("DeCapper connected:", peer)
    decapperServer.clientConnected(socket);
                
  } else {
    console.error("Unknown peer type:", peer.type);
  }
  
});
