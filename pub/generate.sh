#!/bin/sh
google-chrome --allow-file-access-from-files --disable-web-security --headless --deterministic-fetch --disable-gpu --no-sandbox --dump-dom file:///home/saranli/Research/Projects/road/pub/generate.html > output.svg

google-chrome --allow-file-access-from-files --disable-web-security --headless --deterministic-fetch --disable-gpu --no-sandbox --window-size=710,460 --screenshot file:///home/saranli/Research/Projects/road/pub/output.svg
