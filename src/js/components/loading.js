'use strict';

import { h, Component } from 'preact';
import React from 'react';

class Loading extends Component {

  constructor(props) {
    super();
  }
  
  render() {
   return (
       <div class="loading">Loading...</div>
    );
  }
}

module.exports = Loading;
  



