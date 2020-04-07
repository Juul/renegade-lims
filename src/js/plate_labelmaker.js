
const bwipjs = require('bwip-js');

function PlateLabelMaker(opts) {
  
  opts = opts || {};

  this.labelWidth = opts.labelWidth || 336;
  this.labelHeight = opts.labelHeight || 1083;

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
  this.ctxCopy = function() {
	  var c = document.createElement('canvas');
	  c.width = this.ctx.canvas.width;
	  c.height = this.ctx.canvas.height;
    var ctx = c.getContext('2d');
    ctx.drawImage(this.ctx.canvas, 0, 0);
    return ctx;
  };


  this.drawBarcodes = function(ctx, startNumber) {

    var number = startNumber;
    var y = 10;
    var ret;
    do {

      ret = this.drawBarcode(ctx, number, y);
      y += 60;
      number++;
    } while(ret);
    
    
  }
  
  this.drawBarcode = function(ctx, number, y) {

    var tmpCanvas = document.createElement('canvas');
    
    try {
      bwipjs.toCanvas(tmpCanvas, {
        bcid:        'code128',         // Barcode type
        text:        number.toString(), // Text to encode
        scale:       3,                 // 3x scaling factor
        height:      3,                 // Bar height, in millimeters
        includetext: true,              // Show human-readable text
        textsize: 8,
        textxalign:  'center',          // Always good to set this
        backgroundcolor: 'ffffff'
      });

      if(y + tmpCanvas.height > this.labelHeight) {
        return false;
      }
      
      const leftOffset = Math.round((this.labelWidth - tmpCanvas.width) / 2);
      ctx.drawImage(tmpCanvas, leftOffset, y);
    } catch(err) {
      console.error(err);
      return false;
    }

    return true;;
  };
  
  this.drawLabel = function(canvas, number, cb) {

    if(typeof canvas === 'string') {
      canvas = document.getElementById(canvas);
    }
    
    var ctx = this.ctx; 

    this.clear();
    ctx.fillStyle = "#000";
    //        ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    ctx.imageSmoothingEnabled = false;

		ctx.shadowBlur = 0;
		ctx.globalAlpha = 1;

		ctx.save();

    this.drawBarcodes(ctx, 1024);
    
    console.log("GOT HERE");
		ctx.restore();
    show();

    // TODO unused?
    function show() {
      if(canvas) {
        var showCtx = canvas.getContext('2d');
        showCtx.clearRect(0, 0, canvas.width, canvas.height);
        showCtx.drawImage(ctx.canvas, 0, 0, canvas.width, canvas.height);
      }
      if(cb) cb();
    }

  };
  
  this.getDataURL = function(monochrome) {
    var ctx = this.ctxCopy();
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

module.exports = PlateLabelMaker;
