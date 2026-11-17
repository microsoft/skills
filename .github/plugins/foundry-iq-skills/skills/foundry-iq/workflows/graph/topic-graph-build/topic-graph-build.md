# Topic Graph build (preview)

Use [runtime setup](../graph-guide/references/install-and-checks.md#plugin-and-clis)'s `run <domain>` launcher; load one path.

| Intent | Load |
|---|---|
| Inspect, plan, apply or verify a build | [Plan and apply](references/plan-and-apply.md) |
| Publish or manage reader access | [Publish and readers](references/publish-and-readers.md) |
| Turn on topic retrieval in Search/KB, including for existing builds | [Retrieval setup](references/retrieval-setup.md) |
| Recover writes or retire staging | [Reconcile and retire](references/reconcile-and-retire.md) |

## Shared rules

Named runs: [run naming](../graph-guide/references/run-naming.md). Reuse one absolute state directory.

Run `topic-graph-build doctor --json` first/after blocks. Use `--json` and `next_step`; skipped/blocked Azure checks need [prerequisites](../graph-guide/references/install-and-checks.md#missing-prerequisites). Name tenant, subscription, resource group and Search service before sign-in. Entra only; no keys/tokens.

Write gates return `approval_card`: show `approval_card.text` verbatim, ask one Approve/Stop question, then run the write verb with `--plan-id <id>` (Azure writes also need `--confirm-writes`); never write or paraphrase your own approval text, never promise behavior the plan doesn't state, never ask the user to type an ID, and no raw `az`/REST workarounds; when the CLI blocks, stop and report the blocker. Ask the user to choose the Foundry/OpenAI chat resource for labels; never infer it. Run `apply`, `verify`, `publish`, `configure-retrieval` in the main shell (`initial_wait: 600`). Reconcile uncertain writes before retry.

Build writes only inside its approved topic-index prefix. Publish is local. Search/KB topic retrieval is a separate approved step: [Retrieval setup](references/retrieval-setup.md). Keep completed generations.
