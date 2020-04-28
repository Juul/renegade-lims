'use strict';

import auth from 'rpc-multiauth';
import { route } from 'preact-router';


function navigateToObject(item) {
  if(item.type === 'plate') {
    route('/plate/'+encodeURIComponent(item.id));
  } else{
    console.log("TODO no view for item type:", item.type);
  }
}

module.exports = function() {
  return {

    // TODO this is only here for backwards compatibility
    // we should get rid of all calls to app.actions.notify
    notify: function(msg, level) {
      app.notify(msg, level);
    },
    
    // Get some guaranteed unique non-guid barcodes from the server
    getBarcodes: function(howMany, cb) {
      app.remote.getBarcodes(howMany, cb);
    },
    
    // Find and show a physical by uuid
    gotoPhysical: function(id) {
      app.remote.getPhysical(id, function(err, item) {
        if(err) return app.error(err);

        console.log("Got physical item:", item);
        
        navigateToPhysical(item);
      });
    },

    // Find and show an object by uuid
    getObject: function(id, cb) {
      app.remote.getObject(id, cb);
    },

    getPhysicalByBarcode: function(code, cb) {
      app.remote.getPhysicalByBarcode(code, cb);
    },
    
    getSwabTubeByFormBarcode: function(code, cb) {
      app.remote.getSwabTubeByFormBarcode(code, cb);
    },
    
    gotoPhysicalByBarcode: function(code) {
      app.remote.getPhysicalByBarcode(code, function(err, item) {
        if(err) return app.error(err);

        console.log("Got physical item:", item);
        
        navigateToPhysical(item);
      });
    },

    saveSwabTube(tube, cb) {
      app.remote.saveSwabTube(tube, cb);
    },

    savePlate(plate, cb) {
      app.remote.savePlate(plate, cb);
    },

    savePhysical(labelData, imageData, doPrint, cb) {
      app.remote.savePhysical(labelData, imageData, doPrint, cb);
    },

    printLabel(imageData, copies, cb) {
      app.remote.printLabel(imageData, copies, cb);
    },
    
    login: function(username, password, cb) {
      app.rpc.login(username, password, cb);
    },

    signup: function(user, password, masterPassword, cb) {
      console.log("SIGNING UP!");
      app.remote.signup(user, password, masterPassword, cb);
    },

    logout: function(cb) {
      app.rpc.logout(cb);
    },

    connectMessage(isConnected, msg, delay) {
      // TODO implement
      console.log("Connect message:", isConnected, msg, delay);
    },

    saveQpcrResult: function(result, cb) {
      app.remote.saveQpcrResult(result, cb);
    },
    
    rimbaudReportResult(orderID, data, cb) {
      app.remote.rimbaudReportResult(orderID, data, cb);
    },

    csvGetSamples(cb) {
      app.remote.csvGetSamples(cb);
    },

    csvGetPlates(cb) {
      app.remote.csvGetPlates(cb);
    },
    
    csvGetQpcrResults(cb) {
      app.remote.csvGetQpcrResults(cb);
    },
    
    generateEDSFile: function(dirpath, filename, data, cb) {
      app.remote.generateEDSFile(dirpath, filename, data, cb);
    },
    

    // TODO remove debug function
    increase: function() {
      app.state.count++;
    }
  }
}
