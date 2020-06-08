'use strict';

var validateObject = require('./object.js');

module.exports = function(o) {
  if(!validateObject(o)) return false
  const val = o.value;
  if(val.type !== 'rack') return false;
  if(!val.barcode) return false;
  if(!val.positions
     || typeof val.positions !== 'number'
     || val.positions < 1) return false;
  
  return true;
}
