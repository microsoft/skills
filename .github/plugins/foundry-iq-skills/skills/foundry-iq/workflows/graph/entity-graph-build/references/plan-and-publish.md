# Plan and publish

## Quick starts

- "Build an Entity Graph from the documents in `<folder>`."
- "Plan the build with my OWL file and show the approval card."
- "Publish the verified generation."

## Use this path

Plan a source against an existing target; verify and publish.

## Preflight

1. Follow [runtime setup](../../graph-guide/references/install-and-checks.md#plugin-and-clis): explicit `setup entity`, then `run entity entity-graph-build --help`. Retain the `run <domain>` launcher; warm run never installs.
2. Run read-only `entity-graph-build doctor --json`, adding `--tenant-id`, `--build-journal`, and `--descriptor` when known.
3. The target comes only from a `ready` `entity-graph-provision connect` result: pass `--build-args <build_args_file>` (the saved `build_binding.build_args`); hand-write no target flag. Its `--embedding-model` is the model identity; a descriptor's `embedding_deployment` is a deployment name.

## Plan: run exactly

Resources come from the demo provision (`entity-graph-provision`) or your own (`connect-existing-resources.md` in that skill).

Fill placeholders only; paths are absolute and `<journal.json>` is new, outside `<corpus>`. Only the demo uses `fetch-sample`; otherwise inventory the user's folder or approved Blob scope. Use [the named run's directory](../../graph-guide/references/run-naming.md) for corpus and `entity` state; legacy defaults: `.\earnings-corpus`, `.\.entity\`. Never use a session folder; retain returned paths.

Before `plan`, sample documents and any ontology. Draft `<description>`: 1-2 factual sentences on subject, document types and coverage so agents can select this source.

```bash
entity-graph-build fetch-sample --output <corpus> --json
entity-graph-build inventory --source-kind local_path --source-reference <corpus> --output <manifest.json> --json
entity-graph-build plan --build-args <file> --source-kind local_path --source-reference <corpus> --source-manifest <manifest.json> --build-journal <journal.json> --ontology deferred --source-description "<description>" --json
```

`plan` silently accepts missing target flags: never drop one. On error, fix only the named flag.

The earnings sample is `local_path`: retain the automatic nonempty
`scope.staging_prefix`. Never pass `--source-prefix` to a local source.

For Blob input, replace the local source flags above with
`--source-kind blob_prefix --source-reference https://<account>.blob.core.windows.net --source-resource-id <arm-id> --source-container <container> --source-prefix <prefix>`;
inventory also needs `--tenant-id <tenant-id>`. For an explicitly approved whole
container use `--source-prefix=`, including on Windows; omission is invalid.
Keep source flags and manifest through publish; scope changes need new inventory
and approval.

1. Ontology: keep `--ontology deferred` (default): the Knowledge Source gets graph extraction with no ontology, so Search only chunks and embeds; attach the ontology later (see [Deferred ontology](deferred-ontology.md)). Setting an ontology here starts triple extraction at once, so do it only when the user already has the ontology they want: `--ontology inline_jsonld --ontology-path <ontology.jsonld>` (or `--ontology owl_file --ontology-path <ontology.jsonld>`) for the user's classes (offer a trial first), or `--ontology schema_org` when they explicitly ask for the built-in types now.
2. Every build binds a Knowledge Base (`agentic_retrieval: true`); deferred attach creates it. Its planned name is `<prefix>-kb-<generation>`.
3. Blob inventory lists metadata without downloads; the Knowledge Source reads that scope in place: no documents are copied to staging storage. Only `local_path`/`zip_archive` stage copies. On source changes, `verify` checks completed indexer status and reports `source_drift`. Search drops deleted blobs only with [blob soft delete](https://learn.microsoft.com/en-us/azure/storage/blobs/soft-delete-blob-enable?tabs=azure-portal); have the owner enable it before deletion. `inspect`/`apply` warn `BLOB_SOFT_DELETE_OFF`/`_UNKNOWN`, never block. Targets may span subscriptions with per-model overrides (`--embedding-openai-*`, `--chat-openai-*`, `--kb-openai-*`, `--kb-chat-deployment`, `--kb-chat-model`) and Search's user-assigned or system-assigned identity (`--use-system-identity`). Models come only from user choices in `entity-graph-provision discover`: subscription from tier 1, then each role from tier 2 (repeat tier 2 for another subscription). Show tables verbatim; never default, guess or narrow scope.
4. A changed endpoint, source, model, ontology or description changes the plan ID and needs fresh approval; later commands reuse the journaled description.
5. Inventory accepts `.md`/`.txt` plus PDFs, Office files, HTML and images. For any non-text file, add `--content-understanding-endpoint https://<name>.services.ai.azure.com` to `plan` (otherwise `CONTENT_UNDERSTANDING_REQUIRED`; a `*.cognitiveservices.azure.com` endpoint gets `CONTENT_UNDERSTANDING_ENDPOINT_HOST`, so use the `services.ai.azure.com` form). Public-data provision with `--content-understanding-name` creates the account and grants the role. With your own resources, use the `--build-args` file from `entity-graph-provision connect`, which carries the endpoint when the user chose an account there. The account must be in a Content Understanding region, hold an embedding model deployment named like the Build's embedding deployment, and grant the Search identity Cognitive Services User. It needs no chat deployment because Build turns off image verbalization. Apply checks the deployment, role and region read-only before any write. It stops with `CONTENT_UNDERSTANDING_EMBEDDING_MISSING` or `CONTENT_UNDERSTANDING_ROLE_MISSING`; report that and stop, and never create a deployment or grant a role outside an approval card. `CONTENT_UNDERSTANDING_REGION_UNSUPPORTED` and `CONTENT_UNDERSTANDING_ROLE_UNCERTAIN` only warn.

Leave `--extraction-parallelism` at its default.

For canonical IDs, pass `--grounding-index <name>` before planning, give the producer `grounding.graph_name`, and re-plan once readiness passes; never copy a graph name from an ungrounded plan.

## Apply and publish

1. Show the card. After the user approves, run these in order directly in the main session shell (`initial_wait: 600` for `apply`), never inside a subagent. `verify` waits for every document; on `SYNC_IN_PROGRESS` rerun it, never a polling loop. `<plan flags>` is everything between `plan` and `--json` above, unchanged (drop `--chat-capacity`, `--trial-report`, `--upload-concurrency`, which only `plan` and `apply` take, from every later command, including `progress` and `reconcile`):

   ```bash
   entity-graph-build apply <plan flags> --plan-id <plan-id> --confirm-writes --wait --json
   entity-graph-build verify <plan flags> --confirm-writes --json
   entity-graph-build publish <plan flags> --json
   ```

2. `APPLY_INCOMPLETE` or an uncertain result is not success: run `progress`, then `reconcile`, then `verify`, each with `<plan flags> --json`. Never reapply around uncertainty. For local status read `run_id` from that journal; do not substitute the plan ID.
3. `publish` writes the descriptor under `~/.entity/descriptors` (or `$ENTITY_HOME`) and marks it current. Keep its descriptor path. `--keep-current` keeps the current graph, only when one is already current.
4. Pass the serving descriptor as `--descriptor` on later plans so reader grants carry forward.

## Return

Report phase, exact plan ID, ontology mode, whether the result is offline planning or verified state, and one safe next action. After a verified publish, offer the [Graph Playground](../../graph-guide/references/install-and-checks.md#graph-playground).
