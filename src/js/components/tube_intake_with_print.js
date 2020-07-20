'use strict';

import { h, Component } from 'preact';
import {route} from 'preact-router';
import { view } from 'z-preact-easy-state';

import linkState from 'linkstate';

import Link from '@material-ui/core/Link';
import Container from '@material-ui/core/Container';

const moment = require('moment');
const timestamp = require('monotonic-timestamp');

var LabelMaker = require('../labelmaker_with_order_id.js');

const utils = require('../utils.js');
const Scan = require('./scan.js');
const Plate = require('./plate.js');

class TubeIntakeWithPrint extends Component {
  
  constructor(props) {
    super(props);

    this.labelMaker = new LabelMaker({
      labelWidth: 560,
      labelHeight: 1083,
      yOffset: 450,
      
      // bwip options:
      scale:       5.8,
      height:      10,
      includetext: true,
      textsize: 15,
      textxalign:  'center',
      textyoffset: 5,
    });
  }


  // Scanned the physical paper form with accession data 
  formScanned(barcode) {
    route('/tube-intake-with-print/'+encodeURIComponent(barcode))
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

  keypress(e) {
    if(!this.state.tubeBarcode || !this.props.formBarcode) {
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

    this.componentDidUpdate();
  }

  printLabels(tubeBarcode, formBarcode, cb, copies) {
    copies = copies || 2;
    // TODO implement
    console.log("PRINTING:", tubeBarcode, '|', formBarcode);

    this.labelMaker.drawLabel('labelPreview', tubeBarcode, formBarcode);

    
    var imageData = this.labelMaker.getDataURL();
    
    app.actions.printLabel('tube', imageData, copies, cb);
//    cb();
  }

  reprint() {
    this.printLabels(this.state.existingTube.barcode, this.props.formBarcode, (err) => {
      if(err) {
        app.notify(err, 'error');
        return;
      }        
      
      app.notify("Print job sent", 'success');    
    })
  }
  
  save(tubeBarcode, cb) {
    tubeBarcode = tubeBarcode || this.state.tubeBarcode;
    if(!tubeBarcode || !this.props.formBarcode) {
      app.notify("Click \"Save and print labels\" or scan both an accession form and a swab tube before attempting to save.", 'error');
      return 
    }

    var t = this.state.collectionTime.strip();
    if(t) {
      try {
        t = moment(t, 'MM/DD/YYYY hh:mm');
      } catch(e) {
        return cb(new Error("Invalid collection time format"));
      }
//      specimenCollectedAt
    }
    
    const tube = {
      id: (this.state.tube && this.state.tube.id) ? this.state.tube.id : undefined,
      barcode: tubeBarcode,
      formBarcode: this.props.formBarcode
    };
    console.log("Saving:", tube);
    
    app.actions.saveSwabTube(tube, cb);
  }
  
  saveAndPrintBtn() {
    if(!this.props.formBarcode) {
      app.notify("You must scan the accession form before attempting to save and print.", 'error');
      return;
    }
    
    app.actions.getBarcodes(1, (err, startCode, howMany, prefix) => {
      var tubeBarcode = prefix + startCode;
      
      console.log("Got code:", tubeBarcode);
      this.setState({
        tubeBarcode: tubeBarcode
      });
      
      
      this.save(tubeBarcode, (err) => {
        if(err) {
          app.notify(err, 'error');
          return;
        }        

        this.printLabels(tubeBarcode, this.props.formBarcode, (err) => {
          if(err) {
            app.notify(err, 'error');
            return;
          }        
          
          app.notify("Saved and print job sent!", 'success');
          
          setTimeout(function() {
            route('/tube-intake-with-print');
          }, 800);
        })
      });
    });
  }
  
  saveBtn() {
    this.save(null, (err) => {
      if(err) {
        app.notify(err, 'error');
        return;
      }
      
      app.notify("Saved!", 'success');
      setTimeout(function() {
        route('/tube-intake-with-print');
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
            <p>If the sample tube lost its barcode you can <button onClick={this.reprint.bind(this)}>Click here to re-print one</button></p>
            </Container>
        );
      }
    }
    var saveAndPrint = '';
      var tube;
      if(!this.state.tubeBarcode) {
        tube = (
          <div>
            <p>Now either click "Save and print labels" or scan a sample tube. If the tube does not have a barcode then you can <Link href="/print-plate-label">print one here</Link></p>
            <Scan onScan={this.tubeScanned.bind(this)} disableWebcam hideText />
          </div>
        );
        saveAndPrint = (
                      <p>
            <button onClick={this.saveAndPrintBtn.bind(this)}>Save and print labels</button></p>
        );
      }
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

    
    
    if(this.state.tubeBarcode) {
        tube = (
          <div>
            <h3>Sample tube: {this.state.tubeBarcode}</h3>
            <p>
            <button onClick={this.saveBtn.bind(this)}>Save</button>
            </p>
          </div>
        );
      }
      return (
        <Container>
          <h3>Accession form: {this.props.formBarcode}</h3>
          {formWarning}
          {warning}
        {tube}
          <p>
          Collection time (optional): <input type="text" onInput={linkState(this, 'collectionTime')} /><br/>
          <i>Write as e.g: 2/29/2020 14:44</i>
          </p>
        {saveAndPrint}
          <p>
          <button onClick={this.cancelBtn.bind(this)}>Cancel</button>
          </p>
          <h4>Print preview</h4>
          <div style="width:187px;height:361px;">
          <canvas id="labelPreview" class="labelPreview" width="187" height="361"></canvas>
          </div>
          </Container>
      );
    
  }
}

module.exports = view(TubeIntakeWithPrint);
  
