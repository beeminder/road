/**
 * Javascript implementation of beebrain, provided as a UMD
 * module. Provides a {@link beebrain} class, which can be used to
 * construct independent beebrain objects each with their own internal
 * state.<br/>

 * <br/>Copyright © 2017 Uluc Saranli
 @module beebrain
 @requires moment
 @requires butil
 @requires broad
 */
;(((root, factory) => {
  'use strict'
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    //console.log("beebrain: Using AMD module definition")
    define(['moment', 'butil', 'broad'], factory)
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.    
    //console.log("beebrain: Using CommonJS module.exports")
    module.exports = factory(require('moment'), require('./butil'), 
                             require('./broad'))
  } else {
    //console.log("beebrain: Using Browser globals")
    root.beebrain = factory(root.moment, root.butil, root.broad)
  }
})(this, (moment, bu, br) => {
  'use strict'

  // -------------------------------------------------------------
  // ------------------- FACTORY GLOBALS ---------------------
  /** Global counter to Generate unique IDs for multiple beebrain instances. */
  var gid = 1,

  pin = { // In Params: Graph settings and their defaults
    offred   : false,// Whether to use new yesterday-is-red criteria for derails
    deadline : 0,    // Time of deadline given as seconds bfr or after midnight
    sadlhole : true, // Allow the do-less l.hole where you can eke back onto YBR
    asof     : null, // Compute everything as if it were this date
    tini     : null, // (tini,vini) specifies the strt of the YBR, typically but
    vini     : null, //  not necessarily the same as the initial datapoint
    road     : [],   // List of (endTime,goalVal,rate) triples defining the YBR
    tfin     : null, // Goal date (unixtime); end of the Yellow Brick Road
    vfin     : null, // The actual value being targeted; any real value
    rfin     : null, // Final rate (slope) of the YBR before it hits the goal
    runits   : 'w',  // Rate units for road and rfin; one of "y","m","w","d","h"
    yaw      : 0,    // Which side of the YBR you want to be on, +1 or -1
    dir      : 0,    // Which direction you'll go (usually same as yaw)
    pinkzone : [],   // Region to shade pink, specified like the road matrix
    tmin     : null, // Earliest date to plot on the x-axis (unixtime):
    tmax     : null, // ((tmin,tmax), (vmin,vmax)) give the plot range, ie, they
    vmin     : null, // control zooming/panning; they default to the entire
    vmax     : null, //   plot -- initial datapoint to past the akrasia horizon
    kyoom    : false,// Cumulative; plot vals as the sum of those entered so far
    odom     : false,// Treat zeros as accidental odom resets
    abslnw   : null, // Override road width algorithm with a fixed lane width
    maxflux  : 0,    // User-specified max daily fluctuation                      
    noisy    : false,// Compute road width based on data, not just road rate
    integery : false,// Whether vals are necessarily integers (used in limsum)  
    monotone : false,// Whether data is necessarily monotone (used in limsum) 
    aggday   : null, // sum/last/first/min/max/mean/median/mode/trimmean/jolly
    plotall  : true, // Plot all the points instead of just the aggregated point
    steppy   : false,// Join dots with purple steppy-style line
    rosy     : false,// Show the rose-colored dots and connecting line
    movingav : false,// Show moving average line superimposed on the data
    aura     : false,// Show blue-green/turquoise aura/swath
    hashtags : true, // Show annotations on graph for hashtags in datapt comments 
    yaxis    : '',   // Label for the y-axis, eg, "kilograms"
    waterbuf : null, // Watermark on the good side of the YBR; safebuf if null
    waterbux : '',   // Watermark on the bad side, ie, pledge amount
    hidey    : false,// Whether to hide the y-axis numbers
    stathead : true, // Whether to include a label with stats at top of graph 
    imgsz    : 760,  // Image size; width in pixels of the graph image        
    yoog     : 'U/G',// Username/graphname, eg, "alice/weight"                
    usr      : null, // Username (synonym for first half of yoog) ######## DEP
    graph    : null, // Graph name (synonym for second half of yoog) ##### DEP
    gldt     : null, // Synonym for tfin ################################# DEP
    goal     : null, // Synonym for vfin ################################# DEP
    rate     : null  // Synonym for rfin ################################# DEP
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
    stdflux  : 0,      // Rec. lanewidth .9 quantile of rate-adjusted deltas
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

  CNAME = { },

  /** Enum object to identify different types of datapoints. 
      @enum {number} 
      @memberof beebrain*/
  DPTYPE = {
    AGGPAST:0, AGGFUTURE:1, RAWPAST:2, RAWFUTURE:3, FLATLINE:4, HOLLOW: 5
  },

  /** Enum object to identify error types. */
  ErrType = { NOBBFILE:0, BADBBFILE:1  },

  /** Enum object to identify error types. */
  ErrMsgs = [ "Could not find goal file.", "Bad goal file." ],

  /** Type of the last error */
  LastError = null,

  PRAF  = .015,    // Fraction of plot range that the axes extend beyond

  // ----------------- Beeminder Goal utilities ----------------------

  // -------------------------------------------------------------
  // ------------------- BEEBRAIN CONSTRUCTOR ---------------------
  /** beebrain object constructor. Processes the supplied goal
   * information JSON and computed derived goal parameters, summaries
   * and other details. These results can be accessed through various
   * public members and methods.

   @memberof module:beebrain
   @constructs beebrain
   @param {Object} bbin JSON input "BB file" with goal details
  */
  beebrain = function( bbin ) {
    //console.debug("beebrain constructor ("+gid+"): ");
    var self = this,
        curid = gid
    gid++
    
    // Make a new copy of the input to prevent overwriting
    bbin = bu.extend({}, bbin)
      
    // Private variables holding goal, road and datapoint info
    var 
    roads = [],

    goal = {},       // Holds loaded goal parameters
    alldata = [],    // Holds the entire set of data points
    data = [],       // Holds past aggregated data
    rosydata = [],   // Holds rosy data
    fuda = [],       // Holds all future data
    undoBuffer = [], // Array of previous roads for undo
    redoBuffer = [], // Array of future roads for redo
    oresets = [],    // Odometer resets
    derails = [],    // Derailments
    hollow = [],     // Hollow points
    allvals = {},    // Dictionary holding values for each timestamp
    aggvals = {},    // Dictionary holding aggregated value for each timestamp
    worstval = {},   // Maps timestamp to min/max (depending on yaw) value that day
    hashhash = {},   // Maps timestamp to sets of hashtags to display on the graph
    hashtags = []    // Array of timestamp string pairs for hashtag lists
     
    // Initialize goal with sane values
    goal.yaw = +1; goal.dir = +1
    goal.tcur = 0; goal.vcur = 0
    var now = moment.utc()
    now.hour(0); now.minute(0); now.second(0); now.millisecond(0)
    goal.asof = now.unix()
    goal.horizon = goal.asof+bu.AKH
    goal.xMin = goal.asof;  goal.xMax = goal.horizon
    goal.yMin = -1;    goal.yMax = 1

    /** Convery legacy parameters to up-to-date entries 
        @param {Object} p Goal parameters from the bb file */
    function legacyIn( p ) {
      if (p.hasOwnProperty('gldt') && !p.hasOwnProperty('tfin'))  p.tfin = p.gldt
      if (p.hasOwnProperty('goal') && !p.hasOwnProperty('vfin'))  p.vfin = p.goal
      if (p.hasOwnProperty('rate') && !p.hasOwnProperty('rfin'))  p.rfin = p.rate
      if (p.hasOwnProperty('usr') && p.hasOwnProperty('graph') && !p.hasOwnProperty('yoog')) 
        p.yoog = p.usr + "/" + p.graph
    }
    
    // Helper function for legacyOut
    function rowfix(row) {
      if (!Array.isArray(row)) return row
      if (row.length <= 3) return row
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
        var len = p['fullroad'].length
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
      // This is here because object member initialization with dynamic names is not possible
      CNAME[bu.Cols.GRNDOT] = "green",
      CNAME[bu.Cols.BLUDOT] = "blue",
      CNAME[bu.Cols.ORNDOT] = "orange",
      CNAME[bu.Cols.REDDOT] = "red",
      CNAME[bu.Cols.BLCK]   = "black" 
  
      // Data related variables
      data = []
      flad = null
      fuda = []
      allvals = {}
      aggvals = {}
      worstval = {}

      goal = {}
      goal.nw = 0
      goal.siru = null
      oresets = []
      derails = []
      hashhash = {}

      // All the in and out params are also global variables!
      var prop;
      for (prop in pout) if (pout.hasOwnProperty(prop))goal[prop] = pout[prop]
      for (prop in pin) if (pin.hasOwnProperty(prop)) goal[prop] = pin[prop]
    }

    function parserow(row) {
      return (!Array.isArray(row) || row.length != 3)
        ?row:[bu.dayparse(row[0]), row[1], row[2]]
    }

    // Helper function for stampOut
    function dayifyrow( row ) {
      if (row.length < 1) return row
      var newrow = row.slice()
      newrow[0] = bu.dayify(row[0])
      return newrow
    }

    /** Processes fields with timestamps in the input
     @param {Object} p Goal parameters from the BB file
     @param {Array} d Data points from the BB file*/
    function stampIn( p,d ) {
      ['asof', 'tini', 'tfin', 'tmin', 'tmax']
        .map((e)=>{if (p.hasOwnProperty(e)) p[e] = bu.dayparse(p[e])})
      if (p.hasOwnProperty('road'))
        if (bu.listy(p.road)) p.road = p.road.map(parserow)

      // Stable-sort by timestamp before dayparsing the timestamps
      // because if the timestamps were actually given as unixtime
      // then dayparse works like dayfloor and we lose fidelity.
      return d
        .map((r,i)=>([bu.dayparse(r[0]),r[1],r[2],i,r[1]]))   // Store indices
        .sort((a,b)=>((a[0]!== b[0])?(a[0]-b[0]):(a[3]-b[3]))) 
    }

    /** Convert unixtimes back to daystamps
        @param {Object} p Computed goal statistics */
    function stampOut( p ) {
      p['fullroad'] = p['fullroad'].map(dayifyrow)
      p['pinkzone'] = p['pinkzone'].map(dayifyrow)
      p['tluz'] = bu.dayify(p['tluz'])
      p['tcur'] = bu.dayify(p['tcur'])
      p['tdat'] = bu.dayify(p['tdat'])
    }

    // Helper function for Exponential Moving Average; returns
    // smoothed value at x.  Very inefficient since we recompute
    // the whole moving average up to x for every point we want to
    // plot.
    function ema(d, x) {
      // The Hacker's Diet recommends 0.1 Uluc had .0864
      // http://forum.beeminder.com/t/control-exp-moving-av/2938/7
      // suggests 0.25
      var KEXP = .25/bu.SID 
      if (goal.yoog==='meta/derev') KEXP = .03/bu.SID   //.015 for meta/derev
      if (goal.yoog==='meta/dpledge') KEXP = .03/bu.SID // .1 jagged
      var xp = d[0][0],
          yp = d[0][1]
      var prev = yp, dt, i, ii, A, B
      if (x < xp) return prev
      for (ii = 1; ii < d.length; ii++) { // compute line equation
        i = d[ii]
        dt = i[0] - xp
        A = (i[1]-yp)/dt  // (why was this line marked as a to-do?)
        B = yp
        if (x < i[0]) { // found interval; compute intermediate point
          dt = x-xp
          return B+A*dt-A/KEXP + (prev-B+A/KEXP) * Math.exp(-KEXP*dt)
        } else { // not the current interval; compute next point
          prev = B+A*dt-A/KEXP + (prev-B+A/KEXP) * Math.exp(-KEXP*dt)
          xp = i[0]
          yp = i[1]
        }
      }
      // keep computing exponential past the last datapoint if needed
      dt = x-xp
      return B + A*dt - A/KEXP + (prev-B+A/KEXP) * Math.exp(-KEXP*dt)
    }

    // Function to generate samples for the Butterworth filter
    function griddlefilt(a, b) {
      return bu.linspace(a, b, Math.floor(bu.clip((b-a)/(bu.SID+1), 40, 2000)))
    }

    // Function to generate samples for the Butterworth filter
    function griddle(a, b, maxcnt = 6000) {
      return bu.linspace(a, b, Math.floor(bu.clip((b-a)/(bu.SID+1), 
                                            Math.min(600, /*plotbox.width*/ 640),
                                            maxcnt)))
    }

    // Start at the first data point plus sign*delta and walk forward making the next
    // point be equal to the previous point, clipped by the next point plus or minus 
    // delta. Used for the rose-colored dots.
    function inertia0(x, d, sgn) {
      return bu.foldlist( ((a, b)=>bu.clip(a, b-d, b+d)), x[0]+sgn*d, x.slice(1,x.length))
    }
    function inertia(dat, delt, sgn) {  // data, delta, sign (-1 or +1)
      var tdata = bu.zip(dat) // transpose of data
      tdata[1] = inertia0(tdata[1], delt, sgn)
      return bu.zip(tdata)
    }
    // Same thing but start at the last data point and walk backwards.
    function inertiaRev(dat, dlt, sgn) {
      return inertia(dat.slice().reverse(), dlt, sgn).reverse()
    }

    /** Pre-compute rosy datapoints */
    function computeRosy() {
      if (!goal.rosy || data.length == 0) return
      // Pre-compute rosy datapoints
      var delta = Math.max(goal.lnw, goal.stdflux), lo, hi
      if (goal.dir > 0) {
        lo = inertia(   data, delta, -1)
        hi = inertiaRev(data, delta, +1)
      } else {
        lo = inertiaRev(data, delta, -1)
        hi = inertia(   data, delta, +1)
      }
      var yveclo = lo.map(e=>e[1])
      var yvechi = hi.map(e=>e[1])
      var yvec = bu.zip([yveclo, yvechi]).map(e=>((e[0]+e[1])/2))
      var xvec = data.map(e=>e[0])
      rosydata = bu.zip([xvec, yvec])
      rosydata = rosydata.map(e=>[e[0],e[1],"rosy data",
                                  DPTYPE.RAWPAST, null, null, e[1]])
      for (let i = 1; i < rosydata.length-1; i++) {
        rosydata[i][4] = rosydata[i-1][0]
        rosydata[i][5] = rosydata[i-1][1]
      }
    }

    // Take string like "shark jumping #yolo :) #sharks", return {"#yolo", "#sharks"}
    var hre = /(?:^|\s)(#[a-zA-Z]\w+)(?=$|\s)/g
    function hashextract(s){
      var set = new Set(), m
      hre.lastIndex = 0
      while ( (m = hre.exec(s)) != null )
        if (m[1] != "") set.add(m[1])
      return set
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
      var numpts = data.length, i, d

      for (i = 0; i < numpts; i++) {
        d = data[i]
        // Sanity check data element
        if (!(bu.nummy(d[0]) && d[0]>0 && bu.nummy(d[1]) &&bu.stringy(d[2])))
          return "Invalid datapoint: "+d[0]+" "+d[1]+' "'+d[3]

        // Extract and record hashtags
        if (goal.hashtags) {
          var hset = hashextract(d[2]), elem
          if (hset.size == 0) continue
          if (!hashhash.hasOwnProperty(d[0])) hashhash[d[0]] = new Set()
          for (elem of hset) {
            hashhash[d[0]].add(elem)
          }
        }
      }

      // Precompute list of [t, hashtext] pairs for efficient display
      if (goal.hashtags) {
        hashtags = []
        var keys = Object.keys(hashhash);
        for (let key in hashhash)
          hashtags.push([key, Array.from(hashhash[key]).join(" ")])
      }

      // Identify derailments and construct a copied array
      derails = data.filter(e=>(e[2].startsWith("RECOMMITTED")))
      derails = derails.map(e=>e.slice())
      if (!goal.offred)
        for (i = 0; i < derails.length; i++) derails[i][0] = derails[i][0]-bu.SID
      
      // Identify, record and process odometer reset for odom goals
      if (goal.odom) {
        oresets = data.filter(function(e){ return (e[1]==0);}).map(e=>(e[0]))
        br.odomify(data)
      }

      var nonfuda = data.filter(e=>(e[0]<=goal.asof))
      if (goal.plotall) goal.numpts = nonfuda.length

      aggvals = {}
      allvals = {}
      // Aggregate datapoints and handle kyoom
      // HACK: aggday=skatesum requires knowledge of rfin
      br.rfin = goal.rfin
      var newpts = []
      var ct = data[0][0], // Current time
          vl = []  // Value list: All values [val, cmt, originalv] for current time ct
          
      var pre = 0, // Current cumulative sum
          prevpt

      // Helper fn: Extract values from vl
      var dval = (d=>d[0])
      // Helper fn: Compute [informative comment,originalv(or null)] for aggregated points
      var aggpt = function(vl, v) { // v is the aggregated value
        if (vl.length == 1) return [vl[0][1], vl[0][2]]
        else {
          var ind
          // Check if aggregated value is one of the explicit points for today
          if (goal.kyoom && goal.aggday === "sum") 
            ind = bu.accumulate(vl.map(dval)).indexOf(v)
          else ind = vl.map(dval).indexOf(v)
          // If not, aggregated point stands alone
          if (ind < 0) return [goal.aggday, null]
          // If found, append (aggday) to comment and record original value
          else return [vl[ind][1]+" ("+goal.aggday+")", vl[ind][2]]
        }
      }

      // Process all datapoints
      for (i = 0; i <= data.length; i++) {
        if (i < data.length && data[i][0] == ct) {
          // Record all points for the current timestamp in vl
          vl.push([data[i][1],data[i][2],data[i][4]])
        }

        if ( (i >= data.length) || data[i][0] != ct) {
          // Done recording all data for today
          let vlv = vl.map(dval)             // Extract all values for today
          let ad = br.AGGR[goal.aggday](vlv) // Compute aggregated value
          // Find previous point to record its info in the aggregated pt.
          if (newpts.length > 0) prevpt = newpts[newpts.length-1]
          else prevpt = [ct, ad+pre]
          //pre remains 0 for non-kyoom
          let ptinf = aggpt(vl, ad)
          // Create new datapoint
          newpts.push([ct, pre+ad, ptinf[0], // This is the processed datapoint
                       (ct <= goal.asof)?DPTYPE.AGGPAST:DPTYPE.AGGFUTURE, 
                       prevpt[0], prevpt[1], // This is the previous point
                       ptinf[1]])            // v(original)

          // Update allvals and aggvals associative arrays
          // allvals[timestamp] has entries [vtotal, comment, vorig]
          if (goal.kyoom) {
            if (goal.aggday === "sum") {
              allvals[ct] = bu.accumulate(vlv).map((e,j)=>([e+pre, vl[j][1], vl[j][2]]))
            } else allvals[ct] = vl.map(e=>([e[0]+pre, e[1], e[2]]))
            aggvals[ct] = pre+ad
            pre += ad
          } else {
            allvals[ct] = vl
            aggvals[ct] = ad
          }
          let vw = allvals[ct].map(e=>e[0])
          worstval[ct] = (goal.yaw<0)?bu.arrMax(vw):bu.arrMin(vw)
          
          if (i < data.length) {
            ct = data[i][0]
            vl = [[data[i][1],data[i][2],data[i][4]]]
          }
        }
      }
      
      // Recompute an array of all datapoints based on allvals,
      // having incorporated aggregation and other processing steps.
      var allpts = [];
      for (let t in allvals) {
        allpts = allpts.concat(allvals[t].map(
          d=>([Number(t), d[0], d[1], 
               (Number(t) <= goal.asof)?DPTYPE.AGGPAST:DPTYPE.AGGFUTURE,
               null, null, d[2]])))
      }
      alldata = allpts

      fuda = newpts.filter(e=>(e[0]>goal.asof))
      data = newpts.filter(e=>(e[0]<=goal.asof))
      if (!goal.plotall) goal.numpts = data.length

      // Compute data mean after filling in gaps
      var gfd = br.gapFill(data)
      var gfdv = gfd.map(e => (e[1]))
      if (data.length > 0) goal.mean = bu.mean(gfdv)
      if (data.length > 1)
        goal.meandelt = bu.mean(bu.partition(gfdv,2,1).map(e => (e[1] - e[0])))

      // tstamp of last ent. datapoint pre-flatline
      goal.tdat = data[data.length-1][0]

      // Adjust derailment markers to indicate worst value for that day
      for (i = 0; i < derails.length; i++) {
        ct = derails[i][0]+bu.SID
        if (worstval.hasOwnProperty(ct)) derails[i][1] = worstval[ct]
      }
      
      // Extract computed points that are different than any entered
      // data (hollow pts)
      hollow = data.filter(e=>{
        if (!allvals.hasOwnProperty(e[0])) return false
        return (e[0]<goal.asof && !allvals[e[0]].map(e=>e[0]).includes(e[1]))
      })
      
      return ""
    }

    /** Extracts road segments from the supplied road matrix in the *
     input parameters as well as tini and vini. Upon compeltion, the *
     'roads' variable contains an array of road segments as javascript
     objects in the following format:<br/>

     {sta: [startt, startv], end: [endt, endv], slope, auto}<br/>

     Initial and final flat segments are added from starting days
     before tini and ending after 100 days after tfin.
     @param {Array} json Unprocessed road matrix from the BB file
    */
    function procRoad( json ) {
      roads = []
      var rdData = json
      var nk = rdData.length
      var firstsegment
      var tini = goal.tini, vini = goal.vini
      // Handle cases when the first oad matrix entry starts earlier
      // than (tini,vini).
      if (rdData[0][0] != null && rdData[0][0] < tini) {
        tini = rdData[0][0]
        if (rdData[0][1] != null) vini = rdData[0][1]
      }
      // First segment starts from [tini-100days, vini], ends at [tini, vini]
      firstsegment = {
        sta: [tini, Number(vini)],
        slope: 0, auto: br.RP.SLOPE };
      firstsegment.end = firstsegment.sta.slice()
      firstsegment.sta[0] = bu.daysnap(firstsegment.sta[0]-100*bu.DIY*bu.SID)
      roads.push(firstsegment)
      for (let i = 0; i < nk; i++) {
        // Each segment i starts from the end of the previous segment
        // and continues until road[i], filling in empty fields in the
        // road matrix
        var segment = {}
        segment.sta = roads[roads.length-1].end.slice()
        var rddate = null, rdvalue = null, rdslope = null

        rddate = rdData[i][0]
        rdvalue = rdData[i][1]
        rdslope = rdData[i][2]

        if (rddate == null) {
          segment.end = [0, Number(rdvalue)]
          segment.slope = Number(rdslope)/(goal.siru)
          if (segment.slope != 0) {
            segment.end[0] 
              = segment.sta[0] 
              + (segment.end[1] - segment.sta[1])/segment.slope
          } else {
            // Hack to handle tfin=null and inconsistent values.
            segment.end[0] = bu.BDUSK
            segment.end[1] = segment.sta[1]
          }
          segment.end[0] = Math.min(bu.BDUSK, segment.end[0])
          // Readjust the end value in case we clipped the date to BDUSK
          segment.end[1]
            = segment.sta[1]+segment.slope*(segment.end[0]-segment.sta[0])
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
          roads.push(segment);
        }
      }
      // Extract computed values for tfin, vfin and rfin
      var goalseg = roads[roads.length-1];
      
      // A final segment is added, ending 100 days after tfin
      var finalsegment = {
        sta: goalseg.end.slice(),
        end: goalseg.end.slice(),
        slope: 0, auto: br.RP.VALUE };
      finalsegment.end[0] = bu.daysnap(finalsegment.end[0]+100*bu.DIY*bu.SID);
      roads.push(finalsegment);

      //br.printRoad(roads)
      // Uluc: Does not seem necessary if the above extraction is correct
      //br.fixRoadArray( roads, br.RP.VALUE, true );
      return "";
    }


    var flad = null;     // Holds the flatlined datapoint if it exists
    function flatline() {
      flad = null;
      var now = goal.asof;
      var numpts = data.length;
      var tlast = data[numpts-1][0];
      var vlast = data[numpts-1][1];

      if (tlast > goal.tfin) return;
      var x = tlast; // x = the time we're flatlining to
      if (goal.yaw * goal.dir < 0) 
        x = Math.min(now, goal.tfin); // WEEN/RASH: flatline all the way
      else { // for MOAR/PHAT, stop flatlining if 2 red days in a row
        var prevcolor = null;
        var newcolor;
        while (x <= Math.min(now, goal.tfin)) { // walk forward from tlast
          newcolor = br.dotcolor( roads, goal, x, vlast );
          // done iff 2 reds in a row
          if (prevcolor===newcolor && prevcolor===bu.Cols.REDDOT) 
            break;
          prevcolor = newcolor;
          x += bu.SID; // or see padm.us/ppr
        };
        x = bu.arrMin([x, now, goal.tfin]);
        for (let i = 0; i < numpts; i++) {
          if (x == data[i][0])
            return;
        }
      }
      if (!aggvals.hasOwnProperty(x)) {
        var prevpt = data[numpts-1];
        flad = [x, vlast, "PPR", DPTYPE.FLATLINE, prevpt[0], prevpt[1], null];
        data.push(flad);
      }
    }

    /** Set any of {tmin, tmax, vmin, vmax} that don't have explicit
     * values. Duplicates pybrain setRange() behavior*/
    function setDefaultRange() {
      if (goal.tmin == null) goal.tmin = Math.min(goal.tini, goal.asof);
      if (goal.tmax == null) {
        // Make more room beyond the askrasia horizon if lots of data
        var years = Math.floor((goal.tcur - goal.tmin) / (bu.DIY*bu.SID))
        goal.tmax = bu.daysnap((1+years/2)*2*bu.AKH + goal.tcur);
      }
      if (goal.vmin != null && goal.vmax != null) {
        // both provided explicitly
        if  (goal.vmin == goal.vmax) {
          goal.vmin -= 1; goal.vmax += 1    // scooch away from each other
        } else if (goal.vmin >  goal.vmax) {
          let tmp = goal.vmin;
          goal.vmin = goal.vmax; goal.vmax = tmp //swap them
        }
        return
      }
      
      var PRAF = 0.015,
          a = br.rdf(roads, goal.tmin),
          b = br.rdf(roads, goal.tmax),
          d0 = data.filter(e=>(e[0] <= goal.tmax && e[0] >= goal.tmin)).map(e=>e[1]),
          mind = bu.arrMin(d0),
          maxd = bu.arrMax(d0),
          padding = Math.max(goal.lnw/3, (maxd-mind)*PRAF*2),
          minmin = mind - padding,
          maxmax = maxd + padding
      if (goal.monotone && goal.dir>0) {        // Monotone up so no extra padding
        minmin = bu.arrMin([minmin, a, b])         // below (the low) vini.
        maxmax = bu.arrMax([maxmax, a+goal.lnw, b+goal.lnw])
      } else if (goal.monotone && goal.dir<0) { // Monotone down so no extra padding
        minmin = bu.arrMin([minmin, a-goal.lnw, b-goal.lnw]) //   above (the high) vini.
        maxmax = bu.arrMax([maxmax, a, b])
      } else {
        minmin = bu.arrMin([minmin, a-goal.lnw, b-goal.lnw])
        maxmax = bu.arrMax([maxmax, a+goal.lnw, b+goal.lnw])
      }
      if (goal.plotall && goal.tmin<=goal.tini && goal.tini<=goal.tmax
          && allvals.hasOwnProperty(goal.tini)) {      // At tini, leave room
        minmin = Math.min(minmin, bu.arrMin(allvals[goal.tini].map(e=>e[0])))// for all non-agg'd
        maxmax = Math.max(maxmax, bu.arrMax(allvals[goal.tini].map(e=>e[0])))// datapoints.
      }
      if (goal.vmin == null && goal.vmax == null) {
        goal.vmin = minmin
        goal.vmax = maxmax
        if (goal.vmin == goal.vmax){
          goal.vmin -= 1; goal.vmax += 1
        } else if (goal.vmin > goal.vmax) {
          let tmp = goal.vmin
          goal.vmin = goal.vmax; goal.vmax = goal.vmin
        }
      } else if (goal.vmin == null) goal.vmin = (minmin < goal.vmax)?minmin:goal.vmax-1
      else if (goal.vmax == null) goal.vmax = (maxmax > goal.vmin)?maxmax:goal.vmin+1
    }

    // Sanity check a row of the road matrix; exactly one-out-of-three is null
    function validrow(r) {
      if (!bu.listy(r) || r.length != 3) return false
      return (r[0]==null && bu.nummy(r[1])  && bu.nummy(r[2]) ) ||
        (bu.nummy(r[0]) && r[1]==null && bu.nummy(r[2]) ) ||
        (bu.nummy(r[0]) && bu.nummy(r[1]) && r[2]==null)
    }

    // Stringified version of a road matrix row
    function showrow(row) {
      return JSON.stringify((row[0] == null)
                            ?row:[bu.formatDate(row[0]), row[1], row[2]])
    }

    const pchk = [
      ['deadline', (v)=>((6-24)*3600 <= v && v <= 6*3600),
       "outside 6am earlybird to 6am nightowl"],
      ['asof', (v)=>(v!=null), "can't be null! Tell support!"],
      ['asof', bu.torn, "isn't a valid timestamp"],
      ['tini', bu.timy, "isn't a valid timestamp"],
      ['vini', bu.nummy, "isn't numeric"],
      ['road', bu.listy, "(road matrix) isn't a list"],
      ['tfin', bu.torn, "isn't a valid timestamp"],
      ['vfin', bu.norn, "isn't numeric or null"],
      ['rfin', bu.norn, "isn't numeric or null"],
      ['runits', (v)=>bu.SECS.hasOwnProperty(v), "isn't a valid rate unit"],
      ['yaw', (v)=>(v==0||v==1||v==-1), "isn't in [0,-1,1]"],
      ['dir', (v)=>(v==1||v==-1), "isn't in -1,1]"],
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
      ['aggday', (v)=>br.AGGR.hasOwnProperty(v),
       "isn't one of max, sum, last, mean, etc"],
      ['plotall', bu.torf, "isn't boolean"],
      ['steppy', bu.torf, "isn't boolean"],
      ['rosy', bu.torf, "isn't boolean"],
      ['movingav', bu.torf, "isn't boolean"],
      ['aura', bu.torf, "isn't boolean"],
      ['yaxis', bu.stringy, "isn't a string"],
      ['yaxis', (v)=>(v.length<80), "string is too long\\n"],
      ['waterbuf', bu.sorn, "isn't a string or null"],
      ['waterbux', bu.stringy, "isn't a string"],
      ['hidey', bu.torf, "isn't boolean"],
      ['stathead', bu.torf, "isn't boolean"],
      ['imgsz', bu.nummy, "isn't numeric"],
      ['yoog', bu.stringy, "isn't a string"],
    ]

    /** Sanity check the input parameters. Return non-empty string if it fails. */
    function vetParams() {
      var s = (y => JSON.stringify(y)), i

      for (i = 0; i < pchk.length; i++) {
        var l = pchk[i]
        if (!(l[1](goal[l[0]]))) return `'${l[0]}' ${l[2]}: ${s(goal[l[0]])}`
      }

      var rd = goal.road
      for (i = 0; i < rd.length; i++)
        if (!validrow(rd[i]))
          return "Invalid road matrix row: "+showrow(rd[i])
      // At this point road is guaranteed to be a list of length-3 lists
      // I guess we don't mind a redundant final road row
      var mrd = rd.slice(1,rd.length-1)
      if (mrd.length != bu.deldups(mrd).length) {
        var prev = mrd[0] // previous row
        for (i = 1; i < mrd.length; i++) {
          if (bu.arrayEquals(mrd[i], prev))
            return "Road matrix has duplicate row: "+showrow(mrd[i])
          prev = mrd[i]
        }
        return "Road matrix duplicate row error! Tell support!" //seems unreachable
      }
      if (goal.kyoom && goal.odom)
        return "The odometer setting doesn't make sense for an auto-summing goal!"

      return "";
    }
    
    /** Process goal parameters. */
    function procParams() {

      // maps timestamps to most recent datapoint value
      goal.dtf = br.stepify(data)

      goal.road = br.fillroad(goal.road, goal)
      let rl = goal.road.length
      goal.tfin = goal.road[rl-1][0]
      goal.vfin = goal.road[rl-1][1]
      goal.rfin = goal.road[rl-1][2]
      // tfin, vfin, rfin are set in procRoad
      
      if (!bu.orderedq(goal.road.map(e=>e[0]))) {
        var parenerr = 
            "(Your goal date, goal "+(goal.kyoom?"total":"value")+
            ", and rate are inconsistent!\\n"+
            "Is your rate positive when you meant negative?\\n"+
            "Or is your goal "+(goal.kyoom?"total":"value")+
            " such that the implied goal date is in the past?)"
        return "Road dial error\\n" + parenerr
      }

      // rdf function is implemented in broad.js
      // rtf function is implemented in broad.js

      goal.stdflux = br.noisyWidth(roads, data.filter((d)=>(d[0]>=goal.tini)))
      goal.nw = (goal.noisy && goal.abslnw == null)
        ?br.autowiden(roads, goal, data, goal.stdflux):0
      
      goal.lnf =
        (goal.abslnw != null)?(x=>goal.abslnw)
        :br.genLaneFunc(roads, goal)
      
      flatline();

      if (goal.movingav) {
        // Filter data and produce moving average
        var dl = data.length;
        if (!(dl <= 1 || data[dl-1][0]-data[0][0] <= 0)) { 
        
          // Create new vector for filtering datapoints
          var newx = griddle(data[0][0], data[dl-1][0])
          JSON.stringify(newx)
          goal.filtpts = newx.map((d) => [d, ema(data, d)])
        } else goal.filtpts = [];
      } else goal.filtpts = [];
      
      goal.tcur = data[data.length-1][0];
      goal.vcur = data[data.length-1][1];

      goal.lnw = Math.max(goal.nw,goal.lnf( goal.tcur ));
      goal.safebuf = br.dtd(roads, goal, goal.tcur, goal.vcur);
      goal.tluz = goal.tcur+goal.safebuf*bu.SID;
      goal.delta = bu.chop(goal.vcur - br.rdf(roads, goal.tcur))
      goal.rah = br.rdf(roads, goal.tcur+bu.AKH)
      
      goal.dueby = [...Array(7).keys()]
        .map(i => [bu.dayify(goal.tcur+i*bu.SID),
                   br.limd(roads, goal, i),
                   br.lim(roads, goal, i)])
      var tmpdueby = bu.zip(goal.dueby)
      goal.dueby = bu.zip([tmpdueby[0], bu.monotonize(tmpdueby[1],goal.dir),
                      bu.monotonize(tmpdueby[2],goal.dir)])
      
      goal.safebump = br.lim(roads, goal, goal.safebuf)

      goal.rcur = br.rtf(roads, goal.tcur)*goal.siru  
      goal.ravg = br.tvr(goal.tini, goal.vini, goal.tfin,goal.vfin,null)*goal.siru
      goal.cntdn = Math.ceil((goal.tfin-goal.tcur)/bu.SID)
      goal.lane = bu.clip(br.lanage(roads, goal, goal.tcur,goal.vcur), -32768, 32767)
      goal.color = CNAME[br.dotcolor(roads, goal, goal.tcur,goal.vcur)]
      goal.loser = br.isLoser(roads, goal, data, goal.tcur, goal.vcur)
      goal.sadbrink = (goal.tcur-bu.SID>goal.tini)
        &&(br.dotcolor(roads,goal,goal.tcur-bu.SID,goal.dtf(goal.tcur-bu.SID))==bu.Cols.REDDOT)
      if (goal.safebuf <= 0) goal.tluz = goal.tcur
      if (goal.tfin < goal.tluz)  goal.tluz = bu.BDUSK
        
      setDefaultRange();
      return "";
    }
    function sumSet(rd, goal) {
      var y = goal.yaw, d = goal.dir, l = goal.lane, w = goal.lnw, dlt = goal.delta
      var MOAR = (y>0 && d>0), PHAT = (y<0 && d<0),
          WEEN = (y<0 && d>0), RASH = (y>0 && d<0)

      if (goal.error != "") {
        goal.statsum = " error:    "+goal.error+"\\n"; return
      }
      var rz = (bu.zip(goal.road))[2]
      var minr = bu.arrMin(rz), maxr = bu.arrMax(rz)
      if (Math.abs(minr) > Math.abs(maxr)) {
        var tmp = minr
        minr = maxr; maxr = tmp
      }
      goal.ratesum = 
        ((minr == maxr)?bu.shr(minr):"between "+bu.shr(minr)+" and "+bu.shr(maxr)) +
        " per "+bu.UNAM[goal.runits] + 
        ((minr != maxr)?" ("+"current: "+bu.shr(goal.rcur)
         +", average: " + bu.shr(goal.ravg)+')':"")

      // What we actually want is timesum and togosum (aka, progtsum & progvsum) 
      // which will be displayed with labels TO GO and TIME LEFT in the stats box and
      // will have both the absolute amounts remaining as well as the percents done 
      // as calculated here.
      var pt = bu.shn(bu.cvx(bu.daysnap(goal.tcur),
                             goal.tini,bu.daysnap(goal.tfin),
                             0,100, false), 1,1)
      var pv = bu.cvx(goal.vcur, goal.vini,goal.vfin,0,100,false)
      pv = bu.shn((goal.vini<goal.vfin)?pv:100 - pv, 1,1) // meant shn(n,1,2) here?

      if (pt==pv) goal.progsum = pt+"% done"
      else goal.progsum = pt+"% done by time -- "+pv+"% by value"

      var x, ybrStr;
      if (goal.cntdn < 7) {
        x = Math.sign(goal.rfin) * (goal.vfin - goal.vcur)
        ybrStr = "To go to goal: "+bu.shn(x,2,1)+"."
      } else {
        x = br.rdf(roads, goal.tcur+goal.siru) - br.rdf(roads, goal.tcur)
        ybrStr = "Yellow Brick Rd = "+bu.shns(x,2,1)+" / "+bu.UNAM[goal.runits]+"."
      }

      var ugprefix = false // debug mode: prefix yoog to graph title
      goal.graphsum = 
        ((ugprefix)?goal.yoog:"")
        + bu.shn(goal.vcur,3,1)+" on "+bu.shd(goal.tcur)+" ("
        + bu.splur(goal.numpts, "datapoint")+" in "
        + bu.splur(1+Math.floor((goal.tcur-goal.tini)/bu.SID),"day")+") "
        + "targeting "+bu.shn(goal.vfin,3,1)+" on "+bu.shd(goal.tfin)+" ("
        + bu.splur(parseFloat(bu.shn(goal.cntdn,1,1)), "more day")+"). "+ybrStr

      goal.deltasum = bu.shn(Math.abs(dlt),4,2)
        + ((dlt<0)?" below":" above")+" the centerline"
      var s
      if (w == 0)                    s = ""
      else if (y>0 && l>=-1 && l<=1) s = " and "+bu.sh1(w-dlt)+" to go till top edge"
      else if (y>0 && l>=2)          s = " and "+bu.sh1(dlt-w)+" above the top edge"
      else if (y>0 && l<=-2)         s = " and "+bu.sh1(-w-dlt)+" to go till bottom edge"
      else if (y<0 && l>=-1 && l<=1) s = " and "+bu.sh1(w-dlt)+" below top edge"
      else if (y<0 && l<=-2)         s = " and "+bu.sh1(-w-dlt)+" below bottom edge"
      else if (y<0 && l>1)           s = " and "+bu.sh1(dlt-w)+" above top edge"
      else                           s = ""
      goal.deltasum += s

      var c = goal.safebuf // countdown to derailment, in days
      var cd = bu.splur(c, "day")
      if (goal.kyoom) {
        if (MOAR) goal.limsum= bu.sh1sc(br.limd(roads, goal, c),  y)+" in "+cd
        if (PHAT) goal.limsum= bu.sh1sc(br.limd(roads, goal, c),  y)+" in "+cd
        if (WEEN) goal.limsum= bu.sh1sc(br.limd(roads, goal, 0),  y)+" today" 
        if (RASH) goal.limsum= bu.sh1sc(br.limd(roads, goal, 0),  y)+" today" 
      } else {
        if (MOAR) goal.limsum= bu.sh1sc(br.limd(roads, goal, c), y)+" in "+cd+" ("
          +bu.sh1c(br.lim(roads, goal, c), y)+")"
        if (PHAT) goal.limsum= bu.sh1sc(br.limd(roads, goal, c), y)+" in "+cd+" ("
          +bu.sh1c(br.lim(roads, goal, c), y)+")"
        if (WEEN) goal.limsum= bu.sh1sc(br.limd(roads, goal, 0), y)+" today ("
          +bu.sh1c(br.lim(roads, goal, 0), y)+")"    
        if (RASH) goal.limsum= bu.sh1sc(br.limd(roads, goal, 0), y)+" today ("
          +bu.sh1c(br.lim(roads, goal, 0), y)+")"    
      }
      if (y*d<0)      goal.safeblurb = "unknown days of safety buffer"
      else if (c>999) goal.safeblurb = "more than 999 days of safety buffer"
      else            goal.safeblurb = "~"+cd+" of safety buffer"

      if (goal.loser) {
        goal.headsum = "Officially off the yellow brick road"
        goal.lanesum = "officially off the road"
      } else if (w==0) {
        goal.headsum = "Coasting on a currently flat yellow brick road"
        goal.lanesum = "currently on a flat road"
      } else if (MOAR && l==1) {
        goal.headsum = "Right on track in the top lane of the yellow brick road"
        goal.lanesum = "in the top lane: perfect!"
      } else if (MOAR &&  l==2) {
        goal.headsum = "Sitting pretty just above the yellow brick road"
        goal.lanesum = "above the road: awesome!"
      } else if (MOAR &&  l==3) {
        goal.headsum = "Well above the yellow brick road with "+goal.safeblurb
        goal.lanesum = "well above the road: "+goal.safeblurb+"!"
      } else if (MOAR &&  l>3) {
        goal.headsum = "Way above the yellow brick road with "+goal.safeblurb
        goal.lanesum = "way above the road: "+goal.safeblurb+"!"
      } else if (MOAR &&  l==-1) {
        goal.headsum = "On track but in the wrong lane of the yellow brick road "
          +"and in danger of derailing tomorrow"  
        goal.lanesum = "in the wrong lane: could derail tomorrow!"
      } else if (MOAR &&  l<=-2) {
        goal.headsum = "Below the yellow brick road and will derail if still here "
          +"at the end of the day"
        goal.lanesum = "below the road: will derail at end of day!"
      } else if (PHAT &&  l==-1) {
        goal.headsum = "Right on track in the right lane of the yellow brick road"
        goal.lanesum = "in the right lane: perfect!"
      } else if (PHAT &&  l==-2) {
        goal.headsum = "Sitting pretty just below the yellow brick road"
        goal.lanesum = "below the road: awesome!"
      } else if (PHAT &&  l==-3) {
        goal.headsum = "Well below the yellow brick road with "+goal.safeblurb
        goal.lanesum = "well below the road: "+goal.safeblurb+"!"
      } else if (PHAT &&  l<-3) {
        goal.headsum = "Way below the yellow brick road with "+goal.safeblurb
        goal.lanesum = "way below the road: "+goal.safeblurb+"!"
      } else if (PHAT &&  l==1) {
        goal.headsum = "On track but in the wrong lane of the yellow brick road "
          +"and in danger of derailing tomorrow"
        goal.lanesum = "in the wrong lane: could derail tomorrow!"
      } else if (PHAT &&  l>=2) {
        goal.headsum = "Above the yellow brick road and will derail if still here "
          +"at the end of the day"
        goal.lanesum = "above the road: will derail at end of day!"
      } else if (l==0) {
        goal.headsum = "Precisely on the centerline of the yellow brick road"
        goal.lanesum = "precisely on the centerline: beautiful!"
      } else if (l==1) {
        goal.headsum = "In the top lane of the yellow brick road"
        goal.lanesum = "in the top lane"
      } else if (l==-1) {
        goal.headsum = "In the bottom lane of the yellow brick road"
        goal.lanesum = "in the bottom lane"
      } else if (l>1) {
        goal.headsum = "Above the yellow brick road"
        goal.lanesum = "above the road"
      } else if (l<-1) {
        goal.headsum = "Below the yellow brick road"
        goal.lanesum = "below the road"
      }
      goal.titlesum
        = bu.toTitleCase(CNAME[br.dotcolor(roads, goal, goal.tcur, goal.vcur)]) + ". "
        + "bmndr.com/"+goal.yoog+" is " + goal.lanesum
        + ((y*d>0)?" (safe to stay flat for ~"+cd+")":"")

      goal.statsum =
        " progress: "+bu.shd(goal.tini)+"  "
        +((data == null)?"?":bu.sh1(goal.vini))+"\\n"
        +"           "+bu.shd(goal.tcur)+"  "+bu.sh1(goal.vcur)
        +"   ["+goal.progsum+"]\\n"
        +"           "+bu.shd(goal.tfin)+"  "+bu.sh1(goal.vfin)+"\\n"
        +" rate:     "+goal.ratesum+"\\n"
        +" lane:     " +((Math.abs(l) == 666)?"n/a":l)
        +" ("+goal.lanesum+")\\n"
        +" safebuf:  "+goal.safebuf+"\\n"
        +" delta:    "+goal.deltasum+"\\n"
        +" "
      if   (y==0)     goal.statsum += "limit:    "
      else if (y<0)   goal.statsum += "hard cap: "
      else            goal.statsum += "bare min: "
      goal.statsum += goal.limsum+"\\n"
    }
    
    function getNumParam(p, n, dflt) { return (p.hasOwnProperty(n))?Number(p[n]):dflt }
    function getBoolParam(p, n, dflt) { return (p.hasOwnProperty(n))?p[n]:dflt }
    function getStrParam(p, n, dflt) { return (p.hasOwnProperty(n))?p[n]:dflt }

    /** Initiates reprocessing of a newly changed road, recomputing
     * associated goal stats and internal details.*/
    this.reloadRoad = function() {
      //console.debug("id="+curid+", reloadRoad()")
      var error = procParams()
      
      if (error != "") return error
      
      sumSet(roads, goal)
        
      goal.fullroad = goal.road.slice()
      goal.fullroad.unshift( [goal.tini, goal.vini, 0, 0] )
      if (goal.error == "") {
        goal.pinkzone = [[goal.asof,br.rdf(roads, goal.asof),0]]
        goal.road.forEach(
          function(r) {
            if (r[0] > goal.asof && r[0] < goal.asof+bu.AKH) {
              goal.pinkzone.push([r[0], r[1], null]);
            }
          }
        )
        goal.pinkzone.push([goal.asof+bu.AKH, br.rdf(roads, goal.asof+bu.AKH),null])
        goal.pinkzone = br.fillroadall(goal.pinkzone, goal)
      }
      
      // Generate the aura function now that the flatlined
      // datapoint is also computed.
      if (goal.aura) {
        var adata = data.filter((e)=>(e[0]>=goal.tmin))
        var fdata = br.gapFill(adata)
        goal.auraf = br.smooth(fdata)
      } else goal.auraf = (e)=>0

      return ""
    }

    var stats = {};

    /** Process goal details */
    function genStats( p, d, tm=null ) {
      //console.debug("genStats: id="+curid+", "+p.yoog)

      try {
        // start the clock immediately
        if (tm == null) tm = moment.utc().unix()

        legacyIn( p )
        initGlobals()
        goal.proctm = tm
        data = stampIn(p, d)

        // make sure all supplied params are recognized 
        for (let prop in p) {
          if (p.hasOwnProperty(prop)) {
            if (!pin.hasOwnProperty(prop) && (!pig.includes(prop)))
              goal.error += "Unknown param: "+prop+"="+p[prop]+","
            else goal[prop] = p[prop]
          }
        }

        // Process and extract various parameters that are independent of road and data
        // maybe just default to aggday=last; no such thing as aggday=null
        if ( !p.hasOwnProperty('aggday')) p.aggday = (goal.kyoom)?"sum":"last"
        
        goal.siru = bu.SECS[p.runits]
        goal.horizon = goal.asof+bu.AKH
        // Save initial waterbuf value for comparison in bgraph.js
        goal.waterbuf0 = goal.waterbuf
      
        // Append final segment to the road array. These values will be
        // reextracted after filling in road in procParams
        if (bu.listy(goal.road)) goal.road.push([goal.tfin, goal.vfin, goal.rfin])
        if (goal.error == "") goal.error = vetParams()
        if (goal.error == "") goal.error = procData()
      
        // Extract road infor into our internal format consisting of road segments:
        // [ [startt, startv], [endt, endv], slope, autofield]
        if (goal.error == "") goal.error = procRoad( p.road )
        if (goal.error == "") goal.error = self.reloadRoad()

        computeRosy()
        
      } finally {
        // Generate beebrain stats (use getStats tp retrieve)
        stats = Object.assign({}, pout)
        for (let prop in stats) stats[prop] = goal[prop]
        stampOut(stats)
        legacyOut(stats)
      }
    }

    /** Returns an object with pre-computed goal statistics, summaries
     * and other details.*/
    this.getStats = function() { return bu.extend({}, stats) }

    /** Sets a new road object for beebrain. Should be followed by a
     * call to {@link beebrain#reloadRoad reloadRoad()} to perform a
     * recomputation of goal stats. Used by the road editor
     * implemented by the {@link bgraph} module.*/
    this.setRoadObj = function( newroad ) {
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
    
    // -----------------------------------------------------------
    // ----------------- BEEBRAIN OBJECT EXPORTS ------------------

    /** beebrain object ID for the current instance */
    this.id = curid
    
    // Static members for outside access
    this.DPTYPE = DPTYPE

    /** Holds the current array of road segments */
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
    /** Holds the flattened datapoint */
    this.flad = flad
    /** Holds an array of odometer resets */
    this.oresets = oresets
    /** Holds an array of derailments */
    this.derails = derails

    this.hollow = hollow
    this.hashtags = hashtags
  }

  return beebrain;
}));
