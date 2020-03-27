'use strict';

import Router from 'preact-router';
import { h, Component } from 'preact';

var Main = require('./main.js')

class Root extends Component {

  render() {
    
    return (

        <Router>
          <Main path="/" />
        </Router>
    );
  }
}


module.exports = Root;
  

