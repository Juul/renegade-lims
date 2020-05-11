`use strict`;

const fs = require('fs');
const path = require('path');

const timestamp = require('monotonic-timestamp');
const uuid = require('uuid').v4;
const userUtils = require('../lib/user.js');
const writer = require('../lib/writer.js');
const antiBruteforce = require('../lib/anti_bruteforce.js');

module.exports = function(settings, labDeviceServer, dmScanner, labCore, adminCore) {
  return {
    
    foo: function(userData, remoteIP, cb) {
      cb(null, "bar");
    },

    // TODO limit number of attempts per source IP
    signup: function(userData, remoteIP, user, password, masterPassword, cb) {
      
      if(!settings.masterPassword) {
        return cb(new Error("The server administrator has disabled master password functionality")); 
      }

      if(!user || !user.name || !password || !masterPassword) {
        return cb(new Error("You must supply a username, password and master password"));
      }

      adminCore.api.usersByName.get(user.name, function(err, users) {
        if(err && !err.notFound) return cb(err);
        if(users && users.length) {
          return cb(new Error("Username already taken"));
        }

        antiBruteforce(settings.attemptsLog, remoteIP, null, function(err) {
          if(err) return cb(err);
          
          if(masterPassword !== settings.masterPassword) {  
            cb(new Error("Wrong master password"));
            return;
          }

          writer.saveUser(adminCore, user, password, cb);
        });
        
      });
    }
  }

};
