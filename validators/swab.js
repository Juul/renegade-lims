'use strict';


function validateUUID(uuid) {
  // TODO implement
  if(!uuid) return false
  return true
}

function validateTimestamp(stamp) {
  // TODO implement
  if(!stamp) return false
  return true
}

module.exports = function(swab) {
  const val = swab.value;
  if(val.type !== 'swab') return false;
  if(!validateUUID(val.id)) return false;
  if(!validateTimestamp(val.createdAt)) return false;
  
  return true;
}
