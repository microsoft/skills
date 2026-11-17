# Check, inspect, sample

## Quick starts

- "Check my grounding index `<prefix>-grounding`."
- "What predicates and graph names are in this grounding index?"
- "Sample 10 edges about `Microsoft` from the grounding index."

## Commands

All are read-only. JSON on stdout, tenant and subscription on stderr. Flags: `--endpoint <url>` (default: saved connection), `--index <name>`.

- `grounding-consume check --index <name>`: returns `ok`, `profile_kind`, `document_count`, `sample_query_ok`, `descriptor_found`, `problems[]`. Fails when the graph profile is missing, not `edgeList`, or has an unmapped or mistyped role.
- `grounding-consume inspect --index <name>`: profile mapping, fields, document count, storage size, and aggregates over a sample (top predicates, graph names, origin labels), plus the build descriptor when present.
- `grounding-consume sample --index <name> [-n 10] [--query <text>] [--predicate <name>]`: example edges with subject, predicate, object, ids, graph name, confidence, and origin label.

## Reading the result

- `ok: false` with `problems` lists contract violations. Report them verbatim and suggest rebuilding with `grounding-build`.
- Exit codes: 0 ok, 3 auth, 4 service error.
- Wikidata edges are CC0 but unreviewed; own-data edges carry the owner's licence. Do not restate edge contents as verified facts.

## Next

To know whether a graph-extraction build can use the index, load the readiness path.
