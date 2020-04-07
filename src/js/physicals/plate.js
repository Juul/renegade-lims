
var validatePlate = require('../../../validators/plate.js');
var Physical = require('./physical.js');

class Plate extends Physical {

  constructor(o) {
    super(o);

    // Default to 96 well plate
    if(!this.rows) {
      this.rows = 8;
    }
    if(!this.cols) {
      this.cols = 12;
    }
  }

  numWells() {
    return this.rows * this.cols;
  }

  static validate(plate) {
    return validatePlate(plate);
  }

}

module.exports = Plate;
