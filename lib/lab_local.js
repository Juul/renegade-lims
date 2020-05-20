'use strict';

class LabLocal {

  constructor(db, prefix) {
    this.db = db;
    this.lastBarcode = undefined;
    this.lock = false;
    this.queue = [];
    this.prefix = prefix;
  }
  
  loadLastBarcode(cb) {
    var lastBarcode;
    this.db.get('lastBarcode', function(err, val) {
      var number;
      if(err) {
        if(!err.notFound) return cb(err);
        lastBarcode = 1;
      } else {
        lastBarcode = val.number + 1;
      }
      cb(null, lastBarcode);
    });
  }

  processQueue() {
    if(!this.queue) return;

    var func;
    while(this.queue.length > 0) {
      func = this.queue.splice(0, 1);
      if(typeof func !== 'function') return;
      func();
    }
  }

  addToQueue(func) {
    this.queue.push(func);
  }
  
  getBarcodes(howMany, cb) {
    if(this.lock) { // ensure we never run more than one of these at a time
      this.addToQueue(function() {
        this.getBarcodes(howMany, cb);
      }.bind(this));
      return;
    }
    this.lock = true;

    // Looks like we'll need to load it from database (first run)
    if(this.lastBarcode === undefined) {
      this.loadLastBarcode(function(err, lastBarcode) {
        if(err || lastBarcode === undefined) {

          this.lock = false;
          cb(new Error("Failed to load last barcode from database"));
          return;
        }
        this.lastBarcode = lastBarcode;
        this.lock = false
        this.getBarcodes(howMany, cb);
      }.bind(this));
      return;
    }
    
    if(this.lastBarcode === undefined) return cb(new Error("lastBarcode not set"));
    if(!howMany || typeof howMany !== 'number' || howMany < 0 || Math.floor(howMany) !== howMany) {
      return cb(new Error("First argument must a positive integer"));
    }
    if(howMany > 100) {
      return cb(new Error("Trying to reserve more than 100 barcode numbers at a time"));
    }

    var ret = this.lastBarcode + 1;
    const newLast = this.lastBarcode + howMany;
    
    this.db.put('lastBarcode', {number: newLast}, function(err) {
      if(err) {
        cb(err);
        this.lock = false
        this.processQueue();
        return;
      }

      this.lastBarcode = newLast;
      cb(null, ret, howMany, this.prefix);
      
      this.lock = false;
      this.processQueue();
    }.bind(this));
  }
}

module.exports = LabLocal;
