'use strict';
import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';
import linkState from 'linkstate';

var PlateLabelMaker = require('../plate_labelmaker.js');
var settings = require('../../../settings.web.js');

class PrintPlateLabel extends Component {
  
  constructor(props) {
    super(props);

    this.labelMaker = new PlateLabelMaker({
    });

    this.setState({
      copies: 5
    });
  }
  
  close(e) {
    if (this.props.onClose) this.props.onClose(false)
    // TODO fixme
    //        app.actions.prompt.reset()
  }

  print(e) {
    e.preventDefault()
    console.log();

    const copies = this.state.copies;
    
    app.actions.getBarcodes(this.state.numUniqueCodes, function(err, startCode, howMany, prefix) {

      if(err) return app.actions.notify(err, 'error');

      console.log("Got prefix:", prefix);
      this.labelMaker.drawLabel('labelPreview', startCode, copies, prefix);

      var imageData = this.labelMaker.getDataURL();
      app.actions.printLabel(imageData, function(err) {
        if(err) return app.actions.notify(err, 'error');

        console.log("Printing");
      })
      
    }.bind(this));
    

    
  }

  updateLabel(e) {
    var copies = e.target.value;
    console.log("COPIES:", copies);
    if(copies !== '') {
      copies = parseInt(copies);
      if(copies > 15) copies = 15;
      if(copies < 1) copies = 1;
      this.setState({
        copies: copies
      })
    }
    if(copies) {
      var numUniqueCodes = this.labelMaker.drawLabel('labelPreview', 1, copies);
      
      this.setState({
        numUniqueCodes: numUniqueCodes
      })
    }


  }
  
  componentDidMount() {
    var numUniqueCodes = this.labelMaker.drawLabel('labelPreview', 1, this.state.copies);
    
    this.setState({
      numUniqueCodes: numUniqueCodes
    })    
  }

	render() {

    return (
        <div>
        <h3>Label maker</h3>
        <p>Copies (1 to 15): <input type="text" value={this.state.copies} onInput={this.updateLabel.bind(this)} /></p>
          <p><input type="button" onClick={this.print.bind(this)} value="Print" /></p>
          <div style="width:174px;height:560px;">
            <canvas id="labelPreview" class="labelPreview" width="174" height="560"></canvas>
        </div>
        </div>
    )
  }
}

module.exports = view(PrintPlateLabel);
