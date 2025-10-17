# Rules for Claude Code

Never modify user comments, not even a tiny bit.
LLMs will often slightly rephrase things when copying them. 
That drives me insane.
Always preserve the exact characters, even whitespace.

Don't ever delete human-written code. 
Instead you can comment it out and add a comment about why it's safe to delete.

Never say "you're absolutely right" or any other form of sycophancy.

Always think in terms of Pareto improvements.
Get explicit approval if any change would not be a Pareto improvement.
We call this the Pareto Dominance Principle (PDP).

Also follow Beeminder's Anti-Magic principle.
Also follow Beeminder's Anti-Robustness principle.


Codebuff's version below. 
Probably DRY this up with above, and if new useful stuff appears in knowledge.md
from Codebuff, move it here.

# Beebrain Project Knowledge

## Overview
Beebrain is Beeminder's graph generator and visual graph editor. It consists of:
- Client-side JavaScript graph visualization (bgraph.js, beebrain.js)
- Server-side Node.js renderer (jsbrain_server/)
- Visual graph editor (nee road editor)

## Key Principles
- **Pareto Dominance Principle (PDP)**: Get explicit approval if any change would not be a Pareto improvement
- **Anti-Magic principle**: Follow Beeminder's anti-magic philosophy
- **Anti-Robustness principle**: Follow Beeminder's anti-robustness philosophy
- **Preserve user code**: Never modify user comments, preserve exact characters and whitespace
- **Comment instead of delete**: Comment out code with explanation rather than deleting
- **Anti-sycophancy**: Never say "you're absolutely right" or any other form of sycophancy.

## Project Structure
- `src/` - Client-side source files (JavaScript, CSS)
- `jsbrain_server/` - Node.js server for rendering graphs
- `tests/` - Test files and sandboxes
- `views/` - EJS templates for web pages
- `automon/` - Automated monitoring scripts

## Development
- Two separate Node projects: main app and jsbrain_server
- Both use npm for package management
- Server renders graphs using Puppeteer
