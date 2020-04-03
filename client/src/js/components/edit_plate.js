'use strict';

import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

const PlatePhysical = require('../physicals/plate.js');

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
  
  plateScanned(code) {
    app.remote.getPlateByBarcode(id, this.gotPlate);
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

  gotPlate(err, plate) {
    if(err) {
      console.log(err);
    }
    if(!plate || !plate.type === 'plate') {
      app.actions.notify("Plate not found", 'error');
      return;
    }

    
    this.setState({
      id: plate.id,
      plate: plate
    });
  }
  
  componentDidMount() {
    app.whenConnected(() => {
      if(this.state.id) {
        console.log('AAAA', app.remote);
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

    var sampleHtml = '';
    if(this.sample) {
      sampleHtml = (
          <div>
          <button>Save sample to well {this.state.selectedWell || ''}</button>
          </div>
      );
    }
    
    var main;
    if(!this.state.id) {
      main = (
        <div>
        <p>Scan plate QR code to begin.</p>
        <Scan onScan={this.plateScanned.bind(this)} disableKeyboard disableDataMatrixScanner />
        </div>  
      );
    } else if(!this.state.plate) {
      main = (
        <div>
          Loading plate {this.id}
        </div>
      )
    } else {
      main = (
        <div>
          <h3>Plate: {this.state.id}</h3>
          <p>
          Label created at: {this.state.plate.createdAt}
          <br/>
          Label created by: {this.state.plate.createdBy || "Unknown"}
          </p>
          <Plate occupied={this.state.plate.wells} selectfree={!!this.state.sample} allowselectempty={!!this.state.sample} onselect={this.onWellSelect.bind(this)} onhover={this.showWellInfo.bind(this)} />
          <div>
          Scan a cryotube to begin plating, or manually enter a cryotube ID with the keyboard and press enter.
          </div>
          <Scan onScan={this.plateScanned.bind(this)} disableWebcam hideText />
          {sampleHtml}
        </div>
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
  
