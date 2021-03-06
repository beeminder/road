# Beebrain Museum

Most of the Python implementation is in blib.py.
Most of the Mathematica implementation is in beemlib.m

The rest of this file is utterly out of date!

## Old stuff from when Pybrain was in production

See http://doc.bmndr.com/beebrain for Beebrain documentation.

The core of Beebrain is beebrain.py which takes a .bb file (containing
json-encoded goal parameters and data) and writes a .json file with goal stats
and links to the graph image and thumbnail image.

Deploying:
  ./bbdeploy.sh

Fetching data for testing:
  ./zipsuite.py

Continuous Testing:
  watching blib.py sanity.py sanity.txt do ./sanity.py
  watching beebrain.py blib.py suite.sh do ./suite.sh
  watching blib.py beebrain.py test.bb do ./beebrain.py test.bb and open -g test.png

Note: That "open -g" is a macOS thing that keeps the image fresh in the 
background using Preview.app but annoyingly opens a new instance of the image 
each time.
Here's a version that will refresh the image in the background without opening
a new instance but, even more annoyingly, makes it steal focus:
  watching blib.py beebrain.py test.bb do ./beebrain.py test.bb and osascript -e \"tell application \\\"Preview\\\" to activate\"

Viewing images generated from test suite: (do rm data/*.png for test suite)
  open -g data/*.png



NO LONGER USED: -------------------------------------------------------

The daemon (daemon.pl and daemonguts.pl) watches for .bb files appearing in the
nonce directory and calls beebrain.py to generate the corresponding .json
files, queueing them if more than one changes at once.

The actual webservice for Beebrain is implemented in beebrain.php which accepts
the goal parameters and data, writes the .bb file, and lets the daemon notice
and generate the corresponding .json, which it then spits back.
The php wrapper is not currently used by Beeminder though. Instead there's an
undocumented api endpoint, /beebrain, that implements the same thing as the php
wrapper.
