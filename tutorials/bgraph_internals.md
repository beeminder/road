This tutorial describes the internal details of the {@link bgraph}
class provided as part of the Beeminder Javascript implementation.

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

### Axes, graph boundaries, zooming and panning

### Principles of Operation for the Interactive Graph Editor

The interactive graph editor implemented by the {@link bgraph} class
relies heaving on {@link https://d3js.org d3.js} to manipulate DOM
elements and the SVG graph. To this end, callbacks are registered to
various mouse events for relevant objects created within the SVG when
the roadEditor option is enabled on creation. In particular, the
following components and events are used:

  * KNOTS:
    * *drag*: Allows moving the knot left or right. Relevant functions are knotDragStarted(d,i), knotDragged(d,i), knotDragStopped(d,i), where d and i are the data element and index of the knot being dragged. 
    * *leftclick*: If the mouse button is released without any dragging, this selects the knot, shows the associated date and value and highlights the corresponding date field in the table if present.
    * *Ctrl-leftclick*: This selects the knot, activates the date field in the corresponding table row if inactive (i.e. auto-computed), shifts focus to the table element and selects the entire text so the user can manually enter a date.
    * *mouseover*/*mouseout*: Highlights the date entry in the road matrix table corresponding to this knot. Relevant function is highlightDate(i,state)
  * DOTS:
    * *drag*: Allows moving the dot up or down. Relevant functions are dotDragStarted(d,i), dotDragged(d,i), dotDragStopped(d,i), where d and i are the data element and index of the dot being dragged. 
    * *leftclick*: If the mouse button is released without any dragging, this selects the dot, shows the associated date, value and slope for the preceding segment and highlights the corresponding value field in the table if present.
    * *Ctrl-leftclick*: This selects the dot, activates the value field in the corresponding table row if inactive (i.e. auto-computed), shifts focus to the table element and selects the entire text so the user can manually enter a value.
    * *mouseover*/*mouseout*: Highlights the value entry in the road matrix table corresponding to this dot. Relevant function is highlightValue(i,state)
  * SEGMENTS:
    * *drag*: Allows moving the segment up or down, changing its slope accordingly. Relevant functions are roadDragStarted(d,i), roadDragged(d,i), roadDragStopped(d,i), where d and i are the data element and index of the road segment being dragged. 
    * *leftclick*: If the mouse button is released without any dragging, this selects the segment, shows the associated slope, value and date for the next segment and highlights the corresponding slope field in the table if present.
    * *Ctrl-leftclick*: This selects the segment, activates the slope field in the corresponding table row if inactive (i.e. auto-computed), shifts focus to the table element and selects the entire text so the user can manually enter a slope.
    * *mouseover*/*mouseout*: Highlights the slope entry in the road matrix table corresponding to this segment. Relevant function is highlightSlope(i,state)
  * *"x" BUTTONS*
    * *leftclick*: Deletes the corresponding knot by calling knotDeleted(d) where d is the data element corresponding to the knot
    * *mouseover*/*mouseout*: Highlights the date entry in the road matrix table corresponding to this knot. Relevant function is highlightDate(i,state)
    
For each of these components, the associated d3 data is set to the {@link beeminder#roads roads} array, containing the piecewise linear representation of the current road. For a given road segment "seg", dots use the starting point of the segment ("seg.sta"), knots use the ending point of the segment ("seg.end"), and road segments use both endpoints ("seg.sta" and "seg.end") to construct the corresponding SVG element. In addition to these interactions, double left-click anywhere on the graph adds a new knot at the nearest date to the mouse x coordinate and a new dot concident with the current road value for that day.
