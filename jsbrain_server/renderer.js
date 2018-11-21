'use strict'

const uuidv4 = require('uuid/v4')
const fs = require('fs')
const gm = require('gm').subClass({imageMagick: true})
const puppeteer = require('puppeteer')

class Renderer {
  
  constructor(browser, id) {
    this.browser = browser
    this.id = id;
  }

  // Creates a new page in a tab within the puppeteer chrome instance
  async createPage( url ) {
    let gotoOptions = {
      timeout: 60 * 1000,
      waitUntil: 'networkidle2'
    }

    // Create a new tab so parallel requests do not mess with each
    // other
    const page = await this.browser.newPage()
    page.on('console', 
            msg => console.log("("+this.id+"): PAGE LOG:", 
                               msg.text()));    
    page.on('error', msg => console.log("ERROR: "+msg));    

    // Render the page and return result
    try {
      await page.goto(url, gotoOptions)
    } catch (error) {
      console.log(error)
      await page.close();
      return null;
    } 
    return page
  }

  BBURL() { return "http://brain.beeminder.com/" }
  
  nograph(slug) { return slug.match(/NOGRAPH_/) }
  // Take a file and return a parallel temp file, ie, with the directory and file 
  // extension the same but with the base file name amended with a unique string 
  // based on a session ID. Eg, foo.x -> foo-tmp743829.x
  tempify(f,id) { return f.replace(/^(.*)\.([^\.]*)$/,"$1-tmp"+id+".$2") }
  
  /** Renders the graph associated with the BB file with the supplied
   fbase name (i.e. user+slug), located in the supplied path in the puppeteer
   instance. Creates a new tab, renders the graph and json, outputs
   the graph in PNG and SVG forms as well as the JSON output and
   closes the tab afterwards */
  async render(inpath, outpath, slug) {
    let page = null
    const bburl = encodeURIComponent(inpath)+"/"+encodeURIComponent(slug)+".bb"

    const bbfile = `${inpath}/${slug}.bb`
    if (!fs.existsSync(bbfile)) {
      return {}
    }

    const newid = uuidv4();
    const base = inpath // Pybrain compatibility
    const sluga = slug.replace(/^([^\+]*\+[^\+]*).*/, (a,b)=>b)
    
    process.stdout.write(sluga+" @ ")
    let starttm = new Date()
    process.stdout.write(starttm.toISOString().replace(/T/, ' ').replace(/\..+/, ''))
    process.stdout.write("\n")

    const imgf = `${outpath}/${this.nograph(slug)?"NOGRAPH":slug}.png`
    const svgf = `${outpath}/${this.nograph(slug)?"NOGRAPH":slug}.svg`
    const thmf = `${outpath}/${this.nograph(slug)?"NOGRAPH":slug}-thumb.png`
    // generate the graph unless both nograph(slug) and nograph.png already exists
    const graphit = !(this.nograph(slug) && fs.existsSync(imgf) && fs.existsSync(thmf))
    if (graphit) {
      var imgftmp = this.tempify(imgf, newid)
      var svgftmp = this.tempify(svgf, newid)
      var thmftmp = this.tempify(thmf, newid)
      if (fs.existsSync(imgf)) fs.unlinkSync( imgf )
      if (fs.existsSync(svgf)) fs.unlinkSync( svgf )
      if (fs.existsSync(thmf)) fs.unlinkSync( thmf )
    }
    const url
          = `file://${__dirname}/generate.html?bb=file://${bburl}&NOGRAPH=${!graphit}`
    let html = null, svg = null, png = null, jsonstr, json
        
    try {

      // Load and render the page, extract html
      var time_id = `Render time (${slug}, ${newid})`
      console.time(time_id)
      if (!fs.existsSync(bbfile)) {
        let err = `Could not find file ${bbfile}`
        process.stdout.write("ERROR: "+err+"\n")
        return { error: err}
      }
      if (!fs.existsSync(outpath)) {
        let err = `Could not find directory ${outpath}`
        process.stdout.write("ERROR: "+err+"\n")
        return { error:err }
      }
      page = await this.createPage(url)
      if (page) {
        html = await page.content()
        console.timeEnd(time_id)
      
        // Extract and write the goal JSON
        let jf = `${outpath}/${slug}.json`
        let jtmp = this.tempify(jf, newid)
        if (fs.existsSync(jf)) fs.renameSync(jf, jtmp )
        const jsonHandle = await page.$('#goaljson');
        jsonstr = await page.evaluate(json => json.innerHTML, jsonHandle);
        json = JSON.parse(jsonstr)
        json.graphurl=this.BBURL()+imgf
        json.svgurl=this.BBURL()+svgf
        json.thumburl=this.BBURL()+thmf
        fs.writeFileSync(jtmp, JSON.stringify(json));   
        fs.renameSync(jtmp, jf )
        process.stdout.write(json.statsum.replace(/\\n/g, '\n'))
        
        const svgHandle = await page.$('svg')
        svg = await page.evaluate(svg => svg.outerHTML, svgHandle);
        svg = '<?xml version="1.0" standalone="no"?>\n'+svg
        // write the SVG file
        fs.writeFile(`${outpath}/${slug}.svg`, svg, (err) => {  
          if (err) console.log(`Error saving to ${slug}.svg`);
        });   

        // Extract the bounding box for the zoom area to generate the thumbnail
        var za = await page.$('.zoomarea')
        var zi = await page.evaluate(()=>{
          var z = document.getElementsByClassName('zoomarea')[0]
          var b = z.getBBox()
          var c = z.getAttribute('color')
          return {x:Math.round(b.x+1), y:Math.round(b.y),
                  width:Math.round(b.width-2), height:Math.round(b.height),
                  color:c};})
        //console.info("Zoom area bounding box is "+JSON.stringify(zi))
        
        time_id = `Screenshot time (${slug}, ${newid})`

        // Take screenshot of rendered page
        console.time(time_id)
        const rect = await page.evaluate(selector => {
          const element = document.querySelector(selector);
          const {x, y, width, height} = element.getBoundingClientRect();
          return {left: x, top: y, width, height, id: element.id};
        }, "svg");  
        var pngfile = `${outpath}/${slug}.png`
        var thumbfile = `${outpath}/${slug}-thumb.png`
        png = await page.screenshot({path:pngfile, 
                                     clip:{x:rect.left, y:rect.top, 
                                           width:rect.width, height:rect.height}})
        // Generate thumbnail
        var thmratio = 140/zi.height
        var thmw = Math.round(zi.width*thmratio)-4
        var thmh = Math.round(zi.height*thmratio)-4
        thmw = 212-4; thmh = 140-4
        gm(pngfile)
          .in('-crop').in(zi.width+"x"+zi.height+"+"+zi.x+"+"+zi.y)
          .in('-resize').in(thmw+'x'+thmh)
          .in('-bordercolor').in(zi.color)
          .in('-border').in('2x2')
          .in('-filter').in('Box')
          .in('-filter').in('Box')
          .in('-remap').in('palette.png')
          .in('-colors').in('256')
          .in('+dither')
          .in('+repage')
          .write(thumbfile, (err)=>{if (err) console.log(err)})
        // Perform palette remap using ImageMagick
        gm(pngfile)
          .in('-filter').in('Box')
          .in('-remap').in('palette.png')
          .in('-colors').in('256')
          .in('+dither')
          .write(pngfile, (err)=>{if (err) console.log(err)})
        console.timeEnd(time_id)
      } else {

        let err = "Could not create headless chrome page!"
        process.stdout.write("ERROR: "+err+"\n")

        // Clean up leftover timing
        console.timeEnd(time_id)
        return { error:err }
      }
    } finally {
      if (page) await page.close()
    }
    return {html: html, png: png, svg: svg, error:null}
  }
}

async function create( id ) {
  const browser 
          = await puppeteer.launch({ args: ['--no-sandbox', 
                                            '--allow-file-access-from-files'] })
  return new Renderer(browser, id)
}

module.exports = create
