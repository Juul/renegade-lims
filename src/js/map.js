'use strict';

// char code for uppercase A
const aCharCode = 'A'.charCodeAt(0);

function wellRowToNumber(wellRow, numRows) {
  wellRow = wellRow.toUpperCase();
  const val = wellRow.charCodeAt(0) - aCharCode;
  if(val < 0 || val >= numRows) throw new Error("Invalid well row: " + wellRow);
  return val;
}

// expects that we're counting from zero
function wellRowToLetter(wellRow, numRows) {
  if(wellRow >= numRows) throw new Error("Well row too high");
  return String.fromCharCode(aCharCode + wellRow);
}

function wellColumnIndex(wellName, numCols) {
  const idx = parseInt(wellName.slice(1)) - 1;
  if(isNaN(idx) || idx < 0 || idx > numCols - 1) {
    throw new Error("Well column too high");
  }
  return idx;
}

const map = {

  wellRowToLetter: wellRowToLetter,
  wellRowToNumber: wellRowToNumber,
  wellColumnIndex: wellColumnIndex,
  
  wellNameToIndex: function(wellName, numRows, numCols, topToBottom) {
    if(typeof wellName !== 'string' || wellName.length < 2 || wellName.length > 3) {
      throw new Error("Invalid well name: " + wellName);
    }
    
    const rowIndex = wellRowToNumber(wellName, numRows);
    const colIndex = wellColumnIndex(wellName, numCols);
    if(colIndex < 0 || colIndex >= numCols) {
      throw new Error("Invalid column number: " + colIndex);
    }
    
    if(topToBottom) {
      return colIndex * numRows + rowIndex;
    } else {
      return rowIndex * numCols + colIndex;
    }
  },
  

  wellIndexToName: function(wellIndex, numRows, numCols, topToBottom) {
    var col, row;
    if(topToBottom) {
      col = Math.floor(wellIndex / numRows) + 1;
      row = (wellIndex % numRows);
    } else {
      col = (wellIndex % numCols) + 1;
      row = Math.floor(wellIndex / numCols);
    }
    
    return wellRowToLetter(row)+col;
  }
};

module.exports = map;
