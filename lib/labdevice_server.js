'use strict';

var fs = require('fs');
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

        this.addClient(info, remote);
        
        socket.on('close', () => {
          this.delClient(info.id);
        });
      });
    });
    
    socket.pipe(rpcStream).pipe(socket)
  }

  // data can be a path (string), a stream or a buffer
  printWherever(data, cb) {
    cb = cb || function(){};
    data = pathToStream(data); // if path, convert to stream

    const printers = this.getPrinters();
    if(!printers.length) return cb(new Error("No printers connected"));

    return printers[0].print(data, cb);
  }

  // data can be a path (string), a stream or a buffer
  printOn(clientID, index, data, cb) {
    data = pathToStream(data); // if path, convert to stream
    const client = this.clients[clientID];
    if(!client) return cb(new Error("No such client "+clientID+" is connected"));

    const printer = client.devices[index];
    if(!client) return cb(new Error("No such printer "+index+" exists on client "+clientID));

    if(!printer.print) return cb(new Error("Device "+index+" on client "+clientID+" is not a printer"));

    return client.remote.print(index, data, cb);
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

        printer.print = function(data, cb) {
          return this.printOn(printer.clientID, printer.index, data, cb);
        }.bind(this);
        printers.push(printer);
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

function pathToStream(o) {
  if(typeof o === 'string') {
    return fs.createReadStream(o);
  }
  return o;
}
