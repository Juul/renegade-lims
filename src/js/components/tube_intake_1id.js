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

class TubeIntake1D extends Component {
  
  constructor(props) {
    super(props);
  }


  // Scanned the physical paper form with accession data 
  formScanned(barcode) {
    route('/tube-intake-1id/'+encodeURIComponent(barcode))
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

  keypress(e) {
    if(!this.state.tubeBarcode) {
      return;
    }

    // enter or space pressed
    if(e.charCode === 13 || e.charCode === 32) {
      this.saveBtn();
    }
  }
  
  initKeyboardCapture() {
    this.keypressListener = this.keypress.bind(this);
    document.addEventListener('keypress', this.keypressListener);
  }
  
  componentDidMount() {
    this.initKeyboardCapture();

  }
  
  saveBtn() {
    if(!this.state.tubeBarcode) {
      app.notify("You must scan a swab tube before attempting to save.", 'error');
      return 
    }

    const tube = {
      id: (this.state.tube && this.state.tube.id) ? this.state.tube.id : undefined,
      barcode: this.state.tubeBarcode,
      formBarcode: this.state.tubeBarcode
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
    const decide = confirm("Are you sure you want to abort?");
    if(!decide) return;
    this.setState({
      tubeBarcode: undefined,
      tube: undefined
    });
  }
  
  
  render() {

    /*
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
        formWarning = (
            <div>
            <p><b><i>WARNING:</i>This accession form is <i>already</i> associated with a sample tube with barcode '{this.state.existingTube.barcode}'.</b></p>
            <p>Only one sample tube per accession form ID is allowed.</p>
            <p>If the sample tube lost its barcode you can <Link href={"/print-plate-label/" + this.state.existingTube.barcode}>re-print it here.</Link> Otherwise scan a new tube to overwrite.</p>
            </div>
        );
      }
    }
    */
    
      var tube;
      if(!this.state.tubeBarcode) {
        tube = (
          <div>
            <p>Scan a sample tube to accession.</p>
            <Scan onScan={this.tubeScanned.bind(this)} disableWebcam hideText />
          </div>
        );
      } else {
        var warning = '';
        if(this.state.tube && this.state.tube.barcode) {
          console.log("AAA", this.state.tube);
          if(this.state.tube.barcode !== this.state.tube.formBarcode) {
            warning = (
                <div>
                <p><b><i>WARNING:</i> This tube is <i>already</i> accessioned using two ID accessioning to order ID {this.state.tube.formBarcode}.</b></p>
                <p>If you proceed then the previous accessioning will be overwritten.</p>
                </div>
            )
          } else {
            warning = (
                <div>
                <p><b><i>NOTICE:</i> This tube is <i>already</i> accessioned.</b></p>
                </div>
            )
          }
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
          {tube}
          </Container>
      );
    
  }
}

module.exports = view(TubeIntake1D);
  
