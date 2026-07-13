/* This file is all Claude, but it's just quals, not code users run */

// Puppeteer quals: load graph pages and verify they render correctly
const puppeteer = require('puppeteer')
const http = require('http')
const fs = require('fs')
const path = require('path')
const ejs = require('ejs')
const nodeAssert = require('assert')
const br = require('../src/broad')
const bu = require('../src/butil')
const bb = require('../src/beebrain')

const REPO = path.resolve(__dirname, '..')
const PORT = 0 // let OS pick an available port

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css', '.bb': 'text/plain', '.svg': 'image/svg+xml',
}

const GRAPHEDITOR_PATH = '/quals/grapheditor.html'
const GRAPHEDITOR_TEMPLATE = fs.readFileSync(
  path.join(REPO, 'views/grapheditor.ejs'), 'utf8')
const EDITOR_START = GRAPHEDITOR_TEMPLATE.indexOf('<section id="editor"')
const EDITOR_END = GRAPHEDITOR_TEMPLATE.indexOf('<section id="sandbox"')
nodeAssert(EDITOR_START >= 0)
nodeAssert(EDITOR_END > EDITOR_START)
const EDITOR_MARKUP = GRAPHEDITOR_TEMPLATE.slice(EDITOR_START, EDITOR_END)
const QUAL_ROUTES = {
  [GRAPHEDITOR_PATH]: {
    contentType: MIME['.html'],
    body: ejs.render(GRAPHEDITOR_TEMPLATE, {user: {username: 'qual'}}),
  },
  '/getusergoals': {
    contentType: 'application/json',
    body: JSON.stringify(['testroad0']),
  },
  '/getgoaljson/testroad0': {
    contentType: 'application/json',
    body: fs.readFileSync(path.join(REPO, 'automon/data/testroad0.bb')),
  },
  // What a dead session actually serves: the XHR gets 302ed to the login
  // page, so the goal-JSON request comes back as an HTML document
  '/getgoaljson/htmlgoal': {
    contentType: MIME['.html'],
    body: '<!DOCTYPE html>\n<html><body>Pretend login page</body></html>',
  },
}

function serve(req, res) {
  const route = QUAL_ROUTES[req.url]
  if (route) {
    res.writeHead(200, { 'Content-Type': route.contentType })
    res.end(route.body)
    return
  }

  // Map URL paths to filesystem: the qual HTML uses relative ../src/ paths
  // and loads .bb files from absolute paths
  const fpath = path.join(REPO, req.url)

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
async function runQual(browser, port, name, urlPath, checkFn,
                       viewport = {width: 800, height: 600}) {
  console.log(`\n--- ${name} ---`)
  const page = await browser.newPage()
  await page.setViewport(viewport)

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

  // Wait for async graph rendering (specifically for the bright red line, which
  // is the last thing drawn and confirms the graph fully rendered)
  try {
    await page.waitForSelector('svg.bmndrsvg .razr', { timeout: 30000 })
  } catch (e) {
    failures.push(`${name}: graph never rendered (no .razr found)`)
    await page.close()
    return
  }

  assert(pageErrors.length === 0,
    `${name}: page errors: ${pageErrors.join('; ')}`)

  await checkFn(page, name)

  assert(pageErrors.length === 0,
    `${name}: page errors after interaction: ${pageErrors.join('; ')}`)

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

// ---------------------------------------------------------------------------
// Static-analysis quals: correctness-only lint over all first-party js
// ---------------------------------------------------------------------------
// Three separate crashes have come from assigning to a const in a rarely-hit
// branch (`const diff` in redrawXTicks, `const maxind` in knotDragged,
// `const npts` in updateSteppy), each dormant until someone hit the branch.
// These rules are deterministic single-file correctness checks with no style
// component. no-unmodified-loop-condition is deliberately absent: it
// false-positives on broad.js loops whose conditions change via mutation.
console.log('\n--- static-analysis quals ---')
;(() => {
  const { Linter } = require('eslint')
  const linter = new Linter()
  const files = [
    'src/butil.js', 'src/broad.js', 'src/beebrain.js', 'src/bgraph.js',
    'src/bsandbox.js', 'src/btest.js', 'src/grapheditor.js',
    'app/server.js', 'jsbrain_server/jsbrain_server.js',
    'jsbrain_server/renderer.js',
  ]
  const rules = {
    'no-const-assign':               'error',
    'no-dupe-args':                  'error',
    'no-dupe-keys':                  'error',
    'no-dupe-else-if':               'error',
    'no-func-assign':                'error',
    'no-self-assign':                'error',
    'no-self-compare':               'error',
    'use-isnan':                     'error',
    'valid-typeof':                  'error',
    'no-unreachable':                'error',
    'no-compare-neg-zero':           'error',
    'no-constant-binary-expression': 'error',
    'for-direction':                 'error',
    'no-setter-return':              'error',
    'getter-return':                 'error',
  }
  for (const f of files) {
    const code = fs.readFileSync(path.join(REPO, f), 'utf8')
    const msgs = linter.verify(code, {
      languageOptions: { ecmaVersion: 2022, sourceType: 'script' },
      rules,
    })
    for (const m of msgs)
      assert(false,
        `static ${f}:${m.line}:${m.column} [${m.ruleId}] ${m.message}`)
  }
})()

// ---------------------------------------------------------------------------
// Unit quals: pure functions, no browser needed
// ---------------------------------------------------------------------------

// --- butil: type checks ---
console.log('\n--- butil unit quals ---')
assert(bu.nummy(3)        === true,  'nummy(3)')
assert(bu.nummy('3.14')   === true,  'nummy("3.14")')
assert(bu.nummy('abc')    === false, 'nummy("abc")')
assert(bu.nummy(NaN)      === false, 'nummy(NaN)')
assert(bu.nummy(Infinity) === false, 'nummy(Infinity)')
assert(bu.norn(null)       === true,  'norn(null)')
assert(bu.norn(3)          === true,  'norn(3)')
assert(bu.norn('abc')      === false, 'norn("abc")')
assert(bu.stringy('hi')    === true,  'stringy("hi")')
assert(bu.stringy(3)       === false, 'stringy(3)')
assert(bu.listy([])        === true,  'listy([])')
assert(bu.listy({})        === false, 'listy({})')

// --- butil: arrMin, arrMax ---
assert(bu.arrMin([3,1,2])    === 1,  'arrMin([3,1,2])')
assert(bu.arrMax([3,1,2])    === 3,  'arrMax([3,1,2])')
assert(bu.arrMin([5])        === 5,  'arrMin([5])')
assert(bu.arrMax([5])        === 5,  'arrMax([5])')
assert(bu.arrMin([-3,-1,-2]) === -3, 'arrMin([-3,-1,-2])')
assert(bu.arrMax([-3,-1,-2]) === -1, 'arrMax([-3,-1,-2])')
;(function() { // spread-based min(...a) blows the call stack on huge arrays
  const big = Array.from({length: 200000}, (_, i) => i % 1000)
  big[123456] = -1
  big[654]    = 1001
  assert(bu.arrMin(big) === -1,   'arrMin on 200k-element array')
  assert(bu.arrMax(big) === 1001, 'arrMax on 200k-element array')
})()

// --- butil: extendo ---
;(function() {
  const dst = {a: 1, b: {c: 2, d: 3}}
  bu.extendo(dst, {b: {c: 5}})
  assert(dst.b.c === 5 && dst.b.d === 3,
    'extendo deep merge preserves unset keys')
})()
;(function() {
  const dst = {a: 1}
  bu.extendo(dst, {b: 2})
  assert(dst.a === 1 && dst.b === 2, 'extendo adds new keys')
})()

// --- butil: deepcopy ---
;(function() {
  const orig = {a: 1, b: [2, 3], c: {d: 4}}
  const copy = bu.deepcopy(orig)
  assert(copy.a === 1 && copy.b[0] === 2 && copy.c.d === 4,
    'deepcopy copies values')
  copy.c.d = 99
  assert(orig.c.d === 4, 'deepcopy is deep')
})()

// --- butil: partition ---
assert(bu.partition([1,2,3,4,5], 2, 2).length === 2, 'partition length')
assert(bu.arrayEquals(bu.partition([1,2,3,4,5], 2, 2)[0], [1,2]),
  'partition([1..5],2,2)[0]')
assert(bu.arrayEquals(bu.partition([1,2,3,4,5], 2, 2)[1], [3,4]),
  'partition([1..5],2,2)[1]')
assert(bu.partition([], 2, 2).length === 0, 'partition empty')

// --- butil: quantile ---
assert(bu.quantile([1,2,3,4,5], 0.5) === 3, 'quantile median of [1..5]')
assert(bu.quantile([1,2,3,4,5], 0)   === 1, 'quantile 0th of [1..5]')
assert(bu.quantile([1,2,3,4,5], 1)   === 5, 'quantile 1st of [1..5]')

// --- butil: sum ---
assert(bu.sum([1,2,3]) === 6, 'sum([1,2,3])')
assert(bu.sum([])      === 0, 'sum([])')
assert(bu.sum([5])     === 5, 'sum([5])')
assert(bu.sum([-1,1])  === 0, 'sum([-1,1])')

// --- butil: accumulate ---
assert(bu.arrayEquals(bu.accumulate([1,2,3]), [1,3,6]),  'accumulate([1,2,3])')
assert(bu.arrayEquals(bu.accumulate([]),      []),        'accumulate([])')
assert(bu.arrayEquals(bu.accumulate([5]),     [5]),       'accumulate([5])')
assert(bu.arrayEquals(bu.accumulate([1,-1,2]),[1,0,2]),   'accumulate([1,-1,2])')

// --- butil: monotonize ---
assert(bu.arrayEquals(bu.monotonize([1,2,1]),    [1,2,2]),  'monotonize up [1,2,1]')
assert(bu.arrayEquals(bu.monotonize([3,1,2]),    [3,3,3]),  'monotonize up [3,1,2]')
assert(bu.arrayEquals(bu.monotonize([1,2,1],-1), [1,1,1]),  'monotonize dn [1,2,1]')
assert(bu.arrayEquals(bu.monotonize([3,1,2],-1), [3,1,1]),  'monotonize dn [3,1,2]')
assert(bu.arrayEquals(bu.monotonize([]),          []),       'monotonize empty')

// --- butil: zip ---
assert(bu.arrayEquals(bu.zip([[1,2],[3,4]])[0], [1,3]), 'zip row 0')
assert(bu.arrayEquals(bu.zip([[1,2],[3,4]])[1], [2,4]), 'zip row 1')

// --- butil: chop ---
assert(bu.chop(1e-8)  === 0,   'chop(1e-8)')
assert(bu.chop(-1e-8) === 0,   'chop(-1e-8)')
assert(bu.chop(0.5)   === 0.5, 'chop(0.5)')
assert(bu.chop(0)     === 0,   'chop(0)')

// --- butil: clip ---
assert(bu.clip(5,  0, 10) === 5,  'clip mid')
assert(bu.clip(-5, 0, 10) === 0,  'clip below')
assert(bu.clip(15, 0, 10) === 10, 'clip above')
assert(bu.clip(5, 10, 0)  === 5,  'clip swapped bounds')

// --- butil: searchLow, searchHigh (examples from the code comments) ---
assert(bu.searchLow([7,7,7],  x => x-7) === 0, 'searchLow [7,7,7] first 7')
assert(bu.searchHigh([7,7,7], x => x-7) === 2, 'searchHigh [7,7,7] last 7')
assert(bu.searchLow([-1,3,4,7,7,7,9,9],  x => x-7) === 3,
  'searchLow finds first 7')
assert(bu.searchHigh([-1,3,4,7,7,7,9,9], x => x-7) === 5,
  'searchHigh finds last 7')
assert(bu.searchLow([-1,3,4,9,9],  x => x-7) === 2,
  'searchLow errs low (4)')
assert(bu.searchHigh([-1,3,4,9,9], x => x-7) === 3,
  'searchHigh errs high (9)')
assert(bu.searchLow([-2,-2,-1,4,6],  x => x-7) === 4,
  'searchLow all too small')
assert(bu.searchHigh([-2,-2,-1,4,6], x => x-7) === 5,
  'searchHigh all too small')
assert(bu.searchLow([8,8,9,12,13],  x => x-7) === -1,
  'searchLow all too big')
assert(bu.searchHigh([8,8,9,12,13], x => x-7) === 0,
  'searchHigh all too big')

// --- butil: searchLow/searchHigh edge cases ---
assert(bu.searchLow([],    x => x-7) === -1, 'searchLow empty array')
assert(bu.searchHigh([],   x => x-7) === 0,  'searchHigh empty array')
assert(bu.searchLow(null,  x => x-7) === -1, 'searchLow null')
assert(bu.searchHigh(null, x => x-7) === 0,  'searchHigh null')
assert(bu.searchLow([7],  x => x-7) === 0,  'searchLow single match')
assert(bu.searchHigh([7], x => x-7) === 0,  'searchHigh single match')
assert(bu.searchLow([7],  x => x-3) === -1, 'searchLow single too big')
assert(bu.searchHigh([7], x => x-3) === 0,  'searchHigh single too big')
assert(bu.searchLow([7],  x => x-10) === 0, 'searchLow single too small')
assert(bu.searchHigh([7], x => x-10) === 1, 'searchHigh single too small')

// --- butil: shn, splur ---
assert(String(bu.shn(3.14159, 4, 2)) === '3.14', 'shn(3.14159,4,2)')
assert(String(bu.shn(0))             === '0',     'shn(0)')
assert(String(bu.shn(NaN))           === 'NaN',   'shn(NaN)')
assert(bu.splur(1, 'boy')            === '1 boy',  'splur singular')
assert(bu.splur(3, 'boy')            === '3 boys', 'splur plural')
assert(bu.splur(3, 'man', 'men')     === '3 men',  'splur irregular')

// --- butil: conservaround ---
assert(bu.conservaround(3.14, 0.1)     === 3.1, 'conservaround basic')
assert(bu.conservaround(3.14, 0.1, -1) === 3.1, 'conservaround down')
assert(bu.conservaround(3.14, 0.1, 1)  === 3.2, 'conservaround up')

// --- butil: linspace ---
assert(bu.arrayEquals(bu.linspace(0, 1, 3), [0, 0.5, 1]), 'linspace(0,1,3)')
assert(bu.arrayEquals(bu.linspace(0, 1, 1), [0]),          'linspace single')
assert(bu.arrayEquals(bu.linspace(0, 1, 0), []),            'linspace empty')

// --- butil: rescale ---
assert(bu.rescale(5,  0, 10, 0, 100) === 50,  'rescale mid')
assert(bu.rescale(0,  0, 10, 0, 100) === 0,   'rescale left')
assert(bu.rescale(10, 0, 10, 0, 100) === 100, 'rescale right')

// --- butil: deldups ---
assert(bu.arrayEquals(bu.deldups([1,2,1,3,2]), [1,2,3]), 'deldups basic')
assert(bu.arrayEquals(bu.deldups([]),           []),       'deldups empty')
assert(bu.arrayEquals(bu.deldups([1,1,1]),      [1]),      'deldups all same')

// --- butil: orderedq ---
assert(bu.orderedq([1,2,3]) === true,  'orderedq sorted')
assert(bu.orderedq([1,1,2]) === true,  'orderedq with dups')
assert(bu.orderedq([3,2,1]) === false, 'orderedq unsorted')
assert(bu.orderedq([])      === true,  'orderedq empty')
assert(bu.orderedq([5])     === true,  'orderedq single')

// --- butil: unaryflat ---
assert(bu.unaryflat([0,0,1]) === true,  'unaryflat with nonzero')
assert(bu.unaryflat([0,0,0]) === false, 'unaryflat all zero')
assert(bu.unaryflat([])      === false, 'unaryflat empty')

// --- butil: clocky ---
assert(bu.clocky([1,2,6,9]) === 4, 'clocky([1,2,6,9])')
assert(bu.clocky([1,2,6])   === 1, 'clocky odd ignores last')
assert(bu.clocky([])         === 0, 'clocky empty')
// CLOCKYFIX (beebody gissue #4382, reverted for now -- see butil.js): clocky
// takes strict differences, negative when the second element of a pair is
// smaller. If the midnight-wrapping behavior ships as its own aggday (per
// the recommendation in butil.js), these expectations apply to THAT aggday,
// not to clocky:
//   clocky([22.5, 6]) === 7.5  midnight crossing (#4382): (6-22.5)+24
//   clocky([23, 1])   === 2    midnight crossing 23->1:   (1-23)+24
assert(bu.clocky([22.5, 6]) === -16.5,
  'clocky strict difference, no midnight wrap (CLOCKYFIX)')
assert(bu.clocky([23, 1])   === -22,
  'clocky strict difference 23->1 (CLOCKYFIX)')
// A real goal shape the midnight wrap must never apply to: a daily pair of
// (actual wake time, alarm time), where a negative difference means "woke up
// late", not "spans midnight". Eg, woke at 4:00 against a 3:45 alarm:
assert(bu.clocky([4, 3.75]) === -0.25,
  'clocky (measurement, reference) pair stays negative (CLOCKYFIX)')

// --- butil: mean, median, mode, trimmean ---
assert(bu.mean([1,2,3]) === 2, 'mean([1,2,3])')
assert(bu.mean([])      === 0, 'mean([])')
assert(bu.mean([5])     === 5, 'mean([5])')
assert(bu.median([3,1,2])   === 2,   'median odd')
assert(bu.median([4,1,3,2]) === 2.5, 'median even')
assert(bu.median([5])        === 5,   'median single')
;(function() { // median must not mutate its input
  const a = [3,1,2]
  bu.median(a)
  assert(bu.arrayEquals(a, [3,1,2]), 'median does not mutate input')
})()
assert(bu.mode([1,2,2,3])   === 2,   'mode basic')
assert(bu.mode([1,1,2,2,2]) === 2,   'mode tiebreaker')
assert(bu.mode([5])          === 5,   'mode single')
assert(bu.trimmean([1,2,3,4,5,6,7,8,9,10], 0.1) === 5.5, 'trimmean basic')
;(function() { // trimmean must not mutate its input
  const a = [10,1,5,3,8,2,7,4,9,6]
  bu.trimmean(a, 0.1)
  assert(bu.arrayEquals(a, [10,1,5,3,8,2,7,4,9,6]), 'trimmean does not mutate input')
})()

// --- butil: nearEq ---
assert(bu.nearEq(1, 1.0001, 0.001) === true,  'nearEq close')
assert(bu.nearEq(1, 2,      0.001) === false, 'nearEq far')

// --- butil: dayparse, dayify, formatDate roundtrip ---
assert(bu.dayify(bu.dayparse("20170531"))     === "20170531",   'dayparse/dayify roundtrip')
assert(bu.formatDate(bu.dayparse("20170531")) === "2017.05.31", 'formatDate')
assert(bu.dayparse(null) === null, 'dayparse(null)')

// --- butil: dayify throws on invalid input (anti-robustness) ---
;(function() {
  assert(bu.dayify(null) === null, 'dayify(null) returns null')
  assert(bu.dayify(0) === '19700101', 'dayify(0) is epoch')
  let threw
  threw = false
  try { bu.dayify(NaN) } catch(e) { threw = true }
  assert(threw, 'dayify(NaN) throws')
  threw = false
  try { bu.dayify(-1) } catch(e) { threw = true }
  assert(threw, 'dayify(-1) throws')
  threw = false
  try { bu.dayify(Infinity) } catch(e) { threw = true }
  assert(threw, 'dayify(Infinity) throws')
})()

// --- butil: daysnap, monthsnap, yearsnap ---
;(function() {
  const t = bu.dayparse("20170531")
  assert(bu.daysnap(t)         === t,                     'daysnap at midnight')
  assert(bu.daysnap(t + 3600)  === t,                     'daysnap rounds down')
  assert(bu.monthsnap(t)       === bu.dayparse("20170501"), 'monthsnap to 1st')
  assert(bu.yearsnap(t)        === bu.dayparse("20170101"), 'yearsnap to Jan 1')
})()

// --- butil: toTitleCase ---
assert(bu.toTitleCase('hello world') === 'Hello World', 'toTitleCase')

// --- butil: arrayEquals ---
assert(bu.arrayEquals([1,2,3], [1,2,3])       === true,  'arrayEquals same')
assert(bu.arrayEquals([1,2],   [1,2,3])       === false, 'arrayEquals diff len')
assert(bu.arrayEquals([1,2,3], [1,2,4])       === false, 'arrayEquals diff val')
assert(bu.arrayEquals([[1,2],[3]], [[1,2],[3]]) === true,  'arrayEquals nested')

// --- butil: lineval, lineintersect ---
assert(bu.lineval([0,0], [10,10], 5)  === 5,  'lineval midpoint')
assert(bu.lineval([0,0], [10,10], 0)  === 0,  'lineval start')
assert(bu.lineval([0,0], [10,10], 10) === 10, 'lineval end')
;(function() {
  const p = bu.lineintersect([0,0],[10,10],[0,10],[10,0])
  assert(p !== null,              'lineintersect X has result')
  assert(Math.abs(p[0]-5) < 1e-10, 'lineintersect X at x=5')
  assert(Math.abs(p[1]-5) < 1e-10, 'lineintersect X at y=5')
})()
assert(bu.lineintersect([0,0],[1,0],[0,1],[1,1]) === null,
  'lineintersect parallel')

// --- aggday functions ---
console.log('\n--- aggday unit quals ---')
assert(br.AGGR.sum([1,2,3])   === 6, 'aggday sum')
assert(br.AGGR.sum([])        === 0, 'aggday sum empty')
assert(br.AGGR.last([1,2,3])  === 3, 'aggday last')
assert(br.AGGR.first([1,2,3]) === 1, 'aggday first')
assert(br.AGGR.min([3,1,2])   === 1, 'aggday min')
assert(br.AGGR.max([3,1,2])   === 3, 'aggday max')
assert(br.AGGR.count([1,2,3]) === 3, 'aggday count')
assert(br.AGGR.count([])      === 0, 'aggday count empty')
assert(br.AGGR.mu([1,2,3])       === 2, 'aggday mu')
assert(br.AGGR.truemean([1,2,3]) === 2, 'aggday truemean (alias)')
assert(br.AGGR.average([1,2,3])  === 2, 'aggday average (alias)')
assert(br.AGGR.munique([1,2,2,3])  === 2, 'aggday munique')
assert(br.AGGR.uniqmean([1,2,2,3]) === 2, 'aggday uniqmean (alias)')
assert(br.AGGR.mean([1,2,2,3])     === 2, 'aggday mean (alias)')
assert(br.AGGR.mutrim([1,2,3,4,5,6,7,8,9,10])   === 5.5, 'aggday mutrim')
assert(br.AGGR.trimmean([1,2,3,4,5,6,7,8,9,10]) === 5.5, 'aggday trimmean (alias)')
assert(br.AGGR.median([3,1,2])   === 2, 'aggday median')
assert(br.AGGR.mode([1,2,2,3])   === 2, 'aggday mode')
assert(br.AGGR.unary([1])    === 1, 'aggday unary nonempty')
assert(br.AGGR.unary([])     === 0, 'aggday unary empty')
assert(br.AGGR.unary([0])    === 1, 'aggday unary with zero')
assert(br.AGGR.binary([1])   === 1, 'aggday binary (alias)')
assert(br.AGGR.jolly([1])    === 1, 'aggday jolly (alias)')
assert(br.AGGR.unaryflat([0,0,1]) === true,  'aggday unaryflat true')
assert(br.AGGR.unaryflat([0,0,0]) === false, 'aggday unaryflat false')
assert(br.AGGR.nonzero([0,1])     === true,  'aggday nonzero (alias)')
assert(br.AGGR.triangle([3]) === 6, 'aggday triangle 3*(3+1)/2')
assert(br.AGGR.square([3])   === 9, 'aggday square 3^2')
assert(br.AGGR.clocky([1,2,6,9]) === 4, 'aggday clocky')
// CLOCKYFIX (reverted #4382 midnight wrap, see butil.js): strict difference.
// Under the reverted behavior this was 7.5, ie, (6-22.5)+24.
assert(br.AGGR.clocky([22.5, 6])  === -16.5,
  'aggday clocky strict difference (CLOCKYFIX)')
assert(br.AGGR.skatesum([1,2,3]) === 0, 'aggday skatesum (rsk8=0)')

// --- skatesum FP consistency (github.com/beeminder/road/issues/250) ---
// Verify that the two computation paths for rsk8 actually differ, confirming
// the bug that was fixed. With rfin=0.03 and siru=SID=86400:
//   rfin * SID / siru  (old) !== (rfin / siru) * SID  (new, matches fillroad)
;(function() {
  const SID = 86400
  const rfin = 0.03
  const siru = SID
  const oldRsk8 = rfin * SID / siru
  const newRsk8 = (rfin / siru) * SID
  assert(oldRsk8 !== newRsk8,
    'skatesum FP: old vs new rsk8 computation paths differ')
  // The fillroad-matching path must produce a value that survives the
  // divide-then-multiply roundtrip, i.e., (rfin/siru)*SID === (rfin/siru)*SID
  const slope = rfin / siru
  const dailyRate = slope * SID
  assert(newRsk8 === dailyRate,
    'skatesum FP: rsk8 matches fillroad daily rate exactly')
  assert(400 * (oldRsk8 - dailyRate) !== 0,
    'skatesum FP: old path accumulates error over many days')
  assert(400 * (newRsk8 - dailyRate) === 0,
    'skatesum FP: new path has zero accumulated error')
  // Verify skatesum caps correctly when rsk8 is set via the matching path
  br.rsk8 = newRsk8
  assert(br.AGGR.skatesum([1]) === newRsk8,
    'skatesum FP: caps at rsk8 when input exceeds rate')
  assert(br.AGGR.skatesum([0.01]) === 0.01,
    'skatesum FP: passes through when input below rate')
  br.rsk8 = 0 // restore default
})()

// --- kyoom FP accumulation drift (gissue #250) ---
// Repeated FP addition of the daily rate drifts from the road's single-
// multiplication value. The old aok tolerance (abs(v)*-1e-15) was too tight;
// the fix is to use gdelt (which uses bu.chop with 1e-7 tolerance).
/*
;(function() {
  const SID = 86400
  const rfin = 0.03
  const siru = SID
  const slope = rfin / siru
  const dailyRate = slope * SID
  // Simulate 400 days of kyoom accumulation via repeated addition
  let kyoom = 0
  for (let i = 0; i < 400; i++) kyoom += dailyRate
  // Road computes its value with a single multiplication
  const roadVal = slope * (400 * SID)
  const deficit = kyoom - roadVal
  // The deficit is real and negative (repeated addition undershoots)
  assert(deficit < 0,
    'kyoom FP drift: repeated addition undershoots road value')
  assert(Math.abs(deficit) > 1e-14,
    'kyoom FP drift: error magnitude is significant (~6e-14)')
  // The deficit exceeds what the old aok tolerance could handle
  const oldTolerance = Math.abs(kyoom) * -1e-15
  assert(deficit < oldTolerance,
    'kyoom FP drift: deficit exceeds old aok tolerance')
  // But bu.chop (1e-7) correctly treats the deficit as zero
  assert(bu.chop(deficit) === 0,
    'kyoom FP drift: bu.chop treats deficit as zero')
  // And the new aok (via gdelt) handles it correctly
  const rd = [
    {sta: [0, 0], end: [400*SID, roadVal], slope: slope, auto: 0},
    {sta: [400*SID, roadVal], end: [800*SID, roadVal], slope: 0, auto: 0},
  ]
  const g = {yaw: 1}
  assert(br.aok(rd, g, 400*SID, kyoom) === true,
    'kyoom FP drift: aok accepts accumulated value')
  assert(br.gdelt(rd, g, 400*SID, kyoom) >= 0,
    'kyoom FP drift: gdelt treats deficit as non-negative')
})()
*/
assert(br.AGGR.satsum([0.3,0.4,0.5]) === 1,   'aggday satsum capped')
assert(br.AGGR.satsum([0.3,0.2])     === 0.5,  'aggday satsum uncapped')
assert(br.AGGR.cap1([0.3,0.4,0.5])   === 1,    'aggday cap1 (alias)')
assert(br.AGGR.sqrt([4]) === 2, 'aggday sqrt(4)')
assert(br.AGGR.sqrt([9]) === 3, 'aggday sqrt(9)')
assert(br.AGGR.countflat([1,0,2,0,3]) === 3, 'aggday countflat')
assert(br.AGGR.countflat([0,0,0])     === 0, 'aggday countflat all zero')
assert(br.AGGR.countflat([])          === 0, 'aggday countflat empty')
assert(br.AGGR.countflat([5])         === 1, 'aggday countflat single')
assert(br.AGGR.muflat([1,0,2,0,3])   === 2, 'aggday muflat')
assert(br.AGGR.muflat([0,0,0])       === 0, 'aggday muflat all zero')
assert(br.AGGR.muflat([])            === 0, 'aggday muflat empty')
assert(br.AGGR.muflat([4,0])         === 4, 'aggday muflat single nonzero')

// --- broad: isoval endpoint clamping (bgraph getisopath depends on this) ---
// An isoline is a list of [x,y] pairs. Outside the covered x-range isoval
// clamps to the endpoint y. bgraph.getisopath simplifies to "always call
// isoval, clamped via max" — that only works if isoval(isoline, isoline[0][0])
// returns isoline[0][1] exactly (not NaN, not interpolated).
;(function() {
  const iso = [[10, 100], [20, 200], [30, 300]]
  assert(br.isoval(iso, 10) === 100, 'isoval at left endpoint returns y0')
  assert(br.isoval(iso, 30) === 300, 'isoval at right endpoint returns yN')
  assert(br.isoval(iso, 5)  === 100, 'isoval left of range clamps to y0')
  assert(br.isoval(iso, 35) === 300, 'isoval right of range clamps to yN')
  assert(br.isoval(iso, 15) === 150, 'isoval interpolates midpoint')
  assert(br.isoval(iso, 25) === 250, 'isoval interpolates midpoint 2')
  assert(br.isoval([],   5) === null, 'isoval empty returns null')
  assert(br.isoval(null, 5) === null, 'isoval null returns null')
  // Single-point isoline: both endpoints are the same point
  const iso1 = [[10, 100]]
  assert(br.isoval(iso1, 5)  === 100, 'isoval single-point clamps left')
  assert(br.isoval(iso1, 10) === 100, 'isoval single-point at point')
  assert(br.isoval(iso1, 15) === 100, 'isoval single-point clamps right')
})()

// --- broad: interpData (single datapoint case) ---
;(function() {
  const d = [[5, 10]]     // single datapoint at x=5, y=10
  const xv = [1, 5, 9]    // interpolate at these x values
  const result = br.interpData(d, xv)
  assert(result.length === 3,    'interpData single-pt length')
  assert(result[0][1] === 10,    'interpData single-pt y=10 at x=1')
  assert(result[1][1] === 10,    'interpData single-pt y=10 at x=5')
  assert(result[2][1] === 10,    'interpData single-pt y=10 at x=9')
})()

// --- broad: interpData (multi-point case) ---
;(function() {
  const d = [[0, 0], [10, 100]]
  const xv = [0, 5, 10]
  const result = br.interpData(d, xv)
  assert(result[0][1] === 0,   'interpData multi start')
  assert(result[1][1] === 50,  'interpData multi midpoint')
  assert(result[2][1] === 100, 'interpData multi end')
})()

// --- broad: road segment helpers ---
// A road segment has {sta: [t,v], end: [t,v], slope, auto}
;(function() {
  const seg = {sta: [0, 0], end: [100, 200], slope: 2, auto: 0}

  // segSlope: (end_v - sta_v) / (end_t - sta_t)
  assert(br.segSlope(seg) === 2, 'segSlope basic')

  // segValue: sta_v + slope * (x - sta_t)
  assert(br.segValue(seg, 0)   === 0,   'segValue at start')
  assert(br.segValue(seg, 50)  === 100, 'segValue at midpoint')
  assert(br.segValue(seg, 100) === 200, 'segValue at end')
})()

// --- broad: sameRoads, copyRoad ---
;(function() {
  const s = {sta: [0, 0], end: [100, 200], slope: 2, auto: 0}
  const rd = [s]
  const rd2 = br.copyRoad(rd)
  assert(br.sameRoads(rd, rd2), 'sameRoads identical copy')
  rd2[0].end[1] = 999
  assert(!br.sameRoads(rd, rd2), 'sameRoads after mutation')
  assert(rd[0].end[1] === 200, 'copyRoad is deep (original unaffected)')
})()

// --- broad: findSeg, rdf, rtf ---
;(function() {
  // Two segments: [0,0]->[100,100] slope 1, [100,100]->[200,300] slope 2
  const rd = [
    {sta: [0,   0], end: [100, 100], slope: 1, auto: 0},
    {sta: [100,100], end: [200, 300], slope: 2, auto: 0},
  ]
  assert(br.findSeg(rd, 50) === 0,  'findSeg first segment')
  assert(br.findSeg(rd, 150) === 1, 'findSeg second segment')
  assert(br.rdf(rd, 0) === 0,       'rdf at start')
  assert(br.rdf(rd, 50) === 50,     'rdf midpoint of seg 0')
  assert(br.rdf(rd, 150) === 200,   'rdf midpoint of seg 1')
  assert(br.rtf(rd, 50) === 1,      'rtf slope of seg 0')
  assert(br.rtf(rd, 150) === 2,     'rtf slope of seg 1')
})()

// --- broad: tvr (given 2 of 3 of t/v/r, compute the 3rd) ---
;(function() {
  // tp=0, vp=0 (previous endpoint)
  // If we know v=100 and r=2 (per second), then t = 0 + 100/2 = 50
  // (tvr daysnaps so we test r=null and v=null cases instead)
  assert(br.tvr(0, 0, 100, null, 2)  === 200,  'tvr solve for v')
  assert(br.tvr(0, 0, 100, 200, null) === 2,   'tvr solve for r')
  assert(br.tvr(0, 0, 0, 100, null)   === 0,   'tvr zero-length segment r=0')
})()

// --- broad: stepFunc, stepify ---
;(function() {
  const d = [[10, 1], [20, 2], [30, 3]]
  assert(br.stepFunc(d, 5)  === 1, 'stepFunc before first')
  assert(br.stepFunc(d, 10) === 1, 'stepFunc at first')
  assert(br.stepFunc(d, 15) === 1, 'stepFunc between 1st and 2nd')
  assert(br.stepFunc(d, 20) === 2, 'stepFunc at second')
  assert(br.stepFunc(d, 25) === 2, 'stepFunc between 2nd and 3rd')
  assert(br.stepFunc(d, 30) === 3, 'stepFunc at third')

  const f = br.stepify(d)
  assert(f(15) === 1, 'stepify returns working step function')
  assert(f(25) === 2, 'stepify mid value')

  const empty = br.stepify(null)
  assert(empty(42) === 0, 'stepify null returns zero function')
})()

// --- broad: vertseg ---
;(function() {
  // Two segments that share the same start time = vertical
  const rd = [
    {sta: [0,  0], end: [100, 100], slope: 1, auto: 0},
    {sta: [100,100], end: [100, 200], slope: Infinity, auto: 0},
    {sta: [100,200], end: [200, 300], slope: 1, auto: 0},
  ]
  assert(br.vertseg(rd, 100) === true,  'vertseg at vertical')
  assert(br.vertseg(rd, 0)   === false, 'vertseg at non-vertical')
  assert(br.vertseg(rd, 200) === false, 'vertseg at unique boundary')
})()

// --- broad: gapFill ---
;(function() {
  const SID = 86400
  const d = [[0, 0], [3*SID, 30]]  // 3 days apart, linear from 0 to 30
  const filled = br.gapFill(d)
  assert(filled.length === 4,      'gapFill fills 4 points (inclusive)')
  assert(filled[0][0] === 0,       'gapFill day 0 time')
  assert(filled[0][1] === 0,       'gapFill day 0 value')
  assert(filled[1][0] === SID,     'gapFill day 1 time')
  assert(filled[1][1] === 10,      'gapFill day 1 interpolated')
  assert(filled[2][0] === 2*SID,   'gapFill day 2 time')
  assert(filled[2][1] === 20,      'gapFill day 2 interpolated')
  assert(filled[3][0] === 3*SID,   'gapFill day 3 time (endpoint)')
  assert(filled[3][1] === 30,      'gapFill day 3 value (endpoint)')
  assert(bu.arrayEquals(br.gapFill([]), []), 'gapFill empty')
})()

// --- broad: tareify ---
// A tare resets the "zero" like taring a scale. After taring at value 0 when
// previous was 70, cumdelt becomes -70, so subsequent values get +70 added.
;(function() {
  const data = [[1, 70, ''], [2, 70, ''], [3, 0, 'tare'], [4, 50, '']]
  br.tareify(data, c => c === 'tare')
  assert(data[0][1] === 70,  'tareify before tare unchanged')
  assert(data[1][1] === 70,  'tareify before tare unchanged 2')
  assert(data[2][1] === 70,  'tareify at tare preserves continuity')
  assert(data[3][1] === 120, 'tareify after tare offset by 70')
})()

// --- SK8FIX: skatesum caps every day at the constant rfin-based rsk8 ---
// Pins the current behavior that gissue #5451 (per-day road-rate capping,
// reverted for now -- see the SK8FIX comment in beebrain.js procData) would
// change. Two cases that per-day capping would retroactively rewrite:

// Case 1: a day falling on a flat (rate 0) road segment still caps at rfin.
;(function() {
  // Do-more kyoom goal, rate 65/day, with a flat break day 20251223->24.
  const bbdata = {
    params: {
      tini: "20251220", vini: 0,
      road: [["20251223", null, 65], ["20251224", null, 0]],
      tfin: "20260113", rfin: 65, runits: "d",
      yaw: -1, dir: 1, kyoom: true, aggday: "skatesum",
      yoog: "qual/sk8fix-break", asof: "20251226",
    },
    data: [
      ["20251221", 80, ""], ["20251222", 50, ""], ["20251223", 70, ""],
      ["20251224", 90, ""], ["20251225", 55, ""],
    ],
  }
  const b = new bb(bbdata)
  const vals = b.data.slice(0, 5).map(p => p[1])
  // Daily sums 80,50,70,90,55 capped at rfin=65 give 65,50,65,65,55, which
  // cumulate to the values below. In particular 20251223 caps at 65 even
  // though it falls on the flat road segment. (Under #5451 per-day capping
  // it would aggregate to 0 and every later value would drop by 65.)
  assert(bu.arrayEquals(vals, [65, 115, 180, 245, 300]),
    `SK8FIX flat break day caps at rfin, got [${vals}]`)
})()

// Case 2: datapoints before tini (restarted road keeping old data) still cap
// at rfin, not at the rate of the synthetic flat pre-road segment (slope 0)
// that procRoad prepends.
;(function() {
  const bbdata = {
    params: {
      tini: "20220108", vini: 0,
      road: [["20220608", null, 1]],
      tfin: "20220608", rfin: 1, runits: "d",
      yaw: 1, dir: 1, kyoom: true, aggday: "skatesum",
      yoog: "qual/sk8fix-pretini", asof: "20220110",
    },
    data: [
      ["20220101", 5, ""], ["20220102", 5, ""], ["20220103", 5, ""],
      ["20220109", 5, ""],
    ],
  }
  const b = new bb(bbdata)
  const vals = b.data.slice(0, 4).map(p => p[1])
  // Each day's sum (5) caps at rfin (1/day), including the three days that
  // predate tini, cumulating to 1,2,3,4. (Under #5451 per-day capping the
  // pre-tini days would cap at the pre-road segment's rate, 0, giving
  // 0,0,0,1.)
  assert(bu.arrayEquals(vals, [1, 2, 3, 4]),
    `SK8FIX pre-tini days cap at rfin, got [${vals}]`)
})()

// --- CLOCKYFIX end-to-end: negative pair differences aggregate as-is ---
// A wake-up-time goal logging (actual wake time, alarm time) pairs. Waking
// late gives a negative difference that must pass through to the aggregate,
// not get +24'd by the reverted #4382 midnight wrap (see CLOCKYFIX in
// butil.js).
;(function() {
  const bbdata = {
    params: {
      tini: "20220101", vini: 0,
      road: [["20220601", null, 0]],
      tfin: "20220601", rfin: 0, runits: "d",
      yaw: -1, dir: -1, kyoom: true, aggday: "clocky",
      yoog: "qual/clockyfix-riseup", asof: "20220104",
    },
    data: [
      ["20220101", 7,   "woke at 7:00"], ["20220101", 6.5, "alarm was 6:30"],
      ["20220102", 6,   "woke at 6:00"], ["20220102", 6.5, "alarm was 6:30"],
      ["20220103", 6.5, "woke at 6:30"], ["20220103", 6.5, "alarm was 6:30"],
    ],
  }
  const b = new bb(bbdata)
  const vals = b.data.slice(0, 3).map(p => p[1])
  // Daily clocky aggregates: 6.5-7 = -0.5 (late), 6.5-6 = 0.5 (early),
  // 6.5-6.5 = 0 (on time), cumulating to -0.5, 0, 0. (Under the reverted
  // midnight wrap the first day would become +23.5.)
  assert(bu.arrayEquals(vals, [-0.5, 0, 0]),
    `CLOCKYFIX late wake-up stays negative, got [${vals}]`)
})()

// --- skatesum per-segment rate (the rsk8 HACK fix for issue #250) ---
// When a road has segments with different rates, skatesum must cap at the
// current segment's rate, not rfin. Verify with a multi-segment road.
/*
;(function() {
  const SID = 86400
  // Two segments: slope 0.001 (slow) and slope 0.003 (fast)
  const rd = [
    {sta: [0, 0],          end: [100*SID, 100*SID*0.001], slope: 0.001, auto: 0},
    {sta: [100*SID, 100*SID*0.001], end: [200*SID, 100*SID*0.001 + 100*SID*0.003],
     slope: 0.003, auto: 0},
  ]
  const slowRate = br.rtf(rd, 50*SID) * SID   // in the slow segment
  const fastRate = br.rtf(rd, 150*SID) * SID  // in the fast segment
  assert(Math.abs(slowRate - 0.001*SID) < 1e-9,
    'per-segment rsk8: slow segment has correct daily rate')
  assert(Math.abs(fastRate - 0.003*SID) < 1e-9,
    'per-segment rsk8: fast segment has correct daily rate')
  assert(slowRate !== fastRate,
    'per-segment rsk8: different segments have different rates')
  // Verify skatesum caps at the per-segment rate
  br.rsk8 = slowRate
  assert(br.AGGR.skatesum([1000]) === slowRate,
    'per-segment rsk8: skatesum caps at slow rate')
  br.rsk8 = fastRate
  assert(br.AGGR.skatesum([1000]) === fastRate,
    'per-segment rsk8: skatesum caps at fast rate')
  br.rsk8 = 0
})()

// --- end-to-end: skatesum-rounding-orig.bb should not derail ---
;(function() {
  const bbpath = path.resolve(__dirname, '..', 'skatesum-rounding-orig.bb')
  if (!fs.existsSync(bbpath)) {
    console.log('  SKIP: skatesum-rounding-orig.bb not found')
    return
  }
  const bbdata = JSON.parse(fs.readFileSync(bbpath, 'utf8'))
  const b = new bb(bbdata)
  const gol = b.gol
  assert(gol.loser === false,
    'skatesum-rounding-orig.bb: not a loser (issue #250)')
  assert(gol.color !== 'red',
    'skatesum-rounding-orig.bb: not red (issue #250)')
})()
*/

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

      // --- config() assertion quals (rule 14: fail loudly on bad div opts) ---
      // The basic_test page has bgraph loaded as a global. Reuse it to verify
      // that config() accepts valid forms and crashes on garbage.
      const cfg = await page.evaluate(() => {
        const results = {}
        const tryConstruct = (opts) => {
          try { new bgraph(opts); return null }
          catch (e) { return e.message }
        }
        // Happy: all div* omitted → headless-ish, no crash
        results.omitted = tryConstruct({headless: true})
        // Happy: explicit null for every div*
        results.allNull = tryConstruct({
          headless: true,
          divGraph: null, divTable: null, divPoints: null,
          divDueby: null, divData:  null, divJSON:  null,
        })
        // Sad: explicit undefined is caller confusion (null is the right way)
        results.undef = tryConstruct({headless: true, divGraph: undefined})
        // Sad: string where a DOM node belongs
        results.strGraph  = tryConstruct({divGraph: "not a node"})
        results.strTable  = tryConstruct({divTable: "not a node"})
        results.strPoints = tryConstruct({divPoints: "not a node"})
        results.strDueby  = tryConstruct({divDueby: "not a node"})
        results.strData   = tryConstruct({divData:  "not a node"})
        results.strJSON   = tryConstruct({divJSON:  "not a node"})
        // Sad: plain object (no nodeName)
        results.objGraph  = tryConstruct({divGraph: {}})
        // Sad: number
        results.numGraph  = tryConstruct({divGraph: 42})
        // Sad: even in headless mode, garbage still crashes (no silent ignore)
        results.hlGarbage = tryConstruct({headless: true, divTable: "nope"})
        return results
      })
      assert(cfg.omitted === null,
        `${name}: config accepts omitted div opts (got: ${cfg.omitted})`)
      assert(cfg.allNull === null,
        `${name}: config accepts explicit nulls (got: ${cfg.allNull})`)
      for (const k of ['undef','strGraph','strTable','strPoints','strDueby',
                       'strData','strJSON','objGraph','numGraph','hlGarbage']) {
        assert(cfg[k] && /must be a DOM node or null/.test(cfg[k]),
          `${name}: config rejects bad ${k} (got: ${cfg[k]})`)
      }

      // --- redrawXTicks small-focusRect scaling (was masked by try/catch) ---
      // focusRect.width < 600 triggers the diff *= 1.{2,4,6} scaling. Before
      // fixing the `const diff` bug and removing the swallowing try/catch,
      // this path threw a TypeError every frame and was invisible. Now any
      // throw in redrawXTicks surfaces as a pageerror.
      const smallBb = await fetch(`http://localhost:${port}/quals/basic_test.bb`)
        .then(r => r.text())
      const smallErr = await page.evaluate((bbtext) => {
        try {
          const g = document.createElement('div')
          g.style.width = '400px'; g.style.height = '300px'
          document.body.appendChild(g)
          const bg = new bgraph({
            divGraph:  g,
            svgSize:   {width: 400, height: 300},
            focusRect: {x: 0, y: 0, width: 400, height: 240}, // < 500 branch
            ctxRect:   {x: 0, y: 240, width: 400, height: 60},
          })
          bg.loadGoalJSON(JSON.parse(bbtext))
          return null
        } catch (e) { return e.message }
      }, smallBb)
      assert(smallErr === null,
        `${name}: small-focusRect bgraph renders without throwing (got: ${smallErr})`)

      // Replicata: load a steppy goal with a multi-month gap in its data
      // (quals/steppygap_test.bb) and zoom in so the visible window sits
      // inside the gap with datapoints on both sides. Expectata: the graph
      // redraws fine, steppy line intact. Resultata (pre-fix): updateSteppy
      // assigned to a const (npts, from 2caea8c in 2020 -- the third
      // const-assignment crash of this kind, see also `const diff` above
      // and `const maxind` in knotDragged) and threw "Assignment to
      // constant variable" on every redraw once zoomed into the gap.
      const gapBb = await fetch(
        `http://localhost:${port}/quals/steppygap_test.bb`).then(r => r.text())
      const gap = await page.evaluate(async (bbtext) => {
        const g = document.createElement('div')
        g.style.width = '696px'; g.style.height = '453px'
        g.id = 'steppygap'
        document.body.appendChild(g)
        const bg = new bgraph({
          divGraph:  g,
          svgSize:   {width: 696, height: 453},
          focusRect: {x: 0, y: 0, width: 696, height: 453},
          ctxRect:   {x: 0, y: 453, width: 696, height: 32},
          roadEditor: false,
          showContext: false,
        })
        await bg.loadGoalJSON(JSON.parse(bbtext))
        await new Promise(r => setTimeout(r, 300))
        let uncaught = null
        const onerr = e => { uncaught = e.message }
        window.addEventListener('error', onerr)
        document.querySelector('#steppygap svg .zoomin')
          .dispatchEvent(new MouseEvent('click', {bubbles: true}))
        await new Promise(r => setTimeout(r, 300))
        window.removeEventListener('error', onerr)
        const path = document.querySelector('#steppygap svg .steppy')
        return {uncaught, d: path ? (path.getAttribute('d') || '') : ''}
      }, gapBb)
      assert(gap.uncaught === null,
        `${name}: zooming a steppy graph into a data gap doesn't throw ` +
        `(got: ${gap.uncaught})`)
      assert(gap.d.length > 0,
        `${name}: steppy line still drawn when zoomed inside a data gap`)
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

  // Replicata: load the production UI, activate Graph Editor, and resize it.
  // Expectata: a deliberate two-panel workbench that stacks without overflow.
  // Resultata: generic boxed sections, rotated tool tabs, and a fixed viewport.
  await runQual(browser, port, 'grapheditor', GRAPHEDITOR_PATH,
    async (page, name) => {
      // The graph tab has a working scrubber (context graph) for zooming,
      // like the editor's
      const scrubber = await page.evaluate(() => {
        const svg = document.querySelector('#roadgraph svg.bmndrsvg')
        return {
          contextVisible: getComputedStyle(
            svg.querySelector('.brush')).visibility === 'visible',
          focusrectVisible: getComputedStyle(
            svg.querySelector('.focusrect')).visibility === 'visible',
        }
      })
      assert(scrubber.contextVisible,
        `${name}: graph-tab scrubber is visible`)
      assert(scrubber.focusrectVisible,
        `${name}: graph-tab scrubber shows the zoom window`)

      // Dragging the scrubber's selection pans the graph: the focus x-axis
      // ticks (first .axis in document order) move
      const xAxisTicks = () => page.evaluate(() =>
        document.querySelector('#roadgraph svg.bmndrsvg .axis').innerHTML)
      const axisBefore = await xAxisTicks()
      const sel = await page.$('#roadgraph .brush .selection')
      const selBox = sel && await sel.boundingBox()
      assert(selBox && selBox.width > 0,
        `${name}: graph-tab scrubber has a draggable selection`)
      if (selBox) {
        await page.mouse.move(selBox.x + selBox.width / 2,
                              selBox.y + selBox.height / 2)
        await page.mouse.down()
        await page.mouse.move(selBox.x + selBox.width / 2 - 60,
                              selBox.y + selBox.height / 2, {steps: 5})
        await page.mouse.up()
        assert(await xAxisTicks() !== axisBefore,
          `${name}: dragging the scrubber pans the graph`)
        await page.evaluate(() => graph.zoomDefault())
      }

      // Tool-row markup is single-sourced (DRY partials): the zoom row with
      // its scrubber toggle and the SVG download/preview row each appear
      // once in the template and are stamped out per tab
      const toolsDry = {
        summaries: (GRAPHEDITOR_TEMPLATE.match(/>Experimental features</g) || [])
          .length,
        scrubbers: (GRAPHEDITOR_TEMPLATE.match(/>Include scrubber</g) || [])
          .length,
        downloads: (GRAPHEDITOR_TEMPLATE.match(/>Download SVG</g) || [])
          .length,
        previews: (GRAPHEDITOR_TEMPLATE.match(/>Preview SVG</g) || [])
          .length,
      }
      assert(toolsDry.summaries === 1 && toolsDry.scrubbers === 1 &&
             toolsDry.downloads === 1 && toolsDry.previews === 1,
        `${name}: tool-row markup is single-sourced ` +
        JSON.stringify(toolsDry))
      // Replicata: load the graph and editor tabs. Expectata: the SVG
      // download/preview buttons and the scrubber toggle sit right in the
      // tool rows, not tucked inside the experimental-features section, and
      // the graph tab's are visible without expanding anything.
      const svgtools = await page.evaluate(() =>
        ['gshowcontext', 'gsavesvgdl', 'gsavesvgblob',
         'eshowcontext', 'esavesvgdl', 'esavesvgblob'].map(id => {
          const el = document.getElementById(id)
          return {id, exists: !!el,
                  checked: el ? el.checked : false,
                  inDetails: el ? !!el.closest('details') : false,
                  visible: el ? el.checkVisibility() : false}
        }))
      assert(svgtools.every(t => t.exists && !t.inDetails),
        `${name}: SVG buttons and scrubber toggles graduated out of ` +
        `experimental features (${JSON.stringify(svgtools)})`)
      assert(svgtools[0].checked && svgtools[3].checked,
        `${name}: scrubber toggles on by default ` +
        `(${JSON.stringify(svgtools)})`)
      assert(svgtools.slice(0, 3).every(t => t.visible),
        `${name}: graph-tab SVG buttons and scrubber toggle visible ` +
        `without expanding anything (${JSON.stringify(svgtools)})`)
      await page.evaluate(() => {
        window.qualGSCCalls = []
        const orig = graph.showContext
        graph.showContext = f => { window.qualGSCCalls.push(f)
                                   return orig(f) }
      })
      await page.click('#gshowcontext')
      await page.click('#gshowcontext')
      const gscCalls = await page.evaluate(() => window.qualGSCCalls)
      assert(JSON.stringify(gscCalls) === '[false,true]',
        `${name}: scrubber toggle drives graph.showContext ` +
        `(got ${JSON.stringify(gscCalls)})`)

      // Replicata: click Download SVG and Preview SVG on the graph tab
      // (with the anchor click and window.open stubbed to capture their
      // payloads). Expectata: a standalone well-formed SVG blob named
      // after the goal, xml declaration and namespaces included, zoom
      // buttons stripped. Resultata (before these buttons): only a
      // right-click-this-data-URI flow buried in experimental features.
      const svgdl = await page.evaluate(async () => {
        let blob = null, dlname = null, openedUrl = null
        const origClick = HTMLAnchorElement.prototype.click
        const origCreate = URL.createObjectURL
        const origOpen = window.open
        HTMLAnchorElement.prototype.click = function() {
          dlname = this.download }
        URL.createObjectURL = b => { blob = b; return origCreate(b) }
        window.open = (u) => { openedUrl = u; return null }
        try {
          graph.saveGraphDownload()
          const dltext = await blob.text()
          const dltype = blob.type
          graph.saveGraphBlob()
          const pvtext = await (await fetch(openedUrl)).text()
          const parseErr = new DOMParser()
            .parseFromString(dltext, 'image/svg+xml')
            .querySelector('parsererror')
          return {dlname, dltype, dltext, pvtext,
                  parseErr: parseErr ? parseErr.textContent : null,
                  yoog: graph.getGoalObj().yoog}
        } finally {
          HTMLAnchorElement.prototype.click = origClick
          URL.createObjectURL = origCreate
          window.open = origOpen
        }
      })
      assert(svgdl.dlname === svgdl.yoog.replace('/', '-') + '.svg',
        `${name}: downloaded SVG is named after the goal ` +
        `(${svgdl.dlname} vs yoog ${svgdl.yoog})`)
      assert(svgdl.dltype === 'image/svg+xml',
        `${name}: downloaded SVG has the right MIME type (${svgdl.dltype})`)
      assert(svgdl.parseErr === null,
        `${name}: downloaded SVG parses as XML (${svgdl.parseErr})`)
      assert(svgdl.dltext.startsWith(
               '<?xml version="1.0" standalone="no"?>') &&
             /<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/
               .test(svgdl.dltext) &&
             /<svg[^>]+xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/
               .test(svgdl.dltext),
        `${name}: downloaded SVG is standalone (xml declaration + ` +
        `namespaces)`)
      assert(!svgdl.dltext.includes('class="zoomin"') &&
             !svgdl.dltext.includes('class="zoomout"'),
        `${name}: downloaded SVG has the interactive zoom buttons stripped`)
      assert(svgdl.pvtext === svgdl.dltext,
        `${name}: Preview SVG serves the same SVG the download saves`)

      await page.click('#editortab')
      await page.waitForSelector('#editor', {visible: true})
      await page.waitForSelector('#roadeditor svg.bmndrsvg .razr',
        {visible: true})

      const wide = await page.evaluate(() => {
        const workspace = document.querySelector('#editor .workspace')
        const graph = document.querySelector('#editor .graphcontainer')
        const tools = document.querySelector('#editor .vtabcontainer')
        const submit = document.getElementById('submit')
        const secondary = document.getElementById('ezoomdflt')
        const submitWasDisabled = submit.disabled
        const submitTransition = submit.style.transition
        submit.style.transition = 'none'
        submit.disabled = false
        const graphRect = graph.getBoundingClientRect()
        const toolsRect = tools.getBoundingClientRect()
        const workspaceStyle = workspace && getComputedStyle(workspace)
        const submitStyle = getComputedStyle(submit)
        const secondaryStyle = getComputedStyle(secondary)
        const result = {
          semanticShell: !!document.querySelector('body > header#header') &&
            !!document.querySelector('body > main.app-shell') &&
            !!document.querySelector('main > nav.tab') &&
            !!document.querySelector(
              'main section#editor[aria-labelledby="editortab"]'),
          goalLabel: document.querySelector('.goalbar > label')?.textContent,
          goalLabelHasControl:
            !!document.querySelector('.goalbar > label')?.control,
          workspaceDisplay: workspaceStyle && workspaceStyle.display,
          panelsShareRow: Math.abs(graphRect.top - toolsRect.top) < 2,
          panelsArePanels: graph.classList.contains('panel') &&
            tools.classList.contains('panel'),
          panelGap: toolsRect.left - graphRect.right,
          panelSurface: getComputedStyle(graph).backgroundColor ===
              getComputedStyle(tools).backgroundColor &&
            getComputedStyle(graph).backgroundColor !== 'rgba(0, 0, 0, 0)' &&
            getComputedStyle(graph).borderStyle !== 'none' &&
            getComputedStyle(tools).borderStyle !== 'none',
          toolTabTransform: getComputedStyle(
            document.querySelector('#editor .vtab')).transform,
          primaryIsDistinct:
            document.querySelectorAll(
              '#editor button.primary-action').length === 1 &&
            submit.classList.contains('primary-action') &&
            submitStyle.backgroundColor !== secondaryStyle.backgroundColor,
          primarySharesGeometry:
            submitStyle.height === secondaryStyle.height &&
            submitStyle.borderRadius === secondaryStyle.borderRadius &&
            submitStyle.fontFamily === secondaryStyle.fontFamily,
          primaryDetails: {
            count: document.querySelectorAll(
              '#editor button.primary-action').length,
            submitDisabled: submit.disabled,
            submitBackground: submitStyle.backgroundColor,
            secondaryBackground: secondaryStyle.backgroundColor,
          },
          bodyFont: getComputedStyle(document.body).fontFamily,
          graphRadius: parseFloat(getComputedStyle(graph).borderRadius),
          copyCasePreserved: [
            document.querySelector('#editor .vtabtitle'),
            document.querySelector('#editor .tooltitle'),
          ].every(el => getComputedStyle(el).textTransform === 'none'),
          focusContainersVisible:
            getComputedStyle(document.querySelector('.tab')).overflow ===
              'visible' &&
            getComputedStyle(document.querySelector('#editor .vtab')).overflow ===
              'visible',
          editorLoaded:
            document.getElementById('esummary').textContent.trim().length > 0 &&
            document.getElementById('editorroad').children.length > 0,
        }
        submit.disabled = submitWasDisabled
        submit.getBoundingClientRect()
        submit.style.transition = submitTransition
        return result
      })

      const inlineStyleCount = (EDITOR_MARKUP.match(/\sstyle\s*=/g) || []).length
      assert(inlineStyleCount === 0,
        `${name}: authored editor has no inline styles (found ${inlineStyleCount})`)
      const voidCloses = (GRAPHEDITOR_TEMPLATE.match(/<\/input>/g) || []).length
      assert(voidCloses === 0,
        `${name}: void <input> elements have no closing tags (found ${voidCloses})`)
      const editableInputs =
        (GRAPHEDITOR_TEMPLATE.match(/<input[^>]*contenteditable/g) || []).length
      assert(editableInputs === 0,
        `${name}: no contenteditable attributes on inputs (found ${editableInputs})`)
      const selectedSelects =
        (GRAPHEDITOR_TEMPLATE.match(/<select[^>]* selected[ =>]/g) || []).length
      assert(selectedSelects === 0,
        `${name}: no selected attributes on select tags (found ${selectedSelects})`)
      assert(/<span id="submitmsg"><\/span>/.test(GRAPHEDITOR_TEMPLATE),
        `${name}: submit message span starts empty in the markup`)
      assert(wide.semanticShell,
        `${name}: app shell uses header, main, nav, and editor section`)
      assert(wide.goalLabel === 'Beeminder goal:' && wide.goalLabelHasControl,
        `${name}: goal picker has its exact visible label (got ${JSON.stringify(wide.goalLabel)})`)
      assert(wide.workspaceDisplay === 'grid',
        `${name}: editor workspace uses a grid (got ${wide.workspaceDisplay})`)
      assert(wide.panelsShareRow,
        `${name}: graph and tools share a row at 1360px`)
      assert(wide.panelsArePanels,
        `${name}: graph and tools share the panel vocabulary`)
      assert(wide.panelGap >= 16,
        `${name}: wide panels have at least 16px separation (${wide.panelGap}px)`)
      assert(wide.panelSurface,
        `${name}: wide panels share a bordered surface treatment`)
      assert(wide.toolTabTransform === 'none',
        `${name}: tool tabs are not rotated (got ${wide.toolTabTransform})`)
      assert(wide.primaryIsDistinct,
        `${name}: Submit has distinct primary emphasis (${JSON.stringify(wide.primaryDetails)})`)
      assert(wide.primarySharesGeometry,
        `${name}: primary and secondary actions share geometry`)
      assert(/ui-sans-serif|-apple-system|BlinkMacSystemFont|Segoe UI/.test(
        wide.bodyFont),
        `${name}: application typography replaces browser defaults`)
      assert(wide.graphRadius >= 2 && wide.graphRadius <= 6,
        `${name}: graph surface has crisp, modest corners (${wide.graphRadius}px)`)
      assert(wide.copyCasePreserved,
        `${name}: CSS preserves authored UI copy casing`)
      assert(wide.editorLoaded,
        `${name}: editor summary and graph matrix are populated`)
      assert(wide.focusContainersVisible,
        `${name}: tab containers do not clip focus outlines`)

      const chrome = await page.evaluate(() => {
        const road = editor.getRoad()
        const rd = road.road
        const logo = document.querySelector('#header a')
        const mainBtn = document.querySelector('.tab button.active')
        const vtabBtn = document.querySelector('#editor .vtab button.active')
        // Kill in-flight border-color transitions so we measure end state
        mainBtn.style.transition = 'none'
        vtabBtn.style.transition = 'none'
        const mainActive = getComputedStyle(mainBtn)
        const vtabActive = getComputedStyle(vtabBtn)
        return {
          siru: String(road.siru),
          slopeType: document.getElementById('slopetype').value,
          endSlope: parseFloat(document.getElementById('endslope').value),
          rawSlope: rd[rd.length - 1][2],
          logoName: logo.getAttribute('aria-label') || logo.textContent.trim(),
          mainActiveShadow: mainActive.boxShadow,
          activeUnderlines: [
            mainActive.borderBottomWidth + ' ' + mainActive.borderBottomColor,
            vtabActive.borderBottomWidth + ' ' + vtabActive.borderBottomColor,
          ],
        }
      })
      assert(chrome.mainActiveShadow === 'none',
        `${name}: active main tab is flat, no drop shadow ` +
        `(got ${chrome.mainActiveShadow})`)
      assert(chrome.activeUnderlines.every(u => u === '3px rgb(255, 203, 6)'),
        `${name}: main and tool tabs share the amber-underline active ` +
        `language (got ${JSON.stringify(chrome.activeUnderlines)})`)
      assert(chrome.slopeType === chrome.siru,
        `${name}: rate-unit menu reflects the goal's own unit ` +
        `(${chrome.slopeType} vs ${chrome.siru})`)
      assert(Math.abs(chrome.endSlope - chrome.rawSlope) <=
             1e-9 * Math.max(1, Math.abs(chrome.rawSlope)),
        `${name}: goal-rate field shows the current end slope ` +
        `(${chrome.endSlope} vs ${chrome.rawSlope})`)
      assert(chrome.logoName.length > 0,
        `${name}: header logo link has an accessible name`)

      // PDP vs olddesign: dragging instructions, keyboard-shortcut
      // tooltips, and the keepIntervals toggle must all survive the redesign
      assert(GRAPHEDITOR_TEMPLATE.includes(
        'Drag the bright red line or double-click for new segments'),
        `${name}: editor instructions survive verbatim`)
      const pdp = await page.evaluate(() => {
        const ki = document.getElementById('keepintervals')
        const hint = [...document.querySelectorAll('#editor *')].find(el =>
          el.children.length === 0 && /Drag the bright red line/.test(
            el.textContent))
        return {
          tips: ['eundo', 'eredo', 'sundo', 'sredo'].map(id =>
            document.getElementById(id).dataset.tip || ''),
          hovertexts: ['eundo', 'eredo', 'sundo', 'sredo'].map(id =>
            document.getElementById(id).title).join(''),
          kiExists: !!ki,
          kiUnchecked: ki ? !ki.checked : false,
          kiTucked: ki ? !!ki.closest('details') : false,
          kiLabel: ki ? document.querySelector(
            'label[for="keepintervals"]')?.textContent : null,
          // checkVisibility, not rects: closed-details content keeps
          // layout boxes in Chromium even though it isn't painted
          hintVisible: hint ? hint.checkVisibility() : false,
        }
      })
      assert(pdp.tips.join('|') ===
        'Ctrl-Z / ⌘Z|Ctrl-Y / ⇧⌘Z|' +
        'Ctrl-Z / ⌘Z|Ctrl-Y / ⇧⌘Z' && pdp.hovertexts === '',
        `${name}: undo/redo buttons advertise shortcuts via data-tip, ` +
        `not title hovertext (got ${pdp.tips.join('|')})`)
      const tipHidden = await page.evaluate(() => getComputedStyle(
        document.getElementById('eundo'), '::after').opacity)
      await page.hover('#eundo')
      await page.evaluate(() => new Promise(r => setTimeout(r, 600)))
      const tipShown = await page.evaluate(() => ({
        opacity: getComputedStyle(
          document.getElementById('eundo'), '::after').opacity,
        content: getComputedStyle(
          document.getElementById('eundo'), '::after').content,
      }))
      assert(tipHidden === '0' && tipShown.opacity === '1' &&
             tipShown.content.includes('Ctrl-Z'),
        `${name}: tooltips render on hover ` +
        JSON.stringify({tipHidden, tipShown}))
      assert(!pdp.hintVisible,
        `${name}: editor instructions tucked away by default`)
      const hintGeom = await page.evaluate(() => ({
        chipPosition: getComputedStyle(
          document.querySelector('#editor details.hint')).position,
        roadTop: document.getElementById('roadeditor')
          .getBoundingClientRect().top,
      }))
      assert(hintGeom.chipPosition === 'absolute',
        `${name}: help chip floats in the panel corner, not in the flow ` +
        `(got ${hintGeom.chipPosition})`)
      await page.click('#editor details.hint > summary')
      const hintOpen = await page.evaluate(() => {
        const pop = document.querySelector('#editor details.hint > .hintpop')
        return {
          visible: pop.checkVisibility(),
          popup: getComputedStyle(pop).position === 'absolute',
          // the popup's items have been both <li>s and <p>s in their time:
          items: pop.querySelectorAll('p, li').length,
          roadTop: document.getElementById('roadeditor')
            .getBoundingClientRect().top,
        }
      })
      assert(hintOpen.visible, `${name}: help chip reveals the instructions`)
      assert(hintOpen.items >= 5,
        `${name}: help popup documents the editor's gestures ` +
        `(${hintOpen.items} items)`)
      assert(hintOpen.popup && hintOpen.roadTop === hintGeom.roadTop,
        `${name}: help text is a popup and does not reflow the graph ` +
        JSON.stringify({popup: hintOpen.popup, before: hintGeom.roadTop,
                        after: hintOpen.roadTop}))
      await page.click('#esummary')
      const hintDismissed = await page.evaluate(() =>
        !document.querySelector('#editor details.hint').open)
      assert(hintDismissed,
        `${name}: clicking away dismisses the help popup`)
      assert(pdp.kiExists && pdp.kiUnchecked && pdp.kiTucked &&
             pdp.kiLabel === 'Fixed intervals',
        `${name}: Fixed intervals toggle exists, unchecked, exact label, ` +
        `tucked in experimental features (got ${JSON.stringify(pdp)})`)
      if (pdp.kiExists) {
        await page.evaluate(() => {
          window.qualKICalls = []
          const orig = editor.keepIntervals
          editor.keepIntervals = f => { window.qualKICalls.push(f)
                                        return orig(f) }
          const d = document.getElementById('keepintervals')
            .closest('details')
          if (d) d.open = true
        })
        await page.click('#keepintervals')
        await page.click('#keepintervals')
        const kiCalls = await page.evaluate(() => {
          const d = document.getElementById('keepintervals')
            .closest('details')
          if (d) d.open = false
          return window.qualKICalls
        })
        assert(JSON.stringify(kiCalls) === '[true,false]',
          `${name}: Fixed intervals checkbox drives editor.keepIntervals ` +
          `(got ${JSON.stringify(kiCalls)})`)
      }

      // Replicata: enable Fixed intervals and drag a knot to the right.
      // Expectata: all later knots slide along with it, keeping the time
      // between them (the point of the toggle). Resultata (pre-fix): a
      // var->const sweep (a9cf6e4) left knotDragged assigning to a const
      // when keepIntervals is on, so every drag event threw a TypeError
      // and the knot wouldn't budge at all.
      const kiBefore = await page.evaluate(() => {
        editor.keepIntervals(true)
        return editor.getRoad().road.map(r => r[0])
      })
      const kiKnot = await page.evaluate(() => {
        const svgr = document.querySelector('#roadeditor svg.bmndrsvg')
          .getBoundingClientRect()
        const ks = [...document.querySelectorAll('#roadeditor .knots')]
          .map(k => { const r = k.getBoundingClientRect()
                      return {x: r.x + r.width / 2, y: r.y + r.height / 2} })
          .filter(p => p.x > svgr.x + 60 && p.x < svgr.right - 20)
        return ks[ks.length - 1]
      })
      await page.mouse.move(kiKnot.x, kiKnot.y)
      await page.mouse.down()
      for (let i = 1; i <= 10; i++) {
        await page.mouse.move(kiKnot.x + 6 * i, kiKnot.y)
        await page.evaluate(() => new Promise(r => setTimeout(r, 20)))
      }
      await page.mouse.up()
      const kiAfter = await page.evaluate(() => {
        const dates = editor.getRoad().road.map(r => r[0])
        if (editor.undoBufferState().undo > 0) editor.undoAll()
        editor.keepIntervals(false)
        return dates
      })
      const day = s => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1,
                                +s.slice(6, 8)) / 86400000
      const kiShift = day(kiAfter[1]) - day(kiBefore[1])
      const kiGoalShift = day(kiAfter[kiAfter.length - 1]) -
                          day(kiBefore[kiBefore.length - 1])
      assert(kiShift > 0 && kiGoalShift === kiShift,
        `${name}: with Fixed intervals on, dragging a knot slides later ` +
        `knots along, keeping the time between them (knot moved ` +
        `${kiShift} days, goal date moved ${kiGoalShift})`)

      // Replicata: drag a road dot upward with "Propagate changes forward"
      // on (the default), then again with it off. Expectata: with it on,
      // every later segment keeps its slope, so the rest of the line
      // translates by the drag delta; with it off, the rest of the line
      // stays pinned and only the adjacent segments re-slope. (This is the
      // keepSlopes toggle; until now nothing pinned its effect on the
      // road, only that the checkbox calls it.)
      const roadEnds = () => page.evaluate(() =>
        editor.getRoadObj().slice(0, -1).map(s => [s.end[0], s.end[1]]))
      const dragDotUp = async () => {
        const pt = await page.evaluate(() => {
          const svgr = document.querySelector('#roadeditor svg.bmndrsvg')
            .getBoundingClientRect()
          const ds = [...document.querySelectorAll('#roadeditor .dots')]
            .map(k => { const r = k.getBoundingClientRect()
                        return {x: r.x + r.width / 2,
                                y: r.y + r.height / 2} })
            .filter(p => p.x > svgr.x + 60 && p.x < svgr.right - 20)
          return ds[ds.length - 1]
        })
        await page.mouse.move(pt.x, pt.y)
        await page.mouse.down()
        for (let i = 1; i <= 10; i++) {
          await page.mouse.move(pt.x, pt.y - 6 * i)
          await page.evaluate(() => new Promise(r => setTimeout(r, 20)))
        }
        await page.mouse.up()
      }
      const undoAllSafe = () => page.evaluate(() => {
        if (editor.undoBufferState().undo > 0) editor.undoAll()
      })

      let ksBefore = await roadEnds()
      await dragDotUp()
      let ksAfter = await roadEnds()
      const moved = ksAfter.findIndex((e, i) =>
        Math.abs(e[1] - ksBefore[i][1]) > 1e-9)
      const ksDelta = moved >= 0 ? ksAfter[moved][1] - ksBefore[moved][1] : 0
      const translated = moved >= 0 &&
        ksAfter.slice(moved).every((e, i) =>
          Math.abs(e[1] - ksBefore[moved + i][1] - ksDelta) < 1e-6 &&
          e[0] === ksBefore[moved + i][0])
      assert(moved >= 0 && Math.abs(ksDelta) > 0 && translated,
        `${name}: with Propagate changes forward on, the rest of the ` +
        `line translates with a dragged dot (delta ${ksDelta})`)
      await undoAllSafe()

      await page.evaluate(() => editor.keepSlopes(false))
      ksBefore = await roadEnds()
      await dragDotUp()
      ksAfter = await roadEnds()
      const lastind = ksBefore.length - 1
      const dotMoved = ksAfter.some((e, i) =>
        Math.abs(e[1] - ksBefore[i][1]) > 1e-9)
      assert(dotMoved &&
             ksAfter[lastind][0] === ksBefore[lastind][0] &&
             Math.abs(ksAfter[lastind][1] - ksBefore[lastind][1]) < 1e-9,
        `${name}: with Propagate changes forward off, the goal endpoint ` +
        `stays pinned while the dragged dot moves`)
      await undoAllSafe()
      await page.evaluate(() => editor.keepSlopes(true))

      // Replicata: click the row-1 slope cell in the graph matrix, type 2,
      // hit Enter. Expectata: the road's row-1 slope becomes 2, the edit
      // lands in the undo buffer, and (for this goal, where that rate
      // change puts today on the wrong side of the line) Submit disables
      // with the insta-derail message. Exercises the tableKeyDown ->
      // tableSlopeChanged -> editorChanged path, which no qual drove
      // before.
      await page.click('#editorroad [name=slope1]')
      await page.evaluate(() => {
        const cell = document.querySelector('#editorroad [name=slope1]')
        const sel = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(cell)
        sel.removeAllRanges()
        sel.addRange(range)
      })
      await page.keyboard.type('2')
      await page.keyboard.press('Enter')
      await page.evaluate(() => new Promise(r => setTimeout(r, 400)))
      const matrixEdit = await page.evaluate(() => ({
        slope: editor.getRoad().road[1][2],
        undo: document.getElementById('eundo').textContent,
        submitDisabled: document.getElementById('submit').disabled,
        submitmsg: document.getElementById('submitmsg').textContent,
      }))
      assert(matrixEdit.slope === 2,
        `${name}: typing in a matrix slope cell edits the road ` +
        `(got ${matrixEdit.slope})`)
      assert(matrixEdit.undo === 'Undo (1)',
        `${name}: matrix edit lands in the undo buffer ` +
        `(got ${matrixEdit.undo})`)
      assert(matrixEdit.submitDisabled &&
             /insta-derail/.test(matrixEdit.submitmsg),
        `${name}: insta-derailing edit disables Submit with the derail ` +
        `message (disabled=${matrixEdit.submitDisabled}, ` +
        `msg="${matrixEdit.submitmsg}")`)
      await undoAllSafe()

      // Undo/redo keyboard shortcuts, including the Mac variants: mod-Z
      // undoes; mod-Y and shift-mod-Z redo
      await page.evaluate(() => {
        window.qualKeys = []
        const u = editor.undo, r = editor.redo
        editor.undo = () => { window.qualKeys.push('undo'); return u() }
        editor.redo = () => { window.qualKeys.push('redo'); return r() }
      })
      await page.keyboard.down('Control')
      await page.keyboard.press('KeyZ')
      await page.keyboard.press('KeyY')
      await page.keyboard.up('Control')
      await page.keyboard.down('Meta')
      await page.keyboard.press('KeyZ')
      await page.keyboard.down('Shift')
      await page.keyboard.press('KeyZ')
      await page.keyboard.up('Shift')
      await page.keyboard.up('Meta')
      const qualKeys = await page.evaluate(() => window.qualKeys)
      assert(qualKeys.join() === 'undo,redo,undo,redo',
        `${name}: Ctrl-Z/Ctrl-Y and Cmd-Z/Shift-Cmd-Z drive undo/redo ` +
        `(got ${qualKeys.join()})`)

      // The due-by table speaks the design system: right-aligned tabular
      // numbers, muted header, hairline row separators
      await page.click('#editor .vtab button[onclick*="estats"]')
      const dueby = await page.evaluate(() => {
        const hdr = document.querySelectorAll('#edueby .dbhdrcell')
        const lastHdr = getComputedStyle(hdr[hdr.length - 1])
        const cell2 = getComputedStyle(document.querySelector(
          '#edueby .dbrow:nth-child(3) .dbcell:nth-child(2)'))
        return {
          nHdr: hdr.length,
          numbersRight: lastHdr.textAlign === 'right' &&
                        cell2.textAlign === 'right',
          hdrMuted: lastHdr.color === 'rgb(109, 106, 97)',
          tabular: cell2.fontVariantNumeric === 'tabular-nums',
          rowRule: getComputedStyle(document.querySelector(
            '#edueby .dbrow:nth-child(3) .dbcell')).borderTopWidth === '1px',
        }
      })
      assert(dueby.nHdr === 3 && dueby.numbersRight && dueby.hdrMuted &&
             dueby.tabular && dueby.rowRule,
        `${name}: due-by table has aligned numbers and hairline rows ` +
        JSON.stringify(dueby))
      await page.screenshot({path: path.resolve(__dirname,
        'qual_grapheditor_dueby_screenshot.png')})
      await page.click('#editor .vtab button[onclick*="eroad"]')

      // The graph matrix and data table speak the design system too:
      // no more hard black borders and default browser button chrome
      const tables = await page.evaluate(() => {
        const rd = getComputedStyle(
          document.querySelector('#editorroad .rdcell'))
        const goal = getComputedStyle(
          document.querySelector('#editorroad .rtbgoal'))
        const btn = getComputedStyle(
          document.querySelector('#editorroad button.rdbtn'))
        return {
          cellBorder: rd.borderTopColor,
          cellRadius: rd.borderTopLeftRadius,
          goalBorder: goal.borderTopColor,
          btnRadius: btn.borderTopLeftRadius,
        }
      })
      assert(tables.cellBorder === 'rgb(193, 188, 174)' &&
             tables.cellRadius === '3px' &&
             tables.goalBorder === 'rgb(193, 188, 174)' &&
             tables.btnRadius === '3px',
        `${name}: matrix cells and buttons speak the design system ` +
        JSON.stringify(tables))
      await page.click('#editor .vtab button[onclick*="edata"]')
      const dtable = await page.evaluate(() => {
        const cell = getComputedStyle(
          document.querySelector('#editordata div.dcell'))
        const hdr = getComputedStyle(
          document.querySelector('#editordata .dhdrcell'))
        return {cellBorder: cell.borderTopColor,
                cellRadius: cell.borderTopLeftRadius,
                hdrColor: hdr.color}
      })
      assert(dtable.cellBorder === 'rgb(193, 188, 174)' &&
             dtable.cellRadius === '3px' &&
             dtable.hdrColor === 'rgb(109, 106, 97)',
        `${name}: data table speaks the design system ` +
        JSON.stringify(dtable))
      await page.click('#editor .vtab button[onclick*="eroad"]')

      await page.screenshot({
        path: path.resolve(__dirname,
          'qual_grapheditor_editor_wide_screenshot.png'),
        fullPage: true,
      })

      await page.focus('#graphtab')
      await page.keyboard.press('Tab')
      const focus = await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement)
        return {
          id: document.activeElement.id,
          style: style.outlineStyle,
          width: parseFloat(style.outlineWidth),
          offset: parseFloat(style.outlineOffset),
          color: style.outlineColor,
        }
      })
      assert(focus.id === 'editortab' && focus.style !== 'none' &&
             focus.width > 0 && focus.offset >= 2 &&
             focus.color === 'rgb(107, 79, 0)',
        `${name}: keyboard focus is visible on main tabs`)

      await page.hover('#submit')
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 150)))
      const disabledHover = await page.evaluate(() => ({
        submit: getComputedStyle(document.getElementById('submit'))
          .backgroundColor,
        undo: getComputedStyle(document.getElementById('eundo'))
          .backgroundColor,
      }))
      assert(disabledHover.submit === disabledHover.undo,
        `${name}: disabled Submit stays visually disabled on hover`)

      await page.setViewport({width: 390, height: 844})
      await page.evaluate(() => new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const narrow = await page.evaluate(() => {
        const workspaceRect = document.querySelector(
          '#editor .workspace').getBoundingClientRect()
        const graphRect = document.querySelector(
          '#editor .graphcontainer').getBoundingClientRect()
        const toolsRect = document.querySelector(
          '#editor .vtabcontainer').getBoundingClientRect()
        const toolbars = [...document.querySelectorAll(
          '#editor .graphtools')]
        return {
          panelsStack: Math.abs(toolsRect.left - graphRect.left) < 2 &&
            toolsRect.top >= graphRect.bottom + 16,
          panelsFit: graphRect.right <= workspaceRect.right + 1 &&
            toolsRect.right <= workspaceRect.right + 1,
          pageFits: document.documentElement.scrollWidth <= innerWidth,
          toolbarCount: toolbars.length,
          toolbarsWrap: toolbars.every(el => {
              const style = getComputedStyle(el)
              return style.display === 'flex' && style.flexWrap === 'wrap'
            }),
        }
      })
      assert(narrow.panelsStack,
        `${name}: graph and tools stack at 390px`)
      assert(narrow.panelsFit,
        `${name}: stacked panels fit inside the workspace`)
      assert(narrow.pageFits,
        `${name}: 390px viewport has no horizontal page overflow`)
      assert(narrow.toolbarCount === 5 && narrow.toolbarsWrap,
        `${name}: narrow editor toolbars wrap`)

      // Wrapping toolbars may only break between checkbox+label pairs, never
      // inside one: each checkbox must stay on the same line as its label
      const checkpairs = await page.evaluate(() => {
        document.querySelectorAll('#editor details')
          .forEach(d => { d.open = true })
        const boxes = [...document.querySelectorAll(
          '#editor input[type="checkbox"]')]
        const rows = boxes.map(box => {
          const label = document.querySelector(`label[for="${box.id}"]`)
          const b = box.getBoundingClientRect()
          const l = label.getBoundingClientRect()
          return {id: box.id, onOneLine: l.top < b.bottom && l.bottom > b.top}
        })
        document.querySelectorAll('#editor details')
          .forEach(d => { d.open = false })
        return rows
      })
      const strays = checkpairs.filter(p => !p.onOneLine).map(p => p.id)
      assert(checkpairs.length === 4 && strays.length === 0,
        `${name}: checkboxes share a line with their labels at 390px ` +
        `(${checkpairs.length} pairs, strays: ${JSON.stringify(strays)})`)

      // The graph matrix is wider than a phone; its pane must scroll so the
      // row buttons stay reachable rather than getting clipped
      const matrix = await page.evaluate(() => {
        const pane = document.getElementById('eroad')
        const buttons = [...pane.querySelectorAll('button')]
        pane.scrollLeft = pane.scrollWidth
        const paneRight = pane.getBoundingClientRect().right
        const reachable = buttons.every(b =>
          b.getBoundingClientRect().right <= paneRight + 1)
        pane.scrollLeft = 0
        return {overflowX: getComputedStyle(pane).overflowX,
                nButtons: buttons.length, reachable}
      })
      assert(matrix.overflowX === 'auto',
        `${name}: graph matrix pane scrolls sideways (got ${matrix.overflowX})`)
      assert(matrix.nButtons > 0 && matrix.reachable,
        `${name}: all ${matrix.nButtons} matrix buttons reachable by scrolling`)

      // The graph and sandbox tabs share the cleaned-up markup and CSS with
      // the editor, so drive them at phone width too
      await page.click('#graphtab')
      await page.waitForSelector('#graph', {visible: true})
      // Focusing the empty date field auto-fills today via Pikaday
      await page.click('#datadate')
      await page.type('#datavalue', '5')
      await page.type('#datacmt', 'abc')
      const graphNarrow = await page.evaluate(() => ({
        date: document.getElementById('datadate').value,
        value: document.getElementById('datavalue').value,
        cmt: document.getElementById('datacmt').value,
        pageFits: document.documentElement.scrollWidth <= innerWidth,
      }))
      assert(/^\d{4}-\d{2}-\d{2}$/.test(graphNarrow.date) &&
             graphNarrow.value === '5' && graphNarrow.cmt === 'abc',
        `${name}: entry form date auto-fills and inputs accept typed text ` +
        JSON.stringify(graphNarrow))
      assert(graphNarrow.pageFits,
        `${name}: graph tab fits a 390px viewport`)
      await page.screenshot({
        path: path.resolve(__dirname,
          'qual_grapheditor_graph_mobile_screenshot.png'),
        fullPage: true,
      })

      await page.click('#sandboxtab')
      await page.waitForSelector('#roadsandbox svg.bmndrsvg .razr',
        {visible: true})
      await page.type('#sdataval', '1')
      await page.click('#sedit button[onclick*="newData"]')
      await page.waitForFunction(
        () => document.getElementById('sundo').innerHTML === 'Undo (1)')
      const sandboxNarrow = await page.evaluate(() => ({
        undoEnabled: !document.getElementById('sundo').disabled,
        rateShown: Number.isFinite(
          parseFloat(document.getElementById('sendslope').value)),
        pageFits: document.documentElement.scrollWidth <= innerWidth,
        activeTabs: [...document.querySelectorAll('.tablinks.active')]
          .map(el => el.id),
      }))
      assert(sandboxNarrow.activeTabs.length === 1 &&
             sandboxNarrow.activeTabs[0] === 'sandboxtab',
        `${name}: exactly the sandbox tab is active after switching ` +
        JSON.stringify(sandboxNarrow.activeTabs))
      assert(sandboxNarrow.undoEnabled,
        `${name}: sandbox accepts a datapoint and enables undo`)
      assert(sandboxNarrow.rateShown,
        `${name}: sandbox dial shows a numeric rate`)
      assert(sandboxNarrow.pageFits,
        `${name}: sandbox tab fits a 390px viewport`)
      await page.screenshot({
        path: path.resolve(__dirname,
          'qual_grapheditor_sandbox_mobile_screenshot.png'),
        fullPage: true,
      })

      // The 1041-1279px band keeps the two-column workspace with no
      // horizontal page overflow
      await page.setViewport({width: 1100, height: 800})
      await page.click('#editortab')
      await page.evaluate(() => new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const mid = await page.evaluate(() => {
        const graphRect = document.querySelector(
          '#editor .graphcontainer').getBoundingClientRect()
        const toolsRect = document.querySelector(
          '#editor .vtabcontainer').getBoundingClientRect()
        return {
          panelsShareRow: Math.abs(graphRect.top - toolsRect.top) < 2,
          pageFits: document.documentElement.scrollWidth <= innerWidth,
        }
      })
      assert(mid.panelsShareRow && mid.pageFits,
        `${name}: two-column layout intact at 1100px ` + JSON.stringify(mid))

      // Park back where the closing checks and final screenshot expect us
      await page.setViewport({width: 390, height: 844})
      await page.evaluate(() => new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))))

      const labels = await page.evaluate(() => ({
        main: [...document.querySelectorAll('.tablinks')]
          .map(el => el.textContent).join('|'),
        editor: [...document.querySelectorAll('.etablinks')]
          .map(el => el.textContent).join('|'),
        actions: ['eundo', 'eredo', 'ereset', 'ezoomall', 'ezoomdflt',
                  'submit'].map(id => document.getElementById(id).textContent)
                           .join('|'),
      }))
      assert(labels.main === 'Graph|Graph Editor|Sandbox',
        `${name}: main-tab copy is unchanged`)
      assert(labels.editor === 'Red Line|Stats|Data|Dial',
        `${name}: editor-tool copy is unchanged`)
      assert(labels.actions ===
        'Undo (0)|Redo (0)|Undo All|View All|Reset Zoom|Submit',
        `${name}: editor-action copy is unchanged`)

      // Replicata: load a goal whose /getgoaljson response is an HTML page
      // instead of JSON, which is what a dead session serves (the server
      // 302s the XHR to the login page). Expectata: loadGoals survives:
      // logs the failure, clears the loading overlays, and the page
      // recovers on the next goal load. Resultata (pre-fix): 480ab4a made
      // butil.loadJSON reject on parse failure without updating its
      // callers, so the rejection escaped as an uncaught SyntaxError (the
      // "Unexpected token '<'" console error) and the "loading..."
      // overlays were stranded forever.
      const badLoad = await page.evaluate(() =>
        loadGoals('htmlgoal').then(() => 'resolved', e => 'rejected: ' + e))
      assert(badLoad === 'resolved',
        `${name}: loadGoals survives an HTML (non-JSON) goal response ` +
        `(got: ${badLoad})`)
      const stuckOverlays = await page.evaluate(() =>
        document.querySelectorAll('svg.bmndrsvg g.overlay').length)
      assert(stuckOverlays === 0,
        `${name}: no loading overlays stranded after a failed goal load ` +
        `(found ${stuckOverlays})`)
      await page.evaluate(() => loadGoals('testroad0'))
      await page.waitForSelector('#roadgraph svg.bmndrsvg .razr')
    }, {width: 1360, height: 900})

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
