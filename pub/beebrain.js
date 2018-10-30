/*!
 * beebrain
 *
 * Dependencies: moment, Polyfit
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
;((function (root, factory) {
  'use strict'
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    console.log("beebrain: Using AMD module definition")
    define(['blib', 'broad', 'moment', 'polyfit'], factory)
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.    
    console.log("beebrain: Using CommonJS module.exports")
    module.exports = factory(require('blib'), require('broad'), 
                             require('moment'), require('polyfit'))
  } else {
    console.log("beebrain: Using Browser globals")
    root.beebrain = factory(root.blib, root.broad, root.moment, root.polyfit)
  }
})(this, function (bl, br, moment, Polyfit) {
  'use strict'

  // -------------------------------------------------------------
  // ------------------- FACTORY GLOBALS ---------------------
  /** Global counter to Generate unique IDs for multiple beebrain instances. */
  var gid = 1,

  pin = { // In Params: Graph settings and their defaults
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

  CNAME = { },

  /** Enum object to identify different types of datapoints. */
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

  AGGR = {
    last     : function(x) { return x[x.length-1] },
    first    : function(x) { return x[0] },
    min      : function(x) { return bl.arrMin(x) },
    max      : function(x) { return bl.arrMax(x) },
    truemean : function(x) { return bl.mean(x) },
    uniqmean : function(x) { return bl.mean(bl.deldups(x)) },
    mean     : function(x) { return bl.mean(bl.deldups(x)) },
    median   : function(x) { return bl.median(x) },
    mode     : function(x) { return bl.mode(x) },
    trimmean : function(x) { return bl.mean(x) }, // Uluc: did not bother 
    sum      : function(x) { return bl.sum(x) },
    jolly    : function(x) { return (x.length > 0)?1:0 },
    binary   : function(x) { return (x.length > 0)?1:0 },
    nonzero  : bl.nonzero,
    triangle : function(x) { return bl.sum(x)*(bl.sum(x)+1)/2 },
    square   : function(x) { return Math.pow(bl.sum(x),2) },
    clocky   : function(x) { return bl.clocky(x) /*sum of pair diff.*/ },
    count    : function(x) { return x.length /* number of datapoints*/ }
  },

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
    console.debug("beebrain constructor ("+gid+"): "); console.log(bbin);
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
    goal.horizon = goal.asof+bl.AKH;
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
      console.log()
      if (!Array.isArray(row)) return row
      if (row.length <= 3) return row
      return row.slice(0,3)
    }

    /** Last in genStats, filter params for backward compatibility */
    function legacyOut(p) {
      p.fullroad = p.fullroad.map( r=>rowfix(r) )
      p['road']     = p['fullroad']
      if (p['error']) {
        p['gldt'] = bl.dayify(goal.tfin)
        p['goal'] = goal.vfin
        p['rate'] = goal.rfin*goal.siru
      } else {
        //p['gldt'] = p['fullroad'][-1][0]
        //p['goal'] = p['fullroad'][-1][1]
        //p['rate'] = p['fullroad'][-1][2]
      }
      p['tini'] = bl.dayify(goal.tini)
      p['vini'] = goal.vini
      p['tfin'] = bl.dayify(goal.tfin)
      p['vfin'] = goal.vfin
      p['rfin'] = goal.rfin*goal.siru
    }

    /** Initialize various global variables before use */
    function initGlobals() {
      CNAME[bl.Cols.GRNDOT] = "green",
      CNAME[bl.Cols.BLUDOT] = "blue",
      CNAME[bl.Cols.ORNDOT] = "orange",
      CNAME[bl.Cols.REDDOT] = "red",
      CNAME[bl.Cols.BLCK]   = "black" 
  
      iRoad = []
      aggdata = []
      flad = null
      fuda = []
      allvals = {}
      aggval = {}
      goal = {}
      goal.nw = 0
      goal.siru = null
      oresets = []

      // All the in and out params are also global variables!
      var prop;
      for (prop in pin) {
        if (pin.hasOwnProperty(prop))
          goal[prop] = pin[prop]
      }
      for (prop in pout) {
        if (pout.hasOwnProperty(prop))
          goal[prop] = pout[prop]
      }
    }

    function parserow(row) {
      if (!Array.isArray(row) || row.length != 3) return row
      return [bl.dayparse(row[0]), row[1], row[2]]
    }

    // Helper function for stampOut
    function dayifyrow( row ) {
      if (row.length < 1) return row
      var newrow = row.slice()
      newrow[0] = bl.dayify(row[0])
      return newrow
    }

    /** Processes fields with timestamps in the input */
    function stampIn( p,d ) {
      if (p.hasOwnProperty('asof')) p.asof = bl.dayparse(p.asof)
      if (p.hasOwnProperty('tini')) p.tini = bl.dayparse(p.tini)
      if (p.hasOwnProperty('tfin')) p.tfin = bl.dayparse(p.tfin)
      if (p.hasOwnProperty('tmin')) p.tmin = bl.dayparse(p.tmin)
      if (p.hasOwnProperty('tmax')) p.tmax = bl.dayparse(p.tmax)
      if (p.hasOwnProperty('road')) p.road = p.road.map(parserow)

      // Stable-sort by timestamp before dayparsing the timestamps
      // because if the timestamps were actually given as unixtime
      // then dayparse works like dayfloor and we lose fidelity.
      var numpts = d.length
      return d
        .sort(function(a,b){return (a[0]!== b[0])?(a[0]-b[0]):(a[3]-b[3]);})
        .map(function(r,i) {return [bl.dayparse(r[0]),r[1],r[2],i,r[1]];})
    }

    /** Convert unixtimes back to daystamps */
    function stampOut( p ) {
      p['fullroad'] = p['fullroad'].map(dayifyrow)
      p['pinkzone'] = p['pinkzone'].map(dayifyrow)
      p['tluz'] = bl.dayify(p['tluz'])
      p['tcur'] = bl.dayify(p['tcur'])
      p['tdat'] = bl.dayify(p['tdat'])
    }

    // Helper function for Exponential Moving Average; returns
    // smoothed value at x.  Very inefficient since we recompute
    // the whole moving average up to x for every point we want to
    // plot.
    function ema(d, x) {
      // The Hacker's Diet recommends 0.1 Uluc had .0864
      // http://forum.beeminder.com/t/control-exp-moving-av/2938/7
      // suggests 0.25
      var KEXP = .25/bl.SID; 
      if (goal.yoog==='meta/derev') KEXP = .03/bl.SID;  //.015 for meta/derev
      if (goal.yoog==='meta/dpledge') KEXP = .03/bl.SID;// .1 jagged
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
      return bl.linspace(a, b, Math.floor(bl.clip((b-a)/(bl.SID+1), 40, 2000)));
    }

    // Function to generate samples for the Butterworth filter
    function griddle(a, b, maxcnt = 6000) {
      return bl.linspace(a, b, Math.floor(bl.clip((b-a)/(bl.SID+1), 
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
      var n = Math.floor((end-start)/bl.SID);
      var out = Array(n), i, j = 0, t = start;
      for (i = 0; i < d.length-1; i++) {
        var den = (d[i+1][0]-d[i][0]);
        while (t <= d[i+1][0]) {
          out[j] = [t,interp(d[i][1], d[i+1][1], (t-d[i][0])/den)];
          j++; t += bl.SID;
        }
      }
      return out;
    }

    // Return a pure function that fits the data smoothly, used by grAura
    function smooth(data) {
      var SMOOTH = (data[0][0] + data[data.length-1][0])/2;
      var dz = bl.zip(data);
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
        br.odomify(aggdata);
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
            ind = bl.accumulate(vl.map(dval)).indexOf(v);
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
              allvals[ct] = bl.accumulate(vlv).map(function(e,i){
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
          allvals[ct] = bl.accumulate(vlv).map(function(e,i){
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
      var nk = rdData.length;
      var firstsegment;

      firstsegment = {
        sta: [bl.dayparse(goal.tini), Number(goal.vini)],
        slope: 0, auto: br.RP.SLOPE };
      firstsegment.end = firstsegment.sta.slice();
      firstsegment.sta[0] = bl.daysnap(firstsegment.sta[0]-100*bl.DIY*bl.SID);
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
          segment.end[0] = Math.min(bl.BDUSK, segment.end[0]);
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
      var goalseg = roads[roads.length-1];
      goal.tfin = goalseg.end[0];
      goal.vfin = goalseg.end[1];
      goal.rfin = goalseg.slope;
      var finalsegment = {
        sta: goalseg.end.slice(),
        end: goalseg.end.slice(),
        slope: 0, auto: br.RP.VALUE };
      finalsegment.end[0] = bl.daysnap(finalsegment.end[0]+100*bl.DIY*bl.SID);
      roads.push(finalsegment);

      br.fixRoadArray( roads );

      iRoad = br.copyRoad( roads );
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
          newcolor = br.dotcolor( roads, goal, x, vlast );
          // done iff 2 reds in a row
          if (prevcolor===newcolor && prevcolor===bl.Cols.REDDOT) 
            break;
          prevcolor = newcolor;
          x += bl.SID; // or see padm.us/ppr
        };
        x = bl.arrMin([x, now, goal.tfin]);
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
      if (goal.tmin >= goal.asof - bl.SID) goal.tmin -= bl.SID;
      if (goal.tmax == null) {
        // Make more room beyond the askrasia horizon if lots of data
        var years = (goal.tcur - goal.tmin) / (bl.DIY*bl.SID);
        goal.tmax = bl.daysnap((1+years/2)*2*bl.AKH + goal.tcur);
      }
    }

    function procParams( p ) {

      // maps timestamps to most recent datapoint value
      goal.dtf = br.stepify(aggdata)

      goal.road = br.fillroad(goal.road, goal)

      // tfin, vfin, rfin are set in procRoad
      
      // TODO: Implement road dial error in beebrain

      // rdf function is implemented above

      // rtf function is implemented above

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
        = br.noisyWidth(roads, aggdata
                     .filter(function(d){return d[0]>=goal.tini;}));
      goal.nw = (goal.noisy && goal.abslnw == null)
        ?br.autowiden(roads, goal, aggdata, goal.dflux):0;
      goal.lnw = Math.max(goal.nw,br.lnfraw( iRoad, goal, goal.tcur ));

      goal.safebuf = br.dtd(roads, goal, goal.tcur, goal.vcur);
      goal.tluz = goal.tcur+goal.safebuf*bl.SID;
      goal.delta = bl.chop(goal.vcur - br.rdf(roads, goal.tcur))
      goal.rah = br.rdf(roads, goal.tcur+bl.AKH)

      goal.rcur = br.rtf(roads, goal.tcur)*goal.siru  
      goal.ravg = br.tvr(goal.tini, goal.vini, goal.tfin,goal.vfin,null)*goal.siru
      goal.cntdn = Math.ceil((goal.tfin-goal.tcur)/bl.SID)
      goal.lane = bl.clip(br.lanage(roads, goal, goal.tcur,goal.vcur), -32768, 32767)
      goal.color = CNAME[br.dotcolor(roads, goal, goal.tcur,goal.vcur)]

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

      // make sure all supplied params are recognized 
      for (var prop in p) {
        if (p.hasOwnProperty(prop)) {
          if (!pin.hasOwnProperty(prop) && (!pig.includes(prop)))
            goal.error += "Unknown param: "+prop+"="+p[prop]+","
          else goal[prop] = p[prop]
        }
      }
      if ( !p.hasOwnProperty('aggday')) {
        if (goal.kyoom) p.aggday = "sum"
        else p.aggday = "last"
      }

      goal.horizon = goal.asof+bl.AKH

      goal.siru = bl.SECS[p.runits]
      goal.road.push([goal.tfin, goal.vfin, goal.rfin])
      
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

      goal.fullroad = goal.road.slice()

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
    // ----------------- BEEBRAIN OBJECT EXPORTS ------------------

    function getStats() { return Object.assign({}, stats) }

    /** beebrain object ID for the current instance */
    self.id = 1
    self.getStats = getStats
  };

  return beebrain;
}));
