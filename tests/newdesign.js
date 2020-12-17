function openTab(evt, tabName, contid, linkid) {
  // Declare all variables
  var i, tabcontent, tablinks;

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

var graph, editor, sandbox, sandboxgr, gload = true, eload = true, sload = true
let curTab = "graph"
function openMainTab(evt, tabName) {
  openTab(evt, tabName, "tabcontent", "tablinks")
  // The following is necessary because Y axis width handling does not
  // work when the graph is not visible, so we have to call show()
  // after the tab becomes visible
  if (tabName == "graph") {
    graph.show()
    editor.hide()
    sandboxgr.hide()
  } else if (tabName == "editor") {
    graph.hide()
    editor.show()
    sandboxgr.hide()
  } else if (tabName == "sandbox") {
    graph.hide()
    editor.hide()
    sandboxgr.show()
  }
  curTab = tabName
} 

let divGraph, divGraphRoad, divGraphDueBy, divGraphData, divGraphProgress
let divEditor, divEditortable, divEditorDueBy, divEditorData, divEditorProgress
let editorTab, undoBtn, redoBtn
let endSlope, endSlopeSandbox, slopeType, slopeTypeSandbox, submitButton

function openGraphTab(evt, tabName) {
  openTab(evt, tabName, "gtabcontent", "gtablinks")
} 

function openEditorTab(evt, tabName) {
  openTab(evt, tabName, "etabcontent", "etablinks")
} 

function openSandboxTab(evt, tabName) {
  openTab(evt, tabName, "stabcontent", "stablinks")
} 

async function loadGoals(url) {
  let resp = await butil.loadJSON( url )

  await graph.loadGoalJSON( resp )
  await editor.loadGoalJSON( resp )
  await sandbox.loadGoalJSON( resp, [],
                              {onRoadChange: sandboxChanged,
                               svgSize: { width: 696, height: 453 },
                               focusRect: { x:0, y:0, width:696, height: 453 },
                               ctxRect: { x:0, y:453, width:696, height: 32 }})
  sandboxgr = sandbox.getGraphObj()
}

function updateProgress(div, progress) {
  // Remove existing elements
  while (div.firstChild) div.removeChild(div.firstChild)
  let table, row

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

function updateCommitFields(issandbox = false) {
  if (!issandbox) {
    var sirunew = parseInt(slopeType.value);
    var road = editor.getRoad();
    var siru = road.siru;
    var rd = road.road;
    endSlope.value = rd[rd.length-1][2]*(sirunew/siru);
  } else {
    var sirunew = parseInt(slopeTypeSandbox.value);
    var road = sandbox.getGraphObj().getRoad();
    var siru = road.siru;
    var rd = road.road;
    endSlopeSandbox.value = butil.shn(rd[rd.length-1][2]*(sirunew/siru));
  }    
}

function commitTo(issandbox = false) {
  if (!issandbox) {
    if (isNaN(endSlope.value)) return;
    var siru = parseInt(slopeType.value);
    var slope = parseInt(endSlope.value);
    editor.commitTo(slope / siru);
  } else {
    if (isNaN(endSlopeSandbox.value)) return;
    var siru = parseInt(slopeTypeSandbox.value);
    var slope = parseInt(endSlopeSandbox.value);
    sandbox.newRate(slope / siru);
  }    
}

function sandboxChanged() {
  sload = false
  updateCommitFields(true);
  if (sandboxgr) updateProgress(sprogress, sandboxgr.getProgress())
}

function graphChanged() {
  gload = false
  updateProgress(gprogress, graph.getProgress())
}

function editorChanged() {
  eload = false
  if (eload || gload) return
  
  var bufStates = editor.undoBufferState();
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
  updateProgress(eprogress, editor.getProgress())

  var road = editor.getRoad();
  slopeType.value = road.siru;
  updateCommitFields(false);
}

function documentKeyDown(e) {
  var evtobj = window.event? window.event : e;
  console.log(curTab)
  if (curTab == "editor") {
    if (evtobj.keyCode == 89 && evtobj.ctrlKey) editor.redo()
    if (evtobj.keyCode == 90 && evtobj.ctrlKey) editor.undo()
  } else if (curTab == "sandbox") {
    if (evtobj.keyCode == 89 && evtobj.ctrlKey) sandbox.redo()
    if (evtobj.keyCode == 90 && evtobj.ctrlKey) sandbox.undo()
  }
}

function initialize() {
  let roadSelect = document.getElementById('roadselect')
  
  divGraph = document.getElementById('roadgraph')
  divGraphRoad = document.getElementById('graphroad')
  divGraphDueBy = document.getElementById('gdueby')
  divGraphData = document.getElementById('graphdata')
  divGraphProgress = document.getElementById('gprogress')
  divEditor = document.getElementById('roadeditor')
  divEditorRoad = document.getElementById('editorroad')
  divEditorDueBy = document.getElementById('edueby')
  divEditorData = document.getElementById('editordata')
  divEditorProgress = document.getElementById('edprogress')
  divSandbox = document.getElementById('roadsandbox')
  divSandboxRoad = document.getElementById('sandboxroad')
  divSandboxDueBy = document.getElementById('sdueby')
  divSandboxData = document.getElementById('sandboxdata')
  divSandboxProgress = document.getElementById('sprogress')
  editorTab = document.getElementById("editortab")
  undoBtn = document.getElementById("eundo")
  redoBtn = document.getElementById("eredo")
  endSlope = document.getElementById("endslope")
  endSlopeSandbox = document.getElementById("sendslope")
  slopeType = document.getElementById("slopetype");
  slopeTypeSandbox = document.getElementById("sslopetype");
  submitButton = document.getElementById("submit");

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
