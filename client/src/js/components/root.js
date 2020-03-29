'use strict';

import Router from 'preact-router';
import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

const Main = require('./main.js')
const Plate = require('./plate.js')
const EditPlate = require('./edit_plate.js')
const Scan = require('./scan.js')
const PrintTest = require('./print_test.js')


class Root extends Component {

  render() {
    
    return (
        <Router>
        <Main path="/" />
        <EditPlate path="/plate/:id" />
          <Plate path="/plate-test" />
        <Scan path="/scan" />
        <PrintTest path="/print-test" />
        </Router>
    );
  }
}


module.exports = view(Root);
  

