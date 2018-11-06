## Javascript implementation of Beebrain and an Interactive Road Editor

This is a Javascript package that implements Beebrain functionality,
in addition to an interactive editor for Beeminder roads. The same
library (ideally) will be usable both on the client and server sides
for graph generation. The interactive editing is only available on the
browser client side. 

Testing on chrome:

chromium-browser --allow-file-access-from-files --disable-web-security --user-data-dir=~/user-data --remote-debugging-port=9222&

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