# Status and telemetry

## Use this path

Use this path for environment checks, local journal status, progress, failed documents, timings, model-usage attribution, and generation protection. Every command here is read-only, except `accept-failures`, which writes only a local record, and `retry-failures`, an approved Search write.

## Commands

- `entity-graph-build doctor --json`: environment, tenant, descriptor, reader probe, and model checks. Missing inputs report `skip`.
- `entity-graph-build status --build-journal <absolute-journal> --run-id <journal.run_id> --json`: the exact local managed run. Read `run_id` from that journal; never invent it or use `plan_id` instead.
- `entity-graph-build progress`: reuse the original binding, source manifest, ontology and journal flags (no apply approval flags). One read; `continuing` at the 120-minute checkpoint is normal. To wait for indexing, run `verify`, which waits inside the command and prints progress; never write a shell polling loop.
- `entity-graph-build failures`: same flags as `progress` (add `--descriptor <deferred descriptor>` for an attach). Lists the documents that did not ingest, with each indexer error message, details and documentation link, the warnings, an `acceptance_id`, any `incomplete_sources` (chunks indexed without embeddings), and a `retry` offer when every failure looks transient.
- `entity-graph-build accept-failures --acceptance-id <id>`: same flags. Records, beside the build journal, that the user accepts exactly that failed set; no Azure writes. A different or larger failed set still pauses the build.
- `entity-graph-build retry-failures --retry-id <id>`: same flags. Resets only the documents in `retry.documents` and reruns the indexer once; a local record blocks a second retry.
- `entity-graph-build telemetry --build-journal <path>`: local journal timings only. Report service synchronization separately from local steps; if it is missing, run `reconcile` first.
- `entity-graph-build attribution`: indexer status, skillset, and Azure Monitor metrics for the exact BuildSpec, naming the bottleneck. Extraction parallelism changes the plan ID.
- `entity-graph-build generations --search-endpoint <search-endpoint> --tenant-id <tenant-id> --descriptor <serving descriptor> --json` (`--build-args <file>` can supply endpoint and tenant): live generations, what protects them (`bound_by`), and which are `retirable`.

## Failed documents

`INGESTION_PARTIAL`, `ATTACH_PARTIAL` or progress `partial` means some documents did not ingest. A few failures are normal, but the build is paused, not finished: never end the turn at the failure report.

1. Run `failures` and show the user the failed documents and their errors. Each error names its document by `key`, which is often encoded.
2. Ask the user to choose:
   - **(A) Investigate.** Work from each error message, details and documentation link. Common causes: an unsupported, corrupt, encrypted or oversized file; a content type the source cannot read; access denied; or model throttling. A corrected source document needs a new plan.
   - **(B) Continue without them.** Only after the user chooses this, run `accept-failures --acceptance-id <id>`, then resume: `reconcile` for a build, or the same `attach-ontology` command for an attach. Then name the next step; on the default path that is publish, then the Topic Graph build ([Deferred ontology](deferred-ontology.md)).
   - **(C) Retry once,** only when `failures` returns `retry` (dropped connections, timeouts, throttling, "must be retried", or chunks without embeddings). Say it repeats those documents' model calls, and only after the user chooses it run `retry-failures --retry-id <id>`. Follow `progress`, then run `failures` again; a second retry is never offered.
3. The indexer errors are the evidence. Do not look for chat-completion diagnostics or try to reproduce the indexer locally.

## Interpretation rules

- A verified journal is history, not a fresh statement that the service is still serving.
- `generations` protects only the descriptors you pass. If the serving set is incomplete, say cleanup advice is incomplete too.
- When extraction needs more than one 2-hour indexer run, plan the full build with `--ingestion-interval PT5M`.
- A managed build needs two free Search index slots (content and graph). If the service is full, move to retirement.

## Return

Report the exact phase, the source of truth used, any returned uncertainty, and one safe next action. Never expose journal contents, secrets, or document text unless asked.

## Status while a step runs

`verify` and `attach-ontology` print progress while they wait (`Still indexing: x/y documents (n min)`, `Still extracting the graph: x/y documents (n min)`) at least once a minute. When the user asks how it's going, quote the shell's latest line. For a fresh read, run `entity-graph-build progress --descriptor <published descriptor>` with no other flags; it reads the published generation. Never rebuild build flags for a status check, and never judge progress from elapsed time. `GENERATION_MISMATCH` means the flags named a different generation: use the `--descriptor` form it prints.

A line `Search asked for a retry (pending cached documents); rerunning the indexer, attempt n of 5` is normal, not a failure: the command reruns the indexer itself inside the approved write (`verify` only with `--confirm-writes`; without it, `verify` stays read-only and stops with `SYNC_RETRY_REQUESTED`). Only `SYNC_RETRY_EXHAUSTED` stops a confirmed rerun, and its next step gives the exact resume command.
