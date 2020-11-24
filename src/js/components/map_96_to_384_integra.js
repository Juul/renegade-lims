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
const map = require('../../../lib/map.js');
const Scan = require('./scan.js');
const Plate = require('./plate.js');

const POS_CTRL_ID = "11111111-1111-1111-1111-111111111111";
const NEG_CTRL_ID = "22222222-2222-2222-2222-222222222222";

const colors = ['orange', 'green', 'pink', 'purple'];
const numberNames = ['zero', 'one', 'two', 'three', 'four'];

const negativeControlWells = ['A1'];
const positiveControlWells = ['A24'];
const humanReadable384Positions = [
  "top left",
  "top right",
  "bottom left",
  "bottom right"
];

class Map96to384 extends Component {
  
  constructor(props) {
    super(props);
    
    this.setState({
      plates96: [],
      plate384: undefined
    });

    // TODO for debug only
//    for(let i=0; i < 4; i++) {
//      this.codeScanned('g'+i);
//    }
  }

  getPlate384Markup(plate, cur96Index) {
    if(!cur96Index || cur96Index < 0) {
      cur96Index = 0;
    }
    const wells = this.map96PlatesTo384Plate(this.state.plates96);
    const pos = humanReadable384Positions[cur96Index];

    return (
        <div>
        <div>Map this 96 well plate to <b style="color:blue">{pos}</b> quadrant of 384 well plate</div>
        <div>Plate barcode: <u>{plate.barcode.toUpperCase()}</u></div>
        <div class={'plate384-container plate384-pos-' +  cur96Index}>
        <Plate rows="16" cols="24" occupied={wells} addClass="plate-medium-384" />
        </div>
        </div>
    );
  }
  
  getPlate96Markup(plate, number) {
    const colorClass = colors[number];
    
    const wells = {};
    for(let wellName in plate.wells) {
      wells[wellName] = {
        cssClass: colorClass
      }
    }
    
    return (
        <div style={'float:left; ' + ((number === 3) ? 'clear:all' : '')}>
        <div>Plate barcode: {plate.barcode.toUpperCase()}</div>
        <Plate rows="8" cols="12" addClass="plate-small-96" occupied={wells} />
        </div>
    );
  }
  

  gotPlate96(plate) {
    if(this.state.plates96.length) {
      for(let prevPlate of this.state.plates96) {
        if(prevPlate.barcode === plate.barcode) {
          app.notify("You scanned the same 96 well plate twice", 'error');
          return;
        }
      }
    }
    
    var plates = this.state.plates96;
    plates.push(plate);
    
    this.setState({
      plates96: plates
    });
    app.notify("Scanned 96 well plate: " + plate.barcode, 'success');
  }
  
  gotPlate384(plate, barcode) {
    if(plate) {
      app.notify("This 384 well plate already exists in the system!", 'error');
      return;
    }

    if(this.state.plate384) {
      app.notify("You already scanned a 384 well plate", 'error');
      return;
    }

    app.notify("Scanned 384 well plate " + barcode, 'success');
    
    plate = {
      barcode: barcode,
      size: 384,
      wells: []
    };
    
    this.setState({
      plate384: plate
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
      }

      // assume an object that doesn't exist
      // in the db is a 384 well plate
      if(!obj) { 
        this.gotPlate384(null, barcode);
        return;
      }
      
      if(obj.type === 'plate' && (!obj.size || obj.size === 96)) {
        this.gotPlate96(obj);
      } else if(obj.type === 'plate' && obj.size === 384) {
        this.gotPlate384(obj);        
      } else {
        app.notify("Scanned object was neither a 96 nor 384 well plate", 'error');
        return;
      }
    });
  }

  // Follows Integra schema
  // first 96 well plate maps to top left quadramt
  // second one to top right quadrant
  // third one to bottom left quadrant
  // fourth one to bottom right quadrant
  // Maps A1 on 96 well plate 0 to A1 on 384 well plate
  // Maps A1 on 96 well plate 1 to A13 on 384 well plate
  // Maps A1 on 96 well plate 2 to I1 on 384 well plate
  // Maps A1 on 96 well plate 3 to I13 on 384 well plate
  map96WellTo384Well(posName, plateNumber) {
    var rowIndex = map.wellRowToNumber(posName, 8);
    var colIndex = map.wellColumnIndex(posName, 12);
    
    // plates 0 and 1 have no row offset
    // plates 2 and 3 are offset down one row
    if(plateNumber > 1) {
      rowIndex += 8;
    }

    // plates 0 and 2 have no column offset
    // plates 1 and 3 are offset right one row
    if(plateNumber % 2) {
      colIndex += 12;
    }

    return map.wellRowToLetter(rowIndex, 16) + (colIndex+1);
  }

  
  map96PlatesTo384Plate(plates96) {
    const wells = {}
    
    var i = 1;
    var plate96Number = 0;
    var plate96, posName, wellName, srcWell;
    for(plate96 of plates96) {
      for(posName in plate96.wells) {
        srcWell = plate96.wells[posName];
        wellName = this.map96WellTo384Well(posName, plate96Number);
        
        wells[wellName] = {
          type: 'swabTube',
          id: srcWell.id,
          barcode: srcWell.barcode,
          formBarcode: srcWell.formBarcode || undefined,
          createdAt: srcWell.createdAt,
          createdBy: srcWell.createdBy,
          cssClass: colors[plate96Number]
        }
        i++;
      }
      plate96Number++;
    }

    for(wellName of negativeControlWells) {
      wells[wellName] = {
        id: NEG_CTRL_ID,
        special: 'negativeControl',
        createdAt: timestamp(),
        createdBy: app.state.user.name,
        cssClass: 'blue'
      };
    }

    for(wellName of positiveControlWells) {
      wells[wellName] = {
        id: POS_CTRL_ID,
        special: 'positiveControl',
        createdAt: timestamp(),
        createdBy: app.state.user.name,
        cssClass: 'red'
      };
    }
    
    return wells;
  }
  
  save() {

    const plate = this.state.plate384;
    plate.wells = this.map96PlatesTo384Plate(this.state.plates96);    

    console.log("SIZE:", plate.size);
    
    app.actions.savePlate(plate, (err) => {
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
    
    var plates96 = [];
    for(let i=0; i < this.state.plates96.length; i++) {
      plates96.push(this.getPlate96Markup(this.state.plates96[i], i));
    }

    var plate384 = '';
    if(this.state.plate384) {
      plate384 = this.getPlate384Markup(this.state.plate384, this.state.plates96.length - 1);
  }    
    
    var scanArea = '';
    if(this.state.plates96.length < 4 && !this.state.plate384) {
      scanArea = this.getScanMarkup("96 or 384 well plate");
    } else if(this.state.plates96.length >= 4 && !this.state.plate384) {
      scanArea = this.getScanMarkup("384 well plate");
    } else if(this.state.plates96.length < 4 && this.state.plate384) {
      scanArea = this.getScanMarkup("96 well plate");
    }
    
    var saver = '';
    
    if(this.state.plates96.length && this.state.plate384) {
      if(!this.state.saved) {
        saver = (
            <div class="save-area">
            <div>Ready to save mapping of {numberNames[this.state.plates96.length]} 96 well plate(s) to one 384 well plate</div>
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
        <h3>Map 96 well plate(s) to 384 well plate - INTEGRA</h3>
        {scanArea}
        <div class="plate384-area">
        <div><b>384 well plate</b></div>
        {(!!plate384) ? plate384 : "No 384 well plate scanned"}
        </div>
        <div class="plate96-area">
          <div><b>96 well plates</b></div>
        {(plates96.length) ? plates96 : "No 96 well plates scanned"}
        {saver}
        </div>
      
      </Container>
    );
  }
}

module.exports = view(Map96to384);
