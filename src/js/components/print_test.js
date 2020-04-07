'use strict';

import { h, Component } from 'preact';
import { Link } from 'preact-router/match';
import { route } from 'preact-router';
import { view } from 'z-preact-easy-state';

const Print = require('./print.js')

var testLabel = {
  
};

class PrintTest extends Component {

  printAndSave(err, labelData, imageData) {
    if(err) return app.actions.notify(err, 'error');

    const doPrint = true;
    
    app.remote.savePhysical(labelData, imageData, doPrint, function(err, obj, filePath) {
      if(err) {
        app.actions.notify(err, 'error');
        return;
      }

      console.log("Saved label with id", obj.id, "filepath", obj.labelPath);
      route('/static/labels/');
    });
    
  }
  
  render() {

    return (
      <div>
        <h3>Print test</h3>

        <Print path="/print-test" item={testLabel} callback={this.printAndSave.bind(this)} />

      </div>
    );
  }
}

module.exports = view(PrintTest);
  

