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

class RackScan extends Component {
  
  constructor(props) {
    super(props);
    
    this.setState({
      error: undefined,
      uploadProgress: undefined,
      scanFilename: undefined
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

      console.log(data);

      const codes = this.state.codes || [];
      if(!codes[data.row]) {
        codes[data.row] = [];
      }
      codes[data.row][data.col] = data.barcode;
      
      this.setState({
        codes: codes,
        scanned: this.state.scanned + 1
      });
    });
  }
  
  scanBarcodesSingle() {
    this.scanBarcodes(1);
  }
  
  scanBarcodesDouble() {
    this.scanBarcodes(2);
  }

  sendToLigolab() {
    var codeList = {};
    const rowNames = ['F', 'E', 'D', 'C', 'B', 'A'];

    this.setState({
      ligoSendingScan: true
    });
    
    var codes = this.state.codes;
    if(!codes) codes = [];
    
    for(let row=0; row < 6; row++) {
      if(!codes[row]) codes[row] = [];
      
      for(let col=0; col < 8; col++) {
        codeList[rowNames[row]+(col+1)] = this.state.codes[row][col];
      }
    }
    
    const o = {
      rackID: this.state.rackBarcode,
      codeList: codeList
    };

    app.actions.ligoSendScan(o, (err, resp) => {
      if(err) {
        app.notify(err, 'error');
        return;
      }

      this.setState({
        ligoSendingScan: false
      });
      app.notify("Scan sent to LigoLab!", 'success');
    })
    
  }

  rackScanned(barcode) {
    this.setState({
      rackBarcode: barcode
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
  
  buildRow(column, codes) {
    var html = [];

    var rowCodes;
    for(let row=0; row < 6; row++) {
      rowCodes = codes[row] || [];
      html.push((
          <td><input type="text" style="border-style:none;width:100%" class={'row'+row+'col'+column} value={rowCodes[column] || ''} onChange={this.barcodeChange.bind(this)} /></td>
      ));
    }
    
    return (
        <tr>
          <th>{column+1}</th>
          {html}
        </tr>
    );
  }

  buildBody(codes) {
    var html = [];
    
    for(let col=0; col < 8; col++) {
      html.push(this.buildRow(col, codes || []));
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
            <span>Scanning {this.state.scanned+1} of {this.state.toScan} tube positions</span>
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
          prog = (
              <p>You can now edit the barcodes manually. Enter <b>POS</b> for positive control or <b>NTC</b> for negative control.</p>
          );

          var sendBtn = '';
          if(!this.state.ligoSendingScan) {
            sendBtn = (
                <input type="button" value="Send to LigoLab" onClick={this.sendToLigolab.bind(this)} />
            );
          } else {
            sendBtn = (
              <div>Sending...</div>
            );
          }
          post = (
            <div>
            <p>
            <b>Rack barcode: </b>{this.state.rackBarcode}
            </p>
            <p>
            </p>
            {sendBtn}
          </div>
          );
          
        }
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
          {this.buildBody(this.state.codes)}
        </table>
          
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
  
