const https = require('https');

var ligolab = function(settings) {
  function doPost(path, data, cb) {
    
    const headers = {
      'Content-Type': "application/json"
    };
    
    var didCallBack;

    console.log("Creating LigoLab request:");
    console.log("     host:", settings.ligolab.host);
    console.log("     port:", settings.ligolab.port);
    console.log("     path:", path);
    console.log("   method:", "POST");
    console.log("  headers:", headers);
    
    const req = https.request({
      host: settings.ligolab.host,
      port: settings.ligolab.port,
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
          return cb(new Error(buf.toString() || "Failed with status code: " +res.statusCode));
        }
        console.log("LigoLab response status:", res.statusCode);
        console.log("LigoLab response body length:", buf.length);
        console.log("LigoLab response body:", buf.toString());
        cb(null, buf.toString());
      });

    })

    req.on('error', function(err) {
      if(didCallBack) return;
      didCallBack = true;
      console.error(err);
      cb(err);
    });

    var toSend = JSON.stringify(data);
    console.log("     data:", toSend)
    req.write(toSend);
    req.end();
  }

  return {
    
    createOrder: function(order, cb) {
      const path = settings.ligolab.orderBasePath;
      return doPost(path, order, cb);
    },
    
    sendRackScan: function(rackScan, cb) {
      const path = settings.ligolab.basePath;
      return doPost(path, rackScan, cb);
    }
  };
  
};

module.exports = ligolab;
