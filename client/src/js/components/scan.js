'use strict';

import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

var QrCode = require('qrcode-reader');
var getUserMedia = require('getusermedia');
var path = require('path');
var settings = require('../../../settings.web.js');

class Scan extends Component {
  
  constructor(props) {
    super(props);

    this.setState({
      code: '',
      scanAccess: false
    });

    this.enableDM = false;
  }

  componentWillUnmount() {
    this.setState({
      scanAccess: false
    });
    this.stopCameraStream();
    this.stopKeyboardCapture();
  }

  async componentDidMount() {

    app.whenConnected(() => {
      app.remote.claimDataMatrixScanner((err, code) => {
        if(err) return console.error("DataMatrix scan error:", err);
        if(this.isCryo(code)) {
          this.scanSuccess(code, 'cryotube');
        }
      })
    })

    
    this.modalCallback = this.props.cb;
    this.qr = new QrCode();
    this.scanCtx = document.getElementById('scanCanvas').getContext("2d");

    this.initKeyboardCapture();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      this.setState({
        scanAccess: true
      });
      
      this.cameraStream = stream;
      const scanVideo = document.getElementById('scanVideo');

      if(scanVideo) {
        scanVideo.style.visibility = 'visible';
        scanVideo.srcObject = stream;
        scanVideo.play().catch(function(err) {
          if(err) {
            console.error(err);
            this.setState({
              error: (
                  <span>
                    Unable to show camera video stream.
                  </span>
              ),
              scanAccess: false
            });
            return;
          }
        });

        setTimeout(this.scan.bind(this), 500);
      }
      
    } catch (err) {
      console.error(err);
      if (err.name === 'DevicesNotFoundError' || err.name === 'NotFoundError') {
        this.setState({
          error: "Looks like your device does not have a webcam.",
          scanAccess: false,
          cameraFailed: true
        });
      } else if (err.name === 'InternalError' || err.name === 'NotReadableError') {
        this.setState({
          error: "Could not access your camera. Is another application using it?",
          scanAccess: false,
          cameraFailed: true
        });
      } else {
        this.setState({
          error: "Unknown camera access error.",
          scanAccess: false,
          cameraFailed: true
        });
        console.error("Camera access error:", err);
      }
      return;
    }

  }

  // is this a cryoking tube? (10-digit numeric code)
  isCryo(code) {
    return !!(code.match(/^[\d]{10}$/));
  }
  
  // check if something is a v4 uuid
  isUUID(id) {
    return !!(id.match(/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/i))
  }

  decodeQrCode(self, cb) {
    var scanCanvas = document.getElementById('scanCanvas');
    if(!scanCanvas) return;

    var data = self.scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
    this.qr.callback = cb;
    this.qr.decode(data);
  }


  scanSuccess(code, type) {
    console.log("Successfully scanned", type, ':', code);

    if(this.props.onScan) {
      this.props.onScan(code, type);
      return;
    }

    if(type === 'uuid') {
      app.actions.gotoPhysical(code);
    } else {
      app.actions.gotoPhysicalByBarcode(code);
    }
  }

  scan(delay) {
    if(!this.state.scanAccess) return;
    delay = delay || 250; // delay between frames in ms
    
    var scanVideo = document.getElementById('scanVideo');
    try {
      this.scanCtx.drawImage(scanVideo, 0, 0);
    } catch(e) {
      
    }

    this.decodeQrCode(this, (err, data) => {
      if(err || !data || !data.result) {
        if(!this.enableDM) {
          setTimeout(this.scan.bind(this), delay);
        } else {
          console.error("DataMatrix scanning not currently supported");
        }
        return
      }
      const id = data.result.toLowerCase();
      if(!this.isUUID(id)) {
        return setTimeout(this.scan.bind(this), delay);
      }

      // TODO visual indication of scan success
      
      this.scanSuccess(id, 'uuid');
    });
  }

  keyboardScan(code) {

    var code = code.toLowerCase();
    console.log("code:", code);

    if(code.length <= 0){
      return;
    }

    if(this.isUUID(code)) {
      this.scanSuccess(code, 'uuid');
      return;
    }

    if(this.isCryo(code)) {
      this.scanSuccess(code, 'cryotube');
      return;      
    }

    return;   
  }

  // prevent text input field from loosing focus
  initKeyboardCapture() {

    this.keydownListener = this.keydown.bind(this)
    this.keypressListener = this.keypress.bind(this)
    document.addEventListener('keypress', this.keypressListener)
    document.addEventListener('keydown', this.keydownListener)
  }

  stopKeyboardCapture() {
    if(this.keypressListener) {
      document.removeEventListener('keypress', this.keypressListener);
    }
    if(this.keydownListener) {
      document.removeEventListener('keydown', this.keydownListener);
    }
  }

  keydown(e) {
    // enter pressed
    if(e.keyCode === 13) {
      e.preventDefault();
      if(!this.state.code) return;

      this.keyboardScan(this.state.code);

      this.setState({
        code: ''
      })
      return;
    }
  }

  keypress(e) {
    if(e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) {
      return;
    }

    // don't handle unprintable chars
    if(e.charCode < 32 || e.charCode > 126) {
      return;
    }

    e.preventDefault();
    var c = String.fromCharCode(e.charCode);

    if(!c) return;

    this.setState({
      code: (this.state.code || '') + c
    })
  }


  stopCameraStream() {
    if(this.cameraStream) {
      var tracks = this.cameraStream.getTracks();
      var i;
      for (i = 0; i < tracks.length; i++) {
        tracks[i].stop();
      }
      this.cameraStream = null
    }
  }
  
	render() {
    var scanVideo = '';
    if(!this.state.error) {
      scanVideo = (<video id="scanVideo" class="scanVideo" width="440" height="330"></video>);
    }
    
    var cameraAccessMsg = '';
    
    if(!this.state.scanAccess) {
      let statusMsg = '';
      if(!this.state.cameraFailed) {
        statusMsg = (
            <h5 style="color:green">Waiting for browser webcam access</h5>
        )
      } else {
        statusMsg = (
            <div id="scanError" class="error">{this.state.error}, but you can still:</div>
        );
      }
      cameraAccessMsg = (
          <div id="cameraAccessMsg">
            <div class="spinner">
              <div class="cssload-whirlpool"></div>
            </div>
            {statusMsg}
          </div>
      );
    } else {
      cameraAccessMsg = (
        <p>Scan QR codes by showing them to the webcam.</p>
      );
    }

    return (

        <div id="scan-wrapper" class="scan">
          <div class="row">
            <div class="col s1 m1 l1"></div>            
            <div class="col s6 m6 l6">
              {cameraAccessMsg}
              <p>Scan cryotubes using the tabletop or hand-held DataMatrix scanners.<br/>Scan 1D barcodes using hand-held 1D barcode scanner,<br/>or use the keyboard to manually enter any barcode, then hit enter.</p>
              <canvas id="scanCanvas" class="scanCanvas" width="560" height="560"></canvas>
              {scanVideo}

              <div id="debug"></div>
              <div class="canvas-layers"></div>
              <div class="canvas-box"></div>
            </div>
          </div>      
        </div>
    )
  }
}

module.exports = view(Scan);
