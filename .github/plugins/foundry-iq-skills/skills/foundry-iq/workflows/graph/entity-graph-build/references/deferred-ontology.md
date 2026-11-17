# Deferred ontology, then attach

Build once with `--ontology deferred`. Search chunks and embeds the documents; attaching an
ontology later reuses that enrichment cache and runs only triple extraction.

Default ontology: `--ontology schema_org` at attach, no trial. Generated ontology: opt-in,
built from a Topic Graph with `ontology-build`. Own OWL file: pass it directly.

1. Plan, apply, verify and publish as in [Plan and publish](plan-and-publish.md) with `--ontology deferred`. The Knowledge
   Source is created with graph extraction and the enrichment cache on, but no ontology. The
   published descriptor has a content index and no graph index or Knowledge Base yet. `verify`
   passes only after chunking and embedding finish for every document, or after the user
   accepts the documents that failed ([Failed documents](status-and-telemetry.md#failed-documents)).
2. Optional: build topics with `topic-graph-build`, then generate and export an ontology
   with `ontology-build`. Skip this for `schema_org` or your own OWL file.
3. Plan the attach with the same flags as the deferred apply, changing only the ontology
   (`none` and `deferred` are refused) and adding the deferred descriptor:

   ```bash
   entity-graph-build plan-attach-ontology <plan flags with --ontology inline_jsonld --ontology-path <ontology.jsonld>> --descriptor <deferred-descriptor.json> [--trial-report <trial-report.json>] --json
   entity-graph-build attach-ontology <same flags, without --trial-report> --plan-id <attach-plan-id> --confirm-writes --json
   ```

   After a GO trial of this ontology, pass its saved `trial-report --json` output as `--trial-report` so the card shows the measured cost and time.
   An attached ontology cannot be removed; offer a strict-subset trial of a custom ontology first
   ([Trial, update, retire](trial-update-retire.md)). Show the approval
   card and ask one Approve/Stop question.
4. Attach updates the existing Knowledge Source in place (ETag-guarded), waits for triple
   extraction, verifies the graph index, creates the planned KB (`<prefix>-kb-<generation>`) and rewrites the
   descriptor. Generation, Knowledge Source and index names do not change. While it waits it
   prints `Still extracting the graph: x/y documents (n min)` at least once a minute; for status
   questions see [Status while a step runs](status-and-telemetry.md#status-while-a-step-runs).
5. `ATTACH_WAITING`: a service rebuild is pending; rerun the same `attach-ontology` command.
   `ATTACH_STALE`: the Knowledge Source changed since planning; re-plan. Never edit the
   Knowledge Source by hand to get around either. `ATTACH_PARTIAL`: some documents failed
   extraction; offer investigate or accept ([Failed documents](status-and-telemetry.md#failed-documents)),
   pass `--descriptor <deferred-descriptor.json>` to `failures` and `accept-failures`, then rerun
   the same `attach-ontology` command.
6. Verify an attached build with `entity-graph-build verify <same flags> --descriptor <attached-descriptor.json> --json`.
   It already has its Knowledge Base, so skip the KB handoff. In-place `update` of an attached
   build is not supported yet; rebuild instead.
7. Search/KB topic retrieval is a separate approved step (`topic-graph-build`, Retrieval setup). Local publish enables browsing only.

## Enrichment cache

The Search system identity needs `Storage Blob Data Contributor` and `Storage Table Data Contributor` on the cache account; `doctor --cache-storage-resource-id <id> --search-resource-id <search-id>` checks both, and a gap routes to `entity-graph-provision connect`. Deleted source blobs drop out only with blob soft delete on; `retire` removes the cache container and tables.
