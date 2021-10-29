/**
 * @exports splinefit
 */

;((function (root, factory) { // BEGIN PREAMBLE --------------------------------

'use strict'
if (typeof define === 'function' && define.amd) {
  // AMD. Register as an anonymous module.
  //console.log("splinefit: Using AMD module definition")
  define([], factory)
} else if (typeof module === 'object' && module.exports) {
  // Node. Does not work with strict CommonJS, but only CommonJS-like
  // environments that support module.exports, like Node.    
  //console.log("Polyfit: Using CommonJS module.exports")
  module.exports = factory()
} else {
  //console.log("splinefit: Using Browser globals")
  root.splinefit = factory()
}

})(this, function () { // END PREAMBLE -- BEGIN MAIN ---------------------------

'use strict'

var self = {}

self.fit = (x, y) => {
  if (!((x instanceof Array        && y instanceof Array) ||
        (x instanceof Float32Array && y instanceof Float32Array) ||
        (x instanceof Float64Array && y instanceof Float64Array))) {
    throw new Error('x and y must be arrays of the same type')
  }
  if      (x instanceof Float32Array) { this.FloatXArray = Float32Array }
  else if (x instanceof Float64Array) { this.FloatXArray = Float64Array }
  if (x.length !== y.length) {
    throw new Error('x and y must have the same length')
  }

  return (x) => 0 // stubbed
}

return self

})); // END MAIN ---------------------------------------------------------------
