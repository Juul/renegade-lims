'use strict';

var fs = require('fs');
var rpc = require('rpc-multistream');

class DecapperServer {

  constructor() {
    
    this.serverRPC = {
      reportScan: (data, cb) => {
        cb = cb || function(){};

        console.log("Got scan result:", data)
        cb();
      }
    }
  }

  clientConnected(socket) {
    var rpcStream = rpc(this.serverRPC, {});
    
    socket.pipe(rpcStream).pipe(socket)
  }
}

module.exports = DecapperServer;
