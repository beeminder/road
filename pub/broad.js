/*!
 * broad
 *
 * Dependencies: moment, blib
 * 
 * Javascript library of road utilities for beebrain, provided as a
 * UMD module. Provides a "broad" function, which can be used to
 * construct independent broad objects each with their unique ID.
 *
 * The following member variables and methods are exported within
 * constructed broad objects:
 *
 * Copyright © 2018 Uluc Saranli
 */
;((function (root, factory) {
  'use strict'
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    console.log("broad: Using AMD module definition")
    define(['moment', 'blib'], factory)
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.    
    console.log("broad: Using CommonJS module.exports")
    module.exports = factory(require('moment'), require('blib'))
  } else {
    console.log("broad: Using Browser globals")
    root.broad = factory(root.moment, root.blib)
  }
})(this, function (moment, bl) {
  'use strict'

  var gid = 1,
  broad = function() {
    console.debug("broad constructor ("+gid+")")
    var self = this,
        curid = gid
    gid++

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
        if (!bl.nearlyEqual(rda[i].end[0], rdb[i].end[0], 10)) return false
        if (!bl.nearlyEqual(rda[i].end[1], rdb[i].end[1], 10)) return false
        if (!bl.nearlyEqual(rda[i].slope, rdb[i].slope, 1e-14)) return false
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
     chosen to be automatically computed. If usetable is true,
     autocompute parameter selections from the table are used */
    self.fixRoadArray = function( rd, autop=self.RP.VALUE, usetable=false, 
                                  edited=self.RP.VALUE) {
      var nr = rd.length;
      // Fix the special first road segment, whose slope will always be 0.
      rd[0].sta[0] = rd[0].end[0] - 100*bl.DIY*bl.SID;
      rd[0].sta[1] = rd[0].end[1];
      
      // Iterate through the remaining segments until the last one
      for (var i = 1; i < nr-1; i++) {
        //console.debug("before("+i+"):[("+rd[i].sta[0]+","+rd[i].sta[1]+"),("+rd[i].end[0]+","+rd[i].end[1]+"),"+rd[i].slope+"]");
        if (usetable) autop = rd[i].auto;
        
        var difftime = rd[i].end[0] - rd[i].sta[0]; 
        var diffval = rd[i].end[1] - rd[i].sta[1]; 
        
        rd[i].sta[0] = rd[i-1].end[0];
        rd[i].sta[1] = rd[i-1].end[1];
        
        if (autop == self.RP.DATE) {
          if (isFinite(rd[i].slope) && rd[i].slope != 0) {
            rd[i].end[0] = bl.daysnap(
              rd[i].sta[0]+(rd[i].end[1]-rd[i].sta[1])/rd[i].slope);
          }
          // Sanity check
          if (rd[i].end[0] <= rd[i].sta[0]) {
            rd[i].end[0] = bl.daysnap(rd[i].sta[0]+bl.SID);
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
          rd[i].slope = self.roadSegmentSlope(rd[i]);
        } else if (autop == self.RP.SLOPE) {
          rd[i].slope = self.roadSegmentSlope(rd[i]);
        }
        //console.debug("after("+i+"):[("+rd[i].sta[0]+","+rd[i].sta[1]+"),("+rd[i].end[0]+","+rd[i].end[1]+"),"+rd[i].slope+"]");
      }
      
      // Fix the last segment
      if (nr > 1) {
        rd[nr-1].sta[0] = rd[nr-2].end[0];
        rd[nr-1].sta[1] = rd[nr-2].end[1];
        rd[nr-1].end[0] = rd[nr-1].sta[0] + 100*bl.DIY*bl.SID;
        rd[nr-1].end[1] = rd[nr-1].sta[1];
      }
    }

    /** Good delta: Returns the delta from the given point to the
     centerline of the road but with the sign such that being on the
     good side of the road gives a positive delta and being on the
     wrong side gives a negative delta. */
    self.gdelt = function( rd, goal, t, v ) {
      return bl.chop( goal.yaw*(v - self.rdf(rd, t)));
    }

    // TODO: Test
    self.lanage = function( rd, goal, t, v, l = null ) {
      var ln = self.lnf( rd, goal, t );
      if (l == null) l = (goal.noisy)?Math.max(ln, goal.nw):ln;
      var d = v - self.rdf(rd, t);
      if (bl.chop(l) == 0) 
      return Math.round((bl.chop(d) == 0.0)?goal.yaw:Math.sign(d)*666);
      var x = bl.ichop(d/l);
      var fracp = x % 1;
      var intp = x -fracp;
      if (fracp > .99999999) {
        intp += 1;
        fracp = 0;
      }
      if (bl.chop(fracp) == 0) {
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
      while (self.aok( rd, goal, t+x*bl.SID, vpess, elnf( t+x*bl.SID ) ) 
           && t+x*bl.SID <= Math.max(goal.tfin, t)) {
        x += 1; // walk forward until we're off the YBR
        //if (t+x*SID > tnow) xt += 1;
        vpess += (goal.yaw*goal.dir < 0)?2*self.rtf(rd, t+x*bl.SID)*bl.SID:0;
      }
      if (goal.noisy && self.gdelt(rd,goal,t,v) >= 0) x = Math.max(2, x);
      return x;
    }

    // Days To Centerline: Count the integer days till you cross the
    // centerline/tfin if nothing reported
    self.dtc = function(rd, goal, t, v) {
      var x = 0;
      while(self.gdelt(rd, goal, t+x*bl.SID, v) >= 0 && t+x*bl.SID <= goal.tfin)
        x += 1; // dpl
      return x;
    }
    
    // Given the endpt of the last road segment (tprev,vprev) and 2 out of 3 of
    //   t = goal date for a road segment (unixtime)
    //   v = goal value 
    //   r = rate in hertz (s^-1), ie, road rate per second
    // return the third, namely, whichever one is passed in as null.
    self.tvr = function(tprev, vprev, t, v, r) {
    
      if (t == null) {
        if (r == 0) return bl.BDUSK
        else  return Math.min(bl.BDUSK, tprev + (v-vprev)/r)
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
      road.unshift( [goal.tini, goal.vini, 0, 0] )
      for (var i = 1; i < road.length; i++)
        road[i] = nextrow(road[i-1], road[i])
      road.forEach( e => (e[2] = (null==e[2])?e[2]:e[2]*goal.siru))
      return road
    }

    // Computes the slope of the supplied road array at the given timestamp
    self.rtf = function(rd, t) {
      var i = self.findRoadSegment( rd, t );
      return (rd[i].slope);
    }

    self.lnfraw = function( rd, goal, x ) {
      var t = rd.map(elt => elt.end[0]);
      var r = rd.map(elt => Math.abs(elt.slope)*bl.SID );
      // pretend flat spots have the previous or next non-flat rate
      var rb = r.slice(), i;
      for (i = 1; i < rb.length; i++) 
        if (Math.abs(rb[i]) < 1e-9 || !isFinite(rb[i])) rb[i] = rb[i-1];
      var rr = r.reverse();
      var rf = rr.slice();
      for (i = 1; i < rf.length; i++) 
        if (Math.abs(rf[i]) < 1e-9 || !isFinite(rf[i])) rf[i] = rf[i-1];
      rf = rf.reverse();
      
      r = bl.zip([rb,rf]).map(e => bl.argmax(Math.abs, [e[0],e[1]]) );
      var valdiff = self.rdf( rd, x ) - self.rdf( rd, x-bl.SID );
      i = self.findRoadSegment(rd, x);
      return Math.max(Math.abs(valdiff), r[i]);
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
        if (data[i][1] == 0) curadd += prev;
        prev = data[i][1];
        data[i][1] += curadd;
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
      if (goal.yaw==0 && Math.abs(l) > 1.0) return bl.Cols.GRNDOT;
      if (goal.yaw==0 && (l==0 && l==1.0)) return bl.Cols.BLUDOT;
      if (goal.yaw==0 && l == -1.0) return bl.Cols.ORNDOT;
      if (l*goal.yaw >=  2.0) return bl.Cols.GRNDOT;
      if (l*goal.yaw ==  1.0) return bl.Cols.BLUDOT;
      if (l*goal.yaw == -1.0) return bl.Cols.ORNDOT;
      if (l*goal.yaw <= -2.0) return bl.Cols.REDDOT;
      return bl.Cols.BLCK;
    }

    self.isLoser = function(rd, goal, data, t, v) {
      return (self.dotcolor( rd, goal, t, v ) === bl.Cols.REDDOT 
            && self.dotcolor(rd, goal,t-bl.SID,
                             self.stepFunc(data,t-bl.SID))===bl.Cols.REDDOT);
    }

    // For noisy graphs, compute the lane width (or half aura width)
    // based on data.  Specifically, get the list of daily deltas
    // between all the points, but adjust each delta by the road rate
    // (eg, if the delta is equal to the delta of the road itself,
    // that's an adjusted delta of 0).  Return the 90% quantile of
    // those adjusted deltas.
    self.noisyWidth = function(rd, d) {
      if (d.length <= 1) return 0;
      var p = bl.partition(d,2,1), el, ad = [];
      var t,v,u,w;
      for (var i = 0; i < p.length; i++) {
        t = p[i][0][0];
        v = p[i][0][1];
        u = p[i][1][0];
        w = p[i][1][1];
        ad.push(Math.abs(w-v-self.rdf(rd,u)+self.rdf(rd,t))/(u-t)*bl.SID);
      }
      return bl.chop((ad.length==1)?ad[0]:bl.quantile(ad, .90));
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
        if (i > -n && d[i][0] - d[i-1][0] <= bl.SID) 
          nw = Math.max(nw, Math.abs(d[i][1] - self.rdf(rd,d[i][0])));
      }
      return bl.chop(nw);
    }


  }

  return new broad()
}));

