// Determine username coming from the node server template
let local = false
if (typeof username != 'undefined') {
  console.log("Live version: user = "+username)
} else {
  console.log("Local version: no username")
  local = true
}

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
    if (graph) graph.show()
    if (editor) editor.hide()
    if (sandboxgr) sandboxgr.hide()
  } else if (tabName == "editor") {
    if (graph) graph.hide()
    if (editor) editor.show()
    if (sandboxgr) sandboxgr.hide()
  } else if (tabName == "sandbox") {
    if (graph) graph.hide()
    if (editor) editor.hide()
    if (sandboxgr) sandboxgr.show()
  }
  curMainTab = tabName
} 

let roadSelect

// DOM components for the graph tab
let divGraph,divGraphRoad,divGraphDueBy,divGraphData
let divGraphProgress,divGraphSummary
let dataDate, dataValue, dataComment, dataAdd

// DOM components for the editor tab
let divEditor,divEditorTable,divEditorDueBy,divEditorData
let divEditorProgress,divEditorSummary
let editorTab, undoBtn, redoBtn
let endSlope, slopeType, submitButton, submitMsg

// DOM components for the sandboxtab
let divSandbox,divSandboxTable,divSandboxDueBy,divSandboxData
let divSandboxProgress,divSandboxSummary
let sandboxTab, undoBtnSandbox, redoBtnSandbox
let endSlopeSandbox, slopeTypeSandbox

// Variables for data submission
let datePicker

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
  let resp
  if (graph) graph.loading(true)
  if (editor) editor.loading(true)
  if (sandboxgr) sandboxgr.loading(true)
  if (local) {
    resp = await butil.loadJSON( url )
  } else {
    resp = await butil.loadJSON( "/getgoaljson/"+url )
  }
  if (graph) graph.loading(false)
  if (editor) editor.loading(false)
  if (sandboxgr) sandboxgr.loading(false)
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
  dataDate.value = ""
  setEntryToday()
  dataAdd.disabled = false
}

// Asks for confirmation before leaving page
function editorBeforeUnload(e) {
  e.preventDefault()
  e.returnValue = ''
}

function editorChanged() {
  eload = false
  if (eload || gload) return
  
  let bufStates = editor.undoBufferState();
  
  if (bufStates.undo === 0)  {
    window.removeEventListener('beforeunload', editorBeforeUnload);
    d3.select(editorTab).style('color', 'black').text("Editor")
    submitButton.disabled=true
    undoBtn.disabled = true
    resetBtn.disabled = true
    undoBtn.innerHTML = "Undo (0)"
  } else {
    window.addEventListener('beforeunload', editorBeforeUnload);
    d3.select(editorTab).style('color', 'red').text("Editor ("+bufStates.undo+")")
    submitButton.disabled=false
    undoBtn.disabled = false
    resetBtn.disabled = false
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

  let newRoad = editor.getRoad()
  // Update state of the Submit button depending on road validity
  if (!newRoad) {
    submitButton.disabled = true
    submitMsg.innerHTML = "Ill-defined yellow brick road!"
  } else if (!newRoad.valid) {
    submitButton.disabled = true;
    submitMsg.innerHTML = "Road can't be easier within the horizon!"
  } else if (newRoad.loser) {
    submitButton.disabled = true
    submitMsg.innerHTML = "Submitting this road would insta-derail!"
  } else {
    submitMsg.innerHTML = ""
  }

  slopeType.value = newRoad.siru;
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

function prepareGoalSelect(goals) {
  // Clean up existing options
  for(let i = roadSelect.options.length - 1 ; i >= 0 ; i--) roadSelect.remove(i);
  // Populate the dropdown list with goals
  let c = document.createDocumentFragment(), opt

  if (goals == null) {
    opt = document.createElement("option");
    opt.text = "load failed!";
    opt.value = "load failed!";
    roadSelect.add(opt);
    return
  }
  
  goals.forEach(function(slug,index){
    opt = document.createElement("option");
    opt.text = slug;
    opt.value = slug;
    roadSelect.add(opt);
  });
  roadSelect.value = goals[0];
  loadGoals(roadSelect.value)
}

// Helper Functions. Something about function hoisting?
function loadJSON( url, callback ) {   

  let xobj = new XMLHttpRequest();
  xobj.overrideMimeType("application/json");
  xobj.onreadystatechange = function () {
    if (xobj.readyState == 4 && xobj.status == "200") {
      //if (xobj.readyState == 4) {
      if (xobj.responseText == "") callback(null)
      else
        callback(JSON.parse(xobj.responseText))
    }
  }
  xobj.open('GET', url, true);
  xobj.send(null);  
}

function postJSON( url, data, callback ){
  let xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState == 4 && xhr.status == "200") {
      callback(JSON.parse(xhr.responseText));
    }
  };
  xhr.send(JSON.stringify(data));
}

function handleRoadSubmit() {
  let currentGoal = roadSelect.value;
  let newRoad = editor.getRoad();
  if (!newRoad) {
    window.alert("Road is null! Graph with errors?");
    return;
  }
  if (!newRoad.valid) {
    window.alert(
      "New road intersects pink region (i.e., violates the akrasia horizon)!");
    return;
  }
  if (newRoad.loser) {
    window.alert("New road causes derailment!");
    return;
  }
  if (!local) {
    submitButton.disabled = true
    submitButton.innerHTML = "Submitting..."
    postJSON("/submitroad/"+currentGoal, newRoad, function(resp) {
      submitButton.innerHTML = "Submit Changes"
      
      if (resp.error) {
        submitMsg.innerHTML = "ERROR! \""
          +resp.error+"\". Email support@beeminder.com for more help!";
      } else {
        submitMsg.innerHTML = "(successfully submitted road!)";
        loadGoals(currentGoal)
      }
    })
  } else {
    submitMsg.innerHTML = "<a id=\"download\">Right-click to download SVG</a>";
    editor.saveGraph(document.getElementById('download'));
    window.alert('new road matrix:\n'+JSON.stringify(editor.getRoad()))
  }
}

function handleDataSubmit() {
  let currentGoal = roadSelect.value;
  let date = butil.dayify(butil.dayparse(dataDate.value,'-'))
  let value = dataValue.value
  let comment = dataComment.value
  let params = {"daystamp":date, "value":value, "comment":comment}
  if (isNaN(value) || value == "") {
    window.alert("Invalid value entry");
    return;
  }
  if (!local) {
    dataAdd.disabled = true
    dataAdd.innerHTML = "ADDING..."
    postJSON("/submitpoint/"+currentGoal, params, function(resp) {
      dataAdd.innerHTML = "ADD PROGRESS"
      
      if (resp.error) {
        console.log("ERROR! \""+resp.error)
      } else {
        loadGoals(currentGoal)
      }
    })
  } else {
    submitMsg.innerHTML = "<a id=\"download\">Right-click to download SVG</a>";
    window.alert('new datapoint: \n'+JSON.stringify(params))
  }
}

function setEntryToday() {
  var today=moment().format("YYYY-MM-DD")
  if (!dataDate.value.trim()) datePicker.setDate(today)
}

function initialize() {
  roadSelect = document.getElementById('roadselect')
  
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
  resetBtn = document.getElementById("ereset")
  endSlope = document.getElementById("endslope")
  slopeType = document.getElementById("slopetype");
  submitButton = document.getElementById("submit");
  submitMsg = document.getElementById("submitmsg");

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
  resetBtnSandbox = document.getElementById("sreset")
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
                       showFocusRect: true,
                       showContext: true,
                       onRoadChange: editorChanged})
  editor.showData(document.getElementById("showdata").checked);
  editor.keepSlopes(document.getElementById("keepslopes").checked);

  // Create the sandbox
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

  //loadGoals( roadSelect.value )
  editor.hide()
  
  // If no usernames are configured, just use a deffault list of sample goals
  if (!local) {
    loadJSON('/getusergoals', prepareGoalSelect)
    for(let i = roadSelect.options.length - 1 ; i >= 0 ; i--) roadSelect.remove(i);
    // Populate the dropdown list with goals
    let c = document.createDocumentFragment();
    let opt = document.createElement("option");
    opt.text = "Loading...";
    opt.value = "";
    roadSelect.add(opt);
  } else
    loadGoals(roadSelect.value)

  dataDate = document.getElementById('datadate')
  dataValue = document.getElementById('datavalue')
  dataComment = document.getElementById('datacmt')
  dataAdd = document.getElementById('dataadd')

  datePicker = new Pikaday({field: dataDate})
  setEntryToday()
  
  document.onkeydown = documentKeyDown;
}
