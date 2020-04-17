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

  // Returns a string on error
  // Return false if test came out negative
  // and true if it came out positive
  calculateWellResult(famCtStr, vicCtStr, ctrl) {
    const undeterminedRegExp = new RegExp(/^\s*undetermined\s*$/i);
        
    const famCt = parseFloat(famCtStr);
    const famCtUn = famCtStr.match(undeterminedRegExp);
    const vicCt = parseFloat(vicCtStr);
    const vicCtUn = vicCtStr.match(undeterminedRegExp);

    if(!famCtUn && isNaN(famCt)) {
      return "cT for FAM channel was unrecognized value";
    }

    if(!vicCtUn && isNaN(vicCt)) {
      return "cT for VIC channel was unrecognized value";
    }
    
    if(ctrl === 'blank') {
      if((famCtUn || famCt === 0) && (vicCtUn || vicCt === 0)) {
        return false;
      } else {
        return "Plate blank control (negative control) was not blank"
      }
    }

    if(ctrl === 'positive') {
      if(!vicCtUn && vicCt < 32 && !famCtUn && famCt < 32) {
        return true;
      } else {
        return "Plate positive control was not positive";
      }
    }
    
    /*
    if(ctrl === 'specimen') {
      if(!vicCtUn && vicCt < 32 && !famCtUn && famCt < 32) {
        return true;
      } else {
        return "Plate 'testing specimen'-control was not positive";
      }
    }
    */

    if(famCtUn || famCt === 0) {
      if(vicCt < 32) {
        return false; // test was negative
      } else {
        return 'retest';
      }
    } else {
      if(famCt < 38) {
        return true; // test was positive
      } else {
        return 'retest';
      }
    }
  }

  calculateWellResults(wells) {
    
    var wellName, well, result, ctrl;
    for(wellName in wells) {
      well = wells[wellName];
      
      if(wellName === 'A1') { // TODO hardcoded control positions!
        ctrl = 'blank'
      } else if(wellName === 'B1') {
        ctrl = 'positive'
      } else {
        ctrl = false;
      }
      
      if(!well['FAM']) {
        result = "Missing data from FAM channel";
      } else if(!well['VIC']) {
        result = "Missing data from VIC channel";
      } else {
        result = this.calculateWellResult(well['FAM'].ct, well['VIC'].ct, ctrl);
      }

      well.result = result;
    }

    const o = {
      protocol: "BGI 0.0.1",
      wells: wells,
    };

    var errors = [];

    if(!wells['A1']) {
      errors.push("Plate blank (negative) control was missing");
    } else if(wells['A1'].result !== false) {
      errors.push(wells['A1'].result)
    }

    if(!wells['B1']) {
      errors.push("Plate positive control was missing");
    } else if(wells['B1'].result !== true) {
      errors.push(wells['B1'].result);
    } 

    if(errors.length) {
      o.errors = errors;
    }

    return o;
  }
  
  analyze(data) {    
    const lines = data.split(/\r?\n/);

    var metadata = {};
    const wells = {};

    var foundStart;
    var highestCycle = 0;
    var i, j, line, wellName, sampleName, reporter, ct;
    for(i=0; i < lines.length; i++) {
      line = lines[i].split(',');

      if(!foundStart) {

        // Look for first two header columns called Well and Cycle
        if(line[0].match(/^\s*well\s*$/i) && line[1].match(/^\s*sample\s+name\s*$/i)) {
          foundStart = true;
          continue;
        }
        if(line[0].trim() && line[1].trim()) {
          metadata[line[0].trim()] = line[1].trim()
        }
        continue;
      }
      if(!line[0] || !line[1] || !line[4] || !line[6]) {
        continue;
      }
      
      const o = {
        wellName: line[0].trim(),
        sampleName: line[1].trim(),
        reporter: line[4].trim(),
        ct: line[6].trim()
      };
      
      if(!o.wellName || !o.reporter || !o.ct) {
        continue;
      }
      
      if(!wells[o.wellName]) {
        wells[o.wellName] = {}
      }
      
      wells[o.wellName][o.reporter] = o;
    }

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

  toHumanResult(well) {
    if(well.result === true) return (
      <span style="color:red">Positive</span>
    );
    if(well.result === false) return (
      <span style="color:green">Negative</span>
    );
    
    return (
      <span style="color:blue">{well.result}</span>
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
        if(this.state.results.errors) {
          let errors = [];
          for(let err of this.state.results.errors) {
            errors.push((
              <li>Error: {this.state.results.errors}</li>
            ));
          }
          return (
              <div>
              <h3>Plate control error(s):</h3>
              <ul>
              {errors}
              </ul>
            </div>
          );
        }
        
        var wellResults = [];
        console.log("AAAAA", this.state.results);
        for(let wellName in this.state.results.wells) {
          let well = this.state.results.wells[wellName];
          wellResults.push((
              <li><b>{wellName}:</b> {this.toHumanResult(well)}</li>
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
  
