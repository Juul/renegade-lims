'use strict';

var validateObject = require('./object.js');

module.exports = function(o) {
  if(!validateObject(o)) return false
  const val = o.value;
  if(val.type !== 'plate' && val.type !== 'rack') return false;

  if(!val.barcode) return false;
  
  return true;
}
