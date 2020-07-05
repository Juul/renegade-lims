'use strict';

import { h, Component } from 'preact';
import {route} from 'preact-router';
import { view } from 'z-preact-easy-state';

import Link from '@material-ui/core/Link';
import Container from '@material-ui/core/Container';

const timestamp = require('monotonic-timestamp');
const utils = require('../utils.js');

class Accessioned extends Component {
  
  constructor(props) {
    super(props);

    this.setState({
      samples: []
    });
  }

  componentDidMount() {
    this.fetchSamples();
  }

  componentDidUpdaate(prevProps) {
    this.fetchSamples();
  }
  
  fetchSamples() {
    app.whenConnected(() => {
      app.actions.getSwabTubesByTimestamp(500, (err, tubes) => {
        console.log(err, tubes);
        if(err) {
          app.actions.notify(err, 'error');
          return;
        }
        this.setState({
          samples: tubes
        })
      })
    })
  }
  
  render() {

    const samples = [];
    for(let sample of this.state.samples) {
      samples.push((
          <li>{utils.formatDateTime(sample.createdAt)} - {sample.barcode || '(NONE)'} - {sample.formBarcode || '(NONE)'} - {(sample.rimbaudSynced) ? 'yes' : 'no'}</li>
      ));
    }
    
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
  
