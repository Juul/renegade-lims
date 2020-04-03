`use strict`;

const fs = require('fs');
const path = require('path');

const timestamp = require('monotonic-timestamp');
const uuid = require('uuid').v4;
const userUtils = require('../lib/user.js');
const writer = require('../lib/writer.js');

module.exports = function(settings, labDeviceServer, dmScanner, labCore, adminCore) {
  return {
    
    foo: function(userData, cb) {
      cb(null, "bar");
    },

    // TODO move all of the below to the 'user' namespace

    savePhysical: function(userData, obj, imageData, doPrint, cb) {

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
    
    getPhysical: function(userData, code, cb) {
      
    },

    getPhysicalByBarcode: function(userData, code, cb) {

    },
    
    claimDataMatrixScanner: function(userData, cb) {
      if(!dmScanner) return cb(new Error("No Data Matrix scanner configured"));

      // TODO we should unregister when this web client disconnects
      dmScanner.registerCallback(cb);
    },

    saveUser: function(user, password, cb) {
      // TODO check that currently logged in user id matches this user id
      // or that user is in admin group
      // TODO require original password or reset token if changing password
      if(typeof password === 'function') {
        cb = password;
        password = null;
      }
      writer.saveUser(adminCore, user, password, cb);
    },

    getPlateByBarcode: function(id, cb) {
      // TODO implement
      throw new Error("Not implemented");
    },
    
    getObject: function(userData, id, cb) {
      labCore.api.objectsByGUID.get(id, cb);
    },

    updatePlate: function(userData, plate, cb) {
      // TODO implement
      cb();
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
  return path.join(settings.labDevice.labelImageFilePath, id+'.png')
}

function printLabel(labDeviceServer, imagePath, cb) {
  labDeviceServer.printLabel('qlPrinter', imagePath, cb);
}

function saveLabel(settings, labDeviceServer, labelData, imageData, doPrint, cb) {
  // TODO validate data
  
  const id = labelData.id;
  
  var mtch;
  if(imageData && (mtch = imageData.match(/^data:image\/png;base64,(.*)/))) {

    var imageBuffer = new Buffer(mtch[1], 'base64');
    
    // TODO size check
    var imagePath = idToLabelPath(settings, id);
    fs.writeFile(imagePath, imageBuffer, function(err) {
      if(err) return cb(err);

      if(doPrint) {
        printLabel(labDeviceServer, imagePath, function(err) {
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

