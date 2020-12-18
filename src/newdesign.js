// Determine username coming from the node server template
console.log("user = "+username)

/* MISC TOOLS ***************************************/

// Maps graph colors to fot colors
const cols = {"red":butil.Cols.REDDOT,
              "green":butil.Cols.GRNDOT,
              "blue":butil.Cols.BLUDOT,
              "orange":butil.Cols.ORNDOT}

/* TAB CONTROLS ***************************************/

let graph, editor, sandbox, sandboxgr // bgraph and sandbox objects
let gload = true, eload = true, sload = true // Loading states

/* Common function for both main and vertical tabs */
function openTab(evt, tabName, contid, linkid) {
  // Declare all variables
  let i, tabcontent, tablinks;

  // Get all elements with class="tabcontent" and hide them
  tabcontent = document.getElementsByClassName(contid);
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }

  // Get all elements with class="tablinks" and remove the class "active"
  tablinks = document.getElementsByClassName(linkid);
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }

  // Show the current tab, and add an "active" class to the button that opened the tab
  document.getElementById(tabName).style.display = "block";
  if (evt) evt.currentTarget.className += " active";
} 

let curMainTab = "graph"
// Handles tab button events for the main tabs
function openMainTab(evt, tabName) {
  openTab(evt, tabName, "tabcontent", "tablinks")
  // The following is necessary because Y axis width handling does not
  // work when the graph is not visible, so we have to call show()
  // after the tab becomes visible
  if (tabName == "graph") {
    graph.show(); editor.hide(); sandboxgr.hide()
  } else if (tabName == "editor") {
    graph.hide(); editor.show(); sandboxgr.hide()
  } else if (tabName == "sandbox") {
    graph.hide(); editor.hide(); sandboxgr.show()
  }
  curMainTab = tabName
} 

// DOM components for the graph tab
let divGraph,divGraphRoad,divGraphDueBy,divGraphData
let divGraphProgress,divGraphSummary

// DOM components for the editor tab
let divEditor,divEditorTable,divEditorDueBy,divEditorData
let divEditorProgress,divEditorSummary
let editorTab, undoBtn, redoBtn
let endSlope, slopeType, submitButton

// DOM components for the sandboxtab
let divSandbox,divSandboxTable,divSandboxDueBy,divSandboxData
let divSandboxProgress,divSandboxSummary
let sandboxTab, undoBtnSandbox, redoBtnSandbox
let endSlopeSandbox, slopeTypeSandbox

// Handles sub-tab button events for the graph
function openGraphTab(evt, tabName) {
  openTab(evt, tabName, "gtabcontent", "gtablinks")
} 

// Handles sub-tab button events for the editor
function openEditorTab(evt, tabName) {
  openTab(evt, tabName, "etabcontent", "etablinks")
} 

// Handles sub-tab button events for the sandbox
function openSandboxTab(evt, tabName) {
  openTab(evt, tabName, "stabcontent", "stablinks")
} 


// Loads a goal from the specified URL for all tabs
async function loadGoals(url) {
  let resp = await butil.loadJSON( url )

  await graph.loadGoalJSON( resp )
  await editor.loadGoalJSON( resp )
  await sandbox.loadGoalJSON( resp )
  sandboxgr = sandbox.getGraphObj()
}

/* STATS TOOLS ********************************* */
/* Creates/updates progress statistics within the specified div. The
 * second argument comes from bgraph.getProgress() */ 
function updateProgress(div, gr) {
  let progress = gr.getProgress()
  
  // Remove existing elements
  while (div.firstChild) div.removeChild(div.firstChild)
  let table, row

  // Create the top level table
  table = d3.select(div).append('div').attr('class', 'progtable')

  row = table.append('div').attr('class', 'progrow')
  row.append('div').attr('class', 'proghdr').text('START')
  row.append('div').attr('class', 'progcell').text(progress[0][0]+" → "+progress[0][1])

  row = table.append('div').attr('class', 'progrow')
  row.append('div').attr('class', 'proghdr').text('NOW')
  row.append('div').attr('class', 'progcell').text(progress[1][0]+" → "+progress[1][1])

  row = table.append('div').attr('class', 'progrow')
  row.append('div').attr('class', 'proghdr').text('TARGET')
  row.append('div').attr('class', 'progcell').text(progress[2][0]+" → "+progress[2][1])

  let startdate = butil.dayparse(progress[0][0], '-')
  let nowdate = butil.dayparse(progress[1][0], '-')
  let enddate = butil.dayparse(progress[2][0], '-')

  let progdate = Math.round(100*(nowdate-startdate)/(enddate-startdate))
  progdate = Math.min(100, Math.max(0,progdate))
  let progval = Math.round(100*(progress[1][1]-progress[0][1])/(progress[2][1]-progress[0][1]))
  progval = Math.min(100, Math.max(0,progval))
  
  let p1 = d3.select(div).append('div').attr('class', 'progcont')
  p1.append('div').attr('class', 'progbar').style('width', progdate+'%')

  let p2 = d3.select(div).append('div').attr('class', 'progcont')
  p2.append('div').attr('class', 'progbar').style('width', progval+'%')

}

/* Updates the summary div gfor the specified graph */
function updateSummary( div, gr ) {
  let goal = gr.getGoalObj()
  let doommod = "due in"
  while (div.firstChild) div.removeChild(div.firstChild)
  let divObj = d3.select(div)
  matches = goal.limsum.match(/(.*) in ([^\(]*).*/)
  if (!matches) {
    matches = goal.limsum.match(/(.*) (today)/)
    doommod = "due"
  }
  divObj.append('div').attr('class','yoog').text(goal.yoog+":")
  divObj.append('div').attr('class','baremin').text(matches[1])
  divObj.append('div').attr('class','doom-modifier').text(doommod)
  divObj.append('div').attr('class','doom').text(matches[2]).style('background-color', cols[goal.color])
  divObj.append('div').attr('class','pledgepre').text("or pay")
  divObj.append('div').attr('class','pledge').text(goal.waterbux)
  
}

function updateCommitFields(issandbox = false) {
  let sirunew, road, siru, rd
  if (!issandbox) {
    sirunew = parseInt(slopeType.value);
    road = editor.getRoad();
    siru = road.siru;
    rd = road.road;
    endSlope.value = rd[rd.length-1][2]*(sirunew/siru);
  } else {
    sirunew = parseInt(slopeTypeSandbox.value);
    road = sandbox.getGraphObj().getRoad();
    siru = road.siru;
    rd = road.road;
    endSlopeSandbox.value = butil.shn(rd[rd.length-1][2]*(sirunew/siru));
  }    
}

function commitTo(issandbox = false) {
  let siru, slope
  if (!issandbox) {
    if (isNaN(endSlope.value)) return;
    siru = parseInt(slopeType.value);
    slope = parseInt(endSlope.value);
    editor.commitTo(slope / siru);
  } else {
    if (isNaN(endSlopeSandbox.value)) return;
    siru = parseInt(slopeTypeSandbox.value);
    slope = parseInt(endSlopeSandbox.value);
    sandbox.newRate(slope / siru);
  }    
}

function sandboxChanged() {
  sload = false

  let bufStates = sandbox.undoBufferState();
  if (bufStates.undo === 0)  {
    undoBtnSandbox.disabled = true
    undoBtnSandbox.innerHTML = "Undo (0)"
  } else {
    undoBtnSandbox.disabled = false;
    undoBtnSandbox.innerHTML = "Undo ("+bufStates.undo+")";
  }
  if (bufStates.redo === 0)  {
    redoBtnSandbox.disabled = true;
    redoBtnSandbox.innerHTML = "Redo (0)";
  } else {
    redoBtnSandbox.disabled = false;
    redoBtnSandbox.innerHTML = "Redo ("+bufStates.redo+")";
  }
  updateCommitFields(true);
  updateProgress(divSandboxProgress, sandbox.getGraphObj())
  updateSummary(divSandboxSummary, sandbox.getGraphObj() )
}

function graphChanged() {
  gload = false
  updateProgress(divGraphProgress, graph)
  updateSummary(divGraphSummary, graph)
}

function editorChanged() {
  eload = false
  if (eload || gload) return
  
  let bufStates = editor.undoBufferState();
  if (bufStates.undo === 0)  {
    d3.select(editorTab).style('color', 'black').text("Editor")
    submitButton.disabled=true
    undoBtn.disabled = true
    undoBtn.innerHTML = "Undo (0)"
  } else {
    d3.select(editorTab).style('color', 'red').text("Editor ("+bufStates.undo+")")
    submitButton.disabled=false
    undoBtn.disabled = false;
    undoBtn.innerHTML = "Undo ("+bufStates.undo+")";
  }
  if (bufStates.redo === 0)  {
    redoBtn.disabled = true;
    redoBtn.innerHTML = "Redo (0)";
  } else {
    redoBtn.disabled = false;
    redoBtn.innerHTML = "Redo ("+bufStates.redo+")";
  }
  updateProgress(divEditorProgress, editor)

  let road = editor.getRoad();
  slopeType.value = road.siru;
  updateCommitFields(false);
  updateSummary(divEditorSummary, editor)
}

/* Captures Ctrl-Z and Ctrl-Y and routes them to the currently active tab */
function documentKeyDown(e) {
  let evtobj = window.event? window.event : e;
  if (curMainTab == "editor") {
    if (evtobj.keyCode == 89 && evtobj.ctrlKey) editor.redo()
    if (evtobj.keyCode == 90 && evtobj.ctrlKey) editor.undo()
  } else if (curMainTab == "sandbox") {
    if (evtobj.keyCode == 89 && evtobj.ctrlKey) sandbox.redo()
    if (evtobj.keyCode == 90 && evtobj.ctrlKey) sandbox.undo()
  }
}

function initialize() {
  let roadSelect = document.getElementById('roadselect')
  
  // Locate and save graph DOM elements
  divGraph = document.getElementById('roadgraph')
  divGraphRoad = document.getElementById('graphroad')
  divGraphDueBy = document.getElementById('gdueby')
  divGraphData = document.getElementById('graphdata')
  divGraphProgress = document.getElementById('gprogress')
  divGraphSummary = document.getElementById('gsummary')

  // Locate and save editor DOM elements
  divEditor = document.getElementById('roadeditor')
  divEditorRoad = document.getElementById('editorroad')
  divEditorDueBy = document.getElementById('edueby')
  divEditorData = document.getElementById('editordata')
  divEditorProgress = document.getElementById('eprogress')
  divEditorSummary = document.getElementById('esummary')
  editorTab = document.getElementById("editortab")
  undoBtn = document.getElementById("eundo")
  redoBtn = document.getElementById("eredo")
  endSlope = document.getElementById("endslope")
  slopeType = document.getElementById("slopetype");
  submitButton = document.getElementById("submit");

  // Locate and save sandbox DOM elements
  divSandbox = document.getElementById('roadsandbox')
  divSandboxRoad = document.getElementById('sandboxroad')
  divSandboxDueBy = document.getElementById('sdueby')
  divSandboxData = document.getElementById('sandboxdata')
  divSandboxProgress = document.getElementById('sprogress')
  divSandboxSummary = document.getElementById('ssummary')
  sandboxTab = document.getElementById("sandboxtab")
  undoBtnSandbox = document.getElementById("sundo")
  redoBtnSandbox = document.getElementById("sredo")
  endSlopeSandbox = document.getElementById("sendslope")
  slopeTypeSandbox = document.getElementById("sslopetype");

  // Create the graph
  graph = new bgraph({divGraph: divGraph,
                      divTable: divGraphRoad,
                      divDueby: divGraphDueBy,
                      divData: divGraphData,
                      svgSize: { width: 696, height: 453 },
                      focusRect: { x:0, y:0, width:696, height: 453 },
                      ctxRect: { x:0, y:453, width:696, height: 32 },
                      roadEditor:false,
                      tableHeight:212,
                      maxFutureDays: 365,
                      showFocusRect: false,
                      showContext: false,
                      onRoadChange: graphChanged})
  // Create the editor
  editor = new bgraph({divGraph: divEditor,
                       divTable: divEditorRoad,
                       divDueby: divEditorDueBy,
                       divData: divEditorData,
                       svgSize: { width: 696, height: 553 },
                       focusRect: { x:0, y:0, width:696, height: 453 },
                       ctxRect: { x:0, y:453, width:696, height: 100 },
                       roadEditor:true,
                       tableHeight:212,
                       maxFutureDays: 365,
                       showFocusRect: false,
                       showContext: true,
                       onRoadChange: editorChanged})
  editor.showData(document.getElementById("showdata").checked);
  editor.keepSlopes(document.getElementById("keepslopes").checked);

  // Create the sandbox
  sandbox = new bsandbox( {divGraph: divSandbox,
                       divTable: divSandboxRoad,
                       divDueby: divSandboxDueBy,
                       divData: divSandboxData,
                       svgSize: { width: 696, height: 553 },
                       focusRect: { x:0, y:0, width:696, height: 453 },
                       ctxRect: { x:0, y:453, width:696, height: 100 },
                       tableHeight:212,
                       onRoadChange: sandboxChanged}, false )

  loadGoals( roadSelect.value )
  editor.hide()
        
  document.onkeydown = documentKeyDown;
}
