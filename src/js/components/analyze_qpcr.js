'use strict';

import { h, Component } from 'preact';
import {route} from 'preact-router';
import { view } from 'z-preact-easy-state';
import linkState from 'linkstate';

import Link from '@material-ui/core/Link';
import Container from '@material-ui/core/Container';
import Modal from '@material-ui/core/Modal';

const timestamp = require('monotonic-timestamp');
const async = require('async');

const utils = require('../utils.js');
const validatorUtils = require('../../../validators/common/utils.js');
const Plate = require('./plate.js');
const Plot = require('./plot.js');
const eds = require('eds-handler');
const qpcrResultXLS = require('../qpcr_result_xls.js');

const negPosNames = ['NTC', 'POS'];

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

  checkIfOrdersExist(plate, cb) {

    const wellNames = Object.keys(plate.wells);

    
    async.eachSeries(wellNames, (wellName, next) => {
      const well = plate.wells[wellName];
      if(!well.barcode) return next();
      
      const wellBarcode = well.barcode.toLowerCase();
      //      app.actions.getObject(well.id, (err, obj) => {
      app.actions.getPhysicalByBarcode(wellBarcode, (err, obj) => {
        if(err) return next();

        if(obj.formBarcode) {
          well.formBarcode = obj.formBarcode;
        }

        next();
      });
    }, (err) => {
      if(err) return cb(err);

      cb(null, plate);
    });
  }

  getPlate(barcode, cb) {
    app.actions.getPhysicalByBarcode(barcode.toLowerCase(), (err, plate) => {
      if(err) {
        if(!err.notFound) {
          return cb(new Error("Plate barcode not found in LIMS"));
        }
        return cb(new Error(err));
      }

      console.log("GOT PLATE!:", plate);

      this.checkIfOrdersExist(plate, (err, plate) => {
        if(err) return cb(err);

        cb(null, plate);
      });
      
//      cb(null, plate);
        
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

  loadFileRenegade() {
    this.loadFile('rb-xp');
  }

  loadFileBGI() {
    this.loadFile('bgi');
  }
  
  loadFile(protocol) {
    this.setState({
      analyzing: true
    });
    
    if(!this.state.file) {
      app.notify("No file to open", 'error');
      return;
    }
    
    var reader = new FileReader();
    
    reader.onload = (e) => {

      var parseFunc; 
      try {
        if(this.state.file.name.match(/\.eds$/i)) {
          parseFunc = this.parseEDS.bind(this);
        } else if(this.state.file.name.match(/\.xlsx?$/i)) {
          parseFunc = this.parseXLS.bind(this);
        } else {
          throw new Error("File must be .eds or .xlsx");
        }

        const fileData = e.target.result;
        
        parseFunc(fileData, (err, result) => {
          if(err) throw err;

          this.setState({
            analyzing: false,
            edsFileData: fileData
          })
          
          this.analyze(result, protocol);
        })
        
      } catch(e) {
        console.error(e);
        app.notify("Failed to parse file: " + e, 'error');
        
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
  calculateWellOutcomeRenegade(reporterCtStr, intCtrlCtStr, ctrl, isRetest) {
    const undeterminedRegExp = new RegExp(/^\s*undetermined\s*$/i);
        
    var reporterCt = parseFloat(reporterCtStr);
    const reporterCtUn = reporterCtStr.match(undeterminedRegExp);
    var intCtrlCt = parseFloat(intCtrlCtStr);
    const intCtrlCtUn = intCtrlCtStr.match(undeterminedRegExp);

    if(!reporterCtUn && isNaN(reporterCt)) {
      return "cT for reporter channel was unrecognized value";
    }

    if(!intCtrlCtUn && isNaN(intCtrlCt)) {
      return "cT for internal control channel was unrecognized value";
    }

    if(reporterCtUn || reporterCt >= 40) {
      reporterCt = 0;
    }

    if(intCtrlCtUn || intCtrlCt >= 40) {
      intCtrlCt = 0;
    }
    
    if(ctrl === 'negativeControl') {
      if(reporterCt === 0 && intCtrlCt === 0) {
        return false;
      } else {
        return "Plate blank control (negative control) was not blank"
      }
    }

    if(ctrl === 'positiveControl') {
      if(intCtrlCt > 0 && intCtrlCt <= 40 && reporterCt > 0 && reporterCt <= 40) {
        return true;
      } else {
        return "Plate positive control was not positive";
      }
    }

    if(intCtrlCt == 0 || intCtrlCt > 40) {
      if(isRetest) {
        return "Internal control failed after retest";
      } else {
        return 'retest';
      }
    }

    if(reporterCt == 0 || reporterCt >= 40) {
      return false;
    }

    if(reporterCt > 0 && reporterCt < 40) {
      return true;
    }

    return "Internal error. Unable to determine result: " + reporterCt + ' | ' + intCtrlCt;
  }

  
  // Returns a string on error
  // Return false if test came out negative
  // and true if it came out positive
  calculateWellOutcomeBGI(famCtStr, vicCtStr, ctrl, isRetest) {
    const undeterminedRegExp = new RegExp(/^\s*undetermined\s*$/i);
        
    var famCt = parseFloat(famCtStr);
    const famCtUn = famCtStr.match(undeterminedRegExp);
    var vicCt = parseFloat(vicCtStr);
    const vicCtUn = vicCtStr.match(undeterminedRegExp);

    if(!famCtUn && isNaN(famCt)) {
      return "cT for FAM channel was unrecognized value";
    }

    if(!vicCtUn && isNaN(vicCt)) {
      return "cT for VIC channel was unrecognized value";
    }

    if(famCtUn || famCt >= 40) {
      famCt = 0;
    }

    if(vicCtUn || vicCt >= 40) {
      vicCt = 0;
    }
    
    if(ctrl === 'negativeControl') {
      if(famCt === 0 && vicCt === 0) {
        return false;
      } else {
        return "Plate blank control (negative control) was not blank"
      }
    }

    if(ctrl === 'positiveControl') {
      if(vicCt > 0 && vicCt <= 35 && famCt > 0 && famCt <= 37) {
        return true;
      } else {
        return "Plate positive control was not positive";
      }
    }

    if(vicCt == 0 || vicCt > 35) {
      if(isRetest) {
        return "Internal control failed after retest";
      } else {
        return 'retest';
      }
    }

    if(famCt > 37) {
      if(isRetest) {
        return false;
      } else {
        return 'retest';
      }
    }

    if(famCt > 0 && famCt <= 37) {
      return true;
    }

    return false;
  }

  // Set the .outcome for each well 
  calculateWellOutcomes(wells, plate, protocol) {
    var plateWells = plate.wells;

    var wellName, well, outcome, ctrl;
    for(wellName in wells) {
      well = wells[wellName].result;

      if(plateWells && plateWells[wellName]) {
        ctrl = plateWells[wellName].special;
      }
      
      if(!well['reporter']) {
        outcome = "Missing data from reporter channel";
      } else if(!well['intCtrl']) {
        outcome = "Missing data from internal control channel";
      } else {
        if(protocol === 'bgi') {
          outcome = this.calculateWellOutcomeBGI(well['reporter']['Ct'], well['intCtrl']['Ct'], ctrl);
        } else if(protocol === 'rb-xp') {
          outcome = this.calculateWellOutcomeRenegade(well['reporter']['Ct'], well['intCtrl']['Ct'], ctrl);
        } else {
          throw new Error("Unknown protocol: " + protocol);
        }
      }

      well.outcome = outcome;
    }
  }

  // Given a result.wells object and a sample barcode
  // return the well that matches this barcode
  resultWellByBarcode(wells, barcode) {
    barcode = barcode.toLowerCase();
    var well, wellName;
    for(wellName in wells) {
      well = wells[wellName];
      if(well.barcode === barcode) {
        return well;
      }
    }
    return undefined;
  }

  // For a well/sample which had the outcome: 'retest'
  // Given the current result for this well
  // and an array of previous results for the same sample
  // return an updated outcome.
  calculateRetestOutcome(wellResult, prevResults) {
    const undeterminedRegExp = new RegExp(/^\s*undetermined\s*$/i);

    var allSampleResults = prevResults.concat([wellResult]);

    // how many results had a FAM Ct higher than 38?
    var highFAMCtCount = 0;

    // how many results had a VIC Ct lower than or equal to 32?
    var lowVICCtCount = 0;
    
    var sampleResult, result, famCtStr, famCt, famCtUn, vicCtStr, vicCt, vicCtUn;
    for(sampleResult of allSampleResults) {
      result = sampleResult.result;

      famCtStr = result['FAM']['Ct'];
      famCt = parseFloat(famCtStr);
      famCtUn = famCtStr.match(undeterminedRegExp);
      vicCtStr = result['VIC']['Ct'];
      vicCt = parseFloat(vicCtStr);
      vicCtUn = vicCtStr.match(undeterminedRegExp);

//      console.log("EEE:", wellResult.barcode, famCt)
      
      if(!famCtUn && famCt > 38) {
        highFAMCtCount++;
      }
      
      if(!vicCtUn && vicCt <= 32) {
        lowVICCtCount++;
      }
      
    }

    // TODO check if S-curve or not
    
    // If more than one test resulted in FAM Ct > 38 then we can report positive
    if(highFAMCtCount >= 2) {
      console.log("  positive!");
      return true;
    }

    // If more than one test resulted in VIC Ct <= 32 then we can report negative
    if(lowVICCtCount >= 2) {
      return false;
    }
    
    return "Failed after retest. Re-extract RNA or re-swab patient.";
  }
  
  // Check if any of the results that need re-testing
  // have previously been tested
  // and if so, update the .outcome accordingly
  handleRetests(result, plate, cb) {
    // The barcodes for samples where we want to check
    // if they've previously been tested 
    const barcodesToCheck = []; 
    
    var well, wellName, wellResult;
    for(wellName in result.wells) {
      well = result.wells[wellName];
      if(!well.result) continue;

      if(well.result.outcome === 'retest') {
        barcodesToCheck.push(well.barcode);
      }
    }

    app.actions.getResultsForSampleBarcodes(barcodesToCheck, (err, allSampleResults) => {
      if(err) return cb(err);
      
      var sampleBarcode, sampleResults, sampleResult, well, outcome, prevResults;
      for(sampleBarcode in allSampleResults) {
        sampleResults = allSampleResults[sampleBarcode];

        prevResults = [];
        for(sampleResult of sampleResults) {

          if(!sampleResult.resultID || sampleResult.resultID === result.id) {
            // Skip previous results for the same plate and sample barcode
            // since that's just a result from the previous analysis
            // of this exact same plate
            continue;
          }

          prevResults.push(sampleResult);
        }
        if(!prevResults.length) continue;
        
        well = this.resultWellByBarcode(result.wells, sampleResult.barcode);
        if(!well) {
          return cb(new Error("Unable to find well for sample: " + sampleResult.barcode));
        }

        if(!well.result) {
          continue;
        }

        // We don't do anything for related to retests for neg/pos control wells
        if(well.special) {
          continue;
        }

        outcome = this.calculateWellOutcome(well.result['FAM']['Ct'], well.result['VIC']['Ct'], null, true);
        //outcome = this.calculateRetestOutcome(well, prevResults);
        
        well.result.outcome = outcome;
        well.result.prevResults = prevResults;
      }
      cb(null);
    });
  }
  
  // Post process the parsed result
  // check the result layout against the plate layout
  postProcessResult(result, plate) {
    if(!result.wells) return;

    var well, wellName, wellResult;
    for(wellName in result.wells) {
      well = result.wells[wellName];
      wellResult = well.result;
      if(!wellResult) continue;

      if(!wellResult['reporter'] || !wellResult['reporter']['Sample Name']) {
        continue;
      }
      
      // The field 'Sample Name' from the parsed .eds file
      // is the barcode of the sample.
      // Since we're using the qPCR software's "sample name" field
      // to store these barcodes so we can map the results back to their samples.
      // For negative and positive controls these will be 'NTC' or 'POS'
      const sampleBarcode = wellResult['reporter']['Sample Name'].trim();
      
      if(negPosNames.indexOf(sampleBarcode) >= 0) {
        // TODO check for plate layout changes for pos/neg controls
        continue;
      }
      well.barcode = sampleBarcode.toLowerCase();

      if(this.state.allowDiscrepancies) {
        continue;
      }
      
      if(!plate.wells[wellName]) {
        throw new Error("Plate layout was changed since .eds file was generated! Well "+wellName+" has sample "+well.barcode+" mapped in the .eds file, but is not mapped in the plate layout");
      }
      if(well.barcode !== plate.wells[wellName].barcode.toLowerCase()) {
        throw new Error("Plate layout was changed since .eds file was generated! Well "+wellName+" has sample "+well.barcode+" mapped in the plate layout, but the .eds file has the same well mapped to sample "+plate.wells[wellName].barcode.toLowerCase());
      }
 
    }
  };

  // Some tests use FAM and VIC and others use FAM and CY5 probes
  // This function normalizes so instead
  // they are always called 'reporter' and 'intCtrl'
  normalizeProbeNames(result) {
    if(!result || !result.wells) return result;

    var wellName, well;
    for(wellName in result.wells) {
      well = result.wells[wellName];
      
      if(well.result['FAM']) {
        well.result.reporter = well.result['FAM'];
        delete well.result['FAM'];
      }
      
      if(well.result['CY5']) {
        well.result.intCtrl = well.result['CY5'];
        delete well.result['CY5'];
        
      } else if(well.result['VIC']) {
        well.result.intCtrl = well.result['VIC'];
        delete well.result['VIC'];
        
      }
      if(well.raw['FAM']) {
        well.raw.reporter = well.raw['FAM'];
        delete well.raw['FAM'];
      }
      
      if(well.raw['CY5']) {
        well.raw.intCtrl = well.raw['CY5'];
        delete well.raw['CY5'];
        
      } else if(well.raw['VIC']) {
        well.raw.intCtrl = well.raw['VIC'];
        delete well.result['VIC'];
        
      }
      
    }
    return result;
  }
  
  parseXLS(fileData, cb) {

      
    qpcrResultXLS.parse(fileData, (err, result) => {
      if(err) return cb(err);
      try {
        result = this.normalizeProbeNames(result);
      } catch(e) {
        return cb(e);
      }      
      cb(null, result);
    });
      

  };
  
  parseEDS(fileData, cb) {
    eds.parse(fileData, (err, result) => {
      if(err) return cb(err);

      result = this.normalizeProbeNames(result);

      cb(null, result);
    });
  };

  analyze(result, protocol) {

    if(!result.metadata || !result.metadata.plateName) {
      app.notify("File was missing a result ID", 'error');
      return;
    }
    
    result.id = result.metadata.plateName;
    
    if(!validatorUtils.validateUUID(result.id)) {
      app.notify("File has invalid result ID", 'error');
      return;
    }
    
    this.getPlate(result.metadata.barcode, (err, plate) => {
      if(err) {
        console.error(err);
        app.notify(err, 'error');
        return;
      }

      // Sets the .outcome for each well
      this.calculateWellOutcomes(result.wells, plate, protocol);

      try {
        this.postProcessResult(result, plate);
      } catch(e) {
        console.error(e);
        app.notify(e, 'error');
        return;
      }
      

      this.handleRetests(result, plate, (err) => {
        if(err) {
          console.error(err);
          app.notify(err, 'error');
          return;
        }

        this.setState({
          plate: plate,
          result: result,
          protocol: protocol
        });
        
      });
    });
  }
  

  saveAndReport() {
    this.setState({
      saving: true
    });
    
    if(!this.state.result) {
      app.notify("No analyzed results available to save or report.", 'error');
      return;
    }
    
    if(!this.state.plate || !this.state.plate.id) {
      app.notify("No plate associated. Cannot save or report.", 'error');
      return;
    }

    if(!this.state.edsFileData) {
      app.notify("No .eds file associated. Cannot save or report.", 'error');
      return;
    }

    const result = Object.assign({}, this.state.result); // clone results
    result.plateID = this.state.plate.id;
    result.plateBarcode = this.state.plate.barcode;
    result.edsFileData = this.state.edsFileData;
    result.protocol = this.state.protocol;

    app.actions.saveQpcrResult(result, (err) => {
      if(err) {
        console.error(err);
        app.notify("Failed to save analyzed results: " + err, 'error');
        return;
      }

      result.wells = {};
    
      const wellNames = getWellNames(this.state.plate.size);
      for(let wellName of wellNames) {
        if(!this.state.toggles[wellName]) continue;
        
        let plateMapWell = this.state.plate.wells[wellName];
        let resultWell = this.state.result.wells[wellName];
        
        if(!plateMapWell || !resultWell) {
          continue;
        }
        
        let res = this.toHumanResult(plateMapWell, resultWell)
        if(!res.reportable) continue;

        result.wells[wellName] = resultWell;
      }

      // We use the qpcr analysis resultID as the rimbaud resultID
      this.generateRimbaudReports(result, (err, reports) => {
        if(err) {
          console.error(err);
          app.notify("Failed to generate Rimbaud reports: " + err, 'error');
          return;
        }

        this.sendRimbaudReports(reports, (err, count) => {
          if(err) {
            console.error(err);
            const errStr = "Failed to report result to Rimbaud: " + err;
            if(count) {
              errStr = "Successfully reported " + count + " results but: " + errStr;
            }
            app.notify(errStr, 'error');
            return;
          }

          app.notify("Saved all results and reported " + count + " results!", 'success');
          
        });
      });
    });
   
  }

  // result is an object like: {orderID: <string>, data: []}
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
  generateRimbaudReport(result, wellName, cb) {
    const well = this.state.plate.wells[wellName];
    if(!well || !well.id) return cb(new Error("Well "+wellName+" not found in plate layout"));

    // Skip unchecked wells
    if(!this.state.toggles[wellName]) {
      return cb();
    }
    
    // Special wells are e.g. positive and negative controls
    // They do not have samples associated
    if(well.special) {
      return cb();
    }
    
//    app.actions.getObject(well.id, (err, sample) => {
//      if(err) return cb(new Error("Sample not found for well "+wellName));
      

      if(!well.formBarcode) {
        return cb(new Error("Form/Order ID for well "+wellName+" was not found"));
      }

      const resultWell = result.wells[wellName];

      // We can't report if there's no result
      if(!resultWell || !resultWell.result) return cb();

      console.log("Well:", resultWell);
      
      var rimbaudResult;
      if(resultWell.result.outcome === true) {
        rimbaudResult = 'positive';
      } else if(resultWell.result.outcome === false) {
        rimbaudResult = 'negative';
      } else if(resultWell.result.outcome === 'inconclusive') {
        rimbaudResult = 'inconclusive';
      } else {
        // we don't report if it's not one of those three values
        return cb(); 
      }
      
      const report = {
        id: result.id,
        orderID: well.formBarcode,
        sampleID: well.id,
        sampleBarcode: well.barcode,
        plateID: this.state.plate.id,
        plateBarcode: this.state.plate.barcode,
        well: wellName,
        'cov-2': rimbaudResult,
        reporterCt: resultWell.result.reporter.Ct,
        internalControlCt: resultWell.result.intCtrl.Ct,
        protocol: result.protocol,
        analyzedBy: (app.state.user) ? app.state.user.name : 'Unknown',
        reportFormatVersion: '0.0.1'
      };

      console.log("Report:", report);
      
      cb(null, report);
    
  }
  

  generateRimbaudReports(result, cb) {
    if(!result) return cb(new Error("No results to report"));

    const reports = [];
    const wellNames = Object.keys(result.wells);
    
    async.eachSeries(wellNames, (wellName, next) => {

      this.generateRimbaudReport(result, wellName, (err, report) => {
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
    var errCount = 0;
    
    async.eachSeries(reports, (report, next) => {

      const toSend = {
        results: [report]
      };
      
      app.actions.rimbaudReportResult(report.orderID, toSend, (err, res) => {
        if(err) return next(err);
        try {
          res = JSON.parse(res);
          if(!res.statuses || !res.statuses.length || res.statuses[0] !== 'saved') {
            return next(new Error("Error reporting order " + report.orderID + ": " + res.statuses[0]));
          }
          
          count++;
          
          next();
        } catch(e) {
          return next(err);
        }
      })
    }, (err) => {
      if(err) return cb(err, count);

      cb(null, count);
    });

  }

  outcomeToText(outcome) {
    if(outcome === true) return 'Positive';
    if(outcome === false) return 'Negative';
    if(outcome === 'retest') return 'Retest';
    return outcome;
  }
  
  toHumanResult(plateMapWell, resultWell) {

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
          result: this.outcomeToText(resultWell.outcome)
        }
      } else {
        return {
          msg: "Plate control with unexpected qPCR result",
          reportable: false,
          fail: true,
          result: this.outcomeToText(resultWell.outcome)
        }
      }
    }
    
    if(!plateMapWell && resultWell) {
      return {
        msg: "Unreportable: No well in well map for this qPCR result",
        reportable: false,
        result: this.outcomeToText(resultWell.outcome)
      }
    }

    if(plateMapWell && !resultWell) {
      return {
        msg: "No qPCR result for this well",
        reportable: false,
        result: 'NA'
      }
    }

    if(plateMapWell && !plateMapWell.formBarcode) {
      return {
        msg: "Unreportable: Sample was never accessioned",
        reportable: false,
        result: this.outcomeToText(resultWell.outcome)
      }
    }
    
    if(resultWell.prevResults && resultWell.prevResults.length) {
      if(resultWell.outcome === 'retest') {
        return {
          reportable: false,
          result: 'failed',
          msg: "Result still undetermined after re-test"
        }
      } else {
        return {
          reportable: true,
          result: this.outcomeToText(resultWell.outcome),
          msg: "Result determinted after re-test"
        }
      }
    }
    
    if(resultWell.outcome === 'retest') {
      return {
        reportable: false,
        result: "Retest",
        msg: "Unable to determine result. Re-run sample on a new plate."
      };
    }

    return {
      reportable: true,
      result: this.outcomeToText(resultWell.outcome)
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
    const wellNames = getWellNames(this.state.plate.size);
    const toggles = {};
    for(let wellName of wellNames) {
      toggles[wellName] = true;
    }
    
    this.setState({
      toggles: toggles
    });
  }

  uncheckAll() {
    const wellNames = getWellNames(this.state.plate.size);
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

  showPlot(wellName, key, wellResult) {

    const rawData = wellResult.raw[key];
    if(!rawData) {
      app.notify("Unable to find raw data for well " + wellName, 'error');
      return;
    }

    var title = "Plot for well " + wellName + " " + key;
    
    this.setState({
      plot: {
        title: title,
        data: rawData
      }
    });
  }

  showPlotForResult(wellResult, key) {

    const rawData = wellResult.raw[key];
    if(!rawData) {
      app.notify("Unable to find raw data for result", 'error');
      return;
    }

    var title = "Plot for " + key;
    
    this.setState({
      plot: {
        title: title,
        data: rawData
      }
    });
  }
  
  showPlotForLink(key, e) {
    if(!e || !e.target) return;
    const wellName = e.target.getAttribute('data-well');
    if(!wellName) {
      const wellResult = e.target.getAttribute('data-result');
      this.showPlotForResult(JSON.parse(wellResult), key);
      return;
    }

    const wellResult = this.state.result.wells[wellName];
    if(!wellResult) {
      app.notify("Unable to find data for well " + wellName, 'error');
      return;
    }
    
    this.showPlot(wellName, key, wellResult);
  }
  
  showPlotForKey(key) {
    return (e) => {
      this.showPlotForLink(key, e);
    };
  }
  
  renderPrevResults(prevResults) {
    var rows = [];
    var wellResult;
    for(wellResult of prevResults) {
      rows.push((
          <tr>
          <td>{utils.formatDateTime(wellResult.createdAt)}</td>
          <td>{wellResult.plateBarcode}</td>
          <td>
          <Link onClick={this.showPlotForKey('reporter').bind(this)} data-result={JSON.stringify(wellResult)} style="cursor:pointer">
              {wellResult.result['reporter']['Ct']}
            </Link>
          </td>
          <td>
          <Link onClick={this.showPlotForKey('intCtrl').bind(this)} data-result={JSON.stringify(wellResult)} style="cursor:pointer">
          {wellResult.result['intCtrl']['Ct']}
        </Link>
          </td>
          <td>{this.outcomeToText(wellResult.result.outcome)}</td>
          </tr>
      ));
    }
    
    return (
        <table cellspacing="3" border="1">
        <thead>
        <tr>
        <th>Analyzed at</th>
        <th>Plate</th>
        <th>Reporter Ct</th>
        <th>Int ctrl Ct</th>
        <th>Result</th>
        </tr>
        </thead>
        {rows}
        </table>
    );
  }

  closePlot() {
    this.setState({
      plot: null
    });
  }
  
  renderPlot(plotData) {
    var xvals = [];
    var yvals = plotData.data;
    var i;
    console.log(yvals);
    for(i=1; i <= yvals.length; i++) {
      xvals.push(i);
    }
    
    return (
        <div class="popup" onClick={this.closePlot.bind(this)}>
        <div class="vert-center">
        <div class="horiz-center">
        <div class="popup-box" onClick={(e) => {e.stopPropagation(); return false}}>
        <h3>{plotData.title}</h3>
        <Plot width="600" height="400" xvals={xvals} yvals={yvals} interpolateMode='lines' margin={{top: 10, right: 10, bottom: 30, left: 150}} />
        </div>
                </div>
        </div>
      </div>
    );
  }
  
  render() {

    var plot = '';
    if(this.state.plot) {
      plot = this.renderPlot(this.state.plot)
    }
    
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
          <p>Select .eds or .xlsx file to load</p>
          <input type="file" onChange={this.openFile.bind(this)} />
          </Container>
      );

    } else if(!this.state.result) {
      if(this.state.analyzing) {
        return (
            <Container>
            <p>Analyzing... (this can take ~20 seconds)</p>
            </Container>
        );
      }
      return (
          <Container>
          <p>Ready for analysis: {this.state.file.name}</p>
          <p>Allow discrepancies between plate map and qPCR results? <input type="checkbox" onInput={linkState(this, "allowDiscrepancies")} /></p>
          <p><button onClick={this.loadFileRenegade.bind(this)}>Analyze using renegade.bio protocol</button></p>
          <p><button onClick={this.loadFileBGI.bind(this)}>Analyze using BGI protocol</button></p>
          </Container>
      ); 
      
    } else if(!this.state.plate) {
        return (
            <Container>
            <p>Loading plate...</p>
        </Container>
        );
    } else if(this.state.plate) {

      let plateSize = this.state.plate.size || 96;
      var plateView = '';
      if(plateSize === 384) {
        plateView = (
            <Plate rows="16" cols="24" occupied={this.state.plate.wells} addClass="plate-large-384" />
        );
      } else {
        plateView = (
            <Plate rows="8" cols="12" occupied={this.state.plate.wells}  />
        );
      }
      
      plate = (
          <div>
          <h3>Plate layout from LIMS</h3>
          <ul>
          <li><b>Plate barcode:</b> {this.state.plate.barcode}</li>
          <li><b>Created at:</b> {utils.formatDateTime(this.state.plate.createdAt)}</li>
          <li><b>Created by:</b> {this.state.plate.createdBy || 'Unknown'}</li>
          </ul>
          {plateView}
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
        const wellNames = getWellNames(this.state.plate.size);

        for(let wellName of wellNames) {

          let plateMapWell = this.state.plate.wells[wellName];

          let well = this.state.result.wells[wellName];
          if(!well) {
            wellResults.push((
                <tr>
                <td><input type="checkbox" disabled /></td>
                <td>{wellName}</td>
                <td colspan="7">No result for this well</td>                
                </tr>
            ));
            continue;
          }
          
          if(plateMapWell || well) {
            let resultWell = well.result;
            let result = this.toHumanResult(plateMapWell, resultWell)
            let prevResults = '';
            if(result.fail) fail.push({well: wellName, msg: result.msg});

            if(resultWell.prevResults && resultWell.prevResults.length) {
              prevResults = this.renderPrevResults(resultWell.prevResults);
            }
            
            wellResults.push((
                <tr>
                <td><input type="checkbox" onClick={this.toggleResult.bind(this)} value={wellName} disabled={!result.reportable} checked={!!result.reportable && this.state.toggles[wellName]} /></td>
                <td>{wellName}</td>
                <td>{(plateMapWell) ? plateMapWell.barcode : "No plate mapping"}</td>
                <td><Link onClick={this.showPlotForKey('reporter').bind(this)} data-well={wellName} style="cursor:pointer">{(resultWell) ? resultWell['reporter']['Ct'] : "No result"}</Link></td>
                <td><Link onClick={this.showPlotForKey('intCtrl').bind(this)} data-well={wellName} style="cursor:pointer">{(resultWell) ? resultWell['intCtrl']['Ct'] : "No result"}</Link></td>
                <td>?</td>
                <td>{result.result}</td>
                <td>{result.msg || ''}</td>
                <td>{prevResults}</td>
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

        var saveButton = '';
        if(!this.state.saving) {
          saveButton = (
              <div>
              <p><button onClick={this.saveAndReport.bind(this)} disabled={!this.toReportCount() || fail.length}>Save and report results</button></p>
              </div>
          );
        } else {
          saveButton = (
            <div>Saving... This can take a while.</div>
          );
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
            <th>Reporter Ct</th>
            <th>Int ctrl Ct</th>
            <th>Re-run count</th>
            <th>Result</th>
            <th>Message</th>
            <th>Previous result(s)</th>
            </tr>
            </thead>
            <tbody>
            {wellResults}
          </tbody>
            </table>
            {saveButton}
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
      {plot}
      </Container>
    )
  }
}

// Generate array of well names
function getWellNames(plateSize) {
  plateSize = plateSize || 96;

  var numRows, numCols;
  if(plateSize === 384) {
    numRows = 16;
    numCols = 24;
  } else {
    numRows = 8;
    numCols = 12;
  }
  
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
  
