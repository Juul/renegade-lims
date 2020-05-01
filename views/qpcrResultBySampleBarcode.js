'use strict';

const through = require('through2');
const readonly = require('read-only-stream');

const validateQpcrResult = require('../validators/qpcr_result.js');

// This view keeps individual per-well results
// which it extracts from 'qpcrResult' objects

function createSampleResult(plateResult, well, wellName) {

  return {
    resultID: plateResult.id,
    plateID: plateResult.plateID,
    plateBarcode: plateResult.plateBarcode,
    wellName: wellName,
    createdAt: plateResult.createdAt,
    createdBy: plateResult.createdBy,
    barcode: well.barcode,
    result: well.result,
    raw: well.raw
  };
}


module.exports = function(db) {
  return {
    // Called with a batch of log entries to be processed by the view.
    // No further entries are processed by this view until 'next()' is called.
    map: function(entries, next) {

      var entry, well, wellName, plateResult, sampleResult;
      const batch = [];
      
      for(entry of entries) {
        if(!validateQpcrResult(entry)) continue;
        plateResult = entry.value;
        if(!plateResult.wells) continue;
        for(wellName in plateResult.wells) {
          well = plateResult.wells[wellName];
          if(!well.result) continue;
          sampleResult = createSampleResult(plateResult, well, wellName);
          if(!well.barcode) continue;
          
          var key = well.barcode + '!' + plateResult.plateID;

          console.log("New sample result:", key);
          
          batch.push({
            type: 'put',
            key: key,
            value: sampleResult
          });
          
        }
      }

      if(!batch.length) return next();
      db.batch(batch, {valueEncoding: 'json'}, next);
    },
    
    api: {
      get: function(core, sampleBarcode, cb) {
        const results = [];
        core.ready(function() { // wait for all views to catch up
          
          var v = db.createValueStream({
            gt: sampleBarcode + '!',
            lt: sampleBarcode + '~',
            valueEncoding: 'json'
          });
          
          v.pipe(through.obj(function(result, enc, next) {
            
            results.push(result);

            next();
          }, function() {
            cb(null, results);
          }));
        })
      }
      
    }
  }
};


