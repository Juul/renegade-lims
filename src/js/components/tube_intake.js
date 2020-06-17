'use strict';

import { h, Component } from 'preact';
import {route} from 'preact-router';
import { view } from 'z-preact-easy-state';

import Link from '@material-ui/core/Link';
import Container from '@material-ui/core/Container';

const timestamp = require('monotonic-timestamp');

const PlatePhysical = require('../physicals/plate.js');

const utils = require('../utils.js');
const Scan = require('./scan.js');
const Plate = require('./plate.js');

class EditPlate extends Component {
  
  constructor(props) {
    super(props);
  }


  // Scanned the physical paper form with accession data 
  formScanned(barcode) {
    route('/tube-intake/'+encodeURIComponent(barcode))
  }

  tubeScanned(code) {
    app.actions.getPhysicalByBarcode(code, (err, o) => {
      if(err && !err.notFound) {
        app.notify(err, 'error');
        return;
      }

      this.setState({
        tubeBarcode: code,
        tube: o
      });
    });
  }

  componentDidUpdate(prevProps) {
    prevProps = prevProps || {}
    if(prevProps.formBarcode !== this.props.formBarcode) {
      // TODO don't change state based on props!
      // see map_tubes_to_plate.js
      
      // If the form changes then reset state
      this.setState({
        checkedExistingTube: false,
        existingTube: undefined,
        tube: undefined,
        tubeBarcode: undefined
      });
    }

    if(!this.props.formBarcode || this.state.checkedExistingTube) return;
    
    app.whenConnected(() => {
      app.actions.getSwabTubeByFormBarcode(this.props.formBarcode, (err, tube) => {
        const state = {
          checkedExistingTube: true
        };

        if(tube) {
          state.existingTube = tube;
        }
        this.setState(state);
      })
    });
  }

  componentDidMount() {
    this.componentDidUpdate();
  }
  
  saveBtn() {
    if(!this.state.tubeBarcode || !this.props.formBarcode) {
      app.notify("You must scan both an accession form and a swab tube before attempting to save.", 'error');
      return 
    }

    const tube = {
      id: (this.state.tube && this.state.tube.id) ? this.state.tube.id : undefined,
      barcode: this.state.tubeBarcode,
      formBarcode: this.props.formBarcode
    };
    console.log("Saving:", tube);
    
    app.actions.saveSwabTube(tube, function(err) {
      if(err) {
        app.notify(err, 'error');
        return;
      }

      app.notify("Saved!", 'success');
      setTimeout(function() {
        route('/tube-intake');
      }, 300);
    });
  }

  cancelBtn() {
    this.setState({
      tubeBarcode: undefined,
      tube: undefined
    });
  }
  
  
  render() {
    
    if(!this.props.formBarcode) {
      return (
        <Container>
          <p>Scan one of the accession form barcodes to begin.</p>
          <Scan onScan={this.formScanned.bind(this)} disableWebcam disableDataMatrixScanner />
        </Container>
      );
    }
    
    if(!this.state.checkedExistingTube) {
      return (
          <Container>
            Loading...
          </Container>
      );
    }

    var formWarning = '';
    if(this.state.existingTube) {
      if(this.state.tubeBarcode && this.state.existingTube.barcode && this.state.existingTube.barcode === this.state.tubeBarcode) {
        formWarning = (
            <div>
            Note: This accession form is already associated with the scanned sample tube.
            </div>
        );
      } else {
        return (
            <Container>
            <h3>Accession form: {this.props.formBarcode}</h3>
            <p><b><i>WARNING:</i>This accession form is <i>already</i> associated with a sample tube with barcode '{this.state.existingTube.barcode}'.</b></p>
            <p>Only one sample tube per accession form ID is allowed.</p>
            <p>If the sample tube lost its barcode you can <Link href={"/print-plate-label/" + this.state.existingTube.barcode}>re-print it here</Link></p>
            </Container>
        );
      }
    }
      var tube;
      if(!this.state.tubeBarcode) {
        tube = (
          <div>
            <p>Now scan a sample tube to begin. If the tube does not have a barcode then you can <Link href="/print-plate-label">print one here</Link></p>
            <Scan onScan={this.tubeScanned.bind(this)} disableWebcam hideText />
          </div>
        );
      } else {
        var warning = '';
        if(this.state.tube) {
          console.log("Tube code:", this.state.tube.barcode, this.state.tube.formBarcode)
        }
        if(this.state.tube && this.state.tube.barcode && this.state.tube.formBarcode !== this.props.formBarcode) {
          warning = (
              <div>
              <p><b><i>WARNING:</i>This tube is <i>already</i> associated with another accession form with barcode '{this.state.tube.formBarcode}'.</b></p>
              <p>Saving will overwrite the existing association between accession form and swab tube.</p>
              <p>Make <i><b>ABSOLUTELY SURE</b></i> you know what you are doing before clicking save!</p>
              </div>
          )
        }
        tube = (
          <div>
            <h3>Sample tube: {this.state.tubeBarcode}</h3>
            {warning}
            <p>
            <button onClick={this.saveBtn.bind(this)}>Save</button> <button onClick={this.cancelBtn.bind(this)}>Cancel</button>
            </p>
          </div>
        );
      }
      return (
        <Container>
          <h3>Accession form: {this.props.formBarcode}</h3>
          {formWarning}
          {tube}
          </Container>
      );
    
  }
}

module.exports = view(EditPlate);
  
