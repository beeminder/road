#!/usr/bin/env python3
# Command-line interface to Beebrain.
# Takes a bb file as the only argument and runs it through the Beebrain server
# running locally (by default on port 8777). Puts the .png and .json and the 
# thumbnail in the same directory as the bb file.

from sys import argv
import os, re
from urllib.parse import quote_plus

BBURL = "http://localhost:8777/"

if len(argv) != 2: print(f"USAGE: {argv[0]} BBFILE")
# (might be handy to do this for all bbfiles provided if more than one)
bbf = argv[1]
if not os.path.isfile(bbf): print('Not a beebrain file:',bbf); exit(1)

m = re.match(r"""(.*?)     # path: everything up to the last slash
                 ([^\/]+)  # slug: everything between last slash and '.bb'
                 \.bb$""", bbf, re.X)
if m == None: print('ERROR:', bbf, 'not a bbfile!'); exit(1)
path  = m.group(1)  # eg, "path/to/data/"
slug  = m.group(2)  # eg, "alice+foo"

#print(   f'curl "{BBURL}?slug={quote_plus(slug)}&inpath=`pwd`/{path}"')
os.system(f'curl "{BBURL}?slug={quote_plus(slug)}&inpath=`pwd`/{path}"')
print() # curl's output doesn't end in a newline so, you're welcome 
os.system(f'open {path}{slug}.png') # this might only work on macs?

