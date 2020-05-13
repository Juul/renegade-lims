'use strict';
import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';
import linkState from 'linkstate';

import Container from '@material-ui/core/Container';

var LabelMaker = require('../labelmaker.js');
var settings = require('../../../settings.web.js');

class PrintPlateLabel extends Component {
  
  constructor(props) {
    super(props);

    this.labelMaker = new LabelMaker({
      labelWidth: 1020,
      labelHeight: 440,
      yOffset: 57,
      barcodesPerLabel: 3,
      barcodeToBarcodeSpacing: 127,
      allowOverPrint: true,
      
      // bwip options:
      scale:       6.0,
      height:      7.5,
      includetext: true,
      textsize: 10,
      textxalign:  'offright',
      textxoffset: 10,
      textyalign:  'center',
      textyoffset: -1
    });
    

    this.setState({
      totalCopies: 1 // how many of these labels to print
    });
  }
  
  close(e) {
    if (this.props.onClose) this.props.onClose(false)
    // TODO fixme
    //        app.actions.prompt.reset()
  }

  printCustom() {
    var customCode = this.state.code;

    this.labelMaker.drawLabel('labelPreview', this.state.customCode, {
      numberOfEach: 3
    });

    var imageData = this.labelMaker.getDataURL();
    app.actions.printLabel('dymoPrinter', imageData, this.state.totalCopies, function(err) {
      if(err) return app.notify(err, 'error');

      app.notify("Printing", 'success');
    })
  }
  
  print(e) {
    e.preventDefault()

    if(this.state.customCode) {
      this.printCustom();
      return;
    }
    
    const copies = this.state.copies;
    
    app.actions.getBarcodes(1, function(err, startCode, howMany, prefix) {
      if(err) return app.actions.notify(err, 'error');

      this.labelMaker.drawLabel('labelPreview', prefix + startCode, {
        numberOfEach: 3
      });

      const copies = this.state.totalCopies || 1;
      
      var imageData = this.labelMaker.getDataURL();
      app.actions.printLabel('dymoPrinter', imageData, copies, function(err) {
        if(err) return app.notify(err, 'error');

        app.notify("Printing", 'success');
      })
      
    }.bind(this));  
  }

  updateCustomCode(eventOrCode) {
    var customCode;
    if(typeof eventOrCode === 'object' && eventOrCode.target) {
      customCode = eventOrCode.target.value;
    } else {
      customCode = eventOrCode;
    }

    this.labelMaker.drawLabel('labelPreview', customCode, {
      numberOfEach: 3
    });
    
    this.setState({
      customCode: customCode || ''
    })
  }
  
  componentDidUpdate(prevProps) {
    prevProps = prevProps || {}
    if(this.props.customCode
       && prevProps.customCode !== this.props.customCode) {

      this.updateCustomCode(this.props.customCode);
    }
  }
  
  componentDidMount() {
    this.labelMaker.drawLabel('labelPreview', 1, {
      numberOfEach: 3
    });

    this.componentDidUpdate();
  }


  
	render() {
    return (
        <Container>
        <h3>Print tube label</h3>
        <p>Custom barcode: <input type="text" value={this.state.customCode} onInput={this.updateCustomCode.bind(this)} /></p>
        <p>Copies to print: <input type="text" value={this.state.totalCopies} onInput={linkState(this, 'totalCopies')} /></p>
        <p><input type="button" onClick={this.print.bind(this)} value="Print" /></p>

        <h4>Print preview</h4>
          <div style="width:510px;height:220px;">
            <canvas id="labelPreview" class="labelPreview" width="510" height="220"></canvas>
        </div>
        </Container>
    )
  }
}

module.exports = view(PrintPlateLabel);
