'use strict';

const crypto = require('crypto');
const shasum = require('shasum');

const userUtils = {

  generateSalt: function() {
    return crypto.randomBytes(16);
  },

  hash: function(salt, password) {
    if(!(salt instanceof Buffer)) {
      salt = Buffer.from(salt, 'hex')
    }
    if(!(password instanceof Buffer)) {
      password = Buffer.from(password)
    }

    const sum = shasum(Buffer.concat([salt, password]));
    return sum;
  },
  
  saltAndHash(salt, password) {
    if(!password) {
      password = salt;
      salt = userUtils.generateSalt();
    } else if(typeof salt === 'string') {
      salt = Buffer.from(salt, 'hex');
    }

    if(!(salt instanceof Buffer) || salt.length !== 16) {
      throw new Error("Supplied salt must be a 16 byte Buffer or the same encoded as a hex string");
    }

    if(!password) {
      throw new Error("No password supplied");
    }

    return {
      salt: salt.toString('hex'),
      hash: userUtils.hash(salt, password)
    };
  },

  verify(salt, hash, password) {
    if(typeof salt === 'string') {
      salt = Buffer.from(salt, 'hex');
    };

    if(!salt || !salt.length) {
      throw new Error("Salt is missing");
    }

    if(!hash || !hash.length) {
      throw new Error("Hash is missing");
    }

    if(!password || !password.length) {
      throw new Error("Hash is missing");
    }

    if(hash !== userUtils.hash(salt, password)) {
      return false;
    }
    
    return true;
  },

  verifyUser(user, password) {
    if(userUtils.verify(user.password.salt, user.password.hash, password)) {
      return user;
    }
    return null;
  },
  
  verifyAll(users, password) {
    var user;
    for(user of users) {
      if(!user.password) continue;
      if(userUtils.verify(user.password.salt, user.password.hash, password)) {
        return user;
      }
    }
    return null;
  }

};


module.exports = userUtils;


