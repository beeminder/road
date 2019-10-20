#!/usr/bin/env python3

# Might need pip3 install watchdog
import curses, sys, getopt, os, time, requests, subprocess
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

################################################################################
############################### EVERYTYHING ELSE ###############################

class ST(Enum):
    INIT = 0 # Initializing
    IDLE = 1 # Waiting for trigger (delay or source change)
    RSET = 2 # Reset job procesing parameters
    PROC = 3 # Processing goal list, one at a time
    JSRF = 4 # Initiate jsref generation
    JSBR = 5 # Initiate jsbrain generation
    WAIT = 6 # Wait for processing to finish
    PAUS = 7 # Processing paused
    EXIT = 8 # Exiting automon

# Transitions and triggers. ORDERING of the checks is RELEVANT and CRITICAL
# INIT -> IDLE : Initialization completed
# IDLE -> PROC : sourcechange OR delaydone OR forcestart
# PROC -> IDLE : forcestop
# PROC -> INIT : forcestart OR forcestop OR curgoal == goals
# PROC -> PAUS : )not above) AND paused
# PROC -> JSRF : (not above) AND (jsref OR jsbrain_checkref)
# PROC -> JSBR : (not above)
# JSBR -> WAIT : (not above)
# WAIT -> PROC : jobsdone
# PAUS -> PROC : NOT paused OR forcestop
# *    -> EXIT : exitflag

class StdOutWrapper:
  text = ""
  def write(self,txt):
    self.text += txt
    # Uluc: Why below? Seems to print only the last 30 lines?
    self.text = '\n'.join(self.text.split('\n')[-30:])
  def get_text(self,beg,end):
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
#  |8. Item                               | <- max_lines = 7
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
    self.max_lines = 0
    self.page = 0

# JobRequest and JobResponse objects are used to communicate with the worker
# thread. Upon receiving a JobRequest on the pending job queue, the worker
# thread executes the corresponding Beebrain task and returns the result, as
# well as the original request object in a response queue
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

# This FileSystemEvent handler from the watchdog library is used to monitor
# various directories, initiating a restart for processing jsbrain goals
class JSBrainEventHandler(FileSystemEventHandler):
  def __init__(self):
    FileSystemEventHandler.__init__(self)
  def on_modified(self, event):
    #print(event.event_type)
    #print(event.src_path)
    # Record where source change was detected so bb file list can be reordered
    cm.sourcechange = cm.curgoal

# Global structure for common data ----------------- 
class CMonitor:
  def __init__(self):
    self.sscr = None # Stores stdscr
    self.ww = 80     # Window width
    self.wh = 25     # Window height
    self.twin = None # Top window for information
    self.lwin = None # Left window for the goal list
    self.lw = 0      # Left window width
    self.lh = 0      # Left window height
    self.ls = ScrollData() # Left window scrolling
    self.rwin = None # Right window for the summary of differences
    self.rs = ScrollData() # Right window scrolling
    self.swin = None # Status window
    self.mwin = None # Menu window

    self.goals = []  # List of goals to be processed 
    self.problems = []  # List of problematic goals 

    self.status = "Initializing..."
    self.progress = 0
    self.needupdate = False
    
    self.bbdir = None  # Directory for bb files
    self.graph = False # Whether to generate graphs or not
    # Current jobTask state
    self.state = ST.INIT
    
    # Various events and flags for the state machine
    self.jobsdone = False
    self.sourcechange = -1
    self.delaydone = False
    self.forcestart = True
    self.forcestop = False
    self.exitflag = False

    self.paused = False     # Processing has paused
    self.jsref = False # Generating reference jsbrain graphs

    self.curgoal = 0
    self.last_update = -1

    # Execution time logs
    self.last_time = 0
    self.total_time = 0
    self.total_count = 0
    
    # Alert task states
    self.req_alert = False  # Alert has been requested
    self.alerted = False    # Alert has been given

    # Job task states
    self.lastreq = -1   # Request ID for the last request
    self.firstreq = -1  # First request ID for the current processing batch
    
    self.delay = -1     # Delay between each iteration through goals

    self.jsref = None  # directory for jsbrain reference files 
    self.jsout = None  # directory for jsbrain output files
    
cm = CMonitor()

# Some constants and configuration elements ----------------- 
# Menu details
menu = [
  ['c', 'reCheck'],
  ['r', 'reRef'],
  ['s', 'Stop/Start'],
  ['p', 'Pause/Resume'],
  ['g', 'Graph on/off'],
  ['R', 'AllRefs'],
  ['q', 'Quit']
]
UP = -1   # Scroll-up increment
DOWN = 1  # Scroll-down increment
PLAY = next(p for p in ['/usr/bin/play', '/usr/bin/afplay']
      if os.path.exists(p)) # path to yr utility of choice to play sound 
LWW = 40 # Width of left window

# Utility functions  ------------------------------
def exitonerr( err, usage=True ):
  usage = ''' Usage: automon.py <options> bbdir
 Supported options are:
  -g or --graph : Enable graph comparisons
  -f or --force : Force regeneration of reference outputs
  -d or --delay : Delay (in seconds) between loop iterations
  -w or --watch : Monitor directory for changes (multiple directories ok)'''
  print("\n========== jsbrain Output Monitoring/Comparison Daemon ==========")
  if (err): print(" Error: "+err)
  if (usage): print(usage+"\n")
  sys.exit()

def play( sound ):
  try:
    subprocess.check_output([PLAY, sound], stderr=subprocess.STDOUT)
  except FileNotFoundError:
    print(" **** Cannot execute 'play' to play sounds")
  
def freak(): play("uhoh.wav")
def ahhhh(): play("phew.wav")

def trstr(s, l): return (s[:l] + '..') if len(s) > l else s

# Scrolling related functions ------------------------------

# Update the scroll object 's' to advance by 1 in 'dir'
def scroll(s, dir):
  # next cursor position after scrolling
  next_line = s.cur + dir

  # Up direction scroll overflow: current cursor position is zero, but top 
  # position greater than zero 
  if dir == UP and (s.top > 0 and s.cur == 0):
    s.top += dir
    return
  # Down direction scroll overflow: next cursor position touch the max lines,
  # but absolute position of max lines could not touch the bottom
  if dir == DOWN and (next_line == s.max_lines) \
     and (s.top + s.max_lines < s.bottom):
    s.top += dir
    return
  # Scroll up: current cursor position or top position is greater than zero
  if (dir == UP) and (s.top > 0 or s.cur > 0):
    s.cur = next_line
    return
  # Scroll down: next cursor position is above max lines, and absolute
  # position of next cursor could not touch the bottom
  if dir == DOWN and next_line < s.max_lines and s.top + next_line < s.bottom:
    s.cur = next_line
    return
    
# Update the scroll object 's' to advance by half a page (max_lines/2) in 'dir'
def paging(s, direction):
  ml = int(s.max_lines/2)
  s.page = s.bottom // ml
  
  current_page = (s.top + s.cur) // ml
  next_page = current_page + direction

  # The last page may have fewer items than max lines, so we should adjust the
  # current cursor position as maximum item count on last page
  if next_page == s.page: s.cur = min(s.cur, s.bottom % ml - 1)

  # Page up: if current page is not a first page, page up is possible top
  # position can not be negative, so if top position is
  # going to be negative, we should set it as 0
  if direction == UP and current_page > 0:
    s.top = max(0, s.top - ml)
    return
  # Page down: if current page is not a last page, page down is possible
  if direction == DOWN and current_page < s.page:
    s.top += ml
    return

# Display and window management and rendering ------------------------------
def _addstr(w,y,x,s,a=curses.A_NORMAL):
  try:
    w.addstr(y,x,s,a)
  except curses.error:
    print("_addstr error: ww:"+str(cm.ww)+",wh:"+str(cm.wh)+",y:"+str(y)+", x:"+str(x)+",str="+s)
    pass

def resize_windows():
  success = False
  # Try until successful. Sometimes, there are race conditions with
  # resize that result in errors, in which case resizes are
  # reattempted
  while (not success):
    cm.wh,cm.ww = cm.sscr.getmaxyx()
    lw = min(int(cm.ww/2),LWW)
    success = True
    
    try:
      # Update the top window
      if (cm.twin): cm.twin.resize(1,cm.ww)
      else: cm.twin = curses.newwin(1,cm.ww,0,0)
      cm.twin.refresh()

      # Update the left window and its scroll data
      if (cm.lwin): cm.lwin.resize(cm.wh-5,lw)
      else: cm.lwin = curses.newwin(cm.wh-5,lw,1,0)
      cm.lwin.refresh()
      cm.lw = lw;cm.lh = cm.wh-5

      # Update left and right scroll data based on the new height
      cm.ls.max_lines = cm.wh-7
      if cm.ls.cur >= cm.ls.max_lines:
        cm.ls.top += (cm.ls.cur-cm.ls.max_lines+1)
        cm.ls.cur = cm.ls.max_lines-1
      
      # Update the right window and its scroll data
      if (cm.rwin): cm.rwin.resize(cm.wh-5,cm.ww-lw);cm.rwin.mvwin(1,lw)
      else: cm.rwin = curses.newwin(cm.wh-5,cm.ww-lw,1,lw)
      cm.rwin.refresh()
      cm.rw = cm.ww-lw
      cm.rs.max_lines = cm.wh-7
      cm.rs.page = cm.rs.bottom // int(cm.rs.max_lines/2)

      # Update status and menu windows
      if (cm.swin): cm.swin.resize(3,cm.ww);cm.swin.mvwin(cm.wh-4,0)
      else: cm.swin = curses.newwin(3,cm.ww,cm.wh-4,0)
      cm.swin.refresh()

      if (cm.mwin): cm.mwin.resize(1,cm.ww);cm.mwin.mvwin(cm.wh-1,0)
      else: cm.mwin = curses.newwin(1,cm.ww,cm.wh-1,0)
      cm.mwin.refresh()
    except:
      # Exception may mean that resized windows ended up outside
      # a resized screen
      success = False
      
  refresh_all()

def refresh_menu():
  x = 1; w = cm.mwin

  w.clear()
  for mi in menu:
    if (x + len(mi[0]) + len(mi[1]) + 2 < cm.ww-2):
      _addstr(w,0,x,mi[0], curses.A_REVERSE)
      w.addch(0,x+len(mi[0]),' ')
      x += len(mi[0])+1
      _addstr(w,0,x, mi[1])
      x += len(mi[1])
      _addstr(w,0,x+1,"  ")
      x += 2
  w.refresh()

def refresh_topline():
  w = cm.twin
  w.clear()
  if (cm.graph): _addstr(w,0,1,"[Graph]", curses.A_REVERSE)
  else:  _addstr(w,0,1,"[Graph]")

  if (cm.jsref): _addstr(w,0,10,"[References]", curses.A_REVERSE)
  else:  _addstr(w,0,10,"[References]")

  if (cm.paused): _addstr(w,0,23,"[Paused]", curses.A_REVERSE)
  else:  _addstr(w,0,23,"[Paused]")

  w.refresh()

def refresh_status():
  w = cm.swin
  w.clear();w.box()
  _addstr(w,0,1,str(cm.state), curses.A_BOLD)
  w.addnstr(1,1,cm.status,cm.ww-2)
  _addstr(w,0,10,
          "(".ljust(int(cm.progress*(cm.ww-14)/100),'o').ljust(cm.ww-14)+")")
  if (cm.total_count != 0):
    _addstr(w,2,cm.ww-29,
         " Avg: "+str(int(1000*cm.total_time/cm.total_count))+"ms ",
         curses.A_BOLD)
    _addstr(w,2,cm.ww-15," Last: "+str(int(1000*cm.last_time))+"ms ",
         curses.A_BOLD)
  w.refresh()

def refresh_windows():
  w = cm.lwin
  w.clear();w.box();w.vline(1,cm.lw-6,0,cm.lh-2)
  w.addch(0,cm.lw-6,curses.ACS_TTEE)
  w.addch(cm.lh-1,cm.lw-6,curses.ACS_BTEE)
  _addstr(w,0,1,"Errors in:", curses.A_BOLD)
  _addstr(w,0,cm.lw-5,"RJPG", curses.A_BOLD)
  for i, item in enumerate(cm.problems[cm.ls.top:cm.ls.top + cm.ls.max_lines]):
    # Highlight the current cursor line
    slug = trstr(item.req.slug,cm.lw-9).ljust(cm.lw-7)
    if i == cm.ls.cur: _addstr(w,i+1, 1, slug, curses.A_REVERSE)
    else: _addstr(w,i+1, 1, slug)
    if (item.req.reqtype == "jsref"):
      _addstr(w,i+1, cm.lw-5, "X", curses.A_REVERSE)
    elif (item.req.reqtype == "jsbrain"):
      _addstr(w,i+1, cm.lw-4, "X", curses.A_REVERSE)
    if (item.grdiff and item.grdiff > 0):
      _addstr(w,i+1, cm.lw-2, "X", curses.A_REVERSE)
      
  w.refresh()

  w = cm.rwin
  w.clear(); w.box()
  if (cm.ls.bottom == 0): _addstr(w,0,1,"Goal: not selected", curses.A_BOLD)
  else:
    sel = cm.ls.top+cm.ls.cur
    pr = cm.problems[sel]
    errmsgs = []
    if (pr.errmsg): errmsgs += pr.errmsg.split('\n')
    if (pr.jsondiff): errmsgs += pr.jsondiff.split('\n')
    errtxt = []
    for e in errmsgs:
      errtxt += textwrap.wrap(e, cm.ww-cm.lw-3)
    cm.rs.bottom = len(errtxt)
    cm.rs.page = cm.rs.bottom // int(cm.rs.max_lines/2)
    w.addnstr(0,1,"Errors: ("+pr.req.reqtype+", "+pr.req.slug+")", cm.ww-cm.lw-2,curses.A_BOLD)
    for i, item in enumerate(errtxt[cm.rs.top:cm.rs.top+cm.rs.max_lines]):
      _addstr(w,i+1, 1, item)
    w.vline(1+int((cm.lh-2)*cm.rs.top/((cm.rs.page+1)*(cm.rs.max_lines//2))), cm.ww-cm.lw-2, curses.ACS_BOARD, (cm.lh-2)//(cm.rs.page+1))
  w.refresh()

def refresh_all():
  refresh_topline()
  refresh_windows()
  refresh_status()
  refresh_menu()

# Sorts the goal list based on a particular prioritization. Currently,
# this just shifts all goals with errors to the beginning of the list
def sort_goallist():
    freeind = 0
    for i in range(len(cm.goals)):
        slug = os.path.splitext(cm.goals[i])[0]
        if (find_problem_slug(slug) < 0):
            continue
        cm.goals[freeind],cm.goals[i] = cm.goals[i],cm.goals[freeind]
        freeind += 1
    return

# Rescans the bb file directory to get an updated file list
def update_goallist():
  bbfiles = [f for f in os.listdir(cm.bbdir)
         if (f.endswith(".bb") and os.path.isfile(cm.bbdir+"/"+f))]
  cm.goals = [os.path.splitext(b)[0] for b in bbfiles]
  cm.ls.bottom = len(cm.problems)
  
# JSBRAIN related functions ------------------------------

# Checks timestamps of generated files wrt the jsbrain reference
# files, returns
# 0 if the reference is up to date
# -1 if any of the reference files are missing
# -2 if the BB file is more recent than any of the references
def jsbrain_checkref( slug, inpath, refpath ):
  inpath = os.path.abspath(inpath)+"/"
  refpath = os.path.abspath(refpath)+"/"
  bb = inpath+slug+".bb"
  json = refpath+slug+".json"
  img = refpath+slug+".png"
  thm = refpath+slug+"-thumb.png"
  svg = refpath+slug+".svg"
  if (not os.path.isfile(bb) or
      not os.path.isfile(json) or not os.path.isfile(img)
    or not os.path.isfile(thm) or not os.path.isfile(svg)):
    return -1
  bbtime = os.stat(bb).st_mtime
  jsontime = os.stat(json).st_mtime
  imgtime = os.stat(img).st_mtime
  thmtime = os.stat(thm).st_mtime
  svgtime = os.stat(svg).st_mtime
  if (bbtime > jsontime or bbtime > imgtime or bbtime > thmtime or bbtime > svgtime):
    return -2
  return 0

# Invokes jsbrain on the indiated slug from inpath, placing outputs in
# outpath, generating graphs if requested
def jsbrain_make(job):
  errmsg = ""
  starttm = time.time();
  try:
    payload = {"slug": job.slug, "inpath" : job.inpath, "outpath": job.outpath}
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


# Compares the output graph to a reference for the supplied slug
def graph_compare(slug, out, ref ):
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
    print("Error comparing SVG files: "+str(e.strerror))
  try: 
    try:
      resp = subprocess.check_output(
        ['compare', '-metric', 'AE', imgref, imgout, '-compose', 'src', 
         imgdiff], stderr=subprocess.STDOUT)
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
        os.unlink(imgdiff) #Seems like there are no errors, remove diff
      else:
        subprocess.check_output(
          ['convert', '-append', imgdiff, imgref, imgout, imgdiff],
          stderr=subprocess.STDOUT)
    except OSError as e:
      errmsg += "\nCould not execute 'convert' (no ImageMagick?):\n"
      errmsg += " "+e.strerror
  finally:
    return {'diffcnt': diffcnt, 'imgdiff': imgdiff, 'errmsg': errmsg}

def json_compare( job ):
  txt = ""
  with open(job.outpath+"/"+job.slug+".json", 'r') as myfile: jsonout=json.loads(myfile.read())
  with open(job.jsref+"/"+job.slug+".json", 'r') as myfile: jsonref=json.loads(myfile.read())
  for prop in jsonref:
    if (prop == "proctm" or prop == "thumburl" or prop == "graphurl"  or prop == "svgurl"):
      del jsonout[prop]
      continue
    if (not prop in jsonout):
      txt += "*** Prp "+prop+" is missing from the output\n"
      continue
    if (not jsonout[prop] == jsonref[prop]):
      pre = prop + " (OLD -> NEW) "
      div = '-' * (cm.ww-cm.lw-4-len(pre))
      txt += pre + div + "\n"
      txt += str(jsonref[prop])+"\n" # reference / old
      txt += str(jsonout[prop])+"\n" # new / current output
      continue
      
  return None if txt == "" else txt

def json_dump( job ):
  txt = ""
  with open(job.outpath+"/"+job.slug+".json", 'r') as myfile: jsonout=json.loads(myfile.read())
  for prop in jsonout:
    txt += "* "+prop+"= "+str(jsonout[prop])+"\n" # new / current output
      
  return None if txt == "" else txt

# Job processing worker thread ---------------------------------------
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
        setstatus(reqstr+": Running jsbrain for "+job.slug+"...")
        resp = JobResponse(job)
        retval = jsbrain_make(job)
        resp.dt = retval['dt']
        resp.errmsg = retval['errmsg']
        # Check if reference is stale; refuse to compare if so
        refstatus = jsbrain_checkref(job.slug, cm.bbdir, cm.jsreff)
        if (refstatus == -1):
          resp.errmsg = "Missing reference files, fresh json output:"
          resp.jsondiff = json_dump(job)
        elif (refstatus == -2 or refstatus == 0):
            # Compare json output to the reference
            resp.jsondiff = json_compare(job)
            # Stale graphs still perform comparison, but with an additional note.
            if (refstatus == -2):
                resp.errmsg = "WARNING: Stale reference files!"
                if (resp.jsondiff == None):
                    resp.errmsg += "\n* No json differences found."
          
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
                elif (refstatus == -2):
                    resp.errmsg += "\n* No graph differences found."
                    
        setstatus(reqstr+": Comparison for "+job.slug+" finished!")
        updateAverage(resp.dt)
      elif (job.reqtype == "jsref"):
        setstatus(reqstr+": Generating jsbrain reference for "+job.slug+"...")
        resp = JobResponse(job)
        retval = jsbrain_make(job)
        resp.dt = retval['dt']
        resp.errmsg = retval['errmsg']
        setstatus(reqstr+": Generating jsbrain reference for "+job.slug+"...done!")
        updateAverage(resp.dt)

      # Inform the main thread about the result
      qcompleted.put(resp)
        
    except (queue.Empty): pass

  setstatus("Worker thread finished.")
    
def worker_start():
  return threading.Thread(target=worker,args=(qpending,qcompleted))

def worker_stop():
  # Empty the request queue
  while (not qpending.empty()): qpending.get_nowait()
  # Issue a kill request to the worker thread
  qpending.put(JobRequest("quit"))

def find_problem_slug( slug ):
  for i in range(len(cm.problems)):
    e = cm.problems[i]
    if (e.req.slug == slug): return i
  return -1

def find_problem( resp):
  for i in range(len(cm.problems)):
    e = cm.problems[i]
    if (e.req.reqtype == resp.req.reqtype and e.req.slug == resp.req.slug):
      return i
  return -1

def add_problem( resp ):
  i = find_problem(resp)
  if (i < 0): cm.problems.append( resp )
  else: cm.problems[i] = resp    
  cm.ls.bottom = len(cm.problems)
  
def remove_problem( resp ):
  i = find_problem(resp)
  if (i < 0): return
  del cm.problems[i]
  if (cm.ls.cur + cm.ls.top >= i):
    if (cm.ls.top != 0 ): cm.ls.top -= 1
    elif (cm.ls.cur != 0): cm.ls.cur -= 1
  cm.ls.bottom = len(cm.problems)
  
# Main round-robin loop tasks

# Status task: Monitors the status message queue and updates the
# status window
qstatus = queue.Queue()    # Status messages
def setstatus(msg): qstatus.put(msg)
def setprogress(percent): cm.progress = percent
# TODO: resetAverage and updateAverage are not thread safe, fix!
def resetAverage(): 
  cm.total_time = 0
  cm.total_count = 0
  cm.last_time = 0
def updateAverage(time): 
  cm.total_time += time
  cm.total_count += 1
  cm.last_time = time
def statusTask():
  if (cm.state == ST.IDLE):
    if (cm.delay > 0): setstatus("Waiting for timer tick...")
    else: setstatus("Waiting for source file changes...")
  # Process pending status messages
  try:
    msg = qstatus.get_nowait()
    newstat = trstr(msg.ljust(cm.ww-4),cm.ww-2)
    if (newstat != cm.status):
      cm.status = trstr(msg.ljust(cm.ww-4),cm.ww-2)
      refresh_status()
  except (queue.Empty): pass

# User interface task: Monitors user input, handles menu events and
# manages the top line
def uiTask():
  c = cm.lwin.getch()
  if c == ord('q'): return True
  elif c == curses.KEY_ENTER or c == 10 or c == 13:
    # ENTER displays graph diff for the currently selected problem
    if (len(cm.problems) > 0 and cm.graph):
      curpr = cm.problems[cm.ls.top+cm.ls.cur]
      if (curpr.grdiff and curpr.grdiff > 0):
        try:
          imgdiff=cm.jsoutf+"/"+curpr.req.slug+"-diff.png"
          subprocess.Popen([DISPCMD+' '+imgdiff],
                   shell=True,stdin=None,stdout=None,stderr=None,
                   close_fds=True)
        except OSError as e:
          pass
      else:
        # If no graph differences are present, just show the png output
        try:
          img=cm.jsoutf+"/"+curpr.req.slug+".png"
          subprocess.Popen([DISPCMD+' '+img],
                   shell=True,stdin=None,stdout=None,stderr=None,
                   close_fds=True)
        except OSError as e:
          pass

  elif c == ord('p'): cm.paused = not cm.paused; refresh_topline()
  elif c == ord('c'):
    if (len(cm.problems) > 0):
      req = cm.problems[cm.ls.top+cm.ls.cur].req
      bbfile = os.path.abspath(cm.bbdir)+"/"+req.slug+".bb"
      if (os.path.isfile(bbfile)):
          qpending.put(req)
      else:
          remove_problem(cm.problems[cm.ls.top+cm.ls.cur])
  elif c == ord('r'):
    if (len(cm.problems) > 0):
      req = cm.problems[cm.ls.top+cm.ls.cur].req
      newreq = JobRequest("jsref")
      newreq.slug = req.slug
      newreq.inpath = req.inpath
      newreq.outpath = cm.jsreff
      newreq.graph = True
      qpending.put(newreq)
      qpending.put(req)
  elif c == ord('R'):
    cm.jsref = not cm.jsref
    cm.forcestart = True
    refresh_topline()
  elif c == ord('g'):
    cm.graph = not cm.graph
    refresh_topline()
  elif c == ord('s'):
    if (cm.state == ST.IDLE): cm.forcestart = True
    else:                     cm.forcestop = True
      
  elif c == curses.KEY_UP:
    scroll(cm.ls, UP)
    refresh_windows()
  elif c == curses.KEY_DOWN:
    scroll(cm.ls, DOWN)
    refresh_windows()
  elif c == curses.KEY_LEFT:
    paging(cm.rs, UP)
    refresh_windows()
  elif c == curses.KEY_RIGHT:
    paging(cm.rs, DOWN)
    refresh_windows()
  elif c == curses.KEY_RESIZE:
    resize_windows()
  return False

# Display task: Manages the left and right windows
def displayTask():
  pass

def alert():     cm.req_alert = True
def alertoff():  cm.req_alert = False; cm.alerted = False
def alertTask():
  if (not cm.alerted and cm.req_alert):
    freak()
    cm.alerted = True
    cm.req_alert = False
  
# Job manager task: Coordinates dispatching of goal processing jobs
# and interprets their responses from the worker thread.
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
  
# Handles processing of jobs. Has a state machine structure defined above
def jobTask():
  
  # Go through job responses and interpret results
  while (not qcompleted.empty()):
    try:
      resp = qcompleted.get_nowait()
      if (resp.errmsg or resp.jsondiff or resp.grdiff):
        add_problem(resp)
        if (cm.state != ST.IDLE and resp.req.reqid > cm.firstreq): alert()
      else:
        remove_problem(resp)
        # If the reference was regenerated, remove jsbrain problems as well
        if (resp.req.reqtype == "jsref"):
          resp.req.reqtype = "jsbrain"
          remove_problem(resp)
          
      refresh_windows()
      
      if (resp.req.reqid == cm.lastreq): cm.jobsdone = True
      if (cm.state != ST.IDLE):
        cm.curgoal += 1
        setprogress(100*cm.curgoal/(len(cm.goals)-1))
    except (queue.Empty): pass

  # Check delay
  if (cm.delay>0 and time.time()-cm.last_update>cm.delay):
    cm.delaydone = True

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
    if (cm.sourcechange >= 0): cm.sourcechange = -1;  cm.state = ST.PROC; restartJobs()
    if (cm.delaydone):         cm.delaydone = False;  cm.state = ST.PROC; restartJobs()
    if (cm.forcestart):        cm.forcestart = False; cm.state = ST.PROC; restartJobs()
      
  elif (cm.state == ST.PROC):
    if (cm.forcestop):
        cm.jsref = False
        cm.state = ST.INIT

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

    elif (cm.forcestart):
      cm.state = ST.INIT

    elif (cm.paused):
        cm.state = ST.PAUS
    elif (cm.jsref):
        cm.state = ST.JSRF
    else:
        cm.state = ST.JSBR

    # Sleep longer until all pending jobs are dispatched
    if (not qpending.empty()):
      time.sleep(0.02)
      return

  elif (cm.state == ST.JSRF):
    slug = os.path.splitext(cm.goals[cm.curgoal])[0]
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
      # Sleep longer if paused
      time.sleep(0.1)
      return

  elif (cm.state == ST.EXIT):
    print(ST.EXIT)

  else:
    exitonerr("Invalid state :"+str(cm.state), false)
    
  if (prevstate != cm.state): refresh_status()
  
# Entry point for the monitoring loop ------------------------------
def monitor(stdscr, bbdir, graph, force, delay, watchdir):
  # Precompute various input and output path strings
  cm.bbdir = os.path.abspath(bbdir)
  cm.jsreff = os.path.abspath(cm.bbdir+"/jsref")
  cm.jsoutf = os.path.abspath(cm.bbdir+"/jsout")

  cm.graph = graph
  cm.delay = delay
  
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
  
  # Source directoty observer
  event_handler = JSBrainEventHandler()
  observer = Observer()
  for d in watchdir: observer.schedule(event_handler, d)
  observer.start()
  
  cm.paused = False
  try:
    while(True):
      statusTask()
      if (uiTask()): break
      jobTask()
      displayTask()
      alertTask()
      time.sleep(0.01)

  except Exception as e:
    traceback.print_exc()
    print("\n")
    pass
  worker_stop()
  worker_thread.join()
  curses.curs_set(True)

#  Main entry point for automon. Parses command line arguments, sets
#  appropriate fields and flags and invokes the curses wrapper with
#  the function monitor()
def main( argv ):
  try:
    opts, args = getopt.getopt(argv,"hgfd:w:",["graph","force","delay=","watch="])
  except getopt.GetoptError as err: exitonerr(str(err))
  
  if (len(args) != 1):
    if (len(args) == 0):  exitonerr("Missing bbdir. ")
    elif (len(args) > 1): exitonerr("Extra arguments.")
    
  graph = False
  force = False
  delay = -1
  bbdir = args[0]
  watchdir = []
  
  for opt, arg in opts:
    if opt == '-h': exitonerr("")
    elif opt in ("-g", "--graph"): graph = True
    elif opt in ("-f", "--force"): force = True
    elif opt in ("-d", "--delay"): delay = math.ceil(int(arg))
    elif opt in ("-w", "--watch"):
      if (not os.path.isdir(arg)): exitonerr(arg+' is not a directory')
      watchdir.append(str(arg))
    else:
      print("Unrecognized option: "+opt)
      print(usage)
      sys.exit(2)
      
  if (not os.path.isdir(bbdir) or not os.path.exists(bbdir)):
    exitonerr(bbdir+" is not a directory.")

  if (len(watchdir) != 0 and delay > 0):
    exitonerr("Options -w and -d should not be used together")
  if (len(watchdir) == 0): delay = 10
  
  curses.wrapper(monitor, bbdir, graph, force, delay, watchdir)

# Make sure we only execute main in the top level environment
if __name__ == "__main__":
  # TODO: this breaks the usage message
  mystdout = StdOutWrapper()
  sys.stdout = mystdout
  sys.stderr = mystdout

  try:
    main(sys.argv[1:])
  finally:
    sys.stdout = sys.__stdout__
    sys.stderr = sys.__stderr__
    sys.stdout.write(mystdout.get_text(0,-1))
