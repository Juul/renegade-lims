'use strict';

import Router from 'preact-router';
import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

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


module.exports = view(Root);
  

