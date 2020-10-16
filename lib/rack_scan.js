'use strict';

const path = require('path');
const spawn = require('child_process').spawn;

// Scan 2D bottom barcodes from an image of one or two 48 tube racks
// Image is from flatbed scanner

module.exports = function(settings) {

  const rackScanAPI = {

    scan: function(imageFilename, numberOfRacks, cb) {
      // check for disallowed characters in filename
      if(imageFilename.match(/[^a-z\d-\.]+/)) {
        return cb(new Error("Illegal character(s) in image filename"));
      }

      const filePath = path.join(settings.uploadFilepath, imageFilename);
      
      console.log("Initiating scan of", imageFilename, numberOfRacks);

      const cmdPath = path.join(__dirname, '..', 'scripts', "48_rack_scan.sh");

      const cmdArgs = [
        filePath,
        numberOfRacks
      ];

      const cmd = spawn(cmdPath, cmdArgs);

      var buf = '';
      cmd.stdout.on('data', (data) => {
        // Parse data output from script into JSON
        // which has format "<rack>,<row>,<column>,<barcode>"
        // E.g. "a,0,0,HE00149091" or "b,5,7,G12345678"
        // or if barcode could not be scanned then e.g. "b,5,7,"
        
        buf += data.toString('utf8');
        if(!buf.indexOf("\n") < 0) return;
        
        const tmp = buf.split("\n");
        
        data = tmp[0];
        if(tmp.length > 1) {
          buf = tmp.slice(1).join("\n");
        }
        
        data = data.split(',');
        
        cb(null, {
          rack: data[0],
          row: data[1],
          col: data[2],
          barcode: data[3]
        });        
      });
      
      cmd.stderr.on('data', (data) => {
        console.log("stderr", data.toString('utf8'));
        
      });
    }

  };
  
  return rackScanAPI;
};



