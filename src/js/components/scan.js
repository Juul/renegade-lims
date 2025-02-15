'use strict';

import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

import Container from '@material-ui/core/Container';

var QrCode = require('qrcode-reader');
var getUserMedia = require('getusermedia');
var path = require('path');
var settings = require('../../../settings.web.js');

class Scan extends Component {
  
  constructor(props) {
    super(props);

    this.setState({
      code: '',
      disableWebcam: props.disableWebcam,
      disableDataMatrixScanner: props.disableDataMatrixScanner,
      disableKeyboard: props.disableKeyboard,
      hideText: props.hideText,
      cameraAccess: false
    });

    this.enableDM = false;
  }

  componentWillUnmount() {
    this.setState({
      cameraAccess: false
    });
    this.stopCameraStream();
    this.stopKeyboardCapture();
  }

  async componentDidMount() {

    if(!this.state.disableDataMatrixScanner) {
      app.whenConnected(() => {
        app.remote.claimDataMatrixScanner((err, code) => {
          if(err) return console.error("DataMatrix scan error:", err);
          if(this.isCryo(code)) {
            this.scanSuccess(code, 'cryotube');
          }
        })
      })
    }
    
    this.modalCallback = this.props.cb;

    if(!this.state.disableKeyboard) {
      this.initKeyboardCapture();
    }

    if(this.state.disableWebcam) return;
    
    this.qr = new QrCode();
    this.scanCtx = document.getElementById('scanCanvas').getContext("2d");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      this.setState({
        cameraAccess: true
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
              cameraAccess: false
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
          error: "Looks like your device does not have a webcam",
          cameraAccess: false,
          cameraFailed: true
        });
      } else if (err.name === 'InternalError' || err.name === 'NotReadableError') {
        this.setState({
          error: "Could not access your camera. Is another application using it?",
          cameraAccess: false,
          cameraFailed: true
        });
      } else {
        this.setState({
          error: "Unknown camera access error.",
          cameraAccess: false,
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
    if(!this.state.cameraAccess) return;
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
      var id = data.result;
      if(!this.props.doNotLower) {
        id = id.toLowerCase();
      }
      if(!this.isUUID(id)) {
        return setTimeout(this.scan.bind(this), delay);
      }

      // TODO visual indication of scan success
      
      this.scanSuccess(id, 'uuid');
    });
  }

  keyboardScan(code) {
    if(!this.props.doNotLower) {
      code = code.toLowerCase();
    }

    if(code.length <= 0){
      return;
    }

    this.scanSuccess(code, 'unknown');
    
    /* // todo re-enable checking
    if(this.isUUID(code)) {
      this.scanSuccess(code, 'uuid');
      return;
    }

    if(this.isCryo(code)) {
      this.scanSuccess(code, 'cryotube');
      return;      
    }
    */

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
      
    } else if(e.keyCode === 8) { // backspace
      this.setState({
        code: this.state.code.slice(0, -1)
      })
    } else if(e.keyCode === 27) { // escape
      this.setState({
        code: ''
      })
    }
  }

  keypress(e) {
    if(e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }

    // don't handle unprintable chars
    if(e.charCode < 32 || e.charCode > 126) {
      return;
    }
    
    e.preventDefault();
    var c = String.fromCharCode(e.charCode);
    if(!c.match(/[\d\w-]+/)) {
      return;
    }
    
    if(e.shiftKey) {
      c = c.toUpperCase();
    }

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
    var helpMessage = [];
    var scanCanvas = '';
    var scanVideo = '';
    var cameraAccessMsg = '';

    if(!this.state.disableDataMatrixScanner) {
      helpMessage.push("Scan cryotubes usig the tabletop or hand-held DataMatrix scanners.");
    }
    if(!this.state.disableKeyboard) {
      helpMessage.push("Scan 1D barcodes using hand-held 1D barcode scanner");
      helpMessage.push("or use the keyboard to manually enter any barcode number, then hit enter");
    }

    if(!helpMessage.length || this.state.hideText) {
      helpMessage = '';
    } else {
      helpMessage = (
          <p>
          {helpMessage.join(" ")+'.'}
        </p>
      );
    } 
    
    if(!this.state.disableWebcam) {
      scanCanvas = (
          <canvas id="scanCanvas" class="scanCanvas" width="560" height="560"></canvas>
      );
      
      if(!this.state.error) {
        scanVideo = (<video id="scanVideo" class="scanVideo" width="440" height="330"></video>);
      }
      
      if(!this.state.cameraAccess) {
        let statusMsg = '';
        if(!this.state.cameraFailed) {
          statusMsg = (
              <h5 style="color:green">Waiting for browser webcam access</h5>
          )
        } else {
          statusMsg = (
              <div id="scanError" class="error">{this.state.error}{(helpMessage) ? ", but you can still:" : '.'}</div>
          );
        }
        cameraAccessMsg = (
          <div id="cameraAccessMsg">
            {statusMsg}
          </div>
        );
      } else {
        cameraAccessMsg = (
            <p>
              Scan QR code labels using webcam.
            </p>
        );
      }
    }

    var keyboardCode = '';
    if(this.state.code) {
      keyboardCode = (
          <div><span><b>Manually entered code: </b></span><span>{this.state.code}</span></div>
      )
    }
    
    return (
      <Container>
        <div id="scan-wrapper" class="scan">
          <div class="row">
            <div class="col s1 m1 l1"></div>            
            <div class="col s6 m6 l6">
              {cameraAccessMsg}
              {helpMessage}
              {scanCanvas}
              {scanVideo}
              {keyboardCode}
              <div id="debug"></div>
              <div class="canvas-layers"></div>
              <div class="canvas-box"></div>
            </div>
          </div>      
        </div>
      </Container>
    )
  }
}

module.exports = view(Scan);
