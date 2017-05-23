
var size = {width: 1000, height:400};
var padding = {left:40, right:10, top:30, bottom:30};
var plotsize = {width: size.width-padding.left-padding.right, height: size.height-padding.top-padding.bottom};

// rawknots includes the start date and value, subsequent date/value
// pairs, and the last entry is the goal date and value
var rawknots = [[1441606400,0], [1454284800,2], [1457284800,5], [1460284800,0], [1563284800,-100]];
// knots array is initialized and updated by us. Each entry encodes a
// segment of the road in the form [startdate, startvalue, enddate,
// endvalue, slope]. The first and last entries encode flat segments
// at the beginning and end of the overall road.
var roads;
function initializeRoadArray() {
    roads = [];
    var nk = rawknots.length - 1;
    for (var i = 0; i < nk; i++) {
        var segment = {};
        segment.slope = (rawknots[i+1][1] - rawknots[i][1]) 
                / (rawknots[i+1][0] - rawknots[i][0]);
        segment.sta = rawknots[i].slice();
        segment.end = rawknots[i+1].slice();
        roads.push(segment);
    }
    var firstsegment = {};
    firstsegment.sta = roads[0].sta.slice();
    firstsegment.end = roads[0].sta.slice();
    firstsegment.sta[0] -= 10*365*24*60*60;
    firstsegment.slope = 0;

    var lastsegment = {};
    lastsegment.sta = roads[nk-1].end.slice();
    lastsegment.end = roads[nk-1].end.slice();
    lastsegment.end[0] += 10*365*24*60*60;
    firstsegment.slope = 0;
    roads.push(lastsegment);
    roads.unshift(firstsegment);
}
initializeRoadArray();

// Create and initialize the SVG chart and its components
var chart = d3.select('.content')
	.append('svg:svg')
	.attr('width', size.width)
	.attr('height', size.height)
	.attr('id', 'roadchart')
	.attr('class', 'chart');
// Common SVG definitions, including clip paths
var defs = chart.append('defs');
defs.append("svg:clipPath")
    .attr("id", "plotclip")
    .append("svg:rect")
    .attr("id", "plotclip-rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", plotsize.width)
    .attr("height", plotsize.height);
defs.append("svg:clipPath")
    .attr("id", "buttonareaclip")
    .append("svg:rect")
    .attr("x", padding.left)
    .attr("y", 0)
    .attr("width", plotsize.width)
    .attr("height", plotsize.height);
var buttongrp = defs.append("g")
        .attr("id", "removebutton");
buttongrp.append("rect")
    .attr("id", "removebutton-rect")
    .attr("x", 0).attr("y", 0)
    .attr("width", 30).attr("height", 30).attr('fill', '#ffffff');
buttongrp.append("path")
    .attr("id", "removebutton-path")
    .attr("d", "M13.98,0C6.259,0,0,6.261,0,13.983c0,7.721,6.259,13.982,13.98,13.982c7.725,0,13.985-6.262,13.985-13.982C27.965,6.261,21.705,0,13.98,0z M19.992,17.769l-2.227,2.224c0,0-3.523-3.78-3.786-3.78c-0.259,0-3.783,3.78-3.783,3.78l-2.228-2.224c0,0,3.784-3.472,3.784-3.781c0-0.314-3.784-3.787-3.784-3.787l2.228-2.229c0,0,3.553,3.782,3.783,3.782c0.232,0,3.786-3.782,3.786-3.782l2.227,2.229c0,0-3.785,3.523-3.785,3.787C16.207,14.239,19.992,17.769,19.992,17.769z");

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
    var found = -1;
    var x = d3.event.x-padding.left;
    var y = d3.event.y-padding.top;
    if (d3.event.shiftKey) {
        console.debug([x, y]);
        for (var i = 0; i < roads.length; i++) {
            if ((x > newXScale(roads[i].sta[0]*1000)) 
                && (x < newXScale(roads[i].end[0]*1000))) {
                found = i;
                break;
            }
        }
        
    }
    if (found >= 0) {
        var segment = {};
        var newx = newXScale.invert(x)/1000;
        var newy = roads[found].sta[1] + roads[found].slope*(newx - roads[found].sta[0]);
        console.debug("Found at "+found);
        if (found == 0) {
            // First segment splitted
            roads[found].sta[1] = newy;
            roads[found].end = [newx, newy];
            segment.sta = roads[found].end.slice();
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
            roads[found].end = segment.sta.slice();
            roads[found].slope =
                (roads[found].end[1] - roads[found].sta[1]) 
                / (roads[found].end[0] - roads[found].sta[0]);
        }
        segment.slope =
            (segment.end[1] - segment.sta[1]) 
            / (segment.end[0] - segment.sta[0]);
        roads.splice(i+1, 0, segment);
        recomputeRoadArray();
        recomputeDataLimits();
        updateAllData();
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

// Define and compute limits of current data
var xMin=Infinity,xMax=-Infinity;
var yMin=Infinity,yMax=-Infinity;

function recomputeDataLimits(allowShrink = false) {
    var firstRun = !Number.isFinite(xMin);

    // Save old limits so we can figure out how much to extend scale
    // extent for zoom
    var xMinOld = xMin, xMaxOld = xMax;
    var yMinOld = yMin, yMaxOld = yMax;

    // Compute new limits for the current data
    xMin = d3.min(roads, function(d) { return d.end[0]; });
    xMax = d3.max(roads, function(d) { return d.sta[0]; });
    yMin = d3.min(roads, function(d) { return d.sta[1]; });
    yMax = d3.max(roads, function(d) { return d.sta[1]; });
    // Extend limits by 5% so everything is visible
    xMin = xMin - 0.05*(xMax - xMin);
    xMax = xMax + 0.15*(xMax - xMin);
    yMin = yMin - 0.05*(yMax - yMin);
    yMax = yMax + 0.05*(yMax - yMin);

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
recomputeDataLimits( );

// Create and initialize the x and y axes
var xScale = d3.scaleTime()
        .domain([new Date(xMin*1000), new Date(xMax*1000)])
        .range([0,plotsize.width]);
var xAxis = d3.axisBottom(xScale).ticks(6);
var xAxisObj = chart.append('g')        
        .attr("class", "axis")
        .attr("transform", "translate("+padding.left+"," + (size.height - padding.bottom) + ")")
        .call(xAxis);
var yScale = d3.scaleLinear()
        .domain([yMin, yMax])
        .range([plotsize.height, 0]);
var yAxis = d3.axisLeft(yScale);
var yAxisObj = chart.append('g')        
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
    plot.selectAll(".roads").style("stroke-width",2/xFactor);
    plot.selectAll(".knots").style("stroke-width",3/xFactor);
    plot.selectAll(".dots").attr("r",5/xFactor);
    plot.selectAll(".dots").style("stroke-width",1/xFactor);
    buttonarea.selectAll(".remove").attr("transform", 
                 function(d){ return "translate("+(newXScale(d.sta[0]*1000)
                                                   +padding.left-8)
                           +","+(padding.top-20)+") scale(0.6,0.6)";});
}

function recomputeRoadArray() {
    var nr = roads.length;
    for (var i = 0; i < nr-1; i++) {
        roads[i+1].sta[1] = 
            roads[i].sta[1]+roads[i].slope*(roads[i+1].sta[0]-roads[i].sta[0]);
        roads[i].end[0] = roads[i+1].sta[0];
        roads[i].end[1] = roads[i+1].sta[1];
    }
    roads[nr-1].end[1] = roads[nr-1].sta[1];
}

function inrange(x, min, max) {
  return x >= min && x <= max;
}

var roadsave, knotmin, knotmax;
function saveRoad() {
    roadsave = [];
    for (var i = 0; i < roads.length; i++) {
        var segment = {};
        segment.sta = roads[i].sta.slice();
        segment.end = roads[i].sta.slice();
        segment.slope = roads[i].slope;
        roadsave.push(segment);
    }
}
function knotDragStarted(d) {
	d3.event.sourceEvent.stopPropagation();
    var kind = Number(this.id);
	knotmin = (kind == 0) ? xMin : (roads[kind-1].sta[0]) + 0.01;
	knotmax = 
        (kind == roads.length-1) 
        ? roads[kind].end[0]-0.01
        :(roads[kind+1].sta[0]-0.01);
    saveRoad();
};
function knotDragged(d) {
	var x = d3.event.x;
	if (inrange(xScale.invert(x)/1000, knotmin, knotmax)) {
        //d3.select(this).attr("stroke","rgb(255,180,0)");
        var kind = Number(this.id);
        var i = kind;
        //for (i = knotindex; i < knots.length; i++) {
	    roads[i].sta[0] = roadsave[i].sta[0] + xScale.invert(x)/1000 
            - roadsave[kind].sta[0];
        //}
        recomputeRoadArray();
        for (i = 0; i < roads.length; i++) {
		    d3.select("[name=knot"+i+"]")
			    .attr("x1", xScale(roads[i].sta[0]*1000))
			    .attr("x2", xScale(roads[i].sta[0]*1000));
		    d3.select("[name=dot"+i+"]")
			    .attr("cx", xScale(roads[i].sta[0]*1000))
			    .attr("cy", yScale(roads[i].sta[1]));
		    d3.select("[name=road"+i+"]")
			    .attr("x1", xScale(roads[i].sta[0]*1000))
			    .attr("y1", yScale(roads[i].sta[1]))
			    .attr("x2", xScale(roads[i].end[0]*1000))
			    .attr("y2", yScale(roads[i].end[1]));
		    d3.select("[name=remove"+i+"]")
                .attr("transform", 
                      function(d){ 
                          return "translate("+(newXScale(d.sta[0]*1000)
                                               +padding.left-8)
                              +","+(padding.top-20)+") scale(0.6,0.6)";
                      });
        }
    }
};
function knotDragEnded(d){
	// d3.select(this).attr("stroke","rgb(200,200,200)");
    recomputeDataLimits();
    updateAllData();
};

function knotDeleted(d) {
    var kind = Number(this.id)+2;
    roads.splice(kind, 1);
    if (kind > 1) {
        roads[kind-1].slope = 
            (roads[kind].sta[1] - roads[kind-1].sta[1]) 
            / (roads[kind].sta[0] - roads[kind-1].sta[0]);
    }
    recomputeRoadArray();
    recomputeDataLimits();
    updateAllData();
}

function dotDragStarted(d) {
	d3.event.sourceEvent.stopPropagation();
    saveRoad();
};
function dotDragged(d) {
	var y = d3.event.y;
    console.debug(y);
	if (inrange(y, 0, plotsize.height)) {
        //d3.select(this).attr("stroke","rgb(255,180,0)");
        var kind = Number(this.id);
	    roads[kind].sta[1] = yScale.invert(y);
        if (kind == 1) {
	        roads[kind-1].sta[1] = yScale.invert(y);
        } if (kind == roads.length-1) {
	        roads[kind].end[1] = yScale.invert(y);
	        roads[kind-1].slope = 
                (roads[kind].sta[1] - roads[kind-1].sta[1])
                / (roads[kind].sta[0] - roads[kind-1].sta[0]);
        } else {
	        roads[kind-1].slope = 
                (roads[kind].sta[1] - roads[kind-1].sta[1])
                / (roads[kind].sta[0] - roads[kind-1].sta[0]);
        }
        recomputeRoadArray();
        for (i = 0; i < roads.length; i++) {
		    d3.select("[name=dot"+i+"]")
			    .attr("cx", xScale(roads[i].sta[0]*1000))
			    .attr("cy", yScale(roads[i].sta[1]));
		    d3.select("[name=road"+i+"]")
			    .attr("x1", xScale(roads[i].sta[0]*1000))
			    .attr("y1", yScale(roads[i].sta[1]))
			    .attr("x2", xScale(roads[i].end[0]*1000))
			    .attr("y2", yScale(roads[i].end[1]));
        }
    }
};
function dotDragEnded(d){
	//d3.select(this).attr("stroke","rgb(200,200,200)");
    recomputeDataLimits();
    updateAllData();
};

function updateAllData() {

    // Create, update and delete vertical knot lines
    var knotelt = plot.selectAll(".knots").data(roads);
    knotelt.exit().remove();
    knotelt
        .attr("y1",yScale(yMin - 10*(yMax-yMin)))
		.attr("y2",yScale(yMax + 10*(yMax-yMin)))
		.attr("x1", function(d){ return xScale(d.sta[0]*1000);})
		.attr("x2", function(d){ return xScale(d.sta[0]*1000);});
    knotelt.enter().append("svg:line")
		.attr("class","knots")
		.attr("y1",yScale(yMin))
		.attr("y2",yScale(yMax))
		.attr("x1", function(d){ return xScale(d.sta[0]*1000);})
		.attr("x2", function(d){ return xScale(d.sta[0]*1000);})
		.attr("stroke", "rgb(200,200,200)") 
		.style("stroke-width",3/xFactor)
		.attr("id", function(d,i) {return i;})
		.attr("name", function(d,i) {return "knot"+i;})
		.on("mouseover",function() {
			d3.select(this).style("stroke-width",6/xFactor);})
		.on("mouseout",function() {
			d3.select(this).style("stroke-width",3/xFactor);})
        .call(d3.drag()
              .on("start", knotDragStarted)
              .on("drag", knotDragged)
              .on("end", knotDragEnded));

    var knotrmelt = 
            buttonarea.selectAll(".remove").
            data(roads.slice(2,roads.length-1));
    knotrmelt.exit().remove();
    knotrmelt
        .attr("transform", 
              function(d){ 
                  return "translate("+(newXScale(d.sta[0]*1000)+padding.left-8)
                      +","+(padding.top-20)+") scale(0.6,0.6)";
              });
    knotrmelt.enter()
        .append("use")
        .attr("xlink:href", "#removebutton")
        .attr("class", "remove")
		.attr("id", function(d,i) {return i;})
		.attr("name", function(d,i) {return "remove"+i;})
        .attr("transform", 
              function(d){ 
                  return "translate("+(newXScale(d.sta[0]*1000)+padding.left-8)
                      +","+(padding.top-20)+") scale(0.6,0.6)";
              })
		.on("mouseenter",function() {
			d3.select(this).attr("fill","#ff0000");})
		.on("mouseout",function() {
			d3.select(this).attr("fill","#000000");})
		.on("click",knotDeleted);

    // Create, update and delete road lines
    var roadelt = plot.selectAll(".roads").data(roads);
    roadelt.exit().remove();
    roadelt
		.attr("x1", function(d){ return xScale(d.sta[0]*1000);})
        .attr("y1",function(d){ return yScale(d.sta[1]);})
		.attr("x2", function(d){ return xScale(d.end[0]*1000);})
		.attr("y2",function(d){ return yScale(d.end[1]);})
		.style("stroke-width",2/xFactor);
    roadelt.enter()
        .append("svg:line")
		.attr("class","roads")
		.attr("x1", function(d){ return xScale(d.sta[0]*1000);})
		.attr("y1",function(d){ return yScale(d.sta[1]);})
		.attr("x2", function(d){ return xScale(d.end[0]*1000);})
		.attr("y2",function(d){ return yScale(d.end[1]);})
		.style("stroke-width",2/xFactor)
		.attr("id", function(d,i) {return i;})
		.attr("name", function(d,i) {return "road"+i;});

    // Create, update and delete inflection points
    var dotelt = plot.selectAll(".dots").data(roads);
    dotelt.exit().remove();
    dotelt
		.attr("cx", function(d){ return xScale(d.sta[0]*1000);})
        .attr("cy",function(d){ return yScale(d.sta[1]);})
		.attr("stroke-width", 1/xFactor);
    dotelt.enter().append("svg:circle")
		.attr("class","dots")
		.attr("cx", function(d){ return xScale(d.sta[0]*1000);})
		.attr("cy",function(d){ return yScale(d.sta[1]);})
		.style("stroke-width", 1/xFactor) 
		.attr("r",5/xFactor)
		.attr("id", function(d,i) {return i;})
		.attr("name", function(d,i) {return "dot"+i;})
		.on("mouseover",function() {
			d3.select(this).style("fill","#00ff00");})
		.on("mouseout",function() {
			d3.select(this).style("fill","red");})
        .call(d3.drag()
              .on("start", dotDragStarted)
              .on("drag", dotDragged)
              .on("end", dotDragEnded));

}

// Reset button restores zooming transformation to identity
function zoomOut() {
    recomputeDataLimits(true);
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
d3.select("button#zoomout").on("click", zoomOut);

// Reset button restores zooming transformation to identity
function resetRoad() {
    initializeRoadArray();
    zoomOut();
}
d3.select("button#resetroad").on("click", resetRoad);

updateAllData();

//self.setInterval(function() {data.push([10*Math.random(), 10*Math.random()]); updateAllData();}, 100);
