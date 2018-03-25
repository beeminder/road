'use strict'

const uuid = require('uuid')
const fs = require('fs')
const puppeteer = require('puppeteer')

class Renderer {
  
  constructor(browser, id) {
    this.browser = browser
    this.id = id;
  }

  async createPage( url ) {
    let gotoOptions = {
      timeout: 30 * 1000,
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

  async render(url) {
    let page = null
    let newid = uuid.v1();
    var html = null, svg = null, png = null

    try {
      var slug = url.replace(/^.*[\\\/]/, '').replace(/\.[^/.]+$/, '')

      // Load and render the page, extract html
      console.time('rendering'+newid)
      page = await this.createPage(url)
      if (page) {
        html = await page.content()
        const svgHandle = await page.$('svg');
        svg = await page.evaluate(svg => svg.outerHTML, svgHandle);
        svg = '<?xml version="1.0" standalone="no"?>\n'+svg
        // write the SVG file
        fs.writeFile(slug+'.svg', svg, (err) => {  
          if (err) console.log(`Error saving to ${slug}.svg`);
        });   
        console.timeEnd('rendering'+newid)
      
        // Take screenshot of rendered page
        console.time('screenshot'+newid)
        png = await page.screenshot({path:slug+".png", 
                                     clip:{x:0, y:0, width:710, height:460}})
        console.timeEnd('screenshot'+newid)
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
