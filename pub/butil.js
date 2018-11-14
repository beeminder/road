/*!
 * butil
 *
 * Dependencies: moment
 * 
 * Javascript library of general purpose utilities for beebrain,
 * provided as a UMD module. Provides a "butil" object, which holds
 * various constants and utility functions to be used. Does not hold
 * any internal state.
 *
 * The following member variables and methods are provided:
 *
 *  BBURL : Base URL for images
 *  Cols  : Beeminder colors for datapoints
 *  DIY   : Days in year
 *  SID   : Seconds in day
 *  AKH   : Akrasia Horizon, in seconds
 *  PRAF  : Fraction of plot range that the axes extend beyond
 *  BDUSK : ~2038, rails's ENDOFDAYS+1 (was 2^31-2weeks)
 *  SECS  : Number of seconds in a year, month, etc
 *  UNAM  : Unit names
 *
 * Copyright © 2018 Uluc Saranli
 */
;((function (root, factory) {
  'use strict'
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    console.log("butil: Using AMD module definition")
    define(['moment'], factory)
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.    
    console.log("butil: Using CommonJS module.exports")
    module.exports = factory(require('moment'))
  } else {
    console.log("butil: Using Browser globals")
    root.butil = factory(root.moment)
  }
})(this, function (moment) {
  'use strict'

  var butil = function() {
    var self = this

    // -----------------------------------------------------------------
    // --------------------- Useful constants --------------------------
    self.BBURL = "http://brain.beeminder.com/"

    /** Beeminder colors for datapoints */
    self.Cols = {
      DYEL:   "#ffff55",
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
      GRNDOT: "#00aa00", //Dark green for good side of the road
      BLUDOT: "#3f3fff", // Blue for correct lane
      ORNDOT: "#ffa500", // Orange for wrong lane
      REDDOT: "#ff0000"  // Red for off the road on the bad side
    }

    self.DIY   = 365.25     // Days in year
    self.SID   = 86400      // Seconds in day
    self.AKH   = 7*self.SID // Akrasia Horizon, in seconds
    self.BDUSK = 2147317201 // ~2038, rails's ENDOFDAYS+1 (was 2^31-2weeks)
    self.ZFUN = function(x) { return 0 } // Function that always returns zero
    // TODO?: IMGMAG
    
    // Number of seconds in a year, month, etc
    self.SECS = { 'y' : self.DIY*self.SID, 
                  'm' : self.DIY/12*self.SID,
                  'w' : 7*self.SID,
                  'd' : self.SID,
                  'h' : 3600        }
    // Unit names
    self.UNAM = { 'y' : 'year',
                  'm' : 'month',
                  'w' : 'week',
                  'd' : 'day',
                  'h' : 'hour'      }

    // -----------------------------------------------------------------
    // ---------------- General Utility Functions ----------------------
    self.arrMin = function(arr) {
      return Math.min.apply(null, arr)
    }

    self.arrMax = function(arr) {
      return Math.max.apply(null, arr)
    }

    self.isArray = function(o) {
      return (/Array/).test(Object.prototype.toString.call(o))
    }

    self.extend = function(to, fr, owr) {
      var prop, hasProp
      for (prop in fr) {
        hasProp = to[prop] !== undefined
        if (hasProp && typeof fr[prop] === 'object' 
            && fr[prop] !== null  && fr[prop].nodeName === undefined ) {
              if (self.isArray(fr[prop])) {
                if (owr) {
                  to[prop] = fr[prop].slice(0)
                }
              } else {
                to[prop] = self.extend({}, fr[prop], owr)
              }
            } else if (owr || !hasProp) {
              to[prop] = fr[prop]
            }
      }
      return to
    }
    
    /** Tested, but this does not seem like "argmax" functionality to
     me, argmax should return the index. This is just max with a
     filter */
    self.argmax = function(f, dom) {
      if (dom == null) return null
      var newdom = dom.map(f)
      var maxelt = self.arrMax(newdom)
      return dom[newdom.findIndex( e => (e == maxelt))]
    }

    /** Partitions list l into sublists whose beginning indices are
     separated by d, and whose lengths are n. If the end of the list is
     reached and there are fewer than n elements, those are not
     returned. */
    self.partition = function(l, n, d) {
      var il = l.length
      var ol = []
      for (var i=0; i < il; i+=d)
        if (i+n <= il) ol.push(l.slice(i,i+n))
      return ol
    }
    
    /** Returns a list containing the fraction and integer parts of a float */
    self.modf = function(f) {
      var fp = (f<0)?-f:f, fl = Math.floor(fp)
      return (f<0)?[-(fp-fl),-fl]:[(fp-fl),fl]
    }

    /** The qth quantile of values in l. For median, set q=1/2.  See
     http://reference.wolfram.com/mathematica/ref/Quantile.html Author:
     Ernesto P. Adorio, PhD; UP Extension Program in Pampanga, Clark
     Field. */
    self.quantile = function(l, q, qt=1, issorted=false) {
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

    // Return a list with the cumulative sum of the elements in l, left
    // to right
    self.sum = function(l) {
      return l.reduce((a,b)=>(a+b), 0)
    }
    
    // Return a list with the cumulative sum of the elements in l, left
    // to right
    self.accumulate = function(l) {
      var ne = l.length
      if (ne == 0) return l
      var nl = [l[0]]
      for (var i = 1; i < ne; i++) nl.push(nl[nl.length-1]+l[i])
      return nl
    }

    // Takes a list like [1,2,1] and make it like [1,2,2] (monotone increasing)
    //Or if dir==-1 then min with the previous value to make it monotone decreasing
    self.monotonize = function(l, dir=1) {
      var lo = l.slice(), i
      if (dir == 1) {
        for (i = 1; i < lo.length; i++)
          lo[i] = Math.max(lo[i-1],lo[i])
      } else {
        for (i = 1; i < lo.length; i++)
          lo[i] = Math.min(lo[i-1],lo[i])
      }
      return lo
    }

    // zip([[1,2], [3,4]]) --> [[1,3], [2,4]]
    self.zip = function (av) {
      return av[0].map(function(_,i){
        return av.map(a => a[i])
      })
    }

    // Return 0 when x is very close to 0
    self.chop = function (x, delta=1e-7) { 
      return (Math.abs(x) < delta)?0:x
    }

    // Return an integer when x is very close to an integer
    self.ichop = function(x, delta=1e-7) {
      var fp = x % 1, ip = x - fp
      if (fp < 0) {fp += 1; ip -= 1;}
      if (fp > 0.5) fp = 1 - self.chop(1-fp)
      return Math.floor(ip) + self.chop(fp, delta)
    }

    // clip(x, a,b) = min(b,max(a,x))
    self.clip = function(x, a, b) {
      if (a > b) { var tmp=a; a=b; b=tmp;}
      if (x < a) x = a
      if (x > b) x = b
      return x
    }

    /** Show Number: convert number to string. Use at most d
     significant figures after the decimal point. Target t significant
     figures total (clipped to be at least i and at most i+d, where i
     is the number of digits in integer part of x). */
    self.shn = function(x, t=10, d=5) {
      if (isNaN(x)) return x.toString()
      var i = Math.floor(Math.abs(x)), k, fmt, ostr
      i = (i==0)?0:i.toString().length // # of digits left of the decimal
      if (Math.abs(x) > Math.pow(10,i)-.5) i += 1
      if (i == 0 && x != 0)
        k = (Math.floor(d - Math.log10(Math.abs(x)))) // get desired 
      else k = d                                          // dec. digits
      // Round input to have the desired number of decimal digits
      var v = x * Math.pow(10,k), vm = v % 10
      if (vm < 0) vm += 10
      // Hack to prevent incorrect rounding with the decimal digits:
      if (vm >= 4.5 && vm < 4.9999999) v = Math.floor(v)
      var xn = Math.round(v) / Math.pow(10,k) + 1e-10
      // If total significant digits < i, do something about it
      if (t < i && Math.abs(Math.pow(10,(i-1)) - xn) < .5) 
        xn = Math.pow(10,(i-1))
      t = self.clip(t, i, i+d)
      // If the magnitude <= 1e-4, prevent scientific notation
      if (Math.abs(xn) < 1e-4 || Math.floor(xn) == 9 
          || Math.floor(xn) == 99 || Math.floor(xn) == 999) {
        ostr = parseFloat(x.toPrecision(k)).toString()
      } else {
        ostr = xn.toPrecision(t)
        if (!ostr.includes('e')) ostr = parseFloat(ostr)
      }
      return ostr
    }

    // Show Number with Sign: include the sign explicitly
    self.shns = function(x, t=16, d=5) {
      return ((x>=0)?"+":"")+self.shn(x, t, d)
    }

    // Same as above but with conservarounding
    self.shnsc = function(x, e, t=16, d=5) {
      return ((x>=0)?"+":"")+self.shnc(x, e, t, d)
    }

    // Show Date: take timestamp and return something like 2012.10.22
    self.shd = function(t) {
      return (t == null)?'null':self.formatDate(t)
    }

    //Show Date/Time: take timestamp and return something like 2012.10.22 15:27:03
    self.shdt = function(t) {
      return (t == null)?'null':self.formatDateTime(t)
    }

    // TODO: need to DRY this and shn() up but want to totally revamp shownum anyway.
    // Show Number, rounded conservatively (variant of shn where you pass which
    // direction, +1 or -1, is safe to err on). Aka conservaround!
    // Eg, shnc(.0000003, +1, 2) -> .01
    self.shnc = function(x, errdir, t=10, d=5) {
      if (isNaN(x)) return x.toString()
      var i = Math.floor(Math.abs(x)), k, fmt, ostr
      i = (i==0)?0:i.toString().length // # of digits left of the decimal
      if (Math.abs(x) > Math.pow(10,i)-.5) i += 1
      if (i == 0 && x != 0)
        k = (Math.floor(d - Math.log10(Math.abs(x)))) // get desired 
      else k = d                                          // dec. digits
      // Round input to have the desired number of decimal digits
      var v = x * Math.pow(10,k), vm = v % 10
      if (vm < 0) vm += 10
      // Hack to prevent incorrect rounding with the decimal digits:
      if (vm >= 4.5 && vm < 4.9999999) v = Math.floor(v)
      var xn = Math.round(v) / Math.pow(10,k) + 1e-10
      //Conservaround
      if ((errdir < 0 && xn > x) || ((errdir > 0) && (xn < x))) { 
        if (d >= 10) xn = x
        else return self.shnc(x, errdir, t, d+1)
      }
      // If total significant digits < i, do something about it
      if (t < i && Math.abs(Math.pow(10,(i-1)) - xn) < .5) 
        xn = Math.pow(10,(i-1))
      t = self.clip(t, i, i+d)
      // If the magnitude <= 1e-4, prevent scientific notation
      if (Math.abs(xn) < 1e-4 || Math.floor(xn) == 9 
          || Math.floor(xn) == 99 || Math.floor(xn) == 999) {
        ostr = parseFloat(x.toPrecision(k)).toString()
      } else {
        ostr = xn.toPrecision(t)
        if (!ostr.includes('e')) ostr = parseFloat(ostr)
      }
      return ostr
    }

    // Singular or Plural: Pluralize the given noun properly, if n is not 1. 
    // Provide the plural version if irregular.
    // Eg: splur(3, "boy") -> "3 boys", splur(3, "man", "men") -> "3 men"
    self.splur = function(n, noun, nounp='') {
      if (nounp=='') nounp = noun+'s'
      return self.shn(n)+' '+((n == 1)?noun:nounp)
    }
    
    // Rate as a string
    self.shr = function(r) {
      if (r == null) r = 0
      // show as a percentage if exprd is true #SCHDEL
      //return shn((100.0 if exprd else 1.0)*r, 4,2) + ("%" if exprd else "")
      return self.shn(r, 4,2)
    }
    
    // Shortcuts for common ways to show numbers
    self.sh1 = function(x)      { return self.shn(  self.chop(x),    4,2) }
    self.sh1c = function(x, e)  { return self.shnc( self.chop(x), e, 4,2) }
    self.sh1s = function(x)     { return self.shns( self.chop(x),    4,2) }
    self.sh1sc = function(x, e) { return self.shnsc(self.chop(x), e, 4,2) }

    self.linspace = function linspace( a, b, n) {
      if (typeof n === "undefined") n = Math.max(Math.round(b-a)+1,1)
      if (n < 2) { return n===1?[a]:[] }
      var i,ret = Array(n)
      n--
      for(i=n;i>=0;i--) { ret[i] = (i*b+(n-i)*a)/n }
      return ret
    }

    // Convex combination: x rescaled to be in [c,d] as x ranges from
    // a to b.  clipQ indicates whether the output value should be
    // clipped to [c,d].  Unsorted inputs [a,b] and [c,d] are also
    // supported and work in the expected way except when clipQ =
    // false, in which case [a,b] and [c,d] are sorted prior to
    // computing the output.
    self.cvx = function(x, a,b, c,d, clipQ=true) {
      var tmp
      if (self.chop(a-b) == 0) {
        if (x <= a) return Math.min(c,d)
        else        return Math.max(c,d)
      }
      if (self.chop(c-d) == 0) return c
      if (clipQ)
        return self.clip(c + (x-a)/(b-a)*(d-c), (c>d)?d:c,(c>d)?c:d)
      else {
        if (a > b) { tmp=a; a=b; b=tmp;}
        if (c > d) { tmp=c; c=d; d=tmp;}
        return c + (x-a)/(b-a)*(d-c)
      }
    }
  
    self.deldups = function(a, idfun = (x=>x)) {
      var seen = {}
      return a.filter(it=>{var marker = JSON.stringify(idfun(it));
                           return seen.hasOwnProperty(marker)?false:(seen[marker] = true)})
    }

    // Whether list l is sorted in increasing order
    self.orderedq = function(l) {
      for (var i = 0; i < l.length-1; i++)
        if (l[i] > l[i+1]) return false;
      return true;
    }

    self.nonzero = function(a) {
      var l = a.length, i
      for( i = 0; i < l; i++ ){ if (a[i] != 0) return true}
      return false
    }

    self.clocky = function(a) {
      var s = 0, l = a.length, i
      for( i = 1; i < l; i+=2 ){ s += (a[i]-a[i-1])}
      return s
    }

    self.sum = function(a) {
      var s = 0, l = a.length, i
      for( i = 0; i < l; i++ ){ s += a[i]}
      return s
    }

    self.mean = function (a) {
      var s = 0,l = a.length,i
      if (l == 0) return 0
      for( i = 0; i < l; i++ ){ s += a[i]}
      return s/a.length
    }

    self.median = function(a) {
      var m = 0, l = a.length
      a.sort((a,b)=>(a-b))
      if (l % 2 === 0) { m = (a[l / 2 - 1] + a[l / 2]) / 2 }
      else { m = a[(l - 1) / 2]}
      return m
    }

    self.mode = function(a) {
      var md = [], count = [], i, num, maxi = 0, al = a.length
      
      for (i = 0; i < al; i += 1) {
        num = a[i]
        count[num] = (count[num] || 0) + 1
        if (count[num] > maxi) { maxi = count[num] }
      }
    
      for (i in count)
        if (count.hasOwnProperty(i)) {
          if (count[i] === maxi) { md.push(Number(i))}
        }
      return md
    }

    self.inrange = function(x, min, max) {
      return x >= min && x <= max
    }

    self.nearlyEqual = function(a, b, eps) {
      return Math.abs(a - b) < eps
    }

  // --------------------------------------------------------
  // ----------------- Date facilities ----------------------

    // Returns a new date object ahead by the specified number of days
    self.addDays = function(m, days) {
      var result = moment(m)
      result.add(days, 'days')
      return result
    }

    // Fixes the supplied unixtime to 00:00:00 on the same day
    self.daysnap = function(ut) {
      var d = moment.unix(ut).utc()
      d.hours(0); d.minutes(0); d.seconds(0); d.milliseconds(0);
      return d.unix()
    }

    self.formatDate = function(ut) {
      var mm = moment.unix(ut).utc()
      var year = mm.year()
      var month = (mm.month()+1)
      month = (month < 10)?"0"+month.toString():month.toString()
      var day = mm.date()
      day= (day < 10)?"0"+day.toString():day.toString()
      return year+"."+month+"."+day
    }

    self.formatDateTime = function(ut) {
      var mm = moment.unix(ut).utc()
      var hour = mm.hour()
      hour = (hour < 10)?"0"+hour.toString():hour.toString()
      var minute = mm.minute()
      minute = (minute < 10)?"0"+minute.toString():minute.toString()
      var second = mm.second()
      second = (second < 10)?"0"+second.toString():second.toString()
      return self.formatDate(ut)+" "+hour+":"+minute+":"+second
    }

    // Take a daystamp like "20170531" and return unixtime in seconds
    // (dreev confirmed this seems to match Beebrain's function)
    self.dayparse = function(s, sep='') {
      if (!RegExp('^\\d{4}'+sep+'\\d{2}'+sep+'\\d{2}$').test(s)) { 
        // Check if the supplied date is a timestamp or not.
        if (!isNaN(s)) return Number(s)
        else return NaN
      }
      s = s.replace(RegExp('^(\\d\\d\\d\\d)'+sep+'(\\d\\d)'+sep+'(\\d\\d)$'), 
                    "$1-$2-$3")
      return self.daysnap(moment.utc(s).unix())
    }

    // Take an integer unixtime in seconds and return a daystamp like "20170531"
    // (dreev superficially confirmed this works)
    // Uluc: Added option choose a separator
    self.dayify = function(t, sep = '') {
      if (isNaN(t) || t < 0) { return "ERROR" }
      var mm = moment.unix(t).utc()
      var y = mm.year()
      var m = mm.month() + 1
      var d = mm.date()
      return '' + y + sep + (m < 10 ? '0' : '') + m 
        + sep + (d < 10 ? '0' : '') + d
    }

    /** Converts a number to an integer string */
    self.sint = function(x){ return Math.round(x).toString(); }

    // Returns a promise that loads a JSON file from the supplied URL
    self.loadJSON = function( url ) {   
      //console.debug("butil.loadJSON: "+url)
      return new Promise(function(resolve, reject) {
        if (url === "") resolve(null)
        var xobj = new XMLHttpRequest()
        xobj.overrideMimeType("application/json")
        xobj.onreadystatechange = function () {
          if (xobj.readyState == 4 
              && (xobj.status == "200"
                  || (xobj.status == "0" && xobj.responseText !== ""))) {
            resolve(JSON.parse(xobj.responseText))
          } else if (xobj.readyState == 4) {
            resolve(null)
          }
        }
        xobj.open('GET', url, true)
        xobj.send(null)
      })
    }

    self.toTitleCase = function(str) {
      return str.replace(
          /\w\S*/g,
        function(txt) {
          return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
      );
    }    

    self.arrayEquals = function(a1, a2) {
      // if the other array is a falsy value, return
      if (!(a1 instanceof Array) || !(a2 instanceof Array)) return false

      // compare lengths - can save a lot of time 
      if (a1.length != a2.length) return false;

      for (var i = 0, l=a1.length; i < l; i++) {
          // Check if we have nested arrays
          if (a1[i] instanceof Array && a2[i] instanceof Array) {
              // recurse into the nested arrays
            if (!self.arrayEquals(a1[i], a2[i])) return false
          } else if (a1[i] != a2[i]) { 
              // Warning - two different object instances will never be equal: {x:20} != {x:20}
              return false;   
          }           
      }       
      return true;
    }
    self.nummy = function(n)  { return !isNaN(parseFloat(n)) && isFinite(n) }
    self.stringy = function(x){ return  typeof x == "string" }
    self.listy = function(x)  { return  Array.isArray(x) }

    // Type-checking convenience functions
    self.torf = function(x){ return typeof x == "boolean"}            // True or False
    self.born = function(x){ return self.torf(x) | (x == null) }      // Boolean or Null
    self.norn = function(x){ return self.nummy(x) || (x == null) }    // Numeric or Null
    self.timy = function(x){ return self.nummy(x) && 0<x && x<self.BDUSK } // Valid time
    self.torn = function(x){ return self.timy(x) || (x == null) }     // ValidTime or Null
    self.sorn = function(x){ return typeof x == "string" || (x == null) } //String or Null

  }

  return new butil()
}));
