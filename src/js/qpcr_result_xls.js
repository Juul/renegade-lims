'use strict';

const date = require('date-and-time');
const xlsx = require('xlsx');

// char code for uppercase A
const aCharCode = 'A'.charCodeAt(0);

// expects that we're counting from zero
function wellRowToLetter(wellRow, plateSize) {
  if(plateSize === 96) {
    if(wellRow >= 12) throw new Error("Well row too high for 96 well plate");
  } else if(plateSize === 384) {
    if(wellRow >= 24) throw new Error("Well row too high for 384 well plate");
  } else {
    throw new Error("Unsupported number of wells in plate: " + plateSize)
  }
  return String.fromCharCode(aCharCode + wellRow);
}

// Expects a well index that's indexed from 0
function wellIndexToName(wellIndex, plateSize) {

  var numRows;
  if(plateSize === 96) {
    numRows = 12;
  } else if(plateSize === 384) {
    numRows = 24;
  } else {
    throw new Error("Unsupported number of wells in plate: " + plateSize)
  }

  wellIndex = parseInt(wellIndex);
  
  const col = (wellIndex % numRows) + 1;
  const row = Math.floor(wellIndex / numRows);

  const res = wellRowToLetter(row, plateSize)+col;
  return res;
}

// Assume first column of CSV is the key and second is the value
// then create object from CSV with only the specified `keys` and their values
function getVals(lines, keys) {
  if(!keys || !keys.length) return {};
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

// TODO only works for mainland U.S. timezones
const timezoneOffsets = {
  'PST': -8,
  'PDT': -7,
  'MST': -7,
  'MDT': -6,
  'CST': -6,
  'CDT': -5,
  'EST': -5,
  'EDT': -4
};

// convert e.g. "PDT" to "-0700"
function timezoneToOffset(str) {
  var offset = timezoneOffsets[str.trim().toUpperCase()];
  if(typeof offset !== 'number') {
    return undefined;
  }

  if(offset < 0) {
    if(offset > -10) {
      return '-0'+Math.abs(offset) + '00';
    } else {
      return offset.toString() + '00';
    }
  } else {
    if(offset < 10) {
      return '+0'+Math.abs(offset) + '00';
    } else {
      return'+'+offset+'00';
    }
  }
}

// incoming date format like: 2020-05-13 11:52:21 AM PDT
function toDate(str) {
  if(!str) return undefined;

  const offset = timezoneToOffset(str.trim().slice(-3));
  if(!offset) return undefined;

  str = str.slice(0, str.length - 3) + offset;

  const d = date.parse(str, "YYYY-MM-DD hh:mm:ss A Z");
  
  if(isNaN(d.getTime())) {
    return undefined;
  }
  return date;
}

const validPlateSizes = [96, 384];

function getMetaData(lines) {
  const data = getVals(lines, ['Block Type', 'Experiment Barcode', 'Experiment Name', 'Instrument Serial Number', 'Experiment Run End Time', 'User Name'])

  var m = data['Block Type'].match(/\s+(\d+)-Well\s+/i);
  if(!m) throw new Error("Unable to detect if this is a 96 or 384 well plate");
  const plateSize = parseInt(m[1]);
  if(validPlateSizes.indexOf(plateSize) < 0) {
    throw new Error("Invalid plate size: " + plateSize);
  }
  
  const o = {
    plateSize: plateSize,
    barcode: data['Experiment Barcode'],
    plateName: data['Experiment Name'],
    instrumentSerialNumber: data['Instrument Serial Number'],
    operatorName: data['User Name'],
    experimentEndedAt: toDate(data['Experiment Run End Time'])
  };

  if(!o.plateName) {
    throw new Error("uuid missing from spreadsheet");
  }

  if(!o.barcode) {
    throw new Error("barcode missing from spreadsheet");
  }

  

  return o;
}

// Find the row with the header (column names) and return as array
// Simply looks for the first row after an empty row
// and assumes it's the header if it includes a field with the contents 'Well'
function getHeader(lines) {
  const emptyLineRegExp = new RegExp(/^\s*,+\s*$/);
  var lastWasEmpty = false;
  var i, line, fields;
  for(i=0; i < lines.length; i++) {
    line = lines[i]
    if(line.match(emptyLineRegExp)) {
      lastWasEmpty = true;
      continue;
    }
    if(!lastWasEmpty) continue;
    
    fields = line.split(',');
    if(fields.indexOf('Well') >= 0) {
      return {
        header: fields,
        lines: lines.slice(i+1)
      };
    }
  }
  return undefined;
}

function getField(header, fields, key) {
  const i = header.indexOf(key);
  if(i < 0) return undefined;
  return fields[i];
}

function getWellResults(lines) {
  // Well,Well Position,Omit,Sample Name,Target Name,Task,Reporter,Quencher,CT,Ct Mean,Ct SD,Quantity,Quantity Mean,Quantity SD,Automatic Ct Threshold,Ct Threshold,Automatic Baseline,Baseline Start,Baseline End,Comments,Y-Intercept,R(superscript 2),Slope,Efficiency,NOAMP,EXPFAIL
  
  // 1,A1,false,RSP,Target 1,UNKNOWN,FAM,None,Undetermined,,,,,,false,0.050,true,1,45,,,,,,Y,Y

  const h = getHeader(lines);
  const header = h.header;
  lines = h.lines;

  const o = {};

  var line, fields, wellName, reporter, w;
  for(line of lines) {
    fields = line.split(',');
    wellName = getField(header, fields, 'Well Position');
    if(!wellName) continue;

    if(!o[wellName]) {
      o[wellName] = {
        result: {}
      };
    }
    
    reporter = getField(header, fields, 'Reporter');
    if(!reporter) continue;
    
    w = {
      'Well': getField(header, fields, 'Well'),
      'Sample Name': getField(header, fields, 'Sample Name'),
      'Ct': getField(header, fields, 'CT'),
      'Detector': getField(header, fields, 'Target Name')
    };
    o[wellName].result[reporter] = w;
  }
  
  return o;
}

// Create a mapping from names like 'Target 1' or 'Target 2'
// to names like 'FAM' or "VIC
function getTargets(wells) {
  var targets = {};
  var wellName, well, reporter, target;
  for(wellName in wells) {
    well = wells[wellName];
    if(!well.result) continue;

    for(reporter in well.result) {
      target = well.result[reporter]['Detector'];;
      if(!target) continue
      if(!targets[target]) {
        targets[target] = reporter
      }
    }
  }
  return targets;
}

function getWellRaw(wells, lines, plateSize) {
  const targets = getTargets(wells);
  
  const h = getHeader(lines);
  const header = h.header;
  lines = h.lines;

  var line, fields, well, wellName, target, reporter, cycle, rn;
  for(line of lines) {
    fields = line.split(',');
    well = getField(header, fields, 'Well');

    if(!well) continue;
    well = parseInt(well);
    if(isNaN(well) || well < 1) continue;
    well--;
    
    try {
      wellName = wellIndexToName(well, plateSize);
    } catch(e) {
      continue;
    }
    
    target = getField(header, fields, 'Target Name');
    if(!target) continue;
    
    reporter = targets[target];
    if(!reporter) continue;
    
    rn = getField(header, fields, 'Rn');
    if(!rn) continue;

    cycle = getField(header, fields, 'Cycle');
    if(!cycle) continue;
    cycle = parseInt(cycle);
    if(isNaN(cycle)) continue;
    cycle--;
    
//    console.log("!", well, wellName, cycle, target, reporter, rn);
    
    if(!wells[wellName]) continue;

    if(!wells[wellName].raw) {
      wells[wellName].raw = {};
    }

    if(!wells[wellName].raw[reporter]) {
      wells[wellName].raw[reporter] = [];
    }
    
    wells[wellName].raw[reporter][cycle] = rn;
  }
  
}

function parse(fileData, cb) {
  try {

    const x = xlsx.read(fileData, {type: 'array'});
    
    const sheets = x['Sheets'];

    const results = xlsx.utils.sheet_to_csv(sheets['Results']);
    var lines = results.split(/\r?\n/);
    
    var metadata = getMetaData(lines);
//    console.log("metadata:", metadata);

    var wells = getWellResults(lines);
//    console.log("WELLS:", wells);
    
    // TODO save results in same format as from EDS
    // TODO save amplification data in same format as from EDS

    const amplificationData = xlsx.utils.sheet_to_csv(sheets['Amplification Data']);
    lines = amplificationData.split(/\r?\n/);

    getWellRaw(wells, lines, metadata.plateSize);
    
    console.log(wells);
  } catch(e) {
    return cb(e);
  }
  

}

module.exports = {
  parse
};
