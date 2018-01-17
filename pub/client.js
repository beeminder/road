

loadJSON('/getusergoals', prepareGoalSelect);

var undoBtn = document.getElementById("undo");
var redoBtn = document.getElementById("redo");
var submitBtn = document.getElementById("roadsubmit");
var submitMsg = document.getElementById("submitmsg");
var breakpicker= new Pikaday({field: document.getElementById('breakstart')});
var endSlope = document.getElementById("endslope");
var slopeType = document.getElementById("slopetype");

function roadChanged() {
    var bufStates = editor.undoBufferState();
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
    var newRoad = editor.getRoad();
    if (!newRoad.valid) {
      submitBtn.disabled = true;
      submitMsg.innerHTML = "(disabled: new road is easier!)";      
    } else if (newRoad.loser) {
      submitBtn.disabled = true;
      submitMsg.innerHTML = "(disabled: new road causes derailment!)";
    } else {
      submitBtn.disabled = false;
      submitMsg.innerHTML = "";
    }
    var mindate=moment(moment.unix(newRoad.horizon).utc().format("YYYY-MM-DD")).toDate();
    breakpicker.setMinDate(mindate);
    if (!breakstart.value.trim()) {
      breakpicker.setDate(mindate);
    }

    slopeType.value = newRoad.siru;
    updateCommitFields();
}

function updateCommitFields() {
  var sirunew = parseInt(slopeType.value);
  var road = editor.getRoad();
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

var editor2 = new bmndr({divGraph: document.getElementById('roadgraph2'),
                        divTable: document.getElementById('roadtable2'),
                        tableAutoScroll: true,
                        tableUpdateOnDrag: true,
                        reverseTable: false,
                        roadEditor:false,
                        maxFutureDays: 365,
                        showFocusRect: false,
                        showContext: true});
if (document.getElementById("showalldata2").checked) editor2.maxDataDays(-1); else editor2.maxDataDays(100);

var editor = new bmndr({divGraph: document.getElementById('roadgraph'),
                        divTable: document.getElementById('roadtable'),
                        tableAutoScroll: true,
                        tableUpdateOnDrag: true,
                        reverseTable: false,
                        roadEditor: true,
                        maxFutureDays: 365,
                        showFocusRect: false,
                        showContext: true,
                        onRoadChange: roadChanged});
if (document.getElementById("showalldata").checked) editor.maxDataDays(-1); else editor.maxDataDays(100);
editor.showData(document.getElementById("showdata").checked);
editor.showContext(document.getElementById("showcontext").checked);
editor.keepSlopes(document.getElementById("keepslopes").checked);
editor.keepIntervals(document.getElementById("keepintervals").checked);

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
      editor2.hide();
   } else {
      divEditor.style.display = "none";
      divGraph.style.display = "block";
      editor.hide();
      editor2.show();
    }
  }
}
document.graphType.typeButton[0].checked = true;
divEditor.style.display = "none";
divGraph.style.display = "block";
editor.hide();
editor2.show();

document.onkeydown = documentKeyDown;



// Helper Functions. Something about function hoisting?

function loadJSON( url, callback ) {   

    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open('GET', url, true);
    xobj.onreadystatechange = function () {
        if (xobj.readyState == 4 && xobj.status == "200") {
            //if (xobj.readyState == 4) {
            callback(JSON.parse(xobj.responseText));
        }
    };
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

function prepareGoalSelect(goalist) {
  var roadSelect = document.getElementById('roadselect');
  var c = document.createDocumentFragment();
  goalist.forEach(function(slug,index){
    var opt = document.createElement("option");
    opt.text = slug;
    opt.value = slug;
    roadSelect.add(opt);
  });
  roadSelect.addEventListener("change", handleGoalSelect);
  roadSelect.value = goalist[0];

  breakstart.value = "";
  editor.loadGoal('/getgoaljson/'+roadSelect.value);
  editor2.loadGoal('/getgoaljson/'+roadSelect.value);
}

function handleGoalSelect() {
  //console.log("handling goal select: "+this.value);
  //console.log(event.target.value)
  breakstart.value="";
  editor.loadGoal('/getgoaljson/'+this.value);
  editor2.loadGoal('/getgoaljson/'+this.value);
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

function handleRoadSubmit(){
  var currentGoal = document.getElementById('roadselect').value;
  var newRoad = editor.getRoad();
  console.log(newRoad);
  if (!newRoad.valid) {
    window.alert("New road intersects pink region!");
    return;
  }
  if (newRoad.loser) {
    window.alert("New road causes derailment!");
    return;
  }
  postJSON("/submitroad/"+currentGoal, editor.getRoad(), function(resp) {
    if (resp.error.length > 0) {
        submitMsg.innerHTML = "ERROR! \""+resp.error+"\". Email support@beeminder.com for more help!"
    } else {
      submitMsg.innerHTML = "(successfully submitted road!)";
      console.log("success!");
      console.log(resp);
      editor.loadGoal('/getgoaljson/'+currentGoal);
      editor2.loadGoal('/getgoaljson/'+currentGoal);
    }
  });
}
