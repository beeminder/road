;((function (root, factory) { // BEGIN PREAMBLE --------------------------------

'use strict'
if (typeof define === 'function' && define.amd) {
  // AMD. Register as an anonymous module.
  //console.log("broad: Using AMD module definition")
  define(['moment', 'Polyfit', 'butil'], factory)
} else if (typeof module === 'object' && module.exports) {
  // Node. Does not work with strict CommonJS, but
  // only CommonJS-like environments that support module.exports,
  // like Node.    
  //console.log("broad: Using CommonJS module.exports")
  module.exports = factory(require('./moment'), require('./polyfit'), 
                           require('./butil'))
} else {
  //console.log("broad: Using Browser globals")
  root.broad = factory(root.moment, root.Polyfit, root.butil)
}

})(this, function (moment, Polyfit, bu) { // END PREAMBLE -- BEGIN MAIN --------

'use strict'

const rnd = Math.round

/**
 * Javascript library of road utilities for beebrain, provided as a
 * UMD module. Returns a "broad" object, whose public members provide
 * a number of road related constants and functions. Does not hold any
 * internal state.
 *
 * The following member variables and methods are provided:
 *
 * Copyright © 2018 Uluc Saranli

 @requires moment
 @requires butil

 @exports broad
*/
var self = {}

self.rfin = 0 // Hack to implement skatesum
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
  trimmean : (x) => bu.mean(x), // Uluc: did not bother
  sum      : (x) => bu.sum(x),
  jolly    : (x) => x.length > 0 ? 1 : 0,
  binary   : (x) => x.length > 0 ? 1 : 0,
  nonzero  : bu.nonzero,
  triangle : (x) => bu.sum(x)*(bu.sum(x)+1)/2,
  square   : (x) => Math.pow(bu.sum(x),2),
  clocky   : bu.clocky, // sum of pair diff.
  count    : (x) => x.length, // number of datapoints
  kyshoc   : (x) => Math.min(2600, bu.sum(x)), // ad hoc, guineapigging
  //TODO: FIXHACK?: Introduced internal state for rfin for skatesum
  skatesum : (x) => Math.min(self.rfin, bu.sum(x)), // only count daily min
  cap1     : (x) => Math.min(1, bu.sum(x)), // for zedmango
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
    if (!bu.nearEq(rda[i].end[0], rdb[i].end[0], 10)) return false
    if (!bu.nearEq(rda[i].end[1], rdb[i].end[1], 10)) return false
    if (!bu.nearEq(rda[i].slope, rdb[i].slope, 1e-14)) return false
  }
  return true
}

/** Creates and returns a clone of the supplied road array */
self.copyRoad = (rd) => {
  var nr = [];
  for (let i = 0; i < rd.length; i++) {
    var s = {
      sta: rd[i].sta.slice(), end: rd[i].end.slice(),
      slope: rd[i].slope, auto: rd[i].auto }
    nr.push(s)
  }
  return nr
}

/** Finds index for the road segment containing the supplied x value */
self.findSeg = (rd, x, dir=0) => {
  var nums = rd.length-1, s = 0, e = nums, m
  if (x < rd[0].sta[0] || x > rd[nums].end[0]) return -1
  while (e-s > 1) { // Uses binary search
    m = Math.floor((s+e)/2)
    if (rd[m].sta[0] <= x) s = m
    else e = m
  }
  if ((x >= rd[e].sta[0]) && (x < rd[e].end[0])) s = e
  if (dir < 0) while(s > 0 && rd[s-1].sta[0] === x) s--
  if (dir > 0) while(s < nums-1 && rd[s+1].sta[0] === x) s++
  return s
}

/** Computes the slope of the supplied road segment */
self.segSlope = (rd) => (rd.end[1] - rd.sta[1]) / (rd.end[0] - rd.sta[0])

/** Computes the value of a road segment at the given timestamp */
self.segValue = (rdseg, x) => rdseg.sta[1] + rdseg.slope*(x - rdseg.sta[0])

/** Computes the value of a road array at the given timestamp */
self.rdf = (rd, x) => self.segValue( rd[self.findSeg(rd, x)], x )

/** Recomputes the road array starting from the first node and
    assuming that the one of slope, enddate, or endvalue parameters is
    chosen to be automatically computed. If usematrix is true,
    autocompute parameter selections from the road matrix are used */
self.fixRoadArray = (rd, autop=self.RP.VALUE, usematrix=false, 
                     edited=self.RP.VALUE) => {
                       var nr = rd.length
                       // Fix the special first road segment w/ slope always 0.
                       rd[0].sta[0] = rd[0].end[0] - 100*bu.DIY*bu.SID
                       rd[0].sta[1] = rd[0].end[1]

                       // Iterate thru the remaining segments until the last one
                       for (let i = 1; i < nr-1; i++) {
                         //console.debug("before("+i+"):[("+rd[i].sta[0]+
                         //","+rd[i].sta[1]+"),("+rd[i].end[0]+","
                         //+rd[i].end[1]+"),"+rd[i].slope+"]");
                         if (usematrix) autop = rd[i].auto
                         
                         var dv = rd[i].end[1] - rd[i].sta[1] 
                         
                         rd[i].sta[0] = rd[i-1].end[0]
                         rd[i].sta[1] = rd[i-1].end[1]
                         
                         if (autop === self.RP.DATE) {
                           if (isFinite(rd[i].slope) && rd[i].slope != 0) {
                             rd[i].end[0] = bu.daysnap(
                               rd[i].sta[0]
                               +(rd[i].end[1]-rd[i].sta[1])/rd[i].slope)
                           }
                           // Sanity check
                           if (rd[i].end[0] <= rd[i].sta[0])
                             rd[i].end[0] = bu.daysnap(rd[i].sta[0]+bu.SID)
                            
                           if (edited === self.RP.SLOPE)
                             // Readjust value if slope was edited
                             rd[i].end[1] = 
                               rd[i].sta[1]+rd[i].slope
                               *(rd[i].end[0]-rd[i].sta[0])
                           else
                             // Readjust value if value was edited
                             rd[i].slope = self.segSlope(rd[i])
                         } else if (autop === self.RP.VALUE) {
                           if (isFinite(rd[i].slope))
                             rd[i].end[1] = rd[i].sta[1]+rd[i].slope
                             *(rd[i].end[0]-rd[i].sta[0])
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
                         rd[nr-1].end[0] = rd[nr-1].sta[0] + 100*bu.DIY*bu.SID
                         rd[nr-1].end[1] = rd[nr-1].sta[1]
                       }
                     }

/** Good delta: Returns the delta from the given point to the
    centerline of the road but with the sign such that being on the
    good side of the road gives a positive delta and being on the
    wrong side gives a negative delta. */
self.gdelt = (rd, goal, t, v) => bu.chop(goal.yaw*(v - self.rdf(rd, t)))

// The bottom lane is -1, top lane is 1, below the road is -2, above is +2, etc.
// Implementation notes:
// This includes the noisy width but it does not adjust the noisy
// width based on t. So this gives the correct lane number for
// noisy graphs when called with (tcur,vcur) but not necessarily
// for other values of t. The dtd function handles this slightly
// more robustly. Unless we deal with the noisy width better we
// might want to remove the {t,v} parameter and have this only
// work for (tcur,vcur).
// How to use lanage:
//  lanage*yaw >= -1: on the road or on the good side of it (orange/blue/green)
//  lanage*yaw >   1: good side of the road (green dot)
//  lanage*yaw ==  1: right lane (blue dot)
//  lanage*yaw == -1: wrong lane (orange dot)
//  lanage*yaw <= -2: emergency day or derailed (red dot)
self.lanage = ( rd, goal, t, v, l = null ) => {
  var ln = goal.lnf( t )
  if (l === null) l = goal.noisy ? Math.max(ln, goal.nw) : ln
  var d = v - self.rdf(rd, t)
  if (bu.chop(l) === 0)
    return rnd(bu.chop(d) === 0.0 ? goal.yaw : Math.sign(d)*666)
  var x = bu.ichop(d/l)
  var fracp = x % 1
  var intp = x -fracp
  if (fracp > .99999999) {
    intp += 1
    fracp = 0
  }
  if (bu.chop(fracp) === 0) {
    if (goal.yaw > 0 && intp >= 0) return rnd(intp+1)
    if (goal.yaw < 0 && intp <= 0) return rnd(intp-1)
    return rnd(Math.sign(x)*Math.ceil(Math.abs(x)))
  }
  return rnd(Math.sign(x)*Math.ceil(Math.abs(x)))
}

/** Whether the given point is on the road if the road has lane width l */
self.aok = (rd, g, t, v, l) => self.lanage(rd, g, t, v, l) * g.yaw >= -1.0

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
self.ppr = (rd, g, t, i=null, pastppr = false) => {
  if (g.yaw*g.dir >= 0) return 0 // MOAR/PHAT => PPR=0; for WEEN/RASH read on...
  // Suppress the PPR if (a) we're computing it for today and (b) there's
  // already a datapoint entered today or if PPRs are explicitly turned off:
  if (!pastppr && t <= g.asof && (!g.ppr || g.tdat === g.asof)) return 0
  // Otherwise it's (a) for the future or (b) for today and PPRs are turned on
  // and there's no datapoint added for today, so go ahead and compute it...
  var r
  if (i != null) r = rd[i].slope * bu.SID
  else r = self.rtf(rd, t) * bu.SID  // twice the current daily rate of the YBR
  if (r === 0) return -g.yaw * 2       // absolute PPR of 2 gunits if flat slope
  if (g.yaw*r > 0) return 0   // don't let it be an OPR (optimistic presumptive)
  return 2*r
}

/** Returns the number of days to derail for the current road
    TODO: There are some issues with computing tcur, vcur */
self.dtd = (rd, goal, t, v) => {
  if (self.isLoser(rd, goal, null, t, v)) return 0

  var fnw = self.gdelt(rd, goal, t,v) >= 0 ? 0.0 : goal.nw // future noisy width
  var elnf = x => Math.max(goal.lnf(x), fnw) // effective lane width function

  const SID = 86400 // seconds in day (shorter than "bu.SID")
  let x = 0 // the number of steps
  let vpess = v + self.ppr(rd, goal, t+x*SID) // value as we walk fwd w/ PPRs
  while (self.aok(rd, goal, t+x*SID, vpess, elnf(t+x*SID)) 
         && t+x*SID <= Math.max(goal.tfin, t)) {
    x += 1 // walk forward until we're off the YBR
    vpess += self.ppr(rd, goal, t+x*SID)
  }
  if (goal.noisy && self.gdelt(rd,goal,t,v) >= 0) x = Math.max(2, x)
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
self.dtdarray = ( rd, goal ) => {
  var rdl = rd.length
  var xcur = rd[rdl-1].sta[0], ycur = rd[rdl-1].sta[1], xn, yn
  var ppr = self.ppr(rd, goal, 0, rdl-1), sl, dtd
  var arr = [], seg
  arr = [[[xcur, ycur, 0, ycur-ppr, 1]]]
  for (var i = rdl-2; i >= 0; i--) {
    xcur = rd[i].sta[0]
    ycur = rd[i].sta[1]
    xn = rd[i].end[0]
    yn = rd[i].end[1]
    ppr = self.ppr(rd, goal, 0, i, true)
    dtd = ((xn-xcur)/bu.SID)
    if (!isFinite(ppr)) {
      if (ycur > yn)
        seg = [[xcur, ycur, 0, yn, dtd]]
      else
        seg = [[xcur, ycur, 0, yn-2*(yn-ycur), dtd]]
    } else
      seg = [[xcur, ycur, 0, yn-ppr*dtd, dtd]]
    
    var last = arr[arr.length-1]
    for (var j = 0; j < last.length; j++) {
      if (!isFinite(ppr)) {
        if (ycur > yn)
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

/* returns an array of x.y coordinate pairs for an isoline associated
 * with dtd=v. This can be used to compute boundaries for
 * derailment regions, as well as guidelines. Coordinate points start
 * from the end of the road and proceed backwards
*/
self.isoline = ( rd, dtdarr, goal, v ) => {
  var n = dtdarr[0], nn, iso
  var s = 0, ns, j, k, st, en, sl
  // Start the isoline with a horizontal line for the end of the road
  iso = [[n[0][0]+10*bu.SID, n[0][1]+v*(n[0][3]-n[0][1])],
         [n[0][0], n[0][1]+v*(n[0][3]-n[0][1])]]
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
    // Consider inflections between the previous segment index and
    // newly found segment index from inflection j+1 to inflection j
    // on the road
    for (k=s; k >= ns; k--) {
      st = [n[k][0], n[k][1], n[k][2]]
      en = [nn[k][0], nn[k][3], nn[k][4]]
      if (en[2] - st[2] == 0)
        iso.push([st[0], st[1]]);
      else {
        sl = (v-st[2]) / (en[2]-st[2])
        iso.push([st[0] + sl*(en[0]-st[0]), st[1]+sl*(en[1]-st[1])]);
      }
    }
    st = [nn[ns][0], nn[ns][1], nn[ns][2]]
    en = [nn[ns][0], nn[ns][3], nn[ns][4]]
    if (en[2] - st[2] == 0)
      iso.push([st[0], st[1]]);
    else {
      sl = (v-st[2]) / (en[2]-st[2])
      iso.push([st[0] + sl*(en[0]-st[0]), st[1]+sl*(en[1]-st[1])]);
    }
    s = ns
    n = nn
  }
  return iso
}
  
/** Days To Centerline: Count the integer days till you cross the
    centerline/tfin if nothing reported */
self.dtc = (rd, goal, t, v) => {
  var x = 0
  while(self.gdelt(rd, goal, t+x*bu.SID, v) >= 0 && t+x*bu.SID <= goal.tfin)
    x += 1 // dpl
  return x
}

/** What delta from the centerline yields n days of safety buffer
 * till centerline? */
self.bufcap = (rd, g, n=7) => {
  var t = g.tcur, v = self.rdf(rd, t), r = self.rtf(rd, t), d, i
  if (r === 0) r = g.lnw
  r = Math.abs(r)
  d = 0
  i = 0
  while(self.dtc(rd, g, t,v+d) < n && i <= 70) { 
    d += g.yaw*r*bu.SID
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
    else         return Math.min(bu.BDUSK, tp + (v-vp)/r)
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
  rd.forEach( e => (e[2] = (null==e[2])?e[2]:e[2]*g.siru))
  return rd
}

/** Version of fillroad that assumes tini/vini is the first row of road */
self.fillroadall = (rd, g) => {
  var tini = rd[0][0], vini = rd[0][1]
  rd.splice(0,1)
  rd.forEach( e => (e[2] = (null==e[2])?e[2]:e[2]/g.siru))
  rd[0] = nextrow([tini, vini, 0, 0], rd[0])
  for (let i = 1; i < rd.length; i++)
    rd[i] = nextrow(rd[i-1], rd[i])
  rd.forEach( e => (e[2] = (null==e[2])?e[2]:e[2]*g.siru))
  rd.unshift([tini, vini, 0, 2])
  return rd
}

/** Computes the slope of the supplied road array at the given timestamp */
self.rtf = (rd, t) => (rd[self.findSeg( rd, t )].slope)

self.genLaneFunc = function(rd, goal ) {
  var r0 = bu.deldups(rd, e=>e.end[0])
  var t = r0.map(elt => elt.end[0])
  var r = r0.map(elt => Math.abs(elt.slope)*bu.SID )
  // pretend flat spots have the previous or next non-flat rate
  var rb = r.slice(), i
  for (i = 1; i < rb.length; i++) 
    if (Math.abs(rb[i]) < 1e-7 || !isFinite(rb[i])) rb[i] = rb[i-1]
  var rr = r.reverse()
  var rf = rr.slice()
  for (i = 1; i < rf.length; i++) 
    if (Math.abs(rf[i]) < 1e-7 || !isFinite(rf[i])) rf[i] = rf[i-1]
  rf = rf.reverse()
  r = bu.zip([rb,rf]).map(e => bu.argmax(Math.abs, [e[0],e[1]]) )
  t.pop()
  r.splice(0,1)
  var rtf0 = self.stepify(bu.zip([t,r]))
  return (x => Math.max(Math.abs(self.vertseg(rd,x) ? 0 : 
                                 self.rdf(rd, x) - self.rdf(rd, x-bu.SID)), 
                        rtf0(x)))
  //return x=>self.lnfraw(rd, goal, x)
}

// Transform datapoints as follows: every time there's a decrease
// in value from one element to the next where the second value is
// zero, say V followed by 0, add V to every element afterwards.
// This is what you want if you're reporting odometer readings (eg,
// your page number in a book can be thought of that way) and the
// odometer gets accidentally reset (or you start a new book but want
// to track total pages read over a set of books). This should be done
// before kyoomify and will have no effect on data that has actually
// been kyoomified since kyoomification leaves no nonmonotonicities.
self.odomify = ( d ) => {
  var ln = d.length
  if (ln === 0) return
  var curadd = 0
  var prev = d[0][1]
  for (let i=1; i<ln; i++) {
    if (d[i][1] === 0) {curadd += prev}
    prev = d[i][1]
    d[i][1] += curadd
  }
}

// Utility function for stepify
self.stepFunc = ( d, x, dflt=0 ) => {
  if (x < d[0][0]) return dflt
  // TODO: Test the below binary search with duplicate timestamps
  var numpts = d.length, s = 0, e = numpts-1, m
  if (x > d[numpts-1][0]) return d[numpts-1][1]
  while (e-s > 1) {
    m = Math.floor((s+e)/2)
    if (d[m][0] <= x) s = m
    else e = m
  }
  return d[s][1]
}

// Take a list of datapoints sorted by x-value and returns a pure
// function that interpolates a step function from the data,
// always mapping to the most recent value. Cf
// http://stackoverflow.com/q/6853787
self.stepify = (d, dflt=0) =>
  d === null ? x => dflt : x => self.stepFunc(d, x, dflt)

// Appropriate color for a datapoint
self.dotcolor = ( rd, g, t, v) => {
  if (t < g.tini) return bu.Cols.BLCK
  var l = self.lanage(rd, g, t, v)
  if (g.yaw===0 && Math.abs(l) > 1.0)  return bu.Cols.GRNDOT
  if (g.yaw===0 && (l===0 || l===1.0)) return bu.Cols.BLUDOT
  if (g.yaw===0 && l===-1.0)           return bu.Cols.ORNDOT
  if (l*g.yaw >=   2.0)                return bu.Cols.GRNDOT
  if (l*g.yaw ===  1.0)                return bu.Cols.BLUDOT
  if (l*g.yaw === -1.0)                return bu.Cols.ORNDOT
  if (l*g.yaw <=  -2.0)                return bu.Cols.REDDOT
  return bu.Cols.BLCK
}

self.isLoser = (rd, g, d, t, v) =>
  g.offred ? 
    self.dotcolor(rd,g,t-bu.SID, g.dtf(t-bu.SID)) === bu.Cols.REDDOT :
    self.dotcolor(rd,g,t-bu.SID, g.dtf(t-bu.SID)) === bu.Cols.REDDOT
      && self.dotcolor(rd,g,t,v) === bu.Cols.REDDOT 

/** For noisy graphs, compute the lane width (or half aura width)
    based on data.  Specifically, get the list of daily deltas
    between all the points, but adjust each delta by the road rate
    (eg, if the delta is equal to the delta of the road itself,
    that's an adjusted delta of 0).  Return the 90% quantile of those
    adjusted deltas. */
self.noisyWidth = (rd, d) => {
  if (d.length <= 1) return 0
  var p = bu.partition(d,2,1), el, ad = []
  var t,v,u,w
  for (let i = 0; i < p.length; i++) {
    t = p[i][0][0]
    v = p[i][0][1]
    u = p[i][1][0]
    w = p[i][1][1]
    ad.push(Math.abs(w-v-self.rdf(rd,u)+self.rdf(rd,t))/(u-t)*bu.SID)
  }
  return bu.chop(ad.length===1 ? ad[0] : bu.quantile(ad, .90))
}

/** Increase the width if necessary for the guarantee that you
    can't lose tomorrow if you're in the right lane today.
    Specifically, when you first cross from right lane to wrong lane
    (if it happened from one day to the next), the road widens if
    necessary to accommodate that jump and then the road width stays
    fixed until you get back in the right lane.  So for this function
    that means if the current point is in the wrong lane, look
    backwards to find the most recent one-day jump from right to
    wrong. That wrong point's deviation from the centerline is what
    to max the default road width with. */
self.autowiden = (rd, g, d, nw) => {
  var n = d, length, i=-1
  if (n <= 1) return 0
  if (self.gdelt(rd, g, d[d.length-1][0], d[d.length-1][1]) < 0) {
    while (i >= -n && self.gdelt(rd, g, d[i][0], d[i][1]) < 0) i -= 1
    i += 1
    if (i > -n && d[i][0] - d[i-1][0] <= bu.SID) 
      nw = Math.max(nw, Math.abs(d[i][1] - self.rdf(rd,d[i][0])))
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
  var n = Math.floor((end-start)/bu.SID)
  var out = Array(n), i, j = 0, t = start
  for (i = 0; i < d.length-1; i++) {
    var den = (d[i+1][0]-d[i][0])
    while (t <= d[i+1][0]) {
      out[j] = [t,interp(d[i][1], d[i+1][1], (t-d[i][0])/den)]
      j++; t += bu.SID
    }
  }
  if (out.length === 0) out.push(d[0])
  return out
}

/** Return a pure function that fits the data smoothly, used by grAura */
self.smooth = (d) => {
  var SMOOTH = (d[0][0] + d[d.length-1][0])/2
  var dz = bu.zip(d)
  var xnew = dz[0].map((e)=>(e-SMOOTH)/bu.SID)
  var poly = new Polyfit(xnew, dz[1])
  var solver = poly.getPolynomial(3)
  var range = Math.abs(Math.max(...dz[1])-Math.min(...dz[1]))
  var error = poly.standardError(poly.computeCoefficients(3))
  if (error > 10000*range) {
    // Very large error. Potentially due to ill-conditioned matrices
    console.log(
      "butil.smooth: Possible ill-conditioned polyfit. Reducing dimension.")
    solver = poly.getPolynomial(2)
  }

  return (x) =>(solver((x-SMOOTH)/bu.SID))
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

/**  The value of the relevant/critical edge of the YBR in n days */
self.lim = (rd, g, n) => {
  var t = g.tcur+n*bu.SID
  return self.rdf(rd, t)
    - Math.sign(g.yaw)
    * (g.noisy ? Math.max(g.nw, g.lnf(t)) : g.lnf(t))
}

/** The bare min needed from vcur to the critical edge of the YBR in n days */
self.limd = (rd, g, n) => {
  return bu.conservaround(self.lim(rd, g, n) - g.vcur, g.integery?1:0, g.yaw)
}
return self

})); // END MAIN ---------------------------------------------------------------
