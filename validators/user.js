'use strict';

var validateObject = require('./object.js');

module.exports = function(o) {
  if(!validateObject(o)) return false
  const val = o.value;
  if(val.type !== 'user') return false;

  if(!val.name) return false;
  if(!val.password) return false;
  
  return true;
}
