'use strict'

const cluster = require('cluster')

if (cluster.isMaster) {

  // Count the machine's CPUs
  var cpuCount = require('os').cpus().length;

  // ULUC: Override for now, chrome instances are parallel anyway
  cpuCount = 1;

  // Create a worker for each CPU
  for (var i = 0; i < cpuCount; i += 1)
    cluster.fork();

} else {

  const port = process.env.PORT || 3000

  const fs = require('fs')
  const sleep = require('sleep')
  const express = require('express')
  const contentDisposition = require('content-disposition')
  const createRenderer = require('./renderer')

  const prefix = "("+cluster.worker.id+"): "
  let renderer = null

  const app = express()
  app.disable('x-powered-by')

  // Render url.
  app.use(async (req, res, next) => {
    let { path, base } = req.query
    if (!base || !path) return res.status(400)
      .send('Supply details with ?base=nonce&path=/path/to/file')

    console.log(prefix+`Request url=${req.url}`);
    console.log(prefix+`Loading "${base}" from "${path}"`);

    try {
      const resp = await renderer.render(path, base)
      // res
      //   .set({
      //     'Content-Type': 'image/svg+xml',
      //     'Content-Length': resp.svg.length,
      //     'Content-Disposition': contentDisposition(slug + '.svg')
      // })
      //   .send(resp.svg)
      var json = {};
      json.path = path
      json.base = base
      if (resp.html == null) {
        json.error = 'Could not process goal'
      } else {
        json.bb = (resp.html)?`${base}.bb`:null
        json.svg = (resp.svg)?`${base}.svg`:null
        json.png = (resp.png)?`${base}.png`:null
        json.error = null
      }

      res.status(200).send(JSON.stringify(json))
    } catch (e) {
      next(e)
    }
  })

  // Error page.
  app.use((err, req, res, next) => {
    console.error(err)
    res.status(500).send('Oops, An expected error seems to have occurred.')
  })

  // Create renderer and start server.
  createRenderer(cluster.worker.id).then(createdRenderer => {
    renderer = createdRenderer
    console.info(prefix+'Initialized renderer.')
      
    app.listen(port, 'localhost', () => {
      console.info(prefix+`Listen port on localhost ${port}.`)
    })
  }).catch(e => {
    console.error('Fail to initialze renderer.', e)
  })
}

// Terminate process
process.on('SIGINT', () => {
  process.exit(0)
})
