/**
 * Library of general purpose utilities for Beebrain, provided as a UMD module.
 * Provides a "butil" object holding various constants and utility functions.
 * No internal state.<br/>
 *
 * Copyright 2018-2020 Uluc Saranli and Daniel Reeves
 *
 * @requires moment
 * @exports butil
 */

;((function (root, factory) { // BEGIN PREAMBLE --------------------------------

'use strict'
if (typeof define === 'function' && define.amd) {
  // AMD. Register as an anonymous module.
  //console.log("butil: Using AMD module definition")
  define(['moment'], factory)
} else if (typeof module === 'object' && module.exports) {
  // Node. Does not work with strict CommonJS, but
  // only CommonJS-like environments that support module.exports,
  // like Node.    
  //console.log("butil: Using CommonJS module.exports")
  module.exports = factory(require('./moment'))
} else {
  //console.log("butil: Using Browser globals")
  root.butil = factory(root.moment)
}

})(this, function (moment) { // END PREAMBLE -- BEGIN MAIN ---------------------

'use strict'


// -----------------------------------------------------------------------------
// --------------------------- CONVENIENCE CONSTANTS ---------------------------

const min   = Math.min  
const max   = Math.max  
const abs   = Math.abs  
const pow   = Math.pow  
const log10 = Math.log10
const floor = Math.floor
const round = Math.round

const DIY = 365.25 // this is what physicists use, eg, to define a light year
const SID = 86400  // seconds in a day (not used: DIM=DIY/12, WIM=DIY/12/7)

// -----------------------------------------------------------------------------
// ---------------------------- BEEBRAIN CONSTANTS -----------------------------

var self = {}

/**Maximum amount of time Beebrain processing should take (in ms). Users of
   bgraph and related tools should implement timeouts with this amount to avoid
   infinite waits in case something goes wrong.
   @type {Number}*/
self.MAXTIME = 60000

/** Base URL for images.
    @type {String}*/
self.BBURL = "http://brain.beeminder.com/"

/** Beeminder colors (pro tip: paste this into Slack for swatches)
    @enum {string} */
// Handy: https://material.io/design/color/#tools-for-picking-colors
//        http://tutorials.jenkov.com/svg/fill-patterns.html
self.Cols = {
  DYEL:   "#ffff44", // Dark yellow  (mma 1,1,.55; py 1,1,.4)
  LYEL:   "#ffff88", // Light yellow (mma 1,1,.68; py 1,1,.6)
  ROSE:   "#ff8080", // (originally 1,1/3,1/3 then 251,130,199)
  AKRA:   "#4C4Cff", // (originally 1,1/3,1/3 then 251,130,199)
  PURP:   "#B56bb5", // Moving average line and steppy line
  LPURP:  "#E5BbE5", // Light purple for aura (previously blue/green)
  BLUE:   "#EAEAFF", // Previously used for aura                      [NOT USED]
  GRUE:   "#b5ffDE", // Aura overlap (m .832,1,.832; py .712,1,.872)  [NOT USED]
  ORNG:   "#ff8000", // Dotted centerline of old non-YBHP YBR
  WITE:   "#ffffff", // For hollow dots
  BIGG:   "#ffe54c", // Bigger guiding line demarcating 7-day buffer
  PINK:   "#ffe5e5", // Original pinkzone/oinkzone
  PNKE:   "#ffcccc", // Darker pink for edge of pink zone             [NOT USED]
  GRAY:   "#f0f0f0", // Watermarks (mma .9625; had .96 thru Nov 2014)
  BLCK:   "#000000", // For edges of dots
  REDDOT: "#ff0000", // Red dots for beemergencies
  ORNDOT: "#ffa500", // Orange dots for 1 safe day
  BLUDOT: "#3f3fff", // Blue dots for 2 safe days
  GRNDOT: "#00aa00", // Green dots for 3+ safe days
  GRADOT: "#228B22", // Forest green Grayson dots for 7+ safe days
  ERRDOT: "#00FFFF", // Garish cyan dots to only show if something's fubar
  RAZR0:  "#ff0000", // Bright red line for razor road; faded = #FF5436
  RAZR1:  "#ffa500", // Orange line;                    faded = #FEB642
  RAZR2:  "#3f3fff", // Blue line;                      faded = #8C7AFF
  RAZR3:  "#6BC461", // Green line;                     faded = #6BC461
}

/** Akrasia horizon, in seconds 
    @type {Number} */
self.AKH   = 7*SID
/** ~2038, specifically Rails's ENDOFDAYS+1 (was 2^31-2weeks) 
    @type {Number} */
self.BDUSK = 2147317201

/** Number of seconds in a year, month, etc 
    @enum {Number} */
self.SECS = { 'y' : DIY*SID, 
              'm' : DIY*SID/12,
              'w' : 7*SID,
              'd' : SID,
              'h' : 3600        }
/** Unit names
    @enum {string} */
self.UNAM = { 'y' : 'year',
              'm' : 'month',
              'w' : 'week',
              'd' : 'day',
              'h' : 'hour'      }

/******************************************************************************
 *                                 FUNCTIONS                                  *
 ******************************************************************************/

/** Returns minimum from an array of numbers 
    @param {Number[]} arr Input array */
self.arrMin = (arr) =>( min.apply(null, arr)) // could use spread operator
/** Returns maximum from an array of numbers
    @param {Number[]} arr Input array */
self.arrMax = (arr) =>( max.apply(null, arr)) // could use spread operator

/** Returns true if input is an array 
    @param {} o Input parameter*/
//self.isArray = (o) => ((/Array/).test(Object.prototype.toString.call(o)))
self.isArray = Array.isArray

// TODO: Does not properly copy, especially for array properties. FIX
/**Extends a destination object with properties from a source object,
   optionally overwriting existing elements.
   @param {object} fr Source object 
   @param {object} to Destination object
   @param {boolean} owr Whether to overwrite existing properties of destination
*/
self.extend = (to, fr, owr) => {
  var prop, hasProp
  for (prop in fr) {
    hasProp = to[prop] !== undefined
    if (hasProp && typeof fr[prop] === 'object' 
        && fr[prop] !== null  && fr[prop].nodeName === undefined ) {
      if (self.isArray(fr[prop])) {if (owr) to[prop] = fr[prop].slice(0)}
      else to[prop] = self.extend({}, fr[prop], owr)
    } else if (owr || !hasProp) {
      if (self.isArray(fr[prop])) to[prop] = fr[prop].slice(0)
      else to[prop] = fr[prop]
    }
  }
  return to
}

// Make a deep copy of object x (simpler/better version of above?)
self.deepcopy = (x) => {
  let y, val, key
  if (typeof x !== "object" || x === null) return x // base case
  y = Array.isArray(x) ? [] : {} // initialize the copy
  for (key in x) {
    val = x[key]
    y[key] = self.deepcopy(val) // recur!
  }
  return y
}

/** Applies f on elements of dom, picks the maximum and returns
    the domain element that achieves that maximum. 

    @param {function} f Filter function
    @param {Array} dom Array with domain elements
*/
self.argmax = (f, dom) => {
  if (dom === null) return null
  var newdom = dom.map(f)
  var maxelt = self.arrMax(newdom)
  return dom[newdom.findIndex(e => e === maxelt)]
}

/** Partitions list l into sublists whose beginning indices are separated by d,
    and whose lengths are n. If the end of the list is reached and there are
    fewer than n elements, those are not returned. 

    @param {Array} l Input array
    @param {Number} n Length of each sublist
    @param {Number} d Sublist separation
*/
self.partition = (l, n, d) => {
  var il = l.length
  var ol = []
  for (let i=0; i < il; i+=d) if (i+n <= il) ol.push(l.slice(i,i+n))
  return ol
}

/** Returns a list containing the fraction and integer parts of a float
    @param {Number} f Input number */
self.modf = (f) =>{
  var fp = (f<0)?-f:f, fl = floor(fp)
  return (f<0)?[-(fp-fl),-fl]:[(fp-fl),fl]
}

/** The qth quantile of values in l. For median, set q=1/2.  See
    http://reference.wolfram.com/mathematica/ref/Quantile.html 
    by Ernesto P. Adorio, PhD; UP Extension Program in Pampanga, Clark Field
    @param {Number[]} l Input array
    @param {Number} q Desired quantile, in range [0,1]
    @param {Number} [qt=1] Type of quantile computation, Hyndman and Fan
      algorithm, integer between 1 and 9
    @param {boolean} [issorted=false] Flag to indicate whether the input array
      is sorted
*/
self.quantile = (l, q, qt=1, issorted=false) => {
  var y
  if (issorted) y = l
  else y = l.slice().sort((a,b)=>(a-b))
  if (qt < 1 || qt > 9) return null // error
  
  var abcd = [         // Parameters for the Hyndman and Fan algorithm
    [0,   0,   1, 0],  // R type 1: inv. emp. CDF (mathematica's default)
    [1/2, 0,   1, 0],  // R type 2: similar to type 1, averaged
    [1/2, 0,   0, 0],  // R type 3: nearest order statistic (SAS)
    [0,   0,   0, 1],  // R type 4: linear interp. (California method)
    [1/2, 0,   0, 1],  // R type 5: hydrologist method
    [0,   1,   0, 1],  // R type 6: mean-based (Weibull m; SPSS, Minitab)
    [1,  -1,   0, 1],  // R type 7: mode-based method (S, S-Plus)
    [1/3, 1/3, 0, 1],  // R type 8: median-unbiased
    [3/8, 1/4, 0, 1]], // R type 9: normal-unbiased
      a = abcd[qt-1][0],
      b = abcd[qt-1][1],
      c = abcd[qt-1][2],
      d = abcd[qt-1][3],
      n = l.length,
      out = self.modf(a + (n+b)*q - 1),
      g = out[0],
      j = out[1]
  if (j < 0) return y[0]
  else if (j >= n) return y[n-1] // oct.8,2010 y[n]?! off by 1 error!!
  j = floor(j)
  return (g==0)?y[j]:(y[j] + (y[j+1] - y[j])* (c + d*g))
}

/** Return a list with the sum of the elements in l 
 @param {list} l Input array */
self.sum = (l) => (l.reduce((a,b)=>(a+b), 0))

/**  foldlist(f,x, [e1, e2, ...]) -> [x, f(x,e1), f(f(x,e1), e2), ...] 

 @param {function} f Filter function that takes two arguments
 @param {} x First argument to the function
 @param {Array} l Array of second arguments to the function
*/
self.foldlist = (f, x, l) => {
  var out = [x]
  for (let i = 0; i < l.length; i++)
    out.push(f(out[i], l[i]))
  return out
}

/** Return a list with the cumulative sum of the elements in l,
    left to right 
    @param {Number[]} l*/
self.accumulate = (l) => {
  var ne = l.length
  if (ne === 0) return l
  var nl = [l[0]]
  for (let i = 1; i < ne; i++) nl.push(nl[nl.length-1]+l[i])
  return nl
}

/** Takes a list like [1,2,1] and make it like [1,2,2] (monotone
    increasing) Or if dir==-1 then min with the previous value to
    make it monotone decreasing 
    @param {Number[]} l 
    @param {Number} [dir=1] Direction to monotonize: 1 or -1
*/
self.monotonize = (l, dir=1) => {
  var lo = l.slice(), i
  if (dir === 1) {
    for (i = 1; i < lo.length; i++) lo[i] = max(lo[i-1],lo[i])
  } else {
    for (i = 1; i < lo.length; i++) lo[i] = min(lo[i-1],lo[i])
  }
  return lo
}

/** zip([[1,2], [3,4]]) --> [[1,3], [2,4]].
    @param {Array[]} av Array of Arrays to zip */
self.zip =  (av) => av[0].map((_,i) => av.map(a => a[i]))

/** Return 0 when x is very close to 0.
    @param {Number} x Input number
    @param {Number} [delta=1e-7] Tolerance */
self.chop = (x, delta=1e-7) => (abs(x) < delta ? 0 : x)

/** Return an integer when x is very close to an integer
    @param {Number} x Input number
    @param {Number} [delta=1e-7] Tolerance */
self.ichop = (x, delta=1e-7) => {
  var fp = x % 1, ip = x - fp
  if (fp < 0) {fp += 1; ip -= 1;}
  if (fp > 0.5) fp = 1 - self.chop(1-fp)
  return floor(ip) + self.chop(fp, delta)
}

/** clip(x, a,b) = min(b,max(a,x)). Swaps a and b if a > b.
    @param {Number} x Input number
    @param {Number} a left boundary
    @param {Number} b right boundary */
self.clip = (x, a, b) => {
  if (a > b) { var tmp=a; a=b; b=tmp }
  if (x < a) x = a
  if (x > b) x = b
  return x
}
  
/* Take a sorted array sarr and a distance function df and do a binary search to
   return a pair of bounding indexes into the array, [i, j], such that sarr[i]
   and sarr[j] are as close as possible to what we're searching for.
   (The distance function takes an element of the array and returns a negative
   number if it's too small, a positive number if it's too big, and 0 if it's
   just right.)
   In the common case we're returning a pair of consecutive indices that an
   ideal value would be sorted between. Special cases:
   * If everything in the array is too big, return [null, 0], and if everything
     in the array is too small, return [n-1, null], where n is the array length.
   * If there are any just-right elements in the array then we return the start
     and end indexes of that range of elements -- the ones the distance function
    maps to zero.
   
   Note for the future: Maybe it would be cleaner to specify an optional error
   direction and then return a single thing. There's always a range of indices
   we could return -- either the indices of all the just-right elements if there
   are any, or two consecutive indexes pointing to elements that are too small
   and too big, respectively. If the specified error direction is -1 it means we
   want to err on the low side and return the first thing in the range. If the
   error direction is +1 it means we want to err high and return the last thing
   in the range. I think that makes sense because we never want an actual range
   of indices, we just want the right element of the array. 
   (Also we might not need to specify an error direction if we constructed the
   distance function appropriately? Let me yank myself out of this rabbit hole
   by the ears now. The current version works Just Fine!) */
self.searchby = (sarr, df) => {
  const n = sarr.length
  if (n===0) return null // none of this works with an empty array
  let li = 0    // initially the index of the leftmost element of sarr
  let ui = n-1  // initially the index of the rightmost element of sarr
  let mi        // midpoint of the search range for binary search
  let lv = df(sarr[li])          // value of the lower bound of the search range
  if (lv > 0) return [null, 0]   // smallest element too big
  let uv = df(sarr[ui])          // value of the upper bound of the search range
  if (uv < 0) return [n-1, null] // biggest element too small
  let mv                         // value of the midpoint of the search range
  
  while (lv != 0 && uv != 0 && ui-li > 1) { // binary search to find the bounds
    mi = floor((li+ui)/2)
    mv = mi === li ? lv : df(sarr[mi]) // avoid calling df unnecessarily
    if (mv <= 0) { li = mi; lv = mv } 
    else         { ui = mi; uv = mv }
  }
  // Extend and return index region if the exact element is found
  if (lv != 0 && uv != 0) return [li, ui]
  li = lv == 0 ? li : ui
  ui = li
  // Scooch back out one at a time. If it mattered we could do binary search 
  // here too to find how far to scooch! But in practice presumably we won't 
  // have a huge range of just-right elements so scooching one element at a time
  // until we find the boundary seems fine, I guess?
  // Also the while-if-break here seems gross. Seems like it should work to just
  // say "while the function says zero and the index is in bounds".
  // PS: We're not using any distance functions that can ever even return 0 so 
  // the code below is unreachable right now anyway.
  while (li > 0)   { if (df(sarr[li-1]) == 0) { li -= 1 } else break }
  while (ui < n-1) { if (df(sarr[ui+1]) == 0) { ui += 1 } else break }
  return [li, ui]
}

// Automon is pretty great but sometimes it would also be nice to have unit
// tests. I'm not sure how best to do that. We don't want crap like the
// following in production... 
/*
const unit_test_1 = self.searchby([7,7,7], x => x-7)
if (!(unit_test_1[0] === 0 && unit_test_1[1] === 2)) {
  console.log("TEST FAILED: searchby edge case")
  exit(1)
} 
*/

/******************************************************************************
 *                                  SHOWNUM                                   *
 ******************************************************************************/

/** Show Number: convert number to string. Use at most d significant figures
    after the decimal point. Target t significant figures total (clipped to be
    at least i and at most i+d, where i is the number of digits in the integer
    part of x).
    @param {Number} x Input number
    @param {Number} [t=10] Total number of significant figures 
    @param {Number} [d=5] Number of significant figures after the decimal 
    @param {Number} [e=0] Error direction for conservarounding */
self.shn = (x, t=10, d=5, e=0) => {
  if (isNaN(x)) return x.toString()
  x = self.chop(x)
  let i = floor(abs(x)), k, fmt, ostr
  i = i===0 ? 0 : i.toString().length // # of digits left of the decimal
  if (abs(x) > pow(10,i)-.5) i += 1
  if (i === 0 && x !== 0)                   // get
    k = floor(d - log10(abs(x)))       // desired
  else k = d                                // decimal digits

  // Round input to have the desired number of decimal digits
  let v = x * pow(10, k), vm = v % 10
  if (vm < 0) vm += 10

  // Hack to prevent incorrect rounding with the decimal digits:
  if (vm >= 4.5 && vm < 4.9999999) v = floor(v)
  let xn = round(v) / pow(10, k) + 1e-10

  // Crappy conservaround that just tacks on decimal places till conservative
  if (e < 0 && xn > x || e > 0 && xn < x) { 
    if (d >= 10) xn = x
    else return self.shn(x, t, d+1, e)
  }

  // If total significant digits < i, do something about it
  if (t < i && abs(pow(10, i-1) - xn) < .5) 
    xn = pow(10, i-1)
  t = self.clip(t, i, i+d)
  
  // If the magnitude <= 1e-4, prevent scientific notation
  if (abs(xn) < 1e-4 || floor(xn) === 9 
      || floor(xn) === 99 || floor(xn) === 999) {
    ostr = parseFloat(x.toPrecision(k)).toString()
  } else {
    ostr = xn.toPrecision(t)
    if (!ostr.includes('e')) ostr = parseFloat(ostr)
  }
  return ostr
}

/** Show Number with Sign: include the sign explicitly. See {@link
    module:butil.shn shn}.
    @param {Number} x Input number
    @param {Number} [t=16] Total number of significant figures 
    @param {Number} [d=5] Number of significant figures after the decimal 
    @param {Number} [e=0] Error direction for conservarounding */
//self.shns = (x, t=16, d=5, e=0) => (x>=0 ? "+" : "") + self.shn(x, t, d, e)

/** Show Date: take timestamp and return something like 2012.10.22
    @param {Number} t Unix timestamp */
self.shd = (t) => t === null ? 'null' : self.formatDate(t)

/** Show Date/Time: take timestamp and return something like 2012.10.22 15:27:03
    @param {Number} t Unix timestamp */
self.shdt = (t) => t === null ? 'null' : self.formatDateTime(t)

/** Singular or Plural: Pluralize the given noun properly, if n is not 1.
    Provide the plural version if irregular. 
    Eg: splur(3, "boy") -> "3 boys", splur(3, "man", "men") -> "3 men" 
    @param {Number} n Count
    @param {String} noun Noun to pluralize
    @param {String} [nounp=''] Irregular pluralization if present */
self.splur = (n, noun, nounp='') => {
  if (nounp === '') nounp = noun + 's'
  return self.shn(n, 10, 5) + ' ' + (n === 1 ? noun : nounp)
}

/** Rate as a string.
 @param {Number} r Rate */
//self.shr = (r) => {
//  //if (r === null) r = 0 // maybe?
//  return self.shn(r, 4,2)
//}

// Shortcuts for common ways to show numbers
/** shn(chop(x), 4, 2). See {@link module:butil.shn shn}.
    @param {Number} x Input 
    @param {Number} [e=0] Error direction for conservarounding */
//self.sh1 = function(x, e=0)  { return self.shn( x, 4,2, e) }
/** shns(chop(x), 4, 2). See {@link module:butil.shns shns}.
    @param {Number} x Input 
    @param {Number} [e=0] Error direction for conservarounding */
//self.sh1s = function(x, e=0) { return self.shns(x, 4,2, e) }


/******************************************************************************
 *                         QUANTIZE AND CONSERVAROUND                         *
 ******************************************************************************/

// These functions are from conservaround.glitch.me

// Normalize number: Return the canonical string representation. Is idempotent.
// If we were true nerds we'd do it like wikipedia.org/wiki/Normalized_number
// but instead we're canonicalizing via un-scientific-notation-ing. The other
// point of this is to not lose trailing zeros after the decimal point.
self.normberlize = (x) => {
  x = typeof x == 'string' ? x.trim() : x.toString()  // stringify the input
  const car = x.charAt(0), cdr = x.substr(1)          // 1st char, rest of chars
  if (car === '+') x = cdr                            // drop the leading '+'
  if (car === '-') return '-'+self.normberlize(cdr)   // set aside leading '-'
  x = x.replace(/^0+([^eE])/, '$1')                   // ditch leading zeros
  const rnum = /^(?:\d+\.?\d*|\.\d+)$/                // eg 2 or 5. or 6.7 or .9
  if (rnum.test(x)) return x                          // already normal! done!
  const rsci = /^(\d+\.?\d*|\.\d+)e([+-]?\d+)$/i      // scientific notation
  const marr = x.match(rsci)                          // match array
  if (!marr || marr.length !== 3) return 'NaN'        // hammer can't parse this
  let [, m, e] = marr                                 // mantissa & exponent
  let dp = m.indexOf('.')                             // decimal pt position
  if (dp===-1) dp = m.length                          // (implied decimal pt)
  dp += +e                                            // scooch scooch
  m = m.replace(/\./, '')                             // mantissa w/o decimal pt
  if (dp < 0) return '.' + '0'.repeat(-dp) + m        // eg 1e-3 -> .001
  if (dp > m.length) m += '0'.repeat(dp - m.length)   // eg 1e3 -> 1000
  else m = m.substring(0, dp) + '.' + m.substring(dp) // eg 12.34e1 -> 123.4
  return m.replace(/\.$/, '').replace(/^0+(.)/, '$1') // eg 0023. -> 23
}

// Infer precision, eg, .123 -> .001 or "12.0" -> .1 or "100" -> 1.
// It seems silly to do this with regexes on strings instead of with floors and
// logs and powers and such but (a) the string the user typed is the ground
// truth and (b) using the numeric representation we wouldn't be able to tell
// the difference between, say, "3" (precision 1) and "3.00" (precision .01).
self.quantize = (x) => {
  let s = self.normberlize(x)          // put the input in canonical string form
  if (/^-?\d+\.?$/.test(s)) return 1   // no decimal pt (or only a trailing one)
  s = s.replace(/^-?\d*\./, '.')       // eg, -123.456 -> .456
  s = s.replace(/\d/g, '0')            // eg,             .456 -> .000
  s = s.replace(/0$/, '1')             // eg,                     .000 -> .001
  return +s                            // return the thing as an actual number
}

// Round x to nearest r, avoiding floating point crap like 9999*.1=999.900000001
// at least when r is an integer or negative power of 10.
self.round = (x, r=1) => {
  if (r < 0) return NaN
  if (r===0) return +x
  const y = round(x/r)
  const rpow = /^0?\.(0*)1$/   // eg .1 or .01 or .001 -- a negative power of 10
  const marr = r.toString().match(rpow)   // match array; marr[0] is whole match
  if (!marr) return y*r
  const p = -marr[1].length-1 // p is the power of 10
  return +self.normberlize(`${y}e${p}`)
}

// Round x to the nearest r ... that's >= x if e is +1
//                          ... that's <= x if e is -1
self.conservaround = (x, r=1, e=0) => {
  let y = self.round(x, r)
  if (e===0) return y
  if (e < 0 && y > x) y -= r
  if (e > 0 && y < x) y += r
  return self.round(y, r) // y's already rounded but the +r can f.p. it up
}

/******************************************************************************
 *                        STATS AND AGGDAY FUNCTIONS                          *
 ******************************************************************************/

/** Returns an array with n elements uniformly spaced between a and b 
 @param {Number} a Left boundary
 @param {Number} b Right boundary
 @param {Number} n Number of samples */
self.linspace = (a, b, n) => {
  if (typeof n === "undefined") n = max(round(b-a)+1, 1)
  if (n < 2) return n===1 ? [a] : []
  var i,ret = Array(n)
  n--
  for (i=n; i>=0; i--) ret[i] = (i*b+(n-i)*a)/n
  return ret
}

/** Convex combination: x rescaled to be in [c,d] as x ranges from
    a to b.  clipQ indicates whether the output value should be
    clipped to [c,d].  Unsorted inputs [a,b] and [c,d] are also
    supported and work in the expected way except when clipQ = false,
    in which case [a,b] and [c,d] are sorted prior to computing the
    output. 
    @param {Number} x Input in [a,b]
    @param {Number} a Left boundary of input
    @param {Number} b Right boundary of input
    @param {Number} c Left boundary of output
    @param {Number} d Right boundary of output
    @param {Boolean} [clipQ=true] When false, sort a,b and c,d first */
self.cvx = (x, a,b, c,d, clipQ=true) => {
  var tmp
  if (self.chop(a-b) === 0) {
    if (x <= a) return min(c,d)
    else        return max(c,d)
  }
  if (self.chop(c-d) === 0) return c
  if (clipQ)
    return self.clip(c + (x-a)/(b-a)*(d-c), c>d ? d : c, c>d ? c : d)
  else {
    if (a > b) { tmp=a; a=b; b=tmp }
    if (c > d) { tmp=c; c=d; d=tmp }
    return c + (x-a)/(b-a)*(d-c)
  }
}

/**Delete Duplicates. The ID function maps elements to something that defines
   equivalence classes.
   @param {Array} a Input array
   @param {function} [idfun=(x=>x)] Function to map elements to an equivalence
           class */
self.deldups = (a, idfun=(x=>x)) => {
  let seen = {}
  return a.filter(i => {
    const marker = JSON.stringify(idfun(i))
    return marker in seen ? false : (seen[marker] = true)
  })
}

/** Whether list l is sorted in increasing order.
    @param {Number[]} l Input list*/
self.orderedq = (l) => {
  for (let i = 0; i < l.length-1; i++) if (l[i] > l[i+1]) return false
  return true
}

/** Whether all elements in a list are zero
    @param {Number[]} a Input list*/
self.nonzero = (a) => {
  var l = a.length, i
  for (i = 0; i < l; i++) if (a[i] !== 0) return true
  return false
}

/** Sum of differences of pairs, eg, [1,2,6,9] -> 2-1 + 9-6 = 1+3 = 4
    If there's an odd number of elements then the last one is ignored.
    @param {Number[]} a Input list*/
self.clocky = (a) => {
  let s = 0
  for (let i = 1; i < a.length; i += 2) s += a[i]-a[i-1]
  return s
}

/** Arithmetic mean of values in list a
    @param {Number[]} a Input list*/
self.mean = (a) => {
  var s = 0, l = a.length, i
  if (l == 0) return 0
  for(i = 0; i < l; i++) s += a[i]
  return s / a.length
}

/** Median of values in list a
    @param {Number[]} a Input list*/
self.median = (a) => {
  var m = 0, l = a.length
  a.sort((a,b)=>a-b)
  if (l % 2 === 0) m = (a[l/2-1] + a[l/2]) / 2
  else m = a[(l-1) / 2]
  return m
}

/** Mode (commonest) of values in list a. Breaks ties in favor of whatever 
    appears first in the lsit. (Mathematica-brain gave the median of the list of
    commonest elements but literally no one cares about aggday=mode anyway.)
    @param {Number[]} a Input list*/
self.mode = (a) => {
  if (!a || !a.length) return NaN
  let tally = {} // hash mapping each element of a to how many times it appears
  let maxtally = 1
  let maxitem = a[0]
  for (const i in a) {
    tally[a[i]] = (tally[a[i]] || 0) + 1
    if (tally[a[i]] > maxtally) {
      maxtally = tally[a[i]]
      maxitem = a[i]
    }
  }
  return maxitem
}

// Trimmed mean. Takes a list of numbers, a, and a fraction to trim.
self.trimmean = (a, trim) => {
  const n = Math.floor(a.length * trim)
  const ta = a.sort((a,b) => a-b).slice(n, a.length - n) // trimmed array
  return ta.reduce((a,b) => a+b) / ta.length
}

/** Whether min <= x <= max.
    @param {Number} x
    @param {Number} min
    @param {Number} max */
self.inrange = (x, min, max) => x >= min && x <= max

/** Whether abs(a-b) < eps 
    @param {Number} a
    @param {Number} b
    @param {Number} eps */
self.nearEq = (a, b, eps) => abs(a-b) < eps

/******************************************************************************
 *                              DATE FACILITIES                               *
 ******************************************************************************/

/** Returns a new date object ahead by the specified number of
 * days (uses moment)
 @param {moment} m Moment object
 @param {Number} days Number of days to add */
self.addDays = (m, days) => {
  var result = moment(m)
  result.add(days, 'days')
  return result
}

/* Utility functions from hmsparsafore in case they're useful...

// Convenience function. What Jquery's isNumeric does, I guess. Javascript wat?
function isnum(x) { return x - parseFloat(x) + 1 >= 0 }

// Take a Date object, set the time back to midnight, return new Date object
function dayfloor(d) {
  var x = new Date(d)
  x.setHours(0)
  x.setMinutes(0)
  x.setSeconds(0)
  return x
}

// Given a time of day expressed as seconds after midnight (default midnight),
// return a Date object corresponding to the soonest future timestamp that
// matches that time of day
function dateat(t=0) {
  if (isNaN(t)) { return null }
  var now = new Date()
  var d = new Date()
  d.setTime(dayfloor(d).getTime() + 1000*t)
  if (d < now) { d.setTime(d.getTime() + 1000*86400) }
  return d  
}

// Turn a Date object (default now) to unixtime in seconds
function unixtm(d=null) {
  if (d===null) { d = new Date() }
  return d.getTime()/1000
}

// Turn a unixtime in seconds to a Date object
function dob(t=null) {
  if (t===null) { return new Date() }
  return isnum(t) ? new Date(1000*t) : null
}

// [Tested, works, at least for current and future timestamps]
// Takes unixtime and returns time of day represented as seconds after midnight.
function TODfromUnixtime(t) {
  var offset = new Date().getTimezoneOffset()
  return (t - offset*60) % 86400
}
*/

/** Fixes the supplied unixtime to 00:00:00 on the same day (uses Moment)
    @param {Number} ut Unix time  */
self.daysnap = (ut) => {
  var d = moment.unix(ut).utc()
  d.hours(0)
  d.minutes(0)
  d.seconds(0)
  d.milliseconds(0)
  return d.unix()
}

/** Scooches unixtime ut to 00:00:00 on the first of the month (uses Moment)
    @param {Number} ut Unix time  */
self.monthsnap = (ut) => {
  var d = moment.unix(ut).utc()
  d.date(1).hours(0).minutes(0).seconds(0).milliseconds(0)
  return d.unix()
}

/** Fixes the supplied unixtime to the first day 00:00:00 on the
    same year (uses moment)
    @param {Number} ut Unix time  */
self.yearsnap = (ut) => {
  var d = moment.unix(ut).utc()
  d.month(0).date(1).hours(0).minutes(0).seconds(0).milliseconds(0)
  return d.unix()
}

/** Formats the supplied unix time as YYYY.MM.DD
    @param {Number} ut Unix time  */
self.formatDate = (ut) => {
  var mm = moment.unix(ut).utc()
  var year = mm.year()
  var month = (mm.month()+1)
  month = month < 10 ? "0"+month.toString() : month.toString()
  var day = mm.date()
  day= day < 10 ? "0"+day.toString() : day.toString()
  return year+"."+month+"."+day
}

/** Formats the supplied unix time as YYYY.MM.DD HH.MM.SS
    @param {Number} ut Unix time  */
self.formatDateTime = (ut) => {
  var mm = moment.unix(ut).utc()
  var hour = mm.hour()
  hour = hour < 10 ? "0"+hour.toString() : hour.toString()
  var minute = mm.minute()
  minute = minute < 10 ? "0"+minute.toString() : minute.toString()
  var second = mm.second()
  second = second < 10  ? "0"+second.toString() : second.toString()
  return self.formatDate(ut)+" "+hour+":"+minute+":"+second
}

let dpre_empty = RegExp('^(\\d{4})(\\d{2})(\\d{2})$')
let pat_empty = "YYYYMMDD"
/** Take a daystamp like "20170531" and return unixtime in seconds
    (dreev confirmed this seems to match Beebrain's function)
    @param {String} s Daystamp as a string "YYYY[s]MM[s]DD"
    @param {String} [sep=''] Separator character */
self.dayparse = (s, sep='') => {
  let re, pat
  if (s == null) return null
  if (sep=='') {
    // Optimize for the common case
    re = dpre_empty
    pat = pat_empty
  } else {
    // General case with configurable separator
    re = RegExp('^(\\d{4})'+sep+'(\\d{2})'+sep+'(\\d{2})$')
    pat = "YYYY"+sep+"MM"+sep+"DD"
  }
  let match
  if (typeof(s) != 'string') match = null
  else match = s.match(re) 
  if (!match) { // make sure the supplied date is a timestamp
    if (!isNaN(s)) return Number(s)
    else return NaN
  }
  return Date.UTC(match[1], match[2]-1, match[3])/1000
}

/** Take an integer unixtime in seconds and return a daystamp like
    "20170531" (dreev superficially confirmed this works) Uluc: Added
    option to choose a separator
    @param {Number} t Integer unix timestamp
    @param {String} [sep=''] Separator character to use */
self.dayify = (t, sep = '') => {
  if (isNaN(t) || t < 0) { return "ERROR" }
  if (t == null) return null
  var mm = moment.unix(t).utc()
  var y = mm.year()
  var m = mm.month() + 1
  var d = mm.date()
  return '' + y + sep + (m < 10 ? '0' : '') + m + sep + (d < 10 ? '0' : '') + d
}
  
/** adjasof: Indicates whether the date object for "now" should be
 * adjusted for the asof value to support the sandbox etc. */
self.nowstamp = (tz, deadline, asof) => {
  let d
  if (tz) {
    // Use supplied timezone if moment-timezone is loaded
    if (moment.hasOwnProperty('tz'))  d = moment().tz(tz)
    else {
      console.log("butil.nowstamp: moment-timezone is not loaded, using local time")
      d = moment() // Use local time if moment-timezone is not loaded
    }
  } else {
    console.log("butil.nowstamp: no timezone specified, using local time")
    d = moment()
  }
  // Set date of the time object to that of asof to support the
  // sandbox and example goals with past asof
  if (asof) {
    const tasof = moment.unix(asof).utc()
    const tdiff = (moment(d).utc() - tasof)/1000
    // Hack to ensure "Yesterday" appears in the dueby table when the
    // current time is past the deadline on the next day
    if (tdiff < 0 || tdiff > 2*SID)
      d.year(tasof.year()).month(tasof.month()).date(tasof.date())
  }
  d.subtract(deadline, 's')
  return d.format("YYYYMMDD")
}
/** Converts a number to an integer string.
    @param {Number} x Input number */
self.sint = (x) => round(x).toString()

/** Returns a promise that loads a JSON file from the supplied
    URL. Resolves to null on error, parsed JSON object on
    success. 
    @param {String} url URL to load JSON from*/
self.loadJSON = (url) => {   
  return new Promise(function(resolve, reject) {
    if (url === "") resolve(null)
    var xobj = new XMLHttpRequest()
    xobj.overrideMimeType("application/json")
    xobj.onreadystatechange = function () {
      if (xobj.readyState == 4 
          && (xobj.status == "200"
              || (xobj.status == "0" && xobj.responseText != ""))) {
        try {
          resolve(JSON.parse(xobj.responseText))
        } catch(err) {
          // Possible parse error in loading the bb file
          console.log("butil.loadJSON: Could not parse JSON file in "+url)
          console.log(err.message)
          resolve(null)
        }
      } else if (xobj.readyState == 4) {
        resolve(null)
      }
    }
    xobj.open('GET', url, true)
    xobj.send(null)
  })
}

/** Changes first letter of each word to uppercase 
    @param {String} str Input string*/
self.toTitleCase = (str) => {
  return str.replace( /\w\S*/g, function(txt) { 
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()});
}

/** Deep compares array a1 and a2 for equality. Does not work on
 * objects within the array 
 @param {Array} a1 First array 
 @param {Array} a2 Second array */
self.arrayEquals = (a1, a2) => {
  // if the other array is a falsy value, return
  if (!(a1 instanceof Array) || !(a2 instanceof Array)) return false

  // compare lengths - can save a lot of time 
  if (a1.length != a2.length) return false

  for (let i = 0, l = a1.length; i < l; i++) {
    // Check if we have nested arrays
    if (a1[i] instanceof Array && a2[i] instanceof Array) {
      // recurse into the nested arrays
      if (!self.arrayEquals(a1[i], a2[i])) return false
    } else if (a1[i] !== a2[i]) { 
      // Warning - two separate object instances will never
      // be equal: {x:20} != {x:20}
      return false
    }           
  }       
  return true
}

// Convenience functions to check object types
/** true if valid float and finite
    @param {} n */
self.nummy = (n) => !isNaN(parseFloat(n)) && isFinite(n)
/** true if string?
    @param {} x */
self.stringy = (x) => (typeof x === "string")
/** true if Array
    @param {} x */
self.listy = (x) => Array.isArray(x)

// Type-checking convenience functions
/** true if boolean 
    @param {} x */
self.torf = (x) => typeof x === "boolean"
/** true if boolean or null
    @param {} x */
self.born = (x) => self.torf(x) || x === null
/** true if numeric or null
    @param {} x */
self.norn = (x) => self.nummy(x) || x === null
/** true if valid time
    @param {} x */
self.timy = (x) => self.nummy(x) && 0<x && x<self.BDUSK
/** true if valid time or null
    @param {} x */
self.torn = (x) => self.timy(x) || x === null
/** true if string or null
    @param {} x */
self.sorn = (x) => typeof x === "string" || x === null

return self

})); // END MAIN ---------------------------------------------------------------

/**
 * Library of utilities for Beebrain, provided as a UMD module. Returns a
 * "broad" object with public member functions and constants for calculating 
 * things about yellow brick roads. Does not hold any internal state.
 *
 * Copyright 2018-2020 Uluc Saranli and Daniel Reeves

 @requires moment
 @requires butil

 @exports broad
*/

;((function(root, factory) { // BEGIN PREAMBLE ---------------------------------

'use strict'

if (typeof define === 'function' && define.amd) {
  // AMD. Register as an anonymous module.
  //console.log("broad: Using AMD module definition")
  define(['moment', 'Polyfit', 'butil'], factory)
} else if (typeof module === 'object' && module.exports) {
  // Node. Does not work with strict CommonJS, but only CommonJS-like
  // environments that support module.exports, like Node.
  //console.log("broad: Using CommonJS module.exports")
  module.exports = factory(require('./moment'), 
                           require('./polyfit'), 
                           require('./butil'))
} else {
  //console.log("broad: Using Browser globals")
  root.broad = factory(root.moment, root.Polyfit, root.butil)
}

})(this, function(moment, Polyfit, bu) { // END PREAMBLE -- BEGIN MAIN ---------

'use strict'

// -----------------------------------------------------------------------------
// --------------------------- CONVENIENCE CONSTANTS ---------------------------

const rnd   = Math.round
const max   = Math.max
const min   = Math.min
const abs   = Math.abs
const pow   = Math.pow
const floor = Math.floor
const ceil  = Math.ceil
const sign  = Math.sign

const DIY = 365.25
const SID = 86400

// -----------------------------------------------------------------------------
// ------------------- PUBLIC MEMBER CONSTANTS AND FUNCTIONS -------------------

var self = {}

self.rsk8 = 0 // Hack for skatesum (should be current daily rate but isn't)

/** Collection of functiont to perform datapoint aggregation
    @enum {function} */
self.AGGR = {
last     : (x) => x[x.length-1],
first    : (x) => x[0],
min      : (x) => bu.arrMin(x),
max      : (x) => bu.arrMax(x),
truemean : (x) => bu.mean(x),
uniqmean : (x) => bu.mean(bu.deldups(x)),
mean     : (x) => bu.mean(bu.deldups(x)),
median   : (x) => bu.median(x),
mode     : (x) => bu.mode(x),
trimmean : (x) => bu.trimmean(x, .1),
sum      : (x) => bu.sum(x),
jolly    : (x) => x.length > 0 ? 1 : 0,
binary   : (x) => x.length > 0 ? 1 : 0,
nonzero  : bu.nonzero,
triangle : (x) => bu.sum(x)*(bu.sum(x)+1)/2, // HT DRMcIver
square   : (x) => pow(bu.sum(x),2),
clocky   : bu.clocky, // sum of differences of pairs
count    : (x) => x.length, // number of datapoints
kyshoc   : (x) => min(2600, bu.sum(x)), // ad hoc, guineapigging
skatesum : (x) => min(self.rsk8, bu.sum(x)), // cap at daily rate
cap1     : (x) => min(1, bu.sum(x)), // for zedmango
}

/*
For aggdays that pick one datapoint value (first, last, min, max), allvals should be the raw values (plus the previous day's aggval if kyoomy). For aggday=sum, you want to see the incremental sums. For exotic aggdays... it's super non-obvious what's best...

One tiny improvement we could make to the current code though: for aggday=sum, we want allvals to use the incremental sums regardless of whether the goal is kyoomy.
*/


/** Enum object to identify field types for road segments. 
    @enum {number} */
self.RP = { DATE:0, VALUE:1, SLOPE:2 }

/** Pretty prints a given array of road segments.
    @param {Array} rd Array of road segment objects */
self.printRoad = (rd) => {
  for (let i = 0; i < rd.length; i++) {
    var s = rd[i]
    console.debug("[("+s.sta[0]+"("+bu.formatDate(s.sta[0])+"),"+s.sta[1]+
                  "),("+s.end[0]+"("+bu.formatDate(s.end[0])+"),"+s.end[1]+"),"
                  +s.slope+", auto="+s.auto+"]")
  }
}

/** Checks whether two road arrays are identical with nearEq segments.
    @param rda First array fo road segments
    @param rdb Second array fo road segments */
self.sameRoads = ( rda, rdb ) => {
  if (rda.length != rdb.length) return false
  for (let i = 0; i < rda.length; i++) {
    if (!bu.nearEq(rda[i].end[0], rdb[i].end[0], 10))   return false
    if (!bu.nearEq(rda[i].end[1], rdb[i].end[1], 10))   return false
    if (!bu.nearEq(rda[i].slope,  rdb[i].slope, 1e-14)) return false
  }
  return true
}

/** Creates and returns a clone of the supplied road array */
self.copyRoad = (rd) => {
  var nr = []
  for (let i = 0; i < rd.length; i++) {
    var s = {
      sta:   rd[i].sta.slice(), 
      end:   rd[i].end.slice(),
      slope: rd[i].slope, 
      auto:  rd[i].auto,
    }
    nr.push(s)
  }
  return nr
}

/* Find the index of the road segment containing the given t-value. Note that
   there could be a vertical segment (or even multiple ones) exactly at the
   given t-value. In that case the dir parameter says how to disambiguate. Since
   we've added a flat dummy segment after tfin (and before tini), we're
   guaranteed to find a non-vertical segment for any t-value.
   Cases:
   1. t is within exactly one segemnt: easy, return (the index of) that segment
   2. t is on a boundary between 2 segments: return 2nd one (regardless of dir)
   3. t is on a vertical segment & dir=-1: return the first vertical segment
   4. t on a vert segmt & dir=+1: return the non-vertical segment to the right
   5. t on a vert segmt & dir=0: return the vertical segment (if there are
      multiple vertical segments all at t, return one arbitrarily) */
self.findSeg = (rd, t, dir=0) => {
  const st = i => rd[i].sta[0]                 // start time of ith road segment
  const et = i => rd[i].end[0]                  // end time of ith road segment
  const isin = (t,i) => st(i) <= t && t < et(i)  // whether segment i contains t

  if (!rd || !rd.length || t < st(0) || t > et(rd.length-1)) return -1

  let a = 0            // initially the index of the leftmost road segment
  let b = rd.length-1  // initially the index of the rightmost road segment
  let m                // midpoint of the search range for binary search
  while (b-a > 1) {
    m = floor((a+b)/2)
    if (st(m) <= t) a = m // m is good or too far left (so throw away left half)
    else            b = m // m is too far right (so throw away right half)
  }   // at this point a & b are consecutive and at least one of them contains t
  m = isin(t, b) ? b : a // if both a & b contain t, pick b (bias right)
  // TODO: find a test bb file where doing this scooching actually matters:
  if (dir < 0) while(m > 0           && st(m-1) === t) m--
  if (dir > 0) while(m < rd.length-1 && st(m+1) === t) m++
  return m
}

/** Computes the slope of the supplied road segment */
self.segSlope = (rd) => (rd.end[1] - rd.sta[1]) / (rd.end[0] - rd.sta[0])

/** Computes the value of a road segment at the given timestamp */
self.segValue = (rdseg, x) => rdseg.sta[1] + rdseg.slope*(x - rdseg.sta[0])

/** Computes the value of a road array at the given timestamp */
self.rdf = (rd, x) => self.segValue( rd[self.findSeg(rd, x)], x )

/**Recompute road matrix starting from the first node and assuming that exactly
   one of the slope, enddate, or endvalue parameters is chosen to be
   automatically computed. If usematrix is true, autocompute parameter
   selections from the road matrix are used. */
self.fixRoadArray = (rd, autop=self.RP.VALUE, usematrix=false, 
                     edited=self.RP.VALUE) => {
  const nr = rd.length
  // Fix the special first road segment w/ slope always 0
  rd[0].sta[0] = rd[0].end[0] - 100*DIY*SID
  rd[0].sta[1] = rd[0].end[1]
  
  // Iterate thru the remaining segments until the last one
  for (let i = 1; i < nr-1; i++) {
    //console.debug("before("+i+"):[("+rd[i].sta[0]+
    //","+rd[i].sta[1]+"),("+rd[i].end[0]+","
    //+rd[i].end[1]+"),"+rd[i].slope+"]")
    if (usematrix) autop = rd[i].auto
    
    var dv = rd[i].end[1] - rd[i].sta[1] 
    
    rd[i].sta[0] = rd[i-1].end[0]
    rd[i].sta[1] = rd[i-1].end[1]
    
    if (autop === self.RP.DATE) {
      if (isFinite(rd[i].slope) && rd[i].slope != 0) {
        rd[i].end[0] = bu.daysnap(
          rd[i].sta[0]+(rd[i].end[1]-rd[i].sta[1])/rd[i].slope)
      }
      // Sanity check
      if (rd[i].end[0] <= rd[i].sta[0])
        rd[i].end[0] = bu.daysnap(rd[i].sta[0]+SID)
       
      if (edited === self.RP.SLOPE)
        // Readjust value if slope was edited
        rd[i].end[1] = rd[i].sta[1]+rd[i].slope*(rd[i].end[0]-rd[i].sta[0])
      else
        // Readjust value if value was edited
        rd[i].slope = self.segSlope(rd[i])
    } else if (autop === self.RP.VALUE) {
      if (isFinite(rd[i].slope))
        rd[i].end[1] = rd[i].sta[1]+rd[i].slope*(rd[i].end[0]-rd[i].sta[0])
      else
        // If slope is infinite, preserve previous delta
        rd[i].end[1] = rd[i].sta[1]+dv  
    } else if (autop === self.RP.SLOPE)
      rd[i].slope = self.segSlope(rd[i])
  }
     
  // Fix the last segment
  if (nr > 1) {
    rd[nr-1].sta[0] = rd[nr-2].end[0]
    rd[nr-1].sta[1] = rd[nr-2].end[1]
    rd[nr-1].end[0] = rd[nr-1].sta[0] + 100*DIY*SID
    rd[nr-1].end[1] = rd[nr-1].sta[1]
  }
}

/**Good delta: Return the delta from the given point to the razor road but with
   the sign such that being on the good side of the road gives a positive delta
   and being on the wrong side gives a negative delta. */
self.gdelt = (rd, g, t, v) => bu.chop(g.yaw*(v - self.rdf(rd, t)))

/** Whether the given point is on or on the good side of the razor road */
self.aok = (rd, g, t, v) => {
  //console.log(`DEBUG: ${JSON.stringify(rd)}`)
  // DRY: this is check is basically the same code as isoside()
  return g.yaw * (v - self.rdf(rd, t)) >= abs(v)*-1e-15
}

/** Pessimistic Presumptive Report (PPR). If this is being computed for *today*
    then return 0 when PPRs are actually turned off (g.ppr==false). If it's
    being computed for the future then go ahead and compute the PPR regardless.
    That's because we want the PPR setting respected for showing an anticipated 
    ghosty PPR for today or not, but then for the future if we don't assume 
    PPRs then do-less goals would always have infinite safety buffer. I.e., the
    PPR setting only matters for *today*. 

    Uluc: Added two parameters, i indicated a specific road segment
    and overrides the rtf() call. Used by the dtdarray function. The
    second one is pastppr, which disables ppr=0 for t<asof since
    nonzero pprs are needed to generate regions before asof
*/
self.ppr = (rd, g, t, i=null, pastppr=false) => {
  // TODO: we may want to use g.maxflux as the PPR for MOAR/PHAT
  if (g.yaw*g.dir >= 0) return 0 // MOAR/PHAT => PPR=0; for WEEN/RASH read on...
  // Suppress the PPR if (a) we're computing it for today and (b) there's
  // already a datapoint entered today or if PPRs are explicitly turned off:
  if (!pastppr && t <= g.asof && (!g.ppr || g.tdat === g.asof)) return 0
  // Otherwise it's (a) for the future or (b) for today and PPRs are turned on
  // and there's no datapoint added for today, so go ahead and compute it...
  var r
  if (i != null) r = rd[i].slope * SID
  else r = self.rtf(rd, t) * SID  // twice the current daily rate of the YBR
  if (r === 0) return -g.yaw * 2  // absolute PPR of 2 gunits if flat slope
  if (g.yaw*r > 0) return 0   // don't let it be an OPR (optimistic presumptive)
  return 2*r
}

/** Return number of days to derail for the current road.
    TODO: There are some issues with computing tcur, vcur */
self.dtd = (rd, gol, t, v) => {
  if (self.redyest(rd, gol, t)) return 0 // TODO: need iso here

  let x = 0 // the number of steps
  let vpess = v + self.ppr(rd, gol, t+x*SID) // value as we walk fwd w/ PPRs
  while (self.aok(rd, gol, t+x*SID, vpess) && t+x*SID <= max(gol.tfin, t)) {
    x += 1 // walk forward until we're off the YBR
    vpess += self.ppr(rd, gol, t+x*SID)
  }
  return x
}
  
/*
Computes piecewise linear dtd (days-to-derail) functions for every
inflection point on the road. This is returned as an array, having as
many elements as inflections on the road, of possibly differently
sized arrays that describe the piecewise linear dependence of the dtd
function on the y coordinate for the corresponding point on the
road. For example:
[
  [          // Entry for the node n (rightmost) on the road
    [t_n y0 dtd0 y1 dtd1],
  ],          
  [          // Entry for the node n-1 on the road
    [t_(n-1) y0 dtd0 y1 dtd1],
    [t_(n-1) y1 dtd1 y2 dtd2]
  ],
  [          // Entry for the node n-1 on the road
    [t_(n-1) y0 dtd0 y1 dtd1],
    [t_(n-1) y1 dtd1 y2 dtd2]
    [t_(n-1) y2 dtd2 y3 dtd3]
  ], ...
]

The array starts from the rightmost node, for which there is only one
relevant dtd degment that corresponds to derailing on the next road
line. The next entry is for node (n-1), for which two dtd segments
will be present, corresponding to derailing on line n-1 or line
n. Subsequent road nodes have additional rows correspondign to
derailing on newly considered road lines.

This dtd array is computed by following the endpoints of every road
line segment backwards along the dtd vector, whose x coordinate is
always 1 days, with the y coordinate dependent on the current road
slope for doless goals and 0 for domore goals. This array can then be
used later to compute isolines for the dtd function, which are curves
along which the dtd function is constant. This is used to compute and
visualize colored regions on graphs as well as guidelines.
*/
self.dtdarray = ( rd, gol ) => {
  var rdl = rd.length
  var xcur = rd[rdl-1].sta[0], ycur = rd[rdl-1].sta[1], xn, yn
  var ppr = self.ppr(rd, gol, 0, rdl-1), sl, dtd
  var arr = [], seg
  arr = [[[xcur, ycur, 0, ycur-ppr, 1]]]
  for (var i = rdl-2; i >= 0; i--) {
    xcur = rd[i].sta[0]
    ycur = rd[i].sta[1]
    xn = rd[i].end[0]
    yn = rd[i].end[1]
    ppr = self.ppr(rd, gol, 0, i, true)
    dtd = ((xn-xcur)/SID)
    if (!isFinite(ppr)) {
      if (gol.dir*(ycur - yn) > 0)
        seg = [[xcur, ycur, 0, yn, dtd]]
      else
        seg = [[xcur, ycur, 0, yn-2*(yn-ycur), dtd]]
    } else
      seg = [[xcur, ycur, 0, yn-ppr*dtd, dtd]]
    
    var last = arr[arr.length-1]
    for (var j = 0; j < last.length; j++) {
      if (!isFinite(ppr)) {
        if (gol.dir*(ycur - yn) > 0)
          seg.push([xcur,last[j][1], last[j][2],last[j][3], last[j][4]])
        else
          seg.push([xcur,last[j][1]-2*(yn-ycur), last[j][2]+(xn-xcur),
                    last[j][3]-2*(yn-ycur), last[j][4]+(xn-xcur)])
      } else
        seg.push([xcur,last[j][1]-ppr*dtd, last[j][2]+dtd,
                  last[j][3]-ppr*dtd, last[j][4]+dtd])
    }
    arr.push(seg)
  }
  //console.log(arr)
  return arr
}

/**Generate and return an initial version of the isoline by processing the
   supplied dtdarray. The resulting isoline is correct for doless and rash
   goals, but will need further processing for goal with dir*yaw>0. */
self.isoline_generate = (rd, dtdarr, gol, v) => {
  var n = dtdarr[0], nn, iso
  var s = 0, ns, j, k, st, en, sl

  function addunique(arr, pt) {
    var elt = arr[arr.length-1]
    if (elt[0] != pt[0] || elt[1] != pt[1])
      arr.push(pt)
  }
  
  // Start the isoline with a horizontal line for the end of the road
  iso = [[n[0][0]+10*SID, n[0][1]+v*(n[0][3]-n[0][1])],
         [n[0][0],        n[0][1]+v*(n[0][3]-n[0][1])]]
  for (j = 1; j < dtdarr.length; j++) {
    nn = dtdarr[j]
    // Identify dtd segment in which the desired value lies
    ns = nn.length-1
    for (k = 0; k < nn.length; k++) {
      if (v <= nn[k][4]) {
        ns = k
        break
      }
    }
    // Consider inflections between the previous segment index and newly found
    // segment index from inflection j+1 to inflection j on the road
    for (k=s; k >= ns; k--) {
      st = [n[k][0], n[k][1], n[k][2]]
      en = [nn[k][0], nn[k][3], nn[k][4]]
      if (en[2] - st[2] == 0)
        addunique(iso, [st[0], st[1]])
      else {
        sl = (v-st[2]) / (en[2]-st[2])
        addunique(iso, [st[0] + sl*(en[0]-st[0]), 
                  st[1] + sl*(en[1]-st[1])])
      }
    }
    st = [nn[ns][0], nn[ns][1], nn[ns][2]]
    en = [nn[ns][0], nn[ns][3], nn[ns][4]]
    if (en[2] - st[2] == 0)
      addunique(iso, [st[0], st[1]])
    else {
      sl = (v-st[2]) / (en[2]-st[2])
      addunique(iso, [st[0] + sl*(en[0]-st[0]), st[1]+sl*(en[1]-st[1])])
    }
    s = ns
    n = nn
  }
  return iso.reverse()  
}

/**Ensure correctness of the isoline for do-more goals such that the isoline is
   not allowed to go against 'dir' for dtd days after a road kink. This ensures
   that the first intersection with the razor road is taken as the dtd value. */
self.isoline_monotonicity = (iso, rd, dtdarr, gol, v) => {
  if (gol.yaw * gol.dir < 0) return iso
  
  let isoout = []
  let downstreak = false
  let flatdone = false
  let slope, newx, j, k
  const addpt = function(a, pt) { a.push([pt[0], pt[1]]) }

  // k holds the last isoline segment that's been processed and filtered
  k = -1
  // j iterates over unfiltered isoline segments
  for (j = 0; j < iso.length-1; j++) {
    // If an upslope is detected, finish downstreak
    if ((iso[j+1][1] - iso[j][1]) * gol.dir > 0) downstreak = false
    
    addpt(isoout, iso[j])
    
    // Check if new downstreak to initiate new flat region (when dtd != 0)
    if (v != 0 && (iso[j+1][1] - iso[j][1]) * gol.dir < 0 && !downstreak) {
      
      downstreak = true
      // Extend horizontally by at least dtd days or till we find positive slope
      k = j+1
      flatdone = false
      while (!flatdone) {
        if (iso[k][0] >= iso[j][0] + v*SID) {
          // Reached end of the flat region with dtd days
          flatdone = true
          newx = iso[j][0]+v*SID
          addpt(isoout, [newx, iso[j][1]])
          
        } else if ((iso[k+1][1] - iso[k][1]) * gol.dir >= 0) {
          // Found a positive slope, finish flat region by extending until 
          // intersection with the positive slope unless the next segment ends
          // before that.
          if (iso[k+1][0] != iso[k][0]) {
            slope = (iso[k+1][1]-iso[k][1])
                   /(iso[k+1][0]-iso[k][0])
            if (slope != 0) {
              newx = iso[k][0] + (iso[j][1] - iso[k][1])/slope
              if (newx <= iso[j][0]+v*SID && newx <= iso[k+1][0]) {
                flatdone = true
              }
            }
          } else if ((iso[j][1]-iso[k][1])*(iso[j][1]-iso[k+1][1]) < 0) {
            // Early intersection with upward vertical segment found.
            // +1 ensures that filtering gets rid of extra backward segments
            newx = iso[k][0]+1
            flatdone = true
          }
          if (flatdone) {
            addpt(isoout, [newx, iso[j][1]])
          }
        }
        k++
      }
    }
  }
  return isoout
}

/** Eliminate backward line segments introduced by the monotonicty pass. */
self.isoline_nobackward = (iso, rd, dtdarr, gol, v) => {
  var isoout = [iso[0].slice()], lastpt, slope, j
  for (j = 1; j < iso.length; j++) {
    lastpt = isoout[isoout.length-1]
    if (iso[j][0] < lastpt[0]) continue
    if (iso[j-1][0] < lastpt[0] && iso[j][0] > lastpt[0]) {
      // Intermediate point needed
      if (iso[j][0] - iso[j-1][0] != 0) {
        slope = (iso[j][1] - iso[j-1][1])/(iso[j][0] - iso[j-1][0])
        isoout.push([lastpt[0], iso[j-1][1] + slope*(lastpt[0]-iso[j-1][0])])
      }
    }
    isoout.push([iso[j][0], iso[j][1]])
  }
  return isoout
}

/* Eliminates segments on the wrong side of the road */
self.isoline_clip = ( iso, rd, dtdarr, gol, v ) => {
  var isoout = []

  function lineval(s, e, x) {
    var sl = (e[1]-s[1])/(e[0]-s[0])
    return s[1] + sl * (x-s[0])
  }

  function intersect(s1, e1, s2, e2) { 
    // Solve the equation 
    //   [(e1-s1) -(e2-s2)]*[a1 a2]^T = s2-s1
    // for [a1 a2]. Both a1 and a2 should be in the range [0,1] for segments to
    // intersect. The matrix on the lhs will be singular if the lines are
    // collinear.
    const a =   e1[0] - s1[0],  c =   e1[1] - s1[1]
    const b = -(e2[0] - s2[0]), d = -(e2[1] - s2[1])
    const e =   s2[0] - s1[0],  f =   s2[1] - s1[1]
    const det = a*d - b*c
    if (det == 0) return null
    const a1 = ( d*e - b*f)/det
    const a2 = (-c*e + a*f)/det
    if (a1 < 0 || a1 > 1 || a2 < 0 || a2 > 1) return null
    return [s1[0]+a1*a, s1[1]+a1*c]
  }

  // Clip a single point to the right side of the road. Assume points on
  // vertical segments are clipped wrt to the closest boundary to the wrong (side=-1)
  // or good (side=1) side of the road.
  function clippt(rd, gol, pt, side = -1) {
    var newpt = pt.slice()
    // Find the road segment [sta, end[ containing the pt
    var seg = self.findSeg(rd, pt[0])
    var rdy = self.segValue(rd[seg], pt[0])
    // If there are preceding vertical segments, take the boundary value based
    // on road yaw.
    while(--seg >= 0 && rd[seg].sta[0] == pt[0]) {
      if (-side*gol.yaw > 0) rdy = min(rdy, rd[seg].sta[1])
      else              rdy = max(rdy, rd[seg].sta[1])
    }
    if ((newpt[1] - rdy) * gol.yaw < 0) newpt[1] = rdy
    return newpt
  }

  var done = false, rdind = 0, isoind = 0, side

  // The loop below alternatingly iterates through the segments in the
  // road and the isoline, ensuring that the isoline always stays on
  // the right side of the road
  if (iso[1][0] != iso[0][0]) side = 1
  else side = -1
  isoout.push(clippt(rd, gol, iso[0], side))
  while (!done) {
    if (rdind > rd.length-1 || isoind > iso.length-2) break

    // Check whether segments are intersecting
    var ind = isoout.length-1
    var pt = intersect(rd[rdind].sta, rd[rdind].end, iso[isoind], iso[isoind+1])
    if (pt != null && (pt[0] != isoout[ind][0] || pt[1] != isoout[ind][1])) isoout.push(pt)
    
    if (rd[rdind].end[0] < iso[isoind+1][0]) {
      // If the isoline remains below the road at road inflection
      // points, add the road inflection point to avoid leaky isolines
      // on the wrong side of the road.
      if ((lineval(iso[isoind], iso[isoind+1],
                   rd[rdind].end[0]) - rd[rdind].end[1]) * gol.yaw < 0)
        isoout.push([rd[rdind].end[0], rd[rdind].end[1]])
      rdind++
    } else {
      isoind++
      // If the next isoline segment is vertical, clip to the wrong
      // side, otherwise, clip to the right side. This should resolve
      // the leaky isoline issue
      if (isoind < iso.length-1 && iso[isoind][0] != iso[isoind+1][0]) side = 1
      else side = -1
      isoout.push(clippt(rd, gol, iso[isoind], side))
    }
  }
  return isoout
}
  
/* Return an array of x,y coordinate pairs for an isoline associated with dtd=v.
 * This can be used to compute boundaries for derailment regions, as well as 
 * guidelines. Coordinate points stggart from the beginning of the road and 
 * proceed forward.
*/
self.isoline = ( rd, dtdarr, gol, v, retall=false ) => {
  let iso1 = self.isoline_generate( rd, dtdarr, gol, v)
  let iso2 = self.isoline_monotonicity( iso1, rd, dtdarr, gol, v)
  let iso3 = self.isoline_nobackward( iso2, rd, dtdarr, gol, v)
  let iso4 = self.isoline_clip( iso3, rd, dtdarr, gol, v)

  if (retall) return [iso1, iso2, iso3, iso4]
  else return iso4
}
  
// Evaluates a given isoline at the supplied x coordinate
self.isoval = ( line, x ) => {
  var nums = line.length-1, s = 0, e = nums-1, m
  if (x < line[0][0]) return line[0][1]
  if (x > line[nums][0]) return line[nums][1]
  while (e-s > 1) { // Uses binary search
    m = floor((s+e)/2)
    if (line[m][0] <= x) s = m
    else e = m
  }
  if ((x >= line[e][0]) && (x < line[e+1][0])) s = e
  var dx = line[s+1][0] - line[s][0]
  var dy = line[s+1][1] - line[s][1]
  if (dx == 0) return line[s][1]
  else return line[s][1]+(x-line[s][0])*dy/dx
}

/** Days To Derail: Count the integer days till you cross the razor road or hit
    tfin (whichever comes first) if nothing reported. Not currently used. */
self.dtd_walk = (rd, gol, t, v) => {
  let x = 0
  while(self.gdelt(rd, gol, t+x*SID, v) >= 0 && t+x*SID <= gol.tfin) x += 1
  return x
}

/** What delta from the razor road yields n days of safety buffer? 
    Not currently used. */
self.bufcap = (rd, g, n=7) => {
  const t = g.tcur
  const v = self.rdf(rd, t)
  const r = abs(self.rtf(rd, t))
  let d = 0
  let i = 0
  while(self.dtd_walk(rd, g, t, v+d) < n && i <= 70) {
    d += g.yaw*r*SID
    i += 1
  }
  return [d, i]
}

/** Given the endpt of the last road segment (tp,vp) and 2 out of 3 of
    t = goal date for a road segment (unixtime)
    v = goal value 
    r = rate in hertz (s^-1), ie, road rate per second
    return the third, namely, whichever one is passed in as null. */
self.tvr = (tp, vp, t, v, r) => {
  
  if (t === null) {
    if (r === 0) return bu.BDUSK
    else         return bu.daysnap(min(bu.BDUSK, tp + (v-vp)/r))
  }
  if (v === null) return vp+r*(t-tp)
  if (r === null) {
    if (t === tp) return 0 // special case: zero-length road segment
    return (v-vp)/(t-tp)
  }
  return 0
}

/** Helper for fillroad for propagating forward filling in all the nulls */
var nextrow =  (or, nr) => {
  var tprev = or[0], vprev = or[1], rprev = or[2], n = or[3]

  var t = nr[0], v = nr[1], r = nr[2]
  var x = self.tvr(tprev, vprev, t,v,r) // the missing t, v, or r
  if (t === null) return [x, v, r, 0]
  if (v === null) return [t, x, r, 1]
  if (r === null) return [t, v, x, 2]
  return [t, v, x, 0]
}

/** Takes road matrix (with last row appended) and fills it in. Also adds a 
    column, n, giving the position (0, 1, or 2) of the original null. */
self.fillroad = (rd, g) => {
  rd.forEach(e => e[2] = null===e[2] ? e[2] : e[2]/g.siru)
  rd[0] = nextrow([g.tini, g.vini, 0, 0], rd[0])
  for (let i = 1; i < rd.length; i++)
    rd[i] = nextrow(rd[i-1], rd[i])
  rd.forEach(e => (e[2] = (null==e[2])?e[2]:e[2]*g.siru))

  // Remove rows that have timestamps before tini. This is temporary until
  // we clean up the goals in the database where this is an issue. After that
  // we should just fail loudly when we get a bb file that has any road rows
  // with dates that are earlier than tini. Huge violation of the
  // anti-robustness principle [blog.beeminder.com/postel] to let Beebody send
  // broken road matrices and clean them up here in Beebrain!
  while (rd !== undefined && rd[0] !== undefined && rd[0][0] < g.tini) 
    rd.shift()

  return rd
}

/** Version of fillroad that assumes tini/vini is the first row of road */
self.fillroadall = (rd, g) => {
  const tini = rd[0][0]
  const vini = rd[0][1]
  rd.splice(0,1)
  rd.forEach(e => (e[2] = null === e[2] ? e[2] : e[2]/g.siru))
  rd[0] = nextrow([tini, vini, 0, 0], rd[0])
  for (let i = 1; i < rd.length; i++) rd[i] = nextrow(rd[i-1], rd[i])
  rd.forEach(e => (e[2] = null === e[2] ? e[2] : e[2]*g.siru))
  rd.unshift([tini, vini, 0, 2])
  return rd
}

/** Computes the slope of the supplied road array at the given timestamp */
self.rtf = (rd, t) => (rd[self.findSeg(rd, t)].slope)

// Transform datapoints as follows: every time there's a decrease in value from
// one element to the next where the second value is zero, say V followed by 0,
// add V to every element afterwards. This is what you want if you're reporting
// odometer readings (eg, your page number in a book can be thought of that way)
// and the odometer gets accidentally reset (or you start a new book but want to
// track total pages read over a set of books). This should be done before
// kyoomify and will have no effect on data that has actually been kyoomified
// since kyoomification leaves no nonmonotonicities.
self.odomify = (d) => {
  if (!d || !d.length || d.length === 0) return
  let curadd = 0
  let prev = d[0][1]
  for (let i = 1; i < d.length; i++) {
    if (d[i][1] === 0) curadd += prev
    prev = d[i][1]
    d[i][1] += curadd
  }
}

// Utility function for stepify. Takes a list of datapoints sorted by x-value
// and a given x value and finds the greatest x-value in d that's less than or
// equal to x. It returns the y-value corresponding to the found x-value.
// (It's like Mathematica's Interpolation[] with interpolation order 0.)
// If the given x is strictly less than d[0][0], return the given default.
self.stepFunc = (d, x, dflt=0) => {
  if (x < d[0][0]) return dflt
  // TODO: Test the below binary search with duplicate timestamps
  var numpts = d.length, s = 0, e = numpts-1, m
  if (x > d[numpts-1][0]) return d[numpts-1][1]
  while (e-s > 1) {
    m = floor((s+e)/2)
    if (d[m][0] <= x) s = m
    else e = m
  }
  return d[s][1]
}

// Take a list of datapoints sorted by x-value and return a pure function that
// interpolates a step function from the data, always mapping to the most
// recent value.
self.stepify = (d, dflt=0) =>
  d === null ? x => dflt : x => self.stepFunc(d, x, dflt)


// Return which side of a given isoline a given datapoint is: -1 for wrong and
// +1 for correct side. Being exactly on an isoline counts as the good side.
self.isoside = (g, isoline, t, v) => {
  if (!isoline || !isoline.length) return 0
  const TOL = abs(v)*-1e-15
  // We multiply that tolerance times abs(v) to be a bit more robust. In the
  // extreme case, imagine the values are already so tiny that they're about
  // equal to the tolerance. Then checking if v - isoval was greater than -v
  // would be way too forgiving.

  //console.log(`ISOSIDE: (${t},${v}) ${JSON.stringify(isoline)}`)
  const n = isoline.length
  let s = 0, e = n-1, m    // start, end, midpoint for binary search
  if (t <= isoline[s][0]) return (v - isoline[s][1])*g.yaw >= TOL ? +1 : -1
  if (t >= isoline[e][0]) return (v - isoline[e][1])*g.yaw >= TOL ? +1 : -1
  while (e-s > 1) {
    m = floor((s+e)/2)
    if (isoline[m][0] <= t) s = m
    else e = m
  }
  if (isoline[s+1][0] === isoline[s][0]) {
    console.log("Warning: isoline ended up with infinite slope!")
    return 0
  }
  const slope =   (isoline[s+1][1]-isoline[s][1]) 
                / (isoline[s+1][0]-isoline[s][0])
  const isoval = isoline[s][1] + slope*(t - isoline[s][0])
  //console.log(`DEBUG v=${v} isoval=${isoval}`)
  return (v - isoval)*g.yaw >= TOL ? +1 : -1 // note tolerance!
}

// Given a road, a goal, a datapoint {t,v}, and an array of isolines, return the
// color that the datapoint should be plotted as. That depends on the isolines
// as follows: 
// * The 0th isoline is the bright red line so if you're on the wrong
//   side of that, you're red. 
// * Otherwise, if you're on the wrong side of the 1st isoline, you're orange.
// * Wrong side of the 2nd isoline, blue. 
// * Being just on the wrong side of the nth isoline means you have n safe days
//   and being exactly on it or just better is n+1 safe days. 
// * So being (on or) on the right side of the 6th isoline means you're immune
//   to the akrasia horizon.
self.dotcolor = (rd, g, t, v, iso=null) => {
  if (t < g.tini)   return bu.Cols.BLCK // dots before tini have no color!
  if (iso === null) return self.aok(rd, g, t, v) ? bu.Cols.BLCK : bu.Cols.REDDOT
  if (!iso || !iso.length || iso.length < 1) return bu.Cols.ERRDOT

  return self.isoside(g, iso[0], t, v) < 0 ? bu.Cols.REDDOT : // 0 safe days
         self.isoside(g, iso[1], t, v) < 0 ? bu.Cols.ORNDOT : // 1 safe day
         self.isoside(g, iso[2], t, v) < 0 ? bu.Cols.BLUDOT : // 2 safe days
         self.isoside(g, iso[6], t, v) < 0 ? bu.Cols.GRNDOT : // 3-6 safe days
                                             bu.Cols.GRADOT   // 7+ safe days
}

// This was previously called isLoser
self.redyest = (rd, g, t, iso=null) => {
  return self.dotcolor(rd, g, t-SID, g.dtf(t-SID), iso) === bu.Cols.REDDOT 
}

/**Previously known as noisyWidth before Yellow Brick Half-Plane for computing
   the road width for goals like weight loss with noisy data. Now it computes
   the so-called 90% Variance show in the Statistics tab. We also use stdflux to
   determine the width of the polynomial fit trend aka blue-green aura aka
   turquoise swath (it's twice stdflux, ie, stdflux in each direction).
   Specifically, we get the list of daily deltas between all the points, but
   adjust each delta by the road rate (eg, if the delta is equal to the delta
   of the road itself, that's an adjusted delta of 0). Return the 90% quantile
   of those adjusted deltas. */
self.stdflux = (rd, d) => {
  if (!d || !d.length || d.length <= 1) return 0
  const p = bu.partition(d, 2, 1)
  let ad = []
  let t, v, u, w
  for (let i = 0; i < p.length; i++) {
    t = p[i][0][0]
    v = p[i][0][1]
    u = p[i][1][0]
    w = p[i][1][1]
    ad.push(abs(w-v-self.rdf(rd,u)
                   +self.rdf(rd,t))/(u-t)*SID)
  }
  return bu.chop(ad.length===1 ? ad[0] : bu.quantile(ad, .90))
}

// This should be safe to kill but probably have some cleanup in the test suite.
/**Increase the width if necessary for the guarantee that you can't lose
   tomorrow if you're in the right lane today. Specifically, when you first
   cross from right lane to wrong lane (if it happened from one day to the
   next), the road widens if necessary to accommodate that jump and then the
   road width stays fixed until you get back in the right lane. So for this
   function that means if the current point is in the wrong lane, look
   backwards to find the most recent one-day jump from right to wrong. That
   wrong point's deviation from the centerline is what to max the default road
   width with. */
self.autowiden = (rd, g, d, nw) => {
  let n = d  // pretty sure we meant n = d.length here killing this anyway, so.
  if (n <= 1) return 0
  let i = -1
  if (self.gdelt(rd, g, d[d.length-1][0], d[d.length-1][1]) < 0) {
    while (i >= -n && self.gdelt(rd, g, d[i][0], d[i][1]) < 0) i -= 1
    i += 1
    if (i > -n && d[i][0] - d[i-1][0] <= SID) 
      nw = max(nw, abs(d[i][1] - self.rdf(rd,d[i][0])))
  }
  return bu.chop(nw)
}

/** Whether the road has a vertical segment at time t */
self.vertseg = (rd, t) => (rd.filter(e=>(e.sta[0] === t)).length > 1)

/** Used with grAura() and for computing mean and meandelt, this
    adds dummy datapoints on every day that doesn't have a datapoint,
    interpolating linearly. */
self.gapFill = (d) => {
  var interp = (bef, aft, atPt) => (bef + (aft - bef) * atPt)
  var start = d[0][0], end = d[d.length-1][0]
  var n = floor((end-start)/SID)
  var out = Array(n), i, j = 0, t = start
  for (i = 0; i < d.length-1; i++) {
    var den = (d[i+1][0]-d[i][0])
    while (t <= d[i+1][0]) {
      out[j] = [t,interp(d[i][1], d[i+1][1], (t-d[i][0])/den)]
      j++; t += SID
    }
  }
  if (out.length === 0) out.push(d[0])
  return out
}

/** Return a pure function that fits the data smoothly, used by grAura */
self.smooth = (d) => {
  var SMOOTH = (d[0][0] + d[d.length-1][0])/2
  var dz = bu.zip(d)
  var xnew = dz[0].map((e)=>(e-SMOOTH)/SID)
  var poly = new Polyfit(xnew, dz[1])
  var solver = poly.getPolynomial(3)
  var range = abs(max(...dz[1])-min(...dz[1]))
  var error = poly.standardError(poly.computeCoefficients(3))
  if (error > 10000*range) {
    // Very large error. Potentially due to ill-conditioned matrices
    console.log(
      "butil.smooth: Possible ill-conditioned polyfit. Reducing dimension.")
    solver = poly.getPolynomial(2)
  }

  return (x) =>(solver((x-SMOOTH)/SID))
}

/** Assumes both datapoints and the x values are sorted */
self.interpData = (d, xv) => {
  var interp = (bef, aft, atPt) =>(bef + (aft - bef) * atPt)
  var di = 0, dl = d.length, od = []
  if (dl === 0) return null
  if (dl === 1) return xv.map((d)=>[d, d[0][1]])
  for (let i = 0; i < xv.length; i++) {
    var xi = xv[i]
    if (xi <= d[0][0]) od.push([xi, d[0][1]])
    else if (xi >= d[dl-1][0]) od.push([xi, d[dl-1][1]])
    else if (xi < d[di+1][0] ) { 
      od.push([xi, interp(d[di][1], d[di+1][1],
                          (xi-d[di][0])/(d[di+1][0]-d[di][0]))])
    } else {
      while (xi > d[di+1][0]) di++
      od.push([xi, interp(d[di][1], d[di+1][1],
                          (xi-d[di][0])/(d[di+1][0]-d[di][0]))])
    }
  }
  return od
}

/**  The value of the YBR in n days */
self.lim = (rd, g, n) => { return self.rdf(rd, g.tcur+n*SID) }

/** The bare min needed from vcur to the critical edge of the YBR in n days */
self.limd = (rd, g, n) => { return self.lim(rd, g, n) - g.vcur }

/** Computes and returns a dueby array with n elements */
self.dueby = (rd, g, n) => {
  let db = [...Array(n).keys()]
      .map(i => [bu.dayify(g.tcur+i*SID),
                 self.limd(rd, g, i),
                 self.lim(rd, g, i)])
  const tmpdueby = bu.zip(db)
  return bu.zip([tmpdueby[0], bu.monotonize(tmpdueby[1],g.dir),
                 bu.monotonize(tmpdueby[2],g.dir)])
}
  
return self

})); // END MAIN ---------------------------------------------------------------

/**
 * Javascript implementation of Beebrain, provided as a UMD module.
 * Provides a {@link beebrain} class, which can be used to construct independent
 * Beebrain objects each with their own internal state. <br/>

@module beebrain
@requires moment
@requires butil
@requires broad

Beebrain -- doc.bmndr.com/beebrain
Originally written in Mathematica by dreeves, 2008-2010.
Ported to Python by Uluc Saranli around 2011.12.20.
Maintained and evolved by dreeves, 2012-2018.
Ported to Javascript in 2018-2019 by Uluc Saranli.

Copyright 2008-2020 Uluc Saranli and Daniel Reeves

*/


/* Notes for maxflux line [this is done now; #SCHDEL on these notes]:
User should try to hew to the YBR-minus-maxflux guiding line for weightloss.
Drawn as a thicker yellow guiding line, in addition to the green isoline.
And the maxflux line is not an isoline, it's just the razor road shifted down by
maxflux.
Put it in its own function, perhaps even in its own container.
Eg: updateMaxfluxLine().
Create a new container such as gMaxFlux in the proper place.
Create it when necessary, destroy it when not needed.
Good d3 practice!
*/


;(((root, factory) => { // BEGIN PREAMBLE --------------------------------------

'use strict'

if (typeof define === 'function' && define.amd) {
  // AMD. Register as an anonymous module.
  //console.log("beebrain: Using AMD module definition")
  define(['moment', 'butil', 'broad'], factory)
} else if (typeof module === 'object' && module.exports) {
  // Node. Does not work with strict CommonJS, but only CommonJS-like
  // environments that support module.exports, like Node.
  //console.log("beebrain: Using CommonJS module.exports")
  module.exports = factory(require('./moment'), 
                           require('./butil'), 
                           require('./broad'))
} else {
  //console.log("beebrain: Using Browser globals")
  root.beebrain = factory(root.moment, root.butil, root.broad)
}

})(this, (moment, bu, br) => { // END PREAMBLE -- BEGIN MAIN -------------------

'use strict'

// -----------------------------------------------------------------------------
// --------------------------- CONVENIENCE CONSTANTS ---------------------------

const max   = Math.max
const min   = Math.min
const abs   = Math.abs
const exp   = Math.exp
const floor = Math.floor
const ceil  = Math.ceil
const sign  = Math.sign

const DIY = 365.25 // this is what physicists use, eg, to define a light year
const SID = 86400 // seconds in a day (not used: DIM=DIY/12, WIM=DIY/12/7)

// -----------------------------------------------------------------------------
// ---------------------- BEEBRAIN CONSTANTS AND GLOBALS -----------------------

let gid = 1 // Global counter giving unique IDs for multiple Beebrain instances

// -----------------------------------------------------------------------------
// In-params and out-params are documented at doc.bmndr.com/beebrain

// NOTES / IDEAS:
// o Recommend stdflux for user-specified maxflux in the UI.
// o Gaps in the Road: If you derail and don't immediately rerail, the YBR
//   should show a gap when you weren't beeminding. The road matrix could
//   indicate this with a row like {t, null, null} which means no road should be
//   drawn between the previous row's time and time t. For the purposes of
//   computing the following row, the null row should be treated as {t, null,
//   0}. Or just have a 4th column for road matrix indicating if segment is a
//   gap?
// o Pass in a "backroad" parameter that's a version of the road that's never 
//   allowed to change retroactively. The first thing to do with that is to use
//   it to color historical datapoints with their original color (aka
//   permacolor)

const pin = { // In Params: Graph settings and their defaults
quantum  : 1e-5,   // Precision/granularity for conservarounding baremin etc
timey    : false,  // Whether numbers should be shown in HH:MM format
ppr      : true,   // Whether PPRs are turned on (ignored if not WEEN/RASH)
deadline : 0,      // Time of deadline given as seconds before or after midnight
sadlhole : true,   // Allow the do-less loophole where you can eke back onto YBR
asof     : null,   // Compute everything as if it were this date
tini     : null,   // (tini,vini) specifies the start of the YBR, typically but
vini     : null,   //   not necessarily the same as the initial datapoint
road     : [],     // List of (endTime,goalVal,rate) triples defining the YBR
tfin     : null,   // Goal date (unixtime); end of the Yellow Brick Road
vfin     : null,   // The actual value being targeted; any real value
rfin     : null,   // Final rate (slope) of the YBR before it hits the goal
runits   : 'w',    // Rate units for road and rfin; one of "y","m","w","d","h"
gunits   : 'units',// Goal units like "kg" or "hours"
yaw      : 0,      // Which side of the YBR you want to be on, +1 or -1
dir      : 0,      // Which direction you'll go (usually same as yaw)
pinkzone : [],     // Region to shade pink, specified like the road matrix
tmin     : null,   // Earliest date to plot on the x-axis (unixtime):
tmax     : null,   //   ((tmin,tmax), (vmin,vmax)) give the plot range, ie, they
vmin     : null,   //   control zooming/panning; they default to the entire
vmax     : null,   //   plot -- initial datapoint to past the akrasia horizon
kyoom    : false,  // Cumulative; plot values as the sum of those entered so far
odom     : false,  // Treat zeros as accidental odom resets
maxflux  : 0,      // User-specified max daily fluctuation                      
monotone : false,  // Whether the data is necessarily monotone (used in limsum) 
aggday   : null,   // sum/last/first/min/max/mean/median/mode/trimmean/jolly
plotall  : true,   // Plot all the points instead of just the aggregated point
steppy   : false,  // Join dots with purple steppy-style line
rosy     : false,  // Show the rose-colored dots and connecting line
movingav : false,  // Show moving average line superimposed on the data
aura     : false,  // Show blue-green/turquoise (now purple I guess) aura/swath
hashtags : true,   // Show annotations on graph for hashtags in datapt comments 
yaxis    : '',     // Label for the y-axis, eg, "kilograms"
waterbuf : null,   // Watermark on the good side of the YBR; safebuf if null
waterbux : '',     // Watermark on the bad side, ie, pledge amount
hidey    : false,  // Whether to hide the y-axis numbers
stathead : true,   // Whether to include a label with stats at top of graph 
imgsz    : 760,    // Image size; width in pixels of the graph image        
yoog     : 'U/G',  // Username/graphname, eg, "alice/weight"                
usr      : null,   // Username (synonym for first half of yoog) ############ DEP
graph    : null,   // Graph name (synonym for second half of yoog) ######### DEP
goal     : null,   // Synonym for vfin ##################################### DEP
rate     : null,   // Synonym for rfin ##################################### DEP
}

const pout = { // Out Params: Beebrain output fields
sadbrink : false,   // Whether we were red yesterday & so will instaderail today
safebump : null,    // Value needed to get one additional safe day
dueby    : [],      // Table of daystamps, deltas, and abs amts needed by day
fullroad : [],      // Road matrix w/ nulls filled in, [tfin,vfin,rfin] appended
pinkzone : [],      // Subset of the road matrix defining the verboten zone
tluz     : null,    // Timestamp of derailment ("lose") if no more data is added
tcur     : null,    // (tcur,vcur) gives the most recent datapoint, including
vcur     : null,    //   flatlining; see asof 
vprev    : null,    // Agged value yesterday 
rcur     : null,    // Rate at time tcur; if kink, take the limit from the left
ravg     : null,    // Overall road rate from (tini,vini) to (tfin,vfin)
tdat     : null,    // Timestamp of last actually entered datapoint
stdflux  : 0,       // Recommended maxflux .9 quantile of rate-adjusted deltas
delta    : 0,       // How far from razor road: vcur - rdf(tcur)
lane     : 666,     // Lane number for backward compatibility
cntdn    : 0,       // Countdown: # of days from tcur till we reach the goal
numpts   : 0,       // Number of real datapoints entered, before munging
mean     : 0,       // Mean of datapoints
meandelt : 0,       // Mean of the deltas of the datapoints
proctm   : 0,       // Unixtime when Beebrain was called (specifically genStats)
statsum  : '',      // Human-readable graph stats summary (not used by Beebody)
ratesum  : '',      // Text saying what the rate of the YBR is
deltasum : '',      // Text saying where you are wrt the razor road
graphsum : '',      // Text at the top of the graph image; see stathead
progsum  : '',      // Text summarizing percent progress
rah      : 0,       // Y-value of the razor road at the akrasia horizon
safebuf  : null,    // Number of days of safety buffer
error    : '',      // Empty string if no errors
limsum   : '',      // Text saying your bare min or hard cap ############### DEP
headsum  : '',      // Text in the heading of the graph page ############### DEP
titlesum : '',      // Title text for graph thumbnail ###################### DEP
lnw      : 0,       // Lane width at time tcur ############################# DEP
color    : 'black', // One of {"green", "blue", "orange", "red"} ########### DEP
loser    : false,   // Whether you're irredeemably off the road ############ DEP
gldt     : null,    // {gldt, goal, rate} are synonyms for ################# DEP
goal     : null,    //   for the last row of fullroad ###################### DEP
rate     : null,    //   like a filled-in version of {tfin, vfin, rfin} #### DEP
road     : [],      // Synonym for fullroad ################################ DEP
tini     : null,    // Echoes input param ################################## DEP
vini     : null,    // Echoes input param ################################## DEP
tfin     : null,    // Subsumed by fullroad ################################ DEP
vfin     : null,    // Subsumed by fullroad ################################ DEP
rfin     : null,    // Subsumed by fullroad ################################ DEP
}

const pig = [ // In Params to ignore; complain about anything not here or in pin
//'rerails',  // Idea for something to be passed to Beebrain
'ybhp',     // Lanes delenda est!
'integery', // Replaced by 'quantum'; fully killed as of 2020-08-21
'noisy',    // Pre-YBHP; fully killed as of 2020-08-20
'abslnw',   // Pre-YBHP; fully killed as of 2020-08-19
'tagtime',  // Used in the very early days
'timezone', // Might make sense to send this to Beebrain in the future
'backroad', // Related to the permacolor idea; see doc.bmndr.com/permacolor
'edgy',     // Ancient; killed as one of the prereqs for YBHP
'offred',   // Used for the transition to the red-yesterday derail condition
//'offparis', // Temporary thing related to red-yesterday
]

/** Enum object to identify different types of datapoints
    @enum {number} 
    @memberof beebrain */
const DPTYPE = {
  AGGPAST:0, AGGFUTURE:1, RAWPAST:2, RAWFUTURE:3, FLATLINE:4, HOLLOW: 5
}

/** Enum object to identify error types */
const ErrType = { NOBBFILE:0, BADBBFILE:1  }

/** Enum object to identify error types */
const ErrMsgs = [ "Could not find goal (.bb) file.", "Bad .bb file." ]

/** Type of the last error */
const LastError = null

const PRAF = .015 // Fraction of plot range that the axes extend beyond

/** beebrain object constructor. Processes the supplied goal information JSON
 * and computed derived goal parameters, summaries, and other details. These
 * results can be accessed through various public members and methods.

 @memberof module:beebrain
 @constructs beebrain
 @param {Object} bbin JSON input "BB file" with goal details
*/
const beebrain = function( bbin ) { // BEGIN beebrain object constructor -------

//console.debug("beebrain constructor ("+gid+"): ");
let self = this
let curid = gid
gid++

bbin = bu.deepcopy(bbin) // Make new copy of the input to prevent overwriting

// Private variables holding goal, road, and datapoint info
let roads = []      // Beebrain-style road data structure w/ sta/end/slope/auto
let gol = {}        // Goal parameters passed to Beebrain
let alldata = []    // Entire set of datapoints passed to Beebrain
let data = []       // Past aggregated data
let rosydata = []   // Derived data corresponding to the rosy line
let fuda = []       // Future data
let undoBuffer = [] // Array of previous roads for undo
let redoBuffer = [] // Array of future roads for redo
let oresets = []    // Odometer resets
let derails = []    // Derailments
let hollow = []     // Hollow points
let allvals = {}    // Hash mapping timestamps to list of datapoint values
let aggval = {}     // Hash mapping timestamps to aggday'd value for that day
let derailval = {}  // Map timestamp to value as of RECOMMIT datapoint that day
let hashhash = {}   // Map timestamp to sets of hashtags to display on graph
let hashtags = []   // Array of timestamp string pairs for hashtag lists
 
// Initialize gol with sane values
gol.yaw = +1; gol.dir = +1
gol.tcur = 0; gol.vcur = 0; gol.vprev = 0
const now = moment.utc()
now.hour(0); now.minute(0); now.second(0); now.millisecond(0)
gol.asof = now.unix()
gol.horizon = gol.asof+bu.AKH
gol.xMin =    gol.asof;  gol.xMax = gol.horizon
gol.yMin =    -1;        gol.yMax = 1

/**Convert legacy parameters to modern counterparts for backward compatibility.
   @param {Object} p Goal parameters from the bb file */
function legacyIn(p) {
  //if (p.gldt!==undefined && p.tfin===undefined)      p.tfin = p.gldt   #SCHDEL
  if ('goal' in p && !('vfin' in p))                 p.vfin = p.goal
  if ('rate' in p && !('rfin' in p))                 p.rfin = p.rate
  if ('usr'  in p && 'graph' in p && !('yoog' in p)) p.yoog = p.usr+"/"+p.graph
}
  
// Helper function for legacyOut
function rowfix(row) {
  if (!Array.isArray(row)) return row
  if (row.length <= 3)     return row
  return row.slice(0,3)
}

/** Last in genStats, filter params for backward compatibility
    @param {Object} p Computed goal statistics */
function legacyOut(p) {
  p.fullroad = p.fullroad.map( r=>rowfix(r) )
  p['road']     = p['fullroad']
  if (p['error']) {
    p['gldt'] = bu.dayify(gol.tfin)
    p['goal'] = gol.vfin
    p['rate'] = gol.rfin*gol.siru
  } else {
    const len = p['fullroad'].length
    if (len > 0) {
      p['gldt'] = p['fullroad'][len-1][0]
      p['goal'] = p['fullroad'][len-1][1]
      p['rate'] = p['fullroad'][len-1][2]
    }
  }
  p['tini'] = bu.dayify(gol.tini)
  p['vini'] = gol.vini
  p['tfin'] = bu.dayify(gol.tfin)
  p['vfin'] = gol.vfin
  p['rfin'] = gol.rfin
}

/** Initialize various global variables before use */
function initGlobals() {
  // Data related variables
  data = []
  flad = null
  fuda = []
  allvals = {}
  aggval = {}
  derailval = {}
  
  gol = {}
  gol.siru = null
  oresets = []
  derails = []
  hashhash = {}
  
  // All the in and out params are also global, via the gol hash
  for (const key in pout) gol[key] = pout[key]
  for (const key in pin)  gol[key] = pin[key]
}

function parserow(row) {
  return !Array.isArray(row) || row.length !== 3 ? row : 
                                           [bu.dayparse(row[0]), row[1], row[2]]
}

// Helper function for stampOut
function dayifyrow(row) {
  if (row.length < 1) return row
  let newrow = row.slice()
  newrow[0] = bu.dayify(row[0])
  return newrow
}

/** Processes fields with timestamps in the input
 @param {Object} p Goal parameters from the BB file
 @param {Array} d Datapoints from the BB file */
function stampIn(p, d) {
  ['asof', 'tini', 'tfin', 'tmin', 'tmax']
    .map(e => { if (e in p) p[e] = bu.dayparse(p[e]) })
  if ('road' in p && bu.listy(p.road)) p.road = p.road.map(parserow)
  
  // Stable-sort by timestamp before dayparsing the timestamps because if the
  // timestamps were actually given as unixtime then dayparse works like
  // dayfloor and we lose fidelity.
  return d
    .map((r,i) => [bu.dayparse(r[0]),r[1],r[2],i,r[1]])   // Store indices
    .sort((a,b) => (a[0]!== b[0] ? a[0]-b[0] : a[3]-b[3])) 
}

/** Convert unixtimes back to daystamps
    @param {Object} p Computed goal statistics */
function stampOut(p) {
  p['fullroad'] = p['fullroad'].map(dayifyrow)
  if ('razrmatr' in pout) p['razrmatr'] = p['razrmatr'].map(dayifyrow)
  p['pinkzone'] = p['pinkzone'].map(dayifyrow)
  p['tluz'] = bu.dayify(p['tluz'])
  p['tcur'] = bu.dayify(p['tcur'])
  p['tdat'] = bu.dayify(p['tdat'])
}

// Helper function for Exponential Moving Average; returns smoothed value at
// x.  Very inefficient since we recompute the whole moving average up to x for
// every point we want to plot.
function ema(d, x) {
  // The Hacker's Diet recommends 0.1; Uluc had .0864
  // http://forum.beeminder.com/t/control-exp-moving-av/2938/7 suggests 0.25
  let KEXP = .25/SID 
  if (gol.yoog==='meta/derev')   KEXP = .03/SID   // .015 for meta/derev
  if (gol.yoog==='meta/dpledge') KEXP = .03/SID   // .1 jagged
  let xp = d[0][0]
  let yp = d[0][1]
  let prev = yp, dt, i, ii, A, B
  if (x < xp) return prev
  for (ii = 1; ii < d.length; ii++) { // compute line equation
    i = d[ii]
    dt = i[0] - xp
    A = (i[1]-yp)/dt  // (why was this line marked as a to-do?)
    B = yp
    if (x < i[0]) { // found interval; compute intermediate point
      dt = x-xp
      return B+A*dt-A/KEXP + (prev-B+A/KEXP) * exp(-KEXP*dt)
    } else { // not the current interval; compute next point
      prev = B+A*dt-A/KEXP + (prev-B+A/KEXP) * exp(-KEXP*dt)
      xp = i[0]
      yp = i[1]
    }
  }
  // keep computing exponential past the last datapoint if needed
  dt = x-xp
  return B + A*dt - A/KEXP + (prev-B+A/KEXP) * exp(-KEXP*dt)
}

// Function to generate samples for the Butterworth filter
function griddlefilt(a, b) {
  return bu.linspace(a, b, floor(bu.clip((b-a)/(SID+1), 40, 2000)))
}

// Function to generate samples for the Butterworth filter
function griddle(a, b, maxcnt = 6000) {
  return bu.linspace(a, b, floor(bu.clip((b-a)/(SID+1), 
                                         min(600, /*plotbox.width*/ 640),
                                         maxcnt)))
}

// Start at the first datapoint plus sign*delta & walk forward making the next
// point be equal to the previous point, clipped by the next point plus or 
// minus delta. Used for the rose-colored dots.
function inertia0(x, d, sgn) {
  return bu.foldlist((a, b) => bu.clip(a, b-d, b+d),
                     x[0]+sgn*d, x.slice(1,x.length))
}
function inertia(dat, delt, sgn) {  // data, delta, sign (-1 or +1)
  let tdata = bu.zip(dat) // transpose of data
  tdata[1] = inertia0(tdata[1], delt, sgn)
  return bu.zip(tdata)
}
// Same thing but start at the last data point and walk backwards
function inertiaRev(dat, dlt, sgn) {
  return inertia(dat.slice().reverse(), dlt, sgn).reverse()
}

/** Pre-compute rosy datapoints */
function computeRosy() {
  if (!gol.rosy || data.length == 0) return
  // Pre-compute rosy datapoints
  const delta = max(0, gol.stdflux)
  let lo, hi
  if (gol.dir > 0) {
    lo = inertia(   data, delta, -1)
    hi = inertiaRev(data, delta, +1)
  } else {
    lo = inertiaRev(data, delta, -1)
    hi = inertia(   data, delta, +1)
  }
  const yveclo = lo.map(e => e[1])
  const yvechi = hi.map(e => e[1])
  const yvec = bu.zip([yveclo, yvechi]).map(e => (e[0]+e[1])/2)
  const xvec = data.map(e => e[0])
  rosydata = bu.zip([xvec, yvec])
  // rosydata format is as follows:
  // [ptx, pty, popup text, pt type, prevx, prevy, v(original)]
  // It is essentially the same as normal datapoints. Previous
  // point coordinates are needed to draw connecting lines.
  rosydata = rosydata.map(e => 
    [e[0],e[1],"rosy data", DPTYPE.RAWPAST, e[0],e[1], e[1]])
  for (let i = 1; i < rosydata.length-1; i++) {
    // These elements store the preceding point to facilitate drawing with d3
    rosydata[i][4] = rosydata[i-1][0]
    rosydata[i][5] = rosydata[i-1][1]
  }
}

// Take, eg, "shark jumping #yolo :) #shark" and return {"#yolo", "#shark"}
let hashtagRE
try {
  //hashtagRE = /(?:^|\s)(#\p{L}[\p{L}0-9_]+)(?=$|\s)/gu
  hashtagRE = new RegExp("(?:^|\\s)(#\\p{L}[\\p{L}0-9_]+)(?=$|\\s)", "gu")
} catch { // Firefox can't handle the above in 2019 so...
  hashtagRE = /(?:^|\s)(#[a-zA-Z]\w+)(?=$|\s)/g
}
function hashextract(s) {
  let set = new Set(), m
  hashtagRE.lastIndex = 0
  while ( (m = hashtagRE.exec(s)) != null ) if (m[1] != "") set.add(m[1])
  return set
}

// Whether datapoint comment string s has the magic string indicating it's a
// recommit datapoint, ie, when a derailment happened.
function recommitted(s) { return s.startsWith("RECOMMITTED") }

// Convenience function to extract values from datapoints
function dval(d) { return d[1] }

// Compute [informative comment, originalv (or null)] for aggregated points
function aggpt(vl, v) { // v is the aggregated value
  const kyoomy = gol.kyoom && gol.aggday === "sum"
  if (vl.length === 1) return [vl[0][2], vl[0][3], vl[0][4]]
  else {
    let i
    // check if agg'd value is also an explicit datapoint for today
    if (kyoomy) i = bu.accumulate(vl.map(dval)).indexOf(v)
    else        i = vl.map(dval).indexOf(v)
    // if not, aggregated point stands alone
    if (i < 0) return [gol.aggday, null, null]
    // if found, append (aggday) to comment and record original value
    else {
      return [vl[i][1]+" ("+gol.aggday+")", vl[i][3], vl[i][4]]
    }
  } // first change; second change
}

/** Process goal data<br/>
    
    Coming here, we assume that data has entries with the
    following format:[t, v, comment, original index,
    v(original)]<br/>
    
    Coming out, datapoints have the following format: [t, v,
    comment, type, prevt, prevv, v(original) or null]<br/>
    
    Each point also records coordinates for the preceding point to
    enable connecting plots such as steppy and rosy even after
    filtering based on visibility in graph
*/
function procData() { 
  if (data == null || data.length == 0) return "No datapoints"
  const numpts = data.length
  let i, d

  for (i = 0; i < numpts; i++) {
    d = data[i]
    // Sanity check data element
    if (!(bu.nummy(d[0]) && d[0]>0 && bu.nummy(d[1]) && bu.stringy(d[2])))
      return "Invalid datapoint: "+d[0]+" "+d[1]+' "'+d[3] 

    // Extract and record hashtags
    if (gol.hashtags) {
      const hset = hashextract(d[2])
      if (hset.size == 0) continue
      if (!(d[0] in hashhash)) hashhash[d[0]] = new Set()
      for (const x of hset) hashhash[d[0]].add(x)
    }
  }

  // Precompute list of [t, hashtext] pairs for efficient display
  if (gol.hashtags) {
    hashtags = []
    const keys = Object.keys(hashhash)
    for (const key in hashhash)
      hashtags.push([key, Array.from(hashhash[key]).join(" ")])
  }

  // Identify derailments and construct a copied array
  derails = data.filter(e => recommitted(e[2]))
  derails = derails.map(e => e.slice())
  // CHANGEDATE is the day that we switched to recommitting goals yesterday
  // instead of the day after the derail.
  for (i = 0; i < derails.length; i++) {
    const CHANGEDATE = 1562299200 // 2019-07-05
    if (derails[i][0] < CHANGEDATE) derails[i][0] = derails[i][0]-SID
  }
    
  // Identify, record and process odometer reset for odom goals
  if (gol.odom) {
    oresets = data.filter(e => e[1]==0).map(e => e[0])
    br.odomify(data)
  }
  const nonfuda = data.filter(e => e[0]<=gol.asof)
  if (gol.plotall) gol.numpts = nonfuda.length
  
  allvals = {}
  aggval = {}

  // Aggregate datapoints and handle kyoom
  let newpts = []
  let ct = data[0][0] // Current time
  let vl = []  // Value list: All values [t, v, c, ind, originalv] for time ct 
        
  let pre = 0 // Current cumulative sum
  let prevpt

  // HACK: aggday=skatesum needs to know rcur which we won't know until we do
  // procParams. We do know rfin so we're making do with that for now...
  br.rsk8 = gol.rfin * SID / gol.siru // convert rfin to daily rate

  // Process all datapoints
  for (i = 0; i <= data.length; i++) {
    if (i < data.length && data[i][0] == ct) {
      // Record all points for the current timestamp in vl
      vl.push(data[i].slice())
    }
    
    if (i >= data.length || data[i][0] != ct) {
      // Done recording all data for today
      let vlv = vl.map(dval)              // Extract all values for today
      let ad  = br.AGGR[gol.aggday](vlv)  // Compute aggregated value
      // Find previous point to record its info in the aggregated point
      if (newpts.length > 0) prevpt = newpts[newpts.length-1]
      else prevpt = [ct, ad+pre]
      // pre remains 0 for non-kyoom
      let ptinf = aggpt(vl, ad)
      // Create new datapoint
      newpts.push([ct, pre+ad, ptinf[0], // this is the processed datapoint
                   ct <= gol.asof ? DPTYPE.AGGPAST : DPTYPE.AGGFUTURE, 
                   prevpt[0], prevpt[1], // this is the previous point
                   ptinf[2],             // v(original)
                   ptinf[1]])            // index of original pt if coincident
      
      // Update allvals and aggval associative arrays
      // allvals[timestamp] has entries [vtotal, comment, vorig]
      if (gol.kyoom) {
        if (gol.aggday === "sum") {
          allvals[ct] = 
            bu.accumulate(vlv).map((e,j) => 
                                      [ct, e+pre, vl[j][2], vl[j][3], vl[j][4]])
        } else allvals[ct] = vl.map(e => [ct, e[1]+pre, e[2], e[3], e[4]])
        aggval[ct] = pre+ad
        pre += ad
      } else {
        allvals[ct] = vl
        aggval[ct] = ad
      }
      const vw = allvals[ct].map(e => e[1])

      // What we actually want for derailval is not this "worstval" but the 
      // agg'd value up to and including the recommit datapoint (see the
      // recommitted() function) and nothing after that:
      derailval[ct] = gol.yaw < 0 ? bu.arrMax(vw) : bu.arrMin(vw)
      
      if (i < data.length) {
        ct = data[i][0]
        vl = [data[i].slice()]
      }
    }
  }
    
  // Recompute an array of all datapoints based on allvals,
  // having incorporated aggregation and other processing steps.
  let allpts = []
  for (let t in allvals) {
    allpts = allpts.concat(allvals[t].map(d => 
      [Number(t), d[1], d[2], 
       Number(t) <= gol.asof ? DPTYPE.AGGPAST : DPTYPE.AGGFUTURE,
       null, null, d[4], d[3]]))
  }
  alldata = allpts

  fuda = newpts.filter(e => e[0]>gol.asof)
  data = newpts.filter(e => e[0]<=gol.asof)
  if (data.length == 0) return "All datapoints are in the future!"

  if (!gol.plotall) gol.numpts = data.length
  
  // Compute data mean after filling in gaps
  const gfd = br.gapFill(data)
  const gfdv = gfd.map(e => (e[1]))
  if (data.length > 0) gol.mean = bu.mean(gfdv)
  if (data.length > 1)
    gol.meandelt = bu.mean(bu.partition(gfdv,2,1).map(e => e[1] - e[0]))
  
  // time of last entered datapoint pre-flatline (so ignoring future data)
  gol.tdat = data[data.length-1][0]
  
  // Adjust derailment markers to indicate worst value for that day
  for (i = 0; i < derails.length; i++) {
    const CHANGEDATE = 1562299200 // 2019-07-05 // yuck, DRY this up
    if (derails[i][0] < CHANGEDATE) ct = derails[i][0]+SID
    else                            ct = derails[i][0]
    if (ct in derailval)
      //derails[i][1] = derailval[ct] // see "What we actually want" above...
      derails[i][1] = aggval[ct]  // doing this until derailval's done right
  }
  
  // Extract computed points that are different than any entered data (hollow
  // pts)
  hollow = data.filter(e => {
    if (!(e[0] in allvals)) return false
    return (e[0]<gol.asof && !allvals[e[0]].map(e => e[1]).includes(e[1]))
  })
  
  return ""
}

/** Extracts road segments from the supplied road matrix in the input
 * parameters as well as tini and vini. Upon completion, the 'roads' variable
 * contains an array of road segments as javascript objects in the following
 * format:<br/>
 
 {sta: [startt, startv], end: [endt, endv], slope, auto}<br/>
 
 Initial and final flat segments are added from starting days
 before tini and ending after 100 days after tfin.
 @param {Array} json Unprocessed road matrix from the BB file
*/
function procRoad(json) {
  //const BDUSK = bu.dayparse(bu.dayify(bu.BDUSK)) // make sure it's dayfloored.
  const BDUSK = bu.BDUSK
  roads = []
  const rdData = json
  const nk = rdData.length
  let firstsegment
  let tini = gol.tini
  let vini = gol.vini
  // Handle cases where first road matrix row starts earlier than (tini,vini)
  if (rdData[0][0] != null && rdData[0][0] < tini) {
    tini = rdData[0][0]
    if (rdData[0][1] != null) vini = rdData[0][1]
  }
  // First segment starts from [tini-100days, vini], ends at [tini, vini]
  firstsegment = { sta: [tini, Number(vini)],
                   slope: 0, 
                   auto: br.RP.SLOPE }
  firstsegment.end = firstsegment.sta.slice()
  firstsegment.sta[0] = bu.daysnap(firstsegment.sta[0]-100*SID*DIY) // 100y?
  roads.push(firstsegment)
  for (let i = 0; i < nk; i++) {
    // Each segment i starts from the end of the previous segment and continues
    // until road[i], filling in empty fields in the road matrix
    let seg = {}
    seg.sta = roads[roads.length-1].end.slice()
    let rddate = null, rdvalue = null, rdslope = null
    
    rddate  = rdData[i][0]
    rdvalue = rdData[i][1]
    rdslope = rdData[i][2]
    
    if (rddate == null) {
      seg.end = [0, Number(rdvalue)]
      seg.slope = Number(rdslope) / gol.siru
      if (seg.slope != 0) {
        seg.end[0] = seg.sta[0] + (seg.end[1] - seg.sta[1]) / seg.slope
      } else {
        // Hack to handle tfin=null and inconsistent values
        seg.end[0] = BDUSK
        seg.end[1] = seg.sta[1]
      }
      seg.end[0] = min(BDUSK, seg.end[0])
      // Readjust the end value in case we clipped the date to BDUSK
      seg.end[1] = seg.sta[1] + seg.slope*(seg.end[0]-seg.sta[0])
      seg.auto = br.RP.DATE
    } else if (rdvalue == null) {
      seg.end = [rddate, 0]
      seg.slope = Number(rdslope)/(gol.siru)
      seg.end[1] = seg.sta[1] + seg.slope*(seg.end[0]-seg.sta[0])
      seg.auto = br.RP.VALUE
    } else if (rdslope == null) {
      seg.end = [rddate, Number(rdvalue)]
      seg.slope = br.segSlope(seg)
      seg.auto = br.RP.SLOPE
    } 
    // Skip adding segment if it is earlier than the first segment
    if (seg.end[0] >= seg.sta[0]) roads.push(seg)
  }
  // Extract computed values for tfin, vfin and rfin
  const golseg = roads[roads.length-1]
  
  // A final segment is added, ending 100 days after tfin
  const finalsegment = { sta: golseg.end.slice(),
                         end: golseg.end.slice(),
                         slope: 0, 
                         auto: br.RP.VALUE }
  finalsegment.end[0] = bu.daysnap(finalsegment.end[0]+100*SID*DIY) // 100y?
  roads.push(finalsegment)
  
  //br.printRoad(roads)
  return ""
}

// Back in Pybrain the intention was to flatline all the way to today for 
// WEEN/RASH and to stop flatlining if 2 red days in a row for MOAR/PHAT.
// That might've stopped making sense after the new red-yesterday derailment
// criterion. In any case, bgraph.js:updateDataPoints() seems to draw the 
// flatlined datapoint fine for do-more goals and I'm not sure why we still
// need this for do-less goals but things break without it.
let flad = null // Holds the flatlined datapoint if it exists
function flatline() {
/************** candidate new version of this function that breaks flatlining...
  flad = null
  const prevpt = data[data.length-1]
  const tlast  = prevpt[0]
  const vlast  = prevpt[1]
  if (gol.yaw * gol.dir < 0 && tlast <= gol.tfin) {
    const tflat = min(gol.asof, gol.tfin)
    if (!(tflat in aggval)) {
      flad = [tflat, vlast, "PPR", DPTYPE.FLATLINE, tlast, vlast, null]
      data.push(flad)
    }
  }
original version of flatline() ************************************************/
  const now = gol.asof
  const numpts = data.length
  const tlast = data[numpts-1][0]
  const vlast = data[numpts-1][1]
  
  if (tlast > gol.tfin) return
  
  let x = tlast // x = the time we're flatlining to
  if (gol.yaw * gol.dir < 0) 
    x = min(now, gol.tfin) // WEEN/RASH: flatline all the way
  else { // for MOAR/PHAT, stop flatlining if 2 red days in a row
    let prevcolor = null
    let newcolor
    while (x <= min(now, gol.tfin)) { // walk forward from tlast
      // gol.isolines not defined yet so makes no sense calling dotcolor() TODO
      newcolor = br.dotcolor(roads, gol, x, vlast, gol.isolines)
      // done iff 2 reds in a row
      if (prevcolor===newcolor && prevcolor===bu.Cols.REDDOT) break
      prevcolor = newcolor
      x += SID // or see doc.bmndr.com/ppr
    }
    // the following looks particularly unnecessary
    x = min(x, now, gol.tfin)
    for (let i = 0; i < numpts; i++) if (x == data[i][0]) return
  }

  if (!(x in aggval)) {
    const prevpt = data[numpts-1]
    flad = [x, vlast, "PPR", DPTYPE.FLATLINE, prevpt[0], prevpt[1], null]
    data.push(flad)
  }
}

/** Set any of {tmin, tmax, vmin, vmax} that don't have explicit values.
 * Duplicates Pybrain's setRange() behavior. */
function setDefaultRange() {
  if (gol.tmin == null) gol.tmin = min(gol.tini, gol.asof)
  if (gol.tmax == null) {
    // Make more room beyond the askrasia horizon if lots of data
    const years = floor((gol.tcur - gol.tmin) / (DIY*SID))
    gol.tmax = bu.daysnap((1+years/2)*2*bu.AKH + gol.tcur)
  }
  if (gol.vmin != null && gol.vmax != null) {     // both provided explicitly
    if (gol.vmin == gol.vmax) {
      gol.vmin -= 1; gol.vmax += 1                // scooch away from each other
    } else if (gol.vmin > gol.vmax) {
      [gol.vmin, gol.vmax] = [gol.vmax, gol.vmin] // swap them
    }
    return
  }
  
  const PRAF = 0.015
  const a = br.rdf(roads, gol.tmin)
  const b = br.rdf(roads, gol.tmax)
  const d0 = data.filter(e => e[0] <= gol.tmax && e[0] >= gol.tmin)
                 .map(e => e[1])
  let mind = bu.arrMin(d0)
  let maxd = bu.arrMax(d0)
  // Make room for the ghosty PPR datapoint
  if (flad != null && flad[0] <= gol.tmax && flad[0] >= gol.tmin) {
    const pprv = flad[1] + br.ppr(roads, gol, gol.asof)
    mind = min(mind, pprv) // Make room for the 
    maxd = max(maxd, pprv) // ghosty PPR datapoint.
  }
  const padding = max(0, (maxd-mind)*PRAF*2)
  let minmin = mind - padding
  let maxmax = maxd + padding
  if (gol.monotone && gol.dir>0) {            // Monotone up so no extra padding
    minmin = bu.arrMin([minmin, a, b])        // below (the low) vini.
    maxmax = bu.arrMax([maxmax, a, b])
  } else if (gol.monotone && gol.dir<0) {     // Monotone down so no extra
    minmin = bu.arrMin([minmin, a, b])        // padding above (the
    maxmax = bu.arrMax([maxmax, a, b])        // high) vini.
  } else {
    minmin = bu.arrMin([minmin, a, b])
    maxmax = bu.arrMax([maxmax, a, b])
  }
  if (gol.plotall && gol.tmin<=gol.tini && gol.tini<=gol.tmax
      && gol.tini in allvals) {      
    // At tini, leave room for all non-agg'd datapoints
    minmin = min(minmin, bu.arrMin(allvals[gol.tini].map(e => e[1])))
    maxmax = max(maxmax, bu.arrMax(allvals[gol.tini].map(e => e[1])))
  }
  if (gol.vmin == null && gol.vmax == null) {     // neither provided explicitly
    gol.vmin = minmin
    gol.vmax = maxmax
    if (gol.vmin == gol.vmax) {
      gol.vmin -= 1; gol.vmax += 1                // scooch away from each other
    } else if (gol.vmin > gol.vmax) {
      [gol.vmin, gol.vmax] = [gol.vmax, gol.vmin] // swap them
    }
  } else if (gol.vmin==null) gol.vmin = minmin < gol.vmax ? minmin : gol.vmax-1
  else if   (gol.vmax==null) gol.vmax = maxmax > gol.vmin ? maxmax : gol.vmin+1
}

// Sanity check a row of the road matrix; exactly one-out-of-three is null
function validrow(r) {
  if (!bu.listy(r) || r.length != 3) return false
  return    r[0]==null     && bu.nummy(r[1]) && bu.nummy(r[2])
         || bu.nummy(r[0]) && r[1]==null     && bu.nummy(r[2])
         || bu.nummy(r[0]) && bu.nummy(r[1]) && r[2]==null
}

// Stringified version of a road matrix row
function showrow(row) {
  return JSON.stringify(row[0] == null ? row : 
                                        [bu.formatDate(row[0]), row[1], row[2]])
}

const pchk = [
['deadline', v => (6-24)*3600 <= v && v <= 6*3600,
 "outside 6am earlybird to 6am nightowl"],
['asof', v => v!=null, "can't be null! Tell support!"],
['asof', bu.torn, "isn't a valid timestamp"],
['tini', bu.timy, "isn't a valid timestamp"],
['vini', bu.nummy, "isn't numeric"],
['road', bu.listy, "(road matrix) isn't a list"],
['tfin', bu.torn, "isn't a valid timestamp"],
['vfin', bu.norn, "isn't numeric or null"],
['rfin', bu.norn, "isn't numeric or null"],
['runits', v => v in bu.SECS, "isn't a valid rate unit"],
['yaw', v => v==0 || v==1 || v==-1, "isn't in [0,-1,1]"],
['dir', v => v==1 || v==-1, "isn't in -1,1]"],
['tmin', bu.torn, "isn't a number/timestamp"],
['tmax', bu.torn, "isn't a valid timestamp"],
['vmin', bu.norn, "isn't numeric or null"],
['vmax', bu.norn, "isn't numeric or null"],
['kyoom', bu.torf, "isn't boolean"],
['odom', bu.torf, "isn't boolean"],
['monotone', bu.torf, "isn't boolean"],
['aggday', v => v in br.AGGR, "isn't one of max, sum, last, mean, etc"],
['plotall', bu.torf, "isn't boolean"],
['steppy', bu.torf, "isn't boolean"],
['rosy', bu.torf, "isn't boolean"],
['movingav', bu.torf, "isn't boolean"],
['aura', bu.torf, "isn't boolean"],
['yaxis', bu.stringy, "isn't a string"],
['yaxis', v => v.length<80, "string is too long\\n"],
['waterbuf', bu.sorn, "isn't a string or null"],
['waterbux', bu.stringy, "isn't a string"],
['hidey', bu.torf, "isn't boolean"],
['stathead', bu.torf, "isn't boolean"],
['imgsz', bu.nummy, "isn't numeric"],
['yoog', bu.stringy, "isn't a string"],
]

/** Sanity check the input parameters. Return non-empty string if it fails. */
function vetParams() {
  const s = (y => JSON.stringify(y))
  let i
  
  for (i = 0; i < pchk.length; i++) {
    const l = pchk[i]
    if (!(l[1](gol[l[0]]))) return `'${l[0]}' ${l[2]}: ${s(gol[l[0]])}`
  }
  
  const rd = gol.road
  for (i = 0; i < rd.length; i++)
    if (!validrow(rd[i]))
      return "Invalid road matrix row: "+showrow(rd[i])
  // At this point road is guaranteed to be a list of length-3 lists.
  // I guess we don't mind a redundant final road row.
  const mrd = rd.slice(1, rd.length-1)
  if (mrd.length != bu.deldups(mrd).length) {
    let prev = mrd[0] // previous row
    for (i = 1; i < mrd.length; i++) {
      if (bu.arrayEquals(mrd[i], prev))
        return "Road matrix has duplicate row: "+showrow(mrd[i])
      prev = mrd[i]
    }
    return "Road matrix duplicate row error! Tell support!" //seems unreachable
  }
  if (gol.kyoom && gol.odom)
    return "The odometer setting doesn't make sense for an auto-summing goal!"

  return ""
}

// Generate razrroad for YBHP migration by shifting each segment by the lane
// width in the negative yaw direction, ie, towards the bad side of the road.
// This yields a razrroad that coincides with the critical edge of the old-style
// laney road. Sort of. At least the critical edge as drawn on the graph, which
// isn't the real critical edge since road width depended on the rate. See
// https://github.com/beeminder/road/issues/96#issuecomment-629482046 for the
// very gory details. #DIELANES
// We're holding on to this in case we want to convert any historical roads in
// archived goals. The current decision is to not do that. Rather, we just
// interpret the historical centerline as being the razor road. It's hard to
// improve on that and hardly matters anyway since it's only about historical
// roads but it's possible we could want to use the current rate as a proxy for
// lane width and shift historical roads towards the bad side by that amount,
// which is what this function does.
function genRazr() {
  const yaw = gol.yaw
  const t1 = seg => seg.sta[0]
  const t2 = seg => seg.end[0]
  const v1 = seg => seg.sta[1]
  const v2 = seg => seg.end[1]
  const offset = bu.conservaround(0 /* lane width or current rate */, 1e-14, 1)

  // Iterate over road segments, s, where segments go from
  // {t1,       v1      } to {t2,       v2      } or 
  // {s.sta[0], s.sta[1]} to {s.end[0], s.end[1]}
  gol.razrroad = roads.slice().map(s => {
    // Previous things we tried:
    // (1) lnf of the midpoint of the segment:     offset = lnf((t1(s)+t2(s))/2)
    // (2) min of lnf(t1) and lnf(t2):      offset = min(lnf(t1(s)), lnf(t2(s)))
    // (3) max of current lnw and amount needed to ensure not redyest:
    //     yest = gol.asof - SID
    //     bdelt = -yaw*(gol.dtf(yest) - br.rdf(roads, yest)) // bad delta
    //     offset = yest < gol.tini ? gol.lnw : max(gol.lnw, bdelt)
    // (4) just use current lnw for chrissakes
    return {
      sta:   [t1(s), v1(s) - yaw*offset],
      end:   [t2(s), v2(s) - yaw*offset],      
      slope: s.slope,
      auto:  s.auto,
    }
  })

  // Beebody style road matrix is a list of end-of-segment values, and each
  // segment means "start where previous segment left off, and then connect that
  // to these new coordinates". But for the very first segment we draw, we need
  // to know where to start, so we add the tini/vini row, but that is kind of an
  // exception, because we don't draw that segment, we just use it to know where
  // to start the first segment. But the road structure that we create in
  // razrroad for bgraph to use, each segment has a start and an end. When we
  // map over that road struct to turn it into a road matrix style data, we need
  // the initial dummy row to give us tini/vini, but we don't  need the final
  // dummy row.
  gol.razrmatr = gol.razrroad.slice(0,-1).map(s => {
    if (s.auto === 0) return [null,     s.end[1], s.slope*gol.siru]
    if (s.auto === 1) return [s.end[0], null,     s.slope*gol.siru]
    if (s.auto === 2) return [s.end[0], s.end[1], null   ]
    return "ERROR"
  })
}

/** Process goal parameters */
function procParams() {

  gol.dtf = br.stepify(data) // map timestamps to most recent datapoint value
  
  gol.road = br.fillroad(gol.road, gol)
  const rl = gol.road.length
  gol.tfin = gol.road[rl-1][0]
  gol.vfin = gol.road[rl-1][1]
  gol.rfin = gol.road[rl-1][2]
  // tfin, vfin, rfin are set in procRoad
  
  // Error checking to ensure the road rows are in chronological order
  const tlist = gol.road.map(e => e[0])
  if (gol.tini > tlist[0]) {
    return "Road dial error\\n(There are segments of your yellow brick road\\n"
      +"that are somehow dated before your road start date!)"
  } 
  // The above check is superfluous for now because fillroad() actually cleans
  // up the road matrix by throwing away road rows that violate that. See the 
  // notes in the comments of fillroad() in broad.js.
  if (!bu.orderedq(tlist)) {
    return "Road dial error\\n(Your goal date, goal "
      +(gol.kyoom?"total":"value")+", and rate are inconsistent!\\n"
      +"Is your rate positive when you meant negative?\\n"
      +"Or is your goal "+(gol.kyoom?"total":"value")+" such that the implied"
      +" goal date is in the past?)"
  }
 
  // rdf function is implemented in broad.js
  // rtf function is implemented in broad.js

  gol.stdflux = br.stdflux(roads, data.filter(d => d[0]>=gol.tini))
  
  flatline()

  const dl = data.length
  
  if (gol.movingav) {
    // Filter data and produce moving average
    if (!(dl <= 1 || data[dl-1][0]-data[0][0] <= 0)) { 
    
      // Create new vector for filtering datapoints
      const newx = griddle(data[0][0], data[dl-1][0],
                           (data[dl-1][0]-data[0][0])*4/SID)
      JSON.stringify(newx)
      gol.filtpts = newx.map(d => [d, ema(data, d)])
    } else gol.filtpts = []
  } else gol.filtpts = []
  
  gol.tcur = data[dl-1][0]
  gol.vcur = data[dl-1][1]
  gol.vprev= data[max(dl-2,0)][1] // default to vcur if < 2 datapts

  gol.safebuf = br.dtd(roads, gol, gol.tcur, gol.vcur)
  gol.tluz = gol.tcur+gol.safebuf*SID
  gol.delta = bu.chop(gol.vcur - br.rdf(roads, gol.tcur))
  gol.rah = br.rdf(roads, gol.tcur+bu.AKH)
  
  gol.dueby = br.dueby(roads, gol, 7)
  gol.safebump = br.lim(roads, gol, gol.safebuf)
  
  gol.rcur = br.rtf(roads, gol.tcur) * gol.siru
  gol.ravg = br.tvr(gol.tini, gol.vini, gol.tfin,gol.vfin, null) * gol.siru
  gol.cntdn = ceil((gol.tfin-gol.tcur)/SID)
  // The "lane" out-param for backward-compatibility:
  gol.lane = gol.yaw * (gol.safebuf - (gol.safebuf <= 1 ? 2 : 1))
  gol.color = (gol.safebuf < 1 ? "red"    :
               gol.safebuf < 2 ? "orange" :
               gol.safebuf < 3 ? "blue"   : "green")
  gol.loser = br.redyest(roads, gol, gol.tcur) // TODO: need iso here
  gol.sadbrink = (gol.tcur-SID > gol.tini)
    && (br.dotcolor(roads, gol, gol.tcur-SID,
                    gol.dtf(gol.tcur-SID, gol.isolines))==bu.Cols.REDDOT)
  if (gol.safebuf <= 0) gol.tluz = gol.tcur
  if (gol.tfin < gol.tluz)  gol.tluz = bu.BDUSK
      
  setDefaultRange()
  //genRazr()
  //console.log(`rdf(tfin)=${br.rdf(roads, gol.tfin)}`)
  return ""
}

function sumSet(rd, gol) {
  const y = gol.yaw, d = gol.dir, 
        l = gol.lane, dlt = gol.delta, 
        q = gol.quantum

  const MOAR = (y>0 && d>0), 
        PHAT = (y<0 && d<0),
        WEEN = (y<0 && d>0), 
        RASH = (y>0 && d<0)

  const shn  = ((x, e=y, t=4, d=2) => q===null ? bu.shn(x, t, d, e) : // TODO
                                                 bu.conservaround(x, q, e))
  const shns = ((x, e=y, t=4, d=2) => (x>=0 ? "+" : "") + shn(x, e, t, d))


  if (gol.error != "") {
    gol.statsum = " error:    "+gol.error+"\\n"
    return
  }
  const rz = (bu.zip(gol.road))[2]
  let minr = bu.arrMin(rz)
  let maxr = bu.arrMax(rz)
  if (abs(minr) > abs(maxr)) { const tmp = minr; minr = maxr; maxr = tmp }
  const smin = bu.shn(minr,      4,2)
  const smax = bu.shn(maxr,      4,2)
  const savg = bu.shn(gol.ravg, 4,2)
  const scur = bu.shn(gol.rcur, 4,2)
  gol.ratesum = 
    (minr === maxr ? smin : "between "+smin+" and "+smax) +
    " per " + bu.UNAM[gol.runits] + 
    (minr !== maxr ? " (current: " + scur + ", average: " + savg + ")" : "")

  // What we actually want is timesum and togosum (aka, progtsum & progvsum) 
  // which will be displayed with labels TO GO and TIME LEFT in the stats box
  // and will have both the absolute amounts remaining as well as the 
  // percents done as calculated here.
  const pt = bu.shn(bu.cvx(bu.daysnap(gol.tcur),
                           gol.tini, bu.daysnap(gol.tfin), 0,100, false), 1,1)
  let pv = bu.cvx(gol.vcur, gol.vini,gol.vfin, 0,100, false)
  pv = bu.shn(gol.vini < gol.vfin ? pv : 100 - pv, 1,1)

  if (pt == pv) gol.progsum = pt+"% done"
  else          gol.progsum = pt+"% done by time -- "+pv+"% by value"

  let x, ybrStr
  if (gol.cntdn < 7) {
    x = sign(gol.rfin) * (gol.vfin - gol.vcur)
    ybrStr = "To go to goal: "+shn(x,0,2,1)+"."
  } else {
    x = br.rdf(roads, gol.tcur+gol.siru) - br.rdf(roads, gol.tcur)
    ybrStr = "Yellow Brick Rd = "+(x>=0 ? "+" : "")+bu.shn(x, 2, 1, 0)
                           +" / "+bu.UNAM[gol.runits]+"."
  }

  const ugprefix = false // debug mode: prefix yoog to graph title
  gol.graphsum = 
    (ugprefix ? gol.yoog : "")
    + shn(gol.vcur,0,3,1)+" on "+bu.shd(gol.tcur)+" ("
    + bu.splur(gol.numpts, "datapoint")+" in "
    + bu.splur(1+floor((gol.tcur-gol.tini)/SID),"day")+") "
    + "targeting "+shn(gol.vfin,0,3,1)+" on "+bu.shd(gol.tfin)+" ("
    + bu.splur(gol.cntdn, "more day")+"). "+ybrStr

  gol.deltasum = shn(abs(dlt),0) + " " + gol.gunits
    + (dlt<0 ? " below" : " above")+" the bright line"

  const c = gol.safebuf // countdown to derailment, in days
  const cd = bu.splur(c, "day")
  const lim  = br.lim (roads, gol, MOAR || PHAT ? c : 0)
  const limd = br.limd(roads, gol, MOAR || PHAT ? c : 0)
  if (gol.kyoom) {
    if (MOAR) gol.limsum = shns(limd)+" in "+cd
    if (PHAT) gol.limsum = shns(limd)+" in "+cd
    if (WEEN) gol.limsum = shns(limd)+" today" 
    if (RASH) gol.limsum = shns(limd)+" today"
  } else {
    if (MOAR) gol.limsum= shns(limd)+" in "+cd+" ("+shn(lim)+")"
    if (PHAT) gol.limsum= shns(limd)+" in "+cd+" ("+shn(lim)+")"
    if (WEEN) gol.limsum= shns(limd)+" today ("    +shn(lim)+")"    
    if (RASH) gol.limsum= shns(limd)+" today ("    +shn(lim)+")"
  }
  if (y*d<0)      gol.safeblurb = "unknown days of safety buffer"
  else if (c>999) gol.safeblurb = "more than 999 days of safety buffer"
  else            gol.safeblurb = "~"+cd+" of safety buffer"

  gol.titlesum = 
    bu.toTitleCase(gol.color) + ": bmndr.com/"+gol.yoog+" is safe for ~"+cd
    + (c===0 ? " (beemergency!)" : "")
  gol.headsum = gol.titlesum

  gol.statsum =
    " progress: "+bu.shd(gol.tini)+"  "
    +(data == null ? "?" : bu.shn(gol.vini, 4, 2, 0))+"\\n"
    +"           "+bu.shd(gol.tcur)+"  "+bu.shn(gol.vcur, 4, 2, 0)
    +"   ["+gol.progsum+"]\\n"
    +"           "+bu.shd(gol.tfin)+"  "+bu.shn(gol.vfin, 4, 2, 0)+"\\n"
    +" rate:     "+gol.ratesum+"\\n"
    +" lane:     " +((abs(l) == 666)?"n/a":l)+"\\n"
    +" safebuf:  "+gol.safebuf+"\\n"
    +" delta:    "+gol.deltasum+"\\n"
    +" "
  if      (y==0) gol.statsum += "limit:    "
  else if (y<0)  gol.statsum += "hard cap: "
  else           gol.statsum += "bare min: "
  gol.statsum += gol.limsum+"\\n"
  //gol.statsum = encodeURI(gol.statsum) // TODO
}

// Fetch value with key n from hash p, defaulting to d -- NOT USED 
/*
function getNumParam (p, n, d) { return n in p ? Number(p[n]) : d }
function getBoolParam(p, n, d) { return n in p ? p[n]         : d }
function getStrParam (p, n, d) { return n in p ? p[n]         : d }
*/

/** Initiates reprocessing of a newly changed road, recomputing
 * associated goal stats and internal details.*/
this.reloadRoad = function() {
  //console.debug("id="+curid+", reloadRoad()")
  const error = procParams()

  if (error != "") return error
    
  sumSet(roads, gol)

  // TODO: This seems to compute these entities based on old data, particularly
  // when this function is called from bgraph as a result of an edited road.
  gol.fullroad = gol.road.slice()
  gol.fullroad.unshift( [gol.tini, gol.vini, 0, 0] )
  if (gol.error == "") {
    gol.pinkzone = [[gol.asof,br.rdf(roads, gol.asof),0]]
    gol.road.forEach(
      function(r) {
        if (r[0] > gol.asof && r[0] < gol.asof+bu.AKH) {
          gol.pinkzone.push([r[0], r[1], null])
        }
      }
    )
    gol.pinkzone.push([gol.asof+bu.AKH, br.rdf(roads, gol.asof+bu.AKH),
                        null])
    gol.pinkzone = br.fillroadall(gol.pinkzone, gol)
  }
    
  // Generate the aura function now that the flatlined datapoint's also computed
  if (gol.aura) {
    const adata = data.filter(e => e[0]>=gol.tmin)
    const fdata = br.gapFill(adata)
    gol.auraf = br.smooth(fdata)
  } else gol.auraf = (e => 0)

  gol.dtdarray = br.dtdarray( roads, gol )
  
  gol.isolines = []
  for (let i = 0; i < 4; i++)
    gol.isolines[i] = br.isoline(roads, gol.dtdarray, gol, i)
  
  return ""
}

let stats = {}

/** Process goal details */
function genStats(p, d, tm=null) {
  //console.debug("genStats: id="+curid+", "+p.yoog)

  try {
    if (tm == null) tm = moment.utc().unix() // Start the clock immediately!
    legacyIn(p)                              // Which is kind of silly because
    initGlobals()                            // legacyIn and initGlobals take no
    gol.proctm = tm                         // time so could just get time here
    // stampIn() returns the data array in the following format
    // [t, v, c, index, v(original)] 
    data = stampIn(p, d)

    // make sure all supplied params are recognized
    const lup = [] // list of unknown parameters
    for (const k in p) {
      if (k in p) {
        if (!(k in pin) && !pig.includes(k)) lup.push(`${k}=${p[k]}`)
        else gol[k] = p[k]
      }
    }
    if (lup.length > 0) gol.error += 
      `Unknown param${lup.length===1 ? "" : "s"}: ${lup.join(', ')}`

    // Process & extract various params that are independent of road & data
    // maybe just default to aggday=last; no such thing as aggday=null
    if (!('aggday' in p)) p.aggday = gol.kyoom ? "sum" : "last"
    
    gol.siru = bu.SECS[gol.runits]
    gol.horizon = gol.asof+bu.AKH
    // Save initial waterbuf value for comparison in bgraph.js
    gol.waterbuf0 = gol.waterbuf
    
    // Append final segment to the road array. These values will be re-extracted
    // after filling in road in procParams.
    if (bu.listy(gol.road)) gol.road.push([gol.tfin, gol.vfin, gol.rfin])
    if (gol.error == "") gol.error = vetParams()
    if (gol.error == "") gol.error = procData()
    
    // Extract road info into our internal format consisting of road segments:
    // [ [startt, startv], [endt, endv], slope, autofield ]
    if (gol.error == "") gol.error = procRoad(p.road)
    if (gol.error == "") gol.error = self.reloadRoad() // does procParams here

    computeRosy()
      
  } finally {
    // Generate beebrain stats (use getStats tp retrieve)
    stats = Object.assign({}, pout)
    for (const prop in stats) stats[prop] = gol[prop]
    stampOut(stats)
    legacyOut(stats)
  }
}

/**Returns an object with pre-computed goal statistics, summaries and other
   details. */
this.getStats = function() { return bu.deepcopy(stats) }

/**Set a new road object for Beebrain. Should be followed by a call to 
   {@link beebrain#reloadRoad reloadRoad()} to perform a recomputation of goal
   stats. Used by the road editor implemented by the {@link bgraph} module.*/
this.setRoadObj = function(newroad) {
  if (newroad.length == 0) {
    console.log("id="+curid+", setRoadObj(), null road!")
    return
  }
  roads = newroad
  self.roads = roads

  // Update the internal road object in bb format so procParams can proceed
  gol.road = []
  for (let i = 1; i < roads.length; i++)
    gol.road.push([roads[i].sta[0], roads[i].sta[1], roads[i].slope])
  self.gol = gol

  self.reloadRoad()
}
  
genStats( bbin.params, bbin.data )
gol.graphurl = bu.BBURL
gol.thumburl = bu.BBURL
  
// -----------------------------------------------------------------------------
// -------------------------- BEEBRAIN OBJECT EXPORTS --------------------------

/** beebrain object ID for the current instance */
this.id = curid
  
// Static members for outside access
this.DPTYPE = DPTYPE

/** Holds the current array of road segments. The
format for this object is an array of linear segments, each of
which is an object with the following format: `{sta: [t, v], end:
[t, v], slope: r, auto: autoparam}`, where `r` is expressed in
Hertz (1/s), and `autoparam` is one of the enumerated values in
{@link module:broad.RP broad.RP}, indicating which entry will be
auto-computed. Note that the end point for one segment is required
to be identical to the starting point for the next
segment.  */
this.roads = roads
/** Holds current goal's information */
this.gol = gol
/** Holds current goal's aggregated datapoints */
this.data = data
/** Holds current goal's preprocessed rosy datapoints */
this.rosydata = rosydata
/** Holds all of current goal's datapoints */
this.alldata = alldata
/** Holds datapoint values associated with each day */
this.allvals = allvals
/** Holds all datapoints into the future */
this.fuda = fuda
/** Holds the flatlined datapoint */
this.flad = flad
/** Holds an array of odometer resets */
this.oresets = oresets
/** Holds an array of derailments */
this.derails = derails

this.hollow = hollow
this.hashtags = hashtags

} // END beebrain object constructor -------------------------------------------

return beebrain

})) // END MAIN ----------------------------------------------------------------