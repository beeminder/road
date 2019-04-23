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
  */
  bsandbox = function( div ) {
    //console.debug("beebrain constructor ("+gid+"): ");
    var self = this,
        curid = gid
    gid++
    
    var goal = {div: div}

    var pledges = [0, 5, 10, 30, 90, 270, 810, 2430]
    
    function newDoMore() {
      return {yaw:1, dir:1, kyoom:true,
              odom: false, movingav:false, 
              steppy:true, rosy: false, aura: false, aggday: "sum",
              integery:false, monotone:true}
    }
    function newLoseWeight() {
      return {yaw: -1, dir: -1, kyoom: false,
              odom: false, movingav: true,
              steppy: false, rosy: true, aura: true, aggday: "min",
              plotall:false, integery:false, monotone:false }
    }
    function newUseOdometer() {
      return {yaw:1, dir: 1, kyoom: false,
              odom: true, movingav: false,
              steppy: true, rosy: false, aura: false, aggday: "last",
              integery:false, monotone:true }
    }
    function newDoLess() {
      return {yaw: -1, dir: 1, kyoom: true,
              odom: false, movingav: false,
              steppy: true, rosy: false, aura: false, aggday: "sum",
              integery:false, monotone:true }
    }
    function newGainWeight() {
      return {yaw: 1, dir: 1, kyoom: false,
              odom: false, movingav: true, 
              steppy: false, rosy: true, aura: true, aggday: "max",
              plotall:false, integery:false, monotone:false }
    }
    function newWhittleDown() {
      return {dir: -1, yaw: -1, kyoom: false,
              odom: false, movingav: false,
              steppy: true, rosy: false, aura: false, aggday: "min",
              plotall:false, integery:true, monotone:false }
    }
    const typefn = {
      hustler: newDoMore, 
      fatloser: newLoseWeight, 
      biker: newUseOdometer, 
      drinker: newDoLess, 
      gainer: newGainWeight,
      inboxer: newWhittleDown
    }

    var undoBuffer = []
    function undo(reload=true) {
      if (undoBuffer.length == 0) return
      var restore = undoBuffer.pop()
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
      goal.graph.loadGoalJSON( bb )
    }
    function reloadGoal(undofirst = true) {
      console.log("bsandbox.reloadGoal(): Regenerating graph ********")
      reGraph()
      // If the goal has derailed, perform rerailments automatically
      if (goal.graph.isLoser()) {
        if (undofirst) {
          console.log("bsandbox.reloadGoal(): Derailed! Rolling back...")
          undo(false)
          reGraph()
        }
        console.log("bsandbox.reloadGoal(): Derailed! Rerailing...")
        let cur = goal.graph.curState()
        // Clean up road ahead
        goal.bb.params.road = goal.bb.params.road.filter(e=>(bu.dayparse(e[0])<cur[0]))
        let road = goal.bb.params.road
        var nextweek = bu.daysnap(cur[0]+7*bu.SID)
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
      console.log("bsandbox.reloadGoal(): Done **********************")
    }
    
    function nextDay() {
      saveState()
      goal.bb.params.asof
        = bu.dayify(bu.daysnap(bu.dayparse(goal.bb.params.asof)+bu.SID))
      reloadGoal()
    }
    
    function newData( v, c ) {
      if (!bu.nummy(v) || !bu.stringy(c)) return;
      saveState()
      goal.bb.data.push([goal.bb.params.asof, Number(v),
                         (c=="")?`Added in sandbox (#${goal.bb.data.length})`:c])
      reloadGoal()
    }
    
    function newRate( r ) {
      if (!bu.nummy(r)) return
      saveState()
      // check if there is a road segment ending a week from now
      var asof = bu.dayparse(goal.bb.params.asof)
      var nextweek = bu.daysnap(asof + 7*bu.SID)
      var road = goal.bb.params.road
      var roadlast = bu.dayparse(road[road.length-1][0])

      if (roadlast < nextweek) {
        road.push([bu.dayify(nextweek), null, goal.bb.params.rfin])
      }
      goal.bb.params.rfin = Number(r)
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
          = ['offred','yaw','dir','kyoom','odom','noisy','integery','monotone','aggday']
    function setGoalConfig( opts ) {
      saveState()
      goalProps.map(e=>{
        if (opts.hasOwnProperty(e)) goal.bb.params[e] = opts[e]
      })
      reloadGoal( false )
    }

    function newGoal( gtype, runits, rfin, vini, buffer ) {
      //console.log(`newGoal(${gtype}, ${runits}, ${rfin}, ${vini}, ${buffer})`)
      if (!typefn.hasOwnProperty(gtype)) {
        console.error("bsandbox.newGoal: Invalid goal type!")
        return
      }
      if (["d", "w", "m", "y"].indexOf(runits) < 0) {
        console.error("bsandbox.newGoal: Invalid rate units!")
        return
      }
      if (!bu.nummy(rfin) || !bu.nummy(vini) || !bu.torf(buffer)) {
        console.error("bsandbox.newGoal: Invalid goal parameters!")
        return
      }

      goal.gtype = gtype
      goal.rfin = rfin
      goal.vini = vini
      goal.runits = runits
      goal.buffer = buffer
      var now = bu.daysnap(moment.now()/1000)
      var nextweek = bu.daysnap(moment.now()/1000 + 7*bu.SID)
      var nextyear = bu.daysnap(moment.now()/1000 + bu.DIY*bu.SID)

      var params = typefn[gtype]()
      var data = {}

      params.stathead = false
      
      params.asof = bu.dayify(now)

      params.tfin = bu.dayify(nextyear)
      params.rfin = Number(rfin)
      params.runits = runits
      
      params.tini = params.asof
      params.vini = Number(vini)

      params.road = [[buffer?bu.dayify(nextweek):params.asof, null, 0]]

      // Some other defaults
      params.deadline = 0
      params.waterbux = "$"+pledges[0]
      params.yoog = "test/sandbox"
      params.timezone = "America/Los_Angeles"
      params.imgsz = 696
      params.yaxis = (params.kyoom)?"current cumulative total":"current value"

      data = [[params.tini, Number(params.vini), "initial datapoint of "+params.vini]]

      goal.bb = {params: params, data: data}
      goal.derails = []
      
      // Delete div contents
      while (goal.div.firstChild) goal.div.removeChild(goal.div.firstChild);
      goal.gdiv = d3.select(goal.div).append('div')
      goal.graph = new bgraph({divGraph: goal.gdiv.node(),
                               roadEditor:false,
                               svgSize: { width: 696, height: 453 },
                               focusRect: { x:0, y:0, width:690, height: 453 },
                               ctxRect: { x:0, y:453, width:690, height: 40 },
                               maxFutureDays: 365,
                               showFocusRect: false,
                               showContext: false});
      clearUndoBuffer()
      reloadGoal()
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
    /** Advances the sandbox goal to the next day. Increments asof by 1 day. 
        @method */
    this.nextDay = nextDay
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
    this.saveBB = function(linkelt) {
      var source = JSON.stringify(goal.bb)
        //convert svg source to URI data scheme.
        var url = "data:application/json;charset=utf-8,"+encodeURIComponent(source)
        //set url value to a element's href attribute.
        linkelt.href = url
    }
    self.getGraphObj = function() {return goal.graph}
  }

  return bsandbox
}))
