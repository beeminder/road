/* Pagekit: helpers shared by the graph editor page (grapheditor.js) and the
   standalone sandbox page (sandboxpage.js). */

// Maps graph colors to fot colors
// Each entry is a [fill, text] pair: the fill stays the standard dot hue
// (brand vocabulary, never darkened) and the text is white except on
// orange, the one fill too light for white text even at large size.
// White on red (4.00:1) and green (3.11:1) is WCAG AA only for large
// text, so .doom renders at large-text metrics (>= 18.66px at weight
// >= 700); see grapheditor.css. Guarded by the contrast quals in the
// grapheditor page qual.
const cols = {"red":    [butil.BHUE.REDDOT, butil.BHUE.WITE],
              "green":  [butil.BHUE.GRNDOT, butil.BHUE.WITE],
              "blue":   [butil.BHUE.BLUDOT, butil.BHUE.WITE],
              "orange": [butil.BHUE.ORNDOT, butil.BHUE.BLCK]}

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

/* One goal-progress bar, ported from beeminder.com's goal page
   (beeminder/beeminder goals_helper.rb prog_by_time/prog_by_value): a
   filled "done" segment next to a gray "togo" segment, each captioned
   inside itself when it's wide enough to hold text and via hover
   tooltip otherwise -- same 40%/60% thresholds as upstream, whose
   caption span is class "summary", renamed "barcap" here because this
   page already uses .summary for the goal summary bar. prog is the
   done percentage, already clamped to [0,100]. */
function progressBar(cont, cls, prog, donetext, togotext) {
  const bar = cont.append('div').attr('class', 'sum '+cls)
  const done = bar.append('div').attr('class', 'done')
    .style('width', prog+'%')
  const togo = bar.append('div').attr('class', 'togo')
    .style('width', (100-prog)+'%')
  if (prog < 40) done.attr('title', donetext)
  else done.append('span').attr('class', 'barcap').text(donetext)
  if (prog > 60) togo.attr('title', togotext)
  else togo.append('span').attr('class', 'barcap').text(togotext)
}

/* Creates/updates progress statistics within the specified div. The
 * second argument comes from bgraph.getProgress() */
function updateProgress(div, gr) {
  let progress = gr.getProgress()
  let goal = gr.getGoalObj()

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

  // Like beeminder.com's goal page, every row tooltips beebrain's
  // one-line percentwise progress summary
  table.selectAll('.progrow').attr('title', goal.progsum)

  let startdate = butil.dayparse(progress[0][0], '-')
  let nowdate = butil.dayparse(progress[1][0], '-')
  let enddate = butil.dayparse(progress[2][0], '-')

  // Same math as upstream prog_by_time/prog_by_value, including the
  // zero-length-goal guards: a zero time span counts as 0% done and a
  // zero value span as 100% or 0% by whether you're on the right side
  // of the red line
  const SID = 86400
  let donet = nowdate - startdate, tott = enddate - startdate
  let progdate = tott === 0 ? 0 : Math.round(100*donet/tott)
  progdate = Math.min(100, Math.max(0,progdate))
  let donev = progress[1][1]-progress[0][1]
  let totv  = progress[2][1]-progress[0][1]
  let progval = totv !== 0 ? Math.round(100*donev/totv)
                           : (goal.delta*goal.yaw >= 0 ? 100 : 0)
  progval = Math.min(100, Math.max(0,progval))

  const bars = d3.select(div).append('div').attr('class', 'progsum')
  progressBar(bars, 'bytime', progdate,
    butil.splur(Math.trunc(donet/SID), "day")+" on track",
    butil.splur(Math.trunc((tott-donet)/SID), "day")+" to go")
  progressBar(bars, 'byvalue', progval,
    butil.shns(donev, 2, 4)+" so far",
    butil.shns(totv-donev, 2, 4)+" to goal")
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
  divObj.append('div').attr('class','doom').text(matches[2])
    .style('background-color', cols[goal.color][0])
    .style('color', cols[goal.color][1])
  divObj.append('div').attr('class','pledgepre').text("or pay")
  divObj.append('div').attr('class','pledge').text(goal.waterbux)

}
