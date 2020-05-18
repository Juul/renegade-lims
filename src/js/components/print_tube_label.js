'use strict';

const async = require('async');
import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';
import linkState from 'linkstate';

import Container from '@material-ui/core/Container';

var LabelMaker = require('../labelmaker.js');
var settings = require('../../../settings.web.js');

class PrintTubeLabel extends Component {
  
  constructor(props) {
    super(props);

    this.labelMaker = new LabelMaker({
      labelWidth: 560,
      labelHeight: 1083,
      yOffset: 450,
      
      // bwip options:
      scale:       5.8,
      height:      10,
      includetext: true,
      textsize: 15,
      textxalign:  'center',
      textyoffset: 5,
    });
    

    this.setState({
      copies: 1, // copies of each (identical) barcode to print
      number: 1 // how many consecutively numbered barcodes to print
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

    const copies = this.state.copies || 1;
    
    var imageData = this.labelMaker.getDataURL();
    app.actions.printLabel('dymoPrinter', imageData, copies, function(err) {
      if(err) return app.notify(err, 'error');

      app.notify("Printing", 'success');
    })
  }

  doPrint(copies, cb) {
    console.log("doPrint:", copies);
    app.actions.getBarcodes(1, function(err, startCode, howMany, prefix) {
      if(err) return cb(err);
      console.log("Got code:", startCode, howMany);

      this.labelMaker.drawLabel('labelPreview', prefix + startCode);
      
      var imageData = this.labelMaker.getDataURL();
      app.actions.printLabel('dymoPrinter', imageData, copies, (err) => {
        if(err) return cb(err);

        console.log("printed");
        cb();
      })
      
    }.bind(this));  
  }
  
  print(e) {
    e.preventDefault()

    if(this.state.customCode) {
      this.printCustom();
      return;
    }

    const number = parseInt(this.state.number || 1);
    const copies = parseInt(this.state.copies || 1);

    console.log("DO PRINT", this.state);
    if(number > 1) {
      this.printMany(number, copies);
      return;
    }
    
    this.doPrint(copies, function(err) {
      if(err) return app.notify(err, 'error');

      app.notify("Printing", 'success');
    });
  }

  printMany(number, copies) {    
    
    copies = parseInt(copies);
    if(!(copies >= 1 && copies <= 10)) {
      app.notify("Number of copies must be between 1 and 10", 'error');
      return;
    }
    number = parseInt(number);
    if(!(number >= 1 && number <= 50)) {
      app.notify("Number of labels must be between 1 and 50", 'error');
      return;
    }
    const total = copies * number;
    if(total > 50) {
      app.notify("", 'error');
      return;
    }
    
    async.timesSeries(number, (n, next) => {
      this.doPrint(copies, next);
    }, function(err) {
      if(err) {
        app.notify(err, 'error');
        retur;
      }
      app.notify("Sent "+number+" labels to printer", 'success');
    })
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
        <p>Number of identical copies to print: <input type="text" value={this.state.copies} onInput={linkState(this, 'copies')} /></p>
        <p>How many consecutively numbered labels to print: <input type="text" value={this.state.number} onInput={linkState(this, 'number')} /></p>
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
