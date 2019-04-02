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
  rect (class=zoomarea): Rectangle to monitor zoom events (for d3.zoom)
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
          path (class=aura): Aura around datapoints beyond tini
          path (class=aurapast): Aura around datapoints prior to tini
        g (class=wmarkgrp):
          text [or image] (class=waterbuf): Safety buffer watermark
          text (class=waterbux): Pledge amount watermark
        g (class=oldguidegrp):
          path (class=oldguides): Guidelines for the unedited "old" road (!roadeditor)
          ...
        g (class=oldroadgrp):
          path (class=oldlanes): YBR for the unedited "old" road (!roadeditor)
        g (class=pinkgrp):
          path (class=pinkregion): Pink "forbidden" region between asof and horizon
        g (class=oldbullseyegrp:
          image (class=oldbullseye): Bullseye for the unedited "old" road
        g (class=oldcentergrp):
          path (class=oldroads): YBR centerline
        g (class=grid):
          g (class=grid): vertical grid lines (!roadeditor)
          line (class=pastline): Vertical line showing asof (roadeditor only)
        g (class=oresetgrp):
          line (class=oresets): Vertical lines to indicate odometer resets
          ...
        g (class=knotgrp):
          line (class=knots): Vertical knots for editing time (roadeditor)
          ...
        g (class=steppygrp):
          path (class=steppy): Purple steppy line (!roadeditor)
        g (class=rosygrp):
          path (class=rosy): Piecewise linear rosy line (!roadeditor)
        g (class=rosyptsgrp):
          circle (class=rd): Points on the rosy line (!roadeditor)
          ...
        g (class=derailsgrp):
          use (class=derails): Arrows showing derailment points (!roadeditor)
          ...
        g (class=allptsgrp):
          circle (class=ap): All non-aggregated datapoints (!roadeditor)
          ...
        g (class=movingavgrp):
          path (class=movingav): Moving average of datapoints (!roadeditor)
        g (class=steppyptsgrp):
          circle (class=std): Purple points on the steppy line (!roadeditor)
          ...
        g (class=datapointgrp):
          circle (class=dp): Aggregated datapoints
          ...
        g (class=hollowgrp):
          circle (class=hpts): "Hollow" datapoints (!roadeditor)
          ...
        g (class=flatlinegrp):
          use (class=fladp): Flatlined datapoint
        g (class=hashtaggrp):
          text (class=hashtag): Hashtag text (!roadeditor)
          ...
        g (class=bullseyegrp):
          image (class=bullseye): Bullseye for edited road (roadeditor)
        g (class=roadgrp):
          line (class=roads): Centerline for the edited road (roadeditor)
          ...
        g (class=dotgrp):
          circle (class=dots): Inflection points for the edited road (roadeditor)
          ...
        g (class=horgrp):
          line (class=horizon): Vertical line for the akrasia horizon
        g (class=hortxtgrp):
          text (class=horizontext): "Akrasia Horizon" string
        g (class=pasttxtgrp):
          text (class=pasttext): "Today (dayname)" string indicating asof (roadeditor)
      use (class=zoomin): Button to zoom in
      use (class=zoomout): Button to zoom out
    g (class=axis): bottom X axis
    g (class=axis): top X axis (only when editor is disabled)
    text (class=axislabel): bottom X axis label
    g (class=axis): left Y axis
    g (class=axis): right Y axis
    text (class=axislabel): left Y axis label
  g (class=brush): Top container for the "context" graph showing the entire range
    g (clip-path=brushclip): Clipping container for the context graph
      g (class=context):
        g (class=brush): "brush" to select and move focus area on the entire range
          ...
        path (class=ctxoldroad): Unedited road centerline in the context graph
        image (class=ctxoldbullseye): Unedited road's bullseye in the context graph
        image (class=ctxbullseye): New road's bullseye in the context graph (roadeditor)
        line (class=ctxroads): New road segments in the context graph (roadeditor)
          ...
        circle (class=ctxdots): New road corners in the context graph (roadeditor)
          ...
        line (class=ctxhorizon): Vertical line for the akrasia horizon in the context gr.
        text (class=ctxhortext): "Akrasia Horizon" string in the context gr.
        line (class=ctxtoday): Vertical line for asof in the context gr.
        text (class=ctxtodaytext): "Today" string in the context gr.
      rect (class=focusrect): Rectange to show the range currently in focus
    g (class=axis): bottom X axis
</pre>
