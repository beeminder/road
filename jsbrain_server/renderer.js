'use strict'

const puppeteer = require('puppeteer')

class Renderer {
  
  constructor(browser) {
    this.browser = browser
    this.page = null
  }

  async createPage(url, { timeout, waitUntil }) {
    let gotoOptions = {
      timeout: Number(timeout) || 30 * 1000,
      waitUntil: waitUntil || 'networkidle2'
    }


    if (this.page == null) {
      var curPages = await this.browser.pages();
      if (curPages.length == 0)
        this.page = await this.browser.newPage()
      else 
        this.page = curPages[0]
      this.page.on('console', msg => console.log('PAGE LOG:', msg.text()));    
    }
    const page = this.page;

    await page.goto(url, gotoOptions)
    return page
  }

  async render(url, options) {
    let page = null
    const { timeout, waitUntil } = options

    console.time('rendering')
    page = await this.createPage(url, { timeout, waitUntil })
    const html = await page.content()
    console.timeEnd('rendering')

    return html
  }

  async screenshot(url, options) {
    let page = null
    try {
      const { timeout, waitUntil, ...extraOptions } = options
      page = await this.createPage(url, { timeout, waitUntil })

      const { fullPage, omitBackground } = extraOptions
      const buffer = await page.screenshot({
        ...extraOptions,
        fullPage: fullPage === 'true',
        omitBackground: omitBackground === 'true',
      })
      return buffer
    } finally {
      if (page) {
        await page.close()
      }
    }
  }

  async close() {
    await this.browser.close()
  }
}

async function create() {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] })
  return new Renderer(browser)
}

module.exports = create
