/*!
 * bmndr
 *
 * Copyright © 2017 Uluc Saranli
 */

;(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['d3', 'moment', 'Pikaday'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('d3', 'moment', 'Pikaday'));
    } else {
        root.bmndr = factory(root.d3, root.moment, root.Pikaday);
    }
}(this, function (d3, moment, Pikaday) {
    'use strict';


    /** default options */
    var 
    defaults = {
        divGraph:     null,   // Binds the graph to a div element
        divTable:     null,    // Binds the road table to a div element
        svgSize:      { width: 700, height: 530 },
        focusRect:    { x:0, y:0, width:700, height: 400 },
        focusPad:     { left:25, right:10, top:25, bottom:30 },
        contextRect:  { x:0, y:400, width:700, height: 80 },
        contextPad:   { left:25, right:10, top:0, bottom:30 },
        tableHeight:  540, // Choose 0 for unspecified

        zoomButton:   { size: 40, opacity: 0.7, factor: 1.5 },
        bullsEye:     { size: 40, ctxsize: 20 },
        roadDot:      { size: 5, ctxsize: 3, border: 1.5, ctxborder: 1 },
        roadKnot:     { width: 3, rmbtnscale: 0.6 },
        roadLine:     { width: 3, ctxwidth: 2 },
        oldRoadLine:  { width: 3, ctxwidth: 2, dash: 32, ctxdash: 16 },
        dataPoint:    { size: 5, flsize: 5 }, 
        horizon:      { width: 2, ctxwidth: 1, dash: 8, ctxdash: 6, 
                        font: 12, ctxfont: 9 },
        today:        { width: 2, ctxwidth: 1, font: 16, ctxfont: 9 },
        textBox:      { margin: 3 },

        roadLineCol:  { valid: "black", invalid:"#ca1212"},
        roadDotCol:   { fixed: "darkgray", editable:"#ca1212", 
                        selected: "lightgreen"},
        roadKnotCol:  { dflt: "#c2c2c2", rmbtn: "black", rmbtnsel: "red"}, 
        textBoxCol:   { bg: "#ffffff", stroke:"#d0d0d0"},
        roadTableCol: { bg:"#ffffff", bgHighlight: "#bbffbb", 
                        text:"#000000", textDisabled: "#aaaaaa"},
        dataPointCol: { future: "#909090", stroke: "lightgray"},
        halfPlaneCol: { fill: "#ffffe8" },
        pastBoxCol:   { fill: "#f0f0f0" },

        roadEditor:      false,
        showContext:     false,
        showFocusRect:   true,
        tableAutoScroll: true, // auto scrolling
        showdata:     true,
        keepslopes:   true,
        keepintervals:false,
        reversetable: false,
        
        precision: 5,
        maxFutureDays: 365,

        onRoadChange: null
    },
    mobiledefaults = {
        svgSize:      { width: 700, height: 530 },
        focusRect:    { x:0, y:0, width:700, height: 400 },
        focusPad:     { left:25, right:10, top:35, bottom:30 },
        contextRect:  { x:0, y:400, width:700, height: 80 },
        contextPad:   { left:25, right:10, top:0, bottom:30 },
        tableHeight:  540, // Choose 0 for unspecified

        zoomButton:   { size: 50, opacity: 0.7, factor: 1.5 },
        bullsEye:     { size: 40, ctxsize: 20 },
        roadDot:      { size: 10, ctxsize: 4, border: 1.5, ctxborder: 1 },
        roadKnot:     { width: 7, rmbtnscale: 0.9 },
        roadLine:     { width: 7, ctxwidth: 2 },
        oldRoadLine:  { width: 3, ctxwidth: 1 },
        dataPoint:    { size: 4, flsize: 6 }, 
        horizon:      { width: 2, ctxwidth: 1, dash: 8, ctxdash: 8, 
                        font: 16, ctxfont: 10 },
        today:        { width: 2, ctxwidth: 1, font: 16, ctxfont: 10 },
        textBox:      { margin: 3 }
    },
    
    /** Beeminder colors for datapoints */
    Cols = {
        DYEL: "#ffff66",
        LYEL: "#ffff99",
        ROSE: "#ff8080",
        AKRA: "#4C4Cff",
        PURP: "#B56bb5",
        BLUE: "#EAEAFF",
        GRUE: "#b5ffDE",
        ORNG: "#ff8000",
        WITE: "#ffffff",
        BIGG: "#ffe54c",
        PINK: "#ffe5e5",
        PNKE: "#ffcccc",
        GRAY: "#f0f0f0",
        BLCK:   "#000000",
        GRNDOT: "#00aa00", //Dark green for good side of the road
        BLUDOT: "#3f3fff", // Blue for correct lane
        ORNDOT: "#ffa500", // Orange for wrong lane
        REDDOT: "#ff0000"  // Red for off the road on the bad side
    },

    RP = {
        DATE:0, VALUE:1, SLOPE:2
    },
    DPTYPE = {
        AGGPAST:0, AGGFUTURE:1, RAWPAST:2, RAWFUTURE:3, FLATLINE:4, HOLLOW: 5
    },
    DIY = 365.25,   // Days in year
    SID = 86400,    // Seconds in day
    AKH = 7*SID,    // Akrasia Horizon, in seconds

    SECS = { 'y' : DIY*SID,     // Number of seconds in a year, month, etc
             'm' : DIY/12*SID,
             'w' : 7*SID,
             'd' : SID,
             'h' : 3600        },
    UNAM = { 'y' : 'year',      // Unit names
             'm' : 'month',
             'w' : 'week',
             'd' : 'day',
             'h' : 'hour'      },

    // ---------------- General Utility Functionc ----------------------

    onMobileOrTablet = function() {
      var check = false;
      (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
      return check;
    },
        
    isArray = function(obj) {
        return (/Array/).test(Object.prototype.toString.call(obj));
    },

    extend = function(to, from, overwrite) {
        var prop, hasProp;
        for (prop in from) {
            hasProp = to[prop] !== undefined;
            if (hasProp && typeof from[prop] === 'object' 
                && from[prop] !== null 
                && from[prop].nodeName === undefined) {
                if (isArray(from[prop])) {
                    if (overwrite) {
                        to[prop] = from[prop].slice(0);
                    }
                } else {
                    to[prop] = extend({}, from[prop], overwrite);
                }
            } else if (overwrite || !hasProp) {
                to[prop] = from[prop];
            }
        }
        return to;
    },
    // Tested, but this does not seem like "argmax" functionality to me, 
    // argmax should return the index. This is just max with a filter
    argmax = function(f, dom) {
        if (dom == null) return null;
        var newdom = dom.map(f);
        var maxelt = d3.max(newdom);
        return dom[newdom.findIndex(function (e) {return e == maxelt;})];
    },

    //Return a list with the cumulative sum of the elements in l, left to right
    accumulate = function(l) {
        var ne = l.length;
        if (ne == 0) return l;
        var nl = [l[0]];
        for (var i = 1; i < ne; i++) nl.push(nl[nl.length-1]+l[i]);
        return nl;
    },

    // zip([[1,2], [3,4]]) --> [[1,3], [2,4]]
    zip = function (arrays) {
        return arrays[0].map(function(_,i){
            return arrays.map(function(array){return array[i];});
        });
    },

    // Return 0 when x is very close to 0
    chop = function (x, delta=1e-7) { 
        return (Math.abs(x) < delta)?0:x;
    },

    // Return an integer when x is very close to an integer
    ichop = function(x, delta=1e-7) {
        var fracp = x % 1;
        var intp = x - fracp;
        if (fracp < 0) {fracp += 1; intp -= 1;};
        if (fracp > 0.5) fracp = 1 - chop(1-fracp);
        return Math.round(intp) + chop(fracp, delta);
    },

    // clip(x, a,b) = min(b,max(a,x))
    clip = function(x, a,b) {
      var tmp;
      if (a > b) { tmp=a; a=b; b=tmp;}
      if (x < a) x = a;
      if (x > b) x = b;
      return x;
    },

    // Convex combination: x rescaled to be in [c,d] as x ranges from a to b. 
    // clipQ indicates whether the output value should be clipped to [c,d]. 
    // Unsorted inputs [a,b] and [c,d] are also supported and work in the expected 
    // way except when clipQ = False, in which case [a,b] and [c,d] are sorted prior 
    // to computing the output.
    cvx = function(x, a,b, c,d, clipQ=true) {
      var tmp;
      if (chop(a-b) == 0) {
        if (x <= a) return d3.min([c,d]);
        else        return d3.max([c,d]);
      }
      if (chop(c-d) == 0) return c;
      if (clipQ)
        return clip(c + (x-a)/(b-a)*(d-c), (c>d)?d:c,(c>d)?c:d);
      else {
          if (a > b) { tmp=a; a=b; b=tmp;}
          if (c > d) { tmp=c; c=d; d=tmp;}
          return c + (x-a)/(b-a)*(d-c);
      }
    },
  
    deldups = function(a) {
        var seen = {};
        return a.filter(function(item) {
            return seen.hasOwnProperty(item) ? false : (seen[item] = true);
        });
    },

    nonzero = function(arr) {
        var l = arr.length;
        for( var i = 0; i < l; i++ ){ if (arr[i] != 0) return true;}
        return false;
    },

    clocky = function(arr) {
        var sum = 0, l = arr.length;
        for( var i = 1; i < l; i+=2 ){ sum += (arr[i]-arr[i-1]);}
        return sum;
    },

    sum = function(arr) {
        var sum = 0, l = arr.length;
        for( var i = 0; i < l; i++ ){ sum += arr[i];}
        return sum;
    },

    mean = function (arr) {
        var sum = 0, l = arr.length;
        if (l == 0) return 0;
        for( var i = 0; i < l; i++ ){ sum += arr[i];}
        return sum/arr.length;
    },

    median = function(arr) {
        var m = 0, l = arr.length;
        arr.sort();
        
        if (l % 2 === 0) { m = (arr[l / 2 - 1] + arr[l / 2]) / 2; }
        else { m = arr[(l - 1) / 2];}
        return m;
    },

    mode = function(arr) {
        var modes = [], count = [], i, number, maxIndex = 0;
        
        for (i = 0; i < arr.length; i += 1) {
            number = arr[i];
            count[number] = (count[number] || 0) + 1;
            if (count[number] > maxIndex) { maxIndex = count[number]; }
        }
        
        for (i in count)
            if (count.hasOwnProperty(i)) {
                if (count[i] === maxIndex) { modes.push(Number(i));}
            }
        return modes;
    },

    inrange = function(x, min, max) {
        return x >= min && x <= max;
    },

    nearlyEqual = function(a, b, epsilon) {
        return Math.abs(a - b) < epsilon;
    },

    ZFUN = function(x) { return 0; },

    // ----------------- Date facilities ----------------------

    // Returns a new date object ahead by the specified number of days
    addDays = function(m, days) {
        var result = moment(m);
        result.add(days, 'days');
        return result;
    },

    // Fixes the supplied unixtime to 00:00:00 on the same day
    daysnap = function(unixtime) {
        var d = moment.unix(unixtime).utc();
        d.hours(0); d.minutes(0); d.seconds(0); d.milliseconds(0);
        return d.unix();
    },

    formatDate = function(unixtime) {
        var mm = moment.unix(unixtime).utc();
        var year = mm.year();
        var month = (mm.month()+1);
        month = (month < 10)?"0"+month.toString():month.toString();
        var day = mm.date();
        day= (day < 10)?"0"+day.toString():day.toString();
        return year+"."+month+"."+day;
    },

    // Take a daystamp like "20170531" and return unixtime in seconds
    // (dreev confirmed this seems to match Beebrain's function)
    dayparse = function(s, sep='') {
        if (!RegExp('^\\d{4}'+sep+'\\d{2}'+sep+'\\d{2}$').test(s)) { 
            // Check if the supplied date is a timestamp or not.
            if (!isNaN(s)) return Number(s);
            else return NaN; 
        }
        s = s.replace(RegExp('^(\\d\\d\\d\\d)'+sep+'(\\d\\d)'+sep+'(\\d\\d)$'), 
                      "$1-$2-$3");
        return daysnap(moment.utc(s).unix());
    },

    // Take an integer unixtime in seconds and return a daystamp like "20170531"
    // (dreev superficially confirmed this works)
    // Uluc: Added options to disable UTC and choose a separator
    dayify = function(t, sep = '') {
        if (isNaN(t) || t < 0) { return "ERROR"; }
        var mm = moment.unix(t).utc();
        var y = mm.year();
        var m = mm.month() + 1;
        var d = mm.date();
        return '' + y + sep + (m < 10 ? '0' : '') + m 
            + sep + (d < 10 ? '0' : '') + d;
    },

    // ----------------- Network utilities ----------------------
    loadJSON = function( url, callback ) {   

        var xobj = new XMLHttpRequest();
        xobj.overrideMimeType("application/json");
        xobj.open('GET', url, true);
        xobj.onreadystatechange = function () {
            if (xobj.readyState == 4 && xobj.status == "200") {
                //if (xobj.readyState == 4) {
                callback(JSON.parse(xobj.responseText));
            }
        };
        xobj.send(null);  
    },

    // ----------------- Beeminder Goal utilities ----------------------

    AGGR = {
        last     : function (x) { return x[x.length-1]; },
        first    : function (x) { return x[0]; },
        min      : function (x) { return d3.min(x); },
        max      : function (x) { return d3.max(x); },
        truemean : function (x) { return mean(x); },
        uniqmean : function (x) { return mean(deldups(x)); },
        mean     : function (x) { return mean(deldups(x)); },
        median   : function (x) { return median(x); },
        mode     : function (x) { return mode(x); },
        trimmean : function (x) { return mean(x); }, // Uluc: did not bother with this
        sum      : function (x) { return sum(x); },
        jolly    : function (x) { return (x.length > 0)?1:0; },
        binary   : function (x) { return (x.length > 0)?1:0; },
        nonzero  : nonzero,
        triangle : function (x) { return sum(x)*(sum(x)+1)/2; },
        square   : function (x) { return Math.pow(sum(x),2); },
        clocky   : function (x) { return clocky(x); /* sum of pair differences*/ },
        count    : function (x) { return x.length; /* number of datapoints*/ }
    },

    printRoad = function( rd ) {
        for (var i = 0; i < rd.length; i++) {
            var segment = rd[i];
            console.debug("[("+segment.sta[0]+","+segment.sta[1]+"),("
                          +segment.end[0]+","+segment.end[1]+"),"
                          +segment.slope+", auto="+segment.auto+"]");
        }
    },

    sameRoads = function( rda, rdb ) {
        if (rda.length != rdb.length) return false;
        for (var i = 0; i < rda.length; i++) {
            if (!nearlyEqual(rda[i].end[0], rdb[i].end[0], 10)) return false;
            if (!nearlyEqual(rda[i].end[1], rdb[i].end[1], 10)) return false;
            if (!nearlyEqual(rda[i].slope, rdb[i].slope, 1e-14)) return false;
        }
        return true;
    },

    /** Creates and returns a clone of the supplied road array */
    copyRoad = function( inroad ) {
        var newroad = [];
        for (var i = 0; i < inroad.length; i++) {
            var segment = {
                sta: inroad[i].sta.slice(), end: inroad[i].end.slice(),
                slope: inroad[i].slope, auto: inroad[i].auto };
            newroad.push(segment);
        }
        return newroad;
    },

    /** Finds index for the road segment containing the supplied x value */
    findRoadSegment = function(rd, x) {
        var found = -1;
        for (var i = 0; i < rd.length; i++) {
            if ((x >= rd[i].sta[0]) && (x < rd[i].end[0])) {
                found = i;
                break;
            }
        }
        return found;
    },

    /** Computes the slope of the supplied road segment */
    roadSegmentSlope = function(rd) {
        return (rd.end[1] - rd.sta[1]) / (rd.end[0] - rd.sta[0]);
    },

    /** Computes the value of a road segment at the given timestamp */
    roadSegmentValue = function(rdseg, x) {
        return rdseg.sta[1] + rdseg.slope*(x - rdseg.sta[0]);
    },

    /** Computes the value of a road array at the given timestamp */
    rdf = function(rd, x) {
        var i = findRoadSegment(rd, x);
        return roadSegmentValue( rd[i], x );
    },

    // Recomputes the road array starting from the first node and assuming
    // that the one of slope, enddate or endvalue parameters is chosen to
    // be automatically computed. If usetable is true, autocompute
    // parameter selections from the table are used
    fixRoadArray = function( rd, autoparam=RP.VALUE, usetable=false, 
                             edited=RP.VALUE) {
        var nr = rd.length;
        // Fix the special first road segment, whose slope will always be 0.
        rd[0].sta[0] = rd[0].end[0] - 100*DIY*SID;
        rd[0].sta[1] = rd[0].end[1];

        // Iterate through the remaining segments until the last one
        for (var i = 1; i < nr-1; i++) {
            //console.debug("before("+i+"):[("+rd[i].sta[0]+","+rd[i].sta[1]+"),("+rd[i].end[0]+","+rd[i].end[1]+"),"+rd[i].slope+"]");
            if (usetable) autoparam = rd[i].auto;

            var difftime = rd[i].end[0] - rd[i].sta[0]; 
            var diffval = rd[i].end[1] - rd[i].sta[1]; 

            rd[i].sta[0] = rd[i-1].end[0];
            rd[i].sta[1] = rd[i-1].end[1];

            if (autoparam == RP.DATE) {
                if (isFinite(rd[i].slope) && rd[i].slope != 0) {
                    rd[i].end[0] = daysnap(
                        rd[i].sta[0]+(rd[i].end[1]-rd[i].sta[1])/rd[i].slope);
                }
                // Sanity check
                if (rd[i].end[0] <= rd[i].sta[0]) {
                    rd[i].end[0] = daysnap(rd[i].sta[0]+SID);
                }
                if (edited == RP.SLOPE) {
                    // Readjust value if slope was edited
                    rd[i].end[1] = 
                        rd[i].sta[1]+rd[i].slope*(rd[i].end[0]-rd[i].sta[0]);
                } else {
                    // Readjust value if value was edited
                    rd[i].slope = roadSegmentSlope(rd[i]);
                }
            } else if (autoparam == RP.VALUE) {
                if (isFinite(rd[i].slope)) {
                    rd[i].end[1] = rd[i].sta[1]+rd[i].slope
                        *(rd[i].end[0]-rd[i].sta[0]);
                } else {
                    // If slope is infinite, preserve previous delta
                    rd[i].end[1] = rd[i].sta[1]+diffval;
                    rd[i].slope = roadSegmentSlope(rd[i]);
                }
            } else if (autoparam == RP.SLOPE) {
                rd[i].slope = roadSegmentSlope(rd[i]);
            }
            //console.debug("after("+i+"):[("+rd[i].sta[0]+","+rd[i].sta[1]+"),("+rd[i].end[0]+","+rd[i].end[1]+"),"+rd[i].slope+"]");
        }

        // Fix the last segment
        if (nr > 1) {
            rd[nr-1].sta[0] = rd[nr-2].end[0];
            rd[nr-1].sta[1] = rd[nr-2].end[1];
            rd[nr-1].end[0] = rd[nr-1].sta[0] + 100*DIY*SID;
            rd[nr-1].end[1] = rd[nr-1].sta[1];
        }
    },

    // Good delta: Returns the delta from the given point to the
    // centerline of the road but with the sign such that being on the
    // good side of the road gives a positive delta and being on the
    // wrong side gives a negative delta.
    gdelt = function( rd, goal, t, v ) {
        return chop( goal.yaw*(v - rdf(rd, t)));
    },

    // TODO: Test
    lanage = function( rd, goal, t, v, l = null ) {
        if (l == null) l = lnf( rd, goal, t );
        var d = v - rdf(rd, t);
        if (chop(l) == 0) 
            return Math.round((chop(d) == 0.0)?goal.yaw:Math.sign(d)*666);
        var x = ichop(d/l);
        var fracp = x % 1;
        var intp = x -fracp;
        if (fracp > .99999999) {
            intp += 1;
            fracp = 0;
        }
        if (chop(fracp) == 0) {
            if (goal.yaw > 0 && intp >= 0) return Math.round(intp+1);
            if (goal.yaw < 0 && intp <= 0) return Math.round(intp-1);
            return Math.round(Math.sign(x)*Math.ceil(Math.abs(x)));
        }
        return Math.round(Math.sign(x)*Math.ceil(Math.abs(x)));
    },

    // TODO: Test
    // Whether the given point is on the road if the road has lane width l
    aok = function( rd, goal, t, v, l ) {
        return ((lanage(rd, goal, t, v, l) * goal.yaw >= -1.0));
    },

    // TODO: Test
    // Returns the number of days to derail for the current road
    // TODO: There are some issues with computing tcur, vcur
    dtd = function( rd, goal, t, v ) {
        var tnow = goal.asof;
        var x = 0; // the number of steps  
        var xt = 0; // the number of steps past today
        var vpess = v; // the value as we walk forward w/ pessimistic presumptive reports  
        while (aok( rd, goal, t+x*SID, vpess, lnf( rd, goal, t+x*SID ) ) 
               && t+x*SID <= d3.max([rd[rd.length-1].sta[0], t])) {
            x += 1; // walk forward until we're off the YBR
            if (t+x*SID > tnow) xt += 1;
            vpess += (goal.yaw*goal.dir < 0)?2*rtf(rd, t+x*SID)*SID:0;
        }
        return xt;
    },

    // Days To Centerline: Count the integer days till you cross the
    // centerline/tfin if nothing reported
    dtc = function(rd, t, v) {
        var x = 0;
        var tfin = roads[roads.length-1].sta[0];
        while(gdelt(rd, t+x*SID, v) >= 0 && t+x*SID <= tfin)
            x += 1; // dpl
        return x;
    },

    odomify = function( data ) {
        var ln = data.length;
        if (ln == 0) return;
        var curadd = 0;
        var prev = data[0][1];
        for (var i=1; i<ln; i++) {
            if (data[i][1] == 0) curadd += prev;
            prev = data[i][1];
            data[i][1] += curadd;
        }
    },

    // Utility function for stepify
    stepFunc = function( data, x, dflt=0 ) {
        if (x < data[0][0]) return dflt;
        var prevval = data[0][1];
        for (var i = 0; i < data.length; i++) {
            if (data[i][0] > x) return prevval;
            else  prevval = data[i][1];
        }
        return data[data.length-1][1];
    },

    // Take a list of datapoints sorted by x-value and returns a pure
    // function that interpolates a step function from the data,
    // always mapping to the most recent value. Cf
    // http://stackoverflow.com/q/6853787
    stepify = function( data, dflt=0 ) {
        if (data == null) return (function (x) { return dflt; });
        return (function(x) { return stepFunc(data, x, dflt); });
    },

    // Computes the slope of the supplied road array at the given timestamp
    rtf = function(rd, t) {
        var i = findRoadSegment( rd, t );
        return (rd[i].slope);
    },

    lnfraw = function( rd, goal, x ) {
        var t = rd.map(function(elt) { return elt.end[0]; });
        var r = rd.map(function(elt) { return Math.abs(elt.slope)*SID; });
        // pretend flat spots have the previous or next non-flat rate
        var rb = r.slice(), i;
        for (i = 1; i < rb.length; i++) 
            if (Math.abs(rb[i]) < 1e-9 || !isFinite(rb[i])) rb[i] = rb[i-1];
        var rr = r.reverse();
        var rf = rr.slice();
        for (i = 1; i < rf.length; i++) 
            if (Math.abs(rf[i]) < 1e-9 || !isFinite(rf[i])) rf[i] = rf[i-1];
        rf = rf.reverse();

        r = zip([rb,rf]).map(function (e) { 
            return argmax(Math.abs, [e[0],e[1]]); });
        var valdiff = rdf( rd, x ) - rdf( rd, x-SID );
        i = findRoadSegment(rd, x);
        return d3.max([Math.abs(valdiff), r[i]]);
    },

    // TODO: Test
    lnf = function( rd, goal, x ) {
        if (goal.hasOwnProperty('abslnw') && goal.abslnw != null) 
            return goal.abslnw;
        return lnfraw( rd, goal, x );
    },

    // Appropriate color for a datapoint
    dotcolor = function( rd, goal, t, v) {
        var l = lanage( rd, goal, t, v );
        if (goal.yaw==0 && Math.abs(l) > 1.0) return Cols.GRNDOT;
        if (goal.yaw==0 && (l==0 && l==1.0)) return Cols.BLUDOT;
        if (goal.yaw==0 && l == -1.0) return Cols.ORNDOT;
        if (l*goal.yaw >=  2.0) return Cols.GRNDOT;
        if (l*goal.yaw ==  1.0) return Cols.BLUDOT;
        if (l*goal.yaw == -1.0) return Cols.ORNDOT;
        if (l*goal.yaw <= -2.0) return Cols.REDDOT;
        return Cols.BLCK;
    },

    isLoser = function(rd, goal, data, t, v) {
        return (dotcolor( rd, goal, t, v ) === Cols.REDDOT 
                && dotcolor(rd, goal,t-SID,stepFunc(data,t-SID))===Cols.REDDOT);
    },

    /** configure functionality (private) */
    config = function(obj, options) {
        if (!obj.opts) { obj.opts = extend({}, defaults, true);}
        
        if (onMobileOrTablet()) {
          extend(obj.opts, mobiledefaults);
        }
        var opts = extend(obj.opts, options, true);
        
        opts.divGraph = (opts.divGraph && opts.divGraph.nodeName)?
            opts.divGraph : null;
        opts.divTable = (opts.divTable && opts.divTable.nodeName)?
            opts.divTable : null;

        return opts;
    },

    roads = [],        // Holds the current road matrix
    initialRoad = [],  // Holds the initial road matrix
    datapoints = [],   // Holds the current set of non-future datapoints 
    oresets = [],
    fuda = [], // Holds the current set of future datapoints 
    allvals = {},
    aggval = {},
    
    
    /** bmndr constructor */
    bmndr = function(options) {
        //console.debug("bmndr constructor: ");console.log(options);
        var self = this,
            opts = config(self, options);

        var yaxisw = 50;

        var 
        sw = opts.svgSize.width,
        sh = opts.svgSize.height,
        plotbox, brushbox, plotpad, contextpad;

        var zoombtnsize = opts.zoomButton.size;
        var zoombtnscale = zoombtnsize / 540;
        var zoombtntr;
        function computeBoxes() {
            plotpad = extend({}, opts.focusPad);
            contextpad = extend({}, opts.contextPad);
            plotpad.left += yaxisw;
            plotpad.right += yaxisw;
            contextpad.left += yaxisw;
            contextpad.right += yaxisw;
            plotbox = {
                x:     opts.focusRect.x + plotpad.left,
                y:     opts.focusRect.y + plotpad.top,
                width: opts.focusRect.width
                    - plotpad.left - plotpad.right, 
                height:opts.focusRect.height
                    - plotpad.top - plotpad.bottom
            },
            brushbox = {
                x:     opts.contextRect.x + contextpad.left,
                y:     opts.contextRect.y + contextpad.top,
                width: opts.contextRect.width
                    - contextpad.left - contextpad.right, 
                height:opts.contextRect.height
                    - contextpad.top - contextpad.bottom
            };
            zoombtntr = {botin:"translate("+(plotbox.width
                                             -2*(zoombtnsize+5))
                         +","+(plotbox.height-(zoombtnsize+5))
                         +") scale("+zoombtnscale+","+zoombtnscale+")",
                         botout:"translate("+(plotbox.width
                                              -(zoombtnsize+5))
                         +","+(plotbox.height-(zoombtnsize+5))
                         +") scale("+zoombtnscale+","+zoombtnscale+")",
                         topin:"translate("+(plotbox.width
                                             -2*(zoombtnsize+5))
                         +",5) scale("+zoombtnscale+","+zoombtnscale+")",
                         topout:"translate("+(plotbox.width
                                              -(zoombtnsize+5))
                         +",5) scale("+zoombtnscale+","+zoombtnscale+")"};
        };
        computeBoxes();

        var svg, defs, zoomarea, axisZoom, focus, buttonarea, focusclip, plot;
        var gPastBox, gYBHP, gPink, gGrid;
        var gOldRoad, gOldCenter, gOldGuides, gOldBullseye, gKnots;
        var gSteppy, gDpts, gBullseye, gRoads, gDots, gHorizon, gHorizonText;
        var gPastText, zoomin, zoomout;;
        var xScale, xAxis, xGrid, xAxisObj, xGridObj;
        var yScale, yAxis, yAxisR, yAxisObj, yAxisObjR, yAxisLabel;
        var context, ctxclip, ctxplot, xScaleB, xAxisB, xAxisObjB;
        var yScaleB, brushObj, brush, focusrect;
        var topLeft;
        var newXScale, newYScale;
        var scalf = 1;

        function createGraph() {
            var div = opts.divGraph;
            if (div === null) return;
            // First, remove all children from the div
            while (div.firstChild) {
                div.removeChild(div.firstChild);
            }        
            // Initialize the div and the SVG
            svg = d3.select(div).attr("class", "bmndrgraph")
	            .append('svg:svg')
	            .attr('width', sw)
	            .attr('height', sh)
	            .attr('class', 'bmndrsvg');
            // Common SVG definitions, including clip paths
            defs = svg.append('defs');
            defs.append("clipPath")
                .attr("id", "plotclip")
                .append("rect")
                .attr("x", 0).attr("y", 0)
                .attr("width", plotbox.width).attr("height", plotbox.height);
            defs.append("clipPath")
                .attr("id", "brushclip")
                .append("rect")
                .attr("x", 0).attr("y", 0)
                .attr("width", brushbox.width).attr("height", brushbox.height);
            defs.append("clipPath")
                .attr("id", "buttonareaclip")
                .append("rect")
                .attr("x", plotbox.x).attr("y", 0)
                .attr("width", plotbox.width).attr("height", plotpad.top);
            
            defs.append("path")
                .attr("stroke", "black")
                .attr("stroke-width", 0)
                .attr("id", "rightarrow")
                .attr("d", "M 55,0 -35,45 -35,-45 z");
            
            var buttongrp = defs.append("g")
                    .attr("id", "removebutton");
            buttongrp.append("circle")
                .attr("cx", 14).attr("cy", 14)
                .attr("r", 16).attr('fill', 'white');
            buttongrp.append("path")
                .attr("d", "M13.98,0C6.259,0,0,6.261,0,13.983c0,7.721,6.259,13.982,13.98,13.982c7.725,0,13.985-6.262,13.985-13.982C27.965,6.261,21.705,0,13.98,0z M19.992,17.769l-2.227,2.224c0,0-3.523-3.78-3.786-3.78c-0.259,0-3.783,3.78-3.783,3.78l-2.228-2.224c0,0,3.784-3.472,3.784-3.781c0-0.314-3.784-3.787-3.784-3.787l2.228-2.229c0,0,3.553,3.782,3.783,3.782c0.232,0,3.786-3.782,3.786-3.782l2.227,2.229c0,0-3.785,3.523-3.785,3.787C16.207,14.239,19.992,17.769,19.992,17.769z");
            
            var zoomingrp = defs.append("g")
                    .attr("id", "zoominbtn");
            zoomingrp.append("path").style("fill", "white")
                .attr("d", "m 530.86356,264.94116 a 264.05649,261.30591 0 1 1 -528.1129802,0 264.05649,261.30591 0 1 1 528.1129802,0 z");
            zoomingrp.append("path")
                .attr("d", "m 308.21,155.10302 -76.553,0 0,76.552 -76.552,0 0,76.553 76.552,0 0,76.552 76.553,0 0,-76.552 76.552,0 0,-76.553 -76.552,0 z m 229.659,114.829 C 537.869,119.51007 420.50428,1.9980234 269.935,1.9980234 121.959,1.9980234 2.0000001,121.95602 2.0000001,269.93202 c 0,147.976 117.2473599,267.934 267.9339999,267.934 150.68664,0 267.935,-117.51205 267.935,-267.934 z m -267.935,191.381 c -105.681,0 -191.381,-85.7 -191.381,-191.381 0,-105.681 85.701,-191.380996 191.381,-191.380996 105.681,0 191.381,85.700996 191.381,191.380996 0,105.681 -85.7,191.381 -191.381,191.381 z");
            
            var zoomoutgrp = defs.append("g")
                    .attr("id", "zoomoutbtn");
            zoomoutgrp.append("path").style("fill", "white")
                .attr("d", "m 530.86356,264.94116 a 264.05649,261.30591 0 1 1 -528.1129802,0 264.05649,261.30591 0 1 1 528.1129802,0 z");
            zoomoutgrp.append("path")
                .attr("d", "m 155.105,231.65502 0,76.553 229.657,0 0,-76.553 c -76.55233,0 -153.10467,0 -229.657,0 z m 382.764,38.277 C 537.869,119.51007 420.50428,1.9980234 269.935,1.9980234 121.959,1.9980234 2.0000001,121.95602 2.0000001,269.93202 c 0,147.976 117.2473599,267.934 267.9339999,267.934 150.68664,0 267.935,-117.51205 267.935,-267.934 z m -267.935,191.381 c -105.681,0 -191.381,-85.7 -191.381,-191.381 0,-105.681 85.701,-191.380996 191.381,-191.380996 105.681,0 191.381,85.700996 191.381,191.380996 0,105.681 -85.7,191.381 -191.381,191.381 z");
            
            // Create rectange to monitor zoom events and install handlers
            zoomarea = svg.append('rect')
                .attr("class", "zoomarea")
                .attr("x", plotbox.x).attr("y", plotbox.y)
                .attr("width", plotbox.width).attr("height", plotbox.height);
            axisZoom = d3.zoom()
                .extent([[0, 0], [plotbox.width, plotbox.height]])
                .scaleExtent([1, Infinity])
                .translateExtent([[0, 0], [plotbox.width, plotbox.height]])
                .on("zoom", zoomed);
            zoomarea.call(axisZoom);
            if (onMobileOrTablet()) {
              var pressTimer = null, pressX;
              var oldTouchStart = zoomarea.on("touchstart.zoom");
              var oldTouchMove = zoomarea.on("touchmove.zoom");
              var oldTouchEnd = zoomarea.on("touchend.zoom");
              
              zoomarea
                .on("touchstart.zoom", function () { 
                    var bbox = this.getBoundingClientRect();
                    pressX = d3.event.touches.item(0).pageX - bbox.left;
                    var newx = newXScale.invert(pressX);
                    if (pressTimer == null && d3.event.touches.length == 1) pressTimer = window.setTimeout(function() { if (newx != null) addNewDot(newx/1000); },1000);
                    oldTouchStart.apply(this, arguments);} )
                .on("touchmove.zoom", function () { clearTimeout(pressTimer); pressTimer = null; oldTouchMove.apply(this, arguments);})
                .on("touchend.zoom", function () { clearTimeout(pressTimer); pressTimer = null; oldTouchEnd.apply(this, arguments);} );              
            }
            function dotAdded() {
                var newx = newXScale.invert(d3.event.x-plotpad.left);
                addNewDot(newx/1000);
            }
            function dotAddedShift() {
                if (d3.event.shiftKey) {
                    dotAdded();
                }
            }
            if (opts.roadEditor) {
                zoomarea.on("click", dotAddedShift);
                zoomarea.on("dblclick.zoom", dotAdded);
            } else {
                zoomarea.on("dblclick.zoom", null);            
            }
            
            focus = svg.append('g')
	            .attr('class', 'focus')
                .attr('transform', 'translate('+opts.focusRect.x
                      +','+opts.focusRect.y+')');
            buttonarea = focus.append('g')
                .attr('clip-path', 'url(#buttonareaclip)')
                .attr('class', 'buttonarea'); 
            focusclip = focus.append('g')
	            .attr('class', 'focusclip')
                .attr('clip-path', 'url(#plotclip)')
                .attr('transform', 'translate('+plotpad.left
                      +','+plotpad.top+')');
            plot = focusclip.append('g').attr('class', 'plot');

            gGrid = plot.append('g').attr('id', 'grid');
            gPastBox = plot.append('g').attr('id', 'pastboxgrp');
            gYBHP = plot.append('g').attr('id', 'ybhpgrp');
            gOldGuides = plot.append('g').attr('id', 'oldguidegrp');
            gOldRoad = plot.append('g').attr('id', 'oldroadgrp');
            gPink = plot.append('g').attr('id', 'pinkgrp');
            gOldCenter = plot.append('g').attr('id', 'oldcentergrp');
            gOldBullseye = plot.append('g').attr('id', 'oldbullseyegrp');
            gKnots = plot.append('g').attr('id', 'knotgrp');
            gSteppy = plot.append('g').attr('id', 'steppygrp');
            gDpts = plot.append('g').attr('id', 'datapointgrp');
            gBullseye = plot.append('g').attr('id', 'bullseyegrp');
            gRoads = plot.append('g').attr('id', 'roadgrp');
            gDots = plot.append('g').attr('id', 'dotgrp');
            gHorizon = plot.append('g').attr('id', 'horgrp');
            gHorizonText = plot.append('g').attr('id', 'hortxtgrp');
            gPastText = plot.append('g').attr('id', 'pasttxtgrp');

            zoomin = plot.append("svg:use")
	            .attr("class","zoomin")
                .attr("xlink:href", "#zoominbtn")
	  	        .attr("opacity",opts.zoomButton.opacity)
                .attr("transform", zoombtntr.botin)
                .on("click", function() {
                    zoomarea.call(axisZoom.scaleBy, 
                                     opts.zoomButton.factor);})
                .on("mouseover", function() {
                    d3.select(this).style("fill", "red");})
	            .on("mouseout",function(d,i) {
                    d3.select(this).style("fill", "black");});
            zoomout = plot.append("svg:use")
	            .attr("class","zoomout")
	            .attr("xlink:href","#zoomoutbtn")
	  	        .attr("opacity",opts.zoomButton.opacity)
                .attr("transform", zoombtntr.botout)
                .on("click", function() {
                    zoomarea.call(axisZoom.scaleBy, 
                                     1/opts.zoomButton.factor);})
                .on("mouseover", function() {
                    d3.select(this).style("fill", "red");})
	            .on("mouseout",function(d,i) {
                    d3.select(this).style("fill", "black");});

            // Create and initialize the x and y axes
            xScale = d3.scaleUtc().range([0,plotbox.width]);
            xAxis = d3.axisBottom(xScale).ticks(6);
            xAxisObj = focus.append('g')        
                .attr("class", "axis")
                .attr("transform", "translate("+plotbox.x+"," 
                      + (plotpad.top+plotbox.height) + ")")
                .call(xAxis);
            if (!opts.roadEditor) {
                xGrid = d3.axisTop(xScale).ticks(6).tickFormat("");
                xGridObj = gGrid.append('g')        
                    .attr("class", "grid")
                    .attr("transform", "translate(0,"+(plotbox.height)+")")
                    .call(xGrid);
            }

            yScale = d3.scaleLinear().range([plotbox.height, 0]);
            yAxis = d3.axisLeft(yScale).ticks(8);
            yAxisR = d3.axisRight(yScale).ticks(8);
            yAxisObj = focus.append('g')        
                .attr("class", "axis")
                .attr("transform", "translate(" 
                      + plotpad.left + ","+plotpad.top+")")
                .call(yAxis);
            yAxisObjR = focus.append('g')        
                .attr("class", "axis")
                .attr("transform", "translate(" 
                      + (plotpad.left+plotbox.width) + ","+plotpad.top+")")
                .call(yAxisR);
            yAxisLabel = focus.append('text')        
                .attr("class", "axislabel")
                .attr("transform", 
                      "translate(15,"+(plotbox.height/2+plotpad.top)
                      +") rotate(-90)")
                .text("deneme");
            
            // Create brush area
            context = svg.append('g')
	            .attr('class', 'brush')
                .attr('transform', 'translate('
                      +opts.contextRect.x+','+opts.contextRect.y+')');
            ctxclip = context.append('g')
                .attr('clip-path', 'url(#brushclip)')
                .attr('transform', 'translate('
                      +contextpad.left+','+contextpad.top+')');
            ctxplot = ctxclip.append('g').attr('class', 'context');
            xScaleB = d3.scaleUtc().range([0,brushbox.width]);
            xAxisB = d3.axisBottom(xScaleB).ticks(6);
            xAxisObjB = context.append('g')        
                .attr("class", "axis")
                .attr("transform", "translate("+brushbox.x+"," 
                      + (contextpad.top+brushbox.height) + ")")
                .call(xAxisB);
            yScaleB = d3.scaleLinear().range([brushbox.height, 0]);

            brushObj = d3.brushX()
                .extent([[0, 0], [brushbox.width, brushbox.height]])
                .on("brush", brushed);

            brush = ctxplot.append("g")
                .attr("class", "brush")
                .call(brushObj);
            focusrect = ctxclip.append("rect")
                .attr("class", "focusrect")
                .attr("x", 1).attr("y", 1)
                .attr("width", brushbox.width-2)
                .attr("height", brushbox.height-2)
                .attr("fill", "none")
                .attr("stroke", "black").attr("stroke-width", 1)
                .attr("stroke-dasharray", "8,4,2,4");
            newXScale = xScale, newYScale = yScale;
        }

        function resizeGraph() {
            var div = opts.divGraph;
            if (div === null) return;

            computeBoxes();

            // Common SVG definitions, including clip paths
            defs.select("#plotclip > rect")
                .attr("width", plotbox.width).attr("height", plotbox.height);
            defs.select("#brushclip > rect")
                .attr("width", brushbox.width).attr("height", brushbox.height);
            defs.select("#buttonareaclip > rect")
                .attr("x", plotbox.x).attr("y", 0)
                .attr("width", plotbox.width).attr("height", plotbox.height);
            zoomarea.attr("x", plotbox.x).attr("y", plotbox.y)
                .attr("width", plotbox.width).attr("height", plotbox.height);
            axisZoom.extent([[0, 0], [plotbox.width, plotbox.height]])
                .scaleExtent([1, Infinity])
                .translateExtent([[0, 0], [plotbox.width, plotbox.height]]);
            focusclip.attr('transform', 'translate('+plotpad.left
                           +','+plotpad.top+')');
            zoomin.attr("transform", zoombtntr.botin);
            zoomout.attr("transform", zoombtntr.botout);
            xScale.range([0, plotbox.width]);
            xAxisObj.attr("transform", "translate("+plotbox.x+"," 
                          + (plotpad.top+plotbox.height) + ")")
                .call(xAxis);
            if (!opts.roadEditor) {
                xGridObj.attr("transform", "translate(0,"+(plotbox.height)+")")
                    .call(xGrid);
            }
            yScale.range([0, plotbox.height]);
            yAxisObj.attr("transform", "translate(" 
                      + plotpad.left + ","+plotpad.top+")")
                .call(yAxis);
            yAxisObjR.attr("transform", "translate(" 
                      + (plotpad.left+plotbox.width) + ","+plotpad.top+")")
                .call(yAxisR);
            yAxisLabel.attr("transform", 
                            "translate(15,"+(plotbox.height/2+plotpad.top)
                            +") rotate(-90)");
            ctxclip.attr('transform', 'translate('
                         +contextpad.left+','+contextpad.top+')');
            xScaleB.range([0,brushbox.width]);
            xAxisObjB.attr("transform", "translate("+brushbox.x+"," 
                           + (contextpad.top+brushbox.height) + ")")
                .call(xAxisB);
            yScaleB.range([brushbox.height, 0]);
            brushObj.extent([[0, 0], [brushbox.width, brushbox.height]]);
            brush.call(brushObj);
        }

        var tbl = {}; // Holds table related objects
        function createTable() {
            var div = opts.divTable;
            if (div === null) return;

            // First, remove all children from the div
            while (div.firstChild) {
                div.removeChild(div.firstChild);
            }
            var divelt = d3.select(div);
            if (opts.tableHeight != 0) {
                divelt
                    .style("height", opts.tableHeight+"px")
                    .style("width", "500px")
                    .style("overflow-y", "auto");
            }
            var table = divelt.append("div")
                    .attr("class", "rtable");
            // This element is used to hold the Pikaday instance
            table.append("div").attr("id", "dpfloat")
                .attr("class", "floating");
            // This element helps figure out layout coordinates of the scrolled window top left
            topLeft = table.append("div").attr("id", "topleft")
                .style("position", "absolute").style("left", 0).style("top",0)
                .style("width", "1px").style("height", "1px")
                .attr("visibility","hidden");
            if (opts.reversetable) {
                createRoadTable();
                createStartTable();
            } else {
                createStartTable();
                createRoadTable();  
            }
        }

        function roadChanged() {
            computePlotLimits( true );
            horindex = findRoadSegment(roads, goal.horizon);
            reloadBrush();
            updateGraphData();
            updateContextData();
            updateTable();
            if (typeof opts.onRoadChange === 'function') {
                opts.onRoadChange.call();
            }
        }
        
        // ------------------ Text Box Utilities ---------------------
        function createTextBox( x, y, text ){
            var textobj = {};
            if (y < 20-plotpad.top)    y = 20 -plotpad.top;
            if (y > plotbox.height-15) y = plotbox.height-15;
            textobj.grp = focus.append('g');
            textobj.rect = textobj.grp.append('svg:rect')
                .attr('fill',   opts.textBoxCol.bg)
                .attr('stroke', opts.textBoxCol.stroke);
            textobj.text = textobj.grp.append('svg:text')
                .attr('text-anchor', 'middle')
                .text(text).attr('class', 'svgtxt');
            var bbox = textobj.text.node().getBBox();
            var margin = opts.textBox.margin;
            textobj.rect
                .attr('x', bbox.x-margin)
                .attr('y', bbox.y-margin)
                .attr('width',  bbox.width + margin*2)
                .attr('height', bbox.height+ margin*2);

            if (x < bbox.width/2) x = bbox.width/2;
            if (x > plotbox.width-bbox.width/2) x =plotbox.width-bbox.width/2;

            textobj.grp
                .attr('transform', 'translate('+(x+plotpad.left)+","
                      +(y+plotpad.top)+")");
            return textobj;
        }

        function updateTextBox( obj, x, y, text ) {
            if (y < 20-plotpad.top) y = 20 -plotpad.top;
            if (y > plotbox.height-15) y = plotbox.height-15;
            obj.text.text(text);
            var bbox = obj.text.node().getBBox();
            var margin = opts.textBox.margin;
            obj.rect
                .attr('x', bbox.x-margin)
                .attr('y', bbox.y-margin)
                .attr('width',  bbox.width +margin*2)
                .attr('height', bbox.height+margin*2);

            if (x < bbox.width/2) x = bbox.width/2;
            if (x > plotbox.width-bbox.width/2) x =plotbox.width-bbox.width/2;
            obj.grp.attr('transform', 'translate('+(x+plotpad.left)+","
                         +(y+plotpad.top)+")");
        }

        function removeTextBox( obj ) {
            obj.grp.remove();
        }

        function hideTextBox( obj, hide ) {
            obj.grp.attr("visibility", (hide)?"hidden":"visible");
        }

        // Private variables holding goal, road and datapoint info
        var 
        goal = {},       // Holds loaded goal parameters
        roads = [],        // Holds the current road matrix
        initialRoad = [],  // Holds the initial road matrix
        datapoints = [],   // Holds the current set of past datapoints 
        fuda = [], // Holds the current set of future datapoints 
        undoBuffer = [],   // Array of previous roads for undo
        redoBuffer = [];   // Array of future roads for redo

        // Initialize goal with sane values
        goal.yaw = +1; goal.dir = +1;
        goal.tcur = 0; goal.vcur = 0;
        var now = moment.utc();
        now.hour(0); now.minute(0); now.second(0); now.millisecond(0);
        goal.asof = now.unix();
        goal.horizon = goal.asof+AKH;
        goal.xMin = goal.asof;  goal.xMax = goal.horizon;
        goal.yMin = -1;    goal.yMax = 1;

        var horindex = null; // Road segment index including the horizon

        // ------- Zoom and brush  related private functions ---------
        var ticks, tickType = 1, majorSkip = 7;
        function computeXTicks() {
            var xr = xScale.domain();
            ticks = [];
            ticks.push([d3.utcDay.range(xr[0], xr[1], 1),"%b %d"]);
            ticks.push([d3.utcDay.range(xr[0], xr[1], 2),"%b %d"]);
            ticks.push([d3.utcWeek.range(xr[0], xr[1], 1),"%b %d"]);
            ticks.push([d3.utcWeek.range(xr[0], xr[1], 2),"%b %d"]);
            ticks.push([d3.utcMonth.every(1).range(xr[0], xr[1]),"%b %Y"]);
            ticks.push([d3.utcMonth.every(2).range(xr[0], xr[1]),"%b %Y"]);
            ticks.push([d3.utcYear.every(1).range(xr[0], xr[1]),"%Y"]);
        }
        function redrawXTicks() {
            //console.debug("redrawXTicks()");
            var xr = [newXScale.invert(0).getTime(), 
                          newXScale.invert(plotbox.width).getTime()];

            var diff = ((xr[1] - xr[0])/(1000*SID));
            if (diff < 10) {
                tickType = 0; majorSkip = 1;
            } else if (diff < 20) {
                tickType = 0; majorSkip = 2;
            } else if (diff < 45) {
                tickType = 0; majorSkip = 7;
            } else if (diff < 120) {
                tickType = 1; majorSkip = 7;
            } else if (diff < 365){
                tickType = 2; majorSkip = 7;
            } else if (diff < 2*365){
                tickType = 4; majorSkip = 3;
            } else if (diff < 4*365){
                tickType = 5; majorSkip = 3;
            } else {
                tickType = 6; majorSkip = 1;              
            }
            var pt = ticks[tickType][0].filter(function(d){
                return (d.getTime()<xr[0]);});
            var ind = majorSkip - (pt.length)%majorSkip - 1;
            var tv = ticks[tickType][0].filter(function(d){
                return (d.getTime()>=xr[0]&&d.getTime()<=xr[1]);});
            xAxis.tickValues(tv)
                .tickSize(7)
                .tickFormat(function(d,i){ 
                    return d3.timeFormat((i%majorSkip==ind)
                                         ?ticks[tickType][1]:"")(d);});
            xAxisObj.call(xAxis.scale(newXScale));
            xAxisObj.selectAll("g").classed("minor", false);
            xAxisObj.selectAll("g")
                .filter(function (d, i) {return (i%majorSkip!=ind);})
                .classed("minor", true);

            if (!opts.roadEditor) {
                xGrid.tickValues(tv).tickSize(plotbox.width);
                xGridObj.call(xGrid.scale(newXScale));
                xGridObj.selectAll("g").classed("minor", false);
                xGridObj.selectAll("g")
                    .filter(function (d, i) {return (i%majorSkip!=ind);})
                    .classed("minor", true);
            }
        }

        function adjustYScale() {
            var xrange = [newXScale.invert(0), 
                          newXScale.invert(plotbox.width)];
            var xtimes = xrange.map(function(d) {
                return Math.floor(d.getTime()/1000);});

            var roadextent 
                    = roadExtentPartial(roads,xtimes[0],xtimes[1],false);
            var oldroadextent 
                    = roadExtentPartial(initialRoad,xtimes[0],xtimes[1],false);
            var dataextent 
                    = dataExtentPartial(datapoints,xtimes[0],xtimes[1],false);
            var allextent = mergeExtents(roadextent, oldroadextent);
            allextent = mergeExtents(allextent, dataextent);
            var p = {xmin:0.0, xmax:0.0, ymin:0.10, ymax:0.10};
            enlargeExtent(allextent, p);
            if ((allextent.yMax - allextent.yMin) < 3*goal.lnw) {
                allextent.yMax += 1.5*goal.lnw;
                allextent.yMin -= 1.5*goal.lnw;
            }

            var yrange = [allextent.yMax, allextent.yMin];
            var newtr = 
                    d3.zoomIdentity
                    .scale(plotbox.height/(yScale(yrange[1])
                                           -yScale(yrange[0])))
                    .translate(0, -yScale(yrange[0]));
            newYScale = newtr.rescaleY(yScale);
            yAxisObj.call(yAxis.scale(newYScale));
            yAxisObjR.call(yAxisR.scale(newYScale));

            // Resize brush if dynamic y limits are beyond graph limits
            if (allextent.yMax > goal.yMax) goal.yMax = allextent.yMax;
            if (allextent.yMin < goal.yMin) goal.yMin = allextent.yMin;
            resizeContext();

            var sx = xrange.map(function (x){return xScaleB(x);});
            var sy = yrange.map(function (y){return yScaleB(y);});
            focusrect
                .attr("x", sx[0]+1).attr("width", sx[1]-sx[0]-2)
                .attr("y", sy[0]+1).attr("height", sy[1]-sy[0]-2);
        }

        function resizeContext(){
            if (opts.divGraph == null) return;
            xScaleB.domain([new Date(goal.xMin*1000), 
                               new Date(goal.xMax*1000)]);
            xAxisObjB.call(xAxisB.scale(xScaleB));
            yScaleB.domain([goal.yMin, goal.yMax]);
        }

        function resizeBrush() {
            if (opts.divGraph == null) return;
            var limits = [xScaleB(newXScale.invert(0)), 
                          xScaleB(newXScale.invert(plotbox.width))];
            if (limits[0] < 0) limits[0] = 0;
            if (limits[1] > brushbox.width) limits[1] = brushbox.width;
            brush.call(brushObj.move, limits );
        }

        function reloadBrush() {
            resizeContext();
            resizeBrush();
        }

        function zoomed() {
            //console.debug("zoomed()");
            if ( roads.length == 0 ) return;
            if (d3.event && d3.event.sourceEvent 
                && d3.event.sourceEvent.type === "brush") return;

            // Inject the current transform into the plot element
            var tr = d3.zoomTransform(zoomarea.node());
            if (tr == null) return;
            
            newXScale = tr.rescaleX(xScale);
            redrawXTicks();
            adjustYScale();

            resizeBrush();
            updateGraphData();
            return;
        }

        function brushed() {
            if ( roads.length == 0 ) return;
            if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") 
                return;
            var s = d3.event.selection || xScaleB.range();
            
            newXScale.domain(s.map(xScaleB.invert, xScaleB));
            redrawXTicks();
            adjustYScale();

            zoomarea.call(axisZoom.transform, d3.zoomIdentity
                          .scale(brushbox.width / (s[1] - s[0]))
                          .translate(-s[0], 0));
            updateGraphData();
        }

        function zoomAll() {
            if (opts.divGraph == null) return;
            //console.debug('zoomAll:');
            computePlotLimits( false );
            xScale.domain([new Date(goal.xMin*1000), 
                              new Date(goal.xMax*1000)]);
            computeXTicks();
            yScale.domain([goal.yMin, goal.yMax]);
            newXScale = xScale; newYScale = yScale;
            resizeContext();
            zoomarea.call(axisZoom.transform, d3.zoomIdentity);

            // Relocate zoom buttons based on road yaw
            if (goal.yaw > 0) {
                zoomin.attr("transform", zoombtntr.botin);
                zoomout.attr("transform", zoombtntr.botout);
            } else {
                zoomin.attr("transform", zoombtntr.topin);
                zoomout.attr("transform", zoombtntr.topout);
            }
            reloadBrush();
            updateGraphData();
            updateTable();
            updateContextData();
        }
        // ---------------- Undo/Redo functionality --------------------

        function clearUndoBuffer() {
            undoBuffer = [];
            redoBuffer = [];
        }

        function redoLastEdit() {
            //console.debug("redoLastEdit: Undo Buffer has "+undoBuffer.length+" entries");
            if (redoBuffer.length == 0) return;
            pushUndoState(true);
            roads = redoBuffer.pop();
            roadChanged();

            return;
        }

        function undoLastEdit() {
            //console.debug("undoLastEdit: Undo Buffer has "+undoBuffer.length+" entries");
            if (undoBuffer.length == 0) return;
            if (undoBuffer.length == 0 || 
                !sameRoads(undoBuffer[undoBuffer.length-1], roads)) {
                redoBuffer.push(roads);
            }
            roads = undoBuffer.pop();
            roadChanged();
            return;
        }

        function pushUndoState(fromredo = false) {
            //console.debug("pushUndoState: Undo Buffer has "+undoBuffer.length+" entries");
            if (undoBuffer.length == 0 || 
                !sameRoads(undoBuffer[undoBuffer.length-1], roads)) {
                undoBuffer.push(copyRoad(roads));
                if (!fromredo) {
                    redoBuffer = [];        
                }
            }
        }


        var flad = null;     // Holds the flatlined datapoint if it exists
        function flatline() {
            flad = null;
            var now = goal.asof;
            var numpts = datapoints.length;
            var tlast = datapoints[numpts-1][0];
            var vlast = datapoints[numpts-1][1];
            var tfin = roads[roads.length-1].sta[0];
            if (tlast > tfin) return;
            var x = tlast; // x = the time we're flatlining to
            if (goal.yaw * goal.dir < 0) 
                x = d3.min([now, tfin]); // WEEN/RASH: flatline all the way
            else { // for MOAR/PHAT, stop flatlining if 2 red days in a row
                var prevcolor = null;
                var newcolor;
                while (x <= d3.min([now, tfin])) { // walk forward from tlast
                    newcolor = dotcolor( roads, goal, x, vlast );
                    // done iff 2 reds in a row
                    if (prevcolor===newcolor && prevcolor===Cols.REDDOT) 
                        break;
                    prevcolor = newcolor;
                    x += SID; // or see eth.pad/ppr
                };
                x = d3.min([x, now, tfin]);
                for (var i = 0; i < numpts; i++) {
                    if (x == datapoints[i][0])
                        return;
                }
                var prevpt = datapoints[numpts-1];
                flad = [x, vlast, DPTYPE.FLATLINE, prevpt[0], prevpt[1]];
                datapoints.push(flad);
            }
        }

        // Determines whether the given road is valid or not (i.e. whether it
        // is clear of the pink region or not)
        function isRoadValid( rd ) {
            var ir = initialRoad;
        
            var now = goal.asof;
            var hor = goal.horizon;
            // Check left/right boundaries of the pink region
            if (goal.yaw*rdf(rd, now) < goal.yaw*rdf(ir, now)) 
                return false;
            if (goal.yaw*rdf(rd, hor) < goal.yaw*rdf(ir, hor)) 
                return false;
            // Iterate through and check current road points in the ping range
            var rd_i1 = findRoadSegment(rd, now);
            var rd_i2 = findRoadSegment(rd, hor);
            for (var i = rd_i1; i < rd_i2; i++) {
                if (goal.yaw*rdf(rd, rd[i].end[0]) < 
                    goal.yaw*rdf(ir, rd[i].end[0])) return false;
            }
            // Iterate through and check old road points in the ping range
            var ir_i1 = findRoadSegment(ir, now);
            var ir_i2 = findRoadSegment(ir, hor);
            for (i = ir_i1; i < ir_i2; i++) {
                if (goal.yaw*rdf(rd, ir[i].end[0]) < 
                    goal.yaw*rdf(ir, ir[i].end[0])) return false;
            }
            return true;
        }


        function mergeExtents( ext1, ext2) {
            var ne = {};

            ne.xMin = d3.min([ext1.xMin, ext2.xMin]);
            ne.xMax = d3.max([ext1.xMax, ext2.xMax]);
            ne.yMin = d3.min([ext1.yMin, ext2.yMin]);
            ne.yMax = d3.max([ext1.yMax, ext2.yMax]);
            return ne;
        }

        function enlargeExtent( extent, p) {
            var xdiff = extent.xMax - extent.xMin;
            if (xdiff < 1) xdiff = 1;
            var ydiff = extent.yMax - extent.yMin;
            if (ydiff < 1) ydiff = 1;

            extent.xMin = extent.xMin - p.xmin*xdiff;
            extent.xMax = extent.xMax + p.xmax*xdiff;
            extent.yMin = extent.yMin - p.ymin*ydiff;
            extent.yMax = extent.yMax + p.ymax*ydiff;
        }

        function roadExtent( rd, extend = true ) {
            var extent = {};
            // Compute new limits for the current data
            extent.xMin = d3.min(rd, function(d) { return d.end[0]; });
            extent.xMax = d3.max(rd, function(d) { return d.sta[0]; });
            extent.yMin = d3.min(rd, function(d) { return d.sta[1]; });
            extent.yMax = d3.max(rd, function(d) { return d.sta[1]; });
            // Extend limits by 5% so everything is visible
            var p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10};
            if (extend) enlargeExtent(extent, p);
            return extent;
        }

        function dataExtentPartial( data, xmin, xmax, extend = false ) {
            var extent = {};
            // Compute new limits for the current data
            extent.xMin = d3.min(data, function(d) { 
                return (d[0] <xmin||d[0]>xmax)?Infinity:d[0]; });
            extent.xMax = d3.max(data, function(d) { 
                return (d[0] <xmin||d[0]>xmax)?-Infinity:d[0]; });
            extent.yMin = d3.min(data, function(d) { 
                return (d[0] <xmin||d[0]>xmax)?Infinity:d[1]; });
            extent.yMax = d3.max(data, function(d) { 
                return (d[0] <xmin||d[0]>xmax)?-Infinity:d[1]; });

            // Extend limits by 5% so everything is visible
            var p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10};
            if (extend) enlargeExtent(extent, p);
            return extent;
        }

        function roadExtentPartial( rd, xmin, xmax, extend = false ) {
            var extent = {};
            // Compute new limits for the current data
            extent.xMin = xmin;
            extent.xMax = xmax;
            extent.yMin = d3.min(rd, function(d) { 
                return (d.sta[0] <xmin||d.sta[0]>xmax)?Infinity:d.sta[1]; });
            extent.yMax = d3.max(rd, function(d) { 
                return (d.sta[0] <xmin||d.sta[0]>xmax)?-Infinity:d.sta[1]; });
            extent.yMin = d3.min([extent.yMin, rdf(rd,xmin), rdf(rd,xmax)]);
            extent.yMax = d3.max([extent.yMax, rdf(rd,xmin), rdf(rd,xmax)]);
            // Extend limits by 5% so everything is visible
            var p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10};
            if (extend) enlargeExtent(extent, p);
            return extent;
        }

        function computePlotLimits( adjustZoom = true ) {
            if (roads.length == 0) return;

            var now = goal.asof;
            var maxx = daysnap(d3.min([now+opts.maxFutureDays*SID, 
                               roads[roads.length-1].sta[0]]));
            var cur = roadExtentPartial( roads, roads[0].end[0], maxx, false );
            var old = roadExtentPartial(initialRoad,roads[0].end[0],maxx,false);
            var ne = mergeExtents( cur, old );

            var data = dataExtentPartial(datapoints,roads[0].end[0],datapoints[datapoints.length-1][0],false);
            ne = mergeExtents(ne, data);
            if (fuda.length != 0) {
                var df = dataExtentPartial(fuda,roads[0].end[0],maxx,false);
                ne = mergeExtents(ne, df);
            }

            var p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10};
            enlargeExtent(ne, p);

            goal.xMin = daysnap(ne.xMin); goal.xMax = daysnap(ne.xMax);
            goal.yMin = ne.yMin; goal.yMax = ne.yMax;

            if ( adjustZoom && opts.divGraph != null) {
                var xrange = [newXScale.invert(0), 
                              newXScale.invert(plotbox.width)];
                var yrange = [newYScale.invert(0), 
                              newYScale.invert(plotbox.height)];
                xScale.domain([new Date(goal.xMin*1000), 
                                  new Date(goal.xMax*1000)]);
                computeXTicks();
                yScale.domain([goal.yMin, goal.yMax]);
                var newtr = d3.zoomIdentity.scale(plotbox.width
                                                  /(xScale(xrange[1]) 
                                                    - xScale(xrange[0])))
                        .translate(-xScale(xrange[0]), 0);
                zoomarea.call( axisZoom.transform, newtr );
            }
        }
        
        function legacyIn(p) {
            if (p.hasOwnProperty('gldt') && !p.hasOwnProperty('tfin')) 
                p.tfin = p.gldt;
            if (p.hasOwnProperty('goal') && !p.hasOwnProperty('vfin')) 
                p.vfin = p.goal;
            if (p.hasOwnProperty('rate') && !p.hasOwnProperty('rfin')) 
                p.rfin = p.rate;
            if (p.hasOwnProperty('reset') && !p.hasOwnProperty('sadreset')) 
                p.sadreset = p.reset;
            if (p.hasOwnProperty('usr') && p.hasOwnProperty('graph') 
                && !p.hasOwnProperty('yoog')) 
                p.yoog = p.usr + "/" + p.graph;
        }
        
        function initGlobals() {

            initialRoad = [];
            goal = {}; 

            datapoints = [];
            flad = null;
            fuda = [];
            allvals = {};
            aggval = {};
            goal.nw = 0;
            goal.siru = null;
            oresets = [];
        }

        function parserow(row) {
            if (!Array.isArray(row) || row.length != 3) return row;
            return [dayparse(row[0]), row[1], row[2]];
        }

        function stampIn(p,d) {
            if (p.hasOwnProperty('sadreset')) p.sadreset = dayparse(p.sadreset);
            if (p.hasOwnProperty('asof'))     p.asof = dayparse(p.asof);
            if (p.hasOwnProperty('tini'))     p.tini = dayparse(p.tini);
            if (p.hasOwnProperty('tfin'))     p.tfin = dayparse(p.tfin);
            if (p.hasOwnProperty('tmin'))     p.tmin = dayparse(p.tmin);
            if (p.hasOwnProperty('tmax'))     p.tmax = dayparse(p.tmax);
            if (p.hasOwnProperty('road'))     p.road = p.road.map(parserow);

            return d.map(function(r) {return [dayparse(r[0]), r[1], r[2]];})
                .sort(function(a,b){ return a[0]-b[0];});
        }

        function procRoad( json ) {
            roads = [];
            var rdData = json;
            var nk = rdData.length;
            var firstsegment;

            firstsegment = {
                sta: [dayparse(goal.tini), Number(goal.vini)],
                slope: 0, auto: RP.SLOPE };
            firstsegment.end = firstsegment.sta.slice();
            firstsegment.sta[0] = daysnap(firstsegment.sta[0]-100*DIY*SID);
            roads.push(firstsegment);
            for (var i = 0; i < nk+1; i++) {
                var segment = {};
                segment.sta = roads[roads.length-1].end.slice();
                var rddate = null, rdvalue = null, rdslope = null;

                if (i < nk) {
                    rddate = rdData[i][0];
                    rdvalue = rdData[i][1];
                    rdslope = rdData[i][2];
                } else {
                    rddate = goal.tfin;
                    rdvalue = goal.vfin;
                    rdslope = goal.rfin;
                }

                if (rddate == null) {
                    segment.end = [0, Number(rdvalue)];
                    segment.slope = Number(rdslope)/(goal.siru);
                    segment.end[0] 
                        = (segment.end[1] - segment.sta[1])/segment.slope;
                    segment.auto = RP.DATE;
                } else if (rdvalue == null) {
                    segment.end = [rddate, 0];
                    segment.slope = Number(rdslope)/(goal.siru);
                    segment.end[1] = 
                        segment.sta[1]
                        +segment.slope*(segment.end[0]-segment.sta[0]);
                    segment.auto = RP.VALUE;
                } else if (rdslope == null) {
                    segment.end = [rddate, Number(rdvalue)];
                    segment.slope = roadSegmentSlope(segment);
                    segment.auto = RP.SLOPE;
                } 
                // Skip adding segment if it is earlier than the first segment
                if (segment.end[0] >= segment.sta[0]) {
                    roads.push(segment);
                }
            }
            var finalsegment = {
                sta: roads[roads.length-1].end.slice(),
                end: roads[roads.length-1].end.slice(),
                slope: 0, auto: RP.VALUE };
            finalsegment.end[0] = daysnap(finalsegment.end[0]+100*DIY*SID);
            roads.push(finalsegment);
            initialRoad = copyRoad( roads );
        }

        function procData() {
            var numpts = datapoints.length, i;
            for (i = 0; i < numpts; i++) {
                datapoints[i].splice(-1,1); // Remove comment
                datapoints[i][0] = dayparse(datapoints[i][0]);
            }
            if (goal.odom) {
                oresets = datapoints.filter(function(e){ return (e[1]==0);});
                odomify(datapoints);
            }

            var nonfuda = datapoints.filter(function(e){
                return e[0]<=goal.asof;});
            if (goal.plotall) goal.numpts = nonfuda.length;

            aggval = {};
            allvals = {};

            // Aggregate datapoints and handle kyoom
            var newpts = [];
            var ct = datapoints[0][0], vl = [datapoints[0][1]];
            var pre = 0, prevpt, ad;
            for (i = 1; i < datapoints.length; i++) {
                if (datapoints[i][0] == ct) {
                    vl.push(datapoints[i][1]);
                } else {
                    ad = AGGR[goal.aggday](vl);
                    if (newpts.length > 0) prevpt = newpts[newpts.length-1];
                    else prevpt = [ct, ad+pre];
                    //pre remains 0 for non-kyoom
                    newpts.push([ct, pre+ad, (ct <= goal.asof)
                                 ?DPTYPE.AGGPAST:DPTYPE.AGGFUTURE, 
                                 prevpt[0], prevpt[1]]);
                    if (goal.kyoom) {
                        if (goal.aggday === "sum") allvals[ct] 
                            = accumulate(vl).map(function(e){return e+pre;});
                        else allvals[ct] = vl.map(function(e) { return e+pre;});
                        aggval[ct] = pre+ad;
                        pre += ad; 
                    } else {
                        allvals[ct] = vl;
                        aggval[ct] = ad;
                    }

                    ct = datapoints[i][0];
                    vl = [datapoints[i][1]];
                }
            }
            ad = AGGR[goal.aggday](vl);
            if (newpts.length > 0) prevpt = newpts[newpts.length-1];
            else prevpt = [ct, ad+pre];
            newpts.push([ct, ad+pre, 
                         (ct <= goal.asof)?DPTYPE.AGGPAST:DPTYPE.AGGFUTURE,
                         prevpt[0], prevpt[1]]);
            if (goal.kyoom) {
                if (goal.aggday === "sum") allvals[ct] 
                    = accumulate(vl).map(function(e){return e+pre;});
                else allvals[ct] = vl.map(function(e) { return e+pre;});
                aggval[ct] = pre+ad;
            } else {
                allvals[ct] = vl;
                aggval[ct] = ad;
            }

            fuda = newpts.filter(function(e){return e[0]>goal.asof;});
            datapoints = newpts.filter(function(e){return e[0]<=goal.asof;});

            if (!goal.plotall) goal.numpts = datapoints.length;
        }

        function procParams( p ) {
            flatline();
            goal.tcur = datapoints[datapoints.length-1][0];
            goal.vcur = datapoints[datapoints.length-1][1];

            goal.lnw = lnfraw( initialRoad, goal, goal.tcur );
        }

        // Recreates the road array from the "rawknots" array, which includes
        // only timestamp,value pairs
        function loadGoal( json ) {
            clearUndoBuffer();

            legacyIn(json.params);
            initGlobals();
            datapoints = stampIn(json.params, json.data);

            // Extract parameters from the json and fill in the goal object
            goal.runits = json.params.runits;
            goal.siru = SECS[json.params.runits];
            goal.asof = json.params.asof;
            goal.horizon = goal.asof+AKH;
            goal.tfin = json.params.tfin;
            goal.vfin = json.params.vfin;
            goal.rfin = json.params.rfin;
            goal.yaw = Number(json.params.yaw);
            goal.dir = Number(json.params.dir);
            if (json.params.hasOwnProperty('abslnw'))
                goal.abslnw = json.params.abslnw;
            goal.odom = (json.params.hasOwnProperty('odom')
                         && json.params.odom);
            goal.kyoom = (json.params.hasOwnProperty('kyoom') 
                         && json.params.kyoom);
            if ( json.params.hasOwnProperty('aggday'))
                goal.aggday = json.params.aggday;
            else {
                if (goal.kyoom) goal.aggday = "sum";
                else goal.aggday = "last";
            }
            goal.plotall = (json.params.hasOwnProperty('plotall')
                         && json.params.plotall);
            goal.yaxis =
                (json.params.hasOwnProperty('yaxis'))?json.params.yaxis:"";
            goal.steppy = 
                (json.params.hasOwnProperty('steppy'))?json.params.steppy:true;

            // Process datapoints
            procData();
            var vtmp;
            if (json.params.hasOwnProperty('tini')) {
                goal.tini = json.params.tini;
            } else {
                goal.tini = datapoints[0][0];
            }
            if (allvals.hasOwnProperty(goal.tini))
                vtmp = (goal.plotall)?allvals[goal.tini][0]:aggval[goal.tini];
            else
                vtmp = json.params.vini;
            if (!allvals.hasOwnProperty(goal.vini)) {
                goal.vini = (goal.kyoom)?0:vtmp;
            } else {
                goal.vini = json.params.vini;
            }

            // Extract the road from the json and fill in details
            procRoad( json.params.road );

            procParams( json.params );

            // Finally, wrap up with graph related initialization
            zoomAll();

            if (opts.divGraph != null) {
                yAxisLabel.text(goal.yaxis);
                var bbox = yAxisObj.node().getBBox();
                yaxisw = bbox.width;
                resizeGraph();
            }
            zoomAll();
        }

        function loadGoalFromURL( url ) {
            loadJSON(url, 
                     function(resp) { 
                         loadGoal(resp);
                         roadChanged();
                         updateRoadTableTitle();
                     });  
        }

        function setSafeDays( days ) {
            var curdtd = dtd(roads, goal, goal.tcur, goal.vcur);
            var now = goal.asof;
            if (days < 0) days = 0;
            // Look into the future to see the road value to ratchet to
            var daydiff = curdtd - (days - 1) - 1;
            if (daydiff <= 0) return;
            var futureDate= goal.asof + daydiff*SID;
            var ratchetValue = rdf( roads, futureDate.unix());

            // Find or add two new dots at asof
            // We only allow the first step to record undo info.
            var first = -1;
            var i;
            for (i = 1; i < roads.length; i++) {
                if (roads[i].sta[0] === now) {
                    first = i-1;
                    break;
                }
            }
            var added = false;
            if (first < 0) {addNewDot(now);added = true;}
            var second;
            if (i+1 < roads.length && roads[i+1].sta[0] === now)
                second = i;
            else {
                second = addNewDot(now); 
                if (added) {undoBuffer.pop(); added = true;}
            }
            changeDotValue( second, ratchetValue, false );
            if (added) {undoBuffer.pop(); added = true;}

            roadChanged();
        }

        // Adds a new dot to the supplied x value, with the y value computed
        // from the corresponding y value
        function addNewDot(x) {
            var found = findRoadSegment(roads, x);
            
            if (found >= 0) {
                var segment = {};
                var newx = daysnap(x);
                var newy = roads[found].sta[1] + roads[found].slope*(newx - roads[found].sta[0]);
                pushUndoState();
                if (found == 0) {
                    // First segment splitted
                    roads[found].end = [newx, newy];
                    segment.sta = [newx, newy];
                    segment.end = roads[found+1].sta.slice();
                } else {
                    segment.sta = [newx, newy];
                    if (found == roads.length-1) {
                        // Last segment splitted
                        segment.end = roads[found].end.slice();
                        segment.end[1] = segment.sta[1];
                    } else {
                        segment.end = roads[found+1].sta.slice();
                    }
                    roads[found].end = [newx, newy];
                    roads[found].slope = roadSegmentSlope(roads[found]);
                }
                segment.slope = roadSegmentSlope(segment);
                segment.auto = RP.VALUE;
                roads.splice(found+1, 0, segment);
                
                roadChanged();
            }
            return found;
        }

        function addNewKnot(kind) {
            if (kind < roads.length-1) {
                addNewDot((roads[kind].sta[0] + roads[kind+1].sta[0])/2);
            } else {
                addNewDot(roads[kind].sta[0] + 7*SID);
            }
        }

        function removeKnot(kind, fromtable) {
            pushUndoState();

            var oldslope = roads[kind].slope;
            roads.splice(kind, 1);
            if (opts.keepslopes) roads[kind].slope = oldslope;
            fixRoadArray( roads, 
                          opts.keepslopes?RP.VALUE
                          :RP.SLOPE, fromtable );

            roadChanged();
        }

        // -------------- Functions for manipulating knots ---------------
        var roadsave, knotind, knotdate, knottext, dottext, slopetext;

        function createDragInfo( pt, slope = undefined ) {
	        var ptx = newXScale(daysnap(pt[0])*1000);
	        var pty = pt[1];
            knotdate = moment.unix(pt[0]).utc();
            knottext = createTextBox(ptx, plotbox.height-15, 
                                     knotdate.format('YYYY-MM-DD'));
            dottext = createTextBox(ptx, newYScale(pty)-15, 
                                    pt[1].toPrecision(5));
            if (slope != undefined) {
	            var slopex = newXScale(daysnap(slope[0])*1000);
	            var slopey = newYScale(slope[1]);
                slopetext = createTextBox(slopex,slopey, 
                                          "s:"+slope[2].toPrecision(5));
                if (ptx - slopex < 50) hideTextBox(slopetext, true);
            }
        }
        function updateDragInfo( pt, slope ) {
            var ptx = daysnap(pt[0]);
            var pty = pt[1];
            knotdate = moment.unix(ptx).utc(); 
            updateTextBox(knottext, newXScale(ptx*1000), plotbox.height-15, 
                          knotdate.format('YYYY-MM-DD'));
            updateTextBox(dottext, newXScale(ptx*1000), newYScale(pty)-15, 
                          pt[1].toPrecision(opts.precision));
            if (slope != undefined) {
	            var slopex = daysnap(slope[0]);
	            var slopey = slope[1];
                updateTextBox(slopetext, newXScale(slopex*1000), 
                              newYScale(slopey), 
                              "s:"+slope[2].toPrecision(5));
            }
        }
        function removeDragInfo( ) {
            removeTextBox(knottext);
            removeTextBox(dottext);
            if (slopetext != null) removeTextBox(slopetext);
            knottext = null;
            dottext = null;
            slopetext = null;

            roadsave = null;
        }

        function updateDragPositions( kind, updateKnots ) {
            var rd = roads;
            for (var ii = kind; ii < rd.length; ii++) {
  	            d3.select("[name=dot"+ii+"]")
	                .attr("cx", newXScale(rd[ii].end[0]*1000))
		            .attr("cy", newYScale(rd[ii].end[1]));
  	            d3.select("[name=ctxdot"+ii+"]")
	                .attr("cx", xScaleB(rd[ii].end[0]*1000))
		            .attr("cy", yScaleB(rd[ii].end[1]));
  		        d3.select("[name=road"+ii+"]")
	  	            .attr("x1", newXScale(rd[ii].sta[0]*1000))
		            .attr("y1", newYScale(rd[ii].sta[1]))
			        .attr("x2", newXScale(rd[ii].end[0]*1000))
			        .attr("y2", newYScale(rd[ii].end[1]));
  		        d3.select("[name=ctxroad"+ii+"]")
	  	            .attr("x1", xScaleB(rd[ii].sta[0]*1000))
		            .attr("y1", yScaleB(rd[ii].sta[1]))
			        .attr("x2", xScaleB(rd[ii].end[0]*1000))
			        .attr("y2", yScaleB(rd[ii].end[1]));
                if (updateKnots) {
  	                d3.select("[name=knot"+ii+"]")
	                    .attr("x1", newXScale(rd[ii].end[0]*1000))
		  	            .attr("x2", newXScale(rd[ii].end[0]*1000));
		            d3.select("[name=remove"+ii+"]")
                        .attr("transform", 
                              function(d){ 
                                  return "translate("+(newXScale(d.end[0]*1000)
                                                       +plotpad.left-8)
                                      +","+(plotpad.top-20)+") scale(0.6,0.6)";
                              });
                }
                var datestr = dayify(rd[ii].end[0], '-');
  		        d3.select("[name=enddate"+ii+"]")
                    .text(datestr);
  		        d3.select("[name=endvalue"+ii+"]")
                    .text(rd[ii].end[1].toPrecision(5));
  		        d3.select("[name=slope"+ii+"]")
                    .text((rd[ii].slope*goal.siru).toPrecision(5));
            }
            updateRoadValidity();
            updateWatermark();
            updateBullseye();
            updateContextBullseye();
            updateDataPoints();
            updateYBHP();
        }

        var editingKnot = false;
        function knotDragStarted(d,i) {
	        d3.event.sourceEvent.stopPropagation();
            editingKnot = true;
            highlightDate(i, true);
            pushUndoState();
            var kind = Number(this.id);
            roadsave = copyRoad( roads );
            createDragInfo( d.end );
            knottext.grp.raise();
        }

        function knotDragged(d,i) {
            // event coordinates are pre-scaled, so use normal scale
	        var x = daysnap(newXScale.invert(d3.event.x)/1000);
            var kind = Number(this.id);
            var rd = roads;
            if (x < rd[kind].sta[0]) x = rd[kind].sta[0];
            if (x > rd[kind+1].end[0]) x = rd[kind+1].end[0];

            var maxind = kind+1;
            if (opts.keepintervals) maxind = rd.length;

            for (var ii = kind; ii < maxind; ii++) {
	            rd[ii].end[0] 
                    = x + roadsave[ii].end[0] - roadsave[kind].end[0];
            }
            fixRoadArray( rd, opts.keepslopes?
                          RP.VALUE:RP.SLOPE,
                          false, RP.DATE );

            updateDragPositions( kind, true );
            updateDragInfo( d.end );
        };
        function knotDragEnded(d,i){
            highlightDate(i, false);
            editingKnot = false;

            removeDragInfo();

            roadChanged();
        };

        function knotDeleted(d) {
            var kind = Number(this.id);
            removeKnot(kind, false);
        }

        function changeKnotDate( kind, newDate, fromtable = true ) {
            pushUndoState();

	        var knotmin = (kind == 0) ? goal.xMin : (roads[kind].sta[0]) + 0.01;
	        var knotmax = 
                (kind == roads.length-1) 
                ? roads[kind].end[0]+0.01
                :(roads[kind+1].end[0]+0.01);
            if (newDate <= knotmin) newDate = daysnap(knotmin);
            if (newDate >= knotmax) newDate = daysnap(knotmin);
            roads[kind].end[0] = newDate;
            if (!fromtable) {
                // TODO?
            }
            fixRoadArray( roads, null, fromtable, RP.DATE );

            roadChanged();
        }

        function knotEdited(d, id) {
            var kind = Number(id);
            if (roads[kind].auto == RP.DATE) {
                if (opts.keepslopes) disableValue(id);
                else disableSlope(id);
            }
            var cell = d3.select('[name=enddate'+kind+']').node();
            cell.focus();
            var range, selection;
            if (document.body.createTextRange) {
                range = document.body.createTextRange();
                range.moveToElementText(cell);
                range.select();
            } else if (window.getSelection) {
                selection = window.getSelection();
                range = document.createRange();
                range.selectNodeContents(cell);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        };

        // ------------------- Functions for manipulating dots -----------------
        var editingDot = false;
        function dotDragStarted(d,id) {
            d3.event.sourceEvent.stopPropagation();
            editingDot = true;
            highlightValue(id, true);
            pushUndoState();
            roadsave = copyRoad( roads );
            var kind = id;
            if (kind != 0) {
                var seg = roads[kind];
                createDragInfo( d.sta, [(seg.sta[0]+seg.end[0])/2, 
                                        (seg.sta[1]+seg.end[1])/2, 
                                        seg.slope*goal.siru] );
            } else createDragInfo( d.sta );
            dottext.grp.raise();
        };
        function dotDragged(d, id) {
            var now = goal.asof;
	        var y = newYScale.invert(d3.event.y);
            var kind = id;
            var rd = roads;
            var seg = roads[kind];
	        seg.end[1] = y;
            seg.slope = roadSegmentSlope(seg);
            fixRoadArray( rd, opts.keepslopes?RP.VALUE
                          :RP.SLOPE,
                          false,RP.VALUE );

            var strt = (kind==0)?0:(kind-1);
            updateDragPositions( strt, false );
            if (kind != 0) {
                updateDragInfo( d.sta, [(seg.sta[0]+seg.end[0])/2, 
                                        (seg.sta[1]+seg.end[1])/2, 
                                        seg.slope*goal.siru] );
                } else updateDragInfo( d.sta );
        };
        function dotDragEnded(d,id){
            editingDot = false;
	        d3.select("[name=dot"+id+"]")
                .style("fill", opts.roadDotCol.editable);
            highlightValue(id, false);

            removeDragInfo();

            roadChanged();
        };

        function changeDotValue( kind, newValue, fromtable = false ) {
            pushUndoState();

            roads[kind].end[1] = newValue;
            if (!fromtable) {
                if (!opts.keepslopes) 
                    roads[kind].slope = roadSegmentSlope(roads[kind]);
                if (kind == 1) {
                    roads[kind-1].sta[1] = newValue;
                } else if (kind == roads.length-1) {
	                roads[kind].end[1] = newValue;
	                roads[kind-1].slope = 
                        (roads[kind].sta[1] - roads[kind-1].sta[1])
                        / (roads[kind].sta[0] - roads[kind-1].sta[0]);
                } else {
                    roads[kind-1].slope = 
                        (roads[kind].sta[1] - roads[kind-1].sta[1])
                        / (roads[kind].sta[0] - roads[kind-1].sta[0]);
                }
            }

            fixRoadArray( roads, opts.keepslopes?RP.VALUE:null, 
                          fromtable, RP.VALUE );

            roadChanged();
        }

        function dotEdited(d, id) {
            var kind = Number(id);
            if (roads[kind].auto == RP.VALUE) {
                disableSlope(id);  
            }
            var cell = d3.select('[name=endvalue'+kind+']').node();
            cell.focus();
            var range, selection;
            if (document.body.createTextRange) {
                range = document.body.createTextRange();
                range.moveToElementText(cell);
                range.select();
            } else if (window.getSelection) {
                selection = window.getSelection();
                range = document.createRange();
                range.selectNodeContents(cell);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        };

        // -------------- Functions for manipulating road segments ----------
        var editingRoad = false;
        var roadedit_x;
        function roadDragStarted(d,id) {
            //console.debug("roadDragStarted: "+id);
            d3.event.sourceEvent.stopPropagation();
            editingRoad = true;
            roadedit_x = daysnap(newXScale.invert(d3.event.x)/1000);
            highlightSlope(id, true);
            pushUndoState();
            roadsave = copyRoad( roads );
            var slopex = (d.sta[0]+d.end[0])/2;
            if (slopex < newXScale.invert(0)/1000) 
                slopex = newXScale.invert(0)/1000;
            if (slopex > newXScale.invert(plotbox.width)/1000 - 10) 
                slopex = newXScale.invert(plotbox.width)/1000 - 10;
            createDragInfo( d.end, [slopex, d.sta[1]+d.slope*(slopex-d.sta[0]),
                                    d.slope*goal.siru] );
            slopetext.grp.raise();
        };
        function roadDragged(d, id) {
            //console.debug("roadDragged()");
            var now = goal.asof;
            var x = daysnap(newXScale.invert(d3.event.x)/1000);
	        var y = newYScale.invert(d3.event.y);
            var kind = id;
            var rd = roads;

            roads[kind].slope 
                = ((y - d.sta[1])/d3.max([x - d.sta[0], SID]));
            roads[kind].end[1] = roads[kind].sta[1] 
                + roads[kind].slope*(roads[kind].end[0] 
                                     - roads[kind].sta[0]);
            roads[kind+1].sta[1] = roads[kind].end[1];
            if (!opts.keepslopes)
                roads[kind+1].slope = roadSegmentSlope(roads[kind+1]);

            fixRoadArray( rd, RP.VALUE,
                          false, RP.SLOPE );

            updateDragPositions( kind, true );
            var slopex = (d.sta[0]+d.end[0])/2;
            if (slopex < newXScale.invert(0)/1000) 
                slopex = newXScale.invert(0)/1000;
            if (slopex > newXScale.invert(plotbox.width)/1000 - 10) 
                slopex = newXScale.invert(plotbox.width)/1000 - 10;
            updateDragInfo( d.end, [slopex, d.sta[1]+d.slope*(slopex-d.sta[0]),
                                    d.slope*goal.siru]  );
        };
        function roadDragEnded(d,id){
            editingRoad = false;
            highlightSlope(id, false);

            removeDragInfo();

            roadChanged();
        };

        function changeRoadSlope(kind, newSlope, fromtable = false) {
            if (kind == roads.length-1) return;
            pushUndoState();

            roads[kind].slope = newSlope/(goal.siru);
            if (!fromtable) {
                if (!opts.keepslopes) {
                    roads[kind].end[1] = roads[kind].sta[1] 
                        + roads[kind].slope*(roads[kind].end[0] 
                                             - roads[kind].sta[0]);
                    roads[kind+1].sta[1] = roads[kind].end[1];
                    roads[kind+1].slope = roadSegmentSlope(roads[kind+1]);
                }
            }
            fixRoadArray( roads, null, fromtable, RP.SLOPE );

            roadChanged();
        }

        function roadEdited(d, id) {
            var kind = Number(id);
            if (d.auto == RP.SLOPE) {
                disableValue(id);
            }
            var cell = d3.select('[name=slope'+kind+']').node();
            cell.focus();
            var range, selection;
            if (document.body.createTextRange) {
                range = document.body.createTextRange();
                range.moveToElementText(cell);
                range.select();
            } else if (window.getSelection) {
                selection = window.getSelection();
                range = document.createRange();
                range.selectNodeContents(cell);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        };

        // ---------------- Functions to update SVG components ----------------

        // Creates or updates the shaded box to indicate past dates
        function updatePastBox() {
            if (opts.divGraph == null || roads.length == 0) return;
            var pastelt = gPastBox.select(".past");
            if (!opts.roadEditor) {
                pastelt.remove();
                return;
            }
            if (pastelt.empty()) {
                gPastBox.insert("svg:rect", ":first-child")
                    .attr("class","past")
	  	            .attr("x", newXScale(goal.xMin))
                    .attr("y", newYScale(goal.yMax+3*(goal.yMax-goal.yMin)))
		            .attr("width", newXScale(goal.asof*1000)
                          -newXScale(goal.xMin))		  
  		            .attr("height",7*Math.abs(newYScale(goal.yMin)
                                              -newYScale(goal.yMax)))
                    .attr("fill", opts.pastBoxCol.fill);
            } else {
                pastelt
	  	            .attr("x", newXScale(goal.xMin))
                    .attr("y", newYScale(goal.yMax+3*(goal.yMax-goal.yMin)))
		            .attr("width", newXScale(goal.asof*1000)
                          -newXScale(goal.xMin))		  
  		            .attr("height",7*Math.abs(newYScale(goal.yMin)
                                              -newYScale(goal.yMax)));
            }
        }
        // Creates or updates the shaded box to indicate past dates
        function updatePastText() {
            if (opts.divGraph == null || roads.length == 0) return;
            var todayelt = gPastText.select(".pastline");
            var pasttextelt = gPastText.select(".pasttext");
            if (!opts.roadEditor) {
                todayelt.remove();
                pasttextelt.remove();
                return;
            }
            if (todayelt.empty()) {
                gPastText.append("svg:line")
	                .attr("class","pastline")
	  	            .attr("x1", newXScale(goal.asof*1000))
                    .attr("y1",0)
		            .attr("x2", newXScale(goal.asof*1000))
                    .attr("y2",plotbox.height)
                    .attr("stroke", "rgb(0,0,200)") 
		            .style("stroke-width",opts.today.width);
            } else {
                todayelt
	  	            .attr("x1", newXScale(goal.asof*1000))
                    .attr("y1", 0)
		            .attr("x2", newXScale(goal.asof*1000))
                    .attr("y2", plotbox.height);
            }
            var textx = newXScale(goal.asof*1000)-8;
            var texty = plotbox.height/2;
            if (pasttextelt.empty()) {
                gPastText.append("svg:text")
	                .attr("class","pasttext")
	  	            .attr("x",textx ).attr("y",texty)
                    .attr("transform", "rotate(-90,"+textx+","+texty+")")
                    .attr("fill", "rgb(0,0,200)") 
                    .style("font-size", opts.horizon.font+"px") 
                    .text("Today");
            } else {
                pasttextelt
	  	            .attr("x", textx).attr("y", texty)
                    .attr("transform", "rotate(-90,"+textx+","+texty+")");
            }
        }

        function updateContextToday() {
            if (opts.divGraph == null || roads.length == 0) return;
            var todayelt = ctxplot.select(".ctxtoday");
            var pasttextelt = ctxplot.select(".ctxtodaytext");
            if (!opts.roadEditor) {
                todayelt.remove();
                pasttextelt.remove();
                return;
            }
            if (todayelt.empty()) {
                ctxplot.append("svg:line")
	                .attr("class","ctxtoday")
	  	            .attr("x1", xScaleB(goal.asof*1000))
                    .attr("y1",0)
		            .attr("x2", xScaleB(goal.asof*1000))
                    .attr("y2",brushbox.height)
                    .attr("stroke", "rgb(0,0,200)") 
		            .style("stroke-width",opts.horizon.ctxwidth);
            } else {
                todayelt
	  	            .attr("x1", xScaleB(goal.asof*1000))
                    .attr("y1",0)
		            .attr("x2", xScaleB(goal.asof*1000))
                    .attr("y2",brushbox.height);
            }
            var textx = xScaleB(goal.asof*1000)-5;
            var texty = brushbox.height/2;

            if (pasttextelt.empty()) {
                ctxplot.append("svg:text")
	                .attr("class","ctxtodaytext")
	  	            .attr("x",textx ).attr("y",texty)
                    .attr("transform", "rotate(-90,"+textx+","+texty+")")
                    .attr("fill", "rgb(0,0,200)") 
                    .style("font-size", (opts.today.ctxfont)+"px") 
                    .text("Today");
            } else {
                pasttextelt
	  	            .attr("x", textx).attr("y", texty)
                    .attr("transform", "rotate(-90,"+textx+","+texty+")");
            }
        }

        // Creates or updates the Bullseye at the goal date
        function updateBullseye() {
            if (opts.divGraph == null || roads.length == 0) return;
            var bullseyeelt = gBullseye.select(".bullseye");
            if (!opts.roadEditor) {
                bullseyeelt.remove();
                return;
            }
            var bx = newXScale(roads[roads.length-1].sta[0]*1000)-(opts.bullsEye.size/2);
            var by = newYScale(roads[roads.length-1].sta[1])-(opts.bullsEye.size/2);
            if (bullseyeelt.empty()) {
                gBullseye.append("svg:image")
	                .attr("class","bullseye")
	                .attr("xlink:href","https://cdn.glitch.com/0ef165d2-f728-4dfd-b99a-9206038656b2%2Fbullseye.png?1496219226927")
	  	            .attr("x",bx ).attr("y",by)
                    .attr('width', opts.bullsEye.size)
                    .attr('height', opts.bullsEye.size);
            } else {
                bullseyeelt
	  	            .attr("x", bx).attr("y", by);
            }
        }

        function updateContextBullseye() {
            if (opts.divGraph == null || roads.length == 0) return;
            var bullseyeelt = ctxplot.select(".ctxbullseye");
            if (!opts.roadEditor) {
                bullseyeelt.remove();
                return;
            }
            var bx = xScaleB(roads[roads.length-1].sta[0]*1000)
                -(opts.bullsEye.ctxsize/2);
            var by = yScaleB(roads[roads.length-1].sta[1])
                -(opts.bullsEye.ctxsize/2);
            if (bullseyeelt.empty()) {
                ctxplot.append("svg:image")
	                .attr("class","ctxbullseye")
	                .attr("xlink:href","https://cdn.glitch.com/0ef165d2-f728-4dfd-b99a-9206038656b2%2Fbullseye.png?1496219226927")
	  	            .attr("x",bx ).attr("y",by)
                    .attr('width', (opts.bullsEye.ctxsize))
                    .attr('height', (opts.bullsEye.ctxsize));
            } else {
                bullseyeelt.attr("x", bx).attr("y", by);
            }
        }

        // Creates or updates the Bullseye at the goal date
        function updateOldBullseye() {
            if (opts.divGraph == null || roads.length == 0) return;
            var png = (opts.roadEditor)?"https://cdn.glitch.com/0ef165d2-f728-4dfd-b99a-9206038656b2%2Fbullseye_old.png?1498051783901":"https://cdn.glitch.com/0ef165d2-f728-4dfd-b99a-9206038656b2%2Fbullseye.png?1496219226927";
            var bullseyeelt = gOldBullseye.select(".oldbullseye");
            var bx = newXScale(initialRoad[initialRoad.length-1]
                                  .sta[0]*1000)-(opts.bullsEye.size/2);
            var by = newYScale(initialRoad[initialRoad.length-1]
                                  .sta[1])-(opts.bullsEye.size/2);
            if (bullseyeelt.empty()) {
                gOldBullseye.append("svg:image")
	                .attr("class","oldbullseye")
	                .attr("xlink:href",png)
	  	            .attr("x",bx ).attr("y",by)
                    .attr('width', (opts.bullsEye.size))
                    .attr('height', (opts.bullsEye.size));
            } else {
                bullseyeelt
	  	            .attr("x", bx).attr("y", by);
            }
        }

        function updateContextOldBullseye() {
            if (opts.divGraph == null || roads.length == 0) return;
            var png = (opts.roadEditor)?"https://cdn.glitch.com/0ef165d2-f728-4dfd-b99a-9206038656b2%2Fbullseye_old.png?1498051783901":"https://cdn.glitch.com/0ef165d2-f728-4dfd-b99a-9206038656b2%2Fbullseye.png?1496219226927";
            var bullseyeelt = ctxplot.select(".ctxoldbullseye");
            var bx = xScaleB(initialRoad[initialRoad.length-1].sta[0]*1000)
                -(opts.bullsEye.ctxsize/2);
            var by = yScaleB(initialRoad[initialRoad.length-1].sta[1])
                -(opts.bullsEye.ctxsize/2);
            if (bullseyeelt.empty()) {
                ctxplot.append("svg:image")
	                .attr("class","ctxoldbullseye")
	                .attr("xlink:href",png)
	  	            .attr("x",bx ).attr("y",by)
                    .attr('width', (opts.bullsEye.ctxsize))
                    .attr('height', (opts.bullsEye.ctxsize));
            } else {
                bullseyeelt
	  	            .attr("x", bx).attr("y", by);
            }
        }

        // Creates or updates the watermark with the number of safe days
        function updateWatermark() {
            if (opts.divGraph == null || roads.length == 0) return;
            var wmarkelt = focus.select(".watermark");
            var bx = sw/2;
            var by = sh-20;
            var loser = isLoser(roads,goal,datapoints,goal.tcur,goal.vcur);
            var txt = (loser)?"Insta-Derail!!":"safe days: "
                    +dtd(roads, goal, goal.tcur, goal.vcur);
            
            if (wmarkelt.empty()) {
                focus.append("svg:text")
	                .attr("class","watermark")
	  	            .attr("x",bx ).attr("y",by)
                    .style('font-size', 30+"px")
                    .text(txt);
            } else {
                wmarkelt
	  	            .attr("x", bx).attr("y", by).text(txt);
            }
        }

        // Creates or updates the Akrasia Horizon line
        function updateHorizon() {
            if (opts.divGraph == null || roads.length == 0) return;
            var horizonelt = gHorizon.select(".horizon");
            if (horizonelt.empty()) {
                gHorizon.append("svg:line")
	                .attr("class","horizon")
	  	            .attr("x1", newXScale(goal.horizon*1000))
                    .attr("y1",0)
		            .attr("x2", newXScale(goal.horizon*1000))
                    .attr("y2",plotbox.height)
                    .attr("stroke", Cols.AKRA) 
                    .attr("stroke-dasharray", 
                          (opts.horizon.dash)+","+(opts.horizon.dash)) 
		            .style("stroke-width",opts.horizon.width*scalf);
            } else {
                horizonelt
	  	            .attr("x1", newXScale(goal.horizon*1000))
                    .attr("y1",0)
		            .attr("x2", newXScale(goal.horizon*1000))
                    .attr("y2",plotbox.height)
		            .style("stroke-width",opts.horizon.width*scalf);
            }
            var textx = newXScale(goal.horizon*1000)+(18);
            var texty = plotbox.height/2;
            var horizontextelt = gHorizonText.select(".horizontext");
            if (horizontextelt.empty()) {
                gHorizonText.append("svg:text")
	                .attr("class","horizontext")
	  	            .attr("x",textx ).attr("y",texty)
                    .attr("transform", "rotate(-90,"+textx+","+texty+")")
                    .attr("fill", Cols.AKRA) 
                    .style("font-size", (opts.horizon.font)+"px") 
                    .text("Akrasia Horizon");
            } else {
                horizontextelt
	  	            .attr("x", textx).attr("y", texty)
                    .attr("transform", "rotate(-90,"+textx+","+texty+")");
            }
        }

        function updateContextHorizon() {
            if (opts.divGraph == null || roads.length == 0) return;
            var horizonelt = ctxplot.select(".ctxhorizon");
            if (horizonelt.empty()) {
                ctxplot.append("svg:line")
	                .attr("class","ctxhorizon")
	  	            .attr("x1", xScaleB(goal.horizon*1000))
                    .attr("y1",yScaleB(goal.yMin-5*(goal.yMax-goal.yMin)))
		            .attr("x2", xScaleB(goal.horizon*1000))
                    .attr("y2",yScaleB(goal.yMax+5*(goal.yMax-goal.yMin)))
                    .attr("stroke", Cols.AKRA) 
                    .attr("stroke-dasharray", (opts.horizon.ctxdash)+","
                          +(opts.horizon.ctxdash)) 
		            .style("stroke-width",opts.horizon.ctxwidth);
            } else {
                horizonelt
	  	            .attr("x1", xScaleB(goal.horizon*1000))
                    .attr("y1",yScaleB(goal.yMin-5*(goal.yMax-goal.yMin)))
		            .attr("x2", xScaleB(goal.horizon*1000))
                    .attr("y2",yScaleB(goal.yMax+5*(goal.yMax-goal.yMin)));
            }

            var textx = xScaleB(goal.horizon*1000)+12;
            var texty = brushbox.height/2;

            var hortextelt = ctxplot.select(".ctxhortext");
            if (hortextelt.empty()) {
                ctxplot.append("svg:text")
	                .attr("class","ctxhortext")
	  	            .attr("x",textx ).attr("y",texty)
                    .attr("transform", "rotate(-90,"+textx+","+texty+")")
                    .attr("fill", Cols.AKRA) 
                    .style("font-size", (opts.horizon.ctxfont)+"px") 
                    .text("Horizon");
            } else {
                hortextelt
	  	            .attr("x", textx).attr("y", texty)
                    .attr("transform", "rotate(-90,"+textx+","+texty+")");
            }
        }

        function updateYBHP() {
            if (opts.divGraph == null || roads.length == 0) return;
            if (!opts.roadEditor) return;

            var pinkelt = gYBHP.select(".halfplane");
            var yedge, itoday, ihor;
            var ir = roads;
            var now = goal.xMin;
            var hor = roads[roads.length-1].sta[0];
            // Determine good side of the road 
            if (goal.yaw < 0) yedge = goal.yMin - 5*(goal.yMax - goal.yMin);
            else yedge = goal.yMax + 5*(goal.yMax - goal.yMin);
            // Compute road indices for left and right boundaries
            itoday = findRoadSegment(ir, now);
            ihor = findRoadSegment(ir, hor);
            var d = "M"+newXScale(now*1000)+" "
                    +newYScale(rdf(ir, now));
            for (var i = itoday; i < ihor; i++) {
                d += " L"+newXScale(ir[i].end[0]*1000)+" "
                    +newYScale(ir[i].end[1]);
            }
            d+=" L"+newXScale(hor*1000)+" "+newYScale(rdf(ir, hor));
            d+=" L"+newXScale(hor*1000)+" "+newYScale(yedge);
            d+=" L"+newXScale(now*1000)+" "+newYScale(yedge);
            d+=" Z";
            if (pinkelt.empty()) {
                gYBHP.append("svg:path")
	                .attr("class","halfplane")
	  	            .attr("d", d)
                    .attr("fill", opts.halfPlaneCol.fill);
            } else {
                pinkelt.attr("d", d);
            }
        }

        function updatePinkRegion() {
            if (opts.divGraph == null || roads.length == 0) return;
            var pinkelt = gPink.select(".pinkregion");
            var yedge, itoday, ihor;
            var ir = initialRoad;
            var now = goal.asof;
            var hor = goal.horizon;
            // Determine good side of the road 
            if (goal.yaw > 0) yedge = goal.yMin - 5*(goal.yMax - goal.yMin);
            else yedge = goal.yMax + 5*(goal.yMax - goal.yMin);
            // Compute road indices for left and right boundaries
            itoday = findRoadSegment(ir, now);
            ihor = findRoadSegment(ir, hor);
            var d = "M"+newXScale(now*1000)+" "
                    +newYScale(rdf(ir, now));
            for (var i = itoday; i < ihor; i++) {
                d += " L"+newXScale(ir[i].end[0]*1000)+" "+
                    newYScale(ir[i].end[1]);
            }
            d+=" L"+newXScale(hor*1000)+" "+newYScale(rdf(ir, hor));
            d+=" L"+newXScale(hor*1000)+" "+newYScale(yedge);
            d+=" L"+newXScale(now*1000)+" "+newYScale(yedge);
            d+=" Z";
            if (pinkelt.empty()) {
                gPink.append("svg:path")
                    .attr("class","pinkregion")
	  	            .attr("d", d)
	  	            .attr("fill-opacity", 0.4)
                    .attr("fill", Cols.PINK);
            } else {
                pinkelt.attr("d", d);
            }
        }

        // Creates or updates the unedited road
        function updateOldRoad() {
            if (opts.divGraph == null || roads.length == 0) return;

            var ir = initialRoad;
            var d = "M"+newXScale(ir[0].sta[0]*1000)+" "
                    +newYScale(ir[0].sta[1]);
            var i;
            for (i = 0; i < ir.length; i++) {
                d += " L"+newXScale(ir[i].end[0]*1000)+" "+
                    newYScale(ir[i].end[1]);
            }

            var roadelt = gOldCenter.select(".oldroads");
            if (roadelt.empty()) {
                gOldCenter.append("svg:path")
                    .attr("class","oldroads")
	  	            .attr("d", d)
                    .attr("stroke-dasharray", (opts.oldRoadLine.dash)+","
                          +(opts.oldRoadLine.dash)) 
  		            .style("pointer-events", "none")
  		            .style("fill", "none")
  		            .style("stroke-width",opts.oldRoadLine.width*scalf)
  		            .style("stroke", Cols.ORNG);
            } else {
                roadelt.attr("d", d)
  		            .style("stroke-width",opts.oldRoadLine.width*scalf);
            }
            if (!opts.roadEditor) {
                d = "M"+newXScale(ir[0].sta[0]*1000)+" "
                    +newYScale(ir[0].sta[1]+goal.lnw);
                for (i = 0; i < ir.length; i++) {
                    d += " L"+newXScale(ir[i].end[0]*1000)+" "+
                        newYScale(ir[i].end[1]+goal.lnw);
                }
                for (i = ir.length; i > 0; i--) {
                    d += " L"+newXScale(ir[i-1].end[0]*1000)+" "+
                        newYScale(ir[i-1].end[1]-goal.lnw);
                }
                d += " L"+newXScale(ir[0].sta[0]*1000)+" "+
                    newYScale(ir[0].sta[1]-goal.lnw)+" Z";
                roadelt = gOldRoad.select(".oldlanes");
                if (roadelt.empty()) {
                    gOldRoad.append("svg:path")
                        .attr("class","oldlanes")
  		                .style("pointer-events", "none")
	  	                .attr("d", d)
  		                .style("fill", Cols.DYEL)
  		                .style("fill-opacity", 0.5)
  		                .style("stroke", "none");
                } else {
                    roadelt.attr("d", d);
                }
            }
        }

        function updateGuidelines() {
            if (opts.divGraph == null || roads.length == 0) return;
            if (opts.roadEditor) return;

            var ir = initialRoad, d, i;
            // Compute Y range
            var yrange = [newYScale.invert(plotbox.height), 
                          newYScale.invert(0)];
            var delta = 1;
            var numlines = Math.abs((yrange[1] - yrange[0])/(goal.lnw*delta));
            if (numlines > 32) {
                delta = 7;
                numlines = Math.abs((yrange[1] - yrange[0])/(goal.lnw*delta));
            }
            if (numlines > 32) {
                delta = 4*7;
                numlines = Math.abs((yrange[1] - yrange[0])/(goal.lnw*delta));
            }
            if (numlines > 32) {
                delta = 8*7;
                numlines = Math.abs((yrange[1] - yrange[0])/(goal.lnw*delta));
            }
            var arr = new Array(Math.ceil(numlines)).fill(0);

            d = "M"+newXScale(ir[0].sta[0]*1000)+" "
                    +newYScale(ir[0].sta[1]);
            for (i = 0; i < ir.length; i++) {
                d += " L"+newXScale(ir[i].end[0]*1000)+" "+
                    newYScale(ir[i].end[1]);
            }
            var shift = newYScale(ir[0].sta[1]+goal.yaw*goal.lnw) 
                    - newYScale(ir[0].sta[1]);
            var roadelt = gOldGuides.selectAll(".oldguides").data(arr);
            roadelt.exit().remove();
            roadelt.enter().append("svg:path")
                .attr("class","oldguides")
	  	        .attr("d", d)
	  	        .attr("transform", function(d,i) { 
                    return "translate(0,"+((i+1)*delta*shift)+")";})
  		        .style("pointer-events", "none")
  		        .style("fill", "none")
  		        .style("stroke-width", function (d,i) { 
                    return ((delta==7 && i==0) || (delta==1 && i==6))
                        ?4*scalf:2*scalf;})
  		        .style("stroke", function (d,i) { 
                    return ((delta==7 && i==0) || (delta==1 && i==6))
                        ?Cols.DYEL:Cols.LYEL;});
            roadelt
	  	        .attr("d", d)
                .attr("transform", function(d,i) { 
                    return "translate(0,"+((i+1)*delta*shift)+")";})
  		        .style("stroke-width", function (d,i) { 
                    return ((delta==7 && i==0) || (delta==1 && i==6))
                        ?4*scalf:2*scalf;})
  		        .style("stroke", function (d,i) { 
                    return ((delta==7 && i==0) || (delta==1 && i==6))
                        ?Cols.DYEL:Cols.LYEL;});
        }
        function updateContextOldRoad() {
            if (opts.divGraph == null || roads.length == 0) return;
            // Create, update and delete road lines on the brush graph
            var roadelt = ctxplot.selectAll(".ctxoldroads");
            var ir = initialRoad;
            var d = "M"+xScaleB(ir[0].sta[0]*1000)+" "
                    +yScaleB(ir[0].sta[1]);
            for (var i = 0; i < ir.length; i++) {
                d += " L"+xScaleB(ir[i].end[0]*1000)+" "+
                    yScaleB(ir[i].end[1]);
            }
            if (roadelt.empty()) {
                ctxplot.append("svg:path")
                    .attr("class","ctxoldroads")
	  	            .attr("d", d)
                    .attr("stroke-dasharray", (opts.oldRoadLine.ctxdash)+","
                          +(opts.oldRoadLine.ctxdash)) 
  		            .style("fill", "none")
  		            .style("stroke-width",opts.oldRoadLine.ctxwidth)
  		            .style("stroke", Cols.ORNG);
            } else {
                roadelt.attr("d", d);
            }
        }

        function updateKnots() {
            if (opts.divGraph == null || roads.length == 0) return;
            // Create, update and delete vertical knot lines
            var knotelt = gKnots.selectAll(".knots").data(roads);
            var knotrmelt = buttonarea.selectAll(".remove").data(roads);
            if (!opts.roadEditor) {
                knotelt.remove();
                knotrmelt.remove();
                return;
            }
            knotelt.exit().remove();
            knotelt
	            .attr("x1", function(d){ return newXScale(d.end[0]*1000);})
	            .attr("y2", newYScale(goal.yMax + 10*(goal.yMax-goal.yMin)))
	            .attr("x2", function(d){ return newXScale(d.end[0]*1000);})
                .attr("y1", newYScale(goal.yMin - 10*(goal.yMax-goal.yMin)))
	            .attr("stroke", "rgb(200,200,200)") 
	            .style("stroke-width",opts.roadKnot.width);
            knotelt.enter().append("svg:line")
	            .attr("class","knots")
	            .attr("id", function(d,i) {return i;})
	            .attr("name", function(d,i) {return "knot"+i;})
	            .attr("x1", function(d){ return newXScale(d.end[0]*1000);})
	            .attr("y1",newYScale(goal.yMin))
	            .attr("x2", function(d){ return newXScale(d.end[0]*1000);})
	            .attr("y2",newYScale(goal.yMax))
	            .attr("stroke", "rgb(200,200,200)") 
	            .style("stroke-width",opts.roadKnot.width)
                .on('wheel', function(d) { 
                    // Redispatch a copy of the event to the zoom area
                    var new_event = new d3.event.constructor(d3.event.type, 
                                                             d3.event); 
                    zoomarea.node().dispatchEvent(new_event);})
	            .on("mouseover",function(d,i) {
	                if (!editingKnot) {
                        highlightDate(i,true);
                        d3.select(this)
                            .style("stroke-width",(opts.roadKnot.width+2));
                    }})
	            .on("mouseout",function(d,i) {
	                if (!editingKnot) {
                        highlightDate(i,false);
                        d3.select(this)
                            .style("stroke-width",opts.roadKnot.width);
                    }})
                .on("click", function(d,i) { 
                    if (d3.event.ctrlKey) knotEdited(d,this.id);})
                .call(d3.drag()
                      .on("start", knotDragStarted)
                      .on("drag", knotDragged)
                      .on("end", knotDragEnded));

            // Create, update and delete removal icons for knots
            knotrmelt.exit().remove();
            knotrmelt
  	            .attr("id", function(d,i) {return i;})
	            .attr("name", function(d,i) {return "remove"+i;})
                .attr("transform", 
                      function(d){ 
                          return "translate("+(newXScale(d.end[0]*1000)
                                               +plotpad.left-14*opts.roadKnot.rmbtnscale)
                              +","+(plotpad.top-28*opts.roadKnot.rmbtnscale-3)+") scale("+opts.roadKnot.rmbtnscale+")";
                      })
                .style("visibility", function(d,i) {
                    return (i<roads.length-1)
                        ?"visible":"hidden";});
            knotrmelt.enter()
                .append("use")
                .attr("class", "remove")
                .attr("xlink:href", "#removebutton")
  	            .attr("id", function(d,i) {return i;})
	            .attr("name", function(d,i) {return "remove"+i;})
                .attr("transform", 
                      function(d){ 
                          return "translate("+(newXScale(d.end[0]*1000)
                                               +plotpad.left-14*opts.roadKnot.rmbtnscale)
                              +","+(plotpad.top-28*opts.roadKnot.rmbtnscale-3)+") scale("+opts.roadKnot.rmbtnscale+")";
                      })
                .style("visibility", function(d,i) {
                    return (i < roads.length-1)
                        ?"visible":"hidden";})
		        .on("mouseenter",function() {
			        d3.select(this).attr("fill",opts.roadKnotCol.rmbtnsel);})
		        .on("mouseout",function() {
			        d3.select(this).attr("fill",opts.roadKnotCol.rmbtns);})
		        .on("click",knotDeleted);
        }

        function updateRoads() {
            if (opts.divGraph == null || roads.length == 0) return;
            var lineColor = isRoadValid( roads )?
                    opts.roadLineCol.valid:opts.roadLineCol.invalid;

            // Create, update and delete road lines
            var roadelt = gRoads.selectAll(".roads").data(roads);
            if (!opts.roadEditor) {
                roadelt.remove();
                return;
            }
            roadelt.exit().remove();
            roadelt
		        .attr("x1", function(d){ return newXScale(d.sta[0]*1000);})
                .attr("y1",function(d){ return newYScale(d.sta[1]);})
		        .attr("x2", function(d){ return newXScale(d.end[0]*1000);})
		        .attr("y2",function(d){ return newYScale(d.end[1]);})
		        .style("stroke",lineColor);
            roadelt.enter()
                .append("svg:line")
		        .attr("class","roads")
  		        .attr("id", function(d,i) {return i;})
	  	        .attr("name", function(d,i) {return "road"+i;})
  		        .attr("x1", function(d){ return newXScale(d.sta[0]*1000);})
  		        .attr("y1",function(d){ return newYScale(d.sta[1]);})
	  	        .attr("x2", function(d){ return newXScale(d.end[0]*1000);})
  		        .attr("y2",function(d){ return newYScale(d.end[1]);})
  		        .style("stroke-width",opts.roadLine.width)
                .on('wheel', function(d) { 
                    // Redispatch a copy of the event to the zoom area
                    var new_event = new d3.event.constructor(d3.event.type, 
                                                             d3.event); 
                    zoomarea.node().dispatchEvent(new_event);})		  
                .on("mouseover",function(d,i) { 
                    if (i > 0 && i < roads.length-1) {
			            d3.select(this)
                            .style("stroke-width",(opts.roadLine.width+2));
                        highlightSlope(i, true);}})
		        .on("mouseout",function(d,i) { 
                    if (i > 0 && i < roads.length-1) {
			            d3.select(this)
                            .style("stroke-width",opts.roadLine.width);
                        highlightSlope(i, false);}})
                .on("click", function(d,i) { 
                    if (d3.event.ctrlKey) roadEdited(d, this.id);})
                .call(d3.drag()
                      .on("start", function(d,i) { 
                          if (i > 0 && i < roads.length-1) 
                              roadDragStarted(d, Number(this.id));})
                      .on("drag", function(d,i) { 
                          if (i > 0 && i < roads.length-1) 
                              roadDragged(d, Number(this.id));})
                      .on("end", function(d,i) { 
                          if (i > 0 && i < roads.length-1) 
                              roadDragEnded(d, Number(this.id));}));
        }

        function updateRoadValidity() {
            if (opts.divGraph == null || roads.length == 0) return;
            var lineColor = isRoadValid( roads )?
                    opts.roadLineCol.valid:opts.roadLineCol.invalid;

            // Create, update and delete road lines
            var roadelt = gRoads.selectAll(".roads");
            roadelt.style("stroke",lineColor);

            roadelt = gRoads.selectAll(".ctxroads");
            roadelt.style("stroke",lineColor);
        }

        function updateContextRoads() {
            if (opts.divGraph == null || roads.length == 0) return;
            var lineColor = isRoadValid( roads )?
                    opts.roadLineCol.valid:opts.roadLineCol.invalid;

            // Create, update and delete road lines for the brush 
            var roadelt = ctxplot.selectAll(".ctxroads").data(roads);
            if (!opts.roadEditor) {
                roadelt.remove();
                return;
            }
            roadelt.exit().remove();
            roadelt
		        .attr("x1", function(d){ return xScaleB(d.sta[0]*1000);})
                .attr("y1",function(d){ return yScaleB(d.sta[1]);})
		        .attr("x2", function(d){ return xScaleB(d.end[0]*1000);})
		        .attr("y2",function(d){ return yScaleB(d.end[1]);});
            roadelt.enter()
                .append("svg:line")
		        .attr("class","ctxroads")
  		        .attr("id", function(d,i) {return i;})
	  	        .attr("name", function(d,i) {return "ctxroad"+i;})
  		        .attr("x1", function(d){ return xScaleB(d.sta[0]*1000);})
  		        .attr("y1",function(d){ return yScaleB(d.sta[1]);})
	  	        .attr("x2", function(d){ return xScaleB(d.end[0]*1000);})
  		        .attr("y2",function(d){ return yScaleB(d.end[1]);})
  		        .style("stroke", lineColor)
  		        .style("stroke-width",opts.roadLine.ctxwidth);
        }

        function updateDots() {
            if (opts.divGraph == null || roads.length == 0) return;
            // Create, update and delete inflection points
            var dotelt = gDots.selectAll(".dots").data(roads);
            if (!opts.roadEditor) {
                dotelt.remove();
                return;
            }
            dotelt.exit().remove();
            dotelt
		        .attr("cx", function(d){ return newXScale(d.sta[0]*1000);})
                .attr("cy",function(d){ return newYScale(d.sta[1]);});
            dotelt.enter().append("svg:circle")
		        .attr("class","dots")
		        .attr("id", function(d,i) {return i-1;})
		        .attr("name", function(d,i) {return "dot"+(i-1);})
                .attr("cx", function(d){ return newXScale(d.sta[0]*1000);})
		        .attr("cy",function(d){ return newYScale(d.sta[1]);})
		        .attr("r", opts.roadDot.size)
                .attr("fill", opts.roadDotCol.editable)
		        .style("stroke-width", opts.roadDot.border) 
                .on('wheel', function(d) { 
                    // Redispatch a copy of the event to the zoom area
                    var new_event = new d3.event.constructor(d3.event.type, 
                                                             d3.event); 
                    zoomarea.node().dispatchEvent(new_event);})
                .on("mouseover",function(d,i) { 
                    if (!editingDot) {
                        highlightValue(i-1, true);
			            d3.select(this).style("fill",opts.roadDotCol.selected);
                    }})
		        .on("mouseout",function(d,i) { 
                    if (!editingDot) {
                        highlightValue(i-1, false);
			            d3.select(this).style("fill",opts.roadDotCol.editable);
                    }})
                .on("click", function(d,i) { 
                    if (d3.event.ctrlKey) dotEdited(d,this.id);})
                .call(d3.drag()
                      .on("start", function(d,i) { 
                          dotDragStarted(d, Number(this.id));})
                      .on("drag", function(d,i) { 
                          dotDragged(d, Number(this.id));})
                      .on("end", function(d,i) { 
                          dotDragEnded(d, Number(this.id));}));
        }
        function updateContextDots() {
            if (opts.divGraph == null || roads.length == 0) return;
            // Create, update and delete inflection points
            var dotelt = ctxplot.selectAll(".ctxdots").data(roads);
            if (!opts.roadEditor) {
                dotelt.remove();
                return;
            }
            dotelt.exit().remove();
            dotelt
		        .attr("cx", function(d){ return xScaleB(d.sta[0]*1000);})
                .attr("cy",function(d){ return yScaleB(d.sta[1]);});
            dotelt.enter().append("svg:circle")
		        .attr("class","ctxdots")
		        .attr("id", function(d,i) {return i-1;})
		        .attr("name", function(d,i) {return "ctxdot"+(i-1);})
		        .attr("r", opts.roadDot.ctxsize)
                .attr("fill", opts.roadDotCol.editable)
		        .style("stroke-width", opts.roadDot.ctxborder)
                .attr("cx", function(d){ return xScaleB(d.sta[0]*1000);})
		        .attr("cy",function(d){ return yScaleB(d.sta[1]);});
        }

        function dpFill( pt ) {
            var col = dotcolor(roads, goal, pt[0], pt[1]);
            return (pt[2] == DPTYPE.AGGPAST)?col:(col+"54");
        }
        function dpStroke( pt ) {
            if (opts.roadEditor) {
                return opts.dataPointCol.stroke;
            } else {
                return "#000000";
            }
        }
        function dpStrokeWidth( pt ) {
            if (opts.roadEditor) {
                return opts.dataPoint.border*scalf;
            } else {
                return ((pt[2] == DPTYPE.AGGPAST)?1:0.5)*scalf;
            }
        }

        function updateDataPoints() {
            if (opts.divGraph == null || roads.length == 0) return;
            var now = goal.asof;
            var dpelt;
            if (opts.showdata) {
                var pts = (flad != null)?
                        datapoints.slice(0,datapoints.length-1):
                        datapoints;
                dpelt = gDpts.selectAll(".dpts").data(pts.concat(fuda));
                dpelt.exit().remove();
                dpelt
		            .attr("cx", function(d){ return newXScale((d[0])*1000);})
                    .attr("cy",function(d){ return newYScale(d[1]);})
		            .attr("stroke-width", dpStrokeWidth)
                    .attr("r", opts.dataPoint.size*scalf)
                    .attr("fill", dpFill);
                dpelt.enter().append("svg:circle")
		            .attr("class","dpts")
		            .attr("id", function(d,i) {return i;})
		            .attr("name", function(d,i) {return "dpt"+i;})
		            .attr("stroke", dpStroke)
		            .attr("stroke-width", dpStrokeWidth)
                    .attr("r", opts.dataPoint.size*scalf)
		            .attr("cx", function(d){ return newXScale((d[0])*1000);})
                    .attr("cy",function(d){ return newYScale(d[1]);})
                    .attr("fill", dpFill);
                var fladelt = gDpts.selectAll(".fladp");
                if (flad != null) {
                    if (fladelt.empty()) {
                        gDpts.append("svg:use")
		                    .attr("class","fladp")
                            .attr("xlink:href", "#rightarrow")
                            .attr("fill", dotcolor(roads,goal,flad[0],flad[1]))
                            .attr("transform", 
                                  "translate("+(newXScale((flad[0])*1000))+","
                                  +newYScale(flad[1])+"),scale("
                                  +(opts.dataPoint.flsize/50)+")");
                    } else {
                        fladelt
                            .attr("fill", dotcolor(roads,goal,flad[0],flad[1]))
                            .attr("transform", 
                                  "translate("+(newXScale((flad[0])*1000))+","
                                  +newYScale(flad[1])+"),scale("
                                  +(opts.dataPoint.flsize/50)+")");
                    }
                } else {
                    if (!fladelt.empty()) fladelt.remove();
                }
                var stpelt = gSteppy.selectAll(".steppy");
                var stpdelt = gSteppy.selectAll(".steppyd").data(pts);
                if (!opts.roadEditor && goal.steppy) {
                    var d = "M"+newXScale(datapoints[0][3]*1000)+" "
                            +newYScale(datapoints[0][4]);
                    for (var i = 0; i < datapoints.length; i++) {
                        d += " L"+newXScale(datapoints[i][0]*1000)+" "+
                            newYScale(datapoints[i][4]);
                        d += " L"+newXScale(datapoints[i][0]*1000)+" "+
                            newYScale(datapoints[i][1]);
                    }
                    if (stpelt.empty()) {
                        gSteppy.append("svg:path")
                            .attr("class","steppy")
                            .attr("pointer-events", "none")
	  	                    .attr("d", d)
  		                    .style("fill", "none")
  		                    .style("stroke-width",3*scalf)
  		                    .style("stroke", Cols.PURP);
                    } else {
                        stpelt.attr("d", d)
  		                    .style("stroke-width",3*scalf);
                    }
                    stpdelt.exit().remove();
                    stpdelt
		                .attr("cx", function(d){ return newXScale(d[0]*1000);})
                        .attr("cy",function(d){ return newYScale(d[1]);})
                        .attr("r", (opts.dataPoint.size+2)*scalf);
                    stpdelt.enter().append("svg:circle")
		                .attr("class","steppyd")
		                .attr("stroke", "none")
                        .attr("pointer-events", "none")
                        .attr("r", (opts.dataPoint.size+2)*scalf)
		                .attr("cx", function(d){ return newXScale(d[0]*1000);})
                        .attr("cy",function(d){ return newYScale(d[1]);})
                        .attr("fill", Cols.PURP);
                } else {
                    stpelt.remove();
                    stpdelt.remove();
                }
            } else {
                dpelt = gDpts.selectAll(".dpts");
                dpelt.remove();
                fladelt = gDpts.selectAll(".fladp");
                fladelt.remove();
            }
        }

        // Create the table header and body to show road segments
        var thead, tbody;
        function createRoadTable() {
            var roadcolumns = ['', '', 'End Date', '', 'Value', '',
                               'Daily Slope', ''];
            thead = d3.select(".rtable");
            thead.append("div").attr('class', 'roadhdr')
                .append("div").attr('class', 'roadhdrrow')
                .selectAll("span.roadhdrcell").data(roadcolumns)
                .enter().append("span").attr('class', 'roadhdrcell')
                .text(function (column) { return column; });
            tbody = thead.append('div').attr('class', 'roadbody');
        }
        function updateRoadTableTitle() {
            if (opts.divTable == null) return;
            var ratetext = "Daily Slope";
            if (goal.runits === 'h') ratetext = "Hourly Slope";
            if (goal.runits === 'd') ratetext = "Daily Slope";
            if (goal.runits === 'w') ratetext = "Weekly Slope";
            if (goal.runits === 'm') ratetext = "Monthly Slope";
            if (goal.runits === 'y') ratetext = "Yearly Slope";

            var roadcolumns = ['', '', 'End Date', '', 'Value', '',
                               ratetext, ''];
            thead.selectAll("span.roadhdrcell").data(roadcolumns)
                .text(function (column) { return column; });

            d3.select("#roadtable")
                .style("width", (tbody.node().offsetWidth+30)+"px");

        }
        
        // Create the table header and body to show the start node
        var sthead, stbody;
        function createStartTable() {
            var startcolumns = ['', '', 'Start Date', '', 'Value', ''];
            sthead = d3.select(".rtable");
            sthead.append("div").attr('class', 'starthdr')
                .append("div").attr('class', 'starthdrrow')
                .selectAll("span.starthdrcell").data(startcolumns)
                .enter().append('span').attr('class', 'starthdrcell')
                .text(function (column) { return column; });
            stbody = sthead.append('div').attr('class', 'startbody');
        };

        var focusField = null;
        var focusOldText = null;
        var datePicker = null;
        function tableFocusIn( d, i ){
            //console.debug('tableFocusIn('+i+') for '+this.parentNode.id);
            focusField = d3.select(this);
            focusOldText = focusField.text();
            if (i != 0 && datePicker != null) {
              datePicker.destroy();
              datePicker = null;
            }
            if (i == 0 && onMobileOrTablet()) {
              focusField.attr("contenteditable", false);
              setTimeout(function() {focusField.attr("contenteditable", true);}, 100);
            }
            if (i == 0) {
                if (datePicker != null) {
                  datePicker.destroy();
                  datePicker = null;
                }
                var kind = Number(focusField.node().parentNode.id);
	              var knotmin = (kind == 0) ? goal.xMin : (roads[kind].sta[0]);
	              var knotmax = 
                    (kind == roads.length-1) 
                    ? roads[kind].end[0]
                    :(roads[kind+1].end[0]);
                // Switch all dates to local time to babysit Pikaday
                var md = moment(focusOldText);
                var mindate = moment(moment.unix(knotmin).utc()
                                     .format("YYYY-MM-DD"));
                var maxdate = moment(moment.unix(knotmax).utc()
                                     .format("YYYY-MM-DD"));
                datePicker = new Pikaday({
                    onSelect: function(date) {
                        var newdate = datePicker.toString();
                        var val = dayparse(newdate, '-');
                        if (newdate === focusOldText) return;
                        if (!isNaN(val)) {
                            focusField.text(newdate);
                            tableDateChanged( Number(kind), val);
                            focusOldText = newdate;
                        }
                    },
                    minDate: mindate.toDate(),
                    maxDate: maxdate.toDate()});
                datePicker.setMoment(md);        
                var floating = d3.select('.floating');
                var bbox = this.getBoundingClientRect();
                var tlbox = topLeft.node().getBoundingClientRect();
                floating
                    .style('left', (bbox.right-tlbox.left)+"px")
                    .style('top', (bbox.bottom+3-tlbox.top)+"px");
                floating.node().appendChild(datePicker.el, this);
            }
        }

        function tableFocusOut( d, i ){
            //console.debug('tableFocusOut('+i+') for '+this.parentNode.id);
            var text = d3.select(this).text();
            if (datePicker != null) {
                datePicker.destroy();
                datePicker = null;
            }
            if (text === focusOldText) return;
            if (focusOldText == null) return; // ENTER must have been hit
            var val = (i==0)?dayparse(text, '-'):text;
            if (isNaN(val)) {
                d3.select(this).text(focusOldText);
                focusOldText = null;
                focusField = null;
                return;
            }
            if (i == 0) tableDateChanged( Number(this.parentNode.id), val);
            if (i == 1) tableValueChanged( Number(this.parentNode.id), val);
            if (i == 2) tableSlopeChanged( Number(this.parentNode.id), val);  
            focusOldText = null;
            focusField = null;
        }
        function tableKeyDown( d, i ){
            if (d3.event.keyCode == 13) {
                window.getSelection().removeAllRanges();
                var text = d3.select(this).text();
                var val = (i==0)?dayparse(text, '-'):text;
                if (isNaN(val)) {
                    d3.select(this).text(focusOldText);
                    focusOldText = null;
                    return;
                }
                if (i == 0) tableDateChanged( Number(this.parentNode.id), val);
                if (i == 1) tableValueChanged( Number(this.parentNode.id), val);
                if (i == 2) tableSlopeChanged( Number(this.parentNode.id), val);  
                focusOldText = d3.select(this).text();
            }
        }

        function tableDateChanged( row, value ) {
            //console.debug("tableDateChanged("+row+","+value+")");
            if (isNaN(value)) updateTableValues();
            else changeKnotDate( row, Number(value), true );
        }
        function tableValueChanged( row, value ) {
            //console.debug("tableValueChanged("+row+","+value+")");
            if (isNaN(value)) updateTableValues();
            else changeDotValue( row, Number(value), true );
        }
        function tableSlopeChanged( row, value ) {
            //console.debug("tableSlopeChanged("+row+")");
            if (isNaN(value)) updateTableValues();
            else changeRoadSlope( row, Number(value), true );
        }

        function autoScroll( elt ) {
            if (opts.tableAutoScroll && opts.tableHeight !== 0) {
                var topPos = elt.node().offsetTop;            
                document.getElementById('roadtable').scrollTop 
                    = topPos-opts.tableHeight/2;
            }
        }
        function highlightDate(i, state) {
            if (opts.divTable == null) return;
            var color = (state)
                    ?opts.roadTableCol.bgHighlight:opts.roadTableCol.bg;
            var elt = d3.select('.rtable [name=enddate'+i+']');
            if (elt.empty()) return;
            elt.style('background-color', color);
            autoScroll(elt);
        }
        function highlightValue(i, state) {
            if (opts.divTable == null) return;
            var color = (state)
                    ?opts.roadTableCol.bgHighlight:opts.roadTableCol.bg;
            var elt = d3.select('.rtable [name=endvalue'+i+']');
            if (elt.empty()) return;
            elt.style('background-color', color);
            autoScroll(elt);
        }
        function highlightSlope(i, state) {
            if (opts.divTable == null) return;
            var color = (state)
                    ?opts.roadTableCol.bgHighlight:opts.roadTableCol.bg;
            var elt = d3.select('.rtable [name=slope'+i+']');
            if (elt.empty()) return;
            elt.style('background-color', color);  
            autoScroll(elt);
        }
        function disableDate(i) {
            roads[i].auto=RP.DATE;
            d3.select('.rtable [name=enddate'+i+']')
                .style('color', opts.roadTableCol.textDisabled)
                .attr('contenteditable', false);  
            d3.select('.rtable [name=endvalue'+i+']')
                .style('color', opts.roadTableCol.text)
                .attr('contenteditable', true);  
            d3.select('.rtable [name=slope'+i+']')
                .style('color', opts.roadTableCol.text)
                .attr('contenteditable', true);  
            d3.select('.rtable [name=btndate'+i+']')
                .property('checked', true);  
            d3.select('.rtable [name=btnvalue'+i+']')
                .property('checked', false);  
            d3.select('.rtable [name=btnslope'+i+']')
                .property('checked', false);  
        }
        function disableValue(i) {
            roads[i].auto=RP.VALUE;
            d3.select('.rtable [name=enddate'+i+']')
                .style('color', opts.roadTableCol.text)
                .attr('contenteditable', true);  
            d3.select('.rtable [name=endvalue'+i+']')
                .style('color', opts.roadTableCol.textDisabled)
                .attr('contenteditable', false);  
            d3.select('.rtable [name=slope'+i+']')
                .style('color', opts.roadTableCol.text)
                .attr('contenteditable', true);  
            d3.select('.rtable [name=btndate'+i+']')
                .property('checked', false);  
            d3.select('.rtable [name=btnvalue'+i+']')
                .property('checked', true);  
            d3.select('.rtable [name=btnslope'+i+']')
                .property('checked', false);  
        }
        function disableSlope(i) {
            roads[i].auto=RP.SLOPE;
            d3.select('.rtable [name=enddate'+i+']')
                .style('color', opts.roadTableCol.text)
                .attr('contenteditable', true);  
            d3.select('.rtable [name=endvalue'+i+']')
                .style('color', opts.roadTableCol.text)
                .attr('contenteditable', true);  
            d3.select('.rtable [name=slope'+i+']')
                .style('color', opts.roadTableCol.text)
                .attr('contenteditable', false);  
            d3.select('.rtable [name=btndate'+i+']')
                .property('checked', false);  
            d3.select('.rtable [name=btnvalue'+i+']')
                .property('checked', false);  
            d3.select('.rtable [name=btnslope'+i+']')
                .property('checked', true);  
        }

        function updateTableButtons() {
            if (opts.divTable == null) return;
            // Update butons on all rows at once, including the start node.
            var allrows = d3.selectAll(".rtable .startrow, .rtable .roadrow");
            var btncells = allrows.selectAll(".roadbtn")
                    .data(function(row, i) {
                        // The table row order is reversed, which means that the last road segment comes in the first row.
                        // We need to compute knot index accordingly
                        var kind;
                        if (opts.reversetable) kind = roads.length-2-i;
                        else kind = i;
                        return [
                            {order: -1, row:kind, name: "btndel"+kind, evt: function() {removeKnot(kind, false);}, 
                             type: 'button', txt: 'del', auto: false},
                            {order: 3, row:kind, name: "btndate"+kind, evt: function() {disableDate(kind);}, 
                             type: 'checkbox', txt: 'r', auto: (row.auto==RP.DATE)},
                            {order: 5, row:kind, name: "btnvalue"+kind, evt: function() {disableValue(kind);}, 
                             type: 'checkbox', txt: 'r', auto: (row.auto==RP.VALUE)},
                            {order: 7, row:kind, name: "btnslope"+kind, evt: function() {disableSlope(kind);}, 
                             type: 'checkbox', txt: 'r', auto: (row.auto==RP.SLOPE)},
                            {order: 8, row:kind, name: "btnadd"+kind, evt: function() {addNewKnot(kind+1);}, 
                             type: 'button', txt: 'ins', auto: false},
                        ];
                    });
            
            var newbtncells = btncells.enter().append("input").attr('class', 'roadbtn')
                    .attr('id', function(d) { return d.row;})
                    .attr('name', function(d) { return d.name;})
                    .attr('type',function(d) {return d.type;})
                    .attr('value', function(d) { return d.txt;})
                    .on('click', function (d) {d.evt();});

            btncells.exit().remove();
            btncells = allrows.selectAll(".rtable .roadbtn");
            btncells
                .attr('id', function(d) { return d.row;})
                .attr('name', function(d) { return d.name;})
                .style('visibility', function(d,i) {
                    return ((Number(d.row)>0 && Number(d.row)<(roads.length-1)) 
                            || i==4 
                            || (i>0 && Number(d.row)>0 ))?"visible":"hidden";
                })
                .property('checked', function(d) { return d.auto?true:false;});

            allrows.selectAll(".roadcell, .roadbtn, .startcell").sort(function(a,b) {return a.order > b.order;});
        }

        function updateTableValues() {
            if (opts.divTable == null) return;

            var reversetable = opts.reversetable;
            var srows = stbody.selectAll(".startrow")
                    .data(roads.slice(0,1));
            srows.enter().append('div').attr('class', 'startrow')
                .attr("name", function(d,i) { return 'startrow'+i;})
                .attr("id", function(d,i) { return (i);})
                .append("span")
                .attr("class", "rowid").text(function(d,i) {return (i)+":";});
            srows.exit().remove();
            srows.order();
            srows = stbody.selectAll(".startrow");
            var scells = srows.selectAll(".rtable .startcell")
                    .data(function(row, i) {
                        var datestr = dayify(row.end[0], '-');
                        return [
                            {order: 2, value: datestr, name: "enddate"+i},
                            {order: 4, value: row.end[1].toPrecision(5), name: "endvalue"+i},
                            {order: 6, value: '', name: "slope"}];
                    });
            scells.enter().append("span").attr('class', 'startcell')
                .attr('name', function(d) { return d.name;})
                .style('color', opts.roadTableCol.text)
                .attr("contenteditable", function(d,i) { return (i>1)?'false':'true';})
                .on('focusin', tableFocusIn)
                .on('focusout', tableFocusOut)
                .on('keydown', tableKeyDown);
            scells.exit().remove();
            scells = srows.selectAll(".startcell");
            scells.text(function(d) { return d.value;});
            
            var rows;
            if (reversetable)
                rows = tbody.selectAll(".roadrow").data(roads.slice(1,roads.length-1).reverse());
            else
                rows = tbody.selectAll(".roadrow").data(roads.slice(1,roads.length-1));
            rows.enter().append("div").attr('class', 'roadrow')
                .attr("name", function(d,i) { 
                    return 'roadrow'+(reversetable?roads.length-1-(i+1)
                                      :(i+1));})
                .attr("id", function(d,i) { 
                    return reversetable?roads.length-1-(i+1):(i+1);})
                .append("span")
                .attr("class", "rowid").text(function(d,i) {return (i+1)+":";});
            rows.exit().remove();
            rows.order();
            rows = tbody.selectAll(".roadrow");
            rows.attr("name", function(d,i) { return 'roadrow'+(reversetable?roads.length-1-(i+1):(i+1));})
                .attr("id", function(d,i) { return reversetable?roads.length-1-(i+1):i+1;});
            var cells = rows.selectAll(".roadcell")
                    .data(function(row, i) {
                        var datestr = dayify(row.end[0], '-');
                        var ri;
                        if (reversetable) ri = roads.length-1-(i+1);
                        else ri = i+1;
                        return [
                            {order: 2, value: datestr, name: "enddate"+(ri), 
                             auto: (row.auto==RP.DATE)},
                            {order: 4, value: row.end[1].toPrecision(5), name: "endvalue"+(ri), 
                             auto: (row.auto==RP.VALUE)},
                            {order: 6, value: (row.slope*goal.siru).toPrecision(5), name: "slope"+(ri), 
                             auto: (row.auto==RP.SLOPE)}];
                    });
            cells.enter().append("span").attr('class', 'roadcell')
                .attr('name', function(d) { return d.name;})
                .attr("contenteditable", function(d,i) { return (d.auto)?'false':'true';})
                .on('focusin', tableFocusIn)
                .on('focusout', tableFocusOut)
                .on('keydown', tableKeyDown);

            cells.exit().remove();
            cells = rows.selectAll(".rtable .roadcell");
            cells.text(function(d) { return d.value;})
                .attr('name', function(d) { return d.name;})
                .style('color', function(d) {
                    return d.auto?opts.roadTableCol.textDisabled
                        :opts.roadTableCol.text;})
                .attr("contenteditable", function(d,i) { return (d.auto)?'false':'true';});

        }

        function updateTable() {
            updateTableValues();
            updateTableButtons();
        }

        function updateContextData() {
            if (opts.showContext) {
                context.attr("visibility", "visible");
                updateContextOldRoad();
                updateContextOldBullseye();
                updateContextBullseye();
                updateContextRoads();
                updateContextDots();
                updateContextHorizon();
                updateContextToday();
                if (opts.focusRect) focusrect.attr("visibility", "visible");
            } else {
                context.attr("visibility", "hidden");
                focusrect.attr("visibility", "hidden");
            }
        }

        function updateGraphData() {
            var limits = [newXScale.invert(0).getTime()/1000, 
                          newXScale.invert(plotbox.width).getTime()/1000];
            scalf = cvx(limits[1], limits[0], limits[0]+73*SID, 1,0.5);

            updatePastBox();
            updateYBHP();
            updatePinkRegion();
            updateOldRoad();
            updateGuidelines();
            updateOldBullseye();
            updateBullseye();
            updateKnots();
            updateDataPoints();
            updateRoads();
            updateDots();
            updateHorizon();
            updatePastText();
            updateWatermark();
        }

        createGraph();
        createTable();

        // This is a privileged function that can access private
        // variables, but is also accessible from the outside.
        self.showData = function( flag ) {
            if (arguments.length > 0) opts.showdata = flag;
            updateDataPoints();
            return opts.showdata;
        };
        self.showContext = function( flag ) {
            if (arguments.length > 0) opts.showContext = flag;
            updateContextData();
            return opts.showContext;
        };
        self.keepSlopes = function( flag ) {
            if (arguments.length > 0) opts.keepslopes = flag;
            return opts.keepslopes;
        };
        self.keepIntervals = function( flag ) {
            if (arguments.length > 0) opts.keepintervals = flag;
            return opts.keepintervals;
        };
        self.reverseTable = function( flag ) {
            if (arguments.length > 0) {
                opts.reversetable = flag;
                if (opts.reversetable) {
                    d3.select(".starthdr").raise();
                    d3.select(".startbody").raise();
                } else {
                    d3.select(".roadhdr").raise();
                    d3.select(".roadbody").raise();      
                }
                updateTable();
            }
            return opts.reversetable;
        };
        self.autoScroll = function( flag ) {
            if (arguments.length > 0) opts.tableAutoScroll = flag;
            return opts.tableAutoScroll;
        };

        self.undoBufferState = function() {
            return({undo: undoBuffer.length, redo: redoBuffer.length});
        };

        self.undo = function() {
            undoLastEdit();
        };
        self.redo = function() {
            redoLastEdit();
        };
        self.zoomOut = function() {
            zoomAll();
        };
        self.loadGoal = function( url ) {
            loadGoalFromURL( url );
        };
        self.retroRatchet = function( days ) {
          setSafeDays( days );  
        };
    };


    bmndr.prototype = {
    };

    return bmndr;
}));
