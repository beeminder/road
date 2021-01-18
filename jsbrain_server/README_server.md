
# node.js server for processing bb files

This directory implements a node.js web server based on express and
puppeteer that runs a headless chromium instance and, upon request,
reads, processes and renders a beebrain BB file followed by the
generation of associated SVG and PNG graphs together with a JSON
output with goal parameters.

## Getting started

You may want to use jsbrain through Docker, or install it locally.

### Docker

#### Caution!

The Dockerfile has *not* been setup for serving in production, and should not be used to do so unless you've audited it yourself!  If you are new to Docker, I suggest spending some time learning about it--but if you can't:

* don't store data you care about inside a container and assume it will be there later
* don't run Docker stuff on computers that have sensitive information without knowing what you're doing

You can, of course, do what you want, but I feel bad when people get burned.

#### Getting Started and Usage

If you are going to run jsbrain for testing, there is a Dockerfile in docker/.

To get it running, first install Docker on your computer.

Then, go to the root of this repository, and run `docker build --tag jsbrain_server --file jsbrain_server/docker/Dockerfile .`.  This takes all the files in the repository and gives them to the Dockerfile, which is a set of instructions for setting up a Docker image.  It then runs through those instructions, using an aggressive cache, and creates an image.  Beyond its automatic hashy name, we add an extra tag of "jsbrain_server".

Next, we'll run the server with `docker run --publish 127.0.0.1:8777:8777 jsbrain_server`.  It takes the jsbrain_server image, creates a new container from it, ties the port 8777 on the container to our port 8777 (only for localhost!) and starts the container.  This is now running the code that was in the repository at the time the image was created, on our port 8777.

You can stop it with `docker ps` to find the container ID corresponding to this container, and then `docker stop <container ID>`.

The code is pulled into the image when that Dockerfile is processed in the build step, so if you change the code, you'll need to rebuild the image. (Improving this would be awesome!)

### Setup

To run jsbrain_server locally, for instance, for a Beeminder development environment, install node, and, here in the jsbrain_server directory, run

`npm update`

### Running the server

Now that your dependencies are installed, you can run the server instance with

`npm start`

which will fire up a node.js server on localhost:8777. You can then request processing for a BB file with a GET request issued to this server with the following parameters

  * `inpath=/path/to/input` : Path to local directory for the BB file
  * `outpath=/path/to/output`: Path to local directory for generated files
  * `user=u`: beeminder username (`slug` param must be empty)
  * `goal=g`: beeminder goalname (`slug` param must be empty)
  * `slug=filebase`: base name for the BB files (`user` and `goal` params must be empty)
  
This reads the file `u+g.bb` (or `slug.bb`) from `/path/to/input`, and
generates `u+g.png`, `u+g-thumb.png`, `u+g.svg` and `u+g.json` in
`/path/to/output`. 

By default, the server only listens to localhost--and that's probably what you want.  If you need to bind to other IPs, use the environment variable JSBRAIN_SERVER_BIND.

### Testing the server

To make sure everything is running, start the server, and then make a request using one of the test files in the automon directory.
From this `jsbrain_server` directory:

`curl "localhost:8777?slug=testroad1&inpath=`pwd`/../automon/data"`

This tells the running server to process testroad1.bb in the `data/` directory next to the `jsbrain_server` directory.
You shouldn't see an error, but instead should get a response of something like:

{ "inpath":"/path/to/road/jsbrain_server/../automon/data",
  "outpath":"/path/to/road/jsbrain_server/../data",
  "slug":"testroad1",
  "host":"my-laptop",
  "process":1,"request":2,
  "log":"testroad1 @ 2019-07-15 15:20:19\n(1:2)  Page creation (testroad1): 1965.953ms\n(1:2)  PAGE LOG: bgraph(1): Goal stats (test/test1): 20.510986328125ms\n(1:2)  PAGE LOG: bgraph(1): Goal graph (test/test1): 153.082275390625ms\n(1:2)  Page render (testroad1): 316.587ms\n(1:2)  Screenshot (testroad1): 867.273ms\n",
  "bb":"/path/to/road/jsbrain_server/../automon/data/testroad1.bb",
  "svg":"/path/to/road/jsbrain_server/../automon/data/testroad1.svg",
  "png":"/path/to/road/jsbrain_server/../automon/data/testroad1.png",
  "json":"/path/to/road/jsbrain_server/../automon/data/testroad1.json",
  "error":null }

## Principles of operation

The following sequence of events occur upon receiving a request of the form described above:

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
