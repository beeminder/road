const gulp = require('gulp')
const minify = require('gulp-minify')
const concat = require('gulp-concat')
const changed = require('gulp-changed')
const cleancss = require('gulp-clean-css')
const ts = require("gulp-typescript")
const tsProject = ts.createProject("tsconfig.json")
const jsdoc = require("gulp-jsdoc3")

const LIBDIR = 'lib'
const LIBJS = LIBDIR+"/js"
const LIBCSS = LIBDIR+"/css"
const LIBIMG = LIBDIR+"/images"
const DOCDIR = './docs'

function clean_css() {
  return gulp.src(['src/jsbrain.css','src/pikaday.css','src/editorpage.css'])
    .pipe(changed(LIBCSS))
    .pipe(cleancss())
    .pipe(gulp.dest(LIBCSS))
}

function compress_js() {
  return gulp.src(['src/butil.js','src/broad.js','src/beebrain.js',
                   'src/bgraph.js',
                   'src/bsandbox.js',
                   'src/btest.js',
                   'src/client.js',
                   'src/polyfit.js',
                   'src/pikaday.js'])
    .pipe(changed(LIBJS))
    .pipe(minify())
    .pipe(gulp.dest(LIBJS))
}

function combine_js() {
  return gulp.src(['lib/js/butil.js','lib/js/broad.js','lib/js/beebrain.js'])
    .pipe(concat('jsbrain.js'))
    .pipe(gulp.dest(LIBJS))
}

function combine_jsmin() {
  return gulp.src(['lib/js/butil-min.js','lib/js/broad-min.js',
                   'lib/js/beebrain-min.js'])
    .pipe(concat('jsbrain-min.js'))
    .pipe(gulp.dest(LIBJS))
}

function copy_vendor() {
  return gulp.src(['node_modules/moment/min/moment.min.js'])
    .pipe(gulp.dest(LIBJS))
}

function tscompile() {
  return tsProject.src()
    .pipe(tsProject())
    .js.pipe(gulp.dest("temp"));
}

function gendoc() {
  return gulp.src(['README.md', 'src/*.js'], {read: false})
    .pipe(jsdoc({opts: {destination: DOCDIR, tutorials:"./tutorials"}}));
}

exports.compile = gulp.series(compress_js,
                              gulp.parallel(combine_js, combine_jsmin, clean_css),
                              copy_vendor
                             ) 
exports.tscompile = tscompile

exports.gendoc = gendoc
