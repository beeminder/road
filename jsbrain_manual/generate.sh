#!/bin/sh

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 BASE PATH" >&2
  exit 1
fi

BASE=$2"/"$1
BBFILE=$BASE".bb"
PNGFILE=$1".png"
SVGFILE=$1".svg"
URL="file://"$BBFILE

if ! [ -f "$BBFILE" ]; then
  echo "Could not find file $BBFILE" >&2
  exit 1
fi

echo Processing file://${PWD}/generate.html?bb="$URL"

chromium-browser --virtual-time-budget=60000 --allow-file-access-from-files --disable-web-security --headless --deterministic-fetch --disable-gpu --no-sandbox --dump-dom file://${PWD}/generate.html?bb="$URL" > output.txt

sed -n -e 's/.*<body>\(.*\)<\/body>.*/\1/p' < output.txt > $SVGFILE
rm output.txt

chromium-browser --allow-file-access-from-files --disable-web-security --headless --deterministic-fetch --disable-gpu --no-sandbox --window-size=710,460 --screenshot file://${PWD}/$SVGFILE
mv screenshot.png $PNGFILE
