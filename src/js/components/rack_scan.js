'use strict';

import { h, Component } from 'preact';
import {route} from 'preact-router';
import { view } from 'z-preact-easy-state';
import linkState from 'linkstate';

import Link from '@material-ui/core/Link';
import Container from '@material-ui/core/Container';
import LinearProgress from '@material-ui/core/LinearProgress';

const uuid = require('uuid').v4;
const timestamp = require('monotonic-timestamp');
const FileSaver = require('file-saver');

//const PlatePhysical = require('../physicals/plate.js');

const utils = require('../utils.js');
const Scan = require('./scan.js');
const Plate = require('./plate.js');

const FILE_SIZE_MAX = 1024 * 1024 * 1024 * 200; // 200 MB

const rowNames = ['F', 'E', 'D', 'C', 'B', 'A'];

// TODO also used in map_tubes_to_plate.js so should be in a common file
const POS_CTRL_ID = "11111111-1111-1111-1111-111111111111";
const NEG_CTRL_ID = "22222222-2222-2222-2222-222222222222";

class RackScan extends Component {
  
  constructor(props) {
    super(props);
    
    this.setState({
      error: undefined,
      uploadProgress: undefined,
      scanFilename: undefined,
      missingLims: {},
      missingLigo: {},
      checkedLims: 0
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

  uploadFile(e) {
    const files = e.target.files;
    if(!files.length) return;
    
    const file = files[0];
    if(file.size && file.size > FILE_SIZE_MAX) {
      app.notify("File exceeded maximum allowed size of "+FILE_SIZE_MAX+" bytes", 'error');
      return;
    }

    if(!file.name.match(/\.jpe?g/i)) {
      app.notify("File must be of type .jpg or .jpeg", 'error');
      return;
    }
    
    var reader = new FileReader();
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener("progress", (e) => {
      if(e.lengthComputable) {
        const percentage = Math.round((e.loaded * 100) / e.total);
        this.setState({
          uploadProgress: percentage
        });
//        console.log("Uploaded:", percentage);
      }
    });
    
    xhr.addEventListener("load", (e) => {
      if(xhr.readyState === xhr.DONE) {
        if (xhr.status === 200) {
          console.log("Filename:", xhr.responseText);
          this.setState({
            scanFilename: xhr.responseText
          });
        }
      }
    })
    
    xhr.upload.addEventListener("load", (e) => {
      this.setState({
        uploadProgress: 100
      });
    })

    xhr.responseType = 'text';
    xhr.overrideMimeType('text/plain; charset=x-user-defined-binary');
    xhr.open("POST", "/upload", true);
    
    reader.onload = (e) => {
      const fileData = e.target.result;

      xhr.send(fileData);
    }
    reader.readAsArrayBuffer(file)
  }

  scanBarcodes(numberOfRacks) {
    numberOfRacks = numberOfRacks || 1;
    
    this.setState({
      scanned: 0,
      toScan: 48 * numberOfRacks
    });
    
    app.actions.scanRackBarcodes(this.state.scanFilename, numberOfRacks, (err, data) => {
      if(err) {
        this.error(err);
        return;
      }
      if(this.state.scanned >= this.state.toScan) {
        if(this.state.checkingMissingLigo === undefined) {
          this.setState({
            checkingMissingLigo: true
          });
          this.checkWithLigoLab();
        }
        return;
      }
      
      console.log(data);

      const codes = this.state.codes || [];
      if(!codes[data.row]) {
        codes[data.row] = [];
      }
      codes[data.row][data.col] = data.barcode;
      
      const scanned = this.state.scanned + 1;

      var stateUpdate = {
        codes: codes,
        scanned: scanned
      };

      if(scanned >= this.state.toScan) {
        stateUpdate.checkingMissingLigo = true;
      }

      this.setState(stateUpdate);

      app.actions.getPhysicalByBarcode(data.barcode.toLowerCase(), (err, tube) => {
        if(err || !tube) {
          const wellName = this.wellNameFromIndex(data.row, data.col);
          const missing = this.state.missingLims;
          missing[wellName] = data.barcode;
          this.setState({
            missingLims: missing,
            checkedLims: (this.state.checkedLims || 0) + 1
          });
        } else {
          this.setState({
            checkedLims: (this.state.checkedLims || 0) + 1
          });
        }
      });
      
    });
  }
  
  scanBarcodesSingle() {
    this.scanBarcodes(1);
  }
  
  scanBarcodesDouble() {
    this.scanBarcodes(2);
  }

  newTube(barcode) {

    const tube = {
      id: uuid(),
      barcode: barcode,
      formBarcode: undefined,
      createdAt: timestamp(),
      createdBy: app.state.user.name
    };

    if(barcode === 'POS') {
      tube.id = POS_CTRL_ID;
      tube.special = 'positiveControl';
    } else if(barcode === 'NTC') {
      tube.id = NEG_CTRL_ID;
      tube.special = 'negativeControl';
    }
    
    return tube;
  }

  generateWells(codes) {
    var wells = {};
    
    var wellName;
    var rowCodes, barcode;
    for(let row=0; row < 6; row++) {
      rowCodes = codes[row] || [];
      for(let col=0; col < 8; col++) {
        wellName = this.wellNameFromIndex(row, col);
        barcode = rowCodes[col];
        if(barcode) barcode = barcode.trim();
        if(barcode) {
          wells[wellName] = this.newTube(barcode);
        }
      }
    }
    return wells;
  }
  
  saveToLIMS() {

    this.setState({
      renegadeSaving: true
    });
    
    const plate = {
      barcode: this.state.rackBarcode,
      createdAt: timestamp(),
      createdBy: app.state.user.name,
      wells: this.generateWells(this.state.codes),
      isNew: true,
      size: 48
    };

    if(this.state.plate) {
      plate.id = this.state.plate.id;
    }

    app.actions.savePlate(plate, (err) => {
      if(err) {
        app.notify(err, 'error')
        return;
      }

      this.setState({
        renegadeSaving: false
      });

      app.notify("Saved", 'success');

    });
  }
  
  saveToLigolab() {
    this.sendToLigolab(true, (err, resp) => {
      if(err) {
        app.notify(err, 'error');
        return;
      }

      this.setState({
        ligoSendingScan: false
      });
      app.notify("Scan sent to LigoLab!", 'success');
    });
  }
  
  // Check which tubes from the scan are recognized by ligolab
  // and update the colors of the table cells to reflect this info
  checkWithLigoLab() {
    this.sendToLigolab(false, (err, resp) => {
      if(err) {
        app.notify("Checking if tubes exist in LigoLab failed", 'error');
        this.setState({
          renegadeSaving: false
        });
        return;
      }

      if(typeof resp === 'string') {
        try {
          resp = JSON.parse(resp);
          if(!resp.codeList || typeof resp.codeList !== 'object') {
            throw new Error("Ligolab response did not contain a .codeList property");
          }
        } catch(err) {
          app.notify("Unable to parse Ligolab response", 'error');
          return;
        }
      }
      console.log("Ligo said:", resp);

      var missing = {};
      var val, m;
      for(let wellName in resp.codeList) {
        val = resp.codeList[wellName];
        m = val.match(/^not\s+found\s+:\s+(.*)$/);
        if(m) {
          missing[wellName] = m[1];
        }
      }
      
      this.setState({
        ligoSendingScan: false,
        checkingMissingLigo: false,
        missingLigo: missing
      });
    });
  }
  
  sendToLigolab(doSave, cb) {
    var codeList = {};

    this.setState({
      ligoSendingScan: true
    });
    
    var codes = this.state.codes;
    if(!codes) codes = [];

    var c;
    for(let row=0; row < 6; row++) {
      if(!codes[row]) codes[row] = [];
      
      for(let col=0; col < 8; col++) {
        c = this.state.codes[row][col];
        if(c) c = c.trim();
        if(c) {
          codeList[rowNames[row]+(col+1)] = c;
        }
      }
    }
    
    const o = {
      rackID: (doSave) ? this.state.rackBarcode : 'fakerack',
      codeList: codeList,
      save: !!doSave
    };

    app.actions.ligoSendScan(o, cb)
    
  }

  rackScanned(barcode) {

    app.actions.getPhysicalByBarcode(barcode, (err, plate) => {
      if(err) {
        app.notify("Error looking up plate in LIMS: " + err, 'error');
        return;
      }
      this.setState({
        rackBarcode: barcode,
        plate: plate
      });
    });
  }

  barcodeChange(e) {
    var m = e.target.className.match(/row(\d+)col(\d+)/);
    if(!m) {
      app.notify("Error finding row/column for edited field", 'error');
      return;
    }
    const row = m[1];
    const col = m[2];

    var codes = this.state.codes;
    if(!codes) codes = [];
    if(!codes[row]) codes[row] = [];
    
    codes[row][col] = e.target.value;
    
    this.setState({
      codes: codes
    });
  }

  stopScan() {
    this.setState({
      toScan: this.state.scanned
    });
  }
  
  wellNameFromIndex(row, column) {
    return rowNames[parseInt(row)] + (parseInt(column) + 1);
  }
  
  buildRow(column, codes, missingLims, missingLigo) {
    missingLims = missingLims || {};
    missingLigo = missingLigo || {};
    var html = [];

    var baseStyle = "border-style:none;width:100%"
    var rowCodes, style, wellName;
    for(let row=0; row < 6; row++) {
      rowCodes = codes[row] || [];
      wellName = this.wellNameFromIndex(row, column);
      style = baseStyle;
      if(missingLims[wellName]) style += ';font-weight:bold';
      if(missingLigo[wellName]) style += ';color:red';
        
      html.push((
          <td><input type="text" style={style} class={'row'+row+'col'+column} value={rowCodes[column] || ''} onChange={this.barcodeChange.bind(this)} /></td>
      ));
    }
    
    return (
        <tr>
          <th>{column+1}</th>
          {html}
        </tr>
    );
  }

  buildBody(codes, missingLims, missingLigo) {
    var html = [];
    
    for(let col=0; col < 8; col++) {
      html.push(this.buildRow(col, codes || [], missingLims, missingLigo));
    }
    return (
        <tbody>
          {html}
        </tbody>
    );        
  }
    
  render() {

    if(this.state.error) {
      return (
          <Container>
          <h3 style="color:red">Error</h3>
          <p>{this.state.error}</p>
          </Container>
      );
    }
    
    var upload = '';
    if(this.state.uploadProgress === undefined) {
      upload = (
        <p>
          Upload scan image: <input type="file" onChange={this.uploadFile.bind(this)} />
        </p>
      )
    } else if(this.state.uploadProgress < 100) {
      upload = (
          <Container>
          <p>Uploading <span>{this.state.uploadProgress}%</span></p>
          <LinearProgress variant="determinate" value={this.state.uploadProgress} />
          </Container>
      );
    }

    var content = '';
    if(this.state.toScan) {
      var prog = '';
      var post = '';
      if(this.state.scanned < this.state.toScan) {
        const percentage = Math.round((this.state.scanned * 100) / this.state.toScan);
        prog = (
            <div>
            <span>Scanning {this.state.scanned+1} of {this.state.toScan} tube positions - <input type="button" onClick={this.stopScan.bind(this)} value="Stop scan" /></span>
            <LinearProgress variant="determinate" value={percentage} /> 
            </div>
        );

      } else {
        if(!this.state.rackBarcode) {
          post = (
              <Container>
              <p>Scan the barcode on the side of the 48 tube rack</p>
              <Scan onScan={this.rackScanned.bind(this)} disableWebcam disableDataMatrixScanner />
              </Container>
          );
              
        } else {
          prog = [(
              <p>You can now edit the barcodes manually. Enter <b>POS</b> for positive control or <b>NTC</b> for negative control.</p>
          )];
          if(this.state.plate) {
            prog.push((
                <p style="color:red">Warning: This rack already exists in Renegade LIMS and will be overwritten if saved.</p>
            ));
          }

          var saveLimsBtn = '';
          if(!this.state.renegadeSaving) {
            saveLimsBtn = (
              <Container>
                <input type="button" value="Save to Renegade LIMS" onClick={this.saveToLIMS.bind(this)} />
                </Container>
            );
          } else {
            saveLimsBtn = (
              <div>Saving to LIMS...</div>
            );
          }
          
          var saveLigoBtn = '';
          if(!this.state.ligoSendingScan) {
            saveLigoBtn = (
              <Container>
                <input type="button" value="Save to LigoLab" onClick={this.saveToLigolab.bind(this)} />
                </Container>
            );
          } else {
            saveLigoBtn = (
              <div>Saving to LigoLab...</div>
            );
          }
          post = (
            <div>
            <p>
            <b>Rack barcode: </b>{this.state.rackBarcode}
            </p>
            <p>
              </p>
              {saveLimsBtn}
              {saveLigoBtn}
          </div>
          );
          
        }
      }

      var loadingLigoMsg = '';
      if(this.state.checkingMissingLigo) {
        loadingLigoMsg = (
            <p><i>Asking LigoLab which sample tubes it knows about...</i></p>
        )
      } else if(this.state.checkingMissingLigo === false) {
        loadingLigoMsg = (
          <div>
            <p><i>Any <span style="color:red">red</span> codes indicate tubes that haven't been accessioned in LigoLab.</i></p>
          </div>
        )
      }

      var loadingLimsMsg = '';
      if(this.state.checkedLims < this.state.toScan) {
        loadingLimsMsg = (
            <p><i>Asking LigoLab which sample tubes it knows about...</i></p>
        )
      } else {
        loadingLimsMsg = (
          <div>
            <p><i>Any <span style="font-weight:bold">bold</span> codes indicate tubes that haven't been accessioned in LIMS.</i></p>
          </div>
        );
      }
      
      content = (
          <Container>
          {prog}
          <table style="width:100%" cellspacing="3" border="1">
          <thead>
          <tr>
          <th></th><th>F</th><th>E</th><th>D</th><th>C</th><th>B</th><th>A</th>
          </tr>
          </thead>
          {this.buildBody(this.state.codes, this.state.missingLims, this.state.missingLigo)}
        </table>
        {loadingLimsMsg}
        {loadingLigoMsg}
        {post}
        </Container>
      );
      
    } else if(this.state.uploadProgress === 100 && this.state.scanFilename) {
      content = (
        <Container>
          <p>Image uploaded. Ready to scan barcodes.</p>
          <input type="button" onClick={this.scanBarcodesSingle.bind(this)} value="Scan single rack" />
        </Container>
      )
    }
    
    return (
      <Container>
        <h3>48 tube rack scanning</h3>
        {upload}
        {content}
      </Container>
    );
    
  }
}

module.exports = view(RackScan);
  
