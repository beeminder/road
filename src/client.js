
// Determine username coming from the node server template
console.log("user = "+username)

// Locate and record some useful elements
var undoBtn = document.getElementById("undo");
var redoBtn = document.getElementById("redo");
var submitBtn = document.getElementById("roadsubmit");
var submitMsg = document.getElementById("submitmsg");
var breakpicker= new Pikaday({field: document.getElementById('breakstart')});
var endSlope = document.getElementById("endslope");
var slopeType = document.getElementById("slopetype");
var roadSelect = document.getElementById('roadselect');

// If no usernames are configured, just use a deffault list of sample goals
if (username != null)  loadJSON('/getusergoals', prepareGoalSelect);
else prepareGoalSelect(['testroad0.bb','testroad1.bb','testroad2.bb','testroad3.bb'])

function roadChanged() {
  var bufStates = editor.undoBufferState();
  
  // Update states of Undo and Redo buttons
  if (bufStates.undo === 0)  {
    undoBtn.disabled = true;
    undoBtn.innerHTML = "Undo (0)";
  } else {
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
  
  // Update state of the Submit button depending on road validity
  var newRoad = editor.getRoad();
  if (!newRoad) {
    submitBtn.disabled = true;
    submitMsg.innerHTML = "(disabled: graph with errors!)";      
  } else if (!newRoad.valid) {
    submitBtn.disabled = true;
    submitMsg.innerHTML = "(disabled: new road is easier!)";      
  } else if (newRoad.loser) {
    submitBtn.disabled = true;
    submitMsg.innerHTML = "(disabled: new road causes derailment!)";
  } else {
    submitBtn.disabled = false;
    submitMsg.innerHTML = "";
  }

  // Update break date picker limits
  if (newRoad != null) {
    var mindate=moment(moment.unix(newRoad.horizon).utc().format("YYYY-MM-DD")).toDate();
    breakpicker.setMinDate(mindate);
    if (!breakstart.value.trim()) {
      breakpicker.setDate(mindate);
    }
    slopeType.value = newRoad.siru;
  }

  updateCommitFields();
}

function updateCommitFields() {
  var sirunew = parseInt(slopeType.value);
  var road = editor.getRoad();
  if (!road) return
  var siru = road.siru;
  var rd = road.road;
  endSlope.value = rd[rd.length-1][2]/siru*sirunew;
}

function commitTo() {
  if (isNaN(endSlope.value)) return;
  var siru = parseInt(slopeType.value);
  var slope = parseInt(endSlope.value);
  editor.commitTo(slope / siru);
}


function scheduleBreak(insert) {
  var start = document.getElementById('breakstart').value; 
  var days = document.getElementById('breakdays').value; 
  if (!isNaN(days)) editor.scheduleBreak(start, days, insert);
}

// Create bgraph objects for the editor and the client-side graph display
var graph = new bgraph({divGraph: document.getElementById('roadgraph2'),
                          divTable: document.getElementById('roadtable2'),
                          tableAutoScroll: true,
                          tableUpdateOnDrag: true,
                          reverseTable: false,
                          roadEditor:false,
                          maxFutureDays: 365,
                          showFocusRect: false,
                          showContext: true});
if (document.getElementById("showalldata2").checked) graph.maxDataDays(-1);
else graph.maxDataDays(100);

var editor = new bgraph({divGraph: document.getElementById('roadgraph'),
                         divTable: document.getElementById('roadtable'),
                         tableAutoScroll: true,
                         tableUpdateOnDrag: true,
                         reverseTable: false,
                         roadEditor: true,
                         maxFutureDays: 365,
                         showFocusRect: false,
                         showContext: true,
                         onRoadChange: roadChanged});
if (document.getElementById("showalldata").checked)
  editor.maxDataDays(-1);
else editor.maxDataDays(100);

editor.showData(document.getElementById("showdata").checked);
editor.showContext(document.getElementById("showcontext").checked);
editor.keepSlopes(document.getElementById("keepslopes").checked);
editor.keepIntervals(document.getElementById("keepintervals").checked);

if (!username) handleGoalSelect()

var curRadio = 0;
var divEditor = document.getElementById("diveditor");
var divGraph = document.getElementById("divgraph");
function handleRadio(myRadio) {
  if (curRadio !== myRadio.value) {
    curRadio = myRadio.value;
    if (curRadio === "editor") { 
      divEditor.style.display = "block";
      divGraph.style.display = "none";
      editor.show();
      graph.hide();
    } else {
      divEditor.style.display = "none";
      divGraph.style.display = "block";
      editor.hide();
      graph.show();
    }
  }
}
document.graphType.typeButton[0].checked = true;
divEditor.style.display = "none";
divGraph.style.display = "block";
editor.hide();
graph.show();

document.onkeydown = documentKeyDown;

// Helper Functions. Something about function hoisting?
function loadJSON( url, callback ) {   

  var xobj = new XMLHttpRequest();
  xobj.overrideMimeType("application/json");
  xobj.onreadystatechange = function () {
    if (xobj.readyState == 4 && xobj.status == "200") {
      //if (xobj.readyState == 4) {
      callback(JSON.parse(xobj.responseText));
    }
  }
  xobj.open('GET', url, true);
  xobj.send(null);  
}

function postJSON( url, data, callback ){
  var xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState == 4 && xhr.status == "200") {
      callback(JSON.parse(xhr.responseText));
    }
  };
  console.log("posting data to "+url);
  xhr.send(JSON.stringify(data));
}

function documentKeyDown(e) {
  var evtobj = window.event? window.event : e;
  if (evtobj.keyCode == 89 && evtobj.ctrlKey) editor.redo();
  if (evtobj.keyCode == 90 && evtobj.ctrlKey) editor.undo();
}

function prepareGoalSelect(goals) {
  // Clean up existing options
  for(let i = roadSelect.options.length - 1 ; i >= 0 ; i--) roadSelect.remove(i);

  // Populate the dropdown list with goals
  var c = document.createDocumentFragment();
  goals.forEach(function(slug,index){
    var opt = document.createElement("option");
    opt.text = slug;
    opt.value = slug;
    roadSelect.add(opt);
  });
  roadSelect.addEventListener("change", handleGoalSelect);
  roadSelect.value = goals[0];

  breakstart.value = "";
  if (username) {
    // If username is provided, retrieve first goal
    editor.loadGoal('/getgoaljson/'+roadSelect.value);
    graph.loadGoal('/getgoaljson/'+roadSelect.value);
  }
}

function handleGoalSelect() {
  breakstart.value="";
  if (username) {
    editor.loadGoal('/getgoaljson/'+roadSelect.value)
    graph.loadGoal('/getgoaljson/'+roadSelect.value)
  } else {
    editor.loadGoal('/data/'+roadSelect.value)
    graph.loadGoal('/data/'+roadSelect.value)
  }
  /*
  //alternately: use the loadJSON fn to just get the bb json data directly?
  loadJSON('/getgoaljson/'+event.target.value, function(data) {
  console.log(data)
  editor.loadGoal(document.getElementById("roadselect").value);
  //editor.loadRoad(data);
  //editor.roadChanged();
  //editor.updateRoadTableTitle();
  })
  */
}

function handleRoadSubmit() {
  var currentGoal = roadSelect.value;
  var newRoad = editor.getRoad();
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
  if (username) {
    postJSON("/submitroad/"+currentGoal, newRoad, function(resp) {
      
      if (resp.error) {
        submitMsg.innerHTML = "ERROR! \""
          +resp.error+"\". Email support@beeminder.com for more help!";
      } else {
        submitMsg.innerHTML = "(successfully submitted road!)";
        console.log("success!");
        console.log(resp);
        editor.loadGoal('/getgoaljson/'+currentGoal);
        graph.loadGoal('/getgoaljson/'+currentGoal);
      }
    })
  } else {
    window.alert('new road matrix:\n'+JSON.stringify(editor.getRoad()))
  }
}
