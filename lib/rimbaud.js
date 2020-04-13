'use strict';

var https = require('https');

module.exports = function(settings) {

  const rimbaudAPI = {
    
    putResult: function(orderID, data, cb) {

      const req = https.request({
        host: settings.rimbaud.host,
        port: settings.rimbaud.host,
        path: settings.rimbaud.basePath+'/result/'+encodeURIComponent(orderID),
        method: 'PUT',
        headers: {
          'Content-Type': "application/json"
        }
      }, function(res) {

        if(res.statusCode < 200 || res.statusCode >= 300) {
          return cb(new Error("Failed with HTTP status code: "+res.statusCode));
        }
        var buf = ''
        
        res.on('data', bytes => {
          buf += bytes.toString('utf8');
        })

        res.on('close', function() {
          cb(null, buf);
        });

      })

      req.on('error', function(err) {
        console.error(err);
      });
      
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



