/*!
 * jsbrain
 *
 * Dependencies: moment
 * 
 * Javascript implementation of beebrain, provided as a UMD
 * module. Provides a "jsbrain" function, which can be used to
 * construct independent jsbrain objects each with their unique
 * ID. The constructor accepts a "bb" object as an initial beebrain
 * file input.
 *
 * The following member variables and methods are exported within
 * constructed objects:
 *
 *  id: jsbrain instance ID 
 *
 * Copyright © 2017 Uluc Saranli
 */
;((function (root, factory) {
  'use strict'
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    console.log("jsbrain: Using AMD module definition")
    define(['moment', 'polyfit'], factory)
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.    
    console.log("jsbrain: Using CommonJS module.exports")
    module.exports = factory(require('moment'), require('polyfit'))
  } else {
    console.log("jsbrain: Using Browser globals")
    root.jsbrain = factory(root.moment, root.polyfit)
  }
})(this, function (moment, Polyfit) {
  'use strict'

  // -------------------------------------------------------------
  // ------------------- FACTORY GLOBALS ---------------------
  /** Global counter to Generate unique IDs for multiple jsbrain instances. */
  var gid = 1,

  /** Base URL for images */
  BBURL = "http://brain.beeminder.com/",

  pin = { // In Params: Graph settings and their defaults
    'deadline' :0,    //Time of deadline given as seconds bfr or after midnight
    'sadlhole' :true, //Allow the do-less l.hole where you can eke back onto YBR
    'asof'     :null, //Compute everything as if it were this date
    'tini'     :null, //(tini,vini) specifies the strt of the YBR, typically but
    'vini'     :null, // not necessarily the same as the initial datapoint
    'road'     :[],   //List of (endTime,goalVal,rate) triples defining the YBR
    'tfin'     :null, //Goal date (unixtime); end of the Yellow Brick Road
    'vfin'     :null, //The actual value being targeted; any real value
    'rfin'     :null, //Final rate (slope) of the YBR before it hits the goal
    'runits'   :'w',  //Rate units for road and rfin; one of "y","m","w","d","h"
    'yaw'      :0,    //Which side of the YBR you want to be on, +1 or -1
    'dir'      :0,    //Which direction you'll go (usually same as yaw)
    'pinkzone' :[],   //Region to shade pink, specified like the road matrix
    'tmin'     :null, //Earliest date to plot on the x-axis (unixtime):
    'tmax'     :null, //((tmin,tmax), (vmin,vmax)) give the plot range, ie, they
    'vmin'     :null, //control zooming/panning; they default to the entire
    'vmax'     :null, //  plot -- initial datapoint to past the akrasia horizon
    'kyoom'    :false,//Cumulative; plot vals as the sum of those entered so far
    'odom'     :false,//Treat zeros as accidental odom resets
    'abslnw'   :null, //Override road width algorithm with a fixed lane width
    'noisy'    :false,//Compute road width based on data, not just road rate
    'integery' :false,//Whether vals are necessarily integers (used in limsum)  
    'monotone' :false,//Whether data is necessarily monotone (used in limsum) 
    'aggday'   :null, //sum/last/first/min/max/mean/median/mode/trimmean/jolly
    'plotall'  :true, //Plot all the points instead of just the aggregated point
    'steppy'   :false,//Join dots with purple steppy-style line
    'rosy'     :false,//Show the rose-colored dots and connecting line
    'movingav' :false,//Show moving average line superimposed on the data
    'aura'     :false,//Show blue-green/turquoise aura/swath
    'yaxis'    :'',   //Label for the y-axis, eg, "kilograms"
    'waterbuf' :null, //Watermark on the good side of the YBR; safebuf if null
    'waterbux' :'',   //Watermark on the bad side, ie, pledge amount
    'hidey'    :false,//Whether to hide the y-axis numbers
    'stathead' :true, //Whether to include a label with stats at top of graph 
    'imgsz'    :760,  //Image size; width in pixels of the graph image        
    'yoog'     :'U/G',//Username/graphname, eg, "alice/weight"                
    'usr'      :null,//Username (synonym for first half of yoog) ######## DEP
    'graph'    :null,//Graph name (synonym for second half of yoog) ##### DEP
    'gldt'     :null,//Synonym for tfin ################################# DEP
    'goal'     :null,//Synonym for vfin ################################# DEP
    'rate'     :null //Synonym for rfin ################################# DEP
  },
  
  pout = { // Out Params: Beebrain output fields
    sadbrink : false,  // Whether we were red yest. & so will instaderail today
    safebump : null,   // Value needed to get one additional safe day
    dueby    : [],     // Table of daystamps, deltas, and abs amts needed by day
    fullroad : [],     // Rd matrix w/ nulls filled in, [tfin,vfin,rfin] app.
    pinkzone : [],     // Subset of the road matrix defining the verboten zone
    tluz     : null,   // Timestamp of derailment ("lose") if no more data added
    tcur     : null,   // (tcur,vcur) gives the most recent datapoint, including
    vcur     : null,   //   flatlining; see asof 
    rcur     : null,   // Rate at time tcur; if kink, take limit from the left
    ravg     : null,   // Overall road rate from (tini,vini) to (tfin,vfin)
    tdat     : null,   // Timestamp of last actually entered datapoint
    lnw      : 0,      // Lane width at time tcur
    dflux    : 0,      // Rec. lanewidth .9 quantile of rate-adjusted deltas
    delta    : 0,      // How far from centerline: vcur - rdf(tcur)
    lane     : 666,    // Lane we're in; below=-2,bottom=-1,top=1,above=2,etc 
    color    : 'black',// One of {"green", "blue", "orange", "red"}
    cntdn    : 0,      // Countdown: # of days from tcur till we reach the goal
    numpts   : 0,      // Number of real datapoints entered, before munging
    mean     : 0,      // Mean of datapoints
    meandelt : 0,      // Mean of the deltas of the datapoints
    proctm   : 0,      // Unixtime Beebrain was called (specifically genStats)
    statsum  : '',     // Human-readable summary of graph statistics
    lanesum  : '',     // Interjection like "wrong lane!"
    ratesum  : '',     // Text saying what the rate of the YBR is
    limsum   : '',     // Text saying your bare min or hard cap
    deltasum : '',     // Text saying where you are wrt the centerline
    graphsum : '',     // Text at the top of the graph image; see stathead
    headsum  : '',     // Text in the heading of the graph page
    titlesum : '',     // Title text for graph thumbnail
    progsum  : '',     // Text summarizing percent progress
    rah      : 0,      // Y-value of the centerline of YBR at the akrasia horiz
    error    : '',     // Empty string if no errors
    safebuf  : null,   // Number of days of safety buffer ############### DEP
    loser    : false,  // Whether you're irredeemably off the road ###### DEP
    gldt     : null,   // {gldt, goal, rate} are synonyms for ########### DEP
    goal     : null,   //   for the last row of fullroad ################ DEP
    rate     : null,   //   like a filled-in version of {tfin, vfin, rfin} DEP
    road     : [],     // Synonym for fullroad ########################## DEP
    tini     : null,   // Echoes input param ############################ DEP
    vini     : null,   // Echoes input param ############################ DEP
    tfin     : null,   // Subsumed by fullroad ########################## DEP
    vfin     : null,   // Subsumed by fullroad ########################## DEP
    rfin     : null    // Subsumed by fullroad ########################## DEP
  },

  // Input parameters to ignore; complain about anything not here or in pin.
  pig = [
    'rerails', 
    'tagtime', 
    'timezone',
    'backroad', 
    'edgy'
  ],

  /** Beeminder colors for datapoints */
  Cols = {
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
  },

  /** Enum object to identify field types for road segments. */
  RP = { DATE:0, VALUE:1, SLOPE:2},

  /** Enum object to identify different types of datapoints. */
  DPTYPE = {
    AGGPAST:0, AGGFUTURE:1, RAWPAST:2, RAWFUTURE:3, FLATLINE:4, HOLLOW: 5
  },
  DIY   = 365.25,     // Days in year
  SID   = 86400,      // Seconds in day
  AKH   = 7*SID,      // Akrasia Horizon, in seconds
  PRAF  = .015,       // Fraction of plot range that the axes extend beyond
  BDUSK = 2147317201, // ~2038, rails's ENDOFDAYS+1 (was 2^31-2weeks)

  SECS = { 'y' : DIY*SID,       // Number of seconds in a year, month, etc
           'm' : DIY/12*SID,
           'w' : 7*SID,
           'd' : SID,
           'h' : 3600        },
  UNAM = { 'y' : 'year',        // Unit names
           'm' : 'month',
           'w' : 'week',
           'd' : 'day',
           'h' : 'hour'      },

  /** Enum object to identify error types. */
  ErrType = { NOBBFILE:0, BADBBFILE:1  },

  /** Enum object to identify error types. */
  ErrMsgs = [ "Could not find goal file.", "Bad goal file." ],

  /** Type of the last error */
  LastError = null,

  // ---------------- General Utility Functions ----------------------
  arrMin = function(arr) {
    return Math.min.apply(null, arr);
  },

  arrMax = function(arr) {
    return Math.max.apply(null, arr);
  },

  isArray = function(o) {
    return (/Array/).test(Object.prototype.toString.call(o));
  },

  extend = function(to, fr, owr) {
    var prop, hasProp;
    for (prop in fr) {
      hasProp = to[prop] !== undefined;
      if (hasProp && typeof fr[prop] === 'object' 
          && fr[prop] !== null  && fr[prop].nodeName === undefined ) {
        if (isArray(fr[prop])) {
          if (owr) {
            to[prop] = fr[prop].slice(0);
          }
        } else {
          to[prop] = extend({}, fr[prop], owr);
        }
      } else if (owr || !hasProp) {
        to[prop] = fr[prop];
      }
    }
    return to;
  },

  /** Tested, but this does not seem like "argmax" functionality to
   me, argmax should return the index. This is just max with a
   filter */
  argmax = function(f, dom) {
    if (dom == null) return null;
    var newdom = dom.map(f);
    var maxelt = arrMax(newdom);
    return dom[newdom.findIndex( e => (e == maxelt))];
  },

  /** Partitions list l into sublists whose beginning indices are
   separated by d, and whose lengths are n. If the end of the list is
   reached and there are fewer than n elements, those are not
   returned. */
  partition = function(l, n, d) {
    var il = l.length;
    var ol = [];
    for (var i=0; i < il; i+=d)
      if (i+n <= il) ol.push(l.slice(i,i+n));
    return ol;
  },

  /** Returns a list containing the fraction and integer parts of a float */
  modf = function(f) {
    var fp = (f<0)?-f:f, fl = Math.floor(fp);
    return (f<0)?[-(fp-fl),-fl]:[(fp-fl),fl];
  },

  /** The qth quantile of values in l. For median, set q=1/2.  See
   http://reference.wolfram.com/mathematica/ref/Quantile.html Author:
   Ernesto P. Adorio, PhD; UP Extension Program in Pampanga, Clark
   Field. */
  quantile = function(l, q, qt=1, issorted=false) {
    var y
    if (issorted) y = l
    else y = l.slice().sort()
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
        out = modf(a + (n+b)*q - 1),
        g = out[0],
        j = out[1];
    if (j < 0) return y[0]
    else if (j >= n) return y[n-1] // oct.8,2010 y[n]?! off by 1 error!!
    j = Math.floor(j)
    return (g==0)?y[j]:(y[j] + (y[j+1] - y[j])* (c + d*g))
  },

  // Return a list with the cumulative sum of the elements in l, left
  // to right
  accumulate = function(l) {
    var ne = l.length
    if (ne == 0) return l
    var nl = [l[0]]
    for (var i = 1; i < ne; i++) nl.push(nl[nl.length-1]+l[i])
    return nl
  },

  // zip([[1,2], [3,4]]) --> [[1,3], [2,4]]
  zip = function (av) {
    return av[0].map(function(_,i){
      return av.map(a => a[i])
    })
  },

  // Return 0 when x is very close to 0
  chop = function (x, delta=1e-7) { 
    return (Math.abs(x) < delta)?0:x
  },

  // Return an integer when x is very close to an integer
  ichop = function(x, delta=1e-7) {
    var fp = x % 1, ip = x - fp
    if (fp < 0) {fp += 1; ip -= 1;}
    if (fp > 0.5) fp = 1 - chop(1-fp)
    return Math.round(ip) + chop(fp, delta)
  },

  // clip(x, a,b) = min(b,max(a,x))
  clip = function(x, a, b) {
    if (a > b) { var tmp=a; a=b; b=tmp;}
    if (x < a) x = a
    if (x > b) x = b
    return x
  },

  /** Show Number: convert number to string. Use at most d
   significant figures after the decimal point. Target t significant
   figures total (clipped to be at least i and at most i+d, where i
   is the number of digits in integer part of x). */
  shn = function(x, t=10, d=5) {
    if (isNaN(x)) return x.toString()
    var i = Math.round(Math.abs(x)), k, fmt, ostr
    i = (i==0)?0:i.toString().length // # of digits left of the decimal
    if (Math.abs(x) > Math.pow(10,i)-.5) i += 1
    if (i == 0 && x != 0)
      k = (Math.floor(d - Math.log(Math.abs(x), 10))) // get desired 
    else k = d                                          // dec. digits
    // Round input to have the desired number of decimal digits
    var v = x * Math.pow(10,k)
    // Hack to prevent incorrect rounding with the decimal digits:
    if (v % 10 >= 4.5 && v % 10 < 4.9999999) v = Math.floor(v)
    var xn = Math.round(v) / Math.pow(10,k) + 1e-10
    // If total significant digits < i, do something about it
    if (t < i && Math.abs(Math.pow(10,(i-1)) - xn) < .5) 
      xn = Math.pow(10,(i-1))
    t = clip(t, i, i+d)
    // If the magnitude <= 1e-4, prevent scientific notation
    if (Math.abs(xn) < 1e-4 || Math.round(xn) == 9 
        || Math.round(xn) == 99 || Math.round(xn) == 999) {
      ostr = parseFloat(x.toPrecision(k)).toString()
    } else {
      ostr = xn.toPrecision(t)
      if (!ostr.includes('e')) ostr = parseFloat(ostr)
    }
    return ostr
  },
  
  linspace = function linspace( a, b, n) {
    if (typeof n === "undefined") n = Math.max(Math.round(b-a)+1,1)
    if (n < 2) { return n===1?[a]:[] }
    var i,ret = Array(n)
    n--
    for(i=n;i>=0;i--) { ret[i] = (i*b+(n-i)*a)/n }
    return ret
  },

  // Convex combination: x rescaled to be in [c,d] as x ranges from
  // a to b.  clipQ indicates whether the output value should be
  // clipped to [c,d].  Unsorted inputs [a,b] and [c,d] are also
  // supported and work in the expected way except when clipQ =
  // false, in which case [a,b] and [c,d] are sorted prior to
  // computing the output.
  cvx = function(x, a,b, c,d, clipQ=true) {
    var tmp
    if (chop(a-b) == 0) {
      if (x <= a) return Math.min(c,d)
      else        return Math.max(c,d)
    }
    if (chop(c-d) == 0) return c
    if (clipQ)
      return clip(c + (x-a)/(b-a)*(d-c), (c>d)?d:c,(c>d)?c:d)
    else {
      if (a > b) { tmp=a; a=b; b=tmp;}
      if (c > d) { tmp=c; c=d; d=tmp;}
      return c + (x-a)/(b-a)*(d-c)
    }
  },
  
  deldups = function(a) {
    var seen = {}
    return a.filter(it=>(seen.hasOwnProperty(it)?false:(seen[it] = true)))
  },

  nonzero = function(a) {
    var l = a.length, i
    for( i = 0; i < l; i++ ){ if (a[i] != 0) return true}
    return false
  },

  clocky = function(a) {
    var s = 0, l = a.length, i
    for( i = 1; i < l; i+=2 ){ s += (a[i]-a[i-1])}
    return s
  },

  sum = function(a) {
    var s = 0, l = a.length, i
    for( i = 0; i < l; i++ ){ s += a[i]}
    return s
  },

  mean = function (a) {
    var s = 0,l = a.length,i
    if (l == 0) return 0;
    for( i = 0; i < l; i++ ){ s += a[i]}
    return s/a.length
  },

  median = function(a) {
    var m = 0, l = a.length
    a.sort()
    if (l % 2 === 0) { m = (a[l / 2 - 1] + a[l / 2]) / 2 }
    else { m = a[(l - 1) / 2]}
    return m
  },

  mode = function(a) {
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
  },

  inrange = function(x, min, max) {
    return x >= min && x <= max
  },

  nearlyEqual = function(a, b, eps) {
    return Math.abs(a - b) < eps
  },

  ZFUN = function(x) { return 0; },

  // ----------------- Date facilities ----------------------

  // Returns a new date object ahead by the specified number of days
  addDays = function(m, days) {
    var result = moment(m)
    result.add(days, 'days')
    return result
  },

  // Fixes the supplied unixtime to 00:00:00 on the same day
  daysnap = function(ut) {
    var d = moment.unix(ut).utc()
    d.hours(0); d.minutes(0); d.seconds(0); d.milliseconds(0);
    return d.unix()
  },

  formatDate = function(ut) {
    var mm = moment.unix(ut).utc()
    var year = mm.year()
    var month = (mm.month()+1)
    month = (month < 10)?"0"+month.toString():month.toString()
    var day = mm.date()
    day= (day < 10)?"0"+day.toString():day.toString()
    return year+"."+month+"."+day
  },

  // Take a daystamp like "20170531" and return unixtime in seconds
  // (dreev confirmed this seems to match Beebrain's function)
  dayparse = function(s, sep='') {
    if (!RegExp('^\\d{4}'+sep+'\\d{2}'+sep+'\\d{2}$').test(s)) { 
      // Check if the supplied date is a timestamp or not.
      if (!isNaN(s)) return Number(s)
      else return NaN
    }
    s = s.replace(RegExp('^(\\d\\d\\d\\d)'+sep+'(\\d\\d)'+sep+'(\\d\\d)$'), 
                  "$1-$2-$3")
    return daysnap(moment.utc(s).unix())
  },

  // Take an integer unixtime in seconds and return a daystamp like "20170531"
  // (dreev superficially confirmed this works)
  // Uluc: Added option choose a separator
  dayify = function(t, sep = '') {
    if (isNaN(t) || t < 0) { return "ERROR" }
    var mm = moment.unix(t).utc()
    var y = mm.year()
    var m = mm.month() + 1
    var d = mm.date()
    return '' + y + sep + (m < 10 ? '0' : '') + m 
      + sep + (d < 10 ? '0' : '') + d
  },

  // ----------------- Beeminder Goal utilities ----------------------

  AGGR = {
    last     : function(x) { return x[x.length-1] },
    first    : function(x) { return x[0] },
    min      : function(x) { return arrMin(x) },
    max      : function(x) { return arrMax(x) },
    truemean : function(x) { return mean(x) },
    uniqmean : function(x) { return mean(deldups(x)) },
    mean     : function(x) { return mean(deldups(x)) },
    median   : function(x) { return median(x) },
    mode     : function(x) { return mode(x) },
    trimmean : function(x) { return mean(x) }, // Uluc: did not bother 
    sum      : function(x) { return sum(x) },
    jolly    : function(x) { return (x.length > 0)?1:0 },
    binary   : function(x) { return (x.length > 0)?1:0 },
    nonzero  : nonzero,
    triangle : function(x) { return sum(x)*(sum(x)+1)/2 },
    square   : function(x) { return Math.pow(sum(x),2) },
    clocky   : function(x) { return clocky(x) /*sum of pair diff.*/ },
    count    : function(x) { return x.length /* number of datapoints*/ }
  },

  printRoad = function( rd ) {
    for (var i = 0; i < rd.length; i++) {
      var segment = rd[i]
      console.debug("[("+segment.sta[0]+","+segment.sta[1]+"),("
                    +segment.end[0]+","+segment.end[1]+"),"
                    +segment.slope+", auto="+segment.auto+"]")
    }
  },

  sameRoads = function( rda, rdb ) {
    if (rda.length != rdb.length) return false
    for (var i = 0; i < rda.length; i++) {
      if (!nearlyEqual(rda[i].end[0], rdb[i].end[0], 10)) return false
      if (!nearlyEqual(rda[i].end[1], rdb[i].end[1], 10)) return false
      if (!nearlyEqual(rda[i].slope, rdb[i].slope, 1e-14)) return false
    }
    return true
  },

  /** Creates and returns a clone of the supplied road array */
  copyRoad = function( rd ) {
    var newroad = [];
    for (var i = 0; i < rd.length; i++) {
      var segment = {
        sta: rd[i].sta.slice(), end: rd[i].end.slice(),
        slope: rd[i].slope, auto: rd[i].auto };
      newroad.push(segment);
    }
    return newroad;
  },

  /** Finds index for the road segment containing the supplied x value */
  findRoadSegment = function(rd, x) {
    var found = -1;
    for (var i = 0; i < rd.length; i++) {
      if ((x >= rd[i].sta[0]) && (x < rd[i].end[0])) {
        found = i;
        break;
      }
    }
    return found;
  },

  /** Computes the slope of the supplied road segment */
  roadSegmentSlope = function(rd) {
    return (rd.end[1] - rd.sta[1]) / (rd.end[0] - rd.sta[0]);
  },

  /** Computes the value of a road segment at the given timestamp */
  roadSegmentValue = function(rdseg, x) {
    return rdseg.sta[1] + rdseg.slope*(x - rdseg.sta[0]);
  },

  /** Computes the value of a road array at the given timestamp */
  rdf = function(rd, x) {
    var i = findRoadSegment(rd, x);
    return roadSegmentValue( rd[i], x );
  },

  /** Recomputes the road array starting from the first node and
   assuming that the one of slope, enddate or endvalue parameters is
   chosen to be automatically computed. If usetable is true,
   autocompute parameter selections from the table are used */
  fixRoadArray = function( rd, autop=RP.VALUE, usetable=false, 
                           edited=RP.VALUE) {
    var nr = rd.length;
    // Fix the special first road segment, whose slope will always be 0.
    rd[0].sta[0] = rd[0].end[0] - 100*DIY*SID;
    rd[0].sta[1] = rd[0].end[1];

    // Iterate through the remaining segments until the last one
    for (var i = 1; i < nr-1; i++) {
      //console.debug("before("+i+"):[("+rd[i].sta[0]+","+rd[i].sta[1]+"),("+rd[i].end[0]+","+rd[i].end[1]+"),"+rd[i].slope+"]");
      if (usetable) autop = rd[i].auto;

      var difftime = rd[i].end[0] - rd[i].sta[0]; 
      var diffval = rd[i].end[1] - rd[i].sta[1]; 

      rd[i].sta[0] = rd[i-1].end[0];
      rd[i].sta[1] = rd[i-1].end[1];

      if (autop == RP.DATE) {
        if (isFinite(rd[i].slope) && rd[i].slope != 0) {
          rd[i].end[0] = daysnap(
            rd[i].sta[0]+(rd[i].end[1]-rd[i].sta[1])/rd[i].slope);
        }
        // Sanity check
        if (rd[i].end[0] <= rd[i].sta[0]) {
          rd[i].end[0] = daysnap(rd[i].sta[0]+SID);
        }
        if (edited == RP.SLOPE) {
          // Readjust value if slope was edited
          rd[i].end[1] = 
            rd[i].sta[1]+rd[i].slope*(rd[i].end[0]-rd[i].sta[0]);
        } else {
          // Readjust value if value was edited
          rd[i].slope = roadSegmentSlope(rd[i]);
        }
      } else if (autop == RP.VALUE) {
        if (isFinite(rd[i].slope)) {
          rd[i].end[1] = rd[i].sta[1]+rd[i].slope
            *(rd[i].end[0]-rd[i].sta[0]);
        } else {
          // If slope is infinite, preserve previous delta
          rd[i].end[1] = rd[i].sta[1]+diffval;
        }
        rd[i].slope = roadSegmentSlope(rd[i]);
      } else if (autop == RP.SLOPE) {
        rd[i].slope = roadSegmentSlope(rd[i]);
      }
      //console.debug("after("+i+"):[("+rd[i].sta[0]+","+rd[i].sta[1]+"),("+rd[i].end[0]+","+rd[i].end[1]+"),"+rd[i].slope+"]");
    }

    // Fix the last segment
    if (nr > 1) {
      rd[nr-1].sta[0] = rd[nr-2].end[0];
      rd[nr-1].sta[1] = rd[nr-2].end[1];
      rd[nr-1].end[0] = rd[nr-1].sta[0] + 100*DIY*SID;
      rd[nr-1].end[1] = rd[nr-1].sta[1];
    }

  },

  /** Good delta: Returns the delta from the given point to the
   centerline of the road but with the sign such that being on the
   good side of the road gives a positive delta and being on the
   wrong side gives a negative delta. */
  gdelt = function( rd, goal, t, v ) {
    return chop( goal.yaw*(v - rdf(rd, t)));
  },

  // TODO: Test
  lanage = function( rd, goal, t, v, l = null ) {
    var ln = lnf( rd, goal, t );
    if (l == null) l = (goal.noisy)?Math.max(ln, goal.nw):ln;
    var d = v - rdf(rd, t);
    if (chop(l) == 0) 
      return Math.round((chop(d) == 0.0)?goal.yaw:Math.sign(d)*666);
    var x = ichop(d/l);
    var fracp = x % 1;
    var intp = x -fracp;
    if (fracp > .99999999) {
      intp += 1;
      fracp = 0;
    }
    if (chop(fracp) == 0) {
      if (goal.yaw > 0 && intp >= 0) return Math.round(intp+1);
      if (goal.yaw < 0 && intp <= 0) return Math.round(intp-1);
      return Math.round(Math.sign(x)*Math.ceil(Math.abs(x)));
    }
    return Math.round(Math.sign(x)*Math.ceil(Math.abs(x)));
  },

  // TODO: Test
  // Whether the given point is on the road if the road has lane width l
  aok = function( rd, goal, t, v, l ) {
    return ((lanage(rd, goal, t, v, l) * goal.yaw >= -1.0));
  },

  // TODO: Test
  // Returns the number of days to derail for the current road
  // TODO: There are some issues with computing tcur, vcur
  dtd = function( rd, goal, t, v ) {
    var tnow = goal.tcur;
    var fnw = (gdelt(rd, goal, t,v) >= 0)?0.0:goal.nw;// future noisy width
    var elnf = function(x) {
      return Math.max(lnf(rd,goal,x),fnw);};//eff. lane width

    var x = 0; // the number of steps  
    var vpess = v; // the value as we walk forward w/ pessimistic presumptive reports  
    while (aok( rd, goal, t+x*SID, vpess, elnf( t+x*SID ) ) 
           && t+x*SID <= Math.max(goal.tfin, t)) {
      x += 1; // walk forward until we're off the YBR
      //if (t+x*SID > tnow) xt += 1;
      vpess += (goal.yaw*goal.dir < 0)?2*rtf(rd, t+x*SID)*SID:0;
    }
    if (goal.noisy && gdelt(rd,goal,t,v) >= 0) x = Math.max(2, x);
    return x;
  },

  // Days To Centerline: Count the integer days till you cross the
  // centerline/tfin if nothing reported
  dtc = function(rd, goal, t, v) {
    var x = 0;
    while(gdelt(rd, goal, t+x*SID, v) >= 0 && t+x*SID <= goal.tfin)
      x += 1; // dpl
    return x;
  },

// Given the endpoint of the last road segment (tprev,vprev) and 2 out of 3 of
//   t = goal date for a road segment (unixtime)
//   v = goal value 
//   r = rate in hertz (s^-1), ie, road rate per second
// return the third, namely, whichever one is passed in as null.
  tvr = function(tprev, vprev, t, v, r) {
    
    if (t == null) {
      if (r == 0) return BDUSK
      else  return Math.min(BDUSK, tprev + (v-vprev)/r)
    }
    if (v == null)
      return vprev+r*(t-tprev)
    if (r == null) {
      if (t == tprev) return 0 // special case: zero-length road segment
      return (v-vprev)/(t-tprev)
    }
    return 0
  },

  odomify = function( data ) {
    var ln = data.length;
    if (ln == 0) return;
    var curadd = 0;
    var prev = data[0][1];
    for (var i=1; i<ln; i++) {
      if (data[i][1] == 0) curadd += prev;
      prev = data[i][1];
      data[i][1] += curadd;
    }
  },

  // Utility function for stepify
  stepFunc = function( data, x, dflt=0 ) {
    if (x < data[0][0]) return dflt;
    var prevval = data[0][1];
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] > x) return prevval;
      else  prevval = data[i][1];
    }
    return data[data.length-1][1];
  },

  // Take a list of datapoints sorted by x-value and returns a pure
  // function that interpolates a step function from the data,
  // always mapping to the most recent value. Cf
  // http://stackoverflow.com/q/6853787
  stepify = function( data, dflt=0 ) {
    if (data == null) return (x => dflt);
    return (x => stepFunc(data, x, dflt));
  },

  // Computes the slope of the supplied road array at the given timestamp
  rtf = function(rd, t) {
    var i = findRoadSegment( rd, t );
    return (rd[i].slope);
  },

  lnfraw = function( rd, goal, x ) {
    var t = rd.map(elt => elt.end[0]);
    var r = rd.map(elt => Math.abs(elt.slope)*SID );
    // pretend flat spots have the previous or next non-flat rate
    var rb = r.slice(), i;
    for (i = 1; i < rb.length; i++) 
      if (Math.abs(rb[i]) < 1e-9 || !isFinite(rb[i])) rb[i] = rb[i-1];
    var rr = r.reverse();
    var rf = rr.slice();
    for (i = 1; i < rf.length; i++) 
      if (Math.abs(rf[i]) < 1e-9 || !isFinite(rf[i])) rf[i] = rf[i-1];
    rf = rf.reverse();

    r = zip([rb,rf]).map(e => argmax(Math.abs, [e[0],e[1]]) );
    var valdiff = rdf( rd, x ) - rdf( rd, x-SID );
    i = findRoadSegment(rd, x);
    return Math.max(Math.abs(valdiff), r[i]);
  },

  // TODO: Test
  lnf = function( rd, goal, x ) {
    if (goal.abslnw != null) return goal.abslnw;
    return lnfraw( rd, goal, x );
  },

  // Appropriate color for a datapoint
  dotcolor = function( rd, goal, t, v) {
    var l = lanage( rd, goal, t, v );
    if (goal.yaw==0 && Math.abs(l) > 1.0) return Cols.GRNDOT;
    if (goal.yaw==0 && (l==0 && l==1.0)) return Cols.BLUDOT;
    if (goal.yaw==0 && l == -1.0) return Cols.ORNDOT;
    if (l*goal.yaw >=  2.0) return Cols.GRNDOT;
    if (l*goal.yaw ==  1.0) return Cols.BLUDOT;
    if (l*goal.yaw == -1.0) return Cols.ORNDOT;
    if (l*goal.yaw <= -2.0) return Cols.REDDOT;
    return Cols.BLCK;
  },

  isLoser = function(rd, goal, data, t, v) {
    return (dotcolor( rd, goal, t, v ) === Cols.REDDOT 
            && dotcolor(rd, goal,t-SID,stepFunc(data,t-SID))===Cols.REDDOT);
  },

  // For noisy graphs, compute the lane width (or half aura width)
  // based on data.  Specifically, get the list of daily deltas
  // between all the points, but adjust each delta by the road rate
  // (eg, if the delta is equal to the delta of the road itself,
  // that's an adjusted delta of 0).  Return the 90% quantile of
  // those adjusted deltas.
  noisyWidth = function(rd, d) {
    if (d.length <= 1) return 0;
    var p = partition(d,2,1), el, ad = [];
    var t,v,u,w;
    for (var i = 0; i < p.length; i++) {
      t = p[i][0][0];
      v = p[i][0][1];
      u = p[i][1][0];
      w = p[i][1][1];
      ad.push(Math.abs(w-v-rdf(rd,u)+rdf(rd,t))/(u-t)*SID);
    }
    return chop((ad.length==1)?ad[0]:quantile(ad, .90));
  },

  // Increase the width if necessary for the guarantee that you
  // can't lose tomorrow if you're in the right lane today.
  // Specifically, when you first cross from right lane to wrong
  // lane (if it happened from one day to the next), the road widens
  // if necessary to accommodate that jump and then the road width
  // stays fixed until you get back in the right lane.  So for this
  // function that means if the current point is in the wrong lane,
  // look backwards to find the most recent one-day jump from right
  // to wrong. That wrong point's deviation from the centerline is
  // what to max the default road width with.
  autowiden = function(rd, goal, d, nw) {
    var n = d, length, i=-1;
    if (n <= 1) return 0;
    if (gdelt(rd, goal, d[d.length-1][0], d[d.length-1][1]) < 0) {
      while (i >= -n && gdelt(rd, goal, d[i][0], d[i][1]) < 0) i -= 1;
      i += 1;
      if (i > -n && d[i][0] - d[i-1][0] <= SID) 
        nw = Math.max(nw, Math.abs(d[i][1] - rdf(rd,d[i][0])));
    }
    return chop(nw);
  },

  // -------------------------------------------------------------
  // ------------------- JSBRAIN CONSTRUCTOR ---------------------
  /** jsbrain constructor. This is returned once the wrapper function
   is called. The constructor itself fills self with exported
   functions and member variables. The argument is expected to include
   the contents of the BB file as a javascript object.*/
  jsbrain = function( bbin ) {
    console.debug("jsbrain constructor ("+gid+"): "); console.log(bbin);
    var self = this,
        curid = gid
    gid++
    
    // Private variables holding goal, road and datapoint info
    var 
    goal = {},       // Holds loaded goal parameters
    roads = [],      // Holds the current road matrix
    iRoad = [],      // Holds the initial road matrix
    alldata = [],    // Holds the entire set of data points
    aggdata = [],    // Holds past aggregated data
    fuda = [],       // Holds all future data
    alldataf = [],   // Holds all data up to a limited days before asof
    aggdataf = [],   // Holds past aggregated data (limited)
    undoBuffer = [], // Array of previous roads for undo
    redoBuffer = [], // Array of future roads for redo
    oresets = [],    // Odometer resets
    allvals = {},    // Dictionary holding values for each timestamp
    aggval = {}      // Dictionary holding aggregated value for each timestamp

    // Initialize goal with sane values
    goal.yaw = +1; goal.dir = +1;
    goal.tcur = 0; goal.vcur = 0;
    var now = moment.utc();
    now.hour(0); now.minute(0); now.second(0); now.millisecond(0);
    goal.asof = now.unix();
    goal.horizon = goal.asof+AKH;
    goal.xMin = goal.asof;  goal.xMax = goal.horizon;
    goal.yMin = -1;    goal.yMax = 1;

    /** Convery legacy parameters to up-to-date entries */
    function legacyIn( p ) {
      if (p.hasOwnProperty('gldt') && !p.hasOwnProperty('tfin')) 
        p.tfin = p.gldt;
      if (p.hasOwnProperty('goal') && !p.hasOwnProperty('vfin')) 
        p.vfin = p.goal;
      if (p.hasOwnProperty('rate') && !p.hasOwnProperty('rfin')) 
        p.rfin = p.rate;
      if (p.hasOwnProperty('usr') && p.hasOwnProperty('graph') 
          && !p.hasOwnProperty('yoog')) 
        p.yoog = p.usr + "/" + p.graph;
    }
    
    /** Last in genStats, filter params for backward compatibility */
    function legacyOut(p) {
      //p['fullroad'] = [rowfix(r) for r in p['fullroad']]
      p['road']     = p['fullroad']
      if (p['error']) {
        p['gldt'] = dayify(goal.tfin)
        p['goal'] = goal.vfin
        p['rate'] = goal.rfin*goal.siru
      } else {
        //p['gldt'] = p['fullroad'][-1][0]
        //p['goal'] = p['fullroad'][-1][1]
        //p['rate'] = p['fullroad'][-1][2]
      }
      p['tini'] = dayify(goal.tini)
      p['vini'] = goal.vini
      p['tfin'] = dayify(goal.tfin)
      p['vfin'] = goal.vfin
      p['rfin'] = goal.rfin*goal.siru
    }

    /** Initialize various global variables before use */
    function initGlobals() {
      iRoad = [];
      aggdata = [];
      flad = null;
      fuda = [];
      allvals = {};
      aggval = {};
      goal = {}; 
      goal.nw = 0;
      goal.siru = null;
      oresets = [];

      // All the in and out params are also global variables!
      var property;
      for (property in pin) {
        if (pin.hasOwnProperty(property)) {
          goal[property] = pin[property];
        }
      }
      for (property in pout) {
        if (pout.hasOwnProperty(property)) {
          goal[property] = pout[property];
        }
      }
      console.log(goal.deadline)
    }

    function parserow(row) {
      if (!Array.isArray(row) || row.length != 3) return row
      return [dayparse(row[0]), row[1], row[2]]
    }

    // Helper function for stampOut
    function dayifyrow( row ) {
      if (row.length < 1) return row
      var newrow = row.slice()
      newrow[0] = dayify(row[0])
      return newrow
    }

    /** Processes fields with timestamps in the input */
    function stampIn( p,d ) {
      if (p.hasOwnProperty('asof'))     p.asof = dayparse(p.asof)
      if (p.hasOwnProperty('tini'))     p.tini = dayparse(p.tini)
      if (p.hasOwnProperty('tfin'))     p.tfin = dayparse(p.tfin)
      if (p.hasOwnProperty('tmin'))     p.tmin = dayparse(p.tmin)
      if (p.hasOwnProperty('tmax'))     p.tmax = dayparse(p.tmax)
      if (p.hasOwnProperty('road'))     p.road = p.road.map(parserow)

      // Stable-sort by timestamp before dayparsing the timestamps
      // because if the timestamps were actually given as unixtime
      // then dayparse works like dayfloor and we lose fidelity.
      var numpts = d.length
      return d.map(function(r,i){
        return [dayparse(r[0]),r[1],r[2],i,r[1]];})
        .sort(function(a,b){ 
          return (a[0]!== b[0])?(a[0]-b[0]):(a[3]-b[3]);})
    }

    /** Convert unixtimes back to daystamps */
    function stampOut( p ) {
      p['fullroad'] = p['fullroad'].map(dayifyrow)
      p['pinkzone'] = p['pinkzone'].map(dayifyrow)
      p['tluz'] = dayify(p['tluz'])
      p['tcur'] = dayify(p['tcur'])
      p['tdat'] = dayify(p['tdat'])
    }

    // Helper function for Exponential Moving Average; returns
    // smoothed value at x.  Very inefficient since we recompute
    // the whole moving average up to x for every point we want to
    // plot.
    function ema(d, x) {
      // The Hacker's Diet recommends 0.1 Uluc had .0864
      // http://forum.beeminder.com/t/control-exp-moving-av/2938/7
      // suggests 0.25
      var KEXP = .25/SID; 
      if (goal.yoog==='meta/derev') KEXP = .03/SID;  //.015 for meta/derev
      if (goal.yoog==='meta/dpledge') KEXP = .03/SID;// .1 jagged
      var xp = d[0][0],
          yp = d[0][1];
      var prev = yp, dt, i, ii, A, B;
      if (x < xp) return prev;
      for (ii = 1; ii < d.length; ii++) { // compute line equation
        i = d[ii]; 
        dt = i[0] - xp;
        A = (i[1]-yp)/dt;  // (why was this line marked as a to-do?)
        B = yp;
        if (x < i[0]) { // found interval; compute intermediate point
          dt = x-xp;
          return B+A*dt-A/KEXP + (prev-B+A/KEXP) * Math.exp(-KEXP*dt);
        } else { // not the current interval; compute next point
          prev = B+A*dt-A/KEXP + (prev-B+A/KEXP) * Math.exp(-KEXP*dt);
          xp = i[0];
          yp = i[1];
        }
      }
      // keep computing exponential past the last datapoint if needed
      dt = x-xp;
      return B + A*dt - A/KEXP + (prev-B+A/KEXP) * Math.exp(-KEXP*dt);
    }

    // Function to generate samples for the Butterworth filter
    function griddlefilt(a, b) {
      return linspace(a, b, Math.floor(clip((b-a)/(SID+1), 40, 2000)));
    }

    // Function to generate samples for the Butterworth filter
    function griddle(a, b, maxcnt = 6000) {
      return linspace(a, b, Math.floor(clip((b-a)/(SID+1), 
                                            Math.min(600, plotbox.width),
                                            maxcnt)));
    }

    /** Converts a number to an integer string */
    function sint(x){ return Math.round(x).toString(); }
    
    // Used with grAura() and for computing mean and meandelt,
    // this adds dummy datapoints on every day that doesn't have a
    // datapoint, interpolating linearly.
    function gapFill(d) {
      var interp = function (before, after, atPoint) {
        return before + (after - before) * atPoint;
      };
      var start = d[0][0], end = d[d.length-1][0];
      var n = Math.floor((end-start)/SID);
      var out = Array(n), i, j = 0, t = start;
      for (i = 0; i < d.length-1; i++) {
        var den = (d[i+1][0]-d[i][0]);
        while (t <= d[i+1][0]) {
          out[j] = [t,interp(d[i][1], d[i+1][1], (t-d[i][0])/den)];
          j++; t += SID;
        }
      }
      return out;
    }

    // Return a pure function that fits the data smoothly, used by grAura
    function smooth(data) {
      var SMOOTH = (data[0][0] + data[data.length-1][0])/2;
      var dz = zip(data);
      var xnew = dz[0].map(function(e){return e-SMOOTH;});
      var poly = new Polyfit(xnew, dz[1]);
      var solver = poly.getPolynomial(3);
      return function(x){ return solver(x-SMOOTH);};
    }

    // Assumes both datapoints and the x values are sorted
    function interpData(d, xv) {
      var interp = function (before, after, atPoint) {
        return before + (after - before) * atPoint;
      };
      var di = 0, dl = d.length, od = [];
      if (dl == 0) return null;
      if (dl == 1) return xv.map(function(d){return [d, d[0][1]];});
      for (var i = 0; i < xv.length; i++) {
        var xi = xv[i];
        if (xi <= d[0][0]) od.push([xi, d[0][1]]);
        else if (xi >= d[dl-1][0]) od.push([xi, d[dl-1][1]]);
        else if (xi < d[di+1][0] ) { 
          od.push([xi, interp(d[di][1], d[di+1][1],
                              (xi-d[di][0])/(d[di+1][0]-d[di][0]))]);
        } else {
          while (xi > d[di+1][0]) di++;
          od.push([xi, interp(d[di][1], d[di+1][1],
                              (xi-d[di][0])/(d[di+1][0]-d[di][0]))]);
        }
      }
      return od;
    }

    function procData() { 

      // Coming here, we assume that aggdata has entries with
      // the following format:
      // [t, v, comment, original index, v(original)]
      //
      if (goal.odom) {
        oresets = aggdata.filter(function(e){ return (e[1]==0);});
        odomify(aggdata);
      }

      var numpts = aggdata.length, i;
      var nonfuda = aggdata.filter(function(e){
        return e[0]<=goal.asof;});
      if (goal.plotall) goal.numpts = nonfuda.length;

      aggval = {};
      allvals = {};
      var dval = function(d) { return d[0];};
      var aggpt = function(vl, v) { 
        if (vl.length == 1) return [vl[0][1], vl[0][2]];
        else {
          var ind;
          if (goal.kyoom && goal.aggday === "sum") 
            ind = accumulate(vl.map(dval)).indexOf(v);
          else ind = vl.map(dval).indexOf(v);
          if (ind < 0) return [goal.aggday, null];
          else return [vl[ind][1]+" ("+goal.aggday+")", vl[ind][2]];
        }
      };
      // Aggregate datapoints and handle kyoom
      var newpts = [];
      var ct = aggdata[0][0], 
          vl = [[aggdata[0][1],aggdata[0][2],aggdata[0][4]]], vlv;
      var pre = 0, prevpt, ad, cmt, ptinf;
      for (i = 1; i < aggdata.length; i++) {
        if (aggdata[i][0] == ct) {
          vl.push([aggdata[i][1],aggdata[i][2],aggdata[i][4]]);
        } else {
          vlv = vl.map(dval);
          ad = AGGR[goal.aggday](vlv);
          if (newpts.length > 0) prevpt = newpts[newpts.length-1];
          else prevpt = [ct, ad+pre];
          //pre remains 0 for non-kyoom
          ptinf = aggpt(vl, ad);
          newpts.push([ct, pre+ad, ptinf[0], (ct <= goal.asof)
                       ?DPTYPE.AGGPAST:DPTYPE.AGGFUTURE, 
                       prevpt[0], prevpt[1], ptinf[1]]);
          if (goal.kyoom) {
            if (goal.aggday === "sum") {
              allvals[ct] = accumulate(vlv).map(function(e,i){
                return [e+pre, vl[i][1], vl[i][2]];});
            } else allvals[ct] = vl.map(function(e) {
              return [e[0]+pre, e[1], e[2]];});
            aggval[ct] = [pre+ad, ptinf[0], ptinf[1]];
            pre += ad; 
          } else {
            allvals[ct] = vl;
            aggval[ct] = [ad, ptinf[0], ptinf[1]];
          }

          ct = aggdata[i][0];
          vl = [[aggdata[i][1],aggdata[i][2],aggdata[i][4]]];
        }
      }
      vlv = vl.map(dval);
      ad = AGGR[goal.aggday](vlv);
      if (newpts.length > 0) prevpt = newpts[newpts.length-1];
      else prevpt = [ct, ad+pre];
      ptinf = aggpt(vl, ad);
      newpts.push([ct, ad+pre, ptinf[0], 
                   (ct <= goal.asof)?DPTYPE.AGGPAST:DPTYPE.AGGFUTURE,
                   prevpt[0], prevpt[1], ptinf[1]]);
      if (goal.kyoom) {
        if (goal.aggday === "sum") {
          allvals[ct] = accumulate(vlv).map(function(e,i){
            return [e+pre, vl[i][1], vl[i][2]];});
        } else allvals[ct] = vl.map(function(e) { 
          return [e[0]+pre, e[1], e[2]];});
        aggval[ct] = [pre+ad, ptinf[0], ptinf[1]];
      } else {
        allvals[ct] = vl;
        aggval[ct] = [ad, , ptinf[0], ptinf[1]];
      }
      var allpts = [];
      for (var t in allvals) {
        if (allvals.hasOwnProperty(t)) {
          allpts = allpts.concat(allvals[t].map(
            function(d){
              return [Number(t), d[0], d[1], 
                      (Number(t) <= goal.asof)
                      ?DPTYPE.AGGPAST:DPTYPE.AGGFUTURE,
                      d[0], d[1], d[2]];}));
        }
      }
      alldata = allpts;
      aggdata = newpts.filter(function(e){return e[0]<=goal.asof;});
      fuda = newpts.filter(function(e){return e[0]>goal.asof;});

      if (!goal.plotall) goal.numpts = aggdata.length;

      goal.tdat = aggdata[aggdata.length-1][0] // tstamp of last ent. datapoint pre-flatline
    }

    function procRoad( json ) {
      roads = [];
      var rdData = json;
      rdData.push([goal.tfin, goal.vfin, goal.rfin]);
      var nk = rdData.length;
      var firstsegment;

      firstsegment = {
        sta: [dayparse(goal.tini), Number(goal.vini)],
        slope: 0, auto: RP.SLOPE };
      firstsegment.end = firstsegment.sta.slice();
      firstsegment.sta[0] = daysnap(firstsegment.sta[0]-100*DIY*SID);
      roads.push(firstsegment);
      for (var i = 0; i < nk; i++) {
        var segment = {};
        segment.sta = roads[roads.length-1].end.slice();
        var rddate = null, rdvalue = null, rdslope = null;

        rddate = rdData[i][0];
        rdvalue = rdData[i][1];
        rdslope = rdData[i][2];

        if (rddate == null) {
          segment.end = [0, Number(rdvalue)];
          segment.slope = Number(rdslope)/(goal.siru);
          segment.end[0] 
            = segment.sta[0] 
            + (segment.end[1] - segment.sta[1])/segment.slope;
          segment.end[0] = Math.min(BDUSK, segment.end[0]);
          segment.auto = RP.DATE;
        } else if (rdvalue == null) {
          segment.end = [rddate, 0];
          segment.slope = Number(rdslope)/(goal.siru);
          segment.end[1] = 
            segment.sta[1]
            +segment.slope*(segment.end[0]-segment.sta[0]);
          segment.auto = RP.VALUE;
        } else if (rdslope == null) {
          segment.end = [rddate, Number(rdvalue)];
          segment.slope = roadSegmentSlope(segment);
          segment.auto = RP.SLOPE;
        } 
        // Skip adding segment if it is earlier than the first segment
        if (segment.end[0] >= segment.sta[0]) {
          roads.push(segment);
        }
      }
      var goalseg = roads[roads.length-1];
      goal.tfin = goalseg.end[0];
      goal.vfin = goalseg.end[1];
      goal.rfin = goalseg.slope;
      var finalsegment = {
        sta: goalseg.end.slice(),
        end: goalseg.end.slice(),
        slope: 0, auto: RP.VALUE };
      finalsegment.end[0] = daysnap(finalsegment.end[0]+100*DIY*SID);
      roads.push(finalsegment);

      fixRoadArray( roads );

      iRoad = copyRoad( roads );
    }


    var flad = null;     // Holds the flatlined datapoint if it exists
    function flatline() {
      flad = null;
      var now = goal.asof;
      var numpts = aggdata.length;
      var tlast = aggdata[numpts-1][0];
      var vlast = aggdata[numpts-1][1];
      if (tlast > goal.tfin) return;
      var x = tlast; // x = the time we're flatlining to
      if (goal.yaw * goal.dir < 0) 
        x = Math.min(now, goal.tfin); // WEEN/RASH: flatline all the way
      else { // for MOAR/PHAT, stop flatlining if 2 red days in a row
        var prevcolor = null;
        var newcolor;
        while (x <= Math.min(now, goal.tfin)) { // walk forward from tlast
          newcolor = dotcolor( roads, goal, x, vlast );
          // done iff 2 reds in a row
          if (prevcolor===newcolor && prevcolor===Cols.REDDOT) 
            break;
          prevcolor = newcolor;
          x += SID; // or see padm.us/ppr
        };
        x = arrMin([x, now, goal.tfin]);
        for (var i = 0; i < numpts; i++) {
          if (x == aggdata[i][0])
            return;
        }
      }
      if (!aggval.hasOwnProperty(x)) {
        var prevpt = aggdata[numpts-1];
        flad = [x, vlast, "PPR", DPTYPE.FLATLINE, prevpt[0], prevpt[1], null];
        aggdata.push(flad);
      }
    }

    // Set any of {tmin, tmax, vmin, vmax} that don't have explicit values.
    function setDefaultRange() {
      if (goal.tmin == null) goal.tmin = Math.min(goal.tini, goal.asof);
      if (goal.tmin >= goal.asof - SID) goal.tmin -= SID;
      if (goal.tmax == null) {
        // Make more room beyond the askrasia horizon if lots of data
        var years = (goal.tcur - goal.tmin) / (DIY*SID);
        goal.tmax = daysnap((1+years/2)*2*AKH + goal.tcur);
      }
    }

    function procParams( p ) {
      flatline();

      if (goal.movingav) {
        // Filter data and produce moving average
        var dl = aggdata.length;
        if (dl <= 1 || aggdata[dl-1][0]-aggdata[0][0] <= 0) 
          return;
        
        // Create new vector for filtering datapoints
        var newx = griddle(aggdata[0][0], aggdata[dl-1][0]);
        goal.filtpts 
          = newx.map(function(d) {return [d, ema(aggdata, d)];});
      } else goal.filtpts = [];
      
      goal.tcur = aggdata[aggdata.length-1][0];
      goal.vcur = aggdata[aggdata.length-1][1];

      goal.dflux 
        = noisyWidth(roads, aggdata
                     .filter(function(d){return d[0]>=goal.tini;}));
      goal.nw = (goal.noisy && goal.abslnw == null)
        ?autowiden(roads, goal, aggdata, goal.dflux):0;
      goal.lnw = Math.max(goal.nw,lnfraw( iRoad, goal, goal.tcur ));

      goal.safebuf = dtd(roads, goal, goal.tcur, goal.vcur);
      goal.tluz = goal.tcur+goal.safebuf*SID;
      goal.delta = chop(goal.vcur - rdf(roads, goal.tcur))
      goal.rah = rdf(roads, goal.tcur+AKH)

      goal.rcur = rtf(roads, goal.tcur)*goal.siru  
      goal.ravg = tvr(goal.tini, goal.vini, goal.tfin,goal.vfin,null)*goal.siru
      goal.cntdn = Math.ceil((goal.tfin-goal.tcur)/SID)
      goal.lane = clip(lanage(roads, goal, goal.tcur,goal.vcur), -32768, 32767)

      setDefaultRange();
    }

    function getNumParam(p, n, dflt) {
      return (p.hasOwnProperty(n))?Number(p[n]):dflt
    }
    function getBoolParam(p, n, dflt) {
      return (p.hasOwnProperty(n))?p[n]:dflt
    }
    function getStrParam(p, n, dflt) {
      return (p.hasOwnProperty(n))?p[n]:dflt
    }

    var stats = {};

    /** Process goal details */
    function genStats( p, d, tm=null ) {
      console.debug("genStats: id="+curid+", "+p.yoog)

      // start the clock immediately
      if (tm == null) tm = moment.utc().unix()

      legacyIn( p )
      initGlobals()
      goal.proctm = tm

      aggdata = stampIn(p, d)

      for (var prop in p) {
        if (p.hasOwnProperty(prop)) {
          if (!pin.hasOwnProperty(prop) && (!pig.includes(prop)))
            goal.error += "Unknown param: "+prop+"="+p[prop]+","
          else
            goal[prop] = p[prop]
        }
      }
      if ( !p.hasOwnProperty('aggday')) {
        if (goal.kyoom) p.aggday = "sum"
        else p.aggday = "last"
      }

      goal.siru = SECS[p.runits]
      goal.horizon = goal.asof+AKH

      // Process datapoints
      procData()

      var vtmp
      if (p.hasOwnProperty('tini'))  goal.tini = Number(p.tini)
      else goal.tini = aggdata[0][0]

      if (allvals.hasOwnProperty(goal.tini)) {
        vtmp = (goal.plotall)
          ?allvals[goal.tini][0][0]:aggval[goal.tini][0]
      } else vtmp = Number(p.vini)

      if (p.hasOwnProperty('vini')) goal.vini = p.vini
      else goal.vini = (goal.kyoom)?0:vtmp

      procRoad( p.road )
      procParams( p )

      // TODO: Implement opts.maxDataDays
      // Now that the flatlined datapoint is in place, we can
      // extract limited data
      //if (opts.maxDataDays < 0) {
      //alldataf = alldata.slice();
      //aggdataf = aggdata.slice();
      //} else {
      //  alldataf = alldata.filter(function(e){
      //    return e[0]>(goal.asof-opts.maxDataDays*SID);});
      //  aggdataf = aggdata.filter(function(e){
      //    return e[0]>(goal.asof-opts.maxDataDays*SID);});
       // }

      // Generate the aura function now that the flatlined
      // datapoint is also computed.
      if (goal.aura) {
        var adata = aggdata.filter(function(e){return e[0]>=goal.tmin})
        var fdata = gapFill(adata)
        goal.auraf = smooth(fdata)
      } else
        goal.auraf = function(e){ return 0 }

      // Generate beebrain stats (use getStats tp retrieve)
      stats = Object.assign({}, pout)
      for (prop in stats) stats[prop] = goal[prop]
      stampOut(stats)
      legacyOut(stats)
    }

    genStats( bbin.params, bbin.data )

    // -----------------------------------------------------------
    // ----------------- JSBRAIN OBJECT EXPORTS ------------------

    function getStats() { return Object.assign({}, stats) }

    /** jsbrain object ID for the current instance */
    self.id = 1
    self.getStats = getStats
  };

  return jsbrain;
}));
