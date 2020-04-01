'use strict';

var u = require('./common/utils.js');

// Validation for any and all objects in the database

module.exports = function(o) {
  const val = o.value;
  if(!u.validateUUID(val.id)) return false;
  if(!u.validateTimestamp(val.createdAt)) return false;
  return true;
}
