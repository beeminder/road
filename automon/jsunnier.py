#!/usr/bin/env python3
# Reformat a bb file to be more human-parsable but still compact.
# Usage: ./jsunnier.py input.bb > output.bb
# HT GPT-5

import sys, json

ORDER = [
"yoog","gunits","yaxis","runits",
"kyoom","odom",
"yaw","dir",
"hashtags",
"rosy","steppy","movingav","aura",
"deadline","aggday",
"tmin","plotall","monotone",
"hidey",
"quantum","timey","ppr",
"waterbux",
"timezone",
"asof",
"tini","vini","road","tfin","vfin","rfin",
"stathead",
]

def readit():
  if len(sys.argv) > 1 and sys.argv[1] != "-":
    with open(sys.argv[1], "r", encoding="utf-8") as f: return f.read()
  return sys.stdin.read()

def dumpit(x):
  # No spaces after separators; keep inner arrays on one line.
  return json.dumps(x, ensure_ascii=False, separators=(",", ":"))

raw = readit().strip()
obj = json.loads(raw)

params = obj.get("params", {})
data   = obj.get("data",   [])

# Build ordered list of param keys: specified ORDER first, then any extras in 
# original order.
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

out.append("]}")

sys.stdout.write("\n".join(out))
