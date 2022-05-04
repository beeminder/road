const gulp = require('gulp')
const minify = require('gulp-minify')
const concat = require('gulp-concat')
const changed = require('gulp-changed')
const cleancss = require('gulp-clean-css')
const jsdoc = require("gulp-jsdoc3")
const jshint = require("gulp-jshint")

const LIBDIR = 'lib'
const LIBJS = LIBDIR+"/js"
const LIBCSS = LIBDIR+"/css"
const LIBIMG = LIBDIR+"/images"
const DOCDIR = './docs'

function clean_css() {
  return gulp.src(['src/jsbrain.css','src/newdesign.css',
                   'src/editorpage.css','src/pikaday.css'])
    .pipe(changed(LIBCSS))
    .pipe(cleancss())
    .pipe(gulp.dest(LIBCSS))
}

function compress_js() {
  return gulp.src(['src/polyfit.js','src/pikaday.js',
                   'src/butil.js','src/broad.js','src/beebrain.js',
                   'src/bgraph.js',
                   'src/bsandbox.js',
                   'src/btest.js',
                   'src/client.js',
                   'src/newdesign.js'])
    .pipe(changed(LIBJS))
    .pipe(minify({ext:{src:".js", min:".min.js"}, noSource:true}))
    .pipe(gulp.dest(LIBJS))
}

function combine_bbrjs() {
  return gulp.src(['src/butil.js','src/broad.js','src/beebrain.js'])
    .pipe(concat('bbrpack.js'))
    .pipe(gulp.dest(LIBJS))
}

function combine_bgrjs() {
  return gulp.src(['src/polyfit.js','src/pikaday.js',
                   'src/butil.js','src/broad.js','src/beebrain.js',
                   'src/bgraph.js'])
    .pipe(concat('bgrpack.js'))
    .pipe(gulp.dest(LIBJS))
}

function combine_bsbjs() {
  return gulp.src(['src/polyfit.js','src/pikaday.js',
                   'src/butil.js','src/broad.js','src/beebrain.js',
                   'src/bgraph.js','src/bsandbox.js'])
    .pipe(concat('bsbpack.js'))
    .pipe(gulp.dest(LIBJS))
}

function combine_js(cb) {
  let a = gulp.series(combine_bbrjs, combine_bgrjs, combine_bsbjs)
  return a(cb)
}

function combine_bbrjsmin() {
  return gulp.src(['lib/js/butil.min.js','lib/js/broad.min.js',
                   'lib/js/beebrain.min.js'])
    .pipe(concat('bbrpack.min.js'))
    .pipe(gulp.dest(LIBJS))
}

function combine_bgrjsmin() {
  return gulp.src(['lib/js/polyfit.min.js','lib/js/pikaday.min.js',
                   'lib/js/butil.min.js','lib/js/broad.min.js',
                   'lib/js/beebrain.min.js', 'lib/js/bgraph.min.js'])
    .pipe(concat('bgrpack.min.js'))
    .pipe(gulp.dest(LIBJS))
}

function combine_bsbjsmin() {
  return gulp.src(['lib/js/polyfit.min.js','lib/js/pikaday.min.js',
                   'lib/js/butil.min.js','lib/js/broad.min.js',
                   'lib/js/beebrain.min.js', 'lib/js/bgraph.min.js',
                   'lib/js/bsandbox.min.js'])
    .pipe(concat('bsbpack.min.js'))
    .pipe(gulp.dest(LIBJS))
}

function combine_jsmin(cb) {
  let a = gulp.series(combine_bbrjsmin, combine_bgrjsmin, combine_bsbjsmin)
  return a(cb)
}

function copy_vendor() {
  return gulp.src(['src/moment.min.js', 'src/moment-timezone.min.js'])
    .pipe(gulp.dest(LIBJS))
}

function gendoc() {
  var config = require('./jsdoc.json')
  return gulp.src(['README.md', 'src/*.js'], {read: false})
    .pipe(jsdoc(config));
}

function linter() {
  return gulp.src(['src/butil.js', 'src/broad.js', 'src/bgraph.js', 'src/bsandbox.js', 'src/newdesign.js']).pipe(jshint({esversion:8, asi:true, laxbreak:true})).pipe(jshint.reporter('default'))
}

exports.compile = gulp.series(compress_js,
                              gulp.parallel(combine_js, combine_jsmin, clean_css),
                              copy_vendor
                             ) 
exports.gendoc = gendoc

exports.jshint = linter
