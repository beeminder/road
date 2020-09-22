/**
 * Library of utilities for Beebrain, provided as a UMD module. Returns a
 * "broad" object with public member functions and constants for calculating 
 * things about yellow brick roads. Does not hold any internal state.
 *
 * Copyright 2018-2020 Uluc Saranli and Daniel Reeves

 @requires moment
 @requires butil

 @exports broad
*/

;((function(root, factory) { // BEGIN PREAMBLE ---------------------------------

'use strict'

if (typeof define === 'function' && define.amd) {
  // AMD. Register as an anonymous module.
  //console.log("broad: Using AMD module definition")
  define(['moment', 'Polyfit', 'butil'], factory)
} else if (typeof module === 'object' && module.exports) {
  // Node. Does not work with strict CommonJS, but only CommonJS-like
  // environments that support module.exports, like Node.
  //console.log("broad: Using CommonJS module.exports")
  module.exports = factory(require('./moment'), 
                           require('./polyfit'), 
                           require('./butil'))
} else {
  //console.log("broad: Using Browser globals")
  root.broad = factory(root.moment, root.Polyfit, root.butil)
}

})(this, function(moment, Polyfit, bu) { // END PREAMBLE -- BEGIN MAIN ---------

'use strict'

// -----------------------------------------------------------------------------
// --------------------------- CONVENIENCE CONSTANTS ---------------------------

const rnd   = Math.round
const max   = Math.max
const min   = Math.min
const abs   = Math.abs
const pow   = Math.pow
const floor = Math.floor
const ceil  = Math.ceil
const sign  = Math.sign

const DIY = 365.25
const SID = 86400

// -----------------------------------------------------------------------------
// ------------------- PUBLIC MEMBER CONSTANTS AND FUNCTIONS -------------------

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
trimmean : (x) => -1505, // bu.mean(x), // TODO: implement this if anyone cares
sum      : (x) => bu.sum(x),
jolly    : (x) => x.length > 0 ? 1 : 0,
binary   : (x) => x.length > 0 ? 1 : 0,
nonzero  : bu.nonzero,
triangle : (x) => bu.sum(x)*(bu.sum(x)+1)/2,
square   : (x) => pow(bu.sum(x),2),
clocky   : bu.clocky, // sum of pair diff.
count    : (x) => x.length, // number of datapoints
kyshoc   : (x) => min(2600, bu.sum(x)), // ad hoc, guineapigging
//TODO: FIXHACK?: Introduced internal state for rfin for skatesum
skatesum : (x) => min(self.rfin, bu.sum(x)), // only count daily min
cap1     : (x) => min(1, bu.sum(x)), // for zedmango
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
    if (!bu.nearEq(rda[i].end[0], rdb[i].end[0], 10))   return false
    if (!bu.nearEq(rda[i].end[1], rdb[i].end[1], 10))   return false
    if (!bu.nearEq(rda[i].slope,  rdb[i].slope, 1e-14)) return false
  }
  return true
}

/** Creates and returns a clone of the supplied road array */
self.copyRoad = (rd) => {
  var nr = []
  for (let i = 0; i < rd.length; i++) {
    var s = {
      sta:   rd[i].sta.slice(), 
      end:   rd[i].end.slice(),
      slope: rd[i].slope, 
      auto:  rd[i].auto,
    }
    nr.push(s)
  }
  return nr
}

/* Find the index of the road segment containing the given t-value. Note that
   there could be a vertical segment (or even multiple ones) exactly at the
   given t-value. In that case the dir parameter says how to disambiguate. Since
   we've added a flat dummy segment after tfin (and before tini), we're
   guaranteed to find a non-vertical segment for any t-value.
   Cases:
   1. t is within exactly one segemnt: easy, return (the index of) that segment
   2. t is on a boundary between 2 segments: return 2nd one (regardless of dir)
   3. t is on a vertical segment & dir=-1: return the first vertical segment
   4. t on a vert segmt & dir=+1: return the non-vertical segment to the right
   5. t on a vert segmt & dir=0: return the vertical segment (if there are
      multiple vertical segments all at t, return one arbitrarily) */
self.findSeg = (rd, t, dir=0) => {
  const st = i => rd[i].sta[0]                 // start time of ith road segment
  const et = i => rd[i].end[0]                  // end time of ith road segment
  const isin = (t,i) => st(i) <= t && t < et(i)  // whether segment i contains t

  if (!rd || !rd.length || t < st(0) || t > et(rd.length-1)) return -1

  let a = 0            // initially the index of the leftmost road segment
  let b = rd.length-1  // initially the index of the rightmost road segment
  let m                // midpoint of the search range for binary search
  while (b-a > 1) {
    m = floor((a+b)/2)
    if (st(m) <= t) a = m // m is good or too far left (so throw away left half)
    else            b = m // m is too far right (so throw away right half)
  }   // at this point a & b are consecutive and at least one of them contains t
  m = isin(t, b) ? b : a // if both a & b contain t, pick b (bias right)
  // TODO: find a test bb file where doing this scooching actually matters:
  if (dir < 0) while(m > 0           && st(m-1) === t) m--
  if (dir > 0) while(m < rd.length-1 && st(m+1) === t) m++
  return m
}

/** Computes the slope of the supplied road segment */
self.segSlope = (rd) => (rd.end[1] - rd.sta[1]) / (rd.end[0] - rd.sta[0])

/** Computes the value of a road segment at the given timestamp */
self.segValue = (rdseg, x) => rdseg.sta[1] + rdseg.slope*(x - rdseg.sta[0])

/** Computes the value of a road array at the given timestamp */
self.rdf = (rd, x) => self.segValue( rd[self.findSeg(rd, x)], x )

/**Recompute road matrix starting from the first node and assuming that exactly
   one of the slope, enddate, or endvalue parameters is chosen to be
   automatically computed. If usematrix is true, autocompute parameter
   selections from the road matrix are used. */
self.fixRoadArray = (rd, autop=self.RP.VALUE, usematrix=false, 
                     edited=self.RP.VALUE) => {
  const nr = rd.length
  // Fix the special first road segment w/ slope always 0
  rd[0].sta[0] = rd[0].end[0] - 100*DIY*SID
  rd[0].sta[1] = rd[0].end[1]
  
  // Iterate thru the remaining segments until the last one
  for (let i = 1; i < nr-1; i++) {
    //console.debug("before("+i+"):[("+rd[i].sta[0]+
    //","+rd[i].sta[1]+"),("+rd[i].end[0]+","
    //+rd[i].end[1]+"),"+rd[i].slope+"]")
    if (usematrix) autop = rd[i].auto
    
    var dv = rd[i].end[1] - rd[i].sta[1] 
    
    rd[i].sta[0] = rd[i-1].end[0]
    rd[i].sta[1] = rd[i-1].end[1]
    
    if (autop === self.RP.DATE) {
      if (isFinite(rd[i].slope) && rd[i].slope != 0) {
        rd[i].end[0] = bu.daysnap(
          rd[i].sta[0]+(rd[i].end[1]-rd[i].sta[1])/rd[i].slope)
      }
      // Sanity check
      if (rd[i].end[0] <= rd[i].sta[0])
        rd[i].end[0] = bu.daysnap(rd[i].sta[0]+SID)
       
      if (edited === self.RP.SLOPE)
        // Readjust value if slope was edited
        rd[i].end[1] = rd[i].sta[1]+rd[i].slope*(rd[i].end[0]-rd[i].sta[0])
      else
        // Readjust value if value was edited
        rd[i].slope = self.segSlope(rd[i])
    } else if (autop === self.RP.VALUE) {
      if (isFinite(rd[i].slope))
        rd[i].end[1] = rd[i].sta[1]+rd[i].slope*(rd[i].end[0]-rd[i].sta[0])
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
    rd[nr-1].end[0] = rd[nr-1].sta[0] + 100*DIY*SID
    rd[nr-1].end[1] = rd[nr-1].sta[1]
  }
}

/**Good delta: Return the delta from the given point to the razor road but with
   the sign such that being on the good side of the road gives a positive delta
   and being on the wrong side gives a negative delta. */
self.gdelt = (rd, g, t, v) => bu.chop(g.yaw*(v - self.rdf(rd, t)))

/** Whether the given point is on or on the good side of the razor road */
self.aok = (rd, g, t, v) => {
  //console.log(`DEBUG: ${JSON.stringify(rd)}`)
  return g.yaw * (v - self.rdf(rd, t)) >= v*-1e-15 // DRY: isoside()'s tolerance
}

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
self.ppr = (rd, g, t, i=null, pastppr=false) => {
  // TODO: we may want to use g.maxflux as the PPR for MOAR/PHAT
  if (g.yaw*g.dir >= 0) return 0 // MOAR/PHAT => PPR=0; for WEEN/RASH read on...
  // Suppress the PPR if (a) we're computing it for today and (b) there's
  // already a datapoint entered today or if PPRs are explicitly turned off:
  if (!pastppr && t <= g.asof && (!g.ppr || g.tdat === g.asof)) return 0
  // Otherwise it's (a) for the future or (b) for today and PPRs are turned on
  // and there's no datapoint added for today, so go ahead and compute it...
  var r
  if (i != null) r = rd[i].slope * SID
  else r = self.rtf(rd, t) * SID  // twice the current daily rate of the YBR
  if (r === 0) return -g.yaw * 2  // absolute PPR of 2 gunits if flat slope
  if (g.yaw*r > 0) return 0   // don't let it be an OPR (optimistic presumptive)
  return 2*r
}

/** Return number of days to derail for the current road.
    TODO: There are some issues with computing tcur, vcur */
self.dtd = (rd, goal, t, v) => {
  if (self.redyest(rd, goal, t)) return 0 // TODO: need iso here

  let x = 0 // the number of steps
  let vpess = v + self.ppr(rd, goal, t+x*SID) // value as we walk fwd w/ PPRs
  while (self.aok(rd, goal, t+x*SID, vpess) && t+x*SID <= max(goal.tfin, t)) {
    x += 1 // walk forward until we're off the YBR
    vpess += self.ppr(rd, goal, t+x*SID)
  }
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
    dtd = ((xn-xcur)/SID)
    if (!isFinite(ppr)) {
      if (goal.dir*(ycur - yn) > 0)
        seg = [[xcur, ycur, 0, yn, dtd]]
      else
        seg = [[xcur, ycur, 0, yn-2*(yn-ycur), dtd]]
    } else
      seg = [[xcur, ycur, 0, yn-ppr*dtd, dtd]]
    
    var last = arr[arr.length-1]
    for (var j = 0; j < last.length; j++) {
      if (!isFinite(ppr)) {
        if (goal.dir*(ycur - yn) > 0)
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

/**Generate and return an initial version of the isoline by processing the
   supplied dtdarray. The resulting isoline is correct for doless and rash
   goals, but will need further processing for goal with dir*yaw>0. */
self.isoline_generate = (rd, dtdarr, goal, v) => {
  var n = dtdarr[0], nn, iso
  var s = 0, ns, j, k, st, en, sl

  function addunique(arr, pt) {
    var elt = arr[arr.length-1]
    if (elt[0] != pt[0] || elt[1] != pt[1])
      arr.push(pt)
  }
  
  // Start the isoline with a horizontal line for the end of the road
  iso = [[n[0][0]+10*SID, n[0][1]+v*(n[0][3]-n[0][1])],
         [n[0][0],        n[0][1]+v*(n[0][3]-n[0][1])]]
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
    // Consider inflections between the previous segment index and newly found
    // segment index from inflection j+1 to inflection j on the road
    for (k=s; k >= ns; k--) {
      st = [n[k][0], n[k][1], n[k][2]]
      en = [nn[k][0], nn[k][3], nn[k][4]]
      if (en[2] - st[2] == 0)
        addunique(iso, [st[0], st[1]])
      else {
        sl = (v-st[2]) / (en[2]-st[2])
        addunique(iso, [st[0] + sl*(en[0]-st[0]), 
                  st[1] + sl*(en[1]-st[1])])
      }
    }
    st = [nn[ns][0], nn[ns][1], nn[ns][2]]
    en = [nn[ns][0], nn[ns][3], nn[ns][4]]
    if (en[2] - st[2] == 0)
      addunique(iso, [st[0], st[1]])
    else {
      sl = (v-st[2]) / (en[2]-st[2])
      addunique(iso, [st[0] + sl*(en[0]-st[0]), st[1]+sl*(en[1]-st[1])])
    }
    s = ns
    n = nn
  }
  return iso.reverse()  
}

/**Ensure correctness of the isoline for do-more goals such that the isoline is
   not allowed to go against 'dir' for dtd days after a road kink. This ensures
   that the first intersection with the razor road is taken as the dtd value. */
self.isoline_monotonicity = (iso, rd, dtdarr, goal, v) => {
  if (goal.yaw * goal.dir < 0) return iso
  
  let isoout = []
  let downstreak = false
  let flatdone = false
  let slope, newx, j, k
  const addpt = function(a, pt) { a.push([pt[0], pt[1]]) }

  // k holds the last isoline segment that's been processed and filtered
  k = -1
  // j iterates over unfiltered isoline segments
  for (j = 0; j < iso.length-1; j++) {
    // If an upslope is detected, finish downstreak
    if ((iso[j+1][1] - iso[j][1]) * goal.dir > 0) downstreak = false
    
    addpt(isoout, iso[j])
    
    // Check if new downstreak to initiate new flat region (when dtd != 0)
    if (v != 0 && (iso[j+1][1] - iso[j][1]) * goal.dir < 0 && !downstreak) {
      
      downstreak = true
      // Extend horizontally by at least dtd days or till we find positive slope
      k = j+1
      flatdone = false
      while (!flatdone) {
        if (iso[k][0] >= iso[j][0] + v*SID) {
          // Reached end of the flat region with dtd days
          flatdone = true
          newx = iso[j][0]+v*SID
          addpt(isoout, [newx, iso[j][1]])
          
        } else if ((iso[k+1][1] - iso[k][1]) * goal.dir >= 0) {
          // Found a positive slope, finish flat region by extending until 
          // intersection with the positive slope unless the next segment ends
          // before that.
          if (iso[k+1][0] != iso[k][0]) {
            slope = (iso[k+1][1]-iso[k][1])
                   /(iso[k+1][0]-iso[k][0])
            if (slope != 0) {
              newx = iso[k][0] + (iso[j][1] - iso[k][1])/slope
              if (newx <= iso[j][0]+v*SID && newx <= iso[k+1][0]) {
                flatdone = true
              }
            }
          } else if ((iso[j][1]-iso[k][1])*(iso[j][1]-iso[k+1][1]) < 0) {
            // Early intersection with upward vertical segment found.
            // +1 ensures that filtering gets rid of extra backward segments
            newx = iso[k][0]+1
            flatdone = true
          }
          if (flatdone) {
            addpt(isoout, [newx, iso[j][1]])
          }
        }
        k++
      }
    }
  }
  return isoout
}

/** Eliminate backward line segments introduced by the monotonicty pass. */
self.isoline_nobackward = (iso, rd, dtdarr, goal, v) => {
  var isoout = [iso[0].slice()], lastpt, slope, j
  for (j = 1; j < iso.length; j++) {
    lastpt = isoout[isoout.length-1]
    if (iso[j][0] < lastpt[0]) continue
    if (iso[j-1][0] < lastpt[0] && iso[j][0] > lastpt[0]) {
      // Intermediate point needed
      if (iso[j][0] - iso[j-1][0] != 0) {
        slope = (iso[j][1] - iso[j-1][1])/(iso[j][0] - iso[j-1][0])
        isoout.push([lastpt[0], iso[j-1][1] + slope*(lastpt[0]-iso[j-1][0])])
      }
    }
    isoout.push([iso[j][0], iso[j][1]])
  }
  return isoout
}

/* Eliminates segments on the wrong side of the road */
self.isoline_clip = ( iso, rd, dtdarr, goal, v ) => {
  var isoout = []

  function lineval(s, e, x) {
    var sl = (e[1]-s[1])/(e[0]-s[0])
    return s[1] + sl * (x-s[0])
  }

  function intersect(s1, e1, s2, e2) { 
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

  // Clip a single point to the right side of the road. Assume points on
  // vertical segments are clipped wrt to the closest boundary to the wrong (side=-1)
  // or good (side=1) side of the road.
  function clippt(rd, goal, pt, side = -1) {
    var newpt = pt.slice()
    // Find the road segment [sta, end[ containing the pt
    var seg = self.findSeg(rd, pt[0])
    var rdy = self.segValue(rd[seg], pt[0])
    // If there are preceding vertical segments, take the boundary value based
    // on road yaw.
    while(--seg >= 0 && rd[seg].sta[0] == pt[0]) {
      if (-side*goal.yaw > 0) rdy = min(rdy, rd[seg].sta[1])
      else              rdy = max(rdy, rd[seg].sta[1])
    }
    if ((newpt[1] - rdy) * goal.yaw < 0) newpt[1] = rdy
    return newpt
  }

  var done = false, rdind = 0, isoind = 0, side

  // The loop below alternatingly iterates through the segments in the
  // road and the isoline, ensuring that the isoline always stays on
  // the right side of the road
  if (iso[1][0] != iso[0][0]) side = 1
  else side = -1
  isoout.push(clippt(rd, goal, iso[0], side))
  while (!done) {
    if (rdind > rd.length-1 || isoind > iso.length-2) break

    // Check whether segments are intersecting
    var ind = isoout.length-1
    var pt = intersect(rd[rdind].sta, rd[rdind].end, iso[isoind], iso[isoind+1])
    if (pt != null && (pt[0] != isoout[ind][0] || pt[1] != isoout[ind][1])) isoout.push(pt)
    
    if (rd[rdind].end[0] < iso[isoind+1][0]) {
      // If the isoline remains below the road at road inflection
      // points, add the road inflection point to avoid leaky isolines
      // on the wrong side of the road.
      if ((lineval(iso[isoind], iso[isoind+1],
                   rd[rdind].end[0]) - rd[rdind].end[1]) * goal.yaw < 0)
        isoout.push([rd[rdind].end[0], rd[rdind].end[1]])
      rdind++
    } else {
      isoind++
      // If the next isoline segment is vertical, clip to the wrong
      // side, otherwise, clip to the right side. This should resolve
      // the leaky isoline issue
      if (isoind < iso.length-1 && iso[isoind][0] != iso[isoind+1][0]) side = 1
      else side = -1
      isoout.push(clippt(rd, goal, iso[isoind], side))
    }
  }
  return isoout
}
  
/* Return an array of x,y coordinate pairs for an isoline associated with dtd=v.
 * This can be used to compute boundaries for derailment regions, as well as 
 * guidelines. Coordinate points stggart from the beginning of the road and 
 * proceed forward.
*/
self.isoline = ( rd, dtdarr, goal, v, retall=false ) => {
  let iso1 = self.isoline_generate( rd, dtdarr, goal, v)
  let iso2 = self.isoline_monotonicity( iso1, rd, dtdarr, goal, v)
  let iso3 = self.isoline_nobackward( iso2, rd, dtdarr, goal, v)
  let iso4 = self.isoline_clip( iso3, rd, dtdarr, goal, v)

  if (retall) return [iso1, iso2, iso3, iso4]
  else return iso4
}
  
// Evaluates a given isoline at the supplied x coordinate
self.isoval = ( line, x ) => {
  var nums = line.length-1, s = 0, e = nums-1, m
  if (x < line[0][0]) return line[0][1]
  if (x > line[nums][0]) return line[nums][1]
  while (e-s > 1) { // Uses binary search
    m = floor((s+e)/2)
    if (line[m][0] <= x) s = m
    else e = m
  }
  if ((x >= line[e][0]) && (x < line[e+1][0])) s = e
  var dx = line[s+1][0] - line[s][0]
  var dy = line[s+1][1] - line[s][1]
  if (dx == 0) return line[s][1]
  else return line[s][1]+(x-line[s][0])*dy/dx
}

/** Days To Derail: Count the integer days till you cross the razor road or hit
    tfin (whichever comes first) if nothing reported. Not currently used. */
self.dtd_walk = (rd, goal, t, v) => {
  let x = 0
  while(self.gdelt(rd, goal, t+x*SID, v) >= 0 && t+x*SID <= goal.tfin) x += 1
  return x
}

/** What delta from the razor road yields n days of safety buffer? 
    Not currently used. */
self.bufcap = (rd, g, n=7) => {
  const t = g.tcur
  const v = self.rdf(rd, t)
  const r = abs(self.rtf(rd, t))
  let d = 0
  let i = 0
  while(self.dtd_walk(rd, g, t, v+d) < n && i <= 70) {
    d += g.yaw*r*SID
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
    else         return bu.daysnap(min(bu.BDUSK, tp + (v-vp)/r))
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
  rd.forEach(e => (e[2] = (null==e[2])?e[2]:e[2]*g.siru))

  // Remove rows that have timestamps before tini. This is temporary until
  // we clean up the goals in the database where this is an issue. After that
  // we should just fail loudly when we get a bb file that has any road rows
  // with dates that are earlier than tini. Huge violation of the
  // anti-robustness principle [blog.beeminder.com/postel] to let Beebody send
  // broken road matrices and clean them up here in Beebrain!
  while (rd !== undefined && rd[0] !== undefined && rd[0][0] < g.tini) 
    rd.shift()

  return rd
}

/** Version of fillroad that assumes tini/vini is the first row of road */
self.fillroadall = (rd, g) => {
  const tini = rd[0][0]
  const vini = rd[0][1]
  rd.splice(0,1)
  rd.forEach(e => (e[2] = null === e[2] ? e[2] : e[2]/g.siru))
  rd[0] = nextrow([tini, vini, 0, 0], rd[0])
  for (let i = 1; i < rd.length; i++) rd[i] = nextrow(rd[i-1], rd[i])
  rd.forEach(e => (e[2] = null === e[2] ? e[2] : e[2]*g.siru))
  rd.unshift([tini, vini, 0, 2])
  return rd
}

/** Computes the slope of the supplied road array at the given timestamp */
self.rtf = (rd, t) => (rd[self.findSeg(rd, t)].slope)

// Transform datapoints as follows: every time there's a decrease in value from
// one element to the next where the second value is zero, say V followed by 0,
// add V to every element afterwards. This is what you want if you're reporting
// odometer readings (eg, your page number in a book can be thought of that way)
// and the odometer gets accidentally reset (or you start a new book but want to
// track total pages read over a set of books). This should be done before
// kyoomify and will have no effect on data that has actually been kyoomified
// since kyoomification leaves no nonmonotonicities.
self.odomify = (d) => {
  if (!d || !d.length || d.length === 0) return
  let curadd = 0
  let prev = d[0][1]
  for (let i = 1; i < d.length; i++) {
    if (d[i][1] === 0) curadd += prev
    prev = d[i][1]
    d[i][1] += curadd
  }
}

// Utility function for stepify. Takes a list of datapoints sorted by x-value
// and a given x value and finds the greatest x-value in d that's less than or
// equal to x. It returns the y-value corresponding to the found x-value.
// (It's like Mathematica's Interpolation[] with interpolation order 0.)
// If the given x is strictly less than d[0][0], return the given default.
self.stepFunc = (d, x, dflt=0) => {
  if (x < d[0][0]) return dflt
  // TODO: Test the below binary search with duplicate timestamps
  var numpts = d.length, s = 0, e = numpts-1, m
  if (x > d[numpts-1][0]) return d[numpts-1][1]
  while (e-s > 1) {
    m = floor((s+e)/2)
    if (d[m][0] <= x) s = m
    else e = m
  }
  return d[s][1]
}

// Take a list of datapoints sorted by x-value and return a pure function that
// interpolates a step function from the data, always mapping to the most
// recent value.
self.stepify = (d, dflt=0) =>
  d === null ? x => dflt : x => self.stepFunc(d, x, dflt)


// Return which side of a given isoline a given datapoint is: -1 for wrong and
// +1 for correct side. Being exactly on an isoline counts as the good side.
self.isoside = (g, isoline, t, v) => {
  if (!isoline || !isoline.length) return 0
  const TOL = v*-1e-15
  // We multiply that tolerance times v to be a bit more robust. In the extreme
  // case, imagine the values are already so tiny that they're about equal to
  // the tolerance. Then checking if v - isoval was greater than -v would be way
  // too forgiving.

  //console.log(`ISOSIDE: (${t},${v}) ${JSON.stringify(isoline)}`)
  const n = isoline.length
  let s = 0, e = n-1, m    // start, end, midpoint for binary search
  if (t <= isoline[s][0]) return (v - isoline[s][1])*g.yaw >= TOL ? +1 : -1
  if (t >= isoline[e][0]) return (v - isoline[e][1])*g.yaw >= TOL ? +1 : -1
  while (e-s > 1) {
    m = floor((s+e)/2)
    if (isoline[m][0] <= t) s = m
    else e = m
  }
  if (isoline[s+1][0] === isoline[s][0]) {
    console.log("Warning: isoline ended up with infinite slope!")
    return 0
  }
  const slope =   (isoline[s+1][1]-isoline[s][1]) 
                / (isoline[s+1][0]-isoline[s][0])
  const isoval = isoline[s][1] + slope*(t - isoline[s][0])
  //console.log(`DEBUG v=${v} isoval=${isoval}`)
  return (v - isoval)*g.yaw >= TOL ? +1 : -1 // note tolerance!
}

// Given a road, a goal, a datapoint {t,v}, and an array of isolines, return the
// color that the datapoint should be plotted as. That depends on the isolines
// as follows: 
// * The 0th isoline is the bright red line so if you're on the wrong
//   side of that, you're red. 
// * Otherwise, if you're on the wrong side of the 1st isoline, you're orange.
// * Wrong side of the 2nd isoline, blue. 
// * Being just on the wrong side of the nth isoline means you have n safe days
//   and being exactly on it or just better is n+1 safe days. 
// * So being (on or) on the right side of the 6th isoline means you're immune
//   to the akrasia horizon.
self.dotcolor = (rd, g, t, v, iso=null) => {
  if (t < g.tini)   return bu.Cols.BLCK // dots before tini have no color!
  if (iso === null) return self.aok(rd, g, t, v) ? bu.Cols.BLCK : bu.Cols.REDDOT
  if (!iso || !iso.length || iso.length < 1) return bu.Cols.ERRDOT

  return self.isoside(g, iso[0], t, v) < 0 ? bu.Cols.REDDOT : // 0 safe days
         self.isoside(g, iso[1], t, v) < 0 ? bu.Cols.ORNDOT : // 1 safe day
         self.isoside(g, iso[2], t, v) < 0 ? bu.Cols.BLUDOT : // 2 safe days
         self.isoside(g, iso[6], t, v) < 0 ? bu.Cols.GRNDOT : // 3-6 safe days
                                             bu.Cols.GRNDOT   // 7+ safe days
}

// This was previously called isLoser
self.redyest = (rd, g, t, iso=null) => {
  return self.dotcolor(rd, g, t-SID, g.dtf(t-SID), iso) === bu.Cols.REDDOT 
}

/**Previously known as noisyWidth before Yellow Brick Half-Plane for computing
   the road width for goals like weight loss with noisy data. Now it computes
   the so-called 90% Variance show in the Statistics tab. We also use stdflux to
   determine the width of the polynomial fit trend aka blue-green aura aka
   turquoise swath (it's twice stdflux, ie, stdflux in each direction).
   Specifically, we get the list of daily deltas between all the points, but
   adjust each delta by the road rate (eg, if the delta is equal to the delta
   of the road itself, that's an adjusted delta of 0). Return the 90% quantile
   of those adjusted deltas. */
self.stdflux = (rd, d) => {
  if (!d || !d.length || d.length <= 1) return 0
  const p = bu.partition(d, 2, 1)
  let ad = []
  let t, v, u, w
  for (let i = 0; i < p.length; i++) {
    t = p[i][0][0]
    v = p[i][0][1]
    u = p[i][1][0]
    w = p[i][1][1]
    ad.push(abs(w-v-self.rdf(rd,u)
                   +self.rdf(rd,t))/(u-t)*SID)
  }
  return bu.chop(ad.length===1 ? ad[0] : bu.quantile(ad, .90))
}

// This should be safe to kill but probably have some cleanup in the test suite.
/**Increase the width if necessary for the guarantee that you can't lose
   tomorrow if you're in the right lane today. Specifically, when you first
   cross from right lane to wrong lane (if it happened from one day to the
   next), the road widens if necessary to accommodate that jump and then the
   road width stays fixed until you get back in the right lane. So for this
   function that means if the current point is in the wrong lane, look
   backwards to find the most recent one-day jump from right to wrong. That
   wrong point's deviation from the centerline is what to max the default road
   width with. */
self.autowiden = (rd, g, d, nw) => {
  let n = d  // pretty sure we meant n = d.length here killing this anyway, so.
  if (n <= 1) return 0
  let i = -1
  if (self.gdelt(rd, g, d[d.length-1][0], d[d.length-1][1]) < 0) {
    while (i >= -n && self.gdelt(rd, g, d[i][0], d[i][1]) < 0) i -= 1
    i += 1
    if (i > -n && d[i][0] - d[i-1][0] <= SID) 
      nw = max(nw, abs(d[i][1] - self.rdf(rd,d[i][0])))
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
  var n = floor((end-start)/SID)
  var out = Array(n), i, j = 0, t = start
  for (i = 0; i < d.length-1; i++) {
    var den = (d[i+1][0]-d[i][0])
    while (t <= d[i+1][0]) {
      out[j] = [t,interp(d[i][1], d[i+1][1], (t-d[i][0])/den)]
      j++; t += SID
    }
  }
  if (out.length === 0) out.push(d[0])
  return out
}

/** Return a pure function that fits the data smoothly, used by grAura */
self.smooth = (d) => {
  var SMOOTH = (d[0][0] + d[d.length-1][0])/2
  var dz = bu.zip(d)
  var xnew = dz[0].map((e)=>(e-SMOOTH)/SID)
  var poly = new Polyfit(xnew, dz[1])
  var solver = poly.getPolynomial(3)
  var range = abs(max(...dz[1])-min(...dz[1]))
  var error = poly.standardError(poly.computeCoefficients(3))
  if (error > 10000*range) {
    // Very large error. Potentially due to ill-conditioned matrices
    console.log(
      "butil.smooth: Possible ill-conditioned polyfit. Reducing dimension.")
    solver = poly.getPolynomial(2)
  }

  return (x) =>(solver((x-SMOOTH)/SID))
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

/**  The value of the YBR in n days */
self.lim = (rd, g, n) => { return self.rdf(rd, g.tcur+n*SID) }

/** The bare min needed from vcur to the critical edge of the YBR in n days */
self.limd = (rd, g, n) => { return self.lim(rd, g, n) - g.vcur }

return self

})); // END MAIN ---------------------------------------------------------------
