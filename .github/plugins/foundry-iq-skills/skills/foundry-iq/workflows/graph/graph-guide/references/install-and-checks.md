# Install and checks

Check only the chosen route. Setup makes no Azure/model calls.
Meta skills never authenticate, change global configuration or start Apps.

## Plugin and CLIs

Resolve the plugin root from your harness. Bootstrap auto-discovers local Python 3.12, 3.13 or 3.14
(newest first) with standard `venv`/`pip`; it never installs Python. Set `FOUNDRY_IQ_PYTHON`
to an absolute executable to override the recorded binding or discovery.
No global install, PATH or system/project environment changes.

Run setup directly for the user for the chosen domain: `entity`, `topicgraph`, `ontology` or `grounding`.
For example:

```text
python -I "<package-root>\graph\runtime\bootstrap.py" setup entity
```

Setup verifies wheel/lock hashes and installs into a plugin-owned external cache using
configured package sources. Supported: Windows x64, Linux x64/ARM64 and macOS Apple Silicon.

The cache defaults to `%LOCALAPPDATA%\foundry-iq-skills\runtimes` on Windows and
`~/.cache/foundry-iq-skills/runtimes` elsewhere. In a sandboxed harness (for example Codex
workspace-write), pick a cache inside the declared writable roots: a private subfolder of the temp
folder, or a workspace folder that git ignores (never inside the plugin). Pass its absolute path as
`FOUNDRY_IQ_RUNTIME_CACHE` on every bootstrap command. Don't ask for broader permissions. If you set
nothing and the home folder isn't writable, the runtime uses a private per-user temp folder by itself
and prints one `Foundry IQ:` note naming it; state folders fall back the same way.

Use the owning skill's entrypoint after `run DOMAIN`, for example:

```text
python -I "<package-root>\graph\runtime\bootstrap.py" run entity entity-graph-build --help
python -I "<package-root>\graph\runtime\bootstrap.py" status entity
```

Bare CLI names mean this prefix, not global commands. Use native path separators.
Warm run/status never install, resolve or repair; missing/changed files fail explicitly.
Cold run/status auto-prepare an absent isolated cache on first launch or wheel update.
The demo runs `python -I "<package-root>\graph\runtime\preflight.py"` first; see [demo checks](../../graph-demo/references/install-and-checks.md).
Re-run setup after changing `FOUNDRY_IQ_PYTHON`.

## Read-only checks

Help proves entrypoint availability, not Azure readiness; use the owning skill's checks.
No universal `--json` or offline doctor: domain checks can read Azure/call models.
Grounding includes Parquet; ontology setup builds nothing. Preparing a missing runtime cache
on first use is expected and does not break read-only; mention it only if asked.

## Missing prerequisites

Doctor `next_step` text is written for one domain. When Azure checks are skipped or blocked,
including after `ready: true`, say what is missing in plain words, name the skill that
creates it and offer to run it. Never show raw flags, `<placeholders>`, IDs, token prices
or internal terms (descriptor, sidecar, chunk vectors, topic builder) as the next step.
Create the Entity Graph without an ontology first; the ontology is attached later. Chain order:

1. No Search service, model deployments or Entity Graph index: `entity-graph-provision`, then `entity-graph-build`
   with no ontology yet (Search only chunks and embeds).
2. No Topic Graph topics: `topic-graph-build` on that Entity Graph index and Search service,
   after its build verifies. Topic browsing needs it published; an ontology needs only its build output folder.
3. No ontology: `ontology-build` on that Topic Graph build output folder, with read access to the
   original source index, reusing the Entity Graph chat deployment; ask for token prices only then.
   Then `entity-graph-build` attaches it (or the built-in `schema_org` if the user wants no custom one).
4. Grounding: `grounding-provision connect` to the Entity Graph's Search service; create one only
   when no Entity Graph exists.

`ready: true` covers local checks only; report Azure readiness as not yet checked. End with
one start-here step: the first missing skill in this order, usually `entity-graph-provision`.

## Optional Apps

Apps use the official MCP SDK. Entity/Topic Graph are registered; ontology and grounding use explicit
launches. Bind ontology state or grounding index/endpoint/graph to the approved scope.
Use the same prefix; an absent runtime is prepared automatically.

Generated servers start `node <plugin-root>/graph/runtime/launch-python.mjs`, running bootstrap with
the first working `python3.14` … `python3.12`, `python3`, `python` or `py`; if none, set
`FOUNDRY_IQ_PYTHON` to an absolute Python 3.12, 3.13 or 3.14. Explicit launches use the same `node` command; `args`: absolute launcher
path, `run`, domain, entrypoint, scope flags:

| Domain | Entry point and scope |
|---|---|
| Ontology | `run ontology ontology-apps --state-dir <absolute-state-directory>` |
| Entity Graph | `run entity entity-graph-apps --descriptor <absolute-descriptor-path>` |
| Topic Graph | `run topicgraph topicgraph-mcp --descriptor <absolute-descriptor-path> --endpoint <search-endpoint> --auth entra` |
| Grounding | `run grounding grounding-apps --index <grounding-index> --endpoint <search-endpoint> --graph-name <graph-name>` |

## Graph Playground

The Graph Playground is a local, read-only browser page with Why Graph, Entities and Topics views; an
unpublished view shows how to set it up. Packaged `graph/apps-host/launch.mjs` verifies
Entity Graph/Topic Graph/ontology/grounding MCP resources before choosing renderers. It needs no
checkout, npm install or frontend build; no direct-CLI browser fallback. See
`graph/apps-host/README.md` in the installed plugin.

Offer it once, in one sentence, after a verified publish or a cited answer; don't offer again
after a no. On yes (in the guided demo, without asking), run from the user's workspace folder:

```text
python -I "<package-root>\graph\runtime\bootstrap.py" run entity graph-playground --json
```

It finds the published state, a Node.js 22.13+ and the plugin's own Python, starts the Playground
in the background, opens the browser and returns `url` and a one-line `summary`; say the summary as-is.
Keep the whole `url`, including the part after `#`: it's this launch's key, and the page won't load without it.
`graph-playground stop` closes it. Never look for Node, write a config, set `*_HOME` variables or
start `launch.mjs` yourself. On `NODE_REQUIRED` or `PLAYGROUND_FAILED`, say the one-line `error`
and follow `next_step`. After a new publish, run `graph-playground stop`, then `graph-playground`.
Treat historical CLI receipts as evidence only, not host acceptance.

## Tenant and approvals

Name the tenant by display name before Azure sign-in. Never print or commit tenant or subscription IDs, keys or tokens.
Plain language never bypasses exact-plan approval. At every write gate:

- Show only the runtime's approval card, verbatim; never write or paraphrase your own approval text, and never promise behavior (such as copy/no-copy or identity mode) the plan does not state.
- Ask one Approve/Stop question; never ask the user to type an ID. If it's cancelled, show the card again.
- After approval, run the plan's `apply_command` (or `--plan-id <id> --confirm-writes`) exactly, in the main conversation with `initial_wait: 600`, and wait. Never a subagent or background shell.
- Create nothing outside the skill CLI: no raw `az` or REST workarounds. When the CLI blocks, stop and report the blocker.
- The user explicitly chooses any Foundry/OpenAI resource, even when only one is listed; never auto-select or infer a default.
