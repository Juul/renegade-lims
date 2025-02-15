'use strict';

const date = require('date-and-time');

//const bgiReporters = ['VIC', 'FAM'];
const reporters = ['reporter', 'intCtrl', 'VIC', 'FAM'];
const dateTimeFormat = date.compile('M-D-YYYY HH:mm [UTC]Z');

var csv = {

  // TODO Switch to using a stream
  getPlates: function(labCore, cb) {
    const header = ["UUID", "Plate barcode", "Well", "Sample UUID", "Sample barcode", "Requisition form barcode", "Replicate group", "Well created at date and time", "Well created at timestamp", "Well created by"]

    var str = header.join(',') + "\r\n";
      
    var stream = labCore.api.platesByTimestamp.read({valueEncoding:'json'});


    var createdAt, createdBy;
    
    stream.on('data', function(val) {
      if(!val.wells || !Object.keys(val.wells).length) return;

      var wellName, well;
      for(wellName in val.wells) {
        well = val.wells[wellName];

        try {
          createdAt = date.format(new Date(well.createdAt), dateTimeFormat);
        } catch(e) {
          createdAt = '?';
        }
        
        createdBy = well.createdBy || 'admin';
        if(createdBy === 'unknown') createdBy = 'admin';
      
        str += val.id+','+val.barcode+','+wellName+','+well.id+','+well.barcode+','+well.formBarcode+','+well.replicateGroup+','+createdAt+','+well.createdAt+','+createdBy+"\r\n";
      }
      
    });

    stream.on('end', function(val) {
      cb(null, str);
    });
    
  },

  getSamplesWrong: function(labCore, cb) {
    const header = ["UUID", "Sample tube barcode", "Requisition form barcode", "Accessioned at date and time", "Accessioned at timestamp", "Accessioned by user"];

    var str = header.join(',') + "\r\n";
      
    var stream = labCore.api.objectsByGUID.read({valueEncoding:'json'});


    var createdAt, createdBy;
    
    stream.on('data', function(val) {
      if(val.type !== 'swabTube') return;
      
      createdAt = date.format(new Date(val.createdAt), dateTimeFormat);
      
      createdBy = val.createdBy || 'admin';
      if(createdBy === 'unknown') createdBy = 'admin';
      
      str += val.id+','+val.barcode+','+val.formBarcode+','+createdAt+','+val.createdAt+','+createdBy+"\r\n";
      
    });

    stream.on('end', function(val) {
      cb(null, str);
    });
    
  },

  getPlatesWrong: function(labCore, cb) {
    const header = ["UUID", "Sample tube barcode", "Requisition form barcode", "Accessioned at date and time", "Accessioned at timestamp", "Accessioned by user"];

    var str = header.join(',') + "\r\n";
      
    var stream = labCore.api.objectsByGUID.read({valueEncoding:'json'});


    var createdAt, createdBy;
    
    stream.on('data', function(val) {
      if(val.type !== 'plate') return;
      if(!val.wells || !Object.keys(val.wells).length) return;

      var wellName, well;
      for(wellName in val.wells) {
        well = val.wells[wellName];

        
        //createdAt = date.format(new Date(well.createdAt), dateTimeFormat);
        
        createdBy = well.createdBy || 'admin';
        if(createdBy === 'unknown') createdBy = 'admin';
      
        str += val.id+','+val.barcode+','+wellName+','+well.id+','+well.barcode+','+well.formBarcode+','+well.replicateGroup+','+createdAt+','+well.createdAt+','+createdBy+"\r\n";
      }
      
    });

    stream.on('end', function(val) {
      cb(null, str);
    });
    
  },
  
  getAll: function(labCore, cb) {
    const header = ["UUID", "Sample tube barcode", "Requisition form barcode", "Accessioned at date and time", "Accessioned at timestamp", "Accessioned by user"];

    var str = header.join(',') + "\r\n";
      
    var stream = labCore.api.objectsByGUID.read({valueEncoding:'json'});


    var createdAt, createdBy;
    
    stream.on('data', function(val) {
      createdAt = date.format(new Date(val.createdAt), dateTimeFormat);
      
      createdBy = val.createdBy || 'admin';
      if(createdBy === 'unknown') createdBy = 'admin';
      
      str += val.id+','+val.barcode+','+val.formBarcode+','+createdAt+','+val.createdAt+','+createdBy+"\r\n";
      
    });

    stream.on('end', function(val) {
      cb(null, str);
    });
    
  },
  
  getSamples: function(labCore, cb) {
    const header = ["UUID", "Sample tube barcode", "Requisition form barcode", "Accessioned at date and time", "Accessioned at timestamp", "Accessioned by user", "Rimbaud synced"];
    
    var str = header.join(',') + "\r\n";
      
    var stream = labCore.api.swabTubesByTimestamp.read({valueEncoding:'json'});


    var createdAt, createdBy;
    
    stream.on('data', function(data) {
      const val = data.value;
      
      createdAt = date.format(new Date(val.createdAt), dateTimeFormat);
      
      createdBy = val.createdBy || 'admin';
      if(createdBy === 'unknown') createdBy = 'admin';
      
      str += val.id+','+val.barcode+','+val.formBarcode+','+createdAt+','+val.createdAt+','+createdBy+','+(!!(val.rimbaudSynced))+"\r\n";
      
    });

    stream.on('end', function(val) {
      cb(null, str);
    });
    
  },

  getQpcrResults: function(labCore, cb) {
    const header = ["UUID", "Plate ID", "Well", "Reporter", "Sample barcode", "Ct", "Result", "Protocol", "Result created at date and time", "Result created by"]

    var str = header.join(',') + "\r\n\r\n";
      
    var stream = labCore.api.qpcrResultsByTimestamp.read({valueEncoding:'json'});

    var protocol, createdAt, createdBy, reporter;

    var fail;
    
    stream.on('data', function(val) {
      if(fail) return;
      if(!val.wells || !Object.keys(val.wells).length) return;

      protocol = val.protocol || '?';
//      if(!val.protocol) {
//        fail = true;
//        return cb(new Error("Unknown protocol: " + val.protocol));
//      }
      
      createdAt = date.format(new Date(val.createdAt), dateTimeFormat);
      
      createdBy = val.createdBy || 'admin';
      if(createdBy === 'unknown') createdBy = 'admin';
      
      var wellName, well, result;
      for(wellName in val.wells) {
        well = val.wells[wellName];


//        console.log(well.result);
//        return
        
        if(well.result.outcome === true) {
          result = 'positive';
        } else if(well.result.outcome === false) {
          result = 'negative';
        } else {
          result = well.outcome;
        }
          
        for(reporter of reporters) {
          if(!well.result[reporter]) {
            continue;
          }
//          if(well.result[reporter]['Sample Name'] === 'c348') {
//            console.log("AAAA", well);
//          }
          str += val.id+','+val.plateID+','+wellName+','+reporter+','+well.result[reporter]['Sample Name']+','+well.result[reporter].Ct+','+result+','+protocol+','+createdAt+','+createdBy+"\r\n";
          
        }
      }

      str += "\r\n"
    });

    stream.on('end', function(val) {
      if(fail) return;
      cb(null, str);
    });
    
  }

  

  

};

module.exports = csv;
