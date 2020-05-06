'use strict';
import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';
import linkState from 'linkstate';

import Container from '@material-ui/core/Container';

var TubeLabelMaker = require('../tube_labelmaker.js');
var settings = require('../../../settings.web.js');

class PrintTubeLabel extends Component {
  
  constructor(props) {
    super(props);

    this.labelMaker = new TubeLabelMaker({
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
    
    app.actions.getBarcodes(this.state.numUniqueCodes, function(err, startCode, howMany, prefix) {

      if(err) return app.actions.notify(err, 'error');

      this.labelMaker.drawLabel('labelPreview', prefix + startCode);

      var imageData = this.labelMaker.getDataURL();
      app.actions.printLabel(imageData, this.state.totalCopies, function(err) {
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
  
  componentDidUpdate(prevProps) {
    prevProps = prevProps || {}
    if(this.props.customCode
       && prevProps.customCode !== this.props.customCode) {

      this.updateCustomCode(this.props.customCode);
    }
  }
  
  componentDidMount() {
    this.labelMaker.drawLabel('labelPreview', 1);

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
          <div style="width:187px;height:361px;">
            <canvas id="labelPreview" class="labelPreview" width="187" height="361"></canvas>
        </div>
        </Container>
    )
  }
}

module.exports = view(PrintTubeLabel);
