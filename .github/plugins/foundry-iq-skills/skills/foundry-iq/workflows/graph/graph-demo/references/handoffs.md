# Hand-offs

Plain updates: [story](story.md). The `foundry-iq-skills` leaves own the cards; show each verbatim. Sections 2 to 8 follow the acts.

## Run name

Before cards: [resolve run name](../../graph-guide/references/run-naming.md); reuse it.

## 2. Documents

### Resources

New (default):

```text
entity-graph-provision plan --tenant-id <tenant> --subscription-id <sub> --run-prefix <prefix> --state-dir <provision_state_dir> --create-resource-group --public-data-entra --storage-container public-documents --operator-object-id <oid> --embedding-deployment embedding --chat-deployment chat
```

Add the model flags from [checks](install-and-checks.md#subscription-and-models). Details: [new resources](../../entity-graph-provision/references/new-resources.md).
Existing resources: [connect existing](../../entity-graph-provision/references/connect-existing-resources.md).
Apply runs `connect`; when `ready`, pass its saved `build_args_file` as `--build-args <file>` from
then on; never synthesize flags. Otherwise run its printed connect command. Reuse bound models.

### Sample and build

Fetch the sample into the run directory:

```text
python -I "<package-root>\graph\runtime\bootstrap.py" run entity entity-graph-build fetch-sample --output "<run_directory>\corpus" --json
```

Sample: `--source-kind local_path --source-reference <output>` on inventory and builds;
never pass `--source-prefix`. Keep `questions_file` for Act 8.
For Blob, retain [flags](../../entity-graph-build/references/plan-and-publish.md#plan-run-exactly);
only explicit whole-container approval permits `--source-prefix=`.

Build: `entity-graph-build plan --build-args <file> --ontology deferred`, manifest, absolute `<run_directory>\entity\build-journal.json`, `--source-description` from sampled documents. After approval: apply, verify (waits for all documents; on `SYNC_IN_PROGRESS` rerun it, never a polling loop), publish. Retain descriptor, flags, journal.

## Grounding

If chosen ([grounding](grounding.md)), before the build card:

1. `entity-graph-build plan ... --ontology deferred --grounding-index <prefix>-grounding --json`, same build inputs. Read `grounding.index` and `grounding.graph_name`; blocked until index exists, so no card.
2. `grounding-provision doctor --build-args <file>`.
3. Wikidata: `grounding-build plan --build-args <file> --wikidata --seed Q2283 --depth 1 --index <grounding.index> --graph-name <graph name>`. Entity file: replace Wikidata flags with `--file <edges> --license "<licence>"`. Add `--run-state-dir <run_directory>\grounding`. No preview: show plan's card and ask one Approve/Stop question; then `grounding-build apply --build-args <file> --plan-id <plan-id>` with its returned ID.
4. `grounding-consume ready --build-args <file> --index <grounding.index> --graph-name <graph name>` must pass; on failure follow its `next_step`.
5. Re-run the step 1 plan unchanged; its card is the build card.

Attach retains build flags including `--grounding-index`; leave it out of the trial (a separate build and graph name).

## 3. Topics

Topic Graph reads the published content index in place; no copy is made. Before every verb: `--build-args <file>`, absolute `--state-dir <run_directory>\topics` and these flags; prefix from binding:

| Topic Graph flag | Value |
|---|---|
| `--source-index` | descriptor's content index |
| `--key-field` | `uid` |
| `--text-field` | `snippet` |
| `--vector-field` | `snippet_vector` |
| `--source-field` | `blob_url` |
| `--dataset` | lowercase slug, such as `earnings` |

`topic-graph-build inspect --json` must pass before planning; failure or unknown blocks. Inspect, plan, apply, verify, publish behind its own card. After approval, run plan's `apply_command` exactly; then publish's `browse.command` exactly. Retain `generation_id`, `browse.env.TOPICGRAPH_DESCRIPTOR` for browsing/Sitemap, verify's `topicgraph_output.directory` and state for setup after attach.

## 4. Ontology

Standard (default): `--ontology schema_org` at attach; no trial. Generated (opt-in, needs per-1M input/output token prices): `ontology-build connect --build-args <file> --topic-graph-output <dir> --accept-current-source`; absolute `--state-dir <run_directory>\ontology` throughout. Inspect, plan, propose (spend card), review, approve (its card, one Approve/Stop question; review's printed command), export beneath `<run_directory>\exports`. Go straight from propose to review; offer refine in the recap. `ontology-consume check` must pass; retain `ontology-consume current --json` path, SHA-256 and matching source generation. User file: [my ontology](byo-ontology.md).

## 5. Trial

For M documents, use the intake's N with `1 <= N < M`; never pad the corpus or change the manifest. `entity-graph-build plan`: binding, source, `--source-description`, `--source-manifest <manifest.json> --sample <N> --json`, `--ontology inline_jsonld --ontology-path <path>.jsonld` and a new journal. Apply the exact plan ID, then `trial-report` with the same inputs plus `--json`, saved as `trial-report.json`. A trial cannot be published; no-go returns zero-hit classes to Act 4. Keep trial resources.

## 6. Attach

Same complete manifest and journal as the build, changing only the ontology, plus the published deferred descriptor; no `--sample`. An attached ontology cannot be removed.

```text
entity-graph-build plan-attach-ontology <build flags, --ontology inline_jsonld --ontology-path <path>.jsonld> --descriptor <deferred-descriptor.json> --trial-report <trial-report.json> --json
entity-graph-build attach-ontology <same flags, without --trial-report> --plan-id <attach-plan-id> --confirm-writes --json
```

Only extraction runs; it creates `<prefix>-kb-<generation>` and rewrites the descriptor. Read names from plan/descriptor. `ATTACH_WAITING`: rerun. `ATTACH_STALE`: re-plan. `ATTACH_PARTIAL`: partial-ingestion stop.

Always `entity-graph-build verify <same flags> --descriptor <descriptor> --json`. Show chunks, relationships, `facts` (per type and class), `grounding_coverage`, and name every empty type/class. On failure, stop and follow `next_step`.

### Native topic retrieval

Before Act 7: final attached descriptor's `endpoints.knowledge_source`, `endpoints.knowledge_base`:

```text
topic-graph-build --state-dir <absolute-state> --json plan-retrieval --generation-id <topic-generation> --topic-diversity off --knowledge-source <final-ks> --knowledge-base <final-kb>
```

Show `approval_card.text` verbatim; ask one Approve/Stop question. Only after approval:

```text
topic-graph-build --state-dir <absolute-state> --json configure-retrieval --plan-id <retrieval-plan> --confirm-writes
topic-graph-build --state-dir <absolute-state> --json verify-retrieval --plan-id <retrieval-plan>
```

Require `state: configured` and every resource `configured`. A block or declined card leaves retrieval setup incomplete. For partial writes, follow [recovery](../../topic-graph-build/references/retrieval-setup.md#failure-and-return); no hand edits.

## 7. See it

Offer the Graph Playground: [finish](finish.md).

## 8. Questions

Each question once: `entity-graph-consume query --graph --descriptor <descriptor> --query "<question>" --json` (Search only). `answer` is null by design: narrate nodes, edges, paths, provenance ([finish](finish.md)); `--query-mode kb` writes one. On one question only, compare `--topic-diversity on` and `off` (KB model calls, see intake); require success without default-only retries. The full `default`/`on`/`off`/`kb` matrix is a release check, not the demo.

## Resume

Before resume: `entity-graph-build verify <build flags> --descriptor <descriptor> --json` (§6); `topic-graph-consume --json status` with published `TOPICGRAPH_DESCRIPTOR`; `grounding-consume ready` (step 4) if used. Failure stops: redo that act.

## Cleanup commands

Print, never run: `az group delete --name <resource group> --subscription <subscription>` per run-created group. List `run_directory` for the user to remove.
