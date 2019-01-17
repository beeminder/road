/**
Main GULP file for jsbrain

The following main targets are implemented

*/

const gulp = require('gulp')
const browserify = require("browserify");
const source = require('vinyl-source-stream');
const tsify = require("tsify");
const sourcemaps = require('gulp-sourcemaps');
const buffer = require('vinyl-buffer');
const jsdoc = require("gulp-jsdoc3")
const typedoc = require("gulp-typedoc")

var ts = require("gulp-typescript");
var tsProject = ts.createProject("tsconfig.json");

const DOCDIR = './docs'
const TSDOCDIR = './tdocs'
const TESTSDIR = './tests'

var paths = {
    pages: [TESTSDIR+'/ts_test.html']
};


function copyhtml() {
  return gulp.src(paths.pages)
    .pipe(gulp.dest("dist"));
}

function tscompile() {
  return tsProject.src()
    .pipe(tsProject())
    .js.pipe(gulp.dest("dist"));
}

function tsbundle() {
    return browserify({ 
      standalone: 'bb',
      basedir: '.',
      debug: true,
      entries: ['src/butil.ts'],
      cache: {},
      packageCache: {}
    })
    .plugin(tsify)
    .bundle()
    .pipe(source('bundle.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest("dist"));
}

function doc() {
  return gulp.src(['README.md', 'src/*.js'], {read: false})
    .pipe(jsdoc({opts: {destination: DOCDIR, tutorials:"./tutorials"}}));
}

function tdoc() {
  return gulp.src(['src/*.ts'])
    .pipe(typedoc({
            // TypeScript options (see typescript docs)
            module: "commonjs",
            target: "es5",
            includeDeclarations: true,
            excludeExternals: true,
 
            // Output options (see typedoc docs)
            out: TSDOCDIR,
 
            // TypeDoc options (see typedoc docs)
            name: "jsbrain",
            mode: "modules",
            includes: "./tutorials",
            ignoreCompilerErrors: false,
            version: true,
    }));
}

exports.tscompile = tscompile

exports.tsbundle = tsbundle

exports.tsmake = gulp.series(copyhtml, gulp.series(tscompile, tsbundle))

exports.doc = doc

exports.tdoc = tdoc
