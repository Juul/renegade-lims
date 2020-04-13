'use strict';

const timestamp = require('monotonic-timestamp');
const uuid = require('uuid').v4;

const validateUser = require('../validators/user.js');
const validateSwabTube = require('../validators/swab_tube.js');
const validatePlate = require('../validators/plate.js');
const userUtils = require('./user.js');

const writer = {

        // TODO ensure that user with that ID does not already exist
      // and check that user with that name does not exist
  saveUser: function(adminCore, user, password, masterPassword, skipCheck, cb) {
    adminCore.writer('users', function(err, feed) {
      if(err) return cb(err);
      
      if(skipCheck) {
        saveUser(user, password, feed, cb);
        return;
      }

      // TODO this is the server. not the client. there is no `app`
      if(!app.user) {
        return cb(new Error("Not logged in"));
      }
      
      if(user.id) { // modifying existing user
        if(!app.user || app.user.id !== user.id) {
          return cb(new Error("Non-admin user attempting to modify a user other than themselves"));
          
        }
      } else {
        if(app.user.indexOf('admin') < 0) {
          return cb(new Error("Non-admin trying to create new user"));
        }
      }
      
      saveUser(user, password, feed, cb);
      
    });
  },

  // Save a swab tube with its barcode and association to an accession ID/barcode
  saveSwabTube(labCore, swabTube, cb) {
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

      if(!hadID) return append(feed, swabTube, cb);
      
      labCore.api.objectsByGUID.get(swabTube.id, function(err, oldSwabTube) {
        if(err) return append(feed, swabTube, cb);

        swabTube.changed = getChanged(oldSwabTube, swabTube);

        append(feed, swabTube, cb);
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

        
        console.log("WRITING:", plate);
        append(feed, plate, cb);
      });
    });
  }
  
  
};

function saveUser(user, password, feed, cb) {
  user = Object.assign({
    type: 'user',
    id: uuid(),
    groups: [],
    createdAt: timestamp(),
    createdBy: 'unknown' // TODO
  }, user);
  
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
  
  feed.append(user, function(err) {
    if(err) return cb(err);
    cb(null, user);
  });
}


function append(feed, o, cb) {
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
    if(o[key] !== n[key]) {
      changed[key] = o[key];
    }
  }
  return changed;
}

module.exports = writer;

