'use strict';

var validateObject = require('./object.js');

module.exports = function(o) {
  if(!validateObject(o)) return false
  const val = o.value;
  if(val.type !== 'swabTube') return false;

  if(!val.barcode) return false;
  if(!val.formBarcode) return false;
  
  return true;
}
