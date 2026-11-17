# Readiness

## Quick starts

- "Is my grounding index ready for graph name `<graph name>`?"
- "Why does my graph-extraction build resolve no entities against the grounding index?"
- "Run the readiness check and tell me the next step."

## Command

`grounding-consume ready --index <name> --graph-name <graph name>`.

Result is `PASS` or `FAIL` with `checks[]`:

| Check | Meaning |
|---|---|
| `edgelist_profile` | The index has a valid `edgeList` graph profile. |
| `label_rows` | There are `rdfs:label`/`skos:altLabel` rows for name resolution. |
| `graph_name_match` | Rows carry the build's graph name. `SKIP` without `--graph-name`. |

Other fields: `label_rows`, `distinct_graph_names`, and one `next_step`. The CLI exits 2 on FAIL.

## Acting on FAIL

Follow `next_step` literally and say which skill does it:

- Wrong graph name: `grounding-build align --index <name> --graph-name <graph name>`.
- No label rows: rebuild with ids and labels (see `grounding-build`).
- Missing or wrong profile: rebuild the index with `grounding-build`.

After the fix, re-run `ready`. Hand back the index name and endpoint with one line saying `ready` passed.

## Why this matters

A graph-extraction build matches mentions only against rows with its own graph name, so a mismatched name resolves nothing even when the index is otherwise valid. The graph name depends on the build's inputs; recompute it if the build settings change.
