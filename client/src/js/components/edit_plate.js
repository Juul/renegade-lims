'use strict';

import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

var Scan = require('./scan.js');
var Plate = require('./plate.js');

class EditPlate extends Component {
  
  constructor(props) {
    super(props);
    
    this.setState({
      plate: undefined,
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
    app.remote.getOrCreatePlateByBarcode(code, (err, plate) => {
      if(err) return this.error(err);

      this.setState({
        plate: plate,
        error: undefined
      });
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
    if(!this.state.plate) {
      main = (
        <div>
        <p>Scan plate QR code to begin</p>
        <Scan onScan={this.plateScanned.bind(this)} />
        </div>  
      );
    } else {
      main = (
          <Plate data={this.state.plate} />
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
  
