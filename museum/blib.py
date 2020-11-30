"""
Beebrain -- doc.bmndr.com/beebrain
Originally written in Mathematica by dreeves, 2008-2010.
Ported to Python by Uluc Saranli around 2011.12.20.
Maintained and evolved by dreeves, 2012-2018.

Usage:
> stats = genStats(params, data)
> genGraph()                      # NB: genStats must be called before this
> genImage(target_image_filename) # NB: genGraph must be called before these
> genThumb(target_thumb_filename)

YBHP AKA BEEBRAIN DEATHLIST:
1. die timezones --------------------------------------------------------- DONE!
2. die asof null --------------------------------------------------------- DONE!
3. die sadedgy ----------------------------------------------------------- DONE!
4. die sadreset ---------------------------------------------------------- DONE!
5. die inferred tini/vini ------------------------------------------------ DONE!
6. die weightloss leniency ----------------------------------------------- DONE!
7. die noisyWidth and auto-widening [blog.bmndr.com/manwide] done for new goals!
8. die exponential roads ------------------------------------------------- DONE!
9. die lanes: Yellow Brick Half Plane (YBHP) -- [done after move to Javascript!]

OTHER POSSIBLE PREREQS BEFORE PORTING ALL THIS TO JAVASCRIPT:
[narrator voice: we moved to Javascript without any of this]
1. True Pauses 
2. Universal PPR -- doc.bmndr.com/ppr
3. Pass in a "backroad" parameter that's a version of the road that's never 
   allowed to change retroactively. The first thing to do with that is to use it
   to color historical datapoints with their original color (aka permacolor)
4. Each segment should show its true roadwidth (lnf) but moot if YBHP
"""

from __future__ import division #py3
from __future__ import print_function #py3
from math import floor, ceil, exp, log, modf
import warnings
import time, datetime, calendar
import os, re
import uuid # just used for tempify
import matplotlib; matplotlib.use('Agg') # stackoverflow.com/questions/4931376
import matplotlib.pyplot as plt
import matplotlib.dates as dt
import matplotlib.image as mpi
import numpy as np
from scipy.signal import filtfilt, butter
from scipy.interpolate import interp1d
#from subprocess import check_output # slurp system call output as string

################################################################################
######################### CONSTANTS AND CONFIGURATION ##########################

#DEV = (os.uname()[1] == "dreev.local") # not used
DIY    = 365.25      # this is what physicists use, eg, to define a light year
SID    = 86400       # seconds in a day (not used: DIM=DIY/12, WIM=DIY/12/7)
BDUSK  = 2147317201  # ~2038, specifically rails's ENDOFDAYS+1 (was 2^31-2weeks)
ZFUN   = lambda x: 0 # function that always returns zero
IMGMAG = next(p for p in ['/usr/bin/convert', '/usr/local/bin/convert']
              if os.path.exists(p)) # path to ImageMagick convert utility

# No timezones in UTC so it's safe to increment days by adding 86400 (SID)
os.environ['TZ'] = 'UTC'; time.tzset()

SECS = { 'y' : DIY*SID,     # Number of seconds in a year, month, etc
         'm' : DIY/12*SID,
         'w' : 7*SID,
         'd' : SID,
         'h' : 3600,        }
UNAM = { 'y' : 'year',      # Unit names
         'm' : 'month',
         'w' : 'week',
         'd' : 'day',
         'h' : 'hour',      }

#def tri(n): return n*(n+1)/2 # nth triangular number
#def abssum(l): []

# Sum of differences of pairs, eg, [1,2,6,9] -> 2-1 + 9-6 = 1+3 = 4
def clocky(l):
  if len(l) % 2 != 0: l = l[:-1] # ignore last entry if unpaired
  return sum([end-start for [start,end] in partition(l,2,2)])

################################################################################
################################################################################
#                                                                              #
#  BOOKMARK: dreev has copied all notes and stuff to jsbrain up to this point  #
#                                                                              #
################################################################################
################################################################################

AGGR = { # Map possible aggday settings to lambdas that aggregate thusly
'last'     : lambda x: x[-1],
'first'    : lambda x: x[0],
'min'      : lambda x: min(x),
'max'      : lambda x: max(x),
'truemean' : lambda x: np.mean(x),
'uniqmean' : lambda x: np.mean(deldups(x)),
'mean'     : lambda x: np.mean(deldups(x)),
'median'   : lambda x: np.median(x),
'mode'     : lambda x: scipy.mode(x),              # mma: Median@Commonest
'trimmean' : lambda x: scipy.trim_mean(x, .1),     # mma: TrimmedMean
'sum'      : lambda x: np.sum(x),
'jolly'    : lambda x: 1 if x else 0, # deprecated; now an alias for 'binary'
'binary'   : lambda x: 1 if x else 0, # 1 iff there exist any datapoints
'nonzero'  : lambda x: 1 if any([i!=0 for i in x]) else 0, # 1 iff non-0 datapts
'triangle' : lambda x: np.sum(x)*(np.sum(x)+1)/2,  # HT DRMcIver
'square'   : lambda x: np.sum(x)**2,
'clocky'   : lambda x: clocky(x), # sum of differences of pairs
'count'    : lambda x: len(x), # number of datapoints entered
'kyshoc'   : lambda x: min(2600, np.sum(x)), # ad hoc, guineapigging
'skatesum' : lambda x: min(rfin, np.sum(x)), # only count the daily min
#tareable' : 
# start with first datapoint and see if the 2nd one is w/in 60 seconds of it.
# for every datapoint, find all the subsequent datapoints w/in 60 seconds of it.
}

AKH    = 7*SID  # Akrasia Horizon, in seconds
ASP    = .6514  # ASPect ratio; monitors like 2560x1600, 1440x900 are .625 (5/8)
DPI    = 100.0  # DPI for graph generation; should not have any effect normally
SCL    = 2.0    # Scale for the initial PNG which is then scaled back
PRAF   = .015   # Fraction of plot range that the axes extend beyond
AXW    = .85    # Axes Width (fraction of the plot width that graph takes up)
AXH    = .88    # Axes Height (fraction of the plot height that graph takes up)
DYEL   = (1.0,   1.0,   0.4  ) # Dark yellow  (mma 1,1,.55; py 1,1,.4)
LYEL   = (1.0,   1.0,   0.60 ) # Light yellow (mma 1,1,.68; py 1,1,.6)
ROSE   = (1.0,   0.5,   0.5  ) # (originally 1,1/3,1/3 then 251,130,199)
AKRA   = (0.3,   0.3,   1.0  ) # (originally 1,1/3,1/3 then 251,130,199)
PURP   = (0.71,  0.42,  0.71 ) # Moving average line and steppy line
BLUE   = (0.918, 0.918, 1.0  ) # Aura
GRUE   = (0.712, 1.0,   0.872) # Aura overlap; (mma .832,1,.832; py .712,1,.872)
ORNG   = (1.0,   0.5,   0.0  ) # Dotted centerline of YBR
BLCK   = (0.0,   0.0,   0.0  ) # For edges of dots
WITE   = (1,     1,     1    ) # For hollow dots
BIGG   = (1.0,   0.9,   0.3  ) # Bigger guiding line demarcating 7-day buffer
PINK   = (1.0,   0.9,   0.9  ) # Pink zone
PNKE   = (1.0,   0.8,   0.8  ) # Edge of pink zone
GRAY   = (.945,  .945,  .945 ) # Watermarks (mma .9625; had .96 thru Nov 2014)
GRNDOT = (0.0,   0.67,  0.0  ) # Dark green for good side of the road
BLUDOT = (0.25,  0.25,  1.0  ) # Blue for correct lane
ORNDOT = (1.0,   0.65,  0.0  ) # Orange for wrong lane
REDDOT = (1.0,   0.0,   0.0  ) # Red for off the road on the bad side

CNAME = { GRNDOT : "green",   # Color names
          BLUDOT : "blue",
          ORNDOT : "orange",
          REDDOT : "red",
          BLCK   : "black",   }

################################################################################
####################### PARAMETERS and default settings ########################
# In-params and out-params are documented at doc.bmndr.com/beebrain

# NOTES:
# o Death to auto-widening and noisy width! Recommend abslnw=stdflux in the UI.
# o Gaps in the Road: If you derail and don't immediately rerail, the YBR should
#   show a gap when you weren't beeminding. The road matrix could indicate this 
#   with a row like {t, null, null} which means no road should be drawn between 
#   the previous row's time and time t. For the purposes of computing the 
#   following row, the null row should be treated as {t, null, 0}.
#   Or just have a 4th column for road matrix indicating if segment is a gap?

pin = { # In Params: Graph settings and their defaults
'offred'   : False, # Whether to use new yesterday-is-red criteria for derails
'deadline' : 0,     # Time of deadline given as seconds before or after midnight
'sadlhole' : True,  # Allow the do-less loophole where you can eke back onto YBR
'asof'     : None,  # Compute everything as if it were this date                
'tini'     : None,  # (tini,vini) specifies the start of the YBR, typically but 
'vini'     : None,  #   not necessarily the same as the initial datapoint       
'road'     : [],    # List of (endTime,goalVal,rate) triples defining the YBR   
'tfin'     : None,  # Goal date (unixtime); end of the Yellow Brick Road        
'vfin'     : None,  # The actual value being targeted; any real value           
'rfin'     : None,  # Final rate (slope) of the YBR before it hits the goal     
'runits'   : 'w',   # Rate units for road and rfin; one of "y","m","w","d","h"  
#'exprd'    : False, # Interpret YBR rate as fractional, not absolute, change   
'yaw'      : 0,     # Which side of the YBR you want to be on, +1 or -1         
'dir'      : 0,     # Which direction you'll go (usually same as yaw)           
'pinkzone' : [],    # Region to shade pink, specified like the road matrix
'tmin'     : None,  # Earliest date to plot on the x-axis (unixtime):           
'tmax'     : None,  #   ((tmin,tmax), (vmin,vmax)) give the plot range, ie, they
'vmin'     : None,  #   control zooming/panning; they default to the entire     
'vmax'     : None,  #   plot -- initial datapoint to past the akrasia horizon   
'kyoom'    : False, # Cumulative; plot values as the sum of those entered so far
'odom'     : False, # Treat zeros as accidental odom resets                     
'abslnw'   : None,  # Override road width algorithm with a fixed lane width     
'maxflux'  : 0,     # User-specified max daily fluctuation                      
'noisy'    : False, # Compute road width based on data, not just road rate      
'integery' : False, # Whether values are necessarily integers (used in limsum)  
'monotone' : False, # Whether the data is necessarily monotone (used in limsum) 
'aggday'   : None,  # sum/last/first/min/max/mean/median/mode/trimmean/jolly    
'plotall'  : True,  # Plot all the points instead of just the aggregated point  
'steppy'   : False, # Join dots with purple steppy-style line                   
'rosy'     : False, # Show the rose-colored dots and connecting line            
'movingav' : False, # Show moving average line superimposed on the data         
'aura'     : False, # Show blue-green/turquoise aura/swath                      
'hashtags' : True,  # Show annotations on graph for hashtags in datapt comments 
'yaxis'    : '',    # Label for the y-axis, eg, "kilograms"                     
'waterbuf' : None,  # Watermark on the good side of the YBR; safebuf if null    
'waterbux' : '',    # Watermark on the bad side, ie, pledge amount              
'hidey'    : False, # Whether to hide the y-axis numbers
'stathead' : True,  # Whether to include a label with stats at top of graph     
'imgsz'    : 760,   # Image size; width in pixels of the graph image            
'yoog'     : 'U/G', # Username/graphname, eg, "alice/weight"                    
'usr'      : None,  # Username (synonym for first half of yoog) ############ DEP
'graph'    : None,  # Graph name (synonym for second half of yoog) ######### DEP
'gldt'     : None,  # Synonym for tfin ##################################### DEP
'goal'     : None,  # Synonym for vfin ##################################### DEP
'rate'     : None,  # Synonym for rfin ##################################### DEP
}

pout = { # Out Params: Beebrain output fields
'sadbrink' : False,  # Whether we were red yesterday & so will instaderail today
'safebump' : None,   # Value needed to get one additional safe day
'dueby'    : [],     # Table of daystamps, deltas, and abs amts needed by day
'fullroad' : [],     # Road matrix w/ nulls filled in, [tfin,vfin,rfin] appended
'pinkzone' : [],     # Subset of the road matrix defining the verboten zone
'tluz'     : None,   # Timestamp of derailment ("lose") if no more data is added
'tcur'     : None,   # (tcur,vcur) gives the most recent datapoint, including   
'vcur'     : None,   #   flatlining; see asof                                   
'rcur'     : None,   # Rate at time tcur; if kink, take the limit from the left 
'ravg'     : None,   # Overall road rate from (tini,vini) to (tfin,vfin)        
'tdat'     : None,   # Timestamp of last actually entered datapoint             
'lnw'      : 0,      # Lane width at time tcur                                  
'stdflux'  : 0,      # Recommended lanewidth .9 quantile of rate-adjusted deltas
'delta'    : 0,      # How far from centerline: vcur - rdf(tcur)                
'lane'     : 666,    # What lane we're in; below=-2,bottom=-1,top=1,above=2,etc 
'color'    : 'black',# One of {"green", "blue", "orange", "red"}                
'cntdn'    : 0,      # Countdown: # of days from tcur till we reach the goal    
'numpts'   : 0,      # Number of real datapoints entered, before munging        
'mean'     : 0,      # Mean of datapoints
'meandelt' : 0,      # Mean of the deltas of the datapoints
'proctm'   : 0,      # Unixtime when Beebrain was called (specifically genStats)
'statsum'  : '',     # Human-readable summary of graph statistics               
'lanesum'  : '',     # Interjection like "wrong lane!"                          
'ratesum'  : '',     # Text saying what the rate of the YBR is
'limsum'   : '',     # Text saying your bare min or hard cap                    
'deltasum' : '',     # Text saying where you are wrt the centerline             
'graphsum' : '',     # Text at the top of the graph image; see stathead         
'headsum'  : '',     # Text in the heading of the graph page                    
'titlesum' : '',     # Title text for graph thumbnail                           
'progsum'  : '',     # Text summarizing percent progress                        
'rah'      : 0,      # Y-value of the centerline of YBR at the akrasia horiz
'error'    : '',     # Empty string if no errors                                
'safebuf'  : None,   # Number of days of safety buffer ##################### DEP
'loser'    : False,  # Whether you're irredeemably off the road ############ DEP
'gldt'     : None,   # {gldt, goal, rate} are synonyms for ################# DEP
'goal'     : None,   #   for the last row of fullroad ###################### DEP
'rate'     : None,   #   like a filled-in version of {tfin, vfin, rfin} #### DEP
'road'     : [],     # Synonym for fullroad ################################ DEP
'tini'     : None,   # Echoes input param ################################## DEP
'vini'     : None,   # Echoes input param ################################## DEP
'tfin'     : None,   # Subsumed by fullroad ################################ DEP
'vfin'     : None,   # Subsumed by fullroad ################################ DEP
'rfin'     : None,   # Subsumed by fullroad ################################ DEP
}

# Input parameters to ignore; complain about anything not here or in pin.
pig = [
'rerails', 
'tagtime', 
'timezone',
'backroad', 
'edgy',
]

################################################################################
############################### GLOBAL VARIABLES ###############################

# Take a symbol name s as a string and a value x and eval(s+' = '+x) to set a 
# global variable with name s to value x. For getglobal(s) use eval(s).
def setglobal(s, x): globals()[s] = x

def initGlobals():
  global data, flad, fuda, allvals, aggval, worstval, rdf,rtf,lnf, nw, dtf, \
         watermarks, figtitle, auraf,aurup,aurdn, siru, oresets, derails, \
         hashhash

  data    = []    # List of (timestamp,value) pairs, one value per day
  flad    = None  # Flatlined datapoint, if any
  fuda    = []    # Future data: datapoints after asof, plotted ghostily
  allvals = {}    # Maps timestamp to list of values on that day
  aggval  = {}    # Maps timestamp to single aggregated value on that day
  worstval = {}   # Maps timestamp to min/max (depending on yaw) value that day
  rdf     = ZFUN  # Pure function mapping timestamp to the y-value of the YBR
  rtf     = ZFUN  # Maps timestamp to YBR rate (derivative of rdf wrt time)
  lnf     = ZFUN  # Maps timestamp to lane width, not counting noisy width
  nw      = 0     # Noisy width; true lane width is this maxed with lnf
  dtf     = ZFUN  # Maps timestamp to most recent data value
  watermarks = [] # Text objects for watermarks
  figtitle = None # Stats summary across top of graph image; not normally used
  auraf   = ZFUN  # Pure function that fits the data smoothly, for the aura
  aurup   = 0     # Amount to shift up from auraf to make the aura
  aurdn   = 0     # Amount to shift down from auraf to make the aura
  siru    = None  # Seconds in rate units, eg: runits=="d" => 86400
  scalf   = 1/400 # Scale factor for dot sizes and line thicknesses
  oresets = []    # List of timestamps of odometer resets
  derails = []    # List of derail timestamps
  hashhash = {}   # Maps timestamp to sets of hashtags to display on the graph

  # NB: All the in and out params are also global variables!
  for k,v in pout.iteritems(): setglobal(k, v) #py3 iteritems -> items
  for k,v in pin.iteritems() : setglobal(k, v) #py3 iteritems -> items

################################################################################
################ GENERAL UTILITIES (not specific to Beeminder) #################

def nummy(x):   return  type(x) is int or \
                        type(x) is float or \
                        type(x) is np.float64 or \
                        type(x) is np.float32
def stringy(x): return  type(x) is str or \
                        type(x) is unicode  #py3 comment out; no unicode type?
def listy(x):   return  type(x) is list or \
                        type(x) is tuple

def sint(x): return str(int(x))

# Return -1, 0, or 1 depending on the sign of x
def sign(x): return -1 if x < 0 else (0 if x == 0 else 1)

# Return 0 when x is very close to 0
def chop(x, delta=1e-7): return 0 if abs(x) < delta else x

# Return an integer when x is very close to an integer
def ichop(x, delta=1e-7):
  fracp, intp = modf(x)
  return int(intp) + chop(fracp, delta)

# clip(x, a,b) = min(b,max(a,x))
def clip(x, a,b):
  if a > b: a,b = b,a
  if x < a: x = a
  if x > b: x = b
  return x

# Convex combination: x rescaled to be in [c,d] as x ranges from a to b. 
# clipQ indicates whether the output value should be clipped to [c,d]. 
# Unsorted inputs [a,b] and [c,d] are also supported and work in the expected 
# way except when clipQ = False, in which case [a,b] and [c,d] are sorted prior 
# to computing the output.
def cvx(x, a_b, c_d, clipQ=True):
  a,b = a_b
  c,d = c_d
  if chop(a-b) == 0:
    if x <= a: return min(c,d)
    else:      return max(c,d)
  if chop(c-d) == 0:
    return c
  if clipQ:
    return clip(c + (x-a)/(b-a)*(d-c), *sorted([c,d]))
  else:
    a, b = sorted([a,b])
    c, d = sorted([c,d])
    return c + (x-a)/(b-a)*(d-c)

# Fill in the missing y-value in the middle datapoint by interpolating linearly 
# between the points it's sandwiched between.
def sandwich(t0_v0, t_x, t1_v1):  #((t0,v0), (t,_), (t1,v1)):  #py3
  t0,v0 = t0_v0; t = t_x[0]; t1,v1 = t1_v1
  return (t, cvx(t, (t0,t1), (v0,v1)))

# Helper for foldlist; this one returns a generator instead of a list
def foldlist0(f, x, l): 
  yield x
  for i in l: x = f(x,i); yield x

# foldlist(f,x, [e1, e2, ...]) -> [x, f(x,e1), f(f(x,e1), e2), ...]
def foldlist(f, x, l): return list(foldlist0(f, x, l))

# Return a list with the cumulative sum of the elements in l, left to right
def accumulate(l): return foldlist(lambda x,y: x+y, l[0], l[1:])

# Takes a list like [1,2,1] and make it like [1,2,2] (monotone increasing)
# Or if dir==-1 then min with the previous value to make it monotone decreasing
def monotonize(l, dir=1):
  if dir == 1:  return foldlist(lambda x,y: max(x,y), l[0], l[1:])
  else:         return foldlist(lambda x,y: min(x,y), l[0], l[1:])


# Helper for frange; returns a generator instead of a list
#def frange0(a, b, s):
#  TOL = 1e-6
#  x = a
#  while x - b < TOL: yield x; x += s

# Like Python's range() but the step can be a float
#def frange(a, b, s=1): return list(frange0(a, b, s))

# Helper for splitby; returns a generator instead of a list
def splitby0(l, f=None):
  if not l: return
  f = f or (lambda x: x)
  ss = 0 # streak start
  v = f(l[0]) # value for the current streak
  i = 1
  while i < len(l):
    v2 = f(l[i])
    if v2 != v:
      yield l[ss:i]
      v = v2
      ss = i
    i += 1
  yield l[ss:]

# Helper for split; returns a generator instead of a list
def split0(l, f=None):
  if not l: return
  f = f or (lambda x,y: x == y)
  ss = 0 # streak start
  i = 1
  while i < len(l):
    if not f(l[i-1], l[i]):
      yield l[ss:i]
      ss = i
    i += 1
  yield l[ss:]

# Splits list l into a list of lists each of whose elements produce the same 
# output when the unary function f is applied to them (default: identity). 
# Preserves the original sequence of l.
def splitby(l, f=None): return list(splitby0(l, f))

# Splits list l into a list of lists each whose elements are pairwise the same
# according to the binary sameness function f (default "==").
def split(l, f=None): return list(split0(l, f))

# Like Mathematica's Flatten but just for exactly 2 levels for now
def flatten(l): return [i for sublist in l for i in sublist]

# Whether there exists an element x of l such that f(x) is true
# Is there a better way to do this with the builtin functions any and all?
def some(f, l):
  for i in l:
    if f(i): return True
  return False

# Whether f(x) is true for all x in l (only proved correct, haven't tried it)
def every(f, l):
  for i in l:
    if not f(i): return False
  return True

# The number of elements x in l for which f(x) is true
def count(f, l):
  cnt = 0
  for i in l:
    if f(i): cnt += 1
  return cnt

# Helper for deldups; this one returns a generator instead of a list
def deldups0(l, idfun):
  idfun = idfun or (lambda x: x)
  seen = {}
  for i in l:
    marker = repr(idfun(i))         # using repr() since idfun's output might be
    if marker in seen: continue     # something unhashable like a list
    seen[marker] = 1
    yield i

# Delete Duplicates. The ID function maps elements to something that defines
# equivalence classes.
def deldups(l, idfun=None): return list(deldups0(l, idfun))

# Whether list l is sorted in increasing order
def orderedq(l): return all(l[i] <= l[i+1] for i in xrange(len(l)-1)) 
#py3 xrange->range

def argmax(f, dom): return None if not dom else dom[dom.index(max(dom, key=f))]

# Helper for partition; returns a generator instead of a list
def partition0(l, n, d):
  il = len(l)
  for i in range(0, il, d): 
    if i+n <= il: yield l[i:i+n]

# Partitions list l into sublists whose beginning indices are separated by d, 
# and whose lengths are n. If the end of the list is reached and there are fewer
# than n elements, those are not returned.
def partition(l, n, d): return list(partition0(l, n, d))

# The qth quantile of values in l. For median, set q=1/2. 
# See http://reference.wolfram.com/mathematica/ref/Quantile.html
# Author: Ernesto P. Adorio, PhD; UP Extension Program in Pampanga, Clark Field.
def quantile(l, q, qtype=1, issorted=False):
  if issorted: y = l
  else:        y = sorted(l)
  if not 1 <= qtype <= 9: return None # error

  abcd = [ # Parameters for the Hyndman and Fan algorithm
    (0,   0,   1, 0), # R type 1: inverse empirical CDF (mathematica's default)
    (1/2, 0,   1, 0), # R type 2: similar to type 1, averaged
    (1/2, 0,   0, 0), # R type 3: nearest order statistic (SAS)
    (0,   0,   0, 1), # R type 4: linear interpolation (California method)
    (1/2, 0,   0, 1), # R type 5: hydrologist method
    (0,   1,   0, 1), # R type 6: mean-based (Weibull method; SPSS, Minitab)
    (1,  -1,   0, 1), # R type 7: mode-based method (S, S-Plus)
    (1/3, 1/3, 0, 1), # R type 8: median-unbiased
    (3/8, 1/4, 0, 1)  # R type 9: normal-unbiased
  ]
  a, b, c, d = abcd[qtype-1]
  n = len(l)
  g, j = modf(a + (n+b)*q - 1)
  if   j <  0: return y[0]
  elif j >= n: return y[n-1]
  j = int(floor(j))
  return y[j] if g==0 else y[j] + (y[j+1] - y[j])* (c + d*g)

# Exponential moving average; not currently used
def expmovingavg(l, alpha):
  if not l: return l
  out = [l[0]]
  for v in l[1:]: out.append(out[-1]*(1-alpha) + alpha*v)
  return out

# Take a file and return a parallel temp file, ie, with the directory and file 
# extension the same but with the base file name amended with a unique string 
# based on a session ID. Eg, foo.x -> foo-tmp743829.x
def tempify(f):
  return re.sub('^(.*)\\.([^\\.]*)$',r'\1-tmp'+uuid.uuid4().hex+r'.\2', f)

# STACK OF LINKS for doing shownum in Python right:
#http://stackoverflow.com/questions/5627185/displaying-numbers-to-non-technical
#http://docs.scipy.org/doc/numpy/reference/generated/numpy.set_printoptions.html
#http://randlet.com/blog/python-significant-figures-format/
#https://docs.python.org/2/library/decimal.html
#https://github.com/brianhempel/rounding

# Show Number: convert number to string. Use at most d significant figures after
# the decimal point. Target t significant figures total (clipped to be at least
# i and at most i+d, where i is the number of digits in integer part of x).
def shn(x, t=10, d=5):
  if not nummy(x): return str(x)
  i = int(abs(x))
  i = (0 if i==0 else len(str(i))) # number of digits left of the decimal
  if abs(x) > 10**i-.5: i += 1
  if i == 0 and x != 0: k = int(floor(d - log(abs(x), 10)))  # get desired 
  else:                 k = d                                # decimal digits
  # Round input to have the desired number of decimal digits
  v = x * 10**k
  # Hack to prevent incorrect rounding with the decimal digits:
  if v % 10 >= 4.5 and v % 10 < 4.9999999: v = floor(v)
  xn = round(v) / 10**k + 1e-10
  # If total significant digits < i, do something about it
  if t < i and abs(10**(i-1) - xn) < .5: xn = 10**(i-1)
  t = clip(t, i, i+d)
  # If the magnitude <= 1e-4, prevent scientific notation
  if abs(xn) < 1e-4 or int(xn) == 9 or int(xn) == 99 or int(xn) == 999:
    fmt = "%%.%df" % k
    ostr = (fmt % xn).rstrip('0').rstrip('.')
  else:
    fmt = "%%.%dg" % t
    ostr = (fmt % xn)
  return ostr

def shn2(x, t=10, d=5):
  return check_output([
    "/Applications/Mathematica.app/Contents/MacOS/MathematicaScript","-script",
    "shn.m",
    #"/Users/dreeves/bin/mash", "shn.m",
    repr(x), str(t), str(d)])

# Show Number with Sign: include the sign explicitly
def shns(x, t=16, d=5): return ("+" if x>=0 else "")+shn(x, t, d)

# Same as above but with conservarounding
def shnsc(x, e, t=16, d=5): return ("+" if x>=0 else "")+shnc(x, e, t, d)

# Show Date: take timestamp and return something like 2012.10.22
def shd(t):
  return 'null' if t is None else time.strftime("%Y.%m.%d", time.localtime(t))

# Show Date/Time: take timestamp and return something like 2012.10.22 15:27:03
def shdt(t): return 'null' if t is None else \
  time.strftime('%Y.%m.%d %H:%M:%S', time.localtime(t))

# TODO: need to DRY this and shn() up but want to totally revamp shownum anyway.
# Show Number, rounded conservatively (variant of shn where you pass which
# direction, +1 or -1, is safe to err on). Aka conservaround!
# Eg, shnc(.0000003, +1, 2) -> .01
def shnc(x, errdir, t=10, d=5):
  if not nummy(x): return str(x)
  i = int(abs(x))
  i = (0 if i==0 else len(str(i))) # number of digits left of the decimal
  if abs(x) > 10**i-.5: i += 1
  if i == 0 and x != 0: k = int(floor(d - log(abs(x), 10)))  # get desired 
  else:                 k = d                                # decimal digits
  # Round input to have the desired number of decimal digits
  v = x * 10**k
  # Hack to prevent incorrect rounding with the decimal digits:
  if v % 10 >= 4.5 and v % 10 < 4.9999999: v = floor(v) # orig 4.9999999
  xn = round(v) / 10**k + 1e-10
  # Conservaround
  if errdir < 0 and xn > x or errdir > 0 and xn < x: 
    if d >= 10: xn = x
    else: return shnc(x, errdir, t, d+1)
  # If total significant digits < i, do something about it
  if t < i and abs(10**(i-1) - xn) < .5: xn = 10**(i-1)
  t = clip(t, i, i+d)
  # If the magnitude <= 1e-4, prevent scientific notation
  if abs(xn) < 1e-4 or int(xn) == 9 or int(xn) == 99 or int(xn) == 999:
    fmt = "%%.%df" % k
    ostr = (fmt % xn).rstrip('0').rstrip('.')
  else:
    fmt = "%%.%dg" % t
    ostr = (fmt % xn)
  return ostr

#  y = float(shn(x, t, d))
#  if errdir < 0 and y > x: y -= 
#  return shn(x)

# How should Show Number really work?
# Maybe you just say how many sigfigs you want and we presume you want, say, 
# half that much (rounded up) for the cap on the number of decimal places.
# All the (t,d) currently used:
# 10,5
# 1,1
# 2,1
# 3,1 --> 3,2
# 4,2
# 5,3

# not used:
#def tma(y, m, d, h=12, mn=0, s=0):
#  dtstring = "%04d.%02d.%02d %02d:%02d:%02d" % (y,m,d,h,m,s)
#  tval = time.strptime(dtstring, "%Y.%m.%d %H:%M:%S" )
#  return time.mktime(tval)

# Singular or Plural: Pluralize the given noun properly, if n is not 1. 
# Provide the plural version if irregular.
# Eg: splur(3, "boy") -> "3 boys", splur(3, "man", "men") -> "3 men"
def splur(n, noun, nounp=''):
  if nounp=='': nounp = noun+'s'
  return shn(n)+' '+(noun if n == 1 else nounp)

# Utility function for stepify
def stepFunc(data, x, default=0):
  #print("DEBUG",repr(x),"<->",repr(data[0][0]))
  #if type(x) is str: x = dayparse(x) #py3 wtf
  if x < data[0][0]: return default #py3 add "x is None or"
  prevval = data[0][1]
  for (t,v) in data:
    if t > x:   return prevval
    else:       prevval = v
  return data[-1][1]

# Take a list of datapoints sorted by x-value and returns a pure function that
# interpolates a step function from the data, always mapping to the most recent
# value. Cf http://stackoverflow.com/q/6853787
def stepify(data, default=0):
  if not data: return lambda x: default
  return lambda x: stepFunc(data, x, default)

# Takes unixtime in seconds, returns unixtime corresponding to midnight that day
def dayfloor(t):
  if t is None: return None
  return int(time.mktime(datetime.datetime.fromtimestamp(t).replace( \
                       hour=0, minute=0, second=0, microsecond=0).timetuple()))

# Take a daystamp like "20140831" and return unixtime. If it's already a 
# unixtime, dayfloor it.
def dayparse(s):
  if s is None or nummy(s): return dayfloor(s)  #TZFAT
  try:
    return time.mktime(datetime.datetime.strptime(s, "%Y%m%d").timetuple())
  except Exception:
    return s

# Take unixtime t and return a daystamp like "20140831"
def dayify(t): 
  if t is None or stringy(t): return t
  if t < 0: t = 0 # bugfix for confused road matrix; should fix upstream
  return datetime.datetime.fromtimestamp(t).strftime('%Y%m%d')

# Take string like "shark jumping #yolo :) #sharks", return {"#yolo", "#sharks"}
def hashextract(s): return set(re.findall(r'(?:^|\s)(#[a-zA-Z]\w+)(?=$|\s)', s))

################################################################################
######################### GENERAL BEEMINDER UTILITIES ##########################

# Convert a unix time u to plot time p, and vice versa.
# http://stackoverflow.com/questions/13259875/making-matplotlibs-date2num-and
def plottm(u): return dt.date2num(datetime.datetime.utcfromtimestamp(u))
def unixtm(p): return calendar.timegm(dt.num2date(p).timetuple())

# Good delta: Returns the delta from the given point to the centerline of the 
# road but with the sign such that being on the good side of the road gives a 
# positive delta and being on the wrong side gives a negative delta.
def gdelt(t_v): t,v = t_v; return chop(yaw*(v-rdf(t)))

# The bottom lane is -1, top lane is 1, below the road is -2, above is +2, etc.
# Implementation notes:
# This includes the noisy width but it does not adjust the noisy width based on 
# t. So this gives the correct lane number for noisy graphs when called with 
# (tcur,vcur) but not necessarily for other values of t. The dtd function 
# handles this slightly more robustly. Unless we deal with the noisy width 
# better we might want to remove the {t,v} parameter and have this only work for
# (tcur,vcur).
# How to use lanage:
#  lanage*yaw >= -1: on the road or on the good side of it (orange/blue/green)
#  lanage*yaw >   1: good side of the road (green dot)
#  lanage*yaw ==  1: right lane (blue dot)
#  lanage*yaw == -1: wrong lane (orange dot)
#  lanage*yaw <= -2: beemergency or derailed (red dot)
def lanage(t_v, l=None): 
  t,v = t_v
  l = l or (max(nw, lnf(t)) if noisy else lnf(t))
  d = v - rdf(t)
  if chop(l) == 0: return int(yaw if chop(d) == 0.0 else sign(d)*666)
  x = ichop(d/l)
  fracp, intp = modf(x)
  if fracp > .99999999: # because Python behaves strangely with modf sometimes
    intp += 1
    fracp = 0
  if chop(fracp) == 0:
    if yaw > 0 and intp >= 0: return int(intp+1)
    if yaw < 0 and intp <= 0: return int(intp-1)
  return int(round(sign(x)*ceil(abs(x))))

# Whether the given point is on the road if the road has lane width l
def aok(p, l):  return (lanage(p, l) * yaw >= -1.0)

# Rate as a string
def shr(r):
  r = r or 0
  # show as a percentage if exprd is true #SCHDEL
  #return shn((100.0 if exprd else 1.0)*r, 4,2) + ("%" if exprd else "")
  return shn(r, 4,2)

# Shortcuts for common ways to show numbers
def sh1(x):      return shn(  chop(x),    4,2)
def sh1c(x, e):  return shnc( chop(x), e, 4,2)
def sh1s(x):     return shns( chop(x),    4,2)
def sh1sc(x, e): return shnsc(chop(x), e, 4,2)

# The value of the relevant/critical edge of the YBR in n days
def lim(n):
  t = tcur+n*SID
  return rdf(t) - sign(yaw)*(max(nw, lnf(t)) if noisy else lnf(t))

# The bare minimum needed from vcur to the critical edge of the YBR in n days
def limd(n): 
  x = lim(n)-vcur
  if not integery: return x
  if yaw>0 and dir>0 and x>0: return ceil(x)  # MOAR
  if yaw<0 and dir<0 and x<0: return floor(x) # PHAT
  if yaw<0 and dir>0 and x>0: return floor(x) # WEEN
  if yaw>0 and dir<0 and x<0: return ceil(x)  # RASH
  return x

# Days To Derail if you're at (tcur,v). Eg, if it's an eep day then return 0.
# Assumes Pessimistic Presumptive Reports, whether or not they're turned on.
# Implementation notes:
# For noisy graphs there are two cases to consider:
# 1. If the graph is noisy and you're in the right lane, conservatively assume
#    the width is the minimum possible: lnf(t). Not only can the noisy width 
#    shrink as you walk forward but, being noisy, your datapoint could jump off
#    the road the day after you cross into the wrong lane. (The Really Right 
#    thing might be to recompute noisyWidth prospectively based on flatlining 
#    till going into the wrong lane, at which point the road width would be 
#    fixed, and then seeing how many additional days before going off the 
#    road.)
# 2. If the graph is noisy and you're in the *wrong* lane, then the width is 
#    fixed so it's just like the straightforward case of non-noisy graphs 
#    except you have to max lnf(t) with noisyWidth.
def dtd(v):
  t = tcur
  fnw = 0.0 if gdelt((t,v)) >= 0 else nw # future noisy width
  elnf = (lambda x: max(lnf(x), fnw))    # effective lane width function

  x = 0  # the number of steps
  vpess = v # the value as we walk forward w/ pessimistic presumptive reports
  while aok((t+x*SID, vpess), elnf(t+x*SID)) and t+x*SID <= max(tfin, t):
    x += 1 # walk forward until we're off the YBR
    vpess += (2*rtf(t+x*SID)*SID if yaw*dir < 0 else 0)

  # At least one safe day if noisy and in right lane, due to can't-lose-tmw
  if noisy and gdelt((t,v)) >= 0: x = max(2, x)
  return x

# Days To Centerline: Count the integer days till you cross the centerline/tfin
# if nothing reported
def dtc(t_v):
  t,v = t_v
  x = 0
  while(gdelt((t+x*SID,v)) >= 0 and t+x*SID <= tfin): x += 1
  return x

# What delta from the centerline yields n days of safety buffer till centerline?
def bufcap(n=7):
  t = tcur
  v = rdf(t)
  r = rtf(t)
  if r==0: r = lnw
  r = abs(r)
  d = 0
  i = 0
  while(dtc((t,v+d)) < n and i <= 70): 
    #print("DEBUG:",i,d,"(",t,v,r*SID*7,")",dtc((t,v+d)))
    d += yaw*r*SID
    i += 1
  return d

################################################################################
############################## YELLOW BRICK ROAD ###############################

# Given the endpoint of the last road segment (tprev,vprev) and 2 out of 3 of
#   t = goal date for a road segment (unixtime)
#   v = goal value 
#   r = rate in hertz (s^-1), ie, road rate per second
# return the third, namely, whichever one is passed in as null.
def tvr(tprev, vprev, t, v, r):
  #if exprd and v is not None:   #SCHDEL
  #  if v     == 0: v     = 1e-6 # zero values and exprds don't mix!
  #  if vprev == 0: vprev = 1e-6 # just make them near zero I guess?

  if t is None:
    if r == 0: return BDUSK
    else:  return min(BDUSK, tprev + (v-vprev)/r)
    #                                log(v/vprev)/r if exprd #SCHDEL
  if v is None: 
    #SCHDEL
    #if exprd and r*(t-tprev) > 35: return vprev*1e15 # bugfix: math overflow
    return vprev+r*(t-tprev)
    #      vprev*exp(r*(t-tprev)) if exprd  #SCHDEL
  if r is None:
    if t == tprev: return 0 # special case: zero-length road segment
    return (v-vprev)/(t-tprev)
    #      log(v/vprev)/(t-tprev) if exprd  #SCHDEL

# Helper for fillroad for propagating forward filling in all the nulls
def nextrow(oldrow, newrow):
  tprev, vprev, rprev, n = oldrow 
  t, v, r = newrow
  x = tvr(tprev, vprev, t,v,r) # the missing t, v, or r
  if t is None: return (x, v, r, 0)
  if v is None: return (t, x, r, 1)
  if r is None: return (t, v, x, 2)

# Takes road matrix (with last row appended) and fills it in. Also adds a 
# column, n, giving the position (0, 1, or 2) of the original null.
def fillroad(road):
  road = [(t, v, r if r is None else r/siru) for (t,v,r) in road]
  #print("DEBUG tini in fillroad:",shdt(tini))
  road = foldlist(nextrow, (tini, vini, 0, 0), road)[1:]
  return [(t, v, r*siru, n) for (t,v,r,n) in road]

# Version of fillroad that assumes tini/vini is the first row of road
def fillroadall(road):
  (tini, vini) = (road[0][0], road[0][1])
  road = road[1:]
  road = [(t, v, r if r is None else r/siru) for (t,v,r) in road]
  road = foldlist(nextrow, (tini, vini, 0, 0), road)[1:]
  return [(tini, vini, 0, 2)] + [(t, v, r*siru, n) for (t,v,r,n) in road]
  
# Helper for roadfunc. Return the value of the segment of the YBR at time x, 
# given the start of the previous segment (tprev,vprev) and the rate r. 
# (Equivalently we could've used the start and end points of the segment, 
# (tprev,vprev) and (t,v), instead of the rate.)
def rseg(tprev, vprev, r, x):
  #if exprd and r*(x-tprev) > 230: return 1e100 # bugfix: math overflow  #SCHDEL
  return vprev+r*(x-tprev)
  #      vprev*exp(r*(x-tprev)) if exprd  #SCHDEL

# Take an initial point and a filled in road matrix (including the final row) 
# and a time t and return the value of the centerline at time x.
def roadfunc(tini, vini, road, x):
  road = [(tini,vini,None)] + road
  #print("DEBUG",repr(x),"<->",repr(road[0][0]))
  #if type(x) is str: x = dayparse(x) #py3 wtf
  if   x<road[0][0]: return road[0][1] # road value is vini before tini
  for i in range(1, len(road)):
    if x<road[i][0]: return rseg(road[i-1][0], road[i-1][1], road[i][2]/siru, x)
  return road[-1][1] # road value is vfin after tfin

def genRoadFunc(tini,vini, road): return lambda t: roadfunc(tini,vini, road, t)

# Appropriate color for a datapoint
# (could pass in segment type (gap or not) and use black(?) dots if gap)
def dotcolor(t_v):
  t,v = t_v
  if t is None or v is None:       return BLCK
  l = lanage((t,v))
  if yaw==0 and abs(l) > 1.0:      return GRNDOT
  if yaw==0 and (l==0 or l==1.0):  return BLUDOT
  if yaw==0 and l == -1.0:         return ORNDOT
  if l*yaw >=  2.0:                return GRNDOT
  if l*yaw ==  1.0:                return BLUDOT
  if l*yaw == -1.0:                return ORNDOT
  if l*yaw <= -2.0:                return REDDOT
  return BLCK

# Whether we're officially off the road (off both yesterday and today)
def isLoser(t_v):
  t,v = t_v
  if offred:
    return  dotcolor((t-SID, dtf(t-SID))) == REDDOT
  else:
    return (dotcolor((t,v))               == REDDOT \
        and dotcolor((t-SID, dtf(t-SID))) == REDDOT)

# Return a pure function mapping timestamp to the rate of the YBR at that time.
# The returned rate is in units per second (absolute not fractional rate).
# Ie, this is the derivative of the road function wrt time. 
# Note: if you ask for the rate at a kink in the road, it gives the *new* rate.
# NB: The road matrix and road function must exist when we call this. 
# Implementation note: Stepify constructs a step function where the supplied
#   datapoints give the *start* of a new step, but the road matrix gives the 
#   points where each rate *ends*, hence the munging around before stepifying. 
#   For example, (t,r) road segments 
#     [(2,20),(5,40),(6,30)] 
#   should get transformed to 
#     [(2,40),(5,30),(6,0)] 
#   with a stepify default of 20 to cover the first segment that ends at time 2.
def genRateFunc():
  road0 = deldups(road, lambda x: x[0])
  (rt, rv, rr, rn) = zip(*road0)
  road1 = zip(rt, rv, rr[1:]+(0,), rn)
  rtf0 = stepify([(t,r) for (t,v,r,n) in road1], road0[0][2])
  return (lambda t: 1.0/siru * rtf0(t))
  #                            (rdf(t) if exprd else 1.0)*rtf0(t)  #SCHDEL

# For noisy graphs, compute the lane width (or half aura width) based on data.
# Specifically, get the list of daily deltas between all the points, but adjust
# each delta by the road rate (eg, if the delta is equal to the delta of the 
# road itself, that's an adjusted delta of 0).
# Return the 90% quantile of those adjusted deltas.
def noisyWidth(d):
  if len(d) <= 1: return 0
  ad = [abs(w-v-rdf(u)+rdf(t))/(u-t)*SID for ((t,v),(u,w)) in partition(d, 2,1)]
  return chop(ad[0] if len(ad) == 1 else quantile(ad, .90))

# Increase the width if necessary for the guarantee that you can't lose
# tomorrow if you're in the right lane today.
# Specifically, when you first cross from right lane to wrong lane (if it 
# happened from one day to the next), the road widens if necessary to 
# accommodate that jump and then the road width stays fixed until you get back
# in the right lane.
# So for this function that means if the current point is in the wrong lane,
# look backwards to find the most recent one-day jump from right to wrong. That
# wrong point's deviation from the centerline is what to max the default road 
# width with.
def autowiden(d, nw):
  n = len(d)
  if n <= 1: return 0
  i = -1
  if gdelt(d[-1]) < 0:
    while i >= -n and gdelt(d[i]) < 0: i -= 1
    i += 1
    if i > -n and data[i][0] - data[i-1][0] <= SID:
      nw = max(nw, abs(data[i][1] - rdf(data[i][0])))
  return chop(nw) 

# Whether the road has a vertical segment at time t
def vertseg(t): return len([x for (x,v,r,n) in road if t==x]) > 1

# Return a pure function mapping timestamp to the width of the YBR at that time.
# This does not incorporate noisyWidth -- this is the minimum width given the 
# rate of the road. If noisy this has to be maxed with noisyWidth.
# Mostly the lane width at a given time is the daily absolute rate of the road
# at that time, but there's an exception for flat spots (until YBHP!):
# * The lane width for a flat spot is the rate of the previous or next non-flat
#   segment, whichever's bigger. 

#SCHDEL
# * Exp exception: The lane function was not *quite* right for exponential 
#   roads. It gave lane width based on the instantaneous daily rate but that 
#   means that the rate (for decreasing graphs) is slightly less than the day 
#   before. So if you were right on the centerline yesterday then the lane width
#   today is slightly less than the amount that the centerline dropped since 
#   yesterday. So you'll be ever so slightly off your road if you stay flat, 
#   violating the Can't Lose Tomorrow guarantee. So we max with the difference 
#   in the road function from the previous day. 

# Implementation note:
#   If it weren't for the exception this would just return SID*abs(rtf(_))
def genLaneFunc():
  road0 = deldups(road, lambda x: x[0])
  #road0 = road # I should understand why this changes some graphs
  # t: times that new rates start; nb: in the road matrix they're end times
  # r: the corresponding new rates, dailyified
  t = [x[0] for x in road0]
  r = [abs(x[2])*SID/siru for x in road0]
  r.append(0.0)
  # pretend flat spots have the previous or next non-flat rate
  rb = foldlist(lambda x,y: x if abs(y)<1e-7 else y, r[0], r[1:])    # backwards
  rr = reversed(r[:])
  rf = reversed(foldlist(lambda x,y: x if abs(y)<1e-7 else y, r[-1], rr)) # forw
  r = [argmax(abs, [b,f]) for (b,f) in zip(rb, rf)]
  rtf0 = stepify(zip(*[t, r[1:]]), r[0]) #py3 need to wrap zip in list
  return lambda x: max(abs(rdf(x)-rdf(x-SID)) if not vertseg(x) else 0, \
                       rtf0(x))
  #                    (rdf(x) if exprd else 1.0)*rtf0(x)  #SCHDEL

# Take a filled-in road matrix (and tini/vini), and current datapoint 
# (tcur,vcur) and a desired safety buffer s. Return retroratcheted road matrix.
#def retroRatchet(tini, vini, road, tcur, vcur, s):
#  shifted = [(t-yaw*dir*(safebuf-1-s),v,r,n) for (t,v,r,n) in road]
#  ratroad = []
#  for (t,v,r,n) in road:
#    if dayfloor(t) <= tcur:
#      row = [t,v,r]; row[n] = None
#      ratroad.append(row)
#
#  rdf = genRoadFunc(tini, vini, road)
#  return road

#  if ratchet is not None:
#    bc = bufcap(ratchet)
#    ratroad = []
#    rowflag = True # whether to insert a row to make a segment ending at tcur
#    for (t,v,r,n) in road:
#      if dayfloor(t) <= tcur:
#        row = [t,v,r]; row[n] = None 
#        ratroad.append(row)
#      if dayfloor(t) > tcur and rowflag:
#        rowflag = False
#        ratroad.append([tcur, rdf(tcur), None])
#        ratroad.append([tcur, rdf(tcur)+bc, None])
#      row = [t,v,r]; row[n] = None
#      ratroad.append(row)
#    ratroad = fillroad(ratroad)
    #road = ratroad[:]
    #road = [(1377964800,60,0,2)]
    #tini_copy, vini_copy, road_copy = tini, vini, road
    #rdf = lambda t: roadfunc(tini_copy, vini_copy, road_copy, t)
    #print("DEBUG2:",ratchet," -> ",ratroad,"(",bc,")")
    #print("DEBUG",shd(asof))


################################################################################
################################ TRANSFORM DATA ################################

# Transform list l as follows: every time there's a decrease in value from one
# element to the next where the second value is zero, say V followed by 0, add V
# to every element afterwards. (should use a generator/yield instead of append)
def odomify0(l):
  if not l: return l
  curadd = 0
  prev = l[0]
  out = [prev]
  for i in l[1:]:
    if i == 0: curadd += prev
    prev = i
    out.append(i + curadd)
  return out

# Similar to above but for (t,v) pairs or (t,v,c) triples: every time there's a
# decrease in value from one datapoint to the next where the second value is
# zero, say (t1,V) followed by (t2,0), add V to the value of every datapoint on
# or after t2. This is what you want if you're reporting odometer readings (eg,
# your page number in a book can be thought of that way) and the odometer gets 
# accidentally reset (or you start a new book but want to track total pages read
# over a set of books). This should be done before kyoomify and will have no 
# effect on data that has actually been kyoomified since kyoomification leaves 
# no nonmonotonicities.
def odomify(d):
  tdata = zip(*d) #py3 zip needs to be wrapped in list
  tdata[1] = odomify0(tdata[1])
  return zip(*tdata) #py3 wrap zip in list

# Here's a version of the above that does that for *all* decreases, {t1,V} to
# {t2,v}, adding V to the value of every datapoint on or after t2.
# This is not currently used. It might be useful for a bartlebee/nanowrimo goal
# where you wanted to count total words added and not consider decreases in 
# wordcount to be backward progress toward the goal. Of course if the goal is
# to end up with a 50k-word document then you do want decreases to count as
# backward progress.
#mon00[{prev_,offset_}, next_] := {next, offset + If[prev > next, prev, 0]}
#monotonify0[list_]:= list + Rest[FoldList[mon00, {-Infinity,0}, list]][[All,2]]
#monotonify[data_] := Transpose@{#1, monotonify0[#2]}& @@ Transpose@data

# Clean up the data: throw away comments, sort it, dayfloor it, throw away data
# after asof date, do the aggday'ing and kyooming and odomifying, set outparams
# like numpts, etc
# Returns a string indicating errors, or the empty string if none.
def procData():
  global data,fuda, aggday, aggval,allvals,worstval, asof, tini,vini, \
    road, numpts, tdat, mean, meandelt, oresets, derails, hashhash

  # It's kinda dumb how many separate full walks thru the data we take here

  if not data: return 'No datapoints'
  for (t,v,c) in data:
    if not (nummy(t) and t>0 and nummy(v) and stringy(c)):
      return "Invalid datapoint: "+str(t)+' '+str(v)+' "' \
                                  +str(c).encode('ascii','ignore')+'"'
    if hashtags:
      hset = hashextract(c)
      if not hset: continue
      hashhash[t] = (set() if t not in hashhash else hashhash[t]).union(hset)

  # maybe just default to aggday=last; no such thing as aggday=null
  if aggday is None: aggday = 'sum' if kyoom else 'last'

  if offred:
    derails = [t for t,v,c in data if c.startswith('RECOMMITTED')]
  else:
    derails = [t-SID for t,v,c in data if c.startswith('RECOMMITTED')]
  data = [(t,v) for t,v,c in data] # throw away the comments
  if odom: 
    oresets = [t for (t,v) in data if v==0]
    data = odomify(data) # treat zeros as odom resets

  #if asof is None: asof = dayfloor(proctm) # null asof not currently allowed
  nonfuda = [x for x in data if x[0] <= asof]
  if not nonfuda: return "No data as of " + shd(asof)
  if plotall: numpts = len(nonfuda) # else wait till after agging

  if vini is None:
    if yoog=='meta/users':   vini = 451

  aggval.clear(); allvals.clear()
  grouped = splitby(data, lambda x: x[0]) # put datapts with same t in sublists
  pre = 0 # initialize cumulative total so far as we walk thru

  for group in grouped:          # each group is a day
    t = group[0][0]              # timestamp for this day
    vl = [v for (t,v) in group]  # list of values for the datapoints on this day
    ad = AGGR[aggday](vl)        # agg'd datapoint value for this day
    if kyoom:
      if aggday=='sum': allvals[t] = [i+pre for i in accumulate(vl)]
      else:             allvals[t] = [i+pre for i in vl]
      aggval[t] = pre + ad
      pre += ad                  # (Eg if yesterday's aggval was 10 and today's
    else:                        # values are 1, 2, 1 then for kyoomy & aggday
      allvals[t] = vl            # sum we get allvals 10+1, 10+3, 10+4)
      aggval[t] = ad
    worstval[t] = (max(allvals[t]) if yaw<0 else min(allvals[t]))

  data = [(t,aggval[t]) for t in sorted(aggval.keys())]

  fuda = [x for x in data if x[0] > asof]
  data = [x for x in data if x[0] <= asof]
  # NB: we'll also later append the flatlined datapoint to data as well

  if not plotall: numpts = len(data)
  gfd = gapFill(data)
  if len(data) > 0: mean = np.mean([v for t,v in gfd])
  if len(data) > 1:
    meandelt = np.mean([b-a for [a,b] in partition([v for t,v in gfd],2,1)])

  tdat = data[-1][0] # timestamp of last entered datapoint pre-flatline

  return ''


################################################################################
#################### PROCESS INPUT PARAMETERS AND GENSTATS #####################

# Type-checking convenience functions
def torf(x):  return type(x) is bool                         # True or False
def born(x):  return torf(x)  or x is None                   # Boolean or Null
def norn(x):  return nummy(x) or x is None                   # Numeric or Null
def timy(x):  return nummy(x) and 0<x<BDUSK                  # Valid time
def torn(x):  return timy(x)  or x is None                   # ValidTime or Null
def sorn(x):  return type(x) is str or x is None             # String or Null

# Sanity check a row of the road matrix; exactly one-out-of-three is null
def validrow(r):
  if not listy(r) or len(r) != 3: return False
  return (r[0] is None and nummy(r[1])  and nummy(r[2]) ) or \
         (nummy(r[0])  and r[1] is None and nummy(r[2]) ) or \
         (nummy(r[0])  and nummy(r[1])  and r[2] is None)

# Stringified version of a road matrix row
def showrow(row):
  if not listy(row) or len(row) != 3: return str(row)
  (t,v,r) = row
  t = dayify(t)
  if t is None: t = "null"
  if v is None: v = "null"
  if r is None: r = "null"
  return str(t)+', '+str(v)+', '+str(r)

# Sanity check the input parameters. Return non-empty string if it fails.
def vetParams():
  def s(y): return str(y) # I'm a bit too obsessed with fitting things in 80 cha

  if not((6-24)*3600 <= deadline <= 6*3600):
    return "'deadline' outside 6am earlybird to 6am nightowl: "     +s(deadline)
  if asof is None:       return "'asof' can't be null! Tell support!"
  if not torn(asof):     return "'asof' isn't a valid timestamp: "  +s(asof)
  if not timy(tini):     return "'tini' isn't a valid timestamp: "  +s(tini)
  if not nummy(vini):    return "'vini' isn't numeric: "            +s(vini)
  if not listy(road): return "Road matrix ('road') isn't a list: "  +s(road)
  for r in road:
    if not validrow(r):
      return "Invalid road matrix row: "+showrow(r)
  # At this point road is guaranteed to be a list of length-3 lists
  mostroad = road[:-1] # I guess we don't mind a redundant final road row
  if len(mostroad) != len(deldups(mostroad)):
    prev = mostroad[0] # previous row
    for r in mostroad[1:]:
      if r == prev:
        return "Road matrix ('road') has duplicate row: "+showrow(r)
      prev = r
    return "Road matrix duplicate row error! Tell support!" # seems unreachable
  if not torn(tfin):  return "'tfin' isn't a valid timestamp: "     +s(tfin)
  if not norn(vfin):  return "'vfin' isn't numeric or null: "       +s(vfin)
  if not norn(rfin):  return "'rfin' isn't numeric or null: "       +s(rfin)
  if not runits in SECS.keys(): return "Bad rate units ('runits'): "+s(runits)
  #SCHDEL
  #if not torf(exprd):     return "'exprd' isn't boolean: "          +s(exprd)
  if not yaw in [0,-1,1]: return "'yaw' isn't in [0,-1,1]: "        +s(yaw)
  if not dir in [-1,1]:   return "'dir' isn't in [-1,1]: "          +s(dir)
  if not norn(tmin):      return "'tmin' isn't a number/timestamp: "+s(tmin)
  if not torn(tmax):      return "'tmax' isn't a valid timestamp: " +s(tmax)
  if not norn(vmin):      return "'vmin' isn't numeric or null: "   +s(vmin)
  if not norn(vmax):      return "'vmax' isn't numeric or null: "   +s(vmax)
  if not torf(kyoom):     return "'kyoom' isn't boolean: "          +s(kyoom)
  if not torf(odom):      return "'odom' isn't boolean: "           +s(odom)
  if not norn(abslnw):    return "'abslnw' isn't numeric or null: " +s(abslnw)
  if not torf(noisy):     return "'noisy' isn't boolean: "          +s(noisy)
  if not torf(integery):  return "'integery' isn't boolean: "       +s(integery)
  if not torf(monotone):  return "'monotone' isn't boolean: "       +s(monotone)
  if not aggday in AGGR.keys() + [None]:  #py3 needs list() around keys()
    return "'aggday' = "+s(aggday)+" isn't one of max, sum, last, mean, etc"
  if not born(plotall):   return "'plotall' isn't boolean or null: "+s(plotall)
  if not torf(steppy):    return "'steppy' isn't boolean: "         +s(steppy)
  if not torf(rosy):      return "'rosy' isn't boolean: "           +s(rosy)
  if not torf(movingav):  return "'movingav' isn't boolean: "       +s(movingav)
  if not torf(aura):      return "'aura' isn't boolean: "           +s(aura)
  if not stringy(yaxis):  return "'yaxis' isn't a string: "         +s(yaxis)
  # Beeminder enforces no more than 70chars for y-axis label
  if len(yaxis) > 80:     return "Y-axis label is too long:\n"      +yaxis
  if not sorn(waterbuf):  return "'waterbuf' isn't string or null: "+s(waterbuf)
  if not stringy(waterbux): return "'waterbux' isn't a string: "    +s(waterbux)
  if not torf(hidey):     return "'hidey' isn't boolean: "          +s(hidey)
  if not torf(stathead):  return "'stathead' isn't boolean: "       +s(stathead)
  if not nummy(imgsz):    return "'imgsz' isn't numeric: "          +s(imgsz)
  if not stringy(yoog):   return "'yoog' isn't a string: "          +s(yoog)
  #SCHDEL
  #if kyoom and exprd and not yoog in \
  #    ["meta/pledged", "meta/revenue", "scarabaea/running"]:
  #  return "Can't have an auto-summing graph that's exponential.\\n"+ \
  #         "Well, theoretically you could but every time someone has done\\n"+\
  #         "that it's not been at all what they really wanted.\\n"+ \
  #         "If you think you do want it, let us know!"
  if kyoom and odom: 
    return "The odometer setting doesn't make sense for an auto-summing goal!"
  return ''

# Convert deadline value (seconds from midnight) to time-of-day like "3am"
def deadtod(ds):
  str = time.strftime('%I:%M%p', time.gmtime(ds)).lower()
  str = re.sub('^0', '', str)
  str = re.sub(':00', '', str)
  return str

# Convert tluz to the day of the week (eg, "Wed") of the eep day
def deaddow(t): return time.strftime('%a', time.localtime(t))

# Set the watermark (waterbuf) to number of safe days if not given explicitly.
def setWatermark():
  global waterbuf
  if waterbuf is None:
    if   asof >= tfin and not loser: waterbuf = ":)"
    elif safebuf > 999:              waterbuf = "inf"
    elif safebuf >= 7:               waterbuf = str(safebuf)+"d"
    elif safebuf <= 0:               waterbuf = deadtod(deadline)+"!"
    else:                            waterbuf = deaddow(tluz)

# Set any of {tmin, tmax, vmin, vmax} that don't have explicit values.
def setRange():
  global tmin, tmax, vmin, vmax
  if tmin is None: tmin = min(tini, asof)
  if tmax is None:
    # Make more room beyond the askrasia horizon if lots of data
    years = (tcur - tmin)//(DIY*SID)
    tmax = dayfloor(tcur+(1+years/2)*2*AKH) # years = 0 unless more than a year
  if vmin is not None and vmax is not None: # both provided explicitly
    if   vmin == vmax:  vmin -= 1; vmax += 1    # scooch away from each other
    elif vmin >  vmax:  vmin, vmax = vmax, vmin # swap them
    return
  a, b = rdf(tmin), rdf(tmax) # spikes in YBR may still be outside plot range
  d0 = [v for t,v in data if tmin <= t <= tmax]
  mind = min(d0) if d0 else 0 # min datapoint
  maxd = max(d0) if d0 else 0 # max datapoint
  padding = max(lnw/3, (maxd-mind)*PRAF*2) # scooch a bit beyond min/max datapts
  minmin = mind - padding
  maxmax = maxd + padding
  if monotone and dir>0:               # Monotone up so no extra padding
    minmin = min(minmin, a, b)         #   below (the low) vini.
    maxmax = max(maxmax, a+lnw, b+lnw)
  elif monotone and dir<0:             # Monotone down so no extra padding
    minmin = min(minmin, a-lnw, b-lnw) #   above (the high) vini.
    maxmax = max(maxmax, a, b)
  else:
    minmin = min(minmin, a-lnw, b-lnw)
    maxmax = max(maxmax, a+lnw, b+lnw)
  if plotall and tmin<=tini<=tmax and tini in allvals: # At tini, leave room
    minmin = min(minmin, min(allvals[tini]))           #   for all non-agg'd
    maxmax = max(maxmax, max(allvals[tini]))           #   datapoints.

  if vmin is None and vmax is None:
    vmin, vmax = minmin, maxmax
    if   vmin == vmax:  vmin -= 1; vmax += 1
    elif vmin >  vmax:  vmin, vmax = vmax, vmin
  elif vmin is None:  vmin = minmin if minmin < vmax else vmax - 1
  elif vmax is None:  vmax = maxmax if maxmax > vmin else vmin + 1

# Compute flatline datapoint (flad) and append it to data
def flatline():
  global data, flad
  tlast, vlast = data[-1]
  if tlast > tfin: return
  x = tlast # x = the time we're flatlining to
  if yaw*dir<0: x = min(asof, tfin) # WEEN/RASH: flatline all the way
  else:                  # for MOAR/PHAT, stop flatlining if 2 red days in a row
    prevcolor = None
    while x <= min(asof, tfin): # walk forward from tlast
      newcolor = dotcolor((x,vlast))
      if prevcolor==newcolor==REDDOT: break # done iff 2 reds in a row
      prevcolor = newcolor
      x += SID # or see doc.bmndr.com/ppr
    x = min(x, asof, tfin)
  if x not in aggval:
    flad = (x, vlast)
    data.append(flad)

# Where most of the real work happens in computing goal stats.
# Returns a string indicating errors, or '' if none.
def procParams():
  global tini,vini, tfin,vfin,rfin, rdf, rtf, lnf, nw, dtf, road, \
    tcur,vcur,rcur, ravg, safebuf, tluz, delta, rah, cntdn, \
    lnw, stdflux, lane, color, loser, tluz, dueby, safebump, sadbrink

  #SCHDEL
  #if exprd and abs(vini) < 1e-7:
  #  return "Exponential roads can't start with value zero"
  #if exprd and some(lambda x: x[1] is not None and x[1] < 0, road):
  #  return "Exponential roads must always be positive"

  dtf = stepify(data) # maps timestamps to most recent datapoint value
  
  road = fillroad(road)
  tfin, vfin, rfin = road[-1][:-1]

  parenerr = \
    "(Your goal date, goal "+("total" if kyoom else "value")+ \
    ", and rate are inconsistent!\\n"+ \
    "Is your rate positive when you meant negative?\\n"+ \
    "Or is your goal "+("total" if kyoom else "value")+ \
    " such that the implied goal date is in the past?)"
  if not orderedq([t for (t,v,r,n) in road]): 
    return "Road dial error\\n" + parenerr

  rdf = genRoadFunc(tini, vini, road)

  rtf = genRateFunc()
  stdflux = noisyWidth([(t,v) for t,v in data if t>=tini])
  nw = autowiden(data, stdflux) if noisy and abslnw is None else 0.0
  lnf = genLaneFunc() if abslnw is None else lambda x: abslnw

  flatline()
  tcur, vcur = data[-1] # might be the flatlined datapoint
  safebuf = dtd(vcur)
  tluz = tcur+safebuf*SID

  delta = chop(vcur - rdf(tcur))
  rah = rdf(tcur+AKH)

  # nonmonotonicities are possible here, like if the road width shrinks due to
  # a shallow spot. should probably be monotonized...
  dueby = [[dayify(tcur+i*SID), limd(i), lim(i)] for i in range(0,7)]
  #print("DEBUG lim(0) lim(6)", lim(0), lim(6))
  tmpday, tmpdel, tmpabs = zip(*dueby)
  #print("DEBUG", tmpabs)
  #print("DEBUG", monotonize(tmpabs, dir))
  #print("DEBUG dir yaw", dir, yaw)
  dueby = zip(tmpday, monotonize(tmpdel, dir), monotonize(tmpabs, dir))
  safebump = lim(safebuf)

  #if exprd and rdf(tcur) == 0: rcur = ravg = 0  #SCHDEL
  #else:                        
  rcur = rtf(tcur)*siru  #/(rdf(tcur) if exprd else 1)  #SCHDEL
  #print("DEBUG tini -> tfin / vini -> vfin: ", 
  #  shdt(tini),' (',tini,')',' -> ',shdt(tfin),' (',tfin,')  /  ', 
  #  vini,' -> ',vfin,
  #  sep='')
  ravg = tvr(tini, vini, tfin,vfin,None)*siru

  cntdn = int(ceil((tfin-tcur)/SID))

  lnw = max(nw,lnf(tcur)) if noisy else lnf(tcur)
  lane = clip(lanage((tcur,vcur)), -32768, 32767) # beemiOS needs 16bit ints?
  color = CNAME[dotcolor((tcur,vcur))]
  loser = isLoser((tcur,vcur))
  sadbrink = tcur-SID >= tini and dotcolor((tcur-SID, dtf(tcur-SID))) == REDDOT
  tluz0 = tluz
  if safebuf <= 0: tluz = tcur
  if tfin < tluz:  tluz = BDUSK

  # idea: canonicalize(road) to purge redundant rows

  setWatermark()
  setRange()
  if not(tmin <= tcur <= tmax and vmin*0<=vcur*0<=vmax*0):
    return "Plot range (tmin, tmax, vmin, vmax) must include current datapoint"
  return ''

# Helper function for genStats that's called after the out-params are set for 
# the graph. It considers all the possible graph types and constructs the 
# appropriate human-readable summary lines.
def sumSet():
  global statsum, lanesum, ratesum, limsum, deltasum, graphsum, headsum, \
         titlesum, progsum
  y, d, l, w, dlt = yaw, dir, lane, lnw, delta
  MOAR = y>0 and d>0
  PHAT = y<0 and d<0
  WEEN = y<0 and d>0
  RASH = y>0 and d<0

  if error != "": statsum = " error:    "+error+"\\n";  return

  minr = min(zip(*road)[2]) #py3 need to wrap zip in list
  maxr = max(zip(*road)[2]) #py3 need to wrap zip in list
  if abs(minr) > abs(maxr): minr, maxr = maxr, minr
  ratesum = \
    (shr(minr) if minr == maxr else "between "+shr(minr)+" and "+shr(maxr)) + \
    " per "+UNAM[runits] + \
    (" ("+"current: "+shr(rcur)+", average: " + shr(ravg)+')' \
      if minr != maxr else "")

  # What we actually want is timesum and togosum (aka, progtsum & progvsum) 
  # which will be displayed with labels TO GO and TIME LEFT in the stats box and
  # will have both the absolute amounts remaining as well as the percents done 
  # as calculated here.
  pt = shn(cvx(dayfloor(tcur), [tini,dayfloor(tfin)],[0,100], clipQ=False), 1,1)
  pv =     cvx(vcur,           [vini,vfin],          [0,100], clipQ=False)
  pv = shn(pv if vini<vfin else 100 - pv, 1,1) # meant shn(n,1,2) here?
  if pt==pv: progsum = pt+"% done"
  else:      progsum = pt+"% done by time -- "+pv+"% by value"

  if cntdn < 7:
    x = sign(rfin) * (vfin - vcur)
    ybrStr = "To go to goal: "+shn(x,2,1)+"."
  else:
    x = rdf(tcur+siru) - rdf(tcur)
    ybrStr = "Yellow Brick Rd = "+shns(x,2,1)+" / "+UNAM[runits]+"."

  ugprefix = False # debug mode: prefix yoog to graph title
  graphsum = \
    (yoog if ugprefix else "") \
    + shn(vcur,3,1)+" on "+shd(tcur)+" (" \
    + splur(numpts, "datapoint")+" in " \
    + splur(1+floor((tcur-tini)/SID),"day")+") " \
    + "targeting "+shn(vfin,3,1)+" on "+shd(tfin)+" (" \
    + splur(shn(cntdn,1,1), "more day")+"). "+ybrStr

  deltasum = shn(abs(dlt),4,2) \
    + (" below" if dlt<0 else " above")+" the centerline"
  if w == 0:                s = ""
  elif y>0 and l in [-1,1]: s = " and "+sh1(w-dlt)+" to go till top edge"
  elif y>0 and l>=2:        s = " and "+sh1(dlt-w)+" above the top edge"
  elif y>0 and l<=-2:       s = " and "+sh1(-w-dlt)+" to go till bottom edge"
  elif y<0 and l in [-1,1]: s = " and "+sh1(w-dlt)+" below top edge"
  elif y<0 and l<=-2:       s = " and "+sh1(-w-dlt)+" below bottom edge"
  elif y<0 and l>1:         s = " and "+sh1(dlt-w)+" above top edge"
  else:                     s = ""
  deltasum += s

  c = safebuf # countdown to derailment, in days
  cd = splur(c, "day")
  if kyoom:
    if MOAR: limsum= sh1sc(limd(c),  y)+" in "+cd
    if PHAT: limsum= sh1sc(limd(c),  y)+" in "+cd
    if WEEN: limsum= sh1sc(limd(0),  y)+" today" 
    if RASH: limsum= sh1sc(limd(0),  y)+" today" 
  else:
    if MOAR: limsum= sh1sc(limd(c), y)+" in "+cd+" ("+sh1c(lim(c), y)+")"
    if PHAT: limsum= sh1sc(limd(c), y)+" in "+cd+" ("+sh1c(lim(c), y)+")"
    if WEEN: limsum= sh1sc(limd(0), y)+" today ("    +sh1c(lim(0), y)+")"    
    if RASH: limsum= sh1sc(limd(0), y)+" today ("    +sh1c(lim(0), y)+")"    

  if y*d<0:   safeblurb = "unknown days of safety buffer"
  elif c>999: safeblurb = "more than 999 days of safety buffer"
  else:       safeblurb = "~"+cd+" of safety buffer"

  if loser:
    headsum = "Officially off the yellow brick road"
    lanesum = "officially off the road"
  elif w==0:
    headsum = "Coasting on a currently flat yellow brick road"
    lanesum = "currently on a flat road"
  elif MOAR and l==1:
    headsum = "Right on track in the top lane of the yellow brick road"
    lanesum = "in the top lane: perfect!"
  elif MOAR and l==2:
    headsum = "Sitting pretty just above the yellow brick road"
    lanesum = "above the road: awesome!"
  elif MOAR and l==3:
    headsum = "Well above the yellow brick road with "+safeblurb
    lanesum = "well above the road: "+safeblurb+"!"
  elif MOAR and l>3:
    headsum = "Way above the yellow brick road with "+safeblurb
    lanesum = "way above the road: "+safeblurb+"!"
  elif MOAR and l==-1:
    headsum = "On track but in the wrong lane of the yellow brick road " \
              +"and in danger of derailing tomorrow"  
    lanesum = "in the wrong lane: could derail tomorrow!"
  elif MOAR and l<=-2:
    headsum = "Below the yellow brick road and will derail if still here " \
              +"at the end of the day"
    lanesum = "below the road: will derail at end of day!"
  elif PHAT and l==-1:
    headsum = "Right on track in the right lane of the yellow brick road"
    lanesum = "in the right lane: perfect!"
  elif PHAT and l==-2:
    headsum = "Sitting pretty just below the yellow brick road"
    lanesum = "below the road: awesome!"
  elif PHAT and l==-3:
    headsum = "Well below the yellow brick road with "+safeblurb
    lanesum = "well below the road: "+safeblurb+"!"
  elif PHAT and l<-3:
    headsum = "Way below the yellow brick road with "+safeblurb
    lanesum = "way below the road: "+safeblurb+"!"
  elif PHAT and l==1:
    headsum = "On track but in the wrong lane of the yellow brick road " \
              +"and in danger of derailing tomorrow"
    lanesum = "in the wrong lane: could derail tomorrow!"
  elif PHAT and l>=2:
    headsum = "Above the yellow brick road and will derail if still here " \
              +"at the end of the day"
    lanesum = "above the road: will derail at end of day!"
  elif l==0:
    headsum = "Precisely on the centerline of the yellow brick road"
    lanesum = "precisely on the centerline: beautiful!"
  elif l==1:
    headsum = "In the top lane of the yellow brick road"
    lanesum = "in the top lane"
  elif l==-1:
    headsum = "In the bottom lane of the yellow brick road"
    lanesum = "in the bottom lane"
  elif l>1:
    headsum = "Above the yellow brick road"
    lanesum = "above the road"
  elif l<-1:
    headsum = "Below the yellow brick road"
    lanesum = "below the road"
  titlesum = CNAME[dotcolor((tcur, vcur))].title() + ". " \
    + "bmndr.com/"+yoog+" is " + lanesum \
    + (" (safe to stay flat for ~"+cd+")" if y*d>0 else "")
  
  statsum = \
    " progress: "+shd(tini)+"  " \
    +("?" if not data else sh1(vini))+"\\n" \
    +"           "+shd(tcur)+"  "+sh1(vcur) \
    +"   ["+progsum+"]\\n" \
    +"           "+shd(tfin)+"  "+sh1(vfin)+"\\n" \
    +" rate:     "+ratesum+"\\n" \
    +" lane:     " +("n/a" if abs(l) == 666 else str(l)) \
    +" ("+lanesum+")\\n" \
    +" safebuf:  "+str(safebuf)+"\\n" \
    +" delta:    "+deltasum+"\\n" \
    +" "
  if   y==0:  statsum += "limit:    "
  elif y<0:   statsum += "hard cap: "
  else:       statsum += "bare min: "
  statsum += limsum+"\\n"

# Deal with deprecated parameters for backward compatibility
def legacyIn(p):
  if 'gldt'  in p and 'tfin'     not in p: p['tfin']     = p['gldt']
  if 'goal'  in p and 'vfin'     not in p: p['vfin']     = p['goal']
  if 'rate'  in p and 'rfin'     not in p: p['rfin']     = p['rate']
  if 'usr'   in p and 'graph' in p and 'yoog' not in p:
    p['yoog'] = p['usr']+'/'+p['graph']

# Helper function for legacyOut
def rowfix(row):
  if not listy(row): return row
  if len(row) <= 3:  return row
  return row[0:3]

# Last thing we do in genStats, filter params for backward compatibility
def legacyOut(p):
  #p['fullroad']= [(p['tini'],p['vini'],0,2)]+[rowfix(r) for r in p['fullroad']]
  p['fullroad'] = [rowfix(r) for r in p['fullroad']]
  p['road']     = p['fullroad']
  if p['error']:  p['gldt'], p['goal'], p['rate'] = dayify(tfin), vfin, rfin
  else:           p['gldt'], p['goal'], p['rate'] = p['fullroad'][-1]
  p['tini'], p['vini']            = dayify(tini), vini
  p['tfin'], p['vfin'], p['rfin'] = dayify(tfin), vfin, rfin

# Helper function for stampIn
def parserow(row):
  if not listy(row) or len(row) != 3: return row
  (t,v,r) = row
  return (dayparse(t), v, r)

# Helper function for stampOut
def dayifyrow(row):
  if not listy(row) or len(row) < 1: return row
  return (dayify(row[0]),) + row[1:]

# Convert all the daystamps to unixtimes; return converted data
def stampIn(p, d):
  if 'asof'     in p: p['asof']     = dayparse(p['asof'])
  if 'tini'     in p: p['tini']     = dayparse(p['tini'])
  if 'tfin'     in p: p['tfin']     = dayparse(p['tfin'])
  if 'tmin'     in p: p['tmin']     = dayparse(p['tmin'])
  if 'tmax'     in p: p['tmax']     = dayparse(p['tmax'])
  if 'road'     in p: p['road']     = [parserow(r) for r in p['road']]

  # Stable-sort by timestamp before dayparsing the timestamps because if the 
  # timestamps were actually given as unixtime then dayparse works like dayfloor
  # and we lose fidelity.
  return [(dayparse(t), v, c) for (t,v,c) in sorted(d, key = lambda x: x[0])]

# Convert unixtimes back to daystamps
def stampOut(p):
  p['fullroad'] = [dayifyrow(r) for r in p['fullroad']]
  p['pinkzone'] = [dayifyrow(r) for r in p['pinkzone']]
  p['tluz'] = dayify(p['tluz'])
  p['tcur'] = dayify(p['tcur'])
  p['tdat'] = dayify(p['tdat'])

# Takes hash of params and data as a list of (timestamp,value,comment) triples.
# Returns a hash of the Beebrain output params, like stats about the graph and 
# where you are relative to the YBR. One special param it sets is 'error'.
# The genGraph function won't try to make a graph unless that's the empty 
# string. In addition it sets global variables like 'data' which genGraph 
# assumes are set. Optionally pass in a time to override "now" as the proctm.
def genStats(p, d, tm=None):
  global data, siru, asof, tini, road, tfin,vfin,rfin, tmin,tmax, \
         fullroad, pinkzone, tluz, tcur, tdat, error

  tm = tm or time.time() # start the clock immediately
  legacyIn(p)
  initGlobals()
  proctm = tm
  data = stampIn(p, d)

  for k,v in p.iteritems(): # make sure all supplied params are recognized 
    #py3 iteritems->items
    if k not in pin and k not in pig: error+= 'Unknown param: '+k+'='+str(v)+','
    else: setglobal(k, v)

  siru = SECS[runits]
  road.append((tfin, vfin, rfin))

  if error == '': error = vetParams()      # abort if problems with input params
  if error == '': error = procData()       # otherwise, first process the data.
  if error == '': error = procParams()     # the real work generating out params
  sumSet()

  # Why is tcur ever less than asof?

  #if tcur > asof: print("DEBUG", "tcur", shd(tcur), "asof", shd(asof), error)
  fullroad = [(tini, vini, 0, 2)] + road
  if error == '': # maybe put this in a procRoad() function
    pinkzone = [(asof, rdf(asof), 0)]
    pinkzone += [(t,v,None) for (t,v,r,n) in road if asof < t < asof+AKH]
    pinkzone += [(asof+AKH, rdf(asof+AKH), None)]
    pinkzone = fillroadall(pinkzone)

  q = pout.copy() # test suite calls genStats repeatedly so can't tamper w/ pout
  for k in q.keys(): q[k] = eval(k)
  stampOut(q)
  legacyOut(q)
  return q

################################################################################
############################## GENERATE THE GRAPH ##############################

# Return a finely spaced array of numbers from a to b for plotting purposes.
# 600-6000 is best fidelity but we had it at 200-2000 for a long time.
def griddle(a, b): return np.linspace(a, b, clip((b-a)//SID+1, 600, 6000))

# Computes dot size, taking scalf and matplotlib idiosyncracies into account
def dsz(m):
  y = round(2.0*m*scalf)/2.0
  if SCL < 1.5 and y == 3.5: return 3.0
  return y

# Convenience function for matplotlib's plot_date
def pd(data, **kwargs):
  if not data: return
  plt.plot_date(*zip(*[(plottm(t), v) for (t,v) in data]), **kwargs)

# Version of the above where the x-values and y-values are passed separately
def pdxy(xvec, yvec, **kwargs): plt.plot_date(map(plottm, xvec), yvec, **kwargs)

def fb(xvec, ytop, ybot, **kwargs):
  plt.fill_between(map(plottm, xvec), ytop, ybot, **kwargs)

# Set up axes and tick marks before plotting anything else
def grAxesPre():
  plt.minorticks_on()
  plt.grid(which='major', axis='x', linestyle='-', color='#aaaaaa')
  plt.hold(True) # matplotlib.org/api/pyplot_api.html#matplotlib.pyplot.hold
  plt.ylabel(yaxis, fontsize=8)
  # Select date formatter and tick locator with an appropriate interval
  d = (tmax - tmin) / SID  # size of the domain of the graph (x-axis's range)
  if d < 90: # include the day of the month
    plt.gca().xaxis.set_major_formatter(dt.DateFormatter('%b %d'))
    if d < 45:
      plt.gca().xaxis.set_major_locator(dt.WeekdayLocator(interval=1))
      plt.gca().xaxis.set_minor_locator(dt.DayLocator(interval=1))
    else: # major ticks 2 weeks apart
      plt.gca().xaxis.set_major_locator(dt.WeekdayLocator(interval=2))
      plt.gca().xaxis.set_minor_locator(dt.DayLocator(interval=2))
  else: # just include the month name
    if d < 365//2:
      plt.gca().xaxis.set_major_formatter(dt.DateFormatter('%b'))
      plt.gca().xaxis.set_major_locator(dt.MonthLocator(interval=1))
    elif d < 365: # major ticks 2 months apart
      plt.gca().xaxis.set_major_formatter(dt.DateFormatter('%b'))
      plt.gca().xaxis.set_major_locator(dt.MonthLocator(interval=2))
  if hidey:
    yticker = matplotlib.ticker.FormatStrFormatter('')
  else:
    yticker = matplotlib.ticker.ScalarFormatter(useOffset=False)
    yticker.set_scientific(False)
    yticker.set_powerlimits((-10,10))
  plt.gca().yaxis.set_major_formatter(yticker)

# Add the plot title and other post-graphing stuff like drawing another frame 
# to keep the guidelines from being visible on top of axes. This is mostly still
# magic from Uluc.
def grAxesPost():
  ptmin = plottm(tmin) # retrieve data limits
  ptmax = plottm(tmax)  
  ta = ptmin - PRAF*(ptmax-ptmin) # compute axis limits
  tb = ptmax + PRAF*(ptmax-ptmin)
  va = vmin  - PRAF*(vmax-vmin)
  vb = vmax  + PRAF*(vmax-vmin)
  plt.axis([ta, tb, va, vb]) # rescale axis properly
  # uluc says we can comment this out for mpld3:
  #plt.plot([ta,ta,tb,tb,ta], # here's where we redraw the frame
  #         [va,vb,vb,va,va], linestyle='-', color=BLCK)
  
  xax = plt.gca().xaxis
  yax = plt.gca().yaxis

  for a in [xax, yax]:
    ticks = list(a.majorTicks) # a copy
    ticks.extend(a.minorTicks)
    for t in ticks:
      t.label1.set_fontsize(8)
      t.label2.set_fontsize(8)
      t.tick1On = t.label1On = True # tick marker/label on left (or bottom)
      t.tick2On = t.label2On = True # tick marker/label on right (or top)

  for label in xax.get_ticklabels(): label.set_verticalalignment('top')
  ticks = list(xax.majorTicks)
  ticks.extend(xax.minorTicks)
  for t in ticks: 
    t.label1.set_y(t.label1._y - .01)
    t.label2.set_y(t.label2._y + .03)
  if stathead:  # squeeze it in up top
    plt.annotate(graphsum, (.5,.98), 
                 xycoords='figure fraction', ha='center', fontsize=7)

  plt.gcf().tight_layout()

# Auto-wrap all text objects in a figure at draw-time. The idea, I guess, is
# that the text watermarks (not the image ones) have to be rescaled based on how
# wide they are after rendering. So we have this callback function that's used
# in genImage. But why? This isn't needed for the "akrasia horizon" text...
def ondraw(event):                            
  for artist in watermarks: # Cycle thru all artists in all the axes in the fig
    fs = artist.get_size()                          # font size
    le = artist.get_window_extent().extents         # list of extents
    pc = ASP * event.renderer.points_to_pixels(fs)  # pixels per character
    if pc*len(artist.get_text()) != 0:
      artist.set_size(min(SCL*(imgsz*AXW/2.4)/(le[2]-le[0])*fs,
                          imgsz*ASP*AXH/3.5))
  fig = event.canvas.figure
  # Temporarily disconnect any callbacks to the draw event (to avoid recursion)
  fh = fig.canvas.callbacks.callbacks[event.name] # function handles
  fig.canvas.callbacks.callbacks[event.name] = {}
  fig.canvas.draw() # re-draw the figure
  fig.canvas.callbacks.callbacks[event.name] = fh # reset draw event callbacks

# Render s (a string or an image) to fill a rectangle with left/bottom corner 
# (l,b) and right/top corner (r,t). Cf:
# http://stackoverflow.com/q/8178257/make-a-text-string-fill-a-rectangle
# http://matplotlib.org/users/text_props.html
# The watermark is drawn below everything except the aura, and we have to do
# that by specifying the zorder (zorder defaults to 1, 2, or 3) because the 
# watermarks are drawn with a callback when the graph is turned into an image
# (see above ondraw function) so it has to be inserted at the right zorder
# instead of just plotting it first or second. Messy.
def rendrect(s, rect, align='center'):
  (l,b), (r,t) = rect
  l, r = plottm(l), plottm(r)
  if type(s) is str:
    if   align == 'left':  x = l 
    elif align == 'right': x = r
    else:                  x = (l+r)/2
    watermarks.append(plt.text(x, (t+b)/2, s,
                               horizontalalignment=align,
                               verticalalignment='center',  
                               size=130, color=GRAY, weight='heavy', zorder=0))
  else:
    mid = (l+r)//2
    l = mid - (mid - l)*ASP*1.1
    r = mid + (r - mid)*ASP*1.1
    imgp = plt.imshow(s, extent=[l,r,b,t], aspect='auto',
                         clip_on=False, interpolation='nearest')

# Watermark: safebuf on good side of the YBR and pledge on bad side
def grWatermark():
  skl = "jollyroger_sqr.png" # image of skull and crossbones (jolly roger)
  inf = "infinity.png"       # image of infinity symbol
  sml = "smiley.png"         # image of smiley face
  if loser and os.path.exists(skl): g = mpi.imread(skl)
  else:                             g = str(waterbuf)
  b = str(waterbux)

  if   g == 'inf': g = mpi.imread(inf)
  elif g == ':)':  g = mpi.imread(sml)
  if   b == 'inf': b = mpi.imread(inf)
  elif b == ':)':  b = mpi.imread(sml)

  tmid = (tmin+tmax)/2
  vmid = (vmin+vmax)/2
  toff = (tmax-tmin)/25      # offset from quadrant edges
  voff = (vmax-vmin)/25

  bl = ((tmin+toff, vmin+voff), (tmid-toff, vmid-voff)) # bottom left
  br = ((tmid+toff, vmin+voff), (tmax-toff, vmid-voff)) # bottom right
  tl = ((tmin+toff, vmid+voff), (tmid-toff, vmax-voff)) # top left
  tr = ((tmid+toff, vmid+voff), (tmax-toff, vmax-voff)) # top right

  if   dir>0 and yaw<0: rendrect(g, br, 'right'); rendrect(b, tl, 'left')  #WEEN
  elif dir<0 and yaw>0: rendrect(g, tr, 'right'); rendrect(b, bl, 'left')  #RASH
  elif dir<0 and yaw<0: rendrect(g, bl, 'left');  rendrect(b, tr, 'right') #PHAT
  else:                 rendrect(g, tl, 'left');  rendrect(b, br, 'right') #MOAR

# Generate the paved yellow brick road and the dotted centerline
def grRoad():
  # maybe just get the YBR value at all kinks in the road, plus the endpoints...
  #xvec= sorted(deldups([tmin,tmax] + [t for (t,v,r) in road if tmin<=t<=tmax]))
  fudge = PRAF*(tmax-tmin) # scooch a bit beyond tmin/tmax, right up to the axes
  xvec = griddle(max(tini, tmin-fudge), tmax+fudge)
  yvec = [rdf(t) for t in xvec]
  if lnw != 0: # the actual YBR, filled between the edges
    ylo = [rdf(t)-lnw for t in xvec]
    yhi = [rdf(t)+lnw for t in xvec]
    fb(xvec, ylo, yhi, edgecolor=DYEL, facecolor=DYEL, alpha=.5)
    # could do 
    # pdxy(xvec, ylo if yaw>0 else yhi, color=BRIGHTERYELLOW, fmt='bo', 
    #      marker='None', linestyle='-', linewidth=1.5*scalf)
    # to show the critical edge of the YBR as a brighter yellow but it looks 
    # funny showing through the turquoise swath.
    # we were using (1, 1, .75) as the brighter yellow. (previously .9 vs .75)
  else: # razor-thin version of YBR when it technically has 0 width
    pdxy(xvec, yvec, color=DYEL, marker='None', linestyle='-', 
                                                linewidth=2.4*scalf)
  if yaw != 0: grGuidelines(xvec)
  # Finally, draw the dotted orange centerline
  pdxy(xvec, yvec, color=ORNG, fmt='bo', marker='None', linestyle='--', 
                   linewidth=1.0*scalf, dashes=(20,40))

def grAhorizon():
  #t = asof + AKH
  #if t > tmax or t < tmin: return
  #x = plottm(dayfloor(t))
  #plt.axvline(x=x, color=AKRA, linewidth=.5*scalf, dashes=(5,5))
  #xt = x + (plottm(tmax)-plottm(tmin))*.021
  #plt.text(xt, (vmin+vmax)/2, "Akrasia Horizon", rotation=90, color=AKRA,
  #  horizontalalignment='right', verticalalignment='center', fontsize=7)
  # new version from uluc below:
  va = vmin  - PRAF*(vmax-vmin)
  vb = vmax  + PRAF*(vmax-vmin)
  t = asof + AKH
  if t > tmax or t < tmin: return
  x = plottm(dayfloor(t))
  plt.plot_date([x, x], [va, vb], color=AKRA, linewidth=.5*scalf, dashes=(5,5),
    marker='None')
  xt = x + (plottm(tmax)-plottm(tmin))*.021
  plt.text(xt, (vmin+vmax)/2, "Akrasia Horizon", rotation=90, color=AKRA,
    horizontalalignment='center',
    verticalalignment='center', fontsize=7)

# Show a gray line for odom resets
def grOdomResets(xvec):
  va = vmin - PRAF*(vmax-vmin)
  vb = vmax + PRAF*(vmax-vmin)
  for t in xvec:
    if t > tmax or t < tmin: continue
    x = plottm(dayfloor(t))
    plt.plot_date([x,x], [va,vb], color=BLCK, linewidth=.05*scalf, dashes=(5,5),
      marker='None')
    #xt = x + (plottm(tmax)-plottm(tmin))*.021 #SCHDEL

# Show the hashtags as labels on the graph
def grHashtags():
  va = vmin - PRAF*(vmax-vmin)
  vb = vmax + PRAF*(vmax-vmin)
  for t in hashhash.keys():
    if t > tmax or t < tmin or not hashhash[t]: continue
    x = plottm(dayfloor(t))
    #plt.plot_date([x,x], [va,vb], color=BLCK, linewidth=.01*scalf, 
    #  marker='None')
    xt = x + (plottm(tmax)-plottm(tmin))*.021
    plt.text(xt, (vmin+vmax)/2, ' '.join(hashhash[t]),
      rotation=90, color=BLCK,
      horizontalalignment='center',
      verticalalignment='center', fontsize=7)


# Other ideas for data smoothing...
# Double Exponential Moving Average: http://stackoverflow.com/q/5533544
# Uluc notes that we should use an acausal filter to prevent the lag in 
# the thin purple line.

# Helper function for Exponential Moving Average; returns smoothed value at x.
# Very inefficient since we recompute the whole moving average up to x for 
# every point we want to plot.
def ema0(data, x):
  # The Hacker's Diet recommends 0.1
  # Uluc had .0864
  # http://forum.beeminder.com/t/control-exp-moving-av/2938/7 suggests 0.25
  KEXP = .25/SID 
  if yoog=='meta/derev':   KEXP = .03/SID  # .015 looks good for meta/derev
  if yoog=='meta/dpledge': KEXP = .03/SID  # .1 was too jagged for meta/dpledge

  (xp, yp) = data[0]  # previous x-value, previous y-value
  prev = yp
  if x < xp: return prev
  for i in data[1:]:  # compute line equation
    dt = i[0]-xp
    A = (i[1]-yp)/dt  # (why was this line marked as a to-do?)
    B = yp
    if x < i[0]:        # found the interval; compute intermediate point
      dt = x-xp
      return B + A*dt - A/KEXP + (prev - B + A/KEXP) * exp(-KEXP*dt)
    else:               # not the current interval; compute next point
      prev = B + A*dt - A/KEXP + (prev - B + A/KEXP) * exp(-KEXP*dt)
      (xp, yp) = i
  # keep computing the exponential past the last datapoint if needed
  dt = x-xp
  return     B + A*dt - A/KEXP + (prev - B + A/KEXP) * exp(-KEXP*dt)

# Function to generate samples for the Butterworth filter
def griddlefilt(a, b): return np.linspace(a, b, clip((b-a)//SID+1, 40, 2000))

# Exponentially weighted moving average line (purple)
def grMovingAv():
  if len(data) == 1 or data[-1][0]-data[0][0] <= 0: return

  # Create new vector for filtering datapoints
  newx = griddlefilt(data[0][0], data[-1][0])

  # Compute cutoff frequency in terms of the Nyquist rate
  dayspersample = ( (data[-1][0]-data[0][0])//SID+1)/len(newx)
  cutoffdays = 40
  # Wn = 1 is half the sample frequency.
  Wn = max(2.0/(cutoffdays/dayspersample), 0.05)
  #print(Wn)

  # Design the filter
  (b, a) = butter(8, Wn, btype = 'low')

  # Restructure data properly
  (datax, datay) = zip(*data)
  # Interpolate
  datafun = interp1d(datax, datay, kind='linear', copy='false')
  # Compute regularly spaced arrays
  newy = datafun(newx)
  # Filter
  filteredy = filtfilt(b, a, newy, padtype='constant')
  # Reshape data to the old format
  newdata = zip(newx, filteredy)

  # Plot the old, exponential filter
  pd([(x, ema0(data,x)) for x in griddle(data[0][0], data[-1][0])], 
     color=PURP, fmt='bo', marker='None', linestyle='-', linewidth=.6*scalf)
  # Plot the new filter response TODO
  #pd(newdata, 
  #   color=BLCK, fmt='bo', marker='None', linestyle='-', linewidth=.6*scalf)

# Return a pure function that fits the data smoothly, used by grAura
def smooth(data):
  SMOOTH = (1e5 * SID + 2208974400)
  (x,y) = zip(*data)
  xnew = [i+SMOOTH for i in x]
  warnings.simplefilter('error', np.RankWarning)
  try:
    (coeff, res, rnk, sv, rc) = np.polyfit(xnew, y, 3, full=True)
    # If smallest singular value is too small, try fitting a 2nd order polynom
    if min(sv) < 5e-13:
      c2 = np.polyfit(xnew, y, 2)
      coeff = c2.tolist()
      coeff.insert(0, 0.0)
  except np.RankWarning:
    c2 = np.polyfit(xnew, y, 2)
    coeff = c2.tolist()
    coeff.insert(0, 0.0)
  return (lambda x: coeff[3] + \
                    coeff[2]*(x+SMOOTH) + \
                    coeff[1]*(x+SMOOTH)**2 + \
                    coeff[0]*(x+SMOOTH)**3)

# Return a pure function that fits the data smoothly, used by grAura
# HT Abe Othman and http://en.wikipedia.org/wiki/Tikhonov_regularization
def smooth2(data):
  a = 0 # regularization parameter greater than 0 (0 = ordinary least squares)
  (x,y) = zip(*data)
  A = np.array([[1.0, float(z), np.power(float(z),2), \
                                np.power(float(z),3)] for z in x])
  #print("DEBUG: A.shape[1] == 4?",A.shape[1])
  #print("DEBUG:",[[1, z, np.power(z,2), np.power(z,3)] for z in x])
  print("DEBUG: data", data)
  print("DEBUG: y", np.array(y))
  print("DEBUG: A", A)
  G = a * np.eye(4) # 4 is the number of columns in A, ie, A.shape[1]
  G[0,0] = 0 # don't regularize bias, or something
  return (lambda z: np.dot(np.hstack((1,z,np.power(float(z),2), \
                                          np.power(float(z),3))), \
                           np.dot(np.linalg.inv(np.dot(A.T, A) + \
                                                np.dot(G.T, G)), \
                                  np.dot(A.T, np.array(y)))))

# STACK OF TABS
# http://stackoverflow.com/questions/8672005/correct-usage-of-fmin-l-bfgs-b-for
# http://stackoverflow.com/questions/12935098/how-to-plot-line-polygonal-chain
# http://en.wikipedia.org/wiki/Local_regression
# http://doc.bmndr.com/abe
# https://gist.github.com/diogojc/1519756

# From 
# https://code.google.com/p/crmeng-pre-1/source/browse/trunk/lowess/lowess.py
# Lowess smoother: Robust locally weighted regression.
# The lowess function fits a nonparametric regression curve to a scatterplot.
# The arrays x and y contain an equal number of elements; each pair
# (x[i], y[i]) defines a datapoint in the scatterplot. The function returns
# the estimated (smooth) values of y.
# The smoothing span is given by f. A larger value for f will result in a
# smoother curve. The number of robustifying iterations is given by iter. The
# function will run faster with a smaller number of iterations.
#def lowess(x, y, f=2./3., iter=3):
#  n = len(x)
#  r = int(np.ceil(f*n))
#  #x = np.array(x)
#  h = [np.sort(np.abs(x-x[i]))[r] for i in range(n)]
#  w = np.clip(np.abs(([x]-np.transpose([x]))/h),0.0,1.0)
#  w = 1-w*w*w
#  w = w*w*w
#  yest = np.zeros(n)
#  delta = np.ones(n)
#  for iteration in range(iter):
#    for i in range(n):
#      weights = delta * w[:,i]
#      b = np.array([sum(weights*y), sum(weights*y*x)])
#      A = np.array([[sum(weights), sum(weights*x)],
#                       [sum(weights*x), sum(weights*x*x)]])
#      beta = np.linalg.solve(A,b)
#      yest[i] = beta[0] + beta[1]*x[i]
#    residuals = y-yest
#    s = np.median(abs(residuals))
#    delta = np.clip(residuals/(6*s),-1,1)
#    delta = 1-delta*delta
#    delta = delta*delta
#  return yest

# Generate guide lines parallel to the centerln on the good side of the YBR
# and make a thicker one at 7 days safety buffer (or whatever akrasia horiz is).
def grGuidelines(xvec):
  def pd0(x, y, c, t=1): 
    pdxy(x, y, color=c, fmt='bo', marker='None', linestyle='-', 
               linewidth=t*.4*scalf, clip_box=[.1,.1,.9,.9])

  if len(xvec) < 3: return
  dt = 1.1*(xvec[2] - xvec[1])
  if   lnw>0 and (vmax-vmin) / lnw   <= 32: delta = lnw
  elif lnw>0 and (vmax-vmin)/(6*lnw) <= 32: delta = 6*lnw # was 7
  else:                                     delta = (vmax-vmin)/32
  shift = 0 # amount to shift the centerline by for each guiding line
  i = 0
  while abs(shift) <= vmax-vmin and i < 99: # i<99 check should be superfluous
    shift += yaw*delta
    i += 1
    if abs(shift) == lnw: continue # if first gline is on road edge, skip it
    rd = [rdf(t) + shift for t in xvec]
    pd0(xvec, rd, [DYEL, LYEL][int(i%2)], 1)

    if not aura: continue # below is for aura overlap (NB: call grAura first)
    tlim = asof+AKH  # max x-value aura extends to; should DRY this up
    newd = [(t,v) for (t,v) in zip(xvec,rd) if t <= tlim and \
                                          aurdn < v-auraf(t) < aurup]
    if not newd: continue
    chunks = split(newd, lambda x,y: y[0]-x[0] <= dt)
    for x in chunks: pd0(*(zip(*x)+[GRUE]))
  # thick guiding line showing the safety buffer cap of 7 days
  bc = (bufcap() if not maxflux else yaw*maxflux)
  pd0(xvec, [rdf(t) + bc for t in xvec], BIGG, 2.5)

# Used with grAura() and for computing mean and meandelt, this adds dummy 
# datapoints on every day that doesn't have a datapoint, interpolating linearly.
def gapFill(d):
  start = int(d[0][0])
  end = int(d[-1][0])
  given = {}
  for p in d: given[sint(p[0])] = 1
  dummies = [(x, None) for x in \
             [x for x in range(start,end,int(SID)) if not sint(x) in given]]
  d = sorted(d+dummies, key=(lambda x: x[0]))
  # walk forward (backward) remembering the prev (next) value for each dummy
  prev = {}
  for p in d:
    if p[1] is not None: x = p
    prev[sint(p[0])] = x
  nxt = {}
  for p in reversed(d):
    if p[1] is not None: x = p
    nxt[sint(p[0])] = x

  return [sandwich(prev[sint(x[0])], x, nxt[sint(x[0])]) for x in d]

# Aura around the points. This (but confusingly not the aura overlap) is drawn
# below everything else, even the watermark.
def grAura():
  global auraf, aurup, aurdn
  if len(data) == 1 or data[-1][0]-data[0][0] <= 0: return
  d = [(t,v) for (t,v) in data if t >= tmin]
  auraf = smooth(gapFill(d))
  # original aura was wide enough to cover every point; now using stdflux
  #aurdn = min(-lnw/2.0, min(v-auraf(t) for (t,v) in data))
  #aurup = max( lnw/2.0, max(v-auraf(t) for (t,v) in data))
  aurdn = min(-lnw/2.0, -stdflux)
  aurup = max( lnw/2.0,  stdflux)
  fudge = PRAF*(tmax-tmin)
  xvec = griddle(tmin-fudge, min(asof+AKH, tmax+fudge))
  fb(xvec, [auraf(x)+aurdn for x in xvec],
           [auraf(x)+aurup for x in xvec], edgecolor=BLUE, facecolor=BLUE, 
                                           zorder=-1, alpha=1.0)

# Opacity/transparency doesn't look right so draw the intersection explicitly.
# This is an amalgamation of grRoad() and grAura().
def grOverlap():
  if len(data) == 1 or data[-1][0]-data[0][0] <= 0: return
  fudge = PRAF*(tmax-tmin)
  xvec = griddle(tmin-fudge, min(asof+AKH, tmax+fudge))
  aurlo = [max(auraf(x)+aurdn, rdf(x)-lnw) for x in xvec]
  aurhi = [min(auraf(x)+aurup, rdf(x)+lnw) for x in xvec]
  aurwh = [l < h for (l,h) in zip(aurlo, aurhi)]
  fb(xvec, aurlo, aurhi, where=aurwh, edgecolor=GRUE, facecolor=GRUE, alpha=.4)

# Pink Zone, aka Verboten Zone aka No Zone
def grPinkzone():
  xvec = griddle(asof, asof+AKH)
  #va = vmin-PRAF*(vmax-vmin)
  #vb = vmax+PRAF*(vmax-vmin)
  if yaw<0:
    bot = [rdf(x)                for x in xvec]
    top = [vmax+PRAF*(vmax-vmin) for x in xvec]
  else:
    bot = [vmin-PRAF*(vmax-vmin) for x in xvec]
    top = [rdf(x)                for x in xvec]
  fb(xvec, bot, top, facecolor=PINK, edgecolor=PNKE, alpha=.25)

def grBullseye(x_y):
  x,y = x_y
  img = mpi.imread("bullseye.png") # image of bullseye
  xsize = 30/(imgsz*AXW)*(tmax-tmin)
  ysize = 60/(imgsz*AXW)*(vmax-vmin)
  l = plottm(x - xsize/2);  b = y - ysize/2
  r = plottm(x + xsize/2);  t = y + ysize/2
  imgp = plt.imshow(img, extent=[l, r, b, t], aspect='auto', clip_on=False,
                         interpolation='nearest', zorder=1)
  # UGH: was zorder=2 for ages but then some things got better by changing
  # to zorder=1 but then it's still not always right. we might need to go back
  # to having explicit zorder for everything like uluc did originally

# Plot the purple steppy line, plus a bigger purple dot at each datapoint
def grSteppy():
  a = tini # maybe more efficient to max w/ the datapoint just left of tmin
  b = min(asof, tmax) # stop the steppy line at asof or tmax, whichever's first
  
  # First plot the purple steppy line without the dots, including flatlined pt
  if tini in allvals: dpre = [(tini, max(allvals[tini]) if dir<0 else \
                                     min(allvals[tini]))]
  else:               dpre = []
  d = dpre + [(t,v) for t,v in aggval.iteritems() if a<=t<=b] 
  #py3 iteritems->items
  if flad is not None: d += [flad]
  d.sort()
  pd(d, color=PURP, fmt='bo', marker='None', linestyle='steps-post-',
        drawstyle='steps-post', linewidth=.9*scalf)
  # Now draw the actual purple dots, except the flatlined point
  a = max(tini, tmin)
  d = [(t,v) for t,v in aggval.iteritems() if a<=t<=b] #py3 iteritems->items
  d.sort() # uluc bug fix
  pd(d, color=PURP, fmt='bo', marker='o',linestyle='None', markeredgewidth=0,
        drawstyle='steps-post', markersize=2.8*scalf, linewidth=.9*scalf)

# Helper for grDots, dot styles for past data, flatlined point, and future data
def dottype(t):
  dot = 'fmt'
  siz = 'markersize'
  mew = 'markeredgewidth'
  mec = 'markeredgecolor'
  alf = 'alpha'
  rgb = 'color'
  qs  = .25*scalf # quarter scale factor
  upd = ('v' if yaw>0 else '^') # up or down triangle for derailments
  return {
    'AGGPAST':   { dot:'o', siz:dsz(2),    mew:qs, mec:BLCK, alf:1.0 },
    'AGGFUTURE': { dot:'o', siz:dsz(2),    mew:qs, mec:BLCK, alf:.33 },
    'FLATLINE':  { dot:'>', siz:dsz(2.6),  mew:0,  mec:BLCK, alf:1.0 },
    'RAWPAST':   { dot:'o', siz:dsz(1.5),  mew:0,  mec:BLCK, alf:1.0 },
    'RAWFUTURE': { dot:'o', siz:dsz(1.5),  mew:0,  mec:BLCK, alf:.33 },
    'DERAIL':    { dot:upd, siz:dsz(4),    mew:0, rgb:REDDOT, alf:1 },
    'HOLLOW':    { dot:'o', siz:dsz(1),    mew:0,  rgb:WITE   },
  }[t]

# Plot the given datapoints (future points transparent, etc) with dottype t
def grDots(data, t):
  dict = dottype(t)
  if 'color' in dict: return pd(data, **dict)
  for i in [BLCK, REDDOT, ORNDOT, BLUDOT, GRNDOT]:
    pd([x for x in data if dotcolor(x)==i], color=i, **dict)

# Start at the first data point plus sign*delta and walk forward making the next
# point be equal to the previous point, clipped by the next point plus or minus 
# delta. Used for the rose-colored dots.
def inertia0(x, d, sgn):
  return foldlist(lambda a, b: clip(a, b-d, b+d), x[0]+sgn*d, x[1:])
def inertia(dat, delt, sgn):  # data, delta, sign (-1 or +1)
  tdata = zip(*dat) # transpose of data
  tdata[1] = inertia0(tdata[1], delt, sgn)
  return zip(*tdata)
# Same thing but start at the last data point and walk backwards.
def inertiaRev(dat, dlt, sgn): return reversed(inertia(reversed(dat), dlt, sgn))

# Plot the rosy progress line
def grRosy():
  delta = max(lnw, stdflux)
  if dir > 0:
    lo = inertia(   data, delta, -1)
    hi = inertiaRev(data, delta, +1)
  else:
    lo = inertiaRev(data, delta, -1)
    hi = inertia(   data, delta, +1)
  yveclo = [v for (t,v) in lo]
  yvechi = [v for (t,v) in hi]
  yvec = [(l+h)/2.0 for (l,h) in zip(yveclo, yvechi)]
  xvec = [t for (t,v) in data]
  pdxy(xvec, yvec, fmt='bo', marker='o', color=ROSE,
                   linestyle='-', markersize=dsz(2.7), markeredgecolor=ROSE,
                   markeredgewidth=0, linewidth=.8*scalf)

# An empty graph with a big message instead of, y'know, a graph.
def emptyGraph(msg):
  matplotlib.rc('font', size=9)
  plt.axis([-1.03, 1.03, -1.03, 1.03])
  plt.minorticks_on()
  plt.tick_params(axis='both', which='minor')
  msg = re.sub(r'\\n', '\n', msg)
  plt.text(0, 0, msg, horizontalalignment='center',
                      verticalalignment='center', size=9)
  plt.ylabel(yaxis)

# Call genStats to set global data, params before calling this.
def genGraph():
  global asof, tini,tfin,tmax, figtitle, road, tcur, tdat, tluz, scalf

  #plt.xkcd() # tee hee
  plt.close('all')
  plt.figure(figsize=(imgsz/DPI, ASP*imgsz/DPI), dpi=DPI)

  if yoog == "NOGRAPH":
    emptyGraph("Beebrain was called with 'NOGRAPH_*' as the slug\n"+
               "so no graph or thumbnail was generated, just this\n"+
               "static placeholder!"); return
  if not data: # there may be other errors but if no data, only say that
    emptyGraph("No data yet"); return
  if error != "":
    emptyGraph("The following errors prevented us from generating "+yoog+".\n"+
      "(We've pinged Beeminder support to come help fix things up here!)"+
      "\n\n"+error); return

  # If the timespan of the graph (tmax - tmin) is at least 73 days then this 
  # scalf is a constant 1/400. If fewer days then this will be up to twice that.
  # This gives the radius of the colored inner disk for datapoints (as a 
  # fraction of the width of the whole graph) and everything else is some amount
  # bigger than that. (Currently the black disk that surrounds the colored one 
  # is 3/2 times as big and the rose or purple dots are (3/2)^2 times as big.)
  scalf = cvx(tmax, (tmin, tmin+73*SID), (2,1)) / 400 * imgsz

  grAxesPre()
  if aura: grAura()
  grWatermark()
  grRoad() # also calls grGuidelines
  grAhorizon()
  grDots([(t, worstval[t+SID]) for t in derails], 'DERAIL')
  grOdomResets(oresets)
  if hashtags: grHashtags()
  if aura: grOverlap()
  grPinkzone()
  if tfin <= tmax: grBullseye((tfin, rdf(tfin)))
  if movingav: grMovingAv()
  if steppy:   grSteppy()
  if rosy:     grRosy()

  if plotall:  # note that allvals and aggval don't include flatlined datapoint
    plotme = flatten([[(t,v) for v in vl] for t,vl in allvals.iteritems()]) 
    #py3 iteritems->items
    grDots([(t,v) for (t,v) in plotme if t <= asof], 'RAWPAST')
    grDots([(t,v) for (t,v) in plotme if t >  asof], 'RAWFUTURE')
  grDots([(t,v) for t,v in aggval.iteritems() if t <= asof], 'AGGPAST') 
  #py3 iteritems->items x2
  tmp = [(t,v) for t,v in aggval.iteritems() if t<=asof and v not in allvals[t]]
  grDots(tmp, 'HOLLOW')
  grDots([(t,v) for t,v in aggval.iteritems() if t > asof], 'AGGFUTURE') 
  #py3 iteritems->items
  if flad is not None: grDots([flad], 'FLATLINE')
  grAxesPost()

# Having created a plot with genGraph above, export it to the given filename, f.
def genImage(f):
  # Resize watermark text during drawing
  cid = plt.gcf().canvas.mpl_connect('draw_event', ondraw)
  plt.savefig(f, dpi=SCL*DPI)
  remap  = " -remap palette.png -colors 256 +dither "
  resize = " -filter Box -resize "+str(100//SCL)+"% "
  if SCL != 1.0: os.system(IMGMAG+resize+remap+f+" "+f)
  else:          os.system(IMGMAG+       remap+f+" "+f)

  plt.gcf().canvas.mpl_disconnect(cid)

# Converts a color to a string like imagemagick wants.
def cstring(r_g_b): 
  r,g,b = r_g_b
  return "rgb(" + sint(round(r*255)) + "," + \
                  sint(round(g*255)) + "," + \
                  sint(round(b*255)) + ")"

def genThumb(tf):
  global figtitle
  if figtitle is not None: figtitle.set_visible(False)
  plt.gca().set_position([-0.01, -0.01, 1.02, 1.02])
  plt.savefig(tf, dpi=.3*DPI)
  remap = " -remap palette.png -colors 256 +dither "
  bord = " -bordercolor '"+cstring(dotcolor((tcur,vcur)))+"' "+"-border 2x2 "
  os.system(IMGMAG+bord+remap+tf+" "+tf)


################################################################################
######################## SCHDEL: SCHEDULED FOR DELETION ########################

"""
Implementation notes for underspecified rows of the road matrix, no longer
supported:
  Compute the global rate given global t, v, (tfin,vfin) & underspecified road 
matrix. For now just use the average rate from (t0,v0) to (t,v). The possibly 
Really Right way to do this when a global gldt and goal (but no rate) are 
specified:  Underspecified road segments with no rate specified should be given
rates that are all the same, if possible. 
What we actually do currently is the following worse-is-better approach:
If there's, for example, a long flat spot between (t0,v0) and the globally 
specified goal (t,v) then the initial segment will be shallow, matching the 
overall average rate, and the final segment will have to be super steep to make
up for the flat spot. So it's a bit myopic. Ideally you'd make both the segments
before and after the flat spot be equally steep. That's not so hard if all the 
road segments have end times specified. Then you can get the global rate (what 
this function returns) by snipping out all the segments that do have rates 
(non-underspecified segments) and stitching them back together. Ie, sum up the 
delta t's and the delta v's for all non-underspecified segments, subtract the 
sums from (t,v) and then compute the rate from (t0,v0) to (t,v).
"""

"""
Implementation notes for the original lane width function:
  For noisy graphs, compute the lane width based on the data and YBR rate.
If there's only one datapoint (t,v) on a flat road then lane = 5% of v.
If one datapoint and road not flat then use the daily rate as the lane width.
Otherwise, compute the lane width for every pair of datapoints and take the max.
The lane width for a pair of points is the max of the daily rate and the daily 
deviation of the values of the points, decayed exponentially so that the 
deviation is multiplied by 50% if it's 30 days in the past.
Finally, the lane width for a pair of points is maxed with the lane width needed
to ensure the property that you can't lose tomorrow if you're in the right lane
today.
  origLaneWidth[{{t_,v_}}] := If[ravg==0, v/20, Abs[rdf[t]-rdf[t+SID]]]
  origLaneWidth[data_] := Max[laneWidth0 /@ Partition[data, 2, 1]]
  laneWidth0[{{t_,v1_},{t_,v2_}}] := Abs[v1-v2]
  laneWidth0[{{t1_,v1_}, {t2_,v2_}}] := Max[
    Abs[rdf[t1]-rdf[t1+SID]],  (* daily rate of the YBR *)
    Abs[v1-v2]/(t2-t1)*SID*Exp[Log[ .50 ] / 30 / SID]^(tcur-t2),
    If[t2-t1 == SID && (ravg<0 && v1<rdf[t1] && v2>rdf[t2] ||
                        ravg>0 && v1>rdf[t1] && v2<rdf[t2]),    
      Abs[v2-rdf[t2]]
    , 0]]
"""
