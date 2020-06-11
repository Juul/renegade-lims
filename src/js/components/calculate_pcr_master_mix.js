'use strict';
import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';
import linkState from 'linkstate';

import Container from '@material-ui/core/Container';

var settings = require('../../../settings.web.js');

// all volumes in uL
const volume_per_reaction = {
  taqpath_master_mix: 5,
  n1_primer_forward: 1,
  n1_primer_reverse: 1,
  n1_fam_probe: 1,
  rnase_p_primer_forward: 1,
  rnase_p_primer_reverse: 1,
  rnase_p_cy5_probe: 1,
  rnase_free_water: 4
};

// add 15% to all volumes
const volumeMultiplier = 1.15;

function totalVolumePerReaction() {
  var total = 0;
  for(let key in volume_per_reaction) {
    total += volume_per_reaction[key];
  }
  return total;
}

// all concentrations in uM
const concentration = {
  taqpath_master_mix: 10,
  n1_primer_forward: 10,
  n1_primer_reverse: 10,
  n1_fam_probe: 6.25,
  rnase_p_primer_forward: 6.25,
  rnase_p_primer_reverse: 10,
  rnase_p_cy5_probe: 10
};

function niceFormat(number) {
  number = Math.round(number * 100) / 100;
  var input = parseInt(number).toString();
  
  var output = '';
  console.log("input now:", input)
  while(input.length > 3) {
    if(output) output = ',' + output ;
    output = input.slice(-3) + output;
    input = input.slice(0, -3);
    console.log("input now:", input)
  }
  if(output) output = ',' + output ;
  output = input + output;
  var m = number.toString().match(/\.\d+$/);
  if(m) {
    output += m[0];
  }
  return output;
}

class CalculatePCRMasterMix extends Component {
  
  constructor(props) {
    super(props);

    this.setState({
      numSamples: 10
    });
  }

  error(str) {
    this.setState({
      error: str
    });
  }

  recalc(e) {
    const numSamples = parseInt(e.target.value);
    if(!numSamples || numSamples < 1 || isNaN(numSamples)) {
      this.error("Invalid number of samples");
      if(e.target.value.trim() === '') {
        this.setState({
          numSamples: ''
        });
      }
      return
    }


    
    
    this.setState({
      numSamples,
      error: null
    });
  }

  makeRow(label, key) {

    return (
      <tr>
        <td>{label}</td><td>{concentration[key]}</td><td>{volume_per_reaction[key] * volumeMultiplier}</td><td>{niceFormat(volume_per_reaction[key] * this.state.numSamples * volumeMultiplier)}</td>
        </tr>
    );
  }
  
	render() {
    const volPerReact = totalVolumePerReaction();
    
    var error = '';
    if(this.state.error) {
      error = (
          <p style="color:red">Error: {this.state.error}</p>
      );
    }

    var table = '';
    if(!error) {
      table = (
          <table border="1" cellpadding="4" cellspacing="4">
        <thead>
        <tr>
        <th>Reagent</th>
        <th>Reagent concentration</th>
        <th>Volume (μL) per reaction</th>
        <th>Total volume (μL) in master mix</th>
        </tr>
        </thead>

        {this.makeRow("TaqPath Master Mix", 'taqpath_master_mix')}
        {this.makeRow("N1 Primer Forward", 'n1_primer_forward')}
        {this.makeRow("N1 Primer Reverse", 'n1_primer_reverse')}
        {this.makeRow("N1 – FAM Probe", 'n1_fam_probe')}
        {this.makeRow("RNase P Primer Forward", 'rnase_p_primer_forward')}
        {this.makeRow("RNase P Primer Reverse", 'rnase_p_primer_reverse')}
        {this.makeRow("RNase P -Cy5 Probe", 'rnase_p_cy5_probe')}
        {this.makeRow("RNase-Free Water", 'rnase_free_water')}
      <tr>
          <td><b>Total volume</b></td><td></td><td><b>{volPerReact * volumeMultiplier}</b></td><td><b>{niceFormat(volPerReact * this.state.numSamples * volumeMultiplier)}</b></td>
        </tr>        
        
      </table>
      )
    }
    
    return (
        <Container>
        <h3>Calculate PCR Master mix</h3>
        <p>Number of samples: <input type="text" value={this.state.numSamples} onInput={this.recalc.bind(this)} /></p>
        <div>
        {error}
      {table}
      </div>
        </Container>
    )
  }
}

module.exports = view(CalculatePCRMasterMix);
