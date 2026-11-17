# Trial, update, retire

## Use this path

Use this path for three follow-ons: an OWL trial build, an in-place update of a published generation, or retirement of unbound generations.

## OWL trial

Offer a trial with N documents, `1 <= N < M` (demo default 5; CLI default 50). The user may skip it. Use the same N for plan, apply and report.

1. `entity-graph-build plan --sample <n>` with the same flags and the ontology to test (`--ontology inline_jsonld --ontology-path <ontology.jsonld>`, never `deferred`). It has its own plan ID and card. For `blob_prefix`, no blobs are copied: the trial's knowledge source points at the whole live prefix and Search may index all of it, so trial cost and time can approach a full build. `--sample <n>` does not cap what Search indexes. For a bounded trial, the user first copies a small set of documents to a separate prefix of their own, then plans the trial on that prefix.
2. After exact approval, `entity-graph-build apply --sample <n> --plan-id <id> --confirm-writes`.
3. After synchronization, `entity-graph-build trial-report --sample <n>` (add `--tenant-id` and the user's chosen `--openai-resource-id`, never an inferred default, for a dollar estimate). Report the summary, zero-hit classes and predicates, and the go or no-go decision. The extrapolation is a range; rare classes can miss a small sample.
4. After a go, save `trial-report --sample <n> --json > trial-report.json`, then attach the same ontology to the published deferred build with `--trial-report trial-report.json` ([Deferred ontology](deferred-ontology.md)). Without a deferred build, plan the full build without `--sample`, with a new `--build-journal` and `--trial-report trial-report.json`. Reusing the trial journal blocks with `BUILD_JOURNAL_IN_USE`.
5. A trial is never publishable. Its resources stay until a separately approved retire plan.

Trial cost and time use observed token usage. They are estimates, not Azure billing.

## In-place update

Use only when documents changed and the ontology, models, extraction settings, and source location did not.

1. `entity-graph-build plan-update` with the published descriptor and the new source manifest.
2. After the user approves, run `entity-graph-build update --plan-id <id> --confirm-writes`. It uses no new index slots. Only one update per generation runs at a time; a concurrent one is refused, and if staged content changed underneath, the update stops as `conflicted` without publishing. Re-plan then.
3. If it stops or waits, follow its one `next_step`; rerunning the same plan ID resumes.
4. If the plan says "this needs a rebuild", return to a normal build plan.

## Retire generations

`<retire flags>` is `--search-endpoint <search-endpoint> --tenant-id <tenant-id>` plus `--descriptor <serving descriptor>` repeated for every descriptor that must stay protected. `--build-args <file>` supplies endpoint and tenant, and also the staging-storage flags of step 2.

1. `entity-graph-build generations <retire flags> --json`. Each listed `generation` is a 16-hex ID; only `retirable: true` ones can be retired.
2. `entity-graph-build plan-retire <retire flags> --generation <16-hex id> --json`, repeating `--generation` per unbound generation. Add `--storage-endpoint` and `--storage-resource-id` to include staged blobs (customer blobs are never deleted), and show the blob prefix and count. When the generation's indexer reports `cache.id`, `plan-retire` also lists the enrichment-cache container (`ms-az-search-indexercache-<id>`) and tables (`MsAzSearchIndexerCache*<id>`) for approved deletion because they outlive the Knowledge Source.
3. After the user approves, run `entity-graph-build retire` with the same flags and `--generation` values, plus `--plan-id <id> --confirm-writes --json`. Each delete is conditional on the ETag reviewed in the plan.

## Return

Separate measured evidence from proposed cleanup. State what was reviewed, what was changed or deleted, and what still needs approval.
