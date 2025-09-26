'use strict'

const {v4: uuidv4} = require('uuid')
const fs = require('fs')
const gm = require('gm').subClass({imageMagick: true})

const pageTimeout = 40 // Seconds to wait until giving up on generate.html

class Renderer {
  
  constructor(browser, id) {
    this.browser = browser
    this.id = id
    this.pages = []
    this.pageCreatedCount = 0
    this.pageClosedCount = 0
    
    console.log(`(${id}): 🟢 Renderer initialized with browser PID ${browser.process().pid}`)
    
    // Clean up pages when browser disconnects
    browser.on('disconnected', () => {
      console.log(`(${id}): 🔴 Browser disconnected! Cleaning up ${this.pages.length} active pages`)
      console.log(`(${id}): 📊 Lifetime stats - Created: ${this.pageCreatedCount}, Closed: ${this.pageClosedCount}`)
      this.pages.forEach((pageinfo, index) => {
        console.log(`(${id}): 🧹 Cleaning up page slot ${index}, timeout: ${!!pageinfo.timeout}`)
        if (pageinfo.timeout) {
          clearTimeout(pageinfo.timeout)
        }
      })
      this.pages = []
      console.log(`(${id}): ✅ Browser disconnect cleanup complete`)
    })
    
    // Log browser events
    browser.on('targetcreated', (target) => {
      console.log(`(${id}): 🎯 Browser target created: ${target.type()} - ${target.url()}`)
    })
    
    browser.on('targetdestroyed', (target) => {
      console.log(`(${id}): 💥 Browser target destroyed: ${target.type()} - ${target.url()}`)
    })
  }

  // This method overrides stdout and captures the output of
  // console.timeEnd in a string for later printing. Quite hacky but
  // works
  timeEndMsg( tagtxt ) {
    const real_stdout    = process.stdout.write
    let captured = ""
    function process_output(output) { captured += output }
    
    process.stdout.write = process_output
    console.timeEnd( tagtxt )
    process.stdout.write = real_stdout
    return captured
  }
  
  prfinfo(r) { return [this.id,r] }
  prf(r) { return "("+this.id+":"+r+") " }

  // Log current page status
  logPageStatus(context = '') {
    const busyPages = this.pages.filter(p => p.busy).length
    const activePagesWithTimeout = this.pages.filter(p => p.page && p.timeout).length
    const activePagesWithoutTimeout = this.pages.filter(p => p.page && !p.timeout).length
    const nullPages = this.pages.filter(p => !p.page).length
    
    console.log(`(${this.id}): 📈 ${context} | Total: ${this.pages.length}, Busy: ${busyPages}, Active+timeout: ${activePagesWithTimeout}, Active-timeout: ${activePagesWithoutTimeout}, Null: ${nullPages} | Created: ${this.pageCreatedCount}, Closed: ${this.pageClosedCount}`)
  }

  // Gracefully close all pages and clear timeouts
  async closeAllPages() {
    console.log(`(${this.id}): 🔄 Starting graceful shutdown of ${this.pages.length} pages`)
    this.logPageStatus('Pre-shutdown')
    
    for (const pageinfo of this.pages) {
      if (pageinfo.timeout) {
        console.log(`(${this.id}): ⏰ Clearing timeout for page slot ${pageinfo.slot}`)
        clearTimeout(pageinfo.timeout)
        pageinfo.timeout = null
      }
      if (pageinfo.page) {
        try {
          console.log(`(${this.id}): 🚪 Closing page in slot ${pageinfo.slot}`)
          await pageinfo.page.close()
          this.pageClosedCount++
        } catch (error) {
          console.warn(`(${this.id}): ⚠️ Error closing page slot ${pageinfo.slot}:`, error.message)
        }
        pageinfo.page = null
      }
    }
    this.pages = []
    console.log(`(${this.id}): ✅ Graceful shutdown complete. Final stats - Created: ${this.pageCreatedCount}, Closed: ${this.pageClosedCount}`)
  }
  
  // Renders and returns an available page (tab) within the puppeteer
  // chrome instance. Creates one if all existing ones are found to be
  // busy
  async renderPage( url, tag, msglog, errlog ) {
    let gotoOptions = { timeout: pageTimeout * 1000, waitUntil: 'load' }
    const MAX_PAGES = 20; // Prevent unbounded page creation

    console.log(`${tag}🔍 Starting renderPage for URL: ${url}`)
    this.logPageStatus('Pre-renderPage')

    try {
      var pageinfo = null, page = null;
      // Grab one of the unused tabs, create a new one if necessary
      var numpages = this.pages.length
      console.log(`${tag}📋 Searching through ${numpages} existing pages for available slot`)
      
      for (var i = 0; i < numpages; i++) {
        if (!this.pages[i].busy) {
          pageinfo = this.pages[i]
          pageinfo.busy = true
          console.log(`${tag}♻️ Reusing page slot ${i} (was free)`)
          
          // Check if page was closed by timeout, recreate if necessary
          if (!pageinfo.page) {
            console.log(`${tag}🔄 Reinstantiating page in slot ${i} (was null)`)
            pageinfo.page = await this.browser.newPage()
            this.pageCreatedCount++
            console.log(`${tag}✅ Successfully reinstantiated page in slot ${i}`)
          }
          page = pageinfo.page
          if (pageinfo.timeout) {
            console.log(`${tag}⏰ Clearing existing timeout for slot ${i}`)
            clearTimeout(pageinfo.timeout)
            pageinfo.timeout = null
          }
          break
        } else {
          console.log(`${tag}⏳ Slot ${i} is busy, continuing search`)
        }
      }
      
      if (!pageinfo) {
        // Check if we've hit the page limit
        if (numpages >= MAX_PAGES) {
          console.warn(`${tag}🚫 Hit page limit (${MAX_PAGES}), rejecting request`)
          this.logPageStatus('Page-limit-hit')
          return null
        }
        // If all existing pages are found to be busy, create a new one
        console.log(`${tag}🆕 All ${numpages} pages busy, creating new page in slot ${numpages}`)
        page = await this.browser.newPage()
        this.pageCreatedCount++
        pageinfo = {page: page, busy: true, slot: numpages}
        this.pages.push( pageinfo )
        console.log(`${tag}✅ Successfully created new page in slot ${numpages}`)
      }
      
      this.logPageStatus('Post-page-allocation')

      // Install new loggers onto the page for this render instance. Will be
      // removed at the end of processing.
      var listeners = page.listenerCount('console')
      if (listeners != 0) {
        console.log(`${tag}⚠️ Found ${listeners} unremoved console listeners - potential memory leak!`)
      }
      
      console.log(`${tag}🎧 Installing event listeners on page slot ${pageinfo.slot}`)
      page.on('console',   msglog)
      page.on('error',     errlog)
      page.on('pageerror', errlog)
      page.on('requestfailed', (request) => {
        console.error(`${tag}💥 Request failed: ${request.url()} ${request.failure().errorText}`);
      });

      // Render the page and return result
      console.log(`${tag}🌐 Navigating to URL with ${pageTimeout}s timeout`)
      const startTime = Date.now()
      try {
        await page.goto(url, gotoOptions)
        const loadTime = Date.now() - startTime
        console.log(`${tag}✅ Page loaded successfully in ${loadTime}ms on slot ${pageinfo.slot}`)
      } catch (error) {
        const failTime = Date.now() - startTime
        console.log(`${tag}❌ Page load failed after ${failTime}ms: ${error.message}`)
        // Remove listeners to prevent accumulation of old listeners for reused 
        // pages. UPDATE: Remove listeners using off() instead of removeListener()
        console.log(`${tag}🧹 Removing event listeners after failed navigation`)
        page.off('console',   msglog)
        page.off('error',     errlog)
        page.off('pageerror', errlog)
        pageinfo.busy = false
        console.log(`${tag}🔓 Released page slot ${pageinfo.slot} after navigation failure`)
        this.logPageStatus('Post-navigation-failure')
        return null
      } 
      console.log(`${tag}🎯 Successfully allocated and loaded page slot ${pageinfo.slot}`)
      return pageinfo
    } catch (error) {
      console.error(`${tag}💀 Critical error in renderPage:`, error.message);
      // Ensure page is released on any error
      if (pageinfo) {
        console.log(`${tag}🔓 Emergency release of page slot ${pageinfo.slot} due to error`)
        pageinfo.busy = false
      }
      this.logPageStatus('Post-critical-error')
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
      if (fs.existsSync(imgf)) fs.unlinkSync( imgf )
      if (fs.existsSync(svgf)) fs.unlinkSync( svgf )
      if (fs.existsSync(thmf)) fs.unlinkSync( thmf )
    }
    const url
          = `file://${__dirname}/generate.html?bb=file://${bburl}&NOGRAPH=${!graphit}`
    let html = null, svg = null, png = null, jsonstr, json
        
    try {

      // Load and render the page, extract html
      var time_id = tag+` Page creation (${slug})`
      console.time(time_id)
      pageinfo = await this.renderPage(url,tag, msglog, errlog)
      if (pageinfo) page = pageinfo.page
      if (time_id != null) msgbuf += this.timeEndMsg(time_id)
      time_id = null

      if (page) {

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
          // Page cleanup will be handled in finally block
          return { error: err.message, msgbuf: msgbuf }
        }
        if (time_id != null) msgbuf += this.timeEndMsg(time_id)
        time_id = null
      
        // Extract goal stats from the JSON field and extend with file locations
        console.log(`${tag}📋 Extracting JSON data from page element`)
        const jsonHandle = await page.$('#goaljson');
        jsonstr = await page.evaluate(json => json.innerHTML, jsonHandle);
        console.log(`${tag}📊 JSON extracted (${jsonstr.length} chars)`)
        if (jsonstr == "" || jsonstr == null) {
          let err = "Could not extract JSON from page!"
          msgbuf += (tag+" renderer.js ERROR: "+err+"\n")
          // Page cleanup will be handled in finally block
          return { error:err, msgbuf: msgbuf }
        }
        //console.log(`DEBUG:\n${jsonstr}\n`) // TODO
        json = JSON.parse(jsonstr)
        //console.log("DEBUG: parse error?") // TODO
        json.graphurl=this.BBURL()+imgf
        json.svgurl=this.BBURL()+svgf
        json.thumburl=this.BBURL()+thmf

        // Write to the goal JSON, using an intermediate temp file
        console.log(`${tag}📊 Writing JSON output (${Object.keys(json).length} properties)`)
        let jf = `${outpath}/${slug}.json`
        let jtmp = this.tempify(jf, newid)
        if (fs.existsSync(jf)) fs.renameSync(jf, jtmp )
        fs.writeFileSync(jtmp, JSON.stringify(json));  
        if (fs.existsSync(jtmp)) {
          fs.renameSync(jtmp, jf )
          console.log(`${tag}✅ JSON file saved: ${jf}`)
        }
        // Display statsum on node console
        //process.stdout.write(tag+json.statsum.replace(/\\n/g, '\n'+tag))
        //process.stdout.write("\n")
        
        if (graphit) {
          // Extract and write the SVG file
          console.log(`${tag}📄 Extracting SVG from rendered page`)
          const svgHandle = await page.$('svg')
          svg = await page.evaluate(svg => svg.outerHTML, svgHandle)
          svg = '<?xml version="1.0" standalone="no"?>\n'+svg
          console.log(`${tag}📝 SVG extracted (${svg.length} chars), writing to file`)
          
          // write to the temp SVG file and rename
          fs.writeFileSync(svgftmp, svg);  
          if (fs.existsSync(svgftmp)) {
            fs.renameSync(svgftmp, svgf )
            console.log(`${tag}✅ SVG file saved: ${svgf}`)
          }

          // Extract the bounding box for the zoom area to generate
          // the thumbnail cropping boundaries
          console.log(`${tag}🔍 Extracting zoom area bounds for thumbnail cropping`)
          var za = await page.$('.zoomarea')
          var zi = await page.evaluate(()=>{
            var z = document.getElementsByClassName('zoomarea')[0]
            var b = z.getBBox()
            return {x:Math.round(b.x+1), y:Math.round(b.y),
                    width:Math.round(b.width-2), height:Math.round(b.height)};})
          console.log(`${tag}📐 Zoom area bounds: ${zi.width}x${zi.height}+${zi.x}+${zi.y}`)
          //console.info("Zoom area bounding box is "+JSON.stringify(zi))
        
          // Take a screenshot to generate PNG files
          time_id = tag+` Screenshot (${slug})`
          console.time(time_id)
          console.log(`${tag}📸 Preparing to capture screenshot`)

          // Extract SVG boundaries on page
          const rect = await page.evaluate(s => {
            const element = document.querySelector(s);
            const {x, y, width, height} = element.getBoundingClientRect();
            return {left: x, top: y, width, height, id: element.id};
          }, "svg");  
          console.log(`${tag}📐 SVG bounds: ${rect.width}x${rect.height} at (${rect.left},${rect.top})`)
          
          png = await page.screenshot({path:imgftmp, 
                                       clip:{x:rect.left, y:rect.top, 
                                             width:rect.width, height:rect.height}})
          console.log(`${tag}✅ Screenshot captured to: ${imgftmp}`)

          // Generate palette optimized thumbnail thru cropping with ImageMagick
          console.log(`${tag}✂️ Cropping thumbnail from zoom area: ${zi.width}x${zi.height}+${zi.x}+${zi.y}`)
          //var thmratio = 140/zi.height
          //var thmw = 212-4 // = Math.round(zi.width*thmratio)-4
          //var thmh = 140-4 // = Math.round(zi.height*thmratio)-4
          var res = await new Promise( (resolve, reject) => {
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
                if (err) reject(err)
                resolve(null)
              })
          })
          if (fs.existsSync(thmftmp)) {
            fs.renameSync(thmftmp, thmf )
            console.log(`${tag}✅ Thumbnail generated: ${thmf}`)
          }
          
          // Generate final graph PNG by palette remapping using ImageMagick
          console.log(`${tag}🎨 Applying palette optimization to main PNG`)
          res = await new Promise( (resolve, reject) => {
            gm(imgftmp)
              .in('-filter').in('Box')
              .in('-remap').in('palette.png')
              .in('-colors').in('256')
              .in('+dither')
              .write(imgftmp, (err) => {
                if (err) reject(err)
                resolve(null)
              })
          })
          console.log(`${tag}✅ Palette optimization complete`)
        }
        if (fs.existsSync(imgftmp)) {
          fs.renameSync(imgftmp, imgf )
          console.log(`${tag}✅ Final PNG saved: ${imgf}`)
        }
        if (time_id != null) msgbuf += this.timeEndMsg(time_id)
        time_id = null

      } else {

        let err = "Could not create headless chrome page!"
        msgbuf += (tag+" renderer.js ERROR: "+err+"\n")

        // Clean up leftover timing
        if (time_id != null) msgbuf += this.timeEndMsg(time_id)
        time_id = null
        // No page cleanup needed as no page was created
        return { error:err, msgbuf: msgbuf }
      }
    } finally {
      if (page) {
        console.log(`${tag}🧹 Cleaning up page slot ${pageinfo.slot} - removing listeners and setting timeout`)
        // UPDATE: Remove listeners using off() instead of removeListener()
        page.off('console',   msglog)
        page.off('error',     errlog)
        page.off('pageerror', errlog)
        pageinfo.busy = false
        console.log(`${tag}🔓 Released page slot ${pageinfo.slot} (marked as not busy)`)
        
        const timeoutMs = 10000
        console.log(`${tag}⏰ Setting ${timeoutMs}ms cleanup timeout for page slot ${pageinfo.slot}`)
        pageinfo.timeout
          = setTimeout(
            function(){
              if (pageinfo) {
                if (pageinfo.page) {
                  console.log(`${tag}🚪 Auto-closing page after ${timeoutMs}ms timeout in slot ${pageinfo.slot}`)
                  try {
                    pageinfo.page.close()
                    console.log(`${tag}✅ Successfully closed page in slot ${pageinfo.slot}`)
                  } catch (closeError) {
                    console.warn(`${tag}⚠️ Error closing page in slot ${pageinfo.slot}:`, closeError.message)
                  }
                }
                pageinfo.page = null
                pageinfo.timeout = null
                console.log(`${tag}🗑️ Nullified page and timeout for slot ${pageinfo.slot}`)
              } else {
                console.log(`${tag}⚠️ Warning: pageinfo=null in timeout callback - potential race condition`)
              }
            }, timeoutMs)
      }
      
      this.logPageStatus('Post-render-cleanup')
    }
    return {html: html, png: png, svg: svg, json: json, error:null, msgbuf: msgbuf}
  }
}

async function create( id, pproduct ) {
  let puppeteer = require('puppeteer');
  
  try {
    console.log(`(${id}): 🚀 Attempting to launch Puppeteer with product ${pproduct}...`);
    const startTime = Date.now()
    
    const launchArgs = [
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
    ]
    
    console.log(`(${id}): ⚙️ Launch args: ${launchArgs.join(' ')}`);
    
    const browser = await puppeteer.launch({ 
      product: pproduct,
      args: launchArgs,
      // Add headless mode explicitly
      headless: 'new',
      // Add more detailed logging
      dumpio: true
    });
    
    const launchTime = Date.now() - startTime
    const browserPid = browser.process().pid
    console.log(`(${id}): ✅ Successfully started ${pproduct} browser in ${launchTime}ms with PID ${browserPid}`);

    browser.on('disconnected', async () => { 
      console.error(`(${id}): 🔴 Browser PID ${browserPid} disconnected unexpectedly! This may indicate a crash or resource issue.`);
      process.exit(1);
    });

    console.log(`(${id}): 🎯 Browser event listeners installed, creating renderer...`);
    return new Renderer(browser, id);
  } catch (error) {
    console.error(`(${id}): 💀 Failed to initialize Puppeteer:`, error.message);
    console.error(`(${id}): 🔍 Error details:`, error);
    throw error;
  }
}

module.exports = create
