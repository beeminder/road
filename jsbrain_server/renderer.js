'use strict'

const puppeteer = require('puppeteer')

class Renderer {
  
  constructor(browser, id) {
    this.browser = browser
    this.page = null
    this.id = id;
  }

  async loadPage( url ) {
    let gotoOptions = {
      timeout: 30 * 1000,
      waitUntil: 'networkidle2'
    }

    // Create page if one does not exist and install console log handler
    if (this.page == null) {
      var curPages = await this.browser.pages();
      if (curPages.length == 0)
        this.page = await this.browser.newPage()
      else 
        this.page = curPages[0]
      this.page.on('console', 
                   msg => console.log("("+this.id+"): PAGE LOG:", 
                                      msg.text()));    
    }
    const page = this.page;

    // Render the page and return result
    await page.goto(url, gotoOptions)
    return page
  }

  async render(url) {
    var slug = url.replace(/^.*[\\\/]/, '').replace(/\.[^/.]+$/, '')

    // Load and render the page, extract html
    console.time('rendering'+this.id)
    let page = await this.loadPage(url)
    const html = await page.content()
    console.timeEnd('rendering'+this.id)

    // Take screenshot of rendered page
    console.time('screenshot'+this.id)
    const buffer 
            = await page.screenshot({path:slug+".png", 
                                     clip:{x:0, y:0, width:710, height:460}})
    console.timeEnd('screenshot'+this.id)

    return {html: html, png: buffer}
  }
}

async function create( id ) {
  const browser 
          = await puppeteer.launch({ args: ['--no-sandbox', 
                                            '--allow-file-access-from-files'] })
  return new Renderer(browser, id)
}

module.exports = create
