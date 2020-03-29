'use strict';

import { route } from 'preact-router';


function navigateToPhysical(item) {
  if(item.type === 'plate') {
    route('/plate/'+item.id);
  } else{
    console.log("TODO no view for item type:", item.type);
  }
}

module.exports = function(state) {
  return {

    // TODO implement a proper notify
    notify: function(msg, level) {
      if(level === 'error') {
        alert(msg);
      } else {
        console.log("[notify]", msg);
      }
    },
    
    // Find and show a physical by uuid
    gotoPhysical: function(id) {
      app.remote.getPhysical(id, function(err, item) {
        if(err) return app.error(err);

        console.log("Got physical item:", item);
        
        navigateToPhysical(item);
      });
    },

    gotoPhysicalByBarcode: function(code) {
      app.remote.getPhysicalByBarcode(code, function(err, item) {
        if(err) return app.error(err);

        console.log("Got physical item:", item);
        
        navigateToPhysical(item);
      });
    },

    // TODO remove debug function
    increase: function() {
      state.count++;
    }
  }
}
