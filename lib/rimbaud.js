'use strict';

// For reporting to rim-lab-rest

const through = require('through2');
const https = require('https');

var fooCount = 0;

module.exports = function(settings) {

  const rimbaudAPI = {

    listUnsynced: function(labCore, cb) {
      const feed = labCore.api.swabTubesByTimestamp.read({valueEncoding: 'json'});

      feed.pipe(through.obj(function(data, enc, next) {
        if(!data.key || !data.value) return next();
        
        var value = data.value;
        if(typeof value === 'string') {
          value = JSON.parse(value);
        }

        // Skip anything older than 24 hours ago
        // TODO this is terrible way of skipping old values
        let pastTime = new Date().getTime() - 60 * 60 * 24 * 1000;
        
        if(value.createdAt < pastTime) return next();
        
        if(value.orderID && !value.rimbaudSynced) {
          console.log("Not synced:", value);
          console.log('----------------');
        }

        next();
        
      }));
      feed.on('end', function(didAnyFail) {
        if(cb) cb();
      });
    },
    
    synchronizeOrders: function(labCore, feed, cb) {
      if(!feed) {
        feed = labCore.api.swabTubesByTimestamp.read({valueEncoding: 'json'});
      }
      var didAnyFail;
      feed.pipe(through.obj(function(data, enc, next) {
        if(!data.key || !data.value) return next();
        
        var value = data.value;
        if(typeof value === 'string') {
          value = JSON.parse(value);
        }

           console.log("ORDER:", value)
        
        console.log("Syncing order:", value.id);
        rimbaudAPI.postOrderAndRemember(labCore, data.key, value, function(err) {
          if(err) {
            didAnyFail = true;
            console.error("  fail:", value.id, err);
          } else {
            console.log("  sucess:", value.id);
          }
          next();
        });
        
      }));
      feed.on('end', function(didAnyFail) {
        if(cb) cb();
      });
    },

    synchronizer: function(labCore) {
      rimbaudAPI.synchronizeOrders(labCore, null, function(didAnyFail) {
        setTimeout(function() {
          rimbaudAPI.synchronizer(labCore);
        }, (settings.rimbaud.synchronizeOrders || 1200) * 1000);
      });
    },
    
    startOrderSynchronizer: function(labCore) {
      const feed = labCore.api.swabTubesByTimestamp.livefeed();
      rimbaudAPI.synchronizeOrders(labCore, feed, function(didAnyFail) {
        // if livefeed ever ends, fall back to periodically updating
        rimbaudAPI.synchronizer(labCore);
      })
    },

    // Post an order to the rimbaud API and remember that it was posted
    // key is swabTube/sample key in swabTubesByTimestamp view
    postOrderAndRemember: function(labCore, key, sample, cb) {
      // If it has already been synced
      if(sample.rimbaudSynced) {
        return cb();
      }
      rimbaudAPI.postOrder(sample, function(err) {
        if(err) return cb(err);
        
        labCore.api.swabTubesByTimestamp.markAsRimbaudSynced(key, cb);
      });
    },
    
    postOrder: function(sample, cb) {
      
      const orderID = sample.formBarcode;
      const path = settings.rimbaud.basePath+'/order/'+encodeURIComponent(orderID);
      console.log("HOST : PORT:", settings.rimbaud.host, ':', settings.rimbaud.port);
      console.log("URL:", path);
      console.log("SAMPLE:", typeof sample, sample);
      
      const order = {
        acUUID: sample.id,
        acTubeBarcode: sample.barcode,
        acAt: sample.createdAt,
        acUser: (!sample.createdBy || sample.createdBy.toLowerCase() === 'unknown') ? 'admin' : sample.createdBy
      };

      if(!orderID) return cb();
      console.log("ORDER:", order);

      
      const headers = {
        'Content-Type': "application/json"
      };
      
      if(settings.rimbaud.secretKey) {
        headers['X-RB-Auth'] = settings.rimbaud.secretKey
      }
      
      var didCallBack;
      
      const req = https.request({
        host: settings.rimbaud.host,
        port: settings.rimbaud.port,
        path: path,
        method: 'POST',
        headers: headers
      }, function(res) {

        var buf = ''
        
        res.on('data', bytes => {
          buf += bytes.toString('utf8');
        })

        res.on('close', function() {
          if(didCallBack) return;
          didCallBack = true;
          if(res.statusCode < 200 || res.statusCode >= 300) {
            return cb(new Error(buf.toString() + " | Status code: " + res.statusCode || "Failed with status code: " +res.statusCode));
          }
//          console.log("GOT:", buf.toString());
          cb(null, buf.toString());
        });

      })

      req.on('error', function(err) {
        if(didCallBack) return;
        didCallBack = true;
        console.error(err);
        cb(err);
      });
      
      req.write(JSON.stringify(order));
      req.end();
    },
    
    putResult: function(orderID, data, cb) {

/*
      setTimeout(function() {
        if(fooCount === 3) {
          console.log("PROBLEM!");
          cb(null, new Error("A problem occurred"));
        } else {
          cb(null, '{"statuses": ["saved"]}');
        }
        fooCount++;
      }, 500);
      return;
*/
      
      const path = settings.rimbaud.basePath+'/result/'+encodeURIComponent(orderID);
      

      const headers = {
        'Content-Type': "application/json"
      };
      
      if(settings.rimbaud.secretKey) {
        headers['X-RB-Auth'] = settings.rimbaud.secretKey
      }
      
      var didCallBack;
      
      const req = https.request({
        host: settings.rimbaud.host,
        port: settings.rimbaud.port,
        path: path,
        method: 'PUT',
        headers: headers
      }, function(res) {

        var buf = ''
        
        res.on('data', bytes => {
          buf += bytes.toString('utf8');
        })

        res.on('close', function() {
          if(didCallBack) return;
          didCallBack = true;
          console.log("Got status:", res.statusCode, "and response:", buf);
          if(res.statusCode < 200 || res.statusCode >= 300) {
            return cb(new Error(buf.toString() || "Failed with status code: " +res.statusCode));
          }
          cb(null, buf.toString());
        });

      })

      req.on('error', function(err) {
        if(didCallBack) return;
        didCallBack = true;
        console.error(err);
        cb(err);
      });

      console.log("Rimbaud PUT:");
      console.log(path);
      console.log(JSON.stringify(data, null, 2));
      
      req.write(JSON.stringify(data));
      req.end();
    },

    putTestOrder: function(cb) {
      rimbaudAPI.putResult(host, basePath, {id: 5075408403824640}, {
        "results": [
          { "id": 999, "cov-2": "positive", "protocol": "rb-xp"},
          { "id": 1000, "a":3, "c":"see"}
        ]
      }, function(err, result) {
        if(err) return cb(err, result);
        
        cb(null, result);
      })
    }
  }
  
  return rimbaudAPI;
};



