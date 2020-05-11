'use strict';

const async = require('async');
const through = require('through2');

const u = require('./common/utils.js');
const nicify = require('./common/nicify.js');
const validateSwabTube = require('../validators/swab_tube.js');

function sortByTimestamp(a, b) {
  return a.ts - b.ts;
}

module.exports = function(db) {
  return {
    // Called with a batch of log entries to be processed by the view.
    // No further entries are processed by this view until 'next()' is called.
    map: function(entries, next) {

      const firstPass = [];
      var entry;
      for(entry of entries) {
        if(!validateSwabTube(entry)) {
          continue;
        }
        nicify(entry);

        entry.ts = u.monotonicTimestampToTimestamp(entry.value.createdAt);
        firstPass.push(entry);
      }
      // Sort entries by creation time so that if we got multiple entries
      // for the same GUID then the newer will overwrite the older in the view
      firstPass.sort(sortByTimestamp);

      const batch = [];
      async.eachSeries(firstPass, function(entry, next) {
        
        db.get(entry.value.id, function(err, oldEntry) {
          if(!err && oldEntry) {
            // If the db has a newer value already, don't overwrite with this one
            if(entry.ts < u.monotonicTimestampToTimestamp(oldEntry.value.createdAt)) {
              return next();
            }
          }
          batch.push({
            type: 'put',
            key: entry.value.formBarcode,
            value: entry.value
          });

          if(entry.value.changed && entry.value.changed['formBarcode']) {
            batch.push({
              type: 'del',
              key: entry.value.changed['formBarcode'],
            });            
          }
          
          next();
        });
      }, function() {
        if(!batch.length) return next();
        db.batch(batch, {valueEncoding: 'json'}, next);
      });
    },
    
    api: {
      // TODO are barcodes really guaranteed to be unique?
      get: function(core, key, cb) {
        this.ready(function() { // wait for all views to catch up
          db.get(key, {valueEncoding: 'json'}, cb);
        })
      }
    }
  }
};


