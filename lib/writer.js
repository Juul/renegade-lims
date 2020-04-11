'use strict';

const timestamp = require('monotonic-timestamp');
const uuid = require('uuid').v4;

const validateUser = require('../validators/user.js');
const userUtils = require('./user.js');


function saveUser(user, password, feed, cb) {
  user = Object.assign({
    type: 'user',
    id: uuid(),
    groups: [],
    createdAt: timestamp(),
    createdBy: 'unknown'
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

  

};

module.exports = writer;

