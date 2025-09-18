'use strict'

const cluster = require('cluster')
const os = require('os')
const yargs = require('yargs')
const { hideBin } = require('yargs/helpers')
const bu = require('../src/butil.js')

function compareJSON(stats, bbr) {
  let valid = true, numeric = false, summary = false, str = ""
  if (stats['error'] != "") {
    str += "Processing error: "+stats['error']+"<br/>\n"
    return {valid: false, numeric: false, summary: false, result: str}
  }
  for (let prop in bbr) {
    if (prop == "proctm" || prop == "thumburl" || prop == "graphurl") continue
    if (!stats.hasOwnProperty(prop)) {
      str += "Prp "+prop+" is missing from the output\n"
      valid = false
    } else {
      if (Array.isArray(stats[prop])) {
        if (!(bu.arrayEquals(stats[prop],bbr[prop]))) {
          str += "Arr "+prop+" differs:\n py:"
            +bbr[prop]+ "\n js:"+stats[prop]+"\n"
          valid = false
        }
      } else if (!(stats[prop] === bbr[prop])) {
        if (bu.nummy(stats[prop]) && bu.nummy(bbr[prop])) {
          str += "Numeric value "+prop+" differs:\n py:"
            +bbr[prop]+ "\n js:"+stats[prop]+"\n"
          numeric = true
          if (Math.abs(bbr[prop]-stats[prop]) > 1e-8)
            valid = false
        } else if (prop.endsWith("sum")) {
          str += "Summary string "+prop+" differs:\n py:"
            +bbr[prop]+ "\n js:"+stats[prop]+"\n"
          summary = true
        } else if ((typeof stats[prop] == 'string') || typeof (bbr[prop] == 'string')) {
          str += "String "+prop+" differs:\n py:"+bbr[prop]+ "\n js:"+stats[prop]+"\n"
          valid = false
        } else
          valid = false
        
      }
    }
  }
  return {valid: valid, numeric: numeric, summary: summary, result: str}
}

if (cluster.isMaster) {

  // Count the machine's CPUs
  let cpuCount = os.cpus().length;

  // Number of "parallel" renderer instances. Actual parallelism is
  // because chromium instances run as processes.
  cpuCount = 1;

  // Create a worker for each CPU
  for (let i = 0; i < cpuCount; i += 1)
    cluster.fork();

  // Whenever a worker dies, create a new one.
  cluster.on('exit', (worker, code, signal) => {
    console.log('Renderer worker %d died (%s). restarting...',
      worker.process.pid, signal || code);
    cluster.fork();
  });

} else {

  let reqcnt = 0  // Keep track of request id for each worker thread
  let pending = 0 // Number of goals currently being processed
  let msgbuf = {} // Local buffer for message outputs 
  let activerequests = new Map() // Track active requests for cleanup
  
  const port = process.env.PORT || 3000

  const fs = require('fs')
  const sleep = require('sleep-promise') // change 'sleep' to 'sleep-promise'
  const express = require('express')
  const contentDisposition = require('content-disposition')
  const createRenderer = require('./renderer')

  const prefix = "("+cluster.worker.id+"): "
  let renderer = null

  const app = express()
  app.disable('x-powered-by')

  const usage =
      "Usage:<br/>"
    +"URL?slug=filebase&inpath=/path/to/dir OR<br/>"
    +"URL?user=username&goal=goalname&inpath=/path/to/dir<br/>"
    +"<br/>You can also supply a path for output files with the \"outpath\" parameter<br/>"
    +"An optional check against the pybrain output can be initiated with the \"pyjson\" parameter<br/>"
    +"Graph generation may be disabled with the \"nograph=1\" parameter<br/>"
    +"SVG optimization can be turned on with the  \"svgo=1\" parameter<br/>"
  const noinpath = "Bad URL parameters: Missing \"inpath\"<br/><br/>"+usage
  const nofile = `Bad URL parameters: One of "slug" or ("user","goal") must be supplied!<br/><br/>`+usage
  const paramconflict = 'Bad URL parameters: "slug\" and ("user\","goal") cannot be used together!<br/><br/>'+usage
  const unknown = "Unknown error!<br/><br/>"+usage
  const pong = "pong"
  
  // Render url.
  const proc_timeid = " Total processing"

  const argv = yargs(hideBin(process.argv))
        .option('firefox', {
          alias: 'f',
          description: 'use headless firefox',
          type: 'boolean'
        })
        .help()
        .alias('help', 'h')
        .argv
  
  let pproduct = "chrome"
  if (argv.firefox) {
    console.log("Starting puppeteer with headless FIREFOX.")
    pproduct = "firefox"
  } else {
    console.log("Starting puppeteer with headless CHROME.")
    pproduct = "chrome"
  }
  
  app.use(async (req, res, next) => {
    let hostname = os.hostname()
    let { ping, inpath, outpath, slug, user, goal, pyjson, nograph, svgo } = req.query
    if (ping)                        return res.status(200).send(pong)
    if (!inpath)                     return res.status(400).send(noinpath)
    if ((!slug && (!user || !goal))) return res.status(400).send(nofile)
    if ((slug && (user || goal)))    return res.status(400).send(paramconflict)
    
    var rid = reqcnt++ // Increment and store unique request id
    if (nograph == undefined || nograph == "false" || nograph == "0")
      nograph = false
    else nograph = true
    if (svgo == "1") svgo = 1      // Generate optimized SVG only
    else if (svgo == "2") svgo = 2 // generate optimized SVG and its PNG as well
    else svgo = 0

    if (!outpath) outpath = inpath
    if (!slug) slug = user+"+"+goal
    
    var tag = renderer.prf(rid)
    
    // Initialize request state
    pending++
    msgbuf[rid] = ""
    activerequests.set(rid, { slug, startTime: Date.now() })
    
    // Set up cleanup function
    const cleanup = () => {
      if (activerequests.has(rid)) {
        pending = Math.max(0, pending - 1)
        delete msgbuf[rid]
        activerequests.delete(rid)
      }
    }
    
    // Handle client disconnect
    const onClientDisconnect = () => {
      console.log(`${tag}Client disconnected for request ${rid} (${slug})`)
      cleanup()
      // Cancel the render if possible
      if (renderer && renderer.cancelRender) {
        renderer.cancelRender(rid)
      }
    }
    
    res.on('close', onClientDisconnect)
    res.on('finish', () => {
      // Normal completion - cleanup will happen in finally
    })
    
    console.log(tag+"============================================")
    console.log(tag+`Request url=${req.url}`)

    msgbuf[rid] += (tag+"<BEEBRAIN> ")
    process.umask(0)

    try {
      var timeid = tag+proc_timeid+` (${slug})`
      console.time(timeid)
      const resp
            = await renderer.render(inpath, outpath, slug, rid, nograph, svgo)
      msgbuf[rid] += resp.msgbuf
      
      var json = {};
      json.inpath = inpath
      json.outpath = outpath
      json.slug = slug
      json.host = hostname
      json.process = cluster.worker.id
      json.request = rid
      json.log = resp.msgbuf
      if (resp.html == null) {
        json.error = 'Processing error: '+resp.error
      } else {
        json.bb = (resp.html)?`${inpath}/${slug}.bb`:null
        json.svg = (resp.svg)?`${outpath}/${slug}.svg`:null
        json.png = (resp.png)?`${outpath}/${slug}.png`:null
        json.json = (resp.json)?`${outpath}/${slug}.json`:null
        json.error = null
        // Compare JSON to pybrain output if enabled
        if (pyjson) {
          msgbuf[rid] += (`${tag} Comparing to pybrain: `)
          if (!fs.existsSync(pyjson) || !fs.lstatSync(pyjson).isFile()) {
            msgbuf[rid] += (`${tag} Could not find file ${pyjson}\n`)
          } else {
            try {
              let pyout = fs.readFileSync(pyjson, "utf8");
              let res = compareJSON(resp.json, JSON.parse(pyout))
              if (res.valid && !res.numeric && !res.summary) {
                msgbuf[rid] += (`--** Success: Exact match!\n`)
              } else {
                if (res.valid) {
                  msgbuf[rid] += ("--** Error: Minor issues\n")
                } else {
                  msgbuf[rid] += ("--** Error: CRITICAL!\n")
                }
                msgbuf[rid] += (tag+`   ${res.result.replace(/\n/g, "\n"+tag+"   ")}`)
                msgbuf[rid] += ("------------------\n")
              }
            } catch (pyJsonError) {
              msgbuf[rid] += (`${tag} Error reading/parsing pyjson: ${pyJsonError.message}\n`)
            }
          }
        }
      }

      msgbuf[rid] += renderer.timeEndMsg(timeid)
      msgbuf[rid] += (tag+"</BEEBRAIN> (pending: "+pending+")\n")

      // Only send response if headers haven't been sent
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json')
        return res.status(200).send(JSON.stringify(json))
      }
    } catch (e) {
      // Enhanced error logging with context
      const errorContext = {
        rid,
        slug,
        workerId: cluster.worker.id,
        timestamp: new Date().toISOString(),
        error: e.message,
        stack: e.stack
      }
      console.error(`${tag}Render error:`, errorContext)
      
      if (msgbuf[rid]) {
        msgbuf[rid] += (`${tag} ERROR: ${e.message}\n`)
      }
      
      // Make sure we only send one response
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json')
        return res.status(500).send(JSON.stringify({
          error: e.message,
          rid: rid,
          slug: slug,
          timestamp: new Date().toISOString()
        }))
      }
    } finally {
      // Always cleanup, regardless of success or failure
      if (msgbuf[rid]) {
        process.stdout.write(msgbuf[rid])
      }
      cleanup()
    }
  })

  // Error page.
  app.use((err, req, res, next) => {
    const errorId = Date.now().toString(36)
    console.error(`Global error handler [${errorId}]:`, {
      error: err.message,
      stack: err.stack,
      workerId: cluster.worker.id,
      url: req.url,
      method: req.method
    })
    
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json')
      res.status(500).send(JSON.stringify({
        error: "Beebrain 500 error",
        errorId: errorId,
        timestamp: new Date().toISOString()
      }))
    }
  })

  // Create renderer and start server.
  createRenderer(cluster.worker.id, pproduct).then(createdRenderer => {
    renderer = createdRenderer
    console.info(prefix+'Initialized renderer.')
    const bindip = process.env.JSBRAIN_SERVER_BIND || 'localhost'
      
    const server = app.listen(port, bindip, () => {
      console.info(prefix+`Listening on ${bindip}:${port}`)
    })
    
    // Configure server timeouts
    server.keepAliveTimeout = 65000 // Slightly higher than typical load balancer timeout
    server.headersTimeout = 66000   // Should be higher than keepAliveTimeout
    server.requestTimeout = 120000  // 2 minutes max for any request
  }).catch(e => {
    console.error('Failed to initialize renderer:', e)
    // Exit with error code to ensure process manager restarts the service
    process.exit(1)
  })

  // Enhanced process error handlers with context
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception in worker', cluster.worker.id, ':', {
      error: err.message,
      stack: err.stack,
      activeRequests: activerequests.size,
      pending: pending,
      timestamp: new Date().toISOString()
    });
    
    // Give a small window for cleanup
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection in worker', cluster.worker.id, ':', {
      reason: reason,
      promise: promise,
      activeRequests: activerequests.size,
      pending: pending,
      timestamp: new Date().toISOString()
    });
    
    // Give a small window for cleanup
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
}

// Terminate process
process.on('SIGINT', () => {
  process.exit(0)
})
