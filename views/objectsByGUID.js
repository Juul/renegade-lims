'use strict';

const through = require('through2');

const u = require('./common/utils.js');
const nicify = require('./common/nicify.js');
const validateObject = require('../validators/object.js');

function sortByTimestamp(a, b) {
  return a.ts - b.ts;
}

module.exports = function(db) {
  return {
    // Called with a batch of log entries to be processed by the view.
    // No further entries are processed by this view until 'next()' is called.
    map: function(entries, next) {

      const firstPass = [];
      entries.forEach(function(entry) {
        if(!validateObject(entry)) return;
        
        nicify(entry);

        entry.ts = u.monotonicTimestampToTimestamp(entry.value.createdAt);
      });

      // Sort entries by creation time so that if we got multiple entries
      // for the same GUID then the newer will overwrite the older in the view
      firstPass.sort(sortByTimestamp);

      const batch = [];
      firstPass.forEach(function(entry) {

        db.get(entry.value.id, function(err, oldEntry) {
          if(!err && oldEntry) {
            // If the db has a newer value already, don't overwrite with this one
            if(entry.ts < u.monotonicTimestampToTimestamp(oldEntry.value.createdAt)) {
              return;
            }
          }
          batch.push({
            type: 'put',
            key: entry.value.id,
            value: entry.value
          });
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


