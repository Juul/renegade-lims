'use strict';

const map = require('./map.js');

// char code for uppercase A
const aCharCode = 'A'.charCodeAt(0);

function header(model, plate) {
  if(!plate.barcode) throw new Error("Plate must have a barcode in order to generate .txt plate layout file");
  return `* Experiment Barcode = ${plate.barcode}
* Experiment Name = ${plate.name}
* Experiment Comment = ${plate.name}

[Sample Setup]
Well\tWell Position\tSample Name\tSample Color\tBiogroup Name\tBiogroup Color\tTarget Name\tTarget Color\tTask\tReporter\tQuencher\tQuantity\tComments
`;
}

const sampleColors = {
  'POS': '255,0,0',
  'NTC': '0,0,255',
  'sample': '0,255,0'
};

const targetColors = {
  'Target 1': '176,23,31',
  'Target 2': '0,0,255'
};

const reporters = {
  'Target 1': 'FAM',
  'Target 2': 'CY5'
};

const quenchers = {
  'Target 1': 'None',
  'Target 2': 'NFQ-MGB'
};

function wellRow(model, wellIndex, wellName, sampleName, sampleType, targetName) {
  const sampleColor = sampleColors[sampleType];
  if(!sampleColor) throw new Error("Unknown sample type: " + sampleType);

  const targetColor = targetColors[targetName];
  if(!targetColor) throw new Error("Unknown target name: " + targetName);

  const reporter = reporters[targetName];
  if(!reporter) throw new Error("Unknown target name: " + targetName);

  const quencher = quenchers[targetName];
  if(!quencher) throw new Error("Unknown target name: " + targetName);
  
  return `${wellIndex}\t${wellName}\t${sampleName}\t"RGB(${sampleColor})"\t\t\t${targetName}\t"RGB(${targetColor})"\tUNKNOWN\t${reporter}\t${quencher}\t\t`;
}

function emptyWellRow(model, wellIndex, wellName) {
  return `${wellIndex}\t${wellName}\t\t\t\t\t\t\t\t\t\t\t`;
}

function wellRows(model, wellIndex, wellName, sampleName) {

  if(!sampleName) {
    return emptyWellRow(model, wellIndex, wellName);
  }
  
  var sampleType;
  if(sampleName === 'NTC') {
    sampleType = 'NTC';
  } else if(sampleName === 'POS') {
    sampleType = 'POS';
  } else {
    sampleType = 'sample';
  }
  
  var lines = [];
  lines.push(
    wellRow(model, wellIndex, wellName, sampleName, sampleType, 'Target 1')
  );
  lines.push(
    wellRow(model, wellIndex, wellName, sampleName, sampleType, 'Target 2')
  );  

  return lines.join("\n");
}

function generate(model, plate) {
  if(model !== 'qs6') {
    throw new Error("The only model currently supported is 'qs6'");
  }
  var txt = header(model, plate);

  const plateSize = plate.size || 96;
  const numRows = map.plateSizeToNumRows(plateSize);
  const numCols = map.plateSizeToNumCols(plateSize);
  
  var i, wellName, sampleName, wellIndex;
  for(i=0; i < plateSize; i++) {
    wellName = map.wellIndexToName(i, numRows, numCols);
    wellIndex = i+1; // we count from zero but the .txt format does not
    sampleName = plate.wells[wellName];
    
    txt += wellRows(model, wellIndex, wellName, sampleName) + "\n";
  }

  return txt;
}

module.exports = {
  generate
};
