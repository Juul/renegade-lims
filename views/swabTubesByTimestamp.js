'use strict';

const through = require('through2');
const charwise = require('charwise');
const readonly = require('read-only-stream');
const livefeed = require('level-livefeed');

const nicify = require('./common/nicify.js');
const validateSwabTube = require('../validators/swab_tube.js');

module.exports = function(db) {
  return {
    // Called with a batch of log entries to be processed by the view.
    // No further entries are processed by this view until 'next()' is called.
    map: function(entries, next) {
      
      const batch = [];
      var entry;
      for(entry of entries) {
        if(!validateSwabTube(entry)) continue;
        
        const ts = nicify(entry);
        var key = charwise.encode(ts) + '!' + entry.value.id;
        
        batch.push({
          type: 'put',
          key: key,
          value: entry.value
        });
      }

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
          var v = db.createReadStream(Object.assign({reverse: true}, opts))
          v.pipe(t)
        })

        return readonly(t)
      },

      livefeed: function(core) {
        return livefeed(db);
      },
      
      // mark the sample as synchronized with rimbaud
      markAsRimbaudSynced: function(core, key, cb) {
        db.get(key, function(err, value) {
          if(err) return cb(err);

          value = JSON.parse(value);
          console.log("  --already synced");
          if(value.rimbaudSynced) return cb();
          
          value.rimbaudSynced = true;
          console.log("  --flagged as synced");
          db.put(key, JSON.stringify(value), cb);
        });
      },
      
    }
  }
};


