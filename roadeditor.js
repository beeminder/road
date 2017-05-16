
var size = {width: 1000, height:400};
var padding = {left:40, right:10, top:10, bottom:30};

var knots = [[0.05,0,1,0], [0.1,0,0,0], [0.5,0,1,0], [0.9,0,0,0], [0.95,0,1,0]];
var curScale = 1;
var curTranslate = [0, 0];

function updateZoom() {
    xAxisObj.call(xAxis);
    yAxisObj.call(yAxis);
    axisZoom = d3.behavior.zoom()
        .x(xScale)
        .y(yScale)
        .on("zoom", updateAll);
    chart.call(axisZoom);
    curScale = curScale * d3.event.scale;
    curTranslate[0] = curTranslate[0] + d3.event.translate[0];
    curTranslate[1] = curTranslate[1] + d3.event.translate[1];
    plot.attr("transform", "translate(" + curTranslate + ") scale(" + curScale + ")");
}

function updateAll() {
    updateZoom();
}

// Create and initialize the SVG chart object when the script is loaded
var chart = d3.select('.content')
	.append('svg:svg')
	.attr('width', size.width)
	.attr('height', size.height)
	.attr('id', 'svg_chart')
	.attr('class', 'chart');
chart.append('def').append("clipPath")
    .attr("id", "clipper")
    .append("rect")
    .attr("x", padding.left)
    .attr("y", padding.right)
    .attr("width", size.width-padding.left-padding.right)
    .attr("height", size.height-padding.top-padding.bottom);

var xScale = d3.scale.linear()
        .domain([0, 10])
        .range([padding.left,size.width-padding.right]);
var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient("bottom");
var xAxisObj = chart.append('g')        
        .attr("class", "axis")
        .attr("transform", "translate(0," + (size.height - padding.bottom) + ")")
        .call(xAxis);
var yScale = d3.scale.linear()
        .domain([0, 10])
        .range([size.height-padding.bottom, padding.top]);
var yAxis = d3.svg.axis()
        .scale(yScale)
        .orient("left");
var yAxisObj = chart.append('g')        
        .attr("class", "axis")
        .attr("transform", "translate(" + padding.left + ",0)")
        .call(yAxis);

var axisZoom = d3.behavior.zoom()
        .x(xScale)
        .y(yScale)
        .on("zoom", updateAll);
chart.call(axisZoom);


var main = chart.append('g')
	    .attr('class', 'main')
        .attr('clip-path', 'url(#clipper)');
var plot = main.append('g');


// -----------------------------------------------------------------
// Generation code for a test SVG including all components
plot.append("svg:circle")
	.attr("class","enddot")
	.attr("cx", xScale(1))
	.attr("cy", yScale(1))
	.attr("stroke", "rgb(0,255,0)") 
	.style("fill", "rgb(0,255,0)") 
	.attr("r",5);
plot.append("svg:circle")
	.attr("class","enddot")
	.attr("cx", xScale(9))
	.attr("cy", yScale(1))
	.attr("stroke", "rgb(0,255,0)") 
	.style("fill", "rgb(0,255,0)") 
	.attr("r",5);
plot.append("svg:circle")
	.attr("class","enddot")
	.attr("cx", xScale(1))
	.attr("cy", yScale(9))
	.attr("stroke", "rgb(0,255,0)") 
	.style("fill", "rgb(0,255,0)") 
	.attr("r",5);

