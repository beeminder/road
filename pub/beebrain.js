/*!
 * beebrain
 *
 * Dependencies: moment, butil, broad
 * 
 * Javascript implementation of beebrain, provided as a UMD
 * module. Provides a "beebrain" function, which can be used to
 * construct independent beebrain objects each with their unique
 * ID. The constructor accepts a "bb" object as an initial beebrain
 * file input.
 *
 * The following member variables and methods are exported within
 * constructed objects:
 *
 *  id         : beebrain instance ID 
 *  getStats() : return stats object for beebrain output
 *
 * Copyright © 2017 Uluc Saranli
 */
((function (root, factory) {
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
    module.exports = factory(require('moment'), require('butil'), 
                             require('broad'))
  } else {
    //console.log("beebrain: Using Browser globals")
    root.beebrain = factory(root.moment, root.butil, root.broad)
  }
})(this, function (moment, bu, br) {
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
    noisy    : false,// Compute road width based on data, not just road rate
    integery : false,// Whether vals are necessarily integers (used in limsum)  
    monotone : false,// Whether data is necessarily monotone (used in limsum) 
    aggday   : null, // sum/last/first/min/max/mean/median/mode/trimmean/jolly
    plotall  : true, // Plot all the points instead of just the aggregated point
    steppy   : false,// Join dots with purple steppy-style line
    rosy     : false,// Show the rose-colored dots and connecting line
    movingav : false,// Show moving average line superimposed on the data
    aura     : false,// Show blue-green/turquoise aura/swath
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

  /** Enum object to identify different types of datapoints. */
  DPTYPE = {
    AGGPAST:0, AGGFUTURE:1, RAWPAST:2, RAWFUTURE:3, FLATLINE:4, HOLLOW: 5, DERAIL: 6
  },

  /** Enum object to identify error types. */
  ErrType = { NOBBFILE:0, BADBBFILE:1  },

  /** Enum object to identify error types. */
  ErrMsgs = [ "Could not find goal file.", "Bad goal file." ],

  /** Type of the last error */
  LastError = null,

  PRAF  = .015,    // Fraction of plot range that the axes extend beyond

  // ----------------- Beeminder Goal utilities ----------------------

  /** Version of fillroad that assumes tini/vini is the first row of road */
  //fillroadall = function(road) {
  //(tini, vini) = (road[0][0], road[0][1])
  //road = road[1:]
  //road = [(t, v, r if r is None else r/siru) for (t,v,r) in road]
  //road = foldlist(nextrow, (tini, vini, 0, 0), road)[1:]
  //return [(tini, vini, 0, 2)] + [(t, v, r*siru, n) for (t,v,r,n) in road]
  //},
  // -------------------------------------------------------------
  // ------------------- BEEBRAIN CONSTRUCTOR ---------------------
  /** beebrain constructor. This is returned once the wrapper function
   is called. The constructor itself fills self with exported
   functions and member variables. The argument is expected to include
   the contents of the BB file as a javascript object.*/
  beebrain = function( bbin ) {
    //console.debug("beebrain constructor ("+gid+"): ");
    var self = this,
        curid = gid
    gid++
    
    // Make a new copy of the input to prevent overwriting
    bbin = bu.extend({}, bbin, {})
      
    // Private variables holding goal, road and datapoint info
    var 
    roads = [],      // Holds the current road matrix

    goal = {},       // Holds loaded goal parameters
    alldata = [],    // Holds the entire set of data points
    data = [],    // Holds past aggregated data
    fuda = [],       // Holds all future data
    undoBuffer = [], // Array of previous roads for undo
    redoBuffer = [], // Array of future roads for redo
    oresets = [],    // Odometer resets
    allvals = {},    // Dictionary holding values for each timestamp
    aggval = {},     // Dictionary holding aggregated value for each timestamp
    worstval = {},   // Maps timestamp to min/max (depending on yaw) value that day
    derails = [],    // List of derail timestamps
    hashhash = {}    // Maps timestamp to sets of hashtags to display on the graph
    
    // Initialize goal with sane values
    goal.yaw = +1; goal.dir = +1;
    goal.tcur = 0; goal.vcur = 0;
    var now = moment.utc();
    now.hour(0); now.minute(0); now.second(0); now.millisecond(0);
    goal.asof = now.unix();
    goal.horizon = goal.asof+bu.AKH;
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
    
    /** Helper function for legacyOut */
    function rowfix(row) {
      if (!Array.isArray(row)) return row
      if (row.length <= 3) return row
      return row.slice(0,3)
    }

    /** Last in genStats, filter params for backward compatibility */
    function legacyOut(p) {
      p.fullroad = p.fullroad.map( r=>rowfix(r) )
      p['road']     = p['fullroad']
      if (p['error']) {
        p['gldt'] = bu.dayify(goal.tfin)
        p['goal'] = goal.vfin
        p['rate'] = goal.rfin*goal.siru
      } else {
        var len = p['fullroad'].length
        p['gldt'] = p['fullroad'][len-1][0]
        p['goal'] = p['fullroad'][len-1][1]
        p['rate'] = p['fullroad'][len-1][2]
      }
      p['tini'] = bu.dayify(goal.tini)
      p['vini'] = goal.vini
      p['tfin'] = bu.dayify(goal.tfin)
      p['vfin'] = goal.vfin
      p['rfin'] = goal.rfin*goal.siru
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
      aggval = {}
      worstval = {}

      goal = {}
      goal.nw = 0
      goal.siru = null
      oresets = []
      derails = []
      hashhash = {}

      // All the in and out params are also global variables!
      var prop;
      for (prop in pout) {
        if (pout.hasOwnProperty(prop))
          goal[prop] = pout[prop]
      }
      for (prop in pin) {
        if (pin.hasOwnProperty(prop))
          goal[prop] = pin[prop]
      }
    }

    function parserow(row) {
      if (!Array.isArray(row) || row.length != 3) return row
      return [bu.dayparse(row[0]), row[1], row[2]]
    }

    // Helper function for stampOut
    function dayifyrow( row ) {
      if (row.length < 1) return row
      var newrow = row.slice()
      newrow[0] = bu.dayify(row[0])
      return newrow
    }

    /** Processes fields with timestamps in the input */
    function stampIn( p,d ) {
      if (p.hasOwnProperty('asof')) p.asof = bu.dayparse(p.asof)
      if (p.hasOwnProperty('tini')) p.tini = bu.dayparse(p.tini)
      if (p.hasOwnProperty('tfin')) p.tfin = bu.dayparse(p.tfin)
      if (p.hasOwnProperty('tmin')) p.tmin = bu.dayparse(p.tmin)
      if (p.hasOwnProperty('tmax')) p.tmax = bu.dayparse(p.tmax)
      if (p.hasOwnProperty('road'))
        if (bu.listy(p.road)) p.road = p.road.map(parserow)

      // Stable-sort by timestamp before dayparsing the timestamps
      // because if the timestamps were actually given as unixtime
      // then dayparse works like dayfloor and we lose fidelity.
      var numpts = d.length
      return d
        .map(function(r,i) {return [bu.dayparse(r[0]),r[1],r[2],i,r[1]];})   // Store indices
        .sort(function(a,b){return (a[0]!== b[0])?(a[0]-b[0]):(a[3]-b[3]);}) 
    }

    /** Convert unixtimes back to daystamps */
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
      var KEXP = .25/bu.SID; 
      if (goal.yoog==='meta/derev') KEXP = .03/bu.SID;  //.015 for meta/derev
      if (goal.yoog==='meta/dpledge') KEXP = .03/bu.SID;// .1 jagged
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
      return bu.linspace(a, b, Math.floor(bu.clip((b-a)/(bu.SID+1), 40, 2000)));
    }

    // Function to generate samples for the Butterworth filter
    function griddle(a, b, maxcnt = 6000) {
      return bu.linspace(a, b, Math.floor(bu.clip((b-a)/(bu.SID+1), 
                                            Math.min(600, /*plotbox.width*/ 640),
                                            maxcnt)));
    }

    function procData() { 

      // TODO: Data sanity checka
      // TODO: hashtags
      // TODO: derails
      
      // Coming here, we assume that data has entries with
      // the following format:
      // [t, v, comment, original index, v(original)]
      //
      if (goal.odom) {
        oresets = data.filter(function(e){ return (e[1]==0);}).map(e=>(e[0]));
        br.odomify(data);
      }

      var numpts = data.length, i;
      var nonfuda = data.filter(function(e){
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
            ind = bu.accumulate(vl.map(dval)).indexOf(v);
          else ind = vl.map(dval).indexOf(v);
          if (ind < 0) return [goal.aggday, null];
          else return [vl[ind][1]+" ("+goal.aggday+")", vl[ind][2]];
        }
      };
      // Aggregate datapoints and handle kyoom
      var newpts = [];
      var ct = data[0][0], 
          vl = [[data[0][1],data[0][2],data[0][4]]], vlv;
      var pre = 0, prevpt, ad, cmt, ptinf;
      for (i = 1; i < data.length; i++) {
        if (data[i][0] == ct) {
          vl.push([data[i][1],data[i][2],data[i][4]]);
        } else {
          vlv = vl.map(dval);
          ad = br.AGGR[goal.aggday](vlv);
          if (newpts.length > 0) prevpt = newpts[newpts.length-1];
          else prevpt = [ct, ad+pre];
          //pre remains 0 for non-kyoom
          ptinf = aggpt(vl, ad);
          newpts.push([ct, pre+ad, ptinf[0], (ct <= goal.asof)
                       ?DPTYPE.AGGPAST:DPTYPE.AGGFUTURE, 
                       prevpt[0], prevpt[1], ptinf[1]]);
          if (goal.kyoom) {
            if (goal.aggday === "sum") {
              allvals[ct] = bu.accumulate(vlv).map(function(e,i){
                return [e+pre, vl[i][1], vl[i][2]];});
            } else allvals[ct] = vl.map(function(e) {
              return [e[0]+pre, e[1], e[2]];});
            aggval[ct] = [pre+ad, ptinf[0], ptinf[1]];
            pre += ad; 
          } else {
            allvals[ct] = vl;
            aggval[ct] = [ad, ptinf[0], ptinf[1]];
          }

          ct = data[i][0];
          vl = [[data[i][1],data[i][2],data[i][4]]];
        }
      }
      vlv = vl.map(dval);
      ad = br.AGGR[goal.aggday](vlv);
      if (newpts.length > 0) prevpt = newpts[newpts.length-1];
      else prevpt = [ct, ad+pre];
      ptinf = aggpt(vl, ad);
      newpts.push([ct, ad+pre, ptinf[0], 
                   (ct <= goal.asof)?DPTYPE.AGGPAST:DPTYPE.AGGFUTURE,
                   prevpt[0], prevpt[1], ptinf[1]]);
      if (goal.kyoom) {
        if (goal.aggday === "sum") {
          allvals[ct] = bu.accumulate(vlv).map(function(e,i){
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
      fuda = newpts.filter(function(e){return e[0]>goal.asof;});
      data = newpts.filter(function(e){return e[0]<=goal.asof;});
      if (!goal.plotall) goal.numpts = data.length;
      var gfd = br.gapFill(data)
      var gfdv = gfd.map(e => (e[1]))
      if (data.length > 0) goal.mean = bu.mean(gfdv)
      if (data.length > 1) {
        goal.meandelt = bu.mean(bu.partition(gfdv,2,1).map(e => (e[1] - e[0])))
      }
      goal.tdat = data[data.length-1][0] // tstamp of last ent. datapoint pre-flatline
      return "";
    }

    /** Extracts road segments from the supplied road matrix in the *
     input parameters as well as tini and vini. Upon compeltion, the *
     'roads' variable contains an array of road segments as javascript
     objects in the following format:

     {sta: [startt, startv], end: [endt, endv], slope, auto}

     Initial and final flat segments are added from starting days
     before tini and ending after 100 days after tfin.
    */
    function procRoad( json ) {
      roads = [];
      var rdData = json;
      var nk = rdData.length;
      var firstsegment;

      // First segment starts from [tini-100days, vini], ends at [tini, vini]
      firstsegment = {
        sta: [bu.dayparse(goal.tini), Number(goal.vini)],
        slope: 0, auto: br.RP.SLOPE };
      firstsegment.end = firstsegment.sta.slice();
      firstsegment.sta[0] = bu.daysnap(firstsegment.sta[0]-100*bu.DIY*bu.SID);
      roads.push(firstsegment);

      for (var i = 0; i < nk; i++) {
        // Each segment i starts from the end of the previous segment
        // and continues until road[i], filling in empty fields in the
        // road matrix
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
          segment.end[0] = Math.min(bu.BDUSK, segment.end[0]);
          segment.auto = br.RP.DATE;
        } else if (rdvalue == null) {
          segment.end = [rddate, 0];
          segment.slope = Number(rdslope)/(goal.siru);
          segment.end[1] = 
            segment.sta[1]
            +segment.slope*(segment.end[0]-segment.sta[0]);
          segment.auto = br.RP.VALUE;
        } else if (rdslope == null) {
          segment.end = [rddate, Number(rdvalue)];
          segment.slope = br.roadSegmentSlope(segment);
          segment.auto = br.RP.SLOPE;
        } 
        // Skip adding segment if it is earlier than the first segment
        if (segment.end[0] >= segment.sta[0]) {
          roads.push(segment);
        }
      }
      // Extract computed values for tfin, vfin and rfin
      var goalseg = roads[roads.length-1];
      goal.tfin = goalseg.end[0];
      goal.vfin = goalseg.end[1];
      goal.rfin = goalseg.slope;
      
      // A final segment is added, ending 100 days after tfin
      var finalsegment = {
        sta: goalseg.end.slice(),
        end: goalseg.end.slice(),
        slope: 0, auto: br.RP.VALUE };
      finalsegment.end[0] = bu.daysnap(finalsegment.end[0]+100*bu.DIY*bu.SID);
      roads.push(finalsegment);

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
        for (var i = 0; i < numpts; i++) {
          if (x == data[i][0])
            return;
        }
      }
      if (!aggval.hasOwnProperty(x)) {
        var prevpt = data[numpts-1];
        flad = [x, vlast, "PPR", DPTYPE.FLATLINE, prevpt[0], prevpt[1], null];
        data.push(flad);
      }
    }

    // Set any of {tmin, tmax, vmin, vmax} that don't have explicit values.
    function setDefaultRange() {
      if (goal.tmin == null) goal.tmin = Math.min(goal.tini, goal.asof);
      if (goal.tmin >= goal.asof - bu.SID) goal.tmin -= bu.SID;
      if (goal.tmax == null) {
        // Make more room beyond the askrasia horizon if lots of data
        var years = (goal.tcur - goal.tmin) / (bu.DIY*bu.SID);
        goal.tmax = bu.daysnap((1+years/2)*2*bu.AKH + goal.tcur);
      }
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
      return JSON.stringify(row)
    }

    // Sanity check the input parameters. Return non-empty string if it fails.
    function vetParams() {
      // I'm a bit too obsessed with fitting things in 80 cha
      var s = (y => JSON.stringify(y)), i

      if (!((6-24)*3600 <= goal.deadline <= 6*3600))
        return "'deadline' outside 6am earlybird to 6am nightowl: "       +s(goal.deadline)
      if (goal.asof == null)    return "'asof' can't be null! Tell support!"
      if (!bu.torn(goal.asof))  return "'asof' isn't a valid timestamp: "  +s(goal.asof)
      if (!bu.timy(goal.tini))  return "'tini' isn't a valid timestamp: "  +s(goal.tini)
      if (!bu.nummy(goal.vini)) return "'vini' isn't numeric: "            +s(goal.vini)
      if (!bu.listy(goal.road)) return "Road matrix ('road') isn't a list: "  +s(goal.road)
      for (i = 0; i < goal.road.length; i++)
        if (!validrow(goal.road[i])) return "Invalid road matrix row: "+showrow(goal.road[i])
      // At this point road is guaranteed to be a list of length-3 lists
      // I guess we don't mind a redundant final road row
      var mostroad = goal.road.slice(1,goal.road.length-1)
      if (mostroad.length != bu.deldups(mostroad).length) {
        var prev = mostroad[0] // previous row
        for (i = 1; i < mostroad.length; i++) {
          console.log(mostroad[i] + " " + prev)
          if (bu.arrayEquals(mostroad[i], prev))
            return "Road matrix has duplicate row: "+showrow(mostroad[i])
          prev = mostroad[i]
        }
        return "Road matrix duplicate row error! Tell support!" //seems unreachable
      }
      if (!bu.torn(goal.tfin))    return "'tfin' isn't a valid timestamp: " +s(goal.tfin)
      if (!bu.norn(goal.vfin))    return "'vfin' isn't numeric or null: "   +s(goal.vfin)
      if (!bu.norn(goal.rfin))    return "'rfin' isn't numeric or null: "   +s(goal.rfin)
      if (!bu.SECS.hasOwnProperty(goal.runits))
          return "Bad rate units ('runits'): "+s(goal.runits)
      if (!(goal.yaw==0 || goal.yaw==1 || goal.yaw==-1))
        return "'yaw' isn't in [0,-1,1]: "        +s(goal.yaw)
      if (!(goal.dir==1 || goal.dir==-1))
        return "'dir' isn't in [-1,1]: "          +s(goal.dir)
      if (!bu.norn(goal.tmin))    return "'tmin' isn't a number/timestamp: "+s(goal.tmin)
      if (!bu.torn(goal.tmax))    return "'tmax' isn't a valid timestamp: " +s(goal.tmax)
      if (!bu.norn(goal.vmin))    return "'vmin' isn't numeric or null: "   +s(goal.vmin)
      if (!bu.norn(goal.vmax))    return "'vmax' isn't numeric or null: "   +s(goal.vmax)
      if (!bu.torf(goal.kyoom))   return "'kyoom' isn't boolean: "          +s(goal.kyoom)
      if (!bu.torf(goal.odom))    return "'odom' isn't boolean: "           +s(goal.odom)
      if (!bu.norn(goal.abslnw))  return "'abslnw' isn't numeric or null: " +s(goal.abslnw)
      if (!bu.torf(goal.noisy))   return "'noisy' isn't boolean: "          +s(goal.noisy)
      if (!bu.torf(goal.integery))return "'integery' isn't boolean: "       +s(goal.integery)
      if (!bu.torf(goal.monotone))return "'monotone' isn't boolean: "       +s(goal.monotone)
      if (!br.AGGR.hasOwnProperty(goal.aggday))
        return "'aggday' = "+s(goal.aggday)+" isn't one of max, sum, last, mean, etc"
      if (!bu.torf(goal.plotall)) return "'plotall' isn't boolean: "       +s(goal.plotall)
      if (!bu.torf(goal.steppy))  return "'steppy' isn't boolean: "        +s(goal.steppy)
      if (!bu.torf(goal.rosy))    return "'rosy' isn't boolean: "          +s(goal.rosy)
      if (!bu.torf(goal.movingav))return "'movingav' isn't boolean: "      +s(goal.movingav)
      if (!bu.torf(goal.aura))    return "'aura' isn't boolean: "          +s(goal.aura)
      if (!bu.stringy(goal.yaxis))return "'yaxis' isn't a string: "        +s(goal.yaxis)
      if (goal.yaxis.length > 80) return "Y-axis label is too long:\n"     +goal.yaxis
      if (!bu.sorn(goal.waterbuf))return "'waterbuf' isn't string or null: "+s(goal.waterbuf)
      if (!bu.stringy(goal.waterbux)) return "'waterbux' isn't a string: "  +s(goal.waterbux)
      if (!bu.torf(goal.hidey))   return "'hidey' isn't boolean: "          +s(goal.hidey)
      if (!bu.torf(goal.stathead))return "'stathead' isn't boolean: "       +s(goal.stathead)
      if (!bu.nummy(goal.imgsz))  return "'imgsz' isn't numeric: "          +s(goal.imgsz)
      if (!bu.stringy(goal.yoog)) return "'yoog' isn't a string: "          +s(goal.yoog)
      if (goal.kyoom && goal.odom)
        return "The odometer setting doesn't make sense for an auto-summing goal!"
      return "";
    }
    
    function procParams( p ) {

      // Save initial waterbuf value for comparison
      goal.waterbuf0 = goal.waterbuf
      
      // maps timestamps to most recent datapoint value
      goal.dtf = br.stepify(data)

      goal.road = br.fillroad(goal.road, goal)
      
      // tfin, vfin, rfin are set in procRoad
      
      if (!bu.orderedq(goal.road.map(e=>e[0]))) {
        var parenerr = 
            "(Your goal date, goal "+(goal.kyoom?"total":"value")+
            ", and rate are inconsistent!\\n"+
            "Is your rate positive when you meant negative?\\n"+
            "Or is your goal "+(goal.kyoom?"total":"value")+
            " such that the implied goal date is in the past?)";
        return "Road dial error\\n" + parenerr
      }

      // rdf function is implemented in broad.js
      // rtf function is implemented in broad.js

      goal.stdflux 
        = br.noisyWidth(roads, data
                     .filter(function(d){return d[0]>=goal.tini;}));
      goal.nw = (goal.noisy && goal.abslnw == null)
        ?br.autowiden(roads, goal, data, goal.stdflux):0;
      
      flatline();

      if (goal.movingav) {
        // Filter data and produce moving average
        var dl = data.length;
        if (dl <= 1 || data[dl-1][0]-data[0][0] <= 0) 
          return "Insufficient data for moving average";
        
        // Create new vector for filtering datapoints
        var newx = griddle(data[0][0], data[dl-1][0]);
        JSON.stringify(newx)
        goal.filtpts 
          = newx.map(function(d) {return [d, ema(data, d)];});
      } else goal.filtpts = [];
      
      goal.tcur = data[data.length-1][0];
      goal.vcur = data[data.length-1][1];

      goal.lnw = Math.max(goal.nw,br.lnf( roads, goal, goal.tcur ));

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
      
      // TODO: Monotonize dueby

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
      var MOAR = (y>0 && d>0),
          PHAT = (y<0 && d<0),
          WEEN = (y<0 && d>0),
          RASH = (y>0 && d<0)

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
      //console.debug("genStats: id="+curid+", "+p.yoog)

      try {
        // start the clock immediately
        if (tm == null) tm = moment.utc().unix()

        legacyIn( p )
        initGlobals()
        goal.proctm = tm
        data = stampIn(p, d)
        
        // make sure all supplied params are recognized 
        for (var prop in p) {
          if (p.hasOwnProperty(prop)) {
            if (!pin.hasOwnProperty(prop) && (!pig.includes(prop)))
              goal.error += "Unknown param: "+prop+"="+p[prop]+","
            else goal[prop] = p[prop]
          }
        }

        // Process and extract various parameters that are independent of road and data
        // maybe just default to aggday=last; no such thing as aggday=null
        if ( !p.hasOwnProperty('aggday')) {
          if (goal.kyoom) p.aggday = "sum"
          else p.aggday = "last"
        }
        goal.siru = bu.SECS[p.runits]
        goal.horizon = goal.asof+bu.AKH
        
        // Append final segment to the road array. These values will be
        // reextracted after filling in road in procParams
        if (bu.listy(goal.road)) goal.road.push([goal.tfin, goal.vfin, goal.rfin])
      
        if (goal.error == "") goal.error = vetParams()
        if (goal.error == "") goal.error = procData()
      
        // TODO: SCHEDULED for removal
        // var vtmp
        // if (p.hasOwnProperty('tini'))  goal.tini = Number(p.tini)
        // else goal.tini = data[0][0]
        
        // if (allvals.hasOwnProperty(goal.tini)) {
        //   vtmp = (goal.plotall)
        //     ?allvals[goal.tini][0][0]:aggval[goal.tini][0]
        // } else vtmp = Number(p.vini)
        
        // if (p.hasOwnProperty('vini')) goal.vini = p.vini
        // else goal.vini = (goal.kyoom)?0:vtmp
        
        // Extract road infor into our internal format consisting of road segments:
        // [ [startt, startv], [endt, endv], slope, autofield]
        if (goal.error == "") goal.error = procRoad( p.road )
        if (goal.error == "") goal.error = procParams( p )
        
        // Abort on error
        if (goal.error != "") return
        
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
      
        // TODO: Implement opts.maxDataDays
        // Now that the flatlined datapoint is in place, we can
        // extract limited data
        //if (opts.maxDataDays < 0) {
        //alldataf = alldata.slice();
        //dataf = data.slice();
        //} else {
        //  alldataf = alldata.filter(function(e){
        //    return e[0]>(goal.asof-opts.maxDataDays*SID);});
        //  dataf = data.filter(function(e){
        //    return e[0]>(goal.asof-opts.maxDataDays*SID);});
        // }
        
        // Generate the aura function now that the flatlined
        // datapoint is also computed.
        if (goal.aura) {
          var adata = data.filter(function(e){return e[0]>=goal.tmin})
          var fdata = br.gapFill(adata)
          goal.auraf = br.smooth(fdata)
        } else
          goal.auraf = function(e){ return 0 }

      } finally {
        // Generate beebrain stats (use getStats tp retrieve)
        stats = Object.assign({}, pout)
        for (prop in stats) stats[prop] = goal[prop]
        stampOut(stats)
        legacyOut(stats)
      }
    }

    genStats( bbin.params, bbin.data )
    goal.graphurl = bu.BBURL
    goal.thumburl = bu.BBURL

    // -----------------------------------------------------------
    // ----------------- BEEBRAIN OBJECT EXPORTS ------------------

    function getStats() { return bu.extend({}, stats, {}) }

    /** beebrain object ID for the current instance */
    self.id = 1
    self.getStats = getStats
    self.roads = roads
    self.goal = goal
    self.data = data
    self.alldata = alldata
    self.fuda = fuda
    self.flad = flad
    self.oresets = oresets
    self.DPTYPE = DPTYPE
  };

  return beebrain;
}));
