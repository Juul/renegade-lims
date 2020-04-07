'use strict';

var rpc = require('rpc-multistream');

class LabDeviceServer {

  constructor() {

    this.clients = {};
    
    this.serverRPC = {
      reportScan: (code, cb) => {
        cb = cb || function(){};

        // TODO report to web peers (if any)
        console.log("Got scan result:", code)
        cb();
      }
    }
  }

  clientConnected(socket, cb) {
    var rpcStream = rpc(this.serverRPC, {});
    
    rpcStream.on('methods', (remote) => {
      
      remote.identify((err, info) => {
        if(err) return cb(err);
        
        this.addClient(info.id, info.name, remote);
        
        socket.on('close', () => {
          this.delClient(info.id);
        });
      });
    });
    
    socket.pipe(rpcStream).pipe(socket)
  }
  
  printWherever(readStream, cb) {
    cb = cb || function(){};
    const printers = this.getPrinters();
    if(!printers.length) return cb(new Error("No printers connected"));

    return printers.print(readStream, cb);
  }
  
  printOn(clientID, index, readStream, cb) {
    const client = this.clients[id];
    if(!client) return cb(new Error("No such client "+clientID+" is connected"));

    const printer = client.devices[index];
    if(!client) return cb(new Error("No such printer "+index+" exists on client "+clientID));

    if(!printer.print) return cb(new Error("Device "+index+" on client "+clientID+" is not a printer"));

    return client.remote.print(index, readStream, cb);
  }

  getPrinters() {
    const printers = [];
    var id, client, device, printer;
    for(id in this.clients) {
      client = this.clients[id];
      if(!client.devices || !client.devices.length) continue;
      
      for(device of client.devices) {
        if(!device.type.match(/printer$/i)) continue;

        printer = device;
        printer.clientID = client.id;
        printer.clientName = client.name;

        printer.print = function(readStream, cb) {
          return this.printOn(printer.clientID, printer.index, readStream, cb);
        }.bind(this);
      }
    }
    return printers;
  }
  
  addClient(info, remote) {
    if(!info.id) return;
    
    this.clients[info.id] = {
      id: info.id,
      name: info.name,
      remote: remote,
      devices: info.devices
    };
  }

  delClient(id) {
    delete this.clients[id];
  }

}

module.exports = LabDeviceServer;
