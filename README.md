# Javascript implementation of Beebrain

## Description

This repository includes various Javascript packages implementing all
Beebrain functionality, as well as an interactive editor for Beeminder
roads. Below is a list of components and features supported by this
repository:

* Javascript modules for processing beeminder goal BB files ({@link module:butil `butil`}, {@link module:broad `broad`}, {@link module:beebrain `beebrain`})
* A Javascript module for goal graph generation and an interactive road editor ({@link module:bgraph `bgraph`})
* A Javascript module implementing a sandbox for experimenting with Beemidner goals ({@link module:bsandbox `bsandbox`})
* A Javascript module to facilitate automated testing and comparison of beebrain outputs ({@link module:btest `btest`})
* A node server that uses the modules above to locally generate graph PNG and SVG, thumbnail PNG and goal JSON output files upon receiving a GET request
* A node server that provides web interface for client-side graphs, road editor and sandbox functionality
* A node server that duplicates the behaviors of sanity.py from pybrain
* Various static HTML pages to test beebrain, graph, editor and sandbox functionality

## Getting started

### Local tests for basic functionality

The directory `tests` includes a collection HTML files that illustrate
various basic functionalities of the JS beebrain implementation. In
particular

* `basic_test.html`: Showcases client-side graphs
* `roadeditor_test.html`: Showcases client-side graphs and the road editor
* `sandbox.html`: Showcases beeminder sandbox to create and experiment with goals

In order to be able to load these files, you will need to use chromium
(or chrome) with the following arguments:

`chromium-browser --allow-file-access-from-files --disable-web-security --user-data-dir=$HOME/jsgraph-data --remote-debugging-port=9222 --use-gl=osmesa`

This allows the browser to open local beeminder files for testing
purposes from within Javascript functions. You should be able to open
the above test files from this browser instance. You may need to
adjust some of the options such as `--user-data-dir` based on
differences in your local system.

### Node server for client-side graph, road editor and sandbox demos

This repository contains a node server instance for serving
various demo pages to browser clients. 

After you clone the main repository, you will need to install
necessary node modules in the root directory with

`npm update`

Once all module dependencies are installed, you will need to generate
minified and concatanated files based on sources in `src`. To do that,
you may need to first install the command line interface for gulp with

`sudo npm install --global gulp-cli`

which now enables you to use the gulp command. Now, you can generate
all distribution files with

`gulp compile`

After updating node modules and using gulp to compile js modules, you
will need to provide a `.data` directory with a local sqlite database
and a `.env` file with proper server settings to access central
Beeminder servers for your login (contact us for details). Once this
is done, you can start the demo server with

`npm start`

This starts a web server on `localhost`, with different features
available through different paths. This server should also be
embeddable in glitch. The following paths are available:

  * `/editor`  : Client-side graph and interactive road editor for example goals
  * `/sandbox` : Client-side sandbox to create and experiment with dummy goals
  * `/login`   : Authorizes these pages to access your Beeminder goals
  * `/logout`  : De-authorizes access to your Beeminder goals
  * `/road`    : Client-side graph and interactive road editor for your Beeminder goals

The last three require setting up oauth redirect uri configuration
properly with beeminder servers, so it would require proper settings
in `.env`. The first two should work locally though. Note that getting
the last three to work requires the node server being accessible from
beeminder servers for the redirect_uri provided in `.env`, associated
with the clientid also configured in `.env`.

### Node server for local server-side graph generation

This feature enables running a separate node.js instance on a server,
listening to GET requests that initiate the generation of PNG,SVG and
JSON files for particular beeminder goals. This server resides under
the directory `jsbrain_server`. You should first update node modules with

`cd jsbrain_server`
`npm update`

At this point, you can start the server in the same directory with 

`npm start`

which should start a node server on port 3000. At this point, every
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

## Appendices

### A. Directory structure 

The directory structure for this repository is organized as follows

  * `src` : Javascript and CSS sources
  * `lib` : Files generated and copied by gulp, served under `/lib`
  * `data`: Example BB files, accessible through `/data`
  * `views`: express.js view templates
  * `tests`: HTML files for various local tests, loading scripts from `src`
  * `jsbrain_server`:Local server to handle graph generation requests
  * `jsbrain_manual`:Outdated manual shell script for PNG generation
  
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

### B. Deployment to glitch, or local server

When deploying a new version of the road editor to glitch (as in setting up a 
new road-staging glitch)

- create a new beeminder client at https://www.beeminder.com/apps/new
- the redirect uri is `https://[project].glitch.me/connect`
- add the client id to your .env file
- add the redirect uri in your .env file
- launch the glitch console and create .data/database.sqlite for the session store to connect to
