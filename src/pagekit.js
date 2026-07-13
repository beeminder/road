/* Pagekit: helpers shared by the graph editor page (grapheditor.js) and the
   standalone sandbox page (sandboxpage.js). */

// Maps graph colors to fot colors
const cols = {"red":butil.BHUE.REDDOT,
              "green":butil.BHUE.GRNDOT,
              "blue":butil.BHUE.BLUDOT,
              "orange":butil.BHUE.ORNDOT}

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
  divObj.append('div').attr('class','baremin').text(matches[1])
  divObj.append('div').attr('class','doom-modifier').text(doommod)
  divObj.append('div').attr('class','doom').text(matches[2]).style('background-color', cols[goal.color])
  divObj.append('div').attr('class','pledgepre').text("or pay")
  divObj.append('div').attr('class','pledge').text(goal.waterbux)

}
