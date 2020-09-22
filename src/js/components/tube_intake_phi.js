'use strict';

import { h, Component } from 'preact';
import {route} from 'preact-router';
import { view } from 'z-preact-easy-state';

import linkState from 'linkstate';

import Link from '@material-ui/core/Link';
import Container from '@material-ui/core/Container';

const moment = require('moment');
const timestamp = require('monotonic-timestamp');

var LabelMaker = require('../labelmaker_with_phi.js');

const utils = require('../utils.js');
const Scan = require('./scan.js');
const Plate = require('./plate.js');

class TubeIntakePHI extends Component {
  
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
    route('/tube-intake-phi/'+encodeURIComponent(barcode))
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

  printLabel(o, cb) {

    this.labelMaker.drawLabel('labelPreview', o);
    var imageData = this.labelMaker.getDataURL();

    var copies = parseInt(this.state.copies) || 1;
    
    app.actions.printLabel('tube', imageData, copies, cb);

  }

  fakePrint() {
    this.printLabel({
      tubeBarcode: 'A123456',
      formBarcode: '5665893929451522',
      patientName: 'Christoffersen, Marc Juul',
      dobDay: 30,
      dobMonth: 11,
      dobYear: 1911
    }, (err) => {
      if(err) return console.error(err);
      
      console.log("Printed fake label");
    });
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
  
  save(tubeBarcode, noSave, cb) {
    tubeBarcode = tubeBarcode || this.state.tubeBarcode;
    if(!tubeBarcode || !this.props.formBarcode) {
      app.notify("Click \"Save and print labels\" or scan both an accession form and a swab tube before attempting to save.", 'error');
      return 
    }

    /*
    var t = this.state.collectionTime.strip();
    if(t) {
      try {
        t = moment(t, 'MM/DD/YYYY hh:mm');
      } catch(e) {
        return cb(new Error("Invalid collection time format"));
      }
//      specimenCollectedAt
    }
    */
    
    const tube = {
      id: (this.state.tube && this.state.tube.id) ? this.state.tube.id : undefined,
      barcode: tubeBarcode,
      formBarcode: this.props.formBarcode
    };
    
    if(noSave) return cb(null, tube);
    console.log("Saving:", tube);
    
    app.actions.saveSwabTube(tube, (err) => {
      if(err) return cb(err);

      cb(null, tube);
    });
  }
  
  saveAndPrintBtn() {
    if(!this.props.formBarcode) {
      app.notify("You must scan the accession form before attempting to save and print.", 'error');
      return;
    }

    this.setState({
      loading: "Contacting Rimbaud..."
    });
    
    app.actions.getBarcodes(1, (err, startCode, howMany, prefix) => {
      var tubeBarcode = prefix + startCode;
      
      console.log("Got code:", tubeBarcode);
      this.setState({
        tubeBarcode: tubeBarcode
      });
      
      
      this.save(tubeBarcode, false, (err, tube) => {
        if(err) {
          app.notify(err, 'error');
          return;
        }        

        app.actions.rimbaudPostOrder(tube, (err, resp) => {
          if(err) {
            app.notify(err, 'error');
            this.setState({
              loading: err.toString()
            });
            return;
          }
          resp = JSON.parse(resp);
          /*
            {"authScope":"test","patientName":"Second new api","dobDay":2,"dobMonth":2,"dobYear":1922,"didChange":true}
          */
          
          console.log("Got response:", resp);

          this.save(tubeBarcode, false, (err, tube) => {
            if(err) {
              app.notify(err, 'error');
              return;
            }        
            
            this.setState({
              loading: "Sending label to printer."
            });
            
            this.printLabel({
              tubeBarcode: tubeBarcode,
              formBarcode: this.props.formBarcode,
              patientName: resp.patientName,
              dobDay: resp.dobDay,
              dobMonth: resp.dobMonth,
              dobYear: resp.dobYear
            }, (err) => {
              if(err) {
                app.notify(err, 'error');
                return;
              }        
              
              app.notify("Saved and print job sent!", 'success');
              
              this.setState({
                loading: "Sent label to printer."
              });
              
              setTimeout(function() {
                route('/tube-intake-phi');
              }, 800);
            })
          });            
        });
      });
    });
  }

  /*
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
*/
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
        return (
            <Container>
            <h3>Accession form: {this.props.formBarcode}</h3>
            <p><b><i>WARNING:</i>This accession form is <i>already</i> associated with a sample tube with barcode '{this.state.existingTube.barcode}'.</b></p>
            <p>Only one sample tube per accession form ID is allowed.</p>
            </Container>
        );
    }

    var saveBtn = '';
    if(this.state.loading) {
      saveBtn = (
          <p>
          {this.state.loading}
        </p>
      );
    } else {
      saveBtn = (
          <p>
          Copies: <input type="text" value="1" onChange={linkState(this, 'copies')} /><br/>
          <button onClick={this.saveAndPrintBtn.bind(this)}>Generate barcode and save</button>
          </p>
      )
    }
    
    //           <h3>Sample tube: {this.state.tubeBarcode}</h3>
    //          <button onClick={this.fakePrint.bind(this)}>Fake print</button>
      return (
        <Container>
          <h3>Accession form: {this.props.formBarcode}</h3>
          
        {saveBtn}
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

module.exports = view(TubeIntakePHI);
  
