/**
 * Beebrain graph generation and yellow brick road editing provided as a UMD
 * module. Provides a {@link bgraph} class, which can be used to construct
 * independent graph generating objects each with their own internal state,
 * possibly linked to particular div elements on the DOM.<br/>
 * <br/>Copyright 2017-2020 Uluc Saranli and Daniel Reeves
 @module bgraph
 @requires d3
 @requires moment
 @requires butil
 @requires broad
 @requires beebrain
 */

;((function (root, factory) { // BEGIN PREAMBLE --------------------------------

'use strict'

if (typeof define === 'function' && define.amd) {
  // AMD. Register as an anonymous module.
  //console.log("bgraph: Using AMD module definition")
  define(['d3', 'moment', 'butil', 'broad', 'beebrain'], factory)
} else if (typeof module === 'object' && module.exports) {
  // Node. Does not work with strict CommonJS, but only CommonJS-like
  // environments that support module.exports, like Node.
  //console.log("bgraph: Using CommonJS module.exports")
  module.exports = factory(require('d3'), 
                           require('./moment'), 
                           require('./butil'), 
                           require('./broad'), 
                           require('./beebrain'))
} else {
  //console.log("bgraph: Using Browser globals")
  root.bgraph    = factory(root.d3, 
                           root.moment, 
                           root.butil, 
                           root.broad, 
                           root.beebrain)
}

})(this, function (d3, moment, bu, br, bb) { // END PREAMBLE -- BEGIN MAIN -----

'use strict'

// -----------------------------------------------------------------------------
// --------------------------- CONVENIENCE CONSTANTS ---------------------------

const max   = Math.max
const min   = Math.min
const abs   = Math.abs
const floor = Math.floor
const ceil  = Math.ceil
const round = Math.round

const DIY = 365.25
const SID = 86400

// -----------------------------------------------------------------------------
// ------------------------------ FACTORY GLOBALS ------------------------------

/** Global counter to generate unique IDs for multiple bgraph instances. */
let gid = 1

/** Default settings */
let defaults = {
  /** Generates an empty graph and JSON */
  noGraph:      false, 
  /** Binds the graph to a div element */
  divGraph:     null,
  /** Binds the road table to a div element */
  divTable:     null,    
  /** Binds the datapoint table to a div element */
  divPoints:    null,    
  /** Binds the dueby table to a div element */
  divDueby:    null,    
  /** Binds the data table to a div element */
  divData:    null,    
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
  dataPoint:    { size: 5, fsize: 5, hsize: 2.5, border:1 }, 
  /** Visual parameters for the akrasia horizon */ 
  horizon:      { width: 2, ctxwidth: 1, dash: 8, ctxdash: 6, 
                  font: 10, ctxfont: 9 },
  /** Visual parameters for vertical line for asof */ 
  today:        { width: 2, ctxwidth: 1, font: 12, ctxfont: 9 },
  /** Visual parameters for watermarks */
  watermark:    { height:170, fntsize:150, color:"#000000" }, // was #f0f0f0
  guidelines:   { width:2, weekwidth:4 },
  maxfluxline:  4, // width
  stdfluxline:  2, // width
  razrline:     2, 
  /** Visual parameters for text boxes shown during dragging */ 
  textBox:      { margin: 3 },
  /** Visual parameters for odometer resets */ 
  odomReset:    { width: 0.5, dash: 8 },
  
  roadLineCol:  { valid: "black",    invalid:"#ca1212",  selected:"yellow" },
  roadDotCol:   { fixed: "darkgray", editable:"#c2c2c2", selected: "yellow" },
  roadKnotCol:  { dflt: "#c2c2c2", selected: "yellow",
                  rmbtn: "black", rmbtnsel: "red" },
  textBoxCol:   { bg: "#ffffff", stroke:"#d0d0d0" },
  roadTableCol: { bg:"#ffffff", bgHighlight: "#fffb55", 
                  text:"#000000", textDisabled: "#aaaaaa",
                  bgDisabled:"#f2f2f2"},
  dataPointCol: { future: "#909090", stroke: "#eeeeee" },
  halfPlaneCol: { fill: "#ffffe8" },
  pastBoxCol:   { fill: "#f8f8f8", opacity:0.5 },
  odomResetCol: { dflt: "#c2c2c2" }, 
                
  /** Strips the graph of all details except what is needed for svg output */
  headless:     false,
  /** Enables zooming by scrollwheel. When disabled, only the context graph and
      the zoom buttons will allow zooming. */
  scrollZoom:   true,
  /** Enables zooming with buttons */
  buttonZoom:   true,
  /** Enables the road editor. When disabled, the generated graph mirrors
      Beebrain output as closely as possible. */
  roadEditor:   false,
  /** Enables the display of the context graph within the SVG */
  showContext:  false,
  /** Enables showing a dashed rectangle in the context graph visualizing the
      current graph limits on the y-axis */
  showFocusRect: false,
  /** Enables displaying datapoints on the graph */ 
  showData:     true,
  /** When datapoint display is enabled, indicates the number of days before
      asof to show data for. This can be used to speed up display refresh for
      large goals. Use -1 to display all datapoints. */ 
  maxDataDays:  -1,
  /** Indicates how many days beyond asof should be included in the fully
      zoomed out graph. This is useful for when the goal date is too far beyond
      asof, making the context graph somewhat useless in the UI. */
  maxFutureDays: 365,
  /** Indicates whether slopes for segments beyond the currently dragged
      element should be kept constant during editing */
  keepSlopes:   true,
  /** Indicates whether guidelines should be shown in the interactive editor */
  showGuidelines: true,
  /** Indicates whether intervals between the knots for segments beyond the
      currently dragged element should be kept constant during editing */
  keepIntervals: false,
  /** Indicates whether the road matrix table should be shown with the earliest
      rows first (normal) or most recent rows first (reversed) */ 
  reverseTable: false,
  /** Indicates whether the auto-scrolling feature for the road matrix table
      should be enabled such that when the mouse moves over knots, dots, or road
      elements, the corresponding table row is scrolled to be visible in the
      table. This is particularly useful when tableHeight is explicitly
      specified and is nonzero. */ 
  tableAutoScroll: true,
  /** Chooses whether the road matrix table should be dynamically updated
      during the dragging of road knots, dots, and segments. Enabling this may
      induce some lagginess, particularly on Firefox due to more components
      being updated during dragging. */
  tableUpdateOnDrag: false,
  /** Chooses whether the dueby table should be dynamically updated
      during the dragging of road knots, dots, and segments. */
  duebyUpdateOnDrag: true,
  /** Chooses whether the road matrix table should include checkboxes for
      choosing the field to be automatically computed */
  tableCheckboxes: true,
  /** Callback function that gets invoked when the road is edited by the user.
      Various interface functions can then be used to retrieve the new road
      state. This is also useful to update the state of undo/redo and submit
      buttons based on how many edits have been done on the original road. */
  onRoadChange: null,
  /** Callback function that gets invoked when a datapoint is edited
      or deleted.  onDataEdit(id, data) indicates that the datapoint
      with the given id is edited with the new content "data =
      [daystamp, value, cmt]" or deleted if data=null */
  onDataEdit: null,
  /** Number of entries visible on the data table */
  dataTableSize: 11,
  dataAutoScroll: true,
  /** Callback function that gets invoked when an error is encountered in
      loading, processing, drawing, or editing the road */
  onError:      null,
}

/** This object defines default options for mobile browsers, where
 larger dots, knots and roads are necessary to make editing through
 dragging feasible. */
const mobiledefaults = {
  svgSize:     { width: 700, height: 530 },
  focusRect:   { x:0, y:0, width: 700, height: 400 },
  focusPad:    { left: 25, right: 10, top: 35, bottom: 30 },
  ctxRect:     { x: 0, y: 400, width: 700, height: 80 },
  ctxPad:      { left: 25, right: 10, top: 0, bottom: 30 },
  tableHeight: 540, // Choose 0 for unspecified

  zoomButton:  { size: 50, opacity: 0.7, factor: 1.5 },
  bullsEye:    { size: 40, ctxsize: 20 },
  roadDot:     { size: 10, ctxsize: 4, border: 1.5, ctxborder: 1 },
  roadKnot:    { width: 7, rmbtnscale: 0.9 },
  roadLine:    { width: 7, ctxwidth: 2 },
  oldRoadLine: { width: 3, ctxwidth: 1, dash: 32, ctxdash: 16 },
  dataPoint:   { size: 4, fsize: 6 }, 
  horizon:     { width: 2, ctxwidth: 1, dash: 8, ctxdash: 8, 
                 font: 14, ctxfont: 10 },
  today:       { width: 2, ctxwidth: 1, font: 16, ctxfont: 10 },
  watermark:   { height: 150, fntsize: 100, color: "#000000" }, // was #f0f0f0
  guidelines:  { width: 2, weekwidth: 4 },
  maxfluxline: 4, // width
  stdfluxline: 2, // width
  razrline:    2,
  textBox:     { margin: 3 },
}

/** Style text embedded in the SVG object for proper saving of the SVG */
const SVGStyle = 
  ".svg{shape-rendering:crispEdges}" 
+ ".axis path,.axis line{fill:none;stroke:black;shape-rendering:crispEdges}"
+ ".axis .minor line{stroke:#777;stroke-dasharray:0,2,4,3}"
+ ".grid line"
+ "{fill:none;stroke:#dddddd;stroke-width:1px;shape-rendering:crispEdges}"
+ ".aura{fill-opacity:0.3;stroke-opacity:0.3;}"
+ ".aurapast{fill-opacity:0.15;stroke-opacity:0.3}"
+ ".grid .minor line{stroke:none}"
+ ".axis text{font-family:sans-serif;font-size:11px}"
+ ".axislabel{font-family:sans-serif;font-size:11px;text-anchor:middle}"
+ "circle.dots{stroke:black}"
+ "line.roads{stroke:black}"
+ ".pasttext,.ctxtodaytext,.ctxhortext,.horizontext,.hashtag"
+ "{text-anchor:middle;font-family:sans-serif}"
+ ".waterbuf,.waterbux{opacity:0.05882353;" //stroke:#dddddd;stroke-width:1;"
+ "text-anchor:middle;font-family:Dejavu Sans,sans-serif}"
+ ".loading{text-anchor:middle;font-family:Dejavu Sans,sans-serif}"
+ ".zoomarea{fill:none}"
+ "circle.ap{stroke:none}"
+ "circle.rd{stroke:none;pointer-events:none;fill:"+bu.Cols.ROSE+"}"
+ "circle.std{stroke:none;pointer-events:none;fill:"+bu.Cols.PURP+"}"
+ "circle.hp{stroke:none;fill:"+bu.Cols.WITE+"}"
+ ".dp.gra,.ap.gra{fill:"+bu.Cols.GRADOT+"}"
+ ".dp.grn,.ap.grn{fill:"+bu.Cols.GRNDOT+"}"
+ ".dp.blu,.ap.blu{fill:"+bu.Cols.BLUDOT+"}"
+ ".dp.orn,.ap.orn{fill:"+bu.Cols.ORNDOT+"}"
+ ".dp.red,.ap.red{fill:"+bu.Cols.REDDOT+"}"
+ ".dp.blk,.ap.blk{fill:"+bu.Cols.BLCK+"}"
+ ".dp.fuda,.ap.fuda{fill-opacity:0.3}"
+ ".guides{pointer-events:none;fill:none;stroke:"+bu.Cols.LYEL+"}"
+ ".ybhp{pointer-events:none}"
+ ".rosy{fill:none;stroke:"+bu.Cols.ROSE+";pointer-events:none}"
+ ".steppy{fill:none;stroke:"+bu.Cols.PURP+";pointer-events:none}"
+ ".steppyppr{fill:none;stroke-opacity:0.8;stroke:"+bu.Cols.LPURP+";pointer-events:none}"
+ ".derails{fill:"+bu.Cols.REDDOT+";pointer-events:none}"
+ ".overlay .textbox{fill:#ffffcc;fill-opacity:0.5;stroke:black;"
+ "stroke-width:1;pointer-events:none;rx:5;ry:5}"

/** Fraction of plot range that the axes extend beyond */
const PRAF = .015

/** Seconds to milliseconds (Javascript unixtime is the latter) */
const SMS = 1000 

/** Paths for various PNG images used within the SVG */
const PNG = { beye:  "https://s3.amazonaws.com/bmndr/road/bullseye.png", 
              beyey: "https://s3.amazonaws.com/bmndr/road/bullseye_prev.png",

              // these versions are very light gray and not currently used:
              //skl:   "https://s3.amazonaws.com/bmndr/road/jollyroger.png",
              //inf:   "https://s3.amazonaws.com/bmndr/road/infinity.png",
              //sml:   "https://s3.amazonaws.com/bmndr/road/smiley.png",
              
              // black versions we're currently using with very low opacity:
              infb:  "https://bmndr.s3.amazonaws.com/road/infinity_blk.png",
              sklb:  "https://bmndr.s3.amazonaws.com/road/jollyroger_blk.png",
              smlb:  "https://bmndr.s3.amazonaws.com/road/smiley_blk.png",
            }

/** Enum object to identify error types */
const ErrType = { NOBBFILE: 0, BADBBFILE: 1, BBERROR: 2 }

/** Enum object to identify error types */
const ErrMsgs = [ "Could not find goal (.bb) file.", 
                  "Bad .bb file.", 
                  "Beeminder error" ]

/** This atrocity attempts to determine whether the page was loaded from a 
    mobile device. It might be from 2019 and in want of updating. */
const onMobileOrTablet = () => {
  if (typeof navigator == 'undefined' && typeof window == 'undefined') 
    return false
  var check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true})(navigator.userAgent||navigator.vendor||window.opera)
  return check
}

/** Configure functionality (private) */
let config = (obj, options) => {
  if (!obj.opts) obj.opts = bu.extend({}, defaults, true)
  
  if (onMobileOrTablet()) bu.extend(obj.opts, mobiledefaults)
  
  let opts = bu.extend(obj.opts, options, true)
  
  opts.divGraph = opts.divGraph && opts.divGraph.nodeName ? opts.divGraph : null
  
  if (opts.headless) {                        // Override options for svg output
    opts.divTable      = null
    opts.divPoints     = null
    opts.divDueby      = null
    opts.divData       = null
    opts.scrollZoom    = false
    opts.roadEditor    = false
    opts.showContext   = false
    opts.showFocusRect = false
  } else {
    opts.divTable = 
      opts.divTable && opts.divTable.nodeName ? opts.divTable : null
    opts.divPoints = 
      opts.divPoints && opts.divPoints.nodeName ? opts.divPoints : null
  }
  
  return opts
}

// -----------------------------------------------------------------------------
// ---------------------------- BGRAPH CONSTRUCTOR -----------------------------

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
  
  
    @property {function} onRoadChange Callback function that gets invoked when the road is finished loading or has been edited by the user. Various interface functions can then be used to retrieve the new road state. This is also useful to update the state of undo/redo and submit buttons based on how many edits have been done on the original road.
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
    @property {object} maxfluxline Visual parameter for maxfluxline (width)
    @property {object} stdfluxline Visual parameter for stdfluxline (width)

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

/** bgraph object constructor. Creates an empty beeminder graph and/or road
 * matrix table with the supplied options. Particular goal details may later be
 * loaded with {@link bgraph~loadGoal} or {@link loadGoalFromURL} functions.

 @memberof module:bgraph
 @constructs bgraph
 @param {BGraphOptions} options JSON input with various graph options
*/
const bgraph = function(options) { // BEGIN bgraph object constructor ------------

//console.debug("beebrain constructor ("+gid+"): ")
const self = this // what OOP magic is this? can we just use "this" on next line?
let opts = config(self, options)
const curid = gid
gid++

// Various dimensions and boxes
let yaxisw = 50
let sw = opts.svgSize.width
let sh = opts.svgSize.height
let plotbox, brushbox, plotpad, contextpad

let zoombtnsize = opts.zoomButton.size
let zoombtnscale = zoombtnsize / 540
let zoombtntr

// Graph components
let svg, defs, graphs, buttonarea, stathead, focus, focusclip, plot,
    context, ctxclip, ctxplot, 
    xSc, nXSc, xAxis, xAxisT, xGrid, xAxisObj, xAxisObjT, xGridObj,
    ySc, nYSc, yAxis, yAxisR, yAxisObj, yAxisObjR, yAxisLabel,
    xScB, xAxisB, xAxisObjB, yScB,
    gPB, gYBHP, gYBHPlines, gPink, gPinkPat, gTapePat, gGrid, gOResets,
    gPastText,
    gGuides, gMaxflux, gStdflux, gRazr, gOldBullseye, 
    gKnots, gSteppy, gSteppyPts, gRosy, gRosyPts, gMovingAv,
    gAura, gDerails, gAllpts, gDpts, gHollow, gFlat, 
    gBullseye, gRoads, gDots, gWatermark, gHashtags, gHorizon, gHorizonText,
    gRedTape,
    zoomarea, axisZoom, zoomin, zoomout,  
    brushObj, brush, focusrect, topLeft, dataTopLeft,
    scf = 1, oldscf = 0,
    xlinkloaded = true

// Internal state for the graph
let lastError = null
let undoBuffer = [] // Array of previous roads for undo
let redoBuffer = [] // Array of future roads for redo
let processing = false
let loading = false
let hidden = false
let mobileOrTablet = onMobileOrTablet()
let dataf, alldataf
let horindex = null // Road segment index including the horizon
let iroad = []  // Initial road 
let igoal = {}  // Initial goal object
  
// Beebrain state objects
let bbr, gol = {}, road = []
let data = [], rawdata = [], alldata = [], dtd = [], iso = []

function getiso(val) {
  if (iso[val] === undefined) iso[val] = br.isoline(road, dtd, gol, val)
  return iso[val]
}

function getisopath( val, xr ) {
  const isoline = getiso(val)
  if (xr == null) xr = [-Infinity, Infinity]
  let x = isoline[0][0]
  let y = isoline[0][1]
  if (x < xr[0]) { x = xr[0]; y = br.isoval(isoline, x) }
  let d = "M"+r1(nXSc(x*SMS))+" "+r1(nYSc(y))
  let a = bu.searchHigh(isoline, p => p[0] < xr[0] ? -1 : 1)
  let b = bu.searchHigh(isoline, p => p[0] < xr[1] ? -1 : 1)
  if (b > isoline.length - 1) b = isoline.length - 1
  for (let i = a; i <= b; i++) {
    d += " L"+r1(nXSc(isoline[i][0]*SMS))+" "+r1(nYSc(isoline[i][1]))
  }
  return d
}
  
// Compute lane width (the delta between yellow guiding lines) based on
// isolines on the left or right border for the graph depending on dir*yaw. If
// dir*yaw > 0 (like do-more), the left side is considered, otherwise the right
// side. The average lane width is computed by computing isolines for dtd=0 and
// dtd=365 and dividing it by 365 to overcome isolines coinciding for flat
// regions.
function isolnwborder(xr) {
  let lnw = 0
  const numdays = min(opts.maxFutureDays, ceil((gol.tfin-gol.tini)/SID))
  const center = getiso(0)
  const oneday = getiso(numdays)
//TODO: switch to this version
//const edge = gol.yaw*gol.dir > 0 ? 0 : 1 // left edge for MOAR/PHAT
//return abs(br.isoval(center, xr[edge])-br.isoval(oneday, xr[edge])) / numdays

  if (gol.yaw*gol.dir > 0) {
    lnw = abs(br.isoval(center, xr[0])-br.isoval(oneday, xr[0])) / numdays
  } else {
    lnw = abs(br.isoval(center, xr[1])-br.isoval(oneday, xr[1])) / numdays
  }
  return lnw
}

/** Limits an svg coordinate to 1 or 3 digits after the decimal 
 @param {Number} x Input number 
*/
function r1(x) { return round(x*10)/10 }
function r3(x) { return round(x*1000)/1000 }

/** Resets the internal goal object, clearing out previous data. */
function resetGoal() {
  // Initialize goal with sane values
  gol = {}
  gol.yaw = +1; gol.dir = +1
  gol.tcur = 0; gol.vcur = 0
  const now = moment.utc()
  now.hour(0); now.minute(0); now.second(0); now.millisecond(0)
  gol.asof = now.unix()
  gol.horizon = gol.asof+bu.AKH
  gol.xMin = gol.asof;  gol.xMax = gol.horizon
  gol.tmin = gol.asof;  gol.tmax = gol.horizon
  gol.yMin = -1;        gol.yMax = 1

  igoal = bu.deepcopy(gol); road = []; iroad = []; data = []; alldata = []
}
resetGoal()

/** Recompute padding value and bounding boxes for various components in the
 * graph. In particular, plotpad, contextpad, plotbox, and contextbox. */
function computeBoxes() {
  plotpad    = bu.extend({}, opts.focusPad)
  contextpad = bu.extend({}, opts.ctxPad)
  if (gol.stathead && !opts.roadEditor) plotpad.top += 15
  plotpad.left  += yaxisw
  plotpad.right += yaxisw+(gol.hidey?8:0) // Extra padding if yaxis text hidden
  contextpad.left += yaxisw
  contextpad.right += yaxisw+(gol.hidey?8:0)
  plotbox = {
    x:      opts.focusRect.x      + plotpad.left,
    y:      opts.focusRect.y      + plotpad.top,
    width:  opts.focusRect.width  - plotpad.left - plotpad.right, 
    height: opts.focusRect.height - plotpad.top  - plotpad.bottom,
  }
  brushbox = {
    x:      opts.ctxRect.x      + contextpad.left,
    y:      opts.ctxRect.y      + contextpad.top,
    width:  opts.ctxRect.width  - contextpad.left - contextpad.right, 
    height: opts.ctxRect.height - contextpad.top  - contextpad.bottom,
  }
  zoombtntr = {
    botin:  "translate("+(plotbox.width-2*(zoombtnsize+5))
                    +","+(plotbox.height -(zoombtnsize+5))
                    +") scale("+zoombtnscale+","+zoombtnscale+")",
    botout: "translate("+(plotbox.width -(zoombtnsize+5))
                    +","+(plotbox.height-(zoombtnsize+5))
                    +") scale("+zoombtnscale+","+zoombtnscale+")",
    topin: "translate("+(plotbox.width-2*(zoombtnsize+5))
                    +",5) scale("+zoombtnscale+","+zoombtnscale+")",
    topout: "translate("+(plotbox.width-(zoombtnsize+5))
                    +",5) scale("+zoombtnscale+","+zoombtnscale+")" }
}
computeBoxes()

/** Utility function to show a shaded overlay with a message consisting of
 multiple lines supplied in the array argument.
 @param {String[]} msgs Array of messages, one for each line
 @param {Number} [fs=-1] Font size. height/15 if -1
 @param {String} [fw="bold"} Font weight
 @param {Object} [box=null] Bounding box {x,y,w,h} for the overlay; default null
 @param {String} [cls="overlay} CSS class of the created overlay
 @param {Boolean} [shd=true] Shade out graph if true
*/
function showOverlay(msgs, fs=-1, fw="bold",
                     box=null, cls="overlay", shd=true, animate=false,
                     parent=null) {
  if (opts.divGraph == null) return
  if (box == null) box ={x:sw/20, y:sh/5, w:sw-2*sw/20, h:sh-2*sh/5}
  if (parent == null) parent = svg
  let pg = parent.select("g."+cls)
  if (pg.empty()) {
    pg = parent.append('g').attr('class', cls)
    if (shd) {
      pg.append('svg:rect').attr('x',             0)
                           .attr('y',             0)
                           .attr('width',         sw)
                           .attr('height',        sh)
                           .style('fill',         bu.Cols.WITE)
                           .style('fill-opacity', 0.5)
    }
    pg.append('svg:rect').attr("class",  "textbox")
                         .attr('x',      box.x)
                         .attr('y',      box.y)
                         .attr('width',  box.w)
                         .attr('height', box.h)
  }
  pg.selectAll(".loading").remove()
  const nummsgs = msgs.length
  if (fs < 0) fs = sh/15
  const lh = fs * 1.1
  for (let i = 0; i < nummsgs; i++) {
    pg.append('svg:text').attr('class', 'loading')
      .attr('x',            box.x+box.w/2)
      .attr('y',            (box.y+box.h/2) - ((nummsgs-1)*lh)/2+i*lh+fs/2-3)
      .attr('font-size',    fs)
      .style('font-size',   fs)
      .style('font-weight', fw)
      .text(msgs[i])
  }
  if (animate) 
    pg.style("opacity", 0).transition().duration(200).style("opacity", 1)
}
/** Removes the message overlay created by {@link 
    bgraph~showOverlay showOverlay()}
    @param {String} [cls="overlay"] CSS class for the overlay to remove
*/
function removeOverlay(cls = "overlay", animate = false, parent = null) {
  //console.debug("removeOverlay("+self.id+")")
  if (opts.divGraph == null) return
  if (parent == null) parent = svg
  let pg = parent.selectAll("g."+cls)
  if (animate) pg.style("opacity", 1).transition().duration(200)
                 .style("opacity", 0).remove()
  else pg.remove()
}

/** Creates all SVG graph components if a graph DIV is provided. Called once
   when the bgraph object is created. */
function createGraph() {
  const div = opts.divGraph
  if (div === null) return
  // First, remove all children from the div
  while (div.firstChild) div.removeChild(div.firstChild)
  
  // Initialize the div and the SVG
  svg = d3.select(div).attr("class", "bmndrgraph")
    .append('svg:svg')
    .attr("id",                  "svg"+curid)
    .attr("xmlns",               "http://www.w3.org/2000/svg")
    .attr("xmlns:xlink",         "http://www.w3.org/1999/xlink")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("viewBox",             "0 0 "+sw+" "+sh)
    .attr('width',               "100%")
    .attr('height',              "100%")
    .attr('class',               'bmndrsvg')
  
  // Common SVG definitions, including clip paths
  defs = svg.append('defs')
  defs.insert('style').attr('type','text/css').text(SVGStyle)
  // Dot types:
  //               col r
  // Rosy dots   : ROSE
  // Steppy pts  : PURP
  // All pts     : 
  // Editor data :
  // Graph data  :
  // Graph hollow:
  defs.insert('style').attr("id", "dynstyle"+curid).attr('type','text/css').text("")
  
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
  
  gPinkPat = defs.append("pattern").attr("id",              "pinkzonepat"+curid)
                                   .attr("x",                0)
                                   .attr("y",                0)
                                   .attr("width",            10)
                                   .attr("height",           10)
                                   .attr("patternTransform", "rotate(45)")
                                   .attr("patternUnits",     "userSpaceOnUse")
  gPinkPat.append("rect").attr("x",                0)
                         .attr("y",                0)
                         .attr("width",            10)
                         .attr("height",           10)
                         .attr("fill", bu.Cols.PINK)
  gPinkPat.append("line").attr("x1",            0)
                         .attr("y1",            0)
                         .attr("x2",            0)
                         .attr("y2",            10)
                         .style("stroke",       "#aaaaaa")
                         .style("stroke-width", 1)
  
  gTapePat = defs.append("pattern").attr("id",              "tapepat"+curid)
                                   .attr("x",                0)
                                   .attr("y",                0)
                                   .attr("width",            20)
                                   .attr("height",           20)
                                   .attr("patternTransform", "rotate(45)")
                                   .attr("patternUnits",     "userSpaceOnUse")
  gTapePat.append("rect").attr("x",                0)
                         .attr("y",                0)
                         .attr("width",            20)
                         .attr("height",           20)
                         .attr("fill", "#ffffff")
  gTapePat.append("line").attr("x1",            0)
                         .attr("y1",            0)
                         .attr("x2",            20)
                         .attr("y2",            0)
                         .style("stroke",       "#ff5555")
                         .style("stroke-width", 25)

  const buttongrp = defs.append("g").attr("id", "removebutton")
  buttongrp.append("circle").attr("cx",   14)
                            .attr("cy",   14)
                            .attr("r",    16)
                            .attr('fill', 'white')
  buttongrp.append("path")
    .attr("d", "M13.98,0C6.259,0,0,6.261,0,13.983c0,7.721,6.259,13.982,13.98,13.982c7.725,0,13.985-6.262,13.985-13.982C27.965,6.261,21.705,0,13.98,0z M19.992,17.769l-2.227,2.224c0,0-3.523-3.78-3.786-3.78c-0.259,0-3.783,3.78-3.783,3.78l-2.228-2.224c0,0,3.784-3.472,3.784-3.781c0-0.314-3.784-3.787-3.784-3.787l2.228-2.229c0,0,3.553,3.782,3.783,3.782c0.232,0,3.786-3.782,3.786-3.782l2.227,2.229c0,0-3.785,3.523-3.785,3.787C16.207,14.239,19.992,17.769,19.992,17.769z")
  
  const zoomingrp = defs.append("g").attr("id", "zoominbtn")
  if (!opts.headless && opts.buttonZoom) {
    // Zoom buttons are not visible for SVG output in headless mode
    zoomingrp.append("path").style("fill", "white")
      .attr("d", "m 530.86356,264.94116 a 264.05649,261.30591 0 1 1 -528.1129802,0 264.05649,261.30591 0 1 1 528.1129802,0 z")
    zoomingrp.append("path")
      .attr("d", "m 308.21,155.10302 -76.553,0 0,76.552 -76.552,0 0,76.553 76.552,0 0,76.552 76.553,0 0,-76.552 76.552,0 0,-76.553 -76.552,0 z m 229.659,114.829 C 537.869,119.51007 420.50428,1.9980234 269.935,1.9980234 121.959,1.9980234 2.0000001,121.95602 2.0000001,269.93202 c 0,147.976 117.2473599,267.934 267.9339999,267.934 150.68664,0 267.935,-117.51205 267.935,-267.934 z m -267.935,191.381 c -105.681,0 -191.381,-85.7 -191.381,-191.381 0,-105.681 85.701,-191.380996 191.381,-191.380996 105.681,0 191.381,85.700996 191.381,191.380996 0,105.681 -85.7,191.381 -191.381,191.381 z")
  }
  
  const zoomoutgrp = defs.append("g").attr("id", "zoomoutbtn")
  if (!opts.headless && opts.buttonZoom) {
    // Zoom buttons are not visible for SVG output in headless mode
    zoomoutgrp.append("path").style("fill", "white")
      .attr("d", "m 530.86356,264.94116 a 264.05649,261.30591 0 1 1 -528.1129802,0 264.05649,261.30591 0 1 1 528.1129802,0 z")
    zoomoutgrp.append("path")
      .attr("d", "m 155.105,231.65502 0,76.553 229.657,0 0,-76.553 c -76.55233,0 -153.10467,0 -229.657,0 z m 382.764,38.277 C 537.869,119.51007 420.50428,1.9980234 269.935,1.9980234 121.959,1.9980234 2.0000001,121.95602 2.0000001,269.93202 c 0,147.976 117.2473599,267.934 267.9339999,267.934 150.68664,0 267.935,-117.51205 267.935,-267.934 z m -267.935,191.381 c -105.681,0 -191.381,-85.7 -191.381,-191.381 0,-105.681 85.701,-191.380996 191.381,-191.380996 105.681,0 191.381,85.700996 191.381,191.380996 0,105.681 -85.7,191.381 -191.381,191.381 z")
  }
  
  // Create rectange to monitor zoom events and install handlers
  zoomarea = svg.append('rect').attr("class",  "zoomarea")
                               .attr("x",      plotbox.x)
                               .attr("y",      plotbox.y)
                               .attr("color",  bu.Cols.REDDOT)
                               .attr("width",  plotbox.width)
                               .attr("height", plotbox.height)
  const oldscroll = zoomarea.on("wheel.scroll")
  const scrollinfo = {shown: false, timeout: null}
  
  const onscroll = function() {
    if (scrollinfo.timeout != null) {
      clearTimeout(scrollinfo.timeout)
      scrollinfo.timeout = null
    }
    if (d3.event.ctrlKey) {
      removeOverlay("zoominfo",true, plot)
      scrollinfo.shown = false
      return
    }
    if (!scrollinfo.shown) {
      showOverlay(["Use ctrl+scroll to zoom"], -1,"normal",
                  {x:0,y:0,w:plotbox.width,h:plotbox.height},
                  "zoominfo", false, true, plot)
      scrollinfo.shown = true
    }
    scrollinfo.timeout= setTimeout(() => {removeOverlay("zoominfo", true);
                                          scrollinfo.shown = false},1000)
 }
  const onmove = function() {
    if (scrollinfo.timeout != null) {
      clearTimeout(scrollinfo.timeout)
      scrollinfo.timeout = null
    }
    removeOverlay("zoominfo",true)
    scrollinfo.shown = false
  }
  zoomarea.on("wheel.scroll", onscroll, {passive:false})
  zoomarea.on("mousedown.move", onmove)
  //zoomarea.on("touchstart", ()=>{console.log("touchstart")} )
  //zoomarea.on("touchmove", ()=>{console.log("touchmove")} )
  //zoomarea.on("touchend", ()=>{console.log("touchend")} )

  axisZoom = d3.zoom()
    .extent([[0, 0], [plotbox.width, plotbox.height]])
    .scaleExtent([1, Infinity])
    .translateExtent([[0, 0], [plotbox.width, plotbox.height]])
    .filter(function(){ return (d3.event.type != "wheel" || d3.event.ctrlKey) })
    .on("zoom", zoomed)
  zoomarea.call(axisZoom)
  if (onMobileOrTablet()) {
    let pressTimer = null, pressX
    const oldTouchStart = zoomarea.on("touchstart.zoom")
    const oldTouchMove  = zoomarea.on("touchmove.zoom")
    const oldTouchEnd   = zoomarea.on("touchend.zoom")
    
    zoomarea
      .on("touchstart.zoom", function(){ 
        const bbox = this.getBoundingClientRect()
        pressX = d3.event.touches.item(0).pageX - bbox.left
        const  newx = nXSc.invert(pressX)
        if (pressTimer == null && d3.event.touches.length == 1) 
          pressTimer = window.setTimeout(
            () => { if (newx != null) addNewDot(newx/SMS) }, 1000)
        oldTouchStart.apply(this, arguments)} )
      .on("touchmove.zoom", function(){ window.clearTimeout(pressTimer); pressTimer = null; oldTouchMove.apply(this, arguments)})
      .on("touchend.zoom", function(){ clearTimeout(pressTimer); pressTimer = null; oldTouchEnd.apply(this, arguments)} )
  }
  function dotAdded() {
    const mouse = d3.mouse(svg.node())
    const newx = nXSc.invert(mouse[0]-plotpad.left)
    addNewDot(newx/SMS)
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
  
  // Order here determines z-order... 
  // (The commented z-values are to remember previous order for experimenting)
  gPB          = plot.append('g').attr('id', 'pastboxgrp')     // z = 01
  gYBHP        = plot.append('g').attr('id', 'ybhpgrp')        // z = 02
  gWatermark   = plot.append('g').attr('id', 'wmarkgrp')       // z = 03
  gGuides      = plot.append('g').attr('id', 'guidegrp')       // z = 04
  gMaxflux     = plot.append('g').attr('id', 'maxfluxgrp')     // z = 05
  gStdflux     = plot.append('g').attr('id', 'stdfluxgrp')     // z = 06
  gYBHPlines   = plot.append('g').attr('id', 'ybhplinesgrp')   // z = 07
  gRazr        = plot.append('g').attr('id', 'razrgrp')        // z = 08
  gAura        = plot.append('g').attr('id', 'auragrp')        // z = 09
  gPink        = plot.append('g').attr('id', 'pinkgrp')        // z = 10
  gOldBullseye = plot.append('g').attr('id', 'oldbullseyegrp') // z = 11
  gBullseye    = plot.append('g').attr('id', 'bullseyegrp')    // z = 12
  gGrid        = plot.append('g').attr('id', 'grid')           // z = 13
  gOResets     = plot.append('g').attr('id', 'oresetgrp')      // z = 14
  gKnots       = plot.append('g').attr('id', 'knotgrp')        // z = 15
  gSteppy      = plot.append('g').attr('id', 'steppygrp')      // z = 16
  gRosy        = plot.append('g').attr('id', 'rosygrp')        // z = 17
  gRosyPts     = plot.append('g').attr('id', 'rosyptsgrp')     // z = 18
  gDerails     = plot.append('g').attr('id', 'derailsgrp')     // z = 19
  gAllpts      = plot.append('g').attr('id', 'allptsgrp')      // z = 20
  gMovingAv    = plot.append('g').attr('id', 'movingavgrp')    // z = 21
  gSteppyPts   = plot.append('g').attr('id', 'steppyptsgrp')   // z = 22
  gDpts        = plot.append('g').attr('id', 'datapointgrp')   // z = 23
  gHollow      = plot.append('g').attr('id', 'hollowgrp')      // z = 24
  gFlat        = plot.append('g').attr('id', 'flatlinegrp')    // z = 25
  gHashtags    = plot.append('g').attr('id', 'hashtaggrp')     // z = 26
  gRoads       = plot.append('g').attr('id', 'roadgrp')        // z = 27
  gDots        = plot.append('g').attr('id', 'dotgrp')         // z = 28
  gHorizon     = plot.append('g').attr('id', 'horgrp')         // z = 29
  gHorizonText = plot.append('g').attr('id', 'hortxtgrp')      // z = 30
  gPastText    = plot.append('g').attr('id', 'pasttxtgrp')     // z = 31

  gRedTape = plot.append('g').attr('visibility', 'hidden')
  // wwidth and height will be set by resizeGraph later
  gRedTape.append('rect').attr('x', 0).attr('y', 0)
    .attr('stroke-width', 20).attr('stroke', "url(#tapepat"+curid+")")
    .attr('fill', 'none')
  // x coordinate will be set by resizeGraph later
  gRedTape.append('text').attr('y', 45)
    .attr('paint-order', 'stroke')
    .attr('stroke-width', '2px').attr('stroke', '#a00000')
    .attr('font-size', "35px").attr('text-anchor', 'middle')
    .attr('fill', '#ff0000')
    .text("Error") // originally "road can't get easier"

  zoomin = focusclip.append("svg:use")
    .attr("class","zoomin")
    .attr("xlink:href", "#zoominbtn")
    .attr("opacity",opts.zoomButton.opacity)
    .attr("transform", zoombtntr.botin)
    .on("click", () => { zoomarea.call(axisZoom.scaleBy, 
                                       opts.zoomButton.factor) })
    .on("mouseover", () =>{
      if (!mobileOrTablet) d3.select(this).style("fill", "red")})
    .on("mouseout",(d,i) => {d3.select(this).style("fill", "black")})
  zoomout = focusclip.append("svg:use")
    .attr("class",      "zoomout")
    .attr("xlink:href", "#zoomoutbtn")
    .attr("opacity",    opts.zoomButton.opacity)
    .attr("transform",  zoombtntr.botout)
    .on("click", () => { zoomarea.call(axisZoom.scaleBy, 
                                       1/opts.zoomButton.factor) })
    .on("mouseover", () => {
      if (!mobileOrTablet) d3.select(this).style("fill", "red") })
    .on("mouseout",(d,i) => { d3.select(this).style("fill", "black") })

  // Create and initialize the x and y axes
  xSc   = d3.scaleUtc().range([0,plotbox.width])
  xAxis = d3.axisBottom(xSc).ticks(6)

  xAxisObj = focus.append('g')        
    .attr("class", "axis")
    .attr("transform", "translate("+plotbox.x+"," 
          + (plotpad.top+plotbox.height) + ")")
    .call(xAxis)
  xGrid = d3.axisTop(xSc).ticks(6).tickFormat("")
  xGridObj = gGrid.append('g')
    .attr("class", "grid")
    .attr("transform", "translate(0,"+(plotbox.height)+")")
    .call(xGrid)
  xAxisT = d3.axisTop(xSc).ticks(6)
  xAxisObjT = focus.append('g')
    .attr("class", "axis")
    .attr("transform", "translate("+plotbox.x+"," + (plotpad.top) + ")")
    .call(xAxisT)

  if (opts.roadEditor) {
    xGridObj.attr('display', 'none')
    xAxisObjT.attr('display', 'none')
  }

  ySc    = d3.scaleLinear().range([plotbox.height, 0])
  yAxis  = d3.axisLeft(ySc).ticks(8).tickSize(6).tickSizeOuter(0)
  yAxisR = d3.axisRight(ySc).ticks(8).tickSize(6).tickSizeOuter(0)
  yAxisObj = focus.append('g')        
    .attr("class", "axis")
    .attr("transform", "translate(" + plotpad.left + ","+plotpad.top+")")
    .call(yAxis)
  yAxisObjR = focus.append('g').attr("class", "axis")
    .attr("transform", "translate(" 
                       + (plotpad.left+plotbox.width) + ","+plotpad.top+")")
    .call(yAxisR)
  yAxisLabel = focus.append('text')        
    .attr("class", "axislabel")
    .attr("transform", 
          "translate(15,"+(plotbox.height/2+plotpad.top)+") rotate(-90)")
    .text("") // used to say "deneme" but was user-visible in error graphs
  
  // Create brush area
  context = svg.append('g')
    .attr('class', 'brush')
    .attr('transform', 'translate('+opts.ctxRect.x+','+opts.ctxRect.y+')')
  ctxclip = context.append('g')
    .attr('clip-path', 'url(#brushclip'+curid+')')
    .attr('transform', 'translate('+contextpad.left+','+contextpad.top+')')
  ctxplot = ctxclip.append('g').attr('class', 'context')
  xScB = d3.scaleUtc().range([0,brushbox.width])
  xAxisB = d3.axisBottom(xScB).ticks(6)
  xAxisObjB = context.append('g')
    .attr("class", "axis")
    .attr("transform", "translate("+brushbox.x+"," 
          + (contextpad.top+brushbox.height) + ")")
    .call(xAxisB)
  yScB = d3.scaleLinear().range([brushbox.height, 0])

  brushObj = d3.brushX()
    .extent([[0, 0], [brushbox.width, brushbox.height]])
    .on("brush", brushed);

  brush = ctxplot.append("g").attr("class", "brush").call(brushObj)
  focusrect = ctxclip.append("rect")
    .attr("class",             "focusrect")
    .attr("x",                 1)
    .attr("y",                 1)
    .attr("width",             brushbox.width-2)
    .attr("height",            brushbox.height-2)
    .attr("fill",              "none")
    .style("stroke",           "black")
    .style("stroke-width",     1)
    .style("stroke-dasharray", "8,4,2,4")
  nXSc = xSc, nYSc = ySc
}

/** Resize various SVG graph components when any of the bounding boxes change.
 * This is primarily due to the text width for y-axis labels and tick marks
 * changing, as handled by the {@link 
 * bgraph~handleYAxisWidth handleYAxisWidth()} function. */
function resizeGraph() {
  //console.debug("id="+curid+", resizeGraph()")

  const div = opts.divGraph
  if (div === null) return

  const xr = [nXSc.invert(0), nXSc.invert(plotbox.width)]
  //console.debug(xr)
  computeBoxes()
  // Common SVG definitions, including clip paths
  defs.select('#plotclip'+curid+' > rect')
    .attr("width",  plotbox.width)
    .attr("height", plotbox.height)
  defs.select('#brushclip'+curid+' > rect')
    .attr("width",  brushbox.width)
    .attr("height", brushbox.height)
  defs.select('#buttonareaclip'+curid+' > rect')
    .attr("x", plotbox.x)
    .attr("y", 0)
    .attr("width",  plotbox.width)
    .attr("height", plotbox.height);
  zoomarea.attr("x", plotbox.x)
    .attr("y", plotbox.y)
    .attr("width", plotbox.width)
    .attr("height", plotbox.height)
  axisZoom.extent([[0, 0], [plotbox.width, plotbox.height]])
    .scaleExtent([1, Infinity])
    .translateExtent([[0, 0], [plotbox.width, plotbox.height]])
  focusclip.attr('transform', 'translate('+plotpad.left+','+plotpad.top+')')
  zoomin.attr( "transform", zoombtntr.botin)
  zoomout.attr("transform", zoombtntr.botout)
  xSc.range( [0, plotbox.width])
  nXSc.range([0, plotbox.width])
  xAxisObj.attr("transform", "translate("+plotbox.x+"," 
                   + (plotpad.top+plotbox.height) + ")").call(xAxis.scale(nXSc))
  xGridObj.attr("transform", "translate(0,"+(plotbox.height)+")").call(xGrid)
  xAxisObjT.attr("transform", "translate("+plotbox.x+","+(plotpad.top)+")")
    .call(xAxisT.scale(nXSc))

  gRedTape.select('rect').attr('width', plotbox.width).attr('height', plotbox.height)
  gRedTape.select('text').attr('x', plotbox.width/2)
    
  ySc.range( [0, plotbox.height])
  nYSc.range([0, plotbox.height])
  yAxisObj.attr("transform", "translate("+plotpad.left+","+plotpad.top+")")
    .call(yAxis.scale(nYSc))

  yAxisObjR.attr("transform", "translate(" 
                           + (plotpad.left+plotbox.width) + ","+plotpad.top+")")
    .call(yAxisR.scale(nYSc))

  yAxisLabel.attr("transform", 
                  "translate(15,"+(plotbox.height/2+plotpad.top)
                                                               +") rotate(-90)")
  ctxclip.attr('transform', 'translate('+contextpad.left+','+contextpad.top+')')
  //console.debug("Scaling brush x axis to "+brushbox.width);
  xScB.range([0,brushbox.width])
  xAxisObjB.attr("transform", "translate("+brushbox.x+"," 
                 + (contextpad.top+brushbox.height) + ")")
    .call(xAxisB)
  yScB.range([brushbox.height, 0])
  brushObj.extent([[0, 0], [brushbox.width, brushbox.height]])
  brush.call(brushObj)

  // Go back to previous zoom level in case x-axis size / limits have changed
  let s = xr.map(xSc)
  zoomarea.call(axisZoom.transform, d3.zoomIdentity
                .scale(plotbox.width / (s[1] - s[0]))
                .translate(-s[0], 0))
  //console.debug(s)
  adjustYScale()
}

let databody, dataslider, dsliderbusy = false
let datarange, dataindex = 0, dataselected=-1
function updateDataSliderValue() {
  if (!dataslider) return
  dataslider.node().value = dataindex
}
  
function selectDataIndex(ind) {
  ind = rawdata.length-ind-1 // reverse table
  // Make sure the data table is visible before selection
  if (!databody.node().offsetParent) return
  dataselected = ind
  const midpt = Math.floor(opts.dataTableSize/2)
  const tbindex = Math.max(0, Math.min(ind-midpt, rawdata.length-opts.dataTableSize))
  dataindex = tbindex
  updateDataSliderValue()
  updateDataTable()
}
function unselectDataIndex() {
  dataselected = -1
  updateDataTable()
}
function dsliderupdate(val) {
  dsliderbusy = true
  dataindex = parseInt(val)
  updateDataTable()
  dsliderbusy = false
}
function dsliderscroll() {
  if (dtableedit) return
  d3.event.preventDefault()
  if (d3.event.deltaY < 0) {
    if (dataindex == 0) return
    dataindex -= 1
  } else {
    if (dataindex >= rawdata.length-opts.dataTableSize) return
    dataindex += 1
  }
  updateDataSliderValue()
  updateDataTable()
}
/** Creates the skeleton for the data table and populates it with
 * rows. Cells are created later in updateDueBy using d3 */
const dcellclass = ["id", "dt", "vl", "cmt", "mod", "del"]
const dcellelt = ["span", "div", "div", "div", "button", "button"]
function createDataTable() {
  const div = opts.divData
  if (div === null) return
  // First, remove all children from the div
  while (div.firstChild) div.removeChild(div.firstChild)

  const divelt = d3.select(div)
  divelt.append("div").attr("id", "dpfloat").attr("class", "floating")
  dataTopLeft = divelt.append("div").attr("id", "datatopleft")
     .style("position", "absolute").style("left", 0).style("top",0)
     .style("width", "1px").style("height", "1px")
     .attr("visibility","hidden")

  divelt.attr("class", "bmndrdata")
  divelt.on("wheel.scroll", dsliderscroll, {passive:false})

  databody = divelt.append("div").attr("class", "dbody") /* Data table body */
  let datacolumns
  datarange = Array(Math.min(rawdata.length, opts.dataTableSize)).fill().map((x,i)=>(i+dataindex))
  datacolumns = ['#', 'DATE', 'VALUE', 'COMMENT', '', ''];
  databody.append("div").attr('class', 'dhdrrow')
    .selectAll("span.dhdrcell").data(datacolumns)
    .enter().append("span").attr('class',(d,i) => ('dhdrcell '+dcellclass[i]))
    .style("text-align", (d,i)=>( (i == 0)?"right":null))
    .text((c)=>c);
  databody
    .selectAll(".drow")
    .data(datarange)
    .join(enter => enter.append("div").attr('class', 'drow'))
  dataslider = divelt.append("input").attr("type", "range").attr("class","dslider")
    .attr("min",0).attr("max",15).attr("value",7).attr("step",1)
    .on("input",function(){dsliderupdate(this.value)})
    .on("change",function(){dsliderupdate(this.value)})
}

function createSvgEl(name) {
  return document.createElementNS("http://www.w3.org/2000/svg", name);
}
function createXhtmlEl(name) {
  return document.createElementNS("http://www.w3.org/1999/xhtml", name);
}

let dtablebusy = false, dtableedit = null
function getDataRowId() {
  return event.currentTarget.parentElement.getAttribute('id')
}
function getDataInd() {
  const id = getDataRowId()
  const ind = id.match(/drow(\d+)/)
  if (!ind || ind.length < 2) return null
  return ind[1]
}
function getDataId() {
  const ind = getDataInd()
  if (!ind) return null
  const d = rawdata[ind]
  return d[3]?d[3]:ind
}
function dataEdit() {
  const ind = getDataInd()
  if (!dtableedit) {
    // Starting edit
    const id = getDataRowId()
    dtableedit = ind
    dataslider.attr("disabled", true)
    dataFocus.field = null
    dataFocus.oldText = null
    dataFocus.changed = false
  } else {
    // Finishing edit
    if (dataFocus.changed) {

      const did = getDataId()
      const parent = d3.select(event.currentTarget.parentNode)
      const date = bu.dayparse(parent.select(".dt").text(),'-')
      const value = parent.select(".vl").text()
      const comment = parent.select(".cmt").text()
      if (!isNaN(date)&&!isNaN(value)&&ind==dtableedit&&opts.onDataEdit)
        opts.onDataEdit(did, [date, value, comment])
    }
    dataslider.attr("disabled", null)
    dtableedit = null
  }
  updateDataTable()
}
function dataDelete() {
  const ind = getDataInd()
  const did = getDataId()
  if (dtableedit && dtableedit != ind) return 
  if (opts.onDataEdit) opts.onDataEdit(did, null)
  updateDataTable()
}
function dataCancel() {
  dataslider.attr("disabled", null)
  dtableedit = null
  updateDataTable()
}

// Focused field information for the road table
const dataFocus = {
  field: null,
  oldText : null,
  changed : false
}
function dataFocusIn( d, i ){
  if (!opts.onDataEdit || i == 0  || i > 3) return
  if (!dtableedit) {
    // Starting editing
    dataEdit()
  } else if (!d.edit) return
  
  //console.debug('dataFocusIn('+i+') for '+this.parentNode.id);
  dataFocus.field = d3.select(this)
  dataFocus.oldText = dataFocus.field.text()
  destroyDatePicker()
  //let kind = Number(dataFocus.field.node().parentNode.id);
  if (i == 1) {
    let floating = d3.select(opts.divData).select('.floating');
    createDatePicker(dataFocus.field, null, null, floating, dataTopLeft)
  }
}

function dataFocusOut( d, i ){
  if (!opts.onDataEdit || !d.edit || i == 0 || i > 3) return
  //console.debug('tableFocusOut('+i+') for '+this.parentNode.id);
  //let kind = Number(this.parentNode.id)
  const text = d3.select(this).text()
  destroyDatePicker()
  clearSelection()
  if (text === dataFocus.oldText) return
  dataFocus.changed = true
  if (dataFocus.oldText == null) return // ENTER must have been hit
  const val = (i==1 ? bu.dayparse(text, '-') : text)
  if (i != 3 && isNaN(val)) {
    d3.select(this).text(dataFocus.oldText)
    dataFocus.oldText = null
    dataFocus.field = null
    return
  }
  dataFocus.oldText = null
  dataFocus.field = null
}
  
function dataKeyDown(d, i) {
  if (!opts.onDataEdit || !d.edit || i == 0 || i > 3) return
  if (d3.event.keyCode == 13) {
    this.blur()
    const text = d3.select(this).text()
    const val = (i==1 ? bu.dayparse(text, '-') : text)
    if (i != 3 && isNaN(val)) {
      d3.select(this).text(dataFocus.oldText)
      dataFocus.oldText = null
      return
    }
    dataFocus.oldText = d3.select(this).text()
    if (d3.event.ctrlKey) {
      // Ctrl-enter finishes editing
      dataEdit()
    }
  }
}
function updateDataTable() {
  if (dtablebusy) return
  dtablebusy = true
  if (processing) return
  if (opts.divData === null) return

  if (!dsliderbusy) {
    if (rawdata.length <= opts.dataTableSize) dataslider.style("visibility", "hidden")
    else {
      dataslider.style("visibility", "visible")
        .attr("max", rawdata.length-opts.dataTableSize)
        .attr("value", 0)
    }
  }
  
  datarange = Array(Math.min(rawdata.length, opts.dataTableSize)).fill().map((x,i)=>(i+dataindex))
  const elts = databody.selectAll(".drow").data(datarange)
  elts.enter()
    .append("div")
    .attr('class', 'drow')
    .attr("id", d=>("drow"+(rawdata.length-d-1)))
  elts.exit().remove()
  elts.style("box-shadow", (d) => (d==dataselected)?"0 0 0 4px yellow":null)
    .attr("id", d=>("drow"+(rawdata.length-d-1)))
  
  const cells = databody
    .selectAll(".drow")
    .selectAll(".dcell")
    .data((row, i) => {
      if (row >= rawdata.length) return [null, null, null, null, null, null]
      row = rawdata.length-row-1 // reverse table
      let date = bu.dayify(bu.dayparse(rawdata[row][0]), '-')
      let editp = (dtableedit)?(row == dtableedit):false
      return [{txt:row,clk:null,edit:editp},
              {txt:date,clk:null,edit:editp},
              {txt:rawdata[row][1],clk:null,edit:editp},
              {txt:rawdata[row][2],clk:null,edit:editp},
              {txt:editp?'<img class="dicon" src="../src/check.svg"></img>':'<img class="dicon" src="../src/edit.svg" ></img>',clk:dataEdit,edit:editp},
              {txt:editp?'<img class="dicon" src="../src/cancel.svg" ></img>':'<img class="dicon" src="../src/trash.svg"></img>',clk:editp?dataCancel:dataDelete,edit:editp}]
    })

  cells.join(enter=>
             enter.append((d,i)=>(createXhtmlEl(dcellelt[i])))
             .attr('class', (d,i)=>("dcell "+dcellclass[i]))
             .style("border", (d,i)=>( (i == 0)?"0":null))
             .style("text-align", (d,i)=>( (i == 0)?"right":null))
             .on('click', d=>(d.clk?d.clk():null)),
             update=>update)
    .html(d=>{return d.txt})
    .style('visibility', function(d){return (this.tagName==="BUTTON" && (dtableedit && !d.edit))?"hidden":null})
    //.attr('contenteditable', (d,i)=>((dtableedit&&d.edit&&i>0)?true:false))
    .attr('contenteditable', (d,i) => (opts.onDataEdit?(i>0&&i<4):false))
    .on('focusin', dataFocusIn)
    .on('focusout', dataFocusOut)
    .on('keydown', dataKeyDown)
    .style('opacity', (d)=>((!dtableedit || d.edit)?null:0.2))
  
  const buttons = databody.selectAll('button.dcell')
  if (opts.onDataEdit) buttons.style('display', null)
  else buttons.style('display', 'none')

  dtablebusy = false
}
function resetDataTable() {
  if (opts.divData === null) return
  dataindex = 0
  dtableedit = null
  dataslider.attr("disabled", null)
  updateDataSliderValue()
  updateDataTable()
}

let dbbody
function duebylabel(i, now) {
  const mm = moment.unix(gol.asof+i*SID).utc()
  const ds = bu.dayparse(mm.format("YYYYMMDD")) / SID
  if (ds == now-1) return ["Yesterday", bu.Cols.REDDOT]
  if (ds == now) return ["Today", bu.Cols.ORNG]
  if (ds == now+1) return ["Tomorrow", bu.Cols.BLUDOT]
  const dstr = mm.format("ddd (Do)")
  if (ds == now+2) return [dstr, bu.Cols.GRNDOT]
  return [dstr, bu.Cols.BLCK]
}
  
/** Creates the skeleton for the dueby table and populates it with
 * rows. Cells are created later in updateDueBy using d3 */
function createDueBy() {
  const div = opts.divDueby
  if (div === null) return
  // First, remove all children from the div
  while (div.firstChild) div.removeChild(div.firstChild)

  const divelt = d3.select(div)
  dbbody = divelt.append("div").attr("class", "dbbody") /* Dueby table body */
  let dbcolumns
  dbcolumns = ['DAY', 'DELTA', 'TOTAL'];
  dbbody.append("div").attr('class', 'dbhdrrow')
    .selectAll("span.dbhdrcell").data(dbcolumns)
    .enter().append('span').attr('class', 'dbhdrcell')
    .text((c)=>c);
  dbbody
    .selectAll(".dbrow")
    .data([1,2,3,4,5,6,7])
    .join(enter => enter.append("div").attr('class', 'dbrow'))
}

function updateDueBy() {
  if (processing) return
  if (opts.divDueby === null) return

  const nowstamp = bu.nowstamp(gol.timezone, gol.deadline, gol.asof)
  const nowday = bu.dayparse(nowstamp) / SID
  const mark = "&#10004;"
  let db = br.dueby(road, gol, 7)
  
  dbbody
    .selectAll(".dbrow")
    .selectAll(".dbcell")
    .data((row, i) => {const inf = duebylabel(i,nowday), del = db[i][1]; return [inf, [(del > 0 || gol.dir < 0)?bu.shn(del):mark,inf[1]], [bu.shn(db[i][2]),inf[1]]]})
    .join(enter=>enter.append("span").attr('class', 'dbcell'), update=>update)
    .html(d=>d[0])
    .style('color', d=>d[1])
}

/** Creates all road matrix table components if a table DIV is provided. Called
 * once when the bgraph object is created. */
function createTable() {
  const div = opts.divTable
  if (div === null) return
  // First, remove all children from the div
  while (div.firstChild) {
    div.removeChild(div.firstChild)
  }
  const divelt = d3.select(div)
  const startelt = divelt.append("div").attr("class", "rtbstart")
  const bodyelt  = divelt.append("div").attr("class", "rtbmain")
  const goalelt  = divelt.append("div").attr("class", "rtbgoal")
  if (opts.tableHeight != 0) {
    bodyelt.style("max-height", opts.tableHeight+"px")
           .style("overflow-y", "auto")
  }
  const table = bodyelt.append("div").attr("class", "rtable")
  // This element is used to hold the Pikaday instance
  table.append("div").attr("id", "dpfloat").attr("class", "floating")
  // This helps figure out layout coords of the scrolled window top left
  topLeft = table.append("div").attr("id", "topleft")
    .style("position", "absolute").style("left", 0).style("top",0)
    .style("width", "1px").style("height", "1px")
    .attr("visibility","hidden")
  if (opts.reverseTable) {
    createGoalTable()
    createRoadTable()
    createStartTable()
  } else {
    createStartTable()
    createRoadTable()  
    createGoalTable()
  }
}

function roadChanged() {

  // If it were the case that tini was simply the first entry in the
  // road, update it for the edited road
  if (igoal.tini == iroad[0].end[0]) {
    gol.tini = road[0].end[0]
    gol.vini = road[0].end[1]
  }
  
  if (!settingRoad)
    // Explicitly set the road object for beebrain to force it to recompute
    // goal parameters
    bbr.setRoadObj(road)
  
  computePlotLimits(true)
  horindex = br.findSeg(road, gol.horizon)
  reloadBrush()
  updateRoadData()
  updateGraphData(true)
  updateContextData()
  updateTable()
  updateDueBy()
  if (typeof opts.onRoadChange === 'function') opts.onRoadChange.call()
}

// ---------------------------- Text Box Utilities -----------------------------

function createTextBox(x, y, text, col, textr=null) {
  let textobj = {}
  if (y < 20-plotpad.top)    y = 20 -plotpad.top
  if (y > plotbox.height-15) y = plotbox.height-15
  textobj.grp = focus.append('g')
  textobj.rect = textobj.grp.append('svg:rect')
    .attr('pointer-events', "none")
    .attr('fill',   opts.textBoxCol.bg)
    .style('stroke', col)
  textobj.text = textobj.grp.append('svg:text').attr('pointer-events', "none")
                                               .attr('text-anchor', 'middle')
  if (textr == null) {
    textobj.text.text(text).attr('class', 'svgtxt')
  } else {
    textobj.text.append("tspan").attr("x", 0).attr("dy", "0.6em")
                                .text(text).attr('class', 'svgtxt')
    for (let i = 0; i < textr.length; i++) {
      textobj.text.append("tspan").attr("dy", "1.2em")
        .attr("x", 0).text(textr[i])
        .attr("font-size", "0.7em")
    }
  }
  const bbox = textobj.text.node().getBBox()
  const margin = opts.textBox.margin
  textobj.rect.attr('x',      bbox.x - margin)
              .attr('y',      bbox.y - margin)
              .attr('width',  bbox.width + margin*2)
              .attr('height', bbox.height+ margin*2)

  if (x < bbox.width/2)               x = bbox.width/2
  if (x > plotbox.width-bbox.width/2) x = plotbox.width - bbox.width/2

  textobj.grp.attr('transform', 'translate('+(x+plotpad.left)+","
                                            +(y+plotpad.top)+")")
  return textobj
}

function updateTextBox( obj, x, y, text ) {
  if (!obj) {console.debug("updateTextBox: null input"); return }
  if (y < 20-plotpad.top)    y = 20 - plotpad.top
  if (y > plotbox.height-15) y = plotbox.height - 15
  obj.text.text(text)
  const bbox = obj.text.node().getBBox()
  const margin = opts.textBox.margin
  obj.rect.attr('x', bbox.x-margin)
          .attr('y', bbox.y-margin)
          .attr('width',  bbox.width +margin*2)
          .attr('height', bbox.height+margin*2)

  if (x < bbox.width/2)               x = bbox.width/2
  if (x > plotbox.width-bbox.width/2) x =plotbox.width - bbox.width/2
  obj.grp.attr('transform', 'translate('+(x+plotpad.left)+","
                                        +(y+plotpad.top)+")")
}

function rmTextBox( obj ) {
  if (!obj) { console.debug("updateTextBox: null input"); return }
  obj.grp.remove()
}

function hideTextBox( obj, hide ) {
  if (!obj) { console.debug("updateTextBox: null input"); return }
  obj.grp.attr("visibility", hide ? "hidden" : "visible")
}


// ----------------- Zoom and brush  related private functions -----------------

let ticks, tickType = 1, majorSkip = 7
/** Compute locations and labels for x-axis ticks corresponding to the entire
 * graph range for different zoom levels. These are stored in the "ticks"
 * member of the bgraph instance. Used later by the 
 * {@link bgraph~redrawXTicks redrawXTicks()} function for rendering. */
function computeXTicks() {
  const xr = xSc.domain()

  // The following make sure that the initial element of the tick values array
  // is at the proper boundary (day, month, year) depending on the tick types.
  const xt  = xr.map(e => e.getTime()/SMS)
  const xtm = xt.slice(); xtm[0] = bu.monthsnap(xtm[0])
  const xty = xt.slice(); xty[0] = bu.yearsnap(xty[0])
  const xrm = xtm.map(e => (new Date(e*SMS)))
  const xry = xty.map(e => (new Date(e*SMS)))

  // [0]: tick dates, [1]: tick text,
  ticks = []
  ticks.push([d3.utcDay .range(xr[0],   xr[1], 1),"%b %d"])
  ticks.push([d3.utcDay .range(xr[0],   xr[1], 2),"%b %d"])
  ticks.push([d3.utcWeek.range(xrm[0], xrm[1], 1),"%b %d"])
  ticks.push([d3.utcWeek.range(xrm[0], xrm[1], 2),"%b %d"])
  ticks.push([d3.utcMonth.every(1).range(xry[0], xry[1]),"%b %Y"])
  ticks.push([d3.utcMonth.every(2).range(xry[0], xry[1]),"%b %Y"])
  ticks.push([d3.utcMonth.every(3).range(xry[0], xry[1]),"%Y"])
  ticks.push([d3.utcYear .every(1).range(xry[0], xry[1]),"%Y"])
}

/** Redraw x-axis tick marks based on current x-axis range for the focus graph,
 * making "smart" decisions on what type of ticks to use. Tick mark types are
 * precomputed and stored in the "ticks" member by the 
 * {@link bgraph~computeXTicks computeXTicks()} function. */
function redrawXTicks() {
  //console.debug("redrawXTicks()");
  const xr = [nXSc.invert(0).getTime(), 
            nXSc.invert(plotbox.width).getTime()]

  const diff = ((xr[1] - xr[0])/(SMS*SID))
  // Adjust tick mark separation if the graph is too small
  if (opts.focusRect.width < 500) diff = diff*1.6
  else if (opts.focusRect.width < 550) diff = diff*1.4
  else if (opts.focusRect.width < 600) diff = diff*1.2
  // * tickType identifies the separation and text of ticks
  // * majorSkip is the number of ticks to skip for the annotated
  // "major" ticks. Remaining ticks are drawn as unlabeled small
  // indicators
  if (diff < 10)           { tickType = 0; majorSkip = 1 }
  else if (diff < 20)      { tickType = 0; majorSkip = 2 }
  else if (diff < 45)      { tickType = 0; majorSkip = 7 }
  else if (diff < 120)     { tickType = 1; majorSkip = 7 }
  else if (diff < 240)     { tickType = 2; majorSkip = 4 }
  else if (diff < 320)     { tickType = 4; majorSkip = 1 }
  else if (diff < 1.5*365) { tickType = 4; majorSkip = 2 } 
  else if (diff < 2.6*365) { tickType = 4; majorSkip = 3 } 
  else if (diff < 5*365)   { tickType = 5; majorSkip = 3 } 
  else if (diff < 10*365)  { tickType = 6; majorSkip = 4 } 
  else                     { tickType = 7; majorSkip = 1 }
  // Invisible ticks to the left of the graph
  const pt = ticks[tickType][0].filter((d)=>((d.getTime()<xr[0])))
  // Number of minor ticks in the partially visible 1st major tick interval
  const ind = (majorSkip - pt.length%majorSkip)%majorSkip
  // Filter tick values based on x axis range
  const tv = ticks[tickType][0].filter(
    (d)=>((d.getTime()>=xr[0]&&d.getTime()<=xr[1])))
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

  // Shift bottom tick marks upwards to ensure they point inwards
  xAxisObj.selectAll("g").selectAll(".tick line")
    .attr("transform", "translate(0,-5)")
  
  // Repeat the above process for the top X axis
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
    .classed("minor", true)
  
  // Shift top tick marks downwards to ensure they point inwards
  xAxisObjT.selectAll("g").selectAll(".tick line")
    .attr("transform", "translate(0,6)")
}

/** Check the widths of y-axis labels and tick marks, resizing the graph
 * components if necessary */
function handleYAxisWidth() {
  //console.debug("curid="+curid+", hidden="+hidden)

  // Checking for the "hidden" state ensures that getBBox() is not
  // called for invisible components in the DOM.
  if (opts.divGraph != null && !hidden) {
    yAxisLabel.text(gol.yaxis)
    if (gol.hidey && !opts.roadEditor) {
      //yAxisObj.selectAll( "text").remove()
      //yAxisObjR.selectAll("text").remove()
      yAxisObj.selectAll( "text").attr('display', 'none')
      yAxisObjR.selectAll("text").attr('display', 'none')
    } else {
      yAxisObj.selectAll( "text").attr('display', null)
      yAxisObjR.selectAll("text").attr('display', null)
    }
    
    const bbox = yAxisObj.node().getBBox()
    // Adjust the graph size and axes if the y axis tick
    // width has changed by a nontrivial amount. This
    // causes a bit jumpy behavior when dragging the brush
    // across the boundary of width change, but that seems
    // to not be too bad a problem.
    if (abs(bbox.width-yaxisw) > 5) {
      yaxisw = floor(bbox.width)
      resizeGraph()
    }
  }
}

/** Adjust scale and range for y-axis based on current range of the y-axis. The
 * y-axis range depends on the graph configuration, including whether it's a
 * headless graph for a screenshot, an interactive graph, or the editor. */
function adjustYScale() {
  const  xrange = [nXSc.invert(0), 
                nXSc.invert(plotbox.width)]
  let yrange
  if (opts.headless) {
    // Headless graphs should match previous pybrain range
    const va = gol.vmin  - PRAF*(gol.vmax-gol.vmin)
    const vb = gol.vmax  + PRAF*(gol.vmax-gol.vmin)
    yrange = [vb, va]
  } else {
    const margin = abs(PRAF*(gol.vmax-gol.vmin))

    // Compute range in unixtime
    const xtimes = xrange.map(d => floor(d.getTime()/SMS))
    // Compute Y axis extent of the edited road in range
    const re = roadExtentPartial(road,xtimes[0],xtimes[1],false)
    re.yMin -= margin
    re.yMax += margin
    let ae
    if (opts.roadEditor) {
      // Compute Y axis extent of the initial road in range
      const ore = roadExtentPartial(iroad,xtimes[0],xtimes[1],false)
      ore.yMin -= margin
      ore.yMax += margin
      ae = mergeExtents(re, ore)
    } else ae = re
    
    // Compute Y axis extent of datapoints in range
    const de = dataExtentPartial((gol.plotall&&!opts.roadEditor)
                                ? alldata : data,
                                xtimes[0],xtimes[1],false)
    if (de != null) ae = mergeExtents(ae, de)
    const p
          = (opts.roadEditor)?{xmin:0.0,xmax:0.0,ymin:0.05,ymax:0.05}:{xmin:0.0,xmax:0.0,ymin:0.02,ymax:0.02}
    enlargeExtent(ae, p)
    if ((ae.yMax - ae.yMin) < 2*margin) {
      ae.yMax += margin
      ae.yMin -= margin
    }
    yrange = [ae.yMax, ae.yMin]
  }
  // Modify the scale object for the entire Y range to focus on
  // the desired range
  const newtr = d3.zoomIdentity
        .scale(plotbox.height/(ySc(yrange[1])-ySc(yrange[0])))
        .translate(0, -ySc(yrange[0]))
  nYSc = newtr.rescaleY(ySc)
  yAxisObj.call(yAxis.scale(nYSc))
  yAxisObjR.call(yAxisR.scale(nYSc))

  // Resize brush if dynamic y limits are beyond graph limits
  if (yrange[0] > gol.yMax) gol.yMax = yrange[0]
  if (yrange[1] < gol.yMin) gol.yMin = yrange[1]
  resizeContext()

  // Rescale the focus rectange to show area being focused.
  const sx = xrange.map( x => xScB(x))
  const sy = yrange.map( y => yScB(y))
  focusrect
    .attr("x", sx[0]+1).attr("width",  max(0, sx[1]-sx[0]-2))
    .attr("y", sy[0]+1).attr("height", max(0, sy[1]-sy[0]-2))
}

/** Update context graph X and Y axis scales to consider newest graph ranges */
function resizeContext() {
  if (opts.divGraph == null) return
  xScB.domain([new Date(min(gol.tmin, gol.xMin)*SMS), 
               new Date(max(gol.tmax, gol.xMax)*SMS)])
  xAxisObjB.call(xAxisB.scale(xScB))
  yScB.domain([gol.yMin, gol.yMax])
}

/** Update brush rectangle and brush box in the context graph to cover the
 * updated X range */
function resizeBrush() {
  if (opts.divGraph == null) return
  const limits = [xScB(nXSc.invert(0)), 
                xScB(nXSc.invert(plotbox.width))]
  //console.debug("limits: "+limits);
  if (limits[0] < 0) limits[0] = 0
  if (limits[1] > brushbox.width) limits[1] = brushbox.width
  brush.call(brushObj.move, limits)
}

/** Update context graph by recomputing its limits & resizing the brush in it */
function reloadBrush() { resizeContext(); resizeBrush() }

/** Gets called by d3.zoom when there has been a zoom event
 * associated with the focus graph */
function zoomed() {
  //console.debug("id="+curid+", zoomed()")
  //console.trace()
  if (road.length == 0) return
  // Prevent recursive calls if this was initiated by a brush motion, resulting
  // in an updated zoom in the focus graph
  if (d3.event && d3.event.sourceEvent 
               && d3.event.sourceEvent.type === "brush") return

  // Inject the current transform into the plot element
  const tr = d3.zoomTransform(zoomarea.node())
  if (tr == null) return
  
  nXSc = tr.rescaleX(xSc)
  redrawXTicks()
  adjustYScale()
  // Shift Y axis tick marks to make them point inwards
  yAxisObj.selectAll("g").selectAll(".tick line")
    .attr("transform", "translate(6,0)")
  yAxisObjR.selectAll("g").selectAll(".tick line")
    .attr("transform", "translate(-5,0)")
  handleYAxisWidth()

  resizeBrush()
  updateGraphData()
  return
}

/** Called by d3.brush whenever user modifies the brush on the context graph */
function brushed() {
  //console.debug("id="+curid+", brushed()")
  //console.trace()
  if (road.length == 0) return
  // Prevent recursive calls in case the change in the brush was triggered by a
  // zoom event
  if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return
  const s = d3.event.selection || xScB.range()
  
  nXSc.domain(s.map(xScB.invert, xScB))
  redrawXTicks()
  adjustYScale()
  handleYAxisWidth()
  
  zoomarea.call(axisZoom.transform, d3.zoomIdentity
                .scale(brushbox.width / (s[1] - s[0]))
                .translate(-s[0], 0))
  updateGraphData()
}

/** Update both the context and focus graphs to include default zoom range */
function zoomDefault() {
  if (opts.divGraph == null) return
  //console.debug("id="+curid+", zoomDefault()")
  const ta = gol.tmin - PRAF*(gol.tmax-gol.tmin)
  const tb = gol.tmax + PRAF*(gol.tmax-gol.tmin)
  const newdom = [new Date(ta*SMS),new Date(tb*SMS)]
  nXSc.domain(newdom)
  const s = newdom.map(xScB)
  //console.debug(s)
  redrawXTicks()
  adjustYScale()
  zoomarea.call(axisZoom.transform, d3.zoomIdentity
                .scale(brushbox.width / (s[1] - s[0]))
                .translate(-s[0], 0))
}

/** Update both the context and focus graphs to zoom out, including the entire
 * graph range */
function zoomAll( ) {
  //console.debug("id="+curid+", zoomAll()")
  if (opts.divGraph == null) return
  computePlotLimits(false)
  // Redefine the unzoomed X and Y scales in case graph range was redefined
  xSc.domain([new Date(min(gol.tmin, gol.xMin)*SMS), 
              new Date(max(gol.tmax, gol.xMax)*SMS)])
  computeXTicks()
  ySc.domain([gol.yMin, gol.yMax])
  nXSc = xSc
  nYSc = ySc
  resizeContext()
  zoomarea.call(axisZoom.transform, d3.zoomIdentity)
  // Relocate zoom buttons based on road yaw
  if (gol.dir > 0) {
    zoomin.attr( "transform", zoombtntr.botin)
    zoomout.attr("transform", zoombtntr.botout)
  } else {
    zoomin.attr( "transform", zoombtntr.topin)
    zoomout.attr("transform", zoombtntr.topout)
  }
  reloadBrush()
}

// -------------------------- Undo/Redo functionality --------------------------

function clearUndoBuffer() {
  //console.debug("clearUndoBuffer()")
  undoBuffer = []
  redoBuffer = []
}

function redoLastEdit() {
  //console.debug("redoLastEdit: UndoBuffer has "+undoBuffer.length+" entries")
  if (redoBuffer.length == 0) return
  pushUndoState(true)
  road = redoBuffer.pop()
  roadChanged()
  return
}

function undoLastEdit() {
  //console.debug("undoLastEdit: UndoBuffer has "+undoBuffer.length+" entries")
  if (undoBuffer.length == 0) return
  if (undoBuffer.length == 0 || 
      !br.sameRoads(undoBuffer[undoBuffer.length-1], road)) {
    redoBuffer.push(road)
  }
  road = undoBuffer.pop()
  bbr.setRoadObj(road) // Since popped version is a copy, must inform beebrain
  roadChanged()
  return
}

function pushUndoState(fromredo = false) {
  //console.debug("pushUndoState: UndoBuffer has "+undoBuffer.length+" entries")
  if (undoBuffer.length == 0 || 
      !br.sameRoads(undoBuffer[undoBuffer.length-1], road)) {
    undoBuffer.push(br.copyRoad(road))
    if (!fromredo) { redoBuffer = [] }
  }
}

// Determine whether given road is valid (ie, clear of the pinkzone)
// TODO: Must rethink this check, probably a general segment intersection
// algorithm will be best
function isRoadValid(rd) {
  const ir = iroad
  const EPS = 0.000001 // dang floating point comparisons
  
  const now = gol.asof
  const hor = gol.horizon
  // Check left/right boundaries of the pinkzone. This should handle the case
  // when there are no kinks within the horizon.
  if (gol.yaw*br.rdf(rd, now) < gol.yaw*br.rdf(ir, now) - EPS) return false
  if (gol.yaw*br.rdf(rd, hor) < gol.yaw*br.rdf(ir, hor) - EPS) return false
  // Iterate through and check current road points in the pink range
  const rd_i1 = br.findSeg(rd, now) // was dir=-1 but don't think it matters
  const rd_i2 = br.findSeg(rd, hor) // was dir=+1 but don't think it matters
  for (let i = rd_i1; i < rd_i2; i++) {
    if (gol.yaw*br.rdf(rd, rd[i].end[0]) < 
        gol.yaw*br.rdf(ir, rd[i].end[0]) - EPS) return false
  }
  // Iterate through and check old road points in the pink range
  const ir_i1 = br.findSeg(ir, now) // was dir=-1 but don't think it matters
  const ir_i2 = br.findSeg(ir, hor) // was dir=+1 but don't think it matters
  for (let i = ir_i1; i < ir_i2; i++) {
    if (gol.yaw*br.rdf(rd, ir[i].end[0]) < 
        gol.yaw*br.rdf(ir, ir[i].end[0]) - EPS) return false
  }
  return true
}


function mergeExtents(ext1, ext2) {
  let ne = {}
  ne.xMin = min(ext1.xMin, ext2.xMin)
  ne.xMax = max(ext1.xMax, ext2.xMax)
  ne.yMin = min(ext1.yMin, ext2.yMin)
  ne.yMax = max(ext1.yMax, ext2.yMax)
  return ne
}

function enlargeExtent(extent, p) {
  let xdiff = extent.xMax - extent.xMin
  if (xdiff < 1e-7) xdiff = 1e-7
  let ydiff = extent.yMax - extent.yMin
  if (ydiff < 1e-7) ydiff = 1e-7

  extent.xMin = extent.xMin - p.xmin*xdiff
  extent.xMax = extent.xMax + p.xmax*xdiff
  extent.yMin = extent.yMin - p.ymin*ydiff
  extent.yMax = extent.yMax + p.ymax*ydiff
}

function roadExtent(rd, extend = true) {
  let extent = {}
  // Compute new limits for the current data
  extent.xMin = bu.arrMin(rd.map(d=>d.end[0]))
  extent.xMax = bu.arrMax(rd.map(d=>d.sta[0]))
  extent.yMin = bu.arrMin(rd.map(d=>d.sta[1]))
  extent.yMax = bu.arrMax(rd.map(d=>d.sta[1]))
  // Extend limits by 5% so everything is visible
  const p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10}
  if (extend) enlargeExtent(extent, p)
  return extent
}

function dataExtentPartial(data, xmin, xmax, extend = false) {
  let extent = {}
  let nd = data.filter(d => (d[0] > xmin && d[0] < xmax))
  if (nd.length == 0) {
    // no points are in range, find enclosing two
    let ind = -1
    for (let i = 0; i < data.length-1; i++) {
      if (data[i][0]<=xmin && data[i+1][0]>=xmax) { ind = i; break }
    }
    if (ind > 0) nd = data.slice(ind, ind+1)
  }
  // Inform caller if no data points are in between the supplied range.
  if (nd.length == 0) return null

  // Compute new limits for the current data
  extent.xMin = bu.arrMin(nd.map(d=>d[0]))
  extent.xMax = bu.arrMax(nd.map(d=>d[0]))
  extent.yMin = bu.arrMin(nd.map(d=>d[1]))
  extent.yMax = bu.arrMax(nd.map(d=>d[1]))     
  if (bbr.flad != null && bbr.flad[0] <= xmax && bbr.flad[0] >= xmin) {
    const pprv = bbr.flad[1] + br.ppr(road, gol, gol.asof)
    extent.yMin = min(extent.yMin, pprv) // Make room for the
    extent.yMax = max(extent.yMax, pprv) // ghosty PPR datapoint.
  }
  // Extend limits by 5% so everything is visible
  const p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10}
  if (extend) enlargeExtent(extent, p)
  return extent
}

function roadExtentPartial( rd, xmin, xmax, extend = false ) {
  let extent = {}
  // Compute new limits for the current data
  extent.xMin = xmin
  extent.xMax = xmax
  extent.yMin = bu.arrMin(rd.map(function(d) { 
    return (d.sta[0]<xmin||d.sta[0]>xmax)?Infinity:d.sta[1] }))
  extent.yMax = bu.arrMax(rd.map(function(d) { 
    return (d.sta[0]<xmin||d.sta[0]>xmax)?-Infinity:d.sta[1] }))
  extent.yMin = bu.arrMin([extent.yMin, br.rdf(rd,xmin), br.rdf(rd,xmax)])
  extent.yMax = bu.arrMax([extent.yMax, br.rdf(rd,xmin), br.rdf(rd,xmax)])
  // Extend limits by 5% so everything is visible
  const p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10}
  if (extend) enlargeExtent(extent, p)
  return extent
}

// Convert deadline value (seconds from midnight) to time-of-day like "3am"
function deadtod(ds) {
  return moment.unix(ds).utc().format("h:mma").replace(":00","")
}

// Convert tluz to the day of the week (eg, "Wed") of the eep day
function deaddow(t) {
  return moment.unix(t).utc().format("ddd")
}

// Set watermark (waterbuf) to number of safe days if not given explicitly
function setWatermark() {
  if (gol.waterbuf0 != null) return
  
  gol.safebuf = br.dtd(road, gol, gol.tcur, gol.vcur)
  gol.tluz = gol.tcur+gol.safebuf*SID
  if (gol.tfin < gol.tluz) gol.tluz = bu.BDUSK
  gol.loser = br.redyest(road, gol, gol.tcur) // TODO: needs iso here

  if  (gol.asof >= gol.tfin && !gol.loser) {
    gol.waterbuf = ":)"
    return
  }

  if      (gol.safebuf > 999) { gol.waterbuf = "inf" } 
  else if (gol.safebuf >= 7)  { gol.waterbuf = gol.safebuf+"d" } 
  else if (gol.safebuf <= 0)  { gol.waterbuf = deadtod(gol.deadline)+"!" }
  else                        { gol.waterbuf = deaddow(gol.tluz) }
}

function computePlotLimits(adjustZoom = true) {
  if (road.length == 0) return

  const now = gol.asof
  const maxx = bu.daysnap(min(now+opts.maxFutureDays*SID, 
                                 road[road.length-1].sta[0]))
  const cur = roadExtentPartial(road, road[0].end[0], maxx, false)
  let ne
  if (opts.roadEditor) {
    let old = roadExtentPartial(iroad,road[0].end[0],maxx,false)
    ne = mergeExtents(cur, old)
  } else ne = cur

  const d = dataExtentPartial(gol.plotall&&!opts.roadEditor ? alldata : data, 
                            road[0].end[0], data[data.length-1][0], false)

  if (d != null) ne = mergeExtents(ne, d)
  if (bbr.fuda.length != 0) {
    const df = dataExtentPartial(bbr.fuda, road[0].end[0], maxx, false)
    if (df != null) ne = mergeExtents(ne, df)
  }
  const p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10}
  if (!opts.roadEditor) {
    // The editor needs more of the time range visible for editing purposes
    p.xmin = 0.02
    p.xmax = 0.02
  }
  enlargeExtent(ne, p)

  gol.xMin = bu.daysnap(ne.xMin)
  gol.xMax = bu.daysnap(ne.xMax)
  gol.yMin = ne.yMin
  gol.yMax = ne.yMax

  if (adjustZoom && opts.divGraph != null) {
    const xrange = [nXSc.invert(0), 
                  nXSc.invert(plotbox.width)]
    const yrange = [nYSc.invert(0), 
                  nYSc.invert(plotbox.height)]
    xSc.domain([new Date(min(gol.tmin, gol.xMin)*SMS), 
                new Date(max(gol.tmax, gol.xMax)*SMS)])
    computeXTicks()
    ySc.domain([gol.yMin, gol.yMax])
    const newtr = d3.zoomIdentity.scale(plotbox.width/(xSc(xrange[1]) 
                                                   - xSc(xrange[0])))
        .translate(-xSc(xrange[0]), 0)
    zoomarea.call(axisZoom.transform, newtr)
  }
}

// Function to generate samples for the Butterworth filter
function griddlefilt(a, b) {
  return bu.linspace(a, b, floor(bu.clip((b-a)/(SID+1), 40, 2000)))
}

// Function to generate samples for the Butterworth filter
function griddle(a, b, maxcnt = 6000) {
  return bu.linspace(a, b, floor(bu.clip((b-a)/(SID+1), 
                                      min(300, plotbox.width/8),
                                      maxcnt)))
}

const stats_timeid = `bgraph(${curid}): Goal stats`
const graph_timeid = `bgraph(${curid}): Goal graph`
// Recreates the road array from the "rawknots" array, which includes only
// timestamp,value pairs

/**Load goal details from the supplied JSON input and populate the graph and
   road matrix table with necessary components based on initially supplied
   options.
   @param {Object} json JSON object with the contents of a BB file, directly fed
   to a {@link beebrain} object instance. */
function loadGoal(json, timing = true) {
  //console.debug("id="+curid+", loadGoal()->"+json.params.yoog)
  if (!('params' in json) || !('data' in json)) {
    throw new Error("loadGoal: JSON input lacks params or data")
  }
  clearUndoBuffer()

  // Disable various graph component updates until graph axes are in
  // their final state and ranges
  processing = true
  
  // Create beebrain processor
  let suffix = (json.params.yoog) ? " ("+json.params.yoog+")" : ""
  if (timing) { console.time(stats_timeid+suffix) }
  bbr = new bb(json)
  gol = bbr.gol
  if (opts.divJSON) {
    if (opts.headless)
      opts.divJSON.innerText = JSON.stringify(bbr.getStats())
    else
      opts.divJSON.innerText = JSON.stringify(bbr.getStats(), null, 4)
  }
  if (timing) { console.timeEnd(stats_timeid+suffix) }

  if (gol.error != "") {
    console.log("Beebrain error: "+ bbr.gol.error)
    lastError = ErrType.BBERROR
    const errors = bbr.gol.error.split("\\n")
    showOverlay( 
      (["The following errors prevented us from generating "+bbr.gol.yoog,
        "(We've pinged Beeminder support to come help fix things up here!)",
        ""]).concat(errors), sh/30, null)
    resetGoal()
    processing = false
    return
  }

  if (opts.noGraph) {
    showOverlay( (["Beebrain was called with 'NOGRAPH_*' as the slug",
                   "so no graph or thumbnail was generated, just this",
                   "static placeholder!"]), sh/30, null)
    resetGoal()
    processing = false
    return
  }
  
  road    = bbr.roads
  iroad   = br.copyRoad(road)
  data    = bbr.data
  rawdata = bu.deepcopy(json.data)
  igoal   = bu.deepcopy(gol)
  alldata = bbr.alldata

  // Extract limited data
  if (opts.maxDataDays < 0) {
    dataf = data.slice()
    alldataf = alldata.slice()
  } else {
    dataf = data.filter(function(e){
      return e[0]>(gol.asof-opts.maxDataDays*SID)})
    alldataf = alldata.filter(function(e){
      return e[0]>(gol.asof-opts.maxDataDays*SID)})
  }

  if (opts.divGraph) {
    if (!opts.roadEditor && gol.stathead)
      stathead.text(gol.graphsum)
    else
      stathead.text("")
  }
  if (timing) { console.time(graph_timeid+suffix) }
  
  // Finally, wrap up with graph related initialization
  updateRoadData()
  zoomAll()
  zoomDefault()

  // Re-enable updates for graph components. Next call to resizeGraph will
  // redraw all of these components
  processing = false

  updateTable()
  updateDueBy()
  resetDataTable()

  updateContextData()

  // This next call ensures that stathead and other new graph
  // properties are properly reflected in the new graph dimensions
  resizeGraph()
    
  updateTableTitles()
  if (typeof opts.onRoadChange === 'function') opts.onRoadChange.call()
  if (timing) { console.timeEnd(graph_timeid+suffix) }
}

async function loadGoalFromURL( url, callback = null ) {
  //console.debug( "loadGoalFromURL: Loading: "+url );
  if (url == "" || loading) return
  loading = true
  if (!opts.headless) showOverlay( ["loading..."], sh/10 )
  const resp = await bu.loadJSON( url )
  if (resp != null) {
    if (!opts.headless) removeOverlay()
    if ('errstring' in resp) {
      throw new Error("loadGoalFromURL: BB file has errors: "+resp.errstring)
    }
    loadGoal( resp )
  } else {
    if (lastError != null) showOverlay( [ErrMsgs[lastError]])
    else showOverlay(["Could not load goal file."])
    if (!opts.headless) setTimeout(removeOverlay, 1500)
    if (typeof opts.onError === 'function') {
      opts.onError.call()
    }
  } 
  loading = false
}

function setSafeDays( days ) {
  if (road.length == 0) {
    console.log("bgraph("+curid+"):setSafeDays(), road is empty!")
    return
  }
  //console.debug("setSafeDays()");
  let curdtd = br.dtd(road, gol, gol.tcur, gol.vcur)
  const now = gol.asof
  if (days < 0) days = 0
  // Look into the future to see the road value to ratchet to
  const daydiff = curdtd - (days - 1) - 1
  if (daydiff <= 0) return
  const futureDate = gol.asof + daydiff*SID
  const ratchetValue = br.rdf(road, futureDate)

  // Find or add two new dots at asof
  // We only allow the first step to record undo info.
  let first = -1, i
  for (i = 1; i < road.length; i++) {
    if (road[i].sta[0] === now) {
      first = i-1; break
    }
  }
  let added = false;
  if (first < 0) {addNewDot(now);added = true}
  let second
  if (i+1 < road.length && road[i+1].sta[0] === now)
    second = i
  else {
    second = addNewDot(now, ratchetValue)
    if (added) {undoBuffer.pop(); added = true}
  }
  //changeDotValue( second, ratchetValue, false )
  //if (added) { undoBuffer.pop(); added = true }

  roadChanged()
}

// Add a new dot to the supplied x value, with the y value either explicitly
// specified or computed from the corresponding y value.
function addNewDot(x, y = null) {
  let found = br.findSeg(road, x)
  if (found >= 0) {
    let s = {}
    let newx = bu.daysnap(x+SID/2)
    let newy = y
    if (y == null) {
      newy = road[found].sta[1] + road[found].slope*(newx - road[found].sta[0])
    }
    pushUndoState()
    s.sta = [newx, newy]
    if (found == 0) {
      // First segment splitted
      s.end = road[found+1].sta.slice()
      if (y != null) {
        s.end[1] = s.sta[1] + road[found].slope*(s.end[0]-newx)
      }
      road[found].end = [newx, newy]
    } else {
      if (found == road.length-1) {
        // Last segment splitted
        s.end = road[found].end.slice()
        s.end[1] = newy
      } else {
        s.end = road[found+1].sta.slice()
        if (y != null && opts.keepSlopes) {
          s.end[1] = s.sta[1] + road[found].slope*(s.end[0]-newx)
        }
      }
      road[found].end = [newx, newy];
      road[found].slope = br.segSlope(road[found]);
      // If the adjusted segment is vertical, switch its auto field to SLOPE
      if (road[found].sta[0] == road[found].end[0])
        road[found].auto = br.RP.SLOPE
    }
    s.slope = br.segSlope(s)
    s.auto  = br.RP.VALUE
    road.splice(found+1, 0, s)
    br.fixRoadArray(road, opts.keepSlopes ? br.RP.VALUE : br.RP.SLOPE, false)
    roadChanged()
    let elt = d3.select(opts.divTable).select(".roadrow [name=endvalue"+(found+1)+"]")
    if (!elt.empty()) autoScroll(elt, false)
  }
  return found;
}

function addNewKnot(kind) {
  if (kind < road.length-1) {
    let newt = (road[kind].sta[0] + road[kind+1].sta[0])/2
    if (newt - road[kind].sta[0] > 30*SID) newt = road[kind].sta[0]+30*SID
    addNewDot(newt)
  } else {
    addNewDot(road[kind].sta[0] + 7*SID)
  }
}

function removeKnot(kind, fromtable) {
  pushUndoState()

  const oldslope = road[kind].slope
  road.splice(kind, 1)
  if (opts.keepSlopes && !isNaN(oldslope)) road[kind].slope = oldslope
  br.fixRoadArray(road, opts.keepSlopes ? br.RP.VALUE : br.RP.SLOPE, fromtable)

  roadChanged()
}

// ---------------------- Drag related utility functions -----------------------

let knottext = null, dottext = null, slopetext = null

function createDragInfo(pt, slope = undefined) {
  let ptx = nXSc(bu.daysnap(pt[0])*SMS)
  let pty = pt[1]
  knotdate = moment.unix(pt[0]).utc()
  knottext = createTextBox(ptx, plotbox.height-15, 
                           knotdate.format('YYYY-MM-DD')
                           + " ("+knotdate.format("ddd")+")",
                           opts.textBoxCol.stroke)
  dottext = createTextBox(ptx, nYSc(pty)-15, 
                          bu.shn(pt[1]), opts.textBoxCol.stroke)
  if (slope != undefined) {
    const slopex = nXSc(bu.daysnap(slope[0])*SMS)
    const slopey = nYSc(slope[1])
    slopetext = createTextBox(slopex,slopey, 
                              "s:"+bu.shn(slope[2]),
                              opts.textBoxCol.stroke)
    if (ptx - slopex < 50) hideTextBox(slopetext, true)
  }
}
function updateDragInfo(pt, slope) {
  const ptx = bu.daysnap(pt[0])
  const pty = pt[1]
  knotdate = moment.unix(ptx).utc()
  updateTextBox(knottext, nXSc(ptx*SMS), plotbox.height-15, 
                knotdate.format('YYYY-MM-DD') + " ("+knotdate.format("ddd")+")")
  updateTextBox(dottext, nXSc(ptx*SMS), nYSc(pty)-15, bu.shn(pt[1]))
  if (slope != undefined) {
    const slopex = bu.daysnap(slope[0])
    const slopey = slope[1]
    updateTextBox(slopetext, nXSc(slopex*SMS), nYSc(slopey), 
                  "s:"+bu.shn(slope[2]))
  }
}
function removeDragInfo( ) {
  if (knottext != null) rmTextBox(knottext)
  knottext = null
  if (dottext != null) rmTextBox(dottext)
  dottext = null
  if (slopetext != null) rmTextBox(slopetext)
  slopetext = null
}

function updateDragPositions(kind, updateKnots) {
  const rd = road
  const el = d3.select(opts.divGraph)
  for (let ii = kind; ii < rd.length; ii++) {
    el.select("[name=dot"    +ii+"]").attr("cx", r1(nXSc(rd[ii].end[0]*SMS)))
                                     .attr("cy", r1(nYSc(rd[ii].end[1])))
    el.select("[name=ctxdot" +ii+"]").attr("cx", r1(xScB(rd[ii].end[0]*SMS)))
                                     .attr("cy", r1(yScB(rd[ii].end[1])))
    el.select("[name=road"   +ii+"]").attr("x1", r1(nXSc(rd[ii].sta[0]*SMS)))
                                     .attr("y1", r1(nYSc(rd[ii].sta[1])))
                                     .attr("x2", r1(nXSc(rd[ii].end[0]*SMS)))
                                     .attr("y2", r1(nYSc(rd[ii].end[1])))
    el.select("[name=ctxroad"+ii+"]").attr("x1", r1(xScB(rd[ii].sta[0]*SMS)))
                                     .attr("y1", r1(yScB(rd[ii].sta[1])))
                                     .attr("x2", r1(xScB(rd[ii].end[0]*SMS)))
                                     .attr("y2", r1(yScB(rd[ii].end[1])))
    if (updateKnots) {
      el.select("[name=knot" +ii+"]").attr("x1", r1(nXSc(rd[ii].end[0]*SMS)))
                                     .attr("x2", r1(nXSc(rd[ii].end[0]*SMS)))
      el.select("[name=remove"+ii+"]")
        .attr("transform", 
              d => ("translate("+(nXSc(d.end[0]*SMS)+plotpad.left-8)
                    +","+(plotpad.top-20)+") scale(0.6,0.6)"))
    }
    el.select("[name=enddate" +ii+"]").text(bu.dayify(rd[ii].end[0], '-'))
    el.select("[name=endvalue"+ii+"]").text(bu.shn(rd[ii].end[1]))
    el.select("[name=slope"   +ii+"]").text(bu.shn(rd[ii].slope*gol.siru))
  }

  if (opts.tableUpdateOnDrag) updateTableValues()
  if (opts.duebyUpdateOnDrag) updateDueBy()
  updateRoadData()
  updateRoadValidity()
  updateWatermark()
  updateBullseye()
  updateContextBullseye()
  updateDataPoints()
  updateMovingAv()
  updateYBHP()
  updateGuidelines()
  updatePinkRegion()
  updateMaxFluxline()
  updateStdFluxline()
}

// --------------- Functions related to selection of components ----------------

let selection  = null
let selectType = null
let selectelt  = null

function selectKnot(kind, scroll = true) {
  if (opts.divGraph == null) return
  highlightDate( kind, true, scroll )
  selection = kind
  selectType = br.RP.DATE
  d3.select("[name=knot"+kind+"]").attr("stroke-width", r3(opts.roadKnot.width))
  const x = nXSc(road[kind].end[0]*SMS)
  selectelt = gKnots.append("svg:line")
    .attr("class",          "selectedknot")
    .attr("pointer-events", "none")
    .attr("x1",             x)
    .attr("x2",             x)
    .attr("y1",             0)
    .attr("y2",             plotbox.height)
    .attr("stroke",         opts.roadKnotCol.selected)
    .attr("stroke-opacity", 0.9)
    .attr("stroke-width",   r3(opts.roadKnot.width+4)).lower()
}
function unselectKnot(kind) {
  highlightDate(kind, false)
  d3.select("[name=knot"+kind+"]").attr("stroke",       opts.roadKnotCol.dflt)
                                  .attr("stroke-width", r3(opts.roadKnot.width))
}
function selectDot(kind, scroll=true) {
  if (opts.divGraph == null) return
  highlightValue(kind, true, scroll)
  selection = kind
  selectType = br.RP.VALUE
  d3.select("[name=dot"+kind+"]").attr("r", r3(opts.roadDot.size))
  selectelt = gDots.append("svg:circle")
    .attr("class",          "selecteddot")
    .attr("pointer-events", "none")
    .attr("cx",              r1(nXSc(road[kind].end[0]*SMS)))
    .attr("cy",              r1(nYSc(road[kind].end[1])))
    .attr("fill",            opts.roadDotCol.selected)
    .attr("fill-opacity",    0.6)
    .attr("r",               r3(opts.roadDot.size+4))
    .attr("stroke",          "none").lower()
}
function unselectDot(kind) {
  highlightValue(kind, false)
  d3.select("[name=dot"+kind+"]").attr("fill", opts.roadDotCol.editable)
                                 .attr("r",    r3(opts.roadDot.size))
}
function selectRoad(kind, scroll = true) {
  if (opts.divGraph == null) return
  highlightSlope(kind, true, scroll)
  selection = kind
  selectType = br.RP.SLOPE
  d3.select("[name=road"+kind+"]")
    .attr("shape-rendering", "geometricPrecision") // crispEdges
    .attr("stroke-width",    (opts.roadLine.width,3)) // ???????????????????????
  selectelt = gRoads.append("svg:line")
    .attr("class",           "selectedroad")
    .attr("shape-rendering", "geometricPrecision") // crispEdges
    .attr("pointer-events",  "none")
    .attr("x1",              nXSc(road[kind].sta[0]*SMS))
    .attr("x2",              nXSc(road[kind].end[0]*SMS))
    .attr("y1",              nYSc(road[kind].sta[1]))
    .attr("y2",              nYSc(road[kind].end[1]))
    .attr("stroke",          opts.roadKnotCol.selected)
    .attr("stroke-opacity",  0.9)
    .attr("stroke-width",    r3(opts.roadLine.width+4)).lower()
}
function unselectRoad(kind) {
  highlightSlope(kind, false)
  const lineColor = isRoadValid(road) ? opts.roadLineCol.valid 
                                    : opts.roadLineCol.invalid
  d3.select("[name=road"+kind+"]")
    .style("stroke",      lineColor)
    .attr("stroke-width", r3(opts.roadLine.width))
}
function unselect() {
  selection = null
  selectType = null
  if (selectelt != null) { selectelt.remove(); selectelt=null }
}
function clearSelection() {
  //console.debug("clearSelection()")
  if (selection == null) return
  if (selectType == br.RP.DATE) unselectKnot(selection)
  else if (selectType == br.RP.VALUE) unselectDot(selection)
  else if (selectType == br.RP.SLOPE) unselectRoad(selection)
  removeDragInfo()
  unselect()
}

// --------------------- Functions for manipulating knots ----------------------

let roadsave, knotind, knotdate, prevslopes

let editingKnot = false
function knotDragStarted(d,i) {
  d3.event.sourceEvent.stopPropagation()
  editingKnot = true
  pushUndoState()
  var kind = Number(this.id)
  roadsave = br.copyRoad(road)
  if (selection == null) {
    selectKnot(kind)
  } else if (selection != null 
             && selection == kind && selectType == br.RP.DATE) {
    clearSelection()
  } else {
    clearSelection()
    selectKnot(kind)
  }
  createDragInfo(d.end)
  knottext.grp.raise()
  // Store initial slopes to the left & right to prevent collapsed segment
  // issues
  prevslopes = []
  prevslopes[0] = road[kind].slope
  prevslopes[1] = road[kind+1].slope

}

function knotDragged(d,i) {
  unselect()
  // event coordinates are pre-scaled, so use normal scale
  const x = bu.daysnap(nXSc.invert(d3.event.x)/SMS)
  const kind = Number(this.id)
  const rd = road
  // Clip drag x between beginning of current segment and end of next segment
  if (x < rd[kind].sta[0])   x = rd[kind].sta[0]
  if (x > rd[kind+1].end[0]) x = rd[kind+1].end[0]

  // If keepIntervals is enabled, shift all future segments as well
  const maxind = kind+1
  if (opts.keepIntervals) maxind = rd.length
  for (let ii = kind; ii < maxind; ii++) {
    rd[ii].end[0] = x + roadsave[ii].end[0] 
                      - roadsave[kind].end[0]
  }
  if (isFinite(prevslopes[0]) && road[kind].sta[0] != road[kind].end[0]) {
    road[kind].slope = prevslopes[0]
  }
  if (isFinite(prevslopes[1]) && road[kind+1].sta[0] != road[kind+1].end[0]) {
    road[kind+1].slope = prevslopes[1]
  }
  br.fixRoadArray(rd, opts.keepSlopes ? br.RP.VALUE : br.RP.SLOPE,
                  false, br.RP.DATE)

  updateDragPositions(kind, true)
  updateDragInfo(d.end)
}
function knotDragEnded(d,i) {
  editingKnot = false

  if (selection == null) {
    unselectKnot(i)
    removeDragInfo()
    roadChanged()
  }
  roadsave = null
}

function knotDeleted(d) {
  const kind = Number(this.id)
  removeKnot(kind, false)
}

function changeKnotDate(kind, newDate, fromtable = true) {
  pushUndoState()

  const knotmin = (kind == 0) ? gol.xMin-10*SID*DIY 
                            : (road[kind].sta[0]) + 0.01
  const knotmax = (kind == road.length-1) ? road[kind].end[0]+0.01
                                        : road[kind+1].end[0]+0.01
  if (newDate <= knotmin) newDate = bu.daysnap(knotmin)
  if (newDate >= knotmax) newDate = bu.daysnap(knotmin)
  road[kind].end[0] = newDate
  if (!fromtable) {
    // TODO?
  }
  br.fixRoadArray(road, null, fromtable, br.RP.DATE)

  roadChanged()
}

function knotEdited(d, id) {
  const kind = Number(id)
  const el = d3.select(opts.divTable)
  if (road[kind].auto == br.RP.DATE) {
    if (opts.keepSlopes) disableValue(id)
    else disableSlope(id)
  }
  const cell = el.select('[name=enddate'+kind+']').node()
  cell.focus()
  let range, selection
  if (document.body.createTextRange) {
    range = document.body.createTextRange()
    range.moveToElementText(cell)
    range.select()
  } else if (window.getSelection) {
    selection = window.getSelection()
    range = document.createRange()
    range.selectNodeContents(cell)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

// ---------------------- Functions for manipulating dots ----------------------

let editingDot = false
function dotDragStarted(d, id) {
  d3.event.sourceEvent.stopPropagation()
  editingDot = true
  pushUndoState()
  roadsave = br.copyRoad(road)
  const kind = id
  if (selection == null) {
    selectDot(kind)
  } else if (selection != null 
             && selection == kind && selectType == br.RP.VALUE) {
    clearSelection()
  } else {
    clearSelection()
    selectDot(kind)
  }
  if (kind != 0) {
    const seg = road[kind]
    createDragInfo( d.sta, [(seg.sta[0]+seg.end[0])/2,
                            (seg.sta[1]+seg.end[1])/2,
                            seg.slope*gol.siru] )
  } else createDragInfo(d.sta)
  dottext.grp.raise()
};
function dotDragged(d, id) {
  unselect()
  const now = gol.asof
  const y = nYSc.invert(d3.event.y)
  const kind = id
  const rd = road
  const seg = road[kind]
  seg.end[1] = y
  seg.slope = br.segSlope(seg)
  br.fixRoadArray(rd, opts.keepSlopes ? br.RP.VALUE
                                      : br.RP.SLOPE,
                  false, br.RP.VALUE)

  const strt = (kind==0) ? 0 : (kind-1)
  updateDragPositions(strt, false)
  if (kind != 0) {
    updateDragInfo( d.sta, [(seg.sta[0]+seg.end[0])/2,
                            (seg.sta[1]+seg.end[1])/2,
                            seg.slope*gol.siru])
  } else updateDragInfo(d.sta)
};
function dotDragEnded(d,id){
  editingDot = false

  if (selection == null) {
    unselectDot(id)
    removeDragInfo()
    roadChanged()
  } 
  roadsave = null
}

function changeDotValue(kind, newValue, fromtable = false) {
  pushUndoState()

  road[kind].end[1] = newValue
  if (!fromtable) {
    if (!opts.keepSlopes) road[kind].slope = br.segSlope(road[kind])
    if (kind == 1) {
      road[kind-1].sta[1] = newValue
    } else if (kind == road.length-1) {
      road[kind].end[1] = newValue
      road[kind-1].slope = (road[kind].sta[1] - road[kind-1].sta[1])
                         / (road[kind].sta[0] - road[kind-1].sta[0])
    } else {
      road[kind-1].slope = (road[kind].sta[1] - road[kind-1].sta[1])
                         / (road[kind].sta[0] - road[kind-1].sta[0])
    }
  }

  br.fixRoadArray(road, opts.keepSlopes ? br.RP.VALUE : null,
                  fromtable, br.RP.VALUE)

  roadChanged()
}

function dotEdited(d, id) {
  const kind = Number(id)
  const el = d3.select(opts.divTable)
  if (road[kind].auto == br.RP.VALUE) { disableSlope(id) }
  const cell = el.select('[name=endvalue'+kind+']').node()
  cell.focus()
  let range, selection
  if (document.body.createTextRange) {
    range = document.body.createTextRange()
    range.moveToElementText(cell)
    range.select()
  } else if (window.getSelection) {
    selection = window.getSelection()
    range = document.createRange()
    range.selectNodeContents(cell)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

// ----------------- Functions for manipulating road segments ------------------

let editingRoad = false
let roadedit_x
function roadDragStarted(d, id) {
  //console.debug("roadDragStarted: "+id)
  d3.event.sourceEvent.stopPropagation()
  editingRoad = true
  roadedit_x = bu.daysnap(nXSc.invert(d3.event.x)/SMS)
  pushUndoState()
  roadsave = br.copyRoad(road)

  if (selection == null) {
    selectRoad(id)
  } else if (selection != null 
             && selection == id && selectType == br.RP.SLOPE) {
    clearSelection()
  } else {
    clearSelection()
    selectRoad(id)
  }
  let slopex = (d.sta[0]+d.end[0])/2
  if (slopex < nXSc.invert(0)/SMS) slopex = nXSc.invert(0)/SMS
  if (slopex > nXSc.invert(plotbox.width)/SMS - 10)
    slopex = nXSc.invert(plotbox.width)/SMS - 10
  createDragInfo(d.end, [slopex, d.sta[1]+d.slope*(slopex-d.sta[0]),
                         d.slope*gol.siru])
  slopetext.grp.raise()
};
function roadDragged(d, id) {
  //console.debug("roadDragged()")
  unselect()
  const now = gol.asof
  const x = bu.daysnap(nXSc.invert(d3.event.x)/SMS)
  const y = nYSc.invert(d3.event.y)
  const kind = id
  const rd = road

  road[kind].slope = ((y - d.sta[1])/max(x - d.sta[0], SID))
  road[kind].end[1] = road[kind].sta[1] + road[kind].slope*(road[kind].end[0] 
                                                          - road[kind].sta[0])
  road[kind+1].sta[1] = road[kind].end[1]
  if (!opts.keepSlopes) road[kind+1].slope = br.segSlope(road[kind+1])

  br.fixRoadArray(rd, br.RP.VALUE, false, br.RP.SLOPE)

  updateDragPositions(kind, true)
  let slopex = (d.sta[0]+d.end[0])/2
  if (slopex < nXSc.invert(0)/SMS) slopex = nXSc.invert(0)/SMS
  if (slopex > nXSc.invert(plotbox.width)/SMS - 10) 
    slopex = nXSc.invert(plotbox.width)/SMS - 10
  updateDragInfo(d.end, [slopex, d.sta[1]+d.slope*(slopex-d.sta[0]),
                         d.slope*gol.siru])
}
function roadDragEnded(d, id) {
  //console.debug("roadDragEnded()")
  editingRoad = false

  if (selection == null) {
    unselectRoad(id)
    removeDragInfo()
    roadChanged()
  }
  roadsave = null
}

function changeRoadSlope(kind, newSlope, fromtable = false) {
  if (kind == road.length-1) return
  pushUndoState()

  road[kind].slope = newSlope/(gol.siru)
  if (!fromtable) {
    if (!opts.keepSlopes) {
      road[kind].end[1] = road[kind].sta[1]+road[kind].slope*(road[kind].end[0] 
                                                            - road[kind].sta[0])
      road[kind+1].sta[1] = road[kind].end[1]
      road[kind+1].slope = br.segSlope(road[kind+1])
    }
  }
  br.fixRoadArray(road, null, fromtable, br.RP.SLOPE)

  roadChanged()
}

function roadEdited(d, id) {
  const kind = Number(id)
  const el = d3.select(opts.divTable)
  if (d.auto == br.RP.SLOPE) { disableValue(id) }
  const cell = el.select('[name=slope'+kind+']').node()
  cell.focus()
  let range, selection
  if (document.body.createTextRange) {
    range = document.body.createTextRange()
    range.moveToElementText(cell)
    range.select()
  } else if (window.getSelection) {
    selection = window.getSelection()
    range = document.createRange()
    range.selectNodeContents(cell)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

// -------------------- Functions to animate SVG components --------------------

const anim = {
  buf: false, bux: false, aura: false, aurap: false,
  hor: false, hort: false, ybr: false, ybrc: false,
  guides: false, rosy: false, rosyd: false, data: false,
  dataa: false, mav:false
}
/** This function initiates a cyclic animation on a particular element, cycling
 * through the attribute and style information supplied in two arrays. Each
 * array is expected to include triples [name, v1, v0], cycling an attribute or
 * style with 'name' up to the v1 value in 'dur' milliseconds and back to v0 in
 * 'dur' milliseconds again, repeating indefinitely. */
function startAnim(elt, dur, attrs, styles, tag) {
  var tr = elt.transition().duration(dur), i
              
  for (i= 0; i< attrs.length; i++)
    tr = tr.attr(  attrs[i][0],  attrs[i][1])
  for (i= 0; i<styles.length; i++)
    tr = tr.style(styles[i][0], styles[i][1])

  tr = tr.transition().duration(dur)
  for (i= 0; i< attrs.length; i++)
    tr = tr.attr(attrs[i][0],    attrs[i][2])
  for (i= 0; i<styles.length; i++)
    tr = tr.style(styles[i][0], styles[i][2])
  tr.on("end", ()=>{if (anim[tag]) startAnim(elt, dur, attrs, styles, tag)})
  anim[tag] = true
}
function stopAnim(elt, dur, attrs, styles, tag) {
  anim[tag] = false
  let  tr = elt.transition().duration(dur)
  for (let i= 0; i<attrs.length; i++)  tr = tr.attr(attrs[i][0], attrs[i][2])
  for (let i= 0; i<styles.length; i++) tr = tr.style(styles[i][0], styles[i][2])
  tr.on("end", ()=>{anim[tag] = false})
}

function animBuf(enable) {
  if (opts.roadEditor) return
  const e = gWatermark.selectAll(".waterbuf")
  const x = Number(e.attr("x"))
  const y = Number(e.attr("y"))
  if  (e.node().tagName == 'text') {
    let sz = e.style("font-size")
    sz = Number(sz.substring(0,sz.length-2))
    let s =[["font-size", (sz*1.3)+"px",(sz)+"px"],
            ["fill", "#606060", opts.watermark.color]]
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
  const e = gWatermark.selectAll(".waterbux")

  let sz = e.style("font-size")
  sz = Number(sz.substring(0,sz.length-2))
  const y = Number(e.attr("y"))
  const s =[["font-size", (sz*1.3)+"px",(sz)+"px"],
          ["fill", "#606060", opts.watermark.color]]
  const a =[["y", y+0.15*sz, y]]
  if (enable) startAnim(e, 500, a, s, "bux")
  else stopAnim(e, 300, a, s, "bux")
}

function animAura(enable) {
  if (opts.roadEditor) return
  const e = gAura.selectAll(".aura")
  const ep = gAura.selectAll(".aurapast")
  
  const s =[["stroke",  "#9e559e", bu.Cols.LPURP],
          ["fill",    "#9e559e", bu.Cols.LPURP]]
  const sp =[["stroke", "#9e559e", bu.Cols.LPURP],
           ["fill",   "#9e559e", bu.Cols.LPURP]]
  const a =[["transform",  "translate(0,5)",  "translate(0,0)"]]
  const ap =[["transform", "translate(0,5)",  "translate(0,0)"]]
  if (enable) {
    startAnim(e,  500, a, s,  "aura")
    startAnim(ep, 500, ap, sp, "aurap")
  }
  else {
    stopAnim(e,  300, a, s,  "aura")
    stopAnim(ep, 300, ap, sp, "aurap")
  }
}

function animHor( enable ) {
  if (opts.roadEditor) return
  const o = opts.horizon
  
  const he = gHorizon.select(".horizon")
  const hte = gHorizonText.select(".horizontext")
  const a = [["stroke-width", r3(o.width*scf*3)+"px", r3(o.width*scf)+"px"]],
        s = [["stroke-dasharray", (o.dash*1.3)+","+(o.dash*0.7),
                                  (o.dash)+","+(o.dash)]]
  const ts = [["font-size",(o.font*1.2)+"px", (o.font)+"px"]]
  if (enable) {
    startAnim(he,  500, a,  s,  "hor")
    startAnim(hte, 500, [], ts, "hort")
  } else {
    stopAnim(he,  300, a,  s,  "hor")
    stopAnim(hte, 300, [], ts, "hort")
  }
}

function animYBR(enable) {
  if (opts.roadEditor) return
  // var e = gOldRoad.select(".oldlanes")
  let styles =[["fill-opacity", 1.0, 0.5],
               ["fill", "#ffff00", bu.Cols.DYEL]]
  // if (enable) startAnim(e, 500, [], styles, "ybr")
  // else stopAnim(e, 300, [], styles, "ybr")

  const e = gRazr.select(".razr")
  styles =[["stroke-width",
            r3(opts.oldRoadLine.width*scf*2)+"px", 
            r3(opts.oldRoadLine.width*scf)+"px"]]
  if (enable) startAnim(e, 500, [], styles, "ybrc")
  else stopAnim(e, 300, [], styles, "ybrc")
}

function animGuides(enable) {
  if (opts.roadEditor) return
  const e = gGuides.selectAll(".guides")
  const a =[["stroke-width", r3(opts.guidelines.width*scf*2)+"px",
             d => (d<0 ? r3(opts.guidelines.weekwidth*scf)+"px"
                   : r3(opts.guidelines.width*scf)+"px")],
            ["stroke", d => (d<0 ? bu.Cols.BIGG : "#ffff00"),
             d => (d<0 ? bu.Cols.BIGG : bu.Cols.LYEL)]]
  if (enable) startAnim(e, 500, [], a, "guides")
  else        stopAnim( e, 300, [], a, "guides")
  // TODO: also animate the maxflux line: 
  // oldguides -> oldmaxflux
  // guidelines -> maxfluxline
}

function animRosy(enable) {
  if (opts.roadEditor) return
  const e  = gRosy.selectAll(".rosy")
  const de = gRosyPts.selectAll(".rd")

  const s =[["stroke-width", r3(6*scf)+"px", r3(4*scf)+"px"]]
  const ds =[["r",
              r3(opts.dataPoint.size*scf*2)+"px", 
              r3(opts.dataPoint.size*scf)+"px"]]
  if (enable) { 
    startAnim(e,  500, [], s, "rosy")
    startAnim(de, 500, [], ds, "rd")
  }
  else {
    stopAnim(e,  300, [], s, "rosy")
    stopAnim(de, 300, [], ds, "rd")
  }
}

function animData(enable) {
  if (opts.roadEditor) return
  var e = gDpts.selectAll(".dp")
  var s =[["r",
            r3(opts.dataPoint.size*scf*2)+"px",
            r3(opts.dataPoint.size*scf)+"px"]]
  if (enable) startAnim(e, 500, [], s, "data")
  else        stopAnim(e,  300, [], s, "data")
  e = gAllpts.selectAll(".ap")
  s =[["r", r3(0.7*opts.dataPoint.size*scf*2)+"px", 
            r3(0.7*opts.dataPoint.size*scf)+"px"]]
  if (enable) startAnim(e, 500, [], s, "dataa")
  else        stopAnim(e,  300, [], s, "dataa")
}

function animMav(enable) {
  if (opts.roadEditor) return
  const e = gMovingAv.selectAll(".movingav")

  let a =[["stroke-width", r3(6*scf)+"px", r3(3*scf)+"px"]]
  if (enable) startAnim(e, 500, a, [], "mav")
  else        stopAnim(e,  300, a, [], "mav")
}

function animYBHPlines(enable) {
  if (opts.roadEditor) return
  const e = gYBHPlines.selectAll("#r11, #r22, #r66")
  const a =[["stroke-width", r3(4*scf)+"px", r3(1.5*scf)+"px"]]
  if (enable) startAnim(e, 500, a, [], "ybl")
  else        stopAnim(e,  300, a, [], "ybl")
}

// -------------------- Functions to update SVG components ---------------------

// Create or update the shaded box to indicate past dates
function updatePastBox() {
  if (processing || opts.divGraph == null || road.length == 0) return
  const pastelt = gPB.select(".past")
  if (!opts.roadEditor) {
    pastelt.remove()
    return
  }
  if (pastelt.empty()) {
    gPB.insert("svg:rect", ":first-child")
      .attr("class","past")
      .attr("x", nXSc(gol.xMin))
      .attr("y", nYSc(gol.yMax+3*(gol.yMax-gol.yMin)))
      .attr("width", nXSc(gol.asof*SMS) - nXSc(gol.xMin))
      .attr("height",7*abs(nYSc(gol.yMin) - nYSc(gol.yMax)))
      .attr("fill", opts.pastBoxCol.fill)
      .attr("fill-opacity", opts.pastBoxCol.opacity)
  } else {
    pastelt.attr("x", nXSc(gol.xMin))
           .attr("y", nYSc(gol.yMax + 3*(gol.yMax-gol.yMin)))
           .attr("width", nXSc(gol.asof*SMS) - nXSc(gol.xMin))
      .attr("height",7*abs(nYSc(gol.yMin) - nYSc(gol.yMax)))
  }
}

// Create or update the shaded box to indicate past dates
function updatePastText() {
  if (processing || opts.divGraph == null || road.length == 0) return
  const todayelt    = gGrid.select(".pastline")
  const pasttextelt = gPastText.select(".pasttext")
  if (!opts.roadEditor) {
    todayelt.remove()
    pasttextelt.remove()
    return
  }
  if (todayelt.empty()) {
    gGrid.append("svg:line").attr("class",         "pastline")
                            .attr("x1",            nXSc(gol.asof*SMS))
                            .attr("y1",            0)
                            .attr("x2",            nXSc(gol.asof*SMS))
                            .attr("y2",            plotbox.height)
                            .style("stroke",       bu.Cols.AKRA) 
                            .style("stroke-width", r3(opts.today.width))
  } else {
    todayelt.attr("x1", nXSc(gol.asof*SMS))
            .attr("y1", 0)
            .attr("x2", nXSc(gol.asof*SMS))
            .attr("y2", plotbox.height)
  }
  const textx = nXSc(gol.asof*SMS)-8
  const texty = plotbox.height/2
  if (pasttextelt.empty()) {
    gPastText.append("svg:text")
      .attr("class","pasttext")
      .attr("x",textx ).attr("y",texty)
      .attr("transform", "rotate(-90,"+textx+","+texty+")")
      .attr("fill", bu.Cols.AKRA) 
      .style("font-size", opts.horizon.font+"px") 
      .text("Today"+" ("+moment.unix(gol.asof).utc().format("ddd")+")")
  } else {
    pasttextelt
      .attr("x", textx).attr("y", texty)
      .attr("transform", "rotate(-90,"+textx+","+texty+")")
      .text("Today"+" ("+moment.unix(gol.asof).utc().format("ddd")+")")
  }
}

function updateContextToday() {
  if (processing || opts.divGraph == null || road.length == 0) return
  const todayelt    = ctxplot.select(".ctxtoday")
  const pasttextelt = ctxplot.select(".ctxtodaytext")
  if (!opts.roadEditor) {
    todayelt.remove()
    pasttextelt.remove()
    return
  }
  if (todayelt.empty()) {
    ctxplot.append("svg:line").attr("class",         "ctxtoday")
                              .attr("x1",            xScB(gol.asof*SMS))
                              .attr("y1",            0)
                              .attr("x2",            xScB(gol.asof*SMS))
                              .attr("y2",            brushbox.height)
                              .style("stroke",       "rgb(0,0,200)") 
                              .style("stroke-width", r3(opts.horizon.ctxwidth))
  } else {
    todayelt.attr("x1", xScB(gol.asof*SMS))
            .attr("y1", 0)
            .attr("x2", xScB(gol.asof*SMS))
            .attr("y2", brushbox.height)
  }
  const textx = xScB(gol.asof*SMS)-5
  const texty = brushbox.height/2

  if (pasttextelt.empty()) {
    ctxplot.append("svg:text")
      .attr("class",      "ctxtodaytext")
      .attr("x",          textx )
      .attr("y",          texty)
      .attr("transform",  "rotate(-90,"+textx+","+texty+")")
      .attr("fill",       "rgb(0,0,200)") 
      .style("font-size", (opts.today.ctxfont)+"px") 
      .text("Today")
  } else {
    pasttextelt.attr("x", textx)
               .attr("y", texty)
               .attr("transform", "rotate(-90,"+textx+","+texty+")")
  }
}

// Creates or updates the Bullseye at the goal date
function updateBullseye() {
  if (processing || opts.divGraph == null || road.length == 0) return;
  var bullseyeelt = gBullseye.select(".bullseye");
  //var bx = nXSc(road[road.length-1].sta[0]*SMS)-(opts.bullsEye.size/2);
  //var by = nYSc(road[road.length-1].sta[1])-(opts.bullsEye.size/2);
  var bx = nXSc(gol.tfin*SMS)-(opts.bullsEye.size/2);
  var by = nYSc(br.rdf(road, gol.tfin))-(opts.bullsEye.size/2);
  if (bullseyeelt.empty()) {
    gBullseye.append("svg:image")
      .attr("class","bullseye")
      .attr("xlink:href",PNG.beye)
      .attr("externalResourcesRequired",true)
      .attr("x",bx ).attr("y",by)
      .attr('width', opts.bullsEye.size)
      .attr('height', opts.bullsEye.size);
  } else {
    bullseyeelt
      .attr("x", bx).attr("y", by);
  }
}

function updateContextBullseye() {
  if (processing || opts.divGraph == null || road.length == 0) return;
  var bullseyeelt = ctxplot.select(".ctxbullseye");
  if (!opts.roadEditor) {
    bullseyeelt.remove();
    return;
  }
  //var bx = xScB(road[road.length-1].sta[0]*SMS)-(opts.bullsEye.ctxsize/2)
  //var by = yScB(road[road.length-1].sta[1])-(opts.bullsEye.ctxsize/2)
  var bx = xScB(gol.tfin*SMS)-(opts.bullsEye.ctxsize/2);
  var by = yScB(br.rdf(road, gol.tfin))-(opts.bullsEye.ctxsize/2);
  if (bullseyeelt.empty()) {
    ctxplot.append("svg:image")
      .attr("class","ctxbullseye")
      .attr("xlink:href",PNG.beyey)
      .attr("externalResourcesRequired",true)
      .attr("x",bx ).attr("y",by)
      .attr('width', (opts.bullsEye.ctxsize))
      .attr('height', (opts.bullsEye.ctxsize));
  } else {
    bullseyeelt.attr("x", bx).attr("y", by);
  }
}

// Creates or updates the Bullseye at the goal date
function updateOldBullseye() {
  if (processing || opts.divGraph == null || road.length == 0) return;
  var bullseyeelt = gOldBullseye.select(".oldbullseye");
  if (!opts.roadEditor) {
    bullseyeelt.remove();
    return;
  }
  var png = (opts.roadEditor)?PNG.beyey:PNG.beye
  //var bx = nXSc(iroad[iroad.length-1].sta[0]*SMS)-(opts.bullsEye.size/2);
  //var by = nYSc(iroad[iroad.length-1].sta[1])-(opts.bullsEye.size/2);
  var bx = nXSc(igoal.tfin*SMS)-(opts.bullsEye.size/2);
  var by = nYSc(br.rdf(iroad, igoal.tfin))-(opts.bullsEye.size/2);
  if (bullseyeelt.empty()) {
    gOldBullseye.append("svg:image")
      .attr("class","oldbullseye")
      .attr("xlink:href",png)
      .attr("externalResourcesRequired",true)
      .attr("x",bx ).attr("y",by)
      .attr('width', (opts.bullsEye.size))
      .attr('height', (opts.bullsEye.size));
  } else {
    bullseyeelt
      .attr("x", bx).attr("y", by);
  }
}

function updateContextOldBullseye() {
  if (processing || opts.divGraph == null || road.length == 0) return;
  var png = (opts.roadEditor)?PNG.beyey:PNG.beye
  var bullseyeelt = ctxplot.select(".ctxoldbullseye");
  var bx = xScB(iroad[iroad.length-1].sta[0]*SMS)
    -(opts.bullsEye.ctxsize/2);
  var by = yScB(iroad[iroad.length-1].sta[1])
    -(opts.bullsEye.ctxsize/2);
  if (bullseyeelt.empty()) {
    ctxplot.append("svg:image")
      .attr("class","ctxoldbullseye")
      .attr("xlink:href",png)
      .attr("externalResourcesRequired",true)
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
  if (processing || opts.divGraph == null || road.length == 0 || hidden) return

  var tl = [0,0], bbl = [0, plotbox.height/2]
  var tr = [plotbox.width/2,0], bbr = [plotbox.width/2, plotbox.height/2]
  var offg, offb, g = null, b = null, x, y, bbox, newsize, newh

  setWatermark()
  if      (gol.loser)              g = PNG.sklb
  if      (gol.waterbuf === 'inf') g = PNG.infb
  else if (gol.waterbuf === ':)')  g = PNG.smlb

  if      (gol.dir>0 && gol.yaw<0) { offg = bbr; offb = tl  }
  else if (gol.dir<0 && gol.yaw>0) { offg = tr;  offb = bbl }
  else if (gol.dir<0 && gol.yaw<0) { offg = bbl; offb = tr  }
  else                             { offg = tl;  offb = bbr }

  xlinkloaded = false
  var wbufelt = gWatermark.select(".waterbuf");
  var fs = opts.watermark.fntsize, wmh = opts.watermark.height
  wbufelt.remove();
  if (g != null) {
    x = (plotbox.width/2-wmh)/2;
    y = (plotbox.height/2-wmh)/2;

    wbufelt = gWatermark.append("svg:image")
      .attr("class","waterbuf")
      //.attr("shape-rendering","crispEdges")
      .attr("xlink:href",g)
      .attr("externalResourcesRequired",true)
      .attr('width', wmh)
      .attr('height', wmh)
      .on('load', ()=>{xlinkloaded = true});
  } else {
    x = plotbox.width/4;
    y = plotbox.height/4+fs/3;
    wbufelt = gWatermark.append("svg:text")
      .attr("class","waterbuf")
      //.attr("shape-rendering","crispEdges")
      .style('font-size', fs+"px")
      .style('font-weight', "bolder")
      .style('fill', opts.watermark.color)
      .text(gol.waterbuf);
    bbox = wbufelt.node().getBBox();
    if (bbox.width > plotbox.width/2.2) {
      newsize = (fs*(plotbox.width/2.2)
                 /bbox.width);
      newh = newsize/fs*bbox.height;
      y = plotbox.height/4+newh/3;
      wbufelt.style('font-size', newsize+"px");
    }        
    xlinkloaded = true
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
      //.attr("shape-rendering","crispEdges")
      .style('font-size', fs+"px")
      .style('font-weight', "bolder")
      .style('fill', opts.watermark.color)
      .text(gol.waterbux);
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
  if (processing || opts.divGraph == null || road.length == 0 || hidden) return
  var el  = gAura.selectAll(".aura")
  var el2 = gAura.selectAll(".aurapast")
  if (gol.aura && opts.showData) {
    var aurdn = min(0, -gol.stdflux)
    var aurup = max(0,  gol.stdflux)
    var fudge = PRAF*(gol.tmax-gol.tmin)
    var xr = [nXSc.invert(            0).getTime()/SMS, 
              nXSc.invert(plotbox.width).getTime()/SMS]
    var xvec, i
    xvec = griddle(max(xr[0], gol.tmin),
                   bu.arrMin([xr[1], gol.asof+bu.AKH, gol.tmax+fudge]),
                   plotbox.width/8)
    // Generate a path string for the aura
    var 
      d = "M"+r1(nXSc(xvec[0]*SMS))+" "+r1(nYSc(gol.auraf(xvec[0])+aurup))
    for (i = 1; i < xvec.length; i++)
      d += 
        " L"+r1(nXSc(xvec[i]*SMS))+" "+r1(nYSc(gol.auraf(xvec[i])+aurup))
    for (i = xvec.length-1; i >= 0; i--)
      d += 
        " L"+r1(nXSc(xvec[i]*SMS))+" "+r1(nYSc(gol.auraf(xvec[i])+aurdn))
    d += " Z"
    if (el.empty()) {
      gAura.append("svg:path")
        .attr("class","aura").attr("d", d)
        .style("fill", bu.Cols.LPURP)
        .style("stroke-width", 2).style("stroke", bu.Cols.LPURP);
    } else {
      el.attr("d", d);
    }
    if (xr[0] < gol.tmin) {
      xvec = griddle(xr[0], gol.tmin, plotbox.width/8);
      d = "M"+r1(nXSc(xvec[0]*SMS))+" "+r1(nYSc(gol.auraf(xvec[0])+aurup))
      for (i = 1; i < xvec.length; i++)
        d += " L"+r1(nXSc(xvec[i]*SMS))+" "
                 +r1(nYSc(gol.auraf(xvec[i])+aurup))
      for (i = xvec.length-1; i >= 0; i--)
        d += " L"+r1(nXSc(xvec[i]*SMS))+" "
                 +r1(nYSc(gol.auraf(xvec[i])+aurdn))
      d += " Z";
      if (el2.empty()) {
        gAura.append("svg:path")
          .attr("class","aurapast").attr("d", d)
          .style("fill", bu.Cols.LPURP)
          .style("stroke-width", 2)
          .style("stroke-dasharray", "4,4")
          .style("stroke", bu.Cols.LPURP)
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

// Create or update the Akrasia Horizon line
function updateHorizon() {
  if (processing || opts.divGraph == null || road.length == 0) return;
  const horizonelt = gHorizon.select(".horizon");
  const o = opts.horizon
  
  if (horizonelt.empty()) {
    gHorizon.append("svg:line")
      .attr("class","horizon")
      .attr("x1", nXSc(gol.horizon*SMS))
      .attr("y1",0)
      .attr("x2", nXSc(gol.horizon*SMS))
      .attr("y2",plotbox.height)
      .style("stroke", bu.Cols.AKRA) 
      .style("stroke-dasharray", 
             (o.dash)+","+(o.dash)) 
      .attr("stroke-width", r3(o.width*scf))
  } else {
    horizonelt
      .attr("x1", nXSc(gol.horizon*SMS))
      .attr("y1",0)
      .attr("x2", nXSc(gol.horizon*SMS))
      .attr("y2",plotbox.height)
      .attr("stroke-width", r3(o.width*scf))
  }
  var textx = nXSc(gol.horizon*SMS)+(14);
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
  if (processing || opts.divGraph == null || road.length == 0) return
  const horizonelt = ctxplot.select(".ctxhorizon")
  const o = opts.horizon
  if (horizonelt.empty()) {
    ctxplot.append("svg:line")
      .attr("class","ctxhorizon")
      .attr("x1", xScB(gol.horizon*SMS))
      .attr("y1", yScB(gol.yMin-5*(gol.yMax-gol.yMin)))
      .attr("x2", xScB(gol.horizon*SMS))
      .attr("y2", yScB(gol.yMax+5*(gol.yMax-gol.yMin)))
      .style("stroke", bu.Cols.AKRA) 
      .style("stroke-dasharray", (o.ctxdash)+","+(o.ctxdash)) 
      .style("stroke-width", r3(o.ctxwidth))
  } else {
    horizonelt.attr("x1", xScB(gol.horizon*SMS))
              .attr("y1", yScB(gol.yMin-5*(gol.yMax-gol.yMin)))
              .attr("x2", xScB(gol.horizon*SMS))
              .attr("y2", yScB(gol.yMax+5*(gol.yMax-gol.yMin)))
  }

  var textx = xScB(gol.horizon*SMS)+12
  var texty = brushbox.height/2

  var hortextelt = ctxplot.select(".ctxhortext")
  if (hortextelt.empty()) {
    ctxplot.append("svg:text")
      .attr("class","ctxhortext")
      .attr("x",textx ).attr("y",texty)
      .attr("transform", "rotate(-90,"+textx+","+texty+")")
      .attr("fill", bu.Cols.AKRA) 
      .style("font-size", (o.ctxfont)+"px") 
      .text("Horizon")
  } else {
    hortextelt.attr("x", textx)
              .attr("y", texty)
              .attr("transform", "rotate(-90,"+textx+","+texty+")")
  }
}

function updateYBHP() {
  if (processing || opts.divGraph == null || road.length == 0) return
  
  // Count all previously generated ybhp path elements on the current svg graph
  // so we can remove unused ones automatically 
  const ybhpreg   = d3.selectAll("#svg"+curid+" #ybhpgrp path")
  const ybhplines = d3.selectAll("#svg"+curid+" #ybhplinesgrp path")
  const prevcnt = ybhpreg.size()+ybhplines.size()

  // Region format: From d to D days to derailment (if d=D it's a region
  // boundary, i.e., an isoline of the DTD function), use fill-color fcolor,
  // stroke-color scolor, stroke-width w, and fill-opacity op.
  // Finally, xrange, a list like [xmin, xmax], gives the x-axis range to apply
  // it to. If xrange=null, use [-infinity, infinity].

  const xrfull   = [gol.tini, gol.tfin]       // x-axis range tini to tfin
  const xrakr    = [gol.asof, gol.asof+7*SID] // now to akrasia horizon
  const bgreen   = bu.Cols.RAZR3 // bu.Cols.GRNDOT // was RAZR3
  const bblue    = bu.Cols.RAZR2
  const borange  = bu.Cols.RAZR1
  const lyellow  = "#ffff88" // light yellow same as LYEL for classic YBR
  const llyellow  = "#ffffbd" // uluc had #ffffdd
  const gsw      = .99  // stroke width for guiding lines
  const gfo      = 1    // fill-opacity for guiding lines -- may not matter
  const rfo      = 0.72 // fill-opacity for regions
  const inf      = (gol.tfin-gol.tini)/SID // num safe days counting as infinite

  const regionsMaxflux = [
  //[  d,  D, fcolor,    scolor,    w,  op, xrange]
  //----------------------------------------------------------------------------
    [  0,  2, lyellow,   "none",    0, rfo, xrfull], // mimic old lanes
  //[  0, -2, "#fff5f5", "none",    0,   1, xrakr ], // nozone/oinkzone
    [inf, -1, llyellow,   "none",    0, rfo, xrfull], // infinitely safe region
  ]
  const regionsNormal = [
  //[  d,  D, fcolor,    scolor,    w,  op, xrange]
  //----------------------------------------------------------------------------
  //[  6, -1, "#b2e5b2", "none",    0, rfo, xrfull], // safe/gray region
    [  6,  6, "none",    bgreen,  gsw, gfo, xrfull], // 1-week isoline
  //[  2,  6, "#cceecc", "none",    0, rfo, xrfull], // green region (not used)
    [  2,  2, "none",    bblue,   gsw, gfo, xrfull], // blue isoline
  //[  1,  2, "#e5e5ff", "none",    0, rfo, xrfull], // blue region (not used)
    [  1,  1, "none",    borange, gsw, gfo, xrfull], // orange isoline
  //[  0,  1, "#fff1d8", "none",    0, rfo, xrfull], // orange region (not used)
    [  0,  2, lyellow,   "none",    0, rfo, xrfull], // mimic old lanes
  // Razor road currently in updateRedline because we can't define dashed lines
  // here; so the following doesn't work:
  //[  0,  0, "#ff0000", "none",    1, gfo, xrfull], // bright red line
  //[  0, -2, "#ffe5e5", "none",    0, rfo,   null], // whole bad half-plane
  //[  0, -2, "#fff5f5", "none",    0,   1, xrakr ], // nozone/oinkzone
    [inf, -1, llyellow,   "none",    0, rfo, xrfull], // infinitely safe region
  ]
  let regions
  if (false) { // change to true for debugging
    const debuglines = 0
    const regionsDebug = [
    //[  d,  D, fcolor,    scolor,    w,  op, xrange]
    //--------------------------------------------------------------------------
      [  6,  6, "none",    bgreen,  1.5,   1, xrfull], // 1-week isoline
      [  7,  7, "none",    bblue,   1.5,   1, xrfull], // extra isoline
      [  8,  8, "none",    borange, 1.5,   1, xrfull], // extra isoline
      [  9,  9, "none",    "red",   1.5,   1, xrfull], // extra isoline
      [  0,  2, lyellow,   "none",    0, 0.5, xrfull], // YBR equivalent
    //[  2,  2, "none",    bblue,   1.5,   1, xrfull], // blue line
    //[  1,  1, "none",    borang,  1.5,   1, xrfull], // orange line
    ]
    regions = regionsDebug // debugging isolines
    const tmp = br.isoline(road, dtd, gol, debuglines, true)
    const adj = abs(nYSc.invert(2.5)-nYSc.invert(0))
    //console.log(JSON.stringify(tmp[3].map(e=>[bu.dayify(e[0]), e[1]])))
    iso[6] = tmp[0]
    iso[7] = tmp[1]
    iso[8] = tmp[2]
    iso[9] = tmp[3]
    iso[7] = iso[7].map(e => [e[0], e[1]+1*adj])
    iso[8] = iso[8].map(e => [e[0], e[1]+2*adj])
    iso[9] = iso[9].map(e => [e[0], e[1]+3*adj])
  } else {
    regions = gol.maxflux > 0 ? regionsMaxflux : regionsNormal
  }
  
  // HT cpcallen who proposed changing this max to a min, though turns out
  // that's wrong. Sad trombone!
  for (var ri = 0; ri < max(prevcnt, regions.length); ri++) {
    // SVG elements for regions are given unique class names
    const clsname = "halfplane"+ri
    const reg = regions[ri]

    // Force removal of leftover regions or lines if requested or stale detected
    if (reg == undefined || (reg[2] == null && reg[3] == null)) {
      gYBHP.select("."+clsname).remove()
      gYBHPlines.select("."+clsname).remove()
      continue
    }

    let ybhpelt, ybhpgrp
    if (reg[0] != reg[1]) {
      // Regions are drawn on their own container
      ybhpgrp = gYBHP
      // Remove any previously created lines with this name to prevent
      // leftovers from earlier graph instances
      gYBHPlines.select("."+clsname).remove()
    } else {
      // Lines are drawn on their own container
      ybhpgrp = gYBHPlines
      // Remove any previously created regions with this name to prevent
      // leftovers from earlier graph instances
      gYBHP.select("."+clsname).remove()
    }
    ybhpelt = ybhpgrp.select("."+clsname)
    const id = "r"+reg[0]+reg[1]

    // Adjustment to y coordinates by half the stroke width
    const adj = gol.yaw*reg[4]/2

    let xr = reg[6]
    if (xr == null) xr = [-Infinity, Infinity]

    const rstrt = reg[0]
    const rend  = reg[1]

    // Starting boundary for a region is not allowed to be infinity
    if (rstrt < 0) {
      console.log("updateYBHP(): Invalid region definition")
      continue
    }
    
    // Clip start and end points to within the requested range
    let xstrt = road[0].end[0]
    let xend = road[road.length-1].sta[0]
    if (xstrt < xr[0]) xstrt = xr[0]
    if (xend  > xr[1]) xend = xr[1]

    // Determine good side of the road for boundaries at infinity
    let yedge, yedgeb
    if (gol.yaw < 0) {
      yedge  = gol.yMin - 0.1*(gol.yMax - gol.yMin)
      yedgeb = gol.yMax + 0.1*(gol.yMax - gol.yMin)
    } else {
      yedge  = gol.yMax + 0.1*(gol.yMax - gol.yMin)
      yedgeb = gol.yMin - 0.1*(gol.yMax - gol.yMin)
    }

    // Construct a path element for the starting DTD value. This will be the
    // only path if the starting and ending DTD values are the same.
    const isostrt = getiso(rstrt)

    let x = isostrt[0][0]
    let y = isostrt[0][1]
    if (x < xstrt) { x = xstrt; y = br.isoval(isostrt, x) }
    let d = "M"+r1(nXSc(x*SMS))+" "+r1(nYSc(y)+adj)
    for (let i = 1; i < isostrt.length; i++) {
      x = isostrt[i][0]; y = isostrt[i][1]
      if (x < xstrt) continue
      if (x > xend) { x = xend; y = br.isoval(isostrt, x) }
      d += " L"+r1(nXSc(x*SMS))+" "+r1(nYSc(y)+adj)
      if (isostrt[i][0] > xend) break
    }

    if (rend == -1) {
      // Region on the good side of the road
      d += " L"+r1(nXSc(xend *SMS))+" "+r1(nYSc(br.isoval(isostrt, xend))+adj)
      d += " L"+r1(nXSc(xend *SMS))+" "+r1(nYSc(yedge))
      d += " L"+r1(nXSc(xstrt*SMS))+" "+r1(nYSc(yedge))
      d += " Z"
    } else if (rend == -2) {
      // Region on the bad side of the road
      d += " L"+nXSc(xend *SMS)+" "+r1(nYSc(br.isoval(isostrt, xend))+adj)
      d += " L"+r1(nXSc(xend *SMS))+" "+r1(nYSc(yedgeb))
      d += " L"+r1(nXSc(xstrt*SMS))+" "+r1(nYSc(yedgeb))
      d += " Z"
    } else if (rstrt != rend) {
      // End DTD value different than start value, so construct a return path
      // to build an enclosed region
      const isoend = getiso(rend)
      const ln = isoend.length
      let x = isoend[ln-1][0]
      let y = isoend[ln-1][1]
      if (x > xend) { x = xend; y = br.isoval(isoend, x) }
      d += " L"+r1(nXSc(x*SMS))+" "+r1(nYSc(y)+adj)
      for (let i = ln-2; i >= 0; i--) {
        x = isoend[i][0]
        y = isoend[i][1]
        if (x > xend) continue
        if (x < xstrt) { x = xstrt; y = br.isoval(isoend, x) }
        d += " L"+r1(nXSc(x*SMS))+" "+r1(nYSc(y)+adj)
        if (isoend[i][0] < xstrt) break
      }
      d += " Z"
    }

    if (ybhpelt.empty()) { // create a new element if an existing one not found
      ybhpgrp.append("svg:path").attr("class",          "ybhp "+clsname)
                                .attr("id",             id)
                                .attr("d",              d)
                                .attr("fill",           reg[2])
                                .attr("fill-opacity",   reg[5])
                                .attr("stroke",         reg[3])
                                .attr("stroke-width",   reg[4])
    } else { // update previously created element
      ybhpelt.attr("d",            d)
             .attr("id",             id)
             .attr("fill",         reg[2])
             .attr("fill-opacity", reg[5])
             .attr("stroke",       reg[3])
             .attr("stroke-width", reg[4])
    }
  }
}

function updatePinkRegion() {                         // AKA nozone AKA oinkzone
  if (processing || opts.divGraph == null || road.length == 0) return

  const pinkelt = gPink.select(".pinkregion")
  const valid = isRoadValid(road)
  let rd = iroad
  // For non-editor graphs, use the most recent road
  if (!opts.roadEditor) rd = road
  
  const now = gol.asof
  const hor = gol.horizon
  let yedge
  if (gol.yaw > 0) yedge = gol.yMin - 5*(gol.yMax - gol.yMin)
  else             yedge = gol.yMax + 5*(gol.yMax - gol.yMin)
  const color = "url(#pinkzonepat"+curid+")"

  const pr = d3.select(" #pinkzonepat"+curid+" rect")
  const pl = d3.select(" #pinkzonepat"+curid+" line")
  pr.attr("fill", (valid||!opts.roadEditor)?bu.Cols.PINK:"#ffbbbb")
  pl.style("stroke", (valid||!opts.roadEditor)?"#aaaaaa":"#666666")
  
  // Compute road indices for left and right boundaries
  const itoday = br.findSeg(rd, now)
  const ihor   = br.findSeg(rd, hor)
  let d = "M"+nXSc(now*SMS)+" "+nYSc(br.rdf(rd, now))
  for (let i = itoday; i < ihor; i++) {
    d += " L"+nXSc(rd[i].end[0]*SMS)
         +" "+nYSc(rd[i].end[1])
  }
  d += " L"+nXSc(hor*SMS)+" "+nYSc(br.rdf(rd, hor))
  d += " L"+nXSc(hor*SMS)+" "+nYSc(yedge)
  d += " L"+nXSc(now*SMS)+" "+nYSc(yedge)
  d += " Z"
  gPinkPat.attr("patternTransform", gol.dir > 0 ? "rotate(135)" : "rotate(45)")
          .attr("x", -gol.dir*nXSc(now*SMS))
  
  if (pinkelt.empty()) {
    gPink.append("svg:path").attr("class",        "pinkregion")
                            .attr("d",            d)
                            .attr("fill-opacity", 0.4)
                            .attr("fill",         color)
  } else {
    pinkelt.attr("d", d).attr("fill", color)
  }
}

// This stands separate from updateYBHP because we need to use it for the "old",
// unedited road as well. This now supports a delta argument for the maxflux
// line, and a dash argument for the editor version. If scol == null, then the
// element is deleted to clean up leftovers from earlier draws.
// TODO: rename this to updateRazrRoad or updateYBR
function updateRedline(rd, g, gelt, cls, delta, usedash) {
  if (processing || opts.divGraph == null || road.length == 0) return
  
  const roadelt = gelt.select("."+cls)
  if (delta == null) {
    roadelt.remove()
    return
  }

  //const sg   = (!opts.roadEditor)
  const dash = (opts.oldRoadLine.dash)+","+ceil(opts.oldRoadLine.dash/2)
  const sda  = usedash?dash:null // stroke-dasharray

  // fx,fy: Start of the current line segment
  // ex,ey: End of the current line segment
  let fx = nXSc(rd[0].sta[0]*SMS), fy = nYSc(rd[0].sta[1]+delta)
  let ex = nXSc(rd[0].end[0]*SMS), ey = nYSc(rd[0].end[1]+delta)
  if (rd[0].sta[0] < g.tini) {
    fx  = nXSc(g.tini*SMS)
    // Using vini instead of the rdf below does not work for some
    // goals where vini ends up not on the road itself -- uluc
    // But let's do stricter error-checking so we can count on rdf(tini)==vini!
    fy  = nYSc(br.rdf(rd, g.tini)+delta)
    //fy  = nYSc(g.vini+delta)
  }

  if (usedash) {
    // Adjust start of road so dashes are stationary wrt time
    const newx = (-nXSc(g.tini*SMS)) % ceil(1.5*opts.oldRoadLine.dash)
    if (ex !== fx) fy = (fy + (-newx-fx)*(ey-fy)/(ex-fx))
    if (fx < 0 || newx > 0) fx = -newx
  }

  let d = "M"+r1(fx)+" "+(r1(fy))
  for (const segment of rd) {
    // Some goals have non-daysnapped road matrix entries, which
    // breaks the tfin check. This hopefully overcomes that problem
    let segx = bu.daysnap(segment.end[0])
    ex = nXSc(segment.end[0]*SMS)
    if (segx < g.tini) continue
    if (segx > g.tfin) break
    ey = nYSc(segment.end[1]+delta)
    d += " L"+r1(ex)+" "+(r1(ey))
    if (ex > plotbox.width) break
  }
  if (roadelt.empty()) {
    gelt.append("svg:path").attr("class",             cls)
                                 .attr("d",                 d)
                                 .style("stroke-dasharray", sda)
  } else {
    roadelt.attr("d", d).style("stroke-dasharray", sda)
  }
}

/* Determine whether a given line segment intersects the given bounding box.
Follows the algorithm in
https://noonat.github.io/intersect/#axis-aligned-bounding-boxes
The bbox parameter should include the center and the half sizes like so:
  [x_mid, y_mid, w_half, h_half] */
function lineInBBox(line, bbox) {
//  console.log("Intersecting "+JSON.stringify(line.map(e=>[bu.dayify(e[0]), e[1]]))+" with "+JSON.stringify([bu.dayify(bbox[0]-bbox[2]), bbox[1]-bbox[3], bu.dayify(bbox[0]+bbox[2]), bbox[1]+bbox[3]]))
  let delta = [line[1][0] - line[0][0], 
               line[1][1] - line[0][1]]
  const scaleX = 1.0 / delta[0]
  const scaleY = 1.0 / delta[1]
  const signX = Math.sign(scaleX)
  const signY = Math.sign(scaleY)
  const nearTimeX = (bbox[0] - signX * bbox[2] - line[0][0]) * scaleX
  const nearTimeY = (bbox[1] - signY * bbox[3] - line[0][1]) * scaleY
  const farTimeX  = (bbox[0] + signX * bbox[2] - line[0][0]) * scaleX
  const farTimeY  = (bbox[1] + signY * bbox[3] - line[0][1]) * scaleY    
  if (nearTimeX > farTimeY || nearTimeY > farTimeX) return false
  const nearTime = nearTimeX > nearTimeY ? nearTimeX : nearTimeY
  const farTime  = farTimeX  < farTimeY  ? farTimeX  : farTimeY
  if (nearTime > 1 || farTime < 0) return false
  return true
}
  
function isovisible(iso, bbox) {
  if (!iso || !iso.length) return false
  // TODO: For efficiency, limit intersection search to isolines in xrange
  const left  = bbox[0] - bbox[2]
  const right = bbox[0] + bbox[2]
  let a = bu.searchLow(iso, p => p[0] < left  ? -1 : 1)
  let b = bu.searchLow(iso, p => p[0] < right ? -1 : 1)
  if (a < 0) a = 0
  if (b > iso.length - 2) b = iso.length - 2
  for (let i=a; i<=b; i++) if (lineInBBox([iso[i], iso[i+1]], bbox)) return true
  return false
}

// Returns true if two isolines overlap within the specified x range in bbox
function isocompare(isoa, isob, bbox) {
  if (!isoa || !isoa.length || !isob || !isob.length) return false
  const EPS = 1e-5 // or 1e-9 works fine; maybe have it depend on y-values?
  // TODO: For efficiency, limit intersection search to isolines in xrange
  const left  = bbox[0] - bbox[2]
  const right = bbox[0] + bbox[2]
  // Fail if isolines differ on the boundaries. 
  // TODO: This duplicates the boundary search below. Combine.
  if (abs(br.isoval(isoa,  left) - br.isoval(isob,  left)) > EPS ||
      abs(br.isoval(isoa, right) - br.isoval(isob, right)) > EPS) return false
  
  let la = bu.searchHigh(isoa, p => p[0] < left  ? -1 : 1)
  let ra = bu.searchLow( isoa, p => p[0] < right ? -1 : 1)
  let lb = bu.searchHigh(isob, p => p[0] < left  ? -1 : 1)
  let rb = bu.searchLow( isob, p => p[0] < right ? -1 : 1)
  // Evaluate the alternate isoline on inflection points
  for (let i = la; i < ra; i++)
    if (abs(br.isoval(isob, isoa[i][0]) - isoa[i][1]) > EPS) return false
  for (let i = lb; i < rb; i++)
    if (abs(br.isoval(isoa, isob[i][0]) - isob[i][1]) > EPS) return false
  return true
}
  
/* Compute the maximum visible DTD isoline, searching up to the specified limit.
 * Does binary search on the isolines between 0 and limit, checking whether a
 * given isoline intersects the visible graph or not. Since isolines never 
 * intersect each other, this should be guaranteed to work unless the maximum
 * DTD isoline is greater than limit in which case limit is returned. */
let glarr, gllimit = -1 // should be more efficient to not recompute these
function maxVisibleDTD(limit) {
  const isolimit = getiso(limit)
  const xr = [nXSc.invert(0)/SMS         , nXSc.invert(plotbox.width)/SMS]
  const yr = [nYSc.invert(plotbox.height), nYSc.invert(0)]
  const bbox = [(xr[0]+xr[1])/2, (yr[0]+yr[1])/2,
                (xr[1]-xr[0])/2, (yr[1]-yr[0])/2]

  if (limit != gllimit) {
    // For efficiency, only compute the search array when there's a change
    // Eek, looks like it's possible for limit to not be an integer!?
    //console.log(`DEBUG limit=${limit} vs gllimit=${gllimit}`)
    gllimit = limit
    glarr = Array(ceil(limit)).fill().map((x,i)=>i) // sticking in ceil for now
  }

  // If upper limit is visible, nothing to do, otherwise proceed with the search
  if (isovisible(isolimit, bbox)) {
    // TODO: Find the minimum isoline that overlaps with the limit w/in the 
    // visible range.
    const maxdtd = 
      bu.searchHigh(glarr, i=>isocompare(isolimit, getiso(i), bbox) ? 1:-1)
    return min(maxdtd, glarr.length - 1)
  }
  
  const maxdtd = bu.searchLow(glarr, i=>isovisible(getiso(i), bbox) ? -1:1)
  return max(maxdtd, 0)
  // Is it weird that the function to search by is something that itself does
  // a search? Probably Uluc is just a couple levels ahead of me but at some 
  // point I'll want to get my head around that! --dreev
}

function updateGuidelines() {
  if (processing || opts.divGraph == null || road.length == 0) return

  let guideelt = gGuides.selectAll(".guides")
  if (opts.roadEditor && !opts.showGuidelines) {
    guideelt.remove(); return
  }
  
  let skip = 1 // Show only one per this many guidelines
  
  // Create an index array as d3 data for guidelines
  // (Fun fact: the .invert() call returns a javascript date objects but when
  // you divide a Date object by a number that coerces it to a number, namely
  // unixtime in milliseconds. So doing .invert().getTime() is unnecessary.)
  const xrange = [nXSc.invert(            0)/SMS,
                  nXSc.invert(plotbox.width)/SMS]
  const buildPath = ((d,i) =>
                     getisopath(d, [max(gol.tini, xrange[0]),
                                    min(gol.tfin, xrange[1])]))
  
  const lnw = isolnwborder(xrange) // estimate intra-isoline delta
  const lnw_px = abs(nYSc(0) - nYSc(lnw))
  const numdays = (gol.tfin-gol.tini)/SID

  let numlines = maxVisibleDTD(numdays)

  if      (lnw_px>8 || numlines<6*7)        skip = 1   // All lines till 6 weeks
  else if (7*lnw_px>8 || numlines<6*28)     skip = 7    // Weekly lines till 6mo
  else if (28*lnw_px>12 || numlines<2*12*28) skip = 28  // Monthly lines till 2y
  else if (4*28*lnw_px>12 || numlines<6*12*28) skip = 4*28  // 4m lines till 6 y
  else                                   skip = 12*28 // Yearly lines afterwards

  numlines = ceil( numlines/skip )
  //console.log(
  //  `DEBUG delta=${delta} lnw=${lnw} numlines=${numlines} \
  //  yrange=${yrange[0]},${yrange[1]}`)

  // glarr should have been generated by the call to maxVisibleDTD() above
  let arr = glarr.slice(0, numlines+1).map(d => (d+1)*skip-1)

  guideelt = guideelt.data(arr)
  guideelt.exit().remove()
  guideelt.enter().append("svg:path")
    .attr("class",           "guides")
    .attr("d",               buildPath)
    .attr("id",              (d)=>("g"+d))
    .attr("transform",       null)
  guideelt
     .attr("d",               buildPath)
     .attr("id",              (d)=>("g"+d))
     .attr("transform",       null)
}

function updateRazrRoad() {
  if (processing || opts.divGraph == null || road.length == 0) return

  // Razor line differs between the editor (dashed) and the graph (solid). Also,
  // the road editor shows the initial road as the razor road.
  if (opts.roadEditor)
    updateRedline(iroad, igoal, gRazr, "razr", 0, true)
  else
    updateRedline(road, gol, gRazr, "razr", 0, false)
}

function updateMaxFluxline() {
  if (processing || opts.divGraph == null || road.length == 0) return

  // Generate the maxflux line if maxflux!=0. Otherwise, remove existing one
  updateRedline(road, gol, gMaxflux, "maxflux", (gol.maxflux!=0)?gol.yaw*gol.maxflux:null, false)
}

function updateStdFluxline() {
  if (processing || opts.divGraph == null || road.length == 0) return

  // Generate the maxflux line if maxflux!=0. Otherwise, remove existing one
  updateRedline(road, gol, gStdflux, "stdflux", (gol.maxflux!=0)?gol.yaw*gol.stdflux:null, true)
}

  
function updateContextOldRoad() {
  if (processing || opts.divGraph == null || road.length == 0) return
  // Create, update, and delete road lines on the brush graph
  var roadelt = ctxplot.selectAll(".ctxoldroads")
  var rd = iroad
  // For non-editor graphs, use the most recent road
  if (!opts.roadEditor) rd = road
  var d = "M"+r1(xScB(rd[0].sta[0]*SMS))+" "
             +r1(yScB(rd[0].sta[1]))
  for (let i = 0; i < rd.length; i++) {
    d += " L"+r1(xScB(rd[i].end[0]*SMS))+" "
             +r1(yScB(rd[i].end[1]))
  }
  if (roadelt.empty()) {
    ctxplot.append("svg:path")
      .attr("class","ctxoldroads")
      .attr("d", d)
      .style("stroke-dasharray",
             (!opts.roadEditor)?null:(opts.oldRoadLine.ctxdash)+","
             +ceil(opts.oldRoadLine.ctxdash/2))
      .style("fill", "none")
      .style("stroke-width",opts.oldRoadLine.ctxwidth)
      .style("stroke", !opts.roadEditor ? bu.Cols.RAZR0
                                        : bu.Cols.ORNG) // TODO: don't need this
  } else {
    roadelt.attr("d", d)
      .style("stroke-dasharray",
             (!opts.roadEditor)?null:(opts.oldRoadLine.ctxdash)+","
             +ceil(opts.oldRoadLine.ctxdash/2))
      .style("stroke", !opts.roadEditor ? bu.Cols.RAZR0
                                        : bu.Cols.ORNG) // TODO: don't need this
  }
}

// Creates or updates vertical lines for odometer resets
function updateOdomResets() {
  if (processing || opts.divGraph == null || road.length == 0 || bbr.oresets.length == 0)
    return

  // Create, update and delete vertical knot lines
  var orelt = gOResets.selectAll(".oresets").data(bbr.oresets)
  if (opts.roadEditor) { orelt.remove(); return }
  orelt.exit().remove()
  orelt
    .attr("x1", function(d){ return nXSc(d*SMS) })
    .attr("y1", 0)
    .attr("x2", function(d){ return nXSc(d*SMS) })
    .attr("y2", plotbox.height)
  orelt.enter().append("svg:line")
    .attr("class","oresets")
    .attr("id", function(d,i) { return i })
    .attr("name", function(d,i) { return "oreset"+i })
    .attr("x1", function(d){ return nXSc(d*SMS) })
    .attr("y1", 0)
    .attr("x2", function(d){ return nXSc(d*SMS) })
    .attr("y2", plotbox.height)
    .attr("stroke", "rgb(200,200,200)") 
      .style("stroke-dasharray", 
             (opts.odomReset.dash)+","+(opts.odomReset.dash)) 
    .attr("stroke-width",opts.odomReset.width)
}

function updateKnots() {
  if (processing || opts.divGraph == null || road.length == 0) return
  // Create, update and delete vertical knot lines
  var knotelt = gKnots.selectAll(".knots").data(road)
  var knotrmelt = buttonarea.selectAll(".remove").data(road)
  if (!opts.roadEditor) {
    knotelt.remove()
    knotrmelt.remove()
    return
  }
  knotelt.exit().remove()
  knotelt
    .attr("x1", function(d){ return nXSc(d.end[0]*SMS)})
    .attr("y1", 0)
    .attr("x2", function(d){ return nXSc(d.end[0]*SMS)})
    .attr("y2", plotbox.height)
    .attr("stroke", "rgb(200,200,200)") 
    .attr("stroke-width",opts.roadKnot.width)
  knotelt.enter().append("svg:line")
    .attr("class","knots")
    .attr("id", function(d,i) {return i})
    .attr("name", function(d,i) {return "knot"+i})
    .attr("x1", function(d){ return nXSc(d.end[0]*SMS)})
    .attr("x2", function(d){ return nXSc(d.end[0]*SMS)})
    .attr("stroke", "rgb(200,200,200)")
    .attr("stroke-width",opts.roadKnot.width)
    .on('wheel', function(d) {
      // Redispatch a copy of the event to the zoom area
      var new_event = new d3.event.constructor(d3.event.type, d3.event)
      zoomarea.node().dispatchEvent(new_event)
      // Prevents mouse wheel event from bubbling up to the page
      d3.event.preventDefault()
    }, {passive:false})
    .on("mouseover",function(d,i) {
      if (!editingKnot && !editingDot && !editingRoad
         && !(selectType == br.RP.DATE && i == selection)) {
        highlightDate(i,true)
        d3.select(this)
          .attr("stroke-width",(opts.roadKnot.width+2))
      }})
    .on("mouseout",function(d,i) {
      if (!editingKnot && !editingDot && !editingRoad
         && !(selectType == br.RP.DATE && i == selection)) {
        highlightDate(i,false)
        d3.select(this)
          .attr("stroke-width",opts.roadKnot.width);
      }})
    .on("click", function(d,i) { 
      if (d3.event.ctrlKey) knotEdited(d,this.id);})
    .call(d3.drag()
          .on("start", knotDragStarted)
          .on("drag", knotDragged)
          .on("end", knotDragEnded))

  // Create, update and delete removal icons for knots
  knotrmelt.exit().remove()
  knotrmelt
  //                .attr("id", function(d,i) {return i;})
  //              .attr("name", function(d,i) {return "remove"+i;})
    .attr("transform", 
          function(d){ 
            return "translate("+(nXSc(d.end[0]*SMS)
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
            return "translate("+(nXSc(d.end[0]*SMS)
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
  if (processing || opts.divGraph == null || road.length == 0) return;
  //let valid = isRoadValid( road )
  //var lineColor = valid?opts.roadLineCol.valid:opts.roadLineCol.invalid;

  // Create, update and delete road lines
  var roadelt = gRoads.selectAll(".roads").data(road);
  if (!opts.roadEditor) {
    roadelt.remove();
    return;
  }
  roadelt.exit().remove();
  roadelt
    .attr("x1", function(d) { return nXSc(d.sta[0]*SMS) })
    .attr("y1", function(d) { return nYSc(d.sta[1]) })
    .attr("x2", function(d) { return nXSc(d.end[0]*SMS) })
    .attr("y2", function(d) { return nYSc(d.end[1]) })
    .attr("stroke-dasharray",
          function(d,i) { return (i==0||i==road.length-1)?"3,3":"none"})
    .style("stroke",opts.roadLineCol.invalid)
  roadelt.enter()
    .append("svg:line")
    .attr("class","roads")
    .attr("id",   function(d,i) { return i })
    .attr("name", function(d,i) { return "road"+i })
    .attr("x1",   function(d)   { return nXSc(d.sta[0]*SMS) })
    .attr("y1",   function(d)   { return nYSc(d.sta[1]) })
    .attr("x2",   function(d)   { return nXSc(d.end[0]*SMS) })
    .attr("y2",   function(d)   { return nYSc(d.end[1]) })
    .style("stroke", opts.roadLineCol.invalid)
    .attr("stroke-dasharray",
          function(d,i) { return (i==0||i==road.length-1)?"3,3":"none"})
    .attr("stroke-width",opts.roadLine.width)
    .on('wheel', function(d) { 
      // Redispatch a copy of the event to the zoom area
      var new_event = new d3.event.constructor(d3.event.type, d3.event)
      zoomarea.node().dispatchEvent(new_event)
      // Prevents mouse wheel event from bubbling up to the page
      d3.event.preventDefault()
    }, {passive:false})      
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

function updateRoadData() {
  // Recompute dtd array and isolines for the newly edited road. Cannot rely on
  // the beebrain object since its road object will be set to the newly edited
  // road later, once dragging is finished. If this is the first time the goal
  // is being loaded, we can rely on the beebrain object's computation.
  dtd = processing ? gol.dtdarray : br.dtdarray(road, gol)
  iso = []
  // Precompute first few isolines for dotcolor etc to rely on (was 5 not 7)
  for (let i = 0; i < 7; i++) iso[i] = br.isoline( road, dtd, gol, i)
}

function updateRoadValidity() {
  if (processing || opts.divGraph == null || road.length == 0) return
  if (!opts.roadEditor) return
  
  let valid = isRoadValid( road )
  //var lineColor = valid?opts.roadLineCol.valid:opts.roadLineCol.invalid

  if (!valid) gRedTape.attr('visibility', 'visible')
  else gRedTape.attr('visibility', 'hidden')
  
  // Create, update and delete road lines
  //var roadelt = gRoads.selectAll(".roads")
  //roadelt.style("stroke",lineColor)

  //roadelt = ctxplot.selectAll(".ctxroads")
  //roadelt.style("stroke",lineColor)
}

function updateContextRoads() {
  if (processing || opts.divGraph == null || road.length == 0) return
  var lineColor = isRoadValid( road )?
        opts.roadLineCol.valid:opts.roadLineCol.invalid

  // Create, update and delete road lines for the brush 
  var roadelt = ctxplot.selectAll(".ctxroads").data(road);
  if (!opts.roadEditor) {
    roadelt.remove()
    return
  }
  roadelt.exit().remove()
  roadelt
    .attr("x1", function(d){ return xScB(d.sta[0]*SMS)})
    .attr("y1",function(d){ return yScB(d.sta[1])})
    .attr("x2", function(d){ return xScB(d.end[0]*SMS)})
    .attr("y2",function(d){ return yScB(d.end[1])})
    .style("stroke", lineColor);
  roadelt.enter()
    .append("svg:line")
    .attr("class","ctxroads")
    .attr("id", function(d,i) {return i})
    .attr("name", function(d,i) {return "ctxroad"+i})
    .attr("x1", function(d){ return xScB(d.sta[0]*SMS)})
    .attr("y1",function(d){ return yScB(d.sta[1])})
    .attr("x2", function(d){ return xScB(d.end[0]*SMS)})
    .attr("y2",function(d){ return yScB(d.end[1])})
    .style("stroke", lineColor)
    .style("stroke-width",opts.roadLine.ctxwidth)
}

function updateDots() {
  if (processing || opts.divGraph == null) return
  // Create, update and delete inflection points
  var dotelt = gDots.selectAll(".dots").data(road)
  if (!opts.roadEditor) {
    dotelt.remove()
    return
  }
  dotelt.exit().remove()
  dotelt
    .attr("cx", function(d) { return r1(nXSc(d.sta[0]*SMS)) })
    .attr("cy", function(d) { return r1(nYSc(d.sta[1])) })
  dotelt.enter().append("svg:circle")
    .attr("class","dots")
    .attr("id",   function(d,i) { return i-1 })
    .attr("name", function(d,i) { return "dot"+(i-1) })
    .attr("cx",   function(d) { return r1(nXSc(d.sta[0]*SMS)) })
    .attr("cy",   function(d)  { return r1(nYSc(d.sta[1])) })
    .attr("r", r3(opts.roadDot.size))
    .attr("fill", opts.roadDotCol.editable)
    .style("stroke-width", opts.roadDot.border) 
    .on('wheel', function(d) {
      // Redispatch a copy of the event to the zoom area
      var new_event = new d3.event.constructor(d3.event.type, d3.event)
      zoomarea.node().dispatchEvent(new_event)
      // Prevents mouse wheel event from bubbling up to the page
      d3.event.preventDefault()
    }, {passive:false})
    .on("mouseover",function(d,i) { 
      if (!editingKnot && !editingDot && !editingRoad
          && !(selectType == br.RP.VALUE && i-1 == selection)) {
        highlightValue(i-1, true)
        d3.select(this).attr("r", r3(opts.roadDot.size+2))
      }})
    .on("mouseout",function(d,i) { 
      if (!editingKnot && !editingDot && !editingRoad
          && !(selectType == br.RP.VALUE && i-1 == selection)) {
        highlightValue(i-1, false)
        d3.select(this).attr("r", r3(opts.roadDot.size))
      }})
    .on("click", function(d,i) { 
      if (d3.event.ctrlKey) dotEdited(d,this.id)})
    .call(d3.drag()
          .on("start", function(d,i) { 
            dotDragStarted(d, Number(this.id))})
          .on("drag", function(d,i) { 
            dotDragged(d, Number(this.id))})
          .on("end", function(d,i) { 
            dotDragEnded(d, Number(this.id))}))
}
function updateContextDots() {
  if (processing || opts.divGraph == null) return;
  // Create, update and delete inflection points
  var dotelt = ctxplot.selectAll(".ctxdots").data(road);
  if (!opts.roadEditor) {
    dotelt.remove();
    return;
  }
  dotelt.exit().remove();
  dotelt
    .attr("cx", function(d) { return r1(xScB(d.sta[0]*SMS)) })
    .attr("cy",function(d)  { return r1(yScB(d.sta[1])) })
  dotelt.enter().append("svg:circle")
    .attr("class","ctxdots")
    .attr("r", r3(opts.roadDot.ctxsize))
    .attr("fill", opts.roadDotCol.editable)
    .style("stroke-width", opts.roadDot.ctxborder)
    .attr("cx", function(d) { return r1(xScB(d.sta[0]*SMS)) })
    .attr("cy", function(d) { return r1(yScB(d.sta[1])) })
}

let styleLookup = {}
styleLookup[bu.Cols.GRADOT] = " gra",
styleLookup[bu.Cols.GRNDOT] = " grn",
styleLookup[bu.Cols.BLUDOT] = " blu",
styleLookup[bu.Cols.ORNDOT] = " orn",
styleLookup[bu.Cols.REDDOT] = " red",
styleLookup[bu.Cols.BLCK]   = " blk"

function dpStyle( pt ) {
  let sty = ""
  let col = br.dotcolor(road, gol, pt[0], pt[1], iso) 
  if (pt[3] != bbr.DPTYPE.AGGPAST) sty += " fuda"
  sty += styleLookup[col]
  return  sty
}
function dpFill( pt ) {
  return br.dotcolor(road, gol, pt[0], pt[1], iso)
}
function dpFillOp( pt ) {
  return (pt[3] == bbr.DPTYPE.AGGPAST)?null:0.3
}
function dpStrokeWidth( pt ) {
  return (((pt[3] == bbr.DPTYPE.AGGPAST)?1:0.5)*scf)+"px"
}

var dotTimer = null, dotText = null
function showDotText(d) {
  var ptx = nXSc(bu.daysnap(d[0])*SMS)
  var pty = nYSc(d[1])
  var txt = ((d[7]!=null)?"#"+d[7]+": ":"")          // datapoint index
      +moment.unix(d[0]).utc().format("YYYY-MM-DD")  // datapoint time
    +", "+((d[6] != null)?bu.shn(d[6]):bu.shn(d[1])) // datapoint original value
  if (dotText != null) rmTextBox(dotText)
  var info = []
  if (d[2] !== "") info.push("\""+d[2]+"\"")
  if (d[6] !== null && d[1] !== d[6]) info.push("total:"+d[1])
  var col = br.dotcolor(road, gol, d[0], d[1], iso)
  dotText = createTextBox(ptx, pty-(15+18*info.length), txt, col, info )
};
function removeDotText() { rmTextBox(dotText) }

// grp: Container group for the datapoints
  // d: data
  // cls: Class name for selection and creation
  // r: circle radius
  // s: stroke
  // sw: stroke-width
  // f: fill
  // hov: hover support (boolean)
  // fop: fill-opacity
  // nc: new element class
function updateDotGroup(grp,d,cls,nc=null,hov=true) {
  let dpelt

  if (nc == null) nc = cls // Temporary
  
  dpelt = grp.selectAll("."+cls).data(d)
  dpelt.exit().remove()
  dpelt
    .attr("cx", function(d) { return r1(nXSc((d[0])*SMS)) })
    .attr("cy", function(d) { return r1(nYSc(d[1])) })
    .attr("class", nc)
  
  var dots = dpelt.enter().append("svg:circle")
  
    dots.attr("class", nc)
      .attr("cx", function(d) { return r1(nXSc((d[0])*SMS)) })
      .attr("cy", function(d) { return r1(nYSc(d[1])) })
  if (!opts.headless) {
    dots
      .on('wheel', function(d) { 
        // Redispatch a copy of the event to the zoom area
        var new_event = new d3.event.constructor(d3.event.type, d3.event)
        zoomarea.node().dispatchEvent(new_event)
        // Prevents mouse wheel event from bubbling up to the page
        d3.event.preventDefault()
      }, {passive:false})
      .on("mouseenter",function(d) {
        if (opts.divData != null && opts.dataAutoScroll && d[7]!=null)
          selectDataIndex(d[7])
        if (dotTimer != null) window.clearTimeout(dotTimer);
        dotTimer = window.setTimeout(function() {
          showDotText(d); dotTimer = null;
        }, 500);})
      .on("mouseout",function() { 
        unselectDataIndex()
        if (dotText != null) {
          removeDotText();
          dotText = null;
        }
        window.clearTimeout(dotTimer); dotTimer = null;});
  }
}

function updateRosy() {
  if (processing || opts.divGraph == null || opts.roadEditor) return;

  var l = [nXSc.invert(0).getTime()/SMS, 
           nXSc.invert(plotbox.width).getTime()/SMS];
  var df = function(d) {
    return ((d[0] >= l[0] && d[0] <= l[1]) || (d[4] >= l[0] && d[4] <= l[1]));
  }

  // *** Plot rosy lines ***
  var rosyelt = gRosy.selectAll(".rosy")
  var rosydelt = gRosyPts.selectAll(".rd")
  if (opts.showData || !opts.roadEditor) {
    if (gol.rosy) {
      var pts = (bbr.flad != null)
          ?bbr.rosydata.slice(0,bbr.rosydata.length-1):bbr.rosydata
      var npts = pts.filter(df), i
      if (bbr.rosydata.length == 0) {
        // no points are in range, find enclosing two
        var ind = -1;
        for (i = 0; i < bbr.rosydata.length-1; i++) {
          if (bbr.rosydata[i][0]<=l[0]&&bbr.rosydata[i+1][0]>=l[1]) {
            ind = i; break;
          }
        }
        if (ind > 0) npts = bbr.rosydata.slice(ind, ind+2)
      }
      if (npts.length != 0) {
        let d = "M"+r1(nXSc(npts[0][4]*SMS))+" "+r1(nYSc(npts[0][5]))
        for (i = 0; i < npts.length; i++) {
          d += " L"+r1(nXSc(npts[i][0]*SMS))+" "+ r1(nYSc(npts[i][1]))
        }
        if (rosyelt.empty()) {
          gRosy.append("svg:path")
            .attr("class","rosy")
            .attr("d", d)
        } else
          rosyelt.attr("d", d)
          
      } else rosyelt.remove();
      // Rosy dots
      updateDotGroup(gRosyPts, npts, "rd", "rd", true)
    } else {
      rosyelt.remove()
      rosydelt.remove()
    }
  } else {
    rosyelt.remove()
    rosydelt.remove()
  }
}

function updateSteppy() {
  if (processing || opts.divGraph == null) return
  const xmin = nXSc.invert(            0).getTime()/SMS
  const xmax = nXSc.invert(plotbox.width).getTime()/SMS
  const df = function(d) {
    return d[0] >= xmin && d[0] <= xmax ||
           d[4] >= xmin && d[4] <= xmax
  }
  // *** Plot steppy lines ***
  let stpelt  = gSteppy.selectAll(".steppy")
  let stpdelt = gSteppyPts.selectAll(".std")
  if (opts.showData || !opts.roadEditor) {
    if (!opts.roadEditor && gol.steppy && dataf.length !== 0) {
      const npts = dataf.filter(df)
      let i
      if (npts.length === 0) {
        // no points are in range, find enclosing two
        let ind = -1
        for (i = 0; i < dataf.length-1; i++) {
          if (dataf[i][0]   <= xmin && 
              dataf[i+1][0] >= xmax) { ind = i; break }
        }
        if (ind > 0) npts = dataf.slice(ind, ind+2)
      }
      if (npts.length !== 0) {
        let d
        if (dataf[0][0] > xmin && 
            dataf[0][0] < xmax && 
            dataf[0][0] in bbr.allvals) {
          const vpre = bbr.allvals[dataf[0][0]][0][1] // initial datapoint
          d =  "M"+r1(nXSc(dataf[0][0]*SMS))+" "+r1(nYSc(vpre))
          d += "L"+r1(nXSc(npts[0][4]*SMS))+" "+r1(nYSc(npts[0][5]))
        } else {
          d =  "M"+r1(nXSc(npts[0][4]*SMS))+" "+r1(nYSc(npts[0][5]))
        }
        for (i = 0; i < npts.length; i++) {
          d += " L"+r1(nXSc(npts[i][0]*SMS))+" "+ r1(nYSc(npts[i][5]))
          d += " L"+r1(nXSc(npts[i][0]*SMS))+" "+ r1(nYSc(npts[i][1]))
        }
        if (stpelt.empty()) {
          gSteppy.append("svg:path")
            .attr("class","steppy")
            .attr("d", d)
        } else
          stpelt.attr("d", d)

        // Need additional vertical steppy for do-less flatlined datapoints
        let stppprelt = gSteppy.selectAll(".steppyppr")
        if (bbr.flad !== null) {
          if (gol.yaw*gol.dir < 0 && gol.asof !== gol.tdat) {
            const fy = bbr.flad[1] + br.ppr(road, gol, gol.asof)
            d = "M"+r1(nXSc(npts[npts.length-1][0]*SMS))+" "
                   +r1(nYSc(npts[npts.length-1][1]))
            d+=" L"+r1(nXSc(npts[npts.length-1][0]*SMS))+" "+r1(nYSc(fy))
            if (stppprelt.empty()) {
              gSteppy.append("svg:path")
                .attr("class","steppyppr").attr("d", d)
            } else
              stppprelt.attr("d", d)
          } else stppprelt.remove()
        } else stppprelt.remove()
        
      } else stpelt.remove()
      // Steppy points
      updateDotGroup(gSteppyPts, bbr.flad ? npts.slice(0, npts.length-1) : npts,
                     "std", "std", true)
    } else {
      stpelt.remove()
      stpdelt.remove()
    }
  } else {
    stpelt.remove()
    stpdelt.remove()
  }
}

function updateDerails() {
  if (processing || opts.divGraph == null) return

  var l = [nXSc.invert(0).getTime()/SMS, 
           nXSc.invert(plotbox.width).getTime()/SMS]
  
  function ddf(d) {// Filter to extract derailments
    return (d[0] >= l[0] && d[0] <= l[1])
  }

  var drelt
  // *** Plot derailments ***
  if (opts.showData || !opts.roadEditor) {
    var drpts = bbr.derails.filter(ddf)
    var arrow = (gol.yaw>0)?"#downarrow":"#uparrow"
    drelt = gDerails.selectAll(".derails").data(drpts)
    drelt.exit().remove()
    drelt
      .attr("transform", function(d){return "translate("+(nXSc((d[0])*SMS))+","
                                      +nYSc(d[1])+"),scale("
                                      +(opts.dataPoint.fsize*scf/24)+")"})
  
    drelt.enter().append("svg:use")
      .attr("class","derails")
      .attr("xlink:href", arrow)
      .attr("transform", function(d){return "translate("+(nXSc((d[0])*SMS))+","
                                      +nYSc(d[1])+"),scale("
                                      +(opts.dataPoint.fsize*scf/24)+")"})
  } else {
    drelt = gDerails.selectAll(".derails")
    drelt.remove()
  }        
}

function updateDataPoints() {
  if (processing || opts.divGraph == null || road.length == 0) return
  //console.debug("id="+curid+", updateDataPoints()");
  var l = [nXSc.invert(0).getTime()/SMS, 
           nXSc.invert(plotbox.width).getTime()/SMS]
  // Filter to apply to normal datapoints
  var df = function(d) {
    return ((d[0] >= l[0] && d[0] <= l[1]) || (d[4] >= l[0] && d[4] <= l[1]))
  }
  // Filter to apply to all datapoints
  var adf = function(d) {
    return (d[0] >= l[0] && d[0] <= l[1])
  }
  var now = gol.asof
  var dpelt
  if (opts.showData || !opts.roadEditor) {
    var pts = bbr.flad != null ? dataf.slice(0, dataf.length-1) : dataf
    
    // *** Plot datapoints ***
    // Filter data to only include visible points
    pts = pts.filter(df);
    if (gol.plotall && !opts.roadEditor) {
      // All points
      updateDotGroup(gAllpts, alldataf.filter(adf), "ap", d=>("ap"+dpStyle(d)), true)
      
    } else {
      var el = gAllpts.selectAll(".ap");
      el.remove();
    }
    if (opts.roadEditor)
      updateDotGroup(gDpts, pts.concat(bbr.fuda), "dp", d=>("dp"+dpStyle(d)), true)
    else {
      updateDotGroup(gDpts, pts.concat(bbr.fuda), "dp", d=>("dp"+dpStyle(d)), true)
      // hollow datapoints
      updateDotGroup(gHollow, bbr.hollow.filter(df), "hp", d=>("hp"+dpStyle(d)), true)
    }
      
    // *** Plot flatlined datapoint ***
    var fladelt = gFlat.selectAll(".fladp");
    if (bbr.flad != null) {
      const ppr = br.ppr(road, gol, gol.asof)
      const flady = bbr.flad[1] + ppr
      const fop = ppr == 0 ? 1.0 : 0.5 // ghosty iff there's a PPR
      if (fladelt.empty()) {
        gFlat.append("svg:use")
          .attr("class","fladp").attr("xlink:href", "#rightarrow")
          .attr("fill", br.dotcolor(road,gol,bbr.flad[0],flady, iso))
          .attr("fill-opacity", fop)
          .attr("transform", "translate("+(nXSc((bbr.flad[0])*SMS))+","
                +nYSc(flady)+"),scale("+(opts.dataPoint.fsize*scf/24)+")")
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
          .attr("fill", br.dotcolor(road,gol,bbr.flad[0],flady, iso))
          .attr("fill-opacity", fop)
          .attr("transform", 
                "translate("+(nXSc((bbr.flad[0])*SMS))+","
                +nYSc(flady)+"),scale("
                +(opts.dataPoint.fsize*scf/24)+")");
      }
    } else {
      if (!fladelt.empty()) fladelt.remove()
    }
    
  } else {
    dpelt = gDpts.selectAll(".dp");
    dpelt.remove();
    fladelt = gDpts.selectAll(".fladp");
    fladelt.remove();
  }
}

function updateHashtags() {
  if (processing || opts.divGraph == null) return
  
  var hashel
  //if (!opts.roadEditor) {
    hashel = gHashtags.selectAll(".hashtag").data(bbr.hashtags);
    hashel.exit().remove();
    hashel
      .attr("x", function(d){ return nXSc((d[0])*SMS);})
      .attr("transform", d=>("rotate(-90,"+nXSc((d[0])*SMS)
                             +","+(plotbox.height/2)+")"))
      .text(d=>(d[1]))
    hashel.enter().append("svg:text")
      .attr("class","hashtag")
      .attr("x", d=>(nXSc((d[0])*SMS)))
      .attr("y", plotbox.height/2)
      .attr("transform", 
        d => ("rotate(-90,"+nXSc((d[0])*SMS)+","+(plotbox.height/2)+")"))
      .attr("fill", bu.Cols.BLACK) 
      .style("font-size", opts.horizon.font+"px") 
      .text(d => (d[1]))
    
  //} else {
  //  hashel = gHashtags.selectAll(".hashtag")
  //  hashel.remove()
  //}
}


// Other ideas for data smoothing...  Double Exponential
// Moving Average: http://stackoverflow.com/q/5533544 Uluc
// notes that we should use an acausal filter to prevent the
// lag in the thin purple line.
function updateMovingAv() {
  if (processing) return;
  
  var el = gMovingAv.selectAll(".movingav");
  if (!opts.roadEditor && gol.movingav && opts.showData) {
    var l = [nXSc.invert(0).getTime()/SMS, 
             nXSc.invert(plotbox.width).getTime()/SMS];
    var rdfilt = function(r) {
      return ((r.sta[0] > l[0] && r.sta[0] < l[1])
              || (r.end[0] > l[0] && r.end[0] < l[1]));
    };
    var pts = gol.filtpts.filter(function(e){
      return (e[0] > l[0]-2*SID && e[0] < l[1]+2*SID);});
    if (pts.length > 0){
      var d = "M"+r1(nXSc(pts[0][0]*SMS))+" "+r1(nYSc(pts[0][1]))
      for (let i = 1; i < pts.length; i++) {
        d += " L"+r1(nXSc(pts[i][0]*SMS))+" "+r1(nYSc(pts[i][1]))
      }
      if (el.empty()) {
        gMovingAv.append("svg:path")
          .attr("class","movingav")
          .attr("d", d)
          .style("fill", "none")
          .attr("stroke-width",r3(3*scf))
          .style("stroke", bu.Cols.PURP)
      } else {
        el.attr("d", d)
          .attr("stroke-width",r3(3*scf))
      }
    } else el.remove();
  } else {
    el.remove();
  }
}

// Create the table header and body to show road segments
var tcont, thead, tbody;
function createRoadTable() {
  d3.select(opts.divTable).attr("class", "bmndrroad")
  // The main road table doe not have a header
  tcont = d3.select(opts.divTable).select(".rtbmain");
  thead = d3.select(opts.divTable).select(".rtable");
  tbody = thead.append('div').attr('class', 'roadbody');
}

// Create the table header and body to show the start node
var sthead, stbody, sttail
const rtbccls = ["dt", "vl", "sl"]
function createStartTable() {
  var startcolumns, tailcolumns;
  if (opts.roadEditor) {
    startcolumns = ['', 'Start Date', 'Value', '', '']
    tailcolumns = ['', 'End Date', 'Value', 'Daily Slope', '']
  } else {
    startcolumns = ['', 'Start Date', 'Value', '']
    tailcolumns = ['', 'End Date', 'Value', 'Daily Slope']
  }    
  sthead = d3.select(opts.divTable).select(".rtbstart")
  sthead.append("div").attr('class', 'roadhdr')
    .append("div").attr('class', 'roadhdrrow')
    .selectAll("span.rdhdrcell").data(startcolumns)
    .enter().append('span').attr('class', (d,i)=>('rdhdrcell '+rtbccls[i]))
    .text((c)=>c);
  stbody = sthead.append('div').attr('class', 'roadbody'); 
  sttail = sthead.append("div").attr('class', 'roadhdr');
  sttail.append("div").attr('class', 'roadhdrrow')
    .selectAll("span.rdhdrcell").data(tailcolumns)
    .enter().append('span').attr('class', (d,i)=>('rdhdrcell '+rtbccls[i]))
    .text((c)=>c);
}

// Create the table header and body to show the goal node
var ghead, gbody
function createGoalTable() {
  var goalcolumns
  if (opts.roadEditor)
    goalcolumns = ['', 'Goal Date', 'Value', 'Daily Slope', '', '']
  else goalcolumns = ['', 'Goal Date', 'Value', 'Daily Slope']

  ghead = d3.select(opts.divTable).select(".rtbgoal");
  ghead.append("div").attr('class', 'roadhdr')
    .append("div").attr('class', 'roadhdrrow')
    .selectAll("span.rdhdrcell").data(goalcolumns)
    .enter().append('span').attr('class', (d,i)=>('rdhdrcell '+rtbccls[i]))
    .text((c)=>c)
  gbody = ghead.append('div').attr('class', 'roadbody');
}

function updateTableTitles() {
  if (opts.divTable == null) return;
  var ratetext = "Daily Slope";
  if (gol.runits === 'h') ratetext = "Hourly Slope";
  if (gol.runits === 'd') ratetext = "Daily Slope";
  if (gol.runits === 'w') ratetext = "Weekly Slope";
  if (gol.runits === 'm') ratetext = "Monthly Slope";
  if (gol.runits === 'y') ratetext = "Yearly Slope";

  var roadcolumns, goalcolumns
  if (opts.roadEditor) {
    roadcolumns = ['', 'End Date',  'Value', ratetext, '', '']
    goalcolumns = ['', 'Goal Date', 'Value', ratetext, '', '']
  } else {
    roadcolumns = ['', 'End Date',  'Value', ratetext]
    goalcolumns = ['', 'Goal Date', 'Value', ratetext]
  }    
  sttail.selectAll("span.rdhdrcell").data(roadcolumns).text((c)=>c)
  thead.selectAll("span.rdhdrcell").data(roadcolumns).text((c)=>c)
  ghead.selectAll("span.rdhdrcell").data(goalcolumns).text((c)=>c)

  updateTableWidths()
}

let datePicker = null
function destroyDatePicker() {
  if (datePicker != null) {
    if (datePicker.picker) datePicker.picker.destroy()
    datePicker = null
  }
}

// flt: floating element that will contain the date picker
// tl: absolutely positioned "topleft" element that will act as a reference for the floating element,
// fld: d3 selection for the field that holds the date
function createDatePicker(fld, min, max, flt, tl) {
  console.log("createDatePicker()"+min)
  destroyDatePicker()
  datePicker = {
    min: min,
    max: max,
    flt: flt,
    tl: tl,
    fld: fld,
    oldText: fld.text()
  }
  if (onMobileOrTablet()) {
    // Some sort of workaround on mobile browser focus behavior?
    fld.attr("contenteditable", false)
    setTimeout(function() {
      fld.attr("contenteditable", true)}, 100);
  }
  let md = moment(datePicker.oldText)
  datePicker.picker = new Pikaday({
    keyboardInput: false,
    onSelect: function(date) {
      var newdate = datePicker.picker.toString()
      var val = bu.dayparse(newdate, '-')
      if (newdate === datePicker.oldText) return
      if (!isNaN(val)) {
        datePicker.fld.text(newdate)
        datePicker.oldText = newdate
        destroyDatePicker()
        document.activeElement.blur()
      }
    },
    minDate: min,
    maxDate: max
  })
  datePicker.picker.setMoment(md)
  var bbox = fld.node().getBoundingClientRect();
  var tlbox = tl.node().getBoundingClientRect();
  flt
    .style('left', (bbox.right-tlbox.left)+"px")
    .style('top', (bbox.bottom+3-tlbox.top)+"px");
  flt.node().appendChild(datePicker.picker.el, fld.node())
}
   
// Focused field information for the road table
let rdFocus = {
  field: null,
  oldText : null,
}
   
function tableFocusIn( d, i ){
  if (!opts.roadEditor) return;
  console.debug('tableFocusIn('+i+') for '+this.parentNode.id);
  rdFocus.field = d3.select(this);
  rdFocus.oldText = rdFocus.field.text();
  destroyDatePicker()

  var kind = Number(rdFocus.field.node().parentNode.id);
  if (selection != null) clearSelection();
  if (i == 0) {
    selectKnot(kind, false)

    var knotmin = (kind == 0) ? gol.xMin-10*SID*DIY : (road[kind].sta[0])
    var knotmax = (kind == road.length-1) ? road[kind].end[0]
                                          : (road[kind+1].end[0])
    // Switch all dates to local time to babysit Pikaday
    var mindate = moment(moment.unix(knotmin).utc().format("YYYY-MM-DD"))
    var maxdate = moment(moment.unix(knotmax).utc().format("YYYY-MM-DD"))
    var floating = d3.select(opts.divTable).select('.floating');
    createDatePicker(rdFocus.field, mindate.toDate(), maxdate.toDate(), floating, topLeft)
  } else if (i == 1) {
    selectDot(kind, false)
  } else if (i == 2) {
    selectRoad(kind, false)
  }
}

function tableFocusOut( d, i ){
  if (!opts.roadEditor) return;
  //console.debug('tableFocusOut('+i+') for '+this.parentNode.id);
  let kind = Number(this.parentNode.id)
  let text = d3.select(this).text()
  destroyDatePicker()
  clearSelection()
  if (text === rdFocus.oldText) return
  if (rdFocus.oldText == null) return // ENTER must have been hit
  let val = (i==0 ? bu.dayparse(text, '-') : text)
  if (isNaN(val)) {
    d3.select(this).text(rdFocus.oldText)
    rdFocus.oldText = null
    rdFocus.field = null
    return
  }
  if (i == 0) { tableDateChanged(  kind, val);  clearSelection() }
  if (i == 1) { tableValueChanged( kind, val);  clearSelection() }
  if (i == 2) { tableSlopeChanged( kind, val);  clearSelection() }
  rdFocus.oldText = null
  rdFocus.field = null
}
function tableKeyDown( d, i ){
  if (d3.event.keyCode == 13) {
    window.getSelection().removeAllRanges()
    var text = d3.select(this).text()
    var val = (i==0 ? bu.dayparse(text, '-') : text)
    if (isNaN(val)) {
      d3.select(this).text(rdFocus.oldText)
      rdFocus.oldText = null
      return
    }
    if (i == 0) tableDateChanged(  Number(this.parentNode.id), val)
    if (i == 1) tableValueChanged( Number(this.parentNode.id), val)
    if (i == 2) tableSlopeChanged( Number(this.parentNode.id), val)
    rdFocus.oldText = d3.select(this).text()
  }
}
function tableClick( d, i ){
  var id = Number(this.parentNode.id)
  if (opts.roadEditor && i == road[id].auto) {
    if (i == 0) disableValue(id)
    else if (i == 1) disableSlope(id)
    else if (i == 2) disableDate(id)
    this.focus()
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

  function autoScroll( elt, force = true ) {
  if (opts.tableAutoScroll && selection == null && opts.tableHeight !== 0) {
    let rect = elt.node().parentNode.getBoundingClientRect()
    if (rect.height == 0) return // Table is most likely invisible
    let eltdata = elt.data(), eh = (rect.height+1)//+1 table border-spacing
    let eind = (eltdata[0].i-1),  topPos = eind*eh
    if (opts.divTable != null) {
      let nd = tcont.node()
      let offset = (eind - Math.floor(nd.scrollTop / eh))*eh
      if (force || (offset < 0 || offset-eh > opts.tableHeight))
        nd.scrollTop = topPos-opts.tableHeight/2
    }
  }
}
/** Highlights the date for the ith knot if state=true. Normal color otherwise*/
function highlightDate(i, state, scroll = true) {
  if (opts.divTable == null) return;
  let color = (state)
      ?opts.roadTableCol.bgHighlight:
      (road[i].auto==0?opts.roadTableCol.bgDisabled:opts.roadTableCol.bg);
  let elt = d3.select(opts.divTable)
      .select('.roadrow [name=enddate'+i+']');
  if (elt.empty()) return;
  elt.style('background-color', color);
  if (scroll && state) autoScroll(elt);
}
function highlightValue(i, state, scroll = true) {
  if (opts.divTable == null) return;
  var color = (state)
        ?opts.roadTableCol.bgHighlight:
        (road[i].auto==1?opts.roadTableCol.bgDisabled:opts.roadTableCol.bg);
  var elt = d3.select(opts.divTable)
        .select('.roadrow [name=endvalue'+i+']');
  if (elt.empty()) return;
  elt.style('background-color', color);
  if (scroll && state) autoScroll(elt);
}
function highlightSlope(i, state, scroll = true) {
  if (opts.divTable == null) return;
  var color = (state)
        ?opts.roadTableCol.bgHighlight:
        (road[i].auto==2?opts.roadTableCol.bgDisabled:opts.roadTableCol.bg);
  var elt = d3.select(opts.divTable)
        .select('.roadrow [name=slope'+i+']');
  if (elt.empty()) return;
  elt.style('background-color', color);  
  if (scroll && state) autoScroll(elt);
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
        .selectAll(".rtbstart .roadrow, .rtable .roadrow, .rtbgoal .roadrow")
  var btncells = allrows.selectAll(".rdbtn")
        .data(function(row, i) {
          // The table row order is reversed, which means that the
          // last road segment comes in the first row.  We need to
          // compute knot index accordingly
          var kind
          if (opts.reverseTable) kind = road.length-2-i
          else kind = i
          return [
            {order: 8, row:kind, name: "btndel"+kind, evt: ()=>removeKnot(kind,false), 
             type: 'button', txt: '<img class="ricon" src="../src/trash.svg" ></img>', auto: false},
            {order: 9, row:kind, name: "btnadd"+kind, evt: ()=>addNewKnot(kind+1),
             type: 'button', txt: '<img class="ricon" src="../src/plus.svg"></img>', auto: false},
          ];
        })
  
  var newbtncells = btncells.enter().append("button")
      .attr('class', (d)=>('rdbtn '+d.txt))
      .attr('id',   (d) => d.row)
      .attr('name', (d) => d.name)
      .html((d) => { 
        return d.txt
      })
      .on('click', (d) => d.evt())
  
  btncells.exit().remove()
  btncells = allrows.selectAll(
    ".rtbstart .rdbtn, .rtable .rdbtn, .rtbgoal .rdbtn")
  btncells
    .attr('id', (d)=>d.row)
    .attr('name', (d)=>d.name)
    .style('display', (d,i) =>
           (((Number(d.row)>0 && Number(d.row)<(road.length-2)) 
             || i==4 
             || (i>0 && Number(d.row)>0 ))?null:"none")
          )

  allrows.selectAll(".rdcell, .rdbtn")
    .sort((a,b)=>d3.ascending(a.order,b.order))

  if (!opts.roadEditor) {
    allrows.selectAll(".rdbtn").style('display', "none")
      .attr("value","")
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
  var cells = rows.selectAll(".rdcell")
      .data((row, i) => {
        var datestr = bu.dayify(row.end[0], '-')
        var ri = ifn(s+i)
        return [
          {order: 2, value: datestr, name: "enddate"+(ri), 
           auto: (row.auto==br.RP.DATE), i:ri},
          {order: 4, value: bu.shn(row.end[1]), name: "endvalue"+(ri), 
           auto: (row.auto==br.RP.VALUE), i:ri},
          {order: 6, value: isNaN(row.slope)
           ?"duplicate":bu.shn(row.slope*gol.siru), name: "slope"+(ri), 
           auto: (row.auto==br.RP.SLOPE), i:ri}]
      });
   cells.enter().append("div").attr('class', (d,i)=>('rdcell '+rtbccls[i]))
    .attr('name', (d)=>d.name)
    .attr("contenteditable", 
      (d,i) =>((d.auto || !opts.roadEditor)?'false':'true'))
    .on('click', tableClick)
    .on('focusin', tableFocusIn)
    .on('focusout', tableFocusOut)
    .on('keydown', tableKeyDown)

   cells.exit().remove()
   cells = rows.selectAll(".rdcell")
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
  if (opts.divTable == null || hidden) return;
  if (road.length > 3) {
    if (!tbody.node().offsetParent) return
    d3.select(opts.divTable)
      .style("width", (tbody.node().offsetWidth+35)+"px")
    
  } else {
    if (!gbody.node().offsetParent) return
    d3.select(opts.divTable)
      .style("width", (gbody.node().offsetWidth+35)+"px")
  }
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
    d3.select(opts.divTable).select(".rtbmain").style("display", "none")
  } else {
    sttail.style("visibility", null)
    d3.select(opts.divTable).select(".rtbmain").style("display", null)
  }

  updateTableWidths()
}

/** Updates table */
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


// Updates style info embedded in the SVG element for datapoints.
// This is called once at the beginning and whenever scf changes
function updateDynStyles() {
  let s = "", svgid = "#svg"+curid+" "
  let pe = "pointer-events:"+((opts.headless)?"none;":"all;")
  
  s += svgid+".rd {r:"+r3(opts.dataPoint.size*scf)+"px} "
  s += svgid+".std {r:"+r3((opts.dataPoint.size+2)*scf)+"px} "
  s += svgid+".ap {r:"+r3(0.7*(opts.dataPoint.size)*scf)+"px;"+pe+"} "
  s += svgid+".hp {r:"+r3(opts.dataPoint.hsize*scf)+"px;"+pe+"} "
  s += svgid+".guides {stroke-width:"+r3(opts.guidelines.width*scf)+"px} "
  s += svgid+".rosy {stroke-width:"+r3(4*scf)+"px} "
  s += svgid+".steppy {stroke-width:"+r3(4*scf)+"px} "
  s += svgid+".steppyppr {stroke-width:"+r3(4*scf)+"px} "
  s += svgid+".maxflux {fill:none;stroke:"+bu.Cols.BIGG+";stroke-width:"+r3(opts.maxfluxline*scf)+"px} "
  s += svgid+".stdflux {fill:none;stroke:"+bu.Cols.BIGG+";stroke-width:"+r3(opts.stdfluxline*scf)+"px} "
  
  // Styles that depend on the road editor
  if (opts.roadEditor) {
    // Datapoints
    s += svgid+".dp {r:"+r3(opts.dataPoint.size*scf)+"px;stroke:"
      +opts.dataPointCol.stroke+";stroke-width:"+r3(opts.dataPoint.border*scf)+"px} "
    s += svgid+".razr {fill:none;pointer-events:none;stroke-width:"+r3(opts.razrline*scf)+"px;stroke:"+bu.Cols.RAZR0+"} "
  } else {
    s += svgid+".dp {r:"+r3(opts.dataPoint.size*scf)+"px;stroke:rgb(0,0,0);stroke-width:"+r3(1*scf)+"px} "
    s += svgid+".dp.fuda {stroke-width:"+r3(0.5*scf)+"px} "
    s += svgid+".razr {fill:none;pointer-events:none;stroke-width:"+r3(opts.razrline*scf)+"px;stroke:"+bu.Cols.REDDOT+"} "
  }
  d3.select("style#dynstyle"+curid).text(s)
}

function updateGraphData(force = false) {
  if (opts.divGraph == null) return
  clearSelection()
  const limits = [nXSc.invert(            0).getTime()/SMS, 
                  nXSc.invert(plotbox.width).getTime()/SMS]
  if (force) oldscf = 0
  scf = opts.roadEditor ? 
    bu.clip(bu.rescale(limits[1], limits[0],limits[0]+73*SID, 1,.7 ), .7,  1) :
    bu.clip(bu.rescale(limits[1], limits[0],limits[0]+73*SID, 1,.55), .55, 1)

  if (scf != oldscf) updateDynStyles()
  
  //updateRoadData()
  updateRoadValidity()
  updateWatermark()
  updatePastBox()
  updateYBHP()
  updatePinkRegion()
  updateGuidelines()
  updateRazrRoad()
  updateMaxFluxline()
  updateStdFluxline()
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
  zoomarea.attr('color', br.dotcolor(road, gol, gol.tcur, gol.vcur, iso))

  // Store the latest scale factor for comparison. Used to
  // eliminate unnecessary attribute setting for updateDotGroup
  // and other update functions
  oldscf = scf
}

createGraph()
createTable()
createDueBy()
createDataTable()
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
      alldataf = alldata.filter((e)=>(e[0]>(gol.asof-opts.maxDataDays*SID)))
      dataf = data.filter((e)=>(e[0]>(gol.asof-opts.maxDataDays*SID)))
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
      d3.select(opts.divTable).select(".rtbgoal").raise()
      d3.select(opts.divTable).select(".rtbmain").raise()
      d3.select(opts.divTable).select(".rtbstart").raise()
    } else {
      d3.select(opts.divTable).select(".rtbstart").raise()
      d3.select(opts.divTable).select(".rtbmain").raise()
      d3.select(opts.divTable).select(".rtbgoal").raise()
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

/** Undoes all edits */
this.undoAll = () => {
  if (!opts.roadEditor) return
  road = undoBuffer.shift()
  clearUndoBuffer()
  bbr.setRoadObj(road) // Since popped version is a copy, must inform beebrain
  roadChanged()
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
    .catch(function(err){
      console.log(err.stack)
    })
}

/** Initiates loading a new goal from the supplied object.
 Expected input format is the same as beebrain. The goal graph and
 road matrix table are updated accordingly.
@param {object} json Javascript object containing the goal BB file contents*/
this.loadGoalJSON = ( json, timing = true ) => {
  removeOverlay()
  loadGoal( json, timing )
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
    road[firstseg].end[0] = bu.daysnap(road[firstseg].end[0]+days*SID)
    for (j = firstseg+1; j < road.length; j++) {
      road[j].sta[0] = bu.daysnap(road[j].sta[0]+days*SID)
      road[j].end[0] = bu.daysnap(road[j].end[0]+days*SID)
    }
    // Now, create and add the end segment if the value of the
    // subsequent endpoint was different
    if (road[firstseg].sta[1] != road[firstseg].end[1]) {
      var segment = {}
      segment.sta = road[firstseg].sta.slice()
      segment.sta[0] = bu.daysnap(segment.sta[0]+days*SID)
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
    var endtime = bu.daysnap(road[firstseg].sta[0]+days*SID)
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
  var horseg = br.findSeg(road, gol.horizon)
  if (road[horseg].sta[0] == gol.horizon || horseg < road.length-2) {
    // There are knots beyond the horizon. Only adjust the last segment
    pushUndoState()
  } else {
    addNewDot(gol.horizon)
  }
  road[road.length-2].slope = newSlope
  br.fixRoadArray( road, br.RP.VALUE, false )
  roadChanged()
}

/** Returns an object with an array ('road') containing the current roadmatix
 (latest edited version), as well as the following members:<br/>
 <ul>
 <li><b>valid</b>: whether edited road intersects the pink region or not</li>
 <li><b>loser</b>: whether edited road results in a derailed goal or not</li>
 <li><b>asof</b>: unix timestamp for "now"</li>
 <li><b>horizon</b>: unix timestamp for the current akrasia horizon</li>
 <li><b>siru</b>: seconds in rate units</li>
 </ul>
*/
this.getRoad = () => {
  function dt(d) { return moment.unix(d).utc().format("YYYYMMDD")}
  // Format the current road matrix to be submitted to Beeminder
  var r = {}, seg, rd, kd
  if (road.length == 0) {
    console.log("bgraph("+curid+"):getRoad(), road is empty!")
    return null
  }
  r.valid = isRoadValid(road)
  r.loser = br.redyest(road, gol, gol.tcur) // TODO: needs iso here
  r.asof = gol.asof
  r.horizon = gol.horizon
  r.siru = gol.siru
  //r.tini = dt(road[0].end[0])
  //r.vini = road[0].end[1]
  r.road = []
  for (let i = 0; i < road.length-1; i++) {
    seg = road[i]
    if (seg.sta[0] == seg.end[0] && seg.sta[1] == seg.end[1])
      continue
    kd = moment.unix(seg.end[0]).utc()
    rd = [kd.format("YYYYMMDD"), seg.end[1], seg.slope*gol.siru]
    if (seg.auto == br.RP.DATE) rd[2] = null // Exception here since roadall does not support null dates
    if (seg.auto == br.RP.VALUE) rd[1] = null
    if (seg.auto == br.RP.SLOPE) rd[2] = null
    //if (i == road.length-2) {
    //    r.tfin = rd[0]
    //    r.vfin = rd[1]
    //    r.rfin = rd[2]
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
  // retrieve svg source as a string
  const svge = svg.node()
  const serializer = new XMLSerializer()
  let source = serializer.serializeToString(svge)

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
    //defs.select('style').remove()

    // add name spaces
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source= source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
    }
    if (!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
      source = source.replace(/^<svg/, 
                              '<svg xmlns:xlink="http://www.w3.org/1999/xlink"')
    }

    //add xml declaration
    source = '<?xml version="1.0" standalone="no"?>\n' + source

    //convert svg source to URI data scheme.
    var url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source)

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
  updateGraphData(true)
}

this.loading = (flag) => {
  if (flag) showOverlay(['loading...'], sh/10)
  else removeOverlay()
}
/** Returns the road matrix object (in the internal format) for the
    goal. Primarily used to synchronize two separate graph
    instances on the same HTML page. 
    @return {object} Internal road object
    @see bgraph#setRoadObj
*/
this.getRoadObj = () => br.copyRoad(road)

this.getGoalObj = () => (gol)

/** Flag to indicate whether we are within a call to
 * setRoadObj(). Prevents repeated calls to beebrain.reloadRoad()
 * since beebrain.setRoadObj() already calls reloadRoad()*/
var settingRoad = false

/** Sets the road matrix (in the internal format) for the
    goal. Primarily used to synchronize two separate graph
    instances on the same HTML page. Should only be called with
    the return value of {@link bgraph#getRoadObj}.
    @param {object} newroad Road object returned by {@link bgraph#getRoadObj}
    @param {Boolean} [resetinitial=false] Whether to set the internal "initial road" as well
    @see bgraph#getRoadObj
*/
this.setRoadObj = ( newroad, resetinitial = false ) => {
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
    // Warning: If the initial road is reset, tini might not be
    // updated since its update in roadChanged() relies on the
    // previous tini and the first road element being the same
    iroad = br.copyRoad(newroad)
    clearUndoBuffer()
  }
  bbr.setRoadObj(newroad)
  roadChanged()
  settingRoad = false
}

/** Checks whether the goal is currently in a derailed state
    @returns {Boolean} 
*/
this.isLoser = () => {
  if (gol && road.length != 0)
    return br.redyest(road, gol, gol.tcur) // TODO: needs iso here
  else return false
}

this.getProgress = () => {
  return [[bu.dayify(gol.tini,'-'), gol.vini], [bu.dayify(gol.tcur,'-'), gol.vcur], [bu.dayify(gol.tfin,'-'), gol.vfin]]
}
  
/** Returns current goal state
    @returns {object} Current goal state as [t, v, r, rdf(t)] or null if no goal
*/
this.curState =
  () => (gol ? [gol.tcur, gol.vcur, gol.rcur, br.rdf(road, gol.tcur)] : null)

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
this.getVisualConfig = ( ) =>{
  var out = {}
  visualProps.map(e=>{ out[e] = gol[e] })
  return out
}

/** Returns a flag indicating whether external image references on
 * the svg have finished loading or not */
this.xlinkLoaded = () => xlinkloaded

/** @typedef GoalProperties
    @global
    @type {object}
    @property {Boolean} yaw Which side of the YBR you want to be on, +1 or -1
    @property {Boolean} dir Which direction you'll go (usually same as yaw)
    @property {Boolean} kyoom Cumulative; plot vals as sum of those entered so far
    @property {Boolean} odom Treat zeros as accidental odom resets
    @property {Boolean} monotone Whether data is necessarily monotone
    @property {String} aggday Aggregation function for the day's official value
*/
const goalProps
      = ['yaw','dir','kyoom','odom','monotone','aggday']
/** Returns properties for the currently loaded goal
    @returns {GoalProperties} 
    @see {@link bgraph#getVisualConfig}
 */
this.getGoalConfig = ( ) => {
  let out = {}
  goalProps.map(e => { out[e] = gol[e] })
  return out
}

/** Display supplied message overlaid towards the top of the graph
    @param {String} msg What to display. Use null to remove existing message. */
this.msg = (msg)=>{
  if (!msg) removeOverlay("message")
  else
    showOverlay([msg], 20, null, {x:sw/20, y:10, w:sw*18/20, h:50},
                "message", false, true, svg)
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
/** Animates YBHP lines at 1, 2 and 6 days
    @method
    @param {Boolean} enable Enables/disables animation */
this.animYBHPlines = animYBHPlines
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

} // END bgraph object constructor ---------------------------------------------

return bgraph

})) // END MAIN ----------------------------------------------------------------
