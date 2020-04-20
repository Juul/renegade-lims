'use strict';

import { h, Component } from 'preact';
import { Link } from 'preact-router/match';
import { view } from 'z-preact-easy-state';

import Container from '@material-ui/core/Container';

function downloadCSV(data, filename) {
  
      var csvURI = encodeURI("data:text/csv;charset=utf-8,"+data);
  
      const el = document.createElement('a');
      el.setAttribute('href', csvURI);
      el.setAttribute('download', filename);
      el.style.display = 'none';
      document.body.appendChild(el);
      el.click();
      document.body.removeChild(el);
}

class CSV extends Component {


  getSamples() {
    const stream = app.actions.csvGetSamples((err, data) => {
      if(err) {
        console.error(err);
        app.notify(err, 'error');
        return;
      }

      downloadCSV(data, 'samples.csv');
    });
  }

  getPlates() {
    const stream = app.actions.csvGetPlates((err, data) => {
      if(err) {
        console.error(err);
        app.notify(err, 'error');
        return;
      }

      downloadCSV(data, 'plate_maps.csv');
    });
  }
  
  getQpcrResults() {
    const stream = app.actions.csvGetQpcrResults((err, data) => {
      if(err) {
        console.error(err);
        app.notify(err, 'error');
        return;
      }

      downloadCSV(data, 'qpcr_results.csv');
    });
  }
  
  render() {
    
    return (
      <Container>
        <h3>Export to CSV</h3>
        <ul>
        <li><Link onClick={this.getSamples.bind(this)} href="#">Export accessioned samples to CSV</Link></li>
        <li><Link onClick={this.getPlates.bind(this)} href="#">Export plate maps to CSV</Link></li>
        <li><Link onClick={this.getQpcrResults.bind(this)} href="#">Export qPCR analysis results to CSV</Link></li>
        </ul>


      </Container>
    );
  }
}

module.exports = view(CSV);
