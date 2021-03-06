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
  let prop, hasProp
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
  let newdom = dom.map(f)
  let maxelt = self.arrMax(newdom)
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
  let il = l.length
  let ol = []
  for (let i=0; i < il; i+=d) if (i+n <= il) ol.push(l.slice(i,i+n))
  return ol
}

/** Returns a list containing the fraction and integer parts of a float
    @param {Number} f Input number */
self.modf = (f) =>{
  let fp = (f<0)?-f:f, fl = floor(fp)
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
  let y
  if (issorted) y = l
  else y = l.slice().sort((a,b)=>(a-b))
  if (qt < 1 || qt > 9) return null // error
  
  let abcd = [         // Parameters for the Hyndman and Fan algorithm
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
  let out = [x]
  for (let i = 0; i < l.length; i++)
    out.push(f(out[i], l[i]))
  return out
}

/** Return a list with the cumulative sum of the elements in l,
    left to right 
    @param {Number[]} l*/
self.accumulate = (l) => {
  let ne = l.length
  if (ne === 0) return l
  let nl = [l[0]]
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
  let lo = l.slice(), i
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

// Return 0 when x is very close to 0.
self.chop = (x, tol=1e-7) => (abs(x) < tol ? 0 : x)

// Return an integer when x is very close to an integer.
self.ichop = (x, tol=1e-7) => {
  let fp = x % 1, ip = x - fp
  if (fp < 0) {fp += 1; ip -= 1;}
  if (fp > 0.5) fp = 1 - self.chop(1-fp)
  return floor(ip) + self.chop(fp, tol)
}

// Clip x to be at least a and at most b: min(b,max(a,x)). Swaps a & b if a > b.
self.clip = (x, a, b) => {
  if (a > b) [a, b] = [b, a]
  return x < a ? a : x > b ? b : x
}


// -----------------------------------------------------------------------------
// The following pair of functions -- searchHigh and searchLow -- take a sorted
// array and a distance function. A distance function is like an "is this the
// element we're searching for and if not, which way did it go?" function. It
// takes an element of a sorted array and returns a negative number if it's too
// small, a positive number if it's too big, and zero if it's just right. Like
// if you wanted to find the number 7 in an array of numbers you could use `x-7`
// as a distance function.                                     L     H
//   Sorted array:                                [-1,  3,  4, 7, 7, 7,  9,  9]
//   Output of distance function on each element: [-8, -4, -3, 0, 0, 0, +2, +2]
// So searchLow would return the index of the first 7 and searchHigh the last 7.
// Or in case of no exact matches...                        L   H
//   Sorted array:                                [-1,  3,  4,  9,  9]
//   Output of distance function on each element: [-8, -4, -3, +2, +2]
// In that case searchLow returns the (index of the) 4 and searchHigh the 9. In
// other words, searchLow errs low, returning the biggest element less than the
// target if the target isn't found. And searchHigh errs high, returning the
// smallest element greater than the target if the target isn't found.
// In the case that every element is too low...                     L   H
//   Sorted array:                                [-2, -2, -1,  4,  6]
//   Output of distance function on each element: [-9, -9, -8, -3, -1]
// As you'd expect, searchLow returns the last index (length minus one) and 
// searchHigh returns one more than that (the actual array length).
// And if every element is too big...           L   H
//   Sorted array:                                [ 8,  8,  9, 12, 13]
//   Output of distance function on each element: [+1, +1, +2, +5, +6]
// Then it's the opposite, with searchHigh giving the first index, 0, and
// searchLow giving one less than that, -1.
// HISTORICAL NOTE: 
// We'd found ourselves implementing and reimplementing ad hoc binary searches
// all over the Beebrain code. Sometimes they would inelegantly do O(n)
// scooching to find the left and right bounds in the case of multiple matches.
// So we made this nice general version.
// -----------------------------------------------------------------------------

// Take a sorted array (sa) and a distance function (df) and do a binary search,
// returning the index of an element with distance zero, erring low per above.
// Review of the cases:
// 1. There exist elements of sa for which df is 0: return index of first such
// 2. No such elements: return the price-is-right index (highest w/o going over)
// 3. Every element too small: return n-1 (the index of the last element)
// 4. Every element is too big: return -1 (one less than the first element)
// *This is like finding the infimum of the set of just-right elements.*
self.searchLow = (sa, df) => {
  if (!sa || !sa.length) return -1 // empty/non-array => every element too big

  let li = -1         // initially left of the leftmost element of sa
  let ui = sa.length  // initially right of the rightmost element of sa
  let mi              // midpoint of the search range for binary search
  
  while (ui-li > 1) {
    mi = floor((li+ui)/2)
    if (df(sa[mi]) < 0) li = mi
    else                ui = mi
  }
  return ui === sa.length || df(sa[ui]) !== 0 ? li : ui
}

// Take a sorted array (sa) and a distance function (df) and do the same thing
// as searchLow but erring high. Cases:
// 1. There exist elements of sa for which df is 0: return index of last such
// 2. No such elements: return the least upper bound (lowest w/o going under)
// 3. Every element is too small: return n (one more than the last element)
// 4. Every element is too big: return 0 (the index of the first element)
// *This is like finding the supremum of the set of just-right elements.*
self.searchHigh = (sa, df) => {
  if (!sa || !sa.length) return 0 // empty/non-array => every element too small

  let li = -1         // initially left of the leftmost element of sa
  let ui = sa.length  // initially right of the rightmost element of sa
  let mi              // midpoint of the search range for binary search
  
  while (ui-li > 1) {
    mi = floor((li+ui)/2)
    if (df(sa[mi]) <= 0) li = mi
    else                 ui = mi
  }
  return li === -1 || df(sa[li]) !== 0 ? ui : li
}
  
// Automon is pretty great but sometimes it would also be nice to have unit
// tests. I'm not sure how best to do that. We don't want crap like the
// following in production... 
/*
const unit_test_1 = self.searchLow([7,7,7], x => x-7)
if (unit_test_1 !== 0) {
  console.log("TEST FAILED: searchHigh/Low edge case")
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
  let i,ret = Array(n)
  n--
  for (i=n; i>=0; i--) ret[i] = (i*b+(n-i)*a)/n
  return ret
}

// Convex combination: x rescaled to be in [c,d] as x ranges from a to b.
self.rescale = (x, a,b, c,d) => {
  if (abs(a-b) < 1e-7) return x <= (a+b)/2 ? c : d // avoid division by 0
  return c + (x-a)/(b-a)*(d-c)
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
  let l = a.length, i
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
  let s = 0, l = a.length, i
  if (l == 0) return 0
  for(i = 0; i < l; i++) s += a[i]
  return s / a.length
}

/** Median of values in list a
    @param {Number[]} a Input list*/
self.median = (a) => {
  let m = 0, l = a.length
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
  let result = moment(m)
  result.add(days, 'days')
  return result
}

/* Utility functions from hmsparsafore in case they're useful...

// Convenience function. What Jquery's isNumeric does, I guess. Javascript wat?
function isnum(x) { return x - parseFloat(x) + 1 >= 0 }

// Take a Date object, set the time back to midnight, return new Date object
function dayfloor(d) {
  let x = new Date(d)
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
  let now = new Date()
  let d = new Date()
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
  let offset = new Date().getTimezoneOffset()
  return (t - offset*60) % 86400
}
*/

/** Fixes the supplied unixtime to 00:00:00 on the same day (uses Moment)
    @param {Number} ut Unix time  */
self.daysnap = (ut) => {
  let d = moment.unix(ut).utc()
  d.hours(0)
  d.minutes(0)
  d.seconds(0)
  d.milliseconds(0)
  return d.unix()
}

/** Scooches unixtime ut to 00:00:00 on the first of the month (uses Moment)
    @param {Number} ut Unix time  */
self.monthsnap = (ut) => {
  let d = moment.unix(ut).utc()
  d.date(1).hours(0).minutes(0).seconds(0).milliseconds(0)
  return d.unix()
}

/** Fixes the supplied unixtime to the first day 00:00:00 on the
    same year (uses moment)
    @param {Number} ut Unix time  */
self.yearsnap = (ut) => {
  let d = moment.unix(ut).utc()
  d.month(0).date(1).hours(0).minutes(0).seconds(0).milliseconds(0)
  return d.unix()
}

/** Formats the supplied unix time as YYYY.MM.DD
    @param {Number} ut Unix time  */
self.formatDate = (ut) => {
  let mm = moment.unix(ut).utc()
  let year = mm.year()
  let month = (mm.month()+1)
  month = month < 10 ? "0"+month.toString() : month.toString()
  let day = mm.date()
  day= day < 10 ? "0"+day.toString() : day.toString()
  return year+"."+month+"."+day
}

/** Formats the supplied unix time as YYYY.MM.DD HH.MM.SS
    @param {Number} ut Unix time  */
self.formatDateTime = (ut) => {
  let mm = moment.unix(ut).utc()
  let hour = mm.hour()
  hour = hour < 10 ? "0"+hour.toString() : hour.toString()
  let minute = mm.minute()
  minute = minute < 10 ? "0"+minute.toString() : minute.toString()
  let second = mm.second()
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
  let mm = moment.unix(t).utc()
  let y = mm.year()
  let m = mm.month() + 1
  let d = mm.date()
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
    let xobj = new XMLHttpRequest()
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

// These are not currently used but they might be handy elsewhere?
//const st = i => rd[i].sta[0]                 // start time of ith road segment
//const et = i => rd[i].end[0]                  // end time of ith road segment
//const isin = (t,i) => st(i) <= t && t < et(i)  // whether segment i contains t
//const delt = s => t < s.sta[0] ? s.sta[0]-t :   // Road segment s's delta
//                  t > s.end[0] ? s.end[0]-t : 0 // from t (0 if t is w/in s).

// Find the index of the road segment containing the given t-value. This may not
// be unique since there can a vertical segment (or multiple ones) exactly at
// the given t-value. In that case go with the segment after the vertical
// segments. Which makes sense since the segment after the vertical ones also
// contains t: that segment will necessarily start exactly at t.
// Since we've added a flat dummy segment after tfin (and before tini), we're
// guaranteed to find a non-vertical segment for any t-value.
self.findSeg = (rd, t) => {
  return bu.searchHigh(rd, s => s.end[0] < t ? -1 :
                                s.sta[0] > t ? +1 : 0)
}


/* SCRATCH AREA -- last remnants of search refactoring #SCHDEL

// Find the index of the road segment containing the given t-value. Note that
// there could be a vertical segment (or even multiple ones) exactly at the
// given t-value. In that case the dir parameter says how to disambiguate. Since
// we've added a flat dummy segment after tfin (and before tini), we're
// guaranteed to find a non-vertical segment for any t-value.
// Cases:
// 1. t is within exactly one segemnt: easy, return (the index of) that segment
// 2. t is on a boundary between 2 segments: return 2nd one (regardless of dir)
// 3. t is on a vertical segment & dir=-1: return the first vertical segment
// 4. t on a vert segmt & dir=+1: return the non-vertical segment to the right
// 5. t on a vert segmt & dir=0: return the vertical segment (if there are
//    multiple vertical segments all at t, return one arbitrarily)
self.findSeg_old = (rd, t, dir=0) => {
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

  // the version that matches the original findSeg on paper:
  //return dir > 0 ? bu.searchHigh(rd, delt) : bu.searchLow(rd, s=>s.sta[0]-t)

  // i think this is unneeded and searchHigh/Low cover this:
  if (!rd || !rd.length || t < st(0) || t > et(rd.length-1)) return -1

  let li = -1         // initially left of the leftmost element of sa
  let ui = rd.length  // initially right of the rightmost element of sa
  let mi              // midpoint of the search range for binary search
  
  while (ui-li > 1) {
    mi = floor((li+ui)/2)
    if (delt(rd[mi]) <= 0) li = mi // df(rd[mi])<0 searchLow; st(mi)<=t old
    else                   ui = mi
  }
  mi = isin(t, ui) ? ui : li // bias right
  if (dir < 0) while(mi > 0           && st(mi-1) === t) mi--
  if (dir > 0) while(mi < rd.length-1 && st(mi+1) === t) mi++
  return mi

  //return bu.searchLow(rd, s => {s.end[0] <  t ? -1 : s.sta[0] >= t ?  1 : 0})

  for (let i = 0; i < rd.length; i++) if (isin(t, i)) return i  
  console.log(`DEBUG WTF NO ROAD SEGMENT CONTAINS ${t}`)
  return null
  
  //return bu.clip(bu.searchLow(rd, s=>s.sta[0] < t ? -1:1), 0, rd.length-1)

  return bu.clip((dir > 0 ? bu.searchHigh(rd, delt)
                          : bu.searchLow(rd, s=>s.sta[0]-t)), 1, rd.length - 2)
*/

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
   supplied dtdarray. The resulting isoline is correct for do-less and rash
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
  let iso1 = self.isoline_generate(           rd, dtdarr, gol, v)
  let iso2 = self.isoline_monotonicity( iso1, rd, dtdarr, gol, v)
  let iso3 = self.isoline_nobackward(   iso2, rd, dtdarr, gol, v)
  let iso4 = self.isoline_clip(         iso3, rd, dtdarr, gol, v)

  if (retall) return [iso1, iso2, iso3, iso4]
  else return iso4
}
  
// Evaluate a given isoline (array of (x,y) pairs) at the supplied x-coordinate
self.isoval = (isoline, x) => {
  if (!isoline || !isoline.length) return null
  // assume isolines extend horizontally forever outside their bounds
  if (x <= isoline[               0][0]) return isoline[               0][1]
  if (x >= isoline[isoline.length-1][0]) return isoline[isoline.length-1][1]

  const i = bu.searchLow(isoline, p=>p[0]<=x?-1:1)
  //if (isoline[i][0] === isoline[i+1][0]) {
  //  console.log("Warning: isoline has vertical segment at " + x)
  //}
  return bu.rescale(x, isoline[i][0], isoline[i+1][0],
                       isoline[i][1], isoline[i+1][1])
}

// Return which side of a given isoline (an array of (x,y) pairs) a given 
// datapoint is: -1 for wrong and +1 for correct side. 
// Being exactly on an isoline counts as the good side (+1).
// Note the floating point tolerance, multiplied by abs(v) to be a bit more
// robust. In the extreme case, imagine the values are already so tiny that
// they're about equal to the tolerance. Then checking if v - isoval was greater
// than -v would be way too forgiving.
self.isoside = (g, isoline, t, v) => {
  const iv = self.isoval(isoline, t)
  if (iv === null) return 0
  return (v - iv)*g.yaw >= abs(v)*-1e-15 ? +1 : -1
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
  const i = bu.searchLow(d, p=>p[0]-x)
  return i < 0 ? dflt : d[i][1]
}

// Take a list of datapoints sorted by x-value and return a pure function that
// interpolates a step function from the data, always mapping to the most
// recent value.
self.stepify = (d, dflt=0) =>
  d === null ? x => dflt : x => self.stepFunc(d, x, dflt)

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
  
  // Stable-sort by timestamp before dayparsing the timestamps because
  // if the timestamps were actually given as unixtime then dayparse
  // works like dayfloor and we lose fidelity. We also augment the
  // data array with the index, unprocessed value and the datapoint id
  // if it exists, the index otherwise
  return d
    .map((r,i) => [bu.dayparse(r[0]),r[1],r[2],i,r[1]]) // Store indices
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

// Exponentially-weighted Moving Average; returns smoothed value at x.
// Very inefficient since we recompute the whole moving average up to x for
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
  hashtagRE = new RegExp("(?:^|\\s)(#\\p{L}[\\p{L}0-9_]*)(?=$|\\s)", "gu")
} catch { // Firefox can't handle the above in 2019 so...
  hashtagRE = /(?:^|\s)(#[a-zA-Z]\w*)(?=$|\s)/g
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
    v(original), id]<br/>
    
    Coming out, datapoints have the following format: [t, v,
    comment, type, prevt, prevv, v(original) or null, index]<br/>
    
    Each point also records coordinates for the preceding point to
    enable connecting plots such as steppy and rosy even after
    filtering based on visibility in graph. v(original) is the
    datapoint value before aggregated values etc. are
    computed. Finally, index is the array index of the datapoint in
    the input data array.
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
  const at = bu.daysnap(gol.tini)
  const xt = bu.daysnap(gol.tcur)
  const bt = bu.daysnap(gol.tfin)
  const av = gol.vini
  const xv = gol.vcur
  const bv = gol.vfin
  let pt, pv // percent done by time, percent done by value
  pt = at === bt ? '??' : bu.shn(bu.rescale(xt, at,bt, 0,100), 1,1)
  if (av === bv)
    pv = xv < av && gol.yaw > 0 ||
         xv > av && gol.yaw < 0    ? '00' : '100'
  else if (abs(av-bv) < 1e-7)
    pv = xv <  (av+bv)/2 && gol.yaw > 0 ||
         xv >  (av+bv)/2 && gol.yaw < 0    ? '~0' : '~100'
  else pv = bu.shn(bu.rescale(gol.vcur, gol.vini,gol.vfin, 0,100), 1,1)

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

/**
 * Beebrain graph generation and yellow brick road editing provided as a UMD
 * module. Provides a {@link bgraph} class, which can be used to construct
 * independent graph generating objects each with their own internal state,
 * possibly linked to particular div elements on the DOM.<br/>
 * <br/>Copyright 2017-2020 Uluc Saranli and Daniel Reeves
 @module bgraph
 @requires d3
 @requires moment
 @requires butil
 @requires broad
 @requires beebrain
 */

;((function (root, factory) { // BEGIN PREAMBLE --------------------------------

'use strict'

if (typeof define === 'function' && define.amd) {
  // AMD. Register as an anonymous module.
  //console.log("bgraph: Using AMD module definition")
  define(['d3', 'moment', 'butil', 'broad', 'beebrain'], factory)
} else if (typeof module === 'object' && module.exports) {
  // Node. Does not work with strict CommonJS, but only CommonJS-like
  // environments that support module.exports, like Node.
  //console.log("bgraph: Using CommonJS module.exports")
  module.exports = factory(require('d3'), 
                           require('./moment'), 
                           require('./butil'), 
                           require('./broad'), 
                           require('./beebrain'))
} else {
  //console.log("bgraph: Using Browser globals")
  root.bgraph    = factory(root.d3, 
                           root.moment, 
                           root.butil, 
                           root.broad, 
                           root.beebrain)
}

})(this, function (d3, moment, bu, br, bb) { // END PREAMBLE -- BEGIN MAIN -----

'use strict'

// -----------------------------------------------------------------------------
// --------------------------- CONVENIENCE CONSTANTS ---------------------------

const max   = Math.max
const min   = Math.min
const abs   = Math.abs
const floor = Math.floor
const ceil  = Math.ceil
const round = Math.round

const DIY = 365.25
const SID = 86400

// -----------------------------------------------------------------------------
// ------------------------------ FACTORY GLOBALS ------------------------------

/** Global counter to generate unique IDs for multiple bgraph instances. */
let gid = 1

/** Default settings */
let defaults = {
  /** Generates an empty graph and JSON */
  noGraph:      false, 
  /** Binds the graph to a div element */
  divGraph:     null,
  /** Binds the road table to a div element */
  divTable:     null,    
  /** Binds the datapoint table to a div element */
  divPoints:    null,    
  /** Binds the dueby table to a div element */
  divDueby:    null,    
  /** Binds the data table to a div element */
  divData:    null,    
  /** Binds the goal JSON output to a div element */
  divJSON:      null,    
  /** Size of the SVG element to hold the graph */
  svgSize:      { width: 700, height: 450 },
  /** Boundaries of the SVG group to hold the focus graph */
  focusRect:    { x:0, y:0, width:700, height: 370 },
  /** Initial padding within the focus graph. */
  focusPad:     { left:25, right:5, top:25, bottom:30 },
  /** Boundaries of the SVG group to hold the context graph */
  ctxRect:      { x:0, y:370, width:700, height: 80 },
  /** Initial padding within the context graph. */
  ctxPad:       { left:25, right:5, top:0, bottom:30 },
  /** Height of the road matrix table. Choose 0 for unspecified */
  tableHeight:  387,
  
  /** Visual parameters for the zoom in/out buttons. "factor" 
      indicates how much to zoom in/out per click. */
  zoomButton:   { size: 40, opacity: 0.6, factor: 1.5 },
  /** Size of the bullseye image in the focus and context graphs */ 
  bullsEye:     { size: 40, ctxsize: 20 },
  /** Visual parameters for draggable road dots */ 
  roadDot:      { size: 5, ctxsize: 3, border: 1.5, ctxborder: 1 },
  /** Visual parameters for draggable road knots and removal buttons */ 
  roadKnot:     { width: 3, rmbtnscale: 0.6 },
  /** Visual parameters for draggable road lines */ 
  roadLine:     { width: 3, ctxwidth: 2 },
  /** Visual parameters for fixed lines for the original road */ 
  oldRoadLine:  { width: 3, ctxwidth: 2, dash: 32, ctxdash: 16 },
  /** Visual parameters for data points (past, flatlined and hollow) */ 
  dataPoint:    { size: 5, fsize: 5, hsize: 2.5, border:1 }, 
  /** Visual parameters for the akrasia horizon */ 
  horizon:      { width: 2, ctxwidth: 1, dash: 8, ctxdash: 6, 
                  font: 10, ctxfont: 9 },
  /** Visual parameters for vertical line for asof */ 
  today:        { width: 2, ctxwidth: 1, font: 12, ctxfont: 9 },
  /** Visual parameters for watermarks */
  watermark:    { height:170, fntsize:150, color:"#000000" }, // was #f0f0f0
  guidelines:   { width:2, weekwidth:4 },
  maxfluxline:  4, // width
  stdfluxline:  2, // width
  razrline:     2, 
  /** Visual parameters for text boxes shown during dragging */ 
  textBox:      { margin: 3 },
  /** Visual parameters for odometer resets */ 
  odomReset:    { width: 0.5, dash: 8 },
  
  roadLineCol:  { valid: "black",    invalid:"#ca1212",  selected:"yellow" },
  roadDotCol:   { fixed: "darkgray", editable:"#c2c2c2", selected: "yellow" },
  roadKnotCol:  { dflt: "#c2c2c2", selected: "yellow",
                  rmbtn: "black", rmbtnsel: "red" },
  textBoxCol:   { bg: "#ffffff", stroke:"#d0d0d0" },
  roadTableCol: { bg:"#ffffff", bgHighlight: "#fffb55", 
                  text:"#000000", textDisabled: "#aaaaaa",
                  bgDisabled:"#f2f2f2"},
  dataPointCol: { future: "#909090", stroke: "#eeeeee" },
  halfPlaneCol: { fill: "#ffffe8" },
  pastBoxCol:   { fill: "#f8f8f8", opacity:0.5 },
  odomResetCol: { dflt: "#c2c2c2" }, 
                
  /** Strips the graph of all details except what is needed for svg output */
  headless:     false,
  /** Enables zooming by scrollwheel. When disabled, only the context graph and
      the zoom buttons will allow zooming. */
  scrollZoom:   true,
  /** Enables zooming with buttons */
  buttonZoom:   true,
  /** Enables the road editor. When disabled, the generated graph mirrors
      Beebrain output as closely as possible. */
  roadEditor:   false,
  /** Enables the display of the context graph within the SVG */
  showContext:  false,
  /** Enables showing a dashed rectangle in the context graph visualizing the
      current graph limits on the y-axis */
  showFocusRect: false,
  /** Enables displaying datapoints on the graph */ 
  showData:     true,
  /** When datapoint display is enabled, indicates the number of days before
      asof to show data for. This can be used to speed up display refresh for
      large goals. Use -1 to display all datapoints. */ 
  maxDataDays:  -1,
  /** Indicates how many days beyond asof should be included in the fully
      zoomed out graph. This is useful for when the goal date is too far beyond
      asof, making the context graph somewhat useless in the UI. */
  maxFutureDays: 365,
  /** Indicates whether slopes for segments beyond the currently dragged
      element should be kept constant during editing */
  keepSlopes:   true,
  /** Indicates whether guidelines should be shown in the interactive editor */
  showGuidelines: true,
  /** Indicates whether intervals between the knots for segments beyond the
      currently dragged element should be kept constant during editing */
  keepIntervals: false,
  /** Indicates whether the road matrix table should be shown with the earliest
      rows first (normal) or most recent rows first (reversed) */ 
  reverseTable: false,
  /** Indicates whether the auto-scrolling feature for the road matrix table
      should be enabled such that when the mouse moves over knots, dots, or road
      elements, the corresponding table row is scrolled to be visible in the
      table. This is particularly useful when tableHeight is explicitly
      specified and is nonzero. */ 
  tableAutoScroll: true,
  /** Chooses whether the road matrix table should be dynamically updated
      during the dragging of road knots, dots, and segments. Enabling this may
      induce some lagginess, particularly on Firefox due to more components
      being updated during dragging. */
  tableUpdateOnDrag: false,
  /** Chooses whether the dueby table should be dynamically updated
      during the dragging of road knots, dots, and segments. */
  duebyUpdateOnDrag: true,
  /** Chooses whether the road matrix table should include checkboxes for
      choosing the field to be automatically computed */
  tableCheckboxes: true,
  /** Callback function that gets invoked when the road is edited by the user.
      Various interface functions can then be used to retrieve the new road
      state. This is also useful to update the state of undo/redo and submit
      buttons based on how many edits have been done on the original road. */
  onRoadChange: null,
  /** Callback function that gets invoked when a datapoint is edited
      or deleted.  onDataEdit(id, data) indicates that the datapoint
      with the given id is edited with the new content "data =
      [daystamp, value, cmt]" or deleted if data=null */
  onDataEdit: null,
  /** Number of entries visible on the data table */
  dataTableSize: 11,
  dataAutoScroll: true,
  /** Callback function that gets invoked when an error is encountered in
      loading, processing, drawing, or editing the road */
  onError:      null,
}

/** This object defines default options for mobile browsers, where
 larger dots, knots and roads are necessary to make editing through
 dragging feasible. */
const mobiledefaults = {
  svgSize:     { width: 700, height: 530 },
  focusRect:   { x:0, y:0, width: 700, height: 400 },
  focusPad:    { left: 25, right: 10, top: 35, bottom: 30 },
  ctxRect:     { x: 0, y: 400, width: 700, height: 80 },
  ctxPad:      { left: 25, right: 10, top: 0, bottom: 30 },
  tableHeight: 540, // Choose 0 for unspecified

  zoomButton:  { size: 50, opacity: 0.7, factor: 1.5 },
  bullsEye:    { size: 40, ctxsize: 20 },
  roadDot:     { size: 10, ctxsize: 4, border: 1.5, ctxborder: 1 },
  roadKnot:    { width: 7, rmbtnscale: 0.9 },
  roadLine:    { width: 7, ctxwidth: 2 },
  oldRoadLine: { width: 3, ctxwidth: 1, dash: 32, ctxdash: 16 },
  dataPoint:   { size: 4, fsize: 6 }, 
  horizon:     { width: 2, ctxwidth: 1, dash: 8, ctxdash: 8, 
                 font: 14, ctxfont: 10 },
  today:       { width: 2, ctxwidth: 1, font: 16, ctxfont: 10 },
  watermark:   { height: 150, fntsize: 100, color: "#000000" }, // was #f0f0f0
  guidelines:  { width: 2, weekwidth: 4 },
  maxfluxline: 4, // width
  stdfluxline: 2, // width
  razrline:    2,
  textBox:     { margin: 3 },
}

/** Style text embedded in the SVG object for proper saving of the SVG */
const SVGStyle = 
  ".svg{shape-rendering:crispEdges}" 
+ ".axis path,.axis line{fill:none;stroke:black;shape-rendering:crispEdges}"
+ ".axis .minor line{stroke:#777;stroke-dasharray:0,2,4,3}"
+ ".grid line"
+ "{fill:none;stroke:#dddddd;stroke-width:1px;shape-rendering:crispEdges}"
+ ".aura{fill-opacity:0.3;stroke-opacity:0.3;}"
+ ".aurapast{fill-opacity:0.15;stroke-opacity:0.3}"
+ ".grid .minor line{stroke:none}"
+ ".axis text{font-family:sans-serif;font-size:11px}"
+ ".axislabel{font-family:sans-serif;font-size:11px;text-anchor:middle}"
+ "circle.dots{stroke:black}"
+ "line.roads{stroke:black}"
+ ".pasttext,.ctxtodaytext,.ctxhortext,.horizontext,.hashtag"
+ "{text-anchor:middle;font-family:sans-serif}"
+ ".waterbuf,.waterbux{opacity:0.05882353;" //stroke:#dddddd;stroke-width:1;"
+ "text-anchor:middle;font-family:Dejavu Sans,sans-serif}"
+ ".loading{text-anchor:middle;font-family:Dejavu Sans,sans-serif}"
+ ".zoomarea{fill:none}"
+ "circle.ap{stroke:none}"
+ "circle.rd{stroke:none;pointer-events:none;fill:"+bu.Cols.ROSE+"}"
+ "circle.std{stroke:none;pointer-events:none;fill:"+bu.Cols.PURP+"}"
+ "circle.hp{stroke:none;fill:"+bu.Cols.WITE+"}"
+ ".dp.gra,.ap.gra{fill:"+bu.Cols.GRADOT+"}"
+ ".dp.grn,.ap.grn{fill:"+bu.Cols.GRNDOT+"}"
+ ".dp.blu,.ap.blu{fill:"+bu.Cols.BLUDOT+"}"
+ ".dp.orn,.ap.orn{fill:"+bu.Cols.ORNDOT+"}"
+ ".dp.red,.ap.red{fill:"+bu.Cols.REDDOT+"}"
+ ".dp.blk,.ap.blk{fill:"+bu.Cols.BLCK+"}"
+ ".dp.fuda,.ap.fuda{fill-opacity:0.3}"
+ ".guides{pointer-events:none;fill:none;stroke:"+bu.Cols.LYEL+"}"
+ ".ybhp{pointer-events:none}"
+ ".rosy{fill:none;stroke:"+bu.Cols.ROSE+";pointer-events:none}"
+ ".steppy{fill:none;stroke:"+bu.Cols.PURP+";pointer-events:none}"
+ ".steppyppr{fill:none;stroke-opacity:0.8;stroke:"+bu.Cols.LPURP+";pointer-events:none}"
+ ".derails{fill:"+bu.Cols.REDDOT+";pointer-events:none}"
+ ".overlay .textbox{fill:#ffffcc;fill-opacity:0.5;stroke:black;"
+ "stroke-width:1;pointer-events:none;rx:5;ry:5}"

/** Fraction of plot range that the axes extend beyond */
const PRAF = .015

/** Seconds to milliseconds (Javascript unixtime is the latter) */
const SMS = 1000 

/** Paths for various PNG images used within the SVG */
const PNG = { beye:  "https://s3.amazonaws.com/bmndr/road/bullseye.png", 
              beyey: "https://s3.amazonaws.com/bmndr/road/bullseye_prev.png",

              // these versions are very light gray and not currently used:
              //skl:   "https://s3.amazonaws.com/bmndr/road/jollyroger.png",
              //inf:   "https://s3.amazonaws.com/bmndr/road/infinity.png",
              //sml:   "https://s3.amazonaws.com/bmndr/road/smiley.png",
              
              // black versions we're currently using with very low opacity:
              infb:  "https://bmndr.s3.amazonaws.com/road/infinity_blk.png",
              sklb:  "https://bmndr.s3.amazonaws.com/road/jollyroger_blk.png",
              smlb:  "https://bmndr.s3.amazonaws.com/road/smiley_blk.png",
            }

/** Enum object to identify error types */
const ErrType = { NOBBFILE: 0, BADBBFILE: 1, BBERROR: 2 }

/** Enum object to identify error types */
const ErrMsgs = [ "Could not find goal (.bb) file.", 
                  "Bad .bb file.", 
                  "Beeminder error" ]

/** This atrocity attempts to determine whether the page was loaded from a 
    mobile device. It might be from 2019 and in want of updating. */
const onMobileOrTablet = () => {
  if (typeof navigator == 'undefined' && typeof window == 'undefined') 
    return false
  var check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true})(navigator.userAgent||navigator.vendor||window.opera)
  return check
}

/** Configure functionality (private) */
let config = (obj, options) => {
  if (!obj.opts) obj.opts = bu.extend({}, defaults, true)
  
  if (onMobileOrTablet()) bu.extend(obj.opts, mobiledefaults)
  
  let opts = bu.extend(obj.opts, options, true)
  
  opts.divGraph = opts.divGraph && opts.divGraph.nodeName ? opts.divGraph : null
  
  if (opts.headless) {                        // Override options for svg output
    opts.divTable      = null
    opts.divPoints     = null
    opts.divDueby      = null
    opts.divData       = null
    opts.scrollZoom    = false
    opts.roadEditor    = false
    opts.showContext   = false
    opts.showFocusRect = false
  } else {
    opts.divTable = 
      opts.divTable && opts.divTable.nodeName ? opts.divTable : null
    opts.divPoints = 
      opts.divPoints && opts.divPoints.nodeName ? opts.divPoints : null
  }
  
  return opts
}

// -----------------------------------------------------------------------------
// ---------------------------- BGRAPH CONSTRUCTOR -----------------------------

/** @typedef BGraphOptions
    @global
    @type {object}
    @property {boolean} noGraph Generates an empty graph and JSON if true
    @property {Boolean} headless Strips the graph of all details except what is needed for svg output.
    @property {Boolean} roadEditor Enables the road editor. When disabled, the generated graph mirrors beebrain output as closely as possible.
    
    @property {object}  divJSON  Binds the goal JSON output to a div element

    @property {object}  divGraph Binds the graph to a div element
    @property {object}  svgSize  Size of the SVG element to hold the graph e.g. { width: 700, height: 450 }
    @property {object}  focusRect Boundaries of the SVG group to hold the focus graph e.g. { x:0, y:0, width:700, height: 370 }
    @property {object} focusPad Initial padding within the focus graph e.g. { left:25, right:5, top:25, bottom:30 }
    @property {object} ctxRect Boundaries of the SVG group to hold the context graph e.g. { x:0, y:370, width:700, height: 80 }
    @property {object} ctxPad Initial padding within the context graph e.g. { left:25, right:5, top:0, bottom:30 }
    @property {Boolean} scrollZoom Enables zooming by scrollwheel. When disabled, only the context graph and the zoom buttons will allow zooming.
    @property {Boolean} showContext Enables the display of the context graph within the SVG
    @property {Boolean} showFocusRect Enables showing a dashed rectange in the context graph visualizing the current graph limits on the y-axis
  
    @property {Boolean} keepSlopes Indicates whether slopes for segments beyond the currently dragged element should be kept constant during editing.
    @property {Boolean} keepIntervals Indicates whether intervals between the knots for segments beyond the currently dragged element should be kept constant during editing.
    @property {Boolean} showData Enables displaying datapoints on the graph 
    @property {Integer} maxDataDays When datapoint display is enabled, indicates the number of days before asof to show data for. This can be used to speed up display refresh for large goals. Choose -1 to display all datapoints. Choose -1 to show all points.
    @property {Integer} maxFutureDays Indicates how many days beyond asof should be included in the fully zoomed out graph. This is useful for when the goal date is too far beyond asof, making the context graph somewhat useless in terms of its interface utility.

    @property {object}  divTable Binds the road table to a div element
    @property {Number} tableHeight Height of the road matrix table. Choose 0 for unspecified
    @property {Boolean} tableCheckboxes Chooses whether the road matrix table should include checkboxes for choosing the field to be automatically computed.
    @property {Boolean} reverseTable Indicates whether the road matrix table should be shown with the earliest rows first (normal) or most recent rows first(reversed).
    @property {Boolean} tableAutoScroll Indicates whether the auto-scrolling feature for the road matrix table should be enabled such that when the mouse moves over knots, dots or road elements, the corresponding table row is scrolled to be visible in the table. This is particularly useful when tableHeight is explicitly specified and is nonzero.
    @property {Boolean} tableUpdateOnDrag Chooses whether the road matrix table should be dynamically updated during the dragging of road knots, dots and segments. Enabling this may induce some lagginess, particularly on Firefox due to more components being updated during dragging
  
  
    @property {function} onRoadChange Callback function that gets invoked when the road is finished loading or has been edited by the user. Various interface functions can then be used to retrieve the new road state. This is also useful to update the state of undo/redo and submit buttons based on how many edits have been done on the original road.
    @property {function} onError Callback function that gets invoked when an error is encountered  in loading, processing, drawing or editing the road. 

    @property {object} zoomButton Visual parameters for the zoom in/out buttons. "factor" indicates how much to zoom in/out per click. e.g. { size: 40, opacity: 0.6, factor: 1.5 }
    @property {object} bullsEye Size of the bullseye image in the focus and context graphs e.g. { size: 40, ctxsize: 20 }
    @property {object} roadDot Visual parameters for draggable road dots e.g. { size: 5, ctxsize: 3, border: 1.5, ctxborder: 1 }
    @property {object} roadKnot Visual parameters for draggable road knots and removal buttons e.g. { width: 3, rmbtnscale: 0.6 }
    @property {object} roadLine Visual parameters for draggable road lines e.g. { width: 3, ctxwidth: 2 }
    @property {object} oldRoadLine Visual parameters for fixed lines for the original road e.g. { width: 3, ctxwidth: 2, dash: 32, ctxdash: 16 }
    @property {object} dataPoint Visual parameters for data points (past, flatlined and hollow) e.g. { size: 5, fsize: 5, hsize: 2.5 }
    @property {object} horizon Visual parameters for the akrasia horizon e.g. { width: 2, ctxwidth: 1, dash: 8, ctxdash: 6, font: 12, ctxfont: 9 }
    @property {object} today Visual parameters for vertical line for asof  e.g. { width: 2, ctxwidth: 1, font: 12, ctxfont: 9 }
    @property {object} watermark Visual parameters for watermarks e.g. { height:170, fntsize:130 }
    @property {object} guidelines Visual parameters for guidelines e.g. { width:2, weekwidth:4 }
    @property {object} maxfluxline Visual parameter for maxfluxline (width)
    @property {object} stdfluxline Visual parameter for stdfluxline (width)

    @property {object} textBox Visual parameters for text boxes shown during dragging e.g. { margin: 3 }
    @property {object} odomReset Visual parameters for odometer resets e.g. { width: 0.5, dash: 8 }
    

  @property {object} roadLineCol Colors for road segments for the editor, e.g. { valid: "black", invalid:"#ca1212", selected:"yellow"}
  @property {object} roadDotCol Colors for the road dots for the editor, e.g. { fixed: "darkgray", editable:"#c2c2c2", selected: "yellow"}
  @property {object} roadKnotCol Colors for the road knots (vertical) for the editor, e.g. { dflt: "#c2c2c2", selected: "yellow", rmbtn: "black", rmbtnsel: "red"}
  @property {object} textBoxCol Colors for text boxes e.g. { bg: "#ffffff", stroke:"#d0d0d0"}
  @property {object} roadTableCol Colors for the road table e.g. { bg:"#ffffff", bgHighlight: "#fffb55", text:"#000000", textDisabled: "#aaaaaa", bgDisabled:"#f2f2f2"}
  @property {object} dataPointCol Colors for datapoints, e.g. { future: "#909090", stroke: "lightgray"}
  @property {object} halfPlaneCol Colors for the yellow brick half plane. e.g. { fill: "#ffffe8" }
  @property {object} pastBoxCol Colors for the past, e.g. { fill: "#f8f8f8", opacity:0.5 }
  @property {object} odomResetCol Colors for odometer reset indicators, e.g. { dflt: "#c2c2c2" }
  
*/

/** bgraph object constructor. Creates an empty beeminder graph and/or road
 * matrix table with the supplied options. Particular goal details may later be
 * loaded with {@link bgraph~loadGoal} or {@link loadGoalFromURL} functions.

 @memberof module:bgraph
 @constructs bgraph
 @param {BGraphOptions} options JSON input with various graph options
*/
let bgraph = function(options) { // BEGIN bgraph object constructor ------------

//console.debug("beebrain constructor ("+gid+"): ")
let self = this // what OOP magic is this? can we just use "this" on next line?
let opts = config(self, options)
let curid = gid
gid++

// Various dimensions and boxes
let yaxisw = 50
let sw = opts.svgSize.width
let sh = opts.svgSize.height
let plotbox, brushbox, plotpad, contextpad

let zoombtnsize = opts.zoomButton.size
let zoombtnscale = zoombtnsize / 540
let zoombtntr

// Graph components
let svg, defs, graphs, buttonarea, stathead, focus, focusclip, plot,
    context, ctxclip, ctxplot, 
    xSc, nXSc, xAxis, xAxisT, xGrid, xAxisObj, xAxisObjT, xGridObj,
    ySc, nYSc, yAxis, yAxisR, yAxisObj, yAxisObjR, yAxisLabel,
    xScB, xAxisB, xAxisObjB, yScB,
    gPB, gYBHP, gYBHPlines, gPink, gPinkPat, gTapePat, gGrid, gOResets,
    gPastText,
    gGuides, gMaxflux, gStdflux, gRazr, gOldBullseye, 
    gKnots, gSteppy, gSteppyPts, gRosy, gRosyPts, gMovingAv,
    gAura, gDerails, gAllpts, gDpts, gHollow, gFlat, 
    gBullseye, gRoads, gDots, gWatermark, gHashtags, gHorizon, gHorizonText,
    gRedTape,
    zoomarea, axisZoom, zoomin, zoomout,  
    brushObj, brush, focusrect, topLeft, dataTopLeft,
    scf = 1, oldscf = 0,
    xlinkloaded = true

// Internal state for the graph
let lastError = null
let undoBuffer = [] // Array of previous roads for undo
let redoBuffer = [] // Array of future roads for redo
let processing = false
let loading = false
let hidden = false
let mobileOrTablet = onMobileOrTablet()
let dataf, alldataf
let horindex = null // Road segment index including the horizon
let iroad = []  // Initial road 
let igoal = {}  // Initial goal object
  
// Beebrain state objects
let bbr, gol = {}, road = []
let data = [], rawdata = [], alldata = [], dtd = [], iso = []

function getiso(val) {
  if (iso[val] === undefined) iso[val] = br.isoline(road, dtd, gol, val)
  return iso[val]
}

function getisopath( val, xr ) {
  const isoline = getiso(val)
  if (xr == null) xr = [-Infinity, Infinity]
  let x = isoline[0][0]
  let y = isoline[0][1]
  if (x < xr[0]) { x = xr[0]; y = br.isoval(isoline, x) }
  let d = "M"+r1(nXSc(x*SMS))+" "+r1(nYSc(y))
  let a = bu.searchHigh(isoline, p => p[0] < xr[0] ? -1 : 1)
  let b = bu.searchHigh(isoline, p => p[0] < xr[1] ? -1 : 1)
  if (b > isoline.length - 1) b = isoline.length - 1
  for (let i = a; i <= b; i++) {
    d += " L"+r1(nXSc(isoline[i][0]*SMS))+" "+r1(nYSc(isoline[i][1]))
  }
  return d
}
  
// Compute lane width (the delta between yellow guiding lines) based on
// isolines on the left or right border for the graph depending on dir*yaw. If
// dir*yaw > 0 (like do-more), the left side is considered, otherwise the right
// side. The average lane width is computed by computing isolines for dtd=0 and
// dtd=365 and dividing it by 365 to overcome isolines coinciding for flat
// regions.
function isolnwborder(xr) {
  let lnw = 0
  const numdays = min(opts.maxFutureDays, ceil((gol.tfin-gol.tini)/SID))
  const center = getiso(0)
  const oneday = getiso(numdays)
//TODO: switch to this version
//const edge = gol.yaw*gol.dir > 0 ? 0 : 1 // left edge for MOAR/PHAT
//return abs(br.isoval(center, xr[edge])-br.isoval(oneday, xr[edge])) / numdays

  if (gol.yaw*gol.dir > 0) {
    lnw = abs(br.isoval(center, xr[0])-br.isoval(oneday, xr[0])) / numdays
  } else {
    lnw = abs(br.isoval(center, xr[1])-br.isoval(oneday, xr[1])) / numdays
  }
  return lnw
}

/** Limits an svg coordinate to 1 or 3 digits after the decimal 
 @param {Number} x Input number 
*/
function r1(x) { return round(x*10)/10 }
function r3(x) { return round(x*1000)/1000 }

/** Resets the internal goal object, clearing out previous data. */
function resetGoal() {
  // Initialize goal with sane values
  gol = {}
  gol.yaw = +1; gol.dir = +1
  gol.tcur = 0; gol.vcur = 0
  const now = moment.utc()
  now.hour(0); now.minute(0); now.second(0); now.millisecond(0)
  gol.asof = now.unix()
  gol.horizon = gol.asof+bu.AKH
  gol.xMin = gol.asof;  gol.xMax = gol.horizon
  gol.tmin = gol.asof;  gol.tmax = gol.horizon
  gol.yMin = -1;        gol.yMax = 1

  igoal = bu.deepcopy(gol); road = []; iroad = []; data = []; alldata = []
}
resetGoal()

/** Recompute padding value and bounding boxes for various components in the
 * graph. In particular, plotpad, contextpad, plotbox, and contextbox. */
function computeBoxes() {
  plotpad    = bu.extend({}, opts.focusPad)
  contextpad = bu.extend({}, opts.ctxPad)
  if (gol.stathead && !opts.roadEditor) plotpad.top += 15
  plotpad.left  += yaxisw
  plotpad.right += yaxisw+(gol.hidey?8:0) // Extra padding if yaxis text hidden
  contextpad.left += yaxisw
  contextpad.right += yaxisw+(gol.hidey?8:0)
  plotbox = {
    x:      opts.focusRect.x      + plotpad.left,
    y:      opts.focusRect.y      + plotpad.top,
    width:  opts.focusRect.width  - plotpad.left - plotpad.right, 
    height: opts.focusRect.height - plotpad.top  - plotpad.bottom,
  }
  brushbox = {
    x:      opts.ctxRect.x      + contextpad.left,
    y:      opts.ctxRect.y      + contextpad.top,
    width:  opts.ctxRect.width  - contextpad.left - contextpad.right, 
    height: opts.ctxRect.height - contextpad.top  - contextpad.bottom,
  }
  zoombtntr = {
    botin:  "translate("+(plotbox.width-2*(zoombtnsize+5))
                    +","+(plotbox.height -(zoombtnsize+5))
                    +") scale("+zoombtnscale+","+zoombtnscale+")",
    botout: "translate("+(plotbox.width -(zoombtnsize+5))
                    +","+(plotbox.height-(zoombtnsize+5))
                    +") scale("+zoombtnscale+","+zoombtnscale+")",
    topin: "translate("+(plotbox.width-2*(zoombtnsize+5))
                    +",5) scale("+zoombtnscale+","+zoombtnscale+")",
    topout: "translate("+(plotbox.width-(zoombtnsize+5))
                    +",5) scale("+zoombtnscale+","+zoombtnscale+")" }
}
computeBoxes()

/** Utility function to show a shaded overlay with a message consisting of
 multiple lines supplied in the array argument.
 @param {String[]} msgs Array of messages, one for each line
 @param {Number} [fs=-1] Font size. height/15 if -1
 @param {String} [fw="bold"} Font weight
 @param {Object} [box=null] Bounding box {x,y,w,h} for the overlay; default null
 @param {String} [cls="overlay} CSS class of the created overlay
 @param {Boolean} [shd=true] Shade out graph if true
*/
function showOverlay(msgs, fs=-1, fw="bold",
                     box=null, cls="overlay", shd=true, animate=false,
                     parent=null) {
  if (opts.divGraph == null) return
  if (box == null) box ={x:sw/20, y:sh/5, w:sw-2*sw/20, h:sh-2*sh/5}
  if (parent == null) parent = svg
  var pg = parent.select("g."+cls)
  if (pg.empty()) {
    pg = parent.append('g').attr('class', cls)
    if (shd) {
      pg.append('svg:rect').attr('x',             0)
                           .attr('y',             0)
                           .attr('width',         sw)
                           .attr('height',        sh)
                           .style('fill',         bu.Cols.WITE)
                           .style('fill-opacity', 0.5)
    }
    pg.append('svg:rect').attr("class",  "textbox")
                         .attr('x',      box.x)
                         .attr('y',      box.y)
                         .attr('width',  box.w)
                         .attr('height', box.h)
  }
  pg.selectAll(".loading").remove()
  const nummsgs = msgs.length
  if (fs < 0) fs = sh/15
  var lh = fs * 1.1
  for (let i = 0; i < nummsgs; i++) {
    pg.append('svg:text').attr('class', 'loading')
      .attr('x',            box.x+box.w/2)
      .attr('y',            (box.y+box.h/2) - ((nummsgs-1)*lh)/2+i*lh+fs/2-3)
      .attr('font-size',    fs)
      .style('font-size',   fs)
      .style('font-weight', fw)
      .text(msgs[i])
  }
  if (animate) 
    pg.style("opacity", 0).transition().duration(200).style("opacity", 1)
}
/** Removes the message overlay created by {@link 
    bgraph~showOverlay showOverlay()}
    @param {String} [cls="overlay"] CSS class for the overlay to remove
*/
function removeOverlay(cls = "overlay", animate = false, parent = null) {
  //console.debug("removeOverlay("+self.id+")")
  if (opts.divGraph == null) return
  if (parent == null) parent = svg
  var pg = parent.selectAll("g."+cls)
  if (animate) pg.style("opacity", 1).transition().duration(200)
                 .style("opacity", 0).remove()
  else pg.remove()
}

/** Creates all SVG graph components if a graph DIV is provided. Called once
   when the bgraph object is created. */
function createGraph() {
  var div = opts.divGraph
  if (div === null) return
  // First, remove all children from the div
  while (div.firstChild) div.removeChild(div.firstChild)
  
  // Initialize the div and the SVG
  svg = d3.select(div).attr("class", "bmndrgraph")
    .append('svg:svg')
    .attr("id",                  "svg"+curid)
    .attr("xmlns",               "http://www.w3.org/2000/svg")
    .attr("xmlns:xlink",         "http://www.w3.org/1999/xlink")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("viewBox",             "0 0 "+sw+" "+sh)
    .attr('width',               "100%")
    .attr('height',              "100%")
    .attr('class',               'bmndrsvg')
  
  // Common SVG definitions, including clip paths
  defs = svg.append('defs')
  defs.insert('style').attr('type','text/css').text(SVGStyle)
  // Dot types:
  //               col r
  // Rosy dots   : ROSE
  // Steppy pts  : PURP
  // All pts     : 
  // Editor data :
  // Graph data  :
  // Graph hollow:
  defs.insert('style').attr("id", "dynstyle"+curid).attr('type','text/css').text("")
  
  defs.append("clipPath")
    .attr("id", "plotclip"+curid)
    .append("rect").attr("x", 0).attr("y", 0)
    .attr("width", plotbox.width).attr("height", plotbox.height)
  defs.append("clipPath")
    .attr("id", "brushclip"+curid)
    .append("rect").attr("x", 0).attr("y", 0)
    .attr("width", brushbox.width).attr("height", brushbox.height)
  defs.append("clipPath")
    .attr("id", "buttonareaclip"+curid)
    .append("rect").attr("x", plotbox.x).attr("y", 0)
    .attr("width", plotbox.width).attr("height", plotpad.top)
  defs.append("path")
    .style("stroke", "none").attr("id", "rightarrow")
    .attr("d", "M 55,0 -35,45 -35,-45 z")
  
  defs.append("path")
    .style("stroke", "none").attr("id", "downarrow")
    .attr("d", "M 0,40 45,-50 -45,-50 z")
  
  defs.append("path")
    .style("stroke", "none").attr("id", "uparrow")
    .attr("d", "M 0,-40 45,50 -45,50 z")
  
  gPinkPat = defs.append("pattern").attr("id",              "pinkzonepat"+curid)
                                   .attr("x",                0)
                                   .attr("y",                0)
                                   .attr("width",            10)
                                   .attr("height",           10)
                                   .attr("patternTransform", "rotate(45)")
                                   .attr("patternUnits",     "userSpaceOnUse")
  gPinkPat.append("rect").attr("x",                0)
                         .attr("y",                0)
                         .attr("width",            10)
                         .attr("height",           10)
                         .attr("fill", bu.Cols.PINK)
  gPinkPat.append("line").attr("x1",            0)
                         .attr("y1",            0)
                         .attr("x2",            0)
                         .attr("y2",            10)
                         .style("stroke",       "#aaaaaa")
                         .style("stroke-width", 1)
  
  gTapePat = defs.append("pattern").attr("id",              "tapepat"+curid)
                                   .attr("x",                0)
                                   .attr("y",                0)
                                   .attr("width",            20)
                                   .attr("height",           20)
                                   .attr("patternTransform", "rotate(45)")
                                   .attr("patternUnits",     "userSpaceOnUse")
  gTapePat.append("rect").attr("x",                0)
                         .attr("y",                0)
                         .attr("width",            20)
                         .attr("height",           20)
                         .attr("fill", "#ffffff")
  gTapePat.append("line").attr("x1",            0)
                         .attr("y1",            0)
                         .attr("x2",            20)
                         .attr("y2",            0)
                         .style("stroke",       "#ff5555")
                         .style("stroke-width", 25)

  var buttongrp = defs.append("g").attr("id", "removebutton")
  buttongrp.append("circle").attr("cx",   14)
                            .attr("cy",   14)
                            .attr("r",    16)
                            .attr('fill', 'white')
  buttongrp.append("path")
    .attr("d", "M13.98,0C6.259,0,0,6.261,0,13.983c0,7.721,6.259,13.982,13.98,13.982c7.725,0,13.985-6.262,13.985-13.982C27.965,6.261,21.705,0,13.98,0z M19.992,17.769l-2.227,2.224c0,0-3.523-3.78-3.786-3.78c-0.259,0-3.783,3.78-3.783,3.78l-2.228-2.224c0,0,3.784-3.472,3.784-3.781c0-0.314-3.784-3.787-3.784-3.787l2.228-2.229c0,0,3.553,3.782,3.783,3.782c0.232,0,3.786-3.782,3.786-3.782l2.227,2.229c0,0-3.785,3.523-3.785,3.787C16.207,14.239,19.992,17.769,19.992,17.769z")
  
  var zoomingrp = defs.append("g").attr("id", "zoominbtn")
  if (!opts.headless && opts.buttonZoom) {
    // Zoom buttons are not visible for SVG output in headless mode
    zoomingrp.append("path").style("fill", "white")
      .attr("d", "m 530.86356,264.94116 a 264.05649,261.30591 0 1 1 -528.1129802,0 264.05649,261.30591 0 1 1 528.1129802,0 z")
    zoomingrp.append("path")
      .attr("d", "m 308.21,155.10302 -76.553,0 0,76.552 -76.552,0 0,76.553 76.552,0 0,76.552 76.553,0 0,-76.552 76.552,0 0,-76.553 -76.552,0 z m 229.659,114.829 C 537.869,119.51007 420.50428,1.9980234 269.935,1.9980234 121.959,1.9980234 2.0000001,121.95602 2.0000001,269.93202 c 0,147.976 117.2473599,267.934 267.9339999,267.934 150.68664,0 267.935,-117.51205 267.935,-267.934 z m -267.935,191.381 c -105.681,0 -191.381,-85.7 -191.381,-191.381 0,-105.681 85.701,-191.380996 191.381,-191.380996 105.681,0 191.381,85.700996 191.381,191.380996 0,105.681 -85.7,191.381 -191.381,191.381 z")
  }
  
  var zoomoutgrp = defs.append("g").attr("id", "zoomoutbtn")
  if (!opts.headless && opts.buttonZoom) {
    // Zoom buttons are not visible for SVG output in headless mode
    zoomoutgrp.append("path").style("fill", "white")
      .attr("d", "m 530.86356,264.94116 a 264.05649,261.30591 0 1 1 -528.1129802,0 264.05649,261.30591 0 1 1 528.1129802,0 z")
    zoomoutgrp.append("path")
      .attr("d", "m 155.105,231.65502 0,76.553 229.657,0 0,-76.553 c -76.55233,0 -153.10467,0 -229.657,0 z m 382.764,38.277 C 537.869,119.51007 420.50428,1.9980234 269.935,1.9980234 121.959,1.9980234 2.0000001,121.95602 2.0000001,269.93202 c 0,147.976 117.2473599,267.934 267.9339999,267.934 150.68664,0 267.935,-117.51205 267.935,-267.934 z m -267.935,191.381 c -105.681,0 -191.381,-85.7 -191.381,-191.381 0,-105.681 85.701,-191.380996 191.381,-191.380996 105.681,0 191.381,85.700996 191.381,191.380996 0,105.681 -85.7,191.381 -191.381,191.381 z")
  }
  
  // Create rectange to monitor zoom events and install handlers
  zoomarea = svg.append('rect').attr("class",  "zoomarea")
                               .attr("x",      plotbox.x)
                               .attr("y",      plotbox.y)
                               .attr("color",  bu.Cols.REDDOT)
                               .attr("width",  plotbox.width)
                               .attr("height", plotbox.height)
  var oldscroll = zoomarea.on("wheel.scroll")
  var scrollinfo = {shown: false, timeout: null}
  
  var onscroll = function() {
    if (scrollinfo.timeout != null) {
      clearTimeout(scrollinfo.timeout)
      scrollinfo.timeout = null
    }
    if (d3.event.ctrlKey) {
      removeOverlay("zoominfo",true, plot)
      scrollinfo.shown = false
      return
    }
    if (!scrollinfo.shown) {
      showOverlay(["Use ctrl+scroll to zoom"], -1,"normal",
                  {x:0,y:0,w:plotbox.width,h:plotbox.height},
                  "zoominfo", false, true, plot)
      scrollinfo.shown = true
    }
    scrollinfo.timeout= setTimeout(() => {removeOverlay("zoominfo", true);
                                          scrollinfo.shown = false},1000)
 }
  var onmove = function() {
    if (scrollinfo.timeout != null) {
      clearTimeout(scrollinfo.timeout)
      scrollinfo.timeout = null
    }
    removeOverlay("zoominfo",true)
    scrollinfo.shown = false
  }
  zoomarea.on("wheel.scroll", onscroll, {passive:false})
  zoomarea.on("mousedown.move", onmove)
  //zoomarea.on("touchstart", ()=>{console.log("touchstart")} )
  //zoomarea.on("touchmove", ()=>{console.log("touchmove")} )
  //zoomarea.on("touchend", ()=>{console.log("touchend")} )

  axisZoom = d3.zoom()
    .extent([[0, 0], [plotbox.width, plotbox.height]])
    .scaleExtent([1, Infinity])
    .translateExtent([[0, 0], [plotbox.width, plotbox.height]])
    .filter(function(){ return (d3.event.type != "wheel" || d3.event.ctrlKey) })
    .on("zoom", zoomed)
  zoomarea.call(axisZoom)
  if (onMobileOrTablet()) {
    var pressTimer = null, pressX
    var oldTouchStart = zoomarea.on("touchstart.zoom")
    var oldTouchMove  = zoomarea.on("touchmove.zoom")
    var oldTouchEnd   = zoomarea.on("touchend.zoom")
    
    zoomarea
      .on("touchstart.zoom", function(){ 
        var bbox = this.getBoundingClientRect()
        pressX = d3.event.touches.item(0).pageX - bbox.left
        var newx = nXSc.invert(pressX)
        if (pressTimer == null && d3.event.touches.length == 1) 
          pressTimer = window.setTimeout(
            () => { if (newx != null) addNewDot(newx/SMS) }, 1000)
        oldTouchStart.apply(this, arguments)} )
      .on("touchmove.zoom", function(){ window.clearTimeout(pressTimer); pressTimer = null; oldTouchMove.apply(this, arguments)})
      .on("touchend.zoom", function(){ clearTimeout(pressTimer); pressTimer = null; oldTouchEnd.apply(this, arguments)} )
  }
  function dotAdded() {
    var mouse = d3.mouse(svg.node())
    var newx = nXSc.invert(mouse[0]-plotpad.left)
    addNewDot(newx/SMS)
  }
  function dotAddedShift() {
    if (d3.event.shiftKey) dotAdded()
    else clearSelection()  
  }
  if (opts.roadEditor) {
    zoomarea.on("click", dotAddedShift)
    zoomarea.on("dblclick.zoom", dotAdded)
  } else {
    zoomarea.on("dblclick.zoom", null)
  }
  
  focus = svg.append('g')
    .attr('class', 'focus')
    .attr('transform', 'translate('+opts.focusRect.x
          +','+opts.focusRect.y+')');
  buttonarea = focus.append('g')
    .attr('clip-path', 'url(#buttonareaclip'+curid+')')
    .attr('class', 'buttonarea'); 
  focusclip = focus.append('g')
    .attr('class', 'focusclip')
    .attr('clip-path', 'url(#plotclip'+curid+')')
    .attr('transform', 'translate('+plotpad.left
          +','+plotpad.top+')');
  plot = focusclip.append('g').attr('class', 'plot');
  
  stathead = focus.append('svg:text').attr("x", sw/2).attr("y", 15)
    .attr("width", plotbox.width)
    .attr('class', 'svgtxt')
    .style("font-size", "80%")
    .attr('text-anchor', 'middle')
  
  // Order here determines z-order... 
  // (The commented z-values are to remember previous order for experimenting)
  gPB          = plot.append('g').attr('id', 'pastboxgrp')     // z = 01
  gYBHP        = plot.append('g').attr('id', 'ybhpgrp')        // z = 02
  gWatermark   = plot.append('g').attr('id', 'wmarkgrp')       // z = 03
  gGuides      = plot.append('g').attr('id', 'guidegrp')       // z = 04
  gMaxflux     = plot.append('g').attr('id', 'maxfluxgrp')     // z = 05
  gStdflux     = plot.append('g').attr('id', 'stdfluxgrp')     // z = 06
  gYBHPlines   = plot.append('g').attr('id', 'ybhplinesgrp')   // z = 07
  gRazr        = plot.append('g').attr('id', 'razrgrp')        // z = 08
  gAura        = plot.append('g').attr('id', 'auragrp')        // z = 09
  gPink        = plot.append('g').attr('id', 'pinkgrp')        // z = 10
  gOldBullseye = plot.append('g').attr('id', 'oldbullseyegrp') // z = 11
  gBullseye    = plot.append('g').attr('id', 'bullseyegrp')    // z = 12
  gGrid        = plot.append('g').attr('id', 'grid')           // z = 13
  gOResets     = plot.append('g').attr('id', 'oresetgrp')      // z = 14
  gKnots       = plot.append('g').attr('id', 'knotgrp')        // z = 15
  gSteppy      = plot.append('g').attr('id', 'steppygrp')      // z = 16
  gRosy        = plot.append('g').attr('id', 'rosygrp')        // z = 17
  gRosyPts     = plot.append('g').attr('id', 'rosyptsgrp')     // z = 18
  gDerails     = plot.append('g').attr('id', 'derailsgrp')     // z = 19
  gAllpts      = plot.append('g').attr('id', 'allptsgrp')      // z = 20
  gMovingAv    = plot.append('g').attr('id', 'movingavgrp')    // z = 21
  gSteppyPts   = plot.append('g').attr('id', 'steppyptsgrp')   // z = 22
  gDpts        = plot.append('g').attr('id', 'datapointgrp')   // z = 23
  gHollow      = plot.append('g').attr('id', 'hollowgrp')      // z = 24
  gFlat        = plot.append('g').attr('id', 'flatlinegrp')    // z = 25
  gHashtags    = plot.append('g').attr('id', 'hashtaggrp')     // z = 26
  gRoads       = plot.append('g').attr('id', 'roadgrp')        // z = 27
  gDots        = plot.append('g').attr('id', 'dotgrp')         // z = 28
  gHorizon     = plot.append('g').attr('id', 'horgrp')         // z = 29
  gHorizonText = plot.append('g').attr('id', 'hortxtgrp')      // z = 30
  gPastText    = plot.append('g').attr('id', 'pasttxtgrp')     // z = 31

  gRedTape = plot.append('g').attr('visibility', 'hidden')
  // wwidth and height will be set by resizeGraph later
  gRedTape.append('rect').attr('x', 0).attr('y', 0)
    .attr('stroke-width', 20).attr('stroke', "url(#tapepat"+curid+")")
    .attr('fill', 'none')
  // x coordinate will be set by resizeGraph later
  gRedTape.append('text').attr('y', 45)
    .attr('paint-order', 'stroke')
    .attr('stroke-width', '2px').attr('stroke', '#a00000')
    .attr('font-size', "35px").attr('text-anchor', 'middle')
    .attr('fill', '#ff0000')
    .text("Error") // originally "road can't get easier"

  zoomin = focusclip.append("svg:use")
    .attr("class","zoomin")
    .attr("xlink:href", "#zoominbtn")
    .attr("opacity",opts.zoomButton.opacity)
    .attr("transform", zoombtntr.botin)
    .on("click", () => { zoomarea.call(axisZoom.scaleBy, 
                                       opts.zoomButton.factor) })
    .on("mouseover", () =>{
      if (!mobileOrTablet) d3.select(this).style("fill", "red")})
    .on("mouseout",(d,i) => {d3.select(this).style("fill", "black")})
  zoomout = focusclip.append("svg:use")
    .attr("class",      "zoomout")
    .attr("xlink:href", "#zoomoutbtn")
    .attr("opacity",    opts.zoomButton.opacity)
    .attr("transform",  zoombtntr.botout)
    .on("click", () => { zoomarea.call(axisZoom.scaleBy, 
                                       1/opts.zoomButton.factor) })
    .on("mouseover", () => {
      if (!mobileOrTablet) d3.select(this).style("fill", "red") })
    .on("mouseout",(d,i) => { d3.select(this).style("fill", "black") })

  // Create and initialize the x and y axes
  xSc   = d3.scaleUtc().range([0,plotbox.width])
  xAxis = d3.axisBottom(xSc).ticks(6)

  xAxisObj = focus.append('g')        
    .attr("class", "axis")
    .attr("transform", "translate("+plotbox.x+"," 
          + (plotpad.top+plotbox.height) + ")")
    .call(xAxis)
  xGrid = d3.axisTop(xSc).ticks(6).tickFormat("")
  xGridObj = gGrid.append('g')
    .attr("class", "grid")
    .attr("transform", "translate(0,"+(plotbox.height)+")")
    .call(xGrid)
  xAxisT = d3.axisTop(xSc).ticks(6)
  xAxisObjT = focus.append('g')
    .attr("class", "axis")
    .attr("transform", "translate("+plotbox.x+"," + (plotpad.top) + ")")
    .call(xAxisT)

  if (opts.roadEditor) {
    xGridObj.attr('display', 'none')
    xAxisObjT.attr('display', 'none')
  }

  ySc    = d3.scaleLinear().range([plotbox.height, 0])
  yAxis  = d3.axisLeft(ySc).ticks(8).tickSize(6).tickSizeOuter(0)
  yAxisR = d3.axisRight(ySc).ticks(8).tickSize(6).tickSizeOuter(0)
  yAxisObj = focus.append('g')        
    .attr("class", "axis")
    .attr("transform", "translate(" + plotpad.left + ","+plotpad.top+")")
    .call(yAxis)
  yAxisObjR = focus.append('g').attr("class", "axis")
    .attr("transform", "translate(" 
                       + (plotpad.left+plotbox.width) + ","+plotpad.top+")")
    .call(yAxisR)
  yAxisLabel = focus.append('text')        
    .attr("class", "axislabel")
    .attr("transform", 
          "translate(15,"+(plotbox.height/2+plotpad.top)+") rotate(-90)")
    .text("") // used to say "deneme" but was user-visible in error graphs
  
  // Create brush area
  context = svg.append('g')
    .attr('class', 'brush')
    .attr('transform', 'translate('+opts.ctxRect.x+','+opts.ctxRect.y+')')
  ctxclip = context.append('g')
    .attr('clip-path', 'url(#brushclip'+curid+')')
    .attr('transform', 'translate('+contextpad.left+','+contextpad.top+')')
  ctxplot = ctxclip.append('g').attr('class', 'context')
  xScB = d3.scaleUtc().range([0,brushbox.width])
  xAxisB = d3.axisBottom(xScB).ticks(6)
  xAxisObjB = context.append('g')
    .attr("class", "axis")
    .attr("transform", "translate("+brushbox.x+"," 
          + (contextpad.top+brushbox.height) + ")")
    .call(xAxisB)
  yScB = d3.scaleLinear().range([brushbox.height, 0])

  brushObj = d3.brushX()
    .extent([[0, 0], [brushbox.width, brushbox.height]])
    .on("brush", brushed);

  brush = ctxplot.append("g").attr("class", "brush").call(brushObj)
  focusrect = ctxclip.append("rect")
    .attr("class",             "focusrect")
    .attr("x",                 1)
    .attr("y",                 1)
    .attr("width",             brushbox.width-2)
    .attr("height",            brushbox.height-2)
    .attr("fill",              "none")
    .style("stroke",           "black")
    .style("stroke-width",     1)
    .style("stroke-dasharray", "8,4,2,4")
  nXSc = xSc, nYSc = ySc
}

/** Resize various SVG graph components when any of the bounding boxes change.
 * This is primarily due to the text width for y-axis labels and tick marks
 * changing, as handled by the {@link 
 * bgraph~handleYAxisWidth handleYAxisWidth()} function. */
function resizeGraph() {
  //console.debug("id="+curid+", resizeGraph()")

  var div = opts.divGraph
  if (div === null) return

  var xr = [nXSc.invert(0), nXSc.invert(plotbox.width)]
  //console.debug(xr)
  computeBoxes()
  // Common SVG definitions, including clip paths
  defs.select('#plotclip'+curid+' > rect')
    .attr("width",  plotbox.width)
    .attr("height", plotbox.height)
  defs.select('#brushclip'+curid+' > rect')
    .attr("width",  brushbox.width)
    .attr("height", brushbox.height)
  defs.select('#buttonareaclip'+curid+' > rect')
    .attr("x", plotbox.x)
    .attr("y", 0)
    .attr("width",  plotbox.width)
    .attr("height", plotbox.height);
  zoomarea.attr("x", plotbox.x)
    .attr("y", plotbox.y)
    .attr("width", plotbox.width)
    .attr("height", plotbox.height)
  axisZoom.extent([[0, 0], [plotbox.width, plotbox.height]])
    .scaleExtent([1, Infinity])
    .translateExtent([[0, 0], [plotbox.width, plotbox.height]])
  focusclip.attr('transform', 'translate('+plotpad.left+','+plotpad.top+')')
  zoomin.attr( "transform", zoombtntr.botin)
  zoomout.attr("transform", zoombtntr.botout)
  xSc.range( [0, plotbox.width])
  nXSc.range([0, plotbox.width])
  xAxisObj.attr("transform", "translate("+plotbox.x+"," 
                   + (plotpad.top+plotbox.height) + ")").call(xAxis.scale(nXSc))
  xGridObj.attr("transform", "translate(0,"+(plotbox.height)+")").call(xGrid)
  xAxisObjT.attr("transform", "translate("+plotbox.x+","+(plotpad.top)+")")
    .call(xAxisT.scale(nXSc))

  gRedTape.select('rect').attr('width', plotbox.width).attr('height', plotbox.height)
  gRedTape.select('text').attr('x', plotbox.width/2)
    
  ySc.range( [0, plotbox.height])
  nYSc.range([0, plotbox.height])
  yAxisObj.attr("transform", "translate("+plotpad.left+","+plotpad.top+")")
    .call(yAxis.scale(nYSc))

  yAxisObjR.attr("transform", "translate(" 
                           + (plotpad.left+plotbox.width) + ","+plotpad.top+")")
    .call(yAxisR.scale(nYSc))

  yAxisLabel.attr("transform", 
                  "translate(15,"+(plotbox.height/2+plotpad.top)
                                                               +") rotate(-90)")
  ctxclip.attr('transform', 'translate('+contextpad.left+','+contextpad.top+')')
  //console.debug("Scaling brush x axis to "+brushbox.width);
  xScB.range([0,brushbox.width])
  xAxisObjB.attr("transform", "translate("+brushbox.x+"," 
                 + (contextpad.top+brushbox.height) + ")")
    .call(xAxisB)
  yScB.range([brushbox.height, 0])
  brushObj.extent([[0, 0], [brushbox.width, brushbox.height]])
  brush.call(brushObj)

  // Go back to previous zoom level in case x-axis size / limits have changed
  var s = xr.map(xSc)
  zoomarea.call(axisZoom.transform, d3.zoomIdentity
                .scale(plotbox.width / (s[1] - s[0]))
                .translate(-s[0], 0))
  //console.debug(s)
  adjustYScale()
}

var databody, dataslider, dsliderbusy = false
var datarange, dataindex = 0, dataselected=-1
function updateDataSliderValue() {
  if (!dataslider) return
  dataslider.node().value = dataindex
}
  
function selectDataIndex(ind) {
  ind = rawdata.length-ind-1 // reverse table
  // Make sure the data table is visible before selection
  if (!databody.node().offsetParent) return
  dataselected = ind
  let midpt = Math.floor(opts.dataTableSize/2)
  let tbindex = Math.max(0, Math.min(ind-midpt, rawdata.length-opts.dataTableSize))
  dataindex = tbindex
  updateDataSliderValue()
  updateDataTable()
}
function unselectDataIndex() {
  dataselected = -1
  updateDataTable()
}
function dsliderupdate(val) {
  dsliderbusy = true
  dataindex = parseInt(val)
  updateDataTable()
  dsliderbusy = false
}
function dsliderscroll() {
  if (dtableedit) return
  d3.event.preventDefault()
  if (d3.event.deltaY < 0) {
    if (dataindex == 0) return
    dataindex -= 1
  } else {
    if (dataindex >= rawdata.length-opts.dataTableSize) return
    dataindex += 1
  }
  updateDataSliderValue()
  updateDataTable()
}
/** Creates the skeleton for the data table and populates it with
 * rows. Cells are created later in updateDueBy using d3 */
let dcellclass = ["id", "dt", "vl", "cmt", "mod", "del"]
let dcellelt = ["span", "div", "div", "div", "button", "button"]
function createDataTable() {
  var div = opts.divData
  if (div === null) return
  // First, remove all children from the div
  while (div.firstChild) div.removeChild(div.firstChild)

  var divelt = d3.select(div)
  divelt.append("div").attr("id", "dpfloat").attr("class", "floating")
  dataTopLeft = divelt.append("div").attr("id", "datatopleft")
     .style("position", "absolute").style("left", 0).style("top",0)
     .style("width", "1px").style("height", "1px")
     .attr("visibility","hidden")

  divelt.attr("class", "bmndrdata")
  divelt.on("wheel.scroll", dsliderscroll, {passive:false})

  databody = divelt.append("div").attr("class", "dbody") /* Data table body */
  var datacolumns;
  datarange = Array(Math.min(rawdata.length, opts.dataTableSize)).fill().map((x,i)=>(i+dataindex))
  datacolumns = ['#', 'DATE', 'VALUE', 'COMMENT', '', ''];
  databody.append("div").attr('class', 'dhdrrow')
    .selectAll("span.dhdrcell").data(datacolumns)
    .enter().append("span").attr('class',(d,i) => ('dhdrcell '+dcellclass[i]))
    .style("text-align", (d,i)=>( (i == 0)?"right":null))
    .text((c)=>c);
  databody
    .selectAll(".drow")
    .data(datarange)
    .join(enter => enter.append("div").attr('class', 'drow'))
  dataslider = divelt.append("input").attr("type", "range").attr("class","dslider")
    .attr("min",0).attr("max",15).attr("value",7).attr("step",1)
    .on("input",function(){dsliderupdate(this.value)})
    .on("change",function(){dsliderupdate(this.value)})
}

function createSvgEl(name) {
  return document.createElementNS("http://www.w3.org/2000/svg", name);
}
function createXhtmlEl(name) {
  return document.createElementNS("http://www.w3.org/1999/xhtml", name);
}

let dtablebusy = false, dtableedit = null
function getDataRowId() {
  return event.currentTarget.parentElement.getAttribute('id')
}
function getDataInd() {
  let id = getDataRowId()
  let ind = id.match(/drow(\d+)/)
  if (!ind || ind.length < 2) return null
  return ind[1]
}
function getDataId() {
  let ind = getDataInd()
  if (!ind) return null
  let d = rawdata[ind]
  return d[3]?d[3]:ind
}
function dataEdit() {
  let ind = getDataInd()
  if (!dtableedit) {
    // Starting edit
    let id = getDataRowId()
    dtableedit = ind
    dataslider.attr("disabled", true)
    dataFocus.field = null
    dataFocus.oldText = null
    dataFocus.changed = false
  } else {
    // Finishing edit
    if (dataFocus.changed) {

      let did = getDataId()
      let parent = d3.select(event.currentTarget.parentNode)
      let date = bu.dayparse(parent.select(".dt").text(),'-')
      let value = parent.select(".vl").text()
      let comment = parent.select(".cmt").text()
      if (!isNaN(date)&&!isNaN(value)&&ind==dtableedit&&opts.onDataEdit)
        opts.onDataEdit(did, [date, value, comment])
    }
    dataslider.attr("disabled", null)
    dtableedit = null
  }
  updateDataTable()
}
function dataDelete() {
  let ind = getDataInd()
  let did = getDataId()
  if (dtableedit && dtableedit != ind) return 
  if (opts.onDataEdit) opts.onDataEdit(did, null)
  updateDataTable()
}
function dataCancel() {
  dataslider.attr("disabled", null)
  dtableedit = null
  updateDataTable()
}

// Focused field information for the road table
let dataFocus = {
  field: null,
  oldText : null,
  changed : false
}
function dataFocusIn( d, i ){
  if (!opts.onDataEdit || i == 0  || i > 3) return
  if (!dtableedit) {
    // Starting editing
    dataEdit()
  } else if (!d.edit) return
  
  //console.debug('dataFocusIn('+i+') for '+this.parentNode.id);
  dataFocus.field = d3.select(this)
  dataFocus.oldText = dataFocus.field.text()
  destroyDatePicker()
  var kind = Number(dataFocus.field.node().parentNode.id);
  if (i == 1) {
    var floating = d3.select(opts.divData).select('.floating');
    createDatePicker(dataFocus.field, null, null, floating, dataTopLeft)
  } else if (i == 1) {
    //selectDot(kind, false)
  } else if (i == 2) {
    //selectRoad(kind, false)
  }
}

function dataFocusOut( d, i ){
  if (!opts.onDataEdit || !d.edit || i == 0 || i > 3) return
  //console.debug('tableFocusOut('+i+') for '+this.parentNode.id);
  var kind = Number(this.parentNode.id)
  var text = d3.select(this).text()
  destroyDatePicker()
  clearSelection()
  if (text === dataFocus.oldText) return
  dataFocus.changed = true
  if (dataFocus.oldText == null) return // ENTER must have been hit
  var val = (i==1 ? bu.dayparse(text, '-') : text)
  if (i != 3 && isNaN(val)) {
    d3.select(this).text(dataFocus.oldText)
    dataFocus.oldText = null
    dataFocus.field = null
    return
  }
  dataFocus.oldText = null
  dataFocus.field = null
}
  
function dataKeyDown(d, i) {
  if (!opts.onDataEdit || !d.edit || i == 0 || i > 3) return
  if (d3.event.keyCode == 13) {
    this.blur()
    var text = d3.select(this).text()
    var val = (i==1 ? bu.dayparse(text, '-') : text)
    if (i != 3 && isNaN(val)) {
      d3.select(this).text(dataFocus.oldText)
      dataFocus.oldText = null
      return
    }
    dataFocus.oldText = d3.select(this).text()
    if (d3.event.ctrlKey) {
      // Ctrl-enter finishes editing
      dataEdit()
    }
  }
}
function updateDataTable() {
  if (dtablebusy) return
  dtablebusy = true
  if (processing) return
  if (opts.divData === null) return

  if (!dsliderbusy) {
    if (rawdata.length <= opts.dataTableSize) dataslider.style("visibility", "hidden")
    else {
      dataslider.style("visibility", "visible")
        .attr("max", rawdata.length-opts.dataTableSize)
        .attr("value", 0)
    }
  }
  
  datarange = Array(Math.min(rawdata.length, opts.dataTableSize)).fill().map((x,i)=>(i+dataindex))
  let elts = databody.selectAll(".drow").data(datarange)
  elts.enter()
    .append("div")
    .attr('class', 'drow')
    .attr("id", d=>("drow"+(rawdata.length-d-1)))
  elts.exit().remove()
  elts.style("box-shadow", (d) => (d==dataselected)?"0 0 0 4px yellow":null)
    .attr("id", d=>("drow"+(rawdata.length-d-1)))
  
  let cells = databody
    .selectAll(".drow")
    .selectAll(".dcell")
    .data((row, i) => {
      if (row >= rawdata.length) return [null, null, null, null, null, null]
      row = rawdata.length-row-1 // reverse table
      let date = bu.dayify(bu.dayparse(rawdata[row][0]), '-')
      let editp = (dtableedit)?(row == dtableedit):false
      return [{txt:row,clk:null,edit:editp},
              {txt:date,clk:null,edit:editp},
              {txt:rawdata[row][1],clk:null,edit:editp},
              {txt:rawdata[row][2],clk:null,edit:editp},
              {txt:editp?'<img class="dicon" src="../src/check.svg"></img>':'<img class="dicon" src="../src/edit.svg" ></img>',clk:dataEdit,edit:editp},
              {txt:editp?'<img class="dicon" src="../src/cancel.svg" ></img>':'<img class="dicon" src="../src/trash.svg"></img>',clk:editp?dataCancel:dataDelete,edit:editp}]
    })

  cells.join(enter=>
             enter.append((d,i)=>(createXhtmlEl(dcellelt[i])))
             .attr('class', (d,i)=>("dcell "+dcellclass[i]))
             .style("border", (d,i)=>( (i == 0)?"0":null))
             .style("text-align", (d,i)=>( (i == 0)?"right":null))
             .on('click', d=>(d.clk?d.clk():null)),
             update=>update)
    .html(d=>{return d.txt})
    .style('visibility', function(d){return (this.tagName==="BUTTON" && (dtableedit && !d.edit))?"hidden":null})
    //.attr('contenteditable', (d,i)=>((dtableedit&&d.edit&&i>0)?true:false))
    .attr('contenteditable', (d,i) => (opts.onDataEdit?(i>0&&i<4):false))
    .on('focusin', dataFocusIn)
    .on('focusout', dataFocusOut)
    .on('keydown', dataKeyDown)
    .style('opacity', (d)=>((!dtableedit || d.edit)?null:0.2))
  
  let buttons = databody.selectAll('button.dcell')
  if (opts.onDataEdit) buttons.style('display', null)
  else buttons.style('display', 'none')

  dtablebusy = false
}
function resetDataTable() {
  if (opts.divData === null) return
  dataindex = 0
  dtableedit = null
  dataslider.attr("disabled", null)
  updateDataSliderValue()
  updateDataTable()
}

var dbbody
function duebylabel(i, now) {
  const mm = moment.unix(gol.asof+i*SID).utc()
  const ds = bu.dayparse(mm.format("YYYYMMDD")) / SID
  if (ds == now-1) return ["Yesterday", bu.Cols.REDDOT]
  if (ds == now) return ["Today", bu.Cols.ORNG]
  if (ds == now+1) return ["Tomorrow", bu.Cols.BLUDOT]
  const dstr = mm.format("ddd (Do)")
  if (ds == now+2) return [dstr, bu.Cols.GRNDOT]
  return [dstr, bu.Cols.BLCK]
}
  
/** Creates the skeleton for the dueby table and populates it with
 * rows. Cells are created later in updateDueBy using d3 */
function createDueBy() {
  var div = opts.divDueby
  if (div === null) return
  // First, remove all children from the div
  while (div.firstChild) div.removeChild(div.firstChild)

  var divelt = d3.select(div)
  dbbody = divelt.append("div").attr("class", "dbbody") /* Dueby table body */
  var dbcolumns;
  dbcolumns = ['DAY', 'DELTA', 'TOTAL'];
  dbbody.append("div").attr('class', 'dbhdrrow')
    .selectAll("span.dbhdrcell").data(dbcolumns)
    .enter().append('span').attr('class', 'dbhdrcell')
    .text((c)=>c);
  dbbody
    .selectAll(".dbrow")
    .data([1,2,3,4,5,6,7])
    .join(enter => enter.append("div").attr('class', 'dbrow'))
}

function updateDueBy() {
  if (processing) return
  if (opts.divDueby === null) return

  const nowstamp = bu.nowstamp(gol.timezone, gol.deadline, gol.asof)
  const nowday = bu.dayparse(nowstamp) / SID
  const mark = "&#10004;"
  let db = br.dueby(road, gol, 7)
  
  dbbody
    .selectAll(".dbrow")
    .selectAll(".dbcell")
    .data((row, i) => {const inf = duebylabel(i,nowday), del = db[i][1]; return [inf, [(del > 0 || gol.dir < 0)?bu.shn(del):mark,inf[1]], [bu.shn(db[i][2]),inf[1]]]})
    .join(enter=>enter.append("span").attr('class', 'dbcell'), update=>update)
    .html(d=>d[0])
    .style('color', d=>d[1])
}

/** Creates all road matrix table components if a table DIV is provided. Called
 * once when the bgraph object is created. */
function createTable() {
  var div = opts.divTable
  if (div === null) return
  // First, remove all children from the div
  while (div.firstChild) {
    div.removeChild(div.firstChild)
  }
  var divelt = d3.select(div)
  var startelt = divelt.append("div").attr("class", "rtbstart")
  var bodyelt  = divelt.append("div").attr("class", "rtbmain")
  var goalelt  = divelt.append("div").attr("class", "rtbgoal")
  if (opts.tableHeight != 0) {
    bodyelt.style("max-height", opts.tableHeight+"px")
           .style("overflow-y", "auto")
  }
  var table = bodyelt.append("div").attr("class", "rtable")
  // This element is used to hold the Pikaday instance
  table.append("div").attr("id", "dpfloat").attr("class", "floating")
  // This helps figure out layout coords of the scrolled window top left
  topLeft = table.append("div").attr("id", "topleft")
    .style("position", "absolute").style("left", 0).style("top",0)
    .style("width", "1px").style("height", "1px")
    .attr("visibility","hidden")
  if (opts.reverseTable) {
    createGoalTable()
    createRoadTable()
    createStartTable()
  } else {
    createStartTable()
    createRoadTable()  
    createGoalTable()
  }
}

function roadChanged() {

  // If it were the case that tini was simply the first entry in the
  // road, update it for the edited road
  if (igoal.tini == iroad[0].end[0]) {
    gol.tini = road[0].end[0]
    gol.vini = road[0].end[1]
  }
  
  if (!settingRoad)
    // Explicitly set the road object for beebrain to force it to recompute
    // goal parameters
    bbr.setRoadObj(road)
  
  computePlotLimits(true)
  horindex = br.findSeg(road, gol.horizon)
  reloadBrush()
  updateRoadData()
  updateGraphData(true)
  updateContextData()
  updateTable()
  updateDueBy()
  if (typeof opts.onRoadChange === 'function') opts.onRoadChange.call()
}

// ---------------------------- Text Box Utilities -----------------------------

function createTextBox(x, y, text, col, textr=null) {
  let textobj = {}
  if (y < 20-plotpad.top)    y = 20 -plotpad.top
  if (y > plotbox.height-15) y = plotbox.height-15
  textobj.grp = focus.append('g')
  textobj.rect = textobj.grp.append('svg:rect')
    .attr('pointer-events', "none")
    .attr('fill',   opts.textBoxCol.bg)
    .style('stroke', col)
  textobj.text = textobj.grp.append('svg:text').attr('pointer-events', "none")
                                               .attr('text-anchor', 'middle')
  if (textr == null) {
    textobj.text.text(text).attr('class', 'svgtxt')
  } else {
    textobj.text.append("tspan").attr("x", 0).attr("dy", "0.6em")
                                .text(text).attr('class', 'svgtxt')
    for (var i = 0; i < textr.length; i++) {
      textobj.text.append("tspan").attr("dy", "1.2em")
        .attr("x", 0).text(textr[i])
        .attr("font-size", "0.7em")
    }
  }
  var bbox = textobj.text.node().getBBox()
  var margin = opts.textBox.margin
  textobj.rect.attr('x',      bbox.x - margin)
              .attr('y',      bbox.y - margin)
              .attr('width',  bbox.width + margin*2)
              .attr('height', bbox.height+ margin*2)

  if (x < bbox.width/2)               x = bbox.width/2
  if (x > plotbox.width-bbox.width/2) x = plotbox.width - bbox.width/2

  textobj.grp.attr('transform', 'translate('+(x+plotpad.left)+","
                                            +(y+plotpad.top)+")")
  return textobj
}

function updateTextBox( obj, x, y, text ) {
  if (!obj) {console.debug("updateTextBox: null input"); return }
  if (y < 20-plotpad.top)    y = 20 - plotpad.top
  if (y > plotbox.height-15) y = plotbox.height - 15
  obj.text.text(text)
  var bbox = obj.text.node().getBBox()
  var margin = opts.textBox.margin
  obj.rect.attr('x', bbox.x-margin)
          .attr('y', bbox.y-margin)
          .attr('width',  bbox.width +margin*2)
          .attr('height', bbox.height+margin*2)

  if (x < bbox.width/2)               x = bbox.width/2
  if (x > plotbox.width-bbox.width/2) x =plotbox.width - bbox.width/2
  obj.grp.attr('transform', 'translate('+(x+plotpad.left)+","
                                        +(y+plotpad.top)+")")
}

function rmTextBox( obj ) {
  if (!obj) { console.debug("updateTextBox: null input"); return }
  obj.grp.remove()
}

function hideTextBox( obj, hide ) {
  if (!obj) { console.debug("updateTextBox: null input"); return }
  obj.grp.attr("visibility", hide ? "hidden" : "visible")
}


// ----------------- Zoom and brush  related private functions -----------------

var ticks, tickType = 1, majorSkip = 7
/** Compute locations and labels for x-axis ticks corresponding to the entire
 * graph range for different zoom levels. These are stored in the "ticks"
 * member of the bgraph instance. Used later by the 
 * {@link bgraph~redrawXTicks redrawXTicks()} function for rendering. */
function computeXTicks() {
  let xr = xSc.domain()

  // The following make sure that the initial element of the tick values array
  // is at the proper boundary (day, month, year) depending on the tick types.
  let xt  = xr.map(e => e.getTime()/SMS)
  let xtm = xt.slice(); xtm[0] = bu.monthsnap(xtm[0])
  let xty = xt.slice(); xty[0] = bu.yearsnap(xty[0])
  let xrm = xtm.map(e => (new Date(e*SMS)))
  let xry = xty.map(e => (new Date(e*SMS)))

  // [0]: tick dates, [1]: tick text,
  ticks = []
  ticks.push([d3.utcDay .range(xr[0],   xr[1], 1),"%b %d"])
  ticks.push([d3.utcDay .range(xr[0],   xr[1], 2),"%b %d"])
  ticks.push([d3.utcWeek.range(xrm[0], xrm[1], 1),"%b %d"])
  ticks.push([d3.utcWeek.range(xrm[0], xrm[1], 2),"%b %d"])
  ticks.push([d3.utcMonth.every(1).range(xry[0], xry[1]),"%b %Y"])
  ticks.push([d3.utcMonth.every(2).range(xry[0], xry[1]),"%b %Y"])
  ticks.push([d3.utcMonth.every(3).range(xry[0], xry[1]),"%Y"])
  ticks.push([d3.utcYear .every(1).range(xry[0], xry[1]),"%Y"])
}

/** Redraw x-axis tick marks based on current x-axis range for the focus graph,
 * making "smart" decisions on what type of ticks to use. Tick mark types are
 * precomputed and stored in the "ticks" member by the 
 * {@link bgraph~computeXTicks computeXTicks()} function. */
function redrawXTicks() {
  //console.debug("redrawXTicks()");
  var xr = [nXSc.invert(0).getTime(), 
            nXSc.invert(plotbox.width).getTime()]

  var diff = ((xr[1] - xr[0])/(SMS*SID))
  // Adjust tick mark separation if the graph is too small
  if (opts.focusRect.width < 500) diff = diff*1.6
  else if (opts.focusRect.width < 550) diff = diff*1.4
  else if (opts.focusRect.width < 600) diff = diff*1.2
  // * tickType identifies the separation and text of ticks
  // * majorSkip is the number of ticks to skip for the annotated
  // "major" ticks. Remaining ticks are drawn as unlabeled small
  // indicators
  if (diff < 10)           { tickType = 0; majorSkip = 1 }
  else if (diff < 20)      { tickType = 0; majorSkip = 2 }
  else if (diff < 45)      { tickType = 0; majorSkip = 7 }
  else if (diff < 120)     { tickType = 1; majorSkip = 7 }
  else if (diff < 240)     { tickType = 2; majorSkip = 4 }
  else if (diff < 320)     { tickType = 4; majorSkip = 1 }
  else if (diff < 1.5*365) { tickType = 4; majorSkip = 2 } 
  else if (diff < 2.6*365) { tickType = 4; majorSkip = 3 } 
  else if (diff < 5*365)   { tickType = 5; majorSkip = 3 } 
  else if (diff < 10*365)  { tickType = 6; majorSkip = 4 } 
  else                     { tickType = 7; majorSkip = 1 }
  // Invisible ticks to the left of the graph
  var pt = ticks[tickType][0].filter((d)=>((d.getTime()<xr[0])))
  // Number of minor ticks in the partially visible 1st major tick interval
  var ind = (majorSkip - pt.length%majorSkip)%majorSkip
  // Filter tick values based on x axis range
  var tv = ticks[tickType][0].filter(
    (d)=>((d.getTime()>=xr[0]&&d.getTime()<=xr[1])))
  xAxis.tickValues(tv)
    .tickSize(6)
    .tickSizeOuter(0)
    .tickFormat(
      (d,i)=>d3.utcFormat((i%majorSkip==ind)?ticks[tickType][1]:"")(d))
  xAxisObj.call(xAxis.scale(nXSc));
  xAxisObj.selectAll("g").classed("minor", false)
  xAxisObj.selectAll("g")
    .filter((d, i)=>(i%majorSkip!=ind))
    .classed("minor", true)

  // Shift bottom tick marks upwards to ensure they point inwards
  xAxisObj.selectAll("g").selectAll(".tick line")
    .attr("transform", "translate(0,-5)")
  
  // Repeat the above process for the top X axis
  xGrid.tickValues(tv).tickSize(plotbox.width);
  xGridObj.call(xGrid.scale(nXSc));
  xGridObj.selectAll("g").classed("minor", false);
  xGridObj.selectAll("g")
    .filter( (d, i)=>(i%majorSkip!=ind))
    .classed("minor", true);
  xAxisT.tickValues(tv)
    .tickSize(6)
    .tickSizeOuter(0)
    .tickFormat(
      (d,i)=>d3.utcFormat((i%majorSkip==ind)?ticks[tickType][1]:"")(d))
  xAxisObjT.call(xAxisT.scale(nXSc));
  xAxisObjT.selectAll("g").classed("minor", false)
  xAxisObjT.selectAll("g")
    .filter((d, i)=>(i%majorSkip!=ind))
    .classed("minor", true)
  
  // Shift top tick marks downwards to ensure they point inwards
  xAxisObjT.selectAll("g").selectAll(".tick line")
    .attr("transform", "translate(0,6)")
}

/** Check the widths of y-axis labels and tick marks, resizing the graph
 * components if necessary */
function handleYAxisWidth() {
  //console.debug("curid="+curid+", hidden="+hidden)

  // Checking for the "hidden" state ensures that getBBox() is not
  // called for invisible components in the DOM.
  if (opts.divGraph != null && !hidden) {
    yAxisLabel.text(gol.yaxis)
    if (gol.hidey && !opts.roadEditor) {
      //yAxisObj.selectAll( "text").remove()
      //yAxisObjR.selectAll("text").remove()
      yAxisObj.selectAll( "text").attr('display', 'none')
      yAxisObjR.selectAll("text").attr('display', 'none')
    } else {
      yAxisObj.selectAll( "text").attr('display', null)
      yAxisObjR.selectAll("text").attr('display', null)
    }
    
    var bbox = yAxisObj.node().getBBox()
    // Adjust the graph size and axes if the y axis tick
    // width has changed by a nontrivial amount. This
    // causes a bit jumpy behavior when dragging the brush
    // across the boundary of width change, but that seems
    // to not be too bad a problem.
    if (abs(bbox.width-yaxisw) > 5) {
      yaxisw = floor(bbox.width)
      resizeGraph()
    }
  }
}

/** Adjust scale and range for y-axis based on current range of the y-axis. The
 * y-axis range depends on the graph configuration, including whether it's a
 * headless graph for a screenshot, an interactive graph, or the editor. */
function adjustYScale() {
  var xrange = [nXSc.invert(0), 
                nXSc.invert(plotbox.width)]
  let yrange
  if (opts.headless) {
    // Headless graphs should match previous pybrain range
    let va = gol.vmin  - PRAF*(gol.vmax-gol.vmin)
    let vb = gol.vmax  + PRAF*(gol.vmax-gol.vmin)
    yrange = [vb, va]
  } else {
    var margin = abs(PRAF*(gol.vmax-gol.vmin))

    // Compute range in unixtime
    var xtimes = xrange.map(d => floor(d.getTime()/SMS))
    // Compute Y axis extent of the edited road in range
    var re = roadExtentPartial(road,xtimes[0],xtimes[1],false)
    re.yMin -= margin
    re.yMax += margin
    let ae
    if (opts.roadEditor) {
      // Compute Y axis extent of the initial road in range
      var ore = roadExtentPartial(iroad,xtimes[0],xtimes[1],false)
      ore.yMin -= margin
      ore.yMax += margin
      ae = mergeExtents(re, ore)
    } else ae = re
    
    // Compute Y axis extent of datapoints in range
    var de = dataExtentPartial((gol.plotall&&!opts.roadEditor)
                                ? alldata : data,
                                xtimes[0],xtimes[1],false)
    if (de != null) ae = mergeExtents(ae, de)
    let p
    if (opts.roadEditor) p = { xmin:0.0, xmax:0.0, ymin:0.05, ymax:0.05 }
    else                 p = { xmin:0.0, xmax:0.0, ymin:0.02, ymax:0.02 }
    enlargeExtent(ae, p)
    if ((ae.yMax - ae.yMin) < 2*margin) {
      ae.yMax += margin
      ae.yMin -= margin
    }
    yrange = [ae.yMax, ae.yMin]
  }
  // Modify the scale object for the entire Y range to focus on
  // the desired range
  var newtr = d3.zoomIdentity
        .scale(plotbox.height/(ySc(yrange[1])-ySc(yrange[0])))
        .translate(0, -ySc(yrange[0]))
  nYSc = newtr.rescaleY(ySc)
  yAxisObj.call(yAxis.scale(nYSc))
  yAxisObjR.call(yAxisR.scale(nYSc))

  // Resize brush if dynamic y limits are beyond graph limits
  if (yrange[0] > gol.yMax) gol.yMax = yrange[0]
  if (yrange[1] < gol.yMin) gol.yMin = yrange[1]
  resizeContext()

  // Rescale the focus rectange to show area being focused.
  var sx = xrange.map( x => xScB(x))
  var sy = yrange.map( y => yScB(y))
  focusrect
    .attr("x", sx[0]+1).attr("width",  max(0, sx[1]-sx[0]-2))
    .attr("y", sy[0]+1).attr("height", max(0, sy[1]-sy[0]-2))
}

/** Update context graph X and Y axis scales to consider newest graph ranges */
function resizeContext() {
  if (opts.divGraph == null) return
  xScB.domain([new Date(min(gol.tmin, gol.xMin)*SMS), 
               new Date(max(gol.tmax, gol.xMax)*SMS)])
  xAxisObjB.call(xAxisB.scale(xScB))
  yScB.domain([gol.yMin, gol.yMax])
}

/** Update brush rectangle and brush box in the context graph to cover the
 * updated X range */
function resizeBrush() {
  if (opts.divGraph == null) return
  var limits = [xScB(nXSc.invert(0)), 
                xScB(nXSc.invert(plotbox.width))]
  //console.debug("limits: "+limits);
  if (limits[0] < 0) limits[0] = 0
  if (limits[1] > brushbox.width) limits[1] = brushbox.width
  brush.call(brushObj.move, limits)
}

/** Update context graph by recomputing its limits & resizing the brush in it */
function reloadBrush() { resizeContext(); resizeBrush() }

/** Gets called by d3.zoom when there has been a zoom event
 * associated with the focus graph */
function zoomed() {
  //console.debug("id="+curid+", zoomed()")
  //console.trace()
  if (road.length == 0) return
  // Prevent recursive calls if this was initiated by a brush motion, resulting
  // in an updated zoom in the focus graph
  if (d3.event && d3.event.sourceEvent 
               && d3.event.sourceEvent.type === "brush") return

  // Inject the current transform into the plot element
  var tr = d3.zoomTransform(zoomarea.node())
  if (tr == null) return
  
  nXSc = tr.rescaleX(xSc)
  redrawXTicks()
  adjustYScale()
  // Shift Y axis tick marks to make them point inwards
  yAxisObj.selectAll("g").selectAll(".tick line")
    .attr("transform", "translate(6,0)")
  yAxisObjR.selectAll("g").selectAll(".tick line")
    .attr("transform", "translate(-5,0)")
  handleYAxisWidth()

  resizeBrush()
  updateGraphData()
  return
}

/** Called by d3.brush whenever user modifies the brush on the context graph */
function brushed() {
  //console.debug("id="+curid+", brushed()")
  //console.trace()
  if (road.length == 0) return
  // Prevent recursive calls in case the change in the brush was triggered by a
  // zoom event
  if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return
  var s = d3.event.selection || xScB.range()
  
  nXSc.domain(s.map(xScB.invert, xScB))
  redrawXTicks()
  adjustYScale()
  handleYAxisWidth()
  
  zoomarea.call(axisZoom.transform, d3.zoomIdentity
                .scale(brushbox.width / (s[1] - s[0]))
                .translate(-s[0], 0))
  updateGraphData()
}

/** Update both the context and focus graphs to include default zoom range */
function zoomDefault() {
  if (opts.divGraph == null) return
  //console.debug("id="+curid+", zoomDefault()")
  var ta = gol.tmin - PRAF*(gol.tmax-gol.tmin)
  var tb = gol.tmax + PRAF*(gol.tmax-gol.tmin)
  var newdom = [new Date(ta*SMS),new Date(tb*SMS)]
  nXSc.domain(newdom)
  var s = newdom.map(xScB)
  //console.debug(s)
  redrawXTicks()
  adjustYScale()
  zoomarea.call(axisZoom.transform, d3.zoomIdentity
                .scale(brushbox.width / (s[1] - s[0]))
                .translate(-s[0], 0))
}

/** Update both the context and focus graphs to zoom out, including the entire
 * graph range */
function zoomAll( ) {
  //console.debug("id="+curid+", zoomAll()")
  if (opts.divGraph == null) return
  computePlotLimits(false)
  // Redefine the unzoomed X and Y scales in case graph range was redefined
  xSc.domain([new Date(min(gol.tmin, gol.xMin)*SMS), 
              new Date(max(gol.tmax, gol.xMax)*SMS)])
  computeXTicks()
  ySc.domain([gol.yMin, gol.yMax])
  nXSc = xSc
  nYSc = ySc
  resizeContext()
  zoomarea.call(axisZoom.transform, d3.zoomIdentity)
  // Relocate zoom buttons based on road yaw
  if (gol.dir > 0) {
    zoomin.attr( "transform", zoombtntr.botin)
    zoomout.attr("transform", zoombtntr.botout)
  } else {
    zoomin.attr( "transform", zoombtntr.topin)
    zoomout.attr("transform", zoombtntr.topout)
  }
  reloadBrush()
}

// -------------------------- Undo/Redo functionality --------------------------

function clearUndoBuffer() {
  //console.debug("clearUndoBuffer()")
  undoBuffer = []
  redoBuffer = []
}

function redoLastEdit() {
  //console.debug("redoLastEdit: UndoBuffer has "+undoBuffer.length+" entries")
  if (redoBuffer.length == 0) return
  pushUndoState(true)
  road = redoBuffer.pop()
  roadChanged()
  return
}

function undoLastEdit() {
  //console.debug("undoLastEdit: UndoBuffer has "+undoBuffer.length+" entries")
  if (undoBuffer.length == 0) return
  if (undoBuffer.length == 0 || 
      !br.sameRoads(undoBuffer[undoBuffer.length-1], road)) {
    redoBuffer.push(road)
  }
  road = undoBuffer.pop()
  bbr.setRoadObj(road) // Since popped version is a copy, must inform beebrain
  roadChanged()
  return
}

function pushUndoState(fromredo = false) {
  //console.debug("pushUndoState: UndoBuffer has "+undoBuffer.length+" entries")
  if (undoBuffer.length == 0 || 
      !br.sameRoads(undoBuffer[undoBuffer.length-1], road)) {
    undoBuffer.push(br.copyRoad(road))
    if (!fromredo) { redoBuffer = [] }
  }
}

// Determine whether given road is valid (ie, clear of the pinkzone)
// TODO: Must rethink this check, probably a general segment intersection
// algorithm will be best
function isRoadValid(rd) {
  var ir = iroad
  const EPS = 0.000001 // dang floating point comparisons
  
  var now = gol.asof
  var hor = gol.horizon
  // Check left/right boundaries of the pinkzone. This should handle the case
  // when there are no kinks within the horizon.
  if (gol.yaw*br.rdf(rd, now) < gol.yaw*br.rdf(ir, now) - EPS) return false
  if (gol.yaw*br.rdf(rd, hor) < gol.yaw*br.rdf(ir, hor) - EPS) return false
  // Iterate through and check current road points in the pink range
  var rd_i1 = br.findSeg(rd, now) // was dir=-1 but don't think it matters
  var rd_i2 = br.findSeg(rd, hor) // was dir=+1 but don't think it matters
  for (let i = rd_i1; i < rd_i2; i++) {
    if (gol.yaw*br.rdf(rd, rd[i].end[0]) < 
        gol.yaw*br.rdf(ir, rd[i].end[0]) - EPS) return false
  }
  // Iterate through and check old road points in the pink range
  var ir_i1 = br.findSeg(ir, now) // was dir=-1 but don't think it matters
  var ir_i2 = br.findSeg(ir, hor) // was dir=+1 but don't think it matters
  for (let i = ir_i1; i < ir_i2; i++) {
    if (gol.yaw*br.rdf(rd, ir[i].end[0]) < 
        gol.yaw*br.rdf(ir, ir[i].end[0]) - EPS) return false
  }
  return true
}


function mergeExtents(ext1, ext2) {
  let ne = {}
  ne.xMin = min(ext1.xMin, ext2.xMin)
  ne.xMax = max(ext1.xMax, ext2.xMax)
  ne.yMin = min(ext1.yMin, ext2.yMin)
  ne.yMax = max(ext1.yMax, ext2.yMax)
  return ne
}

function enlargeExtent(extent, p) {
  var xdiff = extent.xMax - extent.xMin
  if (xdiff < 1e-7) xdiff = 1e-7
  var ydiff = extent.yMax - extent.yMin
  if (ydiff < 1e-7) ydiff = 1e-7

  extent.xMin = extent.xMin - p.xmin*xdiff
  extent.xMax = extent.xMax + p.xmax*xdiff
  extent.yMin = extent.yMin - p.ymin*ydiff
  extent.yMax = extent.yMax + p.ymax*ydiff
}

function roadExtent(rd, extend = true) {
  var extent = {}
  // Compute new limits for the current data
  extent.xMin = bu.arrMin(rd.map(d=>d.end[0]))
  extent.xMax = bu.arrMax(rd.map(d=>d.sta[0]))
  extent.yMin = bu.arrMin(rd.map(d=>d.sta[1]))
  extent.yMax = bu.arrMax(rd.map(d=>d.sta[1]))
  // Extend limits by 5% so everything is visible
  var p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10}
  if (extend) enlargeExtent(extent, p)
  return extent
}

function dataExtentPartial(data, xmin, xmax, extend = false) {
  var extent = {}
  var nd = data.filter(d => (d[0] > xmin && d[0] < xmax))
  if (nd.length == 0) {
    // no points are in range, find enclosing two
    var ind = -1
    for (let i = 0; i < data.length-1; i++) {
      if (data[i][0]<=xmin && data[i+1][0]>=xmax) { ind = i; break }
    }
    if (ind > 0) nd = data.slice(ind, ind+1)
  }
  // Inform caller if no data points are in between the supplied range.
  if (nd.length == 0) return null

  // Compute new limits for the current data
  extent.xMin = bu.arrMin(nd.map(d=>d[0]))
  extent.xMax = bu.arrMax(nd.map(d=>d[0]))
  extent.yMin = bu.arrMin(nd.map(d=>d[1]))
  extent.yMax = bu.arrMax(nd.map(d=>d[1]))     
  if (bbr.flad != null && bbr.flad[0] <= xmax && bbr.flad[0] >= xmin) {
    const pprv = bbr.flad[1] + br.ppr(road, gol, gol.asof)
    extent.yMin = min(extent.yMin, pprv) // Make room for the
    extent.yMax = max(extent.yMax, pprv) // ghosty PPR datapoint.
  }
  // Extend limits by 5% so everything is visible
  var p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10}
  if (extend) enlargeExtent(extent, p)
  return extent
}

function roadExtentPartial( rd, xmin, xmax, extend = false ) {
  var extent = {}
  // Compute new limits for the current data
  extent.xMin = xmin
  extent.xMax = xmax
  extent.yMin = bu.arrMin(rd.map(function(d) { 
    return (d.sta[0]<xmin||d.sta[0]>xmax)?Infinity:d.sta[1] }))
  extent.yMax = bu.arrMax(rd.map(function(d) { 
    return (d.sta[0]<xmin||d.sta[0]>xmax)?-Infinity:d.sta[1] }))
  extent.yMin = bu.arrMin([extent.yMin, br.rdf(rd,xmin), br.rdf(rd,xmax)])
  extent.yMax = bu.arrMax([extent.yMax, br.rdf(rd,xmin), br.rdf(rd,xmax)])
  // Extend limits by 5% so everything is visible
  var p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10}
  if (extend) enlargeExtent(extent, p)
  return extent
}

// Convert deadline value (seconds from midnight) to time-of-day like "3am"
function deadtod(ds) {
  return moment.unix(ds).utc().format("h:mma").replace(":00","")
}

// Convert tluz to the day of the week (eg, "Wed") of the eep day
function deaddow(t) {
  return moment.unix(t).utc().format("ddd")
}

// Set watermark (waterbuf) to number of safe days if not given explicitly
function setWatermark() {
  if (gol.waterbuf0 != null) return
  
  gol.safebuf = br.dtd(road, gol, gol.tcur, gol.vcur)
  gol.tluz = gol.tcur+gol.safebuf*SID
  if (gol.tfin < gol.tluz) gol.tluz = bu.BDUSK
  gol.loser = br.redyest(road, gol, gol.tcur) // TODO: needs iso here

  if  (gol.asof >= gol.tfin && !gol.loser) {
    gol.waterbuf = ":)"
    return
  }

  if      (gol.safebuf > 999) { gol.waterbuf = "inf" } 
  else if (gol.safebuf >= 7)  { gol.waterbuf = gol.safebuf+"d" } 
  else if (gol.safebuf <= 0)  { gol.waterbuf = deadtod(gol.deadline)+"!" }
  else                        { gol.waterbuf = deaddow(gol.tluz) }
}

function computePlotLimits(adjustZoom = true) {
  if (road.length == 0) return

  var now = gol.asof
  var maxx = bu.daysnap(min(now+opts.maxFutureDays*SID, 
                                 road[road.length-1].sta[0]))
  let cur = roadExtentPartial(road, road[0].end[0], maxx, false)
  let ne
  if (opts.roadEditor) {
    let old = roadExtentPartial(iroad,road[0].end[0],maxx,false)
    ne = mergeExtents(cur, old)
  } else ne = cur

  var d = dataExtentPartial(gol.plotall&&!opts.roadEditor ? alldata : data, 
                            road[0].end[0], data[data.length-1][0], false)

  if (d != null) ne = mergeExtents(ne, d)
  if (bbr.fuda.length != 0) {
    var df = dataExtentPartial(bbr.fuda, road[0].end[0], maxx, false)
    if (df != null) ne = mergeExtents(ne, df)
  }
  var p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10}
  if (!opts.roadEditor) {
    // The editor needs more of the time range visible for editing purposes
    p.xmin = 0.02
    p.xmax = 0.02
  }
  enlargeExtent(ne, p)

  gol.xMin = bu.daysnap(ne.xMin)
  gol.xMax = bu.daysnap(ne.xMax)
  gol.yMin = ne.yMin
  gol.yMax = ne.yMax

  if (adjustZoom && opts.divGraph != null) {
    var xrange = [nXSc.invert(0), 
                  nXSc.invert(plotbox.width)]
    var yrange = [nYSc.invert(0), 
                  nYSc.invert(plotbox.height)]
    xSc.domain([new Date(min(gol.tmin, gol.xMin)*SMS), 
                new Date(max(gol.tmax, gol.xMax)*SMS)])
    computeXTicks()
    ySc.domain([gol.yMin, gol.yMax])
    var newtr = d3.zoomIdentity.scale(plotbox.width/(xSc(xrange[1]) 
                                                   - xSc(xrange[0])))
        .translate(-xSc(xrange[0]), 0)
    zoomarea.call(axisZoom.transform, newtr)
  }
}

// Function to generate samples for the Butterworth filter
function griddlefilt(a, b) {
  return bu.linspace(a, b, floor(bu.clip((b-a)/(SID+1), 40, 2000)))
}

// Function to generate samples for the Butterworth filter
function griddle(a, b, maxcnt = 6000) {
  return bu.linspace(a, b, floor(bu.clip((b-a)/(SID+1), 
                                      min(300, plotbox.width/8),
                                      maxcnt)))
}

const stats_timeid = `bgraph(${curid}): Goal stats`
const graph_timeid = `bgraph(${curid}): Goal graph`
// Recreates the road array from the "rawknots" array, which includes only
// timestamp,value pairs

/**Load goal details from the supplied JSON input and populate the graph and
   road matrix table with necessary components based on initially supplied
   options.
   @param {Object} json JSON object with the contents of a BB file, directly fed
   to a {@link beebrain} object instance. */
function loadGoal(json, timing = true) {
  //console.debug("id="+curid+", loadGoal()->"+json.params.yoog)
  if (!('params' in json) || !('data' in json)) {
    throw new Error("loadGoal: JSON input lacks params or data")
  }
  clearUndoBuffer()

  // Disable various graph component updates until graph axes are in
  // their final state and ranges
  processing = true
  
  // Create beebrain processor
  let suffix = (json.params.yoog) ? " ("+json.params.yoog+")" : ""
  if (timing) { console.time(stats_timeid+suffix) }
  bbr = new bb(json)
  gol = bbr.gol
  if (opts.divJSON) {
    if (opts.headless)
      opts.divJSON.innerText = JSON.stringify(bbr.getStats())
    else
      opts.divJSON.innerText = JSON.stringify(bbr.getStats(), null, 4)
  }
  if (timing) { console.timeEnd(stats_timeid+suffix) }

  if (gol.error != "") {
    console.log("Beebrain error: "+ bbr.gol.error)
    lastError = ErrType.BBERROR
    var errors = bbr.gol.error.split("\\n")
    showOverlay( 
      (["The following errors prevented us from generating "+bbr.gol.yoog,
        "(We've pinged Beeminder support to come help fix things up here!)",
        ""]).concat(errors), sh/30, null)
    resetGoal()
    processing = false
    return
  }

  if (opts.noGraph) {
    showOverlay( (["Beebrain was called with 'NOGRAPH_*' as the slug",
                   "so no graph or thumbnail was generated, just this",
                   "static placeholder!"]), sh/30, null)
    resetGoal()
    processing = false
    return
  }
  
  road    = bbr.roads
  iroad   = br.copyRoad(road)
  data    = bbr.data
  rawdata = bu.deepcopy(json.data)
  igoal   = bu.deepcopy(gol)
  alldata = bbr.alldata

  // Extract limited data
  if (opts.maxDataDays < 0) {
    dataf = data.slice()
    alldataf = alldata.slice()
  } else {
    dataf = data.filter(function(e){
      return e[0]>(gol.asof-opts.maxDataDays*SID)})
    alldataf = alldata.filter(function(e){
      return e[0]>(gol.asof-opts.maxDataDays*SID)})
  }

  if (opts.divGraph) {
    if (!opts.roadEditor && gol.stathead)
      stathead.text(gol.graphsum)
    else
      stathead.text("")
  }
  if (timing) { console.time(graph_timeid+suffix) }
  
  // Finally, wrap up with graph related initialization
  updateRoadData()
  zoomAll()
  zoomDefault()

  // Re-enable updates for graph components. Next call to resizeGraph will
  // redraw all of these components
  processing = false

  updateTable()
  updateDueBy()
  resetDataTable()

  updateContextData()

  // This next call ensures that stathead and other new graph
  // properties are properly reflected in the new graph dimensions
  resizeGraph()
    
  updateTableTitles()
  if (typeof opts.onRoadChange === 'function') opts.onRoadChange.call()
  if (timing) { console.timeEnd(graph_timeid+suffix) }
}

async function loadGoalFromURL( url, callback = null ) {
  //console.debug( "loadGoalFromURL: Loading: "+url );
  if (url == "" || loading) return
  loading = true
  if (!opts.headless) showOverlay( ["loading..."], sh/10 )
  var resp = await bu.loadJSON( url )
  if (resp != null) {
    if (!opts.headless) removeOverlay()
    if ('errstring' in resp) {
      throw new Error("loadGoalFromURL: BB file has errors: "+resp.errstring)
    }
    loadGoal( resp )
  } else {
    if (lastError != null) showOverlay( [ErrMsgs[lastError]])
    else showOverlay(["Could not load goal file."])
    if (!opts.headless) setTimeout(removeOverlay, 1500)
    if (typeof opts.onError === 'function') {
      opts.onError.call()
    }
  } 
  loading = false
}

function setSafeDays( days ) {
  if (road.length == 0) {
    console.log("bgraph("+curid+"):setSafeDays(), road is empty!")
    return
  }
  //console.debug("setSafeDays()");
  var curdtd = br.dtd(road, gol, gol.tcur, gol.vcur)
  var now = gol.asof
  if (days < 0) days = 0
  // Look into the future to see the road value to ratchet to
  var daydiff = curdtd - (days - 1) - 1
  if (daydiff <= 0) return
  var futureDate = gol.asof + daydiff*SID
  var ratchetValue = br.rdf(road, futureDate)

  // Find or add two new dots at asof
  // We only allow the first step to record undo info.
  var first = -1, i
  for (i = 1; i < road.length; i++) {
    if (road[i].sta[0] === now) {
      first = i-1; break
    }
  }
  var added = false;
  if (first < 0) {addNewDot(now);added = true}
  var second
  if (i+1 < road.length && road[i+1].sta[0] === now)
    second = i
  else {
    second = addNewDot(now, ratchetValue)
    if (added) {undoBuffer.pop(); added = true}
  }
  //changeDotValue( second, ratchetValue, false )
  //if (added) { undoBuffer.pop(); added = true }

  roadChanged()
}

// Add a new dot to the supplied x value, with the y value either explicitly
// specified or computed from the corresponding y value.
function addNewDot(x, y = null) {
  var found = br.findSeg(road, x)
  if (found >= 0) {
    var s = {}
    var newx = bu.daysnap(x+SID/2)
    var newy = y
    if (y == null) {
      newy = road[found].sta[1] + road[found].slope*(newx - road[found].sta[0])
    }
    pushUndoState()
    s.sta = [newx, newy]
    if (found == 0) {
      // First segment splitted
      s.end = road[found+1].sta.slice()
      if (y != null) {
        s.end[1] = s.sta[1] + road[found].slope*(s.end[0]-newx)
      }
      road[found].end = [newx, newy]
    } else {
      if (found == road.length-1) {
        // Last segment splitted
        s.end = road[found].end.slice()
        s.end[1] = newy
      } else {
        s.end = road[found+1].sta.slice()
        if (y != null && opts.keepSlopes) {
          s.end[1] = s.sta[1] + road[found].slope*(s.end[0]-newx)
        }
      }
      road[found].end = [newx, newy];
      road[found].slope = br.segSlope(road[found]);
      // If the adjusted segment is vertical, switch its auto field to SLOPE
      if (road[found].sta[0] == road[found].end[0])
        road[found].auto = br.RP.SLOPE
    }
    s.slope = br.segSlope(s)
    s.auto  = br.RP.VALUE
    road.splice(found+1, 0, s)
    br.fixRoadArray(road, opts.keepSlopes ? br.RP.VALUE : br.RP.SLOPE, false)
    roadChanged()
    let elt = d3.select(opts.divTable).select(".roadrow [name=endvalue"+(found+1)+"]")
    if (!elt.empty()) autoScroll(elt, false)
  }
  return found;
}

function addNewKnot(kind) {
  if (kind < road.length-1) {
    var newt = (road[kind].sta[0] + road[kind+1].sta[0])/2
    if (newt - road[kind].sta[0] > 30*SID) newt = road[kind].sta[0]+30*SID
    addNewDot(newt)
  } else {
    addNewDot(road[kind].sta[0] + 7*SID)
  }
}

function removeKnot(kind, fromtable) {
  pushUndoState()

  var oldslope = road[kind].slope
  road.splice(kind, 1)
  if (opts.keepSlopes && !isNaN(oldslope)) road[kind].slope = oldslope
  br.fixRoadArray(road, opts.keepSlopes ? br.RP.VALUE : br.RP.SLOPE, fromtable)

  roadChanged()
}

// ---------------------- Drag related utility functions -----------------------

var knottext = null, dottext = null, slopetext = null

function createDragInfo(pt, slope = undefined) {
  var ptx = nXSc(bu.daysnap(pt[0])*SMS)
  var pty = pt[1]
  knotdate = moment.unix(pt[0]).utc()
  knottext = createTextBox(ptx, plotbox.height-15, 
                           knotdate.format('YYYY-MM-DD')
                           + " ("+knotdate.format("ddd")+")",
                           opts.textBoxCol.stroke)
  dottext = createTextBox(ptx, nYSc(pty)-15, 
                          bu.shn(pt[1]), opts.textBoxCol.stroke)
  if (slope != undefined) {
    var slopex = nXSc(bu.daysnap(slope[0])*SMS)
    var slopey = nYSc(slope[1])
    slopetext = createTextBox(slopex,slopey, 
                              "s:"+bu.shn(slope[2]),
                              opts.textBoxCol.stroke)
    if (ptx - slopex < 50) hideTextBox(slopetext, true)
  }
}
function updateDragInfo(pt, slope) {
  var ptx = bu.daysnap(pt[0])
  var pty = pt[1]
  knotdate = moment.unix(ptx).utc()
  updateTextBox(knottext, nXSc(ptx*SMS), plotbox.height-15, 
                knotdate.format('YYYY-MM-DD') + " ("+knotdate.format("ddd")+")")
  updateTextBox(dottext, nXSc(ptx*SMS), nYSc(pty)-15, bu.shn(pt[1]))
  if (slope != undefined) {
    var slopex = bu.daysnap(slope[0])
    var slopey = slope[1]
    updateTextBox(slopetext, nXSc(slopex*SMS), nYSc(slopey), 
                  "s:"+bu.shn(slope[2]))
  }
}
function removeDragInfo( ) {
  if (knottext != null) rmTextBox(knottext)
  knottext = null
  if (dottext != null) rmTextBox(dottext)
  dottext = null
  if (slopetext != null) rmTextBox(slopetext)
  slopetext = null
}

function updateDragPositions(kind, updateKnots) {
  var rd = road
  var el = d3.select(opts.divGraph)
  for (let ii = kind; ii < rd.length; ii++) {
    el.select("[name=dot"    +ii+"]").attr("cx", r1(nXSc(rd[ii].end[0]*SMS)))
                                     .attr("cy", r1(nYSc(rd[ii].end[1])))
    el.select("[name=ctxdot" +ii+"]").attr("cx", r1(xScB(rd[ii].end[0]*SMS)))
                                     .attr("cy", r1(yScB(rd[ii].end[1])))
    el.select("[name=road"   +ii+"]").attr("x1", r1(nXSc(rd[ii].sta[0]*SMS)))
                                     .attr("y1", r1(nYSc(rd[ii].sta[1])))
                                     .attr("x2", r1(nXSc(rd[ii].end[0]*SMS)))
                                     .attr("y2", r1(nYSc(rd[ii].end[1])))
    el.select("[name=ctxroad"+ii+"]").attr("x1", r1(xScB(rd[ii].sta[0]*SMS)))
                                     .attr("y1", r1(yScB(rd[ii].sta[1])))
                                     .attr("x2", r1(xScB(rd[ii].end[0]*SMS)))
                                     .attr("y2", r1(yScB(rd[ii].end[1])))
    if (updateKnots) {
      el.select("[name=knot" +ii+"]").attr("x1", r1(nXSc(rd[ii].end[0]*SMS)))
                                     .attr("x2", r1(nXSc(rd[ii].end[0]*SMS)))
      el.select("[name=remove"+ii+"]")
        .attr("transform", 
              d => ("translate("+(nXSc(d.end[0]*SMS)+plotpad.left-8)
                    +","+(plotpad.top-20)+") scale(0.6,0.6)"))
    }
    el.select("[name=enddate" +ii+"]").text(bu.dayify(rd[ii].end[0], '-'))
    el.select("[name=endvalue"+ii+"]").text(bu.shn(rd[ii].end[1]))
    el.select("[name=slope"   +ii+"]").text(bu.shn(rd[ii].slope*gol.siru))
  }

  if (opts.tableUpdateOnDrag) updateTableValues()
  if (opts.duebyUpdateOnDrag) updateDueBy()
  updateRoadData()
  updateRoadValidity()
  updateWatermark()
  updateBullseye()
  updateContextBullseye()
  updateDataPoints()
  updateMovingAv()
  updateYBHP()
  updateGuidelines()
  updatePinkRegion()
  updateMaxFluxline()
  updateStdFluxline()
}

// --------------- Functions related to selection of components ----------------

var selection  = null
var selectType = null
var selectelt  = null

function selectKnot(kind, scroll = true) {
  if (opts.divGraph == null) return
  highlightDate( kind, true, scroll )
  selection = kind
  selectType = br.RP.DATE
  d3.select("[name=knot"+kind+"]").attr("stroke-width", r3(opts.roadKnot.width))
  var x = nXSc(road[kind].end[0]*SMS)
  selectelt = gKnots.append("svg:line")
    .attr("class",          "selectedknot")
    .attr("pointer-events", "none")
    .attr("x1",             x)
    .attr("x2",             x)
    .attr("y1",             0)
    .attr("y2",             plotbox.height)
    .attr("stroke",         opts.roadKnotCol.selected)
    .attr("stroke-opacity", 0.9)
    .attr("stroke-width",   r3(opts.roadKnot.width+4)).lower()
}
function unselectKnot(kind) {
  highlightDate(kind, false)
  d3.select("[name=knot"+kind+"]").attr("stroke",       opts.roadKnotCol.dflt)
                                  .attr("stroke-width", r3(opts.roadKnot.width))
}
function selectDot(kind, scroll=true) {
  if (opts.divGraph == null) return
  highlightValue(kind, true, scroll)
  selection = kind
  selectType = br.RP.VALUE
  d3.select("[name=dot"+kind+"]").attr("r", r3(opts.roadDot.size))
  selectelt = gDots.append("svg:circle")
    .attr("class",          "selecteddot")
    .attr("pointer-events", "none")
    .attr("cx",              r1(nXSc(road[kind].end[0]*SMS)))
    .attr("cy",              r1(nYSc(road[kind].end[1])))
    .attr("fill",            opts.roadDotCol.selected)
    .attr("fill-opacity",    0.6)
    .attr("r",               r3(opts.roadDot.size+4))
    .attr("stroke",          "none").lower()
}
function unselectDot(kind) {
  highlightValue(kind, false)
  d3.select("[name=dot"+kind+"]").attr("fill", opts.roadDotCol.editable)
                                 .attr("r",    r3(opts.roadDot.size))
}
function selectRoad(kind, scroll = true) {
  if (opts.divGraph == null) return
  highlightSlope(kind, true, scroll)
  selection = kind
  selectType = br.RP.SLOPE
  d3.select("[name=road"+kind+"]")
    .attr("shape-rendering", "geometricPrecision") // crispEdges
    .attr("stroke-width",    (opts.roadLine.width,3)) // ???????????????????????
  selectelt = gRoads.append("svg:line")
    .attr("class",           "selectedroad")
    .attr("shape-rendering", "geometricPrecision") // crispEdges
    .attr("pointer-events",  "none")
    .attr("x1",              nXSc(road[kind].sta[0]*SMS))
    .attr("x2",              nXSc(road[kind].end[0]*SMS))
    .attr("y1",              nYSc(road[kind].sta[1]))
    .attr("y2",              nYSc(road[kind].end[1]))
    .attr("stroke",          opts.roadKnotCol.selected)
    .attr("stroke-opacity",  0.9)
    .attr("stroke-width",    r3(opts.roadLine.width+4)).lower()
}
function unselectRoad(kind) {
  highlightSlope(kind, false)
  var lineColor = isRoadValid(road) ? opts.roadLineCol.valid 
                                    : opts.roadLineCol.invalid
  d3.select("[name=road"+kind+"]")
    .style("stroke",      lineColor)
    .attr("stroke-width", r3(opts.roadLine.width))
}
function unselect() {
  selection = null
  selectType = null
  if (selectelt != null) { selectelt.remove(); selectelt=null }
}
function clearSelection() {
  //console.debug("clearSelection()")
  if (selection == null) return
  if (selectType == br.RP.DATE) unselectKnot(selection)
  else if (selectType == br.RP.VALUE) unselectDot(selection)
  else if (selectType == br.RP.SLOPE) unselectRoad(selection)
  removeDragInfo()
  unselect()
}

// --------------------- Functions for manipulating knots ----------------------

var roadsave, knotind, knotdate, prevslopes

var editingKnot = false
function knotDragStarted(d,i) {
  d3.event.sourceEvent.stopPropagation()
  editingKnot = true
  pushUndoState()
  var kind = Number(this.id)
  roadsave = br.copyRoad(road)
  if (selection == null) {
    selectKnot(kind)
  } else if (selection != null 
             && selection == kind && selectType == br.RP.DATE) {
    clearSelection()
  } else {
    clearSelection()
    selectKnot(kind)
  }
  createDragInfo(d.end)
  knottext.grp.raise()
  // Store initial slopes to the left & right to prevent collapsed segment
  // issues
  prevslopes = []
  prevslopes[0] = road[kind].slope
  prevslopes[1] = road[kind+1].slope

}

function knotDragged(d,i) {
  unselect()
  // event coordinates are pre-scaled, so use normal scale
  var x = bu.daysnap(nXSc.invert(d3.event.x)/SMS)
  var kind = Number(this.id)
  var rd = road
  // Clip drag x between beginning of current segment and end of next segment
  if (x < rd[kind].sta[0])   x = rd[kind].sta[0]
  if (x > rd[kind+1].end[0]) x = rd[kind+1].end[0]

  // If keepIntervals is enabled, shift all future segments as well
  var maxind = kind+1
  if (opts.keepIntervals) maxind = rd.length
  for (let ii = kind; ii < maxind; ii++) {
    rd[ii].end[0] = x + roadsave[ii].end[0] 
                      - roadsave[kind].end[0]
  }
  if (isFinite(prevslopes[0]) && road[kind].sta[0] != road[kind].end[0]) {
    road[kind].slope = prevslopes[0]
  }
  if (isFinite(prevslopes[1]) && road[kind+1].sta[0] != road[kind+1].end[0]) {
    road[kind+1].slope = prevslopes[1]
  }
  br.fixRoadArray(rd, opts.keepSlopes ? br.RP.VALUE : br.RP.SLOPE,
                  false, br.RP.DATE)

  updateDragPositions(kind, true)
  updateDragInfo(d.end)
}
function knotDragEnded(d,i) {
  editingKnot = false

  if (selection == null) {
    unselectKnot(i)
    removeDragInfo()
    roadChanged()
  }
  roadsave = null
}

function knotDeleted(d) {
  var kind = Number(this.id)
  removeKnot(kind, false)
}

function changeKnotDate(kind, newDate, fromtable = true) {
  pushUndoState()

  var knotmin = (kind == 0) ? gol.xMin-10*SID*DIY 
                            : (road[kind].sta[0]) + 0.01
  var knotmax = (kind == road.length-1) ? road[kind].end[0]+0.01
                                        : road[kind+1].end[0]+0.01
  if (newDate <= knotmin) newDate = bu.daysnap(knotmin)
  if (newDate >= knotmax) newDate = bu.daysnap(knotmin)
  road[kind].end[0] = newDate
  if (!fromtable) {
    // TODO?
  }
  br.fixRoadArray(road, null, fromtable, br.RP.DATE)

  roadChanged()
}

function knotEdited(d, id) {
  var kind = Number(id)
  var el = d3.select(opts.divTable)
  if (road[kind].auto == br.RP.DATE) {
    if (opts.keepSlopes) disableValue(id)
    else disableSlope(id)
  }
  var cell = el.select('[name=enddate'+kind+']').node()
  cell.focus()
  var range, selection
  if (document.body.createTextRange) {
    range = document.body.createTextRange()
    range.moveToElementText(cell)
    range.select()
  } else if (window.getSelection) {
    selection = window.getSelection()
    range = document.createRange()
    range.selectNodeContents(cell)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

// ---------------------- Functions for manipulating dots ----------------------

var editingDot = false
function dotDragStarted(d, id) {
  d3.event.sourceEvent.stopPropagation()
  editingDot = true
  pushUndoState()
  roadsave = br.copyRoad(road)
  var kind = id
  if (selection == null) {
    selectDot(kind)
  } else if (selection != null 
             && selection == kind && selectType == br.RP.VALUE) {
    clearSelection()
  } else {
    clearSelection()
    selectDot(kind)
  }
  if (kind != 0) {
    var seg = road[kind]
    createDragInfo( d.sta, [(seg.sta[0]+seg.end[0])/2,
                            (seg.sta[1]+seg.end[1])/2,
                            seg.slope*gol.siru] )
  } else createDragInfo(d.sta)
  dottext.grp.raise()
};
function dotDragged(d, id) {
  unselect()
  var now = gol.asof
  var y = nYSc.invert(d3.event.y)
  var kind = id
  var rd = road
  var seg = road[kind]
  seg.end[1] = y
  seg.slope = br.segSlope(seg)
  br.fixRoadArray(rd, opts.keepSlopes ? br.RP.VALUE
                                      : br.RP.SLOPE,
                  false, br.RP.VALUE)

  var strt = (kind==0) ? 0 : (kind-1)
  updateDragPositions(strt, false)
  if (kind != 0) {
    updateDragInfo( d.sta, [(seg.sta[0]+seg.end[0])/2,
                            (seg.sta[1]+seg.end[1])/2,
                            seg.slope*gol.siru])
  } else updateDragInfo(d.sta)
};
function dotDragEnded(d,id){
  editingDot = false

  if (selection == null) {
    unselectDot(id)
    removeDragInfo()
    roadChanged()
  } 
  roadsave = null
}

function changeDotValue(kind, newValue, fromtable = false) {
  pushUndoState()

  road[kind].end[1] = newValue
  if (!fromtable) {
    if (!opts.keepSlopes) road[kind].slope = br.segSlope(road[kind])
    if (kind == 1) {
      road[kind-1].sta[1] = newValue
    } else if (kind == road.length-1) {
      road[kind].end[1] = newValue
      road[kind-1].slope = (road[kind].sta[1] - road[kind-1].sta[1])
                         / (road[kind].sta[0] - road[kind-1].sta[0])
    } else {
      road[kind-1].slope = (road[kind].sta[1] - road[kind-1].sta[1])
                         / (road[kind].sta[0] - road[kind-1].sta[0])
    }
  }

  br.fixRoadArray(road, opts.keepSlopes ? br.RP.VALUE : null,
                  fromtable, br.RP.VALUE)

  roadChanged()
}

function dotEdited(d, id) {
  var kind = Number(id)
  var el = d3.select(opts.divTable)
  if (road[kind].auto == br.RP.VALUE) { disableSlope(id) }
  var cell = el.select('[name=endvalue'+kind+']').node()
  cell.focus()
  var range, selection
  if (document.body.createTextRange) {
    range = document.body.createTextRange()
    range.moveToElementText(cell)
    range.select()
  } else if (window.getSelection) {
    selection = window.getSelection()
    range = document.createRange()
    range.selectNodeContents(cell)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

// ----------------- Functions for manipulating road segments ------------------

var editingRoad = false
var roadedit_x
function roadDragStarted(d, id) {
  //console.debug("roadDragStarted: "+id)
  d3.event.sourceEvent.stopPropagation()
  editingRoad = true
  roadedit_x = bu.daysnap(nXSc.invert(d3.event.x)/SMS)
  pushUndoState()
  roadsave = br.copyRoad(road)

  if (selection == null) {
    selectRoad(id)
  } else if (selection != null 
             && selection == id && selectType == br.RP.SLOPE) {
    clearSelection()
  } else {
    clearSelection()
    selectRoad(id)
  }
  var slopex = (d.sta[0]+d.end[0])/2
  if (slopex < nXSc.invert(0)/SMS) slopex = nXSc.invert(0)/SMS
  if (slopex > nXSc.invert(plotbox.width)/SMS - 10)
    slopex = nXSc.invert(plotbox.width)/SMS - 10
  createDragInfo(d.end, [slopex, d.sta[1]+d.slope*(slopex-d.sta[0]),
                         d.slope*gol.siru])
  slopetext.grp.raise()
};
function roadDragged(d, id) {
  //console.debug("roadDragged()")
  unselect()
  var now = gol.asof
  var x = bu.daysnap(nXSc.invert(d3.event.x)/SMS)
  var y = nYSc.invert(d3.event.y)
  var kind = id
  var rd = road

  road[kind].slope = ((y - d.sta[1])/max(x - d.sta[0], SID))
  road[kind].end[1] = road[kind].sta[1] + road[kind].slope*(road[kind].end[0] 
                                                          - road[kind].sta[0])
  road[kind+1].sta[1] = road[kind].end[1]
  if (!opts.keepSlopes) road[kind+1].slope = br.segSlope(road[kind+1])

  br.fixRoadArray(rd, br.RP.VALUE, false, br.RP.SLOPE)

  updateDragPositions(kind, true)
  var slopex = (d.sta[0]+d.end[0])/2
  if (slopex < nXSc.invert(0)/SMS) slopex = nXSc.invert(0)/SMS
  if (slopex > nXSc.invert(plotbox.width)/SMS - 10) 
    slopex = nXSc.invert(plotbox.width)/SMS - 10
  updateDragInfo(d.end, [slopex, d.sta[1]+d.slope*(slopex-d.sta[0]),
                         d.slope*gol.siru])
}
function roadDragEnded(d, id) {
  //console.debug("roadDragEnded()")
  editingRoad = false

  if (selection == null) {
    unselectRoad(id)
    removeDragInfo()
    roadChanged()
  }
  roadsave = null
}

function changeRoadSlope(kind, newSlope, fromtable = false) {
  if (kind == road.length-1) return
  pushUndoState()

  road[kind].slope = newSlope/(gol.siru)
  if (!fromtable) {
    if (!opts.keepSlopes) {
      road[kind].end[1] = road[kind].sta[1]+road[kind].slope*(road[kind].end[0] 
                                                            - road[kind].sta[0])
      road[kind+1].sta[1] = road[kind].end[1]
      road[kind+1].slope = br.segSlope(road[kind+1])
    }
  }
  br.fixRoadArray(road, null, fromtable, br.RP.SLOPE)

  roadChanged()
}

function roadEdited(d, id) {
  var kind = Number(id)
  var el = d3.select(opts.divTable)
  if (d.auto == br.RP.SLOPE) { disableValue(id) }
  var cell = el.select('[name=slope'+kind+']').node()
  cell.focus()
  var range, selection
  if (document.body.createTextRange) {
    range = document.body.createTextRange()
    range.moveToElementText(cell)
    range.select()
  } else if (window.getSelection) {
    selection = window.getSelection()
    range = document.createRange()
    range.selectNodeContents(cell)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

// -------------------- Functions to animate SVG components --------------------

var anim = {
  buf: false, bux: false, aura: false, aurap: false,
  hor: false, hort: false, ybr: false, ybrc: false,
  guides: false, rosy: false, rosyd: false, data: false,
  dataa: false, mav:false
}
/** This function initiates a cyclic animation on a particular element, cycling
 * through the attribute and style information supplied in two arrays. Each
 * array is expected to include triples [name, v1, v0], cycling an attribute or
 * style with 'name' up to the v1 value in 'dur' milliseconds and back to v0 in
 * 'dur' milliseconds again, repeating indefinitely. */
function startAnim(elt, dur, attrs, styles, tag) {
  var tr = elt.transition().duration(dur), i
  
  for (i= 0; i< attrs.length; i++) tr = tr.attr(  attrs[i][0],  attrs[i][1])
  for (i= 0; i<styles.length; i++) tr = tr.style(styles[i][0], styles[i][1])

  tr = tr.transition().duration(dur)
  for (i= 0; i< attrs.length; i++) tr = tr.attr(attrs[i][0],    attrs[i][2])
  for (i= 0; i<styles.length; i++) tr = tr.style(styles[i][0], styles[i][2])
  tr.on("end", ()=>{if (anim[tag]) startAnim(elt, dur, attrs, styles, tag)})
  anim[tag] = true
}
function stopAnim(elt, dur, attrs, styles, tag) {
  anim[tag] = false
  var tr = elt.transition().duration(dur)
  for (let i= 0; i<attrs.length; i++)  tr = tr.attr(attrs[i][0], attrs[i][2])
  for (let i= 0; i<styles.length; i++) tr = tr.style(styles[i][0], styles[i][2])
  tr.on("end", ()=>{anim[tag] = false})
}

function animBuf(enable) {
  if (opts.roadEditor) return
  var e = gWatermark.selectAll(".waterbuf")
  var x = Number(e.attr("x"))
  var y = Number(e.attr("y"))
  if  (e.node().tagName == 'text') {
    let sz = e.style("font-size")
    sz = Number(sz.substring(0,sz.length-2))
    let s =[["font-size", (sz*1.3)+"px",(sz)+"px"],
            ["fill", "#606060", opts.watermark.color]]
    let a =[["y", y+0.1*sz/3, y]]
    if (enable) startAnim(e, 500, a, s, "buf")
    else stopAnim(e, 300, a, s, "buf")
  } else {
    let h = opts.watermark.height
    let a =[["width", h*1.3, h], ["height", h*1.3, h],
            ["x", x-0.15*h, x], ["y", y-0.15*h, y]]
    if (enable) startAnim(e, 500, a, [], "buf")
    else stopAnim(e, 300, a, [], "buf")
  }
}

function animBux(enable) {
  if (opts.roadEditor) return
  var e = gWatermark.selectAll(".waterbux")

  var sz = e.style("font-size")
  sz = Number(sz.substring(0,sz.length-2))
  var y = Number(e.attr("y"))
  var s =[["font-size", (sz*1.3)+"px",(sz)+"px"],
          ["fill", "#606060", opts.watermark.color]]
  var a =[["y", y+0.15*sz, y]]
  if (enable) startAnim(e, 500, a, s, "bux")
  else stopAnim(e, 300, a, s, "bux")
}

function animAura(enable) {
  if (opts.roadEditor) return
  var e = gAura.selectAll(".aura")
  var ep = gAura.selectAll(".aurapast")
  
  var s =[["stroke",  "#9e559e", bu.Cols.LPURP],
          ["fill",    "#9e559e", bu.Cols.LPURP]]
  var sp =[["stroke", "#9e559e", bu.Cols.LPURP],
           ["fill",   "#9e559e", bu.Cols.LPURP]]
  var a =[["transform",  "translate(0,5)",  "translate(0,0)"]]
  var ap =[["transform", "translate(0,5)",  "translate(0,0)"]]
  if (enable) {
    startAnim(e,  500, a, s,  "aura")
    startAnim(ep, 500, ap, sp, "aurap")
  }
  else {
    stopAnim(e,  300, a, s,  "aura")
    stopAnim(ep, 300, ap, sp, "aurap")
  }
}

function animHor( enable ) {
  if (opts.roadEditor) return
  const o = opts.horizon
  
  var he = gHorizon.select(".horizon")
  var hte = gHorizonText.select(".horizontext")
  const a = [["stroke-width", o.width*scf*3, o.width*scf]],
        s = [["stroke-dasharray", (o.dash*1.3)+","+(o.dash*0.7),
                                  (o.dash)+","+(o.dash)]]
  const ts = [["font-size",(o.font*1.2)+"px", (o.font)+"px"]]
  if (enable) {
    startAnim(he,  500, a,  s,  "hor")
    startAnim(hte, 500, [], ts, "hort")
  } else {
    stopAnim(he,  300, a,  s,  "hor")
    stopAnim(hte, 300, [], ts, "hort")
  }
}

function animYBR(enable) {
  if (opts.roadEditor) return
  // var e = gOldRoad.select(".oldlanes")
  var styles =[["fill-opacity", 1.0, 0.5],
               ["fill", "#ffff00", bu.Cols.DYEL]]
  // if (enable) startAnim(e, 500, [], styles, "ybr")
  // else stopAnim(e, 300, [], styles, "ybr")

  var e = gRazr.select(".razr")
  styles =[["stroke-width", opts.oldRoadLine.width*scf*2, 
                            opts.oldRoadLine.width*scf]]
  if (enable) startAnim(e, 500, [], styles, "ybrc")
  else stopAnim(e, 300, [], styles, "ybrc")
}

function animGuides(enable) {
  if (opts.roadEditor) return
  const e = gGuides.selectAll(".guides")
  const a =[["stroke-width", opts.guidelines.width*scf*2.5,
             d => (d<0 ? opts.guidelines.weekwidth*scf
                       : opts.guidelines.width*scf)],
            ["stroke", d => (d<0 ? bu.Cols.BIGG : "#ffff00"),
                       d => (d<0 ? bu.Cols.BIGG : bu.Cols.LYEL)]]
  if (enable) startAnim(e, 500, a, [], "guides")
  else        stopAnim( e, 300, a, [], "guides")
  // TODO: also animate the maxflux line: 
  // oldguides -> oldmaxflux
  // guidelines -> maxfluxline
}

function animRosy(enable) {
  if (opts.roadEditor) return
  var e  = gRosy.selectAll(".rosy")
  var de = gRosyPts.selectAll(".rd")

  var a =[["stroke-width", 6*scf, 4*scf]]
  var ds =[["r", opts.dataPoint.size*scf*2, 
                 opts.dataPoint.size*scf]]
  if (enable) { 
    startAnim(e,  500, a, [], "rosy")
    startAnim(de, 500, [], ds, "rd")
  }
  else {
    stopAnim(e,  300, a, [], "rosy")
    stopAnim(de, 300, [], ds, "rd")
  }
}

function animData(enable) {
  if (opts.roadEditor) return
  var e = gDpts.selectAll(".dp")
  var attrs =[["r", opts.dataPoint.size*scf*2, 
                    opts.dataPoint.size*scf]]
  if (enable) startAnim(e, 500, attrs, [], "data")
  else        stopAnim(e,  300, attrs, [], "data")
  e = gAllpts.selectAll(".ap")
  attrs =[["r", 0.7*opts.dataPoint.size*scf*2, 
                0.7*opts.dataPoint.size*scf]]
  if (enable) startAnim(e, 500, attrs, [], "dataa")
  else        stopAnim(e,  300, attrs, [], "dataa")
}

function animMav(enable) {
  if (opts.roadEditor) return
  var e = gMovingAv.selectAll(".movingav")

  var a =[["stroke-width", 6*scf, 3*scf]]
  if (enable) startAnim(e, 500, a, [], "mav")
  else        stopAnim(e,  300, a, [], "mav")
}

function animYBHPlines(enable) {
  if (opts.roadEditor) return
  var e = gYBHPlines.selectAll("#r11, #r22, #r66")
  var a =[["stroke-width", 4*scf, 1.5*scf]]
  if (enable) startAnim(e, 500, a, [], "ybl")
  else        stopAnim(e,  300, a, [], "ybl")
}

// -------------------- Functions to update SVG components ---------------------

// Create or update the shaded box to indicate past dates
function updatePastBox() {
  if (processing || opts.divGraph == null || road.length == 0) return
  var pastelt = gPB.select(".past")
  if (!opts.roadEditor) {
    pastelt.remove()
    return
  }
  if (pastelt.empty()) {
    gPB.insert("svg:rect", ":first-child")
      .attr("class","past")
      .attr("x", nXSc(gol.xMin))
      .attr("y", nYSc(gol.yMax+3*(gol.yMax-gol.yMin)))
      .attr("width", nXSc(gol.asof*SMS) - nXSc(gol.xMin))
      .attr("height",7*abs(nYSc(gol.yMin) - nYSc(gol.yMax)))
      .attr("fill", opts.pastBoxCol.fill)
      .attr("fill-opacity", opts.pastBoxCol.opacity)
  } else {
    pastelt.attr("x", nXSc(gol.xMin))
           .attr("y", nYSc(gol.yMax + 3*(gol.yMax-gol.yMin)))
           .attr("width", nXSc(gol.asof*SMS) - nXSc(gol.xMin))
      .attr("height",7*abs(nYSc(gol.yMin) - nYSc(gol.yMax)))
  }
}

// Create or update the shaded box to indicate past dates
function updatePastText() {
  if (processing || opts.divGraph == null || road.length == 0) return
  var todayelt    = gGrid.select(".pastline")
  var pasttextelt = gPastText.select(".pasttext")
  if (!opts.roadEditor) {
    todayelt.remove()
    pasttextelt.remove()
    return
  }
  if (todayelt.empty()) {
    gGrid.append("svg:line").attr("class",         "pastline")
                            .attr("x1",            nXSc(gol.asof*SMS))
                            .attr("y1",            0)
                            .attr("x2",            nXSc(gol.asof*SMS))
                            .attr("y2",            plotbox.height)
                            .style("stroke",       bu.Cols.AKRA) 
                            .style("stroke-width", r3(opts.today.width))
  } else {
    todayelt.attr("x1", nXSc(gol.asof*SMS))
            .attr("y1", 0)
            .attr("x2", nXSc(gol.asof*SMS))
            .attr("y2", plotbox.height)
  }
  var textx = nXSc(gol.asof*SMS)-8
  var texty = plotbox.height/2
  if (pasttextelt.empty()) {
    gPastText.append("svg:text")
      .attr("class","pasttext")
      .attr("x",textx ).attr("y",texty)
      .attr("transform", "rotate(-90,"+textx+","+texty+")")
      .attr("fill", bu.Cols.AKRA) 
      .style("font-size", opts.horizon.font+"px") 
      .text("Today"+" ("+moment.unix(gol.asof).utc().format("ddd")+")")
  } else {
    pasttextelt
      .attr("x", textx).attr("y", texty)
      .attr("transform", "rotate(-90,"+textx+","+texty+")")
      .text("Today"+" ("+moment.unix(gol.asof).utc().format("ddd")+")")
  }
}

function updateContextToday() {
  if (processing || opts.divGraph == null || road.length == 0) return
  var todayelt    = ctxplot.select(".ctxtoday")
  var pasttextelt = ctxplot.select(".ctxtodaytext")
  if (!opts.roadEditor) {
    todayelt.remove()
    pasttextelt.remove()
    return
  }
  if (todayelt.empty()) {
    ctxplot.append("svg:line").attr("class",         "ctxtoday")
                              .attr("x1",            xScB(gol.asof*SMS))
                              .attr("y1",            0)
                              .attr("x2",            xScB(gol.asof*SMS))
                              .attr("y2",            brushbox.height)
                              .style("stroke",       "rgb(0,0,200)") 
                              .style("stroke-width", r3(opts.horizon.ctxwidth))
  } else {
    todayelt.attr("x1", xScB(gol.asof*SMS))
            .attr("y1", 0)
            .attr("x2", xScB(gol.asof*SMS))
            .attr("y2", brushbox.height)
  }
  var textx = xScB(gol.asof*SMS)-5
  var texty = brushbox.height/2

  if (pasttextelt.empty()) {
    ctxplot.append("svg:text")
      .attr("class",      "ctxtodaytext")
      .attr("x",          textx )
      .attr("y",          texty)
      .attr("transform",  "rotate(-90,"+textx+","+texty+")")
      .attr("fill",       "rgb(0,0,200)") 
      .style("font-size", (opts.today.ctxfont)+"px") 
      .text("Today")
  } else {
    pasttextelt.attr("x", textx)
               .attr("y", texty)
               .attr("transform", "rotate(-90,"+textx+","+texty+")")
  }
}

// Creates or updates the Bullseye at the goal date
function updateBullseye() {
  if (processing || opts.divGraph == null || road.length == 0) return;
  var bullseyeelt = gBullseye.select(".bullseye");
  //var bx = nXSc(road[road.length-1].sta[0]*SMS)-(opts.bullsEye.size/2);
  //var by = nYSc(road[road.length-1].sta[1])-(opts.bullsEye.size/2);
  var bx = nXSc(gol.tfin*SMS)-(opts.bullsEye.size/2);
  var by = nYSc(br.rdf(road, gol.tfin))-(opts.bullsEye.size/2);
  if (bullseyeelt.empty()) {
    gBullseye.append("svg:image")
      .attr("class","bullseye")
      .attr("xlink:href",PNG.beye)
      .attr("externalResourcesRequired",true)
      .attr("x",bx ).attr("y",by)
      .attr('width', opts.bullsEye.size)
      .attr('height', opts.bullsEye.size);
  } else {
    bullseyeelt
      .attr("x", bx).attr("y", by);
  }
}

function updateContextBullseye() {
  if (processing || opts.divGraph == null || road.length == 0) return;
  var bullseyeelt = ctxplot.select(".ctxbullseye");
  if (!opts.roadEditor) {
    bullseyeelt.remove();
    return;
  }
  //var bx = xScB(road[road.length-1].sta[0]*SMS)-(opts.bullsEye.ctxsize/2)
  //var by = yScB(road[road.length-1].sta[1])-(opts.bullsEye.ctxsize/2)
  var bx = xScB(gol.tfin*SMS)-(opts.bullsEye.ctxsize/2);
  var by = yScB(br.rdf(road, gol.tfin))-(opts.bullsEye.ctxsize/2);
  if (bullseyeelt.empty()) {
    ctxplot.append("svg:image")
      .attr("class","ctxbullseye")
      .attr("xlink:href",PNG.beyey)
      .attr("externalResourcesRequired",true)
      .attr("x",bx ).attr("y",by)
      .attr('width', (opts.bullsEye.ctxsize))
      .attr('height', (opts.bullsEye.ctxsize));
  } else {
    bullseyeelt.attr("x", bx).attr("y", by);
  }
}

// Creates or updates the Bullseye at the goal date
function updateOldBullseye() {
  if (processing || opts.divGraph == null || road.length == 0) return;
  var bullseyeelt = gOldBullseye.select(".oldbullseye");
  if (!opts.roadEditor) {
    bullseyeelt.remove();
    return;
  }
  var png = (opts.roadEditor)?PNG.beyey:PNG.beye
  //var bx = nXSc(iroad[iroad.length-1].sta[0]*SMS)-(opts.bullsEye.size/2);
  //var by = nYSc(iroad[iroad.length-1].sta[1])-(opts.bullsEye.size/2);
  var bx = nXSc(igoal.tfin*SMS)-(opts.bullsEye.size/2);
  var by = nYSc(br.rdf(iroad, igoal.tfin))-(opts.bullsEye.size/2);
  if (bullseyeelt.empty()) {
    gOldBullseye.append("svg:image")
      .attr("class","oldbullseye")
      .attr("xlink:href",png)
      .attr("externalResourcesRequired",true)
      .attr("x",bx ).attr("y",by)
      .attr('width', (opts.bullsEye.size))
      .attr('height', (opts.bullsEye.size));
  } else {
    bullseyeelt
      .attr("x", bx).attr("y", by);
  }
}

function updateContextOldBullseye() {
  if (processing || opts.divGraph == null || road.length == 0) return;
  var png = (opts.roadEditor)?PNG.beyey:PNG.beye
  var bullseyeelt = ctxplot.select(".ctxoldbullseye");
  var bx = xScB(iroad[iroad.length-1].sta[0]*SMS)
    -(opts.bullsEye.ctxsize/2);
  var by = yScB(iroad[iroad.length-1].sta[1])
    -(opts.bullsEye.ctxsize/2);
  if (bullseyeelt.empty()) {
    ctxplot.append("svg:image")
      .attr("class","ctxoldbullseye")
      .attr("xlink:href",png)
      .attr("externalResourcesRequired",true)
      .attr("x",bx ).attr("y",by)
      .attr('width', (opts.bullsEye.ctxsize))
      .attr('height', (opts.bullsEye.ctxsize));
  } else {
    bullseyeelt
      .attr("x", bx).attr("y", by);
  }
}

// Creates or updates the watermark with the number of safe days
function updateWatermark() {
  if (processing || opts.divGraph == null || road.length == 0 || hidden) return

  var tl = [0,0], bbl = [0, plotbox.height/2]
  var tr = [plotbox.width/2,0], bbr = [plotbox.width/2, plotbox.height/2]
  var offg, offb, g = null, b = null, x, y, bbox, newsize, newh

  setWatermark()
  if      (gol.loser)              g = PNG.sklb
  if      (gol.waterbuf === 'inf') g = PNG.infb
  else if (gol.waterbuf === ':)')  g = PNG.smlb

  if      (gol.dir>0 && gol.yaw<0) { offg = bbr; offb = tl  }
  else if (gol.dir<0 && gol.yaw>0) { offg = tr;  offb = bbl }
  else if (gol.dir<0 && gol.yaw<0) { offg = bbl; offb = tr  }
  else                             { offg = tl;  offb = bbr }

  xlinkloaded = false
  var wbufelt = gWatermark.select(".waterbuf");
  var fs = opts.watermark.fntsize, wmh = opts.watermark.height
  wbufelt.remove();
  if (g != null) {
    x = (plotbox.width/2-wmh)/2;
    y = (plotbox.height/2-wmh)/2;

    wbufelt = gWatermark.append("svg:image")
      .attr("class","waterbuf")
      //.attr("shape-rendering","crispEdges")
      .attr("xlink:href",g)
      .attr("externalResourcesRequired",true)
      .attr('width', wmh)
      .attr('height', wmh)
      .on('load', ()=>{xlinkloaded = true});
  } else {
    x = plotbox.width/4;
    y = plotbox.height/4+fs/3;
    wbufelt = gWatermark.append("svg:text")
      .attr("class","waterbuf")
      //.attr("shape-rendering","crispEdges")
      .style('font-size', fs+"px")
      .style('font-weight', "bolder")
      .style('fill', opts.watermark.color)
      .text(gol.waterbuf);
    bbox = wbufelt.node().getBBox();
    if (bbox.width > plotbox.width/2.2) {
      newsize = (fs*(plotbox.width/2.2)
                 /bbox.width);
      newh = newsize/fs*bbox.height;
      y = plotbox.height/4+newh/3;
      wbufelt.style('font-size', newsize+"px");
    }        
    xlinkloaded = true
  }
  wbufelt.attr("x", x + offg[0])
    .attr("y", y + offg[1]);

  var wbuxelt = gWatermark.select(".waterbux");
  wbuxelt.remove();
  if (!opts.roadEditor) {
    x = plotbox.width/4;
    y = plotbox.height/4+fs/3;
    wbuxelt = gWatermark.append("svg:text")
      .attr("class","waterbux")
      //.attr("shape-rendering","crispEdges")
      .style('font-size', fs+"px")
      .style('font-weight', "bolder")
      .style('fill', opts.watermark.color)
      .text(gol.waterbux);
    bbox = wbuxelt.node().getBBox();
    if (bbox.width > plotbox.width/2.2) {
      newsize = (fs*(plotbox.width/2.2)/bbox.width)
      newh = newsize/fs*bbox.height
      y = plotbox.height/4+newh/3
      wbuxelt.style('font-size', newsize+"px")
    }
    wbuxelt.attr("x", x + offb[0])
           .attr("y", y + offb[1])
  } else wbuxelt.remove()
}

function updateAura() {
  if (processing || opts.divGraph == null || road.length == 0 || hidden) return
  var el  = gAura.selectAll(".aura")
  var el2 = gAura.selectAll(".aurapast")
  if (gol.aura && opts.showData) {
    var aurdn = min(0, -gol.stdflux)
    var aurup = max(0,  gol.stdflux)
    var fudge = PRAF*(gol.tmax-gol.tmin)
    var xr = [nXSc.invert(            0).getTime()/SMS, 
              nXSc.invert(plotbox.width).getTime()/SMS]
    var xvec, i
    xvec = griddle(max(xr[0], gol.tmin),
                   bu.arrMin([xr[1], gol.asof+bu.AKH, gol.tmax+fudge]),
                   plotbox.width/8)
    // Generate a path string for the aura
    var 
      d = "M"+r1(nXSc(xvec[0]*SMS))+" "+r1(nYSc(gol.auraf(xvec[0])+aurup))
    for (i = 1; i < xvec.length; i++)
      d += 
        " L"+r1(nXSc(xvec[i]*SMS))+" "+r1(nYSc(gol.auraf(xvec[i])+aurup))
    for (i = xvec.length-1; i >= 0; i--)
      d += 
        " L"+r1(nXSc(xvec[i]*SMS))+" "+r1(nYSc(gol.auraf(xvec[i])+aurdn))
    d += " Z"
    if (el.empty()) {
      gAura.append("svg:path")
        .attr("class","aura").attr("d", d)
        .style("fill", bu.Cols.LPURP)
        .style("stroke-width", 2).style("stroke", bu.Cols.LPURP);
    } else {
      el.attr("d", d);
    }
    if (xr[0] < gol.tmin) {
      xvec = griddle(xr[0], gol.tmin, plotbox.width/8);
      d = "M"+r1(nXSc(xvec[0]*SMS))+" "+r1(nYSc(gol.auraf(xvec[0])+aurup))
      for (i = 1; i < xvec.length; i++)
        d += " L"+r1(nXSc(xvec[i]*SMS))+" "
                 +r1(nYSc(gol.auraf(xvec[i])+aurup))
      for (i = xvec.length-1; i >= 0; i--)
        d += " L"+r1(nXSc(xvec[i]*SMS))+" "
                 +r1(nYSc(gol.auraf(xvec[i])+aurdn))
      d += " Z";
      if (el2.empty()) {
        gAura.append("svg:path")
          .attr("class","aurapast").attr("d", d)
          .style("fill", bu.Cols.LPURP)
          .style("stroke-width", 2)
          .style("stroke-dasharray", "4,4")
          .style("stroke", bu.Cols.LPURP)
      } else {
        el2.attr("d", d)
      }
    } else 
      el2.remove()
  } else {
    el.remove()
    el2.remove()
  }
}

// Create or update the Akrasia Horizon line
function updateHorizon() {
  if (processing || opts.divGraph == null || road.length == 0) return;
  const horizonelt = gHorizon.select(".horizon");
  const o = opts.horizon
  
  if (horizonelt.empty()) {
    gHorizon.append("svg:line")
      .attr("class","horizon")
      .attr("x1", nXSc(gol.horizon*SMS))
      .attr("y1",0)
      .attr("x2", nXSc(gol.horizon*SMS))
      .attr("y2",plotbox.height)
      .style("stroke", bu.Cols.AKRA) 
      .style("stroke-dasharray", 
             (o.dash)+","+(o.dash)) 
      .attr("stroke-width", r3(o.width*scf))
  } else {
    horizonelt
      .attr("x1", nXSc(gol.horizon*SMS))
      .attr("y1",0)
      .attr("x2", nXSc(gol.horizon*SMS))
      .attr("y2",plotbox.height)
      .attr("stroke-width", r3(o.width*scf))
  }
  var textx = nXSc(gol.horizon*SMS)+(14);
  var texty = plotbox.height/2;
  var horizontextelt = gHorizonText.select(".horizontext");
  if (horizontextelt.empty()) {
    gHorizonText.append("svg:text")
      .attr("class","horizontext")
      .attr("x",textx ).attr("y",texty)
      .attr("transform", "rotate(-90,"+textx+","+texty+")")
      .attr("fill", bu.Cols.AKRA) 
      .style("font-size", (o.font)+"px") 
      .text("Akrasia Horizon");
  } else {
    horizontextelt
      .attr("x", textx).attr("y", texty)
      .attr("transform", "rotate(-90,"+textx+","+texty+")");
  }
}

function updateContextHorizon() {
  if (processing || opts.divGraph == null || road.length == 0) return
  const horizonelt = ctxplot.select(".ctxhorizon")
  const o = opts.horizon
  if (horizonelt.empty()) {
    ctxplot.append("svg:line")
      .attr("class","ctxhorizon")
      .attr("x1", xScB(gol.horizon*SMS))
      .attr("y1", yScB(gol.yMin-5*(gol.yMax-gol.yMin)))
      .attr("x2", xScB(gol.horizon*SMS))
      .attr("y2", yScB(gol.yMax+5*(gol.yMax-gol.yMin)))
      .style("stroke", bu.Cols.AKRA) 
      .style("stroke-dasharray", (o.ctxdash)+","+(o.ctxdash)) 
      .style("stroke-width", r3(o.ctxwidth))
  } else {
    horizonelt.attr("x1", xScB(gol.horizon*SMS))
              .attr("y1", yScB(gol.yMin-5*(gol.yMax-gol.yMin)))
              .attr("x2", xScB(gol.horizon*SMS))
              .attr("y2", yScB(gol.yMax+5*(gol.yMax-gol.yMin)))
  }

  var textx = xScB(gol.horizon*SMS)+12
  var texty = brushbox.height/2

  var hortextelt = ctxplot.select(".ctxhortext")
  if (hortextelt.empty()) {
    ctxplot.append("svg:text")
      .attr("class","ctxhortext")
      .attr("x",textx ).attr("y",texty)
      .attr("transform", "rotate(-90,"+textx+","+texty+")")
      .attr("fill", bu.Cols.AKRA) 
      .style("font-size", (o.ctxfont)+"px") 
      .text("Horizon")
  } else {
    hortextelt.attr("x", textx)
              .attr("y", texty)
              .attr("transform", "rotate(-90,"+textx+","+texty+")")
  }
}

function updateYBHP() {
  if (processing || opts.divGraph == null || road.length == 0) return
  
  // Count all previously generated ybhp path elements on the current svg graph
  // so we can remove unused ones automatically 
  const ybhpreg   = d3.selectAll("#svg"+curid+" #ybhpgrp path")
  const ybhplines = d3.selectAll("#svg"+curid+" #ybhplinesgrp path")
  const prevcnt = ybhpreg.size()+ybhplines.size()

  // Region format: From d to D days to derailment (if d=D it's a region
  // boundary, i.e., an isoline of the DTD function), use fill-color fcolor,
  // stroke-color scolor, stroke-width w, and fill-opacity op.
  // Finally, xrange, a list like [xmin, xmax], gives the x-axis range to apply
  // it to. If xrange=null, use [-infinity, infinity].

  const xrfull   = [gol.tini, gol.tfin]       // x-axis range tini to tfin
  const xrakr    = [gol.asof, gol.asof+7*SID] // now to akrasia horizon
  const bgreen   = bu.Cols.RAZR3 // bu.Cols.GRNDOT // was RAZR3
  const bblue    = bu.Cols.RAZR2
  const borange  = bu.Cols.RAZR1
  const lyellow  = "#ffff88" // light yellow same as LYEL for classic YBR
  const llyellow  = "#ffffbd" // uluc had #ffffdd
  const gsw      = .99  // stroke width for guiding lines
  const gfo      = 1    // fill-opacity for guiding lines -- may not matter
  const rfo      = 0.72 // fill-opacity for regions
  const inf      = (gol.tfin-gol.tini)/SID // num safe days counting as infinite

  const regionsMaxflux = [
  //[  d,  D, fcolor,    scolor,    w,  op, xrange]
  //----------------------------------------------------------------------------
    [  0,  2, lyellow,   "none",    0, rfo, xrfull], // mimic old lanes
  //[  0, -2, "#fff5f5", "none",    0,   1, xrakr ], // nozone/oinkzone
    [inf, -1, llyellow,   "none",    0, rfo, xrfull], // infinitely safe region
  ]
  const regionsNormal = [
  //[  d,  D, fcolor,    scolor,    w,  op, xrange]
  //----------------------------------------------------------------------------
  //[  6, -1, "#b2e5b2", "none",    0, rfo, xrfull], // safe/gray region
    [  6,  6, "none",    bgreen,  gsw, gfo, xrfull], // 1-week isoline
  //[  2,  6, "#cceecc", "none",    0, rfo, xrfull], // green region (not used)
    [  2,  2, "none",    bblue,   gsw, gfo, xrfull], // blue isoline
  //[  1,  2, "#e5e5ff", "none",    0, rfo, xrfull], // blue region (not used)
    [  1,  1, "none",    borange, gsw, gfo, xrfull], // orange isoline
  //[  0,  1, "#fff1d8", "none",    0, rfo, xrfull], // orange region (not used)
    [  0,  2, lyellow,   "none",    0, rfo, xrfull], // mimic old lanes
  // Razor road currently in updateRedline because we can't define dashed lines
  // here; so the following doesn't work:
  //[  0,  0, "#ff0000", "none",    1, gfo, xrfull], // bright red line
  //[  0, -2, "#ffe5e5", "none",    0, rfo,   null], // whole bad half-plane
  //[  0, -2, "#fff5f5", "none",    0,   1, xrakr ], // nozone/oinkzone
    [inf, -1, llyellow,   "none",    0, rfo, xrfull], // infinitely safe region
  ]
  let regions
  if (false) { // change to true for debugging
    const debuglines = 0
    const regionsDebug = [
    //[  d,  D, fcolor,    scolor,    w,  op, xrange]
    //--------------------------------------------------------------------------
      [  6,  6, "none",    bgreen,  1.5,   1, xrfull], // 1-week isoline
      [  7,  7, "none",    bblue,   1.5,   1, xrfull], // extra isoline
      [  8,  8, "none",    borange, 1.5,   1, xrfull], // extra isoline
      [  9,  9, "none",    "red",   1.5,   1, xrfull], // extra isoline
      [  0,  2, lyellow,   "none",    0, 0.5, xrfull], // YBR equivalent
    //[  2,  2, "none",    bblue,   1.5,   1, xrfull], // blue line
    //[  1,  1, "none",    borang,  1.5,   1, xrfull], // orange line
    ]
    regions = regionsDebug // debugging isolines
    const tmp = br.isoline(road, dtd, gol, debuglines, true)
    const adj = abs(nYSc.invert(2.5)-nYSc.invert(0))
    //console.log(JSON.stringify(tmp[3].map(e=>[bu.dayify(e[0]), e[1]])))
    iso[6] = tmp[0]
    iso[7] = tmp[1]
    iso[8] = tmp[2]
    iso[9] = tmp[3]
    iso[7] = iso[7].map(e => [e[0], e[1]+1*adj])
    iso[8] = iso[8].map(e => [e[0], e[1]+2*adj])
    iso[9] = iso[9].map(e => [e[0], e[1]+3*adj])
  } else {
    regions = gol.maxflux > 0 ? regionsMaxflux : regionsNormal
  }
  
  // HT cpcallen who proposed changing this max to a min, though turns out
  // that's wrong. Sad trombone!
  for (var ri = 0; ri < max(prevcnt, regions.length); ri++) {
    // SVG elements for regions are given unique class names
    const clsname = "halfplane"+ri
    const reg = regions[ri]

    // Force removal of leftover regions or lines if requested or stale detected
    if (reg == undefined || (reg[2] == null && reg[3] == null)) {
      gYBHP.select("."+clsname).remove()
      gYBHPlines.select("."+clsname).remove()
      continue
    }

    let ybhpelt, ybhpgrp
    if (reg[0] != reg[1]) {
      // Regions are drawn on their own container
      ybhpgrp = gYBHP
      // Remove any previously created lines with this name to prevent
      // leftovers from earlier graph instances
      gYBHPlines.select("."+clsname).remove()
    } else {
      // Lines are drawn on their own container
      ybhpgrp = gYBHPlines
      // Remove any previously created regions with this name to prevent
      // leftovers from earlier graph instances
      gYBHP.select("."+clsname).remove()
    }
    ybhpelt = ybhpgrp.select("."+clsname)
    const id = "r"+reg[0]+reg[1]

    // Adjustment to y coordinates by half the stroke width
    const adj = gol.yaw*reg[4]/2

    let xr = reg[6]
    if (xr == null) xr = [-Infinity, Infinity]

    const rstrt = reg[0]
    const rend  = reg[1]

    // Starting boundary for a region is not allowed to be infinity
    if (rstrt < 0) {
      console.log("updateYBHP(): Invalid region definition")
      continue
    }
    
    // Clip start and end points to within the requested range
    let xstrt = road[0].end[0]
    let xend = road[road.length-1].sta[0]
    if (xstrt < xr[0]) xstrt = xr[0]
    if (xend  > xr[1]) xend = xr[1]

    // Determine good side of the road for boundaries at infinity
    let yedge, yedgeb
    if (gol.yaw < 0) {
      yedge  = gol.yMin - 0.1*(gol.yMax - gol.yMin)
      yedgeb = gol.yMax + 0.1*(gol.yMax - gol.yMin)
    } else {
      yedge  = gol.yMax + 0.1*(gol.yMax - gol.yMin)
      yedgeb = gol.yMin - 0.1*(gol.yMax - gol.yMin)
    }

    // Construct a path element for the starting DTD value. This will be the
    // only path if the starting and ending DTD values are the same.
    const isostrt = getiso(rstrt)

    let x = isostrt[0][0]
    let y = isostrt[0][1]
    if (x < xstrt) { x = xstrt; y = br.isoval(isostrt, x) }
    let d = "M"+r1(nXSc(x*SMS))+" "+r1(nYSc(y)+adj)
    for (let i = 1; i < isostrt.length; i++) {
      x = isostrt[i][0]; y = isostrt[i][1]
      if (x < xstrt) continue
      if (x > xend) { x = xend; y = br.isoval(isostrt, x) }
      d += " L"+r1(nXSc(x*SMS))+" "+r1(nYSc(y)+adj)
      if (isostrt[i][0] > xend) break
    }

    if (rend == -1) {
      // Region on the good side of the road
      d += " L"+r1(nXSc(xend *SMS))+" "+r1(nYSc(br.isoval(isostrt, xend))+adj)
      d += " L"+r1(nXSc(xend *SMS))+" "+r1(nYSc(yedge))
      d += " L"+r1(nXSc(xstrt*SMS))+" "+r1(nYSc(yedge))
      d += " Z"
    } else if (rend == -2) {
      // Region on the bad side of the road
      d += " L"+nXSc(xend *SMS)+" "+r1(nYSc(br.isoval(isostrt, xend))+adj)
      d += " L"+r1(nXSc(xend *SMS))+" "+r1(nYSc(yedgeb))
      d += " L"+r1(nXSc(xstrt*SMS))+" "+r1(nYSc(yedgeb))
      d += " Z"
    } else if (rstrt != rend) {
      // End DTD value different than start value, so construct a return path
      // to build an enclosed region
      const isoend = getiso(rend)
      const ln = isoend.length
      let x = isoend[ln-1][0]
      let y = isoend[ln-1][1]
      if (x > xend) { x = xend; y = br.isoval(isoend, x) }
      d += " L"+r1(nXSc(x*SMS))+" "+r1(nYSc(y)+adj)
      for (let i = ln-2; i >= 0; i--) {
        x = isoend[i][0]
        y = isoend[i][1]
        if (x > xend) continue
        if (x < xstrt) { x = xstrt; y = br.isoval(isoend, x) }
        d += " L"+r1(nXSc(x*SMS))+" "+r1(nYSc(y)+adj)
        if (isoend[i][0] < xstrt) break
      }
      d += " Z"
    }

    if (ybhpelt.empty()) { // create a new element if an existing one not found
      ybhpgrp.append("svg:path").attr("class",          "ybhp "+clsname)
                                .attr("id",             id)
                                .attr("d",              d)
                                .attr("fill",           reg[2])
                                .attr("fill-opacity",   reg[5])
                                .attr("stroke",         reg[3])
                                .attr("stroke-width",   reg[4])
    } else { // update previously created element
      ybhpelt.attr("d",            d)
             .attr("id",             id)
             .attr("fill",         reg[2])
             .attr("fill-opacity", reg[5])
             .attr("stroke",       reg[3])
             .attr("stroke-width", reg[4])
    }
  }
}

function updatePinkRegion() {                         // AKA nozone AKA oinkzone
  if (processing || opts.divGraph == null || road.length == 0) return

  const pinkelt = gPink.select(".pinkregion")
  const valid = isRoadValid(road)
  let rd = iroad
  // For non-editor graphs, use the most recent road
  if (!opts.roadEditor) rd = road
  
  const now = gol.asof
  const hor = gol.horizon
  let yedge
  if (gol.yaw > 0) yedge = gol.yMin - 5*(gol.yMax - gol.yMin)
  else             yedge = gol.yMax + 5*(gol.yMax - gol.yMin)
  const color = "url(#pinkzonepat"+curid+")"

  const pr = d3.select(" #pinkzonepat"+curid+" rect")
  const pl = d3.select(" #pinkzonepat"+curid+" line")
  pr.attr("fill", (valid||!opts.roadEditor)?bu.Cols.PINK:"#ffbbbb")
  pl.style("stroke", (valid||!opts.roadEditor)?"#aaaaaa":"#666666")
  
  // Compute road indices for left and right boundaries
  const itoday = br.findSeg(rd, now)
  const ihor   = br.findSeg(rd, hor)
  let d = "M"+nXSc(now*SMS)+" "+nYSc(br.rdf(rd, now))
  for (let i = itoday; i < ihor; i++) {
    d += " L"+nXSc(rd[i].end[0]*SMS)
         +" "+nYSc(rd[i].end[1])
  }
  d += " L"+nXSc(hor*SMS)+" "+nYSc(br.rdf(rd, hor))
  d += " L"+nXSc(hor*SMS)+" "+nYSc(yedge)
  d += " L"+nXSc(now*SMS)+" "+nYSc(yedge)
  d += " Z"
  gPinkPat.attr("patternTransform", gol.dir > 0 ? "rotate(135)" : "rotate(45)")
          .attr("x", -gol.dir*nXSc(now*SMS))
  
  if (pinkelt.empty()) {
    gPink.append("svg:path").attr("class",        "pinkregion")
                            .attr("d",            d)
                            .attr("fill-opacity", 0.4)
                            .attr("fill",         color)
  } else {
    pinkelt.attr("d", d).attr("fill", color)
  }
}

// This stands separate from updateYBHP because we need to use it for the "old",
// unedited road as well. This now supports a delta argument for the maxflux
// line, and a dash argument for the editor version. If scol == null, then the
// element is deleted to clean up leftovers from earlier draws.
// TODO: rename this to updateRazrRoad or updateYBR
function updateRedline(rd, g, gelt, cls, delta, usedash) {
  if (processing || opts.divGraph == null || road.length == 0) return
  
  const roadelt = gelt.select("."+cls)
  if (delta == null) {
    roadelt.remove()
    return
  }

  //const sg   = (!opts.roadEditor)
  const dash = (opts.oldRoadLine.dash)+","+ceil(opts.oldRoadLine.dash/2)
  const sda  = usedash?dash:null // stroke-dasharray

  // fx,fy: Start of the current line segment
  // ex,ey: End of the current line segment
  let fx = nXSc(rd[0].sta[0]*SMS), fy = nYSc(rd[0].sta[1]+delta)
  let ex = nXSc(rd[0].end[0]*SMS), ey = nYSc(rd[0].end[1]+delta)
  if (rd[0].sta[0] < g.tini) {
    fx  = nXSc(g.tini*SMS)
    // Using vini instead of the rdf below does not work for some
    // goals where vini ends up not on the road itself -- uluc
    // But let's do stricter error-checking so we can count on rdf(tini)==vini!
    fy  = nYSc(br.rdf(rd, g.tini)+delta)
    //fy  = nYSc(g.vini+delta)
  }

  if (usedash) {
    // Adjust start of road so dashes are stationary wrt time
    const newx = (-nXSc(g.tini*SMS)) % ceil(1.5*opts.oldRoadLine.dash)
    if (ex !== fx) fy = (fy + (-newx-fx)*(ey-fy)/(ex-fx))
    if (fx < 0 || newx > 0) fx = -newx
  }

  let d = "M"+r1(fx)+" "+(r1(fy))
  for (const segment of rd) {
    // Some goals have non-daysnapped road matrix entries, which
    // breaks the tfin check. This hopefully overcomes that problem
    let segx = bu.daysnap(segment.end[0])
    ex = nXSc(segment.end[0]*SMS)
    if (segx < g.tini) continue
    if (segx > g.tfin) break
    ey = nYSc(segment.end[1]+delta)
    d += " L"+r1(ex)+" "+(r1(ey))
    if (ex > plotbox.width) break
  }
  if (roadelt.empty()) {
    gelt.append("svg:path").attr("class",             cls)
                                 .attr("d",                 d)
                                 .style("stroke-dasharray", sda)
  } else {
    roadelt.attr("d", d).style("stroke-dasharray", sda)
  }
}

/* Determine whether a given line segment intersects the given bounding box.
Follows the algorithm in
https://noonat.github.io/intersect/#axis-aligned-bounding-boxes
The bbox parameter should include the center and the half sizes like so:
  [x_mid, y_mid, w_half, h_half] */
function lineInBBox(line, bbox) {
//  console.log("Intersecting "+JSON.stringify(line.map(e=>[bu.dayify(e[0]), e[1]]))+" with "+JSON.stringify([bu.dayify(bbox[0]-bbox[2]), bbox[1]-bbox[3], bu.dayify(bbox[0]+bbox[2]), bbox[1]+bbox[3]]))
  let delta = [line[1][0] - line[0][0], 
               line[1][1] - line[0][1]]
  const scaleX = 1.0 / delta[0]
  const scaleY = 1.0 / delta[1]
  const signX = Math.sign(scaleX)
  const signY = Math.sign(scaleY)
  const nearTimeX = (bbox[0] - signX * bbox[2] - line[0][0]) * scaleX
  const nearTimeY = (bbox[1] - signY * bbox[3] - line[0][1]) * scaleY
  const farTimeX  = (bbox[0] + signX * bbox[2] - line[0][0]) * scaleX
  const farTimeY  = (bbox[1] + signY * bbox[3] - line[0][1]) * scaleY    
  if (nearTimeX > farTimeY || nearTimeY > farTimeX) return false
  const nearTime = nearTimeX > nearTimeY ? nearTimeX : nearTimeY
  const farTime  = farTimeX  < farTimeY  ? farTimeX  : farTimeY
  if (nearTime > 1 || farTime < 0) return false
  return true
}
  
function isovisible(iso, bbox) {
  if (!iso || !iso.length) return false
  // TODO: For efficiency, limit intersection search to isolines in xrange
  const left  = bbox[0] - bbox[2]
  const right = bbox[0] + bbox[2]
  let a = bu.searchLow(iso, p => p[0] < left  ? -1 : 1)
  let b = bu.searchLow(iso, p => p[0] < right ? -1 : 1)
  if (a < 0) a = 0
  if (b > iso.length - 2) b = iso.length - 2
  for (let i=a; i<=b; i++) if (lineInBBox([iso[i], iso[i+1]], bbox)) return true
  return false
}

// Returns true if two isolines overlap within the specified x range in bbox
function isocompare(isoa, isob, bbox) {
  if (!isoa || !isoa.length || !isob || !isob.length) return false
  const EPS = 1e-5 // or 1e-9 works fine; maybe have it depend on y-values?
  // TODO: For efficiency, limit intersection search to isolines in xrange
  const left  = bbox[0] - bbox[2]
  const right = bbox[0] + bbox[2]
  // Fail if isolines differ on the boundaries. 
  // TODO: This duplicates the boundary search below. Combine.
  if (abs(br.isoval(isoa,  left) - br.isoval(isob,  left)) > EPS ||
      abs(br.isoval(isoa, right) - br.isoval(isob, right)) > EPS) return false
  
  let la = bu.searchHigh(isoa, p => p[0] < left  ? -1 : 1)
  let ra = bu.searchLow( isoa, p => p[0] < right ? -1 : 1)
  let lb = bu.searchHigh(isob, p => p[0] < left  ? -1 : 1)
  let rb = bu.searchLow( isob, p => p[0] < right ? -1 : 1)
  // Evaluate the alternate isoline on inflection points
  for (let i = la; i < ra; i++)
    if (abs(br.isoval(isob, isoa[i][0]) - isoa[i][1]) > EPS) return false
  for (let i = lb; i < rb; i++)
    if (abs(br.isoval(isoa, isob[i][0]) - isob[i][1]) > EPS) return false
  return true
}
  
/* Compute the maximum visible DTD isoline, searching up to the specified limit.
 * Does binary search on the isolines between 0 and limit, checking whether a
 * given isoline intersects the visible graph or not. Since isolines never 
 * intersect each other, this should be guaranteed to work unless the maximum
 * DTD isoline is greater than limit in which case limit is returned. */
let glarr, gllimit = -1 // should be more efficient to not recompute these
function maxVisibleDTD(limit) {
  const isolimit = getiso(limit)
  const xr = [nXSc.invert(0)/SMS         , nXSc.invert(plotbox.width)/SMS]
  const yr = [nYSc.invert(plotbox.height), nYSc.invert(0)]
  const bbox = [(xr[0]+xr[1])/2, (yr[0]+yr[1])/2,
                (xr[1]-xr[0])/2, (yr[1]-yr[0])/2]

  if (limit != gllimit) {
    // For efficiency, only compute the search array when there's a change
    // Eek, looks like it's possible for limit to not be an integer!?
    //console.log(`DEBUG limit=${limit} vs gllimit=${gllimit}`)
    gllimit = limit
    glarr = Array(ceil(limit)).fill().map((x,i)=>i) // sticking in ceil for now
  }

  // If upper limit is visible, nothing to do, otherwise proceed with the search
  if (isovisible(isolimit, bbox)) {
    // TODO: Find the minimum isoline that overlaps with the limit w/in the 
    // visible range.
    const maxdtd = 
      bu.searchHigh(glarr, i=>isocompare(isolimit, getiso(i), bbox) ? 1:-1)
    return min(maxdtd, glarr.length - 1)
  }
  
  const maxdtd = bu.searchLow(glarr, i=>isovisible(getiso(i), bbox) ? -1:1)
  return max(maxdtd, 0)
  // Is it weird that the function to search by is something that itself does
  // a search? Probably Uluc is just a couple levels ahead of me but at some 
  // point I'll want to get my head around that! --dreev
}

function updateGuidelines() {
  if (processing || opts.divGraph == null || road.length == 0) return

  let guideelt = gGuides.selectAll(".guides")
  if (opts.roadEditor && !opts.showGuidelines) {
    guideelt.remove(); return
  }
  
  let skip = 1 // Show only one per this many guidelines
  
  // Create an index array as d3 data for guidelines
  // (Fun fact: the .invert() call returns a javascript date objects but when
  // you divide a Date object by a number that coerces it to a number, namely
  // unixtime in milliseconds. So doing .invert().getTime() is unnecessary.)
  const xrange = [nXSc.invert(            0)/SMS,
                  nXSc.invert(plotbox.width)/SMS]
  const buildPath = ((d,i) =>
                     getisopath(d, [max(gol.tini, xrange[0]),
                                    min(gol.tfin, xrange[1])]))
  
  const lnw = isolnwborder(xrange) // estimate intra-isoline delta
  const lnw_px = abs(nYSc(0) - nYSc(lnw))
  const numdays = (gol.tfin-gol.tini)/SID

  let numlines = maxVisibleDTD(numdays)

  if      (lnw_px>8 || numlines<6*7)        skip = 1   // All lines till 6 weeks
  else if (7*lnw_px>8 || numlines<6*28)     skip = 7    // Weekly lines till 6mo
  else if (28*lnw_px>12 || numlines<2*12*28) skip = 28  // Monthly lines till 2y
  else if (4*28*lnw_px>12 || numlines<6*12*28) skip = 4*28  // 4m lines till 6 y
  else                                   skip = 12*28 // Yearly lines afterwards

  numlines = ceil( numlines/skip )
  //console.log(
  //  `DEBUG delta=${delta} lnw=${lnw} numlines=${numlines} \
  //  yrange=${yrange[0]},${yrange[1]}`)

  // glarr should have been generated by the call to maxVisibleDTD() above
  let arr = glarr.slice(0, numlines+1).map(d => (d+1)*skip-1)

  guideelt = guideelt.data(arr)
  guideelt.exit().remove()
  guideelt.enter().append("svg:path")
    .attr("class",           "guides")
    .attr("d",               buildPath)
    .attr("id",              (d)=>("g"+d))
    .attr("transform",       null)
  guideelt
     .attr("d",               buildPath)
     .attr("id",              (d)=>("g"+d))
     .attr("transform",       null)
}

function updateRazrRoad() {
  if (processing || opts.divGraph == null || road.length == 0) return

  // Razor line differs between the editor (dashed) and the graph (solid). Also,
  // the road editor shows the initial road as the razor road.
  if (opts.roadEditor)
    updateRedline(iroad, igoal, gRazr, "razr", 0, true)
  else
    updateRedline(road, gol, gRazr, "razr", 0, false)
}

function updateMaxFluxline() {
  if (processing || opts.divGraph == null || road.length == 0) return

  // Generate the maxflux line if maxflux!=0. Otherwise, remove existing one
  updateRedline(road, gol, gMaxflux, "maxflux", (gol.maxflux!=0)?gol.yaw*gol.maxflux:null, false)
}

function updateStdFluxline() {
  if (processing || opts.divGraph == null || road.length == 0) return

  // Generate the maxflux line if maxflux!=0. Otherwise, remove existing one
  updateRedline(road, gol, gStdflux, "stdflux", (gol.maxflux!=0)?gol.yaw*gol.stdflux:null, true)
}

  
function updateContextOldRoad() {
  if (processing || opts.divGraph == null || road.length == 0) return
  // Create, update, and delete road lines on the brush graph
  var roadelt = ctxplot.selectAll(".ctxoldroads")
  var rd = iroad
  // For non-editor graphs, use the most recent road
  if (!opts.roadEditor) rd = road
  var d = "M"+r1(xScB(rd[0].sta[0]*SMS))+" "
             +r1(yScB(rd[0].sta[1]))
  for (let i = 0; i < rd.length; i++) {
    d += " L"+r1(xScB(rd[i].end[0]*SMS))+" "
             +r1(yScB(rd[i].end[1]))
  }
  if (roadelt.empty()) {
    ctxplot.append("svg:path")
      .attr("class","ctxoldroads")
      .attr("d", d)
      .style("stroke-dasharray",
             (!opts.roadEditor)?null:(opts.oldRoadLine.ctxdash)+","
             +ceil(opts.oldRoadLine.ctxdash/2))
      .style("fill", "none")
      .style("stroke-width",opts.oldRoadLine.ctxwidth)
      .style("stroke", !opts.roadEditor ? bu.Cols.RAZR0
                                        : bu.Cols.ORNG) // TODO: don't need this
  } else {
    roadelt.attr("d", d)
      .style("stroke-dasharray",
             (!opts.roadEditor)?null:(opts.oldRoadLine.ctxdash)+","
             +ceil(opts.oldRoadLine.ctxdash/2))
      .style("stroke", !opts.roadEditor ? bu.Cols.RAZR0
                                        : bu.Cols.ORNG) // TODO: don't need this
  }
}

// Creates or updates vertical lines for odometer resets
function updateOdomResets() {
  if (processing || opts.divGraph == null || road.length == 0 || bbr.oresets.length == 0)
    return

  // Create, update and delete vertical knot lines
  var orelt = gOResets.selectAll(".oresets").data(bbr.oresets)
  if (opts.roadEditor) { orelt.remove(); return }
  orelt.exit().remove()
  orelt
    .attr("x1", function(d){ return nXSc(d*SMS) })
    .attr("y1", 0)
    .attr("x2", function(d){ return nXSc(d*SMS) })
    .attr("y2", plotbox.height)
  orelt.enter().append("svg:line")
    .attr("class","oresets")
    .attr("id", function(d,i) { return i })
    .attr("name", function(d,i) { return "oreset"+i })
    .attr("x1", function(d){ return nXSc(d*SMS) })
    .attr("y1", 0)
    .attr("x2", function(d){ return nXSc(d*SMS) })
    .attr("y2", plotbox.height)
    .attr("stroke", "rgb(200,200,200)") 
      .style("stroke-dasharray", 
             (opts.odomReset.dash)+","+(opts.odomReset.dash)) 
    .attr("stroke-width",opts.odomReset.width)
}

function updateKnots() {
  if (processing || opts.divGraph == null || road.length == 0) return
  // Create, update and delete vertical knot lines
  var knotelt = gKnots.selectAll(".knots").data(road)
  var knotrmelt = buttonarea.selectAll(".remove").data(road)
  if (!opts.roadEditor) {
    knotelt.remove()
    knotrmelt.remove()
    return
  }
  knotelt.exit().remove()
  knotelt
    .attr("x1", function(d){ return nXSc(d.end[0]*SMS)})
    .attr("y1", 0)
    .attr("x2", function(d){ return nXSc(d.end[0]*SMS)})
    .attr("y2", plotbox.height)
    .attr("stroke", "rgb(200,200,200)") 
    .attr("stroke-width",opts.roadKnot.width)
  knotelt.enter().append("svg:line")
    .attr("class","knots")
    .attr("id", function(d,i) {return i})
    .attr("name", function(d,i) {return "knot"+i})
    .attr("x1", function(d){ return nXSc(d.end[0]*SMS)})
    .attr("x2", function(d){ return nXSc(d.end[0]*SMS)})
    .attr("stroke", "rgb(200,200,200)")
    .attr("stroke-width",opts.roadKnot.width)
    .on('wheel', function(d) {
      // Redispatch a copy of the event to the zoom area
      var new_event = new d3.event.constructor(d3.event.type, d3.event)
      zoomarea.node().dispatchEvent(new_event)
      // Prevents mouse wheel event from bubbling up to the page
      d3.event.preventDefault()
    }, {passive:false})
    .on("mouseover",function(d,i) {
      if (!editingKnot && !editingDot && !editingRoad
         && !(selectType == br.RP.DATE && i == selection)) {
        highlightDate(i,true)
        d3.select(this)
          .attr("stroke-width",(opts.roadKnot.width+2))
      }})
    .on("mouseout",function(d,i) {
      if (!editingKnot && !editingDot && !editingRoad
         && !(selectType == br.RP.DATE && i == selection)) {
        highlightDate(i,false)
        d3.select(this)
          .attr("stroke-width",opts.roadKnot.width);
      }})
    .on("click", function(d,i) { 
      if (d3.event.ctrlKey) knotEdited(d,this.id);})
    .call(d3.drag()
          .on("start", knotDragStarted)
          .on("drag", knotDragged)
          .on("end", knotDragEnded))

  // Create, update and delete removal icons for knots
  knotrmelt.exit().remove()
  knotrmelt
  //                .attr("id", function(d,i) {return i;})
  //              .attr("name", function(d,i) {return "remove"+i;})
    .attr("transform", 
          function(d){ 
            return "translate("+(nXSc(d.end[0]*SMS)
                                 +plotpad.left-14*opts.roadKnot.rmbtnscale)
              +","+(plotpad.top-28*opts.roadKnot.rmbtnscale-3)+") scale("+opts.roadKnot.rmbtnscale+")";
          })
    .style("visibility", function(d,i) {
      return (i > 0 && i<road.length-2)
        ?"visible":"hidden";});
  knotrmelt.enter()
    .append("use")
    .attr("class", "remove")
    .attr("xlink:href", "#removebutton")
    .attr("id", function(d,i) {return i;})
    .attr("name", function(d,i) {return "remove"+i;})
    .attr("transform", 
          function(d){ 
            return "translate("+(nXSc(d.end[0]*SMS)
                                 +plotpad.left-14*opts.roadKnot.rmbtnscale)
              +","+(plotpad.top-28*opts.roadKnot.rmbtnscale-3)+") scale("+opts.roadKnot.rmbtnscale+")";
          })
    .style("visibility", function(d,i) {
      return (i > 0 && i < road.length-2)
        ?"visible":"hidden";})
    .on("mouseenter",function(d,i) {
      d3.select(this).attr("fill",opts.roadKnotCol.rmbtnsel); 
      highlightDate(i, true);})
    .on("mouseout",function(d,i) {
      d3.select(this).attr("fill",opts.roadKnotCol.rmbtns);
      highlightDate(i, false);})
    .on("click",knotDeleted);
}

function updateRoads() {
  if (processing || opts.divGraph == null || road.length == 0) return;
  //let valid = isRoadValid( road )
  //var lineColor = valid?opts.roadLineCol.valid:opts.roadLineCol.invalid;

  // Create, update and delete road lines
  var roadelt = gRoads.selectAll(".roads").data(road);
  if (!opts.roadEditor) {
    roadelt.remove();
    return;
  }
  roadelt.exit().remove();
  roadelt
    .attr("x1", function(d) { return nXSc(d.sta[0]*SMS) })
    .attr("y1", function(d) { return nYSc(d.sta[1]) })
    .attr("x2", function(d) { return nXSc(d.end[0]*SMS) })
    .attr("y2", function(d) { return nYSc(d.end[1]) })
    .attr("stroke-dasharray",
          function(d,i) { return (i==0||i==road.length-1)?"3,3":"none"})
    .style("stroke",opts.roadLineCol.invalid)
  roadelt.enter()
    .append("svg:line")
    .attr("class","roads")
    .attr("id",   function(d,i) { return i })
    .attr("name", function(d,i) { return "road"+i })
    .attr("x1",   function(d)   { return nXSc(d.sta[0]*SMS) })
    .attr("y1",   function(d)   { return nYSc(d.sta[1]) })
    .attr("x2",   function(d)   { return nXSc(d.end[0]*SMS) })
    .attr("y2",   function(d)   { return nYSc(d.end[1]) })
    .style("stroke", opts.roadLineCol.invalid)
    .attr("stroke-dasharray",
          function(d,i) { return (i==0||i==road.length-1)?"3,3":"none"})
    .attr("stroke-width",opts.roadLine.width)
    .on('wheel', function(d) { 
      // Redispatch a copy of the event to the zoom area
      var new_event = new d3.event.constructor(d3.event.type, d3.event)
      zoomarea.node().dispatchEvent(new_event)
      // Prevents mouse wheel event from bubbling up to the page
      d3.event.preventDefault()
    }, {passive:false})      
    .on("mouseover",function(d,i) { 
      if (!editingKnot && !editingDot && !editingRoad
         && !(selectType == br.RP.SLOPE && i == selection)) {
        if (i > 0 && i < road.length-1) {
          d3.select(this)
            .attr("stroke-width",(opts.roadLine.width+2));
          highlightSlope(i, true);}}})
    .on("mouseout",function(d,i) { 
      if (!editingKnot && !editingDot && !editingRoad
         && !(selectType == br.RP.SLOPE && i == selection)) {
        if (i > 0 && i < road.length-1) {
          d3.select(this)
            .attr("stroke-width",opts.roadLine.width);
          highlightSlope(i, false);}}})
    .on("click", function(d,i) { 
      if (d3.event.ctrlKey) roadEdited(d, this.id);})
    .call(d3.drag()
          .on("start", function(d,i) { 
            if (i > 0 && i < road.length-1) 
              roadDragStarted(d, Number(this.id));})
          .on("drag", function(d,i) { 
            if (i > 0 && i < road.length-1) 
              roadDragged(d, Number(this.id));})
          .on("end", function(d,i) { 
            if (i > 0 && i < road.length-1) 
              roadDragEnded(d, Number(this.id));}));
}

function updateRoadData() {
  // Recompute dtd array and isolines for the newly edited road. Cannot rely on
  // the beebrain object since its road object will be set to the newly edited
  // road later, once dragging is finished. If this is the first time the goal
  // is being loaded, we can rely on the beebrain object's computation.
  dtd = processing ? gol.dtdarray : br.dtdarray(road, gol)
  iso = []
  // Precompute first few isolines for dotcolor etc to rely on (was 5 not 7)
  for (let i = 0; i < 7; i++) iso[i] = br.isoline( road, dtd, gol, i)
}

function updateRoadValidity() {
  if (processing || opts.divGraph == null || road.length == 0) return
  if (!opts.roadEditor) return
  
  let valid = isRoadValid( road )
  //var lineColor = valid?opts.roadLineCol.valid:opts.roadLineCol.invalid

  if (!valid) gRedTape.attr('visibility', 'visible')
  else gRedTape.attr('visibility', 'hidden')
  
  // Create, update and delete road lines
  //var roadelt = gRoads.selectAll(".roads")
  //roadelt.style("stroke",lineColor)

  //roadelt = ctxplot.selectAll(".ctxroads")
  //roadelt.style("stroke",lineColor)
}

function updateContextRoads() {
  if (processing || opts.divGraph == null || road.length == 0) return
  var lineColor = isRoadValid( road )?
        opts.roadLineCol.valid:opts.roadLineCol.invalid

  // Create, update and delete road lines for the brush 
  var roadelt = ctxplot.selectAll(".ctxroads").data(road);
  if (!opts.roadEditor) {
    roadelt.remove()
    return
  }
  roadelt.exit().remove()
  roadelt
    .attr("x1", function(d){ return xScB(d.sta[0]*SMS)})
    .attr("y1",function(d){ return yScB(d.sta[1])})
    .attr("x2", function(d){ return xScB(d.end[0]*SMS)})
    .attr("y2",function(d){ return yScB(d.end[1])})
    .style("stroke", lineColor);
  roadelt.enter()
    .append("svg:line")
    .attr("class","ctxroads")
    .attr("id", function(d,i) {return i})
    .attr("name", function(d,i) {return "ctxroad"+i})
    .attr("x1", function(d){ return xScB(d.sta[0]*SMS)})
    .attr("y1",function(d){ return yScB(d.sta[1])})
    .attr("x2", function(d){ return xScB(d.end[0]*SMS)})
    .attr("y2",function(d){ return yScB(d.end[1])})
    .style("stroke", lineColor)
    .style("stroke-width",opts.roadLine.ctxwidth)
}

function updateDots() {
  if (processing || opts.divGraph == null) return
  // Create, update and delete inflection points
  var dotelt = gDots.selectAll(".dots").data(road)
  if (!opts.roadEditor) {
    dotelt.remove()
    return
  }
  dotelt.exit().remove()
  dotelt
    .attr("cx", function(d) { return r1(nXSc(d.sta[0]*SMS)) })
    .attr("cy", function(d) { return r1(nYSc(d.sta[1])) })
  dotelt.enter().append("svg:circle")
    .attr("class","dots")
    .attr("id",   function(d,i) { return i-1 })
    .attr("name", function(d,i) { return "dot"+(i-1) })
    .attr("cx",   function(d) { return r1(nXSc(d.sta[0]*SMS)) })
    .attr("cy",   function(d)  { return r1(nYSc(d.sta[1])) })
    .attr("r", r3(opts.roadDot.size))
    .attr("fill", opts.roadDotCol.editable)
    .style("stroke-width", opts.roadDot.border) 
    .on('wheel', function(d) {
      // Redispatch a copy of the event to the zoom area
      var new_event = new d3.event.constructor(d3.event.type, d3.event)
      zoomarea.node().dispatchEvent(new_event)
      // Prevents mouse wheel event from bubbling up to the page
      d3.event.preventDefault()
    }, {passive:false})
    .on("mouseover",function(d,i) { 
      if (!editingKnot && !editingDot && !editingRoad
          && !(selectType == br.RP.VALUE && i-1 == selection)) {
        highlightValue(i-1, true)
        d3.select(this).attr("r", r3(opts.roadDot.size+2))
      }})
    .on("mouseout",function(d,i) { 
      if (!editingKnot && !editingDot && !editingRoad
          && !(selectType == br.RP.VALUE && i-1 == selection)) {
        highlightValue(i-1, false)
        d3.select(this).attr("r", r3(opts.roadDot.size))
      }})
    .on("click", function(d,i) { 
      if (d3.event.ctrlKey) dotEdited(d,this.id)})
    .call(d3.drag()
          .on("start", function(d,i) { 
            dotDragStarted(d, Number(this.id))})
          .on("drag", function(d,i) { 
            dotDragged(d, Number(this.id))})
          .on("end", function(d,i) { 
            dotDragEnded(d, Number(this.id))}))
}
function updateContextDots() {
  if (processing || opts.divGraph == null) return;
  // Create, update and delete inflection points
  var dotelt = ctxplot.selectAll(".ctxdots").data(road);
  if (!opts.roadEditor) {
    dotelt.remove();
    return;
  }
  dotelt.exit().remove();
  dotelt
    .attr("cx", function(d) { return r1(xScB(d.sta[0]*SMS)) })
    .attr("cy",function(d)  { return r1(yScB(d.sta[1])) })
  dotelt.enter().append("svg:circle")
    .attr("class","ctxdots")
    .attr("r", r3(opts.roadDot.ctxsize))
    .attr("fill", opts.roadDotCol.editable)
    .style("stroke-width", opts.roadDot.ctxborder)
    .attr("cx", function(d) { return r1(xScB(d.sta[0]*SMS)) })
    .attr("cy", function(d) { return r1(yScB(d.sta[1])) })
}

let styleLookup = {}
styleLookup[bu.Cols.GRADOT] = " gra",
styleLookup[bu.Cols.GRNDOT] = " grn",
styleLookup[bu.Cols.BLUDOT] = " blu",
styleLookup[bu.Cols.ORNDOT] = " orn",
styleLookup[bu.Cols.REDDOT] = " red",
styleLookup[bu.Cols.BLCK]   = " blk"

function dpStyle( pt ) {
  let sty = ""
  let col = br.dotcolor(road, gol, pt[0], pt[1], iso) 
  if (pt[3] != bbr.DPTYPE.AGGPAST) sty += " fuda"
  sty += styleLookup[col]
  return  sty
}
function dpFill( pt ) {
  return br.dotcolor(road, gol, pt[0], pt[1], iso)
}
function dpFillOp( pt ) {
  return (pt[3] == bbr.DPTYPE.AGGPAST)?null:0.3
}
function dpStrokeWidth( pt ) {
  return (((pt[3] == bbr.DPTYPE.AGGPAST)?1:0.5)*scf)+"px"
}

var dotTimer = null, dotText = null
function showDotText(d) {
  var ptx = nXSc(bu.daysnap(d[0])*SMS)
  var pty = nYSc(d[1])
  var txt = ((d[7]!=null)?"#"+d[7]+": ":"")          // datapoint index
      +moment.unix(d[0]).utc().format("YYYY-MM-DD")  // datapoint time
    +", "+((d[6] != null)?bu.shn(d[6]):bu.shn(d[1])) // datapoint original value
  if (dotText != null) rmTextBox(dotText)
  var info = []
  if (d[2] !== "") info.push("\""+d[2]+"\"")
  if (d[6] !== null && d[1] !== d[6]) info.push("total:"+d[1])
  var col = br.dotcolor(road, gol, d[0], d[1], iso)
  dotText = createTextBox(ptx, pty-(15+18*info.length), txt, col, info )
};
function removeDotText() { rmTextBox(dotText) }

// grp: Container group for the datapoints
  // d: data
  // cls: Class name for selection and creation
  // r: circle radius
  // s: stroke
  // sw: stroke-width
  // f: fill
  // hov: hover support (boolean)
  // fop: fill-opacity
  // nc: new element class
function updateDotGroup(grp,d,cls,nc=null,hov=true) {
  let dpelt

  if (nc == null) nc = cls // Temporary
  
  dpelt = grp.selectAll("."+cls).data(d)
  dpelt.exit().remove()
  dpelt
    .attr("cx", function(d) { return r1(nXSc((d[0])*SMS)) })
    .attr("cy", function(d) { return r1(nYSc(d[1])) })
    .attr("class", nc)
  
  var dots = dpelt.enter().append("svg:circle")
  
    dots.attr("class", nc)
      .attr("cx", function(d) { return r1(nXSc((d[0])*SMS)) })
      .attr("cy", function(d) { return r1(nYSc(d[1])) })
  if (!opts.headless) {
    dots
      .on('wheel', function(d) { 
        // Redispatch a copy of the event to the zoom area
        var new_event = new d3.event.constructor(d3.event.type, d3.event)
        zoomarea.node().dispatchEvent(new_event)
        // Prevents mouse wheel event from bubbling up to the page
        d3.event.preventDefault()
      }, {passive:false})
      .on("mouseenter",function(d) {
        if (opts.divData != null && opts.dataAutoScroll && d[7]!=null)
          selectDataIndex(d[7])
        if (dotTimer != null) window.clearTimeout(dotTimer);
        dotTimer = window.setTimeout(function() {
          showDotText(d); dotTimer = null;
        }, 500);})
      .on("mouseout",function() { 
        unselectDataIndex()
        if (dotText != null) {
          removeDotText();
          dotText = null;
        }
        window.clearTimeout(dotTimer); dotTimer = null;});
  }
}

function updateRosy() {
  if (processing || opts.divGraph == null || opts.roadEditor) return;

  var l = [nXSc.invert(0).getTime()/SMS, 
           nXSc.invert(plotbox.width).getTime()/SMS];
  var df = function(d) {
    return ((d[0] >= l[0] && d[0] <= l[1]) || (d[4] >= l[0] && d[4] <= l[1]));
  }

  // *** Plot rosy lines ***
  var rosyelt = gRosy.selectAll(".rosy")
  var rosydelt = gRosyPts.selectAll(".rd")
  if (opts.showData || !opts.roadEditor) {
    if (gol.rosy) {
      var pts = (bbr.flad != null)
          ?bbr.rosydata.slice(0,bbr.rosydata.length-1):bbr.rosydata
      var npts = pts.filter(df), i
      if (bbr.rosydata.length == 0) {
        // no points are in range, find enclosing two
        var ind = -1;
        for (i = 0; i < bbr.rosydata.length-1; i++) {
          if (bbr.rosydata[i][0]<=l[0]&&bbr.rosydata[i+1][0]>=l[1]) {
            ind = i; break;
          }
        }
        if (ind > 0) npts = bbr.rosydata.slice(ind, ind+2)
      }
      if (npts.length != 0) {
        let d = "M"+r1(nXSc(npts[0][4]*SMS))+" "+r1(nYSc(npts[0][5]))
        for (i = 0; i < npts.length; i++) {
          d += " L"+r1(nXSc(npts[i][0]*SMS))+" "+ r1(nYSc(npts[i][1]))
        }
        if (rosyelt.empty()) {
          gRosy.append("svg:path")
            .attr("class","rosy")
            .attr("d", d)
        } else
          rosyelt.attr("d", d)
          
      } else rosyelt.remove();
      // Rosy dots
      updateDotGroup(gRosyPts, npts, "rd", "rd", true)
    } else {
      rosyelt.remove()
      rosydelt.remove()
    }
  } else {
    rosyelt.remove()
    rosydelt.remove()
  }
}

function updateSteppy() {
  if (processing || opts.divGraph == null) return
  const xmin = nXSc.invert(            0).getTime()/SMS
  const xmax = nXSc.invert(plotbox.width).getTime()/SMS
  const df = function(d) {
    return d[0] >= xmin && d[0] <= xmax ||
           d[4] >= xmin && d[4] <= xmax
  }
  // *** Plot steppy lines ***
  let stpelt  = gSteppy.selectAll(".steppy")
  let stpdelt = gSteppyPts.selectAll(".std")
  if (opts.showData || !opts.roadEditor) {
    if (!opts.roadEditor && gol.steppy && dataf.length !== 0) {
      const npts = dataf.filter(df)
      let i
      if (npts.length === 0) {
        // no points are in range, find enclosing two
        let ind = -1
        for (i = 0; i < dataf.length-1; i++) {
          if (dataf[i][0]   <= xmin && 
              dataf[i+1][0] >= xmax) { ind = i; break }
        }
        if (ind > 0) npts = dataf.slice(ind, ind+2)
      }
      if (npts.length !== 0) {
        let d
        if (dataf[0][0] > xmin && 
            dataf[0][0] < xmax && 
            dataf[0][0] in bbr.allvals) {
          const vpre = bbr.allvals[dataf[0][0]][0][1] // initial datapoint
          d =  "M"+r1(nXSc(dataf[0][0]*SMS))+" "+r1(nYSc(vpre))
          d += "L"+r1(nXSc(npts[0][4]*SMS))+" "+r1(nYSc(npts[0][5]))
        } else {
          d =  "M"+r1(nXSc(npts[0][4]*SMS))+" "+r1(nYSc(npts[0][5]))
        }
        for (i = 0; i < npts.length; i++) {
          d += " L"+r1(nXSc(npts[i][0]*SMS))+" "+ r1(nYSc(npts[i][5]))
          d += " L"+r1(nXSc(npts[i][0]*SMS))+" "+ r1(nYSc(npts[i][1]))
        }
        if (stpelt.empty()) {
          gSteppy.append("svg:path")
            .attr("class","steppy")
            .attr("d", d)
        } else
          stpelt.attr("d", d)

        // Need additional vertical steppy for do-less flatlined datapoints
        let stppprelt = gSteppy.selectAll(".steppyppr")
        if (bbr.flad !== null) {
          if (gol.yaw*gol.dir < 0 && gol.asof !== gol.tdat) {
            const fy = bbr.flad[1] + br.ppr(road, gol, gol.asof)
            d = "M"+r1(nXSc(npts[npts.length-1][0]*SMS))+" "
                   +r1(nYSc(npts[npts.length-1][1]))
            d+=" L"+r1(nXSc(npts[npts.length-1][0]*SMS))+" "+r1(nYSc(fy))
            if (stppprelt.empty()) {
              gSteppy.append("svg:path")
                .attr("class","steppyppr").attr("d", d)
            } else
              stppprelt.attr("d", d)
          } else stppprelt.remove()
        } else stppprelt.remove()
        
      } else stpelt.remove()
      // Steppy points
      updateDotGroup(gSteppyPts, bbr.flad ? npts.slice(0, npts.length-1) : npts,
                     "std", "std", true)
    } else {
      stpelt.remove()
      stpdelt.remove()
    }
  } else {
    stpelt.remove()
    stpdelt.remove()
  }
}

function updateDerails() {
  if (processing || opts.divGraph == null) return

  var l = [nXSc.invert(0).getTime()/SMS, 
           nXSc.invert(plotbox.width).getTime()/SMS]
  
  function ddf(d) {// Filter to extract derailments
    return (d[0] >= l[0] && d[0] <= l[1])
  }

  var drelt
  // *** Plot derailments ***
  if (opts.showData || !opts.roadEditor) {
    var drpts = bbr.derails.filter(ddf)
    var arrow = (gol.yaw>0)?"#downarrow":"#uparrow"
    drelt = gDerails.selectAll(".derails").data(drpts)
    drelt.exit().remove()
    drelt
      .attr("transform", function(d){return "translate("+(nXSc((d[0])*SMS))+","
                                      +nYSc(d[1])+"),scale("
                                      +(opts.dataPoint.fsize*scf/24)+")"})
  
    drelt.enter().append("svg:use")
      .attr("class","derails")
      .attr("xlink:href", arrow)
      .attr("transform", function(d){return "translate("+(nXSc((d[0])*SMS))+","
                                      +nYSc(d[1])+"),scale("
                                      +(opts.dataPoint.fsize*scf/24)+")"})
  } else {
    drelt = gDerails.selectAll(".derails")
    drelt.remove()
  }        
}

function updateDataPoints() {
  if (processing || opts.divGraph == null || road.length == 0) return
  //console.debug("id="+curid+", updateDataPoints()");
  var l = [nXSc.invert(0).getTime()/SMS, 
           nXSc.invert(plotbox.width).getTime()/SMS]
  // Filter to apply to normal datapoints
  var df = function(d) {
    return ((d[0] >= l[0] && d[0] <= l[1]) || (d[4] >= l[0] && d[4] <= l[1]))
  }
  // Filter to apply to all datapoints
  var adf = function(d) {
    return (d[0] >= l[0] && d[0] <= l[1])
  }
  var now = gol.asof
  var dpelt
  if (opts.showData || !opts.roadEditor) {
    var pts = bbr.flad != null ? dataf.slice(0, dataf.length-1) : dataf
    
    // *** Plot datapoints ***
    // Filter data to only include visible points
    pts = pts.filter(df);
    if (gol.plotall && !opts.roadEditor) {
      // All points
      updateDotGroup(gAllpts, alldataf.filter(adf), "ap", d=>("ap"+dpStyle(d)), true)
      
    } else {
      var el = gAllpts.selectAll(".ap");
      el.remove();
    }
    if (opts.roadEditor)
      updateDotGroup(gDpts, pts.concat(bbr.fuda), "dp", d=>("dp"+dpStyle(d)), true)
    else {
      updateDotGroup(gDpts, pts.concat(bbr.fuda), "dp", d=>("dp"+dpStyle(d)), true)
      // hollow datapoints
      updateDotGroup(gHollow, bbr.hollow.filter(df), "hp", d=>("hp"+dpStyle(d)), true)
    }
      
    // *** Plot flatlined datapoint ***
    var fladelt = gFlat.selectAll(".fladp");
    if (bbr.flad != null) {
      const ppr = br.ppr(road, gol, gol.asof)
      const flady = bbr.flad[1] + ppr
      const fop = ppr == 0 ? 1.0 : 0.5 // ghosty iff there's a PPR
      if (fladelt.empty()) {
        gFlat.append("svg:use")
          .attr("class","fladp").attr("xlink:href", "#rightarrow")
          .attr("fill", br.dotcolor(road,gol,bbr.flad[0],flady, iso))
          .attr("fill-opacity", fop)
          .attr("transform", "translate("+(nXSc((bbr.flad[0])*SMS))+","
                +nYSc(flady)+"),scale("+(opts.dataPoint.fsize*scf/24)+")")
          .style("pointer-events", function() {
            return (opts.roadEditor)?"none":"all";})
          .on("mouseenter",function() {
            if (dotTimer != null)  window.clearTimeout(dotTimer);
            dotTimer = window.setTimeout(function() {
              showDotText(bbr.flad); dotTimer = null;}, 500);})
          .on("mouseout",function() { 
            if (dotText != null) { removeDotText(); dotText = null; }
            window.clearTimeout(dotTimer); 
            dotTimer = null;});
      } else {
        fladelt
          .attr("fill", br.dotcolor(road,gol,bbr.flad[0],flady, iso))
          .attr("fill-opacity", fop)
          .attr("transform", 
                "translate("+(nXSc((bbr.flad[0])*SMS))+","
                +nYSc(flady)+"),scale("
                +(opts.dataPoint.fsize*scf/24)+")");
      }
    } else {
      if (!fladelt.empty()) fladelt.remove()
    }
    
  } else {
    dpelt = gDpts.selectAll(".dp");
    dpelt.remove();
    fladelt = gDpts.selectAll(".fladp");
    fladelt.remove();
  }
}

function updateHashtags() {
  if (processing || opts.divGraph == null) return
  
  var hashel
  //if (!opts.roadEditor) {
    hashel = gHashtags.selectAll(".hashtag").data(bbr.hashtags);
    hashel.exit().remove();
    hashel
      .attr("x", function(d){ return nXSc((d[0])*SMS);})
      .attr("transform", d=>("rotate(-90,"+nXSc((d[0])*SMS)
                             +","+(plotbox.height/2)+")"))
      .text(d=>(d[1]))
    hashel.enter().append("svg:text")
      .attr("class","hashtag")
      .attr("x", d=>(nXSc((d[0])*SMS)))
      .attr("y", plotbox.height/2)
      .attr("transform", 
        d => ("rotate(-90,"+nXSc((d[0])*SMS)+","+(plotbox.height/2)+")"))
      .attr("fill", bu.Cols.BLACK) 
      .style("font-size", opts.horizon.font+"px") 
      .text(d => (d[1]))
    
  //} else {
  //  hashel = gHashtags.selectAll(".hashtag")
  //  hashel.remove()
  //}
}


// Other ideas for data smoothing...  Double Exponential
// Moving Average: http://stackoverflow.com/q/5533544 Uluc
// notes that we should use an acausal filter to prevent the
// lag in the thin purple line.
function updateMovingAv() {
  if (processing) return;
  
  var el = gMovingAv.selectAll(".movingav");
  if (!opts.roadEditor && gol.movingav && opts.showData) {
    var l = [nXSc.invert(0).getTime()/SMS, 
             nXSc.invert(plotbox.width).getTime()/SMS];
    var rdfilt = function(r) {
      return ((r.sta[0] > l[0] && r.sta[0] < l[1])
              || (r.end[0] > l[0] && r.end[0] < l[1]));
    };
    var pts = gol.filtpts.filter(function(e){
      return (e[0] > l[0]-2*SID && e[0] < l[1]+2*SID);});
    if (pts.length > 0){
      var d = "M"+r1(nXSc(pts[0][0]*SMS))+" "+r1(nYSc(pts[0][1]))
      for (let i = 1; i < pts.length; i++) {
        d += " L"+r1(nXSc(pts[i][0]*SMS))+" "+r1(nYSc(pts[i][1]))
      }
      if (el.empty()) {
        gMovingAv.append("svg:path")
          .attr("class","movingav")
          .attr("d", d)
          .style("fill", "none")
          .attr("stroke-width",r3(3*scf))
          .style("stroke", bu.Cols.PURP)
      } else {
        el.attr("d", d)
          .attr("stroke-width",r3(3*scf))
      }
    } else el.remove();
  } else {
    el.remove();
  }
}

// Create the table header and body to show road segments
var tcont, thead, tbody;
function createRoadTable() {
  d3.select(opts.divTable).attr("class", "bmndrroad")
  // The main road table doe not have a header
  tcont = d3.select(opts.divTable).select(".rtbmain");
  thead = d3.select(opts.divTable).select(".rtable");
  tbody = thead.append('div').attr('class', 'roadbody');
}

// Create the table header and body to show the start node
var sthead, stbody, sttail
const rtbccls = ["dt", "vl", "sl"]
function createStartTable() {
  var startcolumns, tailcolumns;
  if (opts.roadEditor) {
    startcolumns = ['', 'Start Date', 'Value', '', '']
    tailcolumns = ['', 'End Date', 'Value', 'Daily Slope', '']
  } else {
    startcolumns = ['', 'Start Date', 'Value', '']
    tailcolumns = ['', 'End Date', 'Value', 'Daily Slope']
  }    
  sthead = d3.select(opts.divTable).select(".rtbstart")
  sthead.append("div").attr('class', 'roadhdr')
    .append("div").attr('class', 'roadhdrrow')
    .selectAll("span.rdhdrcell").data(startcolumns)
    .enter().append('span').attr('class', (d,i)=>('rdhdrcell '+rtbccls[i]))
    .text((c)=>c);
  stbody = sthead.append('div').attr('class', 'roadbody'); 
  sttail = sthead.append("div").attr('class', 'roadhdr');
  sttail.append("div").attr('class', 'roadhdrrow')
    .selectAll("span.rdhdrcell").data(tailcolumns)
    .enter().append('span').attr('class', (d,i)=>('rdhdrcell '+rtbccls[i]))
    .text((c)=>c);
}

// Create the table header and body to show the goal node
var ghead, gbody
function createGoalTable() {
  var goalcolumns
  if (opts.roadEditor)
    goalcolumns = ['', 'Goal Date', 'Value', 'Daily Slope', '', '']
  else goalcolumns = ['', 'Goal Date', 'Value', 'Daily Slope']

  ghead = d3.select(opts.divTable).select(".rtbgoal");
  ghead.append("div").attr('class', 'roadhdr')
    .append("div").attr('class', 'roadhdrrow')
    .selectAll("span.rdhdrcell").data(goalcolumns)
    .enter().append('span').attr('class', (d,i)=>('rdhdrcell '+rtbccls[i]))
    .text((c)=>c)
  gbody = ghead.append('div').attr('class', 'roadbody');
}

function updateTableTitles() {
  if (opts.divTable == null) return;
  var ratetext = "Daily Slope";
  if (gol.runits === 'h') ratetext = "Hourly Slope";
  if (gol.runits === 'd') ratetext = "Daily Slope";
  if (gol.runits === 'w') ratetext = "Weekly Slope";
  if (gol.runits === 'm') ratetext = "Monthly Slope";
  if (gol.runits === 'y') ratetext = "Yearly Slope";

  var roadcolumns, goalcolumns
  if (opts.roadEditor) {
    roadcolumns = ['', 'End Date',  'Value', ratetext, '', '']
    goalcolumns = ['', 'Goal Date', 'Value', ratetext, '', '']
  } else {
    roadcolumns = ['', 'End Date',  'Value', ratetext]
    goalcolumns = ['', 'Goal Date', 'Value', ratetext]
  }    
  sttail.selectAll("span.rdhdrcell").data(roadcolumns).text((c)=>c)
  thead.selectAll("span.rdhdrcell").data(roadcolumns).text((c)=>c)
  ghead.selectAll("span.rdhdrcell").data(goalcolumns).text((c)=>c)

  updateTableWidths()
}

let datePicker = null
function destroyDatePicker() {
  if (datePicker != null) {
    if (datePicker.picker) datePicker.picker.destroy()
    datePicker = null
  }
}

// flt: floating element that will contain the date picker
// tl: absolutely positioned "topleft" element that will act as a reference for the floating element,
// fld: d3 selection for the field that holds the date
function createDatePicker(fld, min, max, flt, tl) {
  console.log("createDatePicker()"+min)
  destroyDatePicker()
  datePicker = {
    min: min,
    max: max,
    flt: flt,
    tl: tl,
    fld: fld,
    oldText: fld.text()
  }
  if (onMobileOrTablet()) {
    // Some sort of workaround on mobile browser focus behavior?
    fld.attr("contenteditable", false)
    setTimeout(function() {
      fld.attr("contenteditable", true)}, 100);
  }
  let md = moment(datePicker.oldText)
  datePicker.picker = new Pikaday({
    keyboardInput: false,
    onSelect: function(date) {
      var newdate = datePicker.picker.toString()
      var val = bu.dayparse(newdate, '-')
      if (newdate === datePicker.oldText) return
      if (!isNaN(val)) {
        datePicker.fld.text(newdate)
        datePicker.oldText = newdate
        destroyDatePicker()
        document.activeElement.blur()
      }
    },
    minDate: min,
    maxDate: max
  })
  datePicker.picker.setMoment(md)
  var bbox = fld.node().getBoundingClientRect();
  var tlbox = tl.node().getBoundingClientRect();
  flt
    .style('left', (bbox.right-tlbox.left)+"px")
    .style('top', (bbox.bottom+3-tlbox.top)+"px");
  flt.node().appendChild(datePicker.picker.el, fld.node())
}
   
// Focused field information for the road table
let rdFocus = {
  field: null,
  oldText : null,
}
   
function tableFocusIn( d, i ){
  if (!opts.roadEditor) return;
  console.debug('tableFocusIn('+i+') for '+this.parentNode.id);
  rdFocus.field = d3.select(this);
  rdFocus.oldText = rdFocus.field.text();
  destroyDatePicker()

  var kind = Number(rdFocus.field.node().parentNode.id);
  if (selection != null) clearSelection();
  if (i == 0) {
    selectKnot(kind, false)

    var knotmin = (kind == 0) ? gol.xMin-10*SID*DIY : (road[kind].sta[0])
    var knotmax = (kind == road.length-1) ? road[kind].end[0]
                                          : (road[kind+1].end[0])
    // Switch all dates to local time to babysit Pikaday
    var mindate = moment(moment.unix(knotmin).utc().format("YYYY-MM-DD"))
    var maxdate = moment(moment.unix(knotmax).utc().format("YYYY-MM-DD"))
    var floating = d3.select(opts.divTable).select('.floating');
    createDatePicker(rdFocus.field, mindate.toDate(), maxdate.toDate(), floating, topLeft)
  } else if (i == 1) {
    selectDot(kind, false)
  } else if (i == 2) {
    selectRoad(kind, false)
  }
}

function tableFocusOut( d, i ){
  if (!opts.roadEditor) return;
  //console.debug('tableFocusOut('+i+') for '+this.parentNode.id);
  let kind = Number(this.parentNode.id)
  let text = d3.select(this).text()
  destroyDatePicker()
  clearSelection()
  if (text === rdFocus.oldText) return
  if (rdFocus.oldText == null) return // ENTER must have been hit
  let val = (i==0 ? bu.dayparse(text, '-') : text)
  if (isNaN(val)) {
    d3.select(this).text(rdFocus.oldText)
    rdFocus.oldText = null
    rdFocus.field = null
    return
  }
  if (i == 0) { tableDateChanged(  kind, val);  clearSelection() }
  if (i == 1) { tableValueChanged( kind, val);  clearSelection() }
  if (i == 2) { tableSlopeChanged( kind, val);  clearSelection() }
  rdFocus.oldText = null
  rdFocus.field = null
}
function tableKeyDown( d, i ){
  if (d3.event.keyCode == 13) {
    window.getSelection().removeAllRanges()
    var text = d3.select(this).text()
    var val = (i==0 ? bu.dayparse(text, '-') : text)
    if (isNaN(val)) {
      d3.select(this).text(rdFocus.oldText)
      rdFocus.oldText = null
      return
    }
    if (i == 0) tableDateChanged(  Number(this.parentNode.id), val)
    if (i == 1) tableValueChanged( Number(this.parentNode.id), val)
    if (i == 2) tableSlopeChanged( Number(this.parentNode.id), val)
    rdFocus.oldText = d3.select(this).text()
  }
}
function tableClick( d, i ){
  var id = Number(this.parentNode.id)
  if (opts.roadEditor && i == road[id].auto) {
    if (i == 0) disableValue(id)
    else if (i == 1) disableSlope(id)
    else if (i == 2) disableDate(id)
    this.focus()
  }
}

function tableDateChanged( row, value ) {
  //console.debug("tableDateChanged("+row+","+value+")");
  if (isNaN(value)) updateTableValues();
  else changeKnotDate( row, Number(value), true );
}
function tableValueChanged( row, value ) {
  //console.debug("tableValueChanged("+row+","+value+")");
  if (isNaN(value)) updateTableValues();
  else changeDotValue( row, Number(value), true );
}
function tableSlopeChanged( row, value ) {
  //console.debug("tableSlopeChanged("+row+")");
  if (isNaN(value)) updateTableValues();
  else changeRoadSlope( row, Number(value), true );
}

  function autoScroll( elt, force = true ) {
  if (opts.tableAutoScroll && selection == null && opts.tableHeight !== 0) {
    let rect = elt.node().parentNode.getBoundingClientRect()
    if (rect.height == 0) return // Table is most likely invisible
    let eltdata = elt.data(), eh = (rect.height+1)//+1 table border-spacing
    let eind = (eltdata[0].i-1),  topPos = eind*eh
    if (opts.divTable != null) {
      let nd = tcont.node()
      let offset = (eind - Math.floor(nd.scrollTop / eh))*eh
      if (force || (offset < 0 || offset-eh > opts.tableHeight))
        nd.scrollTop = topPos-opts.tableHeight/2
    }
  }
}
/** Highlights the date for the ith knot if state=true. Normal color otherwise*/
function highlightDate(i, state, scroll = true) {
  if (opts.divTable == null) return;
  let color = (state)
      ?opts.roadTableCol.bgHighlight:
      (road[i].auto==0?opts.roadTableCol.bgDisabled:opts.roadTableCol.bg);
  let elt = d3.select(opts.divTable)
      .select('.roadrow [name=enddate'+i+']');
  if (elt.empty()) return;
  elt.style('background-color', color);
  if (scroll && state) autoScroll(elt);
}
function highlightValue(i, state, scroll = true) {
  if (opts.divTable == null) return;
  var color = (state)
        ?opts.roadTableCol.bgHighlight:
        (road[i].auto==1?opts.roadTableCol.bgDisabled:opts.roadTableCol.bg);
  var elt = d3.select(opts.divTable)
        .select('.roadrow [name=endvalue'+i+']');
  if (elt.empty()) return;
  elt.style('background-color', color);
  if (scroll && state) autoScroll(elt);
}
function highlightSlope(i, state, scroll = true) {
  if (opts.divTable == null) return;
  var color = (state)
        ?opts.roadTableCol.bgHighlight:
        (road[i].auto==2?opts.roadTableCol.bgDisabled:opts.roadTableCol.bg);
  var elt = d3.select(opts.divTable)
        .select('.roadrow [name=slope'+i+']');
  if (elt.empty()) return;
  elt.style('background-color', color);  
  if (scroll && state) autoScroll(elt);
}
function disableDate(i) {
  road[i].auto=br.RP.DATE;
  var dt = d3.select(opts.divTable);
  dt.select('.roadrow [name=enddate'+i+']')
    .style('color', opts.roadTableCol.textDisabled)
    .style('background-color', opts.roadTableCol.bgDisabled)
    .attr('contenteditable', false);  
  dt.select('.roadrow [name=endvalue'+i+']')
    .style('color', opts.roadTableCol.text)
    .style('background-color', opts.roadTableCol.bg)
    .attr('contenteditable', opts.roadEditor);  
  dt.select('.roadrow [name=slope'+i+']')
    .style('color', opts.roadTableCol.text)
    .style('background-color', opts.roadTableCol.bg)
    .attr('contenteditable', opts.roadEditor);  
  dt.select('.roadrow [name=btndate'+i+']')
    .property('checked', true);  
  dt.select('.roadrow [name=btnvalue'+i+']')
    .property('checked', false);  
  dt.select('.roadrow [name=btnslope'+i+']')
    .property('checked', false);  
}
function disableValue(i) {
  road[i].auto=br.RP.VALUE;
  var dt = d3.select(opts.divTable);
  dt.select('.roadrow [name=enddate'+i+']')
    .style('color', opts.roadTableCol.text)
    .style('background-color', opts.roadTableCol.bg)
    .attr('contenteditable', opts.roadEditor);  
  dt.select('.roadrow [name=endvalue'+i+']')
    .style('color', opts.roadTableCol.textDisabled)
    .style('background-color', opts.roadTableCol.bgDisabled)
    .attr('contenteditable', false);  
  dt.select('.roadrow [name=slope'+i+']')
    .style('color', opts.roadTableCol.text)
    .style('background-color', opts.roadTableCol.bg)
    .attr('contenteditable', opts.roadEditor);  
  dt.select('.roadrow [name=btndate'+i+']')
    .property('checked', false);  
  dt.select('.roadrow [name=btnvalue'+i+']')
    .property('checked', true);  
  dt.select('.roadrow [name=btnslope'+i+']')
    .property('checked', false);  
}
function disableSlope(i) {
  road[i].auto=br.RP.SLOPE;
  var dt = d3.select(opts.divTable);
  dt.select('.roadrow [name=enddate'+i+']')
    .style('color', opts.roadTableCol.text)
    .style('background-color', opts.roadTableCol.bg)
    .attr('contenteditable', opts.roadEditor);  
  dt.select('.roadrow [name=endvalue'+i+']')
    .style('color', opts.roadTableCol.text)
    .style('background-color', opts.roadTableCol.bg)
    .attr('contenteditable', opts.roadEditor);  
  dt.select('.roadrow [name=slope'+i+']')
    .style('color', opts.roadTableCol.textDisabled)
    .style('background-color', opts.roadTableCol.bgDisabled)
    .attr('contenteditable', false);  
  dt.select('.roadrow [name=btndate'+i+']')
    .property('checked', false);  
  dt.select('.roadrow [name=btnvalue'+i+']')
    .property('checked', false);  
  dt.select('.roadrow [name=btnslope'+i+']')
    .property('checked', true);  
}

function updateTableButtons() {
  if (opts.divTable == null) return
  // Update buttons on all rows at once, including the start node.
  var allrows = d3.select(opts.divTable)
        .selectAll(".rtbstart .roadrow, .rtable .roadrow, .rtbgoal .roadrow")
  var btncells = allrows.selectAll(".rdbtn")
        .data(function(row, i) {
          // The table row order is reversed, which means that the
          // last road segment comes in the first row.  We need to
          // compute knot index accordingly
          var kind
          if (opts.reverseTable) kind = road.length-2-i
          else kind = i
          return [
            {order: 8, row:kind, name: "btndel"+kind, evt: ()=>removeKnot(kind,false), 
             type: 'button', txt: '<img class="ricon" src="../src/trash.svg" ></img>', auto: false},
            {order: 9, row:kind, name: "btnadd"+kind, evt: ()=>addNewKnot(kind+1),
             type: 'button', txt: '<img class="ricon" src="../src/plus.svg"></img>', auto: false},
          ];
        })
  
  var newbtncells = btncells.enter().append("button")
      .attr('class', (d)=>('rdbtn '+d.txt))
      .attr('id',   (d) => d.row)
      .attr('name', (d) => d.name)
      .html((d) => { 
        return d.txt
      })
      .on('click', (d) => d.evt())
  
  btncells.exit().remove()
  btncells = allrows.selectAll(
    ".rtbstart .rdbtn, .rtable .rdbtn, .rtbgoal .rdbtn")
  btncells
    .attr('id', (d)=>d.row)
    .attr('name', (d)=>d.name)
    .style('display', (d,i) =>
           (((Number(d.row)>0 && Number(d.row)<(road.length-2)) 
             || i==4 
             || (i>0 && Number(d.row)>0 ))?null:"none")
          )

  allrows.selectAll(".rdcell, .rdbtn")
    .sort((a,b)=>d3.ascending(a.order,b.order))

  if (!opts.roadEditor) {
    allrows.selectAll(".rdbtn").style('display', "none")
      .attr("value","")
  }
}

function updateRowValues( elt, s, e, rev ) {
  var data = road.slice(s, e)
  if (rev) data = data.reverse()
  var rows = elt.selectAll(".roadrow").data( data )
  var ifn = (i)=>(rev?(road.length-2-i):i)
  rows.enter().append("div").attr('class', 'roadrow')
    .attr("name", (d,i)=>('roadrow'+ifn(s+i)))
    .attr("id", (d,i)=>(ifn(s+i)))
    .append("div")
    .attr("class", "rowid").text((d,i)=>(ifn(s+i)+":"))
  rows.exit().remove()
  rows.order()
  rows = elt.selectAll(".roadrow")
  rows.attr("name", (d,i)=>('roadrow'+ifn(s+i)))
    .attr("id", (d,i)=>(ifn(s+i)))
  rows.select("div").text((d,i)=>(ifn(s+i)+":"))
  var cells = rows.selectAll(".rdcell")
      .data((row, i) => {
        var datestr = bu.dayify(row.end[0], '-')
        var ri = ifn(s+i)
        return [
          {order: 2, value: datestr, name: "enddate"+(ri), 
           auto: (row.auto==br.RP.DATE), i:ri},
          {order: 4, value: bu.shn(row.end[1]), name: "endvalue"+(ri), 
           auto: (row.auto==br.RP.VALUE), i:ri},
          {order: 6, value: isNaN(row.slope)
           ?"duplicate":bu.shn(row.slope*gol.siru), name: "slope"+(ri), 
           auto: (row.auto==br.RP.SLOPE), i:ri}]
      });
   cells.enter().append("div").attr('class', (d,i)=>('rdcell '+rtbccls[i]))
    .attr('name', (d)=>d.name)
    .attr("contenteditable", 
      (d,i) =>((d.auto || !opts.roadEditor)?'false':'true'))
    .on('click', tableClick)
    .on('focusin', tableFocusIn)
    .on('focusout', tableFocusOut)
    .on('keydown', tableKeyDown)

   cells.exit().remove()
   cells = rows.selectAll(".rdcell")
   cells.text((d,i)=>d.value)
     .attr('name', (d)=>d.name)
    .style('color', (d) =>{
      if (road[d.i].sta[0] == road[d.i].end[0] 
          && road[d.i].sta[1] == road[d.i].end[1])
        return opts.roadLineCol.invalid
      return d.auto?opts.roadTableCol.textDisabled
        :opts.roadTableCol.text})
    .style('background-color', function(d) {
      return d.auto?opts.roadTableCol.bgDisabled
        :opts.roadTableCol.bg})
    .attr("contenteditable", function(d,i) { 
      return (d.auto || !opts.roadEditor)?'false':'true'})
}

function updateTableWidths() {
  if (opts.divTable == null || hidden) return;
  if (road.length > 3) {
    if (!tbody.node().offsetParent) return
    d3.select(opts.divTable)
      .style("width", (tbody.node().offsetWidth+35)+"px")
    
  } else {
    if (!gbody.node().offsetParent) return
    d3.select(opts.divTable)
      .style("width", (gbody.node().offsetWidth+35)+"px")
  }
}

function updateTableValues() {
  if (opts.divTable == null) return

  var reversetable = opts.reverseTable

  updateRowValues( stbody, 0, 1, false )
  stbody.select("[name=slope0]")
    .style("visibility","hidden")
    .style("pointer-events","none")
    .style("border", "1px solid transparent")

  updateRowValues( tbody, 1, road.length-2, reversetable )
  updateRowValues( gbody, road.length-2, road.length-1, false )

  if (road.length <=3) {
    sttail.style("visibility", "collapse")
    d3.select(opts.divTable).select(".rtbmain").style("display", "none")
  } else {
    sttail.style("visibility", null)
    d3.select(opts.divTable).select(".rtbmain").style("display", null)
  }

  updateTableWidths()
}

/** Updates table */
function updateTable() {
  updateTableValues()
  updateTableButtons()
  updateTableWidths()
}

function updateContextData() {
  if (opts.divGraph == null) return

  if (opts.showContext) {
    context.attr("visibility", "visible")
    updateContextOldRoad()
    updateContextOldBullseye()
    updateContextBullseye()
    updateContextRoads()
    updateContextDots()
    updateContextHorizon()
    updateContextToday()
    if (opts.showFocusRect) focusrect.attr("visibility", "visible")
    else focusrect.attr("visibility", "hidden")
  } else {
    context.attr("visibility", "hidden")
    focusrect.attr("visibility", "hidden")
  }
}


// Updates style info embedded in the SVG element for datapoints.
// This is called once at the beginning and whenever scf changes
function updateDynStyles() {
  let s = "", svgid = "#svg"+curid+" "
  let pe = "pointer-events:"+((opts.headless)?"none;":"all;")
  
  s += svgid+".rd {r:"+r3(opts.dataPoint.size*scf)+"px} "
  s += svgid+".std {r:"+r3((opts.dataPoint.size+2)*scf)+"px} "
  s += svgid+".ap {r:"+r3(0.7*(opts.dataPoint.size)*scf)+"px;"+pe+"} "
  s += svgid+".hp {r:"+r3(opts.dataPoint.hsize*scf)+"px;"+pe+"} "
  s += svgid+".guides {stroke-width:"+r3(opts.guidelines.width*scf)+"px} "
  s += svgid+".rosy {stroke-width:"+r3(4*scf)+"px} "
  s += svgid+".steppy {stroke-width:"+r3(4*scf)+"px} "
  s += svgid+".steppyppr {stroke-width:"+r3(4*scf)+"px} "
  s += svgid+".maxflux {fill:none;stroke:"+bu.Cols.BIGG+";stroke-width:"+r3(opts.maxfluxline*scf)+"px} "
  s += svgid+".stdflux {fill:none;stroke:"+bu.Cols.BIGG+";stroke-width:"+r3(opts.stdfluxline*scf)+"px} "
  
  // Styles that depend on the road editor
  if (opts.roadEditor) {
    // Datapoints
    s += svgid+".dp {r:"+r3(opts.dataPoint.size*scf)+"px;stroke:"
      +opts.dataPointCol.stroke+";stroke-width:"+r3(opts.dataPoint.border*scf)+"px} "
    s += svgid+".razr {fill:none;pointer-events:none;stroke-width:"+r3(opts.razrline*scf)+"px;stroke:"+bu.Cols.RAZR0+"} "
  } else {
    s += svgid+".dp {r:"+r3(opts.dataPoint.size*scf)+"px;stroke:rgb(0,0,0);stroke-width:"+r3(1*scf)+"px} "
    s += svgid+".dp.fuda {stroke-width:"+r3(0.5*scf)+"px} "
    s += svgid+".razr {fill:none;pointer-events:none;stroke-width:"+r3(opts.razrline*scf)+"px;stroke:"+bu.Cols.REDDOT+"} "
  }
  d3.select("style#dynstyle"+curid).text(s)
}

function updateGraphData(force = false) {
  if (opts.divGraph == null) return
  clearSelection()
  const limits = [nXSc.invert(            0).getTime()/SMS, 
                  nXSc.invert(plotbox.width).getTime()/SMS]
  if (force) oldscf = 0
  scf = opts.roadEditor ? 
    bu.clip(bu.rescale(limits[1], limits[0],limits[0]+73*SID, 1,.7 ), .7,  1) :
    bu.clip(bu.rescale(limits[1], limits[0],limits[0]+73*SID, 1,.55), .55, 1)

  if (scf != oldscf) updateDynStyles()
  
  //updateRoadData()
  updateRoadValidity()
  updateWatermark()
  updatePastBox()
  updateYBHP()
  updatePinkRegion()
  updateGuidelines()
  updateRazrRoad()
  updateMaxFluxline()
  updateStdFluxline()
  updateOldBullseye()
  updateBullseye()
  updateKnots()
  updateDataPoints()
  updateDerails()
  updateRosy()
  updateSteppy()
  updateHashtags()
  updateMovingAv()
  updateRoads()
  updateDots()
  updateHorizon()
  updateOdomResets()
  updatePastText()
  updateAura()
  // Record current dot color so it can be retrieved from the SVG
  // for the thumbnail border
  zoomarea.attr('color', br.dotcolor(road, gol, gol.tcur, gol.vcur, iso))

  // Store the latest scale factor for comparison. Used to
  // eliminate unnecessary attribute setting for updateDotGroup
  // and other update functions
  oldscf = scf
}

createGraph()
createTable()
createDueBy()
createDataTable()
//zoomAll()

/** bgraph object ID for the current instance */
this.id = 1

/** Sets/gets the showData option 
 @param {Boolean} flag Set/reset the option*/
this.showData = (flag) => {
  if (arguments.length > 0) opts.showData = flag
  if (alldata.length != 0) {
    updateDataPoints()
    updateDerails()
    updateRosy()
    updateSteppy()
    updateMovingAv()
    updateAura()
  }
  return opts.showData
}

/** Sets/gets the showContext option 
 @param {Boolean} flag Set/reset the option */
this.showContext = (flag) => {
  if (arguments.length > 0) opts.showContext = flag
  if (road.length != 0)
    updateContextData()
  return opts.showContext
}

/** Sets/gets the keepSlopes option 
 @param {Boolean} flag Set/reset the option */
this.keepSlopes = (flag) => {
  if (arguments.length > 0) opts.keepSlopes = flag
  return opts.keepSlopes
}

/** Sets/gets the keepIntervals option 
 @param {Boolean} flag Set/reset the option */
this.keepIntervals = ( flag ) => {
  if (arguments.length > 0) opts.keepIntervals = flag
  return opts.keepIntervals
}

/** Sets/gets the maxDataDays option. Updates the datapoint
 display if the option is changed. */
this.maxDataDays = ( days ) => {
  if (arguments.length > 0) {
    opts.maxDataDays = days
    if (opts.maxDataDays < 0) {
      alldataf = alldata.slice()
      dataf = data.slice()
    } else {
      alldataf = alldata.filter((e)=>(e[0]>(gol.asof-opts.maxDataDays*SID)))
      dataf = data.filter((e)=>(e[0]>(gol.asof-opts.maxDataDays*SID)))
    }
    if (alldata.length != 0) {
      updateDataPoints()
      updateDerails()
      updateRosy()
      updateSteppy()
    }
  }
  return opts.maxDataDays
}

/** Sets/gets the reverseTable option. Updates the table if
 the option is changed.  
 @param {Boolean} flag Set/reset the option*/
this.reverseTable = ( flag ) => {
  if (arguments.length > 0) {
    opts.reverseTable = flag
    if (opts.reverseTable) {
      d3.select(opts.divTable).select(".rtbgoal").raise()
      d3.select(opts.divTable).select(".rtbmain").raise()
      d3.select(opts.divTable).select(".rtbstart").raise()
    } else {
      d3.select(opts.divTable).select(".rtbstart").raise()
      d3.select(opts.divTable).select(".rtbmain").raise()
      d3.select(opts.divTable).select(".rtbgoal").raise()
    }
    updateTable()
  }
  return opts.reverseTable
}

/** Sets/gets the tableUpdateOnDrag option. 
 @param {Boolean} flag Set/reset the option */
this.tableUpdateOnDrag = ( flag ) => {
  if (arguments.length > 0) {
    opts.tableUpdateOnDrag = flag
    updateTable()
  }
  return opts.tableUpdateOnDrag
}

/** Sets/gets the tableAutoScroll option.  
 @param {Boolean} flag Set/reset the option*/
this.tableAutoScroll = ( flag ) => {
  if (arguments.length > 0) opts.tableAutoScroll = flag
  return opts.tableAutoScroll
}

/** Returns an object with the lengths of the undo and redo
 buffers */
this.undoBufferState = () => {
  return({undo: undoBuffer.length, redo: redoBuffer.length})
}

/** Undoes the last edit */
this.undo = () => {
  if (!opts.roadEditor) return
  document.activeElement.blur()
  undoLastEdit()
}

/** Undoes all edits */
this.undoAll = () => {
  if (!opts.roadEditor) return
  road = undoBuffer.shift()
  clearUndoBuffer()
  bbr.setRoadObj(road) // Since popped version is a copy, must inform beebrain
  roadChanged()
}

/** Redoes the last edit that was undone */
this.redo = () => {
  if (!opts.roadEditor) return
  document.activeElement.blur()
  redoLastEdit()
}

/** Clears the undo buffer. May be useful after the new
 road is submitted to Beeminder and past edits need to be
 forgotten.*/
this.clearUndo = clearUndoBuffer

/** Zooms out the goal graph to make the entire range from
 tini to tfin visible, with additional slack before and after
 to facilitate adding new knots. */
this.zoomAll = () => { if (road.length == 0) return; else zoomAll() }

/** Brings the zoom level to include the range from tini to
 slightly beyond the akrasia horizon. This is expected to be
 consistent with beebrain generated graphs. */ 
this.zoomDefault = () => { if (road.length == 0) return; else zoomDefault() }

/** Initiates loading a new goal from the indicated url.
 Expected input format is the same as beebrain. Once the input
 file is fetched, the goal graph and road matrix table are
 updated accordingly. 
@param {String} url URL to load the goal BB file from*/
this.loadGoal = async ( url ) => {
  await loadGoalFromURL( url )
    .catch(function(err){
      console.log(err.stack)
    })
}

/** Initiates loading a new goal from the supplied object.
 Expected input format is the same as beebrain. The goal graph and
 road matrix table are updated accordingly.
@param {object} json Javascript object containing the goal BB file contents*/
this.loadGoalJSON = ( json, timing = true ) => {
  removeOverlay()
  loadGoal( json, timing )
}

/** Performs retroratcheting function by adding new knots to leave
 "days" number of days to derailment based on today data point
 (which may be flatlined).
 @param {Number} days Number of buffer days to preserve*/
this.retroRatchet = ( days ) => {
  if (!opts.roadEditor) return
  setSafeDays( days )
}

/** Schedules a break starting from a desired point beyond the
 * akrasia horizon and extending for a desired number of days.
 @param {String} start Day to start the break, formatted as YYYY-MM-DD
 @param {Number} days Number of days fof the break
 @param {Boolean} insert Whether to insert into or overwrite onto the current road
*/
this.scheduleBreak = ( start, days, insert ) => {
  if (!opts.roadEditor) return
  if (isNaN(days)) return
  if (road.length == 0) {
    console.log("bgraph("+curid+"):scheduleBreak(), road is empty!")
    return
  }
  var begintime = bu.dayparse(start, '-')
  // Find or add a new dot at the start of break
  // We only allow the first step to record undo info.
  var firstseg = -1, i, j
  for (i = 1; i < road.length; i++) {
    if (road[i].sta[0] === begintime) {
      firstseg = i; break
    }
  }
  var added = false;
  if (firstseg < 0) {addNewDot(begintime);added = true;}
  if (!added) pushUndoState()
  for (i = 1; i < road.length; i++) {
    if (road[i].sta[0] === begintime) {
      firstseg = i; break
    }
  }
  if (insert) {
    // First, shift all remaining knots right by the requested
    // number of days
    road[firstseg].end[0] = bu.daysnap(road[firstseg].end[0]+days*SID)
    for (j = firstseg+1; j < road.length; j++) {
      road[j].sta[0] = bu.daysnap(road[j].sta[0]+days*SID)
      road[j].end[0] = bu.daysnap(road[j].end[0]+days*SID)
    }
    // Now, create and add the end segment if the value of the
    // subsequent endpoint was different
    if (road[firstseg].sta[1] != road[firstseg].end[1]) {
      var segment = {}
      segment.sta = road[firstseg].sta.slice()
      segment.sta[0] = bu.daysnap(segment.sta[0]+days*SID)
      segment.end = road[firstseg].end.slice()
      segment.slope = br.segSlope(segment)
      segment.auto = br.RP.VALUE
      road.splice(firstseg+1, 0, segment)
      road[firstseg].end = segment.sta.slice()
      road[firstseg].slope = 0
      br.fixRoadArray( road, br.RP.VALUE, false)
    }
  } else {
    // Find the right boundary for the segment for overwriting
    var endtime = bu.daysnap(road[firstseg].sta[0]+days*SID)
    var lastseg = br.findSeg( road, endtime )
    if (road[lastseg].sta[0] != endtime) {
      // If there are no dots on the endpoint, add a new one
      addNewDot(endtime); 
      if (added) {undoBuffer.pop(); added = true}
      lastseg = br.findSeg( road, endtime )
    }
    // Delete segments in between
    for (j = firstseg+1; j < lastseg; j++) {
      road.splice(firstseg+1, 1)
    }
    road[firstseg].end = road[firstseg+1].sta.slice()
    var valdiff = road[firstseg+1].sta[1] - road[firstseg].sta[1]
    for (j = firstseg; j < road.length; j++) {
      road[j].end[1] -= valdiff
      road[j].slope = br.segSlope(road[j])
      if (j+1 < road.length) road[j+1].sta[1] = road[j].end[1]
    }
    br.fixRoadArray( road, br.RP.SLOPE, false)
  }
  roadChanged()
}

/** Dials the road to the supplied slope starting from the akrasia horizon
 @param {Number} newSlope New road slope to start in a week
*/
this.commitTo = ( newSlope ) => {
  if (!opts.roadEditor) return
  if (isNaN(newSlope)) return
  if (road.length == 0) {
    console.log("bgraph("+curid+"):commitTo(), road is empty!")
    return
  }
  if (road[road.length-2].slope == newSlope) return

  // Find out if there are any segments beyond the horizon
  var horseg = br.findSeg(road, gol.horizon)
  if (road[horseg].sta[0] == gol.horizon || horseg < road.length-2) {
    // There are knots beyond the horizon. Only adjust the last segment
    pushUndoState()
  } else {
    addNewDot(gol.horizon)
  }
  road[road.length-2].slope = newSlope
  br.fixRoadArray( road, br.RP.VALUE, false )
  roadChanged()
}

/** Returns an object with an array ('road') containing the current roadmatix
 (latest edited version), as well as the following members:<br/>
 <ul>
 <li><b>valid</b>: whether edited road intersects the pink region or not</li>
 <li><b>loser</b>: whether edited road results in a derailed goal or not</li>
 <li><b>asof</b>: unix timestamp for "now"</li>
 <li><b>horizon</b>: unix timestamp for the current akrasia horizon</li>
 <li><b>siru</b>: seconds in rate units</li>
 </ul>
*/
this.getRoad = () => {
  function dt(d) { return moment.unix(d).utc().format("YYYYMMDD")}
  // Format the current road matrix to be submitted to Beeminder
  var r = {}, seg, rd, kd
  if (road.length == 0) {
    console.log("bgraph("+curid+"):getRoad(), road is empty!")
    return null
  }
  r.valid = isRoadValid(road)
  r.loser = br.redyest(road, gol, gol.tcur) // TODO: needs iso here
  r.asof = gol.asof
  r.horizon = gol.horizon
  r.siru = gol.siru
  //r.tini = dt(road[0].end[0])
  //r.vini = road[0].end[1]
  r.road = []
  for (let i = 0; i < road.length-1; i++) {
    seg = road[i]
    if (seg.sta[0] == seg.end[0] && seg.sta[1] == seg.end[1])
      continue
    kd = moment.unix(seg.end[0]).utc()
    rd = [kd.format("YYYYMMDD"), seg.end[1], seg.slope*gol.siru]
    if (seg.auto == br.RP.DATE) rd[2] = null // Exception here since roadall does not support null dates
    if (seg.auto == br.RP.VALUE) rd[1] = null
    if (seg.auto == br.RP.SLOPE) rd[2] = null
    //if (i == road.length-2) {
    //    r.tfin = rd[0]
    //    r.vfin = rd[1]
    //    r.rfin = rd[2]
    //} else 
    r.road.push(rd)
  }
  return r
}

/** Generates a data URI downloadable from the link element
 supplied as an argument. If the argument is empty or null,
 replaces page contents with a cleaned up graph suitable to be
 used with headless chrome --dump-dom to retrieve the contents as
 a simple SVG.
@param {object} [linkelt=null] Element to provide a link for the SVG object to download. If null, current page contents are replaced. */
this.saveGraph = ( linkelt = null ) => {
  // retrieve svg source as a string
  const svge = svg.node()
  const serializer = new XMLSerializer()
  let source = serializer.serializeToString(svge)

  //set url value to a element's href attribute.
  if (opts.headless || linkelt == null) {
    // If no link is provided or we are running in headless mode ,
    // replace page contents with the svg and eliminate
    // unnecessary elements
    document.head.remove()
    document.body.innerHTML = source

    // Eliminate unnecessary components from the SVG file in headless mode
    if (opts.headless) {
      var newroot = d3.select(document.body)
      //newroot.selectAll(".zoomarea").remove();
      newroot.selectAll(".buttonarea").remove()
      newroot.selectAll(".brush").remove()
      newroot.selectAll(".zoomin").remove()
      newroot.selectAll(".zoomout").remove()
      //newroot.selectAll(".minor").remove()
    }
  } else {
    // Remove styling once serialization is completed
    //defs.select('style').remove()

    // add name spaces
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source= source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
    }
    if (!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
      source = source.replace(/^<svg/, 
                              '<svg xmlns:xlink="http://www.w3.org/1999/xlink"')
    }

    //add xml declaration
    source = '<?xml version="1.0" standalone="no"?>\n' + source

    //convert svg source to URI data scheme.
    var url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source)

    //set url value to a element's href attribute.
    linkelt.href = url
  }
}

/** Informs the module instance that the element containing the
 visuals will be hidden. Internally, this prevents calls to
 getBBox(), eliminating associated exceptions and errors. 
 @see {@link bgraph#show}*/
this.hide = () => {hidden = true}

/** Informs the module instance that the element containing the
 visuals will be shown again. This forces an update of all visual
 elements, which might have previously been incorrectly rendered
 if hidden. 
 @see {@link bgraph#hide}*/
this.show = () => {
  //console.debug("curid="+curid+", show()");
  hidden = false
  if (road.length == 0) {
    console.log("bgraph("+curid+"):show(), road is empty!")
    return
  }
  redrawXTicks()
  adjustYScale()
  handleYAxisWidth()
  resizeBrush()
  updateTable()
  updateContextData()
  updateGraphData(true)
}

this.loading = (flag) => {
  if (flag) showOverlay(['loading...'], sh/10)
  else removeOverlay()
}
/** Returns the road matrix object (in the internal format) for the
    goal. Primarily used to synchronize two separate graph
    instances on the same HTML page. 
    @return {object} Internal road object
    @see bgraph#setRoadObj
*/
this.getRoadObj = () => br.copyRoad(road)

this.getGoalObj = () => (gol)

/** Flag to indicate whether we are within a call to
 * setRoadObj(). Prevents repeated calls to beebrain.reloadRoad()
 * since beebrain.setRoadObj() already calls reloadRoad()*/
var settingRoad = false

/** Sets the road matrix (in the internal format) for the
    goal. Primarily used to synchronize two separate graph
    instances on the same HTML page. Should only be called with
    the return value of {@link bgraph#getRoadObj}.
    @param {object} newroad Road object returned by {@link bgraph#getRoadObj}
    @param {Boolean} [resetinitial=false] Whether to set the internal "initial road" as well
    @see bgraph#getRoadObj
*/
this.setRoadObj = ( newroad, resetinitial = false ) => {
  if (settingRoad) return
  if (newroad.length == 0) {
    // TODO: More extensive sanity checking
    console.log("bgraph("+curid+"):setRoadObj(), new road is empty!")
    return
  }
  settingRoad = true
  // Create a fresh copy to be safe
  pushUndoState()

  road = br.copyRoad(newroad)
  if (resetinitial) {
    // Warning: If the initial road is reset, tini might not be
    // updated since its update in roadChanged() relies on the
    // previous tini and the first road element being the same
    iroad = br.copyRoad(newroad)
    clearUndoBuffer()
  }
  bbr.setRoadObj(newroad)
  roadChanged()
  settingRoad = false
}

/** Checks whether the goal is currently in a derailed state
    @returns {Boolean} 
*/
this.isLoser = () => {
  if (gol && road.length != 0)
    return br.redyest(road, gol, gol.tcur) // TODO: needs iso here
  else return false
}

this.getProgress = () => {
  return [[bu.dayify(gol.tini,'-'), gol.vini], [bu.dayify(gol.tcur,'-'), gol.vcur], [bu.dayify(gol.tfin,'-'), gol.vfin]]
}
  
/** Returns current goal state
    @returns {object} Current goal state as [t, v, r, rdf(t)] or null if no goal
*/
this.curState =
  () => (gol ? [gol.tcur, gol.vcur, gol.rcur, br.rdf(road, gol.tcur)] : null)

/** @typedef GoalVisuals
    @global
    @type {object}
    @property {Boolean} plotall Plot all points instead of just the aggregated point
    @property {Boolean} steppy Join dots with purple steppy-style line
    @property {Boolean} rosy Show the rose-colored dots and connecting line
    @property {Boolean} movingav Show moving average line superimposed on the data
    @property {Boolean} aura Show blue-green/turquoise aura/swath
    @property {Boolean} hidey Whether to hide the y-axis numbers
    @property {Boolean} stathead Whether to include label with stats at top of graph
    @property {Boolean} hashtags Show annotations on graph for hashtags in comments 
*/
const visualProps
      = ['plotall','steppy','rosy','movingav','aura','hidey','stathead','hashtags']
/** Returns visual properties for the currently loaded goal
    @returns {GoalVisuals} 
    @see {@link bgraph#getGoalConfig}
*/
this.getVisualConfig = ( ) =>{
  var out = {}
  visualProps.map(e=>{ out[e] = gol[e] })
  return out
}

/** Returns a flag indicating whether external image references on
 * the svg have finished loading or not */
this.xlinkLoaded = () => xlinkloaded

/** @typedef GoalProperties
    @global
    @type {object}
    @property {Boolean} yaw Which side of the YBR you want to be on, +1 or -1
    @property {Boolean} dir Which direction you'll go (usually same as yaw)
    @property {Boolean} kyoom Cumulative; plot vals as sum of those entered so far
    @property {Boolean} odom Treat zeros as accidental odom resets
    @property {Boolean} monotone Whether data is necessarily monotone
    @property {String} aggday Aggregation function for the day's official value
*/
const goalProps
      = ['yaw','dir','kyoom','odom','monotone','aggday']
/** Returns properties for the currently loaded goal
    @returns {GoalProperties} 
    @see {@link bgraph#getVisualConfig}
 */
this.getGoalConfig = ( ) => {
  let out = {}
  goalProps.map(e => { out[e] = gol[e] })
  return out
}

/** Display supplied message overlaid towards the top of the graph
    @param {String} msg What to display. Use null to remove existing message. */
this.msg = (msg)=>{
  if (!msg) removeOverlay("message")
  else
    showOverlay([msg], 20, null, {x:sw/20, y:10, w:sw*18/20, h:50},
                "message", false, true, svg)
}

/** Animates the Akrasia horizon element in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animHor = animHor
/** Animates the Yellow Brick Road elements in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animYBR = animYBR
/** Animates datapoints in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animData = animData
/** Animates guideline elements in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animGuides = animGuides
/** Animates the rosy line in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animRosy = animRosy
/** Animates the moving average in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animMav = animMav
/** Animates YBHP lines at 1, 2 and 6 days
    @method
    @param {Boolean} enable Enables/disables animation */
this.animYBHPlines = animYBHPlines
/** Animates the aura element in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animAura = animAura
/** Animates the waterbuf element in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animBuf = animBuf
/** Animates the waterbux element in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animBux = animBux

} // END bgraph object constructor ---------------------------------------------

return bgraph

})) // END MAIN ----------------------------------------------------------------

/**
 * Javascript implementation of a sandbox for Beeminder goals,
 * provided as a UMD module. Provides a {@link bsandbox} class, which
 * can be used to construct independent sandbox objects each with
 * their own graph object, linked to particular div element on the
 * DOM.<br/>

 * <br/>Copyright © 2017 Uluc Saranli
 @module bsandbox
 @requires d3
 @requires moment
 @requires butil
 @requires broad
 @requires beebrain
 @requires bgraph
 */
;((function (root, factory) {
  'use strict'
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    //console.log("beebrain: Using AMD module definition")
    define(['moment', 'butil', 'broad', 'beebrain', 'bgraph'], factory)
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.    
    //console.log("beebrain: Using CommonJS module.exports")
    module.exports = factory(require('./moment'), require('./butil'), 
                             require('./broad'), require('./beebrain'),
                             require('./bgraph'))
  } else {
    //console.log("beebrain: Using Browser globals")
    root.bsandbox = factory(root.moment, root.butil, root.broad,
                            root.beebrain, root.bgraph)
  }
})(this, function (moment, bu, br, bb, bg) {
  'use strict'

// -----------------------------------------------------------------------------
// --------------------------- CONVENIENCE CONSTANTS ---------------------------

  const DIY = 365.25
  const SID = 86400

  // -------------------------------------------------------------
  // ------------------- FACTORY GLOBALS ---------------------
  /** Global counter to Generate unique IDs for multiple bsandbox
   * instances. */
  var gid = 1,

  /** bsandbox object constructor. Creates a beeminder sandbox object,
   * creating a graph on the supplied DIV object in the DOM.

   @memberof module:bsandbox
   @constructs bsandbox
   @param {object} div object on the DOM to create a {@link module:bgraph} instance on
   @param {bool} debug flag turns logging on or off. Default is false.
  */
  bsandbox = function( optsin, debug = true ) {
    // set log level for this instance of bsandbox. 
    var logger = (debug && typeof console != 'undefined') ? console : {
          info: function(){},
          warn: function(){},
          debug:function(){},
          error:function(){},
          log:  function(){}
        }
    logger.debug("beebrain constructor ("+gid+"): ");
    var self = this,
        opts = bu.extend({}, optsin),
        curid = gid
    gid++
    
    bu.extend(opts, {roadEditor:false,
                     maxFutureDays: 365,
                     showFocusRect: false,
                     showContext: false})
    var goal = {div: opts.divGraph}

    var pledges = [0, 5, 10, 30, 90, 270, 810, 2430]
    goal.graph = new bgraph(opts);
    
    function newDoMore() {
      return {yaw:1, dir:1, kyoom:true,
              odom: false, movingav:false, 
              steppy:true, rosy: false, aura: false, aggday: "sum",
              monotone:true}
    }
    function newLoseWeight() {
      return {yaw: -1, dir: -1, kyoom: false,
              odom: false, movingav: true,
              steppy: false, rosy: true, aura: true, aggday: "min",
              plotall:false, monotone:false }
    }
    function newUseOdometer() {
      return {yaw:1, dir: 1, kyoom: false,
              odom: true, movingav: false,
              steppy: true, rosy: false, aura: false, aggday: "last",
              monotone:true }
    }
    function newDoLess() {
      return {yaw: -1, dir: 1, kyoom: true,
              odom: false, movingav: false,
              steppy: true, rosy: false, aura: false, aggday: "sum",
              monotone:true }
    }
    function newGainWeight() {
      return {yaw: 1, dir: 1, kyoom: false,
              odom: false, movingav: true, 
              steppy: false, rosy: true, aura: true, aggday: "max",
              plotall:false, monotone:false }
    }
    function newWhittleDown() {
      return {dir: -1, yaw: -1, kyoom: false,
              odom: false, movingav: false,
              steppy: true, rosy: false, aura: false, aggday: "min",
              plotall:false, monotone:false }
    }
    const typefn = {
      hustler: newDoMore, 
      fatloser: newLoseWeight, 
      biker: newUseOdometer, 
      drinker: newDoLess, 
      gainer: newGainWeight,
      inboxer: newWhittleDown
    }

    var undoBuffer = [], redoBuffer = []
    function undo(reload=true) {
      if (undoBuffer.length == 0) return
      redoBuffer.push(JSON.parse(JSON.stringify({bb:goal.bb, derails:goal.derails})))
      var restore = undoBuffer.pop()
      goal.bb = restore.bb
      goal.derails = restore.derails
      if (reload) reloadGoal()
    }
    function redo(reload=true) {
      if (redoBuffer.length == 0) return
      saveState()
      var restore = redoBuffer.pop()
      goal.bb = restore.bb
      goal.derails = restore.derails
      if (reload) reloadGoal()
    }
    function saveState() {
      undoBuffer.push(JSON.parse(JSON.stringify({bb:goal.bb, derails:goal.derails})))
    }
    function clearUndoBuffer() {
      undoBuffer = []
    }

    function reGraph() {
      let bb = JSON.parse(JSON.stringify(goal.bb))
      bb.params.waterbux = "$"+pledges[Math.min(pledges.length-1, goal.derails.length)]
      goal.graph.loadGoalJSON( bb, false )
    }
    function reloadGoal(undofirst = true) {
      logger.log("bsandbox.reloadGoal(): Regenerating graph ********")
      reGraph()
      // If the goal has derailed, perform rerailments automatically
      if (goal.graph.isLoser()) {
        if (undofirst) {
          logger.log("bsandbox.reloadGoal(): Derailed! Rolling back...")
          undo(false)
          reGraph()
        }
        logger.log("bsandbox.reloadGoal(): Derailed! Rerailing...")
        let cur = goal.graph.curState()
        // Clean up road ahead
        goal.bb.params.road = goal.bb.params.road.filter(e=>(bu.dayparse(e[0])<cur[0]))
        let road = goal.bb.params.road
        var nextweek = bu.daysnap(cur[0]+7*SID)
        var derail = bu.dayify(cur[0])
        road.push([derail, null, cur[2]])
        road.push([derail, Number(cur[1]), null])
        road.push([bu.dayify(nextweek), null, 0])
        goal.bb.data.push([derail,
                           (goal.bb.params.kyoom)?0:Number(cur[1]),
                           "RECOMMITTED at "+derail])

        goal.derails.push(derail)

        reGraph()
      }
      logger.log("bsandbox.reloadGoal(): Done **********************")
    }
    
    function nextDay() {
      saveState()
//      var oldasof
//        = bu.dayify(bu.daysnap(bu.dayparse(goal.bb.params.asof)))
      var newasof
        = bu.dayify(bu.daysnap(bu.dayparse(goal.bb.params.asof)+SID))
//      var ppr = br.ppr(goal.graph.getRoadObj(), goal.graph.getGoalObj(), newasof)
//      console.log(ppr)
//      if (ppr != 0) {
//        if (goal.bb.params.kyoom)
//          goal.bb.data.push([oldasof, Number(ppr),
//                             `PPR (#${goal.bb.data.length})`])
//        else
//          goal.bb.data.push([oldasof,
//                             Number(goal.bb.data[goal.bb.data.length-1][1] + ppr),
//                             `PPR (#${goal.bb.data.length})`])
//        console.log(goal.bb.data)
      //      }
      goal.bb.params.asof = newasof
      reloadGoal()
    }
    
    function newData( v, c ) {
      if (!bu.nummy(v) || !bu.stringy(c)) return;
      saveState()
      goal.bb.data.push([goal.bb.params.asof, Number(v),
                         (c=="")?`Added in sandbox (#${goal.bb.data.length})`:c])
      reloadGoal()
    }
    
    // Rate should be in value/seconds
    function newRate( r ) {
      if (!bu.nummy(r)) return
      saveState()
      // check if there is a road segment ending a week from now
      var asof = bu.dayparse(goal.bb.params.asof)
      var nextweek = bu.daysnap(asof + 7*SID)
      var road = goal.bb.params.road
      var roadlast = bu.dayparse(road[road.length-1][0])

      if (roadlast < nextweek) {
        road.push([bu.dayify(nextweek), null, goal.bb.params.rfin])
      }
      
      goal.bb.params.rfin = Number(r)*bu.SECS[goal.bb.params.runits]
      reloadGoal()
    }

    const visualProps
          = ['plotall','steppy','rosy','movingav','aura','hidey','stathead','hashtags']
    function setVisualConfig( opts ) {
      visualProps.map(e=>{
        if (opts.hasOwnProperty(e) && bu.torf(opts[e])) goal.bb.params[e] = opts[e]
      })
      reloadGoal()
    }

    const goalProps
          = ['yaw','dir','kyoom','odom','monotone','aggday']
    function setGoalConfig( opts ) {
      saveState()
      goalProps.map(e=>{
        if (opts.hasOwnProperty(e)) goal.bb.params[e] = opts[e]
      })
      reloadGoal( false )
    }

    function newGoal( gtype, runits, rfin, vini, buffer, newparams = [] ) {
      logger.log(`newGoal(${gtype}, ${runits}, ${rfin}, ${vini}, ${buffer})`)
      if (!typefn.hasOwnProperty(gtype)) {
        logger.error("bsandbox.newGoal: Invalid goal type!")
        return
      }
      if (["d", "w", "m", "y"].indexOf(runits) < 0) {
        logger.error("bsandbox.newGoal: Invalid rate units!")
        return
      }
      if (!bu.nummy(rfin) || !bu.nummy(vini) || !bu.torf(buffer)) {
        logger.error("bsandbox.newGoal: Invalid goal parameters!")
        return
      }
 
      goal.gtype = gtype
      goal.rfin = rfin
      goal.vini = vini
      goal.runits = runits
      goal.buffer = buffer

      let params = typefn[gtype]()
      params.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      params.deadline = 0
      params.asof = bu.dayify(moment.tz(params.timezone)/ 1000)
      const now = bu.nowstamp(params.timezone, params.deadline, bu.dayparse(params.asof))
      const nextweek = bu.daysnap(moment.now()/1000 + 7*SID)
      const nextyear = bu.daysnap(moment.now()/1000 + DIY*SID)
      var data = {}

      params.stathead = false

      params.quantum = 1
      
      //params.ybhp - true
      //params.abslnw = 0

      params.tfin = bu.dayify(nextyear)
      params.rfin = Number(rfin)
      params.runits = runits
      
      params.tini = params.asof
      params.vini = Number(vini)
      
      params.road = [[buffer?bu.dayify(nextweek):params.asof, null, 0]]

      // Some other defaults
      params.waterbux = "$"+pledges[0]
      params.yoog = "test/sandbox"
      params.imgsz = 696
      params.yaxis = (params.kyoom)?"current cumulative total":"current value"
      //params.ybhp = true
      
      Object.keys(newparams).forEach(e=>{params[e] = newparams[e]})

      data = [[params.tini, Number(params.vini), "initial datapoint of "+params.vini]]

      goal.bb = {params: params, data: data}
      goal.derails = []
      
      // Delete div contents
      while (goal.div.firstChild) goal.div.removeChild(goal.div.firstChild);
      goal.gdiv = d3.select(goal.div)
      goal.graph = new bgraph(opts);
      clearUndoBuffer()
      reloadGoal()
    }

    function loadGoalJSON( bbin, newparams = [] ) {
      logger.log(`loadGoalJSON(${bbin})`)

      goal.bb = bu.deepcopy(bbin)
      goal.derails = []
      
      // Delete div contents
      while (goal.div.firstChild) goal.div.removeChild(goal.div.firstChild);
      goal.gdiv = d3.select(goal.div)
      goal.graph = new bgraph(opts);
      clearUndoBuffer()
      reGraph()
    }

    /** bsandbox object ID for the current instance */
    this.id = curid
    
    /** Creates a fresh new goal, replacing the DIV contents with a
        new graph.
        @method
        @param {String} gtype Goal type. One of the following: "hustler", "fatloser", "biker", "drinker", "gainer", "inboxer".
        @param {String} runits Rate units. One of "d", "w", "m", "y"
        @param {Number} rate Initial road slope in runits
        @param {Number} vini Initial value of the road
        @param {Boolean} buffer Whether to have an initial week-long buffer or not
    */
    this.newGoal = newGoal
    this.loadGoalJSON = loadGoalJSON
    /** Advances the sandbox goal to the next day. Increments asof by 1 day. 
        @method */
    this.nextDay = nextDay
    this.refresh = reloadGoal
    /** Enters a new datapoint to the sandbox goal on the current day
        @method 
        @param {Number} v Datapoint value
        @param {String} c Datapoint comment. Auto-generated if empty string */
    this.newData = newData
    /** Dials the road slope for the sandbox goal beyond the akrasia horizon
        @method 
        @param {Number} r New rate in runits */
    this.newRate = newRate
    this.setVisualConfig = setVisualConfig
    this.getVisualConfig = function() {return goal.graph.getVisualConfig()}
    this.setGoalConfig = setGoalConfig
    this.getGoalConfig = function() {return goal.graph.getGoalConfig()}
    this.undo = undo
    this.redo = redo
    /** Undoes all edits */
    this.undoAll = (reload=true) => {
      while (undoBuffer.length != 0) undo(reload)
      redoBuffer = []
    }
    this.saveBB = function(linkelt) {
      var source = JSON.stringify(goal.bb)
        //convert svg source to URI data scheme.
        var url = "data:application/json;charset=utf-8,"+encodeURIComponent(source)
        //set url value to a element's href attribute.
        linkelt.href = url
    }
    this.show = function(){goal.graph.show()}
    this.hide = function(){goal.graph.hide()}
    self.getGraphObj = function() {return goal.graph}
    this.undoBufferState = () => {
      return({undo: undoBuffer.length, redo: redoBuffer.length})
    }
  }

  return bsandbox
}))
