'use strict';

import { h, Component } from 'preact';
import {route} from 'preact-router';
import { view } from 'z-preact-easy-state';

import Link from '@material-ui/core/Link';
import Container from '@material-ui/core/Container';

const timestamp = require('monotonic-timestamp');
const async = require('async');

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
        console.error(e);
        app.notify("Failed to parse CSV file", 'error');
        
        this.setState({
          file: undefined,
          analyzing: undefined
        })
      }
    };

    reader.readAsText(this.state.file)
  }

  calculateWellResult(channel1, channel2) {

    // TODO implement real analysis

    if(!channel1 || !channel2) {
      return undefined;
    }
    
    const n1 = parseFloat(channel1[30]);
    const n2 = parseFloat(channel2[30]);
    
    if(isNaN(n1) || isNaN(n2)) {
      return undefined;
    }

    if(n1 > 30000 && n2 > 20000) {
      return true;
    }

    return false;
  }

  calculateWellResults(wells) {
    var results = {};
    
    var wellName, well;
    for(wellName in wells) {
      well = wells[wellName];
      results[wellName] = this.calculateWellResult(well['FAM'], well['ROX'])
    }

    return {
      protocol: "BGI 0.0.1",
      wells: results
    }
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
      
      for(j=0; j < fields.length; j++) {
        let channelName = channelNames[j] || j;
        
        if(!wells[wellName][channelName]) {
          wells[wellName][channelName] = {};
        }
        
        wells[wellName][channelName][cycle] = fields[j];
      }
    }

    metadata["Channels"] = channelNames.join(', ');
    metadata["Number of cycles"] = highestCycle - 1

    const results = this.calculateWellResults(wells);
    
    this.setState({
      analyzing: false,
      csvData: data,
      wells: wells,
      results: results,
      metadata: metadata
    });    
  }


  saveAndReport() {

    if(!this.state.results) {
      app.notify("No analyzed results available to save or report.", 'error');
      return;
    }
    
    if(!this.state.plate || !this.state.plate.id) {
      app.notify("No plate associated. Cannot save or report.", 'error');
      return;
    }

    if(!this.state.csvData) {
      app.notify("No CSV file associated. Cannot save or report.", 'error');
      return;
    }
    
    const result = Object.assign({}, this.state.results); // clone results
    result.plateID = this.state.plate.id;
    result.csvData = this.state.csvData;
    
    app.actions.saveQpcrResult(result, (err) => {
      if(err) {
        console.error(err);
        app.notify("Failed to save result: " + err, 'error');
        return;
      }

      console.log("SAVED!");
      
      this.generateRimbaudReport(result, 'A1', (err, report) => {
        if(err) {
          console.log(err);
          return
        }
        console.log("Report:", report);
      });
    });
   
  }

  // Generate a rimbaud report for a single well given a well name like 'A1'
  // and a result object as generated by this.saveAndReport()
  generateRimbaudReport(result, wellName, cb) {
    const well = this.state.plate.wells[wellName];
    if(!well || !well.id) return cb(new Error("Well "+wellName+" not found in plate layout"));
    
    app.actions.getObject(well.id, (err, sample) => {
      if(err) return cb(new Error("Sample not found for well "+wellName));
      

      if(!sample.formBarcode) {
        return cb(new Error("Form ID for well "+wellName+" was not found"));
      }

//      const report = 
      
      cb(null, report);
    });
  }
  
  // results is an array of objects like: {orderID: <string>, data: []}
  // where the data array will contain an array of all the relevant data entries.
  // An entry is e.g.
  // {type: 'testResult', plateID: <string>, well: 'A1', result: 'positive', protocol: 'BGI'}
  // other fields that would be nice:
  //   plateBarcode, sampleID and sampleBarcode
  //   user who ran analysis
  //   user who did initial accession
  rimbaudReportAll(results, cb) {
    if(!results || !results.length) return cb(new Error("No results to report"));

    async.eachSeries(results, (result, next) => {
      // TODO this.generateRimbaudReport
      app.actions.rimbaudReportResult(result.orderID, result.data, next);
    }, cb);

  }

  toHumanResult(result) {
    if(result === true) return (
      <span style="color:red">Positive</span>
    );
    if(result === false) return (
      <span style="color:green">Negative</span>
    );
    
    return (
      <span>Unknown</span>
    );
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

      var results = '';
      if(this.state.results) {
        var wellResults = [];
        for(let wellName in this.state.results.wells) {
          let wellResult = this.state.results.wells[wellName];
          wellResults.push((
              <li><b>{wellName}:</b> {this.toHumanResult(wellResult)}</li>
          ));
        }
        results = (
          <div>
            <h3>Results</h3>
            <p><b>Protocol used:</b> {this.state.results.protocol}</p>
            <ul>
            {wellResults}
          </ul>
            <p><button onClick={this.saveAndReport.bind(this)}>Save and report results</button></p>
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
      {results}
      </Container>
    )
  }
}

module.exports = view(AnalyzeQPCR);
  
