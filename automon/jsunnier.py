#!/usr/bin/env python3
# Reformat a bb file to be more human-parsable but still compact.
# Usage: ./jsunnier.py input.bb
# Modifies the file in place and creates a backup at input.bb.bak
# HT GPT-5 and Claude Code

import sys, json, shutil

ORDER = [
"yoog","gunits","yaxis",
"kyoom","odom",
"yaw","dir",
"hashtags",
"rosy","steppy","movingav","aura",
"maxflux",
"deadline","aggday",
"tmin","tmax","vmin","vmax",
"plotall","monotone",
"hidey",
"quantum","timey","ppr",
"waterbux",
"timezone",
"asof",
"runits",
"tini","vini","road","tfin","vfin","rfin",
"stathead",
]

# Read from file or stdin. Not currently used. Use like: raw = readit().strip()
def readit():
  if len(sys.argv) > 1 and sys.argv[1] != "-":
    with open(sys.argv[1], "r", encoding="utf-8") as f: return f.read()
  return sys.stdin.read()

def dumpit(x):
  # No spaces after separators; keep inner arrays on one line.
  return json.dumps(x, ensure_ascii=False, separators=(",", ":"))

def usage():
  print("Usage: jsunnier.py FILE")
  print("Reformats a bb JSON file to be more human-parsable but still compact.")
  print("Modifies FILE in place and creates a backup at FILE.bak")
  sys.exit(1)

if len(sys.argv) != 2: usage()
filename = sys.argv[1]
try:
  with open(filename, "r", encoding="utf-8") as f: raw = f.read().strip()
except FileNotFoundError:
  print(f"Error: File '{filename}' not found", file=sys.stderr)
  sys.exit(1)
except Exception as e:
  print(f"Error reading file: {e}", file=sys.stderr)
  sys.exit(1)

try:
  obj = json.loads(raw) # parse the JSON or die trying
except json.JSONDecodeError as e:
  print(f"Error! File is not valid JSON: {e}", file=sys.stderr)
  sys.exit(1)

# If the JSON doesn't have the expected structure, leave it alone and abort
if (not isinstance(obj, dict) or "params" not in obj or "data" not in obj or
    not isinstance(obj["params"], dict) or not isinstance(obj["data"], list)):
  print(f"Error! Not a bb file? Expected 'params' dict, 'data' list. Aborting.",
        file=sys.stderr)
  sys.exit(0)

params = obj["params"]
data   = obj["data"]

# Build ordered list of param keys: specified ORDER first, then any extras in
# their original order.
extras = [k for k in params.keys() if k not in ORDER]
keys   = [k for k in ORDER         if k     in params] + extras

out = []
out.append('{"params":{')

# Emit params (special-case "road" to keep each waypoint on a single line)
for i, k in enumerate(keys):
  v = params[k]
  if k == "road" and isinstance(v, list):
    out.append(f'"{k}":[')
    out.extend(dumpit(x) + ("," if j<len(v)-1 else "") for j, x in enumerate(v))
    out.append("]" + ("," if i < len(keys)-1 else ""))
  else:
    out.append(f'"{k}":{dumpit(v)}' + ("," if i < len(keys)-1 else ""))

out.append("},")
out.append('"data":[')

# Each datapoint on its own line, inner array on one line
for i, row in enumerate(data):
  out.append(dumpit(row) + ("," if i < len(data)-1 else ""))

out.append("]}\n")
formatted = "\n".join(out)

backup_filename = filename + ".bak"      # safety net just in case we mess it up
shutil.copy2(filename, backup_filename)

# Write the formatted output back to the original file
try:
  with open(filename, "w", encoding="utf-8") as f: f.write(formatted)
  print(f"Formatted {filename} (backup saved to {backup_filename})")
except Exception as e:
  print(f"Error writing file: {e}", file=sys.stderr)
  sys.exit(1)
