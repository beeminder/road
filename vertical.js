
margin = {top: 20, right: 250, bottom: 100, left: 60}
		, width = 1210 - margin.left - margin.right
		, height = 600 - margin.top - margin.bottom;
knots = [[0.05,0,1,0], [0.1,0,0,0], [0.5,0,1,0], [0.9,0,0,0], [0.95,0,1,0]];

var chart = d3.select('.content')
	.append('svg:svg')
	.attr('width', width + margin.right + margin.left)
	.attr('height', height + margin.top + margin.bottom)
	.attr('class', 'chart');

var main = chart.append('g')
	.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
	.attr('width', width)
	.attr('height', height)
	.attr('class', 'main');  

main.append("clipPath")
    .attr("id", "clipper")
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height);

var knots_svg = main.append("svg:g")
        .attr("clip-path", "url(#clipper)");


var knotdrag = d3.behavior.drag()
		.on("dragstart", function() {
			d3.event.sourceEvent.stopPropagation();
			knotindex =  Number(this.id);
			knotmin = (knotindex == 0) ? 0 : (knots[knotindex-1][0]) + 0.01;
			knotmax = (knotindex == knots.length-1) ? 1:(knots[knotindex+1][0])-0.01;
            knotsave = knots.map(function(arr){return arr.slice();});
		})
		
		.on("drag", function(){
			var x = d3.event.x;
			if (inrange(x/width, knotmin, knotmax)) {
                d3.select(this).attr("stroke","rgb(255,180,0)");
                i = knotindex;
                //for (i = knotindex; i < knots.length; i++) {
				    knots[i][0] = knotsave[i][0] + x/width - knotsave[knotindex][0];
                //}
                filterknots();
                for (i = 0; i < knots.length; i++) {
			        d3.select("[name=knot"+i+"]")
				        .attr("x1", width*knots[i][0])
				        .attr("x2", width*knots[i][0]);
			        d3.select("[name=dot"+i+"]")
				        .attr("cx", width*knots[i][0])
				        .attr("cy", height*knots[i][1]);
			        d3.select("[name=road"+i+"]")
				        .attr("x1", width*knots[i][0])
				        .attr("x2", width*knots[i][3])
				        .attr("y1", height*knots[i][1])
				        .attr("y2", height*knots[i][4]);
                }
                drawknots();
                drawdots();
                drawend();
			}
		})
    
		.on("dragend", function(){
			d3.select(this)
				.attr("stroke","rgb(100,100,100)");
		});

var dotdrag = d3.behavior.drag()
		.on("dragstart", function() {
			d3.event.sourceEvent.stopPropagation();
			knotindex =  Number(this.id);
            knotsave = knots.map(function(arr){return arr.slice();});
		})
		
		.on("drag", function(){
			var y = d3.event.y;

			if (inrange(y/height, 0, 1)) {
                d3.select(this).attr("stroke","rgb(255,180,0)");
                for (i = knotindex; i < knots.length; i++) {
				    knots[i][1] = knotsave[i][1]+y/height - knotsave[knotindex][1];
                    if (i > 0) {
                        knots[i-1][2] = (knots[i][1] - knots[i-1][1]) / (knots[i][0] - knots[i-1][0]);
                    }
                }
                filterknots();
                for (i = 0; i < knots.length; i++) {
			        d3.select("[name=dot"+i+"]")
				        .attr("cx", width*knots[i][0])
				        .attr("cy", height*knots[i][1]);
			        d3.select("[name=road"+i+"]")
				        .attr("x1", width*knots[i][0])
				        .attr("x2", width*knots[i][3])
				        .attr("y1", height*knots[i][1])
				        .attr("y2", height*knots[i][4]);
                }
                drawknots();
                drawdots();
                drawend();
            }
		})
    
		.on("dragend", function(){
			d3.select(this)
				.attr("stroke","rgb(255,0,0)");
		});

var enddrag = d3.behavior.drag()
		.on("dragstart", function() {
			d3.event.sourceEvent.stopPropagation();
		})
		
		.on("drag", function(){
			var y = d3.event.y;
			if (inrange(y/height, 0, 1)) {
			    knots[lastknot][2] = (y/height - knots[lastknot][1])/(1.0 - knots[lastknot][0]);
			    d3.select("circle.enddot")
				    .attr("cy", y);
                filterknots();
			    d3.select("[name=road"+lastknot+"]")
				    .attr("x1", width*knots[lastknot][0])
				    .attr("x2", width*knots[lastknot][3])
				    .attr("y1", height*knots[lastknot][1])
				    .attr("y2", height*knots[lastknot][4]);
            }
		})
    
		.on("dragend", function(){});

filterknots();
drawknots();
drawdots();
drawend();

function filterknots() {

    for (var i = 0; i < knots.length-1; i++) {
        knots[i+1][1] = knots[i][1]+knots[i][2]*(knots[i+1][0] - knots[i][0]);
        knots[i][3] = knots[i+1][0];
        knots[i][4] = knots[i+1][1];
    }
    knots[knots.length-1][3] = 1;
    knots[knots.length-1][4] = knots[knots.length-1][1] + knots[knots.length-1][2]*(1 - knots[knots.length-1][0]);

    newknots = [];
    lastknot = 0;
    for (i = 0; i < knots.length; i++) {
        if (knots[i][0] < 1) {
            newknots.push(knots[i]);
            lastknot = i;
        } else break;
    }
    newknots[newknots.length-1][3] = 1;
    newknots[newknots.length-1][4] = newknots[newknots.length-1][1] + newknots[newknots.length-1][2]*(1 - newknots[newknots.length-1][0]);
}

function inrange(x, min, max) {
  return x >= min && x <= max;
}

function drawend(){

    knots_svg.selectAll("circle.enddot").remove();
    knots_svg.append("svg:circle")
		.attr("class","enddot")
		.attr("cx", width)
		.attr("cy",height*newknots[newknots.length-1][4])
		.attr("stroke", "rgb(0,255,0)") 
		.style("fill", "rgb(0,255,0)") 
		.attr("r",5)
		.call(enddrag);


}

function drawdots(){

    kn = knots_svg.selectAll("line.roads").data(newknots);
    kn.exit().remove();
    kn.enter().append("svg:line")
		.attr("class","roads")
		.attr("y1",function(d){ return (d[1]*height)})
		.attr("y2",function(d){ return (d[4]*height)})
		.attr("x1", function(d){ return (d[0]*width)})
		.attr("x2", function(d){ return (d[3]*width)})
		.attr("stroke", "rgb(100,100,100)") 
		.attr("stroke-width",2)
		.attr("id", function(d,i) {return i;})
		.attr("name", function(d,i) {return "road"+i;});

    kn = knots_svg.selectAll("circle.dots").data(newknots);
    kn.exit().remove();
    kn.enter().append("svg:circle")
		.attr("class","dots")
		.attr("cy",function(d){ return (d[1]*height)})
		.attr("cx", function(d){ return (d[0]*width)})
		.attr("stroke", "rgb(255,0,0)") 
		.style("fill", "rgb(255,0,0)") 
		.attr("r",5)
		.attr("id", function(d,i) {return i;})
		.attr("name", function(d,i) {return "dot"+i;})
		.call(dotdrag);


}

function drawknots(){

    kn = knots_svg.selectAll("line.knots").data(newknots);
    kn.exit().remove();
    kn.enter().append("svg:line")
		.attr("class","knots")
		.attr("y1",0)
		.attr("y2",height)
		.attr("x1", function(d){ return (d[0]*width)})
		.attr("x2", function(d){ return (d[0]*width)})
		.attr("stroke", "rgb(100,100,100)") 
		.attr("stroke-width",2)
		.attr("id", function(d,i) {return i;})
		.attr("name", function(d,i) {return "knot"+i;})
		.on("mouseover",function() {
			d3.select(this).attr("stroke-width",5);})
		.on("mouseout",function() {
			d3.select(this).attr("stroke-width",2);})
		.call(knotdrag);
}

	


