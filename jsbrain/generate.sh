#!/bin/sh

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 FILENAME" >&2
  exit 1
fi

if ! [ -f "$1" ]; then
  echo "Could not find file $1" >&2
  exit 1
fi

echo Processing file://${PWD}/generate.html?bb="$1"

chromium-browser --virtual-time-budget=60000 --allow-file-access-from-files --disable-web-security --headless --deterministic-fetch --disable-gpu --no-sandbox --dump-dom file://${PWD}/generate.html?bb="$1" > output.txt

sed -n -e 's/.*<body>\(.*\)<\/body>.*/\1/p' < output.txt > output.svg
rm output.txt

#chromium-browser --allow-file-access-from-files --disable-web-security --headless --deterministic-fetch --disable-gpu --no-sandbox --window-size=710,460 --screenshot file://${PWD}/output.svg
