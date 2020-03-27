'use strict';

var fs = require('fs-extra');
var path = require('path');
var gulp = require('gulp');
var sass = require('gulp-sass');
var cssimport = require('gulp-cssimport');
var inlineSource = require('gulp-inline-source');
var js = require('./bin/build.js');

fs.ensureDirSync(path.join(__dirname, 'src', 'css'));

gulp.task('build:js', js.build); 

gulp.task('watch:js', js.watch);

function buildCSS() {
  return gulp.src('./src/css/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(cssimport())
    .pipe(gulp.dest('./static/build'));
}

gulp.task('build:css', buildCSS);

function watchCSS() {
  gulp.watch('./src/css/**/*.scss', buildCSS);
}

gulp.task('watch:css', buildCSS);

gulp.task('build', gulp.parallel(js.build, buildCSS));

gulp.task('watch', gulp.parallel(js.watch, watchCSS));
