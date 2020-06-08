'use strict';

var fs = require('fs');
var rpc = require('rpc-multistream');
var writer = require('./writer.js');

class DecapperServer {

  constructor(core) {
    
    this.serverRPC = {
      reportScan: (data, cb) => {
        cb = cb || function(){};

        console.log("Got scan result:", data)
        
        // Rack positions are harcoded here for now
        const rackPositions = 48;

        writer.saveRackFromDecapper(core.labCore, data, 48, function(err, rack) {
          if(err) {
            console.error(err);
            cb(err);
            return;
          }

          cb();          
        });
      }
    }
  }

  clientConnected(socket) {
    var rpcStream = rpc(this.serverRPC, {});
    
    socket.pipe(rpcStream).pipe(socket)
  }
}

module.exports = DecapperServer;
