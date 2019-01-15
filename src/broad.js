;((function (root, factory) {
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
    module.exports = factory(require('moment'), require('./polyfit'), 
                             require('./butil'))
  } else {
    //console.log("broad: Using Browser globals")
    root.broad = factory(root.moment, root.Polyfit, root.butil)
  }
})(this, function (moment, Polyfit, bu) {
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
    last     : (x) =>(x[x.length-1]),
    first    : (x) =>(x[0]),
    min      : (x) =>(bu.arrMin(x)),
    max      : (x) =>(bu.arrMax(x)),
    truemean : (x) =>(bu.mean(x)),
    uniqmean : (x) =>(bu.mean(bu.deldups(x))),
    mean     : (x) =>(bu.mean(bu.deldups(x))),
    median   : (x) =>(bu.median(x)),
    mode     : (x) =>(bu.mode(x)),
    trimmean : (x) =>(bu.mean(x)), // Uluc: did not bother 
    sum      : (x) =>(bu.sum(x)),
    jolly    : (x) =>((x.length > 0)?1:0),
    binary   : (x) =>((x.length > 0)?1:0),
    nonzero  : bu.nonzero,
    triangle : (x) =>(bu.sum(x)*(bu.sum(x)+1)/2),
    square   : (x) =>(Math.pow(bu.sum(x),2)),
    clocky   : bu.clocky, /*sum of pair diff.*/
    count    : (x) =>(x.length /* number of datapoints*/ ),
    kyshoc   : (x) =>(Math.min(2600, bu.sum(x)) ), /* ad hoc, guineapigging*/
    skatesum : (x) =>(Math.min(self.rfin, bu.sum(x)) ) /* only count the daily min. TODO: FIXHACK?: Introduced internal state for rfin*/
  }

  /** Enum object to identify field types for road segments. 
      @enum {number} */
  self.RP = { DATE:0, VALUE:1, SLOPE:2}
  
  /** Pretty prints a given array of road segments.
      @param {Array} rd Array of road segment objects */
  self.printRoad = ( rd ) => {
    for (let i = 0; i < rd.length; i++) {
      var s = rd[i]
      console.debug("[("+s.sta[0]+"("+bu.formatDate(s.sta[0])+"),"+s.sta[1]+"),("+s.end[0]+"("+bu.formatDate(s.end[0])+"),"+s.end[1]+"),"
                    +s.slope+", auto="+s.auto+"]")
    }
  }

  /** Checks whether two road arrays are identical with nearEq segments.
      @param rda First array fo road segments
      @param rdb Second array fo road segments
 */
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
  self.copyRoad = ( rd ) => {
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
    if (dir < 0) while(s > 0 && rd[s-1].sta[0] == x) s--
    if (dir > 0) while(s < nums-1 && rd[s+1].sta[0] == x) s++
    return s
  }

  /** Computes the slope of the supplied road segment */
  self.segSlope = (rd) => ((rd.end[1] - rd.sta[1]) / (rd.end[0] - rd.sta[0]))
  
  /** Computes the value of a road segment at the given timestamp */
  self.segValue = (rdseg, x) =>(rdseg.sta[1] + rdseg.slope*(x - rdseg.sta[0]))
  
  /** Computes the value of a road array at the given timestamp */
  self.rdf = (rd, x) => (self.segValue( rd[self.findSeg(rd, x)], x ))

  /** Recomputes the road array starting from the first node and
      assuming that the one of slope, enddate or endvalue parameters is
      chosen to be automatically computed. If usematrix is true,
      autocompute parameter selections from the road matrix are used */
  self.fixRoadArray = ( rd, autop=self.RP.VALUE, usematrix=false, 
                        edited=self.RP.VALUE) => {
                          var nr = rd.length
                          // Fix the special first road segment, whose slope will always be 0.
                          rd[0].sta[0] = rd[0].end[0] - 100*bu.DIY*bu.SID
                          rd[0].sta[1] = rd[0].end[1]

                          // Iterate through the remaining segments until the last one
                          for (let i = 1; i < nr-1; i++) {
                            //console.debug("before("+i+"):[("+rd[i].sta[0]+","+rd[i].sta[1]+"),("+rd[i].end[0]+","+rd[i].end[1]+"),"+rd[i].slope+"]");
                            if (usematrix) autop = rd[i].auto
                            
                            var dv = rd[i].end[1] - rd[i].sta[1] 
                            
                            rd[i].sta[0] = rd[i-1].end[0]
                            rd[i].sta[1] = rd[i-1].end[1]
                            
                            if (autop == self.RP.DATE) {
                              if (isFinite(rd[i].slope) && rd[i].slope != 0) {
                                rd[i].end[0] = bu.daysnap(
                                  rd[i].sta[0]+(rd[i].end[1]-rd[i].sta[1])/rd[i].slope)
                              }
                              // Sanity check
                              if (rd[i].end[0] <= rd[i].sta[0])
                                rd[i].end[0] = bu.daysnap(rd[i].sta[0]+bu.SID)

                              if (edited == self.RP.SLOPE)
                                // Readjust value if slope was edited
                                rd[i].end[1] = 
                                rd[i].sta[1]+rd[i].slope*(rd[i].end[0]-rd[i].sta[0])
                              else
                                // Readjust value if value was edited
                                rd[i].slope = self.segSlope(rd[i])
                            } else if (autop == self.RP.VALUE) {
                              if (isFinite(rd[i].slope))
                                rd[i].end[1] = rd[i].sta[1]+rd[i].slope
                                *(rd[i].end[0]-rd[i].sta[0])
                              else
                                // If slope is infinite, preserve previous delta
                                rd[i].end[1] = rd[i].sta[1]+dv

                            } else if (autop == self.RP.SLOPE)
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
  self.gdelt = ( rd, goal, t, v ) =>(bu.chop( goal.yaw*(v - self.rdf(rd, t))))

  // The bottom lane is -1, top lane is 1, below the road is -2,
  // above is +2, etc.

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
    if (l == null) l = (goal.noisy)?Math.max(ln, goal.nw):ln
    var d = v - self.rdf(rd, t)
    if (bu.chop(l) == 0) 
      return rnd((bu.chop(d) == 0.0)?goal.yaw:Math.sign(d)*666)
    var x = bu.ichop(d/l)
    var fracp = x % 1
    var intp = x -fracp
    if (fracp > .99999999) {
      intp += 1
      fracp = 0
    }
    if (bu.chop(fracp) == 0) {
      if (goal.yaw > 0 && intp >= 0) return rnd(intp+1)
      if (goal.yaw < 0 && intp <= 0) return rnd(intp-1)
      return rnd(Math.sign(x)*Math.ceil(Math.abs(x)))
    }
    return rnd(Math.sign(x)*Math.ceil(Math.abs(x)))
  }

  /** Whether the given point is on the road if the road has lane width l */
  self.aok = ( rd, g, t, v, l )=>(((self.lanage(rd, g, t, v, l) * g.yaw >= -1.0)))

  /** Returns the number of days to derail for the current road
      TODO: There are some issues with computing tcur, vcur */
  self.dtd = ( rd, goal, t, v ) => {
    var tnow = goal.tcur
    var fnw = (self.gdelt(rd, goal, t,v) >= 0)?0.0:goal.nw // future noisy width
    var elnf = (x) => (Math.max(goal.lnf(x),fnw)) //eff. lane width

    var x = 0 // the number of steps  
    var vpess = v // the value as we walk forward w/ pessimistic presumptive reports
    while (self.aok( rd, goal, t+x*bu.SID, vpess, elnf( t+x*bu.SID ) ) 
           && t+x*bu.SID <= Math.max(goal.tfin, t)) {
      x += 1 // walk forward until we're off the YBR
      //if (t+x*SID > tnow) xt += 1;
      vpess += (goal.yaw*goal.dir < 0)?2*self.rtf(rd, t+x*bu.SID)*bu.SID:0
    }
    if (goal.noisy && self.gdelt(rd,goal,t,v) >= 0) x = Math.max(2, x)
    return x
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
    if (r == 0) r = g.lnw
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
    
    if (t == null) {
      if (r == 0) return bu.BDUSK
      else  return Math.min(bu.BDUSK, tp + (v-vp)/r)
    }
    if (v == null) return vp+r*(t-tp)
    if (r == null) {
      if (t == tp) return 0 // special case: zero-length road segment
      return (v-vp)/(t-tp)
    }
    return 0
  }

  /** Helper for fillroad for propagating forward filling in all the nulls */
  var nextrow =  (or, nr) => {
    var tprev = or[0], vprev = or[1], rprev = or[2], n = or[3]

    var t = nr[0], v = nr[1], r = nr[2]
    var x = self.tvr(tprev, vprev, t,v,r) // the missing t, v, or r
    if (t == null) return [x, v, r, 0]
    if (v == null) return [t, x, r, 1]
    if (r == null) return [t, v, x, 2]
    return [t, v, x, 0]
  }

  /** Takes road matrix (with last row appended) and fills it in. Also adds a 
      column, n, giving the position (0, 1, or 2) of the original null. */
  self.fillroad = (rd, g) => {
    rd.forEach( e => (e[2] = (null==e[2])?e[2]:e[2]/g.siru))
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
    return(x => Math.max(Math.abs(self.vertseg(rd,x)?0:(self.rdf( rd, x ) - self.rdf( rd, x-bu.SID ))), rtf0(x)))
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
    if (ln == 0) return
    var curadd = 0
    var prev = d[0][1]
    for (let i=1; i<ln; i++) {
      if (d[i][1] == 0) {curadd += prev}
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
  self.stepify = (d, dflt=0) => ((d == null)?(x=>dflt):(x=>self.stepFunc(d,x,dflt)))

  // Appropriate color for a datapoint
  self.dotcolor = ( rd, g, t, v) => {
    var l = self.lanage( rd, g, t, v )
    if (g.yaw==0 && Math.abs(l) > 1.0) return bu.Cols.GRNDOT
    if (g.yaw==0 && (l==0 && l==1.0)) return bu.Cols.BLUDOT
    if (g.yaw==0 && l == -1.0) return bu.Cols.ORNDOT
    if (l*g.yaw >=  2.0) return bu.Cols.GRNDOT
    if (l*g.yaw ==  1.0) return bu.Cols.BLUDOT
    if (l*g.yaw == -1.0) return bu.Cols.ORNDOT
    if (l*g.yaw <= -2.0) return bu.Cols.REDDOT
    return bu.Cols.BLCK
  }

  self.isLoser = (rd, g, d, t, v) => 
    ((g.offred)?(self.dotcolor(rd,g,t-bu.SID, g.dtf(t-bu.SID))=== bu.Cols.REDDOT)
     :(self.dotcolor(rd,g,t,v) === bu.Cols.REDDOT 
       && self.dotcolor(rd,g,t-bu.SID,g.dtf(t-bu.SID))===bu.Cols.REDDOT))

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
    return bu.chop((ad.length==1)?ad[0]:bu.quantile(ad, .90))
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
  self.vertseg = (rd, t) => (rd.filter(e=>(e.sta[0] == t)).length > 1)

  /** Used with grAura() and for computing mean and meandelt, this
      adds dummy datapoints on every day that doesn't have a datapoint,
      interpolating linearly. */
  self.gapFill = (d) => {
    var interp = (bef, aft, atPt) =>(bef + (aft - bef) * atPt)
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
    if (out.length == 0) out.push(d[0])
    return out
  }

  /** Return a pure function that fits the data smoothly, used by grAura */
  self.smooth = (d) => {
    var SMOOTH = (d[0][0] + d[d.length-1][0])/2
    var dz = bu.zip(d)
    var xnew = dz[0].map((e)=>(e-SMOOTH))
    var poly = new Polyfit(xnew, dz[1])
    var solver = poly.getPolynomial(3)
    return (x) =>(solver(x-SMOOTH))
  }

  /** Assumes both datapoints and the x values are sorted */
  self.interpData = (d, xv) => {
    var interp = (bef, aft, atPt) =>(bef + (aft - bef) * atPt)
    var di = 0, dl = d.length, od = []
    if (dl == 0) return null
    if (dl == 1) return xv.map((d)=>[d, d[0][1]])
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
      *(g.noisy?(Math.max(g.nw, g.lnf(t))):g.lnf(t))
  }

  /** The bare minimum needed from vcur to the critical edge of the YBR in n days */
  self.limd = (rd, g, n) => {
    var x = self.lim(rd, g, n)-g.vcur
    if (!g.integery) return x
    if (g.yaw>0 && g.dir>0 && x>0) return Math.ceil(x)  // MOAR
    if (g.yaw<0 && g.dir<0 && x<0) return Math.floor(x) // PHAT
    if (g.yaw<0 && g.dir>0 && x>0) return Math.floor(x) // WEEN
    if (g.yaw>0 && g.dir<0 && x<0) return Math.ceil(x)  // RASH
    return x
  }
  return self
}));

