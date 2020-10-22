#!/usr/bin/env python
# Sanity checker for Beebrain.
# If sanity.txt exists, see if we match, otherwise create it.
# Note that we use the timestamp of sanity.txt as the asof date for all the 
# graphs, otherwise things would change from one day to the next.
# But that means you shouldn't do "cp insanity.txt sanity.txt" to accept new
# changes in the output since it won't match itself when run next.
# Just "rm sanity.txt" instead and let it regenerate.
# (Something like "cp -p" except where you preserve the modification time of the
# destination file should work too.)

from __future__ import print_function #py3 comment out
from __future__ import division #py3 comment out
from math import ceil, floor
import commands  #py3 comment out
import time
import sys
import os
import re
import json
import blib as bb

sanef   = 'sanity.txt'
insanef = 'insanity.txt'
dpath   = 'suite'
div     = 'MAGIC_SANITY_DIVIDER'
columns = int(os.popen('stty size', 'r').read().split()[1]) # console width

def freak(): os.system('~/prj/tagtime/sound/playsound loud-uh-oh.wav')
def ahhhh(): os.system('~/prj/tagtime/sound/playsound sigh.wav')

def asciify(x): return 'null' if x == None else str(x)

def riffle(l, x): return bb.flatten([[y,x] for y in l])

def shdl(t): return 'null' if t == None else bb.shd(t)
def sh3(x):  return 'null' if x == None else bb.shn(bb.chop(x), 5,3)
def shl(l):  return ', '.join([sh3(x) for x in l])

def aggval(x):  return bb.aggval[x]  if x in bb.aggval  else None
def allvals(x): return bb.allvals[x] if x in bb.allvals else []

# Write the string s to file f
def spew(f, s):
  x = open(f, 'w')
  x.write(s)
  x.close()

# Append the string s to file f
def spewa(f, s): 
  with open(f, "a") as x: x.write(s)

# Return the contents of file f as a string
def slurp(f):
  x = open(f, 'r')
  out = x.read()
  x.close()
  return out

# Takes a bb filename, runs genStats on it, and returns a string that says 
# everything Beebrain knows about the goal.
def serialize(fn, proctm):
  #print(fn)
  iw = 16           # Indent Width
  ai = '          ' # Additional Indent string for road matrix and deltas
  pf = re.sub('^suite/', '', fn) # PreFix for all lines of the sanity file
  pf = re.sub('\.bb', '', pf)
  pf = re.sub('\+', '/', pf)
  pf = (pf+' '*iw)[0:iw]+' '

  j = json.load(open(fn))
  params, data = j['params'], j['data']
  qo = bb.genStats(params, data, proctm)

  out = [div+' '+'-'*10+" "+str(fn)+" "+'-'*10+'\n']

  qo['fullroad'] = [row[:3] for row in qo['fullroad']]
  qo['fullroad'] = qo['fullroad'][1:] #TODO
  rdtxt = [''.join(['{',str(t),', ',sh3(v),', ',sh3(r), '}']) \
           for (t,v,r) in qo['fullroad']]
  rdtxt = riffle(rdtxt, '\n'+pf+ai)[:-1]
  out+= [pf,"fullroad: "]
  out+= rdtxt
  out+= '\n'

  #pztxt = [''.join(['{',str(t),', ',sh3(v),', ',sh3(r), '}']) \
  #         for (t,v,r,s) in qo['pinkzone']]
  #pztxt = riffle(pztxt, '\n'+pf+ai)[:-1]
  #out+= [pf,"pinkzone: "]
  #out+= pztxt
  #out+= '\n'

  out+= [pf,"tluz:     ",str(    qo['tluz']),    '\n']
  out+= [pf,"tcur:     ",str(    qo['tcur']),    '\n']
  out+= [pf,"vcur:     ",sh3(    qo['vcur']),    '\n']
  out+= [pf,"rcur:     ",sh3(    qo['rcur']),    '\n']
  out+= [pf,"ravg:     ",sh3(    qo['ravg']),    '\n']
  out+= [pf,"tdat:     ",str(    qo['tdat']),    '\n']
  out+= [pf,"lnw:      ",sh3(    qo['lnw']),     '\n']
  out+= [pf,"stdflux:  ",sh3(    qo['stdflux']), '\n']
  out+= [pf,"delta:    ",sh3(    qo['delta']),   '\n']
  out+= [pf,"lane:     ",asciify(qo['lane']),    '\n']
  out+= [pf,"color:    ",asciify(qo['color']),   '\n']
  out+= [pf,"cntdn:    ",asciify(qo['cntdn']),   '\n']
  out+= [pf,"numpts:   ",asciify(qo['numpts']),  '\n']
  # proctm not needed, statsum is at the end
  out+= [pf,"lanesum:  ",asciify(qo['lanesum']), '\n']
  out+= [pf,"ratesum:  ",asciify(qo['ratesum']), '\n']
  out+= [pf,"limsum:   ",asciify(qo['limsum']),  '\n']
  out+= [pf,"deltasum: ",asciify(qo['deltasum']),'\n']
  out+= [pf,"graphsum: ",asciify(qo['graphsum']),'\n']
  out+= [pf,"headsum:  ",asciify(qo['headsum']), '\n']
  out+= [pf,"titlesum: ",asciify(qo['titlesum']),'\n']
  out+= [pf,"progsum:  ",asciify(qo['progsum']), '\n']
  out+= [pf,"rah:      ",sh3(    qo['rah']),     '\n']
  out+= [pf,"deltas:   "]
  if not qo['error']:
    dlttxt = ['{'+str(t)+', '+sh3(v-bb.rdf(bb.dayparse(t)))+'}'+', ' for (t,v,c) in data]
    dlttxt= ['{'+(''.join(x))[0:-2]+'}' for x in bb.partition(dlttxt,4,4)]
    dlttxt = riffle(dlttxt, '\n'+pf+ai)
    out+= dlttxt[0:-1]
    out+= '\n'
  else:
    out+= '['+qo['error']+']\n'

  # LEGACY OUTPUT PARAMS FOLLOW
  #out+= [pf,"bugshift: ",asciify(qo['bugshift']),'\n']
  out+= [pf,"safebuf:  ",asciify(qo['safebuf']), '\n']
  out+= [pf,"loser:    ",asciify(qo['loser']),   '\n']
  #print("DEBUG",repr(qo['tluz']),"<->",repr(bb.asof),"<->",repr(qo['tfin']))
  newloser = qo['tluz'] <  bb.asof and qo['tluz'] <= qo['tfin'] #py3...
  #if qo['tluz'] is None:  #py3 
  #  newloser = False
  #else:
  #  newloser = bb.dayparse(qo['tluz']) <  bb.asof and \
  #             bb.dayparse(qo['tluz']) <= bb.dayparse(qo['tfin']) #py3 dayparse
  out+= [pf,"newloser: ",asciify(newloser),      '\n']

  # FUNCTIONS OF OUTPUT PARAMS FOLLOW
  out+= [pf,"agg(tind):",sh3(aggval(bb.tini)),    '\n']
  out+= [pf,"agg(tcud):",sh3(aggval(qo['tdat'])),  '\n']
  out+= [pf,"all(tind):",shl(allvals(bb.tini)),   '\n']
  out+= [pf,"all(tcud):",shl(allvals(qo['tdat'])), '\n']

  out+= [pf,"rdf(tmin):",sh3(bb.rdf(bb.tmin)),     '\n']
  out+= [pf,"rdf(tini):",sh3(bb.rdf(qo['tini'])),  '\n']
  out+= [pf,"rdf(tind):",sh3(bb.rdf(bb.tini)),    '\n']
  out+= [pf,"rdf(tcur):",sh3(bb.rdf(qo['tcur'])),  '\n']
  out+= [pf,"rdf(tcud):",sh3(bb.rdf(qo['tdat'])),  '\n']
  out+= [pf,"rdf(tfin):",sh3(bb.rdf(qo['tfin'])),  '\n']
  out+= [pf,"rdf(tmax):",sh3(bb.rdf(bb.tmax)),     '\n']

  out+= [pf,"rtf(tmin):",sh3(bb.rtf(bb.tmin)),     '\n']
  out+= [pf,"rtf(tini):",sh3(bb.rtf(qo['tini'])),  '\n']
  out+= [pf,"rtf(tind):",sh3(bb.rtf(bb.tini)),    '\n']
  out+= [pf,"rtf(tcur):",sh3(bb.rtf(qo['tcur'])),  '\n']
  out+= [pf,"rtf(tcud):",sh3(bb.rtf(qo['tdat'])),  '\n']
  out+= [pf,"rtf(tfin):",sh3(bb.rtf(qo['tfin'])),  '\n']
  out+= [pf,"rtf(tmax):",sh3(bb.rtf(bb.tmax)),     '\n']

  out+= [pf,"lnf(tmin):",sh3(bb.lnf(bb.tmin)),     '\n']
  out+= [pf,"lnf(tini):",sh3(bb.lnf(bb.dayparse(qo['tini']))), '\n']
  out+= [pf,"lnf(tind):",sh3(bb.lnf(bb.tini)),    '\n']
  out+= [pf,"lnf(tcur):",sh3(bb.lnf(bb.dayparse(qo['tcur']))), '\n']
  out+= [pf,"lnf(tcud):",sh3(bb.lnf(bb.dayparse(qo['tdat']))), '\n']
  out+= [pf,"lnf(tfin):",sh3(bb.lnf(bb.dayparse(qo['tfin']))), '\n']
  out+= [pf,"lnf(tmax):",sh3(bb.lnf(bb.tmax)),     '\n']

  out+= [pf,"dtf(tmin):",sh3(bb.dtf(bb.tmin)),     '\n']
  out+= [pf,"dtf(tini):",sh3(bb.dtf(qo['tini'])),  '\n']
  out+= [pf,"dtf(tind):",sh3(bb.dtf(bb.tini)),    '\n']
  out+= [pf,"dtf(tcur):",sh3(bb.dtf(qo['tcur'])),  '\n']
  out+= [pf,"dtf(tcud):",sh3(bb.dtf(qo['tdat'])),  '\n']
  out+= [pf,"dtf(tfin):",sh3(bb.dtf(qo['tfin'])),  '\n']
  out+= [pf,"dtf(tmax):",sh3(bb.dtf(bb.tmax)),     '\n']

  out+= [pf,"aur(tmin):",sh3(bb.auraf(bb.tmin)),     '\n']
  out+= [pf,"aur(tini):",sh3(bb.auraf(qo['tini'])),  '\n']
  out+= [pf,"aur(tind):",sh3(bb.auraf(bb.tini)),    '\n']
  out+= [pf,"aur(tcur):",sh3(bb.auraf(qo['tcur'])),  '\n']
  out+= [pf,"aur(tcud):",sh3(bb.auraf(qo['tdat'])),  '\n']
  out+= [pf,"aur(tfin):",sh3(bb.auraf(qo['tfin'])),  '\n']
  out+= [pf,"aur(tmax):",sh3(bb.auraf(bb.tmax)),     '\n']

  # GLOBAL VARIABLES FOLLOW
  out+= [pf,"tmin:     ",shdl(    bb.tmin     ), '\n']
  out+= [pf,"tmax:     ",shdl(    bb.tmax     ), '\n']
  out+= [pf,"vmin:     ",sh3(     bb.vmin     ), '\n']
  out+= [pf,"vmax:     ",sh3(     bb.vmax     ), '\n']
  out+= [pf,"tini:     ",shdl(    bb.tini     ), '\n']
  out+= [pf,"vini:     ",sh3(     bb.vini     ), '\n']
  out+= [pf,"asof:     ",shdl(    bb.asof     ), '\n']
  out+= [pf,"nw:       ",sh3(     bb.nw       ), '\n']
  out+= [pf,"aurup:    ",sh3(     bb.aurup    ), '\n']
  out+= [pf,"aurdn:    ",sh3(     bb.aurdn    ), '\n']
  out+= [pf,"siru:     ",sh3(     bb.siru     ), '\n']

  out+= [pf,"statsum:  ",re.sub(r'\\n','\n'+pf+ai, qo['statsum'][0:-2]),'\n']
  return ''.join(out)

def sumup(n, t): return bb.splur(n,'file')+' in '+bb.shn(t, 2,1)+'s'

def fetchfiles():
  return sorted([f for f in os.listdir(dpath) if re.match('[^\\/]+\\.bb$',f)])

def flush(): sys.stdout.flush()

# Write the concatenation of the elements of l to f, showing progress
def spewlist(f, l, dot='o'):
  n = len(l) # number of elements to write to file
  pd = ceil(n/columns) # Progress Delta
  for i in range(n):
    if i % pd == 0: print(dot, sep='', end=''); flush()
    spewa(f, l[i])

# Print with an arrow at the end pointing at column n
def parrow(n, *stuff):
  pre = ''.join(stuff)
  print(pre,'-'*(n - len(pre) - 1),'>', sep='')

# Given n elements, how many dots will we print
def barn(n): return int(ceil(n/ceil(n/columns)))


# MAIN #########################################################################

if not os.path.exists(sanef):
  pre = 'No '+sanef+' file found; creating it '; print(pre, end=''); flush()
  files = fetchfiles()
  n = len(files)
  parrow(barn(n)-len(pre))
  start = time.time()
  pd = ceil(n/columns) # Progress Delta
  for i in range(n):
    if i % pd == 0: print('*', sep='', end=''); flush()
    spewa(sanef, serialize(dpath+'/'+files[i], start))
  end = time.time()
  print('\nCreated',sanef,'for',sumup(len(files), end-start))
  exit(1)

proctm = os.path.getmtime(sanef)
sanelode = [div+s for s in slurp(sanef).split(div)[1:]]
n1 = len(sanelode)
files = fetchfiles()
n2 = len(files)

if n1 != n2:
  print('THE NUMBER OF BB FILES CHANGED:', n1, '->', n2) 
  print('Delete', sanef, 'to start fresh w/ these', n2, 'files.')
  freak()
  exit(1)

pd = ceil(n2/columns) # Progress Delta
start = time.time()
for i in range(n2):
  if i % pd == 0: print('o', sep='', end=''); flush()
  newi = serialize(dpath+'/'+files[i], proctm)
  if sanelode[i] != newi:
    print('\nINSANE IN THE BEEBRAIN!  Difference in file', i+1, 'of', n2)
    freak()
    spew("sanechunk.txt", sanelode[i])
    spew("insanechunk.txt", newi)
    print('Created sanechunk.txt & insanechunk.txt.')
    parrow(barn(n2), 'Creating ',insanef,' for comparison with ',sanef,' ')
    flush()
    start = time.time()
    insanecount = 0
    icflag = False # Insane Chunk flag
    spew(insanef, '')  # initialize the insanity file to empty first
    spew("insanelist.txt", '')
    for j in range(n2):
      ffn = dpath+'/'+files[j] # full filename
      x = serialize(ffn, proctm)
      if x != sanelode[j]:
        insanecount += 1
        icflag = True
        spewa("insanelist.txt", "cp "+ffn+" insane"+str(insanecount)+".bb\n")
      if j % pd == 0: 
        print('!' if icflag else '.', sep='', end=''); flush()
        icflag = False
      spewa(insanef, x)

    end = time.time()
    print('\n',insanecount,"insane out of",sumup(n2, end-start),
          "(see insanelist.txt)")
    exit(1)
end = time.time()
print('\nSane! ', sumup(n2, end-start))
ahhhh()
