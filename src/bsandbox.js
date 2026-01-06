/**
 * Javascript implementation of a sandbox for Beeminder goals, provided as a UMD
 * module. Provides a {@link bsandbox} class, which can be used to construct 
 * independent sandbox objects each with their own graph object, linked to
 * particular div element on the DOM.<br/>

 * <br/>Copyright 2017-2026 Uluc Saranli and Daniel Reeves and Bethany Soule
 @module bsandbox
 @requires d3
 @requires moment
 @requires butil
 @requires broad
 @requires beebrain
 @requires bgraph
 */
;((function(root, factory) { // BEGIN PREAMBLE ---------------------------------

'use strict'

if (typeof define === 'function' && define.amd) {
  // AMD. Register as an anonymous module.
  //console.log("beebrain: Using AMD module definition")
  define(['moment', 'butil', 'broad', 'beebrain', 'bgraph'], factory)
} else if (typeof module === 'object' && module.exports) {
  // Node. Does not work with strict CommonJS, but
  // only CommonJS-like environments that support module.exports,
  // like Node.    
  //console.log("beebrain: Using CommonJS module.exports")
  module.exports = factory(require('./moment'), require('./butil'), 
                           require('./broad'), require('./beebrain'),
                           require('./bgraph'))
} else {
  //console.log("beebrain: Using Browser globals")
  root.bsandbox = factory(root.moment, root.butil, root.broad,
                          root.beebrain, root.bgraph)
}
})(this, function (moment, bu, br, bb, bg) { // END PREAMBLE -- BEGIN MAIN -----

'use strict'

// -----------------------------------------------------------------------------
// --------------------------- CONVENIENCE CONSTANTS ---------------------------

const DIY = 365.25
const SID = 86400

// -----------------------------------------------------------------------------
// ------------------------------ FACTORY GLOBALS ------------------------------

/** Global counter to Generate unique IDs for multiple bsandbox instances. */
var gid = 1,

/** bsandbox object constructor. Creates a beeminder sandbox object,
 * creating a graph on the supplied DIV object in the DOM.

 @memberof module:bsandbox
 @constructs bsandbox
 @param {object} div object on the DOM to create a {@link module:bgraph} instance on
 @param {bool} debug flag turns logging on or off. Default is false.
*/
bsandbox = function(optsin, debug = true) { // BEGIN BSANDBOX ------------------

// set log level for this instance of bsandbox. 
var logger = (debug && typeof console != 'undefined') ? console : {
      info: function(){},
      warn: function(){},
      debug:function(){},
      error:function(){},
      log:  function(){}
    }
logger.debug("beebrain constructor ("+gid+"): ");
var self = this,
    opts = bu.extendo({}, optsin),
    curid = gid
gid++

bu.extendo(opts, {roadEditor:false,
                 maxFutureDays: 365,
                 showFocusRect: false,
                 showContext: false})
var gol = {div: opts.divGraph}

var pledges = [5, 10, 30, 90, 270, 810, 2430]
gol.graph = new bgraph(opts);

function newDoMore() {
  return {yaw:1, dir:1, kyoom:true,
          odom: false, movingav:false, 
          steppy:true, rosy: false, aura: false, aggday: "sum",
          monotone:true }
}
function newLoseWeight() {
  return {yaw: -1, dir: -1, kyoom: false,
          odom: false, movingav: true,
          steppy: false, rosy: true, aura: false, aggday: "min",
          plotall:false, monotone:false }
}
function newUseOdometer() {
  return {yaw:1, dir: 1, kyoom: false,
          odom: true, movingav: false,
          steppy: true, rosy: false, aura: false, aggday: "last",
          monotone:true }
}
function newDoLess() {
  return {yaw: -1, dir: 1, kyoom: true,
          odom: false, movingav: false,
          steppy: true, rosy: false, aura: false, aggday: "sum",
          monotone:true }
}
function newGainWeight() {
  return {yaw: 1, dir: 1, kyoom: false,
          odom: false, movingav: true, 
          steppy: false, rosy: true, aura: false, aggday: "max",
          plotall:false, monotone:false }
}
function newWhittleDown() {
  return {dir: -1, yaw: -1, kyoom: false,
          odom: false, movingav: false,
          steppy: true, rosy: false, aura: false, aggday: "min",
          plotall:false, monotone:false }
}
const typefn = {
  hustler:    newDoMore, 
  fatloser:   newLoseWeight, 
  biker:      newUseOdometer, 
  drinker:    newDoLess, 
  gainer:     newGainWeight,
  inboxer:    newWhittleDown,
  netcalorie: newWhittleDown,
  custom:     newDoMore,
}

var undoBuffer = [], redoBuffer = []
function undo(reload=true) {
  if (undoBuffer.length == 0) return
  redoBuffer.push(JSON.parse(JSON.stringify(
    { bb: gol.bb, derails: gol.derails })))
  var restore = undoBuffer.pop()
  gol.bb = restore.bb
  gol.derails = restore.derails
  if (reload) reloadGoal()
}
function redo(reload=true) {
  if (redoBuffer.length == 0) return
  saveState()
  var restore = redoBuffer.pop()
  gol.bb = restore.bb
  gol.derails = restore.derails
  if (reload) reloadGoal()
}
function saveState() {
  undoBuffer.push(JSON.parse(JSON.stringify(
    { bb: gol.bb, derails: gol.derails })))
}
function clearUndoBuffer() { undoBuffer = [] }

function reGraph() {
  let bb = JSON.parse(JSON.stringify(gol.bb))
  // this was overwriting Bee's passed-in waterbux / pledge settings
  if (bb.params.yoog === "magic_sandbox_username/magic_sandbox_goalname")
    bb.params.waterbux = 
      "$"+pledges[Math.min(pledges.length-1, gol.derails.length)]
  gol.graph.loadGoalJSON( bb, false )
}
function reloadGoal(undofirst = true) {
  logger.log("bsandbox.reloadGoal(): Regenerating graph ********")
  reGraph()
  // If the goal has derailed, perform rerailments automatically
  if (gol.graph.isLoser()) {
    if (undofirst) {
      logger.log("bsandbox.reloadGoal(): Derailed! Rolling back...")
      undo(false)
      reGraph()
      saveState()
    }
    logger.log("bsandbox.reloadGoal(): Derailed! Rerailing...")
    let cur = gol.graph.curState()
    // Clean up road ahead
    gol.bb.params.road = 
      gol.bb.params.road.filter(e=>(bu.dayparse(e[0])<cur[0]))
    let road = gol.bb.params.road
    var nextweek = bu.daysnap(cur[0]+7*SID)
    var derail = bu.dayify(cur[0])
    road.push([derail, null, cur[2]])
    road.push([derail, Number(cur[1]), null])
    road.push([bu.dayify(nextweek), null, 0])
    gol.bb.data.push([derail,
                       (gol.bb.params.kyoom)?0:Number(cur[1]),
                       "#DERAIL at "+derail])

    gol.derails.push(derail)

    reGraph()
  }
  logger.log("bsandbox.reloadGoal(): Done **********************")
}

function nextDay() {
  saveState()
//var oldasof = bu.dayify(bu.daysnap(bu.dayparse(gol.bb.params.asof)))
  var newasof
    = bu.dayify(bu.daysnap(bu.dayparse(gol.bb.params.asof)+SID))
//var ppr = br.ppr(gol.graph.getRoadObj(), gol.graph.getGoalObj(), newasof)
//console.log(ppr)
//if (ppr != 0) {
//  if (gol.bb.params.kyoom)
//    gol.bb.data.push([oldasof, Number(ppr),
//                       `PPR (#${gol.bb.data.length})`])
//  else
//    gol.bb.data.push([oldasof,
//                       Number(gol.bb.data[gol.bb.data.length-1][1] + ppr),
//                       `PPR (#${gol.bb.data.length})`])
//  console.log(gol.bb.data)
//}
  gol.bb.params.asof = newasof
  reloadGoal()
}

function newData( v, c ) {
  if (!bu.nummy(v) || !bu.stringy(c)) return;
  saveState()
  gol.bb.data.push([gol.bb.params.asof, Number(v),
                     (c=="")?`Added in sandbox (#${gol.bb.data.length})`:c])
  reloadGoal()
}

// GPT-5.2 wrote this function
function setRateUnits( runits ) {
  if (["d", "w", "m", "y"].indexOf(runits) < 0) {
    logger.error("bsandbox.setRateUnits: Invalid rate units!")
    return
  }
  if (!gol.bb || !gol.bb.params || 
      ["d", "w", "m", "y"].indexOf(gol.bb.params.runits) < 0) {
    logger.error(
      "bsandbox.setRateUnits: No goal loaded or invalid current runits!")
    return
  }

  saveState()

  const oldunits = gol.bb.params.runits
  const factor = bu.SECS[runits] / bu.SECS[oldunits]
  gol.bb.params.runits = runits
  gol.runits = runits
  if (bu.nummy(gol.bb.params.rfin)) 
    gol.bb.params.rfin = Number(gol.bb.params.rfin) * factor

  if (bu.listy(gol.bb.params.road)) {
    gol.bb.params.road = gol.bb.params.road.map(row => {
      if (!Array.isArray(row) || row.length !== 3) return row
      if (!bu.norn(row[2])) return row
      return [row[0], row[1], Number(row[2]) * factor]
    })
  }

  reloadGoal()
}

// Rate should be in value/seconds
function newRate( r ) {
  if (!bu.nummy(r)) return
  saveState()
  // check if there is a road segment ending a week from now
  var asof = bu.dayparse(gol.bb.params.asof)
  var nextweek = bu.daysnap(asof + 6*SID)
  var road = gol.bb.params.road
  var roadlast = bu.dayparse(road[road.length-1][0])

  if (roadlast < nextweek) {
    road.push([bu.dayify(nextweek), null, gol.bb.params.rfin])
  }

  gol.bb.params.rfin = Number(r)
  reloadGoal()
}

const visualProps = 
  ['plotall','steppy','rosy','movingav','aura','hidey','stathead','hashtags']
function setVisualConfig( opts ) {
  visualProps.map(e=>{
    if (opts.hasOwnProperty(e) && typeof opts[e] === "boolean")
      gol.bb.params[e] = opts[e]
  })
  reloadGoal()
}

const goalProps = ['yaw','dir','kyoom','odom','monotone','aggday']
function setGoalConfig( opts ) {
  saveState()
  goalProps.map(e=>{
    if (opts.hasOwnProperty(e)) gol.bb.params[e] = opts[e]
  })
  reloadGoal( false )
}

// new new goal type so that I don't break existing graph.beeminder stuff
// pick a goaltype, initval, and graph/goal params
function newGoal2(gtype, initval, params={}) {
  logger.log(`newGoal2(${gtype}, ${initval})`)
  if (!typefn.hasOwnProperty(gtype)) {
    logger.error("bsandbox.newGoal2: Invalid goal type!")
    return
  }
  if (["d", "w", "m", "y"].indexOf(params.runits) < 0) {
    logger.error("bsandbox.newGoal2: Invalid rate units!")
    return
  }
  if (!bu.nummy(initval)) {
    logger.error("bsandbox.newGoal2: Invalid initval!")
    return
  }
  // if rfin is present, is it a number?
  // if vfin is present, is it a number? 
  // is at least one of them present?
  if (!bu.norn(params.rfin) || !bu.norn(params.vfin) ||
      (params.rfin === null && params.vfin === null)) {
    logger.error("bsandbox.newGoal2: Invalid rfin or vfin!")
    return
  }
  if (!bu.nummy(params.vini)) {
    logger.error("bsandbox.newGoal2: Invalid vini!")
    return
  }

  // gol is a class variable (i.e. global to bsandbox).
  // it holds the div that the graph is to be rendered into, as well as other 
  // defaults and stuff.
  gol.gtype = gtype
  gol.rfin = params.rfin = (params.rfin === null ? null : Number(params.rfin))
  gol.vfin = params.vfin = (params.vfin === null ? null : Number(params.vfin))
  gol.vini = params.vini
  gol.runits = params.runits
  gol.initval = initval
  gol.derails = []

  // 'gtype' function as a macro for a set of graph defaults let's start there
  let defaults = typefn[gtype]()
  defaults.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  defaults.deadline = 0
  defaults.asof = bu.dayify(moment.tz(defaults.timezone)/ 1000)
  defaults.waterbux = "$"+pledges[0]
  defaults.yaxis = defaults.kyoom ? "current cumulative total" : "current value"
  defaults.stathead = false
  defaults.quantum = 1

  // some useful dates
  const now = 
   bu.nowstamp(defaults.timezone, defaults.deadline, bu.dayparse(defaults.asof))
  const nextweek = bu.daysnap(moment.now()/1000 + 7*SID)
  const nextyear = bu.daysnap(moment.now()/1000 + DIY*SID*1.5)

  defaults.tfin = bu.dayify(nextyear)
  defaults.tini = defaults.asof
  defaults.vini = 0

  // ok, now we've set up our defaults merge the passed in params with the 
  // defaults, with user specified values overriding the default ones.
  let merged = {...defaults, ...params}
  //Object.keys(params).forEach(e=>{defaults[e] = params[e]})

  // set up first datapoint; use merged tini. initval is passed in.
  var data = {}
  data = [[
    merged.tini, Number(gol.initval), "initial datapoint of "+gol.initval ]]
  gol.bb = {params: merged, data: data}

  // Delete div contents
  while (gol.div.firstChild) gol.div.removeChild(gol.div.firstChild)
  gol.gdiv = d3.select(gol.div)
  gol.graph = new bgraph(opts)
  clearUndoBuffer()
  reloadGoal()
}

function newGoal( gtype, runits, rfin, vini, buffer, newparams = [] ) {
  logger.log(`newGoal(${gtype}, ${runits}, ${rfin}, ${vini}, ${buffer})`)
  if (!typefn.hasOwnProperty(gtype)) {
    logger.error("bsandbox.newGoal: Invalid goal type!")
    return
  }
  if (["d", "w", "m", "y"].indexOf(runits) < 0) {
    logger.error("bsandbox.newGoal: Invalid rate units!")
    return
  }
  if (!bu.nummy(rfin) || !bu.nummy(vini) || typeof buffer !== "boolean") {
    logger.error("bsandbox.newGoal: Invalid goal parameters!")
    return
  }

  gol.gtype = gtype
  gol.rfin = rfin
  gol.vini = vini
  gol.runits = runits
  gol.buffer = buffer

  let params = typefn[gtype]()
  params.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  params.deadline = 0
  params.asof = bu.dayify(moment.tz(params.timezone)/ 1000)
  const now = 
    bu.nowstamp(params.timezone, params.deadline, bu.dayparse(params.asof))
  const nextweek = bu.daysnap(moment.now()/1000 + 7*SID)
  const nextyear = bu.daysnap(moment.now()/1000 + DIY*SID)
  var data = {}

  params.stathead = false
  params.quantum = 1
  
  params.tfin = bu.dayify(nextyear)
  params.rfin = Number(rfin)
  params.runits = runits
  
  params.tini = params.asof
  params.vini = Number(vini)
  
  params.road = [[buffer?bu.dayify(nextweek):params.asof, null, 0]]

  // Some other defaults
  params.waterbux = "$"+pledges[0]
  params.yoog = "magic_sandbox_username/magic_sandbox_goalname"
  params.imgsz = 696
  params.yaxis = (params.kyoom)?"current cumulative total":"current value"
  //params.ybhp = true
  
  Object.keys(newparams).forEach(e=>{params[e] = newparams[e]})

  data = [[
    params.tini, Number(params.vini), "initial datapoint of "+params.vini  ]]

  gol.bb = { params: params, data: data }
  gol.derails = []
  
  // Delete div contents
  while (gol.div.firstChild) gol.div.removeChild(gol.div.firstChild)
  gol.gdiv = d3.select(gol.div)
  gol.graph = new bgraph(opts)
  clearUndoBuffer()
  reloadGoal()
}

function loadGoalJSON( bbin, newparams = [] ) {
  logger.log(`loadGoalJSON(${bbin})`)

  gol.bb = bu.deepcopy(bbin)
  gol.derails = []
  
  // Delete div contents
  while (gol.div.firstChild) gol.div.removeChild(gol.div.firstChild)
  gol.gdiv = d3.select(gol.div)
  gol.graph = new bgraph(opts)
  clearUndoBuffer()
  reGraph()
}

/** bsandbox object ID for the current instance */
this.id = curid

/** Creates a fresh new goal, replacing the DIV contents with a new graph.
    @method
    @param {String} gtype Goal type. One of the following: 
      "hustler", "fatloser", "biker", "drinker", "gainer", "inboxer".
    @param {String} runits Rate units. One of "d", "w", "m", "y"
    @param {Number} rate Initial road slope in runits
    @param {Number} vini Initial value of the road
    @param {Boolean} buffer Whether to have an initial week-long buffer or not
*/
this.newGoal = newGoal
this.newGoal2 = newGoal2
this.loadGoalJSON = loadGoalJSON
/** Advances the sandbox goal to the next day. Increments asof by 1 day. 
    @method */
this.nextDay = nextDay
this.refresh = reloadGoal
/** Enters a new datapoint to the sandbox goal on the current day
    @method 
    @param {Number} v Datapoint value
    @param {String} c Datapoint comment. Auto-generated if empty string */
this.newData = newData
/** Dials the road slope for the sandbox goal beyond the akrasia horizon
    @method 
    @param {Number} r New rate in runits */
this.newRate = newRate
this.setRateUnits = setRateUnits
this.setVisualConfig = setVisualConfig
this.getVisualConfig = function() {return gol.graph.getVisualConfig()}
this.setGoalConfig = setGoalConfig
this.getGoalConfig = function() {return gol.graph.getGoalConfig()}
this.getTypeFn = function(gtype) {return typefn[gtype]()}
this.undo = undo
this.redo = redo
/** Undoes all edits */
this.undoAll = (reload=true) => {
  while (undoBuffer.length != 0) undo(reload)
  redoBuffer = []
}
this.saveBB = function(linkelt) {
  var source = JSON.stringify(gol.bb)
  //convert svg source to URI data scheme.
  var url = "data:application/json;charset=utf-8,"+encodeURIComponent(source)
  //set url value to a element's href attribute.
  linkelt.href = url
}
this.show = () => gol.graph.show()
this.hide = () => gol.graph.hide()
self.getGraphObj = () => gol.graph

this.undoBufferState = () => {
  return({undo: undoBuffer.length, redo: redoBuffer.length})
}

} // END BSANDBOX --------------------------------------------------------------

return bsandbox

})) // END MAIN ----------------------------------------------------------------
