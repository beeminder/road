# Beebrain and the Beeminder Road Editor


This repository includes Javascript packages implementing all Beebrain functionality, as well as an interactive editor for Beeminder's Yellow Brick Roads.

Description of original Beebrain: 
<http://doc.beeminder.com/beebrain>

## Components and Features

* Javascript modules for processing Beeminder goal BB files 
({@link module:butil `butil`},
{@link module:broad `broad`},
{@link module:beebrain `beebrain`})
* A Javascript module for goal graph generation and an interactive road editor 
({@link module:bgraph `bgraph`})
* A Javascript module implementing a sandbox for experimenting with Beemidner goals 
({@link module:bsandbox `bsandbox`})
* A Javascript module to facilitate automated testing and comparison of beebrain outputs 
({@link module:btest `btest`})
* A Node server that uses the modules above to locally generate graph PNG and SVG, thumbnail PNG, and goal JSON output files upon receiving a GET request
* A Node server that provides a web interface for client-side graphs, road editor, and sandbox functionality
* A Node server that duplicates the behaviors of sanity.py from pybrain
* Various static HTML pages to test beebrain, graph, editor and sandbox functionality

## Getting started

First make an environment variable with the path to this repository, for example:

`export BBPATH=/Users/alice/projects/road`

(Or wherever you git-cloned this to.)
You can put that in your .bashrc if you want.
Or just edit in your path wherever it says `$BBPATH` below.

### Local tests for basic functionality

The directory `tests` has HTML files illustrating various Beebrain functionality:

* `basic_test.html`      : Showcases client-side graphs
* `roadeditor_test.html` : Showcases client-side graphs and the road editor
* `sandbox.html`         : Showcases a Beeminder sandbox to create and experiment with goals

You can load them in Chromium or Chrome with the following command:

(Chromium on Linux)  
`chromium-browser --allow-file-access-from-files --disable-web-security --user-data-dir=$BBPATH/chromium-data --remote-debugging-port=9222 --use-gl=osmesa file://$BBPATH/tests/basic_test.html file://$BBPATH/tests/roadeditor_test.html file://$BBPATH/tests/sandbox.html`

(Chrome on MacOS)  
`open -na /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --args --allow-file-access-from-files --disable-web-security --user-data-dir=$BBPATH/chromium-data --remote-debugging-port=9222 --use-gl=osmesa file://$BBPATH/tests/basic_test.html file://$BBPATH/tests/roadeditor_test.html file://$BBPATH/tests/sandbox.html`

The scary-looking arguments allow the browser to open local Beeminder files from within Javascript functions. 

### Node server for client-side graphs, road editor, and sandbox demos

This repository contains a Node server instance for serving various demo pages to browser clients. 

After you clone this repository, install necessary Node modules in the root directory:

`npm update`

Once all module dependencies are installed, generate minified and concatanated files based on sources in `src`. 
To do that, you may need to first install the command line interface for Gulp:

`sudo npm install --global gulp-cli`

which now enables you to use the gulp command. 
Now, you can generate all distribution files with

`gulp compile`

After updating Node modules and using Gulp to compile js modules, you will need to provide a `.data` directory with a local sqlite database and a `.env` file with proper server settings to access central Beeminder servers for your login (contact us for details). 
Once this is done, you can start the demo server with

`npm start`

This starts a web server on `localhost`, with different features available through different paths. 
This server should also be embeddable in Glitch. 
The following paths are available:

  * `/editor`  : Client-side graph and interactive road editor for example goals
  * `/sandbox` : Client-side sandbox to create and experiment with dummy goals
  * `/login`   : Authorizes these pages to access your Beeminder goals
  * `/logout`  : De-authorizes access to your Beeminder goals
  * `/road`    : Client-side graph and interactive road editor for your Beeminder goals

The last three require setting up oauth redirect uri configuration
properly with beeminder servers, so it would require proper settings
in `.env`. The first two should work locally though. Note that getting
the last three to work requires the Node server being accessible from
beeminder servers for the redirect_uri provided in `.env`, associated
with the clientid also configured in `.env`.

### Node server for local server-side graph generation

This feature enables running a separate Node.js instance on a server,
listening to GET requests that initiate the generation of PNG,SVG and
JSON files for particular beeminder goals. This server resides under
the directory `jsbrain_server`. You should first update Node modules with

`cd jsbrain_server`
`npm update`

At this point, you can start the server in the same directory with 

`npm start`

which should start a Node server on port 3000. At this point, every
GET request you issue to `localhost:3000` with appropriate parameters
will initiate graph generation. valid parameters are:

  * `inpath=/path/to/input` : Path to local directory for the BB file
  * `outpath=/path/to/output`: (optional) Path to local directory for generated files
  * `user=u`: beeminder username (`slug` param must be empty)
  * `goal=g`: beeminder goalname (`slug` param must be empty)
  * `slug=filebase`: base name for the BB files (`user` and `goal` params must be empty)
  * `pyjson=/path/to/pyout/slug.json`: (optional) Local path to pybrain JSON output
  
This reads the file `u+g.bb` (or `slug.bb`) from `/path/to/input`, and
generates `u+g.png`, `u+g-thumb.png`, `u+g.svg` and `u+g.json` in
`/path/to/output`. 

### Generating this documentation

Do `gulp gendoc` in the root directory and point your browser to 
`file:///path/to/road/docs/index.html`

## Appendix

### A. Directory structure 

The directory structure for this repository is organized as follows

  * `src` : Javascript and CSS sources
  * `lib` : Files generated and copied by gulp, served under `/lib`
  * `data`: Example BB files, accessible through `/data`
  * `views`: express.js view templates
  * `tests`: HTML files for various local tests, loading scripts from `src`
  * `jsbrain_server`:Local server to handle graph generation requests
  
Emacs environment:
  * indium works well
  * sr-speedbar is docked
  * imenu requires *rescan* from the top menu
  * M-x indium-connect connects to a running chrom instance configured in the .indium file
  * Had to rename menu names in js2 and indium el files to shorten their names
  * purpose-mode is useful to keep windows with what they are for
  * For development, the following fonts seem to be good options:
    * Hack: https://github.com/source-foundry/Hack
    * OfficeCodePro: https://github.com/nathco/Office-Code-Pro
    * Font rendering: https://wiki.manjaro.org/index.php?title=Improve_Font_Rendering

### B. Deployment to Glitch (or similar)

1. Import from https://github.com/beeminder/road
2. Create a new Beeminder client at https://www.beeminder.com/apps/new
3. Set the redirect URI in the .env file to `https://[project].glitch.me/connect`
4. Add the client ID Beeminder assigns you to the .env file
5. Same with the redirect URI, add it to the .env file
6. Open the Glitch console and do `mkdir .data` and `cd .data`
7. Create an empty SQLite file for the session store: `touch database.sqlite`

## Credits

[Uluç Saranlı](http://www.ceng.metu.edu.tr/~saranli/)
