'use strict'

// Dynamic import for uuid (ESM module)
let uuidv4
const fs = require('fs')
const gm = require('gm').subClass({imageMagick: true})

const pageTimeout = 40 // Seconds to wait until giving up on generate.html
const maxConcurrentRenders = 2 // Limit concurrent renders per worker
const pageCreationTimeout = 10000 // 10 seconds timeout for newPage()
const maxConsecutiveFailures = 3 // Restart browser after this many failures

class Renderer {
  
  constructor(browser, id) {
    this.browser = browser
    this.id = id
    this.pages = []
    this.activeSemaphore = 0
    this.cancelledRequests = new Set()
    this.maxPages = 5 // Reduced to prevent resource exhaustion
    this.pageCreationMutex = false // Serialize page creation
    this.pageCreationQueue = []
    this.consecutiveFailures = 0
    this.browserRestartPromise = null
  }

  // Cancel a specific render request
  cancelRender(rid) {
    this.cancelledRequests.add(rid)
    console.log(`(${this.id}:${rid}) Render cancelled`)
  }

  // Check if a request was cancelled
  isCancelled(rid) {
    return this.cancelledRequests.has(rid)
  }

  // Create page with timeout protection
  async createPageWithTimeout(timeoutMs = pageCreationTimeout) {
    const pagePromise = this.browser.newPage()
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Page creation timeout')), timeoutMs)
    )
    return Promise.race([pagePromise, timeoutPromise])
  }

  // Serialize page creation to prevent resource storms
  async createPageSerialized() {
    return new Promise(async (resolve, reject) => {
      // Add to queue if creation is in progress
      if (this.pageCreationMutex) {
        this.pageCreationQueue.push({ resolve, reject })
        return
      }

      this.pageCreationMutex = true
      
      try {
        // Exponential backoff on consecutive failures
        if (this.consecutiveFailures > 0) {
          const delay = Math.min(1000 * Math.pow(2, this.consecutiveFailures - 1), 5000)
          await new Promise(r => setTimeout(r, delay))
        }

        const page = await this.createPageWithTimeout()
        
        // Set explicit timeouts
        await page.setDefaultNavigationTimeout(pageTimeout * 1000)
        await page.setDefaultTimeout(pageTimeout * 1000)
        
        this.consecutiveFailures = 0
        resolve(page)
      } catch (error) {
        this.consecutiveFailures++
        console.error(`Page creation failed (attempt ${this.consecutiveFailures}):`, error.message)
        
        // Consider browser restart after multiple failures
        if (this.consecutiveFailures >= maxConsecutiveFailures) {
          console.error(`Too many consecutive failures (${this.consecutiveFailures}), browser may need restart`)
        }
        
        reject(error)
      } finally {
        this.pageCreationMutex = false
        
        // Process next item in queue
        if (this.pageCreationQueue.length > 0) {
          const next = this.pageCreationQueue.shift()
          setImmediate(() => {
            this.createPageSerialized().then(next.resolve).catch(next.reject)
          })
        }
      }
    })
  }

  // Centralized listener management
  attachPageListeners(page, msglog, errlog) {
    const listeners = { msglog, errlog }
    page.on('console', msglog)
    page.on('error', errlog)
    page.on('pageerror', errlog)
    page.on('requestfailed', (request) => {
      console.error(`Request failed: ${request.url()} ${request.failure().errorText}`)
    })
    return listeners
  }

  detachPageListeners(page, listeners) {
    try {
      page.off('console', listeners.msglog)
      page.off('error', listeners.errlog)
      page.off('pageerror', listeners.errlog)
    } catch (e) {
      console.log(`Warning: Could not remove page listeners: ${e.message}`)
    }
  }

  // This method overrides stdout and captures the output of
  // console.timeEnd in a string for later printing. Quite hacky but
  // works
  timeEndMsg( tagtxt ) {
    const real_stdout    = process.stdout.write
    let captured = ""
    function process_output(output) { captured += output }
    
    process.stdout.write = process_output
    try {
      console.timeEnd( tagtxt )
    } catch (e) {
      captured += `Error in timeEnd: ${e.message}`
    }
    process.stdout.write = real_stdout
    return captured
  }
  
  prfinfo(r) { return [this.id,r] }
  prf(r) { return "("+this.id+":"+r+") " }
  
  // Renders and returns an available page (tab) within the puppeteer
  // chrome instance. Creates one if all existing ones are found to be
  // busy
  async renderPage( url, tag, msglog, errlog, rid ) {
    let gotoOptions = { timeout: pageTimeout * 1000, waitUntil: 'load' }

    try {
      var pageinfo = null, page = null;
      // Grab one of the unused tabs, create a new one if necessary
      var numpages = this.pages.length
      for (var i = 0; i < numpages; i++) {
        if (!this.pages[i].busy) {
            pageinfo = this.pages[i]
            pageinfo.busy = true
            // Check if page was closed by timeout, recreate if necessary
            if (!pageinfo.page || pageinfo.page.isClosed()) {
              console.log(tag+"renderer.js: Reinstantiating page in slot "+i)
              try {
                pageinfo.page = await this.createPageSerialized()
              } catch (e) {
                console.error(tag+"Failed to create new page:", e)
                pageinfo.busy = false
                return null
              }
            }
          page = pageinfo.page
          if (pageinfo.timeout) {
            clearTimeout(pageinfo.timeout)
            pageinfo.timeout = null
          }
          break
        }
      }
      if (!pageinfo && numpages < this.maxPages) {
        // If all existing pages are found to be busy, create a new one (up to limit)
        console.log(tag+"renderer.js: Creating new page in slot "+numpages)
        try {
          page = await this.createPageSerialized()
          pageinfo = {page: page, busy: true, slot: numpages}
          this.pages.push( pageinfo )
        } catch (e) {
          console.error(tag+"Failed to create new page:", e)
          return null
        }
      } else if (!pageinfo) {
        // All pages busy and at max limit
        throw new Error(`All ${this.maxPages} pages are busy, cannot create more`)
      }

      // Check for cancellation before proceeding
      if (this.isCancelled(rid)) {
        pageinfo.busy = false
        throw new Error('Request cancelled')
      }

      // Install new loggers onto the page for this render instance. Will be
      // removed at the end of processing.
      var listeners = page.listenerCount('console')
      if (listeners != 0)
        console.log(tag+"renderer.js ERROR: Unremoved console listeners: "+listeners)
      
      const pageListeners = this.attachPageListeners(page, msglog, errlog)

      // Render the page and return result
      try {
        await page.goto(url, gotoOptions)
      } catch (error) {
        // Remove listeners to prevent accumulation of old listeners for reused pages
        this.detachPageListeners(page, pageListeners)
        console.error(tag+"Page navigation failed:", error.message)
        pageinfo.busy = false
        return null
      } 
      return pageinfo
    } catch (error) {
      console.error(tag+'Error in renderPage:', error.message);
      throw error;
    }
  }

  /** Returns the base URL for graph and thumbnail links */
  BBURL() { return "http://brain.beeminder.com/" }
  
  /** Takes a filename and return a parallel temp filename, ie, with
      the directory and file extension the same but with the base file
      name amended with a unique string based on a session ID. Eg,
      foo.x -> foo-tmp743829.x */
  tempify(f,id) { return f.replace(/^(.*)\.([^\.]*)$/,"$1-tmp"+id+".$2") }
  
  /** Renders the graph associated with the BB file with the supplied
      fbase name (i.e. user+slug), located in the supplied path in the puppeteer
      instance. Creates a new tab, renders the graph and json, outputs
      the graph in PNG and SVG forms as well as the JSON output and
      closes the tab afterwards */
  async render(inpath, outpath, slug, rid, nograph) {
    // Implement concurrency limiting with better error message
    if (this.activeSemaphore >= maxConcurrentRenders) {
      throw new Error(`Server at capacity: ${this.activeSemaphore}/${maxConcurrentRenders} concurrent renders active. Please retry in a few seconds.`)
    }
    
    this.activeSemaphore++
    
    try {
      return await this._doRender(inpath, outpath, slug, rid, nograph)
    } finally {
      this.activeSemaphore--
      this.cancelledRequests.delete(rid) // Clean up cancellation tracking
    }
  }
  
  async _doRender(inpath, outpath, slug, rid, nograph) {
    let page = null
    let pagelog = {msg:""}
    let pageinfo = null
    function msglog(msg) {
      pagelog.msg += (tag+" PAGE LOG: " + msg.text().replace(/\n/g, '\n'+tag)+"\n")}
    function errlog(error) {
      pagelog.msg += (tag+" PAGE ERROR: " + error.message.replace(/\n/g, '\n'+tag)+"\n")}
    
    let tag = this.prf(rid)
    let msgbuf = ""

    if (!fs.existsSync(outpath)) {
      let err = `Could not find directory ${outpath}`
      msgbuf += (tag+" renderer.js ERROR: "+err+"\n")
      return { error:err, msgbuf: msgbuf }
    }

    const bbfile = `${inpath}/${slug}.bb`
    if (!fs.existsSync(bbfile)) {
      //Try again!
      await new Promise(r => setTimeout(r, 250));
      if (!fs.existsSync(bbfile)) {  // was mistakenly "existSync" for years??
        let err = `Could not find file ${bbfile} after second try`
        msgbuf += (tag+" renderer.js ERROR: "+err+"\n")
        return { error: err, msgbuf: msgbuf}
      }
    }
    
    // Check for cancellation
    if (this.isCancelled(rid)) {
      return { error: 'Request cancelled', msgbuf: msgbuf }
    }
    
    const bburl = encodeURIComponent(inpath)+"/"+encodeURIComponent(slug)+".bb"

    const newid = uuidv4();
    const base = inpath // Pybrain compatibility
    const sluga = slug.replace(/^([^\+]*\+[^\+]*).*/, (a,b)=>b)
    
    msgbuf += (sluga+" @ ")
    let starttm = new Date()
    msgbuf += (starttm.toISOString().replace(/T/,' ').replace(/\..+/,'')+"\n")

    const imgf = `${outpath}/${slug}.png`
    const svgf = `${outpath}/${slug}.svg`
    const thmf = `${outpath}/${slug}-thumb.png`
    // generate the graph unless both nograph(slug) and nograph.png already exists
    //const graphit = !(this.nograph(slug) && fs.existsSync(imgf) && fs.existsSync(thmf))
    const graphit = !nograph
    if (graphit) {
      var imgftmp = this.tempify(imgf, newid)
      var svgftmp = this.tempify(svgf, newid)
      var thmftmp = this.tempify(thmf, newid)
      // Remove any existing graph and thumbnail files
      try {
        if (fs.existsSync(imgf)) fs.unlinkSync( imgf )
        if (fs.existsSync(svgf)) fs.unlinkSync( svgf )
        if (fs.existsSync(thmf)) fs.unlinkSync( thmf )
      } catch (e) {
        msgbuf += (tag+" Warning: Could not remove existing files: "+e.message+"\n")
      }
    }
    const url
          = `file://${__dirname}/generate.html?bb=file://${bburl}&NOGRAPH=${!graphit}`
    let html = null, svg = null, png = null, jsonstr, json
        
    try {

      // Load and render the page, extract html
      var time_id = tag+` Page creation (${slug})`
      console.time(time_id)
      pageinfo = await this.renderPage(url,tag, msglog, errlog, rid)
      if (pageinfo) page = pageinfo.page
      if (time_id != null) msgbuf += this.timeEndMsg(time_id)
      time_id = null

      if (page) {
        // Check for cancellation after page creation
        if (this.isCancelled(rid)) {
          return { error: 'Request cancelled', msgbuf: msgbuf }
        }

        time_id = tag+` Page render (${slug})`
        console.time(time_id)
        html = await page.content()
        try {
          await page.waitForFunction('done', {timeout: pageTimeout*1000})
          // Now that the page rendering is done, messages should have
          // finished logging. We can record them
          msgbuf += pagelog.msg
        } catch( err ) {
          msgbuf += pagelog.msg
          msgbuf += (tag+" renderer.js ERROR: "+err.message+"\n")
          if (time_id != null) msgbuf += this.timeEndMsg(time_id)
          time_id = null
          return { error: err.message, msgbuf: msgbuf }
        }
        if (time_id != null) msgbuf += this.timeEndMsg(time_id)
        time_id = null
      
        // Extract goal stats from the JSON field and extend with file locations
        const jsonHandle = await page.$('#goaljson');
        if (!jsonHandle) {
          let err = "Could not find #goaljson element on page!"
          msgbuf += (tag+" renderer.js ERROR: "+err+"\n")
          return { error:err, msgbuf: msgbuf }
        }
        
        jsonstr = await page.evaluate(json => json.innerHTML, jsonHandle);
        if (jsonstr == "" || jsonstr == null) {
          let err = "Could not extract JSON from page!"
          msgbuf += (tag+" renderer.js ERROR: "+err+"\n")
          return { error:err, msgbuf: msgbuf }
        }
        
        try {
          json = JSON.parse(jsonstr)
        } catch (parseError) {
          let err = `Could not parse JSON: ${parseError.message}. JSON start: ${jsonstr.substring(0, 200)}`
          msgbuf += (tag+" renderer.js ERROR: "+err+"\n")
          return { error:err, msgbuf: msgbuf }
        }
        
        json.graphurl=this.BBURL()+imgf
        json.svgurl=this.BBURL()+svgf
        json.thumburl=this.BBURL()+thmf

        // Write to the goal JSON, using an intermediate temp file
        let jf = `${outpath}/${slug}.json`
        let jtmp = this.tempify(jf, newid)
        try {
          if (fs.existsSync(jf)) fs.renameSync(jf, jtmp )
          fs.writeFileSync(jtmp, JSON.stringify(json));  
          if (fs.existsSync(jtmp)) fs.renameSync(jtmp, jf )
        } catch (fileError) {
          msgbuf += (tag+" renderer.js ERROR writing JSON: "+fileError.message+"\n")
          return { error: fileError.message, msgbuf: msgbuf }
        }
        
        if (graphit) {
          // Extract and write the SVG file
          const svgHandle = await page.$('svg')
          if (!svgHandle) {
            let err = "Could not find SVG element on page!"
            msgbuf += (tag+" renderer.js ERROR: "+err+"\n")
            return { error:err, msgbuf: msgbuf }
          }
          
          svg = await page.evaluate(svg => svg.outerHTML, svgHandle)
          svg = '<?xml version="1.0" standalone="no"?>\n'+svg
          
          // write to the temp SVG file and rename
          try {
            fs.writeFileSync(svgftmp, svg);  
            if (fs.existsSync(svgftmp)) fs.renameSync(svgftmp, svgf )
          } catch (svgError) {
            msgbuf += (tag+" renderer.js ERROR writing SVG: "+svgError.message+"\n")
            return { error: svgError.message, msgbuf: msgbuf }
          }

          // Extract the bounding box for the zoom area to generate
          // the thumbnail cropping boundaries
          var za = await page.$('.zoomarea')
          if (!za) {
            let err = "Could not find .zoomarea element on page!"
            msgbuf += (tag+" renderer.js ERROR: "+err+"\n")
            return { error:err, msgbuf: msgbuf }
          }
          
          var zi = await page.evaluate(()=>{
            var z = document.getElementsByClassName('zoomarea')[0]
            if (!z) return null
            var b = z.getBBox()
            return {x:Math.round(b.x+1), y:Math.round(b.y),
                    width:Math.round(b.width-2), height:Math.round(b.height)};})
          
          if (!zi) {
            let err = "Could not get zoom area bounding box!"
            msgbuf += (tag+" renderer.js ERROR: "+err+"\n")
            return { error:err, msgbuf: msgbuf }
          }
        
          // Take a screenshot to generate PNG files
          time_id = tag+` Screenshot (${slug})`
          console.time(time_id)

          // Extract SVG boundaries on page
          const rect = await page.evaluate(s => {
            const element = document.querySelector(s);
            if (!element) return null
            const {x, y, width, height} = element.getBoundingClientRect();
            return {left: x, top: y, width, height, id: element.id};
          }, "svg");  
          
          if (!rect) {
            let err = "Could not get SVG boundaries!"
            msgbuf += (tag+" renderer.js ERROR: "+err+"\n")
            return { error:err, msgbuf: msgbuf }
          }
          
          try {
            png = await page.screenshot({path:imgftmp, 
                                         clip:{x:rect.left, y:rect.top, 
                                               width:rect.width, height:rect.height}})
          } catch (screenshotError) {
            msgbuf += (tag+" renderer.js ERROR taking screenshot: "+screenshotError.message+"\n")
            return { error: screenshotError.message, msgbuf: msgbuf }
          }

          // Generate palette optimized thumbnail thru cropping with ImageMagick
          try {
            var res = await new Promise( (resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('ImageMagick thumbnail generation timeout'))
              }, 30000) // 30 second timeout
              
              gm(imgftmp)
                .in('-crop').in(zi.width+"x"+zi.height+"+"+zi.x+"+"+zi.y)
                .in('-resize').in('208x136!')
                .in('-bordercolor').in(json.color)
                .in('-border').in('2x2')
                .in('-filter').in('Box')
                .in('-remap').in('palette.png')
                .in('-colors').in('256')
                .in('+dither')
                .in('+repage')
                .write(thmftmp, (err) => {
                  clearTimeout(timeout)
                  if (err) reject(err)
                  else resolve(null)
                })
            })
            if (fs.existsSync(thmftmp)) fs.renameSync(thmftmp, thmf )
          } catch (thumbError) {
            msgbuf += (tag+" renderer.js ERROR generating thumbnail: "+thumbError.message+"\n")
            return { error: thumbError.message, msgbuf: msgbuf }
          }
          
          // Generate final graph PNG by palette remapping using ImageMagick
          try {
            res = await new Promise( (resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('ImageMagick PNG generation timeout'))
              }, 30000) // 30 second timeout
              
              gm(imgftmp)
                .in('-filter').in('Box')
                .in('-remap').in('palette.png')
                .in('-colors').in('256')
                .in('+dither')
                .write(imgftmp, (err) => {
                  clearTimeout(timeout)
                  if (err) reject(err)
                  else resolve(null)
                })
            })
          } catch (pngError) {
            msgbuf += (tag+" renderer.js ERROR generating final PNG: "+pngError.message+"\n")
            return { error: pngError.message, msgbuf: msgbuf }
          }
        }
        
        try {
          if (fs.existsSync(imgftmp)) fs.renameSync(imgftmp, imgf )
        } catch (renameError) {
          msgbuf += (tag+" renderer.js WARNING: Could not rename final image: "+renameError.message+"\n")
        }
        
        if (time_id != null) msgbuf += this.timeEndMsg(time_id)
        time_id = null

      } else {

        let err = "Could not create headless chrome page!"
        msgbuf += (tag+" renderer.js ERROR: "+err+"\n")

        // Clean up leftover timing
        if (time_id != null) msgbuf += this.timeEndMsg(time_id)
        time_id = null
        
        return { error:err, msgbuf: msgbuf }
      }
    } finally {
      if (page && pageinfo && pageListeners) {
        // Remove listeners using centralized method
        this.detachPageListeners(page, pageListeners)
        
        pageinfo.busy = false
        
        // Close page immediately if cancelled or on timeout
        if (this.isCancelled(rid)) {
          try {
            console.log(tag+"renderer.js: Closing cancelled page in slot "+pageinfo.slot)
            await page.close()
            pageinfo.page = null
          } catch (e) {
            console.log(tag+"Warning: Could not close cancelled page:", e.message)
            pageinfo.page = null
          }
        } else {
          // Set timeout for page cleanup (shorter timeout)
          pageinfo.timeout
            = setTimeout(
              async function(){
                if (pageinfo) {
                  if (pageinfo.page && !pageinfo.page.isClosed()) {
                    try {
                      console.log(tag+"renderer.js: Closing page after timeout in slot "
                                  +pageinfo.slot)
                      await Promise.race([
                        pageinfo.page.close(),
                        new Promise(resolve => setTimeout(resolve, 2000)) // Hard 2s timeout
                      ])
                    } catch (e) {
                      console.log(tag+"Warning: Could not close timed out page:", e.message)
                    }
                  }
                  pageinfo.page = null
                  pageinfo.timeout = null
                } else
                  console.log("Warning: pageinfo=null in timeout to close page")
              }, 3000) // Reduced from 5000 to 3000
        }
      }
    }
    return {html: html, png: png, svg: svg, json: json, error:null, msgbuf: msgbuf}
  }
}

async function create( id, pproduct ) {
  // Import uuid dynamically
  const { v4 } = await import('uuid')
  uuidv4 = v4
  
  let puppeteer = require('puppeteer');
  
  try {
    console.log(`Attempting to launch Puppeteer with product ${pproduct}...`);
    const browser = await puppeteer.launch({ 
      product: pproduct,
      args: [
        '--no-sandbox', 
        '--allow-file-access-from-files', 
        '--disable-web-security', 
        '--log-level=3',
        // GPU-related flags to fix Vulkan warnings (according to claude)
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      // Add headless mode explicitly
      headless: 'new',
      // Add more detailed logging
      dumpio: true
    });
    
    console.log(`Successfully started Puppeteer with pid ${browser.process().pid} and product ${pproduct}`);

    browser.on('disconnected', async () => { 
      console.error("Browser disconnected unexpectedly. This may indicate a crash or resource issue.");
      process.exit(1);
    });

    browser.on('targetcreated', async (target) => {
      console.log('New target created:', target.url());
    });

    browser.on('targetdestroyed', async (target) => {
      console.log('Target destroyed:', target.url());
    });

    return new Renderer(browser, id);
  } catch (error) {
    console.error('Failed to initialize Puppeteer:', error);
    throw error;
  }
}

module.exports = create
