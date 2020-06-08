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
  printWherever(paperMatch, data, copies, cb) {
    cb = cb || function(){};
    data = pathToStream(data); // if path, convert to stream

    const printers = this.getPrinters(paperMatch);
    if(!printers.length) return cb(new Error("No printers of specified type connected"));
    return printers[0].print(data, copies, cb);
  }

  // data can be a path (string), a stream or a buffer
  printOn(clientID, index, data, copies, cb) {
    data = pathToStream(data); // if path, convert to stream
    const client = this.clients[clientID];
    if(!client) return cb(new Error("No such client "+clientID+" is connected"));

    const printer = client.devices[index];
    if(!client) return cb(new Error("No such printer "+index+" exists on client "+clientID));

    if(!printer.print) return cb(new Error("Device "+index+" on client "+clientID+" is not a printer"));

    return client.remote.print(index, data, copies, cb);
  }

  getPrinter(device, client) {
    var printer = device;
    printer.clientID = client.id;
    printer.clientName = client.name;
    
    printer.print = function(data, copies, cb) {
      return this.printOn(printer.clientID, printer.index, data, copies, cb);
    }.bind(this);

    return printer;
  }
  
  getPrinters(paperMatch) {
    const printers = [];
    for(let id in this.clients) {
      let client = this.clients[id];
      if(!client.devices || !client.devices.length) continue;

      for(let device of client.devices) {
        if(!paperMatch) {
          if(!device.type.match(/printer$/i)) continue;
        } else {
          if(!device.labels || !device.labels.name || !device.labels.name.match(new RegExp(paperMatch, 'i'))) {
            continue;
          }
        }
        let printer = this.getPrinter(device, client);
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
