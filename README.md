## Javascript implementation of Beebrain and an Interactive Road Editor

This repository includes Javascript packages implementing Beebrain
functionality and an interactive editor for Beeminder roads. The same
functionality can be used both on the client and on a node server
through a headless chrome instance.

pub : Includes implementations for javascript beebrain packages.

butil.js : Various utility functions for beebrain
  broad.js : Road related utility functions
  beebrain.js : Beebrain core functionality
  bgraph.js : Graph generation, road table and road editor functionality

jsbrain_server : node server for graph png and svg generation

  Running 'node index' starts up a server on localhost:3000, which
  performs graph generation when supplied with arguments
  '?base=nonce&path=/path/to/file'

jsbrain_manual : script for generating graph and json using headless chrome

  Run 'generate.sh base path' to generate base.png, base.svg and base.json

Testing on chrome:

chromium-browser --allow-file-access-from-files --disable-web-security --user-data-dir=~/user-data --remote-debugging-port=9222 --single-process&

Emacs environment:
- indium works well
- sr-speedbar is docked
- imenu requires *rescan* from the top menu
- M-x indium-connect connects to a running chrom instance configured in the .indium file
- Had to rename menu names in js2 and indium el files to shorten their names
- purpose-mode is useful to keep windows with what they are for
- For development, the following fonts seem to be good options:
  Hack: https://github.com/source-foundry/Hack
  OfficeCodePro: https://github.com/nathco/Office-Code-Pro
  Font rendering: https://wiki.manjaro.org/index.php?title=Improve_Font_Rendering