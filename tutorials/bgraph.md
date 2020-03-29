This tutorial describes the details and usage of the {@link bgraph}
class provided as part of the Beeminder Javascript implementation.

### Basic Usage for Interactive Graphs

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

### Basic Usage for Road Editing

Similar to its usage to generate interactive graphs, the {@link bgraph
bgraph class} also allows programmers to create an interactive road
editor that allows both manipulation of the road on the graph, as well
as edits on the road matrix through the table. To this end, the
following Javascript code creates the editor on an existing div
element on the page:

```javascript
  var graph = new bgraph({divGraph: document.getElementById('editor'),
                          svgSize: { width: 800, height: 600 },
                          focusRect: { x:0, y:0, width:800, height: 453 },
                          ctxRect: { x:0, y:453, width:800, height: 100 },
                          roadEditor: true,
                          showContext: true})
  graph.loadGoal( "/path/slug.bb" )
```

This populates the supplied div element with the following content,
including the interactive editor and the editable road matrix. The
JSON output was excluded since editing the graph will change its
contents.

<center><img src="editor_example.png"></center>

Below is an explanation of various components and features of this editor:

Manipulating the road:
  * The gray vertical lines ("knots") on the graph allow moving left/right the inflection points in the road, changing their time,
  * The "dots" on the road allow moving up/down the inflection points on the road, changing their time,
  * The lines connecting the black dots ("road segments") can also be grabbed and moved, allowing the user to change the slope of road segments,
  * The 'x' buttons on top of each knot allow deletion of the corresponding knot, removing the associated inflection point on the road,
  * You can left double click to create a new inflection point (knot/dot pair) on the road
  * The road line appears black when it's valid and red when invalid, where valid means not intersecting the pink region, i.e., not violating the akrasia horizon

Visual indicators:
  * Datapoints for the goal are shown as small circles,
  * The pink / grayed out area of the graph shows the range from now to a week from now which the edited road is not allowed to intersect to remain valid,
  * When you select any knot, dot, or segment with a single left mouse click, the corresponding entry in the road matrix table is highlighted and corresponding date,value,slope values displayed on tooltips,

Moving around and zooming:
  * You can zoom in/out with the scroll wheel on the mouse, and drag the graph left/right to focus on different time periods on the graph,
  * The y-axis range for the graph is automatically computed to make all relevant components on the graph visible,
  * The "context" graph at the bottom shows the entire range of the graph, together with the current area spanned by the top "focus" graph. You can move around and scale the blue region to change the focus area.
  
Road matrix table:
  * Each row in this table shows three fields, end date, end value and slope, associated with the preceding segment. Only two of the three fields are "active", with the third one inferred to be consistent with the rest of the road,
  * Selecting any of the active fields highlights the corresponding knot, dot or segment on the graph,
  * Selecting an inactive field activates it, but deactivates one of the previously active fields. You can hence determine which field from among the three should be inferred automatically,
  * You can delete a road matrix row by using the "del" button,
  * A new segment can be added using the "add" button, created in between the row with the button and the next
  
These components allow the user to change any and all aspects of the
road associated with a beeminder goal.

### Common Functions for both Graphs and the Editor

  * {@link bgraph#loadGoal loadGoal(url)}: Async function that loads the BB file from the indicated URL and starts rendering the graph. Completion of rendering might take some time, at the end of which the callback function specified in the *onRoadChange* property of {@link BGraphOptions} will be called.
  * {@link bgraph#loadGoalJSON loadGoalJSON(json)}: Function to load goal contents from a BB json start rendering the graph. Completion of rendering might take some time, at the end of which the callback function specified in the *onRoadChange* property of {@link BGraphOptions} will be called. **TODO: CHECK if onRoadChange is indeed called here**
  * {@link bgraph#zoomAll zoomAll()}: Zooms out to show the entire graph range
  * {@link bgraph#zoomDefault zoomDefault()}: Zooms into the default range for the graph
  * {@link bgraph#hide hide()} and {@link bgraph#show}(): Should be called when the div containing the graph/editor is hidden and reshown on the page.
  * {@link bgraph#showContext showContext(flag)}: Show/hide the context graph
  * {@link bgraph#maxDataDays maxDataDays(days)}: Set the maximum number of days before today to show datapoints for. Defaults to -1 (show all) unless specified in the initial options. Helps optimize interactivity performance.
  * {@link bgraph#reverseTable reverseTable(flag)}: Sets whether the road matrix table should be sorted in decreasing (true), or increasing (false) order of dates. Final road row is placed at the top if set to true.
  * {@link bgraph#getRoad getRoad()}: Returns the road matrix array for the current (possibly edited) road as expected by Beeminder API road submission 
  * {@link bgraph#getRoadObj getRoadObj()}: Returns a copy of the internal {@link beebrain#roads roads} object from the {@link beebrain} instance for the current (possibly edited)  road 
  * {@link bgraph#setRoadObj setRoadObj()}: Sets the road matrix for the internal {@link beebrain} instance. Can be used to consistently coordinate two graph instances on a single page.
  * {@link bgraph#isLoser isLoser()}: Returns whether the current (possibly edited) road is a loser or not 
  * {@link bgraph#curState curState()}: Returns the state [t,v,r,rdf(t)] of the goal for today (asof).
  * {@link bgraph#saveGraph saveGraph(linkelt)}: Generates a downloadable URI from the current SVG and links the supplied linkelt to it. If linkelt is null (default), replaces the current page with the SVG content alone.
  * {@link bgraph#getVisualConfig getVisualConfig()}: Returns current settings for visual properties, as captured by the {@link GoalVisuals} datatype.
  * {@link bgraph#getGoalConfig getGoalConfig()}: Returns current non-visual goal properties as captured by the {@link GoalProperties} datatype.


### Functions Specific to the Editor

  * {@link bgraph#showData showData(flag)}: Show/hide datapoints on the editor graph. Datapoins are always shown on the interactive non-editor graph.
  * {@link bgraph#keepSlopes keepSlopes(flag)}:  When enabled, this forces road segment slopes to be preserved when moving knots and points around the editable graph.
  * {@link bgraph#keepIntervals keepIntervals(flag)}: When enabled, this forces all intervals between successive knots to be preserved when moving a knot left/right. This allows keeping the entire road beyond the knot being dragged fixed during editing. 
  * {@link bgraph#tableAutoScroll tableAutoScroll(flag)}: When enabled, hovering over any knots, dots or segments forces the road matrix table to be scrolled such that the  corresponding position is in the center
  * {@link bgraph#undo undo()}: Undoes the last edit
  * {@link bgraph#redo redo()}: Redoes the last undone edit
  * {@link bgraph#undoBufferState undoBufferState()}: Returns the lengths of the undo/redo buffers as {undo: undoBuffer.length, redo: redoBuffer.length}
  * {@link bgraph#clearUndo clearUndo()}: Clears the undo and redo buffers. 
  * {@link bgraph#retroRatchet retroRatchet(days)}: Introduces a vertical road segment on today (asof) such that the goal only has "days" safety buffer left.
  * {@link bgraph#scheduleBreak scheduleBreak(start, days, insert)}: Schedules a break starting on "start" (formatted as YYYY-MM-DD) and lasting for "days" days. If insert=true, road components overlapping with the break are shifted forward. Existing road is overwritten otherwise.
  * {@link bgraph#commitTo commitTo(newSlope)}: Changes the slope of the road to be "newSlope" beyond the akrasia horizon (a week from today)

### Functions Specific to Interactive Graphs

  * {@link bgraph#animHor animHor(enable)}: Enables/disables animation for the Akrasia Horizon
  * {@link bgraph#animYBR animYBR(enable)}: Enables/disables animation for the Yellow Brick Road
  * {@link bgraph#animData animData(enable)}: Enables/disables animation for datapoints
  * {@link bgraph#animGuides animGuides(enable)}: Enables/disables animation for guidelines
  * {@link bgraph#animRosy animRosy(enable)}: Enables/disables animation for the rosy line
  * {@link bgraph#animMav animMav(enable)}: Enables/disables animation for the moving average
  * {@link bgraph#animAura animAura(enable)}: Enables/disables animation for the aura
  * {@link bgraph#animBuf animBuf(enable)}: Enables/disables animation for the safety buffer watermark
  * {@link bgraph#animBux animBux(enable)}: Enables/disables animation for the pledge amount

