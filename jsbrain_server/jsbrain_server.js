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
  console.log(`🎯 Master process ${process.pid} starting up...`);

  // Count the machine's CPUs
  let cpuCount = os.cpus().length;
  console.log(`💻 Detected ${cpuCount} CPU cores`);

  // Number of "parallel" renderer instances. Actual parallelism is
  // because chromium instances run as processes.
  cpuCount = 1;
  console.log(`⚙️ Configured to use ${cpuCount} worker(s)`);

  // Create a worker for each CPU
  for (let i = 0; i < cpuCount; i += 1) {
    console.log(`🚀 Forking worker ${i + 1}/${cpuCount}...`);
    cluster.fork();
  }

  // Log when workers come online
  cluster.on('online', (worker) => {
    console.log(`✅ Worker ${worker.id} (PID ${worker.process.pid}) is online`);
  });

  // Whenever a worker dies, create a new one.
  cluster.on('exit', (worker, code, signal) => {
    console.log(`💀 Worker ${worker.id} (PID ${worker.process.pid}) died with code ${code} and signal ${signal}`);
    console.log(`🔄 Restarting worker ${worker.id}...`);
    cluster.fork();
  });
  
  console.log(`🎉 Master process initialization complete. Managing ${cpuCount} worker(s).`);

} else {

  let reqcnt = 0  // Keep track of request id for each worker thread
  let pending = 0 // Number of goals currently being processed
  let msgbuf = {} // Local buffer for message outputs 
  
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
    pending++
    msgbuf[rid] = ""
    console.log(tag+"============================================")
    console.log(tag+`🌐 Incoming request: ${req.method} ${req.url}`)
    console.log(tag+`📊 Server stats - Pending requests: ${pending}, Worker ID: ${cluster.worker.id}`)
    if (renderer && renderer.logPageStatus) {
      renderer.logPageStatus(`Request-${rid}-start`)
    }

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
          }
        }
      }

      msgbuf[rid] += renderer.timeEndMsg(timeid)
      pending--;
      
      console.log(tag+`✅ Request completed successfully. Files generated: ${Object.keys(json).filter(k => k.endsWith('svg') || k.endsWith('png') || k.endsWith('json')).length}`)
      if (renderer && renderer.logPageStatus) {
        renderer.logPageStatus(`Request-${rid}-success`)
      }
      
      msgbuf[rid] += (tag+"</BEEBRAIN> (pending: "+pending+")\n")

      process.stdout.write(msgbuf[rid])
      delete msgbuf[rid]

      return res.status(200).send(JSON.stringify(json))
    } catch (e) {
      console.error(tag+`💥 Request failed with error: ${e.message}`)
      console.error(tag+`🔍 Error stack:`, e.stack)
      pending--;
      if (renderer && renderer.logPageStatus) {
        renderer.logPageStatus(`Request-${rid}-error`)
      }
      // Make sure we only send one response
      if (!res.headersSent)
        return res.status(500).send(JSON.stringify({error: e.message}))
    }
    // Is the following unreachable?
    return res.status(400).send(noinpath)
  })

  // Error page.
  app.use((err, req, res, next) => {
    console.error(err)
    res.status(500).send('{"error": "Beebrain 500 error"}')
  })

  // Create renderer and start server.
  console.log(prefix+`🚀 Starting worker ${cluster.worker.id} with ${pproduct} browser...`)
  const workerStartTime = Date.now()
  
  createRenderer(cluster.worker.id, pproduct).then(createdRenderer => {
    renderer = createdRenderer
    const initTime = Date.now() - workerStartTime
    console.info(prefix+`✅ Initialized renderer in ${initTime}ms`)
    const bindip = process.env.JSBRAIN_SERVER_BIND || 'localhost'
      
    app.listen(port, bindip, () => {
      const totalStartTime = Date.now() - workerStartTime
      console.info(prefix+`🌐 Server ready! Listening on ${bindip}:${port} (total startup: ${totalStartTime}ms)`)
      console.info(prefix+`📊 Worker stats - PID: ${process.pid}, Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`)
    })
  }).catch(e => {
    const failTime = Date.now() - workerStartTime
    console.error(prefix+`💀 Failed to initialize renderer after ${failTime}ms:`, e.message)
    console.error(prefix+`🔍 Error details:`, e)
    // Exit with error code to ensure process manager restarts the service
    process.exit(1)
  })

  // Add process error handlers
  process.on('uncaughtException', (err) => {
    console.error(prefix+`💀 UNCAUGHT EXCEPTION - Worker ${cluster.worker.id} crashing:`);
    console.error(prefix+`🔍 Error:`, err.message);
    console.error(prefix+`📋 Stack:`, err.stack);
    console.error(prefix+`📊 Memory usage:`, process.memoryUsage());
    if (renderer && renderer.logPageStatus) {
      renderer.logPageStatus('UNCAUGHT-EXCEPTION');
    }
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error(prefix+`💀 UNHANDLED REJECTION - Worker ${cluster.worker.id}:`);
    console.error(prefix+`🔍 Promise:`, promise);
    console.error(prefix+`📋 Reason:`, reason);
    console.error(prefix+`📊 Memory usage:`, process.memoryUsage());
    if (renderer && renderer.logPageStatus) {
      renderer.logPageStatus('UNHANDLED-REJECTION');
    }
    process.exit(1);
  });
}

// Terminate process
process.on('SIGINT', async () => {
  console.log(prefix+`🛑 Received SIGINT, starting graceful shutdown...`)
  if (renderer) {
    try {
      console.log(prefix+`🧹 Cleaning up renderer pages...`)
      const shutdownStart = Date.now()
      await renderer.closeAllPages()
      const shutdownTime = Date.now() - shutdownStart
      console.log(prefix+`✅ Cleanup completed in ${shutdownTime}ms`)
    } catch (error) {
      console.warn(prefix+`⚠️ Error during cleanup:`, error.message)
    }
  }
  console.log(prefix+`👋 Worker ${cluster.worker.id} shutting down gracefully`)
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log(prefix+`🛑 Received SIGTERM, starting graceful shutdown...`)
  if (renderer) {
    try {
      console.log(prefix+`🧹 Cleaning up renderer pages...`)
      const shutdownStart = Date.now()
      await renderer.closeAllPages()
      const shutdownTime = Date.now() - shutdownStart
      console.log(prefix+`✅ Cleanup completed in ${shutdownTime}ms`)
    } catch (error) {
      console.warn(prefix+`⚠️ Error during cleanup:`, error.message)
    }
  }
  console.log(prefix+`👋 Worker ${cluster.worker.id} shutting down gracefully`)
  process.exit(0)
})
