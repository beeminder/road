/**
 * Javascript implementation of graph generation and editing for
 * beebrain, provided as a UMD module. Provides a {@link bgraph}
 * class, which can be used to construct independent graph generating
 * objects each with their own internal state, possibly linked to
 * particular div elements on the DOM.<br/>

 * <br/>Copyright © 2017 Uluc Saranli
 @module bgraph
 @requires d3
 @requires moment
 @requires butil
 @requires broad
 @requires beebrain
 */
;((function (root, factory) {
  'use strict'
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    //console.log("bgraph: Using AMD module definition")
    define(['d3', 'moment', 'butil', 'broad', 'beebrain'], factory)
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.    
    //console.log("bgraph: Using CommonJS module.exports")
    module.exports = factory(require('d3'), require('moment'), require('./butil'), 
                             require('./broad'), require('./beebrain'))
  } else {
    //console.log("bgraph: Using Browser globals")
    root.bgraph = factory(root.d3, root.moment, root.butil, root.broad, root.beebrain)
  }
})(this, function (d3, moment, bu, br, bb) {
  'use strict'

  // -------------------------------------------------------------
  // ------------------- FACTORY GLOBALS ---------------------
  /** Global counter to Generate unique IDs for multiple bgraph instances. */
  var
  gid = 1,

  /** Default settings */
  defaults = {
    /** Generates an empty graph and JSON */
    noGraph:      false,
    /** Binds the graph to a div element */
    divGraph:     null,
    /** Binds the road table to a div element */
    divTable:     null,    
    /** Binds the goal JSON output to a div element */
    divJSON:      null,    
    /** Size of the SVG element to hold the graph */
    svgSize:      { width: 700, height: 450 },
    /** Boundaries of the SVG group to hold the focus graph */
    focusRect:    { x:0, y:0, width:700, height: 370 },
    /** Initial padding within the focus graph. */
    focusPad:     { left:25, right:5, top:25, bottom:30 },
    /** Boundaries of the SVG group to hold the context graph */
    ctxRect:      { x:0, y:370, width:700, height: 80 },
    /** Initial padding within the context graph. */
    ctxPad:       { left:25, right:5, top:0, bottom:30 },
    /** Height of the road matrix table. Choose 0 for unspecified */
    tableHeight:  387,
    
    /** Visual parameters for the zoom in/out buttons. "factor" 
        indicates how much to zoom in/out per click. */
    zoomButton:   { size: 40, opacity: 0.6, factor: 1.5 },
    /** Size of the bullseye image in the focus and context graphs */ 
    bullsEye:     { size: 40, ctxsize: 20 },
    /** Visual parameters for draggable road dots */ 
    roadDot:      { size: 5, ctxsize: 3, border: 1.5, ctxborder: 1 },
    /** Visual parameters for draggable road knots and removal buttons */ 
    roadKnot:     { width: 3, rmbtnscale: 0.6 },
    /** Visual parameters for draggable road lines */ 
    roadLine:     { width: 3, ctxwidth: 2 },
    /** Visual parameters for fixed lines for the original road */ 
    oldRoadLine:  { width: 3, ctxwidth: 2, dash: 32, ctxdash: 16 },
    /** Visual parameters for data points (past, flatlined and hollow) */ 
    dataPoint:    { size: 5, fsize: 5, hsize: 2.5 }, 
    /** Visual parameters for the akrasia horizon */ 
    horizon:      { width: 2, ctxwidth: 1, dash: 8, ctxdash: 6, 
                    font: 10, ctxfont: 9 },
    /** Visual parameters for vertical line for asof */ 
    today:        { width: 2, ctxwidth: 1, font: 12, ctxfont: 9 },
    /** Visual parameters for watermarks */ 
    watermark:    { height:170, fntsize:150, color:"#f0f0f0" },
    guidelines:   { width:2, weekwidth:4 },
    /** Visual parameters for text boxes shown during dragging */ 
    textBox:      { margin: 3 },
    /** Visual parameters for odometer resets */ 
    odomReset:    { width: 0.5, dash: 8 },
    
    roadLineCol:  { valid: "black", invalid:"#ca1212", selected:"yellow"},
    roadDotCol:   { fixed: "darkgray", editable:"#c2c2c2", 
                    selected: "yellow"},
    roadKnotCol:  { dflt: "#c2c2c2", selected: "yellow", 
                    rmbtn: "black", rmbtnsel: "red"}, 
    textBoxCol:   { bg: "#ffffff", stroke:"#d0d0d0"},
    roadTableCol: { bg:"#ffffff", bgHighlight: "#fffb55", 
                    text:"#000000", textDisabled: "#aaaaaa",
                    bgDisabled:"#f2f2f2"},
    dataPointCol: { future: "#909090", stroke: "lightgray"},
    halfPlaneCol: { fill: "#ffffe8" },
    pastBoxCol:   { fill: "#f8f8f8", opacity:0.5 },
    odomResetCol: { dflt: "#c2c2c2" }, 
    
    /** Strips the graph of all details except what is needed for svg
        output. */
    headless:        false,
    
    /** Enables zooming by scrollwheel. When disabled, only the
        context graph and the zoom buttons will allow zooming. */
    scrollZoom:        true,
    
    /** Enables the road editor. When disabled, the generated graph
        mirrors beebrain output as closely as possible. */
    roadEditor:        false,
    
    /** Enables the display of the context graph within the SVG */
    showContext:       false,
    
    /** Enables showing a dashed rectange in the context graph
        visualizing the current graph limits on the y-axis */
    showFocusRect:     false,
    
    /** Enables displaying datapoints on the graph */ 
    showData:          true,
    
    /** When datapoint display is enabled, indicates the number of
        days before asof to show data for. This can be used to speed up
        display refresh for large goals. Choose -1 to display all
        datapoints. */ 
    maxDataDays:   -1, // Choose -1 to show all points
    
    /** Indicates how many days beyond asof should be included in the
        fully zoomed out graph. This is useful for when the goal date is
        too far beyond asof, making the context graph somewhat useless in
        terms of its interface utility. */
    maxFutureDays: 365,
    
    /** Indicates whether slopes for segments beyond the currently
        dragged element should be kept constant during editing. */
    keepSlopes:        true,
    
    /** Indicates whether intervals between the knots for segments
        beyond the currently dragged element should be kept constant
        during editing. */
    keepIntervals:     false,
    
    /** Indicates whether the road matrix table should be shown with
        the earliest rows first (normal) or most recent rows first
        (reversed). */ 
    reverseTable:      false,
    
    /** Indicates whether the auto-scrolling feature for the road
        matrix table should be enabled such that when the mouse moves
        over knots, dots or road elements, the corresponding table row is
        scrolled to be visible in the table. This is particularly useful
        when tableHeight is explicitly specified and is nonzero. */ 
    tableAutoScroll:   true,
    
    /** Chooses whether the road matrix table should be dynamically
        updated during the dragging of road knots, dots and
        segments. Enabling this may induce some lagginess, particularly
        on Firefox due to more components being updated during
        dragging */
    tableUpdateOnDrag: false,
    
    /** Chooses whether the road matrix table should include checkboxes 
        for choosing the field to be automatically computed. */
    tableCheckboxes: false,
    
    /** Callback function that gets invoked when the road is edited by
        the user. Various interface functions can then be used to
        retrieve the new road state. This is also useful to update the
        state of undo/redo and submit buttons based on how many edits
        have been done on the original road. */
    onRoadChange: null,

    /** Callback function that gets invoked when an error is encountered 
        in loading, processing, drawing or editing the road. */
    onError: null
  },

  /** This object defines default options for mobile browsers, where
   larger dots, knots and roads are necessary to make editing through
   dragging feasible. */
  mobiledefaults = {
    svgSize:      { width: 700, height: 530 },
    focusRect:    { x:0, y:0, width:700, height: 400 },
    focusPad:     { left:25, right:10, top:35, bottom:30 },
    ctxRect:  { x:0, y:400, width:700, height: 80 },
    ctxPad:   { left:25, right:10, top:0, bottom:30 },
    tableHeight:  540, // Choose 0 for unspecified

    zoomButton:   { size: 50, opacity: 0.7, factor: 1.5 },
    bullsEye:     { size: 40, ctxsize: 20 },
    roadDot:      { size: 10, ctxsize: 4, border: 1.5, ctxborder: 1 },
    roadKnot:     { width: 7, rmbtnscale: 0.9 },
    roadLine:     { width: 7, ctxwidth: 2 },
    oldRoadLine:  { width: 3, ctxwidth: 1, dash: 32, ctxdash: 16  },
    dataPoint:    { size: 4, fsize: 6 }, 
    horizon:      { width: 2, ctxwidth: 1, dash: 8, ctxdash: 8, 
                    font: 14, ctxfont: 10 },
    today:        { width: 2, ctxwidth: 1, font: 16, ctxfont: 10 },
    watermark:    { height:150, fntsize:100, color:"#f0f0f0" },
    guidelines:   { width:2, weekwidth:4 },
    textBox:      { margin: 3 }
  },
  
  /** This style text gets embedded into the SVG object to enable proper saving of the SVG */
  SVGStyle = ".svg {shape-rendering: crispEdges;} .axis path, .axis line { fill: none; stroke: black; shape-rendering: crispEdges;} .axis .minor line { stroke: #777; stroke-dasharray:0,2,4,3; } .grid line { fill: none; stroke: #dddddd; stroke-width: 1px; shape-rendering: crispEdges; } .grid .minor line { stroke: none; } .axis text { font-family: sans-serif; font-size: 11px; } .axislabel { font-family: sans-serif; font-size: 11px; text-anchor: middle; } circle.dots { stroke: black; } line.roads { stroke: black; } .pasttext, .ctxtodaytext, .ctxhortext, .horizontext, .hashtag { text-anchor: middle; font-family: sans-serif; } .waterbuf, .waterbux { text-anchor: middle; font-family: Dejavu Sans,sans-serif; }.loading { text-anchor: middle; font-family: Dejavu Sans,sans-serif; } .zoomarea { fill: none; }",

  /** Fraction of plot range that the axes extend beyond */
  PRAF  = .015,

  /** paths for various PNG images used within the SVG */
  PNG = { beye: "https://s3.amazonaws.com/bmndr/road/bullseye.png", 
          beyey: "https://s3.amazonaws.com/bmndr/road/bullseye_prev.png",
          skl: "https://s3.amazonaws.com/bmndr/road/jollyroger.png",
          inf: "https://s3.amazonaws.com/bmndr/road/infinity.png",
          sml: "https://s3.amazonaws.com/bmndr/road/smiley.png"
        },
  
  /** Enum object to identify error types. */
  ErrType = { NOBBFILE:0, BADBBFILE:1, BBERROR:2  },

  /** Enum object to identify error types. */
  ErrMsgs = [ "Could not find goal file.", "Bad goal file.", "Beeminder error" ],

  /** This function attempts to determine whether the page was loaded
   * from a mobikle device or not. */
  onMobileOrTablet = () => {
    if (typeof navigator == 'undefined' && typeof window == 'undefined') return false
    var check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true})(navigator.userAgent||navigator.vendor||window.opera)
    return check
  },
  
  /** configure functionality (private) */
  config = ( obj, options ) => {
    if (!obj.opts) obj.opts = bu.extend({}, defaults, true)
    
    if (onMobileOrTablet()) bu.extend(obj.opts, mobiledefaults)

    var opts = bu.extend(obj.opts, options, true)
    
    opts.divGraph = (opts.divGraph && opts.divGraph.nodeName)?opts.divGraph : null
    
    if (opts.headless) {
      // Override options for svg output 
      opts.divTable = null
      opts.scrollZoom = false
      opts.roadEditor = false
      opts.showContext = false
      opts.showFocusRect = false
    } else {
      opts.divTable = (opts.divTable && opts.divTable.nodeName)?opts.divTable : null
    }

    return opts
  },
  
  // -------------------------------------------------------------
  // ------------------- BGRAPH CONSTRUCTOR ---------------------
  /** @typedef BGraphOptions
      @global
      @type {object}
      @property {boolean} noGraph Generates an empty graph and JSON if true
      @property {Boolean} headless Strips the graph of all details except what is needed for svg output.
      @property {Boolean} roadEditor Enables the road editor. When disabled, the generated graph mirrors beebrain output as closely as possible.
      
      @property {object}  divJSON  Binds the goal JSON output to a div element

      @property {object}  divGraph Binds the graph to a div element
      @property {object}  svgSize  Size of the SVG element to hold the graph e.g. { width: 700, height: 450 }
      @property {object}  focusRect Boundaries of the SVG group to hold the focus graph e.g. { x:0, y:0, width:700, height: 370 }
      @property {object} focusPad Initial padding within the focus graph e.g. { left:25, right:5, top:25, bottom:30 }
      @property {object} ctxRect Boundaries of the SVG group to hold the context graph e.g. { x:0, y:370, width:700, height: 80 }
      @property {object} ctxPad Initial padding within the context graph e.g. { left:25, right:5, top:0, bottom:30 }
      @property {Boolean} scrollZoom Enables zooming by scrollwheel. When disabled, only the context graph and the zoom buttons will allow zooming.
      @property {Boolean} showContext Enables the display of the context graph within the SVG
      @property {Boolean} showFocusRect Enables showing a dashed rectange in the context graph visualizing the current graph limits on the y-axis
    
      @property {Boolean} keepSlopes Indicates whether slopes for segments beyond the currently dragged element should be kept constant during editing.
      @property {Boolean} keepIntervals Indicates whether intervals between the knots for segments beyond the currently dragged element should be kept constant during editing.
      @property {Boolean} showData Enables displaying datapoints on the graph 
      @property {Integer} maxDataDays When datapoint display is enabled, indicates the number of days before asof to show data for. This can be used to speed up display refresh for large goals. Choose -1 to display all datapoints. Choose -1 to show all points.
      @property {Integer} maxFutureDays Indicates how many days beyond asof should be included in the fully zoomed out graph. This is useful for when the goal date is too far beyond asof, making the context graph somewhat useless in terms of its interface utility.

      @property {object}  divTable Binds the road table to a div element
      @property {Number} tableHeight Height of the road matrix table. Choose 0 for unspecified
      @property {Boolean} tableCheckboxes Chooses whether the road matrix table should include checkboxes for choosing the field to be automatically computed.
      @property {Boolean} reverseTable Indicates whether the road matrix table should be shown with the earliest rows first (normal) or most recent rows first(reversed).
      @property {Boolean} tableAutoScroll Indicates whether the auto-scrolling feature for the road matrix table should be enabled such that when the mouse moves over knots, dots or road elements, the corresponding table row is scrolled to be visible in the table. This is particularly useful when tableHeight is explicitly specified and is nonzero.
      @property {Boolean} tableUpdateOnDrag Chooses whether the road matrix table should be dynamically updated during the dragging of road knots, dots and segments. Enabling this may induce some lagginess, particularly on Firefox due to more components being updated during dragging
    
    
      @property {function} onRoadChange Callback function that gets invoked when the road is edited by the user. Various interface functions can then be used to retrieve the new road state. This is also useful to update the state of undo/redo and submit buttons based on how many edits have been done on the original road.
      @property {function} onError Callback function that gets invoked when an error is encountered  in loading, processing, drawing or editing the road. 

      @property {object} zoomButton Visual parameters for the zoom in/out buttons. "factor" indicates how much to zoom in/out per click. e.g. { size: 40, opacity: 0.6, factor: 1.5 }
      @property {object} bullsEye Size of the bullseye image in the focus and context graphs e.g. { size: 40, ctxsize: 20 }
      @property {object} roadDot Visual parameters for draggable road dots e.g. { size: 5, ctxsize: 3, border: 1.5, ctxborder: 1 }
      @property {object} roadKnot Visual parameters for draggable road knots and removal buttons e.g. { width: 3, rmbtnscale: 0.6 }
      @property {object} roadLine Visual parameters for draggable road lines e.g. { width: 3, ctxwidth: 2 }
      @property {object} oldRoadLine Visual parameters for fixed lines for the original road e.g. { width: 3, ctxwidth: 2, dash: 32, ctxdash: 16 }
      @property {object} dataPoint Visual parameters for data points (past, flatlined and hollow) e.g. { size: 5, fsize: 5, hsize: 2.5 }
      @property {object} horizon Visual parameters for the akrasia horizon e.g. { width: 2, ctxwidth: 1, dash: 8, ctxdash: 6, font: 12, ctxfont: 9 }
      @property {object} today Visual parameters for vertical line for asof  e.g. { width: 2, ctxwidth: 1, font: 12, ctxfont: 9 }
      @property {object} watermark Visual parameters for watermarks e.g. { height:170, fntsize:130 }
      @property {object} guidelines Visual parameters for guidelines e.g. { width:2, weekwidth:4 }
      @property {object} textBox Visual parameters for text boxes shown during dragging e.g. { margin: 3 }
      @property {object} odomReset Visual parameters for odometer resets e.g. { width: 0.5, dash: 8 }
      

    @property {object} roadLineCol Colors for road segments for the editor, e.g. { valid: "black", invalid:"#ca1212", selected:"yellow"}
    @property {object} roadDotCol Colors for the road dots for the editor, e.g. { fixed: "darkgray", editable:"#c2c2c2", selected: "yellow"}
    @property {object} roadKnotCol Colors for the road knots (vertical) for the editor, e.g. { dflt: "#c2c2c2", selected: "yellow", rmbtn: "black", rmbtnsel: "red"}
    @property {object} textBoxCol Colors for text boxes e.g. { bg: "#ffffff", stroke:"#d0d0d0"}
    @property {object} roadTableCol Colors for the road table e.g. { bg:"#ffffff", bgHighlight: "#fffb55", text:"#000000", textDisabled: "#aaaaaa", bgDisabled:"#f2f2f2"}
    @property {object} dataPointCol Colors for datapoints, e.g. { future: "#909090", stroke: "lightgray"}
    @property {object} halfPlaneCol Colors for the yellow brick half plane. e.g. { fill: "#ffffe8" }
    @property {object} pastBoxCol Colors for the past, e.g. { fill: "#f8f8f8", opacity:0.5 }
    @property {object} odomResetCol Colors for odometer reset indicators, e.g. { dflt: "#c2c2c2" }
    
*/

  /** bgraph object constructor. Creates an empty beeminder graph
   * and/or road matrix table with the supplied options. Particular
   * goal details may later be loaded with {@link bgraph~loadGoal} or {@link
   * loadGoalFromURL} functions.

   @memberof module:bgraph
   @constructs bgraph
   @param {BGraphOptions} options JSON input with various graph options
  */
  bgraph = function( options ) {
    //console.debug("beebrain constructor ("+gid+"): ")
    var self = this,
        opts = config(self, options),
        curid = gid
    gid++

    // Various dimensions and boxes
    var yaxisw = 50,
        sw = opts.svgSize.width,
        sh = opts.svgSize.height,
        plotbox, brushbox, plotpad, contextpad

    var zoombtnsize = opts.zoomButton.size,
        zoombtnscale = zoombtnsize / 540,
        zoombtntr

    // Graph components
    var svg, defs, graphs, buttonarea, stathead, focus, focusclip, plot,
        context, ctxclip, ctxplot, 
        xSc, nXSc, xAxis, xAxisT, xGrid, xAxisObj, xAxisObjT, xGridObj,
        ySc, nYSc, yAxis, yAxisR, yAxisObj, yAxisObjR, yAxisLabel,
        xScB, xAxisB, xAxisObjB, yScB, 
        gPB, gYBHP, gPink, gGrid, gOResets, gPastText, 
        gOldRoad, gOldCenter, gOldGuides, gOldBullseye, 
        gKnots, gSteppy, gSteppyPts, gRosy, gRosyPts, gMovingAv,
        gAura, gDerails, gAllpts, gDpts, gHollow, gFlat, 
        gBullseye, gRoads, gDots,  gWatermark, gHashtags, gHorizon, gHorizonText, 
        zoomarea, axisZoom, zoomin, zoomout,  
        brushObj, brush, focusrect, topLeft,
        scf = 1, oldscf = 0

    // Internal state for the graph
    var lastError = null,
        undoBuffer = [], // Array of previous roads for undo
        redoBuffer = [], // Array of future roads for redo
        processing = false, 
        loading = false,
        hidden = false,
        mobileOrTablet = onMobileOrTablet(),
        dataf, alldataf,
        horindex = null, // Road segment index including the horizon
        iroad = []  // Initial road 
    
    // Beebrain state objects
    var bbr, goal = {}, road = [],
        data = [], alldata = []
    
    function resetGoal() {
      // Initialize goal with sane values
      goal = {}
      goal.yaw = +1; goal.dir = +1
      goal.tcur = 0; goal.vcur = 0
      var now = moment.utc()
      now.hour(0); now.minute(0); now.second(0); now.millisecond(0)
      goal.asof = now.unix()
      goal.horizon = goal.asof+bu.AKH
      goal.xMin = goal.asof;  goal.xMax = goal.horizon
      goal.tmin = goal.asof;  goal.tmax = goal.horizon
      goal.yMin = -1;    goal.yMax = 1

      road = []; iroad = []; data = [], alldata = []
    }
    resetGoal()
    
    function computeBoxes() {
      plotpad = bu.extend({}, opts.focusPad)
      contextpad = bu.extend({}, opts.ctxPad)
      plotpad.left += yaxisw
      plotpad.right += yaxisw+(goal.hidey?8:0) // Extra padding if y axis text is hidden
      contextpad.left += yaxisw
      contextpad.right += yaxisw
      plotbox = {
        x:     opts.focusRect.x + plotpad.left,
        y:     opts.focusRect.y + plotpad.top,
        width: opts.focusRect.width
          - plotpad.left - plotpad.right, 
        height:opts.focusRect.height
          - plotpad.top - plotpad.bottom
      }
      brushbox = {
        x:     opts.ctxRect.x + contextpad.left,
        y:     opts.ctxRect.y + contextpad.top,
        width: opts.ctxRect.width
          - contextpad.left - contextpad.right, 
        height:opts.ctxRect.height
          - contextpad.top - contextpad.bottom
      }
      zoombtntr = {botin:"translate("+(plotbox.width-2*(zoombtnsize+5))
                   +","+(plotbox.height-(zoombtnsize+5))
                   +") scale("+zoombtnscale+","+zoombtnscale+")",
                   botout:"translate("+(plotbox.width-(zoombtnsize+5))
                   +","+(plotbox.height-(zoombtnsize+5))
                   +") scale("+zoombtnscale+","+zoombtnscale+")",
                   topin:"translate("+(plotbox.width-2*(zoombtnsize+5))
                   +",5) scale("+zoombtnscale+","+zoombtnscale+")",
                   topout:"translate("+(plotbox.width-(zoombtnsize+5))
                   +",5) scale("+zoombtnscale+","+zoombtnscale+")"}
    }
    computeBoxes()

    /** Utility function to show a shaded overlay with a message 
     consisting of multiple lines supplied in the array argument */
    function showOverlay( msgs, fs = -1, fw="bold",
                          box=null, cls="overlay", shd = true) {
      if (opts.divGraph == null) return
      if (box == null) box ={x:sw/20, y:sh/5, w:sw-2*sw/20, h:sh-2*sh/5}
      var pg = svg.select("g."+cls)
      if (pg.empty()) {
        pg = svg.append('g').attr('class', cls)
        if (shd) {
          pg.append('svg:rect')
            .attr('x', 0).attr('y',0)
            .attr('width', sw).attr('height',sh)
            .style('fill', bu.Cols.WITE)
            .style('fill-opacity', 0.5)
        }
        pg.append('svg:rect')
          .attr('x', box.x).attr('y',box.y)
          .attr('width', box.w).attr('height',box.h)
          .attr('rx', 5)
          .attr('ry', 5)
          .style('stroke', bu.Cols.BLCK)
          .style('stroke-width', 1)
          .style('fill', "#ffffcc")
          .style('fill-opacity', 0.9)
      }
      pg.selectAll(".loading").remove()
      var nummsgs = msgs.length
      if (fs < 0) fs = sh/15
      var lh = fs * 1.1
      for (let i = 0; i < nummsgs; i++) {
        pg.append('svg:text').attr('class', 'loading')
          .attr('x', sw/2)
          .attr('y',(box.y+box.h/2) - ((nummsgs-1)*lh)/2+i*lh+fs/2-3)
          .attr('font-size', fs)
          .style('font-size', fs)
          .style('font-weight', fw)
          .text(msgs[i])
      }
    }
    function removeOverlay(cls = "overlay") {
      //console.debug("removeOverlay("+self.id+")")
      if (opts.divGraph == null) return
      svg.selectAll("g."+cls).remove()
    }

    function createGraph() {
      var div = opts.divGraph
      if (div === null) return
      // First, remove all children from the div
      while (div.firstChild) div.removeChild(div.firstChild)

      // Initialize the div and the SVG
      svg = d3.select(div).attr("class", "bmndrgraph")
	      .append('svg:svg')
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .attr('width', sw).attr('height', sh)
	      .attr('class', 'bmndrsvg')

      // Common SVG definitions, including clip paths
      defs = svg.append('defs')
      defs.insert('style').attr('type','text/css').text(SVGStyle)
      defs.append("clipPath")
        .attr("id", "plotclip"+curid)
        .append("rect").attr("x", 0).attr("y", 0)
        .attr("width", plotbox.width).attr("height", plotbox.height)
      defs.append("clipPath")
        .attr("id", "brushclip"+curid)
        .append("rect").attr("x", 0).attr("y", 0)
        .attr("width", brushbox.width).attr("height", brushbox.height)
      defs.append("clipPath")
        .attr("id", "buttonareaclip"+curid)
        .append("rect").attr("x", plotbox.x).attr("y", 0)
        .attr("width", plotbox.width).attr("height", plotpad.top)

      defs.append("path")
        .style("stroke", "none").attr("id", "rightarrow")
        .attr("d", "M 55,0 -35,45 -35,-45 z")
      
      defs.append("path")
        .style("stroke", "none").attr("id", "downarrow")
        .attr("d", "M 0,40 45,-50 -45,-50 z")
      
      defs.append("path")
        .style("stroke", "none").attr("id", "uparrow")
        .attr("d", "M 0,-40 45,50 -45,50 z")
      
      var buttongrp = defs.append("g")
            .attr("id", "removebutton")
      buttongrp.append("circle")
        .attr("cx", 14).attr("cy", 14)
        .attr("r", 16).attr('fill', 'white')
      buttongrp.append("path")
        .attr("d", "M13.98,0C6.259,0,0,6.261,0,13.983c0,7.721,6.259,13.982,13.98,13.982c7.725,0,13.985-6.262,13.985-13.982C27.965,6.261,21.705,0,13.98,0z M19.992,17.769l-2.227,2.224c0,0-3.523-3.78-3.786-3.78c-0.259,0-3.783,3.78-3.783,3.78l-2.228-2.224c0,0,3.784-3.472,3.784-3.781c0-0.314-3.784-3.787-3.784-3.787l2.228-2.229c0,0,3.553,3.782,3.783,3.782c0.232,0,3.786-3.782,3.786-3.782l2.227,2.229c0,0-3.785,3.523-3.785,3.787C16.207,14.239,19.992,17.769,19.992,17.769z")
      
      var zoomingrp = defs.append("g")
            .attr("id", "zoominbtn")
      if (!opts.headless) {
        // Zoom buttons are not visible for SVG output in headless mode
        zoomingrp.append("path").style("fill", "white")
          .attr("d", "m 530.86356,264.94116 a 264.05649,261.30591 0 1 1 -528.1129802,0 264.05649,261.30591 0 1 1 528.1129802,0 z")
        zoomingrp.append("path")
          .attr("d", "m 308.21,155.10302 -76.553,0 0,76.552 -76.552,0 0,76.553 76.552,0 0,76.552 76.553,0 0,-76.552 76.552,0 0,-76.553 -76.552,0 z m 229.659,114.829 C 537.869,119.51007 420.50428,1.9980234 269.935,1.9980234 121.959,1.9980234 2.0000001,121.95602 2.0000001,269.93202 c 0,147.976 117.2473599,267.934 267.9339999,267.934 150.68664,0 267.935,-117.51205 267.935,-267.934 z m -267.935,191.381 c -105.681,0 -191.381,-85.7 -191.381,-191.381 0,-105.681 85.701,-191.380996 191.381,-191.380996 105.681,0 191.381,85.700996 191.381,191.380996 0,105.681 -85.7,191.381 -191.381,191.381 z")
      }

      var zoomoutgrp = defs.append("g")
            .attr("id", "zoomoutbtn")
      if (!opts.headless) {
        // Zoom buttons are not visible for SVG output in headless mode
        zoomoutgrp.append("path").style("fill", "white")
          .attr("d", "m 530.86356,264.94116 a 264.05649,261.30591 0 1 1 -528.1129802,0 264.05649,261.30591 0 1 1 528.1129802,0 z")
        zoomoutgrp.append("path")
          .attr("d", "m 155.105,231.65502 0,76.553 229.657,0 0,-76.553 c -76.55233,0 -153.10467,0 -229.657,0 z m 382.764,38.277 C 537.869,119.51007 420.50428,1.9980234 269.935,1.9980234 121.959,1.9980234 2.0000001,121.95602 2.0000001,269.93202 c 0,147.976 117.2473599,267.934 267.9339999,267.934 150.68664,0 267.935,-117.51205 267.935,-267.934 z m -267.935,191.381 c -105.681,0 -191.381,-85.7 -191.381,-191.381 0,-105.681 85.701,-191.380996 191.381,-191.380996 105.681,0 191.381,85.700996 191.381,191.380996 0,105.681 -85.7,191.381 -191.381,191.381 z")
      }

      // Create rectange to monitor zoom events and install handlers
      zoomarea = svg.append('rect')
        .attr("class", "zoomarea")
        .attr("x", plotbox.x).attr("y", plotbox.y)
        .attr("color", bu.Cols.REDDOT)
        .attr("width", plotbox.width).attr("height", plotbox.height)
      axisZoom = d3.zoom()
        .extent([[0, 0], [plotbox.width, plotbox.height]])
        .scaleExtent([1, Infinity])
        .translateExtent([[0, 0], [plotbox.width, plotbox.height]])
        .on("zoom", zoomed)
      zoomarea.call(axisZoom)
      if (onMobileOrTablet()) {
        var pressTimer = null, pressX
        var oldTouchStart = zoomarea.on("touchstart.zoom")
        var oldTouchMove = zoomarea.on("touchmove.zoom")
        var oldTouchEnd = zoomarea.on("touchend.zoom")
        
        zoomarea
          .on("touchstart.zoom", function () { 
            var bbox = this.getBoundingClientRect()
            pressX = d3.event.touches.item(0).pageX - bbox.left
            var newx = nXSc.invert(pressX)
            if (pressTimer == null && d3.event.touches.length == 1) 
              pressTimer = window.setTimeout(
                () => { if (newx != null) addNewDot(newx/1000) },1000)
            oldTouchStart.apply(this, arguments);} )
          .on("touchmove.zoom", function () { window.clearTimeout(pressTimer); pressTimer = null; oldTouchMove.apply(this, arguments)})
          .on("touchend.zoom", function () { clearTimeout(pressTimer); pressTimer = null; oldTouchEnd.apply(this, arguments)} );              
      }
      function dotAdded() {
        var mouse = d3.mouse(svg.node())
        var newx = nXSc.invert(mouse[0]-plotpad.left)
        addNewDot(newx/1000)
      }
      function dotAddedShift() {
        if (d3.event.shiftKey) dotAdded()
        else clearSelection()
        
      }
      if (opts.roadEditor) {
        zoomarea.on("click", dotAddedShift)
        zoomarea.on("dblclick.zoom", dotAdded)
      } else {
        zoomarea.on("dblclick.zoom", null)
      }
      
      focus = svg.append('g')
	      .attr('class', 'focus')
        .attr('transform', 'translate('+opts.focusRect.x
              +','+opts.focusRect.y+')');
      buttonarea = focus.append('g')
        .attr('clip-path', 'url(#buttonareaclip'+curid+')')
        .attr('class', 'buttonarea'); 
      focusclip = focus.append('g')
	      .attr('class', 'focusclip')
        .attr('clip-path', 'url(#plotclip'+curid+')')
        .attr('transform', 'translate('+plotpad.left
              +','+plotpad.top+')');
      plot = focusclip.append('g').attr('class', 'plot');

      stathead = focus.append('svg:text').attr("x", sw/2).attr("y", 15)
        .attr("width", plotbox.width)
        .attr('class', 'svgtxt')
        .style("font-size", "80%")
        .attr('text-anchor', 'middle')

      gPB = plot.append('g').attr('id', 'pastboxgrp');
      gYBHP = plot.append('g').attr('id', 'ybhpgrp');
      gAura = plot.append('g').attr('id', 'auragrp');
      gWatermark = plot.append('g').attr('id', 'wmarkgrp');
      gOldGuides = plot.append('g').attr('id', 'oldguidegrp');
      gOldRoad = plot.append('g').attr('id', 'oldroadgrp');
      gPink = plot.append('g').attr('id', 'pinkgrp');
      gOldBullseye = plot.append('g').attr('id', 'oldbullseyegrp');
      gOldCenter = plot.append('g').attr('id', 'oldcentergrp');
      gGrid = plot.append('g').attr('id', 'grid');
      gOResets = plot.append('g').attr('id', 'oresetgrp');
      gKnots = plot.append('g').attr('id', 'knotgrp');
      gSteppy = plot.append('g').attr('id', 'steppygrp');
      gRosy = plot.append('g').attr('id', 'rosygrp');
      gRosyPts = plot.append('g').attr('id', 'rosyptsgrp');
      gDerails = plot.append('g').attr('id', 'derailsgrp');
      gAllpts = plot.append('g').attr('id', 'allptsgrp');
      gMovingAv = plot.append('g').attr('id', 'movingavgrp');
      gSteppyPts = plot.append('g').attr('id', 'steppyptsgrp');
      gDpts = plot.append('g').attr('id', 'datapointgrp');
      gHollow = plot.append('g').attr('id', 'hollowgrp');
      gFlat = plot.append('g').attr('id', 'flatlinegrp');
      gHashtags = plot.append('g').attr('id', 'hashtaggrp');
      gBullseye = plot.append('g').attr('id', 'bullseyegrp');
      gRoads = plot.append('g').attr('id', 'roadgrp');
      gDots = plot.append('g').attr('id', 'dotgrp');
      gHorizon = plot.append('g').attr('id', 'horgrp');
      gHorizonText = plot.append('g').attr('id', 'hortxtgrp');
      gPastText = plot.append('g').attr('id', 'pasttxtgrp');

      zoomin = plot.append("svg:use")
	      .attr("class","zoomin")
        .attr("xlink:href", "#zoominbtn")
	  	  .attr("opacity",opts.zoomButton.opacity)
        .attr("transform", zoombtntr.botin)
        .on("click", () => {zoomarea.call(axisZoom.scaleBy, opts.zoomButton.factor)})
        .on("mouseover", () =>{
          if (!mobileOrTablet) d3.select(this).style("fill", "red")})
	      .on("mouseout",(d,i) => {d3.select(this).style("fill", "black")});
      zoomout = plot.append("svg:use")
	      .attr("class","zoomout")
	      .attr("xlink:href","#zoomoutbtn")
	  	  .attr("opacity",opts.zoomButton.opacity)
        .attr("transform", zoombtntr.botout)
        .on("click", () => {zoomarea.call(axisZoom.scaleBy, 1/opts.zoomButton.factor)})
        .on("mouseover", () =>{
          if (!mobileOrTablet) d3.select(this).style("fill", "red")})
	      .on("mouseout",(d,i) =>{d3.select(this).style("fill", "black")});

      // Create and initialize the x and y axes
      xSc = d3.scaleUtc().range([0,plotbox.width]);
      xAxis = d3.axisBottom(xSc).ticks(6);
      xAxisObj = focus.append('g')        
        .attr("class", "axis")
        .attr("transform", "translate("+plotbox.x+"," 
              + (plotpad.top+plotbox.height) + ")")
        .call(xAxis);
      if (!opts.roadEditor) {
        xGrid = d3.axisTop(xSc).ticks(6).tickFormat("");
        xGridObj = gGrid.append('g')        
          .attr("class", "grid")
          .attr("transform", "translate(0,"+(plotbox.height)+")")
          .call(xGrid);
        xAxisT = d3.axisTop(xSc).ticks(6);
        xAxisObjT = focus.append('g')        
          .attr("class", "axis")
          .attr("transform", "translate("+plotbox.x+"," 
                + (plotpad.top) + ")")
          .call(xAxisT);
      }

      ySc = d3.scaleLinear().range([plotbox.height, 0]);
      yAxis = d3.axisLeft(ySc).ticks(8).tickSize(6).tickSizeOuter(0)
      yAxisR = d3.axisRight(ySc).ticks(8).tickSize(6).tickSizeOuter(0)
      yAxisObj = focus.append('g')        
        .attr("class", "axis")
        .attr("transform", "translate(" 
              + plotpad.left + ","+plotpad.top+")")
        .call(yAxis);
      yAxisObjR = focus.append('g')        
        .attr("class", "axis")
        .attr("transform", "translate(" 
              + (plotpad.left+plotbox.width) + ","+plotpad.top+")")
        .call(yAxisR);
      yAxisLabel = focus.append('text')        
        .attr("class", "axislabel")
        .attr("transform", 
              "translate(15,"+(plotbox.height/2+plotpad.top)
              +") rotate(-90)")
        .text("deneme");
      
      // Create brush area
      context = svg.append('g')
	      .attr('class', 'brush')
        .attr('transform', 'translate('
              +opts.ctxRect.x+','+opts.ctxRect.y+')');
      ctxclip = context.append('g')
        .attr('clip-path', 'url(#brushclip'+curid+')')
        .attr('transform', 'translate('
              +contextpad.left+','+contextpad.top+')');
      ctxplot = ctxclip.append('g').attr('class', 'context');
      xScB = d3.scaleUtc().range([0,brushbox.width]);
      xAxisB = d3.axisBottom(xScB).ticks(6);
      xAxisObjB = context.append('g')        
        .attr("class", "axis")
        .attr("transform", "translate("+brushbox.x+"," 
              + (contextpad.top+brushbox.height) + ")")
        .call(xAxisB);
      yScB = d3.scaleLinear().range([brushbox.height, 0]);

      brushObj = d3.brushX()
        .extent([[0, 0], [brushbox.width, brushbox.height]])
        .on("brush", brushed);

      brush = ctxplot.append("g")
        .attr("class", "brush")
        .call(brushObj);
      focusrect = ctxclip.append("rect")
        .attr("class", "focusrect")
        .attr("x", 1).attr("y", 1)
        .attr("width", brushbox.width-2)
        .attr("height", brushbox.height-2)
        .attr("fill", "none")
        .style("stroke", "black").style("stroke-width", 1)
        .style("stroke-dasharray", "8,4,2,4");
      nXSc = xSc, nYSc = ySc;
    }

    function resizeGraph() {
      //console.debug("id="+curid+", resizeGraph()");

      var div = opts.divGraph;
      if (div === null) return;

      var xr = [nXSc.invert(0), nXSc.invert(plotbox.width)]; 
      //console.debug(xr);
      computeBoxes();
      // Common SVG definitions, including clip paths
      defs.select('#plotclip'+curid+' > rect')
        .attr("width", plotbox.width).attr("height", plotbox.height);
      defs.select('#brushclip'+curid+' > rect')
        .attr("width", brushbox.width).attr("height", brushbox.height);
      defs.select('#buttonareaclip'+curid+' > rect')
        .attr("x", plotbox.x).attr("y", 0)
        .attr("width", plotbox.width).attr("height", plotbox.height);
      zoomarea.attr("x", plotbox.x).attr("y", plotbox.y)
        .attr("width", plotbox.width).attr("height", plotbox.height);
      axisZoom.extent([[0, 0], [plotbox.width, plotbox.height]])
        .scaleExtent([1, Infinity])
        .translateExtent([[0, 0], [plotbox.width, plotbox.height]]);
      focusclip.attr('transform', 'translate('+plotpad.left
                     +','+plotpad.top+')');
      zoomin.attr("transform", zoombtntr.botin);
      zoomout.attr("transform", zoombtntr.botout);
      xSc.range([0, plotbox.width]);
      nXSc.range([0, plotbox.width]);
      xAxisObj.attr("transform", "translate("+plotbox.x+"," 
                    + (plotpad.top+plotbox.height) + ")")
        .call(xAxis.scale(nXSc));
      if (!opts.roadEditor) {
        xGridObj.attr("transform", "translate(0,"+(plotbox.height)+")")
          .call(xGrid);
        xAxisObjT.attr("transform", "translate("+plotbox.x+"," 
                       + (plotpad.top) + ")")
          .call(xAxisT.scale(nXSc));
      }
      ySc.range([0, plotbox.height]);
      nYSc.range([0, plotbox.height]);
      yAxisObj.attr("transform", "translate(" 
                    + plotpad.left + ","+plotpad.top+")")
        .call(yAxis.scale(nYSc));

      yAxisObjR.attr("transform", "translate(" 
                     + (plotpad.left+plotbox.width) + ","+plotpad.top+")")
        .call(yAxisR.scale(nYSc));

      yAxisLabel.attr("transform", 
                      "translate(15,"+(plotbox.height/2+plotpad.top)
                      +") rotate(-90)");
      ctxclip.attr('transform', 'translate('
                   +contextpad.left+','+contextpad.top+')');
      //console.debug("Scaling brush x axis to "+brushbox.width);
      xScB.range([0,brushbox.width]);
      xAxisObjB.attr("transform", "translate("+brushbox.x+"," 
                     + (contextpad.top+brushbox.height) + ")")
        .call(xAxisB);
      yScB.range([brushbox.height, 0]);
      brushObj.extent([[0, 0], [brushbox.width, brushbox.height]]);
      brush.call(brushObj);

      // Go back to the previous zoom level in case the x axis
      // size and limits have changed
      var s = xr.map(xSc);
      zoomarea.call(axisZoom.transform, d3.zoomIdentity
                    .scale(plotbox.width / (s[1] - s[0]))
                    .translate(-s[0], 0));
      //console.debug(s);
      adjustYScale();
    }

    function createTable() {
      var div = opts.divTable;
      if (div === null) return;
      // First, remove all children from the div
      while (div.firstChild) {
        div.removeChild(div.firstChild);
      }
      var divelt = d3.select(div);
      var startelt = divelt.append("div")
            .attr("class", "rtablestart");
      var bodyelt = divelt.append("div")
            .attr("class", "rtablebody");
      var goalelt = divelt.append("div")
            .attr("class", "rtablegoal");
      if (opts.tableHeight != 0) {
        bodyelt
          .style("max-height", opts.tableHeight+"px")
          .style("overflow-y", "auto");
      }
      var table = bodyelt.append("div")
            .attr("class", "rtable");
      // This element is used to hold the Pikaday instance
      table.append("div").attr("id", "dpfloat")
        .attr("class", "floating");
      // This element helps figure out layout coordinates of the scrolled window top left
      topLeft = table.append("div").attr("id", "topleft")
        .style("position", "absolute").style("left", 0).style("top",0)
        .style("width", "1px").style("height", "1px")
        .attr("visibility","hidden");
      if (opts.reverseTable) {
        createGoalTable();
        createRoadTable();
        createStartTable();
      } else {
        createStartTable();
        createRoadTable();  
        createGoalTable();
      }
    }

    function roadChanged() {
      if (!settingRoad) bbr.reloadRoad()
      computePlotLimits( true );
      horindex = br.findSeg(road, goal.horizon);
      reloadBrush();
      updateGraphData(true);
      updateContextData();
      updateTable();
      if (typeof opts.onRoadChange === 'function') {
        opts.onRoadChange.call();
      }
    }
    
    // ------------------ Text Box Utilities ---------------------
    function createTextBox( x, y, text, col, textr=null ){
      var textobj = {};
      if (y < 20-plotpad.top)    y = 20 -plotpad.top;
      if (y > plotbox.height-15) y = plotbox.height-15;
      textobj.grp = focus.append('g');
      textobj.rect = textobj.grp.append('svg:rect')
        .attr('pointer-events', "none")
        .attr('fill',   opts.textBoxCol.bg)
        .style('stroke', col);
      textobj.text = textobj.grp.append('svg:text')
        .attr('pointer-events', "none")
        .attr('text-anchor', 'middle');
      if (textr == null) {
        textobj.text.text(text).attr('class', 'svgtxt');
      } else {
        textobj.text.append("tspan")
          .attr("x", 0).attr("dy", "0.6em")
          .text(text).attr('class', 'svgtxt');
        for (let i = 0; i < textr.length; i++) {
          textobj.text.append("tspan").attr("dy", "1.2em")
            .attr("x", 0).text(textr[i])
            .attr("font-size", "0.7em");
        }
      }
      var bbox = textobj.text.node().getBBox();
      var margin = opts.textBox.margin;
      textobj.rect
        .attr('x', bbox.x-margin)
        .attr('y', bbox.y-margin)
        .attr('width',  bbox.width + margin*2)
        .attr('height', bbox.height+ margin*2);

      if (x < bbox.width/2) x = bbox.width/2;
      if (x > plotbox.width-bbox.width/2) x =plotbox.width-bbox.width/2;

      textobj.grp
        .attr('transform', 'translate('+(x+plotpad.left)+","
              +(y+plotpad.top)+")");
      return textobj;
    }

    function updateTextBox( obj, x, y, text ) {
      if (!obj) {console.debug("updateTextBox: null input"); return }
      if (y < 20-plotpad.top) y = 20 -plotpad.top;
      if (y > plotbox.height-15) y = plotbox.height-15;
      obj.text.text(text);
      var bbox = obj.text.node().getBBox();
      var margin = opts.textBox.margin;
      obj.rect
        .attr('x', bbox.x-margin)
        .attr('y', bbox.y-margin)
        .attr('width',  bbox.width +margin*2)
        .attr('height', bbox.height+margin*2);

      if (x < bbox.width/2) x = bbox.width/2;
      if (x > plotbox.width-bbox.width/2) x =plotbox.width-bbox.width/2;
      obj.grp.attr('transform', 'translate('+(x+plotpad.left)+","
                   +(y+plotpad.top)+")");
    }

    function rmTextBox( obj ) {
      if (!obj) {console.debug("updateTextBox: null input"); return }
      obj.grp.remove();
    }

    function hideTextBox( obj, hide ) {
      if (!obj) {console.debug("updateTextBox: null input"); return }
      obj.grp.attr("visibility", (hide)?"hidden":"visible");
    }


    // ------- Zoom and brush  related private functions ---------
    var ticks, tickType = 1, majorSkip = 7;
    function computeXTicks() {
      let xr = xSc.domain();

      // The following make sure that the initial element of the tick
      // values array is at the proper boundary (day, month, year)
      // depending on the tick types.
      let xt = xr.map(e=>e.getTime()/1000)
      let xtm = xt.slice(); xtm[0] = bu.monthsnap(xtm[0])
      let xty = xt.slice(); xty[0] = bu.yearsnap(xty[0])
      let xrm = xtm.map(e=>(new Date(e*1000)))
      let xry = xty.map(e=>(new Date(e*1000)))

      // [0]: tick dates, [1]: tick text,
      ticks = [];
      ticks.push([d3.utcDay.range(xr[0], xr[1], 1),"%b %d"]);
      ticks.push([d3.utcDay.range(xr[0], xr[1], 2),"%b %d"]);
      ticks.push([d3.utcWeek.range(xrm[0], xrm[1], 1),"%b %d"]);
      ticks.push([d3.utcWeek.range(xrm[0], xrm[1], 2),"%b %d"]);
      ticks.push([d3.utcMonth.every(1).range(xry[0], xry[1]),"%b %Y"]);
      ticks.push([d3.utcMonth.every(2).range(xry[0], xry[1]),"%b %Y"]);
      ticks.push([d3.utcMonth.every(3).range(xry[0], xry[1]),"%Y"]);
      ticks.push([d3.utcYear.every(1).range(xry[0], xry[1]),"%Y"]);
    }
    function redrawXTicks() {
      //console.debug("redrawXTicks()");
      var xr = [nXSc.invert(0).getTime(), 
                nXSc.invert(plotbox.width).getTime()];

      var diff = ((xr[1] - xr[0])/(1000*bu.SID));
      // * tickType identifies the separation and text of ticks
      // * majorSkip is the number of ticks to skip for the annotated
      // "major" ticks. Remaining ticks are drawn as unlabeled small
      // indicators
      if (diff < 10) {
        tickType = 0; majorSkip = 1;
      } else if (diff < 20) {
        tickType = 0; majorSkip = 2;
      } else if (diff < 45) {
        tickType = 0; majorSkip = 7;
      } else if (diff < 120) {
        tickType = 1; majorSkip = 7;
      } else if (diff < 240){
        tickType = 2; majorSkip = 4;
      } else if (diff < 320){
        tickType = 4; majorSkip = 1;
      } else if (diff < 1.5*365){
        tickType = 4; majorSkip = 2;
      } else if (diff < 2.6*365){
        tickType = 4; majorSkip = 3;
      } else if (diff < 5*365){
        tickType = 5; majorSkip = 3;
      } else if (diff < 10*365) {
        tickType = 6; majorSkip = 4;              
      } else {
        tickType = 7; majorSkip = 1;              
      }
      // Invisible ticks to the left of the graph
      var pt = ticks[tickType][0].filter((d)=>((d.getTime()<xr[0])));
      // Number of minor ticks in the partially visible first major tick interval
      var ind = (majorSkip - pt.length%majorSkip)%majorSkip;
      // Filter tick values based on x axis range
      var tv = ticks[tickType][0].filter(
        (d)=>((d.getTime()>=xr[0]&&d.getTime()<=xr[1])));
      xAxis.tickValues(tv)
        .tickSize(6)
        .tickSizeOuter(0)
        .tickFormat(
          (d,i)=>d3.utcFormat((i%majorSkip==ind)?ticks[tickType][1]:"")(d))
      xAxisObj.call(xAxis.scale(nXSc));
      xAxisObj.selectAll("g").classed("minor", false)
      xAxisObj.selectAll("g")
        .filter((d, i)=>(i%majorSkip!=ind))
        .classed("minor", true)

      xAxisObj.selectAll("g").selectAll(".tick line")
        .attr("transform", "translate(0,-5)")
      
      if (!opts.roadEditor) {
        xGrid.tickValues(tv).tickSize(plotbox.width);
        xGridObj.call(xGrid.scale(nXSc));
        xGridObj.selectAll("g").classed("minor", false);
        xGridObj.selectAll("g")
          .filter( (d, i)=>(i%majorSkip!=ind))
          .classed("minor", true);
        xAxisT.tickValues(tv)
          .tickSize(6)
          .tickSizeOuter(0)
          .tickFormat(
            (d,i)=>d3.utcFormat((i%majorSkip==ind)?ticks[tickType][1]:"")(d))
        xAxisObjT.call(xAxisT.scale(nXSc));
        xAxisObjT.selectAll("g").classed("minor", false)
        xAxisObjT.selectAll("g")
          .filter((d, i)=>(i%majorSkip!=ind))
          .classed("minor", true);

        xAxisObjT.selectAll("g").selectAll(".tick line")
          .attr("transform", "translate(0,6)");

      }
    }
    function handleYAxisWidth() {
      //console.debug("curid="+curid+", hidden="+hidden);
      if (opts.divGraph != null && !hidden) {
        yAxisLabel.text(goal.yaxis);
        if (goal.hidey && !opts.roadEditor) {
          yAxisObj.selectAll("text").remove()
          yAxisObjR.selectAll("text").remove()
        }
        var bbox = yAxisObj.node().getBBox()
        // Adjust the graph size and axes if the y axis tick
        // width has changed by a nontrivial amount. This
        // causes a bit jumpy behavior when dragging the brush
        // across the boundary of width change, but that seems
        // to not be too bad a problem.
        if (Math.abs(bbox.width-yaxisw) > 5) {
          yaxisw = Math.floor(bbox.width)
          resizeGraph()
        }
      }
    }

    function adjustYScale() {
      var xrange = [nXSc.invert(0), 
                    nXSc.invert(plotbox.width)];
      var yrange
      if (opts.headless) {
        let va = goal.vmin  - PRAF*(goal.vmax-goal.vmin)
        let vb = goal.vmax  + PRAF*(goal.vmax-goal.vmin)
        yrange = [vb, va]
      } else {
        var xtimes = xrange.map((d)=>Math.floor(d.getTime()/1000))
        var re 
            = roadExtentPartial(road,xtimes[0],xtimes[1],false);
        re.yMin -= goal.lnw;
        re.yMax += goal.lnw;
        var ore = roadExtentPartial(iroad,xtimes[0],xtimes[1],false);
        ore.yMin -= goal.lnw;
        ore.yMax += goal.lnw;
        var ae = mergeExtents(re, ore);
        
        var de  = dataExtentPartial((goal.plotall&&!opts.roadEditor)
                                    ?alldata:data,
                                    xtimes[0],xtimes[1],false);
        if (de != null) ae = mergeExtents(ae, de);
        var p;
        if (opts.roadEditor)
          p = {xmin:0.0, xmax:0.0, ymin:0.05, ymax:0.05};
        else
          p = {xmin:0.0, xmax:0.0, ymin:0.02, ymax:0.02};
        enlargeExtent(ae, p);
        if ((ae.yMax - ae.yMin) < 3*goal.lnw) {
          ae.yMax += 1.5*goal.lnw;
          ae.yMin -= 1.5*goal.lnw;
        }
        yrange = [ae.yMax, ae.yMin];
      }
      
      var newtr = d3.zoomIdentity
            .scale(plotbox.height/(ySc(yrange[1])
                                   -ySc(yrange[0])))
            .translate(0, -ySc(yrange[0]));
      nYSc = newtr.rescaleY(ySc);
      yAxisObj.call(yAxis.scale(nYSc));
      yAxisObjR.call(yAxisR.scale(nYSc));

      // Resize brush if dynamic y limits are beyond graph limits
      if (yrange[0] > goal.yMax) goal.yMax = yrange[0];
      if (yrange[1] < goal.yMin) goal.yMin = yrange[1];
      resizeContext();

      var sx = xrange.map( (x)=>xScB(x));
      var sy = yrange.map( (y)=>yScB(y));
      focusrect
        .attr("x", sx[0]+1).attr("width", Math.max(0, sx[1]-sx[0]-2))
        .attr("y", sy[0]+1).attr("height", Math.max(0, sy[1]-sy[0]-2));

    }

    function resizeContext(){
      if (opts.divGraph == null) return;
      xScB.domain([new Date(Math.min(goal.tmin, goal.xMin)*1000), 
                   new Date(Math.max(goal.tmax, goal.xMax)*1000)]);
      xAxisObjB.call(xAxisB.scale(xScB));
      yScB.domain([goal.yMin, goal.yMax]);
    }

    function resizeBrush() {
      if (opts.divGraph == null) return;
      var limits = [xScB(nXSc.invert(0)), 
                    xScB(nXSc.invert(plotbox.width))];
      //console.debug("limits: "+limits);
      if (limits[0] < 0) limits[0] = 0;
      if (limits[1] > brushbox.width) limits[1] = brushbox.width;
      brush.call(brushObj.move, limits );
    }

    function reloadBrush() {
      resizeContext();
      resizeBrush();
    }

    function zoomed() {
      //console.debug("id="+curid+", zoomed()");
      //console.trace();
      if ( road.length == 0 ) return;
      if (d3.event && d3.event.sourceEvent 
          && d3.event.sourceEvent.type === "brush") return;

      // Inject the current transform into the plot element
      var tr = d3.zoomTransform(zoomarea.node());
      if (tr == null) return;
      
      nXSc = tr.rescaleX(xSc);
      redrawXTicks();
      adjustYScale();
      yAxisObj.selectAll("g").selectAll(".tick line")
        .attr("transform", "translate(6,0)");
      yAxisObjR.selectAll("g").selectAll(".tick line")
        .attr("transform", "translate(-5,0)");
      handleYAxisWidth();

      resizeBrush();
      updateGraphData();
      return;
    }

    function brushed() {
      //console.debug("id="+curid+", brushed()");
      //console.trace();
      if ( road.length == 0 ) return;
      if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") 
        return;
      var s = d3.event.selection || xScB.range();
      
      nXSc.domain(s.map(xScB.invert, xScB));
      redrawXTicks();
      adjustYScale();
      handleYAxisWidth();

      zoomarea.call(axisZoom.transform, d3.zoomIdentity
                    .scale(brushbox.width / (s[1] - s[0]))
                    .translate(-s[0], 0));
      updateGraphData();
    }

    function zoomDefault() {
      if (opts.divGraph == null) return;
      //console.debug("id="+curid+", zoomDefault()");
      var ta = goal.tmin - PRAF*(goal.tmax-goal.tmin);
      var tb = goal.tmax + PRAF*(goal.tmax-goal.tmin);
      var newdom = [new Date(ta*1000),new Date(tb*1000)];
      //console.debug(newdom);
      nXSc.domain(newdom);
      var s = newdom.map(xScB);
      //console.debug(s);
      redrawXTicks();
      adjustYScale();
      zoomarea.call(axisZoom.transform, d3.zoomIdentity
                    .scale(brushbox.width / (s[1] - s[0]))
                    .translate(-s[0], 0));
    }

    function zoomAll( ) {
      //console.debug("id="+curid+", zoomAll()");
      if (opts.divGraph == null) return;
      computePlotLimits( false );
      xSc.domain([new Date(Math.min(goal.tmin, goal.xMin)*1000), 
                  new Date(Math.max(goal.tmax, goal.xMax)*1000)]);
      computeXTicks();
      ySc.domain([goal.yMin, goal.yMax]);
      nXSc = xSc; nYSc = ySc;
      resizeContext();
      zoomarea.call(axisZoom.transform, d3.zoomIdentity);

      // Relocate zoom buttons based on road yaw
      if (goal.dir > 0) {
        zoomin.attr("transform", zoombtntr.botin);
        zoomout.attr("transform", zoombtntr.botout);
      } else {
        zoomin.attr("transform", zoombtntr.topin);
        zoomout.attr("transform", zoombtntr.topout);
      }
      reloadBrush();
    }

    // ---------------- Undo/Redo functionality --------------------
    function clearUndoBuffer() {
      //console.debug("clearUndoBuffer()");
      undoBuffer = [];
      redoBuffer = [];
    }

    function redoLastEdit() {
      //console.debug("redoLastEdit: Undo Buffer has "+undoBuffer.length+" entries");
      if (redoBuffer.length == 0) return;
      pushUndoState(true);
      road = redoBuffer.pop();
      roadChanged();

      return;
    }

    function undoLastEdit() {
      //console.debug("undoLastEdit: Undo Buffer has "+undoBuffer.length+" entries");
      if (undoBuffer.length == 0) return;
      if (undoBuffer.length == 0 || 
          !br.sameRoads(undoBuffer[undoBuffer.length-1], road)) {
        redoBuffer.push(road);
      }
      road = undoBuffer.pop();
      roadChanged();
      return;
    }

    function pushUndoState(fromredo = false) {
      //console.debug("pushUndoState: Undo Buffer has "+undoBuffer.length+" entries");
      if (undoBuffer.length == 0 || 
          !br.sameRoads(undoBuffer[undoBuffer.length-1], road)) {
        undoBuffer.push(br.copyRoad(road));
        if (!fromredo) {
          redoBuffer = [];        
        }
      }
    }

    // Determines whether the given road is valid or not (i.e. whether it
    // is clear of the pink region or not)
    // TODO: Must rethink this check, probably a general segment
    // intersection algorithm will be best
    function isRoadValid( rd ) {
      var ir = iroad;
      
      var EPS = 0.000001; // dang floating point comparisons
      
      var now = goal.asof;
      var hor = goal.horizon;
      // Check left/right boundaries of the pink region. This should
      // handle the case when there are no road inflections within the
      // horizon
      if (goal.yaw*br.rdf(rd, now) < goal.yaw*br.rdf(ir, now) - EPS) 
        return false;
      if (goal.yaw*br.rdf(rd, hor) < goal.yaw*br.rdf(ir, hor) - EPS) 
        return false;
      // Iterate through and check current road points in the pink range
      var rd_i1 = br.findSeg(rd, now,-1);
      var rd_i2 = br.findSeg(rd, hor,1);
      for (let i = rd_i1; i < rd_i2; i++) {
        if (goal.yaw*br.rdf(rd, rd[i].end[0]) < 
            goal.yaw*br.rdf(ir, rd[i].end[0]) - EPS) return false;
      }
      // Iterate through and check old road points in the pink range
      var ir_i1 = br.findSeg(ir, now,-1);
      var ir_i2 = br.findSeg(ir, hor,1);
      for (let i = ir_i1; i < ir_i2; i++) {
        if (goal.yaw*br.rdf(rd, ir[i].end[0]) < 
            goal.yaw*br.rdf(ir, ir[i].end[0]) - EPS) return false;
      }
      return true;
    }


    function mergeExtents( ext1, ext2) {
      var ne = {};

      ne.xMin = Math.min(ext1.xMin, ext2.xMin);
      ne.xMax = Math.max(ext1.xMax, ext2.xMax);
      ne.yMin = Math.min(ext1.yMin, ext2.yMin);
      ne.yMax = Math.max(ext1.yMax, ext2.yMax);
      return ne;
    }

    function enlargeExtent( extent, p) {
      var xdiff = extent.xMax - extent.xMin;
      if (xdiff < 1e-7) xdiff = 1e-7;
      var ydiff = extent.yMax - extent.yMin;
      if (ydiff < 1e-7) ydiff = 1e-7;

      extent.xMin = extent.xMin - p.xmin*xdiff;
      extent.xMax = extent.xMax + p.xmax*xdiff;
      extent.yMin = extent.yMin - p.ymin*ydiff;
      extent.yMax = extent.yMax + p.ymax*ydiff;
    }

    function roadExtent( rd, extend = true ) {
      var extent = {};
      // Compute new limits for the current data
      extent.xMin = bu.arrMin(rd.map((d)=>d.end[0]));
      extent.xMax = bu.arrMax(rd.map((d)=>d.sta[0]));
      extent.yMin = bu.arrMin(rd.map((d)=>d.sta[1]));
      extent.yMax = bu.arrMax(rd.map((d)=>d.sta[1]));
      // Extend limits by 5% so everything is visible
      var p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10};
      if (extend) enlargeExtent(extent, p);
      return extent;
    }

    function dataExtentPartial( data, xmin, xmax, extend = false ) {
      var extent = {};
      var nd = data.filter((d) =>((d[0] > xmin && d[0] < xmax)));
      if (nd.length == 0) {
        // no points are in range, find enclosing two
        var ind = -1;
        for (let i = 0; i < data.length-1; i++) {
          if (data[i][0]<=xmin && data[i+1][0]>=xmax) {
            ind = i; break;
          }
        }
        if (ind > 0) nd = data.slice(ind, ind+1);
      }
      // Inform caller if no data points are in between the supplied range.
      if (nd.length == 0) return null;

      // Compute new limits for the current data
      extent.xMin = bu.arrMin(nd.map((d)=>d[0]));
      extent.xMax = bu.arrMax(nd.map((d)=>d[0]));
      extent.yMin = bu.arrMin(nd.map((d)=>d[1]));
      extent.yMax = bu.arrMax(nd.map((d)=>d[1]));

      // Extend limits by 5% so everything is visible
      var p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10};
      if (extend) enlargeExtent(extent, p);
      return extent;
    }

    function roadExtentPartial( rd, xmin, xmax, extend = false ) {
      var extent = {};
      // Compute new limits for the current data
      extent.xMin = xmin;
      extent.xMax = xmax;
      extent.yMin = bu.arrMin(rd.map(function(d) { 
        return (d.sta[0] <xmin||d.sta[0]>xmax)?Infinity:d.sta[1]; }));
      extent.yMax = bu.arrMax(rd.map(function(d) { 
        return (d.sta[0] <xmin||d.sta[0]>xmax)?-Infinity:d.sta[1]; }));
      extent.yMin = bu.arrMin([extent.yMin, br.rdf(rd,xmin), br.rdf(rd,xmax)]);
      extent.yMax = bu.arrMax([extent.yMax, br.rdf(rd,xmin), br.rdf(rd,xmax)]);
      // Extend limits by 5% so everything is visible
      var p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10};
      if (extend) enlargeExtent(extent, p);
      return extent;
    }

    // Convert deadline value (seconds from midnight) to
    // time-of-day like "3am"
    function deadtod(ds) {
      var str = moment.unix(ds).utc().format("h:mma").replace(":00","");
      return str;
    }

    // Convert tluz to the day of the week (eg, "Wed") of the eep day
    function deaddow(t){
      return moment.unix(t).utc().format("ddd");
    }

    // Set the watermark (waterbuf) to number of safe days if not
    // given explicitly.
    function setWatermark() {

      if (goal.waterbuf0 != null) return
      
      goal.safebuf = br.dtd(road, goal, goal.tcur, goal.vcur);
      goal.tluz = goal.tcur+goal.safebuf*bu.SID;
      if (goal.tfin < goal.tluz) goal.tluz = bu.BDUSK;
      goal.loser = br.isLoser(road,goal,data,goal.tcur,goal.vcur);

      if  (goal.asof >= goal.tfin && !goal.loser)  {
        goal.waterbuf = ":)";
        return;
      }

      if (goal.safebuf > 999) {
        goal.waterbuf = "inf";
      } else if (goal.safebuf >= 7) {               
        goal.waterbuf = goal.safebuf+"d";
      } else if (goal.safebuf <= 0) {
        goal.waterbuf = deadtod(goal.deadline)+"!";
      } else {
        goal.waterbuf = deaddow(goal.tluz);
      }
    }

    function computePlotLimits( adjustZoom = true ) {
      if (road.length == 0) return;

      var now = goal.asof;
      var maxx = bu.daysnap(Math.min(now+opts.maxFutureDays*bu.SID, 
                                 road[road.length-1].sta[0]));
      var cur = roadExtentPartial( road, road[0].end[0], maxx, false );
      var old = roadExtentPartial(iroad,road[0].end[0],maxx,false);
      var ne = mergeExtents( cur, old );

      var d = dataExtentPartial((goal.plotall&&!opts.roadEditor)?alldata:data,road[0].end[0],data[data.length-1][0],false);

      if (d != null) ne = mergeExtents(ne, d)
      if (bbr.fuda.length != 0) {
        var df = dataExtentPartial(bbr.fuda,road[0].end[0],maxx,false);
        if (df != null) ne = mergeExtents(ne, df);
      }

      var p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10};
      enlargeExtent(ne, p);

      goal.xMin = bu.daysnap(ne.xMin); goal.xMax = bu.daysnap(ne.xMax);
      goal.yMin = ne.yMin; goal.yMax = ne.yMax;

      if ( adjustZoom && opts.divGraph != null) {
        var xrange = [nXSc.invert(0), 
                      nXSc.invert(plotbox.width)];
        var yrange = [nYSc.invert(0), 
                      nYSc.invert(plotbox.height)];
        xSc.domain([new Date(Math.min(goal.tmin, goal.xMin)*1000), 
                    new Date(Math.max(goal.tmax, goal.xMax)*1000)]);
        computeXTicks();
        ySc.domain([goal.yMin, goal.yMax]);
        var newtr = d3.zoomIdentity.scale(plotbox.width
                                          /(xSc(xrange[1]) 
                                            - xSc(xrange[0])))
              .translate(-xSc(xrange[0]), 0);
        zoomarea.call( axisZoom.transform, newtr );
      }
    }

    // Function to generate samples for the Butterworth filter
    function griddlefilt(a, b) {
      return bu.linspace(a, b, Math.floor(bu.clip((b-a)/(bu.SID+1), 40, 2000)));
    }

    // Function to generate samples for the Butterworth filter
    function griddle(a, b, maxcnt = 6000) {
      return bu.linspace(a, b, Math.floor(bu.clip((b-a)/(bu.SID+1), 
                                            Math.min(600, plotbox.width),
                                            maxcnt)));
    }

    const stats_timeid = `bgraph(${curid}): Goal stats`
    const graph_timeid = `bgraph(${curid}): Goal graph`
    // Recreates the road array from the "rawknots" array, which includes
    // only timestamp,value pairs

    /** Loads goal details from the supplied JSON input and populates
     * the graph and road matrix table with necessary components based
     * on initially supplied options

        @param {Object} json JSON object with the contents of a BB
        file, directly fed to a {@link beebrain} object instance. */
    function loadGoal( json ) {
      //console.debug("id="+curid+", loadGoal()->"+json.params.yoog);
      clearUndoBuffer();
      
      processing = true;
      
      // Create beebrain processor
      console.time(stats_timeid)
      bbr = new bb(json)
      goal = bbr.goal
      if (opts.divJSON)
        opts.divJSON.innerHTML = JSON.stringify(bbr.getStats(), null, 4)
      console.timeEnd(stats_timeid)

      if (goal.error != "") {
        console.log("Beebrain error: "+ bbr.goal.error)
        lastError = ErrType.BBERROR
        var errors = bbr.goal.error.split("\\n")
        showOverlay( (["The following errors prevented us from generating "+bbr.goal.yoog,
                       "(We've pinged Beeminder support to come help fix things up here!)",
                       ""])
                     .concat(errors), sh/30, null )
        resetGoal()
        processing = false
        return
      }

      if (opts.noGraph) {
        showOverlay( (["Beebrain was called with 'NOGRAPH_*' as the slug",
                       "so no graph or thumbnail was generated, just this",
                       "static placeholder!"]), sh/30, null )
        resetGoal()
        processing = false
        return
      }
      
      road = bbr.roads
      iroad = br.copyRoad( road );
      data = bbr.data
      alldata = bbr.alldata

      // Extract limited data
      if (opts.maxDataDays < 0) {
        dataf = data.slice();
        alldataf = alldata.slice();
      } else {
        dataf = data.filter(function(e){
          return e[0]>(goal.asof-opts.maxDataDays*bu.SID);});
        alldataf = alldata.filter(function(e){
          return e[0]>(goal.asof-opts.maxDataDays*bu.SID);});
      }
      

      if (opts.divGraph) {
        if (!opts.roadEditor && goal.stathead)
          stathead.text(goal.graphsum)
        else
          stathead.text("")
      }
      console.time(graph_timeid)
      // Finally, wrap up with graph related initialization
      zoomAll();
      processing = false;
      zoomDefault();

      updateTable();
      updateContextData();

      console.timeEnd(graph_timeid)
    }

    async function loadGoalFromURL( url, callback = null ) {
      //console.debug( "loadGoalFromURL: Loading: "+url );
      if (url == "" || loading) return
      loading = true
      showOverlay( ["loading..."], sh/10 )
      var resp = await bu.loadJSON( url )

      if (resp != null) {
        removeOverlay()
        loadGoal( resp )
        if (typeof opts.onRoadChange === 'function') opts.onRoadChange.call()
        updateTableTitles()
      } else {
        if (lastError != null) showOverlay( [ErrMsgs[lastError]] );
        else showOverlay(["Could not load goal file."]);
        if (!opts.headless) setTimeout( removeOverlay, 1500);
        if (typeof opts.onError === 'function') {
          opts.onError.call();
        }
      } 
      loading = false;
    }

    function setSafeDays( days ) {
      if (road.length == 0) {
        console.log("bgraph("+curid+"):setSafeDays(), road is empty!")
        return
      }
      //console.debug("setSafeDays()");
      var curdtd = br.dtd(road, goal, goal.tcur, goal.vcur)
      var now = goal.asof
      if (days < 0) days = 0
      // Look into the future to see the road value to ratchet to
      var daydiff = curdtd - (days - 1) - 1
      if (daydiff <= 0) return
      var futureDate= goal.asof + daydiff*bu.SID
      var ratchetValue = br.rdf( road, futureDate)

      // Find or add two new dots at asof
      // We only allow the first step to record undo info.
      var first = -1, i
      for (i = 1; i < road.length; i++) {
        if (road[i].sta[0] === now) {
          first = i-1; break
        }
      }
      var added = false;
      if (first < 0) {addNewDot(now);added = true}
      var second
      if (i+1 < road.length && road[i+1].sta[0] === now)
        second = i
      else {
        second = addNewDot(now, ratchetValue)
        if (added) {undoBuffer.pop(); added = true}
      }
      //changeDotValue( second, ratchetValue, false );
      //if (added) {undoBuffer.pop(); added = true;}

      roadChanged()
    }

    // Adds a new dot to the supplied x value, with the y value either
    // explicitly specified or computed from the corresponding y
    // value,
    function addNewDot(x, y = null) {
      var found = br.findSeg(road, x);
      if (found >= 0) {
        var s = {};
        var newx = bu.daysnap(x+bu.SID/2), newy = y;
        if (y == null) {
          newy = road[found].sta[1] 
            + road[found].slope*(newx - road[found].sta[0]);
        }
        pushUndoState();
        s.sta = [newx, newy];
        if (found == 0) {
          // First segment splitted
          s.end = road[found+1].sta.slice();
          if (y != null) {
            s.end[1] = s.sta[1]
              +road[found].slope*(s.end[0]-newx);
          }
          road[found].end = [newx, newy];
        } else {
          if (found == road.length-1) {
            // Last segment splitted
            s.end = road[found].end.slice();
            s.end[1] = newy;
          } else {
            s.end = road[found+1].sta.slice();
            if (y != null && opts.keepSlopes) {
              s.end[1] = s.sta[1]
                +road[found].slope*(s.end[0]-newx);
            }
          }
          road[found].end = [newx, newy];
          road[found].slope = br.segSlope(road[found]);
          // If the adjusted segment is vertical, switch its auto field to SLOPE
          if (road[found].sta[0] == road[found].end[0])
            road[found].auto = br.RP.SLOPE
        }
        s.slope = br.segSlope(s);
        s.auto = br.RP.VALUE;
        road.splice(found+1, 0, s);
        br.fixRoadArray( road, opts.keepSlopes?br.RP.VALUE
                      :br.RP.SLOPE, false);
        roadChanged();
      }
      return found;
    }

    function addNewKnot(kind) {
      if (kind < road.length-1) {
        var newt = (road[kind].sta[0] + road[kind+1].sta[0])/2
        if (newt - road[kind].sta[0] > 30*bu.SID) newt = road[kind].sta[0]+30*bu.SID
        addNewDot(newt);
      } else {
        addNewDot(road[kind].sta[0] + 7*bu.SID);
      }
    }

    function removeKnot(kind, fromtable) {
      pushUndoState();

      var oldslope = road[kind].slope;
      road.splice(kind, 1);
      if (opts.keepSlopes) road[kind].slope = oldslope;
      br.fixRoadArray( road, 
                    opts.keepSlopes?br.RP.VALUE
                    :br.RP.SLOPE, fromtable );

      roadChanged();
    }

    // -------------- Drag related utility functions ---------------
    var knottext = null, dottext = null, slopetext = null;

    function createDragInfo( pt, slope = undefined ) {
	    var ptx = nXSc(bu.daysnap(pt[0])*1000);
	    var pty = pt[1];
      knotdate = moment.unix(pt[0]).utc();
      knottext = createTextBox(ptx, plotbox.height-15, 
                               knotdate.format('YYYY-MM-DD')
                               + " ("+knotdate.format("ddd")+")",
                               opts.textBoxCol.stroke);
      dottext = createTextBox(ptx, nYSc(pty)-15, 
                              bu.shn(pt[1]), opts.textBoxCol.stroke);
      if (slope != undefined) {
	      var slopex = nXSc(bu.daysnap(slope[0])*1000);
	      var slopey = nYSc(slope[1]);
        slopetext = createTextBox(slopex,slopey, 
                                  "s:"+bu.shn(slope[2]),
                                  opts.textBoxCol.stroke);
        if (ptx - slopex < 50) hideTextBox(slopetext, true);
      }
    }
    function updateDragInfo( pt, slope ) {
      var ptx = bu.daysnap(pt[0]);
      var pty = pt[1];
      knotdate = moment.unix(ptx).utc(); 
      updateTextBox(knottext, nXSc(ptx*1000), plotbox.height-15, 
                    knotdate.format('YYYY-MM-DD') + " ("+knotdate.format("ddd")+")");
      updateTextBox(dottext, nXSc(ptx*1000), nYSc(pty)-15, 
                    bu.shn(pt[1]));
      if (slope != undefined) {
	      var slopex = bu.daysnap(slope[0]);
	      var slopey = slope[1];
        updateTextBox(slopetext, nXSc(slopex*1000), 
                      nYSc(slopey), 
                      "s:"+bu.shn(slope[2]));
      }
    }
    function removeDragInfo( ) {
      if (knottext != null) rmTextBox(knottext);
      knottext = null;
      if (dottext != null) rmTextBox(dottext);
      dottext = null;
      if (slopetext != null) rmTextBox(slopetext);
      slopetext = null;
    }

    function updateDragPositions( kind, updateKnots ) {
      var rd = road;
      var el = d3.select(opts.divGraph);
      for (let ii = kind; ii < rd.length; ii++) {
  	    el.select("[name=dot"+ii+"]")
	        .attr("cx", nXSc(rd[ii].end[0]*1000))
		      .attr("cy", nYSc(rd[ii].end[1]));
  	    el.select("[name=ctxdot"+ii+"]")
	        .attr("cx", xScB(rd[ii].end[0]*1000))
		      .attr("cy", yScB(rd[ii].end[1]));
  		  el.select("[name=road"+ii+"]")
	  	    .attr("x1", nXSc(rd[ii].sta[0]*1000))
		      .attr("y1", nYSc(rd[ii].sta[1]))
			    .attr("x2", nXSc(rd[ii].end[0]*1000))
			    .attr("y2", nYSc(rd[ii].end[1]));
  		  el.select("[name=ctxroad"+ii+"]")
	  	    .attr("x1", xScB(rd[ii].sta[0]*1000))
		      .attr("y1", yScB(rd[ii].sta[1]))
			    .attr("x2", xScB(rd[ii].end[0]*1000))
			    .attr("y2", yScB(rd[ii].end[1]));
        if (updateKnots) {
  	      el.select("[name=knot"+ii+"]")
	          .attr("x1", nXSc(rd[ii].end[0]*1000))
		  	    .attr("x2", nXSc(rd[ii].end[0]*1000));
		      el.select("[name=remove"+ii+"]")
            .attr("transform", 
                  (d) => ("translate("+(nXSc(d.end[0]*1000)+plotpad.left-8)
                          +","+(plotpad.top-20)+") scale(0.6,0.6)"))
        }
  		  el.select("[name=enddate"+ii+"]").text(bu.dayify(rd[ii].end[0], '-'));
  		  el.select("[name=endvalue"+ii+"]").text(bu.shn(rd[ii].end[1]));
  		  el.select("[name=slope"+ii+"]").text(bu.shn(rd[ii].slope*goal.siru));
      }

      if (opts.tableUpdateOnDrag) updateTableValues();
      updateRoadValidity()
      updateWatermark()
      updateBullseye()
      updateContextBullseye()
      updateDataPoints()
      updateMovingAv()
      updateYBHP()
    }

    // -------- Functions related to selection of components --------
    var selection = null;
    var selectType = null;
    var selectelt = null;

    function selectKnot( kind ) {
      if (opts.divGraph == null) return
      highlightDate( kind, true );
      selection = kind; selectType = br.RP.DATE;
      d3.select("[name=knot"+kind+"]")
        .attr("stroke-width", opts.roadKnot.width);
      var x = nXSc(road[kind].end[0]*1000);
      selectelt = gKnots.append("svg:line")
        .attr("class", "selectedknot")
        .attr("pointer-events", "none")
        .attr("x1", x).attr("x2", x)
        .attr("y1",0).attr("y2",plotbox.height)
        .attr("stroke", opts.roadKnotCol.selected)
        .attr("stroke-opacity", 0.9)
        .attr("stroke-width", opts.roadKnot.width+4).lower();
    }
    function unselectKnot( kind ) {
      highlightDate( kind, false );
      d3.select("[name=knot"+kind+"]")
        .attr("stroke", opts.roadKnotCol.dflt)
        .attr("stroke-width", opts.roadKnot.width);
    }
    function selectDot( kind ) {
      if (opts.divGraph == null) return
      highlightValue( kind, true );
      selection = kind; selectType = br.RP.VALUE;
      d3.select("[name=dot"+kind+"]")
        .attr("r", opts.roadDot.size);
      selectelt = gDots.append("svg:circle")
        .attr("class", "selecteddot")
        .attr("pointer-events", "none")
        .attr("cx", nXSc(road[kind].end[0]*1000))
        .attr("cy", nYSc(road[kind].end[1]))
        .attr("fill", opts.roadDotCol.selected)
        .attr("fill-opacity", 0.6)
        .attr("r", opts.roadDot.size+4)
        .attr("stroke", "none").lower();
    }
    function unselectDot( kind ) {
      highlightValue( kind, false );
      d3.select("[name=dot"+kind+"]")
        .attr("fill", opts.roadDotCol.editable)
        .attr("r", opts.roadDot.size);
    }
    function selectRoad( kind ) {
      if (opts.divGraph == null) return
      highlightSlope( kind, true );
      selection = kind; selectType = br.RP.SLOPE;
      d3.select("[name=road"+kind+"]")
        .attr("shape-rendering", "geometricPrecision")
        .attr("stroke-width",opts.roadLine.width);
      selectelt = gRoads.append("svg:line")
        .attr("class", "selectedroad")
        .attr("shape-rendering", "geometricPrecision")
        .attr("pointer-events", "none")
        .attr("x1", nXSc(road[kind].sta[0]*1000))
        .attr("x2", nXSc(road[kind].end[0]*1000))
        .attr("y1", nYSc(road[kind].sta[1]))
        .attr("y2", nYSc(road[kind].end[1]))
        .attr("stroke", opts.roadKnotCol.selected)
        .attr("stroke-opacity", 0.9)
        .attr("stroke-width", opts.roadLine.width+4).lower();
    }
    function unselectRoad( kind ) {
      highlightSlope( kind, false );
      var lineColor = isRoadValid( road )?
            opts.roadLineCol.valid:opts.roadLineCol.invalid;
      d3.select("[name=road"+kind+"]")
        .style("stroke",lineColor)
        .attr("stroke-width",opts.roadLine.width);
    }
    function unselect() {
      selection = null; selectType = null;
      if (selectelt != null) {selectelt.remove(); selectelt=null;}
    }
    function clearSelection() {
      //console.debug("clearSelection()");
      if (selection == null) return;
      if (selectType == br.RP.DATE) unselectKnot( selection );
      else if (selectType == br.RP.VALUE) unselectDot( selection );
      else if (selectType == br.RP.SLOPE) unselectRoad( selection);
      removeDragInfo();
      unselect();
    }

    // -------------- Functions for manipulating knots ---------------
    var roadsave, knotind, knotdate, prevslopes;

    var editingKnot = false;
    function knotDragStarted(d,i) {
	    d3.event.sourceEvent.stopPropagation();
      editingKnot = true;
      pushUndoState();
      var kind = Number(this.id);
      roadsave = br.copyRoad( road );
      if (selection == null) {
        selectKnot(kind);
      } else if (selection != null 
                 && selection == kind && selectType == br.RP.DATE) {
        clearSelection();
      } else {
        clearSelection();
        selectKnot(kind);
      }
      createDragInfo( d.end );
      knottext.grp.raise();
      // Store initial slopes to the left and right to prevent
      // collapsed segment issues
      prevslopes = [];
      prevslopes[0] = road[kind].slope;
      prevslopes[1] = road[kind+1].slope;

    }

    function knotDragged(d,i) {
      unselect();
      // event coordinates are pre-scaled, so use normal scale
	    var x = bu.daysnap(nXSc.invert(d3.event.x)/1000);
      var kind = Number(this.id);
      var rd = road;
      if (x < rd[kind].sta[0]) x = rd[kind].sta[0];
      if (x > rd[kind+1].end[0]) x = rd[kind+1].end[0];

      var maxind = kind+1;
      if (opts.keepIntervals) maxind = rd.length;

      for (let ii = kind; ii < maxind; ii++) {
	      rd[ii].end[0] 
          = x + roadsave[ii].end[0] - roadsave[kind].end[0];
      }
      if (isFinite(prevslopes[0]) && road[kind].sta[0]!=road[kind].end[0]) {
        road[kind].slope = prevslopes[0]; 
      }
      if (isFinite(prevslopes[1])&&road[kind+1].sta[0]!=road[kind+1].end[0]) {
        road[kind+1].slope = prevslopes[1]; 
      }
      br.fixRoadArray( rd, opts.keepSlopes?
                    br.RP.VALUE:br.RP.SLOPE,
                    false, br.RP.DATE );

      updateDragPositions( kind, true );
      updateDragInfo( d.end );
    };
    function knotDragEnded(d,i){
      editingKnot = false;

      if (selection == null) {
        unselectKnot(i);
        removeDragInfo();
        roadChanged();
      }
      roadsave = null;
    };

    function knotDeleted(d) {
      var kind = Number(this.id);
      removeKnot(kind, false);
    }

    function changeKnotDate( kind, newDate, fromtable = true ) {
      pushUndoState();

	    var knotmin = (kind == 0) ? goal.xMin : (road[kind].sta[0]) + 0.01;
	    var knotmax = 
            (kind == road.length-1) 
            ? road[kind].end[0]+0.01
        :(road[kind+1].end[0]+0.01);
      if (newDate <= knotmin) newDate = bu.daysnap(knotmin);
      if (newDate >= knotmax) newDate = bu.daysnap(knotmin);
      road[kind].end[0] = newDate;
      if (!fromtable) {
        // TODO?
      }
      br.fixRoadArray( road, null, fromtable, br.RP.DATE );

      roadChanged();
    }

    function knotEdited(d, id) {
      var kind = Number(id);
      var el = d3.select(opts.divTable);
      if (road[kind].auto == br.RP.DATE) {
        if (opts.keepSlopes) disableValue(id);
        else disableSlope(id);
      }
      var cell = el.select('[name=enddate'+kind+']').node();
      cell.focus();
      var range, selection;
      if (document.body.createTextRange) {
        range = document.body.createTextRange();
        range.moveToElementText(cell);
        range.select();
      } else if (window.getSelection) {
        selection = window.getSelection();
        range = document.createRange();
        range.selectNodeContents(cell);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    };

    // ------------------- Functions for manipulating dots -----------------
    var editingDot = false;
    function dotDragStarted(d,id) {
      d3.event.sourceEvent.stopPropagation();
      editingDot = true;
      pushUndoState();
      roadsave = br.copyRoad( road );
      var kind = id;
      if (selection == null) {
        selectDot(kind);
      } else if (selection != null 
                 && selection == kind && selectType == br.RP.VALUE) {
        clearSelection();
      } else {
        clearSelection();
        selectDot(kind);
      }
      if (kind != 0) {
        var seg = road[kind];
        createDragInfo( d.sta, [(seg.sta[0]+seg.end[0])/2, 
                                (seg.sta[1]+seg.end[1])/2, 
                                seg.slope*goal.siru] );
      } else createDragInfo( d.sta );
      dottext.grp.raise();
    };
    function dotDragged(d, id) {
      unselect();
      var now = goal.asof;
	    var y = nYSc.invert(d3.event.y);
      var kind = id;
      var rd = road;
      var seg = road[kind];
	    seg.end[1] = y;
      seg.slope = br.segSlope(seg);
      br.fixRoadArray( rd, opts.keepSlopes?br.RP.VALUE
                    :br.RP.SLOPE,
                    false,br.RP.VALUE );

      var strt = (kind==0)?0:(kind-1);
      updateDragPositions( strt, false );
      if (kind != 0) {
        updateDragInfo( d.sta, [(seg.sta[0]+seg.end[0])/2, 
                                (seg.sta[1]+seg.end[1])/2, 
                                seg.slope*goal.siru] );
      } else updateDragInfo( d.sta );
    };
    function dotDragEnded(d,id){
      editingDot = false;

      if (selection == null) {
        unselectDot( id );
        removeDragInfo();
        roadChanged();
      } 
      roadsave = null;

    };

    function changeDotValue( kind, newValue, fromtable = false ) {
      pushUndoState();

      road[kind].end[1] = newValue;
      if (!fromtable) {
        if (!opts.keepSlopes) 
          road[kind].slope = br.segSlope(road[kind]);
        if (kind == 1) {
          road[kind-1].sta[1] = newValue;
        } else if (kind == road.length-1) {
	        road[kind].end[1] = newValue;
	        road[kind-1].slope = 
            (road[kind].sta[1] - road[kind-1].sta[1])
            / (road[kind].sta[0] - road[kind-1].sta[0]);
        } else {
          road[kind-1].slope = 
            (road[kind].sta[1] - road[kind-1].sta[1])
            / (road[kind].sta[0] - road[kind-1].sta[0]);
        }
      }

      br.fixRoadArray( road, opts.keepSlopes?br.RP.VALUE:null, 
                    fromtable, br.RP.VALUE );

      roadChanged();
    }

    function dotEdited(d, id) {
      var kind = Number(id);
      var el = d3.select(opts.divTable);
      if (road[kind].auto == br.RP.VALUE) {
        disableSlope(id);  
      }
      var cell = el.select('[name=endvalue'+kind+']').node();
      cell.focus();
      var range, selection;
      if (document.body.createTextRange) {
        range = document.body.createTextRange();
        range.moveToElementText(cell);
        range.select();
      } else if (window.getSelection) {
        selection = window.getSelection();
        range = document.createRange();
        range.selectNodeContents(cell);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    };

    // -------------- Functions for manipulating road segments ----------
    var editingRoad = false;
    var roadedit_x;
    function roadDragStarted(d,id) {
      //console.debug("roadDragStarted: "+id);
      d3.event.sourceEvent.stopPropagation();
      editingRoad = true;
      roadedit_x = bu.daysnap(nXSc.invert(d3.event.x)/1000);
      pushUndoState();
      roadsave = br.copyRoad( road );

      if (selection == null) {
        selectRoad(id);
      } else if (selection != null 
                 && selection == id && selectType == br.RP.SLOPE) {
        clearSelection();
      } else {
        clearSelection();
        selectRoad(id);
      }
      var slopex = (d.sta[0]+d.end[0])/2;
      if (slopex < nXSc.invert(0)/1000) 
        slopex = nXSc.invert(0)/1000;
      if (slopex > nXSc.invert(plotbox.width)/1000 - 10) 
        slopex = nXSc.invert(plotbox.width)/1000 - 10;
      createDragInfo( d.end, [slopex, d.sta[1]+d.slope*(slopex-d.sta[0]),
                              d.slope*goal.siru] );
      slopetext.grp.raise();
    };
    function roadDragged(d, id) {
      //console.debug("roadDragged()");
      unselect();
      var now = goal.asof;
      var x = bu.daysnap(nXSc.invert(d3.event.x)/1000);
	    var y = nYSc.invert(d3.event.y);
      var kind = id;
      var rd = road;

      road[kind].slope 
        = ((y - d.sta[1])/Math.max(x - d.sta[0], bu.SID));
      road[kind].end[1] = road[kind].sta[1] 
        + road[kind].slope*(road[kind].end[0] 
                             - road[kind].sta[0]);
      road[kind+1].sta[1] = road[kind].end[1];
      if (!opts.keepSlopes)
        road[kind+1].slope = br.segSlope(road[kind+1]);

      br.fixRoadArray( rd, br.RP.VALUE,
                    false, br.RP.SLOPE );

      updateDragPositions( kind, true );
      var slopex = (d.sta[0]+d.end[0])/2;
      if (slopex < nXSc.invert(0)/1000) 
        slopex = nXSc.invert(0)/1000;
      if (slopex > nXSc.invert(plotbox.width)/1000 - 10) 
        slopex = nXSc.invert(plotbox.width)/1000 - 10;
      updateDragInfo( d.end, [slopex, d.sta[1]+d.slope*(slopex-d.sta[0]),
                              d.slope*goal.siru]  );
    };
    function roadDragEnded(d,id){
      //console.debug("roadDragEnded()");
      editingRoad = false;

      if (selection == null) {
        unselectRoad( id );
        removeDragInfo();
        roadChanged();
      }
      roadsave = null;
    };

    function changeRoadSlope(kind, newSlope, fromtable = false) {
      if (kind == road.length-1) return;
      pushUndoState();

      road[kind].slope = newSlope/(goal.siru);
      if (!fromtable) {
        if (!opts.keepSlopes) {
          road[kind].end[1] = road[kind].sta[1] 
            + road[kind].slope*(road[kind].end[0] 
                                 - road[kind].sta[0]);
          road[kind+1].sta[1] = road[kind].end[1];
          road[kind+1].slope = br.segSlope(road[kind+1]);
        }
      }
      br.fixRoadArray( road, null, fromtable, br.RP.SLOPE );

      roadChanged();
    }

    function roadEdited(d, id) {
      var kind = Number(id);
      var el = d3.select(opts.divTable);
      if (d.auto == br.RP.SLOPE) {
        disableValue(id);
      }
      var cell = el.select('[name=slope'+kind+']').node();
      cell.focus();
      var range, selection;
      if (document.body.createTextRange) {
        range = document.body.createTextRange();
        range.moveToElementText(cell);
        range.select();
      } else if (window.getSelection) {
        selection = window.getSelection();
        range = document.createRange();
        range.selectNodeContents(cell);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    };

    // ---------------- Functions to animate SVG components ----------------
    
    var anim = {
      buf: false, bux: false, aura: false, aurap: false,
      hor: false, hort: false, ybr: false, ybrc: false,
      guides: false, rosy: false, rosyd: false, data: false,
      dataa: false, mav:false
    }
    /** This function initiates a cyclic animation on a particular
     * element, cycling through the attribute and style information
     * supplied in two arrays. Each array is expected to include
     * triples [name, v1, v0], cycling an attribute or style with
     * 'name' up to the v1 value in 'dur' milliseconds and back to v0
     * in 'dur' milliseconds again, repeating indefinitely */
    function startAnim(elt, dur, attrs, styles, tag){
      var tr = elt.transition().duration(dur), i
      
      for (i = 0; i < attrs.length; i++) tr = tr.attr(attrs[i][0], attrs[i][1])
      for (i = 0; i < styles.length; i++) tr = tr.style(styles[i][0], styles[i][1])

      tr = tr.transition().duration(dur)
      for (i = 0; i < attrs.length; i++) tr = tr.attr(attrs[i][0], attrs[i][2])
      for (i = 0; i < styles.length; i++) tr = tr.style(styles[i][0], styles[i][2])
      tr.on("end", ()=>{if (anim[tag]) startAnim(elt, dur, attrs, styles, tag)})
      anim[tag] = true
    }
    function stopAnim(elt, dur, attrs, styles, tag){
      anim[tag] = false
      var tr = elt.transition().duration(dur)
      for (let i = 0; i < attrs.length; i++) tr = tr.attr(attrs[i][0], attrs[i][2])
      for (let i = 0; i < styles.length; i++) tr = tr.style(styles[i][0], styles[i][2])
      tr.on("end", ()=>{anim[tag] = false})
    }
      

    function animBuf(enable) {
      if (opts.roadEditor) return
      var e = gWatermark.selectAll(".waterbuf");
      var x = Number(e.attr("x"))
      var y = Number(e.attr("y"))
      if  (e.node().tagName == 'text') {
      
        let sz = e.style("font-size")
        sz = Number(sz.substring(0,sz.length-2))
        let s =[["font-size", (sz*1.3)+"px",(sz)+"px"],
                ["fill", "#c0c0c0", bu.Cols.GRAY]]
        let a =[["y", y+0.1*sz/3, y]]
        if (enable) startAnim(e, 500, a, s, "buf")
        else stopAnim(e, 300, a, s, "buf")
      } else {
        let h = opts.watermark.height
        let a =[["width", h*1.3, h], ["height", h*1.3, h],
                ["x", x-0.15*h, x], ["y", y-0.15*h, y]]
        if (enable) startAnim(e, 500, a, [], "buf")
        else stopAnim(e, 300, a, [], "buf")
      }
    }
    
    function animBux(enable) {
      if (opts.roadEditor) return
      var e = gWatermark.selectAll(".waterbux");

      var sz = e.style("font-size")
      sz = Number(sz.substring(0,sz.length-2))
      var y = Number(e.attr("y"))
      var s =[["font-size", (sz*1.3)+"px",(sz)+"px"],
              ["fill", "#c0c0c0", bu.Cols.GRAY]]
      var a =[["y", y+0.15*sz, y]]
      if (enable) startAnim(e, 500, a, s, "bux")
      else stopAnim(e, 300, a, s, "bux")
    }
    
    function animAura( enable ) {
      if (opts.roadEditor) return
      var e = gAura.selectAll(".aura");
      var ep = gAura.selectAll(".aurapast");
      
      var s =[["stroke", "#CACAEE", bu.Cols.BLUE],["fill", "#CACAEE", bu.Cols.BLUE]]
      var sp =[["stroke", "#CACAEE", bu.Cols.BLUE],["fill", "#CACAEE", bu.Cols.BLUE]]
      if (enable) {startAnim(e, 500, [], s, "aura");startAnim(ep, 500, [], sp, "aurap")}
      else {stopAnim(e, 300, [], s, "aura"); stopAnim(ep, 300, [], sp, "aurap")}
    }

    function animHor( enable ) {
      if (opts.roadEditor) return
      const o = opts.horizon
      
      var he = gHorizon.select(".horizon");
      var hte = gHorizonText.select(".horizontext");
      const a = [["stroke-width", o.width*scf*3, o.width*scf]],
            s =[["stroke-dasharray",(o.dash*1.3)+","+(o.dash*0.7),
                 (o.dash)+","+(o.dash)]]
      const ts = [["font-size",(o.font*1.2)+"px",
                   (o.font)+"px"]]
      if (enable) {
        startAnim(he, 500, a, s, "hor")
        startAnim(hte, 500, [], ts, "hort" )
      } else {
        stopAnim(he, 300, a, s, "hor")
        stopAnim(hte, 300, [], ts, "hort" )
      }
    }
    
    function animYBR( enable ) {
      if (opts.roadEditor) return
      var e = gOldRoad.select(".oldlanes");
      var styles =[["fill-opacity", 1.0, 0.5],
                     ["fill", "#ffff00", bu.Cols.DYEL]]
      if (enable) startAnim(e, 500, [], styles, "ybr")
      else stopAnim(e, 300, [], styles, "ybr")

      e = gOldCenter.select(".oldroads");
      styles =[["stroke-dasharray",
                (opts.oldRoadLine.dash*1.3)+","+(opts.oldRoadLine.dash*0.7),
                (opts.oldRoadLine.dash)+","+(opts.oldRoadLine.dash)],
               ["stroke-width",
                opts.oldRoadLine.width*scf*2, opts.oldRoadLine.width*scf]]
      if (enable) startAnim(e, 500, [], styles, "ybrc")
      else stopAnim(e, 300, [], styles, "ybrc")
    }

    function animGuides( enable ) {
      if (opts.roadEditor) return
      var e = gOldGuides.selectAll(".oldguides");
      var a =[["stroke-width", opts.guidelines.width*scf*2.5,
               (d) => ((d<0)?opts.guidelines.weekwidth*scf
                          :opts.guidelines.width*scf)],
              ["stroke",
               (d) => ((d<0)?bu.Cols.BIGG:"#ffff00"),
               (d) => ((d<0)?bu.Cols.BIGG:bu.Cols.LYEL)]]
      if (enable) startAnim(e, 500, a, [], "guides")
      else stopAnim(e, 300, a, [], "guides")
    }

    function animRosy( enable ) {
      if (opts.roadEditor) return
      var e = gRosy.selectAll(".rosy");
      var de = gRosyPts.selectAll(".rosyd");

      var a =[["stroke-width", 6*scf, 4*scf]]
      var ds =[["r", opts.dataPoint.size*scf*2, opts.dataPoint.size*scf]]
      if (enable) {startAnim(e, 500,a,[],"rosy"); startAnim(de,500,[],ds, "rosyd") }
      else {stopAnim(e, 300, a, [], "rosy"); stopAnim(de, 300, [], ds, "rosyd")}
    }

    function animData( enable ) {
      if (opts.roadEditor) return
      var e = gDpts.selectAll(".dpts");
      var attrs =[["r", opts.dataPoint.size*scf*2, opts.dataPoint.size*scf]]
      if (enable) startAnim(e, 500, attrs, [], "data")
      else stopAnim(e, 300, attrs, [], "data")
      e = gAllpts.selectAll(".allpts");
      attrs =[["r", 0.7*opts.dataPoint.size*scf*2, 0.7*opts.dataPoint.size*scf]]
      if (enable) startAnim(e, 500, attrs, [], "dataa")
      else stopAnim(e, 300, attrs, [], "dataa")
    }
    
    function animMav( enable ) {
      if (opts.roadEditor) return
      var e = gMovingAv.selectAll(".movingav");

      var a =[["stroke-width", 6*scf, 3*scf]]
      if (enable) startAnim(e, 500, a, [], "mav")
      else stopAnim(e, 300, a, [], "mav")
    }

    // ---------------- Functions to update SVG components ----------------

    // Creates or updates the shaded box to indicate past dates
    function updatePastBox() {
      if (opts.divGraph == null || road.length == 0) return;
      var pastelt = gPB.select(".past");
      if (!opts.roadEditor) {
        pastelt.remove();
        return;
      }
      if (pastelt.empty()) {
        gPB.insert("svg:rect", ":first-child")
          .attr("class","past")
	  	    .attr("x", nXSc(goal.xMin))
          .attr("y", nYSc(goal.yMax+3*(goal.yMax-goal.yMin)))
		      .attr("width", nXSc(goal.asof*1000)
                -nXSc(goal.xMin))		  
  		    .attr("height",7*Math.abs(nYSc(goal.yMin)
                                    -nYSc(goal.yMax)))
          .attr("fill", opts.pastBoxCol.fill)
          .attr("fill-opacity", opts.pastBoxCol.opacity);
      } else {
        pastelt
	  	    .attr("x", nXSc(goal.xMin))
          .attr("y", nYSc(goal.yMax+3*(goal.yMax-goal.yMin)))
		      .attr("width", nXSc(goal.asof*1000)
                -nXSc(goal.xMin))		  
  		    .attr("height",7*Math.abs(nYSc(goal.yMin)
                                    -nYSc(goal.yMax)));
      }
    }

    // Creates or updates the shaded box to indicate past dates
    function updatePastText() {
      if (opts.divGraph == null || road.length == 0) return;
      var todayelt = gGrid.select(".pastline");
      var pasttextelt = gPastText.select(".pasttext");
      if (!opts.roadEditor) {
        todayelt.remove();
        pasttextelt.remove();
        return;
      }
      if (todayelt.empty()) {
        gGrid.append("svg:line")
	        .attr("class","pastline")
	  	    .attr("x1", nXSc(goal.asof*1000))
          .attr("y1",0)
		      .attr("x2", nXSc(goal.asof*1000))
          .attr("y2",plotbox.height)
          .style("stroke", bu.Cols.AKRA) 
		      .style("stroke-width",opts.today.width);
      } else {
        todayelt
	  	    .attr("x1", nXSc(goal.asof*1000))
          .attr("y1", 0)
		      .attr("x2", nXSc(goal.asof*1000))
          .attr("y2", plotbox.height);
      }
      var textx = nXSc(goal.asof*1000)-8;
      var texty = plotbox.height/2;
      if (pasttextelt.empty()) {
        gPastText.append("svg:text")
	        .attr("class","pasttext")
	  	    .attr("x",textx ).attr("y",texty)
          .attr("transform", "rotate(-90,"+textx+","+texty+")")
          .attr("fill", bu.Cols.AKRA) 
          .style("font-size", opts.horizon.font+"px") 
          .text("Today"+" ("+moment.unix(goal.asof).utc().format("ddd")+")");
      } else {
        pasttextelt
	  	    .attr("x", textx).attr("y", texty)
          .attr("transform", "rotate(-90,"+textx+","+texty+")")
          .text("Today"+" ("+moment.unix(goal.asof).utc().format("ddd")+")");
      }
    }

    function updateContextToday() {
      if (opts.divGraph == null || road.length == 0) return;
      var todayelt = ctxplot.select(".ctxtoday");
      var pasttextelt = ctxplot.select(".ctxtodaytext");
      if (!opts.roadEditor) {
        todayelt.remove();
        pasttextelt.remove();
        return;
      }
      if (todayelt.empty()) {
        ctxplot.append("svg:line")
	        .attr("class","ctxtoday")
	  	    .attr("x1", xScB(goal.asof*1000))
          .attr("y1",0)
		      .attr("x2", xScB(goal.asof*1000))
          .attr("y2",brushbox.height)
          .style("stroke", "rgb(0,0,200)") 
		      .style("stroke-width",opts.horizon.ctxwidth);
      } else {
        todayelt
	  	    .attr("x1", xScB(goal.asof*1000))
          .attr("y1",0)
		      .attr("x2", xScB(goal.asof*1000))
          .attr("y2",brushbox.height);
      }
      var textx = xScB(goal.asof*1000)-5;
      var texty = brushbox.height/2;

      if (pasttextelt.empty()) {
        ctxplot.append("svg:text")
	        .attr("class","ctxtodaytext")
	  	    .attr("x",textx ).attr("y",texty)
          .attr("transform", "rotate(-90,"+textx+","+texty+")")
          .attr("fill", "rgb(0,0,200)") 
          .style("font-size", (opts.today.ctxfont)+"px") 
          .text("Today");
      } else {
        pasttextelt
	  	    .attr("x", textx).attr("y", texty)
          .attr("transform", "rotate(-90,"+textx+","+texty+")");
      }
    }

    // Creates or updates the Bullseye at the goal date
    function updateBullseye() {
      if (opts.divGraph == null || road.length == 0) return;
      var bullseyeelt = gBullseye.select(".bullseye");
      if (!opts.roadEditor) {
        bullseyeelt.remove();
        return;
      }
      //var bx = nXSc(road[road.length-1].sta[0]*1000)-(opts.bullsEye.size/2);
      //var by = nYSc(road[road.length-1].sta[1])-(opts.bullsEye.size/2);
      var bx = nXSc(goal.tfin*1000)-(opts.bullsEye.size/2);
      var by = nYSc(br.rdf(road, goal.tfin))-(opts.bullsEye.size/2);
      if (bullseyeelt.empty()) {
        gBullseye.append("svg:image")
	        .attr("class","bullseye")
	        .attr("xlink:href",PNG.beye)
	  	    .attr("x",bx ).attr("y",by)
          .attr('width', opts.bullsEye.size)
          .attr('height', opts.bullsEye.size);
      } else {
        bullseyeelt
	  	    .attr("x", bx).attr("y", by);
      }
    }

    function updateContextBullseye() {
      if (opts.divGraph == null || road.length == 0) return;
      var bullseyeelt = ctxplot.select(".ctxbullseye");
      if (!opts.roadEditor) {
        bullseyeelt.remove();
        return;
      }
      //var bx = xScB(road[road.length-1].sta[0]*1000)-(opts.bullsEye.ctxsize/2);
      //var by = yScB(road[road.length-1].sta[1])-(opts.bullsEye.ctxsize/2);
      var bx = xScB(goal.tfin*1000)-(opts.bullsEye.ctxsize/2);
      var by = yScB(br.rdf(road, goal.tfin))-(opts.bullsEye.ctxsize/2);
      if (bullseyeelt.empty()) {
        ctxplot.append("svg:image")
	        .attr("class","ctxbullseye")
	        .attr("xlink:href",PNG.beyey)
	  	    .attr("x",bx ).attr("y",by)
          .attr('width', (opts.bullsEye.ctxsize))
          .attr('height', (opts.bullsEye.ctxsize));
      } else {
        bullseyeelt.attr("x", bx).attr("y", by);
      }
    }

    // Creates or updates the Bullseye at the goal date
    function updateOldBullseye() {
      if (opts.divGraph == null || road.length == 0) return;
      var png = (opts.roadEditor)?PNG.beyey:PNG.beye
      var bullseyeelt = gOldBullseye.select(".oldbullseye");
      //var bx = nXSc(iroad[iroad.length-1].sta[0]*1000)-(opts.bullsEye.size/2);
      //var by = nYSc(iroad[iroad.length-1].sta[1])-(opts.bullsEye.size/2);
      var bx = nXSc(goal.tfin*1000)-(opts.bullsEye.size/2);
      var by = nYSc(br.rdf(iroad, goal.tfin))-(opts.bullsEye.size/2);
      if (bullseyeelt.empty()) {
        gOldBullseye.append("svg:image")
	        .attr("class","oldbullseye")
	        .attr("xlink:href",png)
	  	    .attr("x",bx ).attr("y",by)
          .attr('width', (opts.bullsEye.size))
          .attr('height', (opts.bullsEye.size));
      } else {
        bullseyeelt
	  	    .attr("x", bx).attr("y", by);
      }
    }

    function updateContextOldBullseye() {
      if (opts.divGraph == null || road.length == 0) return;
      var png = (opts.roadEditor)?PNG.beyey:PNG.beye
      var bullseyeelt = ctxplot.select(".ctxoldbullseye");
      var bx = xScB(iroad[iroad.length-1].sta[0]*1000)
        -(opts.bullsEye.ctxsize/2);
      var by = yScB(iroad[iroad.length-1].sta[1])
        -(opts.bullsEye.ctxsize/2);
      if (bullseyeelt.empty()) {
        ctxplot.append("svg:image")
	        .attr("class","ctxoldbullseye")
	        .attr("xlink:href",png)
	  	    .attr("x",bx ).attr("y",by)
          .attr('width', (opts.bullsEye.ctxsize))
          .attr('height', (opts.bullsEye.ctxsize));
      } else {
        bullseyeelt
	  	    .attr("x", bx).attr("y", by);
      }
    }

    // Creates or updates the watermark with the number of safe days
    function updateWatermark() {
      if (processing) return;
      
      if (opts.divGraph == null || road.length == 0 || hidden) return;

      var tl = [0,0], bl = [0, plotbox.height/2];
      var tr = [plotbox.width/2,0], br = [plotbox.width/2, plotbox.height/2];
      var offg, offb, g = null, b = null, x, y, bbox, newsize, newh;

      setWatermark();
      if (goal.loser) g = PNG.skl;
      if (goal.waterbuf === 'inf') g = PNG.inf;
      else if (goal.waterbuf === ':)') g = PNG.sml;

      if (goal.dir>0 && goal.yaw<0) { 
        offg = br; offb = tl
      } else if (goal.dir<0 && goal.yaw>0) { 
        offg = tr; offb = bl
      } else if (goal.dir<0 && goal.yaw<0) { 
        offg = bl; offb = tr
      } else {
        offg = tl; offb = br
      }

      var wbufelt = gWatermark.select(".waterbuf");
      var fs = opts.watermark.fntsize, wmh = opts.watermark.height
      wbufelt.remove();
      if (g != null) {
  	    x = (plotbox.width/2-wmh)/2;
        y = (plotbox.height/2-wmh)/2;

        wbufelt = gWatermark.append("svg:image")
	        .attr("class","waterbuf")
	        .attr("xlink:href",g)
          .attr('width', wmh)
          .attr('height', wmh);
      } else {
	  	  x = plotbox.width/4;
        y = plotbox.height/4+fs/3;
        wbufelt = gWatermark.append("svg:text")
	        .attr("class","waterbuf")
          .style('font-size', fs+"px")
          .style('font-weight', "bolder")
          .style('fill', opts.watermark.color)
          .text(goal.waterbuf);
        bbox = wbufelt.node().getBBox();
        if (bbox.width > plotbox.width/2.2) {
          newsize = (fs*(plotbox.width/2.2)
                     /bbox.width);
          newh = newsize/fs*bbox.height;
          y = plotbox.height/4+newh/3;
          wbufelt.style('font-size', newsize+"px");
        }        
      }
      wbufelt.attr("x", x + offg[0])
        .attr("y", y + offg[1]);

      var wbuxelt = gWatermark.select(".waterbux");
      wbuxelt.remove();
      if (!opts.roadEditor) {
	  	  x = plotbox.width/4;
        y = plotbox.height/4+fs/3;
        wbuxelt = gWatermark.append("svg:text")
	        .attr("class","waterbux")
          .style('font-size', fs+"px")
          .style('font-weight', "bolder")
          .style('fill', opts.watermark.color)
          .text(goal.waterbux);
        bbox = wbuxelt.node().getBBox();
        if (bbox.width > plotbox.width/2.2) {
          newsize = (fs*(plotbox.width/2.2)/bbox.width)
          newh = newsize/fs*bbox.height
          y = plotbox.height/4+newh/3
          wbuxelt.style('font-size', newsize+"px")
        }
        wbuxelt.attr("x", x + offb[0])
          .attr("y", y + offb[1])
      } else wbuxelt.remove()
    }
    
    function updateAura() {
      if (processing) return;
      var el = gAura.selectAll(".aura")
      var el2 = gAura.selectAll(".aurapast")
      if (goal.aura && opts.showData) {
        var aurdn = Math.min(-goal.lnw/2.0, -goal.stdflux)
        var aurup = Math.max(goal.lnw/2.0,  goal.stdflux)
        var fudge = PRAF*(goal.tmax-goal.tmin);
        var xr = [nXSc.invert(0).getTime()/1000, 
                  nXSc.invert(plotbox.width).getTime()/1000]
        var xvec = griddle(goal.tmin, 
                           Math.min(goal.asof+bu.AKH, goal.tmax+fudge)),i
        xvec = griddle(Math.max(xr[0], goal.tmin),
                       bu.arrMin([xr[1], goal.asof+bu.AKH, goal.tmax+fudge]),
                       plotbox.width/2)
        // Generate a path string for the aura
        var d = "M"+nXSc(xvec[0]*1000)+" "+nYSc(goal.auraf(xvec[0])+aurup)
        for (i = 1; i < xvec.length; i++)
          d += " L"+nXSc(xvec[i]*1000)+" "+nYSc(goal.auraf(xvec[i])+aurup)
        for (i = xvec.length-1; i >= 0; i--)
          d += " L"+nXSc(xvec[i]*1000)+" "+nYSc(goal.auraf(xvec[i])+aurdn)
        d += " Z"
        if (el.empty()) {
          gAura.append("svg:path")
            .attr("class","aura").attr("d", d)
  		      .style("fill", bu.Cols.BLUE)
  		      .style("stroke-width", 2).style("stroke", bu.Cols.BLUE);
        } else {
          el.attr("d", d);
        }
        if (xr[0] < goal.tmin) {
          xvec = griddle(xr[0], goal.tmin, plotbox.width/2);
          d = "M"+nXSc(xvec[0]*1000)+" "
            +nYSc(goal.auraf(xvec[0])+aurup);
          for (i = 1; i < xvec.length; i++)
            d += " L"+nXSc(xvec[i]*1000)+" "+nYSc(goal.auraf(xvec[i])+aurup)
          for (i = xvec.length-1; i >= 0; i--)
            d += " L"+nXSc(xvec[i]*1000)+" "+nYSc(goal.auraf(xvec[i])+aurdn)
          d += " Z";
          if (el2.empty()) {
            gAura.append("svg:path")
              .attr("class","aurapast").attr("d", d)
  		        .style("fill", bu.Cols.BLUE)
  		        .style("fill-opacity", 0.3)
  		        .style("stroke-width", 2)
  		        .style("stroke-dasharray", "4,4")
              .style("stroke", bu.Cols.BLUE)
          } else {
            el2.attr("d", d)
          }
        } else 
          el2.remove()
      } else {
        el.remove()
        el2.remove()
      }

    }

    // Creates or updates the Akrasia Horizon line
    function updateHorizon() {
        
      if (opts.divGraph == null || road.length == 0) return;
      const horizonelt = gHorizon.select(".horizon");
      const o = opts.horizon
      
      if (horizonelt.empty()) {
        gHorizon.append("svg:line")
	        .attr("class","horizon")
	  	    .attr("x1", nXSc(goal.horizon*1000))
          .attr("y1",0)
		      .attr("x2", nXSc(goal.horizon*1000))
          .attr("y2",plotbox.height)
          .style("stroke", bu.Cols.AKRA) 
          .style("stroke-dasharray", 
                 (o.dash)+","+(o.dash)) 
		      .attr("stroke-width",o.width*scf);
      } else {
        horizonelt
	  	    .attr("x1", nXSc(goal.horizon*1000))
          .attr("y1",0)
		      .attr("x2", nXSc(goal.horizon*1000))
          .attr("y2",plotbox.height)
		      .attr("stroke-width",o.width*scf);
      }
      var textx = nXSc(goal.horizon*1000)+(14);
      var texty = plotbox.height/2;
      var horizontextelt = gHorizonText.select(".horizontext");
      if (horizontextelt.empty()) {
        gHorizonText.append("svg:text")
	        .attr("class","horizontext")
	  	    .attr("x",textx ).attr("y",texty)
          .attr("transform", "rotate(-90,"+textx+","+texty+")")
          .attr("fill", bu.Cols.AKRA) 
          .style("font-size", (o.font)+"px") 
          .text("Akrasia Horizon");
      } else {
        horizontextelt
	  	    .attr("x", textx).attr("y", texty)
          .attr("transform", "rotate(-90,"+textx+","+texty+")");
      }
    }

    function updateContextHorizon() {
      if (opts.divGraph == null || road.length == 0) return;
      const horizonelt = ctxplot.select(".ctxhorizon");
      const o = opts.horizon
      if (horizonelt.empty()) {
        ctxplot.append("svg:line")
	        .attr("class","ctxhorizon")
	  	    .attr("x1", xScB(goal.horizon*1000))
          .attr("y1",yScB(goal.yMin-5*(goal.yMax-goal.yMin)))
		      .attr("x2", xScB(goal.horizon*1000))
          .attr("y2",yScB(goal.yMax+5*(goal.yMax-goal.yMin)))
          .style("stroke", bu.Cols.AKRA) 
          .style("stroke-dasharray", (o.ctxdash)+","
                 +(o.ctxdash)) 
		      .style("stroke-width",o.ctxwidth);
      } else {
        horizonelt
	  	    .attr("x1", xScB(goal.horizon*1000))
          .attr("y1",yScB(goal.yMin-5*(goal.yMax-goal.yMin)))
		      .attr("x2", xScB(goal.horizon*1000))
          .attr("y2",yScB(goal.yMax+5*(goal.yMax-goal.yMin)));
      }

      var textx = xScB(goal.horizon*1000)+12;
      var texty = brushbox.height/2;

      var hortextelt = ctxplot.select(".ctxhortext");
      if (hortextelt.empty()) {
        ctxplot.append("svg:text")
	        .attr("class","ctxhortext")
	  	    .attr("x",textx ).attr("y",texty)
          .attr("transform", "rotate(-90,"+textx+","+texty+")")
          .attr("fill", bu.Cols.AKRA) 
          .style("font-size", (o.ctxfont)+"px") 
          .text("Horizon");
      } else {
        hortextelt
	  	    .attr("x", textx).attr("y", texty)
          .attr("transform", "rotate(-90,"+textx+","+texty+")");
      }
    }

    function updateYBHP() {
      if (opts.divGraph == null || road.length == 0) return;
      var pinkelt = gYBHP.select(".halfplane");
      if (!opts.roadEditor) {
        pinkelt.remove();
        return;
      }

      var yedge, itoday, ihor;
      var ir = road;
      //var now = goal.xMin;
      var now = road[0].end[0];
      var hor = road[road.length-1].sta[0];
      // Determine good side of the road 
      if (goal.yaw < 0) yedge = goal.yMin - 5*(goal.yMax - goal.yMin);
      else yedge = goal.yMax + 5*(goal.yMax - goal.yMin);
      // Compute road indices for left and right boundaries
      itoday = br.findSeg(ir, now);
      ihor = br.findSeg(ir, hor);
      var d = "M"+nXSc(now*1000)+" "
            +nYSc(br.rdf(ir, now));
      for (let i = itoday; i < ihor; i++) {
        d += " L"+nXSc(ir[i].end[0]*1000)+" "
          +nYSc(ir[i].end[1]);
      }
      d+=" L"+nXSc(hor*1000)+" "+nYSc(br.rdf(ir, hor));
      d+=" L"+nXSc(hor*1000)+" "+nYSc(yedge);
      d+=" L"+nXSc(now*1000)+" "+nYSc(yedge);
      d+=" Z";
      if (pinkelt.empty()) {
        gYBHP.append("svg:path")
	        .attr("class","halfplane")
	  	    .attr("d", d)
          .attr("fill", opts.halfPlaneCol.fill);
      } else {
        pinkelt.attr("d", d);
      }
    }

    function updatePinkRegion() {
      if (opts.divGraph == null || road.length == 0) return;
      var pinkelt = gPink.select(".pinkregion");
      var yedge, itoday, ihor;
      var ir = iroad;
      var now = goal.asof;
      var hor = goal.horizon;
      // Determine good side of the road 
      if (goal.yaw > 0) yedge = goal.yMin - 5*(goal.yMax - goal.yMin);
      else yedge = goal.yMax + 5*(goal.yMax - goal.yMin);
      // Compute road indices for left and right boundaries
      itoday = br.findSeg(ir, now);
      ihor = br.findSeg(ir, hor);
      var d = "M"+nXSc(now*1000)+" "
            +nYSc(br.rdf(ir, now));
      for (let i = itoday; i < ihor; i++) {
        d += " L"+nXSc(ir[i].end[0]*1000)+" "+
          nYSc(ir[i].end[1]);
      }
      d+=" L"+nXSc(hor*1000)+" "+nYSc(br.rdf(ir, hor));
      d+=" L"+nXSc(hor*1000)+" "+nYSc(yedge);
      d+=" L"+nXSc(now*1000)+" "+nYSc(yedge);
      d+=" Z";
      if (pinkelt.empty()) {
        gPink.append("svg:path")
          .attr("class","pinkregion")
	  	    .attr("d", d)
	  	    .attr("fill-opacity", 0.4)
          .attr("fill", bu.Cols.PINK);
      } else {
        pinkelt.attr("d", d);
      }
    }

    // Creates or updates the unedited road
    function updateOldRoad() {
      if (opts.divGraph == null || road.length == 0) return;
      // Find road segments intersecting current x-axis range
      var l = [nXSc.invert(0).getTime()/1000, 
               nXSc.invert(plotbox.width).getTime()/1000];
      var rdfilt = function(r) {
        return ((r.sta[0] > l[0] && r.sta[0] < l[1])
                || (r.end[0] > l[0] && r.end[0] < l[1]));
      };
      var ir = iroad.filter(rdfilt);
      if (ir.length == 0) ir = [iroad[br.findSeg(iroad, l[0])]];

      // **** Construct the centerline path element ****
      // fx,fy: Start of the current line segment
      // ex,ey: End of the current line segment
      var fx = nXSc(ir[0].sta[0]*1000), fy = nYSc(ir[0].sta[1]);
      var ex = nXSc(ir[0].end[0]*1000), ey = nYSc(ir[0].end[1]);
      // Adjust the beginning of the road to ensure dashes are
      // stationary wrt to time
      var newx = (-nXSc(iroad[0].sta[0]*1000)) % (2*opts.oldRoadLine.dash);
      if (ex != fx) fy = (fy + (-newx-fx)*(ey-fy)/(ex-fx));
      if (fx < 0 || newx > 0) fx = -newx;
      var d, rd = "M"+fx+" "+fy;
      var i;
      for (i = 0; i < ir.length; i++) {
        ex = nXSc(ir[i].end[0]*1000); ey = nYSc(ir[i].end[1]);
        if (ex > plotbox.width) {
          fx = nXSc(ir[i].sta[0]*1000); fy = nYSc(ir[i].sta[1]);
          ey = (fy + (plotbox.width-fx)*(ey-fy)/(ex-fx));
          ex = plotbox.width;          
        }
        rd += " L"+ex+" "+ey;
      }

      var roadelt = gOldCenter.select(".oldroads");
      if (roadelt.empty()) {
        gOldCenter.append("svg:path")
          .attr("class","oldroads")
	  	    .attr("d", rd)
  		    .attr("pointer-events", "none")
          .style("stroke-dasharray", (opts.oldRoadLine.dash)+","
                 +(opts.oldRoadLine.dash))
  		    .style("fill", "none")
  		    .style("stroke-width",opts.oldRoadLine.width*scf)
  		    .style("stroke", bu.Cols.ORNG);
      } else {
        roadelt.attr("d", rd)
  		    .style("stroke-width",opts.oldRoadLine.width*scf);
      }

      // **** Construct the guideline path element ****
      // Construct and filter a trimmed road matrix iroad2 for the guidelines
      var iroad2 = iroad.slice(1,-1), ind;
      var ir2 = iroad2.filter(rdfilt);
      if (ir2.length == 0) {
        // If no segmens were found, check if we can find a segment
        // that traverses the current x-axis range
        var seg = br.findSeg(iroad2, l[0]);
        if (seg < 0) ir2 = null;
        else ir2 = [iroad2[seg]];
      }
      // If no guideline was found to be in the visible range, skip guidelines
      if (ir2 != null) {
        // fx2,fy2: Start of the current segment
        // ex2,ey2: End of the current segment
        var fx2 = nXSc(ir2[0].sta[0]*1000), fy2 = nYSc(ir2[0].sta[1]);
        var ex2 = nXSc(ir2[0].end[0]*1000), ey2 = nYSc(ir2[0].end[1]);

        var rd2 = "M"+fx2+" "+fy2;
        for (i = 0; i < ir2.length; i++) {
          ex2 = nXSc(ir2[i].end[0]*1000); ey2 = nYSc(ir2[i].end[1]);
          if (ex2 > plotbox.width) {
            fx2 = nXSc(ir2[i].sta[0]*1000); fy2 = nYSc(ir2[i].sta[1]);
            if (ex2 != fx2) 
              ey2 = (fy2 + (plotbox.width-fx2)*(ey2-fy2)/(ex2-fx2));
            ex2 = plotbox.width;          
          }
          rd2 += " L"+ex2+" "+ey2;
        }
      }

      // YBR and guidelines are only drawn when the editor is disabled
      var laneelt = gOldRoad.select(".oldlanes");
      var guideelt = gOldGuides.selectAll(".oldguides");
      if (!opts.roadEditor && ir2 != null) {

        var minpx = 3*scf; // Minimum visual width for YBR
        var thin = Math.abs(nYSc.invert(minpx)-nYSc.invert(0));
        var lw = (goal.lnw == 0)?thin:goal.lnw;
        if (Math.abs(nYSc(lw)-nYSc(0)) < minpx) lw=thin;

        fx = nXSc(ir2[0].sta[0]*1000); fy = nYSc(ir2[0].sta[1]+lw);
        ex = nXSc(ir2[0].end[0]*1000); ey = nYSc(ir2[0].end[1]+lw);
        
        // Go forward to draw the top side of YBR
        d = "M"+fx+" "+fy;
        for (i = 0; i < ir2.length; i++) {
          ex = nXSc(ir2[i].end[0]*1000);
          ey = nYSc(ir2[i].end[1]+lw);
          if (ex > plotbox.width) {
            fx = nXSc(ir2[i].sta[0]*1000); fy = nYSc(ir2[i].sta[1]+lw);
            ey = (fy + (plotbox.width-fx)*(ey-fy)/(ex-fx)); ex = plotbox.width;
          }
          d += " L"+ex+" "+ey;
        }
        // Go down and backward for the bottom side of the YBR
        ey += (nYSc(0) - nYSc(2*lw));
        d += " L"+ex+" "+ey;
        for (i = ir2.length-1; i >= 0; i--) {
          fx = nXSc(ir2[i].sta[0]*1000); fy = nYSc(ir2[i].sta[1]-lw);
          if (fx < 0) {
            ex = nXSc(ir2[i].end[0]*1000); ey = nYSc(ir2[i].end[1]-lw);
            fy = (fy + (0-fx)*(ey-fy)/(ex-fx)); fx = 0;          
          }
          d += " L"+fx+" "+fy;
        }
        d += " Z";
        // **** Draw the YBR ****
        if (laneelt.empty()) {
          gOldRoad.append("svg:path")
            .attr("class","oldlanes")
  		      .attr("pointer-events", "none")
	  	      .attr("d", d)
  		      .style("fill", bu.Cols.DYEL)
  		      .style("fill-opacity", 0.5)
  		      .style("stroke", "none");
        } else {
          laneelt.attr("d", d);
        }

        // **** Update guidelines ****
        var yrange = [nYSc.invert(plotbox.height), nYSc.invert(0)];
        var delta = 1, oneshift, yr = Math.abs(yrange[1] - yrange[0]);
        var bc = goal.maxflux?[goal.yaw*goal.maxflux,0]:br.bufcap(road, goal)
        bc[0] = nYSc(bc[0])-nYSc(0)
        if (goal.lnw > 0 && yr / goal.lnw <= 32) delta = goal.lnw
        else if (goal.lnw > 0 && yr / (6*goal.lnw) <= 32) {
          delta = 6* goal.lnw
        } else {
          delta = yr / 32
        }
        oneshift = goal.yaw * delta
        var numlines = Math.floor(Math.abs((yrange[1] - yrange[0])/oneshift))

        // Create a dummy array as d3 data for guidelines
        var arr = new Array(Math.ceil(numlines)).fill(0);
        // Add a final data entry for the thick guideline
        arr.push(-1)
        var shift = nYSc(ir2[0].sta[1]+oneshift) - nYSc(ir2[0].sta[1]);
        guideelt = guideelt.data(arr);
        guideelt.exit().remove();
        guideelt.enter().append("svg:path")
          .attr("class","oldguides")
	  	    .attr("d", rd2)
	  	    .attr("transform", (d,i) => ("translate(0,"+((d<0)?bc[0]:((i+1)*shift))+")"))
  		    .attr("pointer-events", "none")
  		    .style("fill", "none")
  		    .attr("stroke-width",
                (d,i) => ((d<0)?opts.guidelines.weekwidth*scf
                          :opts.guidelines.width*scf))
  		    .attr("stroke",(d,i) => ((d<0)?bu.Cols.BIGG:bu.Cols.LYEL));
        guideelt.attr("d", rd2)
          .attr("transform", function(d,i) { 
            return "translate(0,"+((d<0)?bc[0]:((i+1)*shift))+")";})
  		    .attr("stroke-width", (d,i)=>((d<0)?opts.guidelines.weekwidth*scf
                                        :opts.guidelines.width*scf))
  		    .attr("stroke",  (d,i) =>((d<0)?bu.Cols.BIGG:bu.Cols.LYEL));
      } else {
        laneelt.remove();
        guideelt.remove();
      }
    }

    function updateContextOldRoad() {
      if (opts.divGraph == null || road.length == 0) return;
      // Create, update and delete road lines on the brush graph
      var roadelt = ctxplot.selectAll(".ctxoldroads");
      var ir = iroad;
      var d = "M"+xScB(ir[0].sta[0]*1000)+" "
            +yScB(ir[0].sta[1]);
      for (let i = 0; i < ir.length; i++) {
        d += " L"+xScB(ir[i].end[0]*1000)+" "+
          yScB(ir[i].end[1]);
      }
      if (roadelt.empty()) {
        ctxplot.append("svg:path")
          .attr("class","ctxoldroads")
	  	    .attr("d", d)
          .style("stroke-dasharray", (opts.oldRoadLine.ctxdash)+","
                 +(opts.oldRoadLine.ctxdash)) 
  		    .style("fill", "none")
  		    .style("stroke-width",opts.oldRoadLine.ctxwidth)
  		    .style("stroke", bu.Cols.ORNG);
      } else {
        roadelt.attr("d", d);
      }
    }

    // Creates or updates vertical lines for odometer resets
    function updateOdomResets() {
      if (opts.divGraph == null || road.length == 0 || bbr.oresets.length == 0) return;

      // Create, update and delete vertical knot lines
      var orelt = gOResets.selectAll(".oresets").data(bbr.oresets);
      if (opts.roadEditor) {
        orelt.remove(); return
      }
      orelt.exit().remove();
      orelt
	      .attr("x1", function(d){ return nXSc(d*1000);})
	      .attr("y1", 0)
	      .attr("x2", function(d){ return nXSc(d*1000);})
        .attr("y2", plotbox.height)
      orelt.enter().append("svg:line")
	      .attr("class","oresets")
	      .attr("id", function(d,i) {return i;})
	      .attr("name", function(d,i) {return "oreset"+i;})
	      .attr("x1", function(d){ return nXSc(d*1000);})
	      .attr("x2", function(d){ return nXSc(d*1000);})
	      .attr("stroke", "rgb(200,200,200)") 
          .style("stroke-dasharray", 
                 (opts.odomReset.dash)+","+(opts.odomReset.dash)) 
	      .attr("stroke-width",opts.odomReset.width);
    }

    function updateKnots() {
      if (opts.divGraph == null || road.length == 0) return;
      // Create, update and delete vertical knot lines
      var knotelt = gKnots.selectAll(".knots").data(road);
      var knotrmelt = buttonarea.selectAll(".remove").data(road);
      if (!opts.roadEditor) {
        knotelt.remove();
        knotrmelt.remove();
        return;
      }
      knotelt.exit().remove();
      knotelt
	      .attr("x1", function(d){ return nXSc(d.end[0]*1000);})
	      .attr("y1", 0)
	      .attr("x2", function(d){ return nXSc(d.end[0]*1000);})
        .attr("y2", plotbox.height)
	      .attr("stroke", "rgb(200,200,200)") 
	      .attr("stroke-width",opts.roadKnot.width);
      knotelt.enter().append("svg:line")
	      .attr("class","knots")
	      .attr("id", function(d,i) {return i;})
	      .attr("name", function(d,i) {return "knot"+i;})
	      .attr("x1", function(d){ return nXSc(d.end[0]*1000);})
	      .attr("x2", function(d){ return nXSc(d.end[0]*1000);})
	      .attr("stroke", "rgb(200,200,200)") 
	      .attr("stroke-width",opts.roadKnot.width)
        .on('wheel', function(d) { 
          // Redispatch a copy of the event to the zoom area
          var new_event = new d3.event.constructor(d3.event.type, 
                                                   d3.event); 
          zoomarea.node().dispatchEvent(new_event);})
	      .on("mouseover",function(d,i) {
	        if (!editingKnot && !editingDot && !editingRoad
             && !(selectType == br.RP.DATE && i == selection)) {
            highlightDate(i,true);
            d3.select(this)
              .attr("stroke-width",(opts.roadKnot.width+2));
          }})
	      .on("mouseout",function(d,i) {
	        if (!editingKnot && !editingDot && !editingRoad
             && !(selectType == br.RP.DATE && i == selection)) {
            highlightDate(i,false);
            d3.select(this)
              .attr("stroke-width",opts.roadKnot.width);
          }})
        .on("click", function(d,i) { 
          if (d3.event.ctrlKey) knotEdited(d,this.id);})
        .call(d3.drag()
              .on("start", knotDragStarted)
              .on("drag", knotDragged)
              .on("end", knotDragEnded));

      // Create, update and delete removal icons for knots
      knotrmelt.exit().remove();
      knotrmelt
      //  	            .attr("id", function(d,i) {return i;})
      //	            .attr("name", function(d,i) {return "remove"+i;})
        .attr("transform", 
              function(d){ 
                return "translate("+(nXSc(d.end[0]*1000)
                                     +plotpad.left-14*opts.roadKnot.rmbtnscale)
                  +","+(plotpad.top-28*opts.roadKnot.rmbtnscale-3)+") scale("+opts.roadKnot.rmbtnscale+")";
              })
        .style("visibility", function(d,i) {
          return (i > 0 && i<road.length-2)
            ?"visible":"hidden";});
      knotrmelt.enter()
        .append("use")
        .attr("class", "remove")
        .attr("xlink:href", "#removebutton")
  	    .attr("id", function(d,i) {return i;})
	      .attr("name", function(d,i) {return "remove"+i;})
        .attr("transform", 
              function(d){ 
                return "translate("+(nXSc(d.end[0]*1000)
                                     +plotpad.left-14*opts.roadKnot.rmbtnscale)
                  +","+(plotpad.top-28*opts.roadKnot.rmbtnscale-3)+") scale("+opts.roadKnot.rmbtnscale+")";
              })
        .style("visibility", function(d,i) {
          return (i > 0 && i < road.length-2)
            ?"visible":"hidden";})
		    .on("mouseenter",function(d,i) {
			    d3.select(this).attr("fill",opts.roadKnotCol.rmbtnsel); 
          highlightDate(i, true);})
		    .on("mouseout",function(d,i) {
			    d3.select(this).attr("fill",opts.roadKnotCol.rmbtns);
        highlightDate(i, false);})
		    .on("click",knotDeleted);
    }

    function updateRoads() {
      if (opts.divGraph == null || road.length == 0) return;
      var lineColor = isRoadValid( road )?
            opts.roadLineCol.valid:opts.roadLineCol.invalid;

      // Create, update and delete road lines
      var roadelt = gRoads.selectAll(".roads").data(road);
      if (!opts.roadEditor) {
        roadelt.remove();
        return;
      }
      roadelt.exit().remove();
      roadelt
		    .attr("x1", function(d){ return nXSc(d.sta[0]*1000);})
        .attr("y1",function(d){ return nYSc(d.sta[1]);})
		    .attr("x2", function(d){ return nXSc(d.end[0]*1000);})
		    .attr("y2",function(d){ return nYSc(d.end[1]);})
		    .style("stroke",lineColor);
      roadelt.enter()
        .append("svg:line")
		    .attr("class","roads")
  		  .attr("id", function(d,i) {return i;})
	  	  .attr("name", function(d,i) {return "road"+i;})
  		  .attr("x1", function(d){ return nXSc(d.sta[0]*1000);})
  		  .attr("y1",function(d){ return nYSc(d.sta[1]);})
	  	  .attr("x2", function(d){ return nXSc(d.end[0]*1000);})
  		  .attr("y2",function(d){ return nYSc(d.end[1]);})
		    .style("stroke",lineColor)
  		  .attr("stroke-width",opts.roadLine.width)
        .on('wheel', function(d) { 
          // Redispatch a copy of the event to the zoom area
          var new_event = new d3.event.constructor(d3.event.type, 
                                                   d3.event); 
          zoomarea.node().dispatchEvent(new_event);})		  
        .on("mouseover",function(d,i) { 
	        if (!editingKnot && !editingDot && !editingRoad
             && !(selectType == br.RP.SLOPE && i == selection)) {
            if (i > 0 && i < road.length-1) {
			        d3.select(this)
                .attr("stroke-width",(opts.roadLine.width+2));
              highlightSlope(i, true);}}})
		    .on("mouseout",function(d,i) { 
	        if (!editingKnot && !editingDot && !editingRoad
             && !(selectType == br.RP.SLOPE && i == selection)) {
            if (i > 0 && i < road.length-1) {
			        d3.select(this)
                .attr("stroke-width",opts.roadLine.width);
              highlightSlope(i, false);}}})
        .on("click", function(d,i) { 
          if (d3.event.ctrlKey) roadEdited(d, this.id);})
        .call(d3.drag()
              .on("start", function(d,i) { 
                if (i > 0 && i < road.length-1) 
                  roadDragStarted(d, Number(this.id));})
              .on("drag", function(d,i) { 
                if (i > 0 && i < road.length-1) 
                  roadDragged(d, Number(this.id));})
              .on("end", function(d,i) { 
                if (i > 0 && i < road.length-1) 
                  roadDragEnded(d, Number(this.id));}));
    }

    function updateRoadValidity() {
      if (opts.divGraph == null || road.length == 0) return;
      var lineColor = isRoadValid( road )?
            opts.roadLineCol.valid:opts.roadLineCol.invalid;

      // Create, update and delete road lines
      var roadelt = gRoads.selectAll(".roads");
      roadelt.style("stroke",lineColor);

      roadelt = ctxplot.selectAll(".ctxroads");
      roadelt.style("stroke",lineColor);
    }

    function updateContextRoads() {
      if (opts.divGraph == null || road.length == 0) return;
      var lineColor = isRoadValid( road )?
            opts.roadLineCol.valid:opts.roadLineCol.invalid;

      // Create, update and delete road lines for the brush 
      var roadelt = ctxplot.selectAll(".ctxroads").data(road);
      if (!opts.roadEditor) {
        roadelt.remove();
        return;
      }
      roadelt.exit().remove();
      roadelt
		    .attr("x1", function(d){ return xScB(d.sta[0]*1000);})
        .attr("y1",function(d){ return yScB(d.sta[1]);})
		    .attr("x2", function(d){ return xScB(d.end[0]*1000);})
		    .attr("y2",function(d){ return yScB(d.end[1]);})
  		  .style("stroke", lineColor);
      roadelt.enter()
        .append("svg:line")
		    .attr("class","ctxroads")
  		  .attr("id", function(d,i) {return i;})
	  	  .attr("name", function(d,i) {return "ctxroad"+i;})
  		  .attr("x1", function(d){ return xScB(d.sta[0]*1000);})
  		  .attr("y1",function(d){ return yScB(d.sta[1]);})
	  	  .attr("x2", function(d){ return xScB(d.end[0]*1000);})
  		  .attr("y2",function(d){ return yScB(d.end[1]);})
  		  .style("stroke", lineColor)
  		  .style("stroke-width",opts.roadLine.ctxwidth);
    }

    function updateDots() {
      if (opts.divGraph == null || road.length == 0) return;
      // Create, update and delete inflection points
      var dotelt = gDots.selectAll(".dots").data(road);
      if (!opts.roadEditor) {
        dotelt.remove();
        return;
      }
      dotelt.exit().remove();
      dotelt
		    .attr("cx", function(d){ return nXSc(d.sta[0]*1000);})
        .attr("cy",function(d){ return nYSc(d.sta[1]);});
      dotelt.enter().append("svg:circle")
		    .attr("class","dots")
		    .attr("id", function(d,i) {return i-1;})
		    .attr("name", function(d,i) {return "dot"+(i-1);})
        .attr("cx", function(d){ return nXSc(d.sta[0]*1000);})
		    .attr("cy",function(d){ return nYSc(d.sta[1]);})
		    .attr("r", opts.roadDot.size)
        .attr("fill", opts.roadDotCol.editable)
		    .style("stroke-width", opts.roadDot.border) 
        .on('wheel', function(d) { 
          // Redispatch a copy of the event to the zoom area
          var new_event = new d3.event.constructor(d3.event.type, 
                                                   d3.event); 
          zoomarea.node().dispatchEvent(new_event);})
        .on("mouseover",function(d,i) { 
	        if (!editingKnot && !editingDot && !editingRoad
              && !(selectType == br.RP.VALUE && i-1 == selection)) {
            highlightValue(i-1, true);
			      d3.select(this).attr("r",opts.roadDot.size+2);
          }})
		    .on("mouseout",function(d,i) { 
	        if (!editingKnot && !editingDot && !editingRoad
              && !(selectType == br.RP.VALUE && i-1 == selection)) {
            highlightValue(i-1, false);
			      d3.select(this).attr("r",opts.roadDot.size);
          }})
        .on("click", function(d,i) { 
          if (d3.event.ctrlKey) dotEdited(d,this.id);})
        .call(d3.drag()
              .on("start", function(d,i) { 
                dotDragStarted(d, Number(this.id));})
              .on("drag", function(d,i) { 
                dotDragged(d, Number(this.id));})
              .on("end", function(d,i) { 
                dotDragEnded(d, Number(this.id));}));
    }
    function updateContextDots() {
      if (opts.divGraph == null || road.length == 0) return;
      // Create, update and delete inflection points
      var dotelt = ctxplot.selectAll(".ctxdots").data(road);
      if (!opts.roadEditor) {
        dotelt.remove();
        return;
      }
      dotelt.exit().remove();
      dotelt
		    .attr("cx", function(d){ return xScB(d.sta[0]*1000);})
        .attr("cy",function(d){ return yScB(d.sta[1]);});
      dotelt.enter().append("svg:circle")
		    .attr("class","ctxdots")
		    .attr("r", opts.roadDot.ctxsize)
        .attr("fill", opts.roadDotCol.editable)
		    .style("stroke-width", opts.roadDot.ctxborder)
        .attr("cx", function(d){ return xScB(d.sta[0]*1000);})
		    .attr("cy",function(d){ return yScB(d.sta[1]);});
    }

    function dpFill( pt ) {
      return br.dotcolor(road, goal, pt[0], pt[1]);
    }
    function dpFillOp( pt ) {
      return (pt[3] == bbr.DPTYPE.AGGPAST)?1:0.3;
    }
    function dpStrokeWidth( pt ) {
      return (((pt[3] == bbr.DPTYPE.AGGPAST)?1:0.5)*scf)+"px";
    }

    var dotTimer = null, dotText = null;
    function showDotText(d) {
	    var ptx = nXSc(bu.daysnap(d[0])*1000);
	    var pty = nYSc(d[1]);
      var txt = moment.unix(d[0]).utc().format("YYYY-MM-DD")
        +", "+((d[6] != null)?bu.shn(d[6]):bu.shn(d[1]));
      if (dotText != null) rmTextBox(dotText);
      var info = [];
      if (d[2] !== "") info.push("\""+d[2]+"\"");
      if (d[6] !== null && d[1] !== d[6]) info.push("total:"+d[1]);
      var col = br.dotcolor(road, goal, d[0], d[1]);
      dotText = createTextBox(ptx, pty-(15+18*info.length), txt, 
                              col, info );
    };
    function removeDotText() { rmTextBox(dotText); }

    function updateDotGroup(grp,d,cls,r,
                            s=null,sw=null,f=null,hov=true,fop=null) {
      var dpelt;
      dpelt = grp.selectAll("."+cls).data(d);
      dpelt.exit().remove();
      dpelt
		    .attr("cx", function(d){ return nXSc((d[0])*1000);})
        .attr("cy",function(d){ return nYSc(d[1]);});
      if (r != null && scf != oldscf) dpelt.attr("r", r);
      if (sw != null) dpelt.attr("stroke-width", sw);
      if (cls != "rosyd" && cls != "steppyd" && cls != "hpts") {
        if (f != null) dpelt.attr("fill", f)
        if (fop != null) dpelt.style("fill-opacity", fop)
      }

      dpelt.enter().append("svg:circle")
		    .attr("class",cls)
        .attr("r", r)
		    .attr("cx", function(d){ return nXSc((d[0])*1000);})
        .attr("cy",function(d){ return nYSc(d[1]);})
		    .attr("stroke-width", sw)
		    .style("stroke", s)
        .attr("fill", f)
        .style("fill-opacity", fop)
        .style("pointer-events", function() {
          return (opts.roadEditor&&hov)?"none":"all";})
		    .on("mouseenter",function(d) {
          if (dotTimer != null) window.clearTimeout(dotTimer);
          dotTimer = window.setTimeout(function() {
            showDotText(d); dotTimer = null;
			    }, 500);})
		    .on("mouseout",function() { 
          if (dotText != null) {
            removeDotText();
            dotText = null;
          }
          window.clearTimeout(dotTimer); dotTimer = null;});
    }

    function updateRosy() {
      if (processing) return;

      var l = [nXSc.invert(0).getTime()/1000, 
               nXSc.invert(plotbox.width).getTime()/1000];
      var df = function(d) {
        return ((d[0] >= l[0] && d[0] <= l[1]) || (d[4] >= l[0] && d[4] <= l[1]));
      }

      // *** Plot rosy lines ***
      var rosyelt = gRosy.selectAll(".rosy");
      var rosydelt = gRosyPts.selectAll(".rosyd");
      if (opts.showData || !opts.roadEditor) {
        if (goal.rosy) {
          var pts = (bbr.flad != null)
              ?bbr.rosydata.slice(0,bbr.rosydata.length-1):bbr.rosydata;
          var npts = pts.filter(df), i;
          if (bbr.rosydata.length == 0) {
            // no points are in range, find enclosing two
            var ind = -1;
            for (i = 0; i < bbr.rosydata.length-1; i++) {
              if (bbr.rosydata[i][0]<=l[0]&&bbr.rosydata[i+1][0]>=l[1]) {
                ind = i; break;
              }
            }
            if (ind > 0) npts = bbr.rosydata.slice(ind, ind+2);
          }
          if (npts.length != 0) {
            var d = "M"+nXSc(npts[0][4]*1000)+" "+nYSc(npts[0][5]);
            for (i = 0; i < npts.length; i++) {
              d += " L"+nXSc(npts[i][0]*1000)+" "+ nYSc(npts[i][1]);
            }
            if (rosyelt.empty()) {
              gRosy.append("svg:path")
                .attr("class","rosy")
	  	          .attr("d", d)
  		          .style("fill", "none")
  		          .attr("stroke-width",4*scf)
  		          .style("stroke", bu.Cols.ROSE);
            } else {
              rosyelt.attr("d", d)
  		          .attr("stroke-width",4*scf);
            }
          } else rosyelt.remove();
          updateDotGroup(gRosyPts, npts, "rosyd", 
                         opts.dataPoint.size*scf,
                         "none", null, bu.Cols.ROSE, true, null);
        } else {
          rosyelt.remove();
          rosydelt.remove();
        }
      } else {
        rosyelt.remove();
        rosydelt.remove();
      }
    }
    
    function updateSteppy() {
      if (processing) return;

      var l = [nXSc.invert(0).getTime()/1000,
               nXSc.invert(plotbox.width).getTime()/1000];
      var df = function(d) {
        return ((d[0] >= l[0] && d[0] <= l[1]) || (d[4] >= l[0] && d[4] <= l[1]));
      }
      // *** Plot steppy lines ***
      var stpelt = gSteppy.selectAll(".steppy");
      var stpdelt = gSteppyPts.selectAll(".steppyd");
      if (opts.showData || !opts.roadEditor) {
        if (!opts.roadEditor && goal.steppy && dataf.length != 0) {
          var npts = dataf.filter(df), i;
          if (npts.length == 0) {
            // no points are in range, find enclosing two
            var ind = -1;
            for (i = 0; i < dataf.length-1; i++) {
              if (dataf[i][0]<=l[0]&&dataf[i+1][0]>=l[1]) {
                ind = i; break;
              }
            }
            if (ind > 0) npts = dataf.slice(ind, ind+2);
          }
          if (npts.length != 0) {
            var d;
            if (dataf[0][0] > l[0] && dataf[0][0] < l[1]
                && bbr.allvals.hasOwnProperty(dataf[0][0])) {
              // Handle the initial point
              var vals = bbr.allvals[dataf[0][0]].map(e=>e[0])
              var vpre = (goal.dir<0)?bu.arrMax(vals):bu.arrMin(vals)
              d = "M"+nXSc(dataf[0][0]*1000)+" "+nYSc(vpre)
              d += "L"+nXSc(npts[0][4]*1000)+" "+nYSc(npts[0][5])
            } else {
              d = "M"+nXSc(npts[0][4]*1000)+" "+nYSc(npts[0][5])
            }
            for (i = 0; i < npts.length; i++) {
              d += " L"+nXSc(npts[i][0]*1000)+" "+ nYSc(npts[i][5]);
              d += " L"+nXSc(npts[i][0]*1000)+" "+ nYSc(npts[i][1]);
            }
            if (stpelt.empty()) {
              gSteppy.append("svg:path")
                .attr("class","steppy")
	  	          .attr("d", d)
  		          .style("fill", "none")
  		          .attr("stroke-width",4*scf)
  		          .style("stroke", bu.Cols.PURP);
            } else {
              stpelt.attr("d", d)
  		          .attr("stroke-width",4*scf);
            }
          } else stpelt.remove();
          updateDotGroup(gSteppyPts, bbr.flad?npts.slice(0,npts.length-1):npts,
                         "steppyd",(opts.dataPoint.size+2)*scf,
                         "none", null, bu.Cols.PURP);
        } else {
          stpelt.remove();
          stpdelt.remove();
        }
      } else {
        stpelt.remove();
        stpdelt.remove();
      }
    }
    
    function updateDerails() {
      if (processing) return;

      var l = [nXSc.invert(0).getTime()/1000, 
               nXSc.invert(plotbox.width).getTime()/1000];
      
      function ddf(d) {// Filter to extract derailments
        return (d[0] >= l[0] && d[0] <= l[1]);
      }

      var drelt
      // *** Plot derailments ***
      if (opts.showData || !opts.roadEditor) {
        var drpts = bbr.derails.filter(ddf);
        var arrow = (goal.yaw>0)?"#downarrow":"#uparrow"
        drelt = gDerails.selectAll(".derails").data(drpts);
        drelt.exit().remove();
        drelt
		      .attr("transform", function(d){ return "translate("+(nXSc((d[0])*1000))+","
                                          +nYSc(d[1])+"),scale("
                                          +(opts.dataPoint.fsize*scf/24)+")"})
      
        drelt.enter().append("svg:use")
		      .attr("class","derails")
          .attr("xlink:href", arrow)
		      .attr("transform", function(d){ return "translate("+(nXSc((d[0])*1000))+","
                                          +nYSc(d[1])+"),scale("
                                          +(opts.dataPoint.fsize*scf/24)+")"})
          .attr("fill", bu.Cols.REDDOT)
          .style("pointer-events", "none")
      } else {
        drelt = gDerails.selectAll(".derails");
        drelt.remove();
      }        
    }
    
    function updateDataPoints() {
      if (processing) return;
      if (opts.divGraph == null || road.length == 0) return;
      //console.debug("id="+curid+", updateDataPoints()");
      var l = [nXSc.invert(0).getTime()/1000, 
               nXSc.invert(plotbox.width).getTime()/1000];
      // Filter to apply to normal datapoints
      var df = function(d) {
        return ((d[0] >= l[0] && d[0] <= l[1]) || (d[4] >= l[0] && d[4] <= l[1]));
      }
      // Filter to apply to all datapoints
      var adf = function(d) {
        return (d[0] >= l[0] && d[0] <= l[1]);
      }
      var now = goal.asof;
      var dpelt;
      if (opts.showData || !opts.roadEditor) {
        var pts = (bbr.flad != null)?dataf.slice(0,dataf.length-1):dataf;
        
        // *** Plot datapoints ***
        // Filter data to only include visible points
        pts = pts.filter(df);
        if (goal.plotall && !opts.roadEditor) {
          updateDotGroup(gAllpts, alldataf.filter(adf), "allpts", 
                         0.7*(opts.dataPoint.size)*scf,
                         "none", null, dpFill, true, dpFillOp);
          
        } else {
          var el = gAllpts.selectAll(".allpts");
          el.remove();
        }
        if (opts.roadEditor)
          updateDotGroup(gDpts, pts.concat(bbr.fuda), "dpts", 
                         opts.dataPoint.size*scf, opts.dataPointCol.stroke,
                         (opts.dataPoint.border*scf)+"px", dpFill, true, dpFillOp);
        else {
          updateDotGroup(gDpts, pts.concat(bbr.fuda), "dpts", 
                         opts.dataPoint.size*scf,
                         "#000000", dpStrokeWidth, dpFill, true, dpFillOp);
          // Compute and plot hollow datapoints
          updateDotGroup(gHollow, bbr.hollow.filter(df), "hpts", 
                         opts.dataPoint.hsize*scf, null,
                         null, bu.Cols.WITE, true, 1);
        }
          
        // *** Plot flatlined datapoint ***
        var fladelt = gFlat.selectAll(".fladp");
        if (bbr.flad != null) {
          if (fladelt.empty()) {
            gFlat.append("svg:use")
		          .attr("class","fladp").attr("xlink:href", "#rightarrow")
              .attr("fill", br.dotcolor(road,goal,bbr.flad[0],bbr.flad[1]))
              .attr("transform", "translate("+(nXSc((bbr.flad[0])*1000))+","
                    +nYSc(bbr.flad[1])+"),scale("+(opts.dataPoint.fsize*scf/24)+")")
              .style("pointer-events", function() {
                return (opts.roadEditor)?"none":"all";})
		          .on("mouseenter",function() {
                if (dotTimer != null)  window.clearTimeout(dotTimer);
                dotTimer = window.setTimeout(function() {
                  showDotText(bbr.flad); dotTimer = null;}, 500);})
		          .on("mouseout",function() { 
                if (dotText != null) { removeDotText(); dotText = null; }
                window.clearTimeout(dotTimer); 
                dotTimer = null;});
          } else {
            fladelt
              .attr("fill", br.dotcolor(road,goal,bbr.flad[0],bbr.flad[1]))
              .attr("transform", 
                    "translate("+(nXSc((bbr.flad[0])*1000))+","
                    +nYSc(bbr.flad[1])+"),scale("
                    +(opts.dataPoint.fsize*scf/35)+")");
          }
        } else {
          if (!fladelt.empty()) fladelt.remove();
        }
        
      } else {
        dpelt = gDpts.selectAll(".dpts");
        dpelt.remove();
        fladelt = gDpts.selectAll(".fladp");
        fladelt.remove();
      }
    }

    function updateHashtags() {
      if (processing) return;
      
      var hashel
      if (!opts.roadEditor) {
        hashel = gHashtags.selectAll(".hashtag").data(bbr.hashtags);
        hashel.exit().remove();
        hashel
		      .attr("x", function(d){ return nXSc((d[0])*1000);})
          .attr("transform", d=>("rotate(-90,"+nXSc((d[0])*1000)
                                 +","+(plotbox.height/2)+")"))
          .text(d=>(d[1]))
        hashel.enter().append("svg:text")
	        .attr("class","hashtag")
		      .attr("x", d=>(nXSc((d[0])*1000)))
		      .attr("y", plotbox.height/2)
          .attr("transform", d=>("rotate(-90,"+nXSc((d[0])*1000)+","+(plotbox.height/2)+")"))
          .attr("fill", bu.Cols.BLACK) 
          .style("font-size", opts.horizon.font+"px") 
          .text(d=>(d[1]))
        
      } else {
        hashel = gHashtags.selectAll(".hashtag");
        hashel.remove()
      }
    }
    

    // Other ideas for data smoothing...  Double Exponential
    // Moving Average: http://stackoverflow.com/q/5533544 Uluc
    // notes that we should use an acausal filter to prevent the
    // lag in the thin purple line.
    function updateMovingAv() {
      if (processing) return;
      
      var el = gMovingAv.selectAll(".movingav");
      if (!opts.roadEditor && goal.movingav && opts.showData) {
        var l = [nXSc.invert(0).getTime()/1000, 
                 nXSc.invert(plotbox.width).getTime()/1000];
        var rdfilt = function(r) {
          return ((r.sta[0] > l[0] && r.sta[0] < l[1])
                  || (r.end[0] > l[0] && r.end[0] < l[1]));
        };
        var pts = goal.filtpts.filter(function(e){
          return (e[0] > l[0]-2*bu.SID && e[0] < l[1]+2*bu.SID);});
        if (pts.length > 0){
          var d = "M"+nXSc(pts[0][0]*1000)+" "+nYSc(pts[0][1]);
          for (let i = 1; i < pts.length; i++) {
            d += " L"+nXSc(pts[i][0]*1000)+" "+nYSc(pts[i][1]);
          }
          if (el.empty()) {
            gMovingAv.append("svg:path")
              .attr("class","movingav")
	  	        .attr("d", d)
  		        .style("fill", "none")
  		        .attr("stroke-width",3*scf)
  		        .style("stroke", bu.Cols.PURP);
          } else {
            el.attr("d", d)
  		        .attr("stroke-width",3*scf);
          }
        } else el.remove();
      } else {
        el.remove();
      }
    }

    // Create the table header and body to show road segments
    var tcont, thead, tbody;
    function createRoadTable() {
      var roadcolumns;
      if (opts.tableCheckboxes)
        roadcolumns = ['', '', 'End Date', '', 'Value', '',
                       'Daily Slope', ''];
      else
        roadcolumns = ['', '', 'End Date', 'Value', 'Daily Slope', ''];
      tcont = d3.select(opts.divTable).select(".rtablebody");
      thead = d3.select(opts.divTable).select(".rtable");
      tbody = thead.append('div').attr('class', 'roadbody');
    }
    
    // Create the table header and body to show the start node
    var sthead, stbody, sttail;
    function createStartTable() {
      var startcolumns, tailcolumns;
      if (opts.tableCheckboxes)
        startcolumns = ['', '', 'Start Date', '', 'Value', ''];
      else
        startcolumns = ['', '', 'Start Date', 'Value', ''];

      sthead = d3.select(opts.divTable).select(".rtablestart");
      sthead.append("div").attr('class', 'roadhdr')
        .append("div").attr('class', 'roadhdrrow')
        .selectAll("span.roadhdrcell").data(startcolumns)
        .enter().append('span').attr('class', 'roadhdrcell')
        .text((c)=>c);
      stbody = sthead.append('div').attr('class', 'roadbody'); 
      if (opts.tableCheckboxes)
        tailcolumns = ['', '', 'End Date', '', 'Value', '', 'Daily Slope'];
      else
        tailcolumns = ['', '', 'End Date', 'Value', 'Daily Slope'];
      sttail = sthead.append("div").attr('class', 'roadhdr');
      sttail.append("div").attr('class', 'roadhdrrow')
        .selectAll("span.roadhdrcell").data(tailcolumns)
        .enter().append('span').attr('class', 'roadhdrcell')
        .text((c)=>c);
   };

    // Create the table header and body to show the goal node
    var ghead, gbody;
    function createGoalTable() {
      var goalcolumns;
      if (opts.tableCheckboxes)
        goalcolumns = ['', '', 'Goal Date', '', 'Value', '', 'Daily Slope'];
      else
        goalcolumns = ['', '', 'Goal Date', 'Value', 'Daily Slope'];
      ghead = d3.select(opts.divTable).select(".rtablegoal");
      ghead.append("div").attr('class', 'roadhdr')
        .append("div").attr('class', 'roadhdrrow')
        .selectAll("span.roadhdrcell").data(goalcolumns)
        .enter().append('span').attr('class', 'roadhdrcell')
        .text((c)=>c)
      gbody = ghead.append('div').attr('class', 'roadbody');
    };

    function updateTableTitles() {
      if (opts.divTable == null) return;
      var ratetext = "Daily Slope";
      if (goal.runits === 'h') ratetext = "Hourly Slope";
      if (goal.runits === 'd') ratetext = "Daily Slope";
      if (goal.runits === 'w') ratetext = "Weekly Slope";
      if (goal.runits === 'm') ratetext = "Monthly Slope";
      if (goal.runits === 'y') ratetext = "Yearly Slope";

      var roadcolumns, goalcolumns;
      if (opts.tableCheckboxes) {
        roadcolumns = ['', '', 'End Date', '', 'Value', '',
                       ratetext, ''];
        goalcolumns = ['', '', 'Goal Date', '', 'Value', '',
                       ratetext, ''];
      } else {
        roadcolumns = ['', '', 'End Date', 'Value', ratetext, ''];
        goalcolumns = ['', '', 'Goal Date', 'Value', ratetext, ''];
      }
      sttail.selectAll("span.roadhdrcell").data(roadcolumns).text((c)=>c);
      thead.selectAll("span.roadhdrcell").data(roadcolumns).text((c)=>c);
      ghead.selectAll("span.roadhdrcell").data(goalcolumns).text((c)=>c);

      updateTableWidths();
    }

    var focusField = null;
    var focusOldText = null;
    var datePicker = null;
    function tableFocusIn( d, i ){
      if (!opts.roadEditor) return;
      //console.debug('tableFocusIn('+i+') for '+this.parentNode.id);
      focusField = d3.select(this);
      focusOldText = focusField.text();
      if (i != 0 && datePicker != null) {
        datePicker.destroy();
        datePicker = null;
      }
      if (i == 0 && onMobileOrTablet()) {
        focusField.attr("contenteditable", false);
        setTimeout(function() {
          focusField.attr("contenteditable", true);}, 100);
      }
      var kind = Number(focusField.node().parentNode.id);
      if (selection != null) clearSelection();
      if (i == 0) {
        selectKnot(kind);
        if (datePicker != null) {
          datePicker.destroy();
          datePicker = null;
        }
	      var knotmin = (kind == 0) ? goal.xMin : (road[kind].sta[0]);
	      var knotmax = 
              (kind == road.length-1) 
              ? road[kind].end[0]
          :(road[kind+1].end[0]);
        // Switch all dates to local time to babysit Pikaday
        var md = moment(focusOldText);
        var mindate = moment(moment.unix(knotmin).utc()
                             .format("YYYY-MM-DD"));
        var maxdate = moment(moment.unix(knotmax).utc()
                             .format("YYYY-MM-DD"));
        datePicker = new Pikaday({
          keyboardInput: false,
          onSelect: function(date) {
            var newdate = datePicker.toString();
            var val = bu.dayparse(newdate, '-');
            if (newdate === focusOldText) return;
            if (!isNaN(val)) {
              focusField.text(newdate)
              tableDateChanged( Number(kind), val)
              focusOldText = newdate
              datePicker.destroy()
              document.activeElement.blur();
            }
          },
          minDate: mindate.toDate(),
          maxDate: maxdate.toDate()});
        datePicker.setMoment(md);        
        var floating = d3.select(opts.divTable).select('.floating');
        var bbox = this.getBoundingClientRect();
        var tlbox = topLeft.node().getBoundingClientRect();
        floating
          .style('left', (bbox.right-tlbox.left)+"px")
          .style('top', (bbox.bottom+3-tlbox.top)+"px");
        floating.node().appendChild(datePicker.el, this);
      } else if (i == 1) {
        selectDot(kind);
      } else if (i == 2) {
        selectRoad(kind);
      }
    }

    function tableFocusOut( d, i ){
      if (!opts.roadEditor) return;
      //console.debug('tableFocusOut('+i+') for '+this.parentNode.id);
      var kind = Number(this.parentNode.id);
      var text = d3.select(this).text();
      if (datePicker != null) {
        datePicker.destroy();
        datePicker = null;
      }
      clearSelection();
      if (text === focusOldText) return;
      if (focusOldText == null) return; // ENTER must have been hit
      var val = (i==0)?bu.dayparse(text, '-'):text;
      if (isNaN(val)) {
        d3.select(this).text(focusOldText);
        focusOldText = null;
        focusField = null;
        return;
      }
      if (i == 0) {
        tableDateChanged( kind, val); clearSelection(); }
      if (i == 1) {
        tableValueChanged( kind, val);  clearSelection(); }
      if (i == 2) {
        tableSlopeChanged( kind, val);  clearSelection(); }
      focusOldText = null;
      focusField = null;
    }
    function tableKeyDown( d, i ){
      if (d3.event.keyCode == 13) {
        window.getSelection().removeAllRanges();
        var text = d3.select(this).text();
        var val = (i==0)?bu.dayparse(text, '-'):text;
        if (isNaN(val)) {
          d3.select(this).text(focusOldText);
          focusOldText = null;
          return;
        }
        if (i == 0) tableDateChanged( Number(this.parentNode.id), val);
        if (i == 1) tableValueChanged( Number(this.parentNode.id), val);
        if (i == 2) tableSlopeChanged( Number(this.parentNode.id), val);  
        focusOldText = d3.select(this).text();
      }
    }
    function tableClick( d, i ){
      var id = Number(this.parentNode.id);
      if (opts.roadEditor && i == road[id].auto) {
        if (i == 0) disableValue(id); 
        else if (i == 1) disableSlope(id);
        else if (i == 2) disableDate(id);
        this.focus();
      }
    }

    function tableDateChanged( row, value ) {
      //console.debug("tableDateChanged("+row+","+value+")");
      if (isNaN(value)) updateTableValues();
      else changeKnotDate( row, Number(value), true );
    }
    function tableValueChanged( row, value ) {
      //console.debug("tableValueChanged("+row+","+value+")");
      if (isNaN(value)) updateTableValues();
      else changeDotValue( row, Number(value), true );
    }
    function tableSlopeChanged( row, value ) {
      //console.debug("tableSlopeChanged("+row+")");
      if (isNaN(value)) updateTableValues();
      else changeRoadSlope( row, Number(value), true );
    }

    function autoScroll( elt ) {
      if (opts.tableAutoScroll && selection == null && opts.tableHeight !== 0) {
        var topPos = elt.node().offsetTop;
        if (opts.divTable != null) {
          tcont.node().scrollTop = topPos-opts.tableHeight/2;
        }
      }
    }
    function highlightDate(i, state) {
      if (opts.divTable == null) return;
      var color = (state)
            ?opts.roadTableCol.bgHighlight:
            (road[i].auto==0?opts.roadTableCol.bgDisabled:opts.roadTableCol.bg);
      var elt = d3.select(opts.divTable)
            .select('.roadrow [name=enddate'+i+']');
      if (elt.empty()) return;
      elt.style('background-color', color);
      autoScroll(elt);
    }
    function highlightValue(i, state) {
      if (opts.divTable == null) return;
      var color = (state)
            ?opts.roadTableCol.bgHighlight:
            (road[i].auto==1?opts.roadTableCol.bgDisabled:opts.roadTableCol.bg);
      var elt = d3.select(opts.divTable)
            .select('.roadrow [name=endvalue'+i+']');
      if (elt.empty()) return;
      elt.style('background-color', color);
      autoScroll(elt);
    }
    function highlightSlope(i, state) {
      if (opts.divTable == null) return;
      var color = (state)
            ?opts.roadTableCol.bgHighlight:
            (road[i].auto==2?opts.roadTableCol.bgDisabled:opts.roadTableCol.bg);
      var elt = d3.select(opts.divTable)
            .select('.roadrow [name=slope'+i+']');
      if (elt.empty()) return;
      elt.style('background-color', color);  
      autoScroll(elt);
    }
    function disableDate(i) {
      road[i].auto=br.RP.DATE;
      var dt = d3.select(opts.divTable);
      dt.select('.roadrow [name=enddate'+i+']')
        .style('color', opts.roadTableCol.textDisabled)
        .style('background-color', opts.roadTableCol.bgDisabled)
        .attr('contenteditable', false);  
      dt.select('.roadrow [name=endvalue'+i+']')
        .style('color', opts.roadTableCol.text)
        .style('background-color', opts.roadTableCol.bg)
        .attr('contenteditable', opts.roadEditor);  
      dt.select('.roadrow [name=slope'+i+']')
        .style('color', opts.roadTableCol.text)
        .style('background-color', opts.roadTableCol.bg)
        .attr('contenteditable', opts.roadEditor);  
      dt.select('.roadrow [name=btndate'+i+']')
        .property('checked', true);  
      dt.select('.roadrow [name=btnvalue'+i+']')
        .property('checked', false);  
      dt.select('.roadrow [name=btnslope'+i+']')
        .property('checked', false);  
    }
    function disableValue(i) {
      road[i].auto=br.RP.VALUE;
      var dt = d3.select(opts.divTable);
      dt.select('.roadrow [name=enddate'+i+']')
        .style('color', opts.roadTableCol.text)
        .style('background-color', opts.roadTableCol.bg)
        .attr('contenteditable', opts.roadEditor);  
      dt.select('.roadrow [name=endvalue'+i+']')
        .style('color', opts.roadTableCol.textDisabled)
        .style('background-color', opts.roadTableCol.bgDisabled)
        .attr('contenteditable', false);  
      dt.select('.roadrow [name=slope'+i+']')
        .style('color', opts.roadTableCol.text)
        .style('background-color', opts.roadTableCol.bg)
        .attr('contenteditable', opts.roadEditor);  
      dt.select('.roadrow [name=btndate'+i+']')
        .property('checked', false);  
      dt.select('.roadrow [name=btnvalue'+i+']')
        .property('checked', true);  
      dt.select('.roadrow [name=btnslope'+i+']')
        .property('checked', false);  
    }
    function disableSlope(i) {
      road[i].auto=br.RP.SLOPE;
      var dt = d3.select(opts.divTable);
      dt.select('.roadrow [name=enddate'+i+']')
        .style('color', opts.roadTableCol.text)
        .style('background-color', opts.roadTableCol.bg)
        .attr('contenteditable', opts.roadEditor);  
      dt.select('.roadrow [name=endvalue'+i+']')
        .style('color', opts.roadTableCol.text)
        .style('background-color', opts.roadTableCol.bg)
        .attr('contenteditable', opts.roadEditor);  
      dt.select('.roadrow [name=slope'+i+']')
        .style('color', opts.roadTableCol.textDisabled)
        .style('background-color', opts.roadTableCol.bgDisabled)
        .attr('contenteditable', false);  
      dt.select('.roadrow [name=btndate'+i+']')
        .property('checked', false);  
      dt.select('.roadrow [name=btnvalue'+i+']')
        .property('checked', false);  
      dt.select('.roadrow [name=btnslope'+i+']')
        .property('checked', true);  
    }

    function updateTableButtons() {
      if (opts.divTable == null) return
      // Update buttons on all rows at once, including the start node.
      var allrows = d3.select(opts.divTable)
            .selectAll(".rtablestart .roadrow, .rtable .roadrow, .rtablegoal .roadrow")
      var btncells = allrows.selectAll(".roadbtn")
            .data(function(row, i) {
              // The table row order is reversed, which means that the
              // last road segment comes in the first row.  We need to
              // compute knot index accordingly
              var kind
              if (opts.reverseTable) kind = road.length-2-i
              else kind = i
              if (opts.tableCheckboxes) 
                return [
                  {order: -1, row:kind, name: "btndel"+kind, evt: ()=>removeKnot(kind,false), 
                   type: 'button', txt: 'del', auto: false},
                  {order: 3, row:kind, name: "btndate"+kind, evt: ()=>disableDate(kind),
                   type: 'checkbox', txt: 'r', auto: (row.auto==br.RP.DATE)},
                  {order: 5, row:kind, name: "btnvalue"+kind, evt: ()=>disableValue(kind), 
                   type: 'checkbox', txt: 'r', auto: (row.auto==br.RP.VALUE)},
                  {order: 7, row:kind, name: "btnslope"+kind, evt: ()=>disableSlope(kind),
                   type: 'checkbox', txt: 'r', auto: (row.auto==br.RP.SLOPE)},
                  {order: 8, row:kind, name: "btnadd"+kind, evt: ()=>addNewKnot(kind+1), 
                   type: 'button', txt: 'ins', auto: false},
                ];
              else
                return [
                  {order: -1, row:kind, name: "btndel"+kind, evt: ()=>removeKnot(kind,false), 
                   type: 'button', txt: 'del', auto: false},
                  {order: 8, row:kind, name: "btnadd"+kind, evt: ()=>addNewKnot(kind+1),
                   type: 'button', txt: 'ins', auto: false},
                ];
            })
      
      var newbtncells = btncells.enter().append("input")
            .attr('class', 'roadbtn')
            .attr('id',   (d)=>d.row)
            .attr('name', (d)=>d.name)
            .attr('type', (d)=>d.type)
            .attr('value', (d)=> { 
              let cell = "<span class='octicon octicon-plus'></span>";
              return d.txt})
            .on('click', (d)=>d.evt())
      
      btncells.exit().remove()
      btncells = allrows.selectAll(".rtablestart .roadbtn, .rtable .roadbtn, .rtablegoal .roadbtn")
      btncells
        .attr('id', (d)=>d.row)
        .attr('name', (d)=>d.name)
        .style('visibility', (d,i) =>
               (((Number(d.row)>0 && Number(d.row)<(road.length-2)) 
                 || i==4 
                 || (i>0 && Number(d.row)>0 ))?"visible":"hidden")
              )
        .property('checked', (d)=>(d.auto?true:false))

      allrows.selectAll(".roadcell, .roadbtn")
        .sort((a,b)=>d3.ascending(a.order,b.order))

      if (!opts.roadEditor) {
        allrows.selectAll(".roadbtn").style('visibility', "collapse").attr("value","")
      }
    }

    function updateRowValues( elt, s, e, rev ) {
      var data = road.slice(s, e)
      if (rev) data = data.reverse()
      var rows = elt.selectAll(".roadrow").data( data )
      var ifn = (i)=>(rev?(road.length-2-i):i)
      rows.enter().append("div").attr('class', 'roadrow')
        .attr("name", (d,i)=>('roadrow'+ifn(s+i)))
        .attr("id", (d,i)=>(ifn(s+i)))
        .append("div")
        .attr("class", "rowid").text((d,i)=>(ifn(s+i)+":"))
      rows.exit().remove()
      rows.order()
      rows = elt.selectAll(".roadrow")
      rows.attr("name", (d,i)=>('roadrow'+ifn(s+i)))
        .attr("id", (d,i)=>(ifn(s+i)))
      rows.select("div").text((d,i)=>(ifn(s+i)+":"))
      var cells = rows.selectAll(".roadcell")
          .data((row, i) => {
            var datestr = bu.dayify(row.end[0], '-')
            var ri = ifn(s+i)
            return [
              {order: 2, value: datestr, name: "enddate"+(ri), 
               auto: (row.auto==br.RP.DATE), i:ri},
              {order: 4, value: bu.shn(row.end[1]), name: "endvalue"+(ri), 
               auto: (row.auto==br.RP.VALUE), i:ri},
              {order: 6, value: isNaN(row.slope)
               ?"duplicate":bu.shn(row.slope*goal.siru), name: "slope"+(ri), 
               auto: (row.auto==br.RP.SLOPE), i:ri}]
          });
       cells.enter().append("div").attr('class', 'roadcell')
        .attr('name', (d)=>d.name)
        .attr("contenteditable", (d,i) =>((d.auto || !opts.roadEditor)?'false':'true'))
        .on('click', tableClick)
        .on('focusin', tableFocusIn)
        .on('focusout', tableFocusOut)
        .on('keydown', tableKeyDown)

       cells.exit().remove()
       cells = rows.selectAll(".roadcell")
       cells.text((d,i)=>d.value)
         .attr('name', (d)=>d.name)
        .style('color', (d) =>{
          if (road[d.i].sta[0] == road[d.i].end[0] 
              && road[d.i].sta[1] == road[d.i].end[1])
            return opts.roadLineCol.invalid
          return d.auto?opts.roadTableCol.textDisabled
            :opts.roadTableCol.text})
        .style('background-color', function(d) {
          return d.auto?opts.roadTableCol.bgDisabled
            :opts.roadTableCol.bg})
        .attr("contenteditable", function(d,i) { 
          return (d.auto || !opts.roadEditor)?'false':'true'})
    }
    
    function updateTableWidths() {
      if (opts.divTable == null) return;
      // var wfn = function(d,i) {
      //   var sel = tbody.select(".roadrow").selectAll(".rowid, .roadcell"); 
      //   var nds = sel.nodes();
      //   if (nds.length == 0) {
      //     sel = gbody.select(".roadrow").selectAll(".rowid, .roadcell"); 
      //     nds = sel.nodes();
      //   }
      //   var w = nds[i].offsetWidth;
      //   // Uluc: Hack, depends on padding
      //   if (i == 0) w = w - 0;
      //   else w = w - 13;
      //   d3.select(this).style("width", w+"px");
      // };
      // stbody.selectAll(".rowid, .roadcell").each( wfn );
      // if (road.length > 3) {
      //   gbody.selectAll(".rowid, .roadcell").each( wfn );
      //   d3.select(opts.divTable)
      //     .style("width", (tbody.node().offsetWidth+30)+"px");
      // } else {
      //   gbody.selectAll(".rowid, .roadcell").style( "width", null );
      //   d3.select(opts.divTable)
      //     .style("width", (gbody.node().offsetWidth+30)+"px");
      // }
      if (road.length > 3)
        d3.select(opts.divTable)
        .style("width", (tbody.node().offsetWidth+35)+"px")
      else
        d3.select(opts.divTable)
        .style("width", (gbody.node().offsetWidth+35)+"px")
    }

    function updateTableValues() {
      if (opts.divTable == null) return

      var reversetable = opts.reverseTable

      updateRowValues( stbody, 0, 1, false )
      stbody.select("[name=slope0]")
        .style("visibility","hidden")
        .style("pointer-events","none")
        .style("border", "1px solid transparent")

      updateRowValues( tbody, 1, road.length-2, reversetable )
      updateRowValues( gbody, road.length-2, road.length-1, false )

      if (road.length <=3) {
        sttail.style("visibility", "collapse")
        d3.select(opts.divTable).select(".rtablebody").style("display", "none")
      } else {
        sttail.style("visibility", null)
        d3.select(opts.divTable).select(".rtablebody").style("display", null)
      }

      updateTableWidths()
    }

    function updateTable() {
      updateTableValues()
      updateTableButtons()
      updateTableWidths()
    }

    function updateContextData() {
      if (opts.divGraph == null) return

      if (opts.showContext) {
        context.attr("visibility", "visible")
        updateContextOldRoad()
        updateContextOldBullseye()
        updateContextBullseye()
        updateContextRoads()
        updateContextDots()
        updateContextHorizon()
        updateContextToday()
        if (opts.showFocusRect) focusrect.attr("visibility", "visible")
        else focusrect.attr("visibility", "hidden")
      } else {
        context.attr("visibility", "hidden")
        focusrect.attr("visibility", "hidden")
      }
    }

    function updateGraphData(force = false) {
      if (opts.divGraph == null) return
      clearSelection()
      var limits = [nXSc.invert(0).getTime()/1000, 
                    nXSc.invert(plotbox.width).getTime()/1000];
      if (force) oldscf = 0
      if (opts.roadEditor)
        scf = bu.cvx(limits[1], limits[0], limits[0]+73*bu.SID, 1,0.7)
      else 
        scf = bu.cvx(limits[1], limits[0], limits[0]+73*bu.SID, 1,0.55)
      updateWatermark()
      updatePastBox()
      updateYBHP()
      updatePinkRegion()
      updateOldRoad()
      updateOldBullseye()
      updateBullseye()
      updateKnots()
      updateDataPoints()
      updateDerails()
      updateRosy()
      updateSteppy()
      updateHashtags()
      updateMovingAv()
      updateRoads()
      updateDots()
      updateHorizon()
      updateOdomResets()
      updatePastText()
      updateAura()
      // Record current dot color so it can be retrieved from the SVG
      // for the thumbnail border
      zoomarea.attr('color', br.dotcolor(road, goal, goal.tcur, goal.vcur))

      // Store the latest scale factor for comparison. Used to
      // eliminate unnecessary attribute setting for updateDotGroup
      // and other update functions
      oldscf = scf
    }

    createGraph()
    createTable()
    //zoomAll()

    /** bgraph object ID for the current instance */
    this.id = 1

    /** Sets/gets the showData option 
     @param {Boolean} flag Set/reset the option*/
    this.showData = (flag) => {
      if (arguments.length > 0) opts.showData = flag
      if (alldata.length != 0) {
        updateDataPoints()
        updateDerails()
        updateRosy()
        updateSteppy()
        updateMovingAv()
        updateAura()
      }
      return opts.showData
    }
    
    /** Sets/gets the showContext option 
     @param {Boolean} flag Set/reset the option */
    this.showContext = (flag) => {
      if (arguments.length > 0) opts.showContext = flag
      if (road.length != 0)
        updateContextData()
      return opts.showContext
    }
    
    /** Sets/gets the keepSlopes option 
     @param {Boolean} flag Set/reset the option */
    this.keepSlopes = (flag) => {
      if (arguments.length > 0) opts.keepSlopes = flag
      return opts.keepSlopes
    }
    
    /** Sets/gets the keepIntervals option 
     @param {Boolean} flag Set/reset the option */
    this.keepIntervals = ( flag ) => {
      if (arguments.length > 0) opts.keepIntervals = flag
      return opts.keepIntervals
    }
    
    /** Sets/gets the maxDataDays option. Updates the datapoint
     display if the option is changed. */
    this.maxDataDays = ( days ) => {
      if (arguments.length > 0) {
        opts.maxDataDays = days
        if (opts.maxDataDays < 0) {
          alldataf = alldata.slice()
          dataf = data.slice()
        } else {
          alldataf = alldata.filter((e)=>(e[0]>(goal.asof-opts.maxDataDays*SID)))
          dataf = data.filter((e)=>(e[0]>(goal.asof-opts.maxDataDays*SID)))
        }
        if (alldata.length != 0) {
          updateDataPoints()
          updateDerails()
          updateRosy()
          updateSteppy()
        }
      }
      return opts.maxDataDays
    }
    
    /** Sets/gets the reverseTable option. Updates the table if
     the option is changed.  
     @param {Boolean} flag Set/reset the option*/
    this.reverseTable = ( flag ) => {
      if (arguments.length > 0) {
        opts.reverseTable = flag
        if (opts.reverseTable) {
          d3.select(opts.divTable).select(".rtablegoal").raise()
          d3.select(opts.divTable).select(".rtablebody").raise()
          d3.select(opts.divTable).select(".rtablestart").raise()
        } else {
          d3.select(opts.divTable).select(".rtablestart").raise()
          d3.select(opts.divTable).select(".rtablebody").raise()
          d3.select(opts.divTable).select(".rtablegoal").raise()
        }
        updateTable()
      }
      return opts.reverseTable
    }
    
    /** Sets/gets the tableUpdateOnDrag option. 
     @param {Boolean} flag Set/reset the option */
    this.tableUpdateOnDrag = ( flag ) => {
      if (arguments.length > 0) {
        opts.tableUpdateOnDrag = flag
        updateTable()
      }
      return opts.tableUpdateOnDrag
    }
    
    /** Sets/gets the tableAutoScroll option.  
     @param {Boolean} flag Set/reset the option*/
    this.tableAutoScroll = ( flag ) => {
      if (arguments.length > 0) opts.tableAutoScroll = flag
      return opts.tableAutoScroll
    }

    /** Returns an object with the lengths of the undo and redo
     buffers */
    this.undoBufferState = () => {
      return({undo: undoBuffer.length, redo: redoBuffer.length})
    }

    /** Undoes the last edit */
    this.undo = () => {
      if (!opts.roadEditor) return
      document.activeElement.blur()
      undoLastEdit()
    }

    /** Redoes the last edit that was undone */
    this.redo = () => {
      if (!opts.roadEditor) return
      document.activeElement.blur()
      redoLastEdit()
    }

    /** Clears the undo buffer. May be useful after the new
     road is submitted to Beeminder and past edits need to be
     forgotten.*/
    this.clearUndo = clearUndoBuffer

    /** Zooms out the goal graph to make the entire range from
     tini to tfin visible, with additional slack before and after
     to facilitate adding new knots. */
    this.zoomAll = () => { if (road.length == 0) return; else zoomAll() }

    /** Brings the zoom level to include the range from tini to
     slightly beyond the akrasia horizon. This is expected to be
     consistent with beebrain generated graphs. */ 
    this.zoomDefault = () => { if (road.length == 0) return; else zoomDefault() }

    /** Initiates loading a new goal from the indicated url.
     Expected input format is the same as beebrain. Once the input
     file is fetched, the goal graph and road matrix table are
     updated accordingly. 
    @param {String} url URL to load the goal BB file from*/
    this.loadGoal = async ( url ) => {
      await loadGoalFromURL( url )
        .catch(function(err){console.log("ERROR (loadGoal): "+err.message)})
    }

    /** Initiates loading a new goal from the supplied object.
     Expected input format is the same as beebrain. The goal graph and
     road matrix table are updated accordingly.
    @param {object} json Javascript object containing the goal BB file contents*/
    this.loadGoalJSON = ( json ) => {
      removeOverlay()
      loadGoal( json )
    }

    /** Performs retroratcheting function by adding new knots to leave
     "days" number of days to derailment based on today data point
     (which may be flatlined).
     @param {Number} days Number of buffer days to preserve*/
    this.retroRatchet = ( days ) => {
      if (!opts.roadEditor) return
      setSafeDays( days )
    }

    /** Schedules a break starting from a desired point beyond the
     * akrasia horizon and extending for a desired number of days.
     @param {String} start Day to start the break, formatted as YYYY-MM-DD
     @param {Number} days Number of days fof the break
     @param {Boolean} insert Whether to insert into or overwrite onto the current road
    */
    this.scheduleBreak = ( start, days, insert ) => {
      if (!opts.roadEditor) return
      if (isNaN(days)) return
      if (road.length == 0) {
        console.log("bgraph("+curid+"):scheduleBreak(), road is empty!")
        return
      }
      var begintime = bu.dayparse(start, '-')
      // Find or add a new dot at the start of break
      // We only allow the first step to record undo info.
      var firstseg = -1, i, j
      for (i = 1; i < road.length; i++) {
        if (road[i].sta[0] === begintime) {
          firstseg = i; break
        }
      }
      var added = false;
      if (firstseg < 0) {addNewDot(begintime);added = true;}
      if (!added) pushUndoState()
      for (i = 1; i < road.length; i++) {
        if (road[i].sta[0] === begintime) {
          firstseg = i; break
        }
      }
      if (insert) {
        // First, shift all remaining knots right by the requested
        // number of days
        road[firstseg].end[0] = bu.daysnap(road[firstseg].end[0]+days*bu.SID)
        for (j = firstseg+1; j < road.length; j++) {
          road[j].sta[0] = bu.daysnap(road[j].sta[0]+days*bu.SID)
          road[j].end[0] = bu.daysnap(road[j].end[0]+days*bu.SID)
        }
        // Now, create and add the end segment if the value of the
        // subsequent endpoint was different
        if (road[firstseg].sta[1] != road[firstseg].end[1]) {
          var segment = {}
          segment.sta = road[firstseg].sta.slice()
          segment.sta[0] = bu.daysnap(segment.sta[0]+days*bu.SID)
          segment.end = road[firstseg].end.slice()
          segment.slope = br.segSlope(segment)
          segment.auto = br.RP.VALUE
          road.splice(firstseg+1, 0, segment)
          road[firstseg].end = segment.sta.slice()
          road[firstseg].slope = 0
          br.fixRoadArray( road, br.RP.VALUE, false)
        }
      } else {
        // Find the right boundary for the segment for overwriting
        var endtime = bu.daysnap(road[firstseg].sta[0]+days*bu.SID)
        var lastseg = br.findSeg( road, endtime )
        if (road[lastseg].sta[0] != endtime) {
          // If there are no dots on the endpoint, add a new one
          addNewDot(endtime); 
          if (added) {undoBuffer.pop(); added = true}
          lastseg = br.findSeg( road, endtime )
        }
        // Delete segments in between
        for (j = firstseg+1; j < lastseg; j++) {
          road.splice(firstseg+1, 1)
        }
        road[firstseg].end = road[firstseg+1].sta.slice()
        var valdiff = road[firstseg+1].sta[1] - road[firstseg].sta[1]
        for (j = firstseg; j < road.length; j++) {
          road[j].end[1] -= valdiff
          road[j].slope = br.segSlope(road[j])
          if (j+1 < road.length) road[j+1].sta[1] = road[j].end[1]
        }
        br.fixRoadArray( road, br.RP.SLOPE, false)
      }
      roadChanged()
    }

    /** Dials the road to the supplied slope starting from the akrasia horizon
     @param {Number} newSlope New road slope to start in a week
    */
    this.commitTo = ( newSlope ) => {
      if (!opts.roadEditor) return
      if (isNaN(newSlope)) return
      if (road.length == 0) {
        console.log("bgraph("+curid+"):commitTo(), road is empty!")
        return
      }
      if (road[road.length-2].slope == newSlope) return

      // Find out if there are any segments beyond the horizon
      var horseg = br.findSeg( road, goal.horizon );
      if (road[horseg].sta[0] == goal.horizon || horseg < road.length-2) {
        // There are knots beyond the horizon. Only adjust the last segment
        pushUndoState()
      } else {
        addNewDot(goal.horizon)
      }
      road[road.length-2].slope = newSlope
      br.fixRoadArray( road, br.RP.VALUE, false )
      roadChanged()
    }

    /** Returns an object with an array ('road') containing the
     current roadmatix (latest edited version), as well as the following members:<br/>
     <ul>
     <li><b>valid</b>: whether the edited road intersects the pink region or not</li>
     <li><b>loser</b>: whether the edited road results in a derailed goal or not</li>
     <li><b>asof</b>: unix timestamp for "now"</li>
     <li><b>horizon</b>: unix timestamp for the current akrasia horizon</li>
     <li><b>siru</b>: seconds in rate units</li>
     </ul>

    */
    this.getRoad = () => {
      function dt(d) { return moment.unix(d).utc().format("YYYYMMDD");};
      // Format the current road matrix to be submitted to Beeminder
      var r = {}, seg, rd, kd;
      if (road.length == 0) {
        console.log("bgraph("+curid+"):getRoad(), road is empty!")
        return null
      }
      r.valid = isRoadValid(road)
      r.loser = br.isLoser(road,goal,data,goal.tcur,goal.vcur)
      r.asof = goal.asof
      r.horizon = goal.horizon
      r.siru = goal.siru
      //r.tini = dt(road[0].end[0]);
      //r.vini = road[0].end[1];
      r.road = []
      for (let i = 0; i < road.length-1; i++) {
        seg = road[i]
        if (seg.sta[0] == seg.end[0] && seg.sta[1] == seg.end[1])
          continue
        kd = moment.unix(seg.end[0]).utc()
        rd = [kd.format("YYYYMMDD"), seg.end[1], seg.slope*goal.siru]
        if (seg.auto == br.RP.DATE) rd[2] = null // Exception here since roadall does not support null dates.
        if (seg.auto == br.RP.VALUE) rd[1] = null
        if (seg.auto == br.RP.SLOPE) rd[2] = null
        //if (i == road.length-2) {
        //    r.tfin = rd[0];
        //    r.vfin = rd[1];
        //    r.rfin = rd[2];
        //} else 
        r.road.push(rd)
      }
      return r
    }

    /** Generates a data URI downloadable from the link element
     supplied as an argument. If the argument is empty or null,
     replaces page contents with a cleaned up graph suitable to be
     used with headless chrome --dump-dom to retrieve the contents as
     a simple SVG.
    @param {object} [linkelt=null] Element to provide a link for the SVG object to download. If null, current page contents are replaced. */
    this.saveGraph = ( linkelt = null ) => {

      // retrieve svg source as a string.
      var svge = svg.node()
      var serializer = new XMLSerializer()
      var source = serializer.serializeToString(svge)

      //set url value to a element's href attribute.
      if (opts.headless || linkelt == null) {
        // If no link is provided or we are running in headless mode ,
        // replace page contents with the svg and eliminate
        // unnecessary elements
        document.head.remove()
        document.body.innerHTML = source

        // Eliminate unnecessary components from the SVG file in headless mode
        if (opts.headless) {
          var newroot = d3.select(document.body)
          //newroot.selectAll(".zoomarea").remove();
          newroot.selectAll(".buttonarea").remove()
          newroot.selectAll(".brush").remove()
          newroot.selectAll(".zoomin").remove()
          newroot.selectAll(".zoomout").remove()
          //newroot.selectAll(".minor").remove()
        }
      } else {

        // Remove styling once serialization is completed
        //defs.select('style').remove();

        // add name spaces.
        if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
          source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
        }
        if(!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)){
          source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"')
        }

        //add xml declaration
        source = '<?xml version="1.0" standalone="no"?>\n' + source

        //convert svg source to URI data scheme.
        var url = "data:image/svg+xml;charset=utf-8,"
              +encodeURIComponent(source)

        //set url value to a element's href attribute.
        linkelt.href = url
      }
    }

    /** Informs the module instance that the element containing the
     visuals will be hidden. Internally, this prevents calls to
     getBBox(), eliminating associated exceptions and errors. 
     @see {@link bgraph#show}*/
    this.hide = () => {hidden = true}

    /** Informs the module instance that the element containing the
     visuals will be shown again. This forces an update of all visual
     elements, which might have previously been incorrectly rendered
     if hidden. 
     @see {@link bgraph#hide}*/
    this.show = () => {
      //console.debug("curid="+curid+", show()");
      hidden = false
      if (road.length == 0) {
        console.log("bgraph("+curid+"):show(), road is empty!")
        return
      }
      redrawXTicks()
      adjustYScale()
      handleYAxisWidth()
      resizeBrush()
      updateTable()
      updateContextData()
      updateGraphData( true )
    }

    /** Returns the road matrix object (in the internal format) for the
        goal. Primarily used to synchronize two separate graph
        instances on the same HTML page. 
        @return {object} Internal road object
        @see bgraph#setRoadObj
    */
    this.getRoadObj = () => br.copyRoad(road)

    var settingRoad = false;
    /** Sets the road matrix (in the internal format) for the
        goal. Primarily used to synchronize two separate graph
        instances on the same HTML page. Should only be called with
        the return value of {@link bgraph#getRoadObj}.
        @param {object} newroad Road object returned by {@link bgraph#getRoadObj}
        @param {Boolean} [resetinitial=true] Whether to set the internal "initial road" as well
        @see bgraph#getRoadObj
    */
    this.setRoadObj = ( newroad, resetinitial = true ) => {
      if (settingRoad) return
      if (newroad.length == 0) {
        // TODO: More extensive sanity checking
        console.log("bgraph("+curid+"):setRoadObj(), new road is empty!")
        return
      }
      settingRoad = true
      // Create a fresh copy to be safe
      pushUndoState()
      road = br.copyRoad(newroad)
      if (resetinitial) {
        iroad = br.copyRoad(newroad)
        clearUndoBuffer()
      }
      bbr.setRoadObj(newroad)
      roadChanged()
      settingRoad = false
    }

    /** Checks whether the goal is currently a loser
        @returns {Boolean} 
    */
    this.isLoser = () => {
      if (goal && road.length != 0)
        return br.isLoser(road,goal,data,goal.tcur,goal.vcur)
      else return false
    }
    /** Returns current goal state
        @returns {object} Current goal state as [t, v, r, rdf(t)] or null if no goal
    */
    this.curState =
      () => (goal?[goal.tcur, goal.vcur, goal.rcur, br.rdf(road, goal.tcur)]:null)

    /** @typedef GoalVisuals
        @global
        @type {object}
        @property {Boolean} plotall Plot all points instead of just the aggregated point
        @property {Boolean} steppy Join dots with purple steppy-style line
        @property {Boolean} rosy Show the rose-colored dots and connecting line
        @property {Boolean} movingav Show moving average line superimposed on the data
        @property {Boolean} aura Show blue-green/turquoise aura/swath
        @property {Boolean} hidey Whether to hide the y-axis numbers
        @property {Boolean} stathead Whether to include label with stats at top of graph
        @property {Boolean} hashtags Show annotations on graph for hashtags in comments 
    */
    const visualProps
          = ['plotall','steppy','rosy','movingav','aura','hidey','stathead','hashtags']
    /** Returns visual properties for the currently loaded goal
        @returns {GoalVisuals} 
        @see {@link bgraph#getGoalConfig}
    */
    this.getVisualConfig = ( opts ) =>{
      var out = {}
      visualProps.map(e=>{ out[e] = goal[e] })
      return out
    }

    /** @typedef GoalProperties
        @global
        @type {object}
        @property {Boolean} offred Whether to use yesterday-is-red criteria for derails
        @property {Boolean} yaw Which side of the YBR you want to be on, +1 or -1
        @property {Boolean} dir Which direction you'll go (usually same as yaw)
        @property {Boolean} kyoom Cumulative; plot vals as the sum of those entered so far
        @property {Boolean} odom Treat zeros as accidental odom resets
        @property {Boolean} noisy Compute road width based on data, not just road rate
        @property {Boolean} integery Whether vals are necessarily integers
        @property {Boolean} monotone Whether data is necessarily monotone
        @property {String} aggday sum/last/first/min/max/mean/median/mode/trimmean/jolly
    */
    const goalProps
          = ['offred','yaw','dir','kyoom','odom','noisy','integery','monotone','aggday']
    /** Returns properties for the currently loaded goal
        @returns {GoalProperties} 
        @see {@link bgraph#getVisualConfig}
     */
    this.getGoalConfig = ( ) => {
      var out = {}
      goalProps.map(e=>{ out[e] = goal[e] })
      return out
    }

    /** Displays the supplied message overlaid towards the top of the graph
        @param {String} msg Message to be displayed. Pass null to remove existing message. */
    this.msg = (msg)=>{
      if (!msg) removeOverlay("message")
      else
        showOverlay([msg], 20, null, {x:sw/20, y:10, w:sw*18/20, h:50},
                    "message", false)
    }

    /** Animates the Akrasia horizon element in the graph
        @method
        @param {Boolean} enable Enables/disables animation */
    this.animHor = animHor
    /** Animates the Yellow Brick Road elements in the graph
        @method
        @param {Boolean} enable Enables/disables animation */
    this.animYBR = animYBR
    /** Animates datapoints in the graph
        @method
        @param {Boolean} enable Enables/disables animation */
    this.animData = animData
    /** Animates guideline elements in the graph
        @method
        @param {Boolean} enable Enables/disables animation */
    this.animGuides = animGuides
    /** Animates the rosy line in the graph
        @method
        @param {Boolean} enable Enables/disables animation */
    this.animRosy = animRosy
    /** Animates the moving average in the graph
        @method
        @param {Boolean} enable Enables/disables animation */
    this.animMav = animMav
    /** Animates the aura element in the graph
        @method
        @param {Boolean} enable Enables/disables animation */
    this.animAura = animAura
    /** Animates the waterbuf element in the graph
        @method
        @param {Boolean} enable Enables/disables animation */
    this.animBuf = animBuf
    /** Animates the waterbux element in the graph
        @method
        @param {Boolean} enable Enables/disables animation */
    this.animBux = animBux

  }
  
  return bgraph;
}));

