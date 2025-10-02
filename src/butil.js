/**
 * Library of general purpose utilities for Beebrain, provided as a UMD module.
 * Provides a "butil" object holding various constants and utility functions.
 * No internal state.<br/>
 *
 * Copyright 2018-2025 Uluc Saranli and Daniel Reeves
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
const sign  = Math.sign

const DIY = 365.25 // this is what physicists use, eg, to define a light year
const SID = 86400  // seconds in a day (not used: DIM=DIY/12, WIM=DIY/12/7)

// -----------------------------------------------------------------------------
// ---------------------------- BEEBRAIN CONSTANTS -----------------------------

// Maximum amount of time in milliseconds that Beebrain processing should take.
// Users of bgraph and related tools should implement timeouts with this amount
// to avoid infinite waits in case something goes wrong.
const MAXTIME = 60000

// Base URL for images.
const BBURL = "http://brain.beeminder.com/"

// Beeminder colors (pro tip: paste this into Slack for swatches)
// Handy: https://material.io/design/color/#tools-for-picking-colors
//        http://tutorials.jenkov.com/svg/fill-patterns.html
const BHUE = {
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


const AKH   = 7*SID       // Akrasia horizon, in seconds 
//const BDUSK = 2147317201  // circa 2038, Rails's ENDOFDAYS+1 (was 2^31-2weeks)
const BDUSK = 4102444799 // 2099-12-31 23:59:59 UTC

// Number of seconds in a year, month, etc 
const SECS = { 'y' : DIY*SID, 
               'm' : DIY*SID/12,
               'w' : 7*SID,
               'd' : SID,
               'h' : 3600        }
// Unit names
const UNAM = { 'y' : 'year',
               'm' : 'month',
               'w' : 'week',
               'd' : 'day',
               'h' : 'hour'      }

/******************************************************************************
 *                                 FUNCTIONS                                  *
 ******************************************************************************/

// Type-checking convenience functions
function nummy(x)   { return !isNaN(parseFloat(x)) && isFinite(x) }
function stringy(x) { return typeof x === "string" }
function listy(x)   { return Array.isArray(x) }


// Min/max of an array of numbers
function arrMin(arr) { return min.apply(null, arr) } // use spread operator?
function arrMax(arr) { return max.apply(null, arr) } 

// TODO: Does not properly copy, especially for array properties. FIX
// https://github.com/beeminder/road/issues/199
// Extends a destination object with properties from a source object, optionally
// overwriting existing elements.
// @param {object}  fr Source object 
// @param {object}  to Destination object
// @param {boolean} ow Whether to overwrite existing properties of destination
function extendo(to, fr, ow) {
  let prop, hasProp
  for (prop in fr) {
    hasProp = to[prop] !== undefined
    if (hasProp && typeof fr[prop] === 'object' &&
        fr[prop] !== null  && fr[prop].nodeName === undefined ) {
      if (listy(fr[prop])) { if (ow) to[prop] = fr[prop].slice(0) }
      else to[prop] = extendo({}, fr[prop], ow)
    } else if (ow || !hasProp) {
      if (listy(fr[prop])) to[prop] = fr[prop].slice(0)
      else to[prop] = fr[prop]
    }
  }
  return to
}

// Make a deep copy of object x (simpler/better version of above?)
function deepcopy(x) {
  let y, val, key
  if (typeof x !== "object" || x === null) return x // base case
  y = listy(x) ? [] : {} // initialize the copy
  for (key in x) {
    val = x[key]
    y[key] = deepcopy(val) // recur!
  }
  return y
}

// Return the index of domain element for which the function is maximal.
/* Not currently used. 
function argmax(f, dom) {
  if (dom === null) return null
  let newdom = dom.map(f)
  let maxelt = arrMax(newdom)
  return dom[newdom.findIndex(e => e === maxelt)]
} */

/** Partitions list l into sublists whose beginning indices are separated by d,
    and whose lengths are n. If the end of the list is reached and there are
    fewer than n elements, those are not returned. 

    @param {Array} l Input array
    @param {Number} n Length of each sublist
    @param {Number} d Sublist separation
*/
function partition(l, n, d) {
  let il = l.length
  let ol = []
  for (let i=0; i < il; i+=d) if (i+n <= il) ol.push(l.slice(i,i+n))
  return ol
}

// Return a list containing the fraction and integer parts of a float
function modf(x) {
  const s = sign(x)
  const fl = floor(s*x)
  return [s*(s*x-fl), s*fl]
}

// The qth quantile of values in l. For median, set q=1/2.
// See http://reference.wolfram.com/mathematica/ref/Quantile.html 
// by Ernesto P. Adorio, PhD; UP Extension Program in Pampanga, Clark Field
// @param {Number[]} l Input array
// @param {Number} q Desired quantile, in range [0,1]
// @param {Number} [qt=1] Type of quantile computation, Hyndman and Fan
//   algorithm, integer between 1 and 9
// @param {boolean} [issorted=false] Flag to indicate whether the input array is
// sorted.
function quantile(l, q, qt=1, issorted=false) {
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
      out = modf(a + (n+b)*q - 1),
      g = out[0],
      j = out[1]
  if (j < 0) return y[0]
  else if (j >= n) return y[n-1] // oct.8,2010 y[n]?! off by 1 error!!
  j = floor(j)
  return (g==0)?y[j]:(y[j] + (y[j+1] - y[j])* (c + d*g))
}

/** Return a list with the sum of the elements in l 
 @param {list} l Input array */
function sum(l) { return l.reduce((a,b)=>(a+b), 0) }

/** Return a list with the cumulative sum of the elements in l,
    left to right 
    @param {Number[]} l*/
function accumulate(l) {
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
function monotonize(l, dir=1) {
  let lo = l.slice(), i
  if (dir === 1) {
    for (i = 1; i < lo.length; i++) lo[i] = max(lo[i-1],lo[i])
  } else {
    for (i = 1; i < lo.length; i++) lo[i] = min(lo[i-1],lo[i])
  }
  return lo
}

// zip([[1,2], [3,4]]) --> [[1,3], [2,4]].
// @param {Array[]} av Array of Arrays to zip
function zip(av) { return av[0].map((_,i) => av.map(a => a[i])) }

// Return 0 when x is very close to 0.
function chop(x, tol=1e-7) { return abs(x) < tol ? 0 : x }

// Return an integer when x is very close to an integer.
/* Not currently used
function ichop(x, tol=1e-7) {
  let fp = x % 1, ip = x - fp
  if (fp < 0) {fp += 1; ip -= 1;}
  if (fp > 0.5) fp = 1 - chop(1-fp)
  return floor(ip) + chop(fp, tol)
}
*/

// Clip x to be at least a and at most b: min(b,max(a,x)). Swaps a & b if a > b.
function clip(x, a, b) {
  if (a > b) [a, b] = [b, a]
  return x < a ? a : x > b ? b : x
}


// -----------------------------------------------------------------------------
// The following pair of functions -- searchHigh and searchLow -- take a sorted
// array and a distance function. A distance function is like an "is this the
// element we're searching for and if not, which way did it go?" function. It
// takes an element of the sorted array and returns a negative number if it's
// too small, a positive number if it's too big, and zero if it's just right.
// Like if you wanted to find the number 7 in an array of numbers you could use
// `x-7` as a distance function.                               L     H
//   Sorted array:                                [-1,  3,  4, 7, 7, 7,  9,  9]
//   Output of distance function on each element: [-8, -4, -3, 0, 0, 0, +2, +2]
// So searchLow would return the index of the first 7 and searchHigh the last 7.
// Or in case of no exact matches...                        L   H
//   Sorted array:                                [-1,  3,  4,  9,  9]
//   Output of distance function on each element: [-8, -4, -3, +2, +2]
// In that case searchLow returns the (index of the) 4 and searchHigh the 9. In
// other words, searchLow errs low, returning the biggest element LESS than the
// target if the target isn't found. And searchHigh errs high, returning the
// smallest element GREATER than the target if the target isn't found.
// In the case that every element is too low...                     L   H
//   Sorted array:                                [-2, -2, -1,  4,  6]
//   Output of distance function on each element: [-9, -9, -8, -3, -1]
// As you'd expect, searchLow returns the index of the last element and
// searchHigh returns one more than that, so out of bounds of the array.
// And if every element is too big...           L   H
//   Sorted array:                                [ 8,  8,  9, 12, 13]
//   Output of distance function on each element: [+1, +1, +2, +5, +6]
// Then it's the opposite, with searchHigh giving the first index and searchLow
// giving one less than that, so -1 since Javascript array's are 0-based.
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
function searchLow(sa, df) {
  if (!sa || !sa.length) return -1 // empty/non-array => every element too big

  let li = -1           // initially left of the leftmost element of sa   
  let ui = sa.length    // initially right of the rightmost element of sa   
  let mi                // midpoint of the search range for binary search   
  
  while (ui-li > 1) {           // squeeze the upper/lower bounds till they meet
    mi = floor((li+ui)/2)       // pick the midpoint, breaking ties towards li
    if (df(sa[mi]) < 0) li = mi; else ui = mi  // drop lower/upper half of range
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
function searchHigh(sa, df) {
  if (!sa || !sa.length) return 0 // empty/non-array => every element too small

  let li = -1          // This part's the same as searchLow and in fact the only
  let ui = sa.length   // differences are returning 0 above, the < vs <= in the
  let mi               // while loop, and mutatis mutandis in the final return.
  
  while (ui-li > 1) {
    mi = floor((li+ui)/2)
    if (df(sa[mi]) <= 0) li = mi; else ui = mi
  }
  return li === -1 || df(sa[li]) !== 0 ? ui : li
}

// Automon is pretty great but sometimes it would also be nice to have unit
// tests. I'm not sure how best to do that. We don't want crap like the
// following in production... 
/*
const unit_test_1 = searchLow([7,7,7], x => x-7)
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
function shn(x, t=10, d=5, e=0) {
  if (isNaN(x)) return x.toString()
  x = chop(x)
  let i = floor(abs(x)), k, fmt, ostr
  i = i===0 ? 0 : i.toString().length // # of digits left of the decimal
  if (abs(x) > pow(10,i)-0.5) i += 1
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
    else return shn(x, t, d+1, e)
  }

  // If total significant digits < i, do something about it
  if (t < i && abs(pow(10, i-1) - xn) < 0.5) 
    xn = pow(10, i-1)
  t = clip(t, i, i+d)
  
  // If the magnitude <= 1e-4, prevent scientific notation
  if (abs(xn) < 1e-4 || floor(xn) === 9 ||
      floor(xn) === 99 || floor(xn) === 999) {
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
//shns = (x, t=16, d=5, e=0) => (x>=0 ? "+" : "") + shn(x, t, d, e)

/** Show Date: take timestamp and return something like 2012.10.22
    @param {Number} t Unix timestamp */
function shd(t) { return t === null ? 'null' : formatDate(t) }

// Show Date/Time: Take Unix timestamp and return something like 
// "2012.10.22 15:27:03". Not currently used.
//function shdt(t) return { t === null ? 'null' : formatDateTime(t) }

// Singular or Plural: Pluralize the given noun properly, if n is not 1.
// Provide the plural version if irregular. 
// Eg: splur(3, "boy") -> "3 boys", splur(3, "man", "men") -> "3 men" 
function splur(n, noun, nounp='') {
  if (nounp === '') nounp = noun + 's'
  return shn(n, 10, 5) + ' ' + (n === 1 ? noun : nounp)
}

// Rate as a string.
//function shr(r) {
//  //if (r === null) r = 0 // maybe?
//  return shn(r, 4,2)
//}

// Shortcuts for common ways to show numbers
/** shn(chop(x), 4, 2). See {@link module:butil.shn shn}.
    @param {Number} x Input 
    @param {Number} [e=0] Error direction for conservarounding */
//sh1 = function(x, e=0)  { return shn( x, 4,2, e) }
/** shns(chop(x), 4, 2). See {@link module:butil.shns shns}.
    @param {Number} x Input 
    @param {Number} [e=0] Error direction for conservarounding */
//sh1s = function(x, e=0) { return shns(x, 4,2, e) }


/******************************************************************************
 *                         QUANTIZE AND CONSERVAROUND                         *
 ******************************************************************************/

// MASTER COPY CONFUSION WARNING: This function lives at conservaround.glitch.me
// Normalize number: Return the canonical string representation. Is idempotent.
// If we were true nerds we'd do it like wikipedia.org/wiki/Normalized_number
// but instead we're canonicalizing via un-scientific-notation-ing. The other
// point of this is to not lose trailing zeros after the decimal point.
// MASTER COPY CONFUSION WARNING: This function lives at conservaround.glitch.me
function normberlize(x) {
  x = typeof x == 'string' ? x.trim() : x.toString()  // stringify the input
  const car = x.charAt(0), cdr = x.substr(1)          // 1st char, rest of chars
  if (car === '+') x = cdr                            // drop the leading '+'
  if (car === '-') return '-'+normberlize(cdr)        // set aside leading '-'
  x = x.replace(/^0+([^eE])/, '$1')                   // ditch leading zeros
  const rnum = /^(?:\d+\.?\d*|\.\d+)$/                // eg 2 or 3. or 6.7 or .9
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

// MASTER COPY CONFUSION WARNING: This function lives at conservaround.glitch.me
// Infer precision, eg, .123 -> .001 or "12.0" -> .1 or "100" -> 1.
// It seems silly to do this with regexes on strings instead of with floors and
// logs and powers and such but (a) the string the user typed is the ground
// truth and (b) using the numeric representation we wouldn't be able to tell
// the difference between, say, "3" (precision 1) and "3.00" (precision .01).
// MASTER COPY CONFUSION WARNING: This function lives at conservaround.glitch.me
function quantize(x) {
  let s = normberlize(x)               // put the input in canonical string form
  if (/^-?\d+\.?$/.test(s)) return 1   // no decimal pt (or only a trailing one)
  s = s.replace(/^-?\d*\./, '.')       // eg, -123.456 -> .456
  s = s.replace(/\d/g, '0')            // eg,             .456 -> .000
  s = s.replace(/0$/, '1')             // eg,                     .000 -> .001
  return +s                            // return the thing as an actual number
}

// MASTER COPY CONFUSION WARNING: This function lives at conservaround.glitch.me
// Round x to nearest r, avoiding floating point crap like 9999*.1=999.900000001
// at least when r is an integer or negative power of 10.
// MASTER COPY CONFUSION WARNING: This function lives at conservaround.glitch.me
function tidyround(x, r=1) {
  if (r < 0) return NaN
  if (r===0) return +x
  const y = round(x/r)
  const rpow = /^0?\.(0*)10*$/ // eg .1 or .01 or .001 -- a negative power of 10
  const marr = normberlize(r).match(rpow) // match array; marr[0] is whole match
  if (!marr) return y*r
  const p = -marr[1].length-1 // p is the power of 10
  return +normberlize(`${y}e${p}`)
}

// MASTER COPY CONFUSION WARNING: This function lives at conservaround.glitch.me
// Round x to the nearest r ... that's >= x if e is +1
//                          ... that's <= x if e is -1
// MASTER COPY CONFUSION WARNING: This function lives at conservaround.glitch.me
function conservaround(x, r=1, e=0) {
  let y = tidyround(x, r)
  if (e===0) return y
  if (e < 0 && y > x) y -= r
  if (e > 0 && y < x) y += r
  return tidyround(y, r) // already rounded but the +r can fu-loatingpoint it up
}

/******************************************************************************
 *                        STATS AND AGGDAY FUNCTIONS                          *
 ******************************************************************************/

/** Returns an array with n elements uniformly spaced between a and b 
 @param {Number} a Left boundary
 @param {Number} b Right boundary
 @param {Number} n Number of samples */
function linspace(a, b, n) {
  if (typeof n === "undefined") n = max(round(b-a)+1, 1)
  if (n < 2) return n===1 ? [a] : []
  let i,ret = Array(n)
  n--
  for (i=n; i>=0; i--) ret[i] = (i*b+(n-i)*a)/n
  return ret
}

// Convex combination: x rescaled to be in [c,d] as x ranges from a to b.
// PS: This wants to be called lerp, for linear interpolation. HT Freya Holmer
function rescale(x, a,b, c,d) {
  if (abs(a-b) < 1e-7) return x <= (a+b)/2 ? c : d // avoid division by 0
  return c + (x-a)/(b-a)*(d-c)
}

/**Delete Duplicates. The ID function maps elements to something that defines
   equivalence classes.
   @param {Array} a Input array
   @param {function} [idfun=(x=>x)] Function to map elements to an equivalence
           class */
function deldups(a, idfun=(x=>x)) {
  let seen = {}
  return a.filter(i => {
    const marker = JSON.stringify(idfun(i))
    return marker in seen ? false : (seen[marker] = true)
  })
}

/** Whether list l is sorted in increasing order.
    @param {Number[]} l Input list*/
function orderedq(l) {
  for (let i = 0; i < l.length-1; i++) if (l[i] > l[i+1]) return false
  return true
}

/** Whether all elements in a list are zero
    @param {Number[]} a Input list*/
function nonzero(a) {
  let l = a.length, i
  for (i = 0; i < l; i++) if (a[i] !== 0) return true
  return false
}

/** Sum of differences of pairs, eg, [1,2,6,9] -> 2-1 + 9-6 = 1+3 = 4
    If there's an odd number of elements then the last one is ignored.
    @param {Number[]} a Input list*/
function clocky(a) {
  let s = 0
  for (let i = 1; i < a.length; i += 2) s += a[i]-a[i-1]
  return s
}

/** Arithmetic mean of values in list a
    @param {Number[]} a Input list*/
// Nicer version: average = (array) => array.reduce((s,x) => s+x) / array.length
function mean(a) {
  let s = 0, l = a.length, i
  if (l == 0) return 0
  for(i = 0; i < l; i++) s += a[i]
  return s / a.length
}

/** Median of values in list a
    @param {Number[]} a Input list*/
function median(a) {
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
function mode(a) {
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
function trimmean(a, trim) {
  const n = floor(a.length * trim)
  const ta = a.sort((a,b) => a-b).slice(n, a.length - n) // trimmed array
  return ta.reduce((a,b) => a+b) / ta.length
}

/** Whether min <= x <= max.
    @param {Number} x
    @param {Number} min
    @param {Number} max */
// function inrange(x, min, max) { return x >= min && x <= max }

/** Whether abs(a-b) < eps 
    @param {Number} a
    @param {Number} b
    @param {Number} eps */
function nearEq(a, b, eps) { return abs(a-b) < eps }

/******************************************************************************
 *                              DATE FACILITIES                               *
 ******************************************************************************/

/** Returns a new date object ahead by the specified number of
 * days (uses moment)
 @param {moment} m Moment object
 @param {Number} days Number of days to add */
/* Not currently used
function addDays(m, days) {
  let result = moment(m)
  result.add(days, 'days')
  return result
}
*/

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
function daysnap(ut) {
  let d = moment.unix(ut).utc()
  d.hours(0)
  d.minutes(0)
  d.seconds(0)
  d.milliseconds(0)
  return d.unix()
}

/** Scooches unixtime ut to 00:00:00 on the first of the month (uses Moment)
    @param {Number} ut Unix time  */
function monthsnap(ut) {
  let d = moment.unix(ut).utc()
  d.date(1).hours(0).minutes(0).seconds(0).milliseconds(0)
  return d.unix()
}

/** Fixes the supplied unixtime to the first day 00:00:00 on the
    same year (uses moment)
    @param {Number} ut Unix time  */
function yearsnap(ut) {
  let d = moment.unix(ut).utc()
  d.month(0).date(1).hours(0).minutes(0).seconds(0).milliseconds(0)
  return d.unix()
}

/** Formats the supplied unix time as YYYY.MM.DD
    @param {Number} ut Unix time  */
function formatDate(ut) {
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
function formatDateTime(ut) {
  let mm = moment.unix(ut).utc()
  let hour = mm.hour()
  hour = hour < 10 ? "0"+hour.toString() : hour.toString()
  let minute = mm.minute()
  minute = minute < 10 ? "0"+minute.toString() : minute.toString()
  let second = mm.second()
  second = second < 10  ? "0"+second.toString() : second.toString()
  return formatDate(ut)+" "+hour+":"+minute+":"+second
}

let dpre_empty = RegExp('^(\\d{4})(\\d{2})(\\d{2})$')
let pat_empty = "YYYYMMDD"
/** Take a daystamp like "20170531" and return unixtime in seconds
    (dreev confirmed this seems to match Beebrain's function)
    @param {String} s Daystamp as a string "YYYY[s]MM[s]DD"
    @param {String} [sep=''] Separator character */
function dayparse(s, sep='') {
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
function dayify(t, sep = '') {
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
function nowstamp(tz, deadline, asof) {
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

// Convert a number to an integer string.
function sint(x) { return round(x).toString() }

/** Returns a promise that loads a JSON file from the supplied
    URL. Resolves to null on error, parsed JSON object on
    success. 
    @param {String} url URL to load JSON from*/
function loadJSON(url) {
  return new Promise(function(resolve, reject) {
    if (url === "") resolve(null)
    let xobj = new XMLHttpRequest()
    xobj.overrideMimeType("application/json")
    xobj.onreadystatechange = function () {
      if (xobj.readyState == 4 &&
          (xobj.status == "200" ||
              (xobj.status == "0" && xobj.responseText != ""))) {
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
function toTitleCase(str) {
  return str.replace( /\w\S*/g, function(txt) { 
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()});
}

/** Deep compares array a1 and a2 for equality. Does not work on
 * objects within the array 
 @param {Array} a1 First array 
 @param {Array} a2 Second array */
function arrayEquals(a1, a2) {
  // if the other array is a falsy value, return
  if (!(a1 instanceof Array) || !(a2 instanceof Array)) return false

  // compare lengths - can save a lot of time 
  if (a1.length != a2.length) return false

  for (let i = 0, l = a1.length; i < l; i++) {
    // Check if we have nested arrays
    if (a1[i] instanceof Array && a2[i] instanceof Array) {
      // recurse into the nested arrays
      if (!arrayEquals(a1[i], a2[i])) return false
    } else if (a1[i] !== a2[i]) { 
      // Warning - two separate object instances will never
      // be equal: {x:20} != {x:20}
      return false
    }           
  }       
  return true
}

/******************************************************************************
 *                            LINE PROCESSING                                 *
 ******************************************************************************/
/** Returns the value of the line starting from "s", ending at "e" at
 * the provided "x" coordinate */
function lineval(s, e, x) {
  var sl = (e[1]-s[1])/(e[0]-s[0])
  return s[1] + sl * (x-s[0])
}

/** Returns the intersection of the lines starting and ending at s1,e1
 * and s2,s2, respectively, returning null if no intersection is
 * found. */
function lineintersect(s1, e1, s2, e2) { 
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


/******************************************************************************
 *                                 SPLINE FIT                                 *
 ******************************************************************************/

// I guess we never implemented spline fits.


// All the constants and functions butil exports
return {
  MAXTIME, BBURL, BHUE, AKH, BDUSK, SECS, UNAM, 
  nummy, stringy, listy,
  arrMin, arrMax, extendo, deepcopy, partition, quantile, sum,
  accumulate, monotonize, zip, chop, clip, 
  searchLow, searchHigh, 
  shn, shd, splur, 
  conservaround, 
  linspace, rescale, deldups, orderedq, nonzero, 
  clocky, mean, median, mode, trimmean, 
  nearEq, 
  daysnap, monthsnap, yearsnap, formatDate, dayparse, dayify, nowstamp, 
  loadJSON, toTitleCase, arrayEquals,
  lineintersect, lineval
}

})); // END MAIN ---------------------------------------------------------------
