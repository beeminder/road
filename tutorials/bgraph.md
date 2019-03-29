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

The {@link bgraph bgraph constructor} accepts an options argument with
type {@link BGraphOptions}, whose components control the behavior of
the generated graph. In particular, the **divGraph**, **divJSON** and
**divTable** options specify container div elements for the graph,
goal json output and a road matrix table, respectively. A page with
all three features enabled would look like the following image:

<center><img src="graph_example.png"></center>


## Internals

### Structure of the SVG element hosting the graph

<pre>
svg: top element
  defs: Definitions references from the graph
    style: Overall style components for the SVG to support standalone loading
    clipPath (id=plotclip): Path for clipping the plot area
    clipPath (id=brushclip): Path for clipping the context plot
    clipPath (id=buttonAreaclip): Path for clipping knot removal buttons
    path (id=rightarrow): Right arrow shape (flatlined datapoint)
    path (id=downtarrow): Down arrow shape (derailment for yaw>0)
    path (id=uparrow): Up arrow shape (derailment for yaw<0)
    g (id=removebutton): Removal button shape
    g (id=zoominbtn): Zoom-in button shape
    g (id=zoomoutbtn): Zoom-out button shape
  rect (class=zoomarea):
  g (class=focus): Top container for the main graph
    text: Shows 'stathead' form the goal when enabled
    g (clippath=buttonareaclip): Clipping container for knot removal buttons (roadeditor)
      use (class=remove): Removal button instance for each know
      ...
    g (clippath=plotclip): Clipping container for the main plot
      g (class=plot): Container for all plot components
        g (class=pastboxgrp)
          rect (class=past): Shaded box ending at asof to show past dates (roadeditor)
        g (class=ybhpgrp)
          path (class=halfplane): Yellow brick half plane (roadeditor)
        g (class=auragrp):
        g (class=wmarkgrp):
        g (class=oldguidegrp):
        g (class=oldroadgrp):
        g (class=pinkgrp):
        g (class=oldbullseyegrp:
        g (class=oldcentergrp):
        g (class=grid):
          g (class=grid): vertical grid lines
        g (class=oresetgrp):
        g (class=knotgrp):
        g (class=steppygrp):
        g (class=rosygrp):
        g (class=rosyptsgrp):
        g (class=derailsgrp):
        g (class=allptsgrp):
        g (class=movingavgrp):
        g (class=steppyptsgrp):
        g (class=datapointgrp):
        g (class=hollowgrp):
        g (class=flatlinegrp):
        g (class=hashtaggrp):
        g (class=bullseyegrp):
        g (class=roadgrp):
        g (class=dotgrp):
        g (class=horgrp):
        g (class=hortxtgrp):
        g (class=pasttxtgrp):
      use (class=zoomin):
      use (class=zoomout):
    g (class=axis): bottom X axis
    g (class=axis): top X axis (only when editor is disabled)
    text (class=axislabel): bottom X axis label
    g (class=axis): left Y axis
    g (class=axis): right Y axis
    text (class=axislabel): left Y axis label
  g (class=brush): Top container for the "context" graph showing the entire range
    g (clip-path=brushclip): Clipping container for the context graph
      g (class=context):
        g (class=axis): bottom X axis
      g (class=brush):
      rect (class=focusrect):
</pre>
