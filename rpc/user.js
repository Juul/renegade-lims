`use strict`;

const fs = require('fs');
const path = require('path');

const async = require('async');
const rpc = require('rpc-multistream');
const timestamp = require('monotonic-timestamp');
const uuid = require('uuid').v4;
const eds = require('eds-handler');
const userUtils = require('../lib/user.js');
const writer = require('../lib/writer.js');
const csv = require('../lib/csv.js');
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

    printLabel: function(userData, remoteIP, printerType, imageData, copies, cb) {
      if(!imageData) return cb(new Error("Image data missing"));
      
      var mtch = imageData.match(/^data:image\/png;base64,(.*)/)
      if(!mtch) return cb(new Error("Image data not in data:image/png;base64 format"));
      
      var imageBuffer = new Buffer.from(mtch[1], 'base64');
      return labDeviceServer.printWherever(printerType, imageBuffer, copies, cb);
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

    saveUser: function(userData, remoteIP, user, opts, cb) {
      if(typeof opts === 'function') {
        cb = opts;
        opts = {};
      }
      opts = opts || {};

      adminCore.api.usersByGUID.get(user.id, function(err, prevUser) {
        if(err) return cb(err);
  
        if(userData.groups.indexOf('admin') < 0) {
          if(userData.id !== user.id) {
            return cb(new Error("You can only change your own user"));
          }
          
          if(!opts.password) return cb(new Error("Missing password"));
                  
          try {
            userUtils.verifyUser(user, opts.password);
          } catch(err) {
            return cb(err);
          }
          
          if(!user) {
            return cb(new Error("Incorrect password"));
          }

        // admin user changing their own user
        } else if(userData.id === user.id) {
          // admin user must repeat their password to change it
          if(opts.password && (opts.password !== opts.repeatPassword)) {
            return cb(new Error("Repeated password does not match password"));
          }
        }

        writer.saveUser(adminCore, user, opts.password, cb);
      });
      
    },

    saveSwabTube: function(userData, remoteIP, tube, cb) {
      writer.saveSwabTube(labCore, tube, cb);
    },

    saveQpcrResult: function(userData, remoteIP, result, cb) {
      console.log("Saving qPCR result:", result);
      writer.saveQpcrResult(labCore, result, cb);
    },
    
    savePlate: function(userData, remoteIP, plate, cb) {
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

    rimbaudReportResult: function(userData, remoteIP, orderID, data, cb) {
      const rimbaud = rimbaudAPI(settings);

      rimbaud.putResult(orderID, data, cb);
    },

    csvGetSamples: function(userData, remoteIP, cb) {
      csv.getSamples(labCore, cb);
    },

    csvGetPlates: function(userData, remoteIP, cb) {
      csv.getPlates(labCore, cb);
    },
    
    csvGetQpcrResults: function(userData, remoteIP, cb) {
      csv.getQpcrResults(labCore, cb);
    },

    generateEDSFile: function(userData, remoteIP, dirpath, filename, data, cb) {
      eds.generate(dirpath, filename, data, settings.eds, 'nodebuffer', function(err, buf) {
        if(err) return cb(err);

        cb(null, 'data:application/zip;base64,'+buf.toString('base64'));
      })
    },

    getResultsForSampleBarcode: function(userData, remoteIP, barcode, cb) {
      labCore.api.qpcrResultBySampleBarcode.get(barcode, cb);
    },

    getResultsForSampleBarcodes: function(userData, remoteIP, barcodes, cb) {
      var ret = {};
      
      async.eachSeries(barcodes, (barcode, next) => {

        labCore.api.qpcrResultBySampleBarcode.get(barcode, (err, results) => {
          if(err) return next(err);

          ret[barcode] = results;
          next();
        });
      }, function(err) {
        if(err) return cb(err);
        cb(null, ret);
      });

    },
    
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


