'use strict'

const express = require('express')
const { URL } = require('url')
const createRenderer = require('./renderer')

const port = process.env.PORT || 3000

const app = express()

let renderer = null

// Configure.
app.disable('x-powered-by')

// Render url.
app.use(async (req, res, next) => {
  let { bbfile, type, ...options } = req.query

  if (!bbfile) {
    return res.status(400).send('Search with url parameter. For eaxample, ?url=http://yourdomain')
  }

  var url = "file://"+__dirname+"/generate.html?bb="+bbfile
  console.log(url);
  try {
    const html = await renderer.render(url, options)
    res.status(200).send("Rendered "+bbfile)
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
createRenderer()
  .then(createdRenderer => {
    renderer = createdRenderer
    console.info('Initialized renderer.')

    app.listen(port, () => {
      console.info(`Listen port on ${port}.`)
    })
  })
  .catch(e => {
    console.error('Fail to initialze renderer.', e)
  })

// Terminate process
process.on('SIGINT', () => {
  process.exit(0)
})
