'use strict';

import Router from 'preact-router';
import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

var Main = require('./main.js')
var Plate = require('./plate.js')
var Scan = require('./scan.js')

class Root extends Component {

  render() {
    
    return (
        <Router>
          <Main path="/" />
          <Plate path="/plate" />
          <Scan path="/scan" />
        </Router>
    );
  }
}


module.exports = view(Root);
  

