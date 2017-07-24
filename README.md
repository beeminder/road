[glitch update1012]

## CHANGELOG

* 2017.07.17 fixed retroratcheting with fixed slopes
* 2017.07.17 informative table display for duplicate road segments
* 2017.07.17 implemented table update on drag and fixed x axis tick mark issues
* 2017.07.17 implemented road matrix generation (auto eliminates duplicates)
* 2017.07.16 implemented aura generation and drawing
* 2017.07.15 implemented shn and changed all text generation to shn()
* 2017.07.15 streamlined loading to prevent unnecessary refreshes
* 2017.07.15 optimized datapoint, old road and guidelines display when zoomed in
* 2017.07.15 Option to display only the latest 100 days (configurable) of data
* 2017.07.15 moving average, fixed tini/vini, tfin/vfin issues
* 2017.07.14 Default zoom consistent with beebrain, fixes for multiple graphs
* 2017.07.13 Support for loading goals from the API
* 2017.07.13 Noisy width, guidelines, plotall support
* 2017.07.12 Better support for multiple graphs on the same page
* 2017.07.11 Normal graph generation, steppy lines
* 2017.07.01 Fixed date picker placement oddities with a ghost element
* 2017.07.01 Works on mobile, long press to add knots, larger components
* 2017.06.30 onRoadChange callback
* 2017.06.30 Externalized undo/redo button and keyboard handling
* 2017.06.30 Option to show/hide context graph
* 2017.06.30 y axis label and auto graph resizing to fit y axis text
* 2017.06.30 Rate units are now supported on the table
* 2017.06.29 Auto limit maximum graph range to 1 year (or maxFutureDays) into the future
* 2017.06.28 Insta-derail indicator and colored datapoints
* 2017.06.28 Option for adding a fixed table height and autoscroll feature
* 2017.06.28 Draggable road segments and slope text box while editing
* 2017.06.28 Refactored code to implement bmndr as a module
* 2017.06.25 Smart/automatic selection of y range for zoom. Manual zoom on x
* 2017.06.25 Zoom in/out buttons on graph, located based on yaw
* 2017.06.25 Finished context/focus graphs and brush zooming
* 2017.06.21 Dots can be dragged beyond limits now
* 2017.06.21 Ctrl-click on roads, knots and points invokes editing
* 2017.06.21 Double click adds a new dot on the line
* 2017.06.21 Added yellow bullseye to the end of the original road
* 2017.06.21 Added Ctrl-z and Ctrl-y support at the page level
* 2017.06.21 Changed internal representations to UTC and fixed Pikaday date shift
* 2017.05.31 Reverse table order, yellow brick halfplane, datapoints, vertical segments and support for reading beebrain JSON.
* 2017.05.29 Road table with selection of inferred element, date picker, node insertion/deletion and more.
* 2017.05.25 Akrasia horizon and Undo and Pink Zone, etc etc
* 2017.05.23 Updated this with the latest from http://user.ceng.metu.edu.tr/~saranli/road/roadeditor.html
* 2016.12.14 This now lives at road.gomix.me
* 2016.07.21 Added test beebrain data files for Jana
* 2016.07.10 Andy undoes overzealous refactoring that broke it in Safari
* 2016.07.08 Dreev refactors the code a bit
* 2016.07.07 Dreev moves it to Glitch (then known as HyperDev)
* 2016.04.24 Uluc shows off http://www.ceng.metu.edu.tr/~saranli/road/vertical.html

## Pre-deployment UI decisions

Quibbly issues to try to make the overall graph aesthetics match or exceed Matplotlib:

1. DONE: show flatlined triangle datapoint on top of other points
2. DONE: watermarks quibble. try making the vertical gridlines display on top of the watermarks like matplotlib does it? and a bit bigger puffier font might help too.
2.2. DONE (as much as I could) more on watermarks: i think the graph canvas should be divided into 4 quadrants and the watermarks should take up as much as possible of their designated quadrant as possible
3. (Not sure if it's worth the effort) frame around the graph with tickmarks only pointing inward?
4. (Kind of tough) lower priority since the blue/green aura isn't turned on for most graphs but i really like how in matplotlib it's green where it overlaps the YBR (cuz yellow and blue make green)
5. (Seems to be a Chrome issue) example of svg with artifacts (only appears in chrome; firefox and safari display it fine): http://road.glitch.me/svg-with-artifacts.svg 
6. day of week for "today" should account for the beeminder deadline. for example, if it's friday night at 8pm and i've done my pushups that we due at 7pm then from beeminder's point of view it's now saturday and it's an eep day again because saturday's pushups are due in less than 24 hours. this seems counterintuitive to call it saturday when it's clearly friday but it turns out to be a can of worms to do anything other than treat the beeminder deadline as the end-of-day.
7. (doable) don't draw the actual YBR left of tini. we do want to be able to scroll left of tini and add new knots and make tini be earlier. just show the actual YBR starting at tini. it's also possible to have datapoints to the left of tini, which is fine.

General
1. Should we allow adding duplicate road knots (helps with subsequent editing, so probably yes) [yes]
2. should the getRoad() function automatically eliminate duplicate knots (probably yes) [yes?]

Graph related questions

3. Whether to display all datapoints by default or only the last n days to help speed up graph visualization and editing [all unless things get too laggy, but even then it's only an issue for veterans who are forgiving/tolerant]
4. Should the context graph be enabled by default [show it only if N months of data, N=3 or 12]
5. Should the context graph show a rectangle with the current y axis zoom [no]
6. Should the first road knot (tini/vini) be editable? [yes?]
7. Default Zoom and Zoom All buttons. Are both needed? Better names? [either rename “default zoom” to “reset zoom” and ditch “zoom all” (hitting minus a bunch of times does that) or even ditch both]
7.1. Should we keep/ditch zoom by scroll? [ditch?]

Features related to the road table:

8. Should the table be displayed in reverse by default? [no?]
9. Should there be an option to reverse the table? [no?]
10. Should auto table scroll enabled by default? [yes?]
11. Should there be an option to toggle auto scroll? [no?]
12. Should table update on drag be enabled by default (disabling it helps with speed)? [yes?]
13. Should there be an option to toggle table update on drag? [no]

### To-Do List

1. Issue: When editing table entries, which one of the remaining two parameters should be updated? How should precision issues be handled particularly since dates are quantizied to days? This is in fact, what "fix ---" choices are determining quite nicely in my opinion. My preference: When editing values and slopes, keep the date fixed, when editing dates, keep the slope or value fixed based on the "fix slopes" option. This makes much more sense from a road adjustment point of view. It is also compatible with visual graph editing. Alternatively, we could have an option for each road segment indicating which two the user is interested in keeping, which would make all these choices inter-mixable based on the user's preference but that might be too complex. Perhaps the graph should keep the two "fix" options, and the table should allow choosing which two are editable?
*Dreev: I'd love for this to work at least as well as the basic original road dial under the graph on http://old.beeminder.com -- where you could pick which one-of-three was inferred from the other two but also you could click on the grayed-out inferred field and it would magically un-gray itself and pick one of the other fields to be inferred.*

1. omg i'm a genius: forget these "keep slopes/intervals fixed" checkboxes, which i'm finding super unintuitive for some reason, and instead drag either the nodes (it would let you drag either vertically or horizontally, but just one or the other) or the edges. i think that makes it super intuitive that if you don't want to mess up the slopes then you drag the segment itself. the vertical lines can be just for display, not clickable<br>
*Uluc: I don't quite agree with this. There is utility in being able to move a "knot" (as I call them) without changing the slope of the preceding segment. Also, if I start dragging a road segment itself, there is ambiguity as to whether I will modify the dates or values associated with either the previous or the next knot. I quite like the current set of possibilities and I think feedback from actual use cases and as many active users as possible would be needed to make a good decision here.*

1. We have https://expost.eth.pad/dial from years ago, may or may not still be anything of value there

1. Use `asof` instead of the latest datapoint for today

### Kenn and Danny discussing extensions to the road data structure

Kenn aka @kenoubi suggests that we think of the road matrix as a piecewise linear function -- a list of road segments stored as (timestamp, endvalue) pairs -- where each segment stores additional fields about the user's intent.
Right now we have the equivalent of that where the intents we can store are the following (`t`, `v`, and `r` are the end date, end value, and rate for a road segment):

1. User cares about `t` and `v` and wants `r` inferred (e.g., "hit 70kg by xmas")
2. User cares about `t` and `r` and wants `v` inferred (e.g., "lose 1kg/week till xmas")
3. User cares about `v` and `r` and wants `t` inferred (e.g., "lose 1kg/week till 70kg")

Questions:

* a) Might it be better to store which specific field -- `t`, `v`, or `r` -- the user *does* care about instead of which of the 3 they don't?
* b) If so, can we add the possibility that what the user cares about is not the absolute end value of a segment, `v`, but the delta from the previous `v`?
* c) Can/should we store a user-specified comment for each segment like "All-you-can-eat-buffet-hopping vacation" for an upward-sloping section of a weight loss goal?

#### ROAD MATRIX REFACTOR PROPOSAL

0. columns are `t`, `v`, `infer` (`infer` indicates which of t/v/r would be null in existing data structure)
1. no separate tini/vini fields — that’s just the first row of the road matrix
2. same for tfin/vfin/rfin — that’s the last row
(any code that wants *ini/*fin can cache them for convenience)
3. no rates stored. that’s confusing with runits, for one thing. and if you want a row’s rate that’s just `(v-v_prev)/(t-t_prev)`

For later:

* A column for `comment` if it’s worth having an interface for annotations like “all-you-can-eat-buffet-hopping vacation” for an upward-sloping section of a weight loss goal
* Way to indicate gaps in the road, which will be a much better way to handle breaks.

### DONE ITEMS

1. DONE: Checking road compliance with the pink region
1. DONE: Show the road matrix and have it update in real time as you drag things around
1. DONE: A way to add and remove segments
1. DONE: Some other way to drag road segments around, conducive to the common use cases of scheduling breaks, ratcheting, etc?
1. DONE: write functions to convert unixtime<->daystamps

1. DONE: drop the scroll-wheel zoom in favor of the style where you draw a box to zoom and a single button to zoom all the way back out
DONE: (uluc: I thought about that as well. Also, having a separate axis for the time range where you can select a date range would be useful.
We can work on those once the feature gets integrated, I think.)

1. DONE (but double clicking now selects the table entry for editing): drop the double-clicking to edit. instead highlight in the matrix whatever segment you click on or drag on on the graph. then it’s easy to always use the matrix to edit values directly

1. DONE: then double-clicking can be strictly for adding nodes

1. DONE (also implemented redo): minimizing UI elements is nice. maybe we can ditch "reset edits" now that you can hit "undo" until it's grayed out. (er, tiny feature request: gray out the undo button when you reach the end of the undo stack)

1. DONE: i think there should be a way to zoom all the way out to see both past and future

1. DONE: it should be possible to edit the start date/val from the road matrix

1. DONE: date picker or at least allow manual editing of dates

1. DONE: there will be huge value in also seeing the datapoints on this graph. you usually need to know what you've done so far to decide how to pick slopes.

1. DONE: tentative idea: two zoom buttons: "default zoom" (what the current zoom-to-fit does) and "zoom out" (which zooms out to fit everything, past and future)

1. DONE: alt idea: small plus and minus for zooming like google maps which everyone knows and so minimizes UI clutter since we don't even need the word "zoom" in that case

1. DONE: the date picker is off by one from the date field in western time zones. <https://github.com/dbushell/Pikaday/issues/138#issuecomment-84253903>

1. DONE: Tiny feature request: visually indicate the good side of the road by shading the whole thing yellow. Also helps pave the way for yellow brick halfplane (YBHP).

1. DONE: The final knot should be visually distinct, like a bull's eye perhaps, or just don't show the YBR beyond that point.

1. DONE: Bug: Akrasia horizon should be shown on top of yellow shading for good side of the road

1. DONE: Bee: keeping the current x-axis zoom seems good, but i guess i sort of expected the y-axis zoom to update. 

1. DONE: Dreev: let's call the zoom-out button good enough for now. bee hadn't noticed that initially. 
