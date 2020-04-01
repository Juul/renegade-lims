'use strict';

const through = require('through2');
const charwise = require('charwise');
const readonly = require('read-only-stream');

const nicify = require('./common/nicify.js');
const validateSwab = require('../validators/swab.js');

module.exports = function(db) {
  return {
    // Called with a batch of log entries to be processed by the view.
    // No further entries are processed by this view until 'next()' is called.
    map: function(entries, next) {
      
      const batch = [];
      entries.forEach(function(entry) {
        if(!validateSwab(entry)) return;
        
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
      get: function(key, cb) {
        this.ready(function() { // wait for all views to catch up
          db.get(key, cb)
        })
      },
      
      read: function(username, opts) {
        opts = opts || {};

        var t = through.obj();

        if(opts.gt) {
          opts.gt = username + '!' + charwise.encode(opts.gt)  + '!';
        } else {
          opts.gt = username + '!';
        }
        
        if(opts.lt) {
          opts.lt = username + '!' + charwise.encode(opts.lt)  + '~';
        } else {
          opts.lt = username + '~';
        }

        this.ready(function() {
          var v = db.createValueStream(Object.assign({reverse: true}, opts))
          v.pipe(t)
        })

        return readonly(t)
      },
      
    }
  }
};
