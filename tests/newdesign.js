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

function openMainTab(evt, tabName) {
  openTab(evt, tabName, "tabcontent", "tablinks")
  // The following is necessary because Y axis width handling does not
  // work when the graph is not visible, so we have to call show()
  // after the tab becomes visible
  if (tabName == "graph") {
    graph.show()
    editor.hide()
  } else if (tabName == "editor") {
    graph.hide()
    editor.show()
  }
} 

let divGraph, divGraphRoad, divGraohDueBy, divGraphProgress
let divEditor, divEditortable, divEditorDueBy, divEditorProgress
let undoBtn, redoBtn

var graph, editor, gload = true, eload = true
function openGraphTab(evt, tabName) {
  openTab(evt, tabName, "gtabcontent", "gtablinks")
} 

function openEditorTab(evt, tabName) {
  openTab(evt, tabName, "etabcontent", "etablinks")
} 

async function loadGoals(goal) {
  await graph.loadGoal( goal )
  await editor.loadGoal( goal )
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
  let progval = Math.round(100*(progress[1][1]-progress[0][1])/(progress[2][1]-progress[0][1]))
  
  let p1 = d3.select(div).append('div').attr('class', 'progcont')
  p1.append('div').attr('class', 'progbar').style('width', progdate+'%')

  let p2 = d3.select(div).append('div').attr('class', 'progcont')
  p2.append('div').attr('class', 'progbar').style('width', progval+'%')

}

function graphChanged() {
  gload = false
  updateProgress(gprogress, graph.getProgress())
}

function editorChanged() {
  eload = false
  if (eload || gload) return
  
  var bufStates = editor.undoBufferState();
  console.log(bufStates)
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
  updateProgress(eprogress, editor.getProgress())
}

function initialize() {
  divGraph = document.getElementById('roadgraph')
  divGraphRoad = document.getElementById('graphroad')
  divGraphDueBy = document.getElementById('gdueby')
  divGraphProgress = document.getElementById('gprogress')
  divEditor = document.getElementById('roadeditor')
  divEditorRoad = document.getElementById('editorroad')
  divEditorDueBy = document.getElementById('edueby')
  divEditorProgress = document.getElementById('edprogress')
  undoBtn = document.getElementById("undo");
  redoBtn = document.getElementById("redo");

  graph = new bgraph({divGraph: divGraph,
                      divTable: divGraphRoad,
                      divDueby: divGraphDueBy,
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
                       svgSize: { width: 696, height: 553 },
                       focusRect: { x:0, y:0, width:696, height: 453 },
                       ctxRect: { x:0, y:453, width:696, height: 100 },
                       roadEditor:true,
                       tableHeight:212,
                       maxFutureDays: 365,
                       showFocusRect: false,
                       showContext: true,
                       onRoadChange: editorChanged})
  loadGoals('../../privatesuite/data/ybhp-rash.bb')
  editor.hide()
}
