# Graph traversal

## Use this path

Use this path for relationship or multi-hop questions when the published descriptor advertises graph retrieval.

## Graph flow

1. Confirm graph retrieval with `entity-graph-consume capabilities --descriptor <path> --json` when not already known.
2. Run `entity-graph-consume query --graph --descriptor <path> --query "<question>" --json`.
3. Bounds: `--depth` 1-3 (default 2), `--top` 1-10 (default 5), `--fanout` 1-50 (default 20). Widen only when the previous result stayed within limits.
4. The default `--json` output is `detail: "summary"`: the relationships most related to
   the question (`summary.top_relationships`, each with its cited `sources` files), counts,
   executed GQL and a budget note. Answer from it. `--detail full` returns every node, edge
   and chunk-level passage; `--detail compact` deduplicates identical evidence records while
   retaining distinct chunks and each edge's `source_ids`/`evidence_ids` links.
5. Every `query` saves its full result to `.entity/results/entity-graph-consume-query-<time>.json`
   and returns the path as `result_file`. Answer later questions about that result from the
   file, or rerun the same read-only query; never search session logs for it.

## Query modes

`--graph --query-mode traverse` is the default multi-hop path. It anchors on the names in the
question and first tries the ontology classes the question names or implies (for example
people for "who" or "executives"), falling back to the other classes only when those find
nothing. When no entity carries the question's full name but it names a period ("FY24 Q4",
"Q4 FY24", "FY24 Fourth Quarter"), it anchors on that period before falling back to single
words. Its result includes `query_mode: "traverse"` and an ordered `executed_gql` list of
the statements actually sent. `answer` is null by design: tell the answer from `nodes`,
`edges`, `paths` and `provenance`, and treat it as empty only when there are no edges or
paths, or no provenance. Use `--query-mode kb` when a written answer is wanted.

Use `--graph --query-mode gql --query "<MATCH ... RETURN ...>"` for a single read-only
statement. Writes, multiple statements, comments, semicolons, control characters and
multiline quoted literals are rejected. Ordinary newline, carriage-return and tab whitespace
outside literals is allowed. The query is limited to 2048 characters and results to 1000 rows;
use an explicit `ORDER BY` and `LIMIT` for predictable bounded results.

`--query-mode nl2gql` turns a question into GQL. `--query-mode kb` asks the Knowledge Base. Both need `endpoints.knowledge_base` in the descriptor; a failed service step is reported in `warnings`.

These results include `executed_gql`, `gql_columns`, `gql_rows`, `graph_diagnostics` and `graph_stats`. Missing bindings are never invented.

## Question sets

For several questions (for example, a dataset's sample questions file), answer each in turn and report every answer before ending the turn. `kb` and `nl2gql` calls are model spend: before running a set in those modes, show the question count (about one Knowledge Base retrieve each) and ask one Approve/Stop question.

1. Run one `query --graph` per question, in sequence; give each call enough time (about two minutes) and never leave one running in the background unreported.
2. Use `traverse` for who-relates-to-whom questions and `kb` or `nl2gql` for counts and rankings. If one mode returns nothing relevant, try the other once and say which you used.
3. Give each answer with its citations, or say plainly that the graph has no relationship to answer it, naming what is missing.

## Premise checking and limits

- Retrieve the named entities and asserted facts, not only the requested impact. If evidence contradicts the premise, say so and cite the correcting source; if neither confirmed nor contradicted, say it is unverified.
- Graph retrieval never falls back silently to document retrieval. If it is not enabled, say so and stop.
- Traversal is bounded by request budget with no completeness or total-count guarantee. If anchors were skipped or a warning appears, split the question and query from the intermediate entity.
- Keep entity IDs, aliases, directed predicates, warnings, and source citations intact. Never invent a missing passage or link.

## Optional presentation

An Apps-capable host can show bounded, read-only graph results with the optional `entity-apps` server; it never replaces the CLI.

## Return

Report the path, the sources behind each returned edge, any traversal warning, and whether the answer is confirmed, contradicted, or unverified.
