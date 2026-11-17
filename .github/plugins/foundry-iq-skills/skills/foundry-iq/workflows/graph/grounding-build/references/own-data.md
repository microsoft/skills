# Own data

## Quick starts

- "Load `<absolute-path>\edges.csv` into a grounding index for graph name `<graph name>`."
- "I have a CSV of entities with `id`, `name` and `aliases`; build a grounding index so names resolve."
- "Plan a grounding index from this Parquet file and show me the plan first."

## Steps

1. Get the target graph name from the consuming graph-extraction plan. Never copy a name from an ungrounded plan.
2. Preview (read-only, nothing saved), then plan with the same flags; the plan saves the approval snapshot. Fill placeholders, nothing else. `--build-args` supplies the tenant, endpoint and run prefix, so the index is `<prefix>-grounding`:

   ```bash
   grounding-build preview --build-args <file> --file <edges> --graph-name <graph name> --run-state-dir <run_directory>\grounding
   grounding-build plan --build-args <file> --file <edges> --graph-name <graph name> --run-state-dir <run_directory>\grounding
   ```

   No binding: pass `--tenant` and `--endpoint` instead.
3. Show the plan card and ask one Approve/Stop question; then `grounding-build apply --build-args <file> --plan-id <plan-id>`.
4. Run `grounding-consume ready --build-args <file> --index <name> --graph-name <graph name>` and follow its `next_step` on FAIL. Return the index and exact graph name to the consumer; it must re-plan before its own writes.

## Formats

`.csv`, `.jsonl`/`.ndjson`, `.parquet` (needs the `parquet` extra). Override with `--format`. Required columns: `subject`, `predicate`, `object` (aliases such as `s`/`p`/`o`, `head`/`relation`/`tail`). Optional: `subject_type`, `object_type`, `subject_id`, `object_id`, display names, `confidence` (0..1, default 1.0), `namespace`, `graph_name`, and typed objects (`object_string`, `object_double`, `object_bool`, `object_datetime`).

## Entity lists

A file with `id` and `name` and no `predicate`/`object` is an entity list. Optional `type` and `aliases` (split on `|` or `;`). Each name and alias becomes one `<id> rdfs:label <name>` row. Do not invent edges or write a conversion script.

## Making names resolve

A graph-extraction build looks up mentions with `graph_name eq '<its graph name>'` and matches exact, starts-with, then BM25 on `object` for `rdfs:label` and `skos:altLabel` rows. The match returns `subject_id`. So:

1. Pass `--graph-name <build graph name>` so every edge carries it.
2. Provide label rows: derived automatically when edges have `subject_id`/`object_id` (`--with-labels` forces, `--no-labels` disables). If the plan warns there are none, ask the user for ids.

## Normalization

Text is NFC-normalized and trimmed. Empty fields, self-loops, and duplicates (highest confidence wins) are dropped and counted; rows over the cap are refused. The plan ID hashes the normalized edges, endpoint, index name and graph name, so any input change yields a new ID.

Own-data edges keep their own licence; only load data the user may store in the target service.
