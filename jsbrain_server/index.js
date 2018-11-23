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
    +"URL?slug=filebase&inpath=/path/to/dir OR<br/>"
    +"URL?user=username&goal=goalname&inpath=/path/to/dir<br/>"
    +"<br/>You can also supply a path for output files with the \"outpath\" parameter<br/>"
  var noinpath = "Bad URL parameters: Missing \"inpath\"<br/><br/>"+usage
  var nofile = `Bad URL parameters: One of "slug" or ("user","goal") must be supplied!<br/><br/>`+usage
  var paramconflict = 'Bad URL parameters: "slug\" and ("user\","goal") cannot be used together!<br/><br/>'+usage
  var unknown = "Unknown error!<br/><br/>"+usage
  
  // Render url.
  const proc_timeid = " Total processing"
  app.use(async (req, res, next) => {
    let { inpath, outpath, slug, user, goal } = req.query
    if (!inpath)                     return res.status(400).send(noinpath)
    if ((!slug && (!user || !goal))) return res.status(400).send(nofile)
    if ((slug && (user || goal)))    return res.status(400).send(paramconflict)

    if (!outpath) outpath = inpath
    if (!slug) slug = user+"+"+goal
    
    console.log("============================================")
    console.log(prefix+`Request url=${req.url}`)

    process.stdout.write("<BEEBRAIN> ")
    process.umask(0)

    try {
      console.time(proc_timeid)
      const resp = await renderer.render(inpath, outpath, slug)

      var json = {};
      json.inpath = inpath
      json.outpath = inpath
      json.slug = slug
      if (resp.html == null) {
        json.error = 'Processing error: '+resp.error
      } else {
        json.bb = (resp.html)?`${inpath}/${slug}.bb`:null
        json.svg = (resp.svg)?`${outpath}/${slug}.svg`:null
        json.png = (resp.png)?`${outpath}/${slug}.png`:null
        json.json = (resp.png)?`${outpath}/${slug}.json`:null
        json.error = null
      }

      console.timeEnd(proc_timeid)
      process.stdout.write("</BEEBRAIN>\n")
      return res.status(200).send(JSON.stringify(json))
    } catch (e) {
      next(e)
    }

    return res.status(400).send(noinpath)
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
