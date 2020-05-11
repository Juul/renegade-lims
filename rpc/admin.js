`use strict`;

const fs = require('fs');
const path = require('path');

const async = require('async');
const rpc = require('rpc-multistream');
const timestamp = require('monotonic-timestamp');
const uuid = require('uuid').v4;
const userUtils = require('../lib/user.js');
const writer = require('../lib/writer.js');


module.exports = function(settings, labDeviceServer, dmScanner, labCore, adminCore, labLocal) {
  return {
    
    getUsers: function(userData, remoteIP, cb) {
      var users = [];
      var stream = adminCore.api.usersByName.read();
      
      stream.on('data', function(user) {
        users.push(JSON.parse(user));
      });

      stream.on('end', function() {
        cb(null, users);
      });
      stream.on('error', cb);
    },
    
    getUser: function(userData, remoteIP, id, cb) {
      adminCore.api.usersByGUID.get(id, cb);
    }
    
  };
};


