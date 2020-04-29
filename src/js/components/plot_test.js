'use strict';

import { h, Component } from 'preact';
import { Link } from 'preact-router/match';
import { route } from 'preact-router';
import { view } from 'z-preact-easy-state';

import Container from '@material-ui/core/Container';

const Plot = require('./plot.js');


class PlotTest extends Component {

  constructor() {
    super();
    
    this.state = {
      interpolateMode: 'akima'
    }
  }

  up() {
    if(this.state.interpolateMode === 'akima') {
      this.setState({
        interpolateMode: 'lines'
      });
    } else {
      this.setState({
        interpolateMode: 'akima'
      });
    }
  }
  
  render(props, state) {

    var xvals = [
      10.421,
      20,
      30,
      40,
      50,
      60,
      70,
      80
    ];

    var yvals = [
      40,
      10.432,
      17,
      39,
      66,
      55,
      30,
      11      
    ];
    console.log("interpolateMode", this.state.interpolateMode);
    
    return ((
        <Container>
        <h3>Plot test</h3>
        <Plot width="400" height="300" xvals={xvals} yvals={yvals} interpolateMode={this.state.interpolateMode} />
        <button onclick={this.up.bind(this)}>up</button>
      </Container>
    ))
  }
}

module.exports = view(PlotTest);
  

