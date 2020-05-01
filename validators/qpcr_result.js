'use strict';

var validateObject = require('./object.js');

module.exports = function(o) {
  if(!validateObject(o)) return false
  const val = o.value;
  if(val.type !== 'qpcrResult') return false;

  if(!val.plateID) return false;
  if(!val.plateBarcode) return false;
  if(!val.edsFileData) return false;
  if(!val.wells) return false;
  
  return true;
}
