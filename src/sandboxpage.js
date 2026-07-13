/* Page controller for the standalone sandbox (views/sandbox.ejs): create a
   dummy goal of a chosen type and experiment with it. Shares helpers with
   the graph editor page via pagekit.js. */

let sandbox, sandboxgr // bsandbox object and its bgraph

// DOM components
let divSandbox, divSandboxRoad, divSandboxDueBy, divSandboxData
let divSandboxProgress, divSandboxSummary
let undoBtnSandbox, redoBtnSandbox, undoCntSandbox, redoCntSandbox
let endSlopeSandbox, slopeTypeSandbox
let gtype, runits, rfin, vini, buffer

// Handles sub-tab button events for the sandbox tools
function openSandboxTab(evt, tabName) {
  openTab(evt, tabName, "stabcontent", "stablinks")
}

// Default rate and starting value for each goal type
const defaults = {
  hustler: {r:1, v:0},
  fatloser: {r:-1, v:70},
  biker: {r:1, v:0},
  drinker: {r:1, v:0},
  gainer: {r:1, v:70},
  inboxer: {r:-1, v:1000}
}

function setDefaults() {
  const sel = gtype.options[gtype.selectedIndex].value
  const dflt = defaults[sel]
  rfin.value = dflt.r
  vini.value = dflt.v
}

// Creates a fresh dummy goal from the creation bar's settings
function newGoal() {
  sandbox.newGoal(gtype.options[gtype.selectedIndex].value,
                  runits.options[runits.selectedIndex].value,
                  rfin.value, vini.value, buffer.checked)
  sandboxgr = sandbox.getGraphObj()
}

function updateCommitFields() {
  const sirunew = parseInt(slopeTypeSandbox.value);
  const road = sandbox.getGraphObj().getRoad();
  const siru = road.siru;
  const rd = road.road;
  endSlopeSandbox.value = butil.shn(rd[rd.length-1][2]*(sirunew/siru));
}

function commitTo() {
  if (isNaN(endSlopeSandbox.value)) return;
  const siru = parseInt(slopeTypeSandbox.value);
  const slope = parseFloat(endSlopeSandbox.value);
  sandbox.newRate(slope / siru);
}

function sandboxChanged() {
  let bufStates = sandbox.undoBufferState();
  if (bufStates.undo === 0)  {
    undoBtnSandbox.disabled = true
  } else {
    undoBtnSandbox.disabled = false;
  }
  undoCntSandbox.textContent = String(bufStates.undo)
  redoCntSandbox.textContent = String(bufStates.redo)
  redoBtnSandbox.disabled = (bufStates.redo === 0)
  updateCommitFields();
  updateProgress(divSandboxProgress, sandbox.getGraphObj())
  updateSummary(divSandboxSummary, sandbox.getGraphObj() )
}

/* Captures Ctrl-Z and Ctrl-Y and routes them to the sandbox. The meta
   (command) key counts too, for Macs, where redo is shift-command-Z.
   (Command-Y is off-limits: browsers use it for History.) */
function documentKeyDown(e) {
  let evtobj = window.event? window.event : e;
  const mod = evtobj.ctrlKey || evtobj.metaKey
  const undoKey = mod && evtobj.keyCode == 90 && !evtobj.shiftKey
  const redoKey = (mod && evtobj.keyCode == 89) ||
                  (mod && evtobj.keyCode == 90 && evtobj.shiftKey)
  if (redoKey) sandbox.redo()
  if (undoKey) sandbox.undo()
}

function initialize() {
  // Locate and save sandbox DOM elements
  divSandbox = document.getElementById('roadsandbox')
  divSandboxRoad = document.getElementById('sandboxroad')
  divSandboxDueBy = document.getElementById('sdueby')
  divSandboxData = document.getElementById('sandboxdata')
  divSandboxProgress = document.getElementById('sprogress')
  divSandboxSummary = document.getElementById('ssummary')
  undoBtnSandbox = document.getElementById("sundo")
  redoBtnSandbox = document.getElementById("sredo")
  undoCntSandbox = document.getElementById("sundocnt")
  redoCntSandbox = document.getElementById("sredocnt")
  endSlopeSandbox = document.getElementById("sendslope")
  slopeTypeSandbox = document.getElementById("sslopetype");

  // Creation bar elements
  gtype = document.getElementById("typeselect")
  runits = document.getElementById("rateunit")
  rfin = document.getElementById("rate")
  vini = document.getElementById("value")
  buffer = document.getElementById("buffer")

  // The corner chips stay open only while clicks land inside
  const chips = document.querySelectorAll("details.gchip");
  document.addEventListener("click", (e) => {
    chips.forEach(d => { d.open &&= d.contains(e.target) });
  });

  // Create the sandbox and seed it with the default goal type
  sandbox = new bsandbox( {divGraph: divSandbox,
                       divTable: divSandboxRoad,
                       divDueby: divSandboxDueBy,
                       divData: divSandboxData,
                       svgSize: { width: 696, height: 453 },
                       focusRect: { x:0, y:0, width:696, height: 453 },
                       ctxRect: { x:0, y:453, width:696, height: 32 },
                       tableHeight:212,
                       showContext: false,
                       onRoadChange: sandboxChanged}, false )
  setDefaults()
  newGoal()

  document.onkeydown = documentKeyDown;
}
