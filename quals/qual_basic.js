/* This file is all Claude */

// Puppeteer quals: load graph pages and verify they render correctly
const puppeteer = require('puppeteer')
const http = require('http')
const fs = require('fs')
const path = require('path')
const br = require('../src/broad')

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

const failures = []

function assert(condition, msg) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`)
    failures.push(msg)
  }
}

// Load a page, collect errors, wait for rendering, then run checks
async function runQual(browser, port, name, urlPath, checkFn) {
  console.log(`\n--- ${name} ---`)
  const page = await browser.newPage()

  const pageErrors = []
  page.on('pageerror', err => { pageErrors.push(err.message) })
  page.on('requestfailed', req => {
    if (req.url().endsWith('/favicon.ico')) return
    pageErrors.push(`request failed: ${req.url()}`)
  })

  const url = `http://localhost:${port}${urlPath}`
  console.log(`  Loading ${url}`)

  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
  } catch (e) {
    console.error(`  page.goto failed: ${e.message}`)
    failures.push(`${name}: page.goto failed`)
    await page.close()
    return
  }

  // Wait for async graph rendering
  await new Promise(r => setTimeout(r, 5000))

  assert(pageErrors.length === 0,
    `${name}: page errors: ${pageErrors.join('; ')}`)

  await checkFn(page, name)

  // Screenshot for visual verification
  const shotPath = path.resolve(__dirname,
    `qual_${name.replace(/\s+/g, '_')}_screenshot.png`)
  await page.screenshot({ path: shotPath, fullPage: true })

  await page.close()
}

// Shared check: an SVG with class bmndrsvg exists and has the right stuff
async function checkGraph(page, name) {
  const checks = await page.evaluate(() => {
    const svgs = document.querySelectorAll('svg.bmndrsvg')
    const svg = svgs[0]
    return {
      nSVGs:      svgs.length,
      hasSVG:     !!svg,
      hasViewBox: svg ? svg.getAttribute('viewBox')?.length > 0 : false,
      hasRazr:    svg ? !!svg.querySelector('.razr') : false,
      hasBull:    svg ? !!svg.querySelector('.bullseye') : false,
      hasAxis:    svg ? svg.querySelectorAll('.axis').length > 0 : false,
      hasBrush:   svg ? !!svg.querySelector('.brush') : false,
      hasZoom:    svg ? !!svg.querySelector('.zoomarea') : false,
    }
  })

  assert(checks.hasSVG,     `${name}: SVG with class bmndrsvg exists`)
  assert(checks.hasViewBox, `${name}: SVG has a viewBox`)
  assert(checks.hasRazr,    `${name}: bright red line rendered`)
  assert(checks.hasBull,    `${name}: bullseye rendered`)
  assert(checks.hasAxis,    `${name}: axis elements exist`)
  assert(checks.hasBrush,   `${name}: brush (context navigator) exists`)
  assert(checks.hasZoom,    `${name}: zoom area exists`)
  return checks
}

// Unit quals: aggday pure functions, no browser needed
console.log('\n--- aggday unit quals ---')
assert(br.AGGR.countflat([1, 0, 2, 0, 3]) === 3, 'countflat([1,0,2,0,3]) === 3')
assert(br.AGGR.countflat([0, 0, 0])        === 0, 'countflat([0,0,0]) === 0')
assert(br.AGGR.countflat([])               === 0, 'countflat([]) === 0')
assert(br.AGGR.countflat([5])              === 1, 'countflat([5]) === 1')
assert(br.AGGR.muflat([1, 0, 2, 0, 3])    === 2, 'muflat([1,0,2,0,3]) === 2')
assert(br.AGGR.muflat([0, 0, 0])           === 0, 'muflat([0,0,0]) === 0')
assert(br.AGGR.muflat([])                  === 0, 'muflat([]) === 0')
assert(br.AGGR.muflat([4, 0])              === 4, 'muflat([4,0]) === 4')

;(async () => {
  const server = http.createServer(serve)
  await new Promise(r => server.listen(PORT, r))
  const port = server.address().port
  const browser = await puppeteer.launch({ headless: true })

  // --- 1. basic_test.html: read-only graph with .bb file ---
  await runQual(browser, port, 'basic', '/quals/basic_test.html',
    async (page, name) => {
      await checkGraph(page, name)
      const extras = await page.evaluate(() => ({
        tableHTML: document.getElementById('table')?.innerHTML?.length || 0,
        jsonHTML:  document.getElementById('json')?.innerHTML?.length || 0,
      }))
      assert(extras.tableHTML > 100,
        `${name}: road table populated (${extras.tableHTML} chars)`)
      assert(extras.jsonHTML > 100,
        `${name}: JSON dump populated (${extras.jsonHTML} chars)`)
    })

  // --- 2. roadeditor_test.html: editor + read-only graph, loads testroad0 ---
  await runQual(browser, port, 'roadeditor', '/quals/roadeditor_test.html',
    async (page, name) => {
      // This page has two graphs: editor (hidden initially) and graph (visible)
      // The visible graph is the second SVG since the editor div comes first in DOM
      const counts = await page.evaluate(() => {
        const svgs = document.querySelectorAll('svg.bmndrsvg')
        return {
          nSVGs: svgs.length,
          // The visible (graph) SVG should have graph elements
          visibleSVG: svgs.length >= 2,
        }
      })
      assert(counts.nSVGs >= 2,
        `${name}: both editor and graph SVGs exist (found ${counts.nSVGs})`)
      await checkGraph(page, name)

      // Road editor specific: check that the road table div exists
      const editorChecks = await page.evaluate(() => ({
        hasRoadTable: !!document.getElementById('roadtable'),
        hasDuebyTable: !!document.getElementById('duebytable'),
      }))
      assert(editorChecks.hasRoadTable,
        `${name}: road table div exists`)
      assert(editorChecks.hasDuebyTable,
        `${name}: dueby table div exists`)
    })

  // --- 3. sandbox.html: creates a new goal from scratch ---
  await runQual(browser, port, 'sandbox', '/quals/sandbox.html',
    async (page, name) => {
      await checkGraph(page, name)
      const extras = await page.evaluate(() => ({
        hasDueby: !!document.getElementById('dueby')?.innerHTML,
      }))
      assert(extras.hasDueby, `${name}: dueby table populated`)
    })

  // --- Done ---
  await browser.close()
  server.close()

  if (failures.length) {
    console.log(`\n${failures.length} FAILURE(S)`)
    process.exit(1)
  }
  console.log('\nAll quals passed.')
  process.exit(0)
})()
