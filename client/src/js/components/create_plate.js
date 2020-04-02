'use strict';

import { h, Component } from 'preact';
import { Link } from 'preact-router/match';
import { route } from 'preact-router';
import { view } from 'z-preact-easy-state';

const u = require('../utils.js');
const PlatePhysical = require('../physicals/plate.js');
const Print = require('./print.js')

class CreatePlate extends Component {

  constructor(props) {
    super(props);

    this.plate = new PlatePhysical();

    this.plate.label = {
        id: this.plate.id,
        name: this.plate.numWells().toString() + " well plate" ,
        description: "Label created at: " + u.formatDateTime(this.plate.createdAt) + "\n"
          + "Created by: <unknown>", // TODO add user
        bsl: 2,
      temperature: -80
    };
        
    this.setState({
      label: this.plate.label
    });
  }

  
  printAndSave(err, labelData, imageData, doPrint) {
    if(err) return app.actions.notify(err, 'error');
    
    this.plate.label = labelData;
    this.plate.label.imageData = imageData;
    
    this.plate.save(doPrint, function(err, obj, filePath) {
      if(err) {
        app.actions.notify(err, 'error');
        return;
      }

      console.log("Saved label with id", obj.id, "filepath", obj.labelPath);
      route('/plate/'+encodeURIComponent(obj.id));
    });
    
  }
  
  render() {

    return (
      <div>
        <h3>Create lavel for new plate</h3>

        <Print item={this.state.label} callback={this.printAndSave.bind(this)} />

      </div>
    );
  }
}

module.exports = view(CreatePlate);
  

