'use strict';

const timestamp = require('monotonic-timestamp');
const isEmail = require('sane-email-validation')
const uuid = require('uuid').v4;
const async = require('async');

const validateUser = require('../validators/user.js');
const validateSwabTube = require('../validators/swab_tube.js');
const validateRack = require('../validators/rack.js');
const validatePlate = require('../validators/plate.js');
const validateQpcrResult = require('../validators/qpcr_result.js');
const userUtils = require('./user.js');
const settings = require('../settings.js');

const writer = {

        // TODO ensure that user with that ID does not already exist
      // and check that user with that name does not exist
  saveUser: function(adminCore, user, password, cb) {
    adminCore.writer('users', function(err, feed) {
      if(err) return cb(err);
      
      saveUser(adminCore, user, password, feed, cb);
      
    });
  },

  saveQpcrResult: function(labCore, result, cb) {

    // The caller is expected to supplya v4 UUID as result.id
    // The reason we're letting the client set the ID is that
    // this ID is actually generated when the .eds file is generated
    labCore.writer('results', function(err, feed) {
      if(err) return cb(err);
      
      const res = Object.assign({
        type: 'qpcrResult',
        createdAt: timestamp(),
        createdBy: 'unknown' // TODO
      }, result);
      
      if(!validateQpcrResult({value: res})) {
        return cb(new Error("Failed to validate QPCR result"));
      }

      return append(feed, res, cb);
    });
  },


  // Save a rack and save all tubes in the rack as individual swabTubes
  saveRackFromDecapper: function(labCore, rackData, positions, cb) {
    labCore.writer('inventory', function(err, feed) {    
      var rack = {
        type: 'rack',
        barcode: rackData.rackBarcode,
        createdAt: timestamp(),
        parsedAt: rackData.parsedAt,
        createdBy: 'DeCapper',
        positions: positions,
        tubes: {}
      };

      if(rack.barcode) rack.barcode = rack.barcode.toLowerCase();
      
      labCore.api.objectsByBarcode.get(rack.barcode, (err, oldRack) => {
        if(err && !err.notFound) return cb(err);

        if(oldRack) {
          rack.id = oldRack.id;
        } else {
          rack.id = uuid();
        }

        if(!validateRack({value: rack})) {
          return cb(new Error("Failed to validate rack"));
        }
        
        const wellNames = Object.keys(rackData.wells || {});

        async.eachSeries(wellNames, function(wellName, next) {
          const well = rackData.wells[wellName];

          const tube = {
            barcode: well.barcode
          };

          writer.saveSwabTube(labCore, tube, function(err, tube) {
            if(err) return cb(err);
            
            rack.wells[wellName] = {
              positionName: wellName,
              id: tube.id,
              barcode: tube.barcode
            };

            next();
          });
          
        }, function(err) {
          if(err) return cb(err);

          console.log("SAVING:", rack);
          append(feed, rack, cb);
        });
      });
    });
  },
    
  // Save a swab tube with its barcode and association to an accession ID/barcode
  saveSwabTube: function(labCore, swabTube, cb) {
    labCore.writer('inventory', function(err, feed) {
      if(err) return cb(err);

      const hadID = swabTube.id;
      swabTube = Object.assign({
        type: 'swabTube',
        id: uuid(),
        createdAt: timestamp(),
        createdBy: 'unknown' // TODO
      }, swabTube);
 
      if(!validateSwabTube({value: swabTube})) {
        return cb(new Error("Failed to validate swab tube"));
      }

      labCore.api.swabTubesByFormBarcode.get(swabTube.formBarcode, (err, tube) => {
        if(err && !err.notFound) return cb(err);
        
        if(tube) {
          if(tube.id !== swabTube.id
             || tube.barcode !== swabTube.barcode) {
            console.log("Warning: Trying to save a new sample tube with same order form barcode as an existing sample tube. Only one sample tube barcode per sample order form ID is allowed.");
          }
        }

        if(!hadID) return append(feed, swabTube, cb);
        
        labCore.api.objectsByGUID.get(swabTube.id, function(err, oldSwabTube) {
          if(err) return append(feed, swabTube, cb);
          
          swabTube.changed = getChanged(oldSwabTube, swabTube);
          
          append(feed, swabTube, cb);
        });
      });
    });
  },

  savePlate(labCore, plate, cb) {
    labCore.writer('inventory', function(err, feed) {
      if(err) return cb(err);

      plate = Object.assign({
        type: 'plate',
        id: uuid(),
        createdAt: timestamp(),
        createdBy: 'unknown' // TODO
      }, plate);

      if(!validatePlate({value: plate})) {
        return cb(new Error("Failed to validate plate"));
      }

      labCore.api.objectsByGUID.get(plate.id, function(err, oldPlate) {
        if(err) return append(feed, plate, cb);

        // TODO find list of samples that were removed since last save
        // then add them to a .deleted property
        // and have the view for sample -> plate reverse lookups

        append(feed, plate, cb);
      });
    });
  }  
};

function saveUser(adminCore, user, password, feed, cb) {

  const hadID = user.id;
  user = Object.assign({
    type: 'user',
    id: uuid(),
    groups: ['user'],
    createdAt: timestamp(),
    createdBy: 'unknown' // TODO
  }, user);

  // Ensure the user is in the 'user' group
  if(!user.groups) {
    user.groups = ['user'];
  } else if(user.groups.indexOf('user') < 0) {
    user.groups.push('user');
  }
  
  if(user.name.replace(/[a-zA-Z\d\.\-_]+/g, '')) {
    return cb(new Error("Usernames can only contain letters, numbers, dots, dashes and underscores"));
  }
  
  if(user.email && !isEmail(user.email)) {
    return cb(new Error("Invalid email address"));
  }
  
  if(password) {
    try {
      user.password = userUtils.saltAndHash(password);
    } catch(err) {
      return cb(err);
    }
  }

  if(!validateUser({value: user})) {
    return cb(new Error("Failed to validate user"));
  }

  if(!hadID) return append(feed, user, cb);

  adminCore.api.usersByGUID.get(user.id, function(err, oldUser) {
    if(err) return append(feed, user, cb);
    
    user.changed = getChanged(oldUser, user);

    if(!user.password) {
      user.password = oldUser.password;
    }
    append(feed, user, cb);
  });

  append(feed, user, cb);
//  feed.append(user, function(err) {
//    if(err) return cb(err);
//    cb(null, user);
//  });
}


function append(feed, o, cb) {
  if(settings.lab) {
    o.lab = o.lab || settings.lab;
  }
  feed.append(o, function(err) {
    if(err) return cb(err);
    cb(null, o);
  });
}

// TODO make this recursive
// TODO compare non-simple values like buffers
// Find changed fields between old and new
function getChanged(o, n) {
  const changed = {};
  var key;
  for(key in o) {
    if(key === 'changed') continue;
    if(o[key] !== n[key]) {
      changed[key] = o[key];
    }
  }
  return changed;
}

module.exports = writer;

