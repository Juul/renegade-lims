'use strict';

const through = require('through2');
const charwise = require('charwise');
const readonly = require('read-only-stream');

const validateUser = require('../validators/user.js');

module.exports = function(db) {
  return {
    // Called with a batch of log entries to be processed by the view.
    // No further entries are processed by this view until 'next()' is called.
    map: function(entries, next) {
      
      const batch = [];
      entries.forEach(function(entry) {
        if(!validateUser(entry)) return;
        
        var key = entry.value.name + '!' + entry.value.id;

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
      // Get an array of all users with the specified username
      get: function(core, key, cb) {

        const t = through.obj();
        
        const opts = {
          gt: key + '!',
          lt: key + '~',
          valueEncoding: 'json'
        }
        
        this.ready(function() { // wait for all views to catch up
          const res = [];
          var v = db.createValueStream(opts)
          //          v.pipe(through.obj(function(obj, enc, next) {
          v.on('data', function(o) {
            res.push(o);
          })
          v.on('end', function() {
            cb(null, res);
          });
        });

      },
      
      read: function(core, username, opts) {
        opts = opts || {}
        const t = through.obj();
        
        if(opts.gt) {
          opts.gt = opts.gt  + '!';
        } else {
          opts.gt = '!';
        }
        
        if(opts.lt) {
          opts.lt = opts.lt  + '~';
        } else {
          opts.lt = '~';
        }
        
        this.ready(function() { // wait for all views to catch up
          var v = db.createValueStream(opts);
          v.pipe(t)
        });

        return t;
      },
      
    }
  }
};
