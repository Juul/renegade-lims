'use strict';

import { h, Component } from 'preact';
import {route} from 'preact-router';
import { view } from 'z-preact-easy-state';

import Link from '@material-ui/core/Link';
import Container from '@material-ui/core/Container';

const timestamp = require('monotonic-timestamp');

const utils = require('../utils.js');
const Scan = require('./scan.js');
const Plate = require('./plate.js');

// Max file size in bytes to read into client
const FILE_SIZE_MAX = 1024 * 1024 * 1024 * 10; // 10 MB

class AnalyzeQPCR extends Component {
  
  constructor(props) {
    super(props);
  }


  componentDidUpdate(prevProps) {

  }
  
  componentDidMount() {
//    this.componentDidUpdate();
  }

  plateScanned(barcode) {
    app.actions.getPhysicalByBarcode(barcode, (err, plate) => {
      if(err) {
        if(!err.notFound) {
          app.notify("Plate barcode not found in LIMS", 'error');
          return;
        }
        app.notify(err, 'error');
        return;
      }

      this.setState({
        plate: plate
      });
    });
  }

  openFile(e) {
    const files = e.target.files;
    if(!files.length) return;

    const file = files[0];
    if(file.size && file.size > FILE_SIZE_MAX) {
      app.notify("File exceeded maximum allowed size of "+FILE_SIZE_MAX+" bytes", 'error');
      return;
    }
    
    this.setState({
      file: file
    });
  }

  loadFile() {
    this.setState({
      analyzing: true
    });
    
    if(!this.state.file) {
      app.notify("No file to open", 'error');
      return;
    }
    
    var reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        this.analyze(e.target.result);
      } catch(e) {
        app.notify("Failed to parse CSV file", 'error');
        
        this.setState({
          file: undefined,
          analyzing: undefined
        })
      }
    };

    reader.readAsText(this.state.file)
  }
  
  analyze(data) {    
    const lines = data.split(/\r?\n/);

    var metadata = {};
    const wells = {};

    var channelNames;
    var foundStart;
    var highestCycle = 0;
    var i, j, line, wellName, cycle, fields;
    for(i=0; i < lines.length; i++) {
      line = lines[i].split(',');

      if(!foundStart) {
        // Look for first two header columns called Well and Cycle
        if(line[0].match(/^\s*well\s*$/i) && line[1].match(/^\s*cycle\s*$/i)) {
          channelNames = line.slice(2); // grab channel names from header
          foundStart = true;
          continue;
        }
        if(line[0].trim()) {
          metadata[line[0].trim()] = line[1].trim()
        }
        continue;
      }

      if(!line[0] || (!line[1] && line[1] !== 0)) {
        continue;
      }
      
      // Now we've reached the actual data;
      wellName = line[0].trim().toUpperCase();
      cycle = line[1].trim();
      fields = line.slice(2);

      highestCycle = Math.max(highestCycle, parseInt(cycle));

      if(!wells[wellName]) {
        wells[wellName] = [];
      }
      if(!wells[wellName][cycle]) {
        wells[wellName][cycle] = {};
      }
      
      for(j=0; j < fields.length; j++) {
        wells[wellName][cycle][channelNames[j] || j] = fields[j];
      }
    }

    metadata["Channels"] = channelNames.join(', ');
    metadata["Number of cycles"] = highestCycle - 1
    
    this.setState({
      analyzing: false,
      wells: wells,
      metadata: metadata
    });
  }

  render() {

    var fileUploader = '';

    if(!this.state.file) {
      fileUploader = (
          <div>
          <p>Select CSV file to analyze</p>
          <input type="file" onChange={this.openFile.bind(this)} />
          </div>
      );
    } else if(!this.state.analyzing && !this.state.metadata) {
      fileUploader = (
          <div>
          <p>Ready for analysis: {this.state.file.name}</p>
          <p><button onClick={this.loadFile.bind(this)}>Analyze</button></p>
          </div>
      );
    } else if(this.state.analyzing) {
      fileUploader = (
          <div>
          Analyzing... Please wait.
          </div>
      );
    }

    var metadata = '';
    var plate = '';
    if(this.state.metadata) {
      var lis = [];
      for(let key in this.state.metadata) {
        lis.push((
            <li><b>{key}</b>: {this.state.metadata[key]}</li>
        ));
      }
      metadata = (
          <div>
          <h3>Metadata from CSV file</h3>
            <ul>
              {lis}
            </ul>
        </div>
      );

      if(!this.state.plate) {
        plate = (
            <div>
            <p><b><u>Warning:</u></b> Unable to find plate barcode in qPCR .csv file.</p>
            <p>Please find the original qPCR plate from this run and scan the plate barcode to continue.</p>
          
          <Scan onScan={this.plateScanned.bind(this)} disableWebcam disableDataMatrixScanner />
        </div>
        );
      } else {
        plate = (
          <div>
            <h3>Plate layout</h3>
            <ul>
            <li><b>Plate barcode:</b> {this.state.plate.barcode}</li>
            <li><b>Created at:</b> {utils.formatDateTime(this.state.plate.createdAt)}</li>
            <li><b>Created by:</b> {this.state.plate.createdBy || 'Unknown'}</li>
            </ul>
            <Plate occupied={this.state.plate.wells}  />
          </div>
        )
       }
    }
    

    
    return (
        <Container>
        <h3>qPCR result analyzer</h3>
        {fileUploader}
      {metadata}
      {plate}
      </Container>
    )
  }
}

module.exports = view(AnalyzeQPCR);
  
