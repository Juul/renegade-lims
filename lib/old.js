
var fs = require('fs');
var path = require('path');
var ssh2 = require('ssh2');
var async = require('async');
var buffersEqual = require('buffer-equal-constant-time');
var rpc = require('rpc-multistream');

var settings;

function log(str) {
  console.log('[printserver] ' + str);
}

function logError(str) {
  console.error('[printserver] ' + str);
}

/* 
   This ssh server only understands one command: "stream".

   The only purpose of that command is to open a duplex stream over the
   ssh2 connection which is then wrapped in an rpc-multistream.

   The server API:

   identify(cb): reports settings.baseUrl to identify the server

   The client API:

   identify(cb): reports {
     id: "clients uuid", name: "human readable name", deviceType: "printer"
   }
   print(readstream, cb): takes a png label file stream and prints it

*/

// clients indexed by their IDs
var clients = {};

var serverRPC = {
  identify: function(cb) {
    return cb(null, settings.baseURL);
  },
  reportScan: function(code, cb) {
    cb = cb || function(){};
    console.log("Got scan result:", code)
    cb();
  }
};

function Client(client, session, test) {
  this.client = client;
  this.session = session;
  this.id = undefined;
  this.name = undefined;
  this.remote = undefined;

  this.client.on('end', function() {
    if(clients[this.id]) {
      log("client " + this.id + " disconnected");
      delete clients[this.id];
    }
  }.bind(this));

  this.session.on('exec', function(accept, reject, info) {
    var self = this;
    var m;
    if(m = info.command.match(/^stream.*/)) {
      var stream = accept();

      var server = rpc(serverRPC, {});

      stream.pipe(server).pipe(stream)
      server.on('methods', function(remote) {
        self.remote = remote;

        remote.identify(function(err, info) {
          if(err) return console.error(err);

          self.id = info.id;
          self.name = info.name;
          clients[self.id] = self;

          if(test) test(self, info);
        });
      });

      //            this.msgChannelCmd(stream);
      //            this.getLabelCmd(stream, filename);
    } else {
      console.log("invalid command from print client");
      reject();
      return;
    }
  }.bind(this));

  this.printLabel = function(labDeviceIndexOrType, filepath, cb) {

    if(!this.remote) return cb(new Error("could not print to client: rpc not yet initialized"));

    var labelStream = fs.createReadStream(filepath);
    
    labelStream.on('error', function(err) {
      logError(err);
      cb(err);
    });
/*
    labelStream.on('end', function() {
      cb();
    });
*/

    this.remote.print(labDeviceIndexOrType, labelStream, cb);
  };


}

var labDeviceServer = {

  _server: null, 

  stop: function(cb) {
    cb = cb || function(){};
    if(!this._server) return cb("No server running");
    this._server.close(cb);
  },

  start: function(settingsOpt, opts, cb) {
    if(typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    settings = settingsOpt;

    if(!settings.labDevice.hostKey || !settings.labDevice.clientKeys) return cb("Missing host or client key. Printserver not started.");
    
    var pubKeys = [];
    try {
      var pubKeyFiles = fs.readdirSync(settings.labDevice.clientKeys);
    } catch(err) {
      return cb(err);
    }

    var i, pubKey, data;
    for(i=0; i < pubKeyFiles.length; i++) {
      if(pubKeyFiles[i].match(/^\./)) {
        console.log("Warning: Ignoring Lab Device SSH client key `"+pubKeyFiles[i]+"` because filename begins with a `.` (period)");
        continue;
      }
      if(pubKeyFiles[i].match(/~$/)) {
        console.log("Warning: Ignoring Lab Device SSH client key `"+pubKeyFiles[i]+"` because it ends with a `~` (tilde)");
        continue;
      }
      if(pubKeyFiles[i].match(/^#.*#$/)) {
        console.log("Warning: Ignoring Lab Device SSH client key `"+pubKeyFiles[i]+"` because it begins and ends with a `#` (hash)");
        continue;
      }
      
      try {
        data = fs.readFileSync(path.join(settings.labDevice.clientKeys, pubKeyFiles[i]));

        if(!data.length) continue;
        pubKey = ssh2.utils.genPublicKey(ssh2.utils.parseKey(data));
      } catch(err) {
        console.log("Warning: Invalid Lab Device SSH client key: `"+pubKeyFiles[i]+"`:", err);
        continue;
      }
      pubKeys.push(pubKey);
    }
    
    try {
      var hostKey = fs.readFileSync(settings.labDevice.hostKey);
    } catch(err) {
      return cb(err);
    }

    this._server = new ssh2.Server({
      hostKeys: [hostKey]
    }, function(client) {
      log('client connected!');

      client.on('error', function(err) {
        log('error:', err);
      });
      
      client.on('authentication', function(ctx) {
        if(ctx.method !== 'publickey') return ctx.reject();

        var i;
        for(i=0; i < pubKeys.length; i++) {          
          if(ctx.key.algo !== pubKeys[i].fulltype) continue;
          if(!buffersEqual(ctx.key.data, pubKeys[i].public)) continue;

          ctx.accept();
          return;
        }
        ctx.reject();
      });
      
      client.on('ready', function() {
        log('client authenticated!');
        
        client.on('session', function(accept, reject) {
          var session = accept();
          log("session accepted");

          var c = new Client(client, session, opts.test)

        });
      });

      client.on('end', function() {
        log("client disconnected");
      });
      
    });
    var listenHost = settings.labDevice.serverHost || settings.host;
    this._server.listen(settings.labDevice.serverPort, listenHost, function() {
      log("listening on "+listenHost+":"+settings.labDevice.serverPort);
      cb(null, this._server);
    });
  },

  printLabel: function(labDeviceIndexOrType, filePath, cb) {
    if(!cb) cb = function(){};

    if(!Object.keys(clients).length) return cb(new Error("No print servers currently connected"));

    var key;
    for(key in clients) {
      clients[key].printLabel(labDeviceIndexOrType, filePath, function(err) {
        if(err) cb(err);

        cb(null, "Sent to printer on", clients[key].name, ":", filePath);
      })
      return;
    }
  }

};

// ToDo clean up after disconnect (remove key from clients var)

module.exports = labDeviceServer;
