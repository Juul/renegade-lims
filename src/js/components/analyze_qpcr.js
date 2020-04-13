'use strict';

import { h, Component } from 'preact';
import {route} from 'preact-router';
import { view } from 'z-preact-easy-state';

import Link from '@material-ui/core/Link';
import Container from '@material-ui/core/Container';

const timestamp = require('monotonic-timestamp');

const utils = require('../utils.js');
const Scan = require('./scan.js');

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
      this.analyze(e.target.result);
    };

    reader.readAsText(this.state.file)
  }
  
  analyze(data) {    
    const lines = data.split(/\r?\n/);

    const metadata = '';
    const wells = {};

    var channelNames;
    var foundStart;
    var i, j, line, wellName, cycle, fields;
    for(i=0; i < lines.length; i++) {
      line = lines[i].split(',');
//      console.log("LINE:", line);
      if(!foundStart) {
        // Look for first two header columns called Well and Cycle
        if(line[0].match(/^\s*well\s*$/i) && line[1].match(/^\s*cycle\s*$/i)) {
          channelNames = line.slice(2); // grab channel names from header
          console.log("Found channel names:", channelNames);
          foundStart = true;
          continue;
        }
        metadata += line + "\n";
        continue;
      }

      if(!line[0] || (!line[1] && line[1] !== 0)) {
        continue;
      }
      
      // Now we've reached the actual data;
      wellName = line[0].trim().toUpperCase();
      cycle = line[1].trim();
      fields = line.slice(2);

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
  }

  
  
  render() {

    var fileUploader = '';

    if(!this.state.file) {
      fileUploader = (
          <input type="file" onChange={this.openFile.bind(this)} />
      );
    } else if(!this.state.analyzing) {
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
    
    
    return (
        <Container>
        <h3>Analyze qPCR results</h3>
        <p>Select CSV file to analyze</p>
        {fileUploader}
      </Container>
    )
  }
}

module.exports = view(AnalyzeQPCR);
  
