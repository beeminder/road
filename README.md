We can type notes to ourselves, to-do lists, etc, here.
I just added Malcolm's Beeminder package for node.js as a dependency but we're not doing anything with it yet.
Do chime in here if you want to contribute!


IDEAS
=====

1. DONE: Checking road compliance with the pink region
1. DONE: Show the road matrix and have it update in real time as you drag things around
1. DONE: A way to add and remove segments
1. DONE: Some other way to drag road segments around, conducive to the common use cases of scheduling breaks, ratcheting, etc?
1. DONE: write functions to convert unixtime<->daystamps

1. Issue: When editing table entries, which one of the remaining two parameters should be updated? How should precision issues be handled particularly since dates are quantizied to days? This is in fact, what "fix ---" choices are determining quite nicely in my opinion. My preference: When editing values and slopes, keep the date fixed, when editing dates, keep the slope or value fixed based on the "fix slopes" option. This makes much more sense from a road adjustment point of view. It is also compatible with visual graph editing. Alternatively, we could have an option for each road segment indicating which two the user is interested in keeping, which would make all these choices inter-mixable based on the user's preference but that might be too complex. Perhaps the graph should keep the two "fix" options, and the table should allow choosing which two are editable?

1. drop the scroll-wheel zoom in favor of the style where you draw a box to zoom and a single button to zoom all the way back out
(uluc: I thought about that as well. Also, having a separate axis for the time range where you can select a date range would be useful.
We can work on those once the feature gets integrated, I think.)

1. drop the double-clicking to edit. instead highlight in the matrix whatever segment you click on or drag on on the graph. then it’s easy to always use the matrix to edit values directly

1. and then double-clicking can be strictly for adding nodes

1. minimizing UI elements is nice. maybe we can ditch "reset edits" now that you can hit "undo" until it's grayed out. (er, tiny feature request: gray out the undo button when you reach the end of the undo stack)

1. i think there should be a way to zoom all the way out to see both past and future - DONE

1. DONE: it should be possible to edit the start date/val from the road matrix

1. date picker or at least allow manual editing of dates

1. there will be huge value in also seeing the datapoints on this graph. you usually need to know what you've done so far to decide how to pick slopes.

1. omg i'm a genius: forget these "keep slopes/intervals fixed" checkboxes, which i'm finding super unintuitive for some reason, and instead drag either the nodes (it would let you drag either vertically or horizontally, but just one or the other) or the edges. i think that makes it super intuitive that if you don't want to mess up the slopes then you drag the segment itself. the vertical lines can be just for display, not clickable

Uluc: I don't quite agree with this. There is utility in being able to move a "knot" (as I call them) without changing the slope of the preceding segment. Also, if I start dragging a road segment itself, there is ambiguity as to whether I will modify the dates or values associated with either the previous or the next knot. I quite like the current set of possibilities and I think feedback from actual use cases and as many active users as possible would be needed to make a good decision here.

1. DONE: tentative idea: two zoom buttons: "default zoom" (what the current zoom-to-fit does) and "zoom out" (which zooms out to fit everything, past and future)

2. alt idea: small plus and minus for zooming like google maps which everyone knows and so minimizes UI clutter since we don't even need the word "zoom" in that case

### Uluc and Bee discussing auto-zooming

Bee: Seems buggy how when i move one segment and it pushes another segment out of the plot bounds. maybe the plot bounds can dynamically update?

Uluc: You can zoom out when that happens. I wanted to keep the current zoom level so things do not jump around while moving things. Also, D3 mechanism for zooming does not allow separate zooming for x and y axes. That requires "substantial" more work. Probably doable, but not sure if it's worth the time.

Bee: keeping the current x-axis zoom seems good, but i guess i sort of expected the y-axis zoom to update. 

Dreev: let's call the zoom-out button good enough for now. bee hadn't noticed that initially. 

CHANGELOG
=========

2017.05.25 Akrasia horizon and Undo and Pink Zone, etc etc
2017.05.23 Updated this with the latest from http://user.ceng.metu.edu.tr/~saranli/road/roadeditor.html
2016.12.14 This now lives at road.gomix.me
2016.07.21 Added test beebrain data files for Jana
2016.07.10 Andy undoes overzealous refactoring that broke it in Safari
2016.07.08 Dreev refactors the code a bit
2016.07.07 Dreev moves it to Glitch (then known as HyperDev)
2016.04.24 Uluc shows off http://www.ceng.metu.edu.tr/~saranli/road/vertical.html
