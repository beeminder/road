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
;((function (root, factory) {
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
    module.exports = factory(require('moment'), require('./butil'), 
                             require('./broad'), require('./beebrain'))
  } else {
    //console.log("btest: Using Browser globals")
    root.btest = factory(root.moment, root.butil, root.broad, root.beebrain)
  }
})(this, function (moment, bu, br, bb) {
  'use strict'

  var btest = function() {
    var self = this

    self.compareOutputs = function(stats, bbr) {
      var valid = true, numeric = false, summary = false, str = ""
      if (stats['error'] != "") {
        str += "Processing error: "+stats['error']+"<br/>\n"
        return {valid: false, numeric: false, summary: false, result: str}
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
                +bbr[prop]+ "<br/>\n<tt>&nbsp;js:</tt>"+stats[prop]+"<br/>\n"
              valid = false
            }
          } else if (!(stats[prop] === bbr[prop])) {
            if (bu.nummy(stats[prop]) && bu.nummy(bbr[prop])) {
              str += "Numeric value <b>"+prop+"</b> differs:<br/>\n<tt>&nbsp;py:</tt>"
                +bbr[prop]+ "<br/>\n<tt>&nbsp;js:</tt>"+stats[prop]+"<br/>\n"
              numeric = true
              if (Math.abs(bbr[prop]-stats[prop]) > 1e-8)
                valid = false
            } else if (prop.endsWith("sum")) {
              str += "Summary string <b>"+prop+"</b> differs:<br/>\n<tt>&nbsp;py:</tt>"
                +bbr[prop]+ "<br/>\n<tt>&nbsp;js:</tt>"+stats[prop]+"<br/>\n"
              summary = true
            } else if ((typeof stats[prop] == 'string') || typeof (bbr[prop] == 'string')) {
              str += "String <b>"+prop+"</b> differs:<br/>\n<tt>&nbsp;py:</tt>"
                +bbr[prop]+ "<br/>\n<tt>&nbsp;js:</tt>"+stats[prop]+"<br/>\n"
              valid = false
            } else
              valid = false
              
          }
        }
      }
      return {valid: valid, numeric: numeric, summary: summary, result: str}
    }

    self.compareWithPybrain = async function( url, pyouturl ) {
      if (url == "") return null;
      var resp = await bu.loadJSON(url);
      var bbr = await bu.loadJSON(pyouturl);

      if (resp != null  && bbr != null) {

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

    self.createDiv = function( cdiv, text, bg=null, top=false ) {
      var ndiv = document.createElement('div')
      ndiv.style.margin = '4px'
      if (bg != null) ndiv.style.background = bg
      if (text != null) ndiv.innerHTML = text
      if (!top) cdiv.appendChild( ndiv )
      else cdiv.prepend( ndiv )
      return ndiv
    }
    
    self.createImg = function( cdiv, href ) {
      var ndiv = document.createElement('img')
      ndiv.src = href
      cdiv.appendChild(ndiv)
      return ndiv
    }
    
    self.graphCompare = async function( opts ) {
      if (!opts.hasOwnProperty("div") || !opts.hasOwnProperty("goal")
          || !opts.hasOwnProperty("baseurl") || !opts.hasOwnProperty("abspath")) {
        console.log("btest.graphCompare(): Missing div, goal, baseurl or abspath options")

        return
      }

      var div = opts.div
      var g = opts.goal
      var bburl = opts.baseurl+"/"
      var jsurl = opts.baseurl+"/jsout/"
      var pyurl = opts.baseurl+"/pyout/"
      var inpath= opts.abspath
      var outpath= opts.abspath+"/jsout"
      
      // Prepare div for results
      while (div.firstChild) div.removeChild(div.firstChild);

      var res, info, bg, txt
      res = await self.compareWithPybrain(bburl+g+".bb", pyurl+g+".json");

      if (res == null) {
        txt = "GOAL <b>"+g+"</b> "+" Processing error, some files not found?"
        self.createDiv( div, txt, '#ffaaaa')
      }

      if (res != null) {
        if (res.valid) {
          if (res.numeric || res.summary) {
            info = "[NUMERIC OR SUMMARY ERRORS]"; bg = '#aaaaff'
          } else {
            info = "[EXACT MATCH]";    bg = '#aaffaa'
          }
        } else {
          info = "[OTHER ERRORS]";     bg = '#ffaaaa'
        }
        txt = "Goal <b>"+g+"</b> "+" ("+res.typestr+") "+info
        self.createDiv( div, txt, bg )
        self.createDiv( div, res.result)
      }
      
      self.createDiv( div, "Python beebrain graph:", "yellow" )
      self.createImg( div, pyurl+g+".png" )

      self.createDiv( div, "Javascript beebrain graph:", "yellow" )
      var resp =
          await butil.loadJSON( "http://localhost:8777?slug="+encodeURIComponent(g)+
                                "&inpath="+inpath+"&outpath="+outpath )
      var pythm = null, jsthm = null
      if (resp) {
        self.createImg( div, jsurl+g+".png" )
        self.createDiv( div, "Thumbnails (python, javascript):", "yellow" )
        pythm = self.createImg( div, "" )
        pythm.style.margin="5px"
        pythm.src = pyurl+g+"-thumb.png"

        jsthm = self.createImg( div, "" )
        jsthm.style.margin="5px"
        jsthm.src = jsurl+g+"-thumb.png"
        
      } else self.createDiv( div, "Response is null. Did you start jsbrain_server?" )
      
      self.createDiv( div, "Javascript client-side graph:", "yellow" )
      var gdiv = self.createDiv( div, null )
      var graph = new bgraph({divGraph: gdiv,
                              roadEditor:false,
                              svgSize: { width: 696, height: 453 },
                              focusRect: { x:0, y:0, width:690, height: 453 },
                              ctxRect: { x:0, y:453, width:690, height: 40 },
                              maxFutureDays: 365,
                              showFocusRect: false,
                              showContext: false
                             });
      graph.loadGoal( bburl+g+".bb")
      if (res != null) {
        self.createDiv( div, "Javascript beebrain JSON output:", "yellow" )
        var ndiv = document.createElement('pre')
        ndiv.innerHTML = JSON.stringify(res.stats, null, 1)
        div.appendChild(ndiv)
      }
    }
    self.batchCompare = async function( opts ) {
      if (!opts.hasOwnProperty("div") || !opts.hasOwnProperty("goals")
          || !opts.hasOwnProperty("baseurl")) {
        console.log("btest.batchCompare(): Missing div, goals or baseurl options")
        return
      }
      var div = opts.div
      var g = opts.goals
      var bburl = opts.baseurl+"/"
      var pyurl = opts.baseurl+"/pyout/"

      // Prepare div for results
      while (div.firstChild) div.removeChild(div.firstChild);

      var i, res, info, ex = 0, num = 0, err = 0, bg, txt
      for (i = 0; i < g.length; i++) {
        console.log("btest.batchCompare: Processing "+g[i])
        res = await self.compareWithPybrain(bburl+g[i]+".bb", pyurl+g[i]+".json");
        if (res == null) {
          txt = (i+1)+": GOAL <b>"+g[i]+"</b> "
            +" Processing error, some files not found?  <a href=\"compare_graph.html?base="
            +g[i]+"&path=testbb\" target=\"blank\"=>Click to compare graphs</a>"
          self.createDiv( div, txt, '#ffaaaa')
          err = err+1
          continue
        }
        if (res.valid) {
          if (res.numeric || res.summary) {
            info = "[NUMERIC OR SUMMARY ERRORS]"
            num = num+1
            bg = '#aaaaff'
          } else {
            info = "[EXACT MATCH]"
            ex = ex+1
            bg = '#aaffaa'
          }
        } else {
          info = "[OTHER ERRORS]"
          err = err+1
          bg = '#ffaaaa'
        }
        txt = (i+1)+": GOAL <b>"+g[i]+"</b> "+" ("+res.typestr+") "+info
          +"</br> &nbsp;&nbsp;>>> <a href=\"compare_graph.html?base="+g[i]
          +"&path=testbb\" target=\"blank\"=>Click to compare graphs</a>"
        self.createDiv( div, txt, bg)
        self.createDiv( div, res.result)
      }
      txt = "RESULTS ("+g.length+" goals): Exact matches: "+ex+", Numeric or Summary errors: "
        +num+", critical?: "+err
      var sum = self.createDiv( div, txt, null, true)
      sum.style.border = '2px solid black'
      sum.style.padding = '5px'
    }
  }

  return new btest()
}));
