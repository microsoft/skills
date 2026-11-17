# Operator configuration example

Most people don't need this file: `graph-playground` ([setup](standalone-setup.md)) writes it
for you and starts the Knowledge Graph Playground. Write it yourself only to run the launcher by hand.

Generate this file from what the machine has published, from your workspace folder:

```powershell
python -I "<installed plugin>\graph\runtime\bootstrap.py" run entity foundry-iq-workspace config
```

It reads only local published state (no Azure calls), includes each published domain, reports
why any other is skipped, and prints the launch command.

Keep operator JSON outside the installed plugin and source control. Configure
only the domains needed; this example enables all four:

```json
{
  "python": "C:\\operator\\python312\\python.exe",
  "cwd": "C:\\operator",
  "port": 0,
  "domains": {
    "ontology": {
      "scope": {
        "state_dir": "C:\\operator\\ontology-state",
        "version": 1
      },
      "env": {
        "SystemRoot": "C:\\Windows",
        "PYTHONIOENCODING": "utf-8",
        "PYTHONUTF8": "1"
      }
    },
    "entity": {
      "scope": {
        "descriptor_path": "C:\\operator\\published-entity.json"
      },
      "env": {
        "SystemRoot": "C:\\Windows",
        "PYTHONIOENCODING": "utf-8",
        "PYTHONUTF8": "1"
      },
      "timeoutMs": 120000
    },
    "topicgraph": {
      "scope": {
        "descriptor_path": "C:\\operator\\published-topicgraph.json",
        "endpoint": "https://approved-service.search.windows.net",
        "auth": "entra"
      },
      "env": {
        "SystemRoot": "C:\\Windows",
        "PYTHONIOENCODING": "utf-8",
        "PYTHONUTF8": "1"
      }
    },
    "grounding": {
      "scope": {
        "descriptor_path": "C:\\operator\\published-entity.json",
        "index": "approved-grounding-index",
        "endpoint": "https://approved-service.search.windows.net",
        "graph_name": "approved-graph"
      },
      "env": {
        "SystemRoot": "C:\\Windows",
        "PYTHONIOENCODING": "utf-8",
        "PYTHONUTF8": "1"
      }
    }
  }
}
```

Replace the example scope with verified local descriptors, ontology version,
index and graph name; the example is not evidence that these resources exist.
Grounding requires an absolute `descriptor_path` or a nonempty `index`.
Its `index`, HTTPS service-origin `endpoint` and `graph_name`, when supplied,
are fixed bootstrap flags and MCP tool scope. `descriptor_path` is fixed MCP
tool scope only, not a grounding `--descriptor` launch flag.

[Prerequisites and setup](standalone-setup.md) | [Launch](standalone-launch.md)
