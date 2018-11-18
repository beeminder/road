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

  var usage =
      "Usage:<br/>"
    +"URL?base=filebase&inpath=/path/to/file OR<br/>"
    +"URL?user=username&slug=goalslug&inpath=/path/to/file OR<br/>"
    +"URL?user=username&slug=goalslug&inpath=/path/to/file OR<br/>"
    +"<br/>You can also supply a path for output files with the \"outpath\" parameter<br/>"
  var noinpath = "Bad URL parameters: Missing \"inpath\"<br/><br/>"+usage
  var nofile = `Bad URL parameters: One of "base" or ("user","slug") must be supplied!<br/><br/>`+usage
  var paramconflict = 'Bad URL parameters: "base\" and ("user\","slug") cannot be used together!<br/><br/>'+usage
  
  // Render url.
  app.use(async (req, res, next) => {
    let { inpath, outpath, base, user, slug } = req.query
    if (!inpath) return res.status(400).send(noinpath)
    if ((!base && (!user || !slug)))
      return res.status(400).send(nofile)
    if ((base && (user || slug)))
      return res.status(400).send(paramconflict)

    if (!outpath) outpath = inpath
    if (!base) base = user+"+"+slug
    
    console.log(prefix+`Request url=${req.url}`);
    console.log(prefix+`Loading "${base}" from "${inpath}"`);

    try {
      const resp = await renderer.render(inpath, outpath, base)
      // res
      //   .set({
      //     'Content-Type': 'image/svg+xml',
      //     'Content-Length': resp.svg.length,
      //     'Content-Disposition': contentDisposition(slug + '.svg')
      // })
      //   .send(resp.svg)
      var json = {};
      json.inpath = inpath
      json.outpath = inpath
      json.base = base
      if (resp.html == null) {
        json.error = 'Processing error: '+resp.error
      } else {
        json.bb = (resp.html)?`${outpath}/${base}.bb`:null
        json.svg = (resp.svg)?`${outpath}/${base}.svg`:null
        json.png = (resp.png)?`${outpath}/${base}.png`:null
        json.json = (resp.png)?`${outpath}/${base}.json`:null
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
