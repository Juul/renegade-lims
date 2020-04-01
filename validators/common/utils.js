'use strict';

const uuidRegExp = new RegExp(/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i);

module.exports = {

  validateUUID: function(uuid) {
    if(!uuid || !uuid.match(uuidRegExp)) {
      return false;
    }
    return true;
  },

  validateTimestamp: function(stamp) {
    // TODO implement
    if(!stamp) return false;
    return true; 
  }
  
}
