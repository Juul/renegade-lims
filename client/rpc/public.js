`use strict`;

const uuid = require('uuid').v4;
const fs = require('fs');

module.exports = function(labDeviceServer, dmScanner, labCore) {
  return {
    
    foo: function(userData, cb) {
      cb(null, "bar");
    },

    // TODO move all of the below to the 'user' namespace

    savePhysical: function(userData, obj, imageData, doPrint, cb) {

      if(imageData) {
        obj.labelPath = idToLabelPath(obj.id);
      }
      if(err) return cb(err);
      savePhysical(labCore, obj, function(err, obj) {
        if(!imageData || err) return cb(err, obj);
        saveLabel(labDeviceServer, obj, imageData, doPrint, function(err) {
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
    
    getOrCreatePlateByBarcode: function(userData, barcode, cb) {
      // TODO implement
      /*
      console.log("get/create plate by barcode");
      cb(null, {
        id: uuid(),
        createdBy: 'juul',
        createdAt: new Date(),
        updatedBy: 'juul', 
        updatedAt: new Date(),
        wells: {
          A1: uuid(),
          A2: uuid()
        }
      });
      */
    },

    getPlate: function(userData, id, cb) {
      // TODO implement
      /*
      console.log("get plate:", id);
      cb(null, {
        id: uuid(),
        createdBy: 'juul',
        createdAt: new Date(),
        updatedBy: 'juul', 
        updatedAt: new Date(),
        wells: {
          A1: uuid(),
          A2: uuid()
        }
      });
      */
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

function idToLabelPath(id) {
  return path.join(settings.labDevice.labelImageFilePath, id+'.png')
}

function printLabel(labDeviceServer, imagePath, cb) {
  labDeviceServer.printLabel('qlPrinter', imagePath, cb);
}

function saveLabel(labDeviceServer, labelData, imageData, doPrint, cb) {
  // TODO validate data
  
  const id = labelData.id;
  
  var mtch;
  if(imageData && (mtch = imageData.match(/^data:image\/png;base64,(.*)/))) {

    var imageBuffer = new Buffer(mtch[1], 'base64');
    
    // TODO size check
    var imagePath = idToLabelPath(id);
    fs.writeFile(imagePath, imageBuffer, function(err) {
      if(err) return cb(err);

      if(doPrint) {
        printLabel(imagePath, function(err) {
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

