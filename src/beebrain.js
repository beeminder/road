/**
 * Javascript implementation of Beebrain, provided as a UMD module.
 * Provides a {@link beebrain} class, which can be used to construct independent
 * Beebrain objects each with their own internal state.<br/>

 @module beebrain
 @requires moment
 @requires butil
 @requires broad

Beebrain -- doc.bmndr.com/beebrain
Originally written in Mathematica by dreeves, 2008-2010.
Ported to Python by Uluc Saranli around 2011.12.20.
Maintained and evolved by dreeves, 2012-2018.
Ported to Javascript in 2018-2019 by Uluc Saranli.

 * <br/>Copyright 2017-2020 Uluc Saranli and Daniel Reeves

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

const DIY = 365.25
const SID = 86400

// -----------------------------------------------------------------------------
// ---------------------- BEEBRAIN CONSTANTS AND GLOBALS -----------------------

let gid = 1 // Global counter giving unique IDs for multiple beebrain instances

// -----------------------------------------------------------------------------
// In-params and out-params are documented at doc.bmndr.com/beebrain

// NOTES / IDEAS:
// o Death to auto-widening and noisy width! Recommend abslnw=stdflux in the UI.
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
quantum  : null,   // Precision/granularity for conservarounding baremin etc
timey    : false,  // Whether numbers should be shown in HH:MM format
ybhp     : true,   // Yellow Brick Half-Plane! For transition to New World Order
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
abslnw   : null,   // Override road width algorithm with a fixed lane width
maxflux  : 0,      // User-specified max daily fluctuation                      
noisy    : false,  // Compute road width based on data, not just road rate
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
//gldt     : null,   // Synonym for tfin ################################### DEP
goal     : null,   // Synonym for vfin ##################################### DEP
rate     : null,   // Synonym for rfin ##################################### DEP
//offred   : true, // Yesterday-is-red criteria for derails ################ DEP
integery : false,  // Whether vals are necessarily integers ################ DEP
}

const pout = { // Out Params: Beebrain output fields
sadbrink : false,   // Whether we were red yesterday & so will instaderail today
safebump : null,    // Value needed to get one additional safe day
dueby    : [],      // Table of daystamps, deltas, and abs amts needed by day
fullroad : [],      // Road matrix w/ nulls filled in, [tfin,vfin,rfin] appended
//razrroad : [],      // Adjusted road data struct for the YBHP transition
razrmatr : [],      // Adjusted road matrix for the YBHP transition
pinkzone : [],      // Subset of the road matrix defining the verboten zone
tluz     : null,    // Timestamp of derailment ("lose") if no more data is added
tcur     : null,    // (tcur,vcur) gives the most recent datapoint, including
vcur     : null,    //   flatlining; see asof 
vprev    : null,    // Agged value yesterday 
rcur     : null,    // Rate at time tcur; if kink, take the limit from the left
ravg     : null,    // Overall road rate from (tini,vini) to (tfin,vfin)
tdat     : null,    // Timestamp of last actually entered datapoint
lnw      : 0,       // Lane width at time tcur
stdflux  : 0,       // Recommended maxflux .9 quantile of rate-adjusted deltas
delta    : 0,       // How far from centerline: vcur - rdf(tcur)
lane     : 666,     // Lane we're in; below=-2,bottom=-1,top=1,above=2,etc # DEP
color    : 'black', // One of {"green", "blue", "orange", "red"} ########### DEP
cntdn    : 0,       // Countdown: # of days from tcur till we reach the goal
numpts   : 0,       // Number of real datapoints entered, before munging
mean     : 0,       // Mean of datapoints
meandelt : 0,       // Mean of the deltas of the datapoints
proctm   : 0,       // Unixtime when Beebrain was called (specifically genStats)
statsum  : '',      // Human-readable graph stats summary (not used by Beebody)
ratesum  : '',      // Text saying what the rate of the YBR is
limsum   : '',      // Text saying your bare min or hard cap ############### DEP
deltasum : '',      // Text saying where you are wrt the centerline
graphsum : '',      // Text at the top of the graph image; see stathead
headsum  : '',      // Text in the heading of the graph page ############### DEP
titlesum : '',      // Title text for graph thumbnail ###################### DEP
progsum  : '',      // Text summarizing percent progress
rah      : 0,       // Y-value of the centerline of YBR at the akrasia horiz
error    : '',      // Empty string if no errors
safebuf  : null,    // Number of days of safety buffer (redundant with tluz?)
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
//'rerails', 
'tagtime', 
'timezone',
'backroad', 
'edgy',
'offred',
//'offparis',
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
const ErrMsgs = [ "Could not find goal file.", "Bad goal file." ]

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

bbin = bu.extend({}, bbin) // Make new copy of the input to prevent overwriting
  
// Private variables holding goal, road, and datapoint info
let roads = []
let goal = {}       // Holds loaded goal parameters
let alldata = []    // Holds the entire set of datapoints
let data = []       // Holds past aggregated data
let rosydata = []   // Holds rosy data
let fuda = []       // Holds all future data
let undoBuffer = [] // Array of previous roads for undo
let redoBuffer = [] // Array of future roads for redo
let oresets = []    // Odometer resets
let derails = []    // Derailments
let hollow = []     // Hollow points
let allvals = {}    // Dictionary holding values for each timestamp
let aggval = {}     // Dictionary holding aggregated value for each timestamp
let derailval = {}  // Map timestamp to value as of RECOMMIT datapoint that day
let hashhash = {}   // Maps timestamp to sets of hashtags to display on graph
let hashtags = []   // Array of timestamp string pairs for hashtag lists
 
// Initialize goal with sane values
goal.yaw = +1; goal.dir = +1
goal.tcur = 0; goal.vcur = 0; goal.vprev = 0;
const now = moment.utc()
now.hour(0); now.minute(0); now.second(0); now.millisecond(0)
goal.asof = now.unix()
goal.horizon = goal.asof+bu.AKH
goal.xMin =    goal.asof;  goal.xMax = goal.horizon
goal.yMin =    -1;         goal.yMax = 1

/**Convert legacy parameters to modern counterparts for backward compatibility.
   @param {Object} p Goal parameters from the bb file */
function legacyIn(p) {
  //if (p.gldt!==undefined && p.tfin===undefined) p.tfin = p.gldt
  if ('goal' in p && !('vfin' in p))  p.vfin = p.goal
  if ('rate' in p && !('rfin' in p))  p.rfin = p.rate
  if ('usr'  in p && 'graph' in p && !('yoog' in p)) 
    p.yoog = p.usr + "/" + p.graph
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
    p['gldt'] = bu.dayify(goal.tfin)
    p['goal'] = goal.vfin
    p['rate'] = goal.rfin*goal.siru
  } else {
    const len = p['fullroad'].length
    if (len > 0) {
      p['gldt'] = p['fullroad'][len-1][0]
      p['goal'] = p['fullroad'][len-1][1]
      p['rate'] = p['fullroad'][len-1][2]
    }
  }
  p['tini'] = bu.dayify(goal.tini)
  p['vini'] = goal.vini
  p['tfin'] = bu.dayify(goal.tfin)
  p['vfin'] = goal.vfin
  p['rfin'] = goal.rfin
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
  
  goal = {}
  goal.nw = 0
  goal.siru = null
  oresets = []
  derails = []
  hashhash = {}
  
  // All the in and out params are also global, via the goal hash
  for (const key in pout) goal[key] = pout[key]
  for (const key in pin)  goal[key] = pin[key]
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
  if (goal.yoog==='meta/derev')   KEXP = .03/SID   // .015 for meta/derev
  if (goal.yoog==='meta/dpledge') KEXP = .03/SID   // .1 jagged
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
  if (!goal.rosy || data.length == 0) return
  // Pre-compute rosy datapoints
  const delta = max(goal.lnw, goal.stdflux)
  let lo, hi
  if (goal.dir > 0) {
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
function dval(d) { return d[0] }

// Compute [informative comment, originalv (or null)] for aggregated points
function aggpt(vl, v) { // v is the aggregated value
  const kyoomy = goal.kyoom && goal.aggday === "sum"
  if (vl.length === 1) return [vl[0][1], vl[0][2]]
  else {
    let i
    // check if agg'd value is also an explicit datapoint for today
    if (kyoomy) i = bu.accumulate(vl.map(dval)).indexOf(v)
    else        i = vl.map(dval).indexOf(v)
    // if not, aggregated point stands alone
    if (i < 0) return [goal.aggday, null]
    // if found, append (aggday) to comment and record original value
    else return [vl[i][1]+" ("+goal.aggday+")", vl[i][2]]
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
    if (goal.hashtags) {
      const hset = hashextract(d[2])
      if (hset.size == 0) continue
      if (!(d[0] in hashhash)) hashhash[d[0]] = new Set()
      for (const x of hset) hashhash[d[0]].add(x)
    }
  }

  // Precompute list of [t, hashtext] pairs for efficient display
  if (goal.hashtags) {
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
  if (goal.odom) {
    oresets = data.filter(e => e[1]==0).map(e => e[0])
    br.odomify(data)
  }
  
  const nonfuda = data.filter(e => e[0]<=goal.asof)
  if (goal.plotall) goal.numpts = nonfuda.length
  
  allvals = {}
  aggval = {}

  // Aggregate datapoints and handle kyoom
  // HACK: aggday=skatesum requires knowledge of rfin
  br.rfin = goal.rfin
  let newpts = []
  let ct = data[0][0] // Current time
  let vl = []  // Value list: All values [val, cmt, originalv] for time ct 
        
  let pre = 0 // Current cumulative sum
  let prevpt

  // Process all datapoints
  for (i = 0; i <= data.length; i++) {
    if (i < data.length && data[i][0] == ct) {
      // Record all points for the current timestamp in vl
      vl.push([data[i][1], data[i][2], data[i][4]])
    }
    
    if (i >= data.length || data[i][0] != ct) {
      // Done recording all data for today
      let vlv = vl.map(dval)              // Extract all values for today
      let ad  = br.AGGR[goal.aggday](vlv) // Compute aggregated value
      // Find previous point to record its info in the aggregated point
      if (newpts.length > 0) prevpt = newpts[newpts.length-1]
      else prevpt = [ct, ad+pre]
      // pre remains 0 for non-kyoom
      let ptinf = aggpt(vl, ad)
      // Create new datapoint
      newpts.push([ct, pre+ad, ptinf[0], // this is the processed datapoint
                   ct <= goal.asof ? DPTYPE.AGGPAST : DPTYPE.AGGFUTURE, 
                   prevpt[0], prevpt[1], // this is the previous point
                   ptinf[1]])            // v(original)
      
      // Update allvals and aggval associative arrays
      // allvals[timestamp] has entries [vtotal, comment, vorig]
      if (goal.kyoom) {
        if (goal.aggday === "sum") {
          allvals[ct] = 
            bu.accumulate(vlv).map((e,j) => [e+pre, vl[j][1], vl[j][2]])
        } else allvals[ct] = vl.map(e => [e[0]+pre, e[1], e[2]])
        aggval[ct] = pre+ad
        pre += ad
      } else {
        allvals[ct] = vl
        aggval[ct] = ad
      }
      const vw = allvals[ct].map(e => e[0])

      // What we actually want for derailval is not this "worstval" but the 
      // agg'd value up to and including the recommit datapoint (see the
      // recommitted() function) and nothing after that:
      derailval[ct] = goal.yaw < 0 ? bu.arrMax(vw) : bu.arrMin(vw)
      
      if (i < data.length) {
        ct = data[i][0]
        vl = [[data[i][1],data[i][2],data[i][4]]]
      }
    }
  }
    
  // Recompute an array of all datapoints based on allvals,
  // having incorporated aggregation and other processing steps.
  let allpts = []
  for (let t in allvals) {
    allpts = allpts.concat(allvals[t].map(d => 
      [Number(t), d[0], d[1], 
       Number(t) <= goal.asof ? DPTYPE.AGGPAST : DPTYPE.AGGFUTURE,
       null, null, d[2]]))
  }
  alldata = allpts

  fuda = newpts.filter(e => e[0]>goal.asof)
  data = newpts.filter(e => e[0]<=goal.asof)
  if (data.length == 0) return "All datapoints are in the future!"

  if (!goal.plotall) goal.numpts = data.length
  
  // Compute data mean after filling in gaps
  const gfd = br.gapFill(data)
  const gfdv = gfd.map(e => (e[1]))
  if (data.length > 0) goal.mean = bu.mean(gfdv)
  if (data.length > 1)
    goal.meandelt = bu.mean(bu.partition(gfdv,2,1).map(e => e[1] - e[0]))
  
  // time of last entered datapoint pre-flatline (so ignoring future data)
  goal.tdat = data[data.length-1][0]
  
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
    return (e[0]<goal.asof && !allvals[e[0]].map(e => e[0]).includes(e[1]))
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
  let tini = goal.tini
  let vini = goal.vini
  // Handle cases where first road matrix row starts earlier than (tini,vini)
  if (rdData[0][0] != null && rdData[0][0] < tini) {
    tini = rdData[0][0]
    if (rdData[0][1] != null) vini = rdData[0][1]
  }
  // First segment starts from [tini-100days, vini], ends at [tini, vini]
  firstsegment = {
    sta: [tini, Number(vini)],
    slope: 0, auto: br.RP.SLOPE }
  firstsegment.end = firstsegment.sta.slice()
  firstsegment.sta[0] = bu.daysnap(firstsegment.sta[0]-100*SID*DIY) // 100y?
  roads.push(firstsegment)
  for (let i = 0; i < nk; i++) {
    // Each segment i starts from the end of the previous segment and continues
    // until road[i], filling in empty fields in the road matrix
    let segment = {}
    segment.sta = roads[roads.length-1].end.slice()
    let rddate = null, rdvalue = null, rdslope = null
    
    rddate  = rdData[i][0]
    rdvalue = rdData[i][1]
    rdslope = rdData[i][2]
    
    if (rddate == null) {
      segment.end = [0, Number(rdvalue)]
      segment.slope = Number(rdslope)/(goal.siru)
      if (segment.slope != 0) {
        segment.end[0] = segment.sta[0] 
                         + (segment.end[1] - segment.sta[1])/segment.slope
      } else {
        // Hack to handle tfin=null and inconsistent values
        segment.end[0] = BDUSK
        segment.end[1] = segment.sta[1]
      }
      segment.end[0] = min(BDUSK, segment.end[0])
      // Readjust the end value in case we clipped the date to BDUSK
      segment.end[1] = 
        segment.sta[1] + segment.slope*(segment.end[0]-segment.sta[0])
      segment.auto = br.RP.DATE
    } else if (rdvalue == null) {
      segment.end = [rddate, 0]
      segment.slope = Number(rdslope)/(goal.siru)
      segment.end[1] = 
        segment.sta[1]
        +segment.slope*(segment.end[0]-segment.sta[0])
      segment.auto = br.RP.VALUE
    } else if (rdslope == null) {
      segment.end = [rddate, Number(rdvalue)]
      segment.slope = br.segSlope(segment)
      segment.auto = br.RP.SLOPE
    } 
    // Skip adding segment if it is earlier than the first segment
    if (segment.end[0] >= segment.sta[0]) {
      roads.push(segment)
    }
  }
  // Extract computed values for tfin, vfin and rfin
  const goalseg = roads[roads.length-1]
  
  // A final segment is added, ending 100 days after tfin
  const finalsegment = {
    sta: goalseg.end.slice(),
    end: goalseg.end.slice(),
    slope: 0, auto: br.RP.VALUE }
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
  if (goal.yaw * goal.dir < 0 && tlast <= goal.tfin) {
    const tflat = min(goal.asof, goal.tfin)
    if (!(tflat in aggval)) {
      flad = [tflat, vlast, "PPR", DPTYPE.FLATLINE, tlast, vlast, null]
      data.push(flad)
    }
  }
original version of flatline() ************************************************/
  const now = goal.asof
  const numpts = data.length
  const tlast = data[numpts-1][0]
  const vlast = data[numpts-1][1]
  
  if (tlast > goal.tfin) return
  
  let x = tlast // x = the time we're flatlining to
  if (goal.yaw * goal.dir < 0) 
    x = min(now, goal.tfin) // WEEN/RASH: flatline all the way
  else { // for MOAR/PHAT, stop flatlining if 2 red days in a row
    let prevcolor = null
    let newcolor
    while (x <= min(now, goal.tfin)) { // walk forward from tlast
      // goal.isolines not defined yet so makes no sense calling dotcolor() TODO
      newcolor = br.dotcolor(roads, goal, x, vlast, goal.isolines)
      // done iff 2 reds in a row
      if (prevcolor===newcolor && prevcolor===bu.Cols.REDDOT) break
      prevcolor = newcolor
      x += SID // or see eth.pad/ppr
    }
    // the following looks particularly unnecessary
    x = min(x, now, goal.tfin)
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
  if (goal.tmin == null) goal.tmin = min(goal.tini, goal.asof)
  if (goal.tmax == null) {
    // Make more room beyond the askrasia horizon if lots of data
    const years = floor((goal.tcur - goal.tmin) / (DIY*SID))
    goal.tmax = bu.daysnap((1+years/2)*2*bu.AKH + goal.tcur)
  }
  if (goal.vmin != null && goal.vmax != null) {
    // both provided explicitly
    if (goal.vmin == goal.vmax) {
      goal.vmin -= 1; goal.vmax += 1    // scooch away from each other
    } else if (goal.vmin >  goal.vmax) {
      const tmp = goal.vmin
      goal.vmin = goal.vmax; goal.vmax = tmp //swap them
    }
    return
  }
  
  const PRAF = 0.015
  const a = br.rdf(roads, goal.tmin)
  const b = br.rdf(roads, goal.tmax)
  const d0 = data.filter(e => e[0] <= goal.tmax && e[0] >= goal.tmin)
                 .map(e => e[1])
  let mind = bu.arrMin(d0)
  let maxd = bu.arrMax(d0)
  // Make room for the ghosty PPR datapoint
  if (flad != null && flad[0] <= goal.tmax && flad[0] >= goal.tmin) {
    const pprv = flad[1] + br.ppr(roads, goal, goal.asof)
    mind = min(mind, pprv) // Make room for the 
    maxd = max(maxd, pprv) // ghosty PPR datapoint.
  }
  const padding = max(goal.lnw/3, (maxd-mind)*PRAF*2)
  let minmin = mind - padding
  let maxmax = maxd + padding
  if (goal.monotone && goal.dir>0) {          // Monotone up so no extra padding
    minmin = bu.arrMin([minmin, a, b])        // below (the low) vini.
    maxmax = bu.arrMax([maxmax, a+goal.lnw, b+goal.lnw])
  } else if (goal.monotone && goal.dir<0) {         // Monotone down so no extra
    minmin = bu.arrMin([minmin, a-goal.lnw, b-goal.lnw])   // padding above (the
    maxmax = bu.arrMax([maxmax, a, b])                     // high) vini.
  } else {
    minmin = bu.arrMin([minmin, a-goal.lnw, b-goal.lnw])
    maxmax = bu.arrMax([maxmax, a+goal.lnw, b+goal.lnw])
  }
  if (goal.plotall && goal.tmin<=goal.tini && goal.tini<=goal.tmax
      && goal.tini in allvals) {      
    // At tini, leave room for all non-agg'd datapoints
    minmin = min(minmin, bu.arrMin(allvals[goal.tini].map(e => e[0])))
    maxmax = max(maxmax, bu.arrMax(allvals[goal.tini].map(e => e[0])))
  }
  if (goal.vmin == null && goal.vmax == null) {
    goal.vmin = minmin
    goal.vmax = maxmax
    if (goal.vmin == goal.vmax) {
      goal.vmin -= 1; goal.vmax += 1
    } else if (goal.vmin > goal.vmax) {
      const tmp = goal.vmin
      goal.vmin = goal.vmax; goal.vmax = goal.vmin
    }
  } else if (goal.vmin==null) goal.vmin= minmin<goal.vmax ? minmin : goal.vmax-1
  else if   (goal.vmax==null) goal.vmax= maxmax>goal.vmin ? maxmax : goal.vmin+1
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
['ybhp', v => v!==false, "can't be false! LANEY ZOMBIE! Tell support!"],
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
['abslnw', bu.norn, "isn't numeric or null"],
['noisy', bu.torf, "isn't boolean"],
['integery', bu.torf, "isn't boolean"],
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
    if (!(l[1](goal[l[0]]))) return `'${l[0]}' ${l[2]}: ${s(goal[l[0]])}`
  }
  
  const rd = goal.road
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
  if (goal.kyoom && goal.odom)
    return "The odometer setting doesn't make sense for an auto-summing goal!"
  if (goal.ybhp && goal.abslnw > 0)
    return "Yellow Brick Half-Plane goals must have zero absolute lane width"

  return ""
}

// DIELANES
// Generate razrroad for YBHP migration by shifting each segment by the lane
// width in the negative yaw direction, ie, towards the bad side of the road.
// This yields a razrroad that coincides with the critical edge of the old-style
// laney road.
// (For dumb crufty reasons we're generating both the road matrix version as
// razrmatr and the version with Uluc's new road data structure as razrroad.
// It's razrmatr that Beebody wants and razrroad that bgraph wants, since we're
// also displaying the critical edge of laney roads as a thin red line now.
// Of course all this cruft will go away when the YBHP transition is complete!)
// ULUC TODO: Is razrline still necessary, sinc it will end up being the same as the road with lnw=0?
function genRazr() {
  //const lnf = goal.lnf
  const yaw = goal.yaw
  const t1 = seg => seg.sta[0]
  const t2 = seg => seg.end[0]
  const v1 = seg => seg.sta[1]
  const v2 = seg => seg.end[1]
  const offset = bu.conservaround(goal.lnw, 1e-14, 1)
  //console.log(`DEBUG: ${offset}`)

  // Iterate over road segments, s, where segments go from
  // {t1,       v1}       to {t2,       v2}       or 
  // {s.sta[0], s.sta[1]} to {s.end[0], s.end[1]}
  goal.razrroad = roads.slice().map(s => { // s for road segment
    // Previous things we tried: (SCHDEL)
    // (1) lnf of the midpoint of the segment, lnf((t1+t2)/2)
    //const offset = lnf((t1(s)+t2(s))/2)
    // (2) min of lnf(t1) and lnf(t2)
    //const offset = min(lnf(t1(s)), lnf(t2(s)))
    // (3) max of current lnw and amount needed to ensure not redyest
    //const yest = goal.asof - SID
    //const bdelt = -yaw*(goal.dtf(yest) - br.rdf(roads, yest)) // bad delta
    //const offset = yest < goal.tini ? goal.lnw : max(goal.lnw, bdelt)
    // (4) just use current lnw for chrissakes
    return {
      sta:   [t1(s), v1(s) - yaw*offset],
      end:   [t2(s), v2(s) - yaw*offset],      
      slope: s.slope,
      auto:  s.auto,
    }
  })

  // beebody style road matrix is a list of end-of-segment values, and
  // each segment means "start where previous segment left off, and
  // then connect that to these new coordinates". But for the very first
  // segment we draw, we need to know where to start, so we add the 
  // tini/vini row, but that is kind of an exception, because we don't
  // draw that segment, we just use it to know where to start the first
  // segment. but the road structure that we create in razrroad for bgraph
  // to use, each segment has a start and an end.
  // When we map over that road struct to turn it into a road matrix style
  // data, we need the initial dummy row to give us tini/vini, but we don't 
  // need the final dummy row.
  goal.razrmatr = goal.razrroad.slice(0,-1).map(s => {
    if (s.auto === 0) return [null,     s.end[1], s.slope*goal.siru]
    if (s.auto === 1) return [s.end[0], null,     s.slope*goal.siru]
    if (s.auto === 2) return [s.end[0], s.end[1], null   ]
    return "ERROR"
  })
}


/* SCHDEL: debugging scratch pad

// TODO: This wants refactored and cleaned up. If we're going to do the exact
// same thing to the dummy segments (iniroad and finroad) as we do to the
// the road with the dummies sliced off (midroad) then we don't need to slice
// them off at all. Just convert the whole thing! Ie, have the map above loop
// through all of "roads". And if we want to set aside iniroad and finroad
// and do *no* conversion to them, then we can just do the following instead
// of going to all the trouble of constructing all the fields:
//goal.razrroad = [roads[0]].concat(midroad, [roads[-1]])

let s = roads[0]  // first segment, which is kind of a dummy segment i guess?
 const iniroad = [{
   sta:   [t1(s), v1(s)],
   end:   [t2(s), v2(s)],
   slope: s.slope,
   auto:  s.auto,
 }]
 s = roads[roads.length-1] // last segment also dummy segment? am fuzzy on this
 const finroad = [{
   sta:   [t1(s), v1(s)],
   end:   [t2(s), v2(s)],
   slope: s.slope,
   auto:  s.auto,
 }]
 goal.razrroad = iniroad.concat(midroad, finroad)

// um, seems like this should be dropping both initial and final segment but
// apparently not because this is the version that actually generates the
// road matrix correctly with both tini/vini and tfin/vfin:

lnf
x => max(abs(self.vertseg(rd,x) ? 0 : self.rdf(rd, x) - self.rdf(rd, x-SID)), 
         rtf0(x))

{"sta":[-1591660800,0],"slope":0,"auto":2,"end":[1564099200,0]},
{"sta":[1564099200,0],"end":[1564185600,0],"slope":0,"auto":1},
{"sta":[1564185600,0],"end":[1895702400,1644.4285714285713],"slope":0.00000496031746031746,"auto":1},
{"sta":[1895702400,1644.4285714285713],"end":[5051462400,1644.4285714285713],"slope":0,"auto":1}
*/

/* SCHDEL: uluc's original code for calculating razrroad
  const oldroad = goal.road.map(e => [e[0], e[1], e[2]])
  // Compute safebuffer with ybhp=true and abslnw=0
  // Requires recomputation of a bunch of previously computed values.
  let newgoal = {}, newsafe, safediff
  //bu.extend(newgoal, goal, true)
  //newgoal = JSON.parse(JSON.stringify(goal)) // very safe deep copy?
  newgoal = {...goal} // this may just be a shallow copy?
  
  newgoal.ybhp = true
  newgoal.abslnw = 0
  newgoal.stdflux = br.noisyWidth(roads, data.filter(d => d[0]>=goal.tini))
  newgoal.nw = newgoal.noisy && newgoal.abslnw == null ?
    br.autowiden(roads, newgoal, data, newgoal.stdflux) : 0
  
  newgoal.lnf = newgoal.abslnw != null ? 
    (x => newgoal.abslnw) : br.genLaneFunc(roads, newgoal)
  newgoal.lnw = max(newgoal.nw, newgoal.lnf(newgoal.tcur))
  newsafe = br.dtd(roads, newgoal, newgoal.tcur, newgoal.vcur)
  safediff = goal.safebuf - newsafe
  
  let newroad = 
             oldroad.map(e => [(e[0] ? e[0]+0*SID*safediff : null), e[1], e[2]])
  //if (newroad[0][0] == null) // Uluc: I think this is not needed/incorrect
  if (safediff != 0)
    newroad.unshift([newgoal.tini+SID*safediff, newgoal.vini, null])
  // Remove the last element [tfin,vfin], which was added by us
  newroad.pop()
  return newroad 
}
*/

/** Process goal parameters */
function procParams() {

  goal.dtf = br.stepify(data) // map timestamps to most recent datapoint value
  
  //SCHDEL
  // remember original road (kludgery here) including tini/vini/tvrfin
  //goal.razrorig = bu.deepcopy(goal.road) // probably unnecessary to deepcopy?
  //goal.razrorig = [[goal.tini, goal.vini, null]].concat(
  //  goal.razrorig, [[goal.tfin, goal.vfin, goal.rfin]])

  goal.road = br.fillroad(goal.road, goal)
  const rl = goal.road.length
  goal.tfin = goal.road[rl-1][0]
  goal.vfin = goal.road[rl-1][1]
  goal.rfin = goal.road[rl-1][2]
  // tfin, vfin, rfin are set in procRoad
  
  if (!bu.orderedq(goal.road.map(e => e[0]))) {
    return "Road dial error\\n(Your goal date, goal "
      +(goal.kyoom?"total":"value")+", and rate are inconsistent!\\n"
      +"Is your rate positive when you meant negative?\\n"
      +"Or is your goal "+(goal.kyoom?"total":"value")+" such that the implied"
      +" goal date is in the past?)"
  }
  
  if (goal.ybhp && goal.abslnw === null) goal.abslnw = 0
  //if (goal.ybhp) goal.abslnw = 0  // fuck abslnw? no, better to fail loudly

  // rdf function is implemented in broad.js
  // rtf function is implemented in broad.js

  goal.stdflux = br.noisyWidth(roads, data.filter(d => d[0]>=goal.tini))
  goal.nw = goal.noisy && goal.abslnw == null ? 
            br.autowiden(roads, goal, data, goal.stdflux) : 0
  
  goal.lnf = goal.abslnw != null ? 
             (x => goal.abslnw) : br.genLaneFunc(roads, goal)
  
  flatline()

  const dl = data.length
  
  if (goal.movingav) {
    // Filter data and produce moving average
    if (!(dl <= 1 || data[dl-1][0]-data[0][0] <= 0)) { 
    
      // Create new vector for filtering datapoints
      const newx = griddle(data[0][0], data[dl-1][0],
                           (data[dl-1][0]-data[0][0])*4/SID)
      JSON.stringify(newx)
      goal.filtpts = newx.map(d => [d, ema(data, d)])
    } else goal.filtpts = []
  } else goal.filtpts = []
  
  goal.tcur = data[dl-1][0]
  goal.vcur = data[dl-1][1]
  goal.vprev= data[max(dl-2,0)][1] // default to vcur if < 2 datapts

  goal.lnw = goal.ybhp ? 0 : max(goal.nw, goal.lnf(goal.tcur))
  goal.safebuf = br.dtd(roads, goal, goal.tcur, goal.vcur)
  // originally called genRazr() here #SCHDEL
  goal.tluz = goal.tcur+goal.safebuf*SID
  goal.delta = bu.chop(goal.vcur - br.rdf(roads, goal.tcur))
  goal.rah = br.rdf(roads, goal.tcur+bu.AKH)
  
  goal.dueby = [...Array(7).keys()]
    .map(i => [bu.dayify(goal.tcur+i*SID),
               br.limd(roads, goal, i),
               br.lim(roads, goal, i)])
  const tmpdueby = bu.zip(goal.dueby)
  goal.dueby = bu.zip([tmpdueby[0], bu.monotonize(tmpdueby[1],goal.dir),
                                    bu.monotonize(tmpdueby[2],goal.dir)])
  
  goal.safebump = br.lim(roads, goal, goal.safebuf)
  
  goal.rcur = br.rtf(roads, goal.tcur)*goal.siru  
  goal.ravg = br.tvr(goal.tini, goal.vini, goal.tfin,goal.vfin, null)*goal.siru
  goal.cntdn = ceil((goal.tfin-goal.tcur)/SID)
  goal.lane = goal.ybhp ?  // backward-compatible version for YBHP
    goal.yaw * (goal.safebuf - (goal.safebuf <= 1 ? 2 : 1)) :
    bu.clip(br.lanage(roads, goal, goal.tcur, goal.vcur), -32768, 32767)
  goal.color = (goal.safebuf < 1 ? "red"    :
                goal.safebuf < 2 ? "orange" :
                goal.safebuf < 3 ? "blue"   : "green")
  goal.loser = br.redyest(roads, goal, goal.tcur) // TODO: need iso here
  goal.sadbrink = (goal.tcur-SID > goal.tini)
    && (br.dotcolor(roads, goal, goal.tcur-SID,
                    goal.dtf(goal.tcur-SID, goal.isolines))==bu.Cols.REDDOT)
  if (goal.safebuf <= 0) goal.tluz = goal.tcur
  if (goal.tfin < goal.tluz)  goal.tluz = bu.BDUSK
      
  setDefaultRange()
  genRazr()
  //console.log(`rdf(tfin)=${br.rdf(roads, goal.tfin)}`)
  return ""
}

function sumSet(rd, goal) {
  const y = goal.yaw, d = goal.dir, 
        l = goal.lane, w = goal.lnw, dlt = goal.delta, 
        q = goal.integery && goal.quantum === null ? 1 : 
            max(1e-5, goal.quantum) // TODO: just trust Beebody
        //q = goal.quantum

  const MOAR = (y>0 && d>0), 
        PHAT = (y<0 && d<0),
        WEEN = (y<0 && d>0), 
        RASH = (y>0 && d<0)

  const shn  = ((x, e=y, t=4, d=2) => q===null ? bu.shn(x, t, d, e) : // TODO
                                                 bu.conservaround(x, q, e))
  const shns = ((x, e=y, t=4, d=2) => (x>=0 ? "+" : "") + shn(x, e, t, d))


  if (goal.error != "") {
    goal.statsum = " error:    "+goal.error+"\\n"
    return
  }
  const rz = (bu.zip(goal.road))[2]
  let minr = bu.arrMin(rz)
  let maxr = bu.arrMax(rz)
  if (abs(minr) > abs(maxr)) { const tmp = minr; minr = maxr; maxr = tmp }
  const smin = bu.shn(minr,      4,2)
  const smax = bu.shn(maxr,      4,2)
  const savg = bu.shn(goal.ravg, 4,2)
  const scur = bu.shn(goal.rcur, 4,2)
  goal.ratesum = 
    (minr === maxr ? smin : "between "+smin+" and "+smax) +
    " per " + bu.UNAM[goal.runits] + 
    (minr !== maxr ? " (current: " + scur + ", average: " + savg + ")" : "")

  // What we actually want is timesum and togosum (aka, progtsum & progvsum) 
  // which will be displayed with labels TO GO and TIME LEFT in the stats box
  // and will have both the absolute amounts remaining as well as the 
  // percents done as calculated here.
  const pt = bu.shn(bu.cvx(bu.daysnap(goal.tcur),
                           goal.tini, bu.daysnap(goal.tfin), 0,100, false), 1,1)
  let pv = bu.cvx(goal.vcur, goal.vini,goal.vfin, 0,100, false)
  pv = bu.shn(goal.vini < goal.vfin ? pv : 100 - pv, 1,1)

  if (pt == pv) goal.progsum = pt+"% done"
  else          goal.progsum = pt+"% done by time -- "+pv+"% by value"

  let x, ybrStr
  if (goal.cntdn < 7) {
    x = sign(goal.rfin) * (goal.vfin - goal.vcur)
    ybrStr = "To go to goal: "+shn(x,0,2,1)+"."
  } else {
    x = br.rdf(roads, goal.tcur+goal.siru) - br.rdf(roads, goal.tcur)
    ybrStr = "Yellow Brick Rd = "+(x>=0 ? "+" : "")+bu.shn(x, 2, 1, 0)
                           +" / "+bu.UNAM[goal.runits]+"."
  }

  const ugprefix = false // debug mode: prefix yoog to graph title
  goal.graphsum = 
    (ugprefix ? goal.yoog : "")
    + shn(goal.vcur,0,3,1)+" on "+bu.shd(goal.tcur)+" ("
    + bu.splur(goal.numpts, "datapoint")+" in "
    + bu.splur(1+floor((goal.tcur-goal.tini)/SID),"day")+") "
    + "targeting "+shn(goal.vfin,0,3,1)+" on "+bu.shd(goal.tfin)+" ("
    + bu.splur(goal.cntdn, "more day")+"). "+ybrStr

  goal.deltasum = shn(abs(dlt),0) + " " + goal.gunits
    + (dlt<0 ? " below" : " above")+" the bright line"
/* SCHDEL DIELANES
  let s
  if (w == 0)                  s=""
  else if (y>0 && l>=-1&&l<=1) s=" and "+shn(w-dlt)+" to go till top edge"
  else if (y>0 && l>=2)        s=" and "+shn(dlt-w,0)+" above the top edge"
  else if (y>0 && l<=-2)       s=" and "+shn(-w-dlt)+" to go till bottom edge"
  else if (y<0 && l>=-1&&l<=1) s=" and "+shn(w-dlt,0)+" below top edge"
  else if (y<0 && l<=-2)       s=" and "+shn(-w-dlt,0)+" below bottom edge"
  else if (y<0 && l>1)         s=" and "+shn(dlt-w,-y)+" above top edge"
  else                         s=""
  goal.deltasum += s
*/

  const c = goal.safebuf // countdown to derailment, in days
  const cd = bu.splur(c, "day")
  const lim  = br.lim (roads, goal, MOAR || PHAT ? c : 0)
  const limd = br.limd(roads, goal, MOAR || PHAT ? c : 0)
  if (goal.kyoom) {
    if (MOAR) goal.limsum = shns(limd)+" in "+cd
    if (PHAT) goal.limsum = shns(limd)+" in "+cd
    if (WEEN) goal.limsum = shns(limd)+" today" 
    if (RASH) goal.limsum = shns(limd)+" today"
  } else {
    if (MOAR) goal.limsum= shns(limd)+" in "+cd+" ("+shn(lim)+")"
    if (PHAT) goal.limsum= shns(limd)+" in "+cd+" ("+shn(lim)+")"
    if (WEEN) goal.limsum= shns(limd)+" today ("    +shn(lim)+")"    
    if (RASH) goal.limsum= shns(limd)+" today ("    +shn(lim)+")"
  }
  if (y*d<0)      goal.safeblurb = "unknown days of safety buffer"
  else if (c>999) goal.safeblurb = "more than 999 days of safety buffer"
  else            goal.safeblurb = "~"+cd+" of safety buffer"

/* SCHDEL DIELANES
  let lanesum
  if (goal.loser) {
    goal.headsum = "Officially off the yellow brick road"
    lanesum      = "officially off the road"
  } else if (w==0 && false) { // TODO: lnw==0 doesn't mean flat road WTF
    goal.headsum = "Coasting on a currently flat yellow brick road"
    lanesum      = "currently on a flat road"
  } else if (MOAR && l==1) {
    goal.headsum = "Right on track in the top lane of the yellow brick road"
    lanesum      = "in the top lane: perfect!"
  } else if (MOAR &&  l==2) {
    goal.headsum = "Sitting pretty just above the yellow brick road"
    lanesum      = "above the road: awesome!"
  } else if (MOAR &&  l==3) {
    goal.headsum = "Well above the yellow brick road with "+goal.safeblurb
    lanesum      = "well above the road: "+goal.safeblurb+"!"
  } else if (MOAR &&  l>3) {
    goal.headsum = "Way above the yellow brick road with "+goal.safeblurb
    lanesum      = "way above the road: "+goal.safeblurb+"!"
  } else if (MOAR &&  l==-1) {
    goal.headsum = "On track but in the wrong lane of the yellow brick road "
      +"and in danger of derailing tomorrow"  
    lanesum      = "in the wrong lane: could derail tomorrow!"
  } else if (MOAR &&  l<=-2) {
    goal.headsum = "Below the yellow brick road and will derail if still here"
      +" at the end of the day"
    lanesum = "below the road: will derail at end of day!"
  } else if (PHAT &&  l==-1) {
    goal.headsum = "Right on track in the right lane of the yellow brick road"
    lanesum      = "in the right lane: perfect!"
  } else if (PHAT &&  l==-2) {
    goal.headsum = "Sitting pretty just below the yellow brick road"
    lanesum      = "below the road: awesome!"
  } else if (PHAT &&  l==-3) {
    goal.headsum = "Well below the yellow brick road with "+goal.safeblurb
    lanesum      = "well below the road: "+goal.safeblurb+"!"
  } else if (PHAT &&  l<-3) {
    goal.headsum = "Way below the yellow brick road with "+goal.safeblurb
    lanesum      = "way below the road: "+goal.safeblurb+"!"
  } else if (PHAT &&  l==1) {
    goal.headsum = "On track but in the wrong lane of the yellow brick road "
      +"and in danger of derailing tomorrow"
    lanesum      = "in the wrong lane: could derail tomorrow!"
  } else if (PHAT &&  l>=2) {
    goal.headsum = "Above the yellow brick road and will derail if still here"
      +" at the end of the day"
    lanesum      = "above the road: will derail at end of day!"
  } else if (l==0) {
    goal.headsum = "Precisely on the centerline of the yellow brick road"
    lanesum      = "precisely on the centerline: beautiful!"
  } else if (l==1) {
    goal.headsum = "In the top lane of the yellow brick road"
    lanesum      = "in the top lane"
  } else if (l==-1) {
    goal.headsum = "In the bottom lane of the yellow brick road"
    lanesum      = "in the bottom lane"
  } else if (l>1) {
    goal.headsum = "Above the yellow brick road"
    lanesum      = "above the road"
  } else if (l<-1) {
    goal.headsum = "Below the yellow brick road"
    lanesum      = "below the road"
  }
*/
  goal.titlesum
    //SCHDEL
    //= bu.toTitleCase(goal.color)
    //+ ". "
    //+ "bmndr.com/"+goal.yoog+" is " 
    //+ lanesum
    //+ ((y*d>0)?" (safe to stay flat for ~"+cd+")":"")
    = bu.toTitleCase(goal.color) + ": bmndr.com/"+goal.yoog+" is safe for ~"+cd
    + (c===0 ? " (beemergency!)" : "")
  goal.headsum = goal.titlesum

  goal.statsum =
    " progress: "+bu.shd(goal.tini)+"  "
    +(data == null ? "?" : bu.shn(goal.vini, 4, 2, 0))+"\\n"
    +"           "+bu.shd(goal.tcur)+"  "+bu.shn(goal.vcur, 4, 2, 0)
    +"   ["+goal.progsum+"]\\n"
    +"           "+bu.shd(goal.tfin)+"  "+bu.shn(goal.vfin, 4, 2, 0)+"\\n"
    +" rate:     "+goal.ratesum+"\\n"
    +" lane:     " +((abs(l) == 666)?"n/a":l)+"\\n"
    +" safebuf:  "+goal.safebuf+"\\n"
    +" delta:    "+goal.deltasum+"\\n"
    +" "
  if      (y==0) goal.statsum += "limit:    "
  else if (y<0)  goal.statsum += "hard cap: "
  else           goal.statsum += "bare min: "
  goal.statsum += goal.limsum+"\\n"
  //goal.statsum = encodeURI(goal.statsum) // TODO
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
    
  sumSet(roads, goal)

  // TODO: This seems to compute these entities based on old data, particularly
  // when this function is called from bgraph as a result of an edited road.
  goal.fullroad = goal.road.slice()
  goal.fullroad.unshift( [goal.tini, goal.vini, 0, 0] )
  if (goal.error == "") {
    goal.pinkzone = [[goal.asof,br.rdf(roads, goal.asof),0]]
    goal.road.forEach(
      function(r) {
        if (r[0] > goal.asof && r[0] < goal.asof+bu.AKH) {
          goal.pinkzone.push([r[0], r[1], null])
        }
      }
    )
    goal.pinkzone.push([goal.asof+bu.AKH, br.rdf(roads, goal.asof+bu.AKH),
                        null])
    goal.pinkzone = br.fillroadall(goal.pinkzone, goal)
  }
    
  // Generate the aura function now that the flatlined datapoint's also computed
  if (goal.aura) {
    const adata = data.filter(e => e[0]>=goal.tmin)
    const fdata = br.gapFill(adata)
    goal.auraf = br.smooth(fdata)
  } else goal.auraf = (e => 0)

  if (goal.ybhp) {
    goal.dtdarray = br.dtdarray( roads, goal )

    goal.isolines = []
    for (let i = 0; i < 4; i++)
      goal.isolines[i] = br.isoline(roads, goal.dtdarray, goal, i)
  } else {
    goal.dtdarray = null
    goal.isolines = null
  }
  
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
    goal.proctm = tm                         // time so could just get time here
    data = stampIn(p, d)

    // make sure all supplied params are recognized
    const lup = [] // list of unknown parameters
    for (const k in p) {
      if (k in p) {
        if (!(k in pin) && !pig.includes(k)) lup.push(`${k}=${p[k]}`)
        else goal[k] = p[k]
      }
    }
    if (lup.length > 0) goal.error += 
      `Unknown param${lup.length===1 ? "" : "s"}: ${lup.join(', ')}`

    // Process & extract various params that are independent of road & data
    // maybe just default to aggday=last; no such thing as aggday=null
    if (!('aggday' in p)) p.aggday = goal.kyoom ? "sum" : "last"
    
    goal.siru = bu.SECS[p.runits]
    goal.horizon = goal.asof+bu.AKH
    // Save initial waterbuf value for comparison in bgraph.js
    goal.waterbuf0 = goal.waterbuf
    
    // Append final segment to the road array. These values will be
    // reextracted after filling in road in procParams
    if (bu.listy(goal.road)) goal.road.push([goal.tfin, goal.vfin, goal.rfin])
    if (goal.error == "") goal.error = vetParams()
    if (goal.error == "") goal.error = procData()
    
    // Extract road info into our internal format consisting of road segments:
    // [ [startt, startv], [endt, endv], slope, autofield ]
    if (goal.error == "") goal.error = procRoad(p.road)
    if (goal.error == "") goal.error = self.reloadRoad() // does procParams here

    computeRosy()
      
  } finally {
    // Generate beebrain stats (use getStats tp retrieve)
    stats = Object.assign({}, pout)
    for (const prop in stats) stats[prop] = goal[prop]
    stampOut(stats)
    legacyOut(stats)
  }
}

/**Returns an object with pre-computed goal statistics, summaries and other
   details. */
this.getStats = function() { return bu.extend({}, stats) }

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
  self.reloadRoad()
}
  
genStats( bbin.params, bbin.data )
goal.graphurl = bu.BBURL
goal.thumburl = bu.BBURL
  
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
this.goal = goal
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
