'use strict';

import Router from 'preact-router';
import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

const TopMenu = require('./top_menu.js')
const Main = require('./main.js')
const Login = require('./login.js')
const Plate = require('./plate.js')
const CreatePlate = require('./create_plate.js')
const EditPlate = require('./edit_plate.js')
const Scan = require('./scan.js')
const PrintPlateLabel = require('./print_plate_label.js')
const PrintTest = require('./print_test.js')
const NotFound = require('./not_found.js')


class Root extends Component {

  render() {
    
    return (
      <div>
        <TopMenu />
        <Router>
        <Main path="/" />
        <Login path="/login" />
        <CreatePlate path="/plate-new" />
        <EditPlate path="/plate" />
        <EditPlate path="/plate/:id" />
        <Plate path="/plate-test" />
        <Scan path="/scan" />
        <PrintPlateLabel path="/print-plate-label" />
        <PrintTest path="/print-test" />
        <NotFound default />
        </Router>
      </div>
    );
  }
}


module.exports = view(Root);
  

