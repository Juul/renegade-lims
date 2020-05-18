const bwipjs = require('bwip-js');

function LabelMaker(opts) {
  
  opts = Object.assign({
    labelWidth: 336,
    labelHeight: 1083,
    rotate: false, // rotate 90 degrees before printing?
    xOffset: 'center', // x position of label, can be a number or 'center'
    yOffset: 'center', // y position of label, can be a number or 'center'

    barcodesPerLabel: 1, // how many labels can we fit on one printed label?
    barcodeToBarcodeSpacing: 10, // spacing between multiple
    allowOverPrint: false, // allow printing beyond the bottom of the label?
    
    // bwip options
    // see: https://github.com/bwipp/postscriptbarcode/wiki/Options-Reference
    bcid:        'code128',  // Barcode type
    scale:       3,          // Scaling factor
    height:      3,          // Bar height, in millimeters
    includetext: true,       // Show human-readable text underneath?
    textsize: 8,
    textxalign:  'center',
    textyoffset: 1, // spacing between barcode and text
    backgroundcolor: 'ffffff'
    
  }, opts || {});
  
  this.opts = opts;
  
  this.labelWidth = opts.labelWidth;
  this.labelHeight = opts.labelHeight;

  this.clear = function() {
    this.ctx.fillStyle = "#FFF";
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  };

	var tmpCanvas = document.createElement('canvas');
	tmpCanvas.width = this.labelWidth;
	tmpCanvas.height = this.labelHeight;
  this.ctx = tmpCanvas.getContext('2d');
  this.clear();

  this.setOpt = function(optName, value) {
    this[optName] = value;
  };

  // get a copy of the context
  this.ctxCopy = function(rotate) {
	  var c = document.createElement('canvas');
    if(rotate) {
	    c.height = this.ctx.canvas.width;
	    c.width = this.ctx.canvas.height;
    } else {
	    c.width = this.ctx.canvas.width;
	    c.height = this.ctx.canvas.height;
    }
    var ctx = c.getContext('2d');
    if(rotate) { // rotate 90 degrees clockwise
      ctx.translate(c.width, 0);
      ctx.rotate(Math.PI/2);
    }
    ctx.drawImage(this.ctx.canvas, 0, 0);
    return ctx;
  };


  this.drawBarcodes = function(ctx, startNumber, ofEach, prefix) {
    ofEach = ofEach || 0;
    prefix = prefix || '';
    console.log("DRAWING:", ofEach);
    var y = this.opts.yOffset;
    if(typeof y !== 'number') {
      y = 0;
    }
    
    var numUniqueCodes = Math.floor(opts.barcodesPerLabel / ofEach);
    var numLabels = Math.floor(opts.barcodesPerLabel / ofEach) * ofEach;
    var count = 0;
    var number = startNumber;
    var ret;
    var eachCount = 0;
    var barcode;
    do {
      if(prefix) {
        barcode = prefix+number;
      } else {
        barcode = number;
      }
      ret = this.drawBarcode(ctx, barcode, undefined, y);
      y += this.opts.barcodeToBarcodeSpacing;
      eachCount++;
      count++;
      if(eachCount >= ofEach) {
        eachCount = 0;
        if(ofEach) {
          number++;
        }
      }
    } while(ret && (count < numLabels || !ofEach));
    
    return numUniqueCodes;
  }
  
  this.drawBarcode = function(ctx, number, x, y) {
    if(typeof x !== 'number' && typeof x !== 'string') {
      x = this.opts.xOffset;
    }
    
    if(typeof y !== 'number' && typeof y !== 'string') {
      y = this.opts.yOffset;
    }
    
    var tmpCanvas = document.createElement('canvas');

    var bwipOpts = this.opts;
    bwipOpts.text = number.toString();
    
    try {
      bwipjs.toCanvas(tmpCanvas, bwipOpts);

      if(!this.opts.allowOverPrint) {
        if(y + tmpCanvas.height > this.labelHeight) {
          return false;
        }
      }

      if(x === 'center') {
        x = Math.round((this.labelWidth - tmpCanvas.width) / 2);
      }
      if(y === 'center') {
        y = Math.round((this.labelHeight - tmpCanvas.height) / 2);
      }
      
      ctx.drawImage(tmpCanvas, x, y);
    } catch(err) {
      console.error(err);
      return false;
    }
    
    return true;;
  };


  this.drawLabel = function(canvas, barcode, opts, cb) {
    if(typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    
    
    opts = Object.assign({
      numberOfEach: 1, // How many of the same barcode to print?
      barcodePrefix: '' // Add this prefix to each barcode number
    }, opts || {});
    
    
    if(typeof canvas === 'string') {
      canvas = document.getElementById(canvas);
    }
    
    var ctx = this.ctx; 

    this.clear();
    ctx.fillStyle = "#000";
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    ctx.imageSmoothingEnabled = false;

		ctx.shadowBlur = 0;
		ctx.globalAlpha = 1;

		ctx.save();

    var numUniqueCodes;
    if(this.opts.barcodesPerLabel > 1) {
      numUniqueCodes = this.drawBarcodes(ctx, barcode, opts.numberOfEach, opts.barcodePrefix);
    } else {
      this.drawBarcode(ctx, barcode);
      numUniqueCodes = 1;
    }
    
		ctx.restore();
    show();
    
    function show() {
      if(canvas) {
        var showCtx = canvas.getContext('2d');
        showCtx.clearRect(0, 0, canvas.width, canvas.height);
        showCtx.drawImage(ctx.canvas, 0, 0, canvas.width, canvas.height);
      }
      if(cb) cb(null, numUniqueCodes);
    }

    return numUniqueCodes;

  };
  
  this.getDataURL = function(monochrome) {
    var ctx = this.ctxCopy(this.opts.rotate);
    if(monochrome) {
      this.toMonochrome(ctx);
    }
    return ctx.canvas.toDataURL('image/png');
  };

  // Color quantization using Euclidean distance
  // https://en.wikipedia.org/wiki/Euclidean_distance
  // We don't do any alpha blending for now
  this.toMonochrome = function(ctx) {
    var imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    var p = imgData.data;
	  for(var i = 0, l = p.length; i < l; i+=4) {
		  var v = (p[i+3] === 0 // handle alpha
		           ||
		           (Math.pow(p[i], 2) + Math.pow(p[i+1], 2) + Math.pow(p[i+2], 2))
		           >
		           (Math.pow(255-p[i], 2) + Math.pow(255-p[i+1], 2) + Math.pow(255-p[i+2], 2))
		          ) * 255;
		  p[i] = p[i+1] = p[i+2] = v;
		  p[i+3] = 255;
	  };
    ctx.putImageData(new ImageData(p, ctx.canvas.width, ctx.canvas.height), 0, 0);
  };

}

module.exports = LabelMaker;
