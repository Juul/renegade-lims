'use strict';

import Router from 'preact-router';
import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

var Main = require('./main.js')
var Plate = require('./plate.js')

class Root extends Component {

  render() {
    
    return (
        <Router>
          <Main path="/" />
          <Plate path="/plate" />
        </Router>
    );
  }
}


module.exports = view(Root);
  

