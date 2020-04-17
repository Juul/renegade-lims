'use strict';

var validateObject = require('./object.js');

module.exports = function(o) {
  if(!validateObject(o)) return false
  const val = o.value;
  if(val.type !== 'qpcrResult') return false;

  if(!val.plateID) return false;
  if(!val.csvData) return false;

  // val.result contains actual result data and is optional
  
  return true;
}
