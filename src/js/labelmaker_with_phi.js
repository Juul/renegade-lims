
const bwipjs = require('bwip-js');

function TubeLabelMakerWithOrderID(opts) {
  
  opts = opts || {};
  
  this.labelWidth = opts.labelWidth || 560;
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


  this.drawTubeBarcode = function(ctx, number, y) {

    var tmpCanvas = document.createElement('canvas');
    
    try {
      bwipjs.toCanvas(tmpCanvas, {
        bcid:        'code128',         // Barcode type
        text:        number.toString(), // Text to encode
        scale:       5,                 // 3x scaling factor
        height:      5,                 // Bar height, in millimeters
        includetext: true,              // Show human-readable text
        textsize: 10,
        textxalign:  'center',          // Always good to set this
        textyoffset: 3,
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
  
  this.drawFormCode = function(ctx, number, y) {

    var tmpCanvas = document.createElement('canvas');
    
    try {
      bwipjs.toCanvas(tmpCanvas, {
        bcid:        'code128',         // Barcode type
        text:        number.toString(), // Text to encode
        scale:       5.8,                 // 3x scaling factor
        height:      0,                 // Bar height, in millimeters
        barcolor:    'FFFFFF',
        includetext: true,              // Show human-readable text
        textsize: 7,
        textxalign:  'center',          // Always good to set this
        textyoffset: 5,
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

  this.drawName = function(ctx, name, y) {

    ctx.font = '30px sans-serif';
    ctx.fillText(name, 10, y);
     
    return true;;
  };

  this.drawDOB = function(ctx, day, month, year, y) {

    ctx.font = '30px sans-serif';
    ctx.fillText('Date of birth: ' + month+'/'+day+'/'+year, 50, y);
    
    return true;;
  };
  
  
  this.drawLabel = function(canvas, o, cb) {
    
    if(typeof canvas === 'string') {
      canvas = document.getElementById(canvas);
    }
    
    var ctx = this.ctx; 

    this.clear();
    ctx.fillStyle = "#000";
    // ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    ctx.imageSmoothingEnabled = false;

		ctx.shadowBlur = 0;
		ctx.globalAlpha = 1;

		ctx.save();

    this.drawFormCode(ctx, o.formBarcode, 570);
    this.drawTubeBarcode(ctx, o.tubeBarcode, 450);
    this.drawName(ctx, o.patientName, 390);
    this.drawDOB(ctx, o.dobDay, o.dobMonth, o.dobYear, 430);
    
		ctx.restore();
    show();
    
    function show() {
      if(canvas) {
        var showCtx = canvas.getContext('2d');
        showCtx.clearRect(0, 0, canvas.width, canvas.height);
        showCtx.drawImage(ctx.canvas, 0, 0, canvas.width, canvas.height);
      }
      if(cb) cb(null);
    }

  };
  
  this.getDataURL = function(monochrome) {
    var ctx = this.ctxCopy(true);
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

module.exports = TubeLabelMakerWithOrderID;
