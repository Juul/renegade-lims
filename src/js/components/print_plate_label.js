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
      labelWidth: 336,
      labelHeight: 1083,
      barcodesPerLabel: 15,
      barcodeToBarcodeSpacing: 65,
      yOffset: 100,
      
      // bwip options:
      scale:       3,
      height:      3,
      includetext: true,
      textsize: 8,
      textxalign:  'center',
      textyoffset: 1,
    });

    this.setState({
      copies: 1, // copies of each barcode per label,
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

    this.labelMaker.drawLabel('labelPreview', this.state.customCode);

    var imageData = this.labelMaker.getDataURL();
    app.actions.printLabel('qlPrinter', imageData, this.state.totalCopies, function(err) {
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
    
    app.actions.getBarcodes(this.state.numUniqueCodes, function(err, startCode, howMany, prefix) {

      if(err) return app.actions.notify(err, 'error');

      this.labelMaker.drawLabel('labelPreview', startCode, {
        numberOfEach: howMany,
        barcodePrefix: prefix
      });

      var imageData = this.labelMaker.getDataURL();
      app.actions.printLabel('qlPrinter', imageData, this.state.totalCopies, function(err) {
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

    this.labelMaker.drawLabel('labelPreview', customCode);
    
    this.setState({
      customCode: customCode || ''
    })
  }
  
  updateLabelCopies(e) {
    var copies = e.target.value;

    if(copies !== '') {
      copies = parseInt(copies);
      if(copies > 15) copies = 15;
      if(copies < 1) copies = 1;
      this.setState({
        copies: copies
      })
    }
    if(copies) {
      var numUniqueCodes = this.labelMaker.drawLabel('labelPreview', 1, {
        numberOfEach: copies
      });
      
      this.setState({
        numUniqueCodes: numUniqueCodes
      })
    }
  }

  componentDidUpdate(prevProps) {
    prevProps = prevProps || {}
    if(this.props.customCode
       && prevProps.customCode !== this.props.customCode) {

      this.updateCustomCode(this.props.customCode);
    }
  }
  
  componentDidMount() {
    var numUniqueCodes = this.labelMaker.drawLabel('labelPreview', 1, this.state.copies);
    
    this.setState({
      numUniqueCodes: numUniqueCodes
    });
    this.componentDidUpdate();
  }


  
	render() {

    var warning = '';
    if(this.state.customCode) {
      warning = (
          <p><b>Warning:</b> Only use the custom barcode feature when re-printing destroyed or lost barcode stickers or risk having two different items labeled with the same code.</p>
      );
    }

    var numIdentical = '';
    numIdentical = (
        <p>Number of identical barcodes per label (1 to 15): <input type="text" value={this.state.copies} onInput={this.updateLabelCopies.bind(this)} disabled={!!this.state.customCode} /></p>
    );
    
    return (
        <Container>
        <h3>Print plate labels</h3>
        {numIdentical}
        <p>Custom barcode: <input type="text" value={this.state.customCode} onInput={this.updateCustomCode.bind(this)} /></p>
        <p>Copies to print: <input type="text" value={this.state.totalCopies} onInput={linkState(this, 'totalCopies')} /></p>
        {warning}
        <p><input type="button" onClick={this.print.bind(this)} value="Print" /></p>

        <h4>Print preview</h4>
          <div style="width:174px;height:560px;">
            <canvas id="labelPreview" class="labelPreview" width="174" height="560"></canvas>
        </div>
        </Container>
    )
  }
}

module.exports = view(PrintPlateLabel);
