'use strict';

const timestamp = require('monotonic-timestamp');
const uuid = require('uuid').v4;

const userUtils = require('./user.js');

const writer = {
  
  saveUser: function(adminCore, obj, password, cb) {
    // TODO validate user
    adminCore.writer('users', function(err, feed) {
      obj = Object.assign({
        type: 'user',
        id: uuid(),
        groups: [],
        createdAt: timestamp(),
        createdBy: 'unknown'
      }, obj);

      if(password) {
        try {
          obj.password = userUtils.saltAndHash(password);
        } catch(err) {
          return cb(err);
        }
      }
      
      feed.append(obj, function(err) {
        if(err) return cb(err);
        cb(null, obj);
      });
    });
  }

};

module.exports = writer;

