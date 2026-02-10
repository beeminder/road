/* This file is all Claude */

// Puppeteer qual: load basic_test.html, verify graph renders correctly
const puppeteer = require('puppeteer')
const http = require('http')
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..')
const PORT = 0 // let OS pick an available port

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css', '.bb': 'text/plain',
}

function serve(req, res) {
  // Map URL paths to filesystem: the qual HTML uses relative ../src/ paths
  // and loads .bb files from absolute paths
  let fpath = req.url.startsWith('/')
    ? path.join(REPO, req.url)
    : req.url
  // basic_test.html hardcodes an absolute path to the .bb file
  if (req.url.startsWith('/Users/')) fpath = req.url

  fs.readFile(fpath, (err, data) => {
    if (err) {
      res.writeHead(404)
      res.end()
      return
    }
    const ext = path.extname(fpath)
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    res.end(data)
  })
}

function assert(condition, msg) {
  if (!condition) {
    console.error(`FAIL: ${msg}`)
    failures.push(msg)
  }
}

const failures = []

;(async () => {
  const server = http.createServer(serve)
  await new Promise(r => server.listen(PORT, r))
  const port = server.address().port

  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()

  const pageErrors = []
  page.on('pageerror', err => { pageErrors.push(err.message) })
  page.on('requestfailed', req => {
    if (req.url().endsWith('/favicon.ico')) return
    pageErrors.push(`request failed: ${req.url()}`)
  })

  const url = `http://localhost:${port}/quals/basic_test.html`
  console.log(`Loading ${url}`)

  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
  } catch (e) {
    console.error(`page.goto failed: ${e.message}`)
    process.exit(1)
  }

  // Wait for async graph rendering
  await new Promise(r => setTimeout(r, 5000))

  assert(pageErrors.length === 0,
    `page errors: ${pageErrors.join('; ')}`)

  // --- DOM assertions ---

  const checks = await page.evaluate(() => {
    const svg = document.querySelector('svg.bmndrsvg')
    return {
      hasSVG:     !!svg,
      hasViewBox: svg ? svg.getAttribute('viewBox')?.length > 0 : false,
      hasRazr:    svg ? !!svg.querySelector('.razr') : false,
      hasBull:    svg ? !!svg.querySelector('.bullseye') : false,
      hasAxis:    svg ? svg.querySelectorAll('.axis').length > 0 : false,
      hasBrush:   svg ? !!svg.querySelector('.brush') : false,
      hasZoom:    svg ? !!svg.querySelector('.zoomarea') : false,
      // Road table should have been populated
      tableHTML:  document.getElementById('table')?.innerHTML?.length || 0,
      // JSON dump should have been populated
      jsonHTML:   document.getElementById('json')?.innerHTML?.length || 0,
    }
  })

  assert(checks.hasSVG,          'SVG with class bmndrsvg exists')
  assert(checks.hasViewBox,      'SVG has a viewBox')
  assert(checks.hasRazr,         'bright red line rendered')
  assert(checks.hasBull,         'bullseye rendered')
  assert(checks.hasAxis,         'axis elements exist')
  assert(checks.hasBrush,        'brush (context navigator) exists')
  assert(checks.hasZoom,         'zoom area exists')
  assert(checks.tableHTML > 100, `road table populated (${checks.tableHTML} chars)`)
  assert(checks.jsonHTML > 100,  `JSON dump populated (${checks.jsonHTML} chars)`)

  // Take a screenshot for visual verification
  const shotPath = path.resolve(__dirname, 'qual_basic_screenshot.png')
  await page.screenshot({ path: shotPath, fullPage: true })

  await browser.close()
  server.close()

  if (failures.length) {
    console.log(`\n${failures.length} FAILURE(S)`)
    process.exit(1)
  }
  console.log('All checks passed.')
  process.exit(0)
})()
