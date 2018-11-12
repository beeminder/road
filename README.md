## Javascript implementation of Beebrain and an Interactive Road Editor

This is a Javascript package that implements Beebrain functionality,
in addition to an interactive editor for Beeminder roads. The same
library (ideally) will be usable both on the client and server sides
for graph generation. The interactive editing is only available on the
browser client side. 

## Dev environment notes

Uluc recommends Indium for Emacs.

Uluc runs chromium with the following for local debugging:

`chromium-browser --allow-file-access-from-files --disable-web-security --user-data-dir=~/user-data --remote-debugging-port=9222&`

Allows scripts to open local files etc.

