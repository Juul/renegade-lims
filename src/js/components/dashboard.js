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

class Dashboard extends Component {
  
  constructor(props) {
    super(props);

    this.setState({
      samples: []
    });
  }


  // Scanned the physical paper form with accession data 
  formScanned(barcode) {
    route('/tube-intake/'+encodeURIComponent(barcode))
  }

  tubeScanned(code) {
    app.actions.getPhysicalByBarcode(code, (err, o) => {
      if(err && !err.notFound) {
        app.notify(err, 'error');
        return;
      }

      this.setState({
        tubeBarcode: code,
        tube: o
      });
    });
  }

  componentDidUpdate(prevProps) {
    prevProps = prevProps || {}
    if(prevProps.scope !== this.props.scope) {
      // TODO don't change state based on props!
      // see map_tubes_to_plate.js
      
      // If the form changes then reset state
//      this.setState({
//      });
    }
  }

  getSyncedCount(samples) {
    var count = 0;
    for(let sample of samples) {
      if(sample.rimbaudSynced) count++;
    }
    return count;
  }

  getCount(samples, days, onlySynced) {
    var t = (new Date).getTime() - (24 * 60 * 60 * 1000) * days;
    var count = 0;
    for(let sample of samples) {
      if(sample.createdAt < t) break;
      if(!onlySynced || sample.rimbaudSynced) {
        count++;
      }
      count++;
    }
    return count;
  }
  
  componentDidMount() {
    app.whenConnected(() => {
      app.actions.getSwabTubesByTimestamp(0, (err, tubes) => {
        console.log(err, tubes);
        if(err) {
          app.actions.notify(err, 'error');
          return;
        }        
        
        this.setState({
          samples: tubes,
          accessionedSynced: this.getSyncedCount(tubes),
          accessionedDay: this.getCount(tubes, 1),
          accessionedDaySynced: this.getCount(tubes, 1, true),
          accessionedWeek: this.getCount(tubes, 7),
          accessionedWeekSynced: this.getCount(tubes, 7, true),
          accessionedMonth: this.getCount(tubes, 30),
          accessionedMonthSynced: this.getCount(tubes, 30, true)
        })
      })
    });
    this.componentDidUpdate();
  }
  
  render() {
    

      return (
        <Container>
          <h2>Dashboard</h2>
          <h3>Accessioned</h3>
          <ul>
          <li><Link href="/accessioned"><b>All time:</b></Link> {this.state.samples.length}</li>
          <li><b>All time synced to Rimbaud:</b> {this.state.accessionedSynced}</li>
          <li><b>Last 24 hours:</b> {this.state.accessionedDay}</li>
          <li><b>Last 24 hours synced to Rimbaud:</b> {this.state.accessionedDaySynced}</li>
          <li><b>Last 7 days:</b> {this.state.accessionedWeek}</li>
          <li><b>Last 7 days synced to Rimbaud:</b> {this.state.accessionedWeekSynced}</li>
          <li><b>Last 30 days:</b> {this.state.accessionedMonth}</li>
          <li><b>Last 30 days synced to Rimbaud:</b> {this.state.accessionedMonthSynced}</li>
        
        </ul>

          <h3>Plates created</h3>
          <ul>
          <li><b>All time:</b></li>
          </ul>

          <h3>Plates analyzed</h3>
          <ul>
          <li><b>All time:</b></li>
          </ul>

          <h3>Samples analyzed</h3>
          <ul>
          <li><b>All time:</b></li>
          </ul>
          
          <h3>Samples reported to Rimbaud</h3>
          <ul>
          <li><b>All time:</b></li>
          </ul>
        
        
        </Container>
      );
    
  }
}

module.exports = view(Dashboard);
  
