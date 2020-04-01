'use strict';

var validateObject = require('./object.js');

module.exports = function(swab) {
  if(!validateObject(swab)) return false
  const val = swab.value;
  if(val.type !== 'swab') return false;

  // TODO complete this
  
  return true;
}
