'use strict';

const through = require('through2');

const nicify = require('./common/nicify.js');
const validateObject = require('../validators/object.js');

module.exports = function(db) {
  return {
    // Called with a batch of log entries to be processed by the view.
    // No further entries are processed by this view until 'next()' is called.
    map: function(entries, next) {
      
      const batch = [];
      entries.forEach(function(entry) {
        if(!validateObject(entry)) return;
        
        nicify(entry);
        
        batch.push({
          type: 'put',
          key: entry.value.id,
          value: entry.value
        });
      })

      if(!batch.length) return next();
      db.batch(batch, {valueEncoding: 'json'}, next);
    },
    
    api: {
      get: function(key, cb) {
        this.ready(function() { // wait for all views to catch up
          db.get(key, cb)
        })
      }
    }
  }
};


