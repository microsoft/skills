# Reconcile and retire

## Quick starts

- "The apply timed out; what landed in the index?"
- "List my Topic Graph generations and tell me which ones are safe to retire."
- "Plan retiring my incomplete staging index `<index>`."

## Use this path

Use this path after a failed or uncertain write, or to retire journal-owned, unexposed incomplete staging. Completed generations remain retained.
For uncertain `configure-retrieval` updates, instead use read-only
`verify-retrieval --plan-id <id>` with the same state directory; follow
[retrieval setup recovery](retrieval-setup.md#failure-and-return). Build reconcile
does not undo service-wide native topic bindings.

## Reconcile

1. A write that times out or returns an unclear error is journaled as ambiguous and never retried. The next `apply` stops with `RECONCILE_REQUIRED`.
2. Run the read-only `topic-graph-build reconcile --plan-id <id>` and show what landed and what is missing.
3. Resume with `apply ... --resume-after-reconcile` only after the operator explicitly says yes to that resume. It uploads only the missing documents.

## Retire

1. Run the read-only `topic-graph-build generations`. Only `incomplete-owned` qualifies. `local-current`, `retained`, `source`, `unknown`, `unrecognized`, `unresolved`, `retiring`, and `protected` do not.
2. Run `topic-graph-build plan-retire --index <index>` and show its approval card verbatim, including the document count and reader grants.
3. After the user approves, run `topic-graph-build retire --plan-id <id> --confirm-writes`. Ownership, schema/content digests, generation, count and grants must still match; manifest-bearing or exposed indexes block. It sends one delete, verifies absence and removes only the planned grants.
4. A failed or unclear delete is journaled and not retried. Retiring is irreversible: going back means rebuilding that generation.

## Return

Report what was found or removed and the safe next action. Never propose deleting completed, exposed, source, unknown or unrecognized indexes. No alias inspection or mutation is used.
