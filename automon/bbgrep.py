#!/usr/bin/env python3

import sys, os, json

# Main entry point for Automon. Parse command line arguments, set appropriate
# fields and flags, and invoke the curses wrapper with the function monitor().
def main(argv):

    bbparam = argv[0]

    for f in argv[1:]:
        base = os.path.basename(f)
        ext = os.path.splitext(base)[1]
        if (ext != ".bb"): continue 
        with open(f, 'r') as myfile: 
            bb = json.loads(myfile.read())
            params = bb["params"]
            if (bbparam in params) :
                print(base+": "+bbparam+"="+str(params[bbparam]))

    # Make sure we only execute main in the top level environment
if __name__ == "__main__":
    main(sys.argv[1:])
