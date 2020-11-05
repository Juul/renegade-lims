
'use strict';

import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';
const FileSaver = require('file-saver');

import Container from '@material-ui/core/Container';
const Scan = require('./scan.js');
const LabContainer = require('./lab_container.js');

const FILE_SIZE_MAX = 1 * 1024 * 1024; // 1 MB

class RemapQPCRResults extends Component {

  constructor(props) {
    super(props);

  }

  componentDidUpdate(prevProps) {
    console.log("update");
    /*
    prevProps = prevProps || {}

    
    this.setState(firstState);
    */
  }
  
  componentDidMount() {
    console.log("mount");
//    this.componentDidUpdate();
  }
  
  openResultsFile(e) {
    const files = e.target.files;
    if(!files.length) return;

    const file = files[0];
    if(file.size && file.size > FILE_SIZE_MAX) {
      app.notify("File exceeded maximum allowed size of "+FILE_SIZE_MAX+" bytes", 'error');
      return;
    }

    if(!file.name.match(/\.txt$/i)) {
      app.notify("Only .txt files allowed", 'error');
      return;
    }

    var reader = new FileReader();
    
    reader.onload = (e) => {

      const fileData = e.target.result;
      console.log("Data length", fileData.length);
      const decoder = new TextDecoder("utf-8");
      const strData = decoder.decode(fileData);
      
      this.setState({
        resultsFilename: file.name,
        results: strData
      });
      
//      const lines = strData.split(/\r?\n/);
//      console.log("Line:", lines[3]);

    };

    reader.readAsArrayBuffer(file)
  }
  
  openMappingFile(e) {
    const files = e.target.files;
    if(!files.length) return;

    const file = files[0];
    if(file.size && file.size > FILE_SIZE_MAX) {
      app.notify("File exceeded maximum allowed size of "+FILE_SIZE_MAX+" bytes", 'error');
      return;
    }

    if(!file.name.match(/\.txt$/i) && !file.name.match(/\.csv$/i)) {
      app.notify("Only .csv and .txt files allowed", 'error');
      return;
    }

    var reader = new FileReader();
    
    reader.onload = (e) => {

      const fileData = e.target.result;
      console.log("Data length", fileData.length);
      const decoder = new TextDecoder("utf-8");
      const strData = decoder.decode(fileData);
      
      this.setState({
        mappingFilename: file.name,
        mapping: strData
      });
    };

    reader.readAsArrayBuffer(file)
  }

  arrayToHash(header, fields) {
    var o = {}
    for(let i=0;i < fields.length; i++) {
      o[header[i]] = fields[i];
    }
    return o;
  }

  hashToArray(header, o) {
    var a = [];
    for(let key of header) {
      a.push(o[key]);
    }
    return a;
  }
  
  remap(plateBarcode, results, mapping) {
    const resultLines = results.split(/\r?\n/);
    const mappingLines = mapping.split(/\r?\n/);

    var fields, o;
    var mapping = {};
    var pastHeader = false;
    for(let line of mappingLines) {
      if(!pastHeader) {
        if(line.match(/^Well/)) {
          pastHeader = true;
        }
        continue;
      }
      fields = line.split(/\t/);
      if(fields[1] === 'Empty' || fields[1] === 'null' || fields[2] === 'Empty' || fields[2] === 'null') {
        continue;
      }

      // the key is the well name, e.g. A1
      mapping[fields[0]] = {
        orderID: fields[1],
        tubeBarcode: fields[2]
      };
    }

//    console.log("Mapping:", mapping);    

    var warnings = [];
    
    var header, curMapping;
    var newLines = [];
    pastHeader = false;
    for(let line of resultLines) {
      if(!pastHeader) {
        if(line.match(/^\*\s+Experiment\s+Barcode\s+=/i)) {
          newLines.push("* Experiment Barcode = " + plateBarcode);
        } else {
          newLines.push(line);
        }
        if(line.match(/^Well/)) {
          pastHeader = true;
          header = line.split(/\t/);
        }
        continue;
      }
      fields = line.split(/\t/);
      o = this.arrayToHash(header, fields);

//      console.log("Processing:", o['Well Position'])
      
      if(!o['Sample Name'] || o['Sample Name'] === 'POS' || o['Sample Name'] === 'NTC') {
        newLines.push(line);
        continue;
      }
      
      curMapping = mapping[o['Well Position']];
      if(!curMapping) {
        console.log("WARN");
        let warn = "No mapping for well: " + o['Well Position'];
        if(warnings.indexOf(warn) < 0) {
          warnings.push(warn);
        }
        continue;
      }

      if(curMapping.tubeBarcode.toUpperCase() !== o['Sample Name'].toUpperCase()) {
        app.notify("Error for well: " + o['Well Position'], 'error');
        return;
      }

      o['Sample Name'] = curMapping.orderID;
      
      newLines.push(this.hashToArray(header, o).join("\t"));
    }
    
//    console.log(newLines.join("\n"));

    this.setState({
      warnings: warnings
    });
    
    return newLines.join("\n");
  }
  
  downloadRemapped() {

    var strData = this.remap(this.state.plateBarcode, this.state.results, this.state.mapping);

    const m = this.state.resultsFilename.match(/(.*)\..+$/);
    if(!m) {
      app.notify("Unexpected filename: " + this.state.resultsFilename, 'error');
      return;
    }
    const newFilename = m[1] + '_' + 'for_ligolabs.txt';
    
    const buf = Buffer.from(strData, {encoding: 'utf8'});
    const dataURL = 'data:text/plain;base64,'+buf.toString('base64');
    
    // Convert from base64 DataURL to blob
    fetch(dataURL).then(res => res.blob()).then((blob) => {
      
      FileSaver.saveAs(blob, newFilename);
      
    }).catch((err) => {
      console.error(err);
      app.notify(err, 'error');
      return;
    });

  }

  plateScanned(barcode) {
    this.setState({
      plateBarcode: barcode
    })
  }
  
  render() {

    var msg = '';

    if(!this.state.plateBarcode) {
      return (
        <Container>
        <p>Scan <b><u>LigoLab</u></b> plate barcode to begin.</p>
        <Scan onScan={this.plateScanned.bind(this)} disableWebcam disableDataMatrixScanner />
          </Container>
      );
    }
    
    if(!this.state.results || !this.state.mapping) {
      return (
          <Container>
          <p>Upload qPCR results .txt file</p>
          <input type="file" onChange={this.openResultsFile.bind(this)} />
          <br/>-----------------------------------<br/>
          <p>Upload Ligolab mapping file</p>
          <input type="file" onChange={this.openMappingFile.bind(this)} />
          </Container>
      );
      
    } else {

      var warnings = [];
      if(this.state.warnings && this.state.warnings.length) {
        warnings.push((
            <h3>Warnings</h3>
        ));
        for(let warn of this.state.warnings) {
          warnings.push((
            <p>{warn}</p>
          ))
        }
      }

      return (
          <Container>
          <p>Download remapped results file</p>
          <input type="button" onClick={this.downloadRemapped.bind(this)} value="Download" />
          {warnings}
          </Container>
      );
      
    }
  }
}


module.exports = view(RemapQPCRResults);
  
