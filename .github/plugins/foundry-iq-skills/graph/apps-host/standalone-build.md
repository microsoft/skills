# Contributor build and immutable export

Consumers do not run these commands. Contributors use the existing pinned
toolchain and approved npm feed; on Windows set `GRAPH_TEST_PYTHON` to an existing
Python 3.12, 3.13 or 3.14 executable when needed by supervision tests.

```powershell
npm run typecheck
npm run build:embedded
npm run build:standalone
npm run test:standalone
npm run test:standalone:browser
npm run package:standalone
```

`package:standalone` builds and exports `dist\apps-host`, not a separate ZIP:

```text
apps-host/
  launch.mjs
  connector.mjs
  supervise.py
  README.md
  standalone-*.md
  CONNECTOR_THIRD_PARTY_NOTICES.txt
  payload-provenance.json
  ui/
    standalone.html
    sandbox.html
    assets/*
    THIRD_PARTY_NOTICES.txt
    build-provenance.json
    apps/
      ontology/
        ontology.html
        evidence.html
        assets/*
        THIRD_PARTY_NOTICES.txt
        asset-manifest.json
      entity/     (graph.html, evidence.html, assets, notices, manifest)
      topicgraph/ (explorer.html, evidence.html, assets, notices, manifest)
      grounding/  (explorer.html, assets, notices, manifest)
```

The export requires clean committed source for this directory (`git status --porcelain -- .`
is empty and `git rev-parse HEAD:./` resolves) and exact lock/output hashes. Payload
provenance binds every file except itself using relative paths and raw lowercase
SHA-256, with source identity (`sourceCommit`, `sourceTree`, `sourceDirty`), Node, SDK and lockfile versions.
`sourceTree` is the committed tree id of this directory, so it survives squash or rebase merges of a
larger repository; `sourceCommit` is informational. Development builds of uncommitted source record
`sourceTree: null` with `sourceDirty: true` and cannot be exported. The host
README index and every linked standalone guide page are copied from the canonical docs and included in that file map. The plugin
packager must preserve the complete variable emitted tree, not a fixed file count.
Run `build:embedded` before the localhost build to bind the seven localhost
resource hashes. Embedded single-file files and their existing runtime contract
remain separate from this localhost payload. The plugin
packager preserves those bytes and independently binds the provenance in its
final plugin digest. No npm dependencies, fixtures, credentials, source maps,
developer checkout or additional wrapper/client are needed at customer runtime.

Dependency versions remain pinned in the root lock.

## Live Knowledge Graph Playground test

`npm run test:standalone:live` drives an installed plugin's Knowledge Graph Playground end to end against
the graphs published on this machine. It is read-only: it generates the config with
`foundry-iq-workspace config`, starts `graph/apps-host/launch.mjs`, checks the server's origin and
token guards, exercises every tab in Chromium, then quits and verifies every owned process
exited and the port was released. Set `ENTITY_HOME`, `TOPICGRAPH_HOME`, `ONTOLOGY_HOME`
and `GROUNDING_HOME` as for the skills. `FIQ_PLUGIN_ROOT` (required) is the installed plugin
folder, `FIQ_OUT` the report folder, and `FIQ_ENTITY_QUERY`,
`FIQ_ASK_QUESTION`, `FIQ_ONTOLOGY_CLASS`, `FIQ_COMPARE_QUESTION` the inputs;
`FIQ_SKIP_COMPARE=1` skips **Why use a graph?**. It writes `report.md`, `report.json`, screenshots and
the launcher log, and exits nonzero on any failed check.

[Prerequisites and setup](standalone-setup.md) | [Launch](standalone-launch.md)
