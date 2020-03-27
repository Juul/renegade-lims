'use strict';

module.exports = function(state) {
  return {
    
    increase: function() {
      state.count++;
    }

  }
}
