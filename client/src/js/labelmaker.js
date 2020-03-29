var QR = require('qrcode-generator');

function LabelMaker(opts) {
    
    opts = opts || {};

    this.fontFamily = opts.fontFamily || "FiraSans-Regular";
    this.fontFamilyBold = opts.fontFamilyBold || "FiraSans-Bold";
    this.fontFamilyItalic = opts.fontFamilyItalic || "FiraSans-Italic";
    this.fontSize = opts.fontSize || 35;
    this.lineHeight = opts.lineHeight || 40;
    this.leftMargin = opts.leftMargin || 5;
    this.topMargin = opts.topMargin || 5;
    this.bottomMargin = opts.bottomMargin || 12;
    this.lineMargins = opts.lineMargins || {};
    this.maxLines = opts.maxLines || 7; // maximum number of lines
    this.symbolSpacing = opts.symbolSpacing || 40;
    this.labelWidth = opts.labelWidth || 1083;
    this.labelHeight = opts.labelHeight || 336;
    this.symbolPath = opts.symbolPath || '/symbols/';

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

    // get total vertical offset of a line due to line margins of above lines
    this.getLineMargins = function(lineNum) {
      var totalMargin = 0;
      var i;
      for(i=0; i <= lineNum; i++) {
        if(this.lineMargins[i]) totalMargin += this.lineMargins[i]
      }
      return totalMargin;
    };

    this.drawLabel = function(canvas, url, txt, symbols, cb) {

        if(typeof canvas === 'string') {
            canvas = document.getElementById(canvas);
        }
        var ctx = this.ctx; 

        if(typeof symbols.bsl === 'string') {
            symbols.bsl = parseInt(symbols.bsl);
            if(isNaN(symbols.bsl)) symbols.bsl = undefined
        }

        if(typeof symbols.temperature === 'string') {
            symbols.temperature = parseInt(symbols.temperature);
            if(isNaN(symbols.temperature)) symbols.temperature = undefined
        }

        this.clear();
        ctx.fillStyle = "#000";

        ctx.mozImageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
        ctx.imageSmoothingEnabled = false;

		    ctx.shadowBlur = 0;
		    ctx.globalAlpha = 1;

		    var qrcode = new QR(3, 'L');
		    qrcode.addData(url);
		    qrcode.make();

		    ctx.save();

        var numSquares = qrcode.getModuleCount() + 2;
		    var squareSize = this.labelHeight / (numSquares);
        var squareSizeR = Math.round(squareSize);

        var row, col;
		    ctx.beginPath();
		    for(row=0; row < qrcode.getModuleCount(); row++){
			      for(col=0; col < qrcode.getModuleCount(); col++){
				        if(qrcode.isDark(row, col)) {
					          ctx.rect(Math.round(col*squareSize+squareSize), Math.round(row*squareSize+squareSize), squareSizeR, squareSizeR);
				        }
			      }
		    }
		    ctx.closePath();
		    ctx.fill();
		    ctx.restore();

//        ctx.translate(height, 0);
        txt = txt || '';
        var lines = txt.split("\n");

        var lineMargin;
        var i, line;
        for(i=0; i < lines.length && i < this.maxLines; i++) {
            if(i==0) {
                ctx.font = this.fontSize + 'px' + ' ' + this.fontFamilyBold;
            } else if(i==1) {
                ctx.font = this.fontSize + 'px' + ' ' + this.fontFamilyItalic;
            } else {
                ctx.font = this.fontSize + 'px' + ' ' + this.fontFamily;
            }
            line = lines[i];
            lineMargin = this.getLineMargins(i) || 0;
		        ctx.fillText(line, this.labelHeight + this.leftMargin, this.topMargin + this.lineHeight * (i + 1) + lineMargin);
        }

        function show() {
            if(canvas) {
                var showCtx = canvas.getContext('2d');
                showCtx.clearRect(0, 0, canvas.width, canvas.height);
                showCtx.drawImage(ctx.canvas, 0, 0, canvas.width, canvas.height);
            }
            if(cb) cb();
        }

        // draw temperature symbol
        var drawSymbolTemp = function(temp, offset, cb) {

            offset = offset || 0;
            if(temp < -99) {
                temp = -99;
            } else if(temp > 99) {
                temp = 99;
            }
            var img = new Image();

            img.onload = function() {
                var symbolStart = this.lineHeight * (this.maxLines - 1) + this.bottomMargin;
                ctx.drawImage(img, this.labelWidth - img.width - 80, symbolStart);
                ctx.font = '36px' + ' ' + this.fontFamily;
                var lbl;
                if(temp < 0) {
                    lbl = temp+'°';
                } else if(temp > 0) {
                    lbl = '+'+temp+'°';
                } else {
                    lbl = temp+'°';
                }

                ctx.fillText(lbl, this.labelWidth - img.width - 45, symbolStart + 45);
                var symbolWidth = img.width + ctx.measureText('00').width;
                cb(null, symbolWidth + 30 + offset);
            }.bind(this);

            img.src = this.symbolPath + "/temperature.png";

        }.bind(this);


        // draw BSL
        var drawSymbolBSL = function(bsl, offset, cb) {
            offset = offset || 0;
            if(bsl < 0) {
                bsl = 0;
            } else if(bsl > 4) {
                bsl = 4;
            }
            var symbolStart = this.lineHeight * (this.maxLines - 1) + this.bottomMargin;
            
            ctx.font = '36px' + ' ' + this.fontFamily;
            var lbl;
            lbl = 'BSL-'+bsl;

            var symbolWidth = ctx.measureText(lbl).width;

            ctx.fillText(lbl, this.labelWidth - symbolWidth - offset - 30, symbolStart + 52);

            cb(null, symbolWidth + offset);
        }.bind(this);

        // draw biohazard symbol
        var drawSymbolBiohazard = function(offset, cb) {
            offset = offset || 0;
            var img = new Image();
            img.onload = function() {
                var symbolStart = this.lineHeight * (this.maxLines - 1) + this.bottomMargin;
                ctx.drawImage(img, this.labelWidth - img.width - offset, symbolStart);
                var symbolWidth = img.width;
                cb(null, symbolWidth + offset);
            }.bind(this);

            img.src = this.symbolPath + "/biohazard.png";

        }.bind(this);

        if(symbols.temperature !== undefined) {
            drawSymbolTemp(symbols.temperature, 0, function(err, offset) {

                if(symbols.biohazard) {
                    drawSymbolBiohazard(offset + this.symbolSpacing, function(err, offset) {
                        if(symbols.bsl >= 0) { 
                            drawSymbolBSL(symbols.bsl, offset, show);
                        } else {
                            show();
                        }
                    }.bind(this));
                } else {
                    if(symbols.bsl >= 0) { 
                        drawSymbolBSL(symbols.bsl, offset, show);
                    } else {
                        show();
                    }
                }
            }.bind(this));
        } else {
            if(symbols.biohazard) {
                drawSymbolBiohazard(this.symbolSpacing, function(err, offset) {
                    if(symbols.bsl >= 0) { 
                        drawSymbolBSL(symbols.bsl, offset, show);
                    } else {
                        show();
                    }
                }.bind(this));
            } else {
                if(symbols.bsl >= 0) { 
                    drawSymbolBSL(symbols.bsl, 0, show);
                } else {
                    show();
                }
            }
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

module.exports = LabelMaker;
