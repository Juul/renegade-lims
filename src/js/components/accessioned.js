'use strict';

import { h, Component } from 'preact';
import {route} from 'preact-router';
import { view } from 'z-preact-easy-state';
import linkState from 'linkstate';

import Link from '@material-ui/core/Link';
import Container from '@material-ui/core/Container';

const timestamp = require('monotonic-timestamp');
const utils = require('../utils.js');

class Accessioned extends Component {
  
  constructor(props) {
    super(props);

    this.setState({
      samples: [],
      autoUpdate: false
    });
  }

  componentDidMount() {
    app.whenConnected(() => {
      this.fetchSamples();
    });
  }

  componentDidUpdaate(prevProps) {
    this.fetchSamples();
  }
  
  fetchSamples(cb) {
    app.actions.getSwabTubesByTimestamp(500, (err, tubes) => {
      console.log(err, tubes);
      if(err) {
        app.actions.notify(err, 'error');
        if(cb) return cb(err);
      }
      this.setState({
        samples: tubes
      })
      if(cb) cb();
    })
    
  }

  autoUpdateClick(e) {
    if(!this.state.autoUpdate && e.target.checked) {
      this.autoUpdate(true);
    }
    this.setState({
      autoUpdate: e.target.checked
    });
  }

  autoUpdate(force) {
    if(!force && !this.state.autoUpdate) return;

    this.fetchSamples((err) => {
      if(err) return;

      setTimeout(() => {
        this.autoUpdate();
      }, 3000);
    });
  }
  
  render() {

    const samples = [];
    for(let sample of this.state.samples) {
      samples.push((
          <li>{utils.formatDateTime(sample.createdAt)} - {sample.barcode || '(NONE)'} - {sample.formBarcode || '(NONE)'} - {(sample.rimbaudSynced) ? 'yes' : 'no'}</li>
      ));
    }

//            <p>
///        Auto-update? <input type="checkbox" onInput={this.autoUpdateClick.bind(this)} />
//        </p>
    
    return (
      <Container>
        <h3>Accessioned samples</h3>

        <p>Accession time - Tube barcode - Order barcode - Synced to Rimbaud?</p>
        <p>
        <ul>
        {samples}
        </ul>
        </p>
      </Container>
    );
  }
}

module.exports = view(Accessioned);
  
