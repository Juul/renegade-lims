`use strict`;

const fs = require('fs');
const path = require('path');

const timestamp = require('monotonic-timestamp');
const uuid = require('uuid').v4;
const userUtils = require('../lib/user.js');
const writer = require('../lib/writer.js');
const rimbaudAPI = require('../lib/rimbaud.js');

module.exports = function(settings, labDeviceServer, dmScanner, labCore, adminCore, labLocal) {
  return {
    
    getBarcodes: function(userData, remoteIP, howMany, cb) {
      labLocal.getBarcodes(howMany, cb);
    },
    
    savePhysical: function(userData, remoteIP, obj, imageData, doPrint, cb) {

      if(imageData) {
        obj.labelPath = idToLabelPath(settings, obj.id);
      }

      savePhysical(labCore, obj, function(err, obj) {
        if(!imageData || err) return cb(err, obj);

        saveLabel(settings, labDeviceServer, obj, imageData, doPrint, function(err) {
          if(err) return cb(err);
          
          cb(null, obj);
        });
      });
    },

    printLabelAndIncrement: function(userData, remoteIP, imageData, toInc) {
      // TODO implement
    },
    
    printLabel: function(userData, remoteIP, imageData, copies, cb) {
      if(!imageData) return cb(new Error("Image data missing"));
      
      var mtch = imageData.match(/^data:image\/png;base64,(.*)/)
      if(!mtch) return cb(new Error("Image data not in data:image/png;base64 format"));
      
      var imageBuffer = new Buffer.from(mtch[1], 'base64');
      return labDeviceServer.printWherever(imageBuffer, copies, cb);
    },
    
    getPhysical: function(userData, remoteIP, code, cb) {
      // TODO implement
    },

    getPhysicalByBarcode: function(userData, remoteIP, barcode, cb) {
      labCore.api.objectsByBarcode.get(barcode, cb);
    },

    getSwabTubeByFormBarcode: function(userData, remoteIP, formBarcode, cb) {
      labCore.api.swabTubesByFormBarcode.get(formBarcode, cb);
    },
    
    claimDataMatrixScanner: function(userData, remoteIP, cb) {
      if(!dmScanner) return cb(new Error("No Data Matrix scanner configured"));

      // TODO we should unregister when this web client disconnects
      dmScanner.registerCallback(cb);
    },

    saveUser: function(userData, remoteIP, user, password, cb) {
      // TODO check that currently logged in user id matches this user id
      // or that user is in admin group
      // TODO require original password or reset token if changing password
      if(typeof password === 'function') {
        cb = password;
        password = null;
      }
      writer.saveUser(adminCore, user, password, cb);
    },

    saveSwabTube: function(userData, remoteIP, tube, cb) {
      writer.saveSwabTube(labCore, tube, cb);
    },

    savePlate: function(userData, remoteIP, plate, cb) {
      console.log("Saving:",plate);
      writer.savePlate(labCore, plate, cb);
    },

    getPlateByBarcode: function(userData, remoteIP, id, cb) {
      // TODO implement
      throw new Error("Not implemented");
    },
    
    getObject: function(userData, remoteIP, id, cb) {
      labCore.api.objectsByGUID.get(id, cb);
    },

    updatePlate: function(userData, remoteIP, plate, cb) {
      // TODO implement
      cb();
    },

    rimbaudReportResults: function(userData, remoteIP, orderID, data, cb) {
      const rimbaud = rimbaudAPI(settings);

      rimbaud.putResult(orderID, data, cb);
    }
  };
};

function savePhysical(labCore, obj, cb) {
  labCore.writer('inventory', function(err, feed) {
    obj = Object.assign({
      type: 'physical',
      id: uuid(),
      createdAt: timestamp(),
      createdBy: 'unknown',
      isExternal: false,
      isPriority: false
    }, obj);
    
    feed.append(obj, function(err) {
      if(err) return cb(err);
      cb(null, obj);
    });
  });
}

function idToLabelPath(settings, id) {
  return path.join(settings.labDeviceServer.labelImageFilePath, id+'.png')
}

function saveLabel(settings, labDeviceServer, labelData, imageData, doPrint, cb) {
  // TODO validate data
  
  const id = labelData.id;
  
  var mtch;
  if(imageData && (mtch = imageData.match(/^data:image\/png;base64,(.*)/))) {

    var imageBuffer = new Buffer.from(mtch[1], 'base64');
    
    // TODO size check
    var imagePath = idToLabelPath(settings, id);
    fs.writeFile(imagePath, imageBuffer, function(err) {
      if(err) return cb(err);

      if(doPrint) {
        labDeviceServer.printWherever(imagePath, function(err) {
          if(err) return cb(err);
          cb(null, id, imagePath);
        });
      } else {
        cb(null, id, imagePath);
      }
      
    });
  } else{
    cb(null, id);
  }
  
}


