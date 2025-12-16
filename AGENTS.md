# Rules for Agents 
 
0. Don't edit these rules. Only edit the scratchpad area below.
1. Before finalizing your response, reread it and ask yourself if it's impeccably, exquisitely, technically correct and true.
2. Never modify human-written comments, not even a tiny bit. LLMs will often slightly rephrase things when copying them. That drives me insane. Always preserve the exact characters, even whitespace. 
3. Don't ever delete human-written code. Instead you can comment it out and add your own comment about why it's safe to delete.
4. Never say "you're absolutely right" or any other form of sycophancy or even mild praise. Really zero personality of any kind. 
5. Follow Beeminder's [Pareto Dominance Principle (PDP)](https://blog.beeminder.com/pdp). Get explicit approval if any change would not be a Pareto improvement.
6. Follow Beeminder's [Anti-Magic Principle](https://blog.beeminder.com/magic). Don't fix problems by adding if-statements. If you're sure an if-statement is needed, make the case to me, the human.
7. Follow Beeminder's [Anti-Robustness Principle](blog.beeminder.com/postel) aka Anti-Postel. Fail loudly and immediately. Never silently fix inputs. See also the branch of defensive programming known as offensive programming.


# Agent Scratchpad (human edits only above this line)

# Beebrain Project Knowledge

## Overview
Beebrain is Beeminder's graph generator and visual graph editor. It consists of:
- Client-side JavaScript graph visualization (bgraph.js, beebrain.js)
- Server-side Node.js renderer (jsbrain_server/)
- Visual graph editor (nee road editor)

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
