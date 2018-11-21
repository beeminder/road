'use strict'

const uuid = require('uuid')
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

  /** Renders the graph associated with the BB file with the supplied
   base name, located in the supplied path in the puppeteer
   instance. Creates a new tab, renders the graph and json, outputs
   the graph in PNG and SVG forms as well as the JSON output and
   closes the tab afterwards */
  async render(inpath, outpath, base) {
    let page = null
    let url = `file://${__dirname}/generate.html?bb=file://${encodeURIComponent(inpath)}/${encodeURIComponent(base)}.bb`
    let newid = uuid.v1();
    var html = null, svg = null, png = null, json = null

    try {

      // Load and render the page, extract html
      var time_id = `Render time (${base}, ${newid})`
      console.time(time_id)
      if (!fs.existsSync(`${inpath}/${base}.bb`))
        return { error:`Could not find file ${inpath}/${base}.bb` }
      if (!fs.existsSync(`${outpath}`))
        return { error:`Directory ${outpath} does not exist` }
      page = await this.createPage(url)
      if (page) {
        html = await page.content()
        const svgHandle = await page.$('svg')
        svg = await page.evaluate(svg => svg.outerHTML, svgHandle);
        svg = '<?xml version="1.0" standalone="no"?>\n'+svg
        // write the SVG file
        fs.writeFile(`${outpath}/${base}.svg`, svg, (err) => {  
          if (err) console.log(`Error saving to ${base}.svg`);
        });   
        const jsonHandle = await page.$('#goaljson');
        json = await page.evaluate(json => json.innerHTML, jsonHandle);
        // write the SVG file
        fs.writeFile(`${outpath}/${base}.json`, json, (err) => {  
          if (err) console.log(`Error saving to ${base}.json`);
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
        console.info("Zoom area bounding box is "+JSON.stringify(zi))
        
        console.timeEnd(time_id)
      
        time_id = `Screenshot time (${base}, ${newid})`

        // Take screenshot of rendered page
        console.time(time_id)
        const rect = await page.evaluate(selector => {
          const element = document.querySelector(selector);
          const {x, y, width, height} = element.getBoundingClientRect();
          return {left: x, top: y, width, height, id: element.id};
        }, "svg");  
        var pngfile = `${outpath}/${base}.png`
        var thumbfile = `${outpath}/${base}-thumb.png`
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
        // Clean up leftover timing
        console.timeEnd(time_id)
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
