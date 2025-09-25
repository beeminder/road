/**
 * Javascript implementation of Beebrain, provided as a UMD module.
 * Provides a {@link beebrain} class, which can be used to construct independent
 * Beebrain objects each with their own internal state.<br/>

@module beebrain
@requires moment
@requires butil
@requires broad

Beebrain -- doc.bmndr.com/beebrain
First written in Mathematica by dreev, 2008-2010.
Ported to Python by Uluc Saranli around 2011.12.20.
Maintained and evolved by dreev, 2012-2018.
Ported to Javascript by Uluc Saranli, in 2018-2019.

Copyright 2008-2025 Uluc Saranli and Daniel Reeves
*/

;(((root, factory) => { // BEGIN PREAMBLE --------------------------------------

'use strict'

if (typeof define === 'function' && define.amd) {
  // AMD. Register as an anonymous module.
  //console.log("beebrain: Using AMD module definition")
  define(['fili', 'moment', 'butil', 'broad'], factory)
} else if (typeof module === 'object' && module.exports) {
  // Node. Does not work with strict CommonJS, but only CommonJS-like
  // environments that support module.exports, like Node.
  //console.log("beebrain: Using CommonJS module.exports")
  module.exports = factory(require('./fili'),
                           require('./moment'), 
                           require('./butil'), 
                           require('./broad'))
} else {
  //console.log("beebrain: Using Browser globals")
  root.beebrain = factory(root.Fili, root.moment, root.butil, root.broad)
}

})(this, (fili, moment, bu, br) => { // END PREAMBLE -- BEGIN MAIN -------------

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
// o Gaps in the Graph: If you derail and don't immediately rerail, the BRL 
//   should show a gap when you weren't beeminding. The graph matrix could
//   indicate this with a row like {t, null, null} which means no segment should
//   be drawn between the previous row's time and time t. For the purposes of
//   computing the following row, the null row should be treated as {t, null,
//   0}. Or just have a 4th column for graph matrix indicating if segment is a
//   gap?
// o Pass in a "backroad" parameter that's a version of the road that's never 
//   allowed to change retroactively. The first thing to do with that is to use
//   it to color historical datapoints with their original color (aka
//   permacolor)
// o Some of these in-params have null as a default but don't actually allow 
//   null, meaning that it's an error to not specify those in-params. Would it
//   be better to be explicit and distinguish? Null could mean that null is a
//   valid default and if we require the in-param to be explicitly specified we
//   could have the default below be a magic string like '_DEFAULT_DISALLOWED_'
//   or '_NOD_' or maybe just anything that will obviously fail the error check?
// o Any changes to the in-params (pin) should also be reflected in the error-
//   checking (pchex) below.

const pin = { // In Params: Graph settings and their defaults
quantum  : 1e-5,   // Precision/granularity for conservarounding baremin etc
timey    : false,  // Whether numbers should be shown in HH:MM format
ppr      : true,   // Whether PPRs are turned on (ignored if not WEEN/RASH)
deadline : 0,      // Time of deadline given as seconds before or after midnight
asof     : null,   // Compute everything as if it were this date; future ghosty
tini     : null,   // (tini,vini) specifies the start of the BRL, typically but
vini     : null,   //   not necessarily the same as the initial datapoint
road     : [],     // List of (endTime,goalVal,rate) triples defining the BRL
tfin     : null,   // Goal date (unixtime); end of the Bright Red Line (BRL)
vfin     : null,   // The actual value being targeted; any real value
rfin     : null,   // Final rate (slope) of the BRL before it hits the goal
runits   : 'w',    // Rate units for road and rfin; one of "y","m","w","d","h"
gunits   : 'units',// Goal units like "kg" or "hours"
yaw      : 0,      // Which side of the BRL you want to be on, +1 or -1
dir      : 0,      // Which direction you'll go (usually same as yaw)
pinkzone : [],     // Region to shade pink, specified like the graph matrix
tmin     : null,   // Earliest date to plot on the x-axis (unixtime):
tmax     : null,   //   ((tmin,tmax), (vmin,vmax)) give the plot range, ie, they
vmin     : null,   //   control zooming/panning; they default to the entire
vmax     : null,   //   plot -- initial datapoint to past the akrasia horizon
kyoom    : false,  // Cumulative; plot values as the sum of those entered so far
odom     : false,  // Treat zeros as accidental odom resets (deprecated)
maxflux  : 0,      // User-specified max daily fluctuation                      
monotone : false,  // Whether the data is necessarily monotone (used in limsum) 
aggday   : null,   // How to aggregate points on the same day, max/sum/last/etc
plotall  : true,   // Plot all the points instead of just the aggregated point
steppy   : false,  // Join dots with purple steppy-style line
rosy     : false,  // Show the rose-colored dots and connecting line
movingav : false,  // Show moving average line superimposed on the data
aura     : false,  // Show blue-green/turquoise (now purple I guess) aura/swath
hashtags : true,   // Show annotations on graph for hashtags in datapt comments 
yaxis    : '',     // Label for the y-axis, eg, "kilograms"
waterbuf : null,   // Watermark on the good side of the BRL; safebuf if null
waterbux : '',     // Watermark on the bad side, ie, pledge amount
hidey    : false,  // Whether to hide the y-axis numbers
stathead : true,   // Whether to add a label w/ stats at top of graph (DEV ONLY)
yoog     : 'U/G',  // Username/graphname, eg, "alice/weight"                
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
ravg     : null,    // Overall red line rate from (tini,vini) to (tfin,vfin)
tdat     : null,    // Timestamp of last actually entered datapoint pre-flatline
stdflux  : 0,       // Recommended maxflux, .9 quantile of rate-adjusted deltas
delta    : 0,       // How far from the red line: vcur - rdf(tcur)
lane     : 666,     // Lane number for backward compatibility
cntdn    : 0,       // Countdown: # of days from tcur till we reach the goal
numpts   : 0,       // Number of real datapoints entered, before munging
mean     : 0,       // Mean of datapoints
meandelt : 0,       // Mean of the deltas of the datapoints
proctm   : 0,       // Unixtime when Beebrain was called (specifically genStats)
statsum  : '',      // Human-readable graph stats summary (not used by Beebody)
ratesum  : '',      // Text saying what the rate of the red line is
deltasum : '',      // Text saying where you are wrt the red line
graphsum : '',      // Text at the top of the graph image; see stathead
progsum  : '',      // Text summarizing percent progress, timewise and valuewise
safesum  : '',      // Text summarizing how safe you are (NEW!)
rah      : 0,       // Y-value of the bright red line at the akrasia horizon
safebuf  : null,    // Number of days of safety buffer
error    : '',      // Empty string if no errors generating the graph
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
//graphurl : null,  // Nonce URL for the graph image, based on the provided slug
//thumburl : null,  // Nonce URL for the graph image thumbnail
}

const pig = [ // In-params to ignore; complain about anything not here or in pin
'timezone', // Beebody sends this but we don't use it currently
//'rerails',  // Idea for something to be passed to Beebrain
'usr',      // Username (old synonym for first half of yoog)
'graph',    // Graph name (old synonym for second half of yoog)
'ybhp',     // Boolean used for the yellow brick half-plane transition
'integery', // Replaced by 'quantum'; fully killed as of 2020-08-21
'noisy',    // Pre-YBHP; fully killed as of 2020-08-20
'abslnw',   // Pre-YBHP; fully killed as of 2020-08-19
'tagtime',  // Used in the very early days
'backroad', // Related to the permacolor idea; see doc.bmndr.com/permacolor
'edgy',     // Ancient; killed as one of the prereqs for YBHP
'offred',   // Used for the transition to the red-yesterday derail condition
//'offparis', // Temporary thing related to red-yesterday
'sadlhole', // Allowed the do-less loophole where you could eke back on the road
'imgsz',    // Image size (default 760); width in pixels of graph image
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
let tarings = []    // Timestamps of tarings (generalization of odometer resets)
let derails = []    // Derailments
let hollow = []     // Hollow points
let allvals = {}    // Hash mapping timestamps to list of datapoint values
let aggval = {}     // Hash mapping timestamps to aggday'd value for that day
let derailval = {}  // Map timestamp to value as of DERAIL datapoint that day
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
  if ('goal' in p && !('vfin' in p))                 p.vfin = p.goal
  if ('rate' in p && !('rfin' in p))                 p.rfin = p.rate
//if ('usr'  in p && 'graph' in p && !('yoog' in p)) p.yoog = p.usr+"/"+p.graph
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
  tarings = []
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
  // forum.beeminder.com/t/control-exp-moving-av/2938/7 suggests 0.25
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

// Based on the Mathematica function. Take a 2-argument function f, an initial
// argument x, and a list l of next arguments to fold in:
// foldlist(f, x, [e1, e2, ...]) -> [x, f(x,e1), f(f(x,e1), e2), ...] 
function foldlist(f, x, l) {
  let out = [x]
  for (let i = 0; i < l.length; i++) out.push(f(out[i], l[i]))
  return out
}

// Start at the first datapoint plus sign*delta and walk forward making the next
// point be equal to the previous point, clipped by the next point plus or minus
// delta. Used for the rose-colored dots.
function inertia0(data, delta, sign) {
  return foldlist((a, b) => bu.clip(a, b-delta, b+delta),
                  data[0]+sign*delta, data.slice(1, data.length))
}
function inertia(data, delta, sign) {
  let tdata = bu.zip(data) // transpose of data
  tdata[1] = inertia0(tdata[1], delta, sign)
  return bu.zip(tdata)
}
// Same thing but start at the last datapoint and walk backwards
function inertiaRev(data, delta, sign) {
  return inertia(data.slice().reverse(), delta, sign).reverse()
}

/** Pre-compute rosy datapoints */
function computeRosy() {
  if (!gol.rosy || data.length == 0) return
  // Pre-compute rosy datapoints
  const delta = max(0, gol.stdflux)
  let lo, hi
  if (gol.dir > 0) { lo = inertia(   data, delta, -1)
                     hi = inertiaRev(data, delta, +1)
  } else           { lo = inertiaRev(data, delta, -1)
                     hi = inertia(   data, delta, +1)
  }
  const yveclo = lo.map(e => e[1])
  const yvechi = hi.map(e => e[1])
  const yvec = bu.zip([yveclo, yvechi]).map(e => (e[0]+e[1])/2)
  const xvec = data.map(e => e[0])
  rosydata = bu.zip([xvec, yvec])
  // rosydata format: [ptx, pty, popup text, pt type, prevx, prevy, v(original)]
  // It's essentially the same as normal datapoints. Previous point coordinates
  // are needed to draw connecting lines.
  rosydata = rosydata.map(e => 
                       [e[0],e[1],"rosy data", DPTYPE.RAWPAST, e[0],e[1], e[1]])
  for (let i = 1; i < rosydata.length-1; i++) {
    // These elements store the preceding point to facilitate drawing with d3
    rosydata[i][4] = rosydata[i-1][0]
    rosydata[i][5] = rosydata[i-1][1]
  }
}

// Magic strings in datapoint comments: (see beeminder/beeminder/issues/2423)
// 1. "#SELFDESTRUCT" and "#THISWILLSELFDESTRUCT"
// 2. "#DERAIL"
// 3. "#RESTART"
// 4. "#TARE" (replaces/generalizes odometer resets; see gissue #216)
// And @ signs are allowed instead of #, which is useful if you don't want the
// magic strings to show up as hashtags on the graph.

// Take, eg, "shark jumping #yolo :) #shark" and return {"#yolo", "#shark"}
// Pro tip: use scriptular.com to test these regexes
let hashtagRE
try {
  //hashtagRE = /(?:^|\s)(#\p{L}[\p{L}0-9_]+)(?=$|\s)/gu
  hashtagRE = new RegExp(
    //"(?:^|\\s)(#\\p{L}[\\p{L}0-9_]*)(?=$|\\s)", "gu")
      "(?:^|\\s)(#\\p{L}[\\p{L}0-9_]*)(?=$|[\\s])", "gu")
    //"(?:^|\\s)(#\\p{L}[\\p{L}0-9_]*)(?=$|\\s|\\.|\\!|\\,|\\:|\\))", "gu")
} catch { // Firefox couldn't handle the above in 2019 so just in case:
  hashtagRE = 
      /(?:^|\s)(#[a-zA-Z]\w*)(?=$|\s)/g  // version not allowing punctuation
    ///(?:^|\s)(#[a-zA-Z]\w*)(?=$|\s|\.|\!|\,|\:|\))/g
}
function hashextract(s) {
  let set = new Set(), m
  hashtagRE.lastIndex = 0
  while ( (m = hashtagRE.exec(s)) != null ) if (m[1] != "") set.add(m[1])
  return set
}

// Whether datapoint comment string s has the magic string indicating it's when
// a derailment happened (previously known as a recommit datapoint).
function derailed(s) { 
  return /(?:^|\s)[#@]DERAIL(?:$|\s)/.test(s)
}

// Note for the future: this regex is slightly better:
// /(?<!\S)[#@]DERAIL(?!\S)/ 

// Whether datapoint comment string s has the magic string indicating it's a
// tare datapoint (odometer reset replacement)
function tared(s) { return /(?:^|\s)[#@]TARE(?:$|\s)/.test(s) }

// Whether datapoint comment string s has the magic string indicating it's a
// PPR (self-destruct) datapoint
// TODO: figure out how to call this from bgraph.js or else just copy it there
/*
function selfdestructing(s) {
  return /(?:^|\s)[#@](?:SELFDESTRUCT|THISWILLSELFDESTRUCT)(?:$|\s)/.test(s) ||
    s.startsWith("PESSIMISTIC PRESUMPTION") // backward compatibility
}
*/

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

// WIP: This is the subset of procData that takes the raw datapoints -- a list
// of timestamp, value, comment triples -- and returns what's actually plotted
// on the y-axis, accounting for kyoom, odom, and aggday.
// UPDATE: Ugh, I'm not sure it's possible to refactor this part out as a 
// separate function without taking an extra pass through the datapoints.
// Regardless, it would be very nice to have this available as a separate thing,
// like for Beeminder's API to provide both raw data, like it does now, and 
// processed/aggregated data, giving what's actually plotted on the y-axis.
/*
function aggData(data) {
  if (!data || !data.length) return data
  
}
*/

// Walk through the list of datapoints (stored in the gobal "data") converting
// them as follow:
//    IN: [t, v, comment, original index, v(original), id] 
//   OUT: [t, v, comment, type, prevt, prevv, v(original) or null, index]
// Each datapoint records coordinates for the preceding point to enable
// connecting plots such as steppy and rosy even after filtering based on
// visibility in graph. v(original) is the datapoint value before aggregated
// values etc. are computed. Finally, index is the array index of the datapoint
// in the input data array.
function procData() { 
  if (!data || !data.length) return "No datapoints"
  const n = data.length
  let i

  for (i = 0; i < n; i++) {
    const d = data[i]
    // Sanity check data element
    if (!(bu.nummy(d[0]) && d[0]>0 && bu.nummy(d[1]) && bu.stringy(d[2])))
      return "Invalid datapoint: "+d[0]+" "+d[1]+' "'+d[3] 

    if (gol.hashtags) {                           // extract and record hashtags
      const hset = hashextract(d[2])
      if (hset.size == 0) continue
      if (!(d[0] in hashhash)) hashhash[d[0]] = new Set()
      for (const x of hset) hashhash[d[0]].add(x)
    }
  }

  // Precompute list of [t, hashtext] pairs for efficient display
  if (gol.hashtags) {
    hashtags = []
    for (const key in hashhash)
      hashtags.push([key, Array.from(hashhash[key]).join(' ')])
  }

  // Identify derailments and construct a copied array
  derails = data.filter(e => derailed(e[2]))
  derails = derails.map(e => e.slice())
  // Legacy adjustment for before we switched from defining derailment as today
  // and yesterday being in the red to just yesterday in the red. As of 2021
  // there are still current graphs that become messed up without this...
  for (i = 0; i < derails.length; i++)
    if (derails[i][0] < 1562299200/*2019-07-05*/) derails[i][0] -= SID
  
  br.tareify(data, tared)
  tarings = data.filter(e => tared(e[2])).map(e => e[0])
  
  // Safety net: if odom=true AND no tare-tagged datapoints, use old odomify
  if (gol.odom && tarings.length === 0) {
    tarings = data.filter(e => e[1] == 0).map(e => e[0])
    br.odomify(data)
  }
  const nonfuda = data.filter(e => e[0] <= gol.asof)
  if (gol.plotall) gol.numpts = nonfuda.length
  
  allvals = {}
  aggval = {}

  // Aggregate datapoints and handle kyoom
  let newpts = []
  let ct = data[0][0] // Current Time
  let vl = []  // Value List: All values [t, v, c, ind, originalv] for time ct 
        
  let pre = 0 // Current cumulative sum
  let prevpt

  // HACK: aggday=skatesum needs to know rcur which we won't know until we do
  // procParams. We do know rfin so we're making do with that for now...
  br.rsk8 = gol.rfin * SID / gol.siru // convert rfin to daily rate

  // Process all datapoints
  for (i = 0; i <= n; i++) {
    if (i < n && data[i][0] == ct)
      vl.push(data[i].slice()) // record all points for current timestamp in vl
    
    if (i >= data.length || data[i][0] != ct) {
      // Done recording all data for today
      let vlv = vl.map(dval)              // extract all values for today
      let ad  = br.AGGR[gol.aggday](vlv)  // compute aggregated value
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
        if (gol.aggday === "sum")
          allvals[ct] = 
            bu.accumulate(vlv).map((e,j) => 
                                      [ct, e+pre, vl[j][2], vl[j][3], vl[j][4]])
        else allvals[ct] = vl.map(e => [ct, e[1]+pre, e[2], e[3], e[4]])
        aggval[ct] = pre+ad
        pre += ad
      } else {
        allvals[ct] = vl
        aggval[ct] = ad
      }
      const vw = allvals[ct].map(e => e[1])

      // What we actually want for derailval is not this "worstval" but the
      // agg'd value up to and including the derail (nee recommit) datapoint 
      // (see the derailed() function) and nothing after that:
      derailval[ct] = gol.yaw < 0 ? bu.arrMax(vw) : bu.arrMin(vw)
      
      if (i < data.length) {
        ct = data[i][0]
        vl = [data[i].slice()]
      }
    }
  }
    
  // Recompute an array of all datapoints based on allvals, having incorporated
  // aggregation and other processing steps.
  let allpts = []
  for (let t in allvals) {
    allpts = allpts.concat(allvals[t].map(d => 
      [Number(t), d[1], d[2], 
       Number(t) <= gol.asof ? DPTYPE.AGGPAST : DPTYPE.AGGFUTURE,
       null, null, d[4], d[3]]))
  }
  alldata = allpts

  fuda = newpts.filter(e => e[0] >  gol.asof)
  data = newpts.filter(e => e[0] <= gol.asof)
  if (!gol.plotall) gol.numpts = data.length
  if (data.length == 0) { // all datapoints are in the future
    gol.tdat = gol.tcur
    gol.mean = 0
    hollow = []
    return ""
  }
  
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
      derails[i][1] = aggval[ct]  // doing this until derailval is done right
  }
  
  // Extract computed points that're different than any entered data
  hollow = data.filter(e => {
    if (!(e[0] in allvals)) return false
    return (e[0]<gol.asof && !allvals[e[0]].map(e => e[1]).includes(e[1]))
  })

  return ""
}

/** Extracts segments from the supplied graph matrix in the input
 * parameters as well as tini and vini. Upon completion, the 'roads' variable
 * contains an array of road segments as javascript objects in the following
 * format:<br/>
 
 {sta: [startt, startv], end: [endt, endv], slope, auto}<br/>
 
 Initial and final flat segments are added from starting days
 before tini and ending after 100 days after tfin.
 @param {Array} json Unprocessed graph matrix from the BB file
*/
function procRoad(json) {
  //const BDUSK = bu.dayparse(bu.dayify(bu.BDUSK)) // make sure it's dayfloored.
  const BDUSK = bu.BDUSK
  roads = []
  const rdData = json
  if (!rdData) return "Road param missing"
  const nk = rdData.length
  let firstsegment
  let tini = gol.tini
  let vini = gol.vini
  // Handle cases where first graph matrix row starts earlier than (tini,vini)
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
    // until road[i], filling in empty fields in the graph matrix
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

// Add a flatlined datapoint today if the last datapoint is before today.
// But don't keep flatlining past a derailment unless doing so will eventually
// put you back on the right side of the bright red line, like if the goal is
// restarted and the red line reset. That's nicer to stop the flatlining early
// if possible because maybe you derailed years ago and by not flatlining past
// that point you can actually see that ancient derailment on the graph. If we
// always flatlined to today, the graph would look dumb/boring, with everything
// interesting squished to the left and then a years-long flatline with a little
// triangle at the end. 
// PS: We currently only do this fanciness for UPTOP/DNLOW (aka MOAR/PHAT)
// because for UPLOW/DNTOP (aka WEEN/RASH) we'd have to deal with PPRs I guess?
let flad = null // Holds the flatlined datapoint if it exists
function flatline() {
  const lastpt = data.length === 0 ? [gol.tini, gol.vini] : data[data.length-1]
  const tlast  = lastpt[0]
  const vlast  = lastpt[1]
  if (tlast > gol.tfin) return // no flatlining past the end of the goal
  const tcurr  = min(gol.asof, gol.tfin) // flatline at most this far
  const red = (t) => !br.aok(roads, gol, t, vlast) // convenience function

  let tflat = tcurr // the time we're flatlining to, walking backward from here
  if (gol.yaw * gol.dir > 0) { // UPTOP (MOAR) and DNLOW (PHAT)
    while (red(tflat -   SID) && tflat-SID > tlast &&
           red(tflat - 2*SID) && tflat-SID > gol.tini) {
      tflat -= SID
    }
  }

  if (!(tflat in aggval)) { // only make a flatline point if no actual datapoint
    flad = [tflat, vlast, "PPR", DPTYPE.FLATLINE, tlast, vlast, null]
    // Check if a PPR was already added and if so, replace
    if (tlast == tflat && lastpt[2] == "PPR") data[data.length-1] = flad
    else data.push(flad)
  }
}

/* For relative tmin, this from Claude seems to work to turn ISO durations like
"-P1Y" into absolute dates:

const { DateTime, Duration } = luxon;
function addTimeToNow(isoDuration) {
  try {
    const duration = Duration.fromISO(isoDuration);
    const now = DateTime.now();
    const newDate = now.plus(duration);
    return newDate.toISODate();
  } catch (error) {
      throw new Error("Invalid ISO 8601 duration format");
  }
}
*/

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

// Stringified version of a graph matrix row
function showrow(row) {
  return JSON.stringify(row[0] === null ? row : 
                                        [bu.formatDate(row[0]), row[1], row[2]])
}

// Sanity check a row of the graph matrix; exactly one-out-of-three is null
function validrow(r) {
  if (!bu.listy(r) || r.length != 3) return false
  return    r[0]==null     && bu.nummy(r[1]) && bu.nummy(r[2])
         || bu.nummy(r[0]) && r[1]==null     && bu.nummy(r[2])
         || bu.nummy(r[0]) && bu.nummy(r[1]) && r[2]==null
}

// Convenience functions for error checking
const validyaw = (y) => y === -1 || y === 0 || y === 1               // yaw
const validead = (d) => bu.nummy(d) && (6-24)*3600 <= d&&d <= 6*3600 // deadline
const validate = (t) => bu.nummy(t) && 0 < t && t < bu.BDUSK         // tini etc
const validyax = (s) => bu.stringy(s) && s.length<80                 // yaxis
const torf     = (x) => typeof x === "boolean"      // True or False
const born     = (x) => torf(x) || x === null       // Boolean or Null
const norn     = (x) => bu.nummy(x) || x === null   // Numeric or Null
const torn     = (x) => validate(x) || x === null   // Timey or Null
const sorn     = (x) => bu.stringy(x) || x === null // String or Null

// Error-checking function and error message for each in-param
const pchex = {
quantum  : [bu.nummy,           "isn't numeric"],
timey    : [torf,               "isn't boolean"],
ppr      : [torf,               "isn't boolean"],
deadline : [validead,           "outside 6am earlybird and 6am nightowl"],
asof     : [validate,           "isn't a valid timestamp"],
tini     : [validate,           "isn't a valid timestamp"],
vini     : [bu.nummy,           "isn't numeric"],
road     : [bu.listy,           "(graph matrix) isn't a list"],
tfin     : [torn,               "isn't a valid timestamp or null"],
vfin     : [norn,               "isn't numeric or null"],
rfin     : [norn,               "isn't numeric or null"],
runits   : [v => v in bu.SECS,  "isn't a valid rate unit"],
gunits   : [bu.stringy,         "isn't a string"],
yaw      : [validyaw,           "isn't -1 or 1 or 0"],
dir      : [v => v==1 || v==-1, "isn't -1 or 1"],
pinkzone : [bu.listy,           "isn't a a list"],
tmin     : [torn,               "isn't a valid timestamp or null"],
tmax     : [torn,               "isn't a valid timestamp or null"],
vmin     : [norn,               "isn't numeric or null"],
vmax     : [norn,               "isn't numeric or null"],
kyoom    : [torf,               "isn't boolean"],
odom     : [torf,               "isn't boolean"],
monotone : [torf,               "isn't boolean"],
aggday   : [v => v in br.AGGR,  "isn't one of max, sum, last, mean, etc"],
plotall  : [torf,               "isn't boolean"],
steppy   : [torf,               "isn't boolean"],
rosy     : [torf,               "isn't boolean"],
movingav : [torf,               "isn't boolean"],
aura     : [torf,               "isn't boolean"],
hashtags : [torf,               "isn't boolean"],
yaxis    : [validyax,           "isn't a string of at most 79 chars"],
waterbuf : [sorn,               "isn't a string or null"],
waterbux : [bu.stringy,         "isn't a string"],
hidey    : [torf,               "isn't boolean"],
stathead : [torf,               "isn't boolean"],
yoog     : [bu.stringy,         "isn't a string"],
goal     : [norn,               "isn't numeric or null"],
rate     : [norn,               "isn't numeric or null"],
}

/** Sanity check the input parameters. Return non-empty string if it fails. */
function vetParams() {
  for (const p in pchex) {
    const chk = pchex[p][0]
    const msg = pchex[p][1]
    if (!chk(gol[p])) return `${p} = ${JSON.stringify(gol[p])}\\nERROR: ${msg}`
  }
  
  for (const row of gol.road)
    if (!validrow(row))
      return "Invalid graph matrix row: "+showrow(row)

  for (const row of gol.pinkzone)
    if (!validrow(row))
      return "Invalid pinkzone row: "+showrow(row)

  // At this point graph matrix (road) guaranteed to be a list of length-3 lists
  // (I guess we don't mind a redundant final graph matrix row)
  const mrd = gol.road.slice(1, gol.road.length-1)
  if (mrd.length !== bu.deldups(mrd).length) {
    let prev = mrd[0] // previous row
    for (const row of mrd) {
      if (bu.arrayEquals(row, prev))
        return "Graph matrix has duplicate row: "+showrow(row)
      prev = row
    }
  }
  if (gol.kyoom && gol.odom)
    return "The odometer setting doesn't make sense for an auto-summing goal!"
  if (gol.tmin > gol.asof)
    return "You can't set the graph bounds to be solely in the future!"

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

  // Beebody style graph matrix is a list of end-of-segment values, and each
  // segment means "start where previous segment left off, and then connect that
  // to these new coordinates". But for the very first segment we draw, we need
  // to know where to start, so we add the tini/vini row, but that is kind of an
  // exception, because we don't draw that segment, we just use it to know where
  // to start the first segment. But the road structure that we create in
  // razrroad for bgraph to use, each segment has a start and an end. When we
  // map over that road struct to turn it into a graph matrix style data, we
  // need the initial dummy row to give us tini/vini, but we don't  need the
  // final dummy row.
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
  gol.tfin = gol.road[rl-1][0] // TODO: what if this isn't at a day boundary?
  gol.vfin = gol.road[rl-1][1]
  gol.rfin = gol.road[rl-1][2]
  // tfin, vfin, rfin are set in procRoad
  
  // Error checking to ensure the road rows are in chronological order
  const tlist = gol.road.map(e => e[0])
  if (gol.tini > tlist[0]) {
    return "Graph matrix error\\n(There are segments of your bright red line\\n"
      +"that are somehow dated before your goal's start date!)"
  } 
  // The above check is superfluous for now because fillroad() actually cleans
  // up the graph matrix by throwing away road rows that violate that. See the 
  // notes in the comments of fillroad() in broad.js.
  if (!bu.orderedq(tlist)) {
    return "Dial error\\n(Your goal date, goal "
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
  const enableFili = true
  const filiAura = true
  
  if (gol.movingav || (filiAura && gol.aura && enableFili)) {
    // Filter data and produce moving average
    if (!(dl <= 1 || data[dl-1][0]-data[0][0] <= 0)) { 

      if (enableFili && fili !== undefined) {
        // IIR filter design
        let iirCalc = new Fili.CalcCascades()
        let mavFilterCoeffs = iirCalc.lowpass({
          order: 1, // cascade 3 biquad filters (max: 12)
          characteristic: 'bessel',
          Fs: 1000, // sampling frequency
          Fc: 50, // cutoff frequency / center frequency for 
                  // bandpass, bandstop, peak
          gain: 0, // gain for peak, lowshelf and highshelf
          preGain: false // adds one constant multiplication for highpass 
                         // and lowpass
          // k = (1 + cos(omega)) * 0.5 / k = 1 with preGain == false
        })
        let mavFilter = new Fili.IirFilter(mavFilterCoeffs)

        // Generate daily samples for consistent filtering
        let a = data[0][0], b = data[dl-1][0]
        let newx = bu.linspace(a, b, 1+ceil((b-a)/(SID)))

        // Data is levelled out (by subtracting a linear function from
        // the start to the end) to begin and end at value 0 to
        // prevent erroneous filter behavior at the boundaries. This
        // is undone after filtering to restore the original offsets
        let dst = data[0][1], dend = data[dl-1][1]
        let tst = data[0][0], dsl = (dend - dst) / (data[dl-1][0] - tst)
        let unfilt = [0], ind = 0, newind = false
        let slope = (data[ind+1][1]-data[ind][1])/(data[ind+1][0]-data[ind][0])
        for (let i = 1; i < newx.length; i++) {
          if (newx[i] == data[ind+1][0]) {
            unfilt.push(data[ind+1][1]-dst-dsl*(newx[i]-tst))
            ind++
            if (ind == data.length-1) break
            slope = (data[ind+1][1]-data[ind][1])/(data[ind+1][0]-data[ind][0])
          } else {
            if (newx[i] > data[ind+1][0]) {
              ind++
              if (ind == data.length) break
              slope= (data[ind+1][1]-data[ind][1])/(data[ind+1][0]-data[ind][0])
            }
            unfilt.push(data[ind][1] + (newx[i]-data[ind][0])*slope
                        -dst-dsl*(newx[i]-tst))
          }
        }
        const padding = 50
        // Add padding to the end of the array to correct boundary errots
        for (let i = 0; i < padding; i++) unfilt.push(0)
        let mavdata = mavFilter.filtfilt(unfilt)
        // Remove padding elements
        mavdata.splice(-padding, padding)
        // Merge with timestamps and remove linear offset introduced
        // during preprocessing
        gol.filtpts
          = bu.zip([newx, mavdata.map(d=>d+dst)]).map(d=>[d[0], d[1]+dsl*(d[0]-tst)])

        if (filiAura) {
          // Calculate cutoff frequency based on the number of visible datapoints
          let visibledata = data.filter(d=>(d[0]>=gol.tmin))
          let cutoff = 50 - min(45,10*(visibledata.length/30))
          let auraFilterCoeffs = iirCalc.lowpass({
            order: 1, characteristic: 'bessel', Fs: 1000, Fc: cutoff,
            gain: 0, preGain: false
          })
          let auraFilter = new Fili.IirFilter(auraFilterCoeffs)
          let auradata = auraFilter.filtfilt(unfilt)
          // Remove padding elements
          auradata.splice(-padding+7, padding-7) // Leave the horizon intact (7 days)
          // Merge with timestamps and remove linear offset introduced
          // during preprocessing
          let tlast = newx[newx.length-1]
          for (let i = 1; i < 8; i++) newx.push(tlast+SID*i)
          gol.aurapts
            = bu.zip([newx, auradata.map(d=>d+dst)]).map(d=>[d[0], d[1]+dsl*(d[0]-tst)])
        }
        
      } else {
        // Create new vector for filtering datapoints
        const newx = griddle(data[0][0], data[dl-1][0],
                             (data[dl-1][0]-data[0][0])*4/SID)
        gol.filtpts = newx.map(d => [d, ema(data, d)])
      }
    } else gol.filtpts = []
  } else gol.filtpts = []

  gol.tcur  = dl === 0 ? gol.tini : data[dl-1][0]
  gol.vcur  = dl === 0 ? gol.vini : data[dl-1][1]
  gol.vprev = data[max(dl-2,0)][1] // default to vcur if < 2 datapts

  gol.safebuf = br.dtd(roads, gol, gol.tcur, gol.vcur)

  gol.tluz = min(gol.tcur + gol.safebuf*SID, gol.tfin + SID, bu.BDUSK)
  // let's kill the following so soon-to-end goals just have the tluz as tfin +
  // 1 day:
  if (gol.tluz > gol.tfin) gol.tluz = bu.BDUSK

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
  gol.loser = br.redyest(roads, gol, gol.tcur) // needs iso here; is that fine?
  gol.sadbrink = (gol.tcur-SID > gol.tini)
    && (br.dotcolor(roads, gol, gol.tcur-SID,
                    gol.dtf(gol.tcur-SID, gol.isolines))==bu.BHUE.REDDOT)
      
  setDefaultRange()
  return ""
}

/* BEGIN SAFESUM REFERENCE DUMP 

def plato
  return "phat" if dir == -1 && yaw == -1
  return "moar" if dir ==  1 && yaw ==  1
  return "ween" if dir ==  1 && yaw == -1
  return "rash" if dir == -1 && yaw ==  1
  return "moar" # should never fall thru to this but some old goals have yaw==0
end
def moar? plato == "moar" end
def phat? plato == "phat" end
def ween? plato == "ween" end
def rash? plato == "rash" end

def is_autod? ii[:name].present? end

def eepday?
  if bb[:safebuf] && bb[:safebuf] < 1; return true
  elsif (ween? || rash?) && !is_autod? && pessimistic
    if bb[:safebuf] && bb[:safebuf] < 1
      datapoints.on_date(nowstamp(self.deadline, tz).to_s(:ds)).none?
    end
  end
  return false
end

def baremin(show_secs=false)
  if    bb[:limsum].nil? || !bb[:error].blank?; bb[:error]
  elsif bb[:limsum] == "n/a";                   bb[:limsum]
  else
    bmin = bb[:limsum].match(/([\d\.\-\+]+)/)[0]
    prefix = bmin.to_f > 0 ? "+" : ""
    if self.timey
      prefix + TimeUtils.hours_to_HHMM(bmin, 
        yaw>0 ? "ceil" : "floor", show_secs)
    elsif Integer(100*bmin.to_f) == 100*bmin.to_f; "#{bmin}"
    else
      if    self.yaw > 0; prefix + "#{((100*bmin.to_f).floor + 1).round/100.0}"
      elsif self.yaw < 0; prefix + "#{((100*bmin.to_f).ceil  - 1).round/100.0}"
      end
    end
  end
end

def bareminDelta(show_secs=false)
  if !bb[:error].blank?;                                    return bb[:error]
  elsif bb[:delta].nil? || bb[:lnw].nil? || bb[:vcur].nil?; return "Error"
  elsif bb[:safebump].nil?; return baremin(show_secs)
  end
  if yaw*dir < 1
    hardcap = (bb[:delta] + yaw*bb[:lnw])*yaw
    shns(hardcap)
  else
    shns(bb[:safebump] - bb[:vcur])
  end
end

def bareminAbs(show_secs=false)
  if !bb[:error].blank?;                                    return bb[:error]
  elsif bb[:delta].nil? || bb[:lnw].nil? || bb[:vcur].nil?; return "Error"
  elsif bb[:safebump].nil?; return baremintotal(show_secs)
  end
  if yaw*dir < 1
    critical_edge = bb[:vcur] - bb[:delta] - yaw*bb[:lnw]
    shn(critical_edge)
  else
    shn(bb[:safebump])
  end
end

def baremintotal(show_secs=false)
  # As of Dec 2019 or earlier; deprecated, but still used for frozen/stale goals
  if bb[:limsum].nil? || !bb[:error].blank?; bb[:error]
  elsif bb[:limsum] == "n/a";                bb[:limsum]
  else
    bmintotal = 
     bb[:vcur] + bb[:limsum].match(/^[\d\.\+\-]+/)[0].gsub(/[^\d\.\-]/, "").to_f
    if self.timey
         TimeUtils.hours_to_HHMM(bmintotal, yaw>0 ? "ceil" : "floor", show_secs)
    elsif bmintotal.floor == bmintotal;                      #{bmintotal.to_i}"
    elsif Integer(100*bmintotal.to_f) == 100*bmintotal.to_f; #{bmintotal}"
    elsif self.yaw > 0; "#{((100*bmintotal.to_f).floor + 1).round/100.0}"
    elsif self.yaw < 0; "#{((100*bmintotal.to_f).ceil  - 1).round/100.0}"
    end
  end
end

# BEGIN generating safesum string. Input variables: yaw, dir, eep.
return "goal is not currently active" if is_frozen?
due_datetime = self.countdown.in_time_zone(self.tz) + 1
if due_datetime.strftime('%M') == "00"
  due_str = due_datetime.strftime('%-l%P') # the '-' removes leading padding
else
  due_str = due_datetime.strftime('%-l:%M%P')
end
gunits = gunits.blank? ? " " : " #{gunits} " # don't have 2 spaces if no gunits

# Truth table (PLATO X EEP X SUMMY) @ github.com/beeminder/beeminder/issues/1290
if eepday? && moar?
  if aggday == "sum" // safesum hides total in this case
    # MOAR, eep, delta-only -> +1 pushup due by 12am
    return "#{bareminDelta}#{gunits}due by #{due_str}"
  else
    # MOAR, eep, not delta-only -> +1 pushups (12345) due by 12am
    return "#{bareminDelta}#{gunits}(#{bareminAbs}) due by #{due_str}"
  end
elsif eepday? && phat?
  if aggday == "sum" // safesum hides total in this case
    # PHAT, eep, delta-only -> hard cap -2 pounds by 12am
    return "hard cap #{bareminDelta}#{gunits}by #{due_str}"
  else
    # PHAT, eep, not delta-only -> hard cap -2 pounds (150) by 12am
    return "hard cap #{bareminDelta}#{gunits}(#{bareminAbs}) by #{due_str}"
  end
elsif !eepday? && phat?
  if bb[:dueby].present? and bb[:dueby][0].present? and bb[:dueby][0].length > 2
    deltahardcap = shns(bb[:dueby][0][1])
    abshardcap   = shn( bb[:dueby][0][2])
  else
    deltahardcap = bb[:error].present? ? bb[:error] : '[ERROR]'
    abshardcap = ''
  end

  if aggday == "sum" // aka safesum hides total
    # PHAT, not eep, delta-only -> hard cap +2 pounds today˚
    return "hard cap #{deltahardcap}#{gunits}today"
  else
    # PHAT, not eep, not delta-only -> hard cap +2 pounds (150) today
    return "hard cap #{deltahardcap}#{gunits}(#{abshardcap}) today"
  end
elsif !eepday? && moar?
  # MOAR, not eep -> safe for X days
  safe_days_str = "#{bb[:safebuf]} day"
  if bb[:safebuf] > 1; safe_days_str += "s"
  end unless bb[:safebuf].nil?
  return "safe for #{safe_days_str}"
elsif eepday? && (ween? || rash?)
  if aggday == "sum" // aka safesum hides total
    # RASH/WEEN, eep, delta-only -> hard cap +3 servings by 12am
    return "hard cap #{bareminDelta}#{gunits}by #{due_str}"
  else
    # RASH/WEEN, eep, not delta-only -> hard cap +4 cigarettes (12354) by 12am
    return "hard cap #{bareminDelta}#{gunits}(#{bareminAbs}) by #{due_str}"
  end
elsif !eepday? && (ween? || rash?)
  if aggday == "sum" // aka safesum hides total
    # RASH/WEEN, not eep, delta-only -> hard cap +3 servings today
    return "hard cap #{bareminDelta}#{gunits}today"
  else
    # RASH/WEEN, not eep, not delta-only -> hard cap +4 cigarettes (12354) today
    return "hard cap #{bareminDelta}#{gunits}(#{bareminAbs}) today"
  end
end

END SAFESUM REFERENCE DUMP */

function safesumSet(rd, gol) {
  const y = gol.yaw, d = gol.dir, dlt = gol.delta, q = gol.quantum
  const c = gol.safebuf // countdown to derailment, in days
  const cd = bu.splur(c, "day")

  if (y*d<0)      gol.safesum = "unknown days of safety buffer"
  else if (c>999) gol.safesum = "more than 999 days of safety buffer"
  else            gol.safesum = "~"+cd+" of safety buffer"
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
    ybrStr = "w/ "+shn(x,0,2,1)+" to go to goal"
  } else {
    x = br.rdf(roads, gol.tcur+gol.siru) - br.rdf(roads, gol.tcur)
    ybrStr = "@ "+(x>=0 ? "+" : "")+bu.shn(x, 2, 1, 0)
                           +" / "+bu.UNAM[gol.runits]
  }

  const ugprefix = false // debug mode: prefix yoog to graph title
  gol.graphsum = 
      (gol.asof !== gol.tcur ? "["+bu.shd(gol.asof)+"] " : "")
    + (ugprefix ? gol.yoog : "")
    + shn(gol.vcur,0,3,1)+" on "+bu.shd(gol.tcur)+" ("
    + bu.splur(gol.numpts, "datapoint")+" in "
    + bu.splur(1+floor((gol.tcur-gol.tini)/SID),"day")+") "
    + "targeting "+shn(gol.vfin,0,3,1)+" on "+bu.shd(gol.tfin)+" ("
    + bu.splur(gol.cntdn, "more day")+") "+ybrStr

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
  safesumSet(rd, gol)
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
    gol.pinkzone = [[gol.asof, br.rdf(roads, gol.asof), 0]]
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
    if (gol.aurapts === undefined) {
      const adata = data.filter(e => e[0]>=gol.tmin)
      const fdata = br.gapFill(adata)
      gol.auraf = br.smooth(fdata)
    } else {
      gol.auraf = function(x) {
        let ind = bu.searchLow(gol.aurapts, d=>(d[0]-x))
        if (ind == -1) return gol.aurapts[0][1]
        else if (ind == gol.aurapts.length-1) return gol.aurapts[gol.aurapts.length-1][1]
        else {
          let pt1 = gol.aurapts[ind], pt2 = gol.aurapts[ind+1]
          return pt1[1] + (x-pt1[0]) * (pt2[1]-pt1[1])/(pt2[0]-pt1[0])
        }
      }
    }
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
    gol.horizon = gol.asof+bu.AKH-SID // draw the akrasia horizon 6 days out
    // Save initial waterbuf value for comparison in bgraph.js because we don't
    // want to keep recomputing it there as the red line is edited 
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
    console.log("id="+curid+", setRoadObj(), null redline!")
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
/** Holds an array of taring timestamps (generalization of odometer resets) */
this.tarings = tarings //TODOT
/** Holds an array of derailments */
this.derails = derails

this.hollow = hollow
this.hashtags = hashtags

} // END beebrain object constructor -------------------------------------------

// Export utility functions as static methods
// beebrain.selfdestructing = selfdestructing // TODO

return beebrain

})) // END MAIN ----------------------------------------------------------------
