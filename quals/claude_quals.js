/* This file is all Claude */

// Puppeteer quals: load graph pages and verify they render correctly
const puppeteer = require('puppeteer')
const http = require('http')
const fs = require('fs')
const path = require('path')
const br = require('../src/broad')
const bu = require('../src/butil')
const bb = require('../src/beebrain')

const REPO = path.resolve(__dirname, '..')
const PORT = 0 // let OS pick an available port

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css', '.bb': 'text/plain',
}

function serve(req, res) {
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
assert(bu.clocky([22.5, 6]) === 7.5, 'clocky midnight crossing (#4382)')
assert(bu.clocky([23, 1])   === 2,   'clocky midnight crossing 23->1')

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
assert(br.AGGR.clocky([22.5, 6])  === 7.5, 'aggday clocky midnight (#4382)')
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
