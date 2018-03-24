'use strict'

const cluster = require('cluster')

if (cluster.isMaster) {

  // Count the machine's CPUs
  var cpuCount = require('os').cpus().length;

  cpuCount = 1; // ULUC: Override for now

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
    let { bbfile } = req.query
    console.log(prefix+"Request reached thread");

    if (!bbfile) return res.status(400)
      .send('Supply bbfile with ?bbfile=http://yourdomain')

    var url = `file://${__dirname}/generate.html?bb=${bbfile}`
    var slug = url.replace(/^.*[\\\/]/, '').replace(/\.[^/.]+$/, '')
    console.log(prefix+`Loading ${url}`);

    try {
      const resp = await renderer.render(url)
      // res
      //   .set({
      //     'Content-Type': 'image/svg+xml',
      //     'Content-Length': resp.svg.length,
      //     'Content-Disposition': contentDisposition(slug + '.svg')
      // })
      //   .send(resp.svg)
      res.status(200).send("Rendered "+slug)
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
      
    app.listen(port, () => {
      console.info(prefix+`Listen port on ${port}.`)
    })
  }).catch(e => {
    console.error('Fail to initialze renderer.', e)
  })
}

// Terminate process
process.on('SIGINT', () => {
  process.exit(0)
})
