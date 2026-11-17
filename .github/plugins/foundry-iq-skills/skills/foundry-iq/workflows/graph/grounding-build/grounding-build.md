# Grounding build

First read [runtime setup](../graph-guide/references/install-and-checks.md#plugin-and-clis); use its `run <domain>` launcher.

Load one path only.

| Intent | Load |
|---|---|
| Load own edges (CSV, JSONL, Parquet) or an entity list; make names resolve | [Own data](references/own-data.md) |
| Bootstrap from a bounded Wikidata seed; licensing | [Wikidata](references/wikidata.md) |
| Fix the graph name of an existing index, or resume an interrupted load | [Align and resume](references/align-and-resume.md) |

## Shared rules

Get the index and graph names from the plan of the graph-extraction build that will use the index; never guess them. Never set `GROUNDING_HOME`; `plan` prints where it saved the plan (`saved_to`).

Pass `--build-args <file>` so tenant, endpoint and [run prefix](../graph-guide/references/run-naming.md) come from the binding; the index defaults to `<prefix>-grounding`. Keep `--run-state-dir` under the run directory; it stores naming metadata only, not saved plans.

Writes stay on the CLI. `grounding-build plan` is a dry run: show its runtime `approval` card verbatim, ask one Approve/Stop question, then run `grounding-build apply --plan-id <id>` with the ID from its output; never write or paraphrase your own approval text, never promise behavior the plan doesn't state, never ask the user to type an ID, and no raw `az`/REST workarounds; when the CLI blocks, stop and report the blocker. Never delete or overwrite an index this plan did not create. Edge caps: 200,000 own data, 50,000 Wikidata. Verify with `grounding-consume` before handing back.
