'use strict';

import { h, Component } from 'preact';
import {route} from 'preact-router';
import { view } from 'z-preact-easy-state';

import Link from '@material-ui/core/Link';
import Container from '@material-ui/core/Container';

const timestamp = require('monotonic-timestamp');
const async = require('async');

const utils = require('../utils.js');
const Plate = require('./plate.js');
const eds = require('../../../lib/eds-handler');

// Max file size in bytes to read into client
const FILE_SIZE_MAX = 1024 * 1024 * 1024 * 10; // 10 MB

class AnalyzeQPCR extends Component {
  
  constructor(props) {
    super(props);

    this.setState({
      toggles: {}
    });
  }


  componentDidUpdate(prevProps) {

  }
  
  componentDidMount() {
//    this.componentDidUpdate();
  }

  getPlate(barcode) {
    app.actions.getPhysicalByBarcode(barcode.toLowerCase(), (err, plate) => {
      if(err) {
        if(!err.notFound) {
          app.notify("Plate barcode not found in LIMS", 'error');
          return;
        }
        app.notify(err, 'error');
        return;
      }

      this.calculateWellResults(this.state.result.wells, plate);
      
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
      this.fileData = e.target.result;      

      try {
        this.analyze(e.target.result);
      } catch(e) {
        console.error(e);
        app.notify("Failed to parse .eds file", 'error');
        
        this.setState({
          file: undefined,
          analyzing: undefined
        })
      }
    };

    reader.readAsArrayBuffer(this.state.file)
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
    
    if(ctrl === 'negativeControl') {
      if((famCtUn || famCt === 0) && (vicCtUn || vicCt === 0)) {
        return false;
      } else {
        return "Plate blank control (negative control) was not blank"
      }
    }

    if(ctrl === 'positiveControl') {
      if(!vicCtUn && vicCt < 32 && !famCtUn && famCt < 32) {
        return true;
      } else {
        return "Plate positive control was not positive";
      }
    }

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

  calculateWellResults(wells, plate) {
    var plateWells = plate.wells;

    var wellName, well, outcome, ctrl;
    for(wellName in wells) {
      well = wells[wellName].result;

      if(plateWells && plateWells[wellName]) {
        ctrl = plateWells[wellName].special;
      }
      
      if(!well['FAM']) {
        outcome = "Missing data from FAM channel";
      } else if(!well['VIC']) {
        outcome = "Missing data from VIC channel";
      } else {
        outcome = this.calculateWellResult(well['FAM']['Ct'], well['VIC']['Ct'], ctrl);
      }

      well.outcome = outcome;
    }
  }
  
  analyze(data) {    
    eds.parse(data, (err, res) => {
      if(err) {
        console.error(err);
        app.notify(err, 'error');
        return;
      }

      this.setState({
        analyzing: false,
        result: res
      })
      
      this.getPlate(res.metadata.barcode);
    });
    

  }


  saveAndReport() {

    if(!this.state.result) {
      app.notify("No analyzed results available to save or report.", 'error');
      return;
    }
    
    if(!this.state.plate || !this.state.plate.id) {
      app.notify("No plate associated. Cannot save or report.", 'error');
      return;
    }

    if(!this.state.csvData) {
      app.notify("No .eds file associated. Cannot save or report.", 'error');
      return;
    }

    const result = Object.assign({}, this.state.result); // clone results
    result.plateID = this.state.plate.id;
    result.csvData = this.state.csvData;
        
    app.actions.saveQpcrResult(result, (err, resultID) => {
      if(err) {
        console.error(err);
        app.notify("Failed to save analyzed results: " + err, 'error');
        return;
      }

      result.wells = {};
    
      const wellNames = getWellNames(8, 12);
      for(let wellName of wellNames) {
        if(!this.state.toggles[wellName]) continue;
        
        let plateMapWell = this.state.plate.wells[wellName];
        let resultWell = this.state.results.wells[wellName];
        
        if(!plateMapWell || !resultWell) {
          continue
        }
        
        let res = this.toHumanResult(plateMapWell, resultWell)
        if(!res.reportable) continue;
        
        result.wells[wellName] = resultWell;
      }

      // We use the qpcr analysis resultID as the rimbaud resultID
      this.generateRimbaudReports(result, resultID, (err, reports) => {
        if(err) {
          console.error(err);
          app.notify("Failed to generate Rimbaud reports: " + err, 'error');
          return;
        }
        
        this.sendRimbaudReports(reports, (err, count) => {
          if(err) {
            console.error(err);
            app.notify("Failed to report results to Rimbaud: " + err, 'error');
            return;
          }

          app.notify("Saved and reported " + count + " results!", 'success');
          
        });
      });
    });
   
  }

  // results is an object like: {orderID: <string>, data: []}
  // where the data array will contain an array of all the relevant data entries.
  // An entry is e.g.
  // {type: 'testResult', plateID: <string>, well: 'A1', result: 'positive', protocol: 'bgi', version: '0.0.1'}
  //  there might be more if there was re-tests but maybe that array
  //  will always only have one element
  //
  // other fields that would be nice:
  //   plateBarcode, sampleID and sampleBarcode
  //   user who ran analysis
  //   user who did initial accession  
  generateRimbaudReport(result, wellName, resultID, cb) {
    const well = this.state.plate.wells[wellName];
    if(!well || !well.id) return cb(new Error("Well "+wellName+" not found in plate layout"));

//    console.log("Well ID:", well.id, well.special);

    // Special wells are e.g. positive and negative controls
    // They do not have samples associated
    if(well.special) {
      return cb();
    }
    
    app.actions.getObject(well.id, (err, sample) => {
      if(err) return cb(new Error("Sample not found for well "+wellName));
      

      if(!sample.formBarcode) {
        return cb(new Error("Form/Order ID for well "+wellName+" was not found"));
      }

      const resultWell = result.wells[wellName];

      // We can't report if there's no result
      if(!resultWell) return cb();

      var rimbaudResult;
      if(resultWell.result === true) {
        rimbaudResult = 'positive';
      } else if(resultWell.result === false) {
        rimbaudResult = 'negative';
      } else if(resultWell.result === 'inconclusive') {
        rimbaudResult = 'inconclusive';
      } else {
        // we don't report if it's not one of those three values
        return cb(); 
      }
      
      const report = {
        id: resultID,
        orderID: sample.formBarcode,
        sampleID: sample.id,
        sampleBarcode: sample.barcode,
        plateID: this.state.plate.id,
        plateBarcode: this.state.plate.barcode,
        well: wellName,
        'cov-2': rimbaudResult,
        protocol: result.protocol,
        analyzedBy: (app.state.user) ? app.state.user.name : 'Unknown',
        reportFormatVersion: '0.0.1'
      };

      console.log("Report:", report);
      
      cb(null, report);
    });
  }
  

  generateRimbaudReports(result, resultID, cb) {
    if(!result) return cb(new Error("No results to report"));

    const reports = [];
    const wellNames = Object.keys(this.state.plate.wells);
    
    async.eachSeries(wellNames, (wellName, next) => {

      this.generateRimbaudReport(result, wellName, resultID, (err, report) => {
        if(err) return next(err);

        if(report) {
          reports.push(report);
        }

        next();
      });
    }, (err) => {
      if(err) return cb(err);
      
      cb(null, reports);
    });

  }

  sendRimbaudReports(reports, cb) {
    if(!reports || !reports.length) return cb(new Error("Nothing to report"));

    var count = 0;
    
    async.eachSeries(reports, (report, next) => {

      const toSend = {
        results: [report]
      };
      
      app.actions.rimbaudReportResult(report.orderID, toSend, (err) => {
        if(err) return cb(err);

        count++;

        next();
      })
    }, (err) => {
      if(err) return cb(err);

      cb(null, count);
    });

  }

  toHumanResult(plateMapWell, resultWell) {
    function toText(bool) {
      if(bool === true) return 'Positive';
      if(bool === false) return 'Negative';
      return bool;
    }
    
    if(plateMapWell && plateMapWell.special) {

      if(!resultWell) {
        return {
          msg: "This is a plate control without any qPCR results",
          reportable: false,
          fail: true,
          result: 'NA'
        }
      }
      if((plateMapWell.special === 'negativeControl' && resultWell.outcome === false) || (plateMapWell.special === 'positiveControl' && resultWell.outcome === true)) {
        return {
          msg: "This is a plate control",
          reportable: false,
          result: toText(resultWell.outcome)
        }
      } else {
        return {
          msg: "Plate control with unexpected qPCR result",
          reportable: false,
          fail: true,
          result: toText(resultWell.outcome)
        }
      }
    }
    
    if(!plateMapWell && resultWell) {
      return {
        msg: "Unreportable: No well in well map for this qPCR result",
        reportable: false,
        result: toText(resultWell.outcome)
      }
    }

    if(plateMapWell && !resultWell) {
      return {
        msg: "No qPCR result for this well",
        reportable: false,
        result: 'NA'
      }
    }
    
    return {
      reportable: true,
      result: toText(resultWell.outcome)
    }
  }

  toggleResult(e) {
    var toggles = this.state.toggles || {};
    toggles[e.target.value] = e.target.checked;
    this.setState({
      toggles: toggles
    });
    
//    console.log("Check:", e.target.value, e.target.checked);
  }

  checkAll() {
    const wellNames = getWellNames(8, 12);
    const toggles = {};
    for(let wellName of wellNames) {
      toggles[wellName] = true;
    }
    
    this.setState({
      toggles: toggles
    });
  }

  uncheckAll() {
    const wellNames = getWellNames(8, 12);
    const toggles = {};
    for(let wellName of wellNames) {
      toggles[wellName] = false;
    }
    
    this.setState({
      toggles: toggles
    });
  }

  toReportCount() {
    var count = 0;
    for(let key in this.state.toggles) {
      if(this.state.toggles[key]) count++;
    }
    return count;
  }

  render() {

    if(!eds) {
      return (
          <Container>
            Analyzing qPCR data requires the <b>eds-handler</b> library.
          </Container>
      );
    }
    
    var plate = '';
    if(!this.state.file) {
      return (
          <Container>
          <p>Select .eds file to load</p>
          <input type="file" onChange={this.openFile.bind(this)} />
          </Container>
      );

    } else if(!this.state.result) {
      return (
          <Container>
          <p>Ready for analysis: {this.state.file.name}</p>
          <p><button onClick={this.loadFile.bind(this)}>Analyze</button></p>
          {plate}
          </Container>
      ); 
      
    } else if(!this.state.plate) {
        return (
            <Container>
            <p>Loading plate...</p>
        </Container>
        );
    } else if(this.state.plate) {

      plate = (
          <div>
          <h3>Plate layout from LIMS</h3>
          <ul>
          <li><b>Plate barcode:</b> {this.state.plate.barcode}</li>
          <li><b>Created at:</b> {utils.formatDateTime(this.state.plate.createdAt)}</li>
          <li><b>Created by:</b> {this.state.plate.createdBy || 'Unknown'}</li>
          </ul>
          <Plate occupied={this.state.plate.wells}  />
          {results}
        </div>
      );

      var metadata = '';
      
      var lis = [];
      var metaVal;
      for(let key in this.state.result.metadata) {
        metaVal = this.state.result.metadata[key];
        if(!metaVal || typeof metaVal !== 'string') continue;
        lis.push((
            <li><b>{key}</b>: {metaVal}</li>
        ));
      }
      metadata = (
          <div>
          <h3>Metadata from .eds file</h3>
          <ul>
          {lis}
        </ul>
          </div>
      )
      
        
      var failMsgs = [];
      var results = '';
      if(this.state.result) {

        var fail = [];
        var wellResults = [];
        const wellNames = getWellNames(8, 12);
        for(let wellName of wellNames) {

          let plateMapWell = this.state.plate.wells[wellName];

          let well = this.state.result.wells[wellName]
          
          
          if(plateMapWell || well) {
            let resultWell = well.result;
            let result = this.toHumanResult(plateMapWell, resultWell)
            if(result.fail) fail.push({well: wellName, msg: result.msg});
            
            wellResults.push((
                <tr>
                <td><input type="checkbox" onClick={this.toggleResult.bind(this)} value={wellName} disabled={!result.reportable} checked={!!result.reportable && this.state.toggles[wellName]} /></td>
                <td>{wellName}</td>
                <td>{(plateMapWell) ? plateMapWell.barcode : "No plate mapping"}</td>
                <td>{(resultWell) ? resultWell['FAM']['Ct'] : "No result"}</td>
                <td>{(resultWell) ? resultWell['VIC']['Ct'] : "No result"}</td>
                <td>?</td>
                <td>{result.result}</td>
                <td></td>
                
              </tr>
            ));
          }
        }
        if(fail.length) {
          for(let f of fail) {
            failMsgs.push((
                <p>Error for well {f.well}: {f.msg}</p>
            ))
          }
        }
        
        results = (
            <div>
            <h3>Results</h3>
            <p>Check the checkbox next to each of the results that you want to sign off on and report, then click the "Save and report" button at the bottom of this page.</p>
            <p><button onClick={this.checkAll.bind(this)}>Check all</button><button onClick={this.uncheckAll.bind(this)}>Uncheck all</button></p>
            <table cellspacing="3" border="1">
            <thead>
            <tr>
            <th>Accept?</th>
            <th>Well</th>
            <th>Sample barcode</th>
            <th>FAM Ct</th>
            <th>VIC Ct</th>
            <th>Re-run count</th>
            <th>Result</th>
            <th>Message</th>
            </tr>
            </thead>
            <tbody>
            {wellResults}
          </tbody>
            </table>
            <p><button onClick={this.saveAndReport.bind(this)} disabled={!this.toReportCount() || fail.length}>Save and report results</button></p>
            {failMsgs}
          </div>
        )
      }
    }

    

    
    return (
      <Container>
        <h3>qPCR result analyzer</h3>
        {metadata}
        {plate}
        {results}
      </Container>
    )
  }
}

// Generate array of well names
function getWellNames(numRows, numCols) {
  var names = [];
  const startLetter = 'A'.charCodeAt(0);
  const endLetter = Math.min(startLetter+numRows - 1, 'Z'.charCodeAt(0));
  
  var row, col;
  for(row=startLetter; row <=endLetter; row++) {
    for(col=1; col <= numCols; col++) {
      names.push(String.fromCharCode(row)+col);
    }
  }
  return names;
}

module.exports = view(AnalyzeQPCR);
  
