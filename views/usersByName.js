'use strict';

const async = require('async');
const through = require('through2');
const charwise = require('charwise');
const readonly = require('read-only-stream');

const u = require('./common/utils.js');
const nicify = require('./common/nicify.js');
const validateUser = require('../validators/user.js');

function sortByTimestamp(a, b) {
  return a.ts - b.ts;
}

function makeKey(name, id) {
  return name + '!' + id;
}

module.exports = function(db) {
  return {
    // Called with a batch of log entries to be processed by the view.
    // No further entries are processed by this view until 'next()' is called.
    map: function(entries, next) {
      
      const firstPass = [];
      var entry;
      for(entry of entries) {
        if(!validateUser(entry)) return next();

        nicify(entry);

        entry.ts = u.monotonicTimestampToTimestamp(entry.value.createdAt);
        firstPass.push(entry);
      }

      // Sort entries by creation time so that if we got multiple entries
      // for the same GUID then the newer will overwrite the older in the view
      firstPass.sort(sortByTimestamp);
      
      const batch = [];
      async.eachSeries(firstPass, function(entry, next) {

        db.get(entry.value.id, function(err, oldUser) {
          if(!err && oldUser) {
            // If the db has a newer value already, don't overwrite with this one
            if(entry.ts < u.monotonicTimestampToTimestamp(oldUser.createdAt)) {
              return next();
            }
          }
          
          const key = makeKey(entry.value.name, entry.value.id);
          
          batch.push({
            type: 'put',
            key: key,
            value: entry.value
          });

          if(entry.value.changed && entry.value.changed['name']) {
            batch.push({
              type: 'del',
              key: makeKey(entry.value.changed['name'], entry.value.id)
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
      // Get an array of all users with the specified username
      get: function(core, key, cb) {

        const t = through.obj();
        
        const opts = {
          gt: key + '!!',
          lt: key + '!~',
          valueEncoding: 'json'
        }
        
        this.ready(function() { // wait for all views to catch up
          const res = [];
          var v = db.createReadStream(opts)
          //          v.pipe(through.obj(function(obj, enc, next) {
          v.on('data', function(o) {
            res.push(o.value);
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
