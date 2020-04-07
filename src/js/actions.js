'use strict';

import auth from 'rpc-multiauth';
import { route } from 'preact-router';


function navigateToObject(item) {
  if(item.type === 'plate') {
    route('/plate/'+encodeURIComponent(item.id));
  } else{
    console.log("TODO no view for item type:", item.type);
  }
}

module.exports = function() {
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

    login: function(username, password, cb) {
      app.rpc.login(username, password, cb);
    },

    logout: function(cb) {
      app.rpc.logout(cb);
    },

    connectMessage(isConnected, msg, delay) {
      // TODO implement
      console.log("Connect message:", isConnected, msg, delay);
    },


    // TODO remove debug function
    increase: function() {
      app.state.count++;
    }
  }
}
