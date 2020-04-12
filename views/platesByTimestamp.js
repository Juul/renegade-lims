'use strict';

const through = require('through2');
const charwise = require('charwise');
const readonly = require('read-only-stream');

const nicify = require('./common/nicify.js');
const validatePlate = require('../validators/plate.js');

module.exports = function(db) {
  return {
    // Called with a batch of log entries to be processed by the view.
    // No further entries are processed by this view until 'next()' is called.
    map: function(entries, next) {
      
      const batch = [];
      entries.forEach(function(entry) {
        if(!validatePlate(entry)) return next();
        
        const ts = nicify(entry);
        var key = charwise.encode(ts);
        
        batch.push({
          type: 'put',
          key: key,
          value: entry.value
        });
      })

      if(!batch.length) return next();
      db.batch(batch, {valueEncoding: 'json'}, next);
    },
    
    api: {
      get: function(core, key, cb) {
        core.ready(function() { // wait for all views to catch up
          db.get(key, cb)
        })
      },
    
      read: function(core, opts) {
        opts = opts || {};

        var t = through.obj();

        if(opts.gt) {
          opts.gt = charwise.encode(opts.gt)  + '!';
        } else {
          opts.gt = '!';
        }
        
        if(opts.lt) {
          opts.lt = charwise.encode(opts.lt)  + '~';
        } else {
          opts.lt = '~';
        }

        core.ready(function() {
          var v = db.createValueStream(Object.assign({reverse: true}, opts))
          v.pipe(t)
        })

        return readonly(t)
      }
    }
  }
};


