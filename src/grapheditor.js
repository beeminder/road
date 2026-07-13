// Determine username coming from the node server template
let local = false
if (typeof username != 'undefined') {
  console.log("Live version: user = "+username)
} else {
  console.log("Local version: no username")
  local = true
}

/* MODE & TAB CONTROLS (shared helpers live in pagekit.js) ****************/

let graph, editor // bgraph objects for view and edit modes
let gload = true, eload = true // Loading states

let curMode = "graph" // "graph" = view mode, "editor" = edit mode
// Switches between view mode (the plain graph) and edit mode (the editor)
function setMode(evt, mode) {
  openTab(evt, mode, "tabcontent", "modelinks")
  // Landing here without an event (from the #edit hash at load time) means
  // openTab couldn't mark the pressed button active, so do it ourselves
  if (!evt) document.getElementById(mode == "editor" ? "editortab"
                                                     : "graphtab")
                    .className += " active"
  // The following is necessary because Y axis width handling does not
  // work when the graph is not visible, so we have to call show()
  // after the mode becomes visible
  if (mode == "graph") {
    if (graph) graph.show()
    if (editor) editor.hide()
  } else if (mode == "editor") {
    if (graph) graph.hide()
    if (editor) editor.show()
  }
  // Carry the zoom/pan position across the mode switch (same load-flag
  // guards as the summary refresh below: nothing to carry before a goal
  // has loaded)
  if (mode == "graph"  && !eload) graph.setZoomRange(...editor.getZoomRange())
  if (mode == "editor" && !gload) editor.setZoomRange(...graph.getZoomRange())
  curMode = mode
  // The shared summary bar reflects the active mode's engine (the editor
  // may hold pending edits that view mode shouldn't show, and vice versa)
  if (mode == "graph"  && !gload) updateSummary(divSummary, graph)
  if (mode == "editor" && !eload) updateSummary(divSummary, editor)
  // Deep-linkable mode: reflect it in the URL hash
  history.replaceState(null, "", mode == "editor"
    ? "#edit" : location.pathname + location.search)
} 

let roadSelect
let roadTomSelect

// DOM components for the graph tab
let divGraph,divGraphRoad,divGraphDueBy,divGraphData
let divGraphProgress
let dataDate, dataValue, dataComment, dataAdd

// DOM components for the editor tab
let divEditor,divEditorTable,divEditorDueBy,divEditorData
let divEditorProgress
let editorTab, undoBtn, redoBtn, undoCnt, redoCnt
let endSlope, slopeType, submitButton, submitMsg

// The one summary bar, shared by both modes
let divSummary

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


// Loads a goal from the specified URL for all tabs
async function loadGoals(url) {
  // Tom Select fires once with an empty value when the dropdown is first
  // focused; skip that so we don't hit /getgoaljson/ and get a 404:
  if (!url || url.trim() === '') return;
  // Everything numeric on the page still belongs to the previous goal
  // until the new one lands, so gray it all out in the meantime (the
  // graph area shows its own loading overlay)
  document.body.classList.add("goalloading")
  try {
    let resp
    if (graph) graph.loading(true)
    if (editor) editor.loading(true)
    if (local) { resp = await butil.loadJSON( url ) } 
    else       { resp = await butil.loadJSON( "/getgoaljson/"+url ) }
    if (graph) graph.loading(false)
    if (editor) editor.loading(false)
    if (!resp) {
      console.log("Failed to load goal")
      return
    }
    await graph.loadGoalJSON( resp )
    await editor.loadGoalJSON( resp )
  } finally {
    document.body.classList.remove("goalloading")
  }
}

function updateCommitFields() {
  const sirunew = parseInt(slopeType.value);
  const road = editor.getRoad();
  const siru = road.siru;
  const rd = road.road;
  endSlope.value = rd[rd.length-1][2]*(sirunew/siru);
}

function commitTo() {
  if (isNaN(endSlope.value)) return;
  const siru = parseInt(slopeType.value);
  const slope = parseFloat(endSlope.value);
  editor.commitTo(slope / siru);
}

function graphChanged() {
  gload = false
  updateProgress(divGraphProgress, graph)
  updateSummary(divSummary, graph)
  dataDate.value = ""
  setEntryToday()
  dataAdd.disabled = false
}

// Asks for confirmation before leaving page
function editorBeforeUnload(e) {
  e.preventDefault()
  e.returnValue = ''
}

function confirmDataEdit() {
  let bufStates = editor.undoBufferState();
  if (bufStates.undo == 0) return true
  return confirm("Your unsaved changes in the editor will be lost\nAre you sure?")
}

function dataEdited(id, data) {
  let currentGoal = roadSelect.value

  if (!local) {
    let proceed = true
    if (!confirmDataEdit()) return
    if (!data) {
      // Delete datapoint
      deleteJSON("/data/"+currentGoal+"/"+id, {}, function(resp) {
        
        if (resp.error) {
          reportDataActionError(resp)
        } else {
          
          loadGoals(currentGoal)
        }
      })
    } else {
      // Update datapoint
      putJSON("/data/"+currentGoal+"/"+id, {timestamp:data[0], value:data[1], comment:data[2]}, function(resp) {
        
        if (resp.error) {
          reportDataActionError(resp)
        } else {
          loadGoals(currentGoal)
        }
      })
    }
  } else {
    if (!data)
      window.alert("Received request to delete datapoint "+id+".\nDatapoint deletion not yet supported for local-only editing.\n")
    else
      window.alert("Received request to update datapoint "+id+" to ["+butil.dayify(data[0],"-")+","+data[1]+",\""+data[2]+"\"].\nUpdating datapoints is not yet supported for local-only editing.\n")
  }
}

function editorChanged() {
  eload = false
  if (eload || gload) return
  
  let bufStates = editor.undoBufferState()
  
  if (bufStates.undo === 0)  {
    window.removeEventListener('beforeunload', editorBeforeUnload)
    d3.select(editorTab).style('color', 'black').text("Edit")
    submitButton.disabled=true
    undoBtn.disabled = true
  } else {
    window.addEventListener('beforeunload', editorBeforeUnload);
    d3.select(editorTab).style('color', 'red').text("Edit ("+bufStates.undo+")")
    submitButton.disabled=false
    undoBtn.disabled = false
  }
  undoCnt.textContent = String(bufStates.undo)
  redoCnt.textContent = String(bufStates.redo)
  redoBtn.disabled = (bufStates.redo === 0)
  updateProgress(divEditorProgress, editor)

  let newRoad = editor.getRoad()
  // Update state of the Submit button depending on road validity
  if (!newRoad) {
    submitButton.disabled = true
    submitMsg.innerHTML = "Ill-defined bright red line!"
  } else if (!newRoad.valid) {
    submitButton.disabled = true;
    submitMsg.innerHTML = "Bright red line can't be easier within the akrasia horizon!"
  } else if (newRoad.loser) {
    submitButton.disabled = true
    submitMsg.innerHTML = "Submitting would insta-derail (we can't let you do that, Dave)"
  } else {
    submitMsg.innerHTML = ""
  }

  slopeType.value = newRoad.siru;
  updateCommitFields();
  updateSummary(divSummary, editor)
}

/* Captures Ctrl-Z and Ctrl-Y and routes them to the currently active tab.
   The meta (command) key counts too, for Macs, where redo is
   shift-command-Z. (Command-Y is off-limits: browsers use it for History.) */
function documentKeyDown(e) {
  let evtobj = window.event? window.event : e;
  const mod = evtobj.ctrlKey || evtobj.metaKey
  const undoKey = mod && evtobj.keyCode == 90 && !evtobj.shiftKey
  const redoKey = (mod && evtobj.keyCode == 89) ||
                  (mod && evtobj.keyCode == 90 && evtobj.shiftKey)
  if (curMode == "editor") {
    if (redoKey) editor.redo()
    if (undoKey) editor.undo()
  }
}

function prepareGoalSelect(goals) {
  roadTomSelect.destroy()

  // Clean up existing options
  for(let i = roadSelect.options.length - 1 ; i >= 0 ; i--) roadSelect.remove(i);
  // Populate the dropdown list with goals
  let c = document.createDocumentFragment(), opt

  if (goals == null) {
    opt = document.createElement("option");
    opt.text = "load failed!";
    opt.value = "load failed!";
    roadSelect.add(opt);
    initTomSelect()
    return
  }
  
  goals.forEach(function(slug,index){
    opt = document.createElement("option");
    opt.text = slug;
    opt.value = slug;
    roadSelect.add(opt);
  });

  initTomSelect()

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

function xhrJSONResponse(xhr) {
  if (xhr.responseText == "") {
    return xhr.status == "200" ? {} : {error: xhr.statusText || String(xhr.status)}
  }
  try {
    return JSON.parse(xhr.responseText)
  } catch (e) {
    return {error: xhr.responseText || xhr.statusText || String(xhr.status)}
  }
}

function reportDataActionError(resp) {
  const msg = String(resp && resp.error != null ? resp.error : resp)
  console.log(msg)
  window.alert(msg)
}

function postJSON( url, data, callback ){
  let xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState != 4) return
    callback(xhrJSONResponse(xhr));
  };
  xhr.send(JSON.stringify(data));
}

function putJSON( url, data, callback ){
  let xhr = new XMLHttpRequest();
  xhr.open("PUT", url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState != 4) return
    callback(xhrJSONResponse(xhr));
  }
  console.log(JSON.stringify(data))
  xhr.send(JSON.stringify(data));
}

function deleteJSON( url, data, callback ){
  let xhr = new XMLHttpRequest();
  xhr.open("DELETE", url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState != 4) return
    callback(xhrJSONResponse(xhr));
  };
  xhr.send(JSON.stringify(data));
}

function handleRoadSubmit() {
  let currentGoal = roadSelect.value;
  let newRoad = editor.getRoad();
  if (!newRoad) {
    window.alert("Red line is null! Graph with errors?");
    return;
  }
  if (!newRoad.valid) {
    window.alert(
      "New red line intersects pink region (i.e., violates the akrasia horizon)!");
    return;
  }
  if (newRoad.loser) {
    window.alert("New red line causes derailment!");
    return;
  }
  if (!local) {
    submitButton.disabled = true
    submitButton.innerHTML = "Submitting..."
    postJSON("/submitroad/"+currentGoal, newRoad, function(resp) {
      submitButton.innerHTML = "Submit Changes"
      
      if (resp.error) {
        if (resp.error == "graph matrix can't get easier in akrasia horizon") {
          submitMsg.innerHTML = `\
Oops! You've hit a known bug that we're working on.
As a workaround, try having your change to the bright red line start one day later.\
`;
        } else {
          submitMsg.innerHTML = `\
Unexpected server error! Please paste this to support@beeminder.com:
"${resp.error}"\
`;
        }
      } else {
        submitMsg.innerHTML = "(successfully submitted graph!)";
        loadGoals(currentGoal)
      }
    })
  } else {
    window.alert('new graph matrix:\n'+JSON.stringify(editor.getRoad()))
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
    if (!confirmDataEdit()) return
    dataAdd.disabled = true
    dataAdd.innerHTML = "ADDING..."
    postJSON("/data/"+currentGoal, params, function(resp) {
      dataAdd.innerHTML = "ADD PROGRESS"
      
      if (resp.error) {
        dataAdd.disabled = false
        reportDataActionError(resp)
      } else {
        loadGoals(currentGoal)
      }
    })
  } else {
    window.alert('new datapoint: \n'+JSON.stringify(params))
  }
}

function setEntryToday() {
  var today=moment().format("YYYY-MM-DD")
  if (!dataDate.value.trim()) datePicker.setDate(today)
}

// Claude added this and it might be dumb but it seems to work
function scheduleBreak(insert) {
  let start = document.getElementById('breakstart').value
  let days = document.getElementById('breakdays').value
  if (!isNaN(days)) editor.scheduleBreak(start, days, insert)
}

function initialize() {
  roadSelect = document.getElementById('roadselect')
  
  // Locate and save graph DOM elements
  divGraph = document.getElementById('roadgraph')
  divGraphRoad = document.getElementById('graphroad')
  divGraphDueBy = document.getElementById('gdueby')
  divGraphData = document.getElementById('graphdata')
  divGraphProgress = document.getElementById('gprogress')
  divSummary = document.getElementById('goalsummary')

  // Locate and save editor DOM elements
  divEditor = document.getElementById('roadeditor')
  divEditorRoad = document.getElementById('editorroad')
  divEditorDueBy = document.getElementById('edueby')
  divEditorData = document.getElementById('editordata')
  divEditorProgress = document.getElementById('eprogress')
  editorTab = document.getElementById("editortab")
  undoBtn = document.getElementById("eundo")
  redoBtn = document.getElementById("eredo")
  undoCnt = document.getElementById("eundocnt")
  redoCnt = document.getElementById("eredocnt")
  endSlope = document.getElementById("endslope")
  slopeType = document.getElementById("slopetype");
  submitButton = document.getElementById("submit");
  submitMsg = document.getElementById("submitmsg");

  // Create the graph
  graph = new bgraph({divGraph: divGraph,
                      divTable: divGraphRoad,
                      divDueby: divGraphDueBy,
                      divData: divGraphData,
                      svgSize: { width: 696, height: 553 },
                      focusRect: { x:0, y:0, width:696, height: 453 },
                      ctxRect: { x:0, y:453, width:696, height: 100 },
                      roadEditor:false,
                      tableHeight:212,
                      maxFutureDays: 365,
                      showFocusRect: true,
                      showContext: true,
                      onDataEdit: dataEdited,
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
                       tableUpdateOnDrag: true,
                       maxFutureDays: 365,
                       showFocusRect: true,
                       showContext: true,
                       onRoadChange: editorChanged})
  graph.showData(document.getElementById("gshowdata").checked);
  editor.showData(document.getElementById("eshowdata").checked);
  editor.keepSlopes(document.getElementById("keepslopes").checked);
  editor.keepIntervals(document.getElementById("keepintervals").checked);

  // The help popup and corner chips stay open only while clicks land
  // inside, and opening one closes the others
  const chips = document.querySelectorAll("details.hint, details.gchip");
  document.addEventListener("click", (e) => {
    chips.forEach(d => { d.open &&= d.contains(e.target) });
  });
  chips.forEach(d => d.addEventListener("toggle", () => {
    if (d.open) chips.forEach(o => { if (o !== d) o.open = false });
  }));

  //loadGoals( roadSelect.value )
  editor.hide()

  // Deep link: land in edit mode if the URL says #edit
  if (location.hash === "#edit") setMode(null, "editor")

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

  initTomSelect()

  dataDate = document.getElementById('datadate')
  dataValue = document.getElementById('datavalue')
  dataComment = document.getElementById('datacmt')
  dataAdd = document.getElementById('dataadd')

  datePicker = new Pikaday({field: dataDate})
  setEntryToday()

  // Claude added this and it might be dumb (especially the part where we assign
  // something to a variable we never use?) but it seems to work.
  // This is the break scheduler in the Dial tab.
  let breakStartField = document.getElementById('breakstart')
  if (breakStartField) {
    let breakPicker = new Pikaday({field: breakStartField})
  }

  document.onkeydown = documentKeyDown;
}

function initTomSelect () {
  roadTomSelect = new TomSelect('#roadselect', {
    onFocus: () => {
      roadTomSelect.clear()
    }
  })
}
