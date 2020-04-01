'use strict';

import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

var Scan = require('./scan.js');
var Plate = require('./plate.js');

class EditPlate extends Component {
  
  constructor(props) {
    super(props);
    
    this.setState({
      id: props.id,
      plate: undefined,
      wells: undefined,
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
    app.remote.getPlateByBarcode(id, (err, plate) => {
      if(err) return this.error(err);

      this.setState({
        plate: plate,
        error: undefined
      });
    });  
  }

  saveSampleToSelectedWell() {

  }

  wellsToClass(wells, className) {
    var wellsCopy = {};
    for(let well in wells) {
      if(wells[well]) {
        wellsCopy[well] = className;
      }
    }
    return wellsCopy;
  }

  onWellSelect(well) {
    this.setState({
      selectedWell: well
    });
  }
  
  showWellInfo(well) {
 //   console.log("Hovered well:", well);
  }
  
  componentDidMount() {
    app.whenConnected(() => {
      if(this.state.id) {
        app.remote.getObject(this.state.id, (err, plate) => {
          if(err) {
            console.log(err);
            this.error("Plate not found");
            return;
          }
          if(!plate || !plate.type === 'plate') return;

          const wells = this.wellsToClass(plate.wells, 'green');
          
          this.setState({
            plate: plate,
            wells: wells
          });
        })
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
    
    var main;
    if(!this.state.id) {
      main = (
        <div>
        <p>Scan plate QR code to begin</p>
        <Scan onScan={this.plateScanned.bind(this)} />
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
          <Plate occupied={this.state.wells} selectnext="orange" onselect={this.onWellSelect.bind(this)} onhover={this.showWellInfo.bind(this)} />
          <div>
            Well: {this.state.selectedWell || ''}
          </div>
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
  
