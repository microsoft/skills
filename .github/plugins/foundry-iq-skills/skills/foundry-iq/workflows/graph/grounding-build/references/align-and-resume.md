# Align and resume

## Quick starts

- "My grounding index resolves nothing; align it to graph name `<graph name>`."
- "The grounding load was interrupted; resume it."
- "What is the status of my grounding build?"

## Align an existing index

Use when an index already exists but its `graph_name` does not match the graph-extraction build.

1. Dry run: `grounding-build align --index <name> --graph-name <graph name>`. It shows the rows to change and the current graph names.
2. Show the plan; wait for approval.
3. Apply: re-run the same command with `--plan-id <id>`.

It re-stamps `graph_name` and the `parent_id` sentinel that mirrors it, using merge only: no rows are created or deleted, rows already aligned are skipped, and it is a no-op when everything matches. It is the only change ever made to an index this plan did not create.

## Resume an interrupted load

- `grounding-build status [--plan-id <id>]` reads the local journal and makes no Azure calls.
- `grounding-build resume --plan-id <id>` re-verifies remote state and continues. It refuses if the remote index diverged from the journal.
- Documents use deterministic keys with `mergeOrUpload` in batches of at most 1,000, so re-running is safe. For `align`, re-run it with the same plan ID.

## Verify

Run `grounding-consume ready --index <name> --graph-name <graph name>` after either path and follow `next_step` literally on FAIL.

## Never

Do not delete or recreate an index to fix a name mismatch. The CLI prints only an operator-run delete hint; leave it to the user.
