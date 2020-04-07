
// Support for scanning bottom-labeled cryotubes
// using a webcam-based datamatrix scanner

var childProcess = require('child_process');

module.exports = class DataMatrixScanner {

  constructor(device) {
    this.device = device;
    this.initialized = false;
    this.callback = function(){};

    this.cmd = "streamer -q -c "+this.device+" -f jpeg -s 1024x768 -o /dev/stdout | dmtxread -m 200 -N1 /dev/stdin";
  }

  // Register a remote RPC peer
  registerCallback(cb) {
    this.callback = cb;
  }

  unregisterCallback() {
    this.callback = function(){};
  }
  
  // if keepScanning is true then continue scanning after a valid scan
  scan(keepScanning, cb) {
    // Initialize on first run if not already initialized
    if(!this.initialized) {
      return this.init((err) => {
        if(err) return cb(err);
        this.scan(keepScanning, cb);
      });
    }

    if(typeof keepScanning === 'function') {
      cb = keepScanning;
      keepScanning = false;
    }
    if(!cb) return;
    this.keepScanning = keepScanning;
    
    childProcess.exec(this.cmd, (err, stdout, stderr) => {
      if(err && stderr.length) cb(err);
      var code = stdout.trim();
      if(code.length) {
        console.log("COOOOOOODE", code, this.callback);
        cb(null, code);
        if(this.callback) this.callback(null, code);
      }
      
      if(this.keepScanning) {
        this.scan(this.keepScanning, cb);
      }
    });
  }

  
  init(cb) {
    if(this.initialized) return;
    this.initialized = true;
    
    childProcess.exec("v4l2-ctl --device "+this.device+" -c brightness=100", (err, stdout, stderr) => {
      if(err) return cb(err);
      childProcess.exec("v4l2-ctl --device "+this.device+" -c contrast=100", (err, stdout, stderr) => {
        if(err) return cb(err);
        cb();
      });
    });
  }
}

