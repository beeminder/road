/*!
 * beebrain
 *
 * Dependencies: moment, butil, broad
 * 
 * Javascript implementation of beebrain, provided as a UMD
 * module. Provides a "beebrain" function, which can be used to
 * construct independent beebrain objects each with their unique
 * ID. The constructor accepts a "bb" object as an initial beebrain
 * file input.
 *
 * The following member variables and methods are exported within
 * constructed objects:
 *
 *  id         : beebrain instance ID 
 *  getStats() : return stats object for beebrain output
 *
 * Copyright © 2017 Uluc Saranli
 */
((function (root, factory) {
  'use strict'
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    console.log("btest: Using AMD module definition")
    define(['moment', 'butil', 'broad', 'beebrain'], factory)
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.    
    console.log("btest: Using CommonJS module.exports")
    module.exports = factory(require('moment'), require('butil'), 
                             require('broad'), require('beebrain'))
  } else {
    console.log("btest: Using Browser globals")
    root.btest = factory(root.moment, root.butil, root.broad, root.beebrain)
  }
})(this, function (moment, bu, br, bb) {
  'use strict'

  var btest = function() {
    var self = this

    
    self.compareOutputs = function(stats, bbr) {
      var valid = true, str = ""
      for (var prop in bbr) {
        if (prop == "proctm" || prop == "thumburl" || prop == "graphurl") continue
        if (!stats.hasOwnProperty(prop)) {
          str += "Prp "+prop+" is missing from the output<br/>\n"
          valid = false
        } else {
          if (Array.isArray(stats[prop])) {
            if (!(bu.arrayEquals(stats[prop],bbr[prop]))) {
              str += "Arr "+prop+" differs: "+stats[prop]+ " !== "+bbr[prop]+"<br/>\n"
              valid = false
            }
          } else if (!(stats[prop] === bbr[prop])) {
            str += "Prp "+prop+" differs: "+stats[prop]+ " !== "+bbr[prop]+"<br/>\n"
            valid = false
          }
        }
      }
      return {valid: valid, result: str}
    }
  }

  return new btest()
}));
