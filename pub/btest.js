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
    //console.log("btest: Using AMD module definition")
    define(['moment', 'butil', 'broad', 'beebrain'], factory)
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.    
    //console.log("btest: Using CommonJS module.exports")
    module.exports = factory(require('moment'), require('butil'), 
                             require('broad'), require('beebrain'))
  } else {
    //console.log("btest: Using Browser globals")
    root.btest = factory(root.moment, root.butil, root.broad, root.beebrain)
  }
})(this, function (moment, bu, br, bb) {
  'use strict'

  var btest = function() {
    var self = this

    
    self.compareOutputs = function(stats, bbr) {
      var valid = true, numeric = false, str = ""
      if (stats['error'] != "") {
        str += "Processing error: "+stats['error']+"<br/>\n"
        return {valid: false, numeric: false, result: str}
      }
      for (var prop in bbr) {
        if (prop == "proctm" || prop == "thumburl" || prop == "graphurl") continue
        if (!stats.hasOwnProperty(prop)) {
          str += "Prp <b>"+prop+"</b> is missing from the output<br/>\n"
          valid = false
        } else {
          if (Array.isArray(stats[prop])) {
            if (!(bu.arrayEquals(stats[prop],bbr[prop]))) {
              str += "Arr <b>"+prop+"</b> differs:<br/>\n<tt>&nbsp;py:</tt>"
                +stats[prop]+ "<br/>\n<tt>&nbsp;js:</tt>"+bbr[prop]+"<br/>\n"
              valid = false
            }
          } else if (!(stats[prop] === bbr[prop])) {
            if (bu.nummy(stats[prop]) && bu.nummy(bbr[prop])) {
              str += "Numeric value <b>"+prop+"</b> differs:<br/>\n<tt>&nbsp;py:</tt>"
                +stats[prop]+ "<br/>\n<tt>&nbsp;js:</tt>"+bbr[prop]+"<br/>\n"
              numeric = true
              if (Math.abs(bbr[prop]-stats[prop]) > 1e-8)
                valid = false
            } else if ((typeof stats[prop] == 'string') || typeof (bbr[prop] == 'string')) {
              str += "String <b>"+prop+"</b> differs:<br/>\n<tt>&nbsp;py:</tt>"
                +stats[prop]+ "<br/>\n<tt>&nbsp;js:</tt>"+bbr[prop]+"<br/>\n"
              valid = false
            } else
              valid = false
              
          }
        }
      }
      return {valid: valid, numeric: numeric, result: str}
    }

    self.compareWithPybrain = async function( url, pyouturl ) {
      if (url == "") return null;
      var resp = await bu.loadJSON(url);
      var bbr = await bu.loadJSON(pyouturl);

      if (resp != null && bbr != null) {

        var jsb = new bb( resp ),
            stats = jsb.getStats()
        var res = await self.compareOutputs(stats, bbr)
        res.typestr = self.goalTypeString(jsb.goal)
        res.stats = stats;
        res.pyout = bbr;
        return res
      }
      return null
    }

    self.goalTypeString = function( goal ) {
      var r = "<span style=\"color:red\">"
      var g = "<span style=\"color:green\">"
      var b = "<span style=\"color:black\">"
      var e = "</span>"
      var v = (s=>((goal[s]?(b+s+e+","):"")))
      var str = v("kyoom")+v("odom")+v("noisy")+v("steppy")+v("rosy")
          +v("aura")+v("plotall")+v("movingav")+v("hidey")+v("stathead")
      return str.slice(0,str.length-1)
    }

  }

  return new btest()
}));
