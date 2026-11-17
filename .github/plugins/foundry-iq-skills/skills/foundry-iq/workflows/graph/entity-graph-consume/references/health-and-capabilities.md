# Health and capabilities

## Use this path

Use this path to confirm descriptor validity, default descriptor selection, tenant alignment, reader access, or which retrieval modes are advertised.

## Discovery

1. Follow [runtime setup](../../graph-guide/references/install-and-checks.md#plugin-and-clis): explicit `setup entity`, then `run entity entity-graph-consume --help`. Retain the `run <domain>` launcher on later commands; warm run never installs.
2. Run `entity-graph-consume doctor --json` when the tenant, descriptor, or tooling may be wrong. It is read-only, skips missing inputs, sends no completions or embeddings, and returns one `next_step`. Name the tenant before any sign-in.
3. Run `entity-graph-consume capabilities --descriptor <absolute-path> --json`. It is offline: it validates the descriptor and shows whether document or graph retrieval is advertised. It does not probe Azure.

## Interpretation

- With no `--descriptor`, the CLI uses `ENTITY_DESCRIPTOR`, then the descriptor marked current by `entity-graph-build publish`. Say which one when it matters.
- If the descriptor is invalid, stop and correct it; do not guess missing fields.
- `endpoints.dataset_profile` selects corpus-specific consume behavior; a packaged earnings-call sample build records `microsoft-earnings-calls` (per-call scoping). A sample graph built before that field existed opts in with `ENTITY_CONSUME_PROFILE=microsoft-earnings-calls`.
- If a capability is absent, report `CAPABILITY_UNAVAILABLE`. Do not route around it silently.
- A clean doctor result is not approval for any write, and offline validation does not prove a live deployment.

## Return

State whether the result is offline descriptor validation, environment diagnosis, or live-read readiness. Keep tenant details and credential material out of output.
