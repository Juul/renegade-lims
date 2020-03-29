'use strict';

import Router from 'preact-router';
import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

var Main = require('./main.js')
var Plate = require('./plate.js')
var EditPlate = require('./edit_plate.js')
var Scan = require('./scan.js')


class Root extends Component {

  render() {
    
    return (
        <Router>
        <Main path="/" />
        <EditPlate path="/plate" />
          <Plate path="/plate-test" />
          <Scan path="/scan" />
        </Router>
    );
  }
}


module.exports = view(Root);
  

