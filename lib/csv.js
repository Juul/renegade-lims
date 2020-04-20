'use strict';

const date = require('date-and-time');

const bgiReporters = ['VIC', 'FAM'];
const dateTimeFormat = date.compile('M-D-YYYY HH:mm');

var csv = {

  // TODO Switch to using a stream
  getPlates: function(labCore, cb) {
    const header = ["UUID", "Plate barcode", "Well", "Sample UUID", "Sample barcode", "Requisition form barcode", "Replicate group", "Well created at date and time", "Well created by"]

    var str = header.join(',') + "\r\n\r\n";
      
    var stream = labCore.api.platesByTimestamp.read({valueEncoding:'json'});


    var createdAt, createdBy;
    
    stream.on('data', function(val) {
      if(!val.wells || !Object.keys(val.wells).length) return;

      var wellName, well;
      for(wellName in val.wells) {
        well = val.wells[wellName];
        
        createdAt = date.format(new Date(well.createdAt), dateTimeFormat);
        
        createdBy = well.createdBy || 'admin';
        if(createdBy === 'unknown') createdBy = 'admin';
      
        str += val.id+','+val.barcode+','+wellName+','+well.id+','+well.barcode+','+well.formBarcode+','+well.replicateGroup+','+createdAt+','+createdBy+"\r\n";
      }

      str += "\r\n";
    });

    stream.on('end', function(val) {
      cb(null, str);
    });
    
  },

  // TODO Switch to using a stream
  getSamples: function(labCore, cb) {
    const header = ["UUID", "Sample tube barcode", "Requisition form barcode", "Accessioned at date and time", "Accessioned by user"];

    var str = header.join(',') + "\r\n\r\n";
      
    var stream = labCore.api.swabTubesByTimestamp.read({valueEncoding:'json'});


    var createdAt, createdBy;
    
    stream.on('data', function(val) {
      createdAt = date.format(new Date(val.createdAt), dateTimeFormat);
      
      createdBy = val.createdBy || 'admin';
      if(createdBy === 'unknown') createdBy = 'admin';
      
      str += val.id+','+val.barcode+','+val.formBarcode+','+createdAt+','+createdBy+"\r\n";
      
    });

    stream.on('end', function(val) {
      cb(null, str);
    });
    
  },

  getQpcrResults: function(labCore, cb) {
    const header = ["UUID", "Plate ID", "Well", "Reporter", "Sample barcode", "Ct", "Result", "Protocol", "Result created at date and time", "Result created by"]

    var str = header.join(',') + "\r\n\r\n";
      
    var stream = labCore.api.qpcrResultsByTimestamp.read({valueEncoding:'json'});

    var createdAt, createdBy, reporter;

    var fail;
    
    stream.on('data', function(val) {
      if(fail) return;
      if(!val.wells || !Object.keys(val.wells).length) return;
      if(!val.protocol || val.protocol.toLowerCase() !== 'bgi') {
        fail = true;
        return cb(new Error("Unknown protocol"));
      }
      
      createdAt = date.format(new Date(val.createdAt), dateTimeFormat);
      
      createdBy = val.createdBy || 'admin';
      if(createdBy === 'unknown') createdBy = 'admin';
      
      var wellName, well, result;
      for(wellName in val.wells) {
        well = val.wells[wellName];

        if(well.result === true) {
          result = 'positive';
        } else if(well.result === false) {
          result = 'negative';
        } else {
          result = well.result;
        }
          
        for(reporter of bgiReporters) {
        
          str += val.id+','+val.plateID+','+wellName+','+reporter+','+well[reporter].sampleName+','+well[reporter].ct+','+result+','+val.protocol+','+createdAt+','+createdBy+"\r\n";
          
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
