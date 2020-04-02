
//var decamelize = require('decamelize');
var uuid = require('uuid').v4;
var u = require('../../../../validators/common/utils.js');
var validatePhysical = require('../../../../validators/object.js');

class Physical {

  // o can be an object, a JSON string or a v4 UUID
  constructor(o) {
    if(o) {
      if(typeof o === 'string') {
        if(u.validateUUID(o)) {
          this.id = o;
        } else {
          o = JSON.parse(o);
        }
      }
      if(!this.constructor.validate(objOrJSON)) {
        throw new Error("Validation failed");
      }
      Object.assign(this, o);
    }
    // Set type name from class name
    this.type = u.decamelize(this.constructor.name, '_');
    
    if(!this.id) {
      this.id = uuid();
      if(!this.createdAt) {
        this.createdAt = new Date();
      }
      if(!this.createdBy) {
        // TODO add createdBy user when possible
      }
    }
  }

  save(doPrint, cb) {
    if(typeof doPrint === 'function') {
      cb = doPrint;
      doPrint = false;
    }
    if(!this.label) {
      app.remote.savePhysical(this, null, false, cb);
      return;
    }
    if(!this.label.imageData) {
      app.remote.savePhysical(this, this.label.imageData, false, cb);
      return;
    }
    
    app.remote.savePhysical(this, this.label.imageData, doPrint, cb); 
  }
  
  static validate(p) {
    return validatePhysical(p);
  }

}

module.exports = Physical;


