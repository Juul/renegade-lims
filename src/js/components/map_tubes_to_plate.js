'use strict';

import { h, Component } from 'preact';
import {route} from 'preact-router';
import { view } from 'z-preact-easy-state';

import Link from '@material-ui/core/Link';
import Container from '@material-ui/core/Container';

const uuid = require('uuid').v4;
const timestamp = require('monotonic-timestamp');
const FileSaver = require('file-saver');

const PlatePhysical = require('../physicals/plate.js');

const utils = require('../utils.js');
const Scan = require('./scan.js');
const Plate = require('./plate.js');

const POS_CTRL_ID = "11111111-1111-1111-1111-111111111111";
const NEG_CTRL_ID = "22222222-2222-2222-2222-222222222222";

class EditPlate extends Component {
  
  constructor(props) {
    super(props);
    
    this.setState({
      id: props.id,
      plate: undefined,
      selectedWell: undefined,
      error: undefined
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
  
  plateScanned(barcode) {
    route('/map-tubes-to-plate/'+encodeURIComponent(barcode));
  }

  tubeScanned(code) {

    app.actions.getPhysicalByBarcode(code, (err, tube) => {
      if(err) {
        console.log(err);
        if(!err.notFound) {
          app.notify(err, 'error');
          return;
        }
        app.notify("Tube with barcode '"+code+"' not registered in LIMS", 'error');
        return;
      }
      this.gotTube(tube);
    });
  }

  gotTube(tube) {
    tube.replicateGroup = this.replicateGroupForSample(tube.id);
    
    this.setState({
      selectedWell: null,
      tube: tube
    });
  }

  replicateGroupForSample(sampleID) {
    const plate = Object.assign({}, this.state.plate);
    plate.replicateGroups = plate.replicateGroups || 0;
    
    const wells = this.state.plate.wells;
    if(!wells) return;

    var well, sample;
    for(well in wells) {
      sample = wells[well];
      if(sample.id === sampleID) {
        if(sample.replicateGroup)  {
          this.replicateGroupIncremented = false;
          return sample.replicateGroup;
        }
        plate.replicateGroups++;
        this.replicateGroupIncremented = true;
        this.setState({
          plate: plate
        })
        sample.replicateGroup = plate.replicateGroups;
        return plate.replicateGroups;
      }
    }
    plate.replicateGroups++
    this.replicateGroupIncremented = true;
    this.setState({
      plate: plate
    })
    return plate.replicateGroups;
  }
  
  savePlate() {
    if(!this.state.selectedWell) {
      app.notify("Error: No well selected", 'error');
      return;
    }
    if(!this.state.tube) {
      app.notify("Error: No tube scanned", 'error');
      return;
    }
    
    const plate = this.state.plate;

    const tube = Object.assign({}, this.state.tube);
    plate.wells[this.state.selectedWell] = tube;
    app.actions.savePlate(plate, (err) => {
      if(err) {
        app.notify(err, 'error')
        return;
      }
      this.setState({
        tube: undefined,
        selectedWell: undefined,
        plate: plate
      })

      app.notify("Saved", 'success');
    });
  }

  addSpecial(type, id) {
    const sample = {
      id: id,
      special: type,
      createdAt: timestamp(),
      createdBy: app.state.user.name
    };

    this.gotTube(sample);
  }

  addPosCtrl() {
    this.addSpecial('positiveControl', POS_CTRL_ID);
  }
  
  addNegCtrl() {
    this.addSpecial('negativeControl', NEG_CTRL_ID);
  }

  deleteWell() {
    if(!confirm("Are you sure you want to delete the sample from this well?")) {
      return;
    }
    
    if(!this.state.selectedWell) {
      app.notify("Error: No well selected", 'error');
      return;
    }
    
    const plate = this.state.plate;
    delete plate.wells[this.state.selectedWell]
    
    app.actions.savePlate(plate, (err) => {
      if(err) {
        app.notify(err, 'error')
        return;
      }
      this.setState({
        tube: undefined,
        selectedWell: undefined,
        plate: plate
      })

      app.notify("Deleted", 'success');
    });
  }
  
  cancelTube() {
    // kinda hacky :/
    if(this.replicateGroupIncremented) {
      this.state.plate.replicateGroups--;
    }
    
    this.setState({
      tube: undefined,
      selectedWell: undefined,
      plate: this.state.plate
    })
  }

  onWellSelect(well) {
    this.setState({
      selectedWell: well
    });
    return;
    
  }
  
  showWellInfo(well) {
 //   console.log("Hovered well:", well);
  }

  newPlate(barcode) {

    const plate = {
      barcode: barcode,
      createdAt: timestamp(),
      createdBy: app.state.user.name,
      wells: {},
      isNew: true
    };
    
    this.setState({
      plate: plate
    });
  }
  
  gotPlate(plate) {
    this.setState({
      id: plate.id,
      plate: plate
    });
  }

  downloadEDS() {

    const wells = {};
    const plate = this.state.plate;
    const plateWells = plate.wells;
    var well, wellName;
    for(wellName in plateWells) {
      well = plateWells[wellName];
      if(!well) continue;

      if(well.barcode) {
        wells[wellName] = well.barcode;
      } else if(well.special) {
        console.log(well);
        if(well.special === 'positiveControl') {
          wells[wellName] = 'POS';  
        } else if(well.special === 'negativeControl') {
          wells[wellName] = 'NTC';
        } else {
          continue;
        }
      } else {
        continue;
      }
        
    }

    var createdBy = plate.createdBy;
    if(!createdBy || createdBy.toLowerCase() === 'unknown') {
      createdBy = 'admin';
    }

    const resultID = uuid();
    
    const o = {
      barcode: plate.barcode,
      name: resultID, // Save the result ID as the .eds experiment name
      description: "Generated on " + utils.formatDateTime(plate.createdAt),
      operator: createdBy,
      wells: wells
    };

    const dirpath = "C:\\somedir"; // TODO get from settings.js
    const filename = o.barcode+'_'+utils.formatDateTime(new Date()).replace(/\s+/g, '_')+'.eds';
    
    app.actions.generateEDSFile(dirpath, filename, o, (err, dataURL) => {
      if(err) {
        console.error(err);
        app.notify(err, 'error');
        return;
      }

      // Convert from base64 DataURL to blob
      fetch(dataURL).then(res => res.blob()).then((blob) => {
        
        FileSaver.saveAs(blob, filename);
        
      }).catch((err) => {
        console.error(err);
        app.notify(err, 'error');
        return;
      });
    });
  }
  
  componentDidMount() {
   this.componentDidUpdate();
  }

  componentDidUpdate(prevProps) {
    prevProps = prevProps || {}
    
    if(!this.props.barcode) return;
    if(prevProps.barcode === this.props.barcode) return;
    
    app.whenConnected(() => {
      
      app.actions.getPhysicalByBarcode(this.props.barcode, (err, plate) => {
        if(!plate) {
          this.newPlate(this.props.barcode);
          return
        }
        this.gotPlate(plate);
      })
    })    
  }
  
  render(props) {

    var error;
    if(this.state.error) {
      error = (
          <p>
          <b>Error:</b>
          <span>{this.state.error}</span>
          </p>
      )
    }

    var ctrlButtons = '';
    if(!this.state.tube) {
      ctrlButtons = (
        <div>
          <button onClick={this.addPosCtrl.bind(this)}>Positive control</button>
          <button onClick={this.addNegCtrl.bind(this)}>Negative control</button>
          </div>
      )
    }
    
    var sampleHtml;
    if(this.state.tube) {      
      sampleHtml = (
          <div>
          <p><b>Current tube:</b> {this.state.tube.barcode} created at {utils.formatDateTime(this.state.tube.createdAt)} by {this.state.tube.createdBy}.</p>
          
          </div>
      );
    } else {
      sampleHtml = (
          <div>
          To place a sample in a well, first scan a sample tube, or manually enter the barcode number with the keyboard and press enter.
          <p><button onClick={this.downloadEDS.bind(this)}>Download .eds file</button></p>
          </div>
      )
    }
    
    var main;
    if(!this.props.barcode) {
      main = (
        <Container>
          <p>Scan plate barcode to begin.</p>
          <Scan onScan={this.plateScanned.bind(this)} disableWebcam disableDataMatrixScanner />
          <p>If your plate does not have a barcode you can <Link href="/print-plate-label">print one here</Link>.</p>
        </Container>
      );
    } else if(!this.state.plate) {
      main = (
        <Container>
          <div>
            Loading plate {this.id}
          </div>
        </Container>
      )
    } else {
      main = (
        <Container>
          <h3>Plate: {this.state.plate.barcode}</h3>
          <p>
          Plate created at: {utils.formatDateTime(this.state.plate.createdAt)}
          <br/>
          Plate created by: {this.state.plate.createdBy || "Unknown"}
          </p>
          <Plate occupied={this.state.plate.wells} selectedReplicateGroup={(this.state.tube) ? this.state.tube.replicateGroup : ''} selectedWell={this.state.selectedWell} selectFree={!!this.state.tube} placingMode={!!this.state.tube} onSelect={this.onWellSelect.bind(this)} onSave={this.savePlate.bind(this)} onCancel={this.cancelTube.bind(this)} onDelete={this.deleteWell.bind(this)} onhover={this.showWellInfo.bind(this)} />

          {ctrlButtons}
          {sampleHtml}
          <Scan onScan={this.tubeScanned.bind(this)} disableWebcam hideText />
        </Container>
      )
    }
    
    return (
      <div>
        {error}

        {main}
      </div>
    );
    
  }
}

module.exports = view(EditPlate);
  
