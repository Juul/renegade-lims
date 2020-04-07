#!/usr/bin/env node

var fs = require('fs-extra');
var path = require('path');
var colors = require('colors');
var browserify = require('browserify');
var watchify = require('watchify');
var minimist = require('minimist');

function getTime() {
  var d = new Date;
  var t = [d.getHours(), d.getMinutes(), d.getSeconds()];
  t = t.map(function(i) {
    return (i < 9) ? '0'+i : i;
  })
  return t[0] + ':' + t[1] + '.' + t[2];
}

function build(opts, cb) {
  if(typeof opts === 'function') {
    cb = opts;
    opts = {};
  }
  opts = opts || {};

  const buildDir = path.join(__dirname, '..', 'static', 'build');
  fs.ensureDirSync(buildDir);
  
  var output = path.join(buildDir, 'bundle.js');

  function onBuildEnd(msg) {
    console.log("Completed".green + ((msg) ? (': ' + msg) : ''));
    if(cb) cb();
  }

  function onBuildStart() {

    process.stdout.write("Build started at " + getTime() + "... ");

    var outStream = fs.createWriteStream(output);

    if(!opts.dev) {
      outStream.on('close', onBuildEnd);
    }

    b.bundle()

      .on('error', function(err) {
        if(cb) {
          return cb(err);
        }
        
        if(err instanceof SyntaxError && err.message.match(/while parsing file/)) {
          // Format syntax error messages nicely
          var re = new RegExp(err.filename+'\:? ?');
          var msg = err.message.replace(re, '');
          msg = msg.replace(/ while parsing file\:.*/, '');
          console.error();
          console.error("\nError: ".red + msg.underline);
          console.error();
          console.error("Filename:", err.filename);
          console.error();
          console.error(err.loc);
          console.error();
          console.error(err.codeFrame);
          console.error();
        } else {
          console.error(err);
        }
      })
    
      .pipe(outStream);
  }

  var b = browserify({
    entries: [path.join(__dirname, '..', 'src', 'js', 'index.js')],
    cache: {},
    packageCache: {}
  })

  if(opts.dev) {
    console.log("Watching for changes...".yellow);
    b.plugin(watchify);
  }

  b.on('update', function(time) {
    onBuildStart();  
  });

  if(opts.dev) {
    b.on('log', onBuildEnd);
  }

  b.transform('babelify', {
    presets: [
      ['@babel/preset-env',
       {
        targets: {
          safari: 'tp', // safari version: technology preview
        }
      }]
    ],
    plugins: [
      ['transform-react-jsx', {pragma: 'h'}]
    ]
  })
  
  onBuildStart();
}

if (require.main === module) {

  var argv = minimist(process.argv.slice(2), {
    alias: {
      d: 'dev'
    },
    boolean: [
      'dev'
    ],
    default: {}
  });
  
  build(argv);

} else {

  module.exports = {
    build: build,

    watch: function(opts) {
      opts = opts || opts;
      opts.dev = true;
      return build(opts);
    }
  }

}
