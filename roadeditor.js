// --------------------------------- 80chars ---------------------------------->
/* global d3 */ // This line makes JSLint not complain

document.execCommand("enableInlineTableEditing", false, false);
document.execCommand("enableObjectResizing", false, false);

// SVG size and padding
var size = {width: 700, height:500};
var padding = {left:50, right:10, top:30, bottom:30};
// Options for graph generation and editing
var opts = {
    dotsize: 5,
    dotborder: 2,
    oldroadwidth: 2,
    roadwidth: 3,
    knotwidth: 4,
    horizonwidth: 2,
    horizondash: 8,
    horizonfont: 16,
    tbmargin: 3,       // Margin for text box background
    precision: 5,      // Digit precision for values
    editpast: true
};

// rawknots includes the start date and value, subsequent date/value
// pairs, and the last entry is the goal date and value
var rawknots = [[1474606400,50], 
                [1484606400,0], 
                [1495984800,20], 
                [1503284800,-50], 
                [1505284800,0],
                [1509284800,-100]];
var roadyaw = +1; // +1: above, -1: below

// Do not edit: Computed based on values provided above
var plotsize = {width: size.width-padding.left-padding.right, 
                height: size.height-padding.top-padding.bottom};

// ----------------- Basic tools ----------------------
function inrange(x, min, max) {
    return x >= min && x <= max;
}
function  nearlyEqual(a, b, epsilon) {
    return Math.abs(a - b) < epsilon;
}
// ----------------- Date facilities ----------------------
// Returns a new date object ahead by the specified number of days
function addDays(date, days) {
    var result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
// Fixes the supplied unixtime to 00:00:00 on the same day
function daysnap(unixtime) {
    var d = new Date(unixtime*1000);
    d.setHours(0,0,0,0); // I think we want everything in UTC
    return Math.ceil(d.getTime()/1000);
}

function formatDate(unixtime) {
    var date = new Date(unixtime);
    var year = date.getFullYear();
    var month = (date.getMonth()+1);
    month = (month < 10)?"0"+month.toString():month.toString();
    var day = date.getDate();
    day= (day < 10)?"0"+day.toString():day.toString();
    return year+"."+month+"."+day;
}

// Take a daystamp like "20170531" and return unixtime in seconds
// (dreev confirmed this seems to match Beebrain's function)

// Uluc: Got rid of UTC since we initialize D3's x axis values with the local timezone, 
// so using UTC will screw that up. We will just keep internal times in the local 
// timezone, and convert to whatever is appropriate before sending data back
function dayparse(s, sep='') {
    if (!RegExp('^\\d{4}'+sep+'\\d{2}'+sep+'\\d{2}$').test(s)) { return NaN; }
    s = s.replace(RegExp('^(\\d\\d\\d\\d)'+sep+'(\\d\\d)'+sep+'(\\d\\d)$'), "$1-$2-$3");
    return Date.parse(s)/1000;
}

// Take an integer unixtime in seconds and return a daystamp like "20170531"
// (dreev superficially confirmed this works)
// Uluc: Added options to disable UTC and choose a separator
function dayify(t, utc = true, sep = '') {
    if (isNaN(t) || t < 0) { return "ERROR"; }
    var date = new Date(t*1000);
    var y = utc?date.getUTCFullYear():date.getFullYear();
    var m = utc?date.getUTCMonth() + 1:date.getMonth() + 1;
    var d = utc?date.getUTCDate():date.getDate();
    return '' + y + sep + (m < 10 ? '0' : '') + m + sep + (d < 10 ? '0' : '') + d;
}

// ------------------ Text Box Utilities ---------------------
function createTextBox(x, y, text){
    var textobj = {};
    if (y < 20-padding.top) y = 20 -padding.top;
    if (y > size.height-padding.bottom-10) y = size.height-padding.bottom-10;
    textobj.grp = main.append('g')
        .attr('transform', 'translate('+(x+padding.left)+","+(y+padding.top)+")");
    textobj.rect = textobj.grp.append('svg:rect')
        .attr('fill','var(--col-txtbox-bg)').attr('stroke', 'var(--col-txtbox-stroke)');
    textobj.text = textobj.grp.append('svg:text')
        .attr('text-anchor', 'middle')
        .text(text).attr('class', 'svgtxt');
    var bbox = textobj.text.node().getBBox();
    textobj.rect
        .attr('x', bbox.x-opts.tbmargin)
        .attr('y', bbox.y-opts.tbmargin)
        .attr('width',  bbox.width +opts.tbmargin*2)
        .attr('height', bbox.height+opts.tbmargin*2);
    return textobj;
}

function updateTextBox(obj, x, y, text) {
    if (y < 20-padding.top) y = 20 -padding.top;
    if (y > size.height-padding.bottom-10) y = size.height-padding.bottom-10;
    obj.text.text(text);
    var bbox = obj.text.node().getBBox();
    obj.rect
        .attr('x', bbox.x-opts.tbmargin)
        .attr('y', bbox.y-opts.tbmargin)
        .attr('width',  bbox.width +opts.tbmargin*2)
        .attr('height', bbox.height+opts.tbmargin*2);
    obj.grp.attr('transform', 'translate('+(x+padding.left)+","
                 +(y+padding.top)+")");
}

function removeTextBox(obj) {
    obj.grp.remove();
}

// ---------------- Road Array utilities --------------------
// The roads array is initialized and updated by us. Each entry encodes a
// segment of the road in the form [startdate, startvalue, enddate,
// endvalue, slope]. The first and last entries encode flat segments
// at the beginning and end of the overall road.
var initialRoad;
var roads;
var undoBuffer = [];

var RoadParamEnum = Object.freeze({DATE:0, VALUE:1, SLOPE:2});

function clearUndoBuffer() {
    undoBuffer = [];
    d3.select("button#undo").attr('disabled', 'true');
}

function undoLastEdit() {
    //console.debug("undoLastEdit: Undo Buffer has "+undoBuffer.length+" entries");
    if (undoBuffer.length == 0) return;
    roads = undoBuffer.pop();
    updateAllData();
    if (undoBuffer.length == 0) 
        d3.select("button#undo").attr('disabled', 'true');
    return;
}
function pushUndoState() {
    //console.debug("pushUndoState: Undo Buffer has "+undoBuffer.length+" entries");
    if (undoBuffer.length == 0 || !sameRoads(undoBuffer[undoBuffer.length-1], roads)) {
        undoBuffer.push(copyRoad(roads));
        d3.select("button#undo").attr('disabled', null);
    }
}

// Determines whether the given road is valid or not (i.e. whether it
// is clear of the pink region or not)
function isRoadValid( rd ) {
    var ir = initialRoad;
    
    var now = today.getTime()/1000;
    var hor = hordate.getTime()/1000;
    // Check left/right boundaries of the pink region
    if (roadyaw*roadValue(rd, now) < roadyaw*roadValue(ir, now)) return false;
    if (roadyaw*roadValue(rd, hor) < roadyaw*roadValue(ir, hor)) return false;
    // Iterate through and check current road points in the ping range
    var rd_i1 = findRoadSegment(rd, now);
    var rd_i2 = findRoadSegment(rd, hor);
    for (var i = rd_i1; i < rd_i2; i++) {
        if (roadyaw*roadValue(rd, rd[i].end[0]) < 
            roadyaw*roadValue(ir, rd[i].end[0])) return false;
    }
    // Iterate through and check old road points in the ping range
    var ir_i1 = findRoadSegment(ir, now);
    var ir_i2 = findRoadSegment(ir, hor);
    for (i = ir_i1; i < ir_i2; i++) {
        if (roadyaw*roadValue(rd, ir[i].end[0]) < 
            roadyaw*roadValue(ir, ir[i].end[0])) return false;
    }
    
    return true;
}

function sameRoads( roada, roadb ) {
    if (roada.length != roadb.length) return false;
    for (var i = 0; i < roada.length; i++) {
        //console.debug(nearlyEqual(roada[i].end[0], roadb[i].end[0], 1));
        //console.debug(nearlyEqual(roada[i].end[1], roadb[i].end[1], 1));
        //console.debug(nearlyEqual(roada[i].slope, roadb[i].slope, 1));
        if (!nearlyEqual(roada[i].end[0], roadb[i].end[0], 10)) return false;
        if (!nearlyEqual(roada[i].end[1], roadb[i].end[1], 10)) return false;
        if (!nearlyEqual(roada[i].slope, roadb[i].slope, 1e-14)) return false;
    }
    return true;
}

function copyRoad( inroad ) {
    var newroad = [];
    for (var i = 0; i < inroad.length; i++) {
        var segment = {
            sta: inroad[i].sta.slice(),
            end: inroad[i].end.slice(),
            slope: inroad[i].slope,
            auto: inroad[i].auto };
        newroad.push(segment);
    }
    return newroad;
}

// Finds index for the road segment containing the supplied x value
function findRoadSegment(rd, x) {
    var found = -1;
    for (var i = 0; i < rd.length; i++) {
        if ((x >= rd[i].sta[0]) && (x < rd[i].end[0])) {
            found = i;
            break;
        }
    }
    return found;
}

function roadSegmentSlope(rd) {
    return (rd.end[1] - rd.sta[1]) / (rd.end[0] - rd.sta[0]);
}

function roadSegmentValue(rdseg, x) {
    return rdseg.sta[1] + rdseg.slope*(x - rdseg.sta[0]);
}

function roadValue(rd, x) {
    var i = findRoadSegment(rd, x);
    return roadSegmentValue( rd[i], x );
}

// Recomputes the road array starting from the first node and assuming
// that the one of slope, enddate or endvalue parameters is chosen to
// be automatically computed. If usetable is true, autocompute
// parameter selections from the table are used
function fixRoadArray(autoparam=RoadParamEnum.VALUE, usetable=false, edited=RoadParamEnum.VALUE) {
    var nr = roads.length;
    // Fix the special first road segment, whose slope will always be 0.
    roads[0].sta[0] = roads[0].end[0] - 100*365*24*60*60;
    roads[0].sta[1] = roads[0].end[1];

    // Iterate through the remaining segments until the last one
    for (var i = 1; i < nr-1; i++) {
        //console.debug("before("+i+"):[("+roads[i].sta[0]+","+roads[i].sta[1]+"),("+roads[i].end[0]+","+roads[i].end[1]+"),"+roads[i].slope+"]");
        if (usetable) autoparam = roads[i].auto;

        roads[i].sta[0] = roads[i-1].end[0];
        roads[i].sta[1] = roads[i-1].end[1];
        if (autoparam == RoadParamEnum.DATE) {
            if (roads[i].slope != 0) {
                roads[i].end[0] = daysnap(
                    roads[i].sta[0]+(roads[i].end[1]-roads[i].sta[1])/roads[i].slope);
            }
            // Sanity check
            if (roads[i].end[0] <= roads[i].sta[0]) {
                roads[i].end[0] = daysnap(roads[i].sta[0]+24*60*60);
            }
            if (edited == RoadParamEnum.SLOPE) {
                // Readjust value if slope was edited
                roads[i].end[1] = 
                    roads[i].sta[1]+roads[i].slope*(roads[i].end[0]-roads[i].sta[0]);
            } else {
                // Readjust value if value was edited
                roads[i].slope = roadSegmentSlope(roads[i]);
            }
        } else if (autoparam == RoadParamEnum.VALUE) {
            roads[i].end[1] = 
                roads[i].sta[1]+roads[i].slope*(roads[i].end[0]-roads[i].sta[0]);
        } else if (autoparam == RoadParamEnum.SLOPE) {
            roads[i].slope = roadSegmentSlope(roads[i]);
        }
        //console.debug("after("+i+"):[("+roads[i].sta[0]+","+roads[i].sta[1]+"),("+roads[i].end[0]+","+roads[i].end[1]+"),"+roads[i].slope+"]");
    }

    // Fix the last segment
    if (nr > 1) {
        roads[nr-1].sta[0] = roads[nr-2].end[0];
        roads[nr-1].sta[1] = roads[nr-2].end[1];
        roads[nr-1].end[0] = roads[nr-1].sta[0] + 100*365*24*60*60;
        roads[nr-1].end[1] = roads[nr-1].sta[1];
    }
}

// Adds a new dot to the supplied x value, with the y value computed
// from the corresponding y value
function addNewDot(x) {
    var found = findRoadSegment(roads, x);
    
    if (found >= 0) {
        var segment = {};
        var newx = daysnap(x);
        var newy = roads[found].sta[1] + roads[found].slope*(newx - roads[found].sta[0]);
        if (newx == roads[found].sta[0] || newx == roads[found].end[0] ) return;
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
        
        computeRoadExtent();
        updateAllData();
        horindex = findRoadSegment(roads, hordate.getTime()/1000);
    }
}

function addNewKnot(kind) {
    if (kind < roads.length-1) {
        addNewDot((roads[kind].sta[0] + roads[kind+1].sta[0])/2);
    } else {
        addNewDot(roads[kind].sta[0] + 7*24*60*60);
    }
}

function removeKnot(kind, fromtable) {
    pushUndoState();

    var oldslope = roads[kind].slope;
    roads.splice(kind, 1);
    if (keepslopes) roads[kind].slope = oldslope;
    fixRoadArray( keepslopes?RoadParamEnum.VALUE:RoadParamEnum.SLOPE, fromtable );
    computeRoadExtent();
    updateAllData();
}

// Recreates the road array from the "rawknots" array, which includes
// only timestamp,value pairs
function reloadRoadArray() {
    roads = [];
    var nk = rawknots.length;
    for (var i = 0; i < nk; i++) {
        rawknots[i][0] = daysnap(rawknots[i][0]);
    }
    for (i = 0; i < nk-1; i++) {
        var segment = {};
        segment.slope = (rawknots[i+1][1] - rawknots[i][1]) / 
            (rawknots[i+1][0] - rawknots[i][0]);
        segment.sta = rawknots[i].slice();
        segment.end = rawknots[i+1].slice();
        segment.auto = RoadParamEnum.VALUE;
        roads.push(segment);
    }
    var firstsegment = {
        sta: roads[0].sta.slice(),
        end: roads[0].sta.slice(),
        slope: 0,
        auto: RoadParamEnum.VALUE };
    firstsegment.sta[0] = daysnap(firstsegment.sta[0]-100*365*24*60*60);
    
    var lastsegment = {
        sta: roads[nk-2].end.slice(),
        end: roads[nk-2].end.slice(),
        slope: 0,
        auto: RoadParamEnum.VALUE };
    lastsegment.end[0] = daysnap(lastsegment.end[0]+100*365*24*60*60);
    
    roads.push(lastsegment);
    roads.unshift(firstsegment);
}

function roadExtent( rd ) {
    var extent = {};
    // Compute new limits for the current data
    extent.xMin = d3.min(rd, function(d) { return d.end[0]; });
    extent.xMax = d3.max(rd, function(d) { return d.sta[0]; });
    extent.yMin = d3.min(rd, function(d) { return d.sta[1]; });
    extent.yMax = d3.max(rd, function(d) { return d.sta[1]; });
    // Extend limits by 5% so everything is visible
    extent.xMin = extent.xMin - 0.25*(extent.xMax - extent.xMin);
    extent.xMax = extent.xMax + 0.15*(extent.xMax - extent.xMin);
    extent.yMin = extent.yMin - 0.05*(extent.yMax - extent.yMin);
    extent.yMax = extent.yMax + 0.05*(extent.yMax - extent.yMin);
    return extent;
}

// Define and compute limits for the current road array.
var xMin = Infinity, xMinNow = Infinity, xMax = -Infinity;
var yMin = Infinity, yMax = -Infinity;
function computeRoadExtent(allowShrink = false) {
    var firstRun = !Number.isFinite(xMin);
    
    // Save old limits so we can figure out how much to extend scale
    // extent for zoom
    var xMinOld = xMin, xMaxOld = xMax;
    var yMinOld = yMin, yMaxOld = yMax;
    
    var cur = roadExtent( roads );
    var old = roadExtent( initialRoad );
    
    xMin = d3.min([cur.xMin, old.xMin]);
    xMax = d3.max([cur.xMax, old.xMax]);
    yMin = d3.min([cur.yMin, old.yMin]);
    yMax = d3.max([cur.yMax, old.yMax]);
    
    // Limit minimum x to a month before today
    xMinNow = d3.max([xMin, today.getTime()/1000-28*24*60*60]);
    
    // Make sure we never shrink allowable zoom extent (unless
    // requested) since that causes jumpy behavior
    if (!allowShrink) {
        xMin = d3.min([xMin, xMinOld]);
        xMax = d3.max([xMax, xMaxOld]);
        yMin = d3.min([yMin, yMinOld]);
        yMax = d3.max([yMax, yMaxOld]);
    }
    
    if (!firstRun) {
        // After initialization, update the zoom scale extent if the
        // data limits have been extended.
        var curScales = axisZoom.scaleExtent();
        curScales[0] = curScales[0] 
            * d3.min([(xMaxOld - xMinOld) / (xMax - xMin),
                      (yMaxOld - yMinOld) / (yMax - yMin)]);
        axisZoom.scaleExtent(curScales);
        axisZoom.translateExtent([[xScale(xMin*1000), yScale(yMax)], 
                                  [xScale(xMax*1000), yScale(yMin)]]);
    }
}

// Compute daysnapped dates for today and the akrasia horizon
var today = new Date();
today.setHours(0,0,0,0);
var hordate = addDays(today, 7);
var horindex = null;

reloadRoadArray();
initialRoad = copyRoad( roads );

// Create and initialize the SVG chart and its components
var chart = d3.select('.roadgraph')
	    .append('svg:svg')
	    .attr('width', size.width)
	    .attr('height', size.height)
	    .attr('id', 'roadchart')
	    .attr('class', 'chart');
// Common SVG definitions, including clip paths
var defs = chart.append('defs');
defs.append("clipPath")
    .attr("id", "plotclip")
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", plotsize.width)
    .attr("height", plotsize.height);
defs.append("clipPath")
    .attr("id", "buttonareaclip")
    .append("rect")
    .attr("x", padding.left)
    .attr("y", 0)
    .attr("width", plotsize.width)
    .attr("height", plotsize.height);
var buttongrp = defs.append("g")
        .attr("id", "removebutton");
buttongrp.append("rect")
    .attr("x", 0).attr("y", 0)
    .attr("width", 30).attr("height", 30).attr('fill', 'white');
buttongrp.append("path")
    .attr("d", "M13.98,0C6.259,0,0,6.261,0,13.983c0,7.721,6.259,13.982,13.98,13.982c7.725,0,13.985-6.262,13.985-13.982C27.965,6.261,21.705,0,13.98,0z M19.992,17.769l-2.227,2.224c0,0-3.523-3.78-3.786-3.78c-0.259,0-3.783,3.78-3.783,3.78l-2.228-2.224c0,0,3.784-3.472,3.784-3.781c0-0.314-3.784-3.787-3.784-3.787l2.228-2.229c0,0,3.553,3.782,3.783,3.782c0.232,0,3.786-3.782,3.786-3.782l2.227,2.229c0,0-3.785,3.523-3.785,3.787C16.207,14.239,19.992,17.769,19.992,17.769z");

// --------------------------------- 80chars ---------------------------------->
// Create a rectange to monitor zoom events and install initial handlers
var zoomarea = chart.append('rect')
        .attr("class", "zoomarea")
        .attr("x", padding.left).attr("y", padding.top)
        .attr("width", plotsize.width).attr("height", plotsize.height);
var xzoomarea = chart.append('rect')
        .attr("class", "axiszoom")
        .attr("x", padding.left).attr("y", plotsize.height+padding.top)
        .attr("width", plotsize.width).attr("height", padding.bottom);
var yzoomarea = chart.append('rect')
        .attr("class", "axiszoom")
        .attr("x", 0).attr("y", padding.top)
        .attr("width", padding.left).attr("height", plotsize.height);
var axisZoom = d3.zoom()
        .scaleExtent([1, Infinity])
        .extent([[0, 0], [plotsize.width, plotsize.height]])
        .translateExtent([[0, 0], [plotsize.width, plotsize.height]])
        .on("zoom", updateZoom);
zoomarea.call(axisZoom);

function dotAdded() {
    if (d3.event.shiftKey) {
        var newx = newXScale.invert(d3.event.x-padding.left);
        if (opts.editpast || newx > hordate.getTime())
            addNewDot(newx/1000);
    }
}
zoomarea.on("click", dotAdded);

// Create plotting area above the zooming area so points can be selected
var main = chart.append('g')
	    .attr('class', 'main');
var buttonarea = main.append('g')
        .attr('clip-path', 'url(#buttonareaclip)')
        .attr('class', 'buttonarea'); 
var mainclip = main.append('g')
        .attr('clip-path', 'url(#plotclip)')
        .attr('transform', 'translate('+padding.left+','+padding.top+')');
var plot = mainclip.append('g')
	    .attr('class', 'plot');

// Now, compute limits of road data and create x and y axes
computeRoadExtent( );

// Create and initialize the x and y axes
var xScale = d3.scaleTime()
        .domain([new Date(xMinNow*1000), new Date(xMax*1000)])
        .range([0,plotsize.width]);
var xAxis = d3.axisBottom(xScale).ticks(6);
var xAxisObj = main.append('g')        
        .attr("class", "axis")
        .attr("transform", "translate("+padding.left+"," + (size.height - padding.bottom) + ")")
        .call(xAxis);
var yScale = d3.scaleLinear()
        .domain([yMin, yMax])
        .range([plotsize.height, 0]);
var yAxis = d3.axisLeft(yScale);
var yAxisObj = main.append('g')        
        .attr("class", "axis")
        .attr("transform", "translate(" + padding.left + ","+padding.top+")")
        .call(yAxis);

// These keep the current scaling factors for x and y axes
var xFactor = 1, yFactor = 1;
// These are the updated scale objects based on the current transform
var newXScale = xScale, newYScale = yScale;

function updateZoom() {
    // Inject the current transform into the plot element
    var tr = d3.event.transform;
    if (tr == null) return;

    plot.attr("transform", tr);

    // Rescale x and y axes
    newXScale = tr.rescaleX(xScale);
    newYScale = tr.rescaleY(yScale);
    xAxisObj.call(xAxis.scale(newXScale));
    yAxisObj.call(yAxis.scale(newYScale));

    // Compute scaling factors and adjust translation limits for zooming
    xFactor = tr.applyX(1) - tr.applyX(0);
    yFactor = tr.applyY(1) - tr.applyY(0);
    axisZoom.translateExtent([[xScale(xMin*1000), yScale(yMax)], 
                              [xScale(xMax*1000), yScale(yMin)]]);
    // Readjust point sizes and line widths with the current scale
    updateHorizon();
    updatePastBox();
    plot.selectAll(".roads").style("stroke-width",opts.roadwidth/xFactor);
    plot.selectAll(".oldroads").style("stroke-width",opts.oldroadwidth/xFactor);
    plot.selectAll(".knots").style("stroke-width",opts.knotwidth/xFactor);
    plot.selectAll(".dots").attr("r",opts.dotsize/xFactor);
    plot.selectAll(".dots").style("stroke-width",opts.dotborder/xFactor);
    buttonarea.selectAll(".remove")
        .attr("transform", 
              function(d){ return "translate("+(newXScale(d.sta[0]*1000)
                                                +padding.left-8)
                           +","+(padding.top-20)+") scale(0.6,0.6)";});
}

// ------------------- Functions for manipulating knots -----------------
var roadsave, knotmin, knotmax, knottext, knotdate, dottext;
var keepslopes, keepintervals;
function readEditOptions() {
    keepslopes = d3.select('#keepslopes');
    keepslopes = (!keepslopes.empty() && keepslopes.node().checked);
    keepintervals = d3.select('#keepintervals');
    keepintervals = (!keepintervals.empty() && keepintervals.node().checked);
}

var editingKnot = false;
function knotDragStarted(d,i) {
	d3.event.sourceEvent.stopPropagation();
    editingKnot = true;
    highlightDate(i, true);
    readEditOptions();
    pushUndoState();
    var kind = Number(this.id);
	knotmin = (kind == 0) ? xMin : (roads[kind].sta[0]) + 0.01;
	knotmax = 
        (kind == roads.length-1) 
        ? roads[kind].end[0]-0.01
        :(roads[kind+1].end[0]-0.01);
    if (keepintervals) knotmax = newXScale.invert(plotsize.width)/1000;
    roadsave = copyRoad( roads );
    // event coordinates are pre-scaled, so use normal scale
	var x = daysnap(xScale.invert(d3.event.x)/1000);
    knotdate = new Date(d.end[0]*1000);
    knottext = createTextBox(newXScale(x*1000), plotsize.height-15, 
                             knotdate.toDateString());
    dottext = createTextBox(newXScale(x*1000), newYScale(d.end[1])-15, 
                            d.end[1].toPrecision(5));
};
function knotDragged(d,i) {
    // event coordinates are pre-scaled, so use normal scale
	var x = daysnap(xScale.invert(d3.event.x)/1000);
	if (inrange(x, knotmin, knotmax)) {
        var kind = Number(this.id);
        var maxind = kind+1;
        if (keepintervals) maxind = roads.length;

        for (var ii = kind; ii < maxind; ii++) {
	        roads[ii].end[0] = x + roadsave[ii].end[0] - roadsave[kind].end[0];
        }
        fixRoadArray( keepslopes?RoadParamEnum.VALUE:RoadParamEnum.SLOPE,false,RoadParamEnum.DATE );
        for (ii = 0; ii < roads.length; ii++) {
  	        d3.select("[name=knot"+ii+"]")
	            .attr("x1", xScale(roads[ii].end[0]*1000))
		  	    .attr("x2", xScale(roads[ii].end[0]*1000));
  	        d3.select("[name=dot"+ii+"]")
	            .attr("cx", xScale(roads[ii].end[0]*1000))
		        .attr("cy", yScale(roads[ii].end[1]));
  		    d3.select("[name=road"+ii+"]")
	  	        .attr("x1", xScale(roads[ii].sta[0]*1000))
		        .attr("y1", yScale(roads[ii].sta[1]))
			    .attr("x2", xScale(roads[ii].end[0]*1000))
			    .attr("y2", yScale(roads[ii].end[1]));
		    d3.select("[name=remove"+ii+"]")
                .attr("transform", 
                      function(d){ 
                          return "translate("+(newXScale(d.end[0]*1000)+padding.left-8)
                              +","+(padding.top-20)+") scale(0.6,0.6)";
                      });
        }
        updateRoads(); // Make sure road validity is checked
        updateTableValues();
        knotdate.setTime(x*1000); 
        updateTextBox(knottext, newXScale(x*1000), plotsize.height-15, 
                      knotdate.toDateString());
        updateTextBox(dottext, newXScale(x*1000), newYScale(d.end[1])-15, 
                      d.end[1].toPrecision(opts.precision));
    }
};
function knotDragEnded(d,i){
    highlightDate(i, false);
    editingKnot = false;
    d3.select("[name=knot"+i+"]").style("stroke-width",opts.knotwidth/xFactor);
    computeRoadExtent();
    updateAllData();
    removeTextBox(knottext);
    removeTextBox(dottext);
    knottext = null;
    dottext = null;
    roadsave = null;
};

function knotDeleted(d) {
    readEditOptions();
    var kind = Number(this.id);
    removeKnot(kind, false);
}

function changeKnotDate( kind, newDate, fromtable = true ) {
    pushUndoState();

	knotmin = (kind == 0) ? xMin : (roads[kind].sta[0]) + 0.01;
	knotmax = 
        (kind == roads.length-1) 
        ? roads[kind].end[0]-0.01
        :(roads[kind+1].end[0]-0.01);
    if (newDate <= knotmin) newDate = daysnap(knotmin+24*60*60);
    if (newDate >= knotmax) newDate = daysnap(knotmin-24*60*60);
    roads[kind].end[0] = newDate;
    if (!fromtable) {
        // TODO?
    }
    fixRoadArray( null, fromtable, RoadParamEnum.DATE );
    computeRoadExtent();
    updateAllData();
}

// ------------------- Functions for manipulating dots -----------------
var editingDot = false;
function dotDragStarted(d,id) {
    d3.event.sourceEvent.stopPropagation();
    editingDot = true;
    highlightValue(id, true);
    pushUndoState();
    readEditOptions();
    roadsave = copyRoad( roads );
    // event coordinates are pre-scaled, so use normal scale
	var txtx = daysnap(d.sta[0]);
	var txty = yScale.invert(d3.event.y);
    dottext = createTextBox(newXScale(txtx*1000), newYScale(txty)-18, 
                            d.end[1].toPrecision(opts.precision));  
};
function dotDragged(d, id) {
	var y = yScale.invert(d3.event.y);
	if (inrange(y, newYScale.invert(plotsize.height), newYScale.invert(0))) {
        var kind = id;
	    roads[kind].end[1] = y;
        roads[kind].slope = roadSegmentSlope(roads[kind]);
        fixRoadArray( keepslopes?RoadParamEnum.VALUE:RoadParamEnum.SLOPE,false,RoadParamEnum.VALUE );
        for (var i = 0; i < roads.length; i++) {
		    d3.select("[name=dot"+i+"]")
		        .attr("cx", xScale(roads[i].end[0]*1000))
		        .attr("cy", yScale(roads[i].end[1]));
		    d3.select("[name=road"+i+"]")
			    .attr("x1", xScale(roads[i].sta[0]*1000))
			    .attr("y1", yScale(roads[i].sta[1]))
			    .attr("x2", xScale(roads[i].end[0]*1000))
			    .attr("y2", yScale(roads[i].end[1]));
        }
        updateRoads(); // Make sure road validity is checked
        updateTableValues();
        // event coordinates are pre-scaled, so use normal scale
	    var txtx = daysnap(d.sta[0]);
	    var txty = yScale.invert(d3.event.y);
        updateTextBox(dottext, newXScale(txtx*1000), newYScale(txty)-18, 
                      d.end[1].toPrecision(opts.precision));  
    }
};
function dotDragEnded(d,id){
    editingDot = false;
	d3.select("[name=dot"+id+"]").style("fill", "var(--col-dot-editable)");
    highlightValue(id, false);
    computeRoadExtent();
    updateAllData();
    removeTextBox(dottext);
    roadsave = null;
    dottext = null;
};

function changeDotValue( kind, newValue, fromtable = false ) {
    pushUndoState();

    roads[kind].end[1] = newValue;
    if (!fromtable) {
        if (!keepslopes) roads[kind].slope = roadSegmentSlope(roads[kind]);
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

    fixRoadArray( null, fromtable, RoadParamEnum.VALUE );
    computeRoadExtent();
    updateAllData();
}

function dotEdited(d, id) {
    readEditOptions();
    var kind = Number(id);
    var newValue = prompt("Please enter desired value", d.end[1]);
    if (newValue == null) return;
    newValue = parseFloat(newValue);
    if (isNaN(newValue)) return;
    changeDotValue(kind, newValue, false);
};

// -------------- Functions for manipulating road segments ----------
function changeRoadSlope(kind, newSlope, fromtable = false) {
    if (kind == roads.length-1) return;
    pushUndoState();

    roads[kind].slope = newSlope/(24*60*60);
    if (!fromtable) {
        if (!keepslopes) {
            roads[kind].end[1] = roads[kind].sta[1] + roads[kind].slope*(roads[kind].end[0] - roads[kind].sta[0]);
            roads[kind+1].sta[1] = roads[kind].end[1];
            roads[kind+1].slope = roadSegmentSlope(roads[kind+1]);
        }
    }
    fixRoadArray( null, fromtable, RoadParamEnum.SLOPE );
    computeRoadExtent();
    updateAllData();  
}

function roadEdited(d, id) {
    readEditOptions();
    var kind = Number(id);
    var newSlope = prompt("Please enter desired daily slope", d.slope*24*60*60);
    if (newSlope == null) return;
    newSlope = parseFloat(newSlope);
    if (isNaN(newSlope)) return;
    changeRoadSlope( kind, newSlope, false );
};

// ---------------- Functions to update SVG components ----------------

// Determines whether the knot at the given index is editable or not
function knotEditable(i) {
    if (opts.editpast)
        return ((i > 0) && (i < roads.length-1));
    else
        return ((i > horindex) && (i <roads.length-1));
}

// Creates or updates the shaded box to indicate past dates
function updatePastBox() {
    var pastelt = plot.select(".past");
    if (pastelt.empty()) {
        plot.insert("svg:rect", ":first-child")
            .attr("class","past")
	  	    .attr("x", xScale(xMin)).attr("y", yScale(yMax+3*(yMax-yMin)))
		    .attr("width", xScale(today.getTime())-xScale(xMin))		  
  		    .attr("height",7*Math.abs(yScale(yMin)-yScale(yMax)))
            .attr("fill", "rgb(240,240,240)");
    } else {
        pastelt
	  	    .attr("x", xScale(xMin)).attr("y", yScale(yMax+3*(yMax-yMin)))
		    .attr("width", xScale(today.getTime())-xScale(xMin))		  
  		    .attr("height",7*Math.abs(yScale(yMin)-yScale(yMax)));
    }
    var textx = xScale(today.getTime())-(5/xFactor);
    var texty = yScale(newYScale.invert(plotsize.height/2));
    var pasttextelt = plot.select(".pasttext");
    if (pasttextelt.empty()) {
        plot.append("svg:text")
	        .attr("class","pasttext")
	  	    .attr("x",textx ).attr("y",texty)
            .attr("transform", "rotate(-90,"+textx+","+texty+")")
            .attr("fill", "rgb(0,0,200)") 
            .style("font-size", (opts.horizonfont/xFactor)+"px") 
            .text("Today");
    } else {
        pasttextelt
	  	    .attr("x", textx).attr("y", texty)
            .attr("transform", "rotate(-90,"+textx+","+texty+")")
            .style("font-size", (opts.horizonfont/xFactor)+"px");
    }
}

// Creates or updates the Akrasia Horizon line
function updateHorizon() {
    var horizonelt = plot.select(".horizon");
    if (horizonelt.empty()) {
        plot.append("svg:line")
	        .attr("class","horizon")
	  	    .attr("x1", xScale(hordate.getTime()))
            .attr("y1",yScale(yMin-5*(yMax-yMin)))
		    .attr("x2", xScale(hordate.getTime()))
            .attr("y2",yScale(yMax+5*(yMax-yMin)))
            .attr("stroke", "rgb(0,0,200)") 
            .attr("stroke-dasharray", 
                  (opts.horizondash/xFactor)+","+(opts.horizondash/xFactor)) 
		    .style("stroke-width",opts.horizonwidth/xFactor);
    } else {
        horizonelt
	  	    .attr("x1", xScale(hordate.getTime()))
            .attr("y1",yScale(yMin-5*(yMax-yMin)))
		    .attr("x2", xScale(hordate.getTime()))
            .attr("y2",yScale(yMax+5*(yMax-yMin)))
            .attr("stroke-dasharray", 
                  (opts.horizondash/xFactor)+","+(opts.horizondash/xFactor)) 
		    .style("stroke-width",opts.horizonwidth/xFactor);
    }
    var textx = xScale(hordate.getTime())+(20/xFactor);
    var texty = yScale(newYScale.invert(plotsize.height/2));
    var horizontextelt = plot.select(".horizontext");
    if (horizontextelt.empty()) {
        plot.append("svg:text")
	        .attr("class","horizontext")
	  	    .attr("x",textx ).attr("y",texty)
            .attr("transform", "rotate(-90,"+textx+","+texty+")")
            .attr("fill", "rgb(0,0,200)") 
            .style("font-size", (opts.horizonfont/xFactor)+"px") 
            .text("Akrasia Horizon");
    } else {
        horizontextelt
	  	    .attr("x", textx).attr("y", texty)
            .attr("transform", "rotate(-90,"+textx+","+texty+")")
            .style("font-size", (opts.horizonfont/xFactor)+"px");
    }
}

function updatePinkRegion() {
    var pinkelt = plot.select(".pinkregion");
    var yedge, itoday, ihor;
    var ir = initialRoad;
    var now = today.getTime()/1000;
    var hor = hordate.getTime()/1000;
    // Determine good side of the road 
    if (roadyaw > 0) yedge = yMin - 5*(yMax - yMin);
    else yedge = yMax + 5*(yMax - yMin);
    // Compute road indices for left and right boundaries
    itoday = findRoadSegment(ir, now);
    ihor = findRoadSegment(ir, hor);
    var d = "M"+xScale(now*1000)+" "+yScale(roadValue(ir, now));
    for (var i = itoday; i < ihor; i++) {
        d += " L"+xScale(ir[i].end[0]*1000)+" "+yScale(ir[i].end[1]);
    }
    d += " L"+xScale(hor*1000)+" "+yScale(roadValue(ir, hor));
    d += " L"+xScale(hor*1000)+" "+yScale(yedge);
    d += " L"+xScale(now*1000)+" "+yScale(yedge);
    d += " Z";
    if (pinkelt.empty()) {
        plot.append("svg:path")
	        .attr("class","pinkregion")
	  	    .attr("d", d)
            .attr("fill", "rgb(255,220,220)");
    } else {
        pinkelt.attr("d", d);
    }
}

// Creates or updates the unedited road
function updateOldRoad() {
    // Create, update and delete road lines
    var roadelt = plot.selectAll(".oldroads").data(initialRoad);
    roadelt.exit().remove();
    roadelt
		.attr("x1", function(d){ return xScale(d.sta[0]*1000);})
        .attr("y1",function(d){ return yScale(d.sta[1]);})
		.attr("x2", function(d){ return xScale(d.end[0]*1000);})
		.attr("y2",function(d){ return yScale(d.end[1]);})
		.style("stroke-width",opts.oldroadwidth/xFactor);
    roadelt.enter()
        .append("svg:line")
		.attr("class","oldroads")
  		.attr("id", function(d,i) {return i;})
	  	.attr("name", function(d,i) {return "oldroad"+i;})
  		.attr("x1", function(d){ return xScale(d.sta[0]*1000);})
  		.attr("y1",function(d){ return yScale(d.sta[1]);})
	  	.attr("x2", function(d){ return xScale(d.end[0]*1000);})
  		.attr("y2",function(d){ return yScale(d.end[1]);})
  		.style("stroke-width",opts.oldroadwidth/xFactor)
  		.style("stroke","var(--col-oldroad)")
        .style('pointer-events', "none");
}

function updateKnots() {
    // Create, update and delete vertical knot lines
    var knotelt = plot.selectAll(".knots").data(roads);
    knotelt.exit().remove();
    knotelt
	    .attr("x1", function(d){ return xScale(d.end[0]*1000);})
	    .attr("y2",yScale(yMax + 10*(yMax-yMin)))
	    .attr("x2", function(d){ return xScale(d.end[0]*1000);})
        .attr("y1",yScale(yMin - 10*(yMax-yMin)))
        .style('pointer-events', function(d,i) {return (knotEditable(i))?"all":"none";})
        .style("visibility", function(d,i) {return (knotEditable(i))?"visible":"hidden";});
    knotelt.enter().append("svg:line")
	    .attr("class","knots")
	    .attr("id", function(d,i) {return i;})
	    .attr("name", function(d,i) {return "knot"+i;})
	    .attr("x1", function(d){ return xScale(d.end[0]*1000);})
	    .attr("y1",yScale(yMin))
	    .attr("x2", function(d){ return xScale(d.end[0]*1000);})
	    .attr("y2",yScale(yMax))
        .style('pointer-events', function(d,i) {return (knotEditable(i))?"all":"none";})
        .style("visibility", function(d,i) {return (knotEditable(i))?"visible":"hidden";})
	    .attr("stroke", "rgb(200,200,200)") 
	    .style("stroke-width",opts.knotwidth/xFactor)
	    .on("mouseover",function(d,i) {
	        if (!editingKnot) {
                highlightDate(i,true);
                d3.select(this).style("stroke-width",(opts.knotwidth+2)/xFactor);
            }})
	    .on("mouseout",function(d,i) {
	        if (!editingKnot) {
                highlightDate(i,false);
                d3.select(this).style("stroke-width",opts.knotwidth/xFactor);
            }})
        .call(d3.drag()
              .on("start", knotDragStarted)
              .on("drag", knotDragged)
              .on("end", knotDragEnded));

    // Create, update and delete removal icons for knots
    var knotrmelt = buttonarea.selectAll(".remove").data(roads);
    knotrmelt.exit().remove();
    knotrmelt
        .attr("transform", 
              function(d){ 
                  return "translate("+(newXScale(d.end[0]*1000)+padding.left-8)
                      +","+(padding.top-20)+") scale(0.6,0.6)";
              })
        .style("visibility", function(d,i) {
            return (knotEditable(i) && i < roads.length-1)?"visible":"hidden";});
    knotrmelt.enter()
        .append("use")
        .attr("class", "remove")
        .attr("xlink:href", "#removebutton")
	    .attr("id", function(d,i) {return i;})
	    .attr("name", function(d,i) {return "remove"+i;})
        .attr("transform", 
              function(d){ 
                  return "translate("+(newXScale(d.end[0]*1000)+padding.left-8)
                      +","+(padding.top-20)+") scale(0.6,0.6)";
              })
        .style("visibility", function(d,i) {
            return (knotEditable(i) && i < roads.length-1)?"visible":"hidden";})
		.on("mouseenter",function() {
			d3.select(this).attr("fill","var(--col-rmknot-selected)");})
		.on("mouseout",function() {
			d3.select(this).attr("fill","var(--col-rmknot)");})
		.on("click",knotDeleted);
}

function updateRoads() {
    var lineColor = isRoadValid( roads )?"var(--col-line-valid)":"var(--col-line-invalid)";

    // Create, update and delete road lines
    var roadelt = plot.selectAll(".roads").data(roads);
    roadelt.exit().remove();
    roadelt
		.attr("x1", function(d){ return xScale(d.sta[0]*1000);})
        .attr("y1",function(d){ return yScale(d.sta[1]);})
		.attr("x2", function(d){ return xScale(d.end[0]*1000);})
		.attr("y2",function(d){ return yScale(d.end[1]);})
		.style("stroke",lineColor)
		.style("stroke-width",opts.roadwidth/xFactor)
        .style('pointer-events', function(d,i) {return (knotEditable(i+1))?"all":"none";});
    roadelt.enter()
        .append("svg:line")
		.attr("class","roads")
  		.attr("id", function(d,i) {return i;})
	  	.attr("name", function(d,i) {return "road"+i;})
  		.attr("x1", function(d){ return xScale(d.sta[0]*1000);})
  		.attr("y1",function(d){ return yScale(d.sta[1]);})
	  	.attr("x2", function(d){ return xScale(d.end[0]*1000);})
  		.attr("y2",function(d){ return yScale(d.end[1]);})
  		.style("stroke-width",opts.roadwidth/xFactor)
        .style('pointer-events', function(d,i) {return (knotEditable(i+1))?"all":"none";})
		.on("mouseover",function(d,i) { if (knotEditable(i+1))
			                            d3.select(this).style("stroke-width",(opts.roadwidth+2)/xFactor);highlightSlope(i, true);})
		.on("mouseout",function(d,i) { if (knotEditable(i+1))
			                           d3.select(this).style("stroke-width",opts.roadwidth/xFactor);highlightSlope(i, false);})
        .on("dblclick", function(d,i) { if (knotEditable(i+1)) roadEdited(d, this.id);});
}

function updateDots() {
    // Create, update and delete inflection points
    var dotelt = plot.selectAll(".dots").data(roads);
    dotelt.exit().remove();
    dotelt
		.attr("cx", function(d){ return xScale(d.sta[0]*1000);})
        .attr("cy",function(d){ return yScale(d.sta[1]);})
        .attr("fill", function(d,i) { 
            return knotEditable(i-1)?"var(--col-dot-editable)":"var(--col-dot-fixed)";})
        .style('pointer-events', function(d,i) {return (knotEditable(i-1))?"all":"none";})
		.attr("stroke-width", opts.dotborder/xFactor);
    dotelt.enter().append("svg:circle")
		.attr("class","dots")
		.attr("id", function(d,i) {return i-1;})
		.attr("name", function(d,i) {return "dot"+(i-1);})
        .attr("cx", function(d){ return xScale(d.sta[0]*1000);})
		.attr("cy",function(d){ return yScale(d.sta[1]);})
		.attr("r", opts.dotsize/xFactor)
        .attr("fill", function(d,i) { 
            return knotEditable(i-1)?"var(--col-dot-editable)":"var(--col-dot-fixed)";})
		.style("stroke-width", opts.dotborder/xFactor) 
        .style('pointer-events', function(d,i) {return (knotEditable(i-1))?"all":"none";})
		.on("mouseover",function(d,i) { 
            if (knotEditable(i-1)) { if (!editingDot) {
                highlightValue(i-1, true);
			    d3.select(this).style("fill","var(--col-dot-selected");
            }}})
		.on("mouseout",function(d,i) { 
            if (knotEditable(i-1)) { if (!editingDot) {
                highlightValue(i-1, false);
			    d3.select(this).style("fill","var(--col-dot-editable");
            }}})
        .on("dblclick", function(d,i) { if (knotEditable(i-1)) dotEdited(d,this.id);})
        .call(d3.drag()
              .on("start", function(d,i) { 
                  if (knotEditable(i-1)) dotDragStarted(d, Number(this.id));})
              .on("drag", function(d,i) { 
                  if (knotEditable(i-1)) dotDragged(d, Number(this.id));})
              .on("end", function(d,i) { 
                  if (knotEditable(i-1)) dotDragEnded(d, Number(this.id));}));
}

// Create the table header and body to show the start node
var startcolumns = ['', 'Start Date', '', 'Start Value', ''];
var sthead = d3.select('div.rtable');
sthead.append("div").attr('class', 'starthdr')
    .append("div").attr('class', 'starthdrrow')
    .selectAll("span.starthdrcell").data(startcolumns)
    .enter().append('span').attr('class', 'starthdrcell')
    .text(function (column) { return column; });
var stbody = sthead.append('div').attr('class', 'startbody');

// Create the table header and body to show road segments
var roadcolumns = ['', 'End Date', '', 'End Value', '', 'Daily Slope', ''];
var thead = d3.select('div.rtable');
thead.append("div").attr('class', 'roadhdr')
    .append("div").attr('class', 'roadhdrrow')
    .selectAll("span.roadhdrcell").data(roadcolumns)
    .enter().append("span").attr('class', 'roadhdrcell')
    .text(function (column) { return column; });
var tbody = thead.append('div').attr('class', 'roadbody');

var focusField = null;
var focusOldText = null;
var datePicker = null;
function tableFocusIn( d, i ){
    //console.debug('tableFocusIn('+i+') for '+this.parentNode.id);
    focusField = d3.select(this);
    focusOldText = focusField.text();
    if (i == 0 && datePicker == null) {
        var kind = Number(focusField.node().parentNode.id);
	    knotmin = (kind == 0) ? xMin : (roads[kind].sta[0]);
	    knotmax = 
            (kind == roads.length-1) 
            ? roads[kind].end[0]
            :(roads[kind+1].end[0]);
        datePicker = new Pikaday({
            onSelect: function(date) {
                var newdate = datePicker.toString();
                var val = dayparse(newdate, '-');
                if (!isNaN(val)) {
                    focusField.text(newdate);
                    tableDateChanged( Number(kind), val);
                }
            },
            minDate: new Date((knotmin+24*60*60)*1000),
            maxDate: new Date((knotmax-24*60*60)*1000)});
        datePicker.setDate(focusOldText, true);
        var floating = d3.select('.floating');
        var bbox = this.getBoundingClientRect();
        floating.style('left', bbox.left+"px").style('top', (bbox.bottom+3)+"px");
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
        .style('color', 'var(--col-tbltxt-disabled)').attr('contenteditable', false);  
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
        .style('color', 'var(--col-tbltxt)').attr('contenteditable', true);  
    d3.select('.rtable [name=endvalue'+i+']')
        .style('color', 'var(--col-tbltxt-disabled)').attr('contenteditable', false);  
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
        .style('color', 'var(--col-tbltxt-disabled)').attr('contenteditable', false);  
    d3.select('.rtable [name=btndate'+i+']').property('checked', false);  
    d3.select('.rtable [name=btnvalue'+i+']').property('checked', false);  
    d3.select('.rtable [name=btnslope'+i+']').property('checked', true);  
}

function updateTableButtons() {
    var allrows = d3.selectAll(".rtable .startrow, .rtable .roadrow");
    var btncells = allrows.selectAll(".roadbtn")
            .data(function(row, i) {
                return [
                    {order: -1, row:i, name: "btndel"+i, evt: function() {removeKnot(i, false);}, 
                     type: 'button', txt: 'del', auto: false},
                    {order: 3, row:i, name: "btndate"+i, evt: function() {disableDate(i);}, 
                     type: 'checkbox', txt: 'r', auto: (row.auto==RoadParamEnum.DATE)},
                    {order: 5, row:i, name: "btnvalue"+i, evt: function() {disableValue(i);}, 
                     type: 'checkbox', txt: 'r', auto: (row.auto==RoadParamEnum.VALUE)},
                    {order: 7, row:i, name: "btnslope"+i, evt: function() {disableSlope(i);}, 
                     type: 'checkbox', txt: 'r', auto: (row.auto==RoadParamEnum.SLOPE)},
                    {order: 8, row:i, name: "btnadd"+i, evt: function() {addNewKnot(i+1);}, 
                     type: 'button', txt: 'ins', auto: false},
];
            });
    
    var newbtncells = btncells.enter().append("input").attr('class', 'roadbtn')
            .attr('type',function(d) {return d.type;})
            .attr('id', function(d) { return d.row;})
            .attr('value', function(d) { return d.txt;})
            .attr('name', function(d) { return d.name;})
            .on('click', function (d) {d.evt();});

    btncells.exit().remove();
    btncells = allrows.selectAll(".rtable .roadbtn");
    btncells
        .style('visibility', function(d,i) {
            return ((Number(d.row)>0 && Number(d.row)<(roads.length-2)) 
                || i==4 
                || (i>0 && Number(d.row)>0 ))?"visible":"hidden";
        })
        .property('checked', function(d) { return d.auto?true:false;});

    allrows.selectAll(".roadcell, .roadbtn, .startcell").sort(function(a,b) {return a.order > b.order;});
}

function updateTableValues() {

    //console.debug("updateTableValues()");
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
                var datestr = dayify(row.end[0], false, '-');
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
    
    var rows = tbody.selectAll(".roadrow")
            .data(roads.slice(1,roads.length-1));
    rows.enter().append("div").attr('class', 'roadrow')
        .attr("name", function(d,i) { return 'roadrow'+(i+1);})
        .attr("id", function(d,i) { return (i+1);});
    rows.exit().remove();
    rows.order();
    rows = tbody.selectAll(".roadrow");

    var cells = rows.selectAll(".roadcell")
            .data(function(row, i) {
                var datestr = dayify(row.end[0], false, '-');
                return [
                    {order: 2, value: datestr, name: "enddate"+(i+1), 
                     auto: (row.auto==RoadParamEnum.DATE)},
                    {order: 4, value: row.end[1].toPrecision(5), name: "endvalue"+(i+1), 
                     auto: (row.auto==RoadParamEnum.VALUE)},
                    {order: 6, value: (row.slope*24*60*60).toPrecision(5), name: "slope"+(i+1), 
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
        .style('color', function(d) {
            return d.auto?'var(--col-tbltxt-disabled)':'var(--col-tbltxt)';})
        .attr("contenteditable", function(d,i) { return (d.auto)?'false':'true';});

}

function updateTable() {
    updateTableValues();
    updateTableButtons();
}

function updateAllData() {
    updatePinkRegion();
    updateOldRoad();
    updateKnots();
    updateRoads();
    updateDots();
    updateHorizon();
    updatePastBox();
    updateTable();
}


// Reset button restores zooming transformation to identity
function zoomOut() {
    computeRoadExtent(true);
    xFactor = 1; yFactor = 1;
    xScale.domain([new Date(xMinNow*1000), new Date(xMax*1000)])
        .range([0,plotsize.width]);
    yScale.domain([yMin, yMax])
        .range([plotsize.height, 0]);
    newXScale = xScale; newYScale = yScale;
    axisZoom.scaleExtent([1, Infinity])
        .extent([[0, 0], [plotsize.width, plotsize.height]])
        .translateExtent([[0, 0], [plotsize.width, plotsize.height]]);
    zoomarea.call(axisZoom.transform, d3.zoomIdentity);
    updateAllData();
}
d3.select("button#zoomout").on("click", zoomOut);

// Reset button restores zooming transformation to identity
function zoomAll() {
    computeRoadExtent(true);
    xFactor = 1; yFactor = 1;
    xScale.domain([new Date(xMin*1000), new Date(xMax*1000)])
        .range([0,plotsize.width]);
    yScale.domain([yMin, yMax])
        .range([plotsize.height, 0]);
    newXScale = xScale; newYScale = yScale;
    axisZoom.scaleExtent([1, Infinity])
        .extent([[0, 0], [plotsize.width, plotsize.height]])
        .translateExtent([[0, 0], [plotsize.width, plotsize.height]]);
    zoomarea.call(axisZoom.transform, d3.zoomIdentity);
    updateAllData();
}
d3.select("button#zoomall").on("click", zoomAll);

// Reset button restores zooming transformation to identity
function resetRoad() {
    roads = copyRoad( initialRoad );
    clearUndoBuffer();
    if (!opts.editpast) addNewDot(hordate.getTime()/1000);
    zoomOut();
}
d3.select("button#resetroad").on("click", resetRoad);

d3.select("button#undo").attr('disabled', 'true').on("click", undoLastEdit);

if (!opts.editpast) addNewDot(hordate.getTime()/1000);
updateAllData();

// --------------------------------- 80chars ---------------------------------->
