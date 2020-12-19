/**
 * Javascript implementation of a sandbox for Beeminder goals,
 * provided as a UMD module. Provides a {@link bsandbox} class, which
 * can be used to construct independent sandbox objects each with
 * their own graph object, linked to particular div element on the
 * DOM.<br/>

 * <br/>Copyright © 2017 Uluc Saranli
 @module bsandbox
 @requires d3
 @requires moment
 @requires butil
 @requires broad
 @requires beebrain
 @requires bgraph
 */
;((function (root, factory) {
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
})(this, function (moment, bu, br, bb, bg) {
  'use strict'

// -----------------------------------------------------------------------------
// --------------------------- CONVENIENCE CONSTANTS ---------------------------

  const DIY = 365.25
  const SID = 86400

  // -------------------------------------------------------------
  // ------------------- FACTORY GLOBALS ---------------------
  /** Global counter to Generate unique IDs for multiple bsandbox
   * instances. */
  var gid = 1,

  /** bsandbox object constructor. Creates a beeminder sandbox object,
   * creating a graph on the supplied DIV object in the DOM.

   @memberof module:bsandbox
   @constructs bsandbox
   @param {object} div object on the DOM to create a {@link module:bgraph} instance on
   @param {bool} debug flag turns logging on or off. Default is false.
  */
  bsandbox = function( optsin, debug = true ) {
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
        opts = bu.extend({}, optsin),
        curid = gid
    gid++
    
    bu.extend(opts, {roadEditor:false,
                     maxFutureDays: 365,
                     showFocusRect: false,
                     showContext: false})
    var goal = {div: opts.divGraph}

    var pledges = [0, 5, 10, 30, 90, 270, 810, 2430]
    goal.graph = new bgraph(opts);
    
    function newDoMore() {
      return {yaw:1, dir:1, kyoom:true,
              odom: false, movingav:false, 
              steppy:true, rosy: false, aura: false, aggday: "sum",
              monotone:true}
    }
    function newLoseWeight() {
      return {yaw: -1, dir: -1, kyoom: false,
              odom: false, movingav: true,
              steppy: false, rosy: true, aura: true, aggday: "min",
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
              steppy: false, rosy: true, aura: true, aggday: "max",
              plotall:false, monotone:false }
    }
    function newWhittleDown() {
      return {dir: -1, yaw: -1, kyoom: false,
              odom: false, movingav: false,
              steppy: true, rosy: false, aura: false, aggday: "min",
              plotall:false, monotone:false }
    }
    const typefn = {
      hustler: newDoMore, 
      fatloser: newLoseWeight, 
      biker: newUseOdometer, 
      drinker: newDoLess, 
      gainer: newGainWeight,
      inboxer: newWhittleDown
    }

    var undoBuffer = [], redoBuffer = []
    function undo(reload=true) {
      if (undoBuffer.length == 0) return
      redoBuffer.push(JSON.parse(JSON.stringify({bb:goal.bb, derails:goal.derails})))
      var restore = undoBuffer.pop()
      goal.bb = restore.bb
      goal.derails = restore.derails
      if (reload) reloadGoal()
    }
    function redo(reload=true) {
      if (redoBuffer.length == 0) return
      saveState()
      var restore = redoBuffer.pop()
      goal.bb = restore.bb
      goal.derails = restore.derails
      if (reload) reloadGoal()
    }
    function saveState() {
      undoBuffer.push(JSON.parse(JSON.stringify({bb:goal.bb, derails:goal.derails})))
    }
    function clearUndoBuffer() {
      undoBuffer = []
    }

    function reGraph() {
      let bb = JSON.parse(JSON.stringify(goal.bb))
      bb.params.waterbux = "$"+pledges[Math.min(pledges.length-1, goal.derails.length)]
      goal.graph.loadGoalJSON( bb, false )
    }
    function reloadGoal(undofirst = true) {
      logger.log("bsandbox.reloadGoal(): Regenerating graph ********")
      reGraph()
      // If the goal has derailed, perform rerailments automatically
      if (goal.graph.isLoser()) {
        if (undofirst) {
          logger.log("bsandbox.reloadGoal(): Derailed! Rolling back...")
          undo(false)
          reGraph()
        }
        logger.log("bsandbox.reloadGoal(): Derailed! Rerailing...")
        let cur = goal.graph.curState()
        // Clean up road ahead
        goal.bb.params.road = goal.bb.params.road.filter(e=>(bu.dayparse(e[0])<cur[0]))
        let road = goal.bb.params.road
        var nextweek = bu.daysnap(cur[0]+7*SID)
        var derail = bu.dayify(cur[0])
        road.push([derail, null, cur[2]])
        road.push([derail, Number(cur[1]), null])
        road.push([bu.dayify(nextweek), null, 0])
        goal.bb.data.push([derail,
                           (goal.bb.params.kyoom)?0:Number(cur[1]),
                           "RECOMMITTED at "+derail])

        goal.derails.push(derail)

        reGraph()
      }
      logger.log("bsandbox.reloadGoal(): Done **********************")
    }
    
    function nextDay() {
      saveState()
//      var oldasof
//        = bu.dayify(bu.daysnap(bu.dayparse(goal.bb.params.asof)))
      var newasof
        = bu.dayify(bu.daysnap(bu.dayparse(goal.bb.params.asof)+SID))
//      var ppr = br.ppr(goal.graph.getRoadObj(), goal.graph.getGoalObj(), newasof)
//      console.log(ppr)
//      if (ppr != 0) {
//        if (goal.bb.params.kyoom)
//          goal.bb.data.push([oldasof, Number(ppr),
//                             `PPR (#${goal.bb.data.length})`])
//        else
//          goal.bb.data.push([oldasof,
//                             Number(goal.bb.data[goal.bb.data.length-1][1] + ppr),
//                             `PPR (#${goal.bb.data.length})`])
//        console.log(goal.bb.data)
      //      }
      goal.bb.params.asof = newasof
      reloadGoal()
    }
    
    function newData( v, c ) {
      if (!bu.nummy(v) || !bu.stringy(c)) return;
      saveState()
      goal.bb.data.push([goal.bb.params.asof, Number(v),
                         (c=="")?`Added in sandbox (#${goal.bb.data.length})`:c])
      reloadGoal()
    }
    
    // Rate should be in value/seconds
    function newRate( r ) {
      if (!bu.nummy(r)) return
      saveState()
      // check if there is a road segment ending a week from now
      var asof = bu.dayparse(goal.bb.params.asof)
      var nextweek = bu.daysnap(asof + 7*SID)
      var road = goal.bb.params.road
      var roadlast = bu.dayparse(road[road.length-1][0])

      if (roadlast < nextweek) {
        road.push([bu.dayify(nextweek), null, goal.bb.params.rfin])
      }
      
      goal.bb.params.rfin = Number(r)*bu.SECS[goal.bb.params.runits]
      reloadGoal()
    }

    const visualProps
          = ['plotall','steppy','rosy','movingav','aura','hidey','stathead','hashtags']
    function setVisualConfig( opts ) {
      visualProps.map(e=>{
        if (opts.hasOwnProperty(e) && bu.torf(opts[e])) goal.bb.params[e] = opts[e]
      })
      reloadGoal()
    }

    const goalProps
          = ['yaw','dir','kyoom','odom','monotone','aggday']
    function setGoalConfig( opts ) {
      saveState()
      goalProps.map(e=>{
        if (opts.hasOwnProperty(e)) goal.bb.params[e] = opts[e]
      })
      reloadGoal( false )
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
      if (!bu.nummy(rfin) || !bu.nummy(vini) || !bu.torf(buffer)) {
        logger.error("bsandbox.newGoal: Invalid goal parameters!")
        return
      }
 
      goal.gtype = gtype
      goal.rfin = rfin
      goal.vini = vini
      goal.runits = runits
      goal.buffer = buffer

      let params = typefn[gtype]()
      params.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      params.deadline = 0
      params.asof = bu.dayify(moment.tz(params.timezone)/ 1000)
      const now = bu.nowstamp(params.timezone, params.deadline, bu.dayparse(params.asof))
      const nextweek = bu.daysnap(moment.now()/1000 + 7*SID)
      const nextyear = bu.daysnap(moment.now()/1000 + DIY*SID)
      var data = {}

      params.stathead = false

      params.quantum = 1
      
      //params.ybhp - true
      //params.abslnw = 0

      params.tfin = bu.dayify(nextyear)
      params.rfin = Number(rfin)
      params.runits = runits
      
      params.tini = params.asof
      params.vini = Number(vini)
      
      params.road = [[buffer?bu.dayify(nextweek):params.asof, null, 0]]

      // Some other defaults
      params.waterbux = "$"+pledges[0]
      params.yoog = "test/sandbox"
      params.imgsz = 696
      params.yaxis = (params.kyoom)?"current cumulative total":"current value"
      //params.ybhp = true
      
      Object.keys(newparams).forEach(e=>{params[e] = newparams[e]})

      data = [[params.tini, Number(params.vini), "initial datapoint of "+params.vini]]

      goal.bb = {params: params, data: data}
      goal.derails = []
      
      // Delete div contents
      while (goal.div.firstChild) goal.div.removeChild(goal.div.firstChild);
      goal.gdiv = d3.select(goal.div)
      goal.graph = new bgraph(opts);
      clearUndoBuffer()
      reloadGoal()
    }

    function loadGoalJSON( bbin, newparams = [] ) {
      logger.log(`loadGoalJSON(${bbin})`)

      goal.bb = bu.deepcopy(bbin)
      goal.derails = []
      
      // Delete div contents
      while (goal.div.firstChild) goal.div.removeChild(goal.div.firstChild);
      goal.gdiv = d3.select(goal.div)
      goal.graph = new bgraph(opts);
      clearUndoBuffer()
      reGraph()
    }

    /** bsandbox object ID for the current instance */
    this.id = curid
    
    /** Creates a fresh new goal, replacing the DIV contents with a
        new graph.
        @method
        @param {String} gtype Goal type. One of the following: "hustler", "fatloser", "biker", "drinker", "gainer", "inboxer".
        @param {String} runits Rate units. One of "d", "w", "m", "y"
        @param {Number} rate Initial road slope in runits
        @param {Number} vini Initial value of the road
        @param {Boolean} buffer Whether to have an initial week-long buffer or not
    */
    this.newGoal = newGoal
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
    this.setVisualConfig = setVisualConfig
    this.getVisualConfig = function() {return goal.graph.getVisualConfig()}
    this.setGoalConfig = setGoalConfig
    this.getGoalConfig = function() {return goal.graph.getGoalConfig()}
    this.undo = undo
    this.redo = redo
    /** Undoes all edits */
    this.undoAll = (reload=true) => {
      while (undoBuffer.length != 0) undo(reload)
    }
    this.saveBB = function(linkelt) {
      var source = JSON.stringify(goal.bb)
        //convert svg source to URI data scheme.
        var url = "data:application/json;charset=utf-8,"+encodeURIComponent(source)
        //set url value to a element's href attribute.
        linkelt.href = url
    }
    this.show = function(){goal.graph.show()}
    this.hide = function(){goal.graph.hide()}
    self.getGraphObj = function() {return goal.graph}
    this.undoBufferState = () => {
      return({undo: undoBuffer.length, redo: redoBuffer.length})
    }
  }

  return bsandbox
}))
