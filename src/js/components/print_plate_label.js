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

    });
  }
  
  close(e) {
    if (this.props.onClose) this.props.onClose(false)
    // TODO fixme
    //        app.actions.prompt.reset()
  }

  print(e) {
    e.preventDefault()
    var imageData = this.labelMaker.getDataURL();
    app.actions.printLabel(imageData, function(err) {
      if(err) return app.actions.notify(err, 'error');

      console.log("Printing");
    })
    
  }

  componentDidMount() {
    this.labelMaker.drawLabel('labelPreview');
    
    this.componentDidUpdate();
  }


  componentDidUpdate() {
    if(!this.state.fontsLoaded) return;
    this.updateLabel(function(err) {
      if(err) app.actions.notify(err, 'error');
    });
  }

	render() {

    return (
        <div>
          <h3>Label maker</h3>
          <input type="button" onClick={this.print.bind(this)} value="Print" />
          <div style="width:174px;height:560px;">
            <canvas id="labelPreview" class="labelPreview" width="174" height="560"></canvas>
        </div>
        </div>
    )
  }
}

module.exports = view(PrintPlateLabel);
