# Wikidata

## Quick starts

- "Ground the demo against Wikidata (`Q2283`)."
- "Bootstrap a grounding index from Wikidata for the seed `Q95`."
- "Plan a depth-2 Wikidata grounding index for `Microsoft`, capped at 20,000 edges."
- "Is Wikidata data OK to load into a grounding index?"

## Steps

1. Plan. Fill placeholders, nothing else; repeat `--seed` per seed, and `--depth` is 1 or 2. `--build-args` supplies the tenant, endpoint and run prefix, so the index is `<prefix>-grounding`:

   ```bash
   grounding-build plan --build-args <file> --wikidata --seed <QID or title> --depth 1 --graph-name <build graph name> --run-state-dir <run_directory>\grounding
   ```

   No binding: replace `--build-args` with `--tenant` and `--endpoint`, and pass `--index`.
2. Show the plan card and ask one Approve/Stop question; then `grounding-build apply --build-args <file> --plan-id <plan-id>`.
3. Run `grounding-consume ready --build-args <file> --index <name> --graph-name <graph name>`.

## Bounds

Seed-bounded only: at least one seed is required and full dumps are refused. Depth 1 reads the seed's statements; depth 2 also the entities they link to. The edge cap maximum is 50,000. If it would be exceeded the plan refuses rather than truncating; narrow the seeds or depth.

## What is loaded

Item, string, quantity, time (day precision or finer) and English text statements from the public Wikidata API, read at a polite rate; deprecated and no-value statements are skipped. Edges use English labels, QIDs in `subject_id`/`object_id`, property-ID predicates such as `P31`, confidence 0.9 and origin `wikidata:CC0`.

## Licensing

Wikidata structured data is CC0 1.0: no attribution or ShareAlike obligation. The plan and descriptor record `wikidata:CC0`. Generic Wikidata edges add noise for private or niche corpora; prefer this mode for demos and public-domain topics.
