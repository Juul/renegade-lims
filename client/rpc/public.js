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

    createUser: function(user, password, cb) {
      // TODO ensure that user with that ID does not already exist
      // and check that user with that name does not exist
      
      // TODO Check master password
      
//      writer.saveUser(adminCore, user, password, cb);
    }
  }

};
