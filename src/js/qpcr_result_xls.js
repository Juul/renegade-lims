'use strict';

const xlsx = require('xlsx');

// Assume first column of CSV is the key and second is the value
// then create object from CSV with only the specified `keys` and their values
function getVals(lines, keys) {
  if(!vals || !vals.length) return {};
  var o = {};

  var line, parts, key, val;
  for(line of lines) {
    parts = line.split(',');
    if(!parts || parts.length < 2) continue;
    key = parts[0];
    val = parts[1];
    
    if(keys.indexOf(key) >= 0) {
      o[key] = val;
    }
  }
  return o;
}

function toDate(str) {
  if(!str) return undefined;
  
  const date = new Date(str);
  if(isNaN(date.getTime())) {
    return undefined;
  }
  return date;
}

function getMetaData(results) {
  const lines = results.split(/\r?\n/);
  const data = getVals(lines, ['Experiment Barcode', 'Experiment Name', 'Instrument Serial Number', 'Experiment Run End Time', 'User Name'])
  
  const o = {
    barcode: data['Experiment Barcode'],
    id: data['Experiment Name'],
    instrumentSerialNumber: data['Instrument Serial Number'],
    labTechName: data['User Name'],
    experimentEndedAt: toDate(data['Experiment Run End Time'])
  };

  if(!o.barcode) {
    throw new Error("uuid missing from spreadsheet");
  }

  if(!o.barcode) {
    throw new Error("barcode missing from spreadsheet");
  }

  return o;
}

function parse(fileData, cb) {
  try {
    const x = xlsx.read(fileData);
    const sheets = x['Sheets'];

    const results = xlsx.utils.sheet_to_csv(sheets['Results']);
    const amplificationData = xlsx.utils.sheet_to_csv(sheets['Amplification Data']);

    const data = getMetaData(results);

    // TODO save results in same format as from EDS
    // TODO save amplification data in same format as from EDS
    

  } catch(e) {
    return cb(err);
  }
  

}

module.exports = {
  parse
};
