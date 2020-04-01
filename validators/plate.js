'use strict';

var validateObject = require('./object.js');

module.exports = function(plate) {
  if(!validateObject(plate)) return false
  const val = plate.value;
  if(val.type !== 'plate') return false;

  // TODO complete this
  
  return true;
}
