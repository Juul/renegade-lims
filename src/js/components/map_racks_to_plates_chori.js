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

// TODO also used in map_tubes_to_plate.js so should be in a common file
const POS_CTRL_ID = "11111111-1111-1111-1111-111111111111";
const NEG_CTRL_ID = "22222222-2222-2222-2222-222222222222";

class MapRacksToPlates extends Component {
  
  constructor(props) {
    super(props);
    
    this.setState({
      racks: [],
      plates: [],
      numPlates: 1
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
    
    if(this.state.racks.length) { // second rack
      for(let prevRack of this.state.racks) {
        if(prevRack.barcode === rack.barcode) {
          app.notify("You scanned the same 48 tube rack twice", 'error');
          return;
        }
      }
      if(rack.wells['A1'] && rack.wells['A1'].special !== 'negativeControl') {
        app.notify("This rack has a tube in the position reserved for the negative control", 'error');
        return;
      }

      rack.wells['A1'] = {
        id: NEG_CTRL_ID,
        special: 'negativeControl'
      };
      
    } else { // first rack
      if(rack.wells['F1'] && rack.wells['F1'].special !== 'positiveControl') {
        app.notify("This rack has a tube in the position reserved for the positive control", 'error');
        return;
      }

      rack.wells['F1'] = {
        id: POS_CTRL_ID,
        special: 'positiveControl'
      };
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
      /*
    if(this.state.racks.length < (this.props.numPlates * 2)) {
      app.notify("You must scan the 48 tube racks before the 96 well plates", 'error');
      return;
    }
*/

    if(this.state.plates.length >= this.state.numPlates) {
      app.notify("You already scanned "+this.state.numPlates+" 96 well plate(s)", 'error');
      return;
    }

    app.notify("Scanned 96 well plate " + barcode, 'success');
    
    plate = {
      barcode: barcode,
      size: 96,
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

        if(this.state.racks.length !== 2 && this.state.racks.length !== 4) {
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

  mapTubePositionToWell_simple(rackWellName, rackNumber) {
    const plateRowNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const rackRowNamesReverse = ['F', 'E', 'D', 'C', 'B', 'A'];
    const rackRowName = rackWellName[0].toUpperCase();
    const rackRowReverse = rackRowNamesReverse.indexOf(rackRowName);
    if(rackRowReverse < 0) throw new Error("Invalid rack row name: " + rackRowName);
    const rackCol = parseInt(rackWellName.slice(1)) - 1;
    const plateRowName = plateRowNames[rackCol];
    const plateCol = rackRowReverse + (6 * rackNumber);

    const plateWellName = plateRowName + (plateCol + 1);
    return plateWellName;
  }
  
  // this maps:
  // source: left to right then top to bottom
  // dest: top to bottom then left to right
  mapTubePositionToWell(posName, rackNumber) {
    var posIndex = map.wellNameToIndex(posName, 6, 8);
    if(rackNumber > 0) {
      posIndex += 48;
    }

    return map.wellIndexToName(posIndex, 8, 12, true)
  }  

  // this maps:
  // source: top to bottom then left to right
  // dest: top to bottom then left to right
  mapTubePositionToWell_topToBottom(posName, rackNumber) {
    var posIndex = map.wellNameToIndex(posName, 6, 8, true);
    if(rackNumber > 0) {
      posIndex += 48;
    }

    return map.wellIndexToName(posIndex, 8, 12, true)
  }
  
  mapWellsToPlate(racks) {
    const wells = {}

    var i = 1;
    var rackNumber = 0;
    var rack, posName, wellName, tube;
    for(rack of racks) {
      for(posName in rack.wells) {
        tube = rack.wells[posName];
        wellName = this.mapTubePositionToWell_simple(posName, rackNumber);
        
        wells[wellName] = {
          type: 'swabTube',
          id: tube.id,
          special: tube.special || undefined,
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

    if(this.state.numPlates > 1) {
      plates.push({
        barcode: this.state.plates[1].barcode,
        wells: this.mapWellsToPlate(this.state.racks.slice(2))
      });
    }
    
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

  skipRack() {
    this.state.racks.push({
      barcode: "NONE",
      createdAt: timestamp(),
      createdBy: app.state.user.name,
      wells: {
        'A1': {
          id: NEG_CTRL_ID,
          special: 'negativeControl'
        }
      },
      isNew: true,
      type: 'rack',
      size: 48
    });
    
    this.setState({
      racks: this.state.racks
    });
  }
  
  getScanMarkup(what) {
    var skip = ''
    if(this.state.racks.length && this.state.racks.length < this.state.numPlates * 2) {
      skip = (
        <div>
          <input type="button" value ="Skip rack" onClick={this.skipRack.bind(this)} /> (skipping rack will still add negative control to plate well A12).
          </div>
      );
    }
    return (
      <div class="scan-area">
      <p>Scan the <span style="color:blue">{what}</span></p>
        <Scan onScan={this.codeScanned.bind(this)} disableWebcam disableDataMatrixScanner />
        {skip}
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
    if((this.state.racks.length === 2 && this.state.plates.length === 0) || (this.state.racks.length === 4 && this.state.plates.length < 2)) {
      scanArea = this.getScanMarkup("96 well plate number " + (this.state.plates.length+1));
    } else if(this.state.racks.length < this.state.numPlates * 2)  {
      scanArea = this.getScanMarkup("48 tube rack number " + (this.state.racks.length+1));
    }
  //this.state.plates.length < this.props.numPlates) {
    
    var saver = '';
    
    if(this.state.plates.length >= this.state.numPlates) {
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
            <p><a href={"/map-tubes-to-plate/"+this.state.plates[0].barcode}>Show plate</a></p>
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
