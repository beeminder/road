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
        svgSize:      { width: 700, height: 550 },
        focusRect:    { x:0, y:0, width:700, height: 400 },
        focusPad:     { left:50, right:10, top:30, bottom:30 },
        contextRect:  { x:0, y:400, width:700, height: 80 },
        contextPad:   { left:50, right:10, top:0, bottom:30 },

        zoomButton:   { size: 40, opacity: 0.7, factor: 1.5 },
        bullsEye:     { size: 40, ctxsize: 20 },
        roadDot:      { size: 5, ctxsize: 3, border: 1.5, ctxborder: 1 },
        roadKnot:     { width: 3 },
        roadLine:     { width: 3, ctxwidth: 2 },
        oldRoadLine:  { width: 2, ctxwidth: 1 },
        dataPoint:    { size: 4, flsize: 6 }, 
        horizon:      { width: 2, ctxwidth: 1, dash: 8, ctxdash: 8, 
                        font: 16, ctxfont: 10 },
        today:        { width: 2, ctxwidth: 1, font: 16, ctxfont: 10 },

        
        textBox:      { margin: 3 },
        showdata:     true,
        keepslopes:   true,
        keepintervals:false,
        reversetable: false,

        roadLineCol:  { valid: "black", invalid:"#ca1212", old:"#f0f000"},
        roadDotCol:   { fixed: "darkgray", editable:"#ca1212", 
                        selected: "lightgreen"},
        roadKnotCol:  { dflt: "#c2c2c2", rmbtn: "black", rmbtnsel: "red"}, 
        textBoxCol:   { bg: "#ffffff", stroke:"#d0d0d0"},
        roadTable:    { bg:"#ffffff", bgHighlight: "#bbffbb", 
                        text:"#000000", textDisabled: "#aaaaaa"},
        dataPointCol: { future: "#909090", stroke: "lightgray"},
        pinkRegionCol:{ fill: "#ffd0d0" },
        halfPlaneCol: { fill: "#ffffd0" },
        pastBoxCol:   { fill: "#f0f0f0" },

        precision: 5,
        editpast: true
    },
    
    /** Beeminder colors for datapoints */
    DotCol = {
        BLCK:   "#000000",
        GRNDOT: "#00aa00", //Dark green for good side of the road
        BLUDOT: "#3f3fff", // Blue for correct lane
        ORNDOT: "#ffa500", // Orange for wrong lane
        REDDOT: "#ff0000"  // Red for off the road on the bad side
    },

    RoadParamEnum = {
        DATE:0, VALUE:1, SLOPE:2
    },
    DIY = 365.25,   // Days in year
    SID = 86400,    // Seconds in day
    AKH = 7*SID,    // Akrasia Horizon, in seconds

    // ---------------- General Utility Functionc ----------------------

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
    roadValue = function(rd, x) {
        var i = findRoadSegment(rd, x);
        return roadSegmentValue( rd[i], x );
    },

    // Recomputes the road array starting from the first node and assuming
    // that the one of slope, enddate or endvalue parameters is chosen to
    // be automatically computed. If usetable is true, autocompute
    // parameter selections from the table are used
    fixRoadArray = function( rd, autoparam=RoadParamEnum.VALUE, usetable=false, 
                             edited=RoadParamEnum.VALUE) {
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

            if (autoparam == RoadParamEnum.DATE) {
                if (isFinite(rd[i].slope) && rd[i].slope != 0) {
                    rd[i].end[0] = daysnap(
                        rd[i].sta[0]+(rd[i].end[1]-rd[i].sta[1])/rd[i].slope);
                }
                // Sanity check
                if (rd[i].end[0] <= rd[i].sta[0]) {
                    rd[i].end[0] = daysnap(rd[i].sta[0]+SID);
                }
                if (edited == RoadParamEnum.SLOPE) {
                    // Readjust value if slope was edited
                    rd[i].end[1] = 
                        rd[i].sta[1]+rd[i].slope*(rd[i].end[0]-rd[i].sta[0]);
                } else {
                    // Readjust value if value was edited
                    rd[i].slope = roadSegmentSlope(rd[i]);
                }
            } else if (autoparam == RoadParamEnum.VALUE) {
                if (isFinite(rd[i].slope)) {
                    rd[i].end[1] = rd[i].sta[1]+rd[i].slope
                        *(rd[i].end[0]-rd[i].sta[0]);
                } else {
                    // If slope is infinite, preserve previous delta
                    rd[i].end[1] = rd[i].sta[1]+diffval;
                    rd[i].slope = roadSegmentSlope(rd[i]);
                }
            } else if (autoparam == RoadParamEnum.SLOPE) {
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
    gdelt = function( rd, yaw, t, v ) {
        return chop( yaw*(v - roadValue(rd, t)));
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

    // TODO: Test
    lnf = function( rd, x ) {
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
        var valdiff = roadValue( rd, x ) - roadValue( rd, x-SID );
        var i = findRoadSegment(rd, x);
        return d3.max([Math.abs(valdiff), r[i]]);
    },

    // TODO: Test
    lanage = function( rd, yaw, t, v, l = null ) {
        if (l == null) l = lnf( rd, t );
        var d = v - roadValue(rd, t);
        if (chop(l) == 0) 
            return Math.round((chop(d) == 0.0)?yaw:Math.sign(d)*666);
        var x = ichop(d/l);
        var fracp = x % 1;
        var intp = x -fracp;
        if (fracp > .99999999) {
            intp += 1;
            fracp = 0;
        }
        if (chop(fracp) == 0) {
            if (yaw > 0 && intp >= 0) return Math.round(intp+1);
            if (yaw < 0 && intp <= 0) return Math.round(intp-1);
            return Math.round(Math.sign(x)*Math.ceil(Math.abs(x)));
        }
        return Math.round(Math.sign(x)*Math.ceil(Math.abs(x)));
    },

    // TODO: Test
    // Whether the given point is on the road if the road has lane width l
    aok = function( rd, yaw, t, v, l ) {
        return ((lanage(rd, yaw, t,v, l) * yaw >= -1.0));
    },

    // TODO: Test
    // Returns the number of days to derail for the current road
    // TODO: There are some issues with computing tcur, vcur
    dtd = function( rd, yaw, dir, asof, t, v ) {
        var tnow = asof.unix();
        var x = 0; // the number of steps  
        var xt = 0; // the number of steps past today
        var vpess = v; // the value as we walk forward w/ pessimistic presumptive reports  
        while (aok( rd, yaw, t+x*SID, vpess, lnf( rd, t+x*SID ) ) 
               && t+x*SID <= d3.max([rd[rd.length-1].sta[0], t])) {
            x += 1; // walk forward until we're off the YBR
            if (t+x*SID > tnow) xt += 1;
            vpess += (yaw*dir < 0)?2*rtf(rd, t+x*SID)*SID:0;
        }
        return xt;
    },

    // Appropriate color for a datapoint
    dotcolor = function( rd, yaw, t, v) {
        var l = lanage( rd, yaw, t,v );
        if (yaw==0 && Math.abs(l) > 1.0) return DotCol.GRNDOT;
        if (yaw==0 && (l==0 && l==1.0)) return DotCol.BLUDOT;
        if (yaw==0 && l == -1.0) return DotCol.ORNDOT;
        if (l*yaw >=  2.0) return DotCol.GRNDOT;
        if (l*yaw ==  1.0) return DotCol.BLUDOT;
        if (l*yaw == -1.0) return DotCol.ORNDOT;
        if (l*yaw <= -2.0) return DotCol.REDDOT;
        return DotCol.BLCK;
    },

    isLoser = function(rd, yaw, data, t, v) {
        return (dotcolor( rd, yaw, t, v ) === DotCol.REDDOT 
                && dotcolor(rd,yaw,t-SID,stepFunc(data,t-SID))===DotCol.REDDOT);
    },

    /** configure functionality (private) */
    config = function(obj, options) {
        if (!obj._o) { obj._o = extend({}, defaults, true); }
        
        var opts = extend(obj._o, options, true);
        
        opts.divGraph = (opts.divGraph && opts.divGraph.nodeName)?
            opts.divGraph : null;
        opts.divTable = (opts.divTable && opts.divTable.nodeName)?
            opts.divTable : null;

        return opts;
    },

    roads = [],        // Holds the current road matrix
    initialRoad = [],  // Holds the initial road matrix
    datapoints = [],   // Holds the current set of non-future datapoints 
    futurepoints = [], // Holds the current set of future datapoints 

    /** bmndr constructor */
    bmndr = function(options) {
        //console.debug("bmndr constructor: ");console.log(options);
        var self = this,
            opts = config(self, options);

        var plotpad = opts.focusPad;
        var brushpad = opts.brushPad;
        var 
        sw = opts.svgSize.width,
        sh = opts.svgSize.height, 
        plotbox = {
            x:     opts.focusRect.x + plotpad.left,
            y:     opts.focusRect.y + plotpad.top,
            width: opts.focusRect.width
                - plotpad.left - plotpad.right, 
            height:opts.focusRect.height
                - plotpad.top - plotpad.bottom
        },
        brushbox = {
            x:     opts.contextRect.x + opts.contextPad.left,
            y:     opts.contextRect.y + opts.contextPad.top,
            width: opts.contextRect.width
                - opts.contextPad.left - opts.contextPad.right, 
            height:opts.contextRect.height
                - opts.contextPad.top - opts.contextPad.bottom
        };

        var zoombtnsize = opts.zoomButton.size;
        var zoombtnscale = zoombtnsize / 540;
        var zoombtntr = {botin:"translate("+(plotbox.width
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

        var svg, zoomarea, axisZoom, focus, buttonarea, focusclip, plot;
        var gPastBox, gYBHP, gPink, gOldRoad, gOldBullseye, gKnots;
        var gDpts, gBullseye, gRoads, gDots, gHorizon, gHorizonText;
        var gPastText, zoomin, zoomout;;
        var xScale, xAxis, xAxisObj;
        var yScale, yAxis, yAxisObj;
        var context, ctxclip, ctxplot, xScaleB, xAxisB, xAxisObjB;
        var yScaleB, brushObj, brush, focusrect;
        var newXScale, newYScale;

        var gr = {};  // Holds graph related objects
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
            var defs = svg.append('defs');
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
                .attr("stroke-width", 5)
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

            function dotAdded() {
                var newx = newXScale.invert(d3.event.x-plotpad.left);
                if (opts.editpast || newx > goal.horizon.unix()*1000)
                    addNewDot(newx/1000);
            }
            function dotAddedShift() {
                if (d3.event.shiftKey) {
                    dotAdded();
                }
            }
            zoomarea.on("click", dotAddedShift);
            zoomarea.on("dblclick.zoom", dotAdded);
            

            focus = svg.append('g')
	            .attr('class', 'focus')
                .attr('transform', 'translate('+opts.focusRect.x
                      +','+opts.focusRect.y+')');
            buttonarea = focus.append('g')
                .attr('clip-path', 'url(#buttonareaclip)')
                .attr('class', 'buttonarea'); 
            focusclip = focus.append('g')
                .attr('clip-path', 'url(#plotclip)')
                .attr('transform', 'translate('+plotpad.left
                      +','+plotpad.top+')');
            plot = focusclip.append('g').attr('class', 'plot');

            gPastBox = plot.append('g').attr('id', 'pastboxgrp');
            gYBHP = plot.append('g').attr('id', 'ybhpgrp');
            gPink = plot.append('g').attr('id', 'pinkgrp');
            gOldRoad = plot.append('g').attr('id', 'oldroadgrp');
            gOldBullseye = plot.append('g').attr('id', 'oldbullseyegrp');
            gKnots = plot.append('g').attr('id', 'knotgrp');
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

            yScale = d3.scaleLinear().range([plotbox.height, 0]);
            yAxis = d3.axisLeft(yScale);
            yAxisObj = focus.append('g')        
                .attr("class", "axis")
                .attr("transform", "translate(" 
                      + plotpad.left + ","+plotpad.top+")")
                .call(yAxis);

            // Create brush area
            context = svg.append('g')
	            .attr('class', 'brush')
                .attr('transform', 'translate('
                      +opts.contextRect.x+','+opts.contextRect.y+')');
            ctxclip = context.append('g')
                .attr('clip-path', 'url(#brushclip)')
                .attr('transform', 'translate('
                      +opts.contextPad.left+','+opts.contextPad.top+')');
            ctxplot = ctxclip.append('g').attr('class', 'context');
            xScaleB = d3.scaleUtc().range([0,brushbox.width]);
            xAxisB = d3.axisBottom(xScaleB).ticks(6);
            xAxisObjB = context.append('g')        
                .attr("class", "axis")
                .attr("transform", "translate("+brushbox.x+"," 
                      + (opts.contextPad.top+brushbox.height) + ")")
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

        var tbl = {}; // Holds table related objects
        function createTable() {
            var div = opts.divTable;
            if (div === null) return;

            // First, remove all children from the div
            while (div.firstChild) {
                div.removeChild(div.firstChild);
            }
            d3.select(div).attr("class", "rtable")
                .append("div").attr("id", "dpfloat")
                .attr("class", "floating");
            if (opts.reversetable) {
                createRoadTable();
                createStartTable();
            } else {
                createStartTable();
                createRoadTable();  
            }
        }

        // ------------------ Text Box Utilities ---------------------
        function createTextBox( x, y, text ){
            var plotpad = opts.focusPad;
            var textobj = {};
            if (y < 20-plotpad.top) y = 20 -plotpad.top;
            if (y > sh-plotpad.bottom-10) 
                y = sh-plotpad.bottom-10;
            textobj.grp = focus.append('g')
                .attr('transform', 'translate('+(x+plotpad.left)+","
                      +(y+plotpad.top)+")");
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
            return textobj;
        }

        function updateTextBox( obj, x, y, text ) {
            if (y < 20-plotpad.top) y = 20 -plotpad.top;
            if (y > sh-plotpad.bottom-10) 
                y = sh-plotpad.bottom-10;
            obj.text.text(text);
            var bbox = obj.text.node().getBBox();
            var margin = opts.textBox.margin;
            obj.rect
                .attr('x', bbox.x-margin)
                .attr('y', bbox.y-margin)
                .attr('width',  bbox.width +margin*2)
                .attr('height', bbox.height+margin*2);
            obj.grp.attr('transform', 'translate('+(x+plotpad.left)+","
                         +(y+plotpad.top)+")");
        }

        function removeTextBox( obj ) {
            obj.grp.remove();
        }

        // Private variables holding goal, road and datapoint info
        var 
        goal = {},       // Holds loaded goal parameters
        roads = [],        // Holds the current road matrix
        initialRoad = [],  // Holds the initial road matrix
        datapoints = [],   // Holds the current set of past datapoints 
        futurepoints = [], // Holds the current set of future datapoints 
        undoBuffer = [],   // Array of previous roads for undo
        redoBuffer = [];   // Array of future roads for redo

        // Initialize goal with sane values
        goal.yaw = +1; goal.dir = +1;
        goal.tcur = 0; goal.vcur = 0;
        goal.asof = moment.utc();
        goal.asof.hour(0); goal.asof.minute(0); 
        goal.asof.second(0); goal.asof.millisecond(0);
        goal.horizon = addDays(goal.asof, 7);
        goal.xMin = goal.asof;  goal.xMax = goal.horizon;
        goal.yMin = -1;    goal.yMax = 1;

        var horindex = null; // Road segment index including the horizon

        // ------- Zoom and brush  related private functions ---------
        function adjustYScale() {
            var xrange = [newXScale.invert(0), 
                          newXScale.invert(plotbox.width)];
            var xtimes = xrange.map(function(d) {
                return Math.floor(d.getTime()/1000);});
            var roadextent = roadExtentPartial(roads, xtimes[0], xtimes[1]);
            var oldroadextent = roadExtentPartial(initialRoad, 
                                                  xtimes[0], xtimes[1]);
            var allextent = mergeExtents(roadextent, oldroadextent);
            var p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10};
            enlargeExtent(allextent, p);
            var yrange = [allextent.yMax, allextent.yMin] ;
            var newtr = 
                    d3.zoomIdentity
                    .scale(plotbox.height/(yScale(yrange[1])
                                           -yScale(yrange[0])))
                    .translate(0, -yScale(yrange[0]));
            newYScale = newtr.rescaleY(yScale);
            yAxisObj.call(yAxis.scale(newYScale));
            var sx = xrange.map(function (x){return xScaleB(x);});
            var sy = yrange.map(function (y){return yScaleB(y);});
            focusrect.attr("x", sx[0]+1).attr("width", sx[1]-sx[0]-2)
                .attr("y", sy[0]+1).attr("height", sy[1]-sy[0]-2);
        }

        function resizeContext(){
            xScaleB.domain([new Date(goal.xMin*1000), 
                               new Date(goal.xMax*1000)]);
            yScaleB.domain([goal.yMin, goal.yMax]);
            xAxisObjB.call(xAxisB.scale(xScaleB));
        }

        function resizeBrush() {
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
            if ( roads.length == 0 ) return;
            if (d3.event && d3.event.sourceEvent 
                && d3.event.sourceEvent.type === "brush") return;

            // Inject the current transform into the plot element
            var tr = d3.zoomTransform(zoomarea.node());
            if (tr == null) return;
            
            newXScale = tr.rescaleX(xScale);
            xAxisObj.call(xAxis.scale(newXScale));
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
            xAxisObj.call(xAxis);
            adjustYScale();

            zoomarea.call(axisZoom.transform, d3.zoomIdentity
                          .scale(brushbox.width / (s[1] - s[0]))
                          .translate(-s[0], 0));
            updateGraphData();
        }

        function zoomAll() {
            //console.debug('zoomAll:');
            computePlotLimits( false );
            xScale.domain([new Date(goal.xMin*1000), 
                              new Date(goal.xMax*1000)]);
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

        function documentKeyDown(e) {
            var evtobj = window.event? window.event : e;
            if (evtobj.keyCode == 89 && evtobj.ctrlKey) redoLastEdit();
            if (evtobj.keyCode == 90 && evtobj.ctrlKey) undoLastEdit();
        }
        
        document.onkeydown = documentKeyDown;

        function clearUndoBuffer() {
            undoBuffer = [];
            redoBuffer = [];
            d3.select("button#undo").attr('disabled', 'true').text('Undo (0)');
            d3.select("button#redo").attr('disabled', 'true').text('Redo (0)');
        }

        function redoLastEdit() {
            //console.debug("redoLastEdit: Undo Buffer has "+undoBuffer.length+" entries");
            if (redoBuffer.length == 0) return;
            pushUndoState(true);
            roads = redoBuffer.pop();
            computePlotLimits( true );
            reloadBrush();
            updateGraphData();
            updateTable();
            updateContextData();
            if (redoBuffer.length == 0)  {
                d3.select("button#redo")
                    .attr('disabled', 'true').text('Redo (0)');
            } else
                d3.select("button#redo").text('Redo ('+redoBuffer.length+")");
            return;
        }

        function undoLastEdit() {
            //console.debug("undoLastEdit: Undo Buffer has "+undoBuffer.length+" entries");
            if (undoBuffer.length == 0) return;
            if (undoBuffer.length == 0 || 
                !sameRoads(undoBuffer[undoBuffer.length-1], roads)) {
                redoBuffer.push(roads);
                d3.select("button#redo").attr('disabled', null)
                    .text('Redo ('+redoBuffer.length+")");
            }
            roads = undoBuffer.pop();
            computePlotLimits( true );
            reloadBrush();
            updateGraphData();
            updateTable();
            updateContextData();
            if (undoBuffer.length == 0) {
                d3.select("button#undo")
                    .attr('disabled', 'true').text('Undo (0)');
            } else
                d3.select("button#undo").text('Undo ('+undoBuffer.length+")");
            return;
        }

        function pushUndoState(fromredo = false) {
            //console.debug("pushUndoState: Undo Buffer has "+undoBuffer.length+" entries");
            if (undoBuffer.length == 0 || 
                !sameRoads(undoBuffer[undoBuffer.length-1], roads)) {
                undoBuffer.push(copyRoad(roads));
                d3.select("button#undo").attr('disabled', null)
                    .text('Undo ('+undoBuffer.length+")");
                if (!fromredo) {
                    redoBuffer = [];        
                    d3.select("button#redo")
                        .attr('disabled', 'true').text('Redo (0)');
                }
            }
        }


        var flad = null;     // Holds the flatlined datapoint if it exists
        function flatline() {
            flad = null;
            var now = goal.asof.unix();;
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
                    newcolor = dotcolor( roads, goal.yaw, x, vlast );
                    // done iff 2 reds in a row
                    if (prevcolor===newcolor && prevcolor===DotCol.REDDOT) 
                        break;
                    prevcolor = newcolor;
                    x += SID; // or see eth.pad/ppr
                };
                x = d3.min([x, now, tfin]);
                for (var i = 0; i < numpts; i++) {
                    if (x == datapoints[i][0])
                        return;
                }
                flad = [x, vlast];
                datapoints.push(flad);
            }
        }

        // Determines whether the given road is valid or not (i.e. whether it
        // is clear of the pink region or not)
        function isRoadValid( rd ) {
            var ir = initialRoad;
        
            var now = goal.asof.unix();
            var hor = goal.horizon.unix();
            // Check left/right boundaries of the pink region
            if (goal.yaw*roadValue(rd, now) < goal.yaw*roadValue(ir, now)) 
                return false;
            if (goal.yaw*roadValue(rd, hor) < goal.yaw*roadValue(ir, hor)) 
                return false;
            // Iterate through and check current road points in the ping range
            var rd_i1 = findRoadSegment(rd, now);
            var rd_i2 = findRoadSegment(rd, hor);
            for (var i = rd_i1; i < rd_i2; i++) {
                if (goal.yaw*roadValue(rd, rd[i].end[0]) < 
                    goal.yaw*roadValue(ir, rd[i].end[0])) return false;
            }
            // Iterate through and check old road points in the ping range
            var ir_i1 = findRoadSegment(ir, now);
            var ir_i2 = findRoadSegment(ir, hor);
            for (i = ir_i1; i < ir_i2; i++) {
                if (goal.yaw*roadValue(rd, ir[i].end[0]) < 
                    goal.yaw*roadValue(ir, ir[i].end[0])) return false;
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

        function roadExtentPartial( rd, xmin, xmax, extend = false ) {
            var extent = {};
            // Compute new limits for the current data
            extent.xMin = xmin;
            extent.xMax = xmax;
            extent.yMin = d3.min(rd, function(d) { 
                return (d.sta[0] <xmin||d.sta[0]>xmax)?Infinity:d.sta[1]; });
            extent.yMax = d3.max(rd, function(d) { 
                return (d.sta[0] <xmin||d.sta[0]>xmax)?-Infinity:d.sta[1]; });
            extent.yMin = d3.min([extent.yMin, roadValue(rd,xmin), roadValue(rd,xmax)]);
            extent.yMax = d3.max([extent.yMax, roadValue(rd,xmin), roadValue(rd,xmax)]);

            // Extend limits by 5% so everything is visible
            var p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10};
            if (extend) enlargeExtent(extent, p);
            return extent;
        }

        function computePlotLimits( adjustZoom = true ) {
            if (roads.length == 0) return;
            // Save old limits so we can figure out how much to extend scale
            // extent for zoom
            var xMinOld = goal.xMin, xMaxOld = goal.xMax;
            var yMinOld = goal.yMin, yMaxOld = goal.yMax;
            
            var cur = roadExtent( roads, false );
            var old = roadExtent( initialRoad, false );
            var now = goal.asof.unix();

            var ne = mergeExtents( cur, old );
            var p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10};
            enlargeExtent(ne, p);

            goal.xMin = ne.xMin; goal.xMax = ne.xMax;
            goal.yMin = ne.yMin; goal.yMax = ne.yMax;

            if ( adjustZoom ) {
                var xrange = [newXScale.invert(0), 
                              newXScale.invert(plotbox.width)];
                var yrange = [newYScale.invert(0), 
                              newYScale.invert(plotbox.height)];
                xScale.domain([new Date(goal.xMin*1000), 
                                  new Date(goal.xMax*1000)]);
                yScale.domain([goal.yMin, goal.yMax]);
                var newtr = d3.zoomIdentity.scale(plotbox.width
                                                  /(xScale(xrange[1]) 
                                                    - xScale(xrange[0])))
                        .translate(-xScale(xrange[0]), 0);
                zoomarea.call( axisZoom.transform, newtr );
            }
        }
        
        // Recreates the road array from the "rawknots" array, which includes
        // only timestamp,value pairs
        function loadRoad( json ) {

            roads = [];
            clearUndoBuffer();
            var rdData = json.params.road;
            var nk = rdData.length;
            var firstsegment;
            var ratemult = SID;
            if (json.params.runits === 'h') ratemult = 60*60;
            if (json.params.runits === 'd') ratemult = SID;
            if (json.params.runits === 'w') ratemult = 7*SID;
            if (json.params.runits === 'm') ratemult = 30*SID;
            if (json.params.runits === 'y') ratemult = DIY*SID;

            if (json.params.hasOwnProperty('asof')) {
                goal.asof = moment.utc(json.params.asof);
                goal.asof.hour(0); goal.asof.minute(0); 
                goal.asof.second(0); goal.asof.millisecond(0);
                goal.horizon = addDays(goal.asof, 7);
            }

            if (json.params.hasOwnProperty('tini')) {
                firstsegment = {
                    sta: [dayparse(json.params.tini), Number(json.params.vini)],
                    slope: 0,
                    auto: RoadParamEnum.SLOPE };
                firstsegment.end = firstsegment.sta.slice();
                firstsegment.sta[0] = daysnap(firstsegment.sta[0]-100*DIY*SID);
            } else {
                // Retrieve starting date from the first datapoint
                firstsegment = {
                    sta: [dayparse(json.data[0][0]), Number(json.data[0][1])],
                    slope: 0,
                    auto: RoadParamEnum.SLOPE };
                firstsegment.end = firstsegment.sta.slice();
                firstsegment.sta[0] = daysnap(firstsegment.sta[0]-100*365*SID);
            }
            roads.push(firstsegment);
            
            for (var i = 0; i < nk+1; i++) {
                var segment = {};
                segment.sta = roads[roads.length-1].end.slice();
                var rddate = null;
                var rdvalue = null;
                var rdslope = null;

                if (i < nk) {
                    rddate = rdData[i][0];
                    rdvalue = rdData[i][1];
                    rdslope = rdData[i][2];
                } else {
                    if (json.params.hasOwnProperty('tfin') 
                        && json.params.tfin != null) { 
                        rddate = json.params.tfin;
                    } if (json.params.hasOwnProperty('gldt') 
                          && json.params.gldt != null) { 
                        rddate = json.params.gldt;
                    }
                    if (json.params.hasOwnProperty('vfin') 
                        && json.params.vfin != null) { 
                        rdvalue = json.params.vfin;
                    } else if (json.params.hasOwnProperty('goal')
                               && json.params.goal != null) { 
                        rdvalue = json.params.goal;
                    }
                    if (json.params.hasOwnProperty('rfin') 
                        && json.params.rfin != null) {
                        rdslope = json.params.rfin;
                    } else if (json.params.hasOwnProperty('rate')
                               && json.params.rate != null) { 
                        rdvalue = json.params.rate;
                    }
                }

                if (rddate == null) {
                    segment.end = [0, Number(rdvalue)];
                    segment.slope = Number(rdslope)/(ratemult);
                    segment.end[0] 
                        = (segment.end[1] - segment.sta[1])/segment.slope;
                    segment.auto = RoadParamEnum.DATE;
                } else if (rdvalue == null) {
                    segment.end = [dayparse(rddate), 0];
                    segment.slope = Number(rdslope)/(ratemult);
                    segment.end[1] = 
                        segment.sta[1]
                        +segment.slope*(segment.end[0]-segment.sta[0]);
                    segment.auto = RoadParamEnum.VALUE;
                } else if (rdslope == null) {
                    segment.end = [dayparse(rddate), Number(rdvalue)];
                    segment.slope = roadSegmentSlope(segment);
                    segment.auto = RoadParamEnum.SLOPE;
                } 
                // Skip adding segment if it is earlier than the first segment
                if (segment.end[0] >= segment.sta[0]) {
                    roads.push(segment);
                }
            }
            
            var finalsegment = {
                sta: roads[roads.length-1].end.slice(),
                end: roads[roads.length-1].end.slice(),
                slope: 0,
                auto: RoadParamEnum.VALUE };
            finalsegment.end[0] = daysnap(finalsegment.end[0]+100*DIY*SID);
            roads.push(finalsegment);
            
            goal.yaw = Number(json.params.yaw);
            goal.dir = Number(json.params.dir);
            datapoints = json.data;
            var numpts = datapoints.length;
            for (i = 0; i < numpts; i++) {
                datapoints[i].splice(-1,1); // Remove comment
                datapoints[i][0] = dayparse(datapoints[i][0]);
            }
            if (json.params.hasOwnProperty('odom') && json.params.odom)
                odomify(datapoints);

            goal.kyoom = (json.params.hasOwnProperty('kyoom') 
                         &&json.params.kyoom);
            if ( json.params.hasOwnProperty('aggday'))
                goal.aggday = json.params.aggday;
            else {
                if (goal.kyoom) goal.aggday = "sum";
                else goal.aggday = "last";
            }
            // Aggregate datapoints and handle kyoom
            var pre = 0;
            var newpts = [];
            var futurepts = [];
            var curtime = datapoints[0][0];
            var curvalues = [datapoints[0][1]];
            for (i = 1; i < datapoints.length; i++) {
                if (datapoints[i][0] == curtime) {
                    curvalues.push(datapoints[i][1]);
                } else {
                    var ad = AGGR[goal.aggday](curvalues);
                    if (curtime <= goal.asof.unix())
                        //pre remains 0 for non-kyoom
                        newpts.push([curtime, ad+pre]);
                    else
                        futurepoints.push([curtime, ad+pre]);
                    if (goal.kyoom) pre += ad; 
                    curtime = datapoints[i][0];
                    curvalues = [datapoints[i][1]];
                }
            }
            if (curtime <= goal.asof.unix())
                newpts.push([curtime, AGGR[goal.aggday](curvalues)+pre]);
            else futurepoints.push([curtime, AGGR[goal.aggday](curvalues)+pre]);
            datapoints = newpts;

            flatline();
            goal.tcur = datapoints[datapoints.length-1][0];
            goal.vcur = datapoints[datapoints.length-1][1];

            initialRoad = copyRoad( roads );

            computePlotLimits( false );
            zoomAll();
        }

        function loadRoadFromURL( url ) {
            loadJSON(url, 
                     function(resp) { 
                         loadRoad(resp);
                         updateGraphData();
                         updateTable();
                         updateContextData();
                     });  
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
                segment.auto = RoadParamEnum.VALUE;
                roads.splice(found+1, 0, segment);
                
                computePlotLimits( true );
                horindex = findRoadSegment(roads, goal.horizon.unix());
                reloadBrush();
                updateGraphData();
                updateTable();
                updateContextData();
            }
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
                          opts.keepslopes?RoadParamEnum.VALUE
                          :RoadParamEnum.SLOPE, fromtable );

            computePlotLimits( true );
            reloadBrush();
            updateGraphData();
            updateTable();
            updateContextData();
        }

        // -------------- Functions for manipulating knots ---------------
        var roadsave, knotind, knotmin, knotmax, knottext, knotdate, dottext;

        var editingKnot = false;
        function knotDragStarted(d,i) {
	        d3.event.sourceEvent.stopPropagation();
            editingKnot = true;
            highlightDate(i, true);
            pushUndoState();
            var kind = Number(this.id);
	        knotmin = (kind == 0) ? goal.xMin : (roads[kind].sta[0])-SID;
            //var hortime = goal.horizon.getTime()/1000;
            //if (kind == roads.length-2 && roads[kind].end[0] >= hortime)
            //knotmin = d3.max([knotmin, hortime]);
	        knotmax = 
                ((kind == roads.length-1) 
                 ? roads[kind].end[0]
                 :(roads[kind+1].end[0])) + SID;
            if (opts.keepintervals) 
                knotmax = newXScale.invert(plotbox.width)/1000;
            roadsave = copyRoad( roads );
            // event coordinates are pre-scaled, so use normal scale
	        var x = daysnap(newXScale.invert(d3.event.x+3)/1000);
            knotdate = moment.unix(d.end[0]).utc();
            knottext = createTextBox(newXScale(x*1000), plotbox.height-15, 
                                     knotdate.format('YYYY-MM-DD'));
            dottext = createTextBox(newXScale(x*1000), 
                                    newYScale(d.end[1])-15, 
                                    d.end[1].toPrecision(5));
        };
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
                          RoadParamEnum.VALUE:RoadParamEnum.SLOPE,
                          false,RoadParamEnum.DATE );
            for (ii = kind; ii < rd.length; ii++) {
  	            d3.select("[name=knot"+ii+"]")
	                .attr("x1", newXScale(rd[ii].end[0]*1000))
		  	        .attr("x2", newXScale(rd[ii].end[0]*1000));
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
		        d3.select("[name=remove"+ii+"]")
                    .attr("transform", 
                          function(d){ 
                              return "translate("+(newXScale(d.end[0]*1000)
                                                   +plotpad.left-8)
                                  +","+(plotpad.top-20)+") scale(0.6,0.6)";
                          });
                var datestr = dayify(rd[ii].end[0], '-');
  		        d3.select("[name=enddate"+ii+"]")
                    .text(datestr);
  		        d3.select("[name=endvalue"+ii+"]")
                    .text(rd[ii].end[1].toPrecision(5));
  		        d3.select("[name=slope"+ii+"]")
                    .text((rd[ii].slope*SID).toPrecision(5));
            }
            updateWatermark();
            updateBullseye();
            updateContextBullseye();
            updateRoadValidity(); // Make sure road validity is checked
            updateDataPoints();
            updateYBHP();
            knotdate = moment.unix(x).utc(); 
            updateTextBox(knottext, newXScale(x*1000), plotbox.height-15, 
                          knotdate.format('YYYY-MM-DD'));
            updateTextBox(dottext, newXScale(x*1000), newYScale(d.end[1])-15, 
                          d.end[1].toPrecision(opts.precision));
        };
        function knotDragEnded(d,i){
            highlightDate(i, false);
            editingKnot = false;

            removeTextBox(knottext);
            removeTextBox(dottext);
            knottext = null;
            dottext = null;
            roadsave = null;

            computePlotLimits( true );
            reloadBrush();
            updateGraphData();
            updateTable();
            updateContextData();
        };

        function knotDeleted(d) {
            var kind = Number(this.id);
            removeKnot(kind, false);
        }

        function changeKnotDate( kind, newDate, fromtable = true ) {
            pushUndoState();

	        knotmin = (kind == 0) ? goal.xMin : (roads[kind].sta[0]) + 0.01;
	        knotmax = 
                (kind == roads.length-1) 
                ? roads[kind].end[0]+0.01
                :(roads[kind+1].end[0]+0.01);
            if (newDate <= knotmin) newDate = daysnap(knotmin);
            if (newDate >= knotmax) newDate = daysnap(knotmin);
            roads[kind].end[0] = newDate;
            if (!fromtable) {
                // TODO?
            }
            fixRoadArray( roads, null, fromtable, RoadParamEnum.DATE );

            computePlotLimits( true );
            reloadBrush();
            updateGraphData();
            updateTable();
            updateContextData();
        }

        function knotEdited(d, id) {
            var kind = Number(id);
            if (roads[kind].auto == RoadParamEnum.DATE) {
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
            //var newValue = prompt("Please enter desired value", d.end[1]);
            //if (newValue == null) return;
            //newValue = parseFloat(newValue);
            //if (isNaN(newValue)) return;
            //changeDotValue(kind, newValue, false);
        };

        // ------------------- Functions for manipulating dots -----------------
        var editingDot = false;
        function dotDragStarted(d,id) {
            d3.event.sourceEvent.stopPropagation();
            editingDot = true;
            highlightValue(id, true);
            pushUndoState();
            roadsave = copyRoad( roads );
            // event coordinates are pre-scaled, so use normal scale
	        var txtx = daysnap(d.sta[0]);
	        var txty = newYScale.invert(d3.event.y);
            knotdate = moment.unix(d.sta[0]).utc();
            knottext = createTextBox(newXScale(txtx*1000), 
                                     plotbox.height-15, 
                                     knotdate.format('YYYY-MM-DD'));
            dottext = createTextBox(newXScale(txtx*1000), 
                                    newYScale(txty)-18, 
                                    d.sta[1].toPrecision(opts.precision));  
        };
        function dotDragged(d, id) {
            var now = goal.asof.unix();
	        var y = newYScale.invert(d3.event.y);
            var kind = id;
            var rd = roads;
	        roads[kind].end[1] = y;
            roads[kind].slope = roadSegmentSlope(rd[kind]);
            fixRoadArray( rd, opts.keepslopes?RoadParamEnum.VALUE
                          :RoadParamEnum.SLOPE,
                          false,RoadParamEnum.VALUE );
            var strt = (kind==0)?0:(kind-1);
            for (var i = strt; i < rd.length; i++) {
		        d3.select("[name=dot"+i+"]")
		            .attr("cy", newYScale(rd[i].end[1]));
		        d3.select("[name=ctxdot"+i+"]")
		            .attr("cy", yScaleB(rd[i].end[1]));
		        d3.select("[name=road"+i+"]")
			        .attr("y1", newYScale(rd[i].sta[1]))
			        .attr("y2", newYScale(rd[i].end[1]));
		        d3.select("[name=ctxroad"+i+"]")
			        .attr("y1", yScaleB(rd[i].sta[1]))
			        .attr("y2", yScaleB(rd[i].end[1]));
                var datestr = dayify(rd[i].end[0], '-');
  		        d3.select("[name=enddate"+i+"]")
                    .text(datestr);
  		        d3.select("[name=endvalue"+i+"]")
                    .text(rd[i].end[1].toPrecision(5));
  		        d3.select("[name=slope"+i+"]")
                    .text((rd[i].slope*SID).toPrecision(5));
            }
            updateWatermark();
            updateBullseye();
            updateContextBullseye();
            updateRoadValidity();
            updateDataPoints();
            updateYBHP();
            // event coordinates are pre-scaled, so use normal scale
	        var txtx = daysnap(d.sta[0]);
	        var txty = newYScale.invert(d3.event.y);
            updateTextBox(dottext, newXScale(txtx*1000), 
                          newYScale(txty)-18, 
                          d.sta[1].toPrecision(opts.precision));  
        };
        function dotDragEnded(d,id){
            editingDot = false;
	        d3.select("[name=dot"+id+"]").style("fill", "var(--col-dot-editable)");
            highlightValue(id, false);

            removeTextBox(dottext);
            removeTextBox(knottext);
            roadsave = null;
            dottext = null;

            computePlotLimits( true );
            reloadBrush();
            updateGraphData();
            updateTable();
            updateContextData();
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

            fixRoadArray( roads, null, fromtable, RoadParamEnum.VALUE );

            computePlotLimits( true );
            reloadBrush();
            updateGraphData();
            updateTable();
            updateContextData();
        }

        function dotEdited(d, id) {
            var kind = Number(id);
            if (roads[kind].auto == RoadParamEnum.VALUE) {
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
        function changeRoadSlope(kind, newSlope, fromtable = false) {
            if (kind == roads.length-1) return;
            pushUndoState();

            roads[kind].slope = newSlope/(SID);
            if (!fromtable) {
                if (!opts.keepslopes) {
                    roads[kind].end[1] = roads[kind].sta[1] 
                        + roads[kind].slope*(roads[kind].end[0] 
                                             - roads[kind].sta[0]);
                    roads[kind+1].sta[1] = roads[kind].end[1];
                    roads[kind+1].slope = roadSegmentSlope(roads[kind+1]);
                }
            }
            fixRoadArray( roads, null, fromtable, RoadParamEnum.SLOPE );

            computePlotLimits( true );
            reloadBrush();
            updateGraphData();  
            updateTable();
            updateContextData();
        }

        function roadEdited(d, id) {
            var kind = Number(id);
            if (d.auto == RoadParamEnum.SLOPE) {
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
            var pastelt = gPastBox.select(".past");
            if (pastelt.empty()) {
                gPastBox.insert("svg:rect", ":first-child")
                    .attr("class","past")
	  	            .attr("x", newXScale(goal.xMin))
                    .attr("y", newYScale(goal.yMax+3*(goal.yMax-goal.yMin)))
		            .attr("width", newXScale(goal.asof.unix()*1000)
                          -newXScale(goal.xMin))		  
  		            .attr("height",7*Math.abs(newYScale(goal.yMin)
                                              -newYScale(goal.yMax)))
                    .attr("fill", "var(--col-pastbox)");
            } else {
                pastelt
	  	            .attr("x", newXScale(goal.xMin))
                    .attr("y", newYScale(goal.yMax+3*(goal.yMax-goal.yMin)))
		            .attr("width", newXScale(goal.asof.unix()*1000)
                          -newXScale(goal.xMin))		  
  		            .attr("height",7*Math.abs(newYScale(goal.yMin)
                                              -newYScale(goal.yMax)));
            }
        }
        // Creates or updates the shaded box to indicate past dates
        function updatePastText() {
            var todayelt = gPastText.select(".pastline");
            if (todayelt.empty()) {
                gPastText.append("svg:line")
	                .attr("class","pastline")
	  	            .attr("x1", newXScale(goal.asof.unix()*1000))
                    .attr("y1",0)
		            .attr("x2", newXScale(goal.asof.unix()*1000))
                    .attr("y2",plotbox.height)
                    .attr("stroke", "rgb(0,0,200)") 
		            .style("stroke-width",opts.today.width);
            } else {
                todayelt
	  	            .attr("x1", newXScale(goal.asof.unix()*1000))
                    .attr("y1", 0)
		            .attr("x2", newXScale(goal.asof.unix()*1000))
                    .attr("y2", plotbox.height);
            }
            var textx = newXScale(goal.asof.unix()*1000)-8;
            var texty = plotbox.height/2;
            var pasttextelt = gPastText.select(".pasttext");
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

        // Creates or updates the Bullseye at the goal date
        function updateBullseye() {
            var bullseyeelt = gBullseye.select(".bullseye");
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
            var bullseyeelt = ctxplot.select(".ctxbullseye");
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
            var bullseyeelt = gOldBullseye.select(".oldbullseye");
            var bx = newXScale(initialRoad[initialRoad.length-1]
                                  .sta[0]*1000)-(opts.bullsEye.size/2);
            var by = newYScale(initialRoad[initialRoad.length-1]
                                  .sta[1])-(opts.bullsEye.size/2);
            if (bullseyeelt.empty()) {
                gOldBullseye.append("svg:image")
	                .attr("class","oldbullseye")
	                .attr("xlink:href","https://cdn.glitch.com/0ef165d2-f728-4dfd-b99a-9206038656b2%2Fbullseye_old.png?1498051783901")
	  	            .attr("x",bx ).attr("y",by)
                    .attr('width', (opts.bullsEye.size))
                    .attr('height', (opts.bullsEye.size));
            } else {
                bullseyeelt
	  	            .attr("x", bx).attr("y", by);
            }
        }

        function updateContextOldBullseye() {
            var bullseyeelt = ctxplot.select(".ctxoldbullseye");
            var bx = xScaleB(initialRoad[initialRoad.length-1].sta[0]*1000)
                -(opts.bullsEye.ctxsize/2);
            var by = yScaleB(initialRoad[initialRoad.length-1].sta[1])
                -(opts.bullsEye.ctxsize/2);
            if (bullseyeelt.empty()) {
                ctxplot.append("svg:image")
	                .attr("class","ctxoldbullseye")
	                .attr("xlink:href","https://cdn.glitch.com/0ef165d2-f728-4dfd-b99a-9206038656b2%2Fbullseye_old.png?1498051783901")
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
            var wmarkelt = focus.select(".watermark");
            var bx = sw/2;
            var by = sh-20;
            var loser = isLoser(roads,goal.yaw,datapoints,goal.tcur,goal.vcur);
            var txt = (loser)?"Insta-Derail!!":"safe days: "
                    +dtd(roads, goal.yaw, goal.dir, goal.asof, goal.tcur, goal.vcur);
            
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
            var horizonelt = gHorizon.select(".horizon");
            if (horizonelt.empty()) {
                gHorizon.append("svg:line")
	                .attr("class","horizon")
	  	            .attr("x1", newXScale(goal.horizon.unix()*1000))
                    .attr("y1",0)
		            .attr("x2", newXScale(goal.horizon.unix()*1000))
                    .attr("y2",plotbox.height)
                    .attr("stroke", "rgb(0,0,200)") 
                    .attr("stroke-dasharray", 
                          (opts.horizon.dash)+","+(opts.horizon.dash)) 
		            .style("stroke-width",opts.horizon.width);
            } else {
                horizonelt
	  	            .attr("x1", newXScale(goal.horizon.unix()*1000))
                    .attr("y1",0)
		            .attr("x2", newXScale(goal.horizon.unix()*1000))
                    .attr("y2",plotbox.height);
            }
            var textx = newXScale(goal.horizon.unix()*1000)+(18);
            var texty = plotbox.height/2;
            var horizontextelt = gHorizonText.select(".horizontext");
            if (horizontextelt.empty()) {
                gHorizonText.append("svg:text")
	                .attr("class","horizontext")
	  	            .attr("x",textx ).attr("y",texty)
                    .attr("transform", "rotate(-90,"+textx+","+texty+")")
                    .attr("fill", "rgb(0,0,200)") 
                    .style("font-size", (opts.horizon.font)+"px") 
                    .text("Akrasia Horizon");
            } else {
                horizontextelt
	  	            .attr("x", textx).attr("y", texty)
                    .attr("transform", "rotate(-90,"+textx+","+texty+")");
            }
        }

        function updateContextToday() {
            var todayelt = ctxplot.select(".ctxtoday");
            if (todayelt.empty()) {
                ctxplot.append("svg:line")
	                .attr("class","ctxtoday")
	  	            .attr("x1", xScaleB(goal.asof.unix()*1000))
                    .attr("y1",0)
		            .attr("x2", xScaleB(goal.asof.unix()*1000))
                    .attr("y2",brushbox.height)
                    .attr("stroke", "rgb(0,0,200)") 
		            .style("stroke-width",opts.horizon.ctxwidth);
            } else {
                todayelt
	  	            .attr("x1", xScaleB(goal.asof.unix()*1000))
                    .attr("y1",0)
		            .attr("x2", xScaleB(goal.asof.unix()*1000))
                    .attr("y2",brushbox.height);
            }
            var textx = xScaleB(goal.asof.unix()*1000)-5;
            var texty = brushbox.height/2;

            var pasttextelt = ctxplot.select(".ctxtodaytext");
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

        function updateContextHorizon() {
            var horizonelt = ctxplot.select(".ctxhorizon");
            if (horizonelt.empty()) {
                ctxplot.append("svg:line")
	                .attr("class","ctxhorizon")
	  	            .attr("x1", xScaleB(goal.horizon.unix()*1000))
                    .attr("y1",yScaleB(goal.yMin-5*(goal.yMax-goal.yMin)))
		            .attr("x2", xScaleB(goal.horizon.unix()*1000))
                    .attr("y2",yScaleB(goal.yMax+5*(goal.yMax-goal.yMin)))
                    .attr("stroke", "rgb(0,0,200)") 
                    .attr("stroke-dasharray", (opts.horizon.ctxdash)+","
                          +(opts.horizon.ctxdash)) 
		            .style("stroke-width",opts.horizon.ctxwidth);
            } else {
                horizonelt
	  	            .attr("x1", xScaleB(goal.horizon.unix()*1000))
                    .attr("y1",yScaleB(goal.yMin-5*(goal.yMax-goal.yMin)))
		            .attr("x2", xScaleB(goal.horizon.unix()*1000))
                    .attr("y2",yScaleB(goal.yMax+5*(goal.yMax-goal.yMin)));
            }

            var textx = xScaleB(goal.horizon.unix()*1000)+12;
            var texty = brushbox.height/2;

            var hortextelt = ctxplot.select(".ctxhortext");
            if (hortextelt.empty()) {
                ctxplot.append("svg:text")
	                .attr("class","ctxhortext")
	  	            .attr("x",textx ).attr("y",texty)
                    .attr("transform", "rotate(-90,"+textx+","+texty+")")
                    .attr("fill", "rgb(0,0,200)") 
                    .style("font-size", (opts.today.ctxfont)+"px") 
                    .text("Horizon");
            } else {
                hortextelt
	  	            .attr("x", textx).attr("y", texty)
                    .attr("transform", "rotate(-90,"+textx+","+texty+")");
            }
        }

        function updateYBHP() {
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
                    +newYScale(roadValue(ir, now));
            for (var i = itoday; i < ihor; i++) {
                d += " L"+newXScale(ir[i].end[0]*1000)+" "
                    +newYScale(ir[i].end[1]);
            }
            d+=" L"+newXScale(hor*1000)+" "+newYScale(roadValue(ir, hor));
            d+=" L"+newXScale(hor*1000)+" "+newYScale(yedge);
            d+=" L"+newXScale(now*1000)+" "+newYScale(yedge);
            d+=" Z";
            if (pinkelt.empty()) {
                gYBHP.append("svg:path")
                    .style('pointer-events', "none")
	                .attr("class","halfplane")
	  	            .attr("d", d)
                    .attr("fill", "var(--col-halfplane)");
            } else {
                pinkelt.attr("d", d);
            }
        }

        function updatePinkRegion() {
            var pinkelt = gPink.select(".pinkregion");
            var yedge, itoday, ihor;
            var ir = initialRoad;
            var now = goal.asof.unix();
            var hor = goal.horizon.unix();
            // Determine good side of the road 
            if (goal.yaw > 0) yedge = goal.yMin - 5*(goal.yMax - goal.yMin);
            else yedge = goal.yMax + 5*(goal.yMax - goal.yMin);
            // Compute road indices for left and right boundaries
            itoday = findRoadSegment(ir, now);
            ihor = findRoadSegment(ir, hor);
            var d = "M"+newXScale(now*1000)+" "
                    +newYScale(roadValue(ir, now));
            for (var i = itoday; i < ihor; i++) {
                d += " L"+newXScale(ir[i].end[0]*1000)+" "+
                    newYScale(ir[i].end[1]);
            }
            d+=" L"+newXScale(hor*1000)+" "+newYScale(roadValue(ir, hor));
            d+=" L"+newXScale(hor*1000)+" "+newYScale(yedge);
            d+=" L"+newXScale(now*1000)+" "+newYScale(yedge);
            d+=" Z";
            if (pinkelt.empty()) {
                gPink.append("svg:path")
                    .style('pointer-events', "none")
                    .attr("class","pinkregion")
	  	            .attr("d", d)
                    .attr("fill", "var(--col-pinkregion)");
            } else {
                pinkelt.attr("d", d);
            }
        }

        // Creates or updates the unedited road
        function updateOldRoad() {
            // Create, update and delete road lines
            var roadelt = gOldRoad.selectAll(".oldroads").data(initialRoad);
            roadelt.exit().remove();
            roadelt
		        .attr("x1", function(d){ return newXScale(d.sta[0]*1000);})
                .attr("y1",function(d){ return newYScale(d.sta[1]);})
		        .attr("x2", function(d){ return newXScale(d.end[0]*1000);})
		        .attr("y2",function(d){ return newYScale(d.end[1]);});
            roadelt.enter()
                .append("svg:line")
		        .attr("class","oldroads")
  		        .attr("id", function(d,i) {return i;})
	  	        .attr("name", function(d,i) {return "oldroad"+i;})
  		        .attr("x1", function(d){ return newXScale(d.sta[0]*1000);})
  		        .attr("y1",function(d){ return newYScale(d.sta[1]);})
	  	        .attr("x2", function(d){ return newXScale(d.end[0]*1000);})
  		        .attr("y2",function(d){ return newYScale(d.end[1]);})
  		        .style("stroke-width",opts.oldRoadLine.width)
  		        .style("stroke","var(--col-oldroad)")
                .style('pointer-events', "none");
        }

        function updateContextOldRoad() {
            // Create, update and delete road lines on the brush graph
            var roadelt = ctxplot.selectAll(".ctxoldroads")
                    .data(initialRoad);
            roadelt.exit().remove();
            roadelt
		        .attr("x1", function(d){ return xScaleB(d.sta[0]*1000);})
                .attr("y1",function(d){ return yScaleB(d.sta[1]);})
		        .attr("x2", function(d){ return xScaleB(d.end[0]*1000);})
		        .attr("y2",function(d){ return yScaleB(d.end[1]);});
            roadelt.enter()
                .append("svg:line")
		        .attr("class","ctxoldroads")
  		        .attr("id", function(d,i) {return i;})
	  	        .attr("name", function(d,i) {return "ctxoldroad"+i;})
  		        .attr("x1", function(d){ return xScaleB(d.sta[0]*1000);})
  		        .attr("y1",function(d){ return yScaleB(d.sta[1]);})
	  	        .attr("x2", function(d){ return xScaleB(d.end[0]*1000);})
  		        .attr("y2",function(d){ return yScaleB(d.end[1]);})
  		        .style("stroke-width",opts.oldRoadLine.ctxwidth)
  		        .style("stroke","var(--col-oldroad)")
                .style('pointer-events', "none");
        }

        function updateKnots() {
            // Create, update and delete vertical knot lines
            var knotelt = gKnots.selectAll(".knots").data(roads);
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
            var knotrmelt = buttonarea.selectAll(".remove").data(roads);
            knotrmelt.exit().remove();
            knotrmelt
  	            .attr("id", function(d,i) {return i;})
	            .attr("name", function(d,i) {return "remove"+i;})
                .attr("transform", 
                      function(d){ 
                          return "translate("+(newXScale(d.end[0]*1000)
                                               +plotpad.left-8)
                              +","+(plotpad.top-20)+") scale(0.6,0.6)";
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
                                               +plotpad.left-8)
                              +","+(plotpad.top-20)+") scale(0.6,0.6)";
                      })
                .style("visibility", function(d,i) {
                    return (i < roads.length-1)
                        ?"visible":"hidden";})
		        .on("mouseenter",function() {
			        d3.select(this).attr("fill","var(--col-rmknot-selected)");})
		        .on("mouseout",function() {
			        d3.select(this).attr("fill","var(--col-rmknot)");})
		        .on("click",knotDeleted);
        }

        function updateRoads() {
            var lineColor = isRoadValid( roads )?"var(--col-line-valid)":"var(--col-line-invalid)";

            // Create, update and delete road lines
            var roadelt = gRoads.selectAll(".roads").data(roads);
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
			        d3.select(this)
                        .style("stroke-width",(opts.roadLine.width+2));
                    highlightSlope(i, true);})
		        .on("mouseout",function(d,i) { 
			        d3.select(this)
                        .style("stroke-width",opts.roadLine.width);
                    highlightSlope(i, false);})
                .on("click", function(d,i) { 
                    if (d3.event.ctrlKey) roadEdited(d, this.id);});
        }

        function updateRoadValidity() {
            var lineColor = isRoadValid( roads )?
                    "var(--col-line-valid)":"var(--col-line-invalid)";

            // Create, update and delete road lines
            var roadelt = gRoads.selectAll(".roads");
            roadelt.style("stroke",lineColor);

            roadelt = gRoads.selectAll(".ctxroads");
            roadelt.style("stroke",lineColor);
        }

        function updateContextRoads() {
            // Create, update and delete road lines for the brush 
            var roadelt = ctxplot.selectAll(".ctxroads").data(roads);
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
  		        .style("stroke","var(--col-line-valid)")
  		        .style("stroke-width",opts.roadLine.ctxwidth);
        }

        function updateDots() {
            // Create, update and delete inflection points
            var dotelt = gDots.selectAll(".dots").data(roads);
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
                .attr("fill", "var(--col-dot-editable)")
		        .style("stroke-width", opts.roadDot.border) 
                .on('wheel', function(d) { 
                    // Redispatch a copy of the event to the zoom area
                    var new_event = new d3.event.constructor(d3.event.type, 
                                                             d3.event); 
                    zoomarea.node().dispatchEvent(new_event);})
                .on("mouseover",function(d,i) { 
                    if (!editingDot) {
                        highlightValue(i-1, true);
			            d3.select(this).style("fill","var(--col-dot-selected");
                    }})
		        .on("mouseout",function(d,i) { 
                    if (!editingDot) {
                        highlightValue(i-1, false);
			            d3.select(this).style("fill","var(--col-dot-editable");
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
            // Create, update and delete inflection points
            var dotelt = ctxplot.selectAll(".ctxdots").data(roads);
            dotelt.exit().remove();
            dotelt
		        .attr("cx", function(d){ return xScaleB(d.sta[0]*1000);})
                .attr("cy",function(d){ return yScaleB(d.sta[1]);});
            dotelt.enter().append("svg:circle")
		        .attr("class","ctxdots")
		        .attr("id", function(d,i) {return i-1;})
		        .attr("name", function(d,i) {return "ctxdot"+(i-1);})
		        .attr("r", opts.roadDot.ctxsize)
                .attr("fill", "var(--col-dot-editable)")
		        .style("stroke-width", opts.roadDot.ctxborder)
                .attr("cx", function(d){ return xScaleB(d.sta[0]*1000);})
		        .attr("cy",function(d){ return yScaleB(d.sta[1]);});
        }

        function updateDataPoints() {
            var pts = (flad != null)?
                    datapoints.slice(0,datapoints.length-1).concat(futurepoints):
                    datapoints.concat(futurepoints);
            var now = goal.asof.unix();
            var dpelt = gDpts.selectAll(".dpts").data(pts);
            if (opts.showdata) {
                dpelt.exit().remove();
                dpelt
		            .attr("cx", function(d){ return newXScale((d[0])*1000);})
                    .attr("cy",function(d){ return newYScale(d[1]);})
                    .attr("fill", function(d){ 
                        return (d[0] <= now)?
                            dotcolor(roads, goal.yaw, d[0], d[1])
                            :"var(--col-dp-fill-old)";});
                dpelt.enter().append("svg:circle")
		            .attr("class","dpts")
		            .attr("id", function(d,i) {return i;})
		            .attr("name", function(d,i) {return "dpt"+i;})
                    .style('pointer-events', 'none')
		            .attr("stroke", "var(--col-dp-stroke)")
		            .attr("stroke-width", opts.dataPoint.border)
                    .attr("r", opts.dataPoint.size)
		            .attr("cx", function(d){ return newXScale((d[0])*1000);})
                    .attr("cy",function(d){ return newYScale(d[1]);})
                    .attr("fill", function(d){ 
                        return (d[0] <= now)?dotcolor(roads, goal.yaw, d[0], d[1])
                            :"var(--col-dp-fill-old)";});
                dpelt = gDpts.selectAll(".fladp");
                if (flad != null) {
                    if (dpelt.empty()) {
                        gDpts.append("svg:use")
		                    .attr("class","fladp")
                            .attr("xlink:href", "#rightarrow")
                            .attr("fill", dotcolor(roads, goal.yaw, flad[0], flad[1]))
                            .attr("transform", 
                                  "translate("+(newXScale((flad[0])*1000))+","
                                  +newYScale(flad[1])+"),scale("
                                  +(opts.dataPoint.flsize/50)+")");
                    } else {
                        dpelt
                            .attr("fill", dotcolor(roads, goal.yaw, flad[0], flad[1]))
                            .attr("transform", 
                                  "translate("+(newXScale((flad[0])*1000))+","
                                  +newYScale(flad[1])+"),scale("
                                  +(opts.dataPoint.flsize/50)+")");
                    }
                } else {
                    if (!dpelt.empty()) dpelt.remove();
                }
            } else {
                dpelt.remove();
            }
        }

        // Create the table header and body to show road segments
        var thead, tbody;
        function createRoadTable() {
            var roadcolumns = ['', 'End Date', '', 'End Value', '',
                               'Daily Slope', ''];
            thead = d3.select(opts.divTable);
            thead.append("div").attr('class', 'roadhdr')
                .append("div").attr('class', 'roadhdrrow')
                .selectAll("span.roadhdrcell").data(roadcolumns)
                .enter().append("span").attr('class', 'roadhdrcell')
                .text(function (column) { return column; });
            tbody = thead.append('div').attr('class', 'roadbody');
        }

        // Create the table header and body to show the start node
        var sthead, stbody;
        function createStartTable() {
            var startcolumns = ['', 'Start Date', '', 'Start Value', ''];
            sthead = d3.select(opts.divTable);
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
            if (i == 0 && datePicker == null) {
                var kind = Number(focusField.node().parentNode.id);
	            knotmin = (kind == 0) ? goal.xMin : (roads[kind].sta[0]);
	            knotmax = 
                    (kind == roads.length-1) 
                    ? roads[kind].end[0]
                    :(roads[kind+1].end[0]);
                var timezone = moment(new Date()).format("ZZ");
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
                    // The manipulations below ensure that Pikaday shows the
                    // correct minimum and maximum dates regardless of the
                    // current local timezone.
                    minDate: moment.unix(knotmin).utc()
                        .utcOffset(timezone, true).toDate(),
                    maxDate: moment.unix(knotmax).utc()
                        .utcOffset(timezone, true).toDate()});
                datePicker.setMoment(moment(focusOldText + "T00:00:00.000"+timezone));        
                var floating = d3.select('.floating');
                var bbox = this.getBoundingClientRect();
                floating.style('left', (bbox.right+window.scrollX)+"px").style('top', (bbox.bottom+3+window.scrollY)+"px");
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

        function highlightDate(i, state) {
            var color = (state)?"var(--col-tblbg-highlight)":"var(--col-tblbg)";
            d3.select('.rtable [name=enddate'+i+']').style('background-color', color);  
        }
        function highlightValue(i, state) {
            var color = (state)?'var(--col-tblbg-highlight)':'var(--col-tblbg)';
            d3.select('.rtable [name=endvalue'+i+']').style('background-color', color);
        }
        function highlightSlope(i, state) {
            var color = (state)?'var(--col-tblbg-highlight)':'var(--col-tblbg)';
            d3.select('.rtable [name=slope'+i+']').style('background-color', color);  
        }
        function disableDate(i) {
            roads[i].auto=RoadParamEnum.DATE;
            d3.select('.rtable [name=enddate'+i+']')
                .style('color', 'var(--col-tbltxt-disabled)')
                .attr('contenteditable', false);  
            d3.select('.rtable [name=endvalue'+i+']')
                .style('color', 'var(--col-tbltxt)').attr('contenteditable', true);  
            d3.select('.rtable [name=slope'+i+']')
                .style('color', 'var(--col-tbltxt)').attr('contenteditable', true);  
            d3.select('.rtable [name=btndate'+i+']').property('checked', true);  
            d3.select('.rtable [name=btnvalue'+i+']').property('checked', false);  
            d3.select('.rtable [name=btnslope'+i+']').property('checked', false);  
        }
        function disableValue(i) {
            roads[i].auto=RoadParamEnum.VALUE;
            d3.select('.rtable [name=enddate'+i+']')
                .style('color', 'var(--col-tbltxt)')
                .attr('contenteditable', true);  
            d3.select('.rtable [name=endvalue'+i+']')
                .style('color', 'var(--col-tbltxt-disabled)')
                .attr('contenteditable', false);  
            d3.select('.rtable [name=slope'+i+']')
                .style('color', 'var(--col-tbltxt)').attr('contenteditable', true);  
            d3.select('.rtable [name=btndate'+i+']').property('checked', false);  
            d3.select('.rtable [name=btnvalue'+i+']').property('checked', true);  
            d3.select('.rtable [name=btnslope'+i+']').property('checked', false);  
        }
        function disableSlope(i) {
            roads[i].auto=RoadParamEnum.SLOPE;
            d3.select('.rtable [name=enddate'+i+']')
                .style('color', 'var(--col-tbltxt)').attr('contenteditable', true);  
            d3.select('.rtable [name=endvalue'+i+']')
                .style('color', 'var(--col-tbltxt)').attr('contenteditable', true);  
            d3.select('.rtable [name=slope'+i+']')
                .style('color', 'var(--col-tbltxt-disabled)')
                .attr('contenteditable', false);  
            d3.select('.rtable [name=btndate'+i+']').property('checked', false);  
            d3.select('.rtable [name=btnvalue'+i+']').property('checked', false);  
            d3.select('.rtable [name=btnslope'+i+']').property('checked', true);  
        }

        function updateTableButtons() {
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
                             type: 'checkbox', txt: 'r', auto: (row.auto==RoadParamEnum.DATE)},
                            {order: 5, row:kind, name: "btnvalue"+kind, evt: function() {disableValue(kind);}, 
                             type: 'checkbox', txt: 'r', auto: (row.auto==RoadParamEnum.VALUE)},
                            {order: 7, row:kind, name: "btnslope"+kind, evt: function() {disableSlope(kind);}, 
                             type: 'checkbox', txt: 'r', auto: (row.auto==RoadParamEnum.SLOPE)},
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

            var reversetable = opts.reversetable;
            var srows = stbody.selectAll(".startrow")
                    .data(roads.slice(0,1));
            srows.enter().append('div').attr('class', 'startrow')
                .attr("name", function(d,i) { return 'startrow'+i;})
                .attr("id", function(d,i) { return (i);});
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
                .style('color', 'var(--col-tbltxt)')
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
                .attr("name", function(d,i) { return 'roadrow'+(reversetable?roads.length-1-(i+1):(i+1));})
                .attr("id", function(d,i) { return reversetable?roads.length-1-(i+1):(i+1);});
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
                             auto: (row.auto==RoadParamEnum.DATE)},
                            {order: 4, value: row.end[1].toPrecision(5), name: "endvalue"+(ri), 
                             auto: (row.auto==RoadParamEnum.VALUE)},
                            {order: 6, value: (row.slope*SID).toPrecision(5), name: "slope"+(ri), 
                             auto: (row.auto==RoadParamEnum.SLOPE)}];
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
                    return d.auto?'var(--col-tbltxt-disabled)':'var(--col-tbltxt)';})
                .attr("contenteditable", function(d,i) { return (d.auto)?'false':'true';});

        }

        function updateTable() {
            updateTableValues();
            updateTableButtons();
        }

        function updateContextData() {
            updateContextOldRoad();
            updateContextOldBullseye();
            updateContextBullseye();
            updateContextRoads();
            updateContextDots();
            updateContextHorizon();
            updateContextToday();
        }

        function updateGraphData() {
            updatePastBox();
            updateYBHP();
            updatePinkRegion();
            updateOldRoad();
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
        self.privileged = function() { console.log( goal ); };
        self.showData = function( flag ) {
            if (arguments.length > 0) opts.showdata = flag;
            updateDataPoints();
            return opts.showdata;
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
            loadRoadFromURL( url );
        };
    };


    bmndr.prototype = {
    };

    return bmndr;
}));
