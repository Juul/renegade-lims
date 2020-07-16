'use strict';

import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

const QrScanner = require('qr-scanner');
QrScanner.WORKER_PATH = '/static/qr-scanner-worker.min.js';

class LabContainer extends Component {

  constructor(props) {
    super(props);

  }

  componentDidUpdate(prevProps) {
    console.log("update");
    /*
    prevProps = prevProps || {}

    
    this.setState(firstState);
    */
  }
  
  componentDidMount() {
    console.log("mount");
    //    this.componentDidUpdate();
    var videoElem = document.getElementById('vid');
    const qrScanner = new QrScanner(videoElem, function(result) {
      console.log('decoded qr code:', result)
    }, function(err) {
      console.log("Decode error:", err);
    });
    qrScanner.start();
  }

  
  render() {
    
    return (
      <div>
        LAB CONTAINER
        <video id="vid" width="800" height="800"></video>
      </div>
    );
  }
}


module.exports = view(LabContainer);
  
