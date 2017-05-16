
var size = {width: 1000, height:400};
var padding = {left:40, right:10, top:10, bottom:30};

var data = [[1,1], [1,9], [9,1], [9,9]];
var knots = [[0.05,0,1,0], [0.1,0,0,0], [0.5,0,1,0], [0.9,0,0,0], [0.95,0,1,0]];

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

var xScale = d3.scaleLinear()
        .domain([0, 10])
        .range([padding.left,size.width-padding.right]);
var xAxis = d3.axisBottom(xScale);
var xAxisObj = chart.append('g')        
        .attr("class", "axis")
        .attr("transform", "translate(0," + (size.height - padding.bottom) + ")")
        .call(xAxis);
var yScale = d3.scaleLinear()
        .domain([0, 10])
        .range([size.height-padding.bottom, padding.top]);
var yAxis = d3.axisLeft(yScale);
var yAxisObj = chart.append('g')        
        .attr("class", "axis")
        .attr("transform", "translate(" + padding.left + ",0)")
        .call(yAxis);

var main = chart.append('g')
	    .attr('class', 'main')
        .attr('clip-path', 'url(#clipper)');
var plot = main.append('g');

var xFactor = 1;
var yFactor = 1;

function updateZoom() {
    plot.attr("transform", d3.event.transform);
    xAxisObj.call(xAxis.scale(d3.event.transform.rescaleX(xScale)));
    yAxisObj.call(yAxis.scale(d3.event.transform.rescaleY(yScale)));
    xFactor = d3.event.transform.applyX(1) - d3.event.transform.applyX(0);
    yFactor = d3.event.transform.applyY(1) - d3.event.transform.applyY(0);
    plot.selectAll("ellipse").attr("rx",5/xFactor).attr("ry",5/yFactor);
}

function updateData() {
    var points = plot.selectAll("ellipse").data(data);    

    points.attr("rx", 5/xFactor).attr("ry", 5/yFactor);

    points.enter().append("svg:ellipse")
	             .attr("class","enddot")
	             .attr("cx", function(d, i) { return xScale(d[0]); })
	             .attr("cy", function(d, i) { return yScale(d[1]); })
	             .attr("stroke", "rgb(0,255,0)") 
	             .style("fill", "rgb(0,255,0)") 
	             .attr("rx",5/xFactor)
	             .attr("ry",5/yFactor);
    
    points.exit().remove();
}

var axisZoom = d3.zoom().on("zoom", updateZoom);
chart.call(axisZoom);

function updateAll() {
    updateZoom();
    updateData();
}

updateData();

self.setInterval(function() {data.push([10*Math.random(), 10*Math.random()]); updateData();}, 1000);
