
# node.js server for processing bb files

This package implements a node.js web server based on express and puppeteer that runs a headless chromium instance and, upon request, reads, processes and renders a beebrain BB file followed by the generation of associated SVG and PNG graphs together with a JSON output with goal parameters.

## Getting started

You can run the server instance with
```
npm start
```
which will fire up a node.js server on localhost:3000. You can then request processing for a BB file with a GET request issued to this server with the following parameters
```
path: Directory in which the BB file is to be located on the server. Must be accessible by the server
base: Base name for the BB file
```
Upon successful completion of the request, three additional files, base.svg, base.png and base.json will be created within the same directiry as the BB file.

## Principles of operation

The following sequence of events occur upon reception of a request of the form described above:

- A new page is created within the headless chrome instance through puppeteer
- This page loads generate.html with the parameter bb=file://path/base.bb
- generate.html invokes roadeditor.js in headless mode with the editor disabled, generating an SVG graph for the goal
- The generated svg is extracted from the headless browser instance and saved to base.svg
- A screenshot is taken through puppeteer from the SVG bounding box and saved to base.png
- generate.html also informs roadeditor.js to populate a div element with the goal json, which is then extracted and saved into base.json
- The newly created page is closed
