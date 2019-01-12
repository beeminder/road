This tutorial describes the details and usage of the {@link beebrain}
class provided as part of the Beeminder Javascript implementation. 

The {@link module:beebrain beebrain module} and the associated {@link
beebrain beebrain class} allows anyone to load and process a beeminder
goal file (aka BB file), which includes goal configuration
information, as well as the associated road matrix and
datapoints. Assuming that the required modules (moment, polyfit,
butil, broad and beebrain) are preloaded, the following code
illustrates the most basic usage

```javascript
<!DOCTYPE html>
async function loadGoal() {
  let url="file:///path/file.bb"
  var resp = await butil.loadJSON( url )
  document.getElementById('bbjson').innerHTML=JSON.stringify(resp)
  let goalbb = new beebrain( resp )
  let goalout = goalbb.getStats()
  document.getElementById('outjson').innerHTML=JSON.stringify(goalout)
}

loadGoal()
```

Assuming that there are two `div` elements with ids `bbjson` and
`outjson`, this script fills in their contents with the loaded BB
file, as well as the beebrain output. Note that the beebrain
constructor needs to be called with a javascript object with the
contents of the BB file acquired through {@link beebrain#getStats}.

Note that the same module can be used within a node server as
well. The following code (assuming paths are adjusted to work with
your setup and required dependencies are installed) should work with a
node server:

```javascript
const fs = require('fs')

const bu = require('butil.js')
const br = require('broad.js')
const bb = require('beebrain.js')

var bbjson = JSON.parse(fs.readFileSync(testroad.bb', 'utf8'))

var bbr = new bb(bbjson)
console.log(bbr.getStats())
```

Once the beebrain object is created, various internal variables are
directly exposed as public members for efficiency. In particular, the
following members may be useful:

  * {@link beebrain#roads roads} : Piecewise linear road representation. The
    format for this object is an array of linear segments, each of
    which is an object with the following format: `{sta: [t, v], end:
    [t, v], slope: r, auto: autoparam}`, where `r` is expressed in
    Hertz (1/s), and `autoparam` is one of the enumerated values in
    {@link module:broad.RP broad.RP}, indicating which entry will be
    auto-computed. Note that the end point for one segment is required
    to be identical to the starting point for the next
    segment. Finally, initial and final flat segments are added during
    processing, 100 days before and after the initial and final road
    matrix components, respectively.

  * {@link beebrain#goal goal} : Goal parameters and computed details. This
    is a javascript object with all goal parameters and computed
    statistics as well as a number of internal computations.

  * {@link beebrain#data data} : Aggregated (non-future) data points
    for each day with at least one entry, where each array element has
    the form `[unixtime,aggvalue,comment,type,prevt,prevv,voriginal]`,
    where `type` is one of the values in {@link beebrain.DPTYPE},
    `prevt` and `prevv` are the time and value of the previous data
    point (used to draw the steppy lines) and `voriginal` records the
    unmodified (e.g. non-cumulative) value of the datapoint (set to
    null when the aggregated value does not coincide with any of the
    manually entered data points). The last element is used by {@link
    module:bgraph} to display tooltips for datapoints with the
    originally entered data value. Note that this format is also used
    in {@link beebrain#alldata} and {@link beebrain#rosydata} with
    slight differences.

  * {@link beebrain#fuda fuda} : "Future" data points, beyond "today"
    (i.e. `asof`). Has the same format as {@link beebrain.data}.

  * {@link beebrain#alldata alldata} : An array of all data points entered by
    the user, where each entry is an array
    `[unixtime,vtotal,comment,type,null,null,voriginal]`. Fields have
    the same semantics as {@link beebrain#data}, except that the
    "previous" point is not defined and hence not recorded. Includes
    future data as well.

  * {@link beebrain#rosydata rosydata} : "Rosy" datapoints generated from
    aggregated data points. Each array entry has the form
    `[unixtime,aggval_comment,type,prevt,prevv,voriginal]`. Fields
    have the same semantics as {@link beebrain#data}, including the
    time and value of the previous point used to generate lines
    connecting the rosy dots.
  
  * {@link beebrain#flad flad} : Flatlined (predicted) data point for
    today. Has the format `[unixtime, vppr, "PPR", DPTYPE.FLATLINE,
    prevt, prevv, null]`.
  
  * {@link beebrain#allvals allvals} : Set of values for each
    non-empty timestamp.  For a given unixtime t, allvals[t] contains
    an array with entries of the form `[vtotal, comment, voriginal]`.
  
  * {@link beebrain#oresets oresets} : Array of unix timestamps where
    odometer reset was performed
  
  * {@link beebrain#derails derails} : Array of unix timestamps where
    the goal derailed

These variables should be only used in a read-only manner since their
internal consistency is critical for other components of the
Beeminder's Javascript library. An exception to this is the `roads`
object, which can be edited externally, followed by a call to {@link
beebrain#reloadRoad()}. This forces the beebrain object to reprocess
the goal with the new road and update its output and internal state.

Finally, if one wants to directly change the current road matrix for
this particular beebrain instance, this can be done by using the
{@link beebrain#setRoadObj} method. This is often useful to keep two
{@link bgraph} instances on the same web page consistent and
synchronized. However, this is normally done through associated {@link
bgraph} instances and not through {@link beebrain} instances.

## Internals

The inner workings of the beebrain class closely mirror those of the
python implementation of beebrain. The constructor first defines all
private variables and methods, exported public functions and then
calls the `genStats()` function. This function performs all goal
processing to generate goal stats. Important functions (in calling
order) are

  * {@link beebrain~legacyIn `legacyIn(p)`}  : Processes legacy parameters
  * {@link beebrain~stampIn `stampIn(p,d)`} : Performs timestamp conversion for inputs
  * {@link beebrain~vetParams `vetParams()`} : Verifies parameter sanity
  * {@link beebrain~procData `procData()`} : Processes datapoints
  * {@link beebrain~procRoad `procRoad()`} : Processes the road matrix and constructs the internal `roads` object
  * {@link beebrain~computeRosy `computeRosy()`} : Pre-computes rosy datapoints
  * {@link beebrain~stampOut `stampOut(p)`} : Prepares timestamp values for output
  * {@link beebrain~legacyOut `legacyOut(p)`} : Outputs legacy parameters

There are of course numerous details on how and when various things
are computed. Please refer to the code for details.

