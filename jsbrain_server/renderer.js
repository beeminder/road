'use strict'

const uuid = require('uuid')
const fs = require('fs')
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
  async render(path, base) {
    let page = null
    let url = `file://${__dirname}/generate.html?bb=file://${path}/${base}.bb`
    let newid = uuid.v1();
    var html = null, svg = null, png = null, json = null

    try {

      // Load and render the page, extract html
      var time_id = `Render time (${base}, ${newid})`
      console.time(time_id)
      page = await this.createPage(url)
      if (page) {
        html = await page.content()
        const svgHandle = await page.$('svg');
        svg = await page.evaluate(svg => svg.outerHTML, svgHandle);
        svg = '<?xml version="1.0" standalone="no"?>\n'+svg
        // write the SVG file
        fs.writeFile(`${path}/${base}.svg`, svg, (err) => {  
          if (err) console.log(`Error saving to ${base}.svg`);
        });   
        const jsonHandle = await page.$('#goaljson');
        json = await page.evaluate(json => json.innerHTML, jsonHandle);
        // write the SVG file
        fs.writeFile(`${path}/${base}.json`, json, (err) => {  
          if (err) console.log(`Error saving to ${base}.json`);
        });   
        console.timeEnd(time_id)
      
        time_id = `Screenshot time (${base}, ${newid})`

        // Take screenshot of rendered page
        console.time(time_id)
        const rect = await page.evaluate(selector => {
          const element = document.querySelector(selector);
          const {x, y, width, height} = element.getBoundingClientRect();
          return {left: x, top: y, width, height, id: element.id};
        }, "svg");  
        png = await page.screenshot({path:`${path}/${base}.png`, 
                                     clip:{x:rect.left, y:rect.top, 
                                           width:rect.width, height:rect.height}})
        console.timeEnd(time_id)
      } else {
        // Clean up leftover timing
        console.timeEnd(time_id)
      }
    } finally {
      if (page) await page.close()
    }
    return {html: html, png: png, svg: svg}
  }
}

async function create( id ) {
  const browser 
          = await puppeteer.launch({ args: ['--no-sandbox', 
                                            '--allow-file-access-from-files'] })
  return new Renderer(browser, id)
}

module.exports = create
