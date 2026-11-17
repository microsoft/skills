# Prerequisites and runtime setup

## The one command

From your workspace folder:

```powershell
python -I "<installed plugin>\graph\runtime\bootstrap.py" run entity graph-playground
```

It finds what this machine has published, a Node.js 22.13+ (on PATH, then from nvm, fnm or
Volta) and a supported Python (3.12, 3.13 or 3.14), writes its config to its own state folder (not your
workspace), starts the Knowledge Graph Playground in the background, opens your browser and prints the
link. `graph-playground stop` closes it. If Node.js is missing it says, in one line, what to
install. The rest of this page is for operators who manage runtimes and the config by hand.

## Manual setup

The launcher implements Windows, macOS and Linux process ownership; macOS is
untested. Windows requires Windows 10 / Server 2016 or later.
Use an explicit Node 22.13+ executable (development verification: 22.19.0)
and an existing Python 3.12, 3.13 or 3.14 executable. Configure `python` as an absolute path;
the same executable runs the runtime bootstrap and, by default, the process
supervisor. An optional absolute `supervisorPython` overrides the latter.
See [process ownership and isolation](standalone-isolation.md).

Complete runtime setup explicitly using your configured Python package sources.
From an operator directory outside the installed plugin, run these commands for
each configured domain (all four are shown):

```powershell
& 'C:\operator\python312\python.exe' -I 'C:\installed plugin\graph\runtime\bootstrap.py' setup ontology
& 'C:\operator\python312\python.exe' -I 'C:\installed plugin\graph\runtime\bootstrap.py' setup entity
& 'C:\operator\python312\python.exe' -I 'C:\installed plugin\graph\runtime\bootstrap.py' setup topicgraph
& 'C:\operator\python312\python.exe' -I 'C:\installed plugin\graph\runtime\bootstrap.py' setup grounding
& 'C:\operator\python312\python.exe' -I 'C:\installed plugin\graph\runtime\bootstrap.py' status ontology
& 'C:\operator\python312\python.exe' -I 'C:\installed plugin\graph\runtime\bootstrap.py' status entity
& 'C:\operator\python312\python.exe' -I 'C:\installed plugin\graph\runtime\bootstrap.py' status topicgraph
& 'C:\operator\python312\python.exe' -I 'C:\installed plugin\graph\runtime\bootstrap.py' status grounding
```

Bootstrap setup prepares an environment keyed to the Python version and platform
and verifies the artifact and complete hashed dependency lock. It uses configured
pip sources; do not alter global package settings. Normal launch uses only
`python -I <plugin>\graph\runtime\bootstrap.py run <domain> <console-entry-point> [args...]`.
`-I` ignores inherited `PYTHONPATH` and user site packages.
Warm runs never install dependencies. Missing or invalid setup fails explicitly;
the host does not install packages or silently choose another runtime. Do not
use a development checkout or an unrelated console script.

[Launch](standalone-launch.md)
