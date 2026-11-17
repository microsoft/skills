# Health and access

## Quick starts

- "Is my Topic Graph environment ready to browse?"
- "Why can't I read the Topic Graph index? Check my descriptor and sign-in."
- "Browse a different Topic Graph build from this descriptor file."

## Use this path

Use this path when browsing is blocked, the environment is unknown, or the user wants to point at a different build.

## Checks

1. Follow [runtime setup](../../graph-guide/references/install-and-checks.md#plugin-and-clis): explicit `setup topicgraph`, then `run topicgraph topic-graph-consume --help`. Retain the `run <domain>` launcher on later commands; warm run never installs.
2. Run `topic-graph-consume --json doctor`, and again after any blocked result. It only reads: versions, `uv`, the Azure sign-in tenant, the descriptor, topic index health, and reader access. Doctor never signs in.
3. If `result.ready` is false, fix the first `fail` check using `result.next_step`; `warn` does not block.

## Choosing the build

- With no flags, the CLI browses the build this account published last.
- Pass `--descriptor` (or `TOPICGRAPH_DESCRIPTOR`) before the subcommand to read a different build. The Search endpoint comes from the descriptor. `--documents <file>` reads an offline test file only.
- Sign-in defaults to Entra as the signed-in user, in the tenant they are signed in to; `--tenant-id` only pins another tenant. Never run `az login` or `az account set` for the user. The identity needs Search Index Data Reader on the descriptor's physical topic index (`<prefix>-topics-*`) and on its source index (members and evidence are read from the source).
- Auth is Entra only; Consume never uses query or admin keys.

## Limits

- `status.active` is always `unknown`: consume reads the descriptor's physical index, never an alias. Local publication does not retarget already-bound servers or other machines.
- Consume is read-only: it blocks every request except document search, count, and lookup. The enforced boundary is the reader role, not the client check.
- `READ_ACCESS_DENIED` names the index; ask the builder for the role on it.
- The topic index and its source index must be on the same Search service; otherwise consume stops with `PLACEMENT_UNSUPPORTED`.
- `build_health: unlabeled` means some topics have no title (the labelling model may skip a topic its content filter refuses); browsing still works.

## Return

Report ready or blocked, the first failing check, and the single safe next action.
