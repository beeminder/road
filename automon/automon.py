#!/usr/bin/env python3
# Automon: Test Suite Monitoring/Comparison Daemon
# NOTE: You have to run this from the automon directory.

# NOTE: I've refactored this a bit so that the data directory with the bb files
# is treated exactly the same as any source directory.
# So no -w switch for the watch directories. You specify at least one directory
# which is both the data directory and a watch directory. You can also 
# optionally specify any number of additional directories on the command line
# which are taken as additional watch directories.
# Would it be cleaner / more consistent if all the directories were treated 
# identically?
# Like you specify any directories you want and it processes any .bb files it 
# finds in them and reruns whenever any file at all in those directories
# changes. But not recursively.
# Ok, but... simplest is to just have one bbdir so the first directory is
# special -- both the bbdir and a watch directory -- and the additional ones are
# just watch directories.
# One thing that would be nice is, when a bb file changes, only regenerate the 
# output for that file. So that's another way the bbdir is different than a
# source code watch directory.
# Probably I should've just done that directly rather than treating the bbdir
# as a watchdir. But I don't edit the bb files often so it's not a big deal.
# It's nice that when I do, automon picks up on it.
# PS: OMG it's so nice to be able to experiment with changes in bb files and 
# have automon regenerate them. It's so nice that I now think it will be worth
# it to smarten this up slightly so that if a bb file changes then automon 
# regenerates the output just for that bb file. So definitely treat the bbdir
# differently from the other watchdirs.
# TODO: i think there's a bug where, if you edit a bb file and it shows the
# json diff and then you hit g to generate graphs as well and then hit c to 
# regenerate the output, automon won't notice that it should regenerate the 
# graph until you edit the bb file again.


# Might need to do pip3 install watchdog
import curses, sys, getopt, os, time, requests, subprocess, re
import math, threading, queue, textwrap, json, filecmp
import traceback
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from enum import Enum

################################################################################
######################### CONSTANTS AND CONFIGURATION ##########################

DISPCMD = next(p for p in ['/usr/bin/open', '/usr/local/bin/display',
                           '/usr/bin/display', '/bin/true']
               if os.path.exists(p)) # path to utility for displaying images

ST = Enum('ST', [
  'INIT', # Initializing                                            INIT ~ INIT
  'IDLE', # Waiting for trigger (for a source/bb file to change)    IDLE ~ IDLE
  'RSET', # Reset job procesing parameters                          RSET ~ RSET
  'PROC', # Processing goal list, one at a time                     PROC ~ PROC
  'JSRF', # Initiate jsref (bbref) generation                       JSRF ~ REFG
  'JSBR', # Initiate jsbrain (beebrain) generation                  JSBR ~ BEEB
  'WAIT', # Wait for processing to finish                           WAIT ~ WAIT
  'PAUS', # Processing paused                                       PAUS ~ PAUS
  'EXIT', # Exiting automon                                         EXIT ~ EXIT
])

# Transitions and triggers. ORDERING of the checks is RELEVANT and CRITICAL
# INIT -> IDLE : Initialization completed
# IDLE -> PROC : sourcechange OR forcestart
# PROC -> IDLE : forcestop
# PROC -> INIT : forcestart OR forcestop OR curgoal == len(goals)
# PROC -> PAUS : (not above) AND paused
# PROC -> JSRF : (not above) AND (jsref OR jsbrain_checkref)
# PROC -> JSBR : (not above)
# JSBR -> WAIT : (not above)
# WAIT -> PROC : jobsdone
# PAUS -> PROC : NOT paused OR forcestop
# *    -> EXIT : exitflag
#
# JSRF -> WAIT : this wasn't in Uluc's original state transition table

menu = [
  ['c', 'reCheck'],
  ['r', 'reRef'],
  ['s', 'Stop/Start'],
  ['p', 'Pause/Resume'],
  ['g', 'Graph on/off'],
  ['R', 'AllRefs'],
  ['q', 'Quit'],
]
UP = -1   # Scroll-up increment
DOWN = 1  # Scroll-down increment
LWW = 40  # Width of left window
PLAY = next(p for p in ['/usr/bin/play', '/usr/bin/afplay']
            if os.path.exists(p)) # path to your utility of choice to play sound

################################################################################
############################### EVERYTYHING ELSE ###############################

class StdOutWrapper:
  text = ""
  def write(self, txt):
    self.text += txt
    self.text = '\n'.join(self.text.split('\n')[-30:]) # why just last 30 lines?
  def get_text(self, beg, end):
    return '\n'.join(self.text.split('\n')[beg:end])

# Scroll related data ----------------------------
#  ┌--------------------------------------┐
#  |1. Item                               |
#  |--------------------------------------| <- top = 1
#  |2. Item                               | 
#  |3. Item                               |
#  |4./Item///////////////////////////////| <- current = 3
#  |5. Item                               |
#  |6. Item                               |
#  |7. Item                               |
#  |8. Item                               | <- maxlines = 7
#  |--------------------------------------|
#  |9. Item                               |
#  |10. Item                              | <- bottom = 10
#  |                                      |
#  |                                      | <- page = 1 (0 and 1)
#  └--------------------------------------┘
class ScrollData:
  def __init__(self):
    self.top = 0
    self.bottom = 0
    self.cur = 0
    self.maxlines = 0
    self.page = 0

# JobRequest and JobResponse objects are used to communicate with the worker
# thread. Upon receiving a JobRequest on the pending job queue, the worker
# thread executes the corresponding Beebrain task and returns the result, as
# well as the original request object in a response queue.
reqcnt = 0
class JobRequest:
  def __init__(self, typ):
    global reqcnt
    reqcnt += 1
    self.reqtype = typ
    self.reqid = reqcnt
    self.slug = ""
    self.inpath = ""
    self.outpath = ""
    self.graph = False
    self.jsref = ""
    
class JobResponse:
  def __init__(self, req):
    self.req = req
    self.dt = 0
    self.errmsg = ""
    self.jsondiff = None
    self.grdiff = None

# Notice when source files or bbfiles change, to trigger rebraining.
class JSBrainEventHandler(FileSystemEventHandler):
  def __init__(self): FileSystemEventHandler.__init__(self)
  def on_modified(self, event):
    if event.is_directory and os.path.abspath(event.src_path) == \
                              os.path.abspath(cm.jsoutf):        return
    cg = cm.curgoal
    cgs = None if not cm.goals or cg<0 or cg >= len(cm.goals) else cm.goals[cg]
    flog(f'$PRE FILE {event.event_type} {event.src_path} curgoal={cgs}')
    if not event.is_directory and not ignorable(event.src_path):
      if os.path.splitext(event.src_path)[1] == '.bb':
        cm.bbedit = extract_slug(event.src_path)
      else:
        # Record where source change detected so goal list can be reordered
        cm.sourcechange = cm.curgoal
    else:
      flog(" -- but directory or ignorable so ignore")
    flog('\n')

# Global structure for common data ---------------------------------------------

class CMonitor:
  def __init__(self):
    self.sscr = None       # Stores stdscr
    self.ww = 80           # Window width
    self.wh = 25           # Window height
    self.twin = None       # Top window for information
    self.lwin = None       # Left window for the goal list
    self.lw = 0            # Left window width
    self.lh = 0            # Left window height
    self.ls = ScrollData() # Left window scrolling
    self.rwin = None       # Right window for the summary of differences
    self.rs = ScrollData() # Right window scrolling
    self.swin = None       # Status window
    self.mwin = None       # Menu window
    self.dwin = None       # Dialog window for confirmation
    self.dmsg = None       # Dialog window message

    self.goals = []        # List of goals to be processed
    self.problems = []     # List of problem goals

    self.status = "Initializing..."
    self.progress = 0
    self.needupdate = False
    
    self.bbdir = None      # Directory for bb files
    self.graph = False     # Whether to generate graphs or not
    self.logging = False   # Whether to generate a log file with statistics or not
    self.state = ST.INIT   # Current jobTask state
    
    self.jobsdone = False  # Various events and flags for the state machine...
    self.sourcechange = -1
    self.bbedit = ''       # Keep track of when a bbfile is edited
    self.forcestart = True
    self.forcestop = False
    self.exitflag = False

    self.paused = False    # Processing paused
    self.jsref = False     # Generating reference jsbrain graphs

    self.curgoal = 0
    self.last_update = -1

    self.last_time = 0     # Execution time logs...
    self.total_time = 0
    self.max_time = 0
    self.total_count = 0
    
    self.req_alert = False # Alert task state: alert has been requested
    self.alerted = False   # Alert task state: alert has been given

    self.lastreq = -1      # Job task state: request ID for the last request
    self.firstreq = -1     # Job task state: first request ID for current batch

    self.jsref = None      # Directory for jsbrain reference files 
    self.jsout = None      # Directory for jsbrain output files
    
cm = CMonitor()

# Utility functions  -----------------------------------------------------------

# Write string s to a file for debugging (now with macros!)
def flog(s):
  s = s.replace('$PRE',
                f'{time.strftime("%H:%M:%S", time.localtime())} {cm.state}')
  with open('debug.log', 'a') as f:
    f.write(s)
    f.flush()

# Convenience version of flog that adds the prefix and a newline
def flon(s): flog(f'$PRE {s}\n')

def nowstamp(): return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

def exitonerr(err, usage=True):
  usage = '''\
Usage: automon.py <options> bbdir [other directories to monitor for changes]
Supported options:
  -g or --graph : Enable graph comparisons
  -l or --log   : Enable logging
  -f or --force : Force regeneration of reference outputs'''
  #-w or --watch : Monitor directory for changes (multiple directories ok)'''
  #print("========= Automon: Test Suite Monitoring/Comparison Daemon =========")
  if (err): print("Error: "+err)
  if (usage): print(usage+"\n")
  sys.exit()

def play(sound):
  try:
    subprocess.check_output([PLAY, sound], stderr=subprocess.STDOUT)
  except FileNotFoundError:
    flon("ERROR: cannot play sounds")
  
def freak(): play("uhoh.wav")
def ahhhh(): play("phew.wav")

# Truncate string
def trstr(s, l): return (s[:l] + '..') if len(s) > l else s

# Take a full path and extract the slug, eg, "/path/to/foo-bar.bb" -> "foo-bar"
def extract_slug(p): 
  return os.path.splitext(os.path.split(p)[1])[0] # could use os.path.basename?

# Take a full path and return whether it's a swap file or something else we want
# to ignore if it changes, to not trigger unnecessary re-runs thru the suite.
def ignorable(p): return re.match(r"^\..*\.swp$", os.path.basename(p))

# Scrolling related functions --------------------------------------------------

# Update the scroll object s to advance by 1 in direction dir
def scroll(s, dir):
  next_line = s.cur + dir # next cursor position after scrolling

  # Up direction scroll overflow: current cursor position = 0 but top pos > 0
  if dir == UP and (s.top > 0 and s.cur == 0):
    s.top += dir
    return
  # Down direction scroll overflow: next cursor position touch the max lines,
  # but absolute position of max lines could not touch the bottom
  if dir == DOWN and (next_line == s.maxlines) \
     and (s.top + s.maxlines < s.bottom):
    s.top += dir
    return
  # Scroll up: current cursor position or top position > 0
  if (dir == UP) and (s.top > 0 or s.cur > 0):
    s.cur = next_line
    return
  # Scroll down: next cursor position is above max lines, and absolute position
  # of next cursor could not touch the bottom
  if dir == DOWN and next_line < s.maxlines and s.top + next_line < s.bottom:
    s.cur = next_line
    return
    
# Update scroll object s to advance by half a page (maxlines/2) in direction dir
def paging(s, dir):
  ml = int(s.maxlines/2)
  s.page = s.bottom // ml
  
  current_page = (s.top + s.cur) // ml
  next_page = current_page + dir

  # The last page may have fewer items than max lines, so we should adjust the
  # current cursor position as maximum item count on last page
  if next_page == s.page: s.cur = min(s.cur, s.bottom % ml - 1)

  # Page up: if current page is not a first page, page up is possible top
  # position can not be negative, so if top position is going to be negative, 
  # we should set it as 0
  if dir == UP and current_page > 0:
    s.top = max(0, s.top - ml)
    return
  # Page down: if current page is not a last page, page down is possible
  if dir == DOWN and current_page < s.page:
    s.top += ml
    return

# Display and window management and rendering ----------------------------------

def _addstr(w,y,x,s,a=curses.A_NORMAL):
  try:
    w.addstr(y,x,s,a)
  except curses.error:
    cg = cm.curgoal
    cgs = None if not cm.goals or cg<0 or cg >= len(cm.goals) else cm.goals[cg]
    flon("_addstr error: ww:"+str(cm.ww)
                     +", wh:"+str(cm.wh)+", y:"+str(y)
                                        +", x:"+str(x)+", str="+s + f' {cgs}')
    pass


def create_dialog(msg):
  if (cm.dwin): return
  cm.dwin = curses.newwin(5, 30, int(cm.wh/2-5), int(cm.ww/2-15))
  cm.dmsg = msg
  refresh_dialog()
  
def refresh_dialog():
  if (not cm.dwin): return
  cm.dwin.clear()
  cm.dwin.box()
  cm.dwin.addnstr(1, int(15-len(cm.dmsg)/2), cm.dmsg, 30)
  cm.dwin.addstr(3, 4, "Yes (y)")
  cm.dwin.addstr(3, 20, "No (n)")
  cm.dwin.noutrefresh()
  
def remove_dialog():
  if (not cm.dwin): return
  del cm.dwin
  cm.dwin = None
  
  
def resize_windows():
  success = False
  # Try until successful. Sometimes there are race conditions with resize that
  # result in errors, in which case resizes are reattempted
  while (not success):
    cm.wh,cm.ww = cm.sscr.getmaxyx()
    lw = min(int(cm.ww/2),LWW)
    success = True
    
    try:
      # Update the top window
      if (cm.twin): cm.twin.resize(1,cm.ww)
      else: cm.twin = curses.newwin(1,cm.ww,0,0)
      cm.twin.noutrefresh()

      # Update the left window and its scroll data
      if (cm.lwin): cm.lwin.resize(cm.wh-5,lw)
      else: cm.lwin = curses.newwin(cm.wh-5,lw,1,0)
      cm.lwin.noutrefresh()
      cm.lw = lw; cm.lh = cm.wh-5

      # Update left and right scroll data based on the new height
      cm.ls.maxlines = cm.wh-7
      if cm.ls.cur >= cm.ls.maxlines:
        cm.ls.top += (cm.ls.cur-cm.ls.maxlines+1)
        cm.ls.cur = cm.ls.maxlines-1
      
      # Update the right window and its scroll data
      if (cm.rwin): cm.rwin.resize(cm.wh-5, cm.ww-lw); cm.rwin.mvwin(1, lw)
      else: cm.rwin = curses.newwin(cm.wh-5, cm.ww-lw, 1, lw)
      cm.rwin.noutrefresh()
      cm.rw = cm.ww-lw
      cm.rs.maxlines = cm.wh-7
      cm.rs.page = cm.rs.bottom // int(cm.rs.maxlines/2)

      # Update status and menu windows
      if (cm.swin): cm.swin.resize(3, cm.ww); cm.swin.mvwin(cm.wh-4, 0)
      else: cm.swin = curses.newwin(3, cm.ww, cm.wh-4, 0)
      cm.swin.noutrefresh()

      if (cm.mwin): cm.mwin.resize(1, cm.ww); cm.mwin.mvwin(cm.wh-1, 0)
      else: cm.mwin = curses.newwin(1, cm.ww, cm.wh-1, 0)
      cm.mwin.noutrefresh()

      if (cm.dwin):
        cm.dwin.mvwin(int(cm.wh/2-5), int(cm.ww/2-15))
        cm.dwin.noutrefresh()

    except:
      # Exception may mean resized windows ended up outside a resized screen
      success = False
      
  refresh_all()

def refresh_menu():
  x = 1; w = cm.mwin

  w.clear()
  for mi in menu:
    if (x + len(mi[0]) + len(mi[1]) + 2 < cm.ww-2):
      _addstr(w, 0, x, mi[0], curses.A_REVERSE)
      w.addch(0, x+len(mi[0]), ' ')
      x += len(mi[0])+1
      _addstr(w, 0, x, mi[1])
      x += len(mi[1])
      _addstr(w, 0, x+1, "  ")
      x += 2
  w.noutrefresh()

def refresh_topline():
  w = cm.twin
  w.clear()
  if (cm.graph):   _addstr(w, 0, 1, "[Graph]", curses.A_REVERSE)
  else:            _addstr(w, 0, 1, "[Graph]")

  if (cm.logging): _addstr(w, 0, 10, "[Log]", curses.A_REVERSE)
  else:            _addstr(w, 0, 10, "[Log]")

  if (cm.jsref): _addstr(w, 0, 17, "[References]", curses.A_REVERSE)
  else:          _addstr(w, 0, 17, "[References]")

  if (cm.paused): _addstr(w, 0, 31, "[Paused]", curses.A_REVERSE)
  else:           _addstr(w, 0, 31, "[Paused]")

  w.noutrefresh()

# Take a number of seconds and show it as milliseconds like "123ms", or seconds
# if it's 10s or more (should conceivably handle the >60s case too)
def showtm(x):
  if x >= 10: return str(int(x))+"s"
  return str(int(1000*x))+"ms"

def refresh_status():
  w = cm.swin
  w.clear(); w.box()
  _addstr(w, 0, 1, str(cm.state), curses.A_BOLD)
  w.addnstr(1, 1, cm.status, cm.ww-2)
  wwx = cm.ww - 14
  ndots = int(cm.progress/100*wwx)
  if ndots > wwx: # never happens anymore? totally happened
    flon(f'NEVER HAPPENS: prog={cm.progress} ndots={ndots} wwx={wwx}')
    sys.exit(1)
  _addstr(w, 0, 10, "(".ljust(ndots, 'o').ljust(wwx)+")")
  if (cm.total_count != 0):
    _addstr(w, 2, cm.ww-43,
            " Max: "+showtm(cm.max_time)+" ",
            curses.A_BOLD)
    _addstr(w, 2, cm.ww-29,
            " Avg: "+showtm(cm.total_time/cm.total_count)+" ",
            curses.A_BOLD)
    _addstr(w, 2, cm.ww-15, 
            " Last: "+showtm(cm.last_time)+" ",
            curses.A_BOLD)
  w.noutrefresh()

def refresh_windows():
  w = cm.lwin
  w.clear(); w.box(); w.vline(1, cm.lw-6, 0, cm.lh-2)
  w.addch(0, cm.lw-6, curses.ACS_TTEE)
  w.addch(cm.lh-1, cm.lw-6, curses.ACS_BTEE)
  _addstr(w, 0, 1, str(len(cm.problems)) + " errors out of " 
                 + str(len(cm.goals)) + ":", curses.A_BOLD)
  _addstr(w, 0, cm.lw-5, "RJPG", curses.A_BOLD)
  for i, item in enumerate(cm.problems[cm.ls.top:cm.ls.top + cm.ls.maxlines]):
    # Highlight the current cursor line
    slug = trstr(item.req.slug, cm.lw-9).ljust(cm.lw-7)
    if i == cm.ls.cur: _addstr(w, i+1, 1, slug, curses.A_REVERSE)
    else: _addstr(w, i+1, 1, slug)
    if (item.req.reqtype == "jsref"):
      _addstr(w, i+1, cm.lw-5, "X", curses.A_REVERSE)
    elif (item.req.reqtype == "jsbrain"):
      _addstr(w,i+1, cm.lw-4, "X", curses.A_REVERSE)
    if (item.grdiff and item.grdiff > 0):
      _addstr(w, i+1, cm.lw-2, "X", curses.A_REVERSE)
      
  w.noutrefresh()

  w = cm.rwin
  w.clear(); w.box()
  if (cm.ls.bottom == 0): _addstr(w, 0, 1, "Goal: not selected", curses.A_BOLD)
  else:
    sel = cm.ls.top+cm.ls.cur
    pr = cm.problems[sel]
    errmsgs = []
    if (pr.errmsg):   errmsgs += pr.errmsg.split('\n')
    if (pr.jsondiff): errmsgs += pr.jsondiff.split('\n')
    errtxt = []
    for e in errmsgs:
      errtxt += textwrap.wrap(e, cm.ww-cm.lw-3)
    cm.rs.bottom = len(errtxt)
    cm.rs.page = cm.rs.bottom // int(cm.rs.maxlines/2)
    w.addnstr(0, 1, "Errors: ("+pr.req.reqtype+", "+pr.req.slug+")", 
              cm.ww-cm.lw-2, curses.A_BOLD)
    for i, item in enumerate(errtxt[cm.rs.top:cm.rs.top+cm.rs.maxlines]):
      _addstr(w, i+1, 1, item)
    w.vline(1+int((cm.lh-2)*cm.rs.top/((cm.rs.page+1)*(cm.rs.maxlines//2))), 
            cm.ww-cm.lw-2, curses.ACS_BOARD, (cm.lh-2)//(cm.rs.page+1))
  w.noutrefresh()

def refresh_all():
  refresh_topline()
  refresh_windows()
  refresh_status()
  refresh_menu()
  refresh_dialog()

# Sorts the goal list based on a particular prioritization. Currently,
# this just shifts all goals with errors to the beginning of the list
def sort_goallist():
  freeind = 0
  for i in range(len(cm.goals)):
    slug = os.path.splitext(cm.goals[i])[0]
    if (find_problem_slug(slug) < 0): continue
    cm.goals[freeind], cm.goals[i] = cm.goals[i], cm.goals[freeind]
    freeind += 1
  return

# Last-modified time (unixtime) of the bbfile given the slug
def mtime(bb):
  bbfile = os.path.abspath(cm.bbdir)+'/'+bb+'.bb'
  if (not os.path.isfile(bbfile)): return 0
  return os.path.getmtime(bbfile)

# Rescans the bb file directory to get an updated file list
def update_goallist():
  bbfiles = [f for f in os.listdir(cm.bbdir)
             if (f.endswith(".bb") and os.path.isfile(cm.bbdir+"/"+f))]
  bbfiles.sort(key=(lambda f: -os.stat(cm.bbdir+"/"+f).st_mtime))
  cm.goals = [os.path.splitext(b)[0] for b in bbfiles]
  cm.ls.bottom = len(cm.problems)
  
# BEEBRAIN related functions ---------------------------------------------------

# Check timestamps of generated files wrt the beebrain reference files, return:
#  0 if the reference is up to date
# -1 if any reference file is missing
# -2 if any reference file is older than the bbfile's last-modified time
# For the last case, stale reference files, we normally don't care. It happens
# when we edit bbfiles to see how that changes the JSON output or the graph.
# But it's fine, we just get a warning that we can ignore.
# What we might really want is to watch the bb files exactly as if they're
# source code files, so we can try a change and have it automatically show up
# in the list of errors and see the diff.
# But if a bb file changes we want to regenerate just that output, not all the
# outputs!
def jsbrain_checkref(slug, inpath, refpath):
  inpath  = os.path.abspath(inpath)+"/"
  refpath = os.path.abspath(refpath)+"/"
  bb   = inpath+slug+".bb"
  json = refpath+slug+".json"
  img  = refpath+slug+".png"
  thm  = refpath+slug+"-thumb.png"
  svg  = refpath+slug+".svg"
  if (not os.path.isfile(bb)   or
      not os.path.isfile(json) or 
      not os.path.isfile(img)  or
      not os.path.isfile(thm)  or 
      not os.path.isfile(svg)):   return -1

  bbtime   = os.stat(bb)  .st_mtime
  jsontime = os.stat(json).st_mtime
  imgtime  = os.stat(img) .st_mtime
  thmtime  = os.stat(thm) .st_mtime
  svgtime  = os.stat(svg) .st_mtime
  if (bbtime > jsontime or 
      bbtime > imgtime  or 
      bbtime > thmtime  or 
      bbtime > svgtime):   return -2

  return 0

# Invoke Beebrain on the indicated slug from inpath, placing outputs in outpath,
# generating graphs if requested
def jsbrain_make(job):
  errmsg = ""
  starttm = time.time();
  try:
    # possibly this is now slightly redundant with the beebrain.py command line
    # interface to beebrain that lives in the beebrain server directory so we
    # could maybe call that instead of doing the GET request to localhost?
    # but maybe it makes more sense to do it this way; just thinking out loud!
    payload = {"slug": job.slug, "inpath": job.inpath, "outpath": job.outpath}
    if (not job.graph): payload["nograph"] = "1"
    resp = requests.get("http://localhost:8777/", payload)
    rj = resp.json()
    if (rj['error']):
      errmsg = "jsbrain processing error:\n"
      for e in rj:
        errmsg += "  "+e+" = "+str(rj[e])+"\n"
  except requests.exceptions.RequestException as e:
    errmsg = "Could not connect to jsbrain_server."
  return {'dt': time.time() - starttm, 'errmsg': errmsg}

# Compare the output graph to a reference for the supplied slug
def graph_compare(slug, out, ref):
  errmsg = ""
  imgout = out+"/"+slug+".png"
  imgref = ref+"/"+slug+".png"
  svgout = out+"/"+slug+".svg"
  svgref = ref+"/"+slug+".svg"
  imgdiff = out+"/"+slug+"-diff.png"
  diffcnt = 0
  try:
    if (filecmp.cmp(svgref, svgout, shallow=False)):
      return {'diffcnt': 0, 'imgdiff': imgdiff, 'errmsg': errmsg}
  except OSError as e:
    pass
    # print("Error comparing SVG files: "+str(e.strerror))
  try: 
    try:
      resp = subprocess.check_output(
        ['compare', '-metric', 'AE', "-fuzz", "1%", imgref, imgout, 
         '-compose', 'src', imgdiff], stderr=subprocess.STDOUT)
    except subprocess.CalledProcessError as e:
      if (e.returncode == 1):
        diffcnt = int(e.output.decode('utf-8'))
      else:
        errmsg = "Failed to compare images for "+slug+" with command:\n"
        errmsg += str(e.cmd)
        errmsg += "\n return code: "+str(e.returncode)
        errmsg += "\n and output:\n"+str(e.output.decode('utf-8'))
    except OSError as e:
        errmsg += "Could not execute 'compare' (no ImageMagick?):\n"
        errmsg += " "+e.strerror
    try:
      if (diffcnt == 0):
        os.unlink(imgdiff) # Seems like there are no errors, remove diff
      else:
        subprocess.check_output(
          ['convert', '-append', imgdiff, imgref, imgout, imgdiff],
          stderr=subprocess.STDOUT)
    except OSError as e:
      errmsg += "\nCould not execute 'convert' (no ImageMagick?):\n"
      errmsg += " "+e.strerror
  finally:
    return {'diffcnt': diffcnt, 'imgdiff': imgdiff, 'errmsg': errmsg}

def json_compare(job):
  txt = ""
  try:
    with open(job.outpath+"/"+job.slug+".json", 'r') as myfile: 
      jsonout = json.loads(myfile.read())
    with open(job.jsref+"/"+job.slug+".json", 'r') as myfile: 
      jsonref = json.loads(myfile.read())
    for prop in jsonref:
      if (prop == "proctm" or 
          prop == "thumburl" or 
          prop == "graphurl"  or 
          prop == "svgurl"):
        del jsonout[prop]
        continue
      if (not prop in jsonout):
        #txt += "*** Prp "+prop+" is missing from the output\n"
        #continue
        jsonout[prop] = "*** NO SUCH PROPERTY: '"+prop+"' ***"
      if (not jsonout[prop] == jsonref[prop]):
        pre = prop + " (OLD -> NEW) "
        div = '-' * (cm.ww-cm.lw-4-len(pre))
        txt += pre + div + "\n"
        txt += str(jsonref[prop])+"\n" # reference / old
        txt += str(jsonout[prop])+"\n" # new / current output
        continue
  except FileNotFoundError:
    txt = f'json_compare: Could not open ' \
         +f'{job.outpath+"/"+job.slug+".json"} or ' \
         +f'{job.jsref+"/"+job.slug+".json"}'
  return None if txt == "" else txt

def json_dump(job):
  txt = ""
  try:
    with open(job.outpath+"/"+job.slug+".json", 'r') as myfile: 
      jsonout = json.loads(myfile.read())
    for prop in jsonout:
      txt += "* "+prop+"= "+str(jsonout[prop])+"\n" # new / current output
  except FileNotFoundError:
    txt = "json_dump: Could not open json output file"
      
  return None if txt == "" else txt

# Job processing worker thread -------------------------------------------------

qpending = queue.Queue()   # Pending jobs requests
qcompleted = queue.Queue() # Completed job requests

def worker(pending, completed):
  worker_kill = False # Kill request by the main thread
  while (not worker_kill):
    try:
      # Timeout required to detect the final kill request
      job = pending.get(block=True, timeout=0.5)
      
      reqstr = "R"+str(job.reqid)
      if (job.reqtype == "quit"): worker_kill = True; continue
      elif (job.reqtype == "jsbrain"):
        setstatus(reqstr+": Beebraining "+job.slug+"...")
        resp = JobResponse(job)
        retval = jsbrain_make(job)
        resp.dt = retval['dt']
        resp.errmsg = retval['errmsg']
        # Check if reference is stale (refuse to compare if so? not true now?)
        refstatus = jsbrain_checkref(job.slug, cm.bbdir, cm.jsreff)
        if (refstatus == -1):
          resp.errmsg = "Missing reference files, fresh json output:"
          resp.jsondiff = json_dump(job)
        elif (refstatus == -2 or refstatus == 0):
          # Compare json output to the reference
          resp.jsondiff = json_compare(job)
          # Stale graphs still perform comparison, but with an additional note
          # PS: turns out we never want this note because the only reason the
          # reference files are supposedly stale is that we edited the bb file
          # which is always on purpose and we want to treat that the same as
          # any source code change and just regenerate the output files and 
          # compare them to the reference files same as ever.
          #if (refstatus == -2):
          #  resp.errmsg = "WARNING: Stale reference files. " + \
          #    "BB file was edited after the references were last generated.\n"
          #  if (resp.jsondiff == None):
          #    resp.errmsg += "* No json differences found.\n"
          
          # If enabled, compare generated graph to the reference
          if (cm.graph):
            setstatus(reqstr+": Comparing graphs for "+job.slug+"...")
            gres = graph_compare(job.slug, job.outpath, job.jsref )
            if (gres['errmsg']):
              resp.errmsg += "\nError comparing graphs:\n"
              resp.errmsg += gres['errmsg']
            elif (gres['diffcnt'] > 0):
              resp.grdiff = gres['diffcnt']
              resp.errmsg += "Graphs differ by "+str(resp.grdiff)+" pixels."
            #elif (refstatus == -2):
            #  resp.errmsg += "\n* No graph differences found."
                    
        setstatus(reqstr+": Comparison for "+job.slug+" finished!")
        updateAverage(resp.dt)
      elif (job.reqtype == "jsref"):
        setstatus(reqstr+": Generating reference for "+job.slug+"...")
        resp = JobResponse(job)
        retval = jsbrain_make(job)
        resp.dt = retval['dt']
        resp.errmsg = retval['errmsg']
        setstatus(reqstr+": Generating reference for "+job.slug+"... done!")
        updateAverage(resp.dt)

      # Inform the main thread about the result
      qcompleted.put(resp)
        
    except (queue.Empty): pass

  setstatus("Worker thread finished.")
    
def worker_start():
  return threading.Thread(target=worker, args=(qpending,qcompleted))

def worker_stop():
  while (not qpending.empty()): qpending.get_nowait()  # empty the request queue
  qpending.put(JobRequest("quit"))   # issue a kill request to the worker thread

def find_goal(slug): return cm.goals.index(slug) # i guess this is silly

def find_problem_slug(slug):
  for i in range(len(cm.problems)):
    e = cm.problems[i]
    if (e.req.slug == slug): return i
  return -1

def find_problem(resp):
  for i in range(len(cm.problems)):
    e = cm.problems[i]
    if (e.req.reqtype == resp.req.reqtype and e.req.slug == resp.req.slug):
      return i
  return -1

def add_problem(resp):
  i = find_problem(resp)
  if (i < 0): cm.problems.append(resp)
  else:       cm.problems[i] = resp
  cm.ls.bottom = len(cm.problems)
  
def remove_problem(resp):
  i = find_problem(resp)
  if (i < 0): return
  del cm.problems[i]
  if (cm.ls.cur + cm.ls.top >= i):
    if (cm.ls.top != 0 ): cm.ls.top -= 1
    elif (cm.ls.cur != 0): cm.ls.cur -= 1
  cm.ls.bottom = len(cm.problems)
  
# Main round-robin loop tasks --------------------------------------------------

# Status task: Monitors status message queue and updates status window
qstatus = queue.Queue() # status messages
def setstatus(msg): qstatus.put(msg)
def setprogress(percent): cm.progress = percent
# TODO: resetAverage and updateAverage are not thread safe, fix!
def resetAverage(): 
  cm.max_time = 0
  cm.total_time = 0
  cm.total_count = 0
  cm.last_time = 0
def updateAverage(time): 
  if (time > cm.max_time): cm.max_time = time
  cm.total_time += time
  cm.total_count += 1
  cm.last_time = time
def statusTask():
  if (cm.state == ST.IDLE):
    setstatus("Waiting for source file or bbfile changes...")
  # Process pending status messages
  try:
    msg = qstatus.get_nowait()
    newstat = trstr(msg.ljust(cm.ww-4), cm.ww-2)
    if (newstat != cm.status):
      cm.status = trstr(msg.ljust(cm.ww-4), cm.ww-2)
      refresh_status()
  except (queue.Empty): pass

# Update all the last-modified-times of the bbfiles
def lmTask():
  return "TODO"

# UI task: Monitors user input, handles menu events, manages top line
def uiTask():
  c = cm.lwin.getch()
  cg = cm.curgoal
  cgs = None if not cm.goals or cg < 0 or cg >= len(cm.goals) else cm.goals[cg]
  # Check if a yes/no dialog is active, if so, process keys accordingly
  if (cm.dwin):
    if   c == ord('y'): return True
    elif c == ord('n'):
      remove_dialog()
      refresh_all()
      return False
    elif c == curses.KEY_RESIZE:
      resize_windows()
      return False
    else:
      return False
    
  if   c == ord('q'):
    create_dialog("Quit? Really?")

  elif c == ord(' '): refresh_all() # not sure this is of any value
  elif c == curses.KEY_ENTER or c == 10 or c == 13:
    # ENTER displays graph diff for the currently selected problem
    flon(f'ENTER keypress! {cgs}')
    if (len(cm.problems) > 0 and cm.graph):
      curpr = cm.problems[cm.ls.top+cm.ls.cur]
      if (curpr.grdiff and curpr.grdiff > 0):
        try:
          imgdiff = cm.jsoutf+"/"+curpr.req.slug+"-diff.png"
          subprocess.Popen([DISPCMD+' '+imgdiff],
                           shell=True,stdin=None,stdout=None,stderr=None,
                           close_fds=True)
        except OSError as e: pass
      else:
        # If no graph differences are present, just show the png output
        try:
          img=cm.jsoutf+"/"+curpr.req.slug+".png"
          subprocess.Popen([DISPCMD+' '+img],
                           shell=True,stdin=None,stdout=None,stderr=None,
                           close_fds=True)
        except OSError as e: pass

  elif c == ord('p'): 
    flon(f'p keypress! {cgs}')
    cm.paused = not cm.paused
    refresh_topline()
  elif c == ord('c'):
    flon(f'c keypress! {cgs}')
    if (len(cm.problems) > 0): 
      req = cm.problems[cm.ls.top+cm.ls.cur].req
      bbfile = os.path.abspath(cm.bbdir)+"/"+req.slug+".bb"
      if (os.path.isfile(bbfile)):
        qpending.put(req)
      else:
        remove_problem(cm.problems[cm.ls.top+cm.ls.cur])
  elif c == ord('r'):
    flon(f'r keypress! {cgs}')
    if (len(cm.problems) > 0):
      # here we're queueing a new request for whatever bbfile the cursor is on
      # because we want to regenerate the references for it.
      # i think the idea is to queue the generation of new references and then
      # also requeue the request in the list of problems but i'm a bit fuzzy on
      # that part. the list of problems are things where the reference and the
      # output don't match. what's a req for a problem bbfile?
      req = cm.problems[cm.ls.top+cm.ls.cur].req
      newreq = JobRequest("jsref")
      newreq.slug = req.slug
      #DEBUG += f'(slug={req.slug})\n'
      newreq.inpath = req.inpath
      newreq.outpath = cm.jsreff
      newreq.graph = True
      # why is it ok not to set newreq.jsref here? it seems to work, but why?
      qpending.put(newreq)
      qpending.put(req)
  elif c == ord('R'):
    flon(f'R keypress! {cgs}')
    cm.jsref = not cm.jsref
    cm.forcestart = True
    refresh_topline()
  elif c == ord('g'):
    cm.graph = not cm.graph
    refresh_topline()
  elif c == ord('s'):
    flon(f's keypress! {cgs}')
    if (cm.state == ST.IDLE): cm.forcestart = True
    else:                     cm.forcestop = True
      
  elif c == curses.KEY_UP:     scroll(cm.ls, UP);   refresh_windows()
  elif c == curses.KEY_DOWN:   scroll(cm.ls, DOWN); refresh_windows()
  elif c == curses.KEY_LEFT:   paging(cm.rs, UP);   refresh_windows()
  elif c == curses.KEY_RIGHT:  paging(cm.rs, DOWN); refresh_windows()
  elif c == curses.KEY_RESIZE: resize_windows()
  return False

def displayTask():
  refresh_dialog()
  pass # manages the left and right windows

def alert():     cm.req_alert = True
def alertoff():  cm.req_alert = False; cm.alerted = False
def alertTask():
  if (not cm.alerted and cm.req_alert):
    freak()
    cm.alerted = True
    cm.req_alert = False
  
# Job manager task: Coordinates dispatching of goal processing jobs and
# interprets their responses from the worker thread.
def jobDispatch(req, slug, inpath, outpath, graph):
  req.slug = slug
  req.inpath = inpath
  req.outpath = outpath
  req.graph = graph
  qpending.put(req)
  cm.lastreq = req.reqid

def restartJobs():
  alertoff()
  cm.paused = False
  cm.firstreq = cm.lastreq
  cm.curgoal = 0
  update_goallist()
  sort_goallist()
  resetAverage()
  
# Handles processing of jobs. Has a state machine structure defined above.
def jobTask():
  #global DEBUG
  # Go through job responses and interpret results
  while (not qcompleted.empty()):
    try:
      resp = qcompleted.get_nowait()
      if (resp.errmsg or resp.jsondiff or resp.grdiff):
        add_problem(resp)
        if (cm.state != ST.IDLE and resp.req.reqid > cm.firstreq): alert()
      else:
        remove_problem(resp)
        # If the reference was regenerated, remove Beebrain problems as well
        if (resp.req.reqtype == "jsref"):
          resp.req.reqtype = "jsbrain"
          remove_problem(resp)
          
      refresh_windows()
      
      if (resp.req.reqid == cm.lastreq): cm.jobsdone = True
      if (cm.state != ST.IDLE):
        cm.curgoal += 1
        if (cm.curgoal > len(cm.goals)): 
          flog(f'DEBUG: {cm.curgoal} out of {len(cm.goals)} goals?')
          setprogress(100)
        else:
          setprogress(100*cm.curgoal/len(cm.goals))
    except (queue.Empty): pass

  prevstate = cm.state  
  # Process state machine transitions and tasks
  if (cm.state == ST.INIT):
    alertoff()
    cm.forcestop = False
    cm.paused = False
    refresh_topline()
    cm.last_update = time.time()
    cm.curgoal = 0
    while (not qpending.empty()): qpending.get_nowait()
    setprogress(0)
    cm.state = ST.IDLE
    
  elif (cm.state == ST.IDLE):
    if (cm.sourcechange >= 0): 
      cm.sourcechange = -1
      cm.state = ST.PROC
      restartJobs()
    if (cm.bbedit != ''):
      # bb file edited; queue it up or something? sadly i don't know what i'm
      # doing here. do i want to just immediately dispatch it?
      # what i'm trying to accomplish is to generate new output for just the one
      # bbfile that changed, not cause automon to reprocess the whole list of
      # goals.
      #DEBUG = f'noticing {cm.bbedit} changed, dispatching it'
      newreq = JobRequest("jsbrain")
      newreq.slug    = cm.bbedit
      newreq.inpath  = cm.bbdir
      newreq.outpath = cm.jsoutf
      newreq.jsref   = cm.jsreff
      newreq.graph   = True
      # we need to insert cm.bbedit at the beginning of cm.goals maybe?
      cm.curgoal = cm.goals.index(cm.bbedit)
      setprogress(100*cm.curgoal/len(cm.goals))
      cm.paused = False
      #cm.firstreq = cm.lastreq # what is this for?
      qpending.put(newreq)  # put vs put_nowait?
      #jobDispatch(newreq, newreq.slug, cm.bbdir, cm.jsreff, True)
      cm.bbedit = ''
      cm.state = ST.PROC
      #restartJobs() # maybe? but we just want to process this one bbfile...

    if (cm.forcestart):
      cm.forcestart = False
      cm.state = ST.PROC
      restartJobs()
      
  elif (cm.state == ST.PROC):
    if (cm.forcestop):
      cm.jsref = False
      cm.state = ST.INIT

    elif (cm.bbedit != ''):
      # in this case a bbfile was changed while we're processing the goal list.
      # we need to insert it and process it immediately, just like hitting 'c'
      # on it if it were in the list of problems.
      i = cm.goals.index(cm.bbedit)
      # copying this from the condition directly below (un-DRY alert)
      newlist = cm.goals[i:None]
      newlist.extend(cm.goals[0:i])
      cm.goals = newlist
      #sort_goallist() # do we want to do this?
      cm.bbedit = ''
      cm.curgoal = 0
      setprogress(0)
      #DEBUG = \
      #  f'noticed {cm.bbedit} changed while processing {cm.goals[cm.curgoal]}'
      #refresh_topline()

    elif (cm.sourcechange >=0 and cm.sourcechange < len(cm.goals)):
      # Source change detected, rearrange the bb file list and
      # continue processing without refreshing the goal list
      newlist = cm.goals[cm.sourcechange:None]
      newlist.extend(cm.goals[0:cm.sourcechange])
      cm.goals = newlist
      sort_goallist()
      cm.sourcechange = -1
      cm.curgoal = 0
      setprogress(0)
        
    elif (cm.curgoal >= len(cm.goals)):
      if (cm.sourcechange < 0):
        cm.jsref = False
        if (len(cm.problems) == 0): ahhhh()
        cm.state = ST.INIT

    elif (cm.forcestart): cm.state = ST.INIT
    elif (cm.paused):     cm.state = ST.PAUS
    elif (cm.jsref):      cm.state = ST.JSRF
    else:                 cm.state = ST.JSBR

    # Sleep longer until all pending jobs are dispatched
    if (not qpending.empty()):
      time.sleep(0.02)
      return

  elif (cm.state == ST.JSRF):
    # why are we doing splitext here? the list of things in cm.goals are all
    # just slugs. oh, turns out splitext("foo")[0] is just "foo" so that
    # explains that. when i'm not in the middle of a million other changes to
    # this file i can refactor this to just be 
    # slug = cm.goals[cm.curgoal] and look for other similar cases.
    #slug = os.path.splitext(cm.goals[cm.curgoal])[0] #SCHDEL
    slug = cm.goals[cm.curgoal]
    req = JobRequest("jsref")
    jobDispatch(req, slug, cm.bbdir, cm.jsreff, True)
    cm.state = ST.WAIT
    
  elif (cm.state == ST.JSBR):
    slug = os.path.splitext(cm.goals[cm.curgoal])[0]
    req = JobRequest("jsbrain")
    req.jsref = cm.jsreff
    jobDispatch(req, slug, cm.bbdir, cm.jsoutf, cm.graph)
    cm.state = ST.WAIT

  elif (cm.state == ST.WAIT):
    cm.last_update = time.time()
    if (cm.jobsdone):
      cm.jobsdone = False
      cm.state = ST.PROC

  elif (cm.state == ST.PAUS):
    if (not cm.paused or cm.forcestop):
      cm.state = ST.PROC
    else:
      time.sleep(0.1) # sleep longer if paused
      return

  elif (cm.state == ST.EXIT):
    flon("Exiting!")

  else:
    exitonerr("Invalid state :"+str(cm.state), false)
    
  if (prevstate != cm.state): refresh_status()
  
# Entry point for the monitoring loop
def monitor(stdscr, bbdir, graph, logging, force, watchdirs):
  # Precompute various input and output path strings
  cm.bbdir = os.path.abspath(bbdir)
  cm.jsreff = os.path.abspath(cm.bbdir+"/jsref")
  cm.jsoutf = os.path.abspath(cm.bbdir+"/jsout")

  cm.graph = graph
  cm.logging = logging
  
  # Clear screen and initialize various fields
  cm.sscr = stdscr
  cm.sscr.clear()
  cm.wh,cm.ww = cm.sscr.getmaxyx()

  # Create and render windows
  resize_windows()

  curses.curs_set(False)
  cm.lwin.keypad(True)
  cm.lwin.nodelay(True)
  
  restartJobs()
  cm.jsref = force
  refresh_all()
      
  # Initialize and start worker thread
  worker_thread = worker_start()
  worker_thread.start()
  
  #global DEBUG
  # Source directoty observer
  event_handler = JSBrainEventHandler()
  observer = Observer()
  flon(f'adding bbdir={bbdir} to directories to watch for changes')
  observer.schedule(event_handler, bbdir)
  for d in watchdirs: 
    flon(f'adding srcdir={d} to directories to watch for changes')
    observer.schedule(event_handler, d)
  observer.start()
  
  cm.paused = False
  try:
    while(True):
      #flon('start statusTask/uiTask/jobTask/displayTask/alertTask loop')
      statusTask()
      if (uiTask()): break
      jobTask()
      displayTask()
      alertTask()
      curses.doupdate()
      #flon('sleep 1s (originally 0.01)')
      time.sleep(.01) # TODO: originally 0.01, 1 or more for debugging

  except Exception as e:
    flon("Barf!")
    traceback.print_exc()
    print("\n")
    pass
  flon('broke out of main loop, doing worker_stop()'); worker_stop()
  flon('worker_thread.join()?');                       worker_thread.join()
  flon('curses.curs_set(True)?');                      curses.curs_set(True)
  flon('end of monitor function')

# Main entry point for Automon. Parse command line arguments, set appropriate
# fields and flags, and invoke the curses wrapper with the function monitor().
def main(argv):
  flog('-'*80 + '\n')
  flon(f'Automon BEGIN {nowstamp()}')
  try: opts, args = getopt.getopt(argv, "hglf", ["help", "graph", "log", "force"])
  except getopt.GetoptError as err: exitonerr(str(err))
    
  graph = False
  logging = False
  force = False
  for opt, arg in opts:
    if   opt in ('-h', '--help'): exitonerr('')
    elif opt in ('-g', '--graph'): graph = True
    elif opt in ('-l', '--log'):   logging = True
    elif opt in ('-f', '--force'): force = True
    else: exitonerr(f'Unrecognized option: {opt}')

  if (len(args) == 0): exitonerr("Must provide a directory of .bb files")

  bbdir = args[0]
  watchdirs = args[1:]
  for d in watchdirs:
    if (not os.path.isdir(d) or not os.path.exists(d)): 
      exitonerr(f'{d} is not a directory')
  
  curses.wrapper(monitor, bbdir, graph, logging, force, watchdirs)
  flon(f'Automon END   {nowstamp()}')
  flog('-'*80 + '\n')

# Make sure we only execute main in the top level environment
if __name__ == "__main__":
  # this had been breaking the usage message but seems fine now
  mystdout = StdOutWrapper()
  sys.stdout = mystdout
  sys.stderr = mystdout

  try:
    main(sys.argv[1:])
  finally:
    sys.stdout = sys.__stdout__
    sys.stderr = sys.__stderr__
    sys.stdout.write(mystdout.get_text(0,-1))
