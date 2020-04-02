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
  },

  decamelize(str, separator) {
	  separator = (typeof separator === 'undefined') ? '_' : separator;

	  return str
      .replace(/([a-z\d])([A-Z])/g, '$1' + separator + '$2')
      .replace(/([A-Z]+)([A-Z][a-z\d]+)/g, '$1' + separator + '$2')
      .toLowerCase();
  }
  
}
