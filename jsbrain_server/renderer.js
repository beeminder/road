'use strict'

const uuidv4 = require('uuid/v4')
const fs = require('fs')
const gm = require('gm').subClass({imageMagick: true})
const puppeteer = require('puppeteer')

const pageTimeout = 10 // Seconds to wait until giving up on generate.html

class Renderer {
  
  constructor(browser, id) {
    this.browser = browser
    this.id = id
    this.pages = []
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
  
  // Renders and returns an available page (tab) within the puppeteer
  // chrome instance. Creates one if all existing ones are found to be
  // busy
  async renderPage( url, tag, msglog, errlog ) {
    let gotoOptions = { timeout: pageTimeout * 1000, waitUntil: 'load' }

    var pageinfo = null, page = null
    // Grab one of the unused tabs, create a new one if necessary
    var numpages = this.pages.length
    for (var i = 0; i < numpages; i++) {
      if (!this.pages[i].busy) {
        pageinfo = this.pages[i]
        pageinfo.busy = true
        // Check if page was closed by timeout, recreate if necessary
        if (!pageinfo.page) {
          console.log(tag+"renderer.js: Reinstantiating page in slot "+i)
          pageinfo.page = await this.browser.newPage()
        }
        page = pageinfo.page
        if (pageinfo.timeout) {
          clearTimeout(pageinfo.timeout)
          pageinfo.timeout = null
        }
        break
      }
    }
    if (!pageinfo) {
      // If all existing pages are found to be busy, create a new one
      console.log(tag+"renderer.js: Creating new page in slot "+numpages)
      page = await this.browser.newPage()
      pageinfo = {page: page, busy: true, slot: numpages}
      this.pages.push( pageinfo )
    }

    // Install new loggers onto the page for this render
    // instance. Will be removed at the end of processing
    var listeners = page.listeners('console')
    if (listeners.length != 0)
      console.log(tag+"renderer.js ERROR: Unremoved console listeners: "+listeners)
    page.on('console', msglog )
    page.on('error', errlog )
    page.on('pageerror', errlog )
      
    // Render the page and return result
    try {
      await page.goto(url, gotoOptions)
    } catch (error) {
      page.removeListener('console', msglog)
      page.removeListener('error', errlog)
      page.removeListener('pageerror', errlog)
      console.log(error)
      pageinfo.busy = false
      return null
    } 
    return pageinfo
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
      let err = `Could not find file ${bbfile}`
      msgbuf += (tag+" renderer.js ERROR: "+err+"\n")
      return { error: err, msgbuf: msgbuf}
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
          return { error: err.message, msgbuf: msgbuf }
        }
        if (time_id != null) msgbuf += this.timeEndMsg(time_id)
        time_id = null
      
        // Extract goal stats from the JSON field and extend with file locations
        const jsonHandle = await page.$('#goaljson');
        jsonstr = await page.evaluate(json => json.innerHTML, jsonHandle);
        if (jsonstr == "" || jsonstr == null) {
          let err = "Could not extract JSON from page!"
          msgbuf += (tag+" renderer.js ERROR: "+err+"\n")

          return { error:err, msgbuf: msgbuf }
        }
        //console.log(`DEBUG:\n${jsonstr}\n`) // TODO
        json = JSON.parse(jsonstr)
        //console.log("DEBUG: parse error?") // TODO
        json.graphurl=this.BBURL()+imgf
        json.svgurl=this.BBURL()+svgf
        json.thumburl=this.BBURL()+thmf

        // Write to the goal JSON, using an intermediate temp file
        let jf = `${outpath}/${slug}.json`
        let jtmp = this.tempify(jf, newid)
        if (fs.existsSync(jf)) fs.renameSync(jf, jtmp )
        fs.writeFileSync(jtmp, JSON.stringify(json));  
        if (fs.existsSync(jtmp)) fs.renameSync(jtmp, jf )
        // Display statsum on node console
        //process.stdout.write(tag+json.statsum.replace(/\\n/g, '\n'+tag))
        //process.stdout.write("\n")
        
        if (graphit) {
          // Extract and write the SVG file
          const svgHandle = await page.$('svg')
          svg = await page.evaluate(svg => svg.outerHTML, svgHandle)
          svg = '<?xml version="1.0" standalone="no"?>\n'+svg
          // write to the temp SVG file and rename
          fs.writeFileSync(svgftmp, svg);  
          if (fs.existsSync(svgftmp)) fs.renameSync(svgftmp, svgf )

          // Extract the bounding box for the zoom area to generate
          // the thumbnail cropping boundaries
          var za = await page.$('.zoomarea')
          var zi = await page.evaluate(()=>{
            var z = document.getElementsByClassName('zoomarea')[0]
            var b = z.getBBox()
            return {x:Math.round(b.x+1), y:Math.round(b.y),
                    width:Math.round(b.width-2), height:Math.round(b.height)};})
          //console.info("Zoom area bounding box is "+JSON.stringify(zi))
        
          // Take a screenshot to generate PNG files
          time_id = tag+` Screenshot (${slug})`
          console.time(time_id)

          // Extract SVG boundaries on page
          const rect = await page.evaluate(s => {
            const element = document.querySelector(s);
            const {x, y, width, height} = element.getBoundingClientRect();
            return {left: x, top: y, width, height, id: element.id};
          }, "svg");  
          png = await page.screenshot({path:imgftmp, 
                                       clip:{x:rect.left, y:rect.top, 
                                             width:rect.width, height:rect.height}})

          // Generate palette optimized thumbnail thru cropping with ImageMagick
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
          if (fs.existsSync(thmftmp)) fs.renameSync(thmftmp, thmf )
          
          // Generate final graph PNG by palette remapping using ImageMagick
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
        }
        if (fs.existsSync(imgftmp)) fs.renameSync(imgftmp, imgf )
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
      if (page) {
        // Remove listeners to prevent accumulation of old listeners
        // for reused pages
        page.removeListener('console', msglog)
        page.removeListener('error', errlog)
        page.removeListener('pageerror', errlog)
        pageinfo.busy = false
        pageinfo.timeout
          = setTimeout(
            function(){
              if (pageinfo) {
                if (pageinfo.page) {
                  console.log(tag+"renderer.js: Closing page after timeout in slot "
                              +pageinfo.slot)
                  pageinfo.page.close()
                }
                pageinfo.page = null
                pageinfo.timeout = null
              } else
                console.log("Warning: pageinfo=null in timeout to close page")
            }, 10000)
      }
    }
    return {html: html, png: png, svg: svg, json: json, error:null, msgbuf: msgbuf}
  }
}

async function create( id ) {
  const browser 
        = await puppeteer.launch({ /*headless:false,*/
                                   args: ['--no-sandbox', 
                                          '--allow-file-access-from-files'] })
  return new Renderer(browser, id)
}

module.exports = create
