'use strict';

// For reporting to rim-lab-rest

var https = require('https');

module.exports = function(settings) {

  const rimbaudAPI = {
    
    putResult: function(orderID, data, cb) {

      const path = settings.rimbaud.basePath+'/result/'+encodeURIComponent(orderID);
      
      console.log("Rimbaud PUT:", orderID);
      console.log(path);
      console.log(data);
      console.log('--------------------');
      var didCallBack;
      
      const req = https.request({
        host: settings.rimbaud.host,
        port: settings.rimbaud.port,
        path: path,
        method: 'PUT',
        headers: {
          'Content-Type': "application/json"
        }
      }, function(res) {

        var buf = ''
        
        res.on('data', bytes => {
          buf += bytes.toString('utf8');
        })

        res.on('close', function() {
          if(didCallBack) return;
          didCallBack = true;
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



