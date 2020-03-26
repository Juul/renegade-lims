'use strict';

const through = require('through2');
const timestamp = require('monotonic-timestamp');
const charwise = require('charwise');
const readonly = require('read-only-stream');

const validateSwab = require('../validators/swab.js');

module.exports = function(db) {
  return {
    // Called with a batch of log entries to be processed by the view.
    // No further entries are processed by this view until 'next()' is called.
    map: function(entries, next) {
      
      const batch = [];
      entries.forEach(function(entry) {
        if(!validateSwab(entry)) return;
        
        // If the message is from <<THE FUTURE>>, index it at _now_.
        var ts = entry.value.timestamp;
        if(isFutureMonotonicTimestamp(ts)) ts = timestamp();

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
    
      read: function(opts) {
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

        this.ready(function() {
          var v = db.createValueStream(Object.assign({reverse: true}, opts))
          v.pipe(t)
        })

        return readonly(t)
      }
    }
  }
};

// from https://github.com/cabal-club/cabal-core/blob/master/views/messages.js
function monotonicTimestampToTimestamp (timestamp) {
  if (/^[0-9]+\.[0-9]+$/.test(String(timestamp))) {
    return Number(String(timestamp).split('.')[0])
  } else {
    return timestamp
  }
}

// from https://github.com/cabal-club/cabal-core/blob/master/views/messages.js
function isFutureMonotonicTimestamp (ts) {
  var timestamp = monotonicTimestampToTimestamp(ts)
  var now = new Date().getTime()
  return timestamp > now
}
