'use strict';

import { h, Component } from 'preact';
import {route} from 'preact-router';
import { view } from 'z-preact-easy-state';

import Link from '@material-ui/core/Link';
import Container from '@material-ui/core/Container';

const uuid = require('uuid').v4;
const timestamp = require('monotonic-timestamp');
const FileSaver = require('file-saver');
const async = require('async');

const utils = require('../utils.js');
const Scan = require('./scan.js');
const Plate = require('./plate.js');

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

function wellNameToIndex(wellName, numRows, numCols, topToBottom) {
  if(typeof wellName !== 'string' || wellName.length < 2 || wellName.length > 3) {
    throw new Error("Invalid well name: " + wellName);
  }

  const rowIndex = wellRowToNumber(wellName, numRows);
  const colIndex = parseInt(wellName.slice(1)) - 1;
  if(colIndex < 0 || colIndex >= numCols) {
    throw new Error("Invalid column number: " + colIndex);
  }
  
  if(topToBottom) {
    return colIndex * numRows + rowIndex;
  } else {
    return rowIndex * numCols + colIndex;
  }
}

function wellIndexToName(wellIndex, numRows, numCols, topToBottom) {
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


class MapRacksToPlates extends Component {
  
  constructor(props) {
    super(props);
    
    this.setState({
      racks: [],
      plates: []
    });

    // TODO for debug only
//    for(let i=0; i < 4; i++) {
//      this.codeScanned('g'+i);
//    }
  }

  getRackMarkup(rack, number) {
    return (
        <div style={'float:left; ' + ((number === 3) ? 'clear:all' : '')}>
        <div>Rack barcode: {rack.barcode.toUpperCase()}</div>
        <Plate rows="6" cols="8" addClass="plate-small-48" />
        </div>
    );
  }

  getPlateMarkup(plate, number) {
    return (
        <div style={'float:left; ' + ((number === 3) ? 'clear:all' : '')}>
        <div>Plate barcode: {plate.barcode.toUpperCase()}</div>
        <Plate rows="8" cols="12" addClass="plate-medium-96" />
        </div>
    );
  }

  gotRack(rack) {
    if(this.state.racks.length) {
      for(let prevRack of this.state.racks) {
        if(prevRack.barcode === rack.barcode) {
          app.notify("You scanned the same 48 tube rack twice", 'error');
          return;
        }
      }
    }
    
    var racks = this.state.racks;
    racks.push(rack);
    
    this.setState({
      racks: racks
    });
    app.notify("Scanned 48 tube rack: " + rack.barcode, 'success');
  }
  
  gotPlate(plate, barcode) {
    if(plate) {
      app.notify("This 96 well plate already exists in the system!", 'error');
      return;
    }
    if(this.state.racks.length < 4) {
      app.notify("You must scan the 48 tube racks before the 96 well plates", 'error');
      return;
    }

    if(this.state.plates.length > 1) {
      app.notify("You already scanned two 96 well plates", 'error');
      return;
    }

    app.notify("Scanned 96 well plate " + barcode, 'success');
    
    plate = {
      barcode: barcode,
      positions: 96,
      wells: []
    };

    var plates = this.state.plates;
    plates.push(plate);
    this.setState({
      plates: plates
    });
  }

  codeScanned(barcode) {
    app.actions.getPhysicalByBarcode(barcode, (err, obj) => {
      if(err) {
        console.log(err);
        if(!err.notFound) {
          app.notify(err, 'error');
          return;
        }

        if(this.state.racks.length < 4) {
          app.notify("Rack with barcode '"+barcode+"' not registered in LIMS", 'error');
          return;
        }
      }

      if(!obj) { // assume an object that doesn't exist in the db is a plate
        this.gotPlate(null, barcode);
        return;
      }
      
      if(obj.type === 'rack') {
        this.gotRack(obj);
      } else if(obj.type === 'plate') {
        this.gotPlate(obj);
      } else {
        app.notify("Scanned object was neither a rack nor a plate", 'error');
        return;
      }
    });
  }

  // this maps:
  // source: left to right then top to bottom
  // dest: top to bottom then left to right
  mapTubePositionToWell(posName, rackNumber) {
    var posIndex = wellNameToIndex(posName, 6, 8);
    if(rackNumber > 0) {
      posIndex += 48;
    }

    return wellIndexToName(posIndex, 8, 12, true)
  }  

  // this maps:
  // source: top to bottom then left to right
  // dest: top to bottom then left to right
  mapTubePositionToWell_topToBottom(posName, rackNumber) {
    var posIndex = wellNameToIndex(posName, 6, 8, true);
    if(rackNumber > 0) {
      posIndex += 48;
    }

    return wellIndexToName(posIndex, 8, 12, true)
  }
  
  mapWellsToPlate(racks) {
    const wells = {}

    var i = 1;
    var rackNumber = 0;
    var rack, posName, wellName, tube;
    for(rack of racks) {
      for(posName in rack.tubes) {
        tube = rack.tubes[posName];
        wellName = this.mapTubePositionToWell(posName, rackNumber);
        
        wells[wellName] = {
          type: 'swabTube',
          id: tube.id,
          barcode: tube.barcode,
          formBarcode: tube.formBarcode || undefined,
          createdAt: tube.createdAt,
          createdBy: tube.createdBy,
          replicateGroup: i
        }
        i++;
      }
      rackNumber++;
    }

    return wells;
  }
  
  save() {
    var plates = [];

    plates.push({
      barcode: this.state.plates[0].barcode,
      wells: this.mapWellsToPlate(this.state.racks.slice(0, 2))
    });

    plates.push({
      barcode: this.state.plates[1].barcode,
      wells: this.mapWellsToPlate(this.state.racks.slice(2))
    });
    
    async.eachSeries(plates, function(plate, next) {
      
      app.actions.savePlate(plate, next);

    }, (err) => {
      if(err) {
        console.error(err);
        app.notify(err, 'error');
        return;
      }

      app.notify("Mapping saved!", 'success');
      this.setState({
        saved: true
      });
      
    });
  }
  
  getScanMarkup(what) {
    return (
      <div class="scan-area">
      <p>Scan the {what}</p>
      <Scan onScan={this.codeScanned.bind(this)} disableWebcam disableDataMatrixScanner />
        </div>
    )
  }
  
  render() {


    var racks = [];
    for(let i=0; i < this.state.racks.length; i++) {
      racks.push(this.getRackMarkup(this.state.racks[i]));
    }

    var plates = [];
    for(let i=0; i < this.state.plates.length; i++) {
      plates.push(this.getPlateMarkup(this.state.plates[i]));
    }    

    var scanArea = '';
    if(this.state.racks.length < 4) {
      scanArea = this.getScanMarkup("48 tube rack number " + (this.state.racks.length+1));
    } else if(this.state.plates.length < 2) {
      scanArea = this.getScanMarkup("96 well plate number " + (this.state.plates.length+1));
    }

    var saver = '';
    
    if(this.state.plates.length > 1) {
      if(!this.state.saved) {
        saver = (
            <div class="save-area">
            <p>Everything scanned and ready to save</p>
            <button onClick={this.save.bind(this)}>Save this mapping</button>
            </div>
        );
      } else {
        saver = (
          <div class="save-area">
            <p>Mapping was succesfully saved.</p>
          </div>
        );
      }
    }
                  
    
    return (
      <Container>
        <h3>Map 48 tube racks to 96 well plates</h3>
        {scanArea}
        <div class="rack-area">
          <p><b>48 tube racks</b></p>
        {(racks.length) ? racks : "No racks scanned"}
        {saver}
        </div>
        <div class="plate-area">
        <p><b>96 well plates</b></p>
        {(plates.length) ? plates : "No plates scanned"}
        </div>
      </Container>
    );
  }
}

module.exports = view(MapRacksToPlates);
