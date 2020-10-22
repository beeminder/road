#!/usr/bin/env python
# Command-line interface to Beebrain. 
# The php wrapper (now Rails api endpoint) writes a .bb file which the daemon 
# notices and calls this script with. 
# This script writes a corresponding .json file which should happen almost 
# immediately and then writes the .png files for the graph and the thumbnail
# when they're done generating, a couple seconds later.
# To avoid the images being fetched when partially rendered, we generate them
# as temp files and then copy them to their proper file names when finished.
# Finally, if the slug has the special prefix "NOGRAPH_" then we don't generate
# the graph image or thumbnail.

from __future__ import print_function #py3
import time; starttm = time.time() # timstamp that beebrain was called #########
import sys, os, re, json
import blib as bb
#import mpld3

BBURL = "http://brain.beeminder.com/"

# Whether it's a special slug indicating we shouldn't actually draw the graph
def nograph(slug): return re.match('NOGRAPH_', slug)

if len(sys.argv) < 2: print('USAGE:', sys.argv[0], 'bbfile'); exit(1)

print('<BEEBRAIN> ', end=''); sys.stdout.flush()

os.umask(0) # write files sluttily; unix file permissions can (and do) bite me.

bbfile = sys.argv[1]                       # Verify and decompose BB filename...
if not os.path.isfile(bbfile): print('Not a beebrain file:',bbfile); exit(1)

m = re.match(r"""(.*?)     # base: everything up to the last slash
                 ([^\/]+)  # slug: everything between last slash and '.bb'
                 \.bb$""", bbfile, re.X)
if m == None: print('ERROR:', bbfile, 'not a bbfile!'); exit(1)
base  = m.group(1)
slug  = m.group(2)  # typically like "alice+foo+nonce"
sluga = re.sub("^([^\+]*\+[^\+]*).*", r'\1', slug) # slug, abbreviated

print('{} @ {}'.format(sluga, bb.shdt(starttm)))
imgf = base + ("NOGRAPH" if nograph(slug) else slug) + '.png'
thmf = base + ("NOGRAPH" if nograph(slug) else slug) + '-thumb.png'
#d3f  = base + ("NOGRAPH" if nograph(slug) else slug) + '-d3.json'
# generate the graph unless both nograph(slug) and nograph.png already exists
graphit = not(nograph(slug) and os.path.exists(imgf) and os.path.exists(thmf))
if graphit:
  imgftmp = bb.tempify(imgf)                   # Make sure the images 404
  thmftmp = bb.tempify(thmf)                   #   until they're ready...
  #d3ftmp  = bb.tempify(d3f)
  #if os.path.exists(imgf): os.rename(imgf, imgftmp) # SCHDEL: this confused
  #if os.path.exists(thmf): os.rename(thmf, thmftmp) # Preview.app in devel for
  if os.path.exists(imgf): os.remove(imgf)           # me and shouldn't matter
  if os.path.exists(thmf): os.remove(thmf)           # if you remove vs rename
  #if os.path.exists(d3f):  os.remove(d3f)

try:               j = json.load(open(bbfile))    # parse .bb file
except ValueError: print("Couldn't parse",bbfile,"as JSON; aborting!"); exit(1)
# if generating the NOGRAPH graph, set yoog=NOGRAPH so beebrain knows to make it
if nograph(slug) and graphit: j['params']['yoog'] = "NOGRAPH"
stats = bb.genStats(j['params'], j['data'])       # compute the stats
proctm = stats['proctm']
statstm = time.time()                             # done generating stats ######
print(re.sub(r'\\n', '\n', stats['statsum']), sep='', end='')
stats["graphurl"] = BBURL+imgf
stats["thumburl"] = BBURL+thmf
jf = base+slug+'.json'                           # write .json to a temp file
jtmp = bb.tempify(jf)                            #   first, otherwise we could
if os.path.exists(jf): os.rename(jf, jtmp)       #   end up trying to read it
json.dump(stats, open(jtmp, 'w'))                #   before it's completely 
os.rename(jtmp, jf)                              #   written.

if graphit: 
  bb.genGraph()                        # generate the graph
  
  #mpld3.show()
  #json.dump(mpld3.fig_to_dict(bb.plt.gcf()), open(d3ftmp, 'w'))
  #os.rename(d3ftmp, d3f)

graphtm = time.time()                            # done generating the graph ###
if graphit:
  bb.genImage(imgftmp); os.rename(imgftmp, imgf) # write the image file
  bb.genThumb(thmftmp); os.rename(thmftmp, thmf) # write the thumb file

donetm = time.time()                             # done generating the images ##
tottime = donetm - proctm
print("</BEEBRAIN> ", bb.shn(proctm -starttm, 1,3), " load + ", \
                      bb.shn(statstm-proctm,  1,3), " stats + ", \
                      bb.shn(graphtm-statstm, 1,3), " graph + ", \
                      bb.shn(donetm -graphtm, 1,3), " images = ", \
                      bb.shn(donetm -starttm, 1,3), "s", sep='')
