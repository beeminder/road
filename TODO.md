## New stuff

- Put png paths into the output JSON
- Review and finalize PNG URL locations
- Rename PNG files to temporary files while generating new ones as in beebrain.py

## Pre-deployment UI decisions

Prioritized To-Do list for the editor/client-side graphs

- Exes and pencils like in old.beeminder.com for the road rows with auto-ungray (also probably exes for deleting road rows. or maybe '+' and '-' for that?)
- Selector for multiple overlapping node deletion buttons.
- Implement a smoother editing mechanism for roads with lots of breaks.
- True *retro*ratchet when you originally made your rate way too conservative and want the road to match your data
- Mini-editor for goal creation
- Replace table checkmarks with proper icons and implement auto-enable on click.

- DONE: Test out how svg and png generation would work on a node.js server with jsdom?
- DONE: don't draw the actual YBR left of tini. we do want to be able to scroll left of tini and add new knots and make tini be earlier. just show the actual YBR starting at tini. it's also possible to have datapoints to the left of tini, which is fine.
- FIXED: day of week for "today" should account for the beeminder deadline. for example, if it's friday night at 8pm and i've done my pushups that we due at 7pm then from beeminder's point of view it's now saturday and it's an eep day again because saturday's pushups are due in less than 24 hours. this seems counterintuitive to call it saturday when it's clearly friday but it turns out to be a can of worms to do anything other than treat the beeminder deadline as the end-of-day.
- DONE: Enable field on click
- DONE: Table headers and the first row should always be visible
- DONE: Last (goal) row should always be visible or somehow highlighted
- DONE: "Schedule a break" functionality (options: insert or overwrite)
- FIXED: Bug: when you drag a knot and it bumps into another knot it loses the slope it was supposed to be keeping fixed
- DONE (Shown in the table header): Show the rate units somewhere
- DONE (Selection mechanism for knots, dots and roads) Try out ways to "freeze" selection of roads, knots and dots to preserve highlighting of corresponding table entries.
- DONE (handled through the selection interface) Inverse of autoscroll so you know what part of the graph you're editing when you edit road matrix rows

Quibbly issues to try to make the overall graph aesthetics match or exceed Matplotlib:

1. DONE: show flatlined triangle datapoint on top of other points
2. DONE: watermarks quibble. try making the vertical gridlines display on top of the watermarks like matplotlib does it? and a bit bigger puffier font might help too.
2.2. DONE (as much as I could) more on watermarks: i think the graph canvas should be divided into 4 quadrants and the watermarks should take up as much as possible of their designated quadrant as possible
3. (Not sure if it's worth the effort) frame around the graph with tickmarks only pointing inward?
4. (Kind of tough) lower priority since the blue/green aura isn't turned on for most graphs but i really like how in matplotlib it's green where it overlaps the YBR (cuz yellow and blue make green)
5. DISAPPEARED?: (Seems to be a Chrome issue) example of svg with artifacts (only appears in chrome; firefox and safari display it fine): http://road.glitch.me/svg-with-artifacts.svg 

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
