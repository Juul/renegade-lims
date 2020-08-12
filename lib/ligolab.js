const https = require('https');

module.exports = function(settings) {

  return {

    sendRackScan: function(rackScan, cb) {

      const path = settings.ligolab.basePath;
      
      const headers = {
        'Content-Type': "application/json"
      };
      
      var didCallBack;
      
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
          console.log("LigoLab responded:", buf.toString());
          cb(null, buf.toString());
        });

      })

      req.on('error', function(err) {
        if(didCallBack) return;
        didCallBack = true;
        console.error(err);
        cb(err);
      });
      
      req.write(JSON.stringify(rackScan));
      req.end();
    }
  }
};
