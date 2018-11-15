/*!
 * broad
 *
 * Dependencies: moment, butil
 * 
 * Javascript library of road utilities for beebrain, provided as a
 * UMD module. Returns a "broad" object, whose public members provide
 * a number of road related constants and functions. Does not hold any
 * internal state.
 *
 * The following member variables and methods are provided:
 *
 * Copyright © 2018 Uluc Saranli
 */
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
    module.exports = factory(require('moment'), require('Polyfit'), 
                             require('butil'))
  } else {
    //console.log("broad: Using Browser globals")
    root.broad = factory(root.moment, root.Polyfit, root.butil)
  }
})(this, function (moment, Polyfit, bu) {
  'use strict'

  var broad = function() {
    var self = this

    self.AGGR = {
      last     : function(x) { return x[x.length-1] },
      first    : function(x) { return x[0] },
      min      : function(x) { return bu.arrMin(x) },
      max      : function(x) { return bu.arrMax(x) },
      truemean : function(x) { return bu.mean(x) },
      uniqmean : function(x) { return bu.mean(bu.deldups(x)) },
      mean     : function(x) { return bu.mean(bu.deldups(x)) },
      median   : function(x) { return bu.median(x) },
      mode     : function(x) { return bu.mode(x) },
      trimmean : function(x) { return bu.mean(x) }, // Uluc: did not bother 
      sum      : function(x) { return bu.sum(x) },
      jolly    : function(x) { return (x.length > 0)?1:0 },
      binary   : function(x) { return (x.length > 0)?1:0 },
      nonzero  : bu.nonzero,
      triangle : function(x) { return bu.sum(x)*(bu.sum(x)+1)/2 },
      square   : function(x) { return Math.pow(bu.sum(x),2) },
      clocky   : function(x) { return bu.clocky(x) /*sum of pair diff.*/ },
      count    : function(x) { return x.length /* number of datapoints*/ },
      kyshoc   : function(x) { return Math.min(2600, bu.sum(x)) }, /* ad hoc, guineapigging*/
      skatesum : function(x) { return Math.min(6666, bu.sum(x)) } /* only count the daily min. TODO: Cannot use rfin here. No idea what this is for*/
    }

    /** Enum object to identify field types for road segments. */
    self.RP = { DATE:0, VALUE:1, SLOPE:2}

    self.printRoad = function( rd ) {
      for (var i = 0; i < rd.length; i++) {
        var segment = rd[i]
        console.debug("[("+segment.sta[0]+","+segment.sta[1]+"),("
                      +segment.end[0]+","+segment.end[1]+"),"
                      +segment.slope+", auto="+segment.auto+"]")
      }
    }

    self.sameRoads = function( rda, rdb ) {
      if (rda.length != rdb.length) return false
      for (var i = 0; i < rda.length; i++) {
        if (!bu.nearlyEqual(rda[i].end[0], rdb[i].end[0], 10)) return false
        if (!bu.nearlyEqual(rda[i].end[1], rdb[i].end[1], 10)) return false
        if (!bu.nearlyEqual(rda[i].slope, rdb[i].slope, 1e-14)) return false
      }
      return true
    }

    /** Creates and returns a clone of the supplied road array */
    self.copyRoad = function( rd ) {
      var newroad = [];
      for (var i = 0; i < rd.length; i++) {
        var segment = {
          sta: rd[i].sta.slice(), end: rd[i].end.slice(),
          slope: rd[i].slope, auto: rd[i].auto };
        newroad.push(segment);
      }
      return newroad;
    }

    /** Finds index for the road segment containing the supplied x value */
    self.findRoadSegment = function(rd, x) {
      var found = -1;
      for (var i = 0; i < rd.length; i++) {
        if ((x >= rd[i].sta[0]) && (x < rd[i].end[0])) {
          found = i;
          break;
        }
      }
      return found;
    }

    /** Computes the slope of the supplied road segment */
    self.roadSegmentSlope = function(rd) {
      return (rd.end[1] - rd.sta[1]) / (rd.end[0] - rd.sta[0]);
    }
    
    /** Computes the value of a road segment at the given timestamp */
    self.roadSegmentValue = function(rdseg, x) {
      return rdseg.sta[1] + rdseg.slope*(x - rdseg.sta[0]);
    }
    
    /** Computes the value of a road array at the given timestamp */
    self.rdf = function(rd, x) {
      var i = self.findRoadSegment(rd, x);
      return self.roadSegmentValue( rd[i], x );
    }

    /** Recomputes the road array starting from the first node and
     assuming that the one of slope, enddate or endvalue parameters is
     chosen to be automatically computed. If usematrix is true,
     autocompute parameter selections from the road matrix are used */
    self.fixRoadArray = function( rd, autop=self.RP.VALUE, usematrix=false, 
                                  edited=self.RP.VALUE) {
      var nr = rd.length;
      // Fix the special first road segment, whose slope will always be 0.
      rd[0].sta[0] = rd[0].end[0] - 100*bu.DIY*bu.SID;
      rd[0].sta[1] = rd[0].end[1];

      // Iterate through the remaining segments until the last one
      for (var i = 1; i < nr-1; i++) {
        //console.debug("before("+i+"):[("+rd[i].sta[0]+","+rd[i].sta[1]+"),("+rd[i].end[0]+","+rd[i].end[1]+"),"+rd[i].slope+"]");
        if (usematrix) autop = rd[i].auto;
        
        var difftime = rd[i].end[0] - rd[i].sta[0]; 
        var diffval = rd[i].end[1] - rd[i].sta[1]; 
        
        rd[i].sta[0] = rd[i-1].end[0];
        rd[i].sta[1] = rd[i-1].end[1];
        
        if (autop == self.RP.DATE) {
          if (isFinite(rd[i].slope) && rd[i].slope != 0) {
            rd[i].end[0] = bu.daysnap(
              rd[i].sta[0]+(rd[i].end[1]-rd[i].sta[1])/rd[i].slope);
          }
          // Sanity check
          if (rd[i].end[0] <= rd[i].sta[0]) {
            rd[i].end[0] = bu.daysnap(rd[i].sta[0]+bu.SID);
          }
          if (edited == self.RP.SLOPE) {
            // Readjust value if slope was edited
            rd[i].end[1] = 
              rd[i].sta[1]+rd[i].slope*(rd[i].end[0]-rd[i].sta[0]);
          } else {
            // Readjust value if value was edited
            rd[i].slope = self.roadSegmentSlope(rd[i]);
          }
        } else if (autop == self.RP.VALUE) {
          if (isFinite(rd[i].slope)) {
            rd[i].end[1] = rd[i].sta[1]+rd[i].slope
              *(rd[i].end[0]-rd[i].sta[0]);
          } else {
            // If slope is infinite, preserve previous delta
            rd[i].end[1] = rd[i].sta[1]+diffval;
          }
          // TODO: Commented this out, but verify graph during generation
          // if (difftime != 0 && diffval != 0)
          //   rd[i].slope = self.roadSegmentSlope(rd[i]);
        } else if (autop == self.RP.SLOPE) {
          rd[i].slope = self.roadSegmentSlope(rd[i]);
        }
        //console.debug("after("+i+"):[("+rd[i].sta[0]+","+rd[i].sta[1]+"),("+rd[i].end[0]+","+rd[i].end[1]+"),"+rd[i].slope+"]");
      }
      
      // Fix the last segment
      if (nr > 1) {
        rd[nr-1].sta[0] = rd[nr-2].end[0];
        rd[nr-1].sta[1] = rd[nr-2].end[1];
        rd[nr-1].end[0] = rd[nr-1].sta[0] + 100*bu.DIY*bu.SID;
        rd[nr-1].end[1] = rd[nr-1].sta[1];
      }
    }

    /** Good delta: Returns the delta from the given point to the
     centerline of the road but with the sign such that being on the
     good side of the road gives a positive delta and being on the
     wrong side gives a negative delta. */
    self.gdelt = function( rd, goal, t, v ) {
      return bu.chop( goal.yaw*(v - self.rdf(rd, t)));
    }

    // TODO: Test
    self.lanage = function( rd, goal, t, v, l = null ) {
      var ln = self.lnf( rd, goal, t );
      if (l == null) l = (goal.noisy)?Math.max(ln, goal.nw):ln;
      var d = v - self.rdf(rd, t);
      if (bu.chop(l) == 0) 
      return Math.round((bu.chop(d) == 0.0)?goal.yaw:Math.sign(d)*666);
      var x = bu.ichop(d/l);
      var fracp = x % 1;
      var intp = x -fracp;
      if (fracp > .99999999) {
        intp += 1;
        fracp = 0;
      }
      if (bu.chop(fracp) == 0) {
        if (goal.yaw > 0 && intp >= 0) return Math.round(intp+1);
        if (goal.yaw < 0 && intp <= 0) return Math.round(intp-1);
        return Math.round(Math.sign(x)*Math.ceil(Math.abs(x)));
      }
      return Math.round(Math.sign(x)*Math.ceil(Math.abs(x)));
    }

    // TODO: Test
    // Whether the given point is on the road if the road has lane width l
    self.aok = function( rd, goal, t, v, l ) {
      return ((self.lanage(rd, goal, t, v, l) * goal.yaw >= -1.0));
    }

    // TODO: Test
    // Returns the number of days to derail for the current road
    // TODO: There are some issues with computing tcur, vcur
    self.dtd = function( rd, goal, t, v ) {
      var tnow = goal.tcur;
      var fnw = (self.gdelt(rd, goal, t,v) >= 0)?0.0:goal.nw;// future noisy width
      var elnf = function(x) {
        return Math.max(self.lnf(rd,goal,x),fnw);};//eff. lane width

      var x = 0; // the number of steps  
      var vpess = v; // the value as we walk forward w/ pessimistic presumptive reports  
      while (self.aok( rd, goal, t+x*bu.SID, vpess, elnf( t+x*bu.SID ) ) 
           && t+x*bu.SID <= Math.max(goal.tfin, t)) {
        x += 1; // walk forward until we're off the YBR
        //if (t+x*SID > tnow) xt += 1;
        vpess += (goal.yaw*goal.dir < 0)?2*self.rtf(rd, t+x*bu.SID)*bu.SID:0;
      }
      if (goal.noisy && self.gdelt(rd,goal,t,v) >= 0) x = Math.max(2, x);
      return x;
    }

    // Days To Centerline: Count the integer days till you cross the
    // centerline/tfin if nothing reported
    self.dtc = function(rd, goal, t, v) {
      var x = 0;
      while(self.gdelt(rd, goal, t+x*bu.SID, v) >= 0 && t+x*bu.SID <= goal.tfin)
        x += 1; // dpl
      return x;
    }

    // What delta from the centerline yields n days of safety buffer till centerline?
    self.bufcap = function(rd, goal, n=7) {
      var t = goal.tcur, v = self.rdf(rd, t), r = self.rtf(rd, t), d, i
      if (r == 0) r = goal.lnw
      r = Math.abs(r)
      d = 0
      i = 0
      while(self.dtc(rd, goal, t,v+d) < n && i <= 70) { 
        d += goal.yaw*r*bu.SID
        i += 1
      }
      return [d, i]
    }

    // Given the endpt of the last road segment (tprev,vprev) and 2 out of 3 of
    //   t = goal date for a road segment (unixtime)
    //   v = goal value 
    //   r = rate in hertz (s^-1), ie, road rate per second
    // return the third, namely, whichever one is passed in as null.
    self.tvr = function(tprev, vprev, t, v, r) {
    
      if (t == null) {
        if (r == 0) return bu.BDUSK
        else  return Math.min(bu.BDUSK, tprev + (v-vprev)/r)
      }
      if (v == null) return vprev+r*(t-tprev)
      if (r == null) {
        if (t == tprev) return 0 // special case: zero-length road segment
        return (v-vprev)/(t-tprev)
      }
      return 0
    }

    /** Helper for fillroad for propagating forward filling in all the nulls */
    var nextrow = function (oldrow, newrow){
      var tprev = oldrow[0], vprev = oldrow[1], rprev = oldrow[2], n = oldrow[3]

      var t = newrow[0], v = newrow[1], r = newrow[2]
      var x = self.tvr(tprev, vprev, t,v,r) // the missing t, v, or r
      if (t == null) return [x, v, r, 0]
      if (v == null) return [t, x, r, 1]
      if (r == null) return [t, v, x, 2]
      return [t, v, x, 0]
    }

    /** Takes road matrix (with last row appended) and fills it in. Also adds a 
     column, n, giving the position (0, 1, or 2) of the original null. */
    self.fillroad = function(road, goal) {
      road.forEach( e => (e[2] = (null==e[2])?e[2]:e[2]/goal.siru))
      road[0] = nextrow([goal.tini, goal.vini, 0, 0], road[0])
      //road.unshift( [goal.tini, goal.vini, 0, 0] )
      for (var i = 1; i < road.length; i++)
        road[i] = nextrow(road[i-1], road[i])
      road.forEach( e => (e[2] = (null==e[2])?e[2]:e[2]*goal.siru))
      return road
    }

    /** Version of fillroad that assumes tini/vini is the first row of road */
    self.fillroadall = function(road, goal) {
      var tini = road[0][0], vini = road[0][1]
      road.splice(0,1)
      road.forEach( e => (e[2] = (null==e[2])?e[2]:e[2]/goal.siru))
      road[0] = nextrow([tini, vini, 0, 0], road[0])
      for (var i = 1; i < road.length; i++)
        road[i] = nextrow(road[i-1], road[i])
      road.forEach( e => (e[2] = (null==e[2])?e[2]:e[2]*goal.siru))
      road.unshift([tini, vini, 0, 2])
      return road
    }

    // Computes the slope of the supplied road array at the given timestamp
    self.rtf = function(rd, t) {
      var i = self.findRoadSegment( rd, t );
      return (rd[i].slope);
    }

    // TODO: It seems like I need to fix the lnf implementation based on the new beebrain
    self.lnfraw = function( rd, goal, x ) {
      var r0 = bu.deldups(rd, e=>e.end[0])
      var t = r0.map(elt => elt.end[0]);
      var r = r0.map(elt => Math.abs(elt.slope)*bu.SID );
      // pretend flat spots have the previous or next non-flat rate
      var rb = r.slice(), i;
      for (i = 1; i < rb.length; i++) 
        if (Math.abs(rb[i]) < 1e-7 || !isFinite(rb[i])) rb[i] = rb[i-1];
      var rr = r.reverse();
      var rf = rr.slice();
      for (i = 1; i < rf.length; i++) 
        if (Math.abs(rf[i]) < 1e-7 || !isFinite(rf[i])) rf[i] = rf[i-1];
      rf = rf.reverse();
      r = bu.zip([rb,rf]).map(e => bu.argmax(Math.abs, [e[0],e[1]]) );
      t.pop()
      r.splice(0,1)
      var rtf0 = self.stepify(bu.zip([t,r]))
      var valdiff = self.rdf( rd, x ) - self.rdf( rd, x-bu.SID );
      return Math.max(Math.abs(valdiff), rtf0(x));
    }

    // TODO: Test
    self.lnf = function( rd, goal, x ) {
      if (goal.abslnw != null) return goal.abslnw;
      return self.lnfraw( rd, goal, x );
    }

    self.odomify = function( data ) {
      var ln = data.length;
      if (ln == 0) return;
      var curadd = 0;
      var prev = data[0][1];
      for (var i=1; i<ln; i++) {
        if (data[i][1] == 0) {curadd += prev}
        prev = data[i][1];
        data[i][1] += curadd
      }
    }

    // Utility function for stepify
    self.stepFunc = function( data, x, dflt=0 ) {
      if (x < data[0][0]) return dflt;
      var prevval = data[0][1];
      for (var i = 0; i < data.length; i++) {
        if (data[i][0] > x) return prevval;
        else  prevval = data[i][1];
      }
      return data[data.length-1][1];
    }

    // Take a list of datapoints sorted by x-value and returns a pure
    // function that interpolates a step function from the data,
    // always mapping to the most recent value. Cf
    // http://stackoverflow.com/q/6853787
    self.stepify = function( data, dflt=0 ) {
      if (data == null) return (x => dflt);
      return (x => self.stepFunc(data, x, dflt));
    }

    // Appropriate color for a datapoint
    self.dotcolor = function( rd, goal, t, v) {
      var l = self.lanage( rd, goal, t, v );
      if (goal.yaw==0 && Math.abs(l) > 1.0) return bu.Cols.GRNDOT;
      if (goal.yaw==0 && (l==0 && l==1.0)) return bu.Cols.BLUDOT;
      if (goal.yaw==0 && l == -1.0) return bu.Cols.ORNDOT;
      if (l*goal.yaw >=  2.0) return bu.Cols.GRNDOT;
      if (l*goal.yaw ==  1.0) return bu.Cols.BLUDOT;
      if (l*goal.yaw == -1.0) return bu.Cols.ORNDOT;
      if (l*goal.yaw <= -2.0) return bu.Cols.REDDOT;
      return bu.Cols.BLCK;
    }

    self.isLoser = function(rd, goal, data, t, v) {
      if (goal.offred)
        return self.dotcolor(rd, goal, t-bu.SID, goal.dtf(t-bu.SID))
      else
        return (self.dotcolor( rd, goal, t, v ) === bu.Cols.REDDOT 
                && self.dotcolor(rd, goal,t-bu.SID, goal.dtf(data,t-bu.SID))===bu.Cols.REDDOT);
    }

    // For noisy graphs, compute the lane width (or half aura width)
    // based on data.  Specifically, get the list of daily deltas
    // between all the points, but adjust each delta by the road rate
    // (eg, if the delta is equal to the delta of the road itself,
    // that's an adjusted delta of 0).  Return the 90% quantile of
    // those adjusted deltas.
    self.noisyWidth = function(rd, d) {
      if (d.length <= 1) return 0;
      var p = bu.partition(d,2,1), el, ad = [];
      var t,v,u,w;
      for (var i = 0; i < p.length; i++) {
        t = p[i][0][0];
        v = p[i][0][1];
        u = p[i][1][0];
        w = p[i][1][1];
        ad.push(Math.abs(w-v-self.rdf(rd,u)+self.rdf(rd,t))/(u-t)*bu.SID);
      }
      return bu.chop((ad.length==1)?ad[0]:bu.quantile(ad, .90));
    }

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
    self.autowiden = function(rd, goal, d, nw) {
      var n = d, length, i=-1;
      if (n <= 1) return 0;
      if (self.gdelt(rd, goal, d[d.length-1][0], d[d.length-1][1]) < 0) {
        while (i >= -n && self.gdelt(rd, goal, d[i][0], d[i][1]) < 0) i -= 1;
        i += 1;
        if (i > -n && d[i][0] - d[i-1][0] <= bu.SID) 
          nw = Math.max(nw, Math.abs(d[i][1] - self.rdf(rd,d[i][0])));
      }
      return bu.chop(nw);
    }


    // Used with grAura() and for computing mean and meandelt,
    // this adds dummy datapoints on every day that doesn't have a
    // datapoint, interpolating linearly.
    self.gapFill = function(d) {
      var interp = function (before, after, atPoint) {
        return before + (after - before) * atPoint;
      };
      var start = d[0][0], end = d[d.length-1][0];
      var n = Math.floor((end-start)/bu.SID);
      var out = Array(n), i, j = 0, t = start;
      for (i = 0; i < d.length-1; i++) {
        var den = (d[i+1][0]-d[i][0]);
        while (t <= d[i+1][0]) {
          out[j] = [t,interp(d[i][1], d[i+1][1], (t-d[i][0])/den)];
          j++; t += bu.SID;
        }
      }
      if (out.length == 0) out.push(d[0])
      return out;
    }

    // Return a pure function that fits the data smoothly, used by grAura
    self.smooth = function(data) {
      var SMOOTH = (data[0][0] + data[data.length-1][0])/2;
      var dz = bu.zip(data);
      var xnew = dz[0].map(function(e){return e-SMOOTH;});
      var poly = new Polyfit(xnew, dz[1]);
      var solver = poly.getPolynomial(3);
      return function(x){ return solver(x-SMOOTH);};
    }

    // Assumes both datapoints and the x values are sorted
    self.interpData = function (d, xv) {
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

    // The value of the relevant/critical edge of the YBR in n days
    self.lim = function(rd, goal, n) {
      var t = goal.tcur+n*bu.SID
      return self.rdf(rd, t)
        - Math.sign(goal.yaw)
        *(goal.noisy?(Math.max(goal.nw, self.lnf(rd, goal, t))):self.lnf(rd, goal, t))
    }

    // The bare minimum needed from vcur to the critical edge of the YBR in n days
    self.limd = function(rd, goal, n) {
      var x = self.lim(rd, goal, n)-goal.vcur
      if (!goal.integery) return x
      if (goal.yaw>0 && goal.dir>0 && x>0) return Math.ceil(x)  // MOAR
      if (goal.yaw<0 && goal.dir<0 && x<0) return Math.floor(x) // PHAT
      if (goal.yaw<0 && goal.dir>0 && x>0) return Math.floor(x) // WEEN
      if (goal.yaw>0 && goal.dir<0 && x<0) return Math.ceil(x)  // RASH
      return x
    }
  }

  return new broad()
}));

