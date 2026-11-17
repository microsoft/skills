# Scope, environment and launch

Before launch:

- Replace paths, published descriptors and the service origin with the approved
  installation and data scope.
- Set each domain's `env` explicitly, with only the required feed/authentication entries.
  The official stdio SDK adds its small safe platform baseline, not inherited
  `PYTHONPATH`, TopicGraph defaults or provider secrets.
- `cwd` defaults to the operator JSON's directory. An explicit `cwd` must be an
  existing absolute directory outside the installed plugin, including after
  resolving symbolic links.
- Keep config, caches and mutable state outside the installed payload. Runtime
  bootstrap owns dependency verification and environment selection.
- TopicGraph permits an optional explicit `tenant_id`, but not query-key auth or
  test-only `documents`.
- Existing authentication must already be available; launch does not sign in or
  change any tenant.

```powershell
& 'C:\operator\node22\node.exe' `
  'C:\installed plugin\graph\apps-host\launch.mjs' `
  --config 'C:\operator\knowledge-apps.json'
```

The launcher resolves its parent plugin and these exact installed entries:

| Domain | Bootstrap domain | Apps entry and fixed flags |
|---|---|---|
| Ontology | `ontology` | `ontology-apps --state-dir <fixed>` |
| Entity Graph | `entity` | `entity-apps --descriptor <fixed>` |
| TopicGraph | `topicgraph` | `topicgraph-mcp --descriptor <fixed> --endpoint <fixed> --auth entra` |
| Grounding | `grounding` | `grounding-apps` with supplied `--index`, `--endpoint`, `--graph-name` |

Grounding accepts fixed `descriptor_path`, `index`, `endpoint` and `graph_name`
tool scope. Its descriptor path is not a startup flag; supplied index, endpoint
and graph name are also passed to the Apps entry. See the
[four-domain example](standalone-configuration.md) for descriptor/index requirements.

An ontology version is pinned in every advertised tool that accepts `version`;
the state directory itself is fixed on server startup. Browser arguments cannot
change paths, endpoints, credentials, process commands, environment or version.
The customer config cannot supply arbitrary executable/argument bindings.
On macOS/Linux use native absolute paths (for example `/usr/bin/python3`
and `/home/operator/...`), not the Windows example paths.
The same Node launcher and installed relative payload are used on all platforms.

## L1 topic diversity in Why Graph

The **Topic diversity** select at the end of the **Try:** row applies to the next comparison.
See [defaults, native setup prerequisites and request behavior](standalone-topic-diversity.md).

[Prerequisites and setup](standalone-setup.md)
