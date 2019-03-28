This tutorial describes the details and usage of the {@link bgraph}
class provided as part of the Beeminder Javascript implementation.

The {@link module:bgraph bgraph module} and the associated {@link
bgraph bgraph class} allows programmers to create beeminder graph and
road table objects rendered within particular div objects within a web
page. Assuming that the required modules (d3, moment, polyfit,
pikaday, butil, broad, beebrain) are preloaded, the following code
illustrates the most basic usage

```javascript
  var graph = new bgraph({divGraph: document.getElementById('graph'),
                          svgSize: { width: 800, height: 600 },
                          focusRect: { x:0, y:0, width:800, height: 453 },
                          ctxRect: { x:0, y:453, width:800, height: 100 },
                          showFocusRect: true,
                          showContext: true})
  graph.loadGoal( "/path/slug.bb" )
```

This creates an interactive svg element within the supplied div
element, containing all graph components. These include the graph
itself and a "context" graph that shows the entire range of the goal
for the above example.  It is important that you specify the width and
height styles of the div element that will contain the graph with

```html
<div id="graph" style="width:800px; height:600px"></div>
```

