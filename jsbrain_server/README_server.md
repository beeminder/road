
# node.js server for processing bb files

This directory implements a node.js web server based on express and
puppeteer that runs a headless chromium instance and, upon request,
reads, processes and renders a beebrain BB file followed by the
generation of associated SVG and PNG graphs together with a JSON
output with goal parameters.

## Getting started

### Setup

First time you run the server you need to install the dependencies first in the root directory

`cd ../`
`npm update`

Then in the jsbrain_server directory

`npm update`

### Running the server

Now that your dependencies are installed, you can run the server instance with

`npm start`

which will fire up a node.js server on localhost:3000. You can then request processing for a BB file with a GET request issued to this server with the following parameters

  * `inpath=/path/to/input` : Path to local directory for the BB file
  * `outpath=/path/to/output`: Path to local directory for generated files
  * `user=u`: beeminder username (`slug` param must be empty)
  * `goal=g`: beeminder goalname (`slug` param must be empty)
  * `slug=filebase`: base name for the BB files (`user` and `goal` params must be empty)
  
This reads the file `u+g.bb` (or `slug.bb`) from `/path/to/input`, and
generates `u+g.png`, `u+g-thumb.png`, `u+g.svg` and `u+g.json` in
`/path/to/output`. 

## Principles of operation

The following sequence of events occur upon reception of a request of
the form described above:

- A new page is created within the headless chrome instance through puppeteer
- This page loads `generate.html` with the parameter `bb=file://path/base.bb`
- generate.html invokes `bgraph.js` in headless mode with the editor disabled, generating an SVG graph for the goal
- The generated svg is extracted from the headless browser instance and saved to `u+g.svg`
- A screenshot is taken through puppeteer from the SVG bounding box and saved to `u+g.png` after being palette optimized through ImageMagick
- The image is then scaled down, extended with a broder and palette optimized, saved to`u+g-thumb.png` through ImageMagick
- generate.html also informs bgraph.js to populate a div element with the goal json, which is then extracted and saved into u+g.json
- The newly created page is closed

## Deploying jsbrain server to production

In addition to running jsbrain server locally for development purposes, we've of course got it running on the servers to generate static graph images for ufolks.

When there's a change in jsbrain code that you'd like to deploy:

There are currently 2 servers you need to deploy to:
- dubnium.beeminder.com (this one has all the latest rails code, but only runs background workers)
- elion.beeminder.com (this is the live production server)

The process for deploy is the same for either one.

```
ssh beeminder@<server> 
cd /var/www/jsbrain
# before pulling in new changes, create a branch of current HEAD so we can 
# roll back easily if need be
git branch YYYYMMDD_HHMM
git pull
# maybe only need to npm install when packages change?
cd jsbrain_server
npm install 
# finally
pm2 reload jsbrain
```

And that's it. You can also check the logs to see if everything looks ok after doing this:

`pm2 logs jsbrain`


WARNING: this is just hot swapping the code that's getitng used for generating real user graphs.

### deploy script

This totally wants a deploy script, and I'm working on using capistrano (the same deploy tool we're already familiar with for deploying beeminder code to production environment) to set this up. That'll run code on the remote server over ssh as the beeminder user, but will also add in some nice conventions for keeping previous releases easily accessible should a quick rollback be necessary, that kind of thing, and will enable us to deploy jsbrain to all active servers with one button push.
