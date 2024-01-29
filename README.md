# Quick Links

- [ZOMBIES!](https://github.com/beeminder/road/issues?q=is:open+is:issue+label:ZOM "Open gissues labeled ZOM") :zombie:
  &nbsp;&nbsp; | &nbsp;&nbsp;
  [Undotted i's](https://github.com/beeminder/road/issues?q=is:issue+is:closed+-label:zap+-label:nix+-label:cnr+-label:dup "Gissues that are closed but don't have any of the resolution labels: zap, nix, cnr, or dup") :eye:
  &nbsp;&nbsp; | &nbsp;&nbsp;
  [Active](https://github.com/beeminder/road/issues?q=is:issue+is:open+-label:ZzZ "Open gissues NOT labeled ZzZ") :bug:
  &nbsp;&nbsp; | &nbsp;&nbsp;
  [Snoozed](https://github.com/beeminder/road/issues?q=is:issue+is:open+label:ZzZ "Open gissues labeled ZzZ") :zzz:
  &nbsp;&nbsp; | &nbsp;&nbsp;
  [Closed](https://github.com/beeminder/road/issues?q=is:issue+is:closed "Closed gissues") :heavy_check_mark:
- Freshgishing ([blog post](https://blog.beeminder.com/freshen/ "Backlog Freshening")):
  &nbsp;&nbsp;
  [Uluc](https://github.com/beeminder/road/issues?q=is:issue+is:open+sort:updated-asc+-label:ZzZ+assignee:saranli "Open non-snoozed gissues, oldest first, assigned to Uluc")
  &nbsp;&nbsp; | &nbsp;&nbsp;
  [Danny/all](https://github.com/beeminder/road/issues?q=is:issue+is:open+sort:updated-asc+-label:ZzZ "Open non-snoozed gissues, oldest first, assigned to anyone (what Danny uses for freshgishing)") &nbsp;&nbsp; :soap:
- [Probably-peasy UVIs](https://github.com/beeminder/road/issues?q=is:issue+is:open+label:UVI+label:PEA+label:ABC+-label:SKY "Open gissues that are peasy (PEA), not sky-pie (SKY), user-visible (UVI), and just involve webcopy (ABC)")
  &nbsp;&nbsp; | &nbsp;&nbsp;
  [Potentially-peasy UVIs](https://github.com/beeminder/road/issues?q=is:issue+is:open+label:UVI+label:PEA "Open gissues that are peasy (PEA) and user-visible (UVI)") &nbsp;&nbsp; :sweat_smile:

# Beebrain and the Beeminder Graph Editor

This repository includes Javascript packages implementing all Beebrain functionality, as well as an interactive editor for Beeminder's Bright Red Lines.

Description of original Beebrain:
<http://doc.beeminder.com/beebrain>

## Components and Features

- Javascript modules for processing Beeminder goal BB files
  ({@link module:butil `butil`},
  {@link module:broad `broad`},
  {@link module:beebrain `beebrain`})
- A Javascript module for goal graph generation and an interactive graph editor
  ({@link module:bgraph `bgraph`})
- A Javascript module implementing a sandbox for experimenting with Beemidner goals
  ({@link module:bsandbox `bsandbox`})
- A Javascript module to facilitate automated testing and comparison of beebrain outputs
  ({@link module:btest `btest`})
- A Node server that uses the modules above to locally generate graph PNG and SVG, thumbnail PNG, and goal JSON output files upon receiving a GET request
- A Node server that provides a web interface for client-side graphs, graph editor, and sandbox functionality
- A Node server that duplicates the behaviors of sanity.py from pybrain
- Various static HTML pages to test beebrain, graph, editor and sandbox functionality

### Getting started with local tests for basic functionality

The directory `tests` has HTML files illustrating various Beebrain functionality:

- `basic_test.html` : Showcases client-side graphs
- `roadeditor_test.html` : Showcases client-side graphs and the graph editor
- `sandbox.html` : Showcases a Beeminder sandbox to create and experiment with goals

To load these in Chromium or Chrome, first, set up your environment:

```
export BBPATH=/absolule/path/to/this/repository
```

Then, if you are on Linux, you can load them in Chromium with the following example command:
```
chromium-browser --allow-file-access-from-files --disable-web-security --user-data-dir=$BBPATH/chromium-data --remote-debugging-port=9222 --use-gl=osmesa file://$BBPATH/tests/basic_test.html file://$BBPATH/tests/roadeditor_test.html file://$BBPATH/tests/sandbox.html
```

If you are on macOS, you can load them in Chrome with the following example command:
```
open -na /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --args --allow-file-access-from-files --disable-web-security --user-data-dir=$BBPATH/chromium-data --remote-debugging-port=9222 --use-gl=osmesa file://$BBPATH/tests/basic_test.html file://$BBPATH/tests/roadeditor_test.html file://$BBPATH/tests/sandbox.html
```

The scary-looking arguments allow the browser to open local Beeminder files from within Javascript functions.

Note that these will use the files out of `src/`, not the generated files in `lib/`.

### Getting started with the Node server for client-side graphs, graph editor, and sandbox demos

This repository contains a Node server instance for serving various demo pages to browser clients.

To install dependencies and compile the project, run the following commands:

```bash
npm ci # install all dependencies per package-lock.json
npm run compile # clear out lib/ and generate distribution files
```

Some demos have you to log in with your Beeminder account so it can access your Beeminder goals data.

After installing Node modules and using Gulp to compile js modules, you will need to provide a `.env` file with proper server settings to access central Beeminder servers for your login. After copying `template.dev.env` or `template.prod.env` to `.env`, read the comments in `.env` and update the file with proper settings.

Once this is done, you can start the demo server:

`npm start`

This starts a web server on `localhost`, with different features available through different paths.
This server should also be embeddable in Glitch.
The following paths are available:

- `/editor` : Client-side graph and interactive graph editor for example goals
- `/sandbox` : Client-side sandbox to create and experiment with dummy goals
- `/login` : Authorizes these pages to access your Beeminder goals
- `/logout` : De-authorizes access to your Beeminder goals
- `/road` : Client-side graph and interactive graph editor for your Beeminder goals

The last three require setting up oauth redirect uri configuration
properly with beeminder servers, so it would require proper settings
in `.env`.

Note that getting  the last three to work requires the Node server being accessible from
beeminder servers for the redirect_uri provided in `.env`, associated
with the clientid also configured in `.env`.

### Getting started with the Node server for local server-side graph generation

See jsbrain_server/README.md for details.

This feature enables running a separate Node.js instance on a server,
listening to GET requests that initiate the generation of PNG, SVG and
JSON files for particular Beeminder goals.

### Generating documentation

Do `gulp gendoc` in the root directory and point your browser to
`file:///path/to/road/docs/index.html`

## Appendix

### A. Directory structure

The directory structure for this repository is organized as follows

- `src` : Javascript and CSS sources
- `lib` : Files generated and copied by gulp, served under `/lib` (Many projects use `dist` for this)
- `data`: Example BB files, accessible through `/data`
- `views`: express.js view templates
- `tests`: HTML files for various local tests, loading scripts from `src`
- `jsbrain_server`: Local server to handle graph generation requests

### B. Emacs development notes:

- indium works well
- sr-speedbar is docked
- imenu requires _rescan_ from the top menu
- M-x indium-connect connects to a running chrom instance configured in the .indium file
- Had to rename menu names in js2 and indium el files to shorten their names
- purpose-mode is useful to keep windows with what they are for
- For development, the following fonts seem to be good options:
  - Hack: https://github.com/source-foundry/Hack
  - OfficeCodePro: https://github.com/nathco/Office-Code-Pro
  - Font rendering: https://wiki.manjaro.org/index.php?title=Improve_Font_Rendering

### C. Deployment to Glitch (or similar)

1. Import from https://github.com/beeminder/road
2. Create a new Beeminder client at https://www.beeminder.com/apps/new
3. Set the redirect URI in the .env file to `https://[project].glitch.me/connect`
4. Add the client ID Beeminder assigns you to the .env file
5. Same with the redirect URI, add it to the .env file
6. Open the Glitch console and do `mkdir .data` and `cd .data`
7. Create an empty SQLite file for the session store: `touch database.sqlite`

## Credits

[Uluç Saranlı](http://www.ceng.metu.edu.tr/~saranli/)
