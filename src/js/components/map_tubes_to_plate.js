'use strict';

import { h, Component } from 'preact';
import {route} from 'preact-router';
import { view } from 'z-preact-easy-state';

import Link from '@material-ui/core/Link';
import Container from '@material-ui/core/Container';

const uuid = require('uuid').v4;
const timestamp = require('monotonic-timestamp');

const PlatePhysical = require('../physicals/plate.js');

const utils = require('../utils.js');
const Scan = require('./scan.js');
const Plate = require('./plate.js');

class EditPlate extends Component {
  
  constructor(props) {
    super(props);
    
    this.setState({
      id: props.id,
      plate: undefined,
      selectedWell: undefined,
      sample: undefined,
      error: undefined
    });
  }

  error(err) {
    if(typeof err === 'object') {
      err = err.message;
    }
    this.setState({
      error: err
    });
  }

  // Change URI without triggering any other actions
  fakeRoute(id) {
    history.pushState({}, "Map tubes to plate", '/map-tubes-to-plate/'+encodeURIComponent(id));
  }
  
  plateScanned(code) {
    app.actions.getPhysicalByBarcode(code, (err, o) => {
      if(err) {
        if(!err.notFound) {
          app.notify(err, 'error');
          return;
        }
        
        // barcode not found
        const id = uuid();
        this.fakeRoute(id);
        this.newPlate(id, code);
        return;
      }

      if(!plate.type === 'plate') {
        app.notify("Scanned object is not a plate", 'error');
        return;
      }

      fakeRoute(o.id);
      this.gotPlate(o);
    });
  }

  tubeScanned(code) {
    app.actions.getPhysicalByBarcode(code, (err, o) => {
      if(err) {
        console.log(err);
        if(!err.notFound) {
          app.notify(err, 'error');
          return;
        }
        app.notify("Tube with barcode '"+code+"' not registered in LIMS", 'error');
        return;
      }

      this.gotTube(tube);
    });
  }

  gotTube(tube) {
    this.setState({
      tube
    });
    
  }
  
  saveSampleToSelectedWell() {

  }

  onWellSelect(well) {
    this.setState({
      selectedWell: well
    });
  }
  
  showWellInfo(well) {
 //   console.log("Hovered well:", well);
  }

  newPlate(id, barcode) {

    const plate = {
      id: id,
      barcode: barcode,
      createdAt: timestamp(),
      createdBy: app.state.user.name,
      wells: [],
      isNew: true
    };
    
    this.setState({
      id: plate.id,
      plate: plate
    });
  }
  
  gotPlate(plate) {
    
    this.setState({
      id: plate.id,
      plate: plate
    });
  }
  
  componentDidMount() {
    app.whenConnected(() => {
      if(this.state.id) {
        app.remote.getObject(this.state.id, this.gotPlate.bind(this))
      }
    });
  }
  
  render(props) {

    var error;
    if(this.state.error) {
      error = (
          <p>
          <b>Error:</b>
          <span>{this.state.error}</span>
          </p>
      )
    }

    var sampleHtml;
    if(this.state.tube) {
      var saveHtml;
      if(this.state.selectedWell) {
        saveHtml = (
            <button>Save sample to well {this.state.selectedWell || ''}</button>
        );
      } else {
        saveHtml = (
          <p>Click a well to assign sample.</p>
        )
      }
      
      sampleHtml = (
          <div>
          <p><b>Current tube:</b> {this.state.tube.barcode} created at {utils.formateDateTime(this.state.tube.createdAt)} by {this.state.tube.createdBy}.</p>
          {saveHtml}
          <button>Cancel</button>
          </div>
      );
    } else {
      sampleHtml = (
          <div>
          To place a sample in a well, first scan a sample tube, or manually enter the barcode number with the keyboard and press enter.
          </div>
      )
    }
    
    var main;
    if(!this.state.id) {
      main = (
        <Container>
          <p>Scan plate barcode to begin.</p>
          <Scan onScan={this.plateScanned.bind(this)} disableWebcam disableDataMatrixScanner />
          <p>If your plate does not have a barcode you can <Link href="/print-plate-label">print one here</Link>.</p>
        </Container>
      );
    } else if(!this.state.plate) {
      main = (
        <Container>
          <div>
            Loading plate {this.id}
          </div>
        </Container>
      )
    } else {
      main = (
        <Container>
          <h3>Plate: {this.state.plate.barcode}</h3>
          <p>
          Plate created at: {utils.formatDateTime(this.state.plate.createdAt)}
          <br/>
          Plate created by: {this.state.plate.createdBy || "Unknown"}
          </p>
          <Plate occupied={this.state.plate.wells} selectfree={!!this.state.sample} allowselectempty={!!this.state.sample} onselect={this.onWellSelect.bind(this)} onhover={this.showWellInfo.bind(this)} />
          
          {sampleHtml}
          <Scan onScan={this.tubeScanned.bind(this)} disableWebcam hideText />
        </Container>
      )
    }
    
    return (
      <div>
        {error}

        {main}
      </div>
    );
    
  }
}

module.exports = view(EditPlate);
  
