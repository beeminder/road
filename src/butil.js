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

/**
 * Library of general purpose utilities for Beebrain, provided as a UMD
 * module. Provides a "butil" object holding various constants and utility
 * functions. No internal state.<br/>
 *
 * Copyright © 2018-2019 Uluc Saranli and Daniel Reeves
 *
 * @requires moment
 * @exports butil
 */

var self = {}

/******************************************************************************
 *                                 CONSTANTS                                  *
 ******************************************************************************/

/** Maximum amount of time beebrain related processing should take
   * (in ms). Users of bgraph and related tools should implement
   * timeouts with this amount to avoid infinite waits in case
   * something goes wrong
   @type {Number}*/
self.MAXTIME = 60000,

/** Base URL for images.
    @type {String}*/
self.BBURL = "http://brain.beeminder.com/"

/** Beeminder colors for datapoints 
    @enum {string}*/
self.Cols = {
  DYEL:   "#ffff44",
  LYEL:   "#ffff88",
  ROSE:   "#ff8080",
  AKRA:   "#4C4Cff",
  PURP:   "#B56bb5",
  BLUE:   "#EAEAFF",
  GRUE:   "#b5ffDE",
  ORNG:   "#ff8000",
  WITE:   "#ffffff",
  BIGG:   "#ffe54c",
  PINK:   "#ffe5e5",
  PNKE:   "#ffcccc",
  GRAY:   "#f0f0f0",
  BLCK:   "#000000",
  GRNDOT: "#00aa00", // Dark green for good side of the road
  BLUDOT: "#3f3fff", // Blue for correct lane
  ORNDOT: "#ffa500", // Orange for wrong lane
  REDDOT: "#ff0000"  // Red for off the road on the bad side
}

/** Days in year
    @type {Number}*/
self.DIY   = 365.25
/** Seconds in day 
    @type {Number}*/
self.SID   = 86400
/** Akrasia horizon, in seconds 
    @type {Number}*/
self.AKH   = 7*self.SID
/** ~2038, rails's ENDOFDAYS+1 (was 2^31-2weeks) 
    @type {Number}*/
self.BDUSK = 2147317201
/** Unary function that always returns zero 
    @param {} x*/
// self.ZFUN = (_) => 0 // not used

/** Number of seconds in a year, month, etc 
    @enum {Number} */
self.SECS = { 'y' : self.DIY*self.SID, 
              'm' : self.DIY*self.SID/12,
              'w' : 7*self.SID,
              'd' : self.SID,
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
self.arrMin = (arr) =>( Math.min.apply(null, arr)) // could use spread operator
/** Returns maximum from an array of numbers
    @param {Number[]} arr Input array */
self.arrMax = (arr) =>( Math.max.apply(null, arr)) // could use spread operator

/** Returns true if input is an array 
    @param {} o Input parameter*/
//self.isArray = (o) => ((/Array/).test(Object.prototype.toString.call(o)))
self.isArray = Array.isArray

// TODO: Does not properly copy, especially for array properties. FIX
/** Extends a destination object with properties from a source
 * object, optionally overwriting existing elements

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
  var fp = (f<0)?-f:f, fl = Math.floor(fp)
  return (f<0)?[-(fp-fl),-fl]:[(fp-fl),fl]
}

/** The qth quantile of values in l. For median, set q=1/2.  See
    http://reference.wolfram.com/mathematica/ref/Quantile.html Author:
    Ernesto P. Adorio, PhD; UP Extension Program in Pampanga, Clark
    Field. 
    @param {Number[]} l Input array
    @param {Number} q Desired quantile, in range [0,1]
    @param {Number} [qt=1] Type of quantile computation, Hyndman and Fan algorithm, integer between 1 and 9
    @param {boolean} [issorted=false] Flag to indicate whether the input array is sorted
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
  j = Math.floor(j)
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
    for (i = 1; i < lo.length; i++) lo[i] = Math.max(lo[i-1],lo[i])
  } else {
    for (i = 1; i < lo.length; i++) lo[i] = Math.min(lo[i-1],lo[i])
  }
  return lo
}

/** zip([[1,2], [3,4]]) --> [[1,3], [2,4]].
    @param {Array[]} av Array of Arrays to zip */
self.zip =  (av) => av[0].map((_,i) => av.map(a => a[i]))

/** Return 0 when x is very close to 0.
    @param {Number} x Input number
    @param {Number} [delta=1e-7] Tolerance */
self.chop = (x, delta=1e-7) => ((Math.abs(x) < delta)?0:x)

/** Return an integer when x is very close to an integer
    @param {Number} x Input number
    @param {Number} [delta=1e-7] Tolerance */
self.ichop = (x, delta=1e-7) => {
  var fp = x % 1, ip = x - fp
  if (fp < 0) {fp += 1; ip -= 1;}
  if (fp > 0.5) fp = 1 - self.chop(1-fp)
  return Math.floor(ip) + self.chop(fp, delta)
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

/******************************************************************************
 *                                  SHOWNUM                                   *
 ******************************************************************************/

/** Show Number: convert number to string. Use at most d
    significant figures after the decimal point. Target t significant
    figures total (clipped to be at least i and at most i+d, where i
    is the number of digits in integer part of x). 
    @param {Number} x Input number
    @param {Number} [t=10] Total number of significant figures 
    @param {Number} [d=5] Number of significant figures after the decimal 
    @param {Number} [e=0] Error direction for conservarounding */
self.shn = (x, t=10, d=5, e=0) => {
  if (isNaN(x)) return x.toString()
  let i = Math.floor(Math.abs(x)), k, fmt, ostr
  i = i===0 ? 0 : i.toString().length // # of digits left of the decimal
  if (Math.abs(x) > Math.pow(10,i)-.5) i += 1
  if (i === 0 && x !== 0)                             // get
    k = Math.floor(d - Math.log10(Math.abs(x)))       // desired
  else k = d                                          // decimal digits

  //return self.conservaround(x, 10**-k, e)

  // Round input to have the desired number of decimal digits
  let v = x * Math.pow(10, k), vm = v % 10
  if (vm < 0) vm += 10

  // Hack to prevent incorrect rounding with the decimal digits:
  if (vm >= 4.5 && vm < 4.9999999) v = Math.floor(v)
  let xn = Math.round(v) / Math.pow(10, k) + 1e-10

  // Conservaround
  if (e < 0 && xn > x || e > 0 && xn < x) { 
    if (d >= 10) xn = x
    else return self.shn(x, t, d+1, e)
  }

  // If total significant digits < i, do something about it
  if (t < i && Math.abs(Math.pow(10, i-1) - xn) < .5) 
    xn = Math.pow(10, i-1)
  t = self.clip(t, i, i+d)
  
  // If the magnitude <= 1e-4, prevent scientific notation
  if (Math.abs(xn) < 1e-4 || Math.floor(xn) === 9 
      || Math.floor(xn) === 99 || Math.floor(xn) === 999) {
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
self.shns = (x, t=16, d=5, e=0) => (x>=0 ? "+" : "") + self.shn(x, t, d, e)

/** Show Date: take timestamp and return something like 2012.10.22
    @param {Number} t Unix timestamp */
self.shd = (t) => t === null ? 'null' : self.formatDate(t)

/** Show Date/Time: take timestamp and return something like
    2012.10.22 15:27:03 
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
self.shr = (r) => {
  if (r === null) r = 0
  return self.shn(r, 4,2)
}

// Shortcuts for common ways to show numbers
/** shn(chop(x), 4, 2). See {@link module:butil.shn shn}.
    @param {Number} x Input 
    @param {Number} [e=0] Error direction for conservarounding */
self.sh1 = function(x, e=0)  { return self.shn(  self.chop(x), 4,2, e) }
/** shns(chop(x), 4, 2). See {@link module:butil.shns shns}.
    @param {Number} x Input 
    @param {Number} [e=0] Error direction for conservarounding */
self.sh1s = function(x, e=0) { return self.shns( self.chop(x), 4,2, e) }


/******************************************************************************
 *                               CONSERVAROUND                                *
 ******************************************************************************/

// These functions are from conservaround.glitch.me

// Normalize number: Return the canonical string representation. Is idempotent.
// If we were true nerds we'd do it like wikipedia.org/wiki/Normalized_number
// but instead we're canonicalizing via un-scientific-notation-ing. The other
// point of this is to not lose trailing zeros after the decimal point.
// Possible issue: Some equivalent representations don't normalize to the same 
// thing. Eg, 0.5 -> 0.5 and .5 -> .5, 2 -> 2 and +2 -> +2, 3 -> 3 and 3. -> 3.
self.normberlize = function(x) {
  x = typeof x == 'string' ? x.trim() : (+x).toString() // stringify the input
  x = x.replace(/^([+-]?)0+([^eE\.])/, '$1$2')        // ditch the leading zeros
  const rnum = /^[+-]?(?:\d+\.?\d*|\.\d+)$/           // regex from d.glitch.me
  if (rnum.test(x)) return x                          // already normal! done!
  const rsci = /^([+-]?(?:\d+\.?\d*|\.\d+))e([+-]?\d+$)/i // sci. notation
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

// Infer precision, eg, .123 -> .001 or "12.0" -> .1
// It's sort of silly to do this with regexes on strings instead of with floors
// and logs and powers and such but (a) the string the user typed is the ground
// truth and (b) this is just more robust and portable.
self.quantize = function(x) {
  let s = self.normberlize(x)          // put the input in canonical string form
  if (/^-?\d+\.?$/.test(s)) return 1   // no decimal pt (or only a trailing one)
  s = s.replace(/^-?\d*\./, '.')       // eg, -123.456 -> .456
  s = s.replace(/\d/g, '0')            // eg,             .456 -> .000
  s = s.replace(/0$/, '1')             // eg,                     .000 -> .001
  return +s                            // return the thing as an actual number
}

// Round x to nearest r, avoiding floating point crap like 9999*.1=999.900000001
// at least when r is an integer or negative power of 10
self.round = function(x, r=1) {
  if (r < 0) return NaN
  if (r===0) return +x
  const y = Math.round(x/r)
  const rpow = /^0?\.(0*)1$/   // eg .1 or .01 or .001 -- a negative power of 10
  const marr = r.toString().match(rpow)   // match array; marr[0] is whole match
  if (!marr) return y*r
  const p = -marr[1].length-1 // p is the power of 10
  return +self.normberlize(`${y}e${p}`)
}

// Round x to the nearest r ... that's >= x if e is +1
//                          ... that's <= x if e is -1
self.conservaround = function(x, r=1, e=0) {
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
  if (typeof n === "undefined") n = Math.max(Math.round(b-a)+1, 1)
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
    if (x <= a) return Math.min(c,d)
    else        return Math.max(c,d)
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

/** Delete Duplicates. The ID function maps elements to something
    that defines equivalence classes.
    @param {Array} a Input array
    @param {function} [idfun=(x=>x)] Function to map elements to an equivalence class */
self.deldups = (a, idfun = (x=>x)) => {
  var seen = {}
  return a.filter(it=>{var marker = JSON.stringify(idfun(it));
                       return seen.hasOwnProperty(marker)?false
                       :(seen[marker] = true)})
}

/** Whether list l is sorted in increasing order.
    @param {Number[]} l Input list*/
self.orderedq = (l) => {
  for (let i = 0; i < l.length-1; i++)
    if (l[i] > l[i+1]) return false;
  return true;
}

/** Whether all elements in a list are zero
    @param {Number[]} a Input list*/
self.nonzero = (a) => {
  var l = a.length, i
  for (i = 0; i < l; i++) if (a[i] !== 0) return true
  return false
}

/** Sum of differences of pairs, eg, [1,2,6,9] -> 2-1 + 9-6 = 1+3
 * = 4
 @param {Number[]} a Input list*/
self.clocky = (a) => {
  var s = 0, l = a.length, i
  for (i = 1; i < l; i+=2) s += a[i]-a[i-1]
  return s
}

/** Arithmetic mean of values in list a
    @param {Number[]} a Input list*/
self.mean = (a) => {
  var s = 0,l = a.length,i
  if (l == 0) return 0
  for( i = 0; i < l; i++ ){ s += a[i]}
  return s/a.length
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

/** Mode of values in list a
    @param {Number[]} a Input list*/
self.mode = (a) => {
  var md = [], count = [], i, num, maxi = 0, al = a.length
  
  for (i = 0; i < al; i += 1) {
    num = a[i]
    count[num] = (count[num] || 0) + 1
    if (count[num] > maxi) maxi = count[num]
  }
  
  for (i in count)
    if (count.hasOwnProperty(i)) 
      if (count[i] === maxi) md.push(Number(i))
  return md
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
self.nearEq = (a, b, eps) => Math.abs(a-b) < eps

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

/** Fixes the supplied unixtime to 00:00:00 on the same day (uses moment)
    @param {Number} ut Unix time  */
self.daysnap = (ut) => {
  var d = moment.unix(ut).utc()
  d.hours(0); d.minutes(0); d.seconds(0); d.milliseconds(0)
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
  var re, pat
  if (sep=='') {
    // Optimize for the common case
    re = dpre_empty
    pat = pat_empty
  } else {
    // General case with configurable separator
    re = RegExp('^(\\d{4})'+sep+'(\\d{2})'+sep+'(\\d{2})$')
    pat = "YYYY"+sep+"MM"+sep+"DD"
  }
  if (!re.test(s)) { 
      // Check if the supplied date is a timestamp or not
      if (!isNaN(s)) return Number(s)
      else return NaN
  }
  let m = moment.utc(s, pat)
  // Perform daysnap manually for efficiency
  m.hours(0).minutes(0).seconds(0).milliseconds(0)
  return m.unix()
}

/** Take an integer unixtime in seconds and return a daystamp like
    "20170531" (dreev superficially confirmed this works) Uluc: Added
    option to choose a separator
    @param {Number} t Integer unix timestamp
    @param {String} [sep=''] Separator character to use */
self.dayify = (t, sep = '') => {
  if (isNaN(t) || t < 0) { return "ERROR" }
  var mm = moment.unix(t).utc()
  var y = mm.year()
  var m = mm.month() + 1
  var d = mm.date()
  return '' + y + sep + (m < 10 ? '0' : '') + m 
    + sep + (d < 10 ? '0' : '') + d
}

/** Converts a number to an integer string.
    @param {Number} x Input number */
self.sint = (x) => Math.round(x).toString()

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
