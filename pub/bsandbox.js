/*!
 * bsandbox
 *
 * Dependencies: moment, butil, broad, beebrain, bgraph
 * 
 * Javascript implementation of a sandbox for beeminder.
 *
 * The following member variables and methods are exported within
 * constructed objects:
 *
 *  id         : bsandbox instance ID 
 *
 * Copyright © 2017 Uluc Saranli
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
    module.exports = factory(require('moment'), require('./butil'), 
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

  bsandbox = function( div ) {
    //console.debug("beebrain constructor ("+gid+"): ");
    var self = this,
        curid = gid
    gid++
    
    var goal = {div: div}

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
      gainer: newGainWeight, inboxer: newWhittleDown
    }

    var undoBuffer = []
    function undo(reload=true) {
      if (undoBuffer.length == 0) return
      goal.bb = undoBuffer.pop()
      if (reload) reloadGoal()
    }
    function saveState() {
      undoBuffer.push(JSON.parse(JSON.stringify(goal.bb)))
    }
    function clearUndoBuffer() {
      undoBuffer = []
    }

    function reloadGoal() {
      console.log("bsandbox.reloadGoal(): Regenerating graph ********")
      let bb = JSON.parse(JSON.stringify(goal.bb))
      goal.graph.loadGoalJSON( bb )
      // If the goal has derailed, perform rerailments automatically
      if (goal.graph.isLoser()) {
        console.log("bsandbox.reloadGoal(): Derailed! Rolling back...")
        undo(false)
        let bb = JSON.parse(JSON.stringify(goal.bb))
        goal.graph.loadGoalJSON( bb )

        console.log("bsandbox.reloadGoal(): Derailed! Rerailing...")
        let cur = goal.graph.curState()
        // Clean up road ahead
        goal.bb.params.road = goal.bb.params.road.filter(e=>(bu.dayparse(e[0])<cur[0]))
        let road = goal.bb.params.road
        var nextweek = bu.daysnap(cur[0]+7*bu.SID)
        road.push([bu.dayify(cur[0]), null, cur[2]])
        road.push([bu.dayify(cur[0]), Number(cur[1]), null])
        road.push([bu.dayify(nextweek), null, 0])
        goal.bb.data.push([bu.dayify(cur[0]),
                           (goal.bb.params.kyoom)?0:Number(cur[1]), "RECOMMITTED"])

        bb = JSON.parse(JSON.stringify(goal.bb))
        goal.graph.loadGoalJSON( bb )
      }
      console.log("bsandbox.reloadGoal(): Done **********************")
    }
    
    function nextDay() {
      saveState()
      goal.bb.params.asof
        = bu.dayify(bu.daysnap(bu.dayparse(goal.bb.params.asof)+bu.SID))
      reloadGoal()
    }
    
    function newData( v ) {
      if (!bu.nummy(v)) return;
      saveState()
      goal.bb.data.push([goal.bb.params.asof, Number(v),
                         `Added in sandbox (#${goal.bb.data.length})`])
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
            = ['plotall', 'steppy', 'rosy', 'movingav', 'aura', 'hidey', 'stathead']
    function setVisualConfig( opts ) {
      visualProps.map(e=>{
        if (opts.hasOwnProperty(e) && bu.torf(opts[e])) goal.bb.params[e] = opts[e]
      })
      reloadGoal()
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
      params.rfin = Number(rfin) * params.yaw
      params.runits = runits
      
      params.tini = params.asof
      params.vini = Number(vini)

      params.road = [[buffer?bu.dayify(nextweek):params.asof, null, 0]]

      // Some other defaults
      params.deadline = 0
      params.waterbux = "$0"
      params.yoog = "test/sandbox"
      params.timezone = "America/Los_Angeles"
      params.imgsz = 696
      params.yaxis = (params.kyoom)?"current cumulative total":"current value"

      data = [[params.tini, Number(params.vini), "initial datapoint of "+params.vini]]

      goal.bb = {params: params, data: data}
      
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
    self.id = curid
    self.newGoal = newGoal
    self.nextDay = nextDay
    self.newData = newData
    self.newRate = newRate
    self.setVisualConfig = setVisualConfig
    self.getVisualConfig = function() {return goal.graph.getVisualConfig()}
    self.undo = undo
  }

  return bsandbox
}))
