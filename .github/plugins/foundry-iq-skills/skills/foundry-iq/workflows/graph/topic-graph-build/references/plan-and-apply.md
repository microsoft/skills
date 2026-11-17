# Plan and apply

## Quick starts

- "Check whether this machine is ready to build a Topic Graph."
- "Inspect the source index `<index>` and plan a Topic Graph build; show me the approval card."
- "Apply the approved plan and verify the new generation."

## Use this path

Use this path to go from a Search source index with stored chunk vectors to a verified, unpublished topic index.
Search/KB topic retrieval is a separate approved step: [Retrieval setup](retrieval-setup.md). Local publish enables browsing only.

## Preflight

1. Follow [runtime setup](../../graph-guide/references/install-and-checks.md#plugin-and-clis): explicit `setup topicgraph`, then `run topicgraph topic-graph-build --help`. Retain the `run <domain>` launcher; warm run never installs.
   Topic generation also requires the [native binary](native-runtime.md).
2. Global flags go **before** the verb and repeat unchanged on every command. Fill placeholders, nothing else (`<search>` is the service name, not a URL; `<tenant>` from `az account show --query tenantId -o tsv`):

   ```bash
   topic-graph-build --state-dir <absolute-state> --tenant-id <tenant> --subscription-id <sub> --resource-group <rg> --search-service <search> --source-index <index> --json doctor
   ```

   Doctor only reads. Follow the first `fail` check's `next_step`; `warn` does not block. Fix named flag errors, not trial-run guesses.
3. Topics are named by a chat deployment. With an Entity Graph connect file, put `--build-args <file>` **before** the verb; it fills the source, embedding model and chat deployment, so skip discovery and ask nothing. Otherwise run `entity-graph-provision discover` as that skill's `connect-existing-resources.md` describes, show its table verbatim, ask for a chat model by name, and pass `args.topicgraph_doctor` to `doctor` and `args.topicgraph_plan` to `plan`. Doctor makes no model call.

## Inspect and plan

1. Tell the operator the tenant, subscription, resource group, and Search service, then run `inspect` and `plan` with the global source flags before the verb (for a managed graph content index `*-managed-*-index`, use `--key-field uid --text-field snippet --source-field blob_url --vector-field snippet_vector`, and `--embedding-model-id` is read from the Entity Graph connect binding for that Search service when omitted).

   ```bash
   topic-graph-build --state-dir <absolute-state> --tenant-id <tenant> --subscription-id <sub> --resource-group <rg> --search-service <search> --source-index <index> --dataset <slug> --key-field <key> --text-field <text> --source-field <source> --vector-field <vector> --embedding-model-id <model> --json inspect
   topic-graph-build --state-dir <absolute-state> --tenant-id <tenant> --subscription-id <sub> --resource-group <rg> --search-service <search> --source-index <index> --dataset <slug> --key-field <key> --text-field <text> --source-field <source> --vector-field <vector> --embedding-model-id <model> --json plan --model-endpoint <https-endpoint> --model-deployment <chat> --model-name <model-name>
   ```

2. `plan` needs `args.topicgraph_plan`'s `--model-endpoint`, `--model-deployment`, `--model-name` after the verb. `--model-call-cap <n>` bounds naming calls (default ten per expected leaf topic, at least 50); `--model-api-version` overrides the default. Model settings and cap enter the plan ID.
3. Before the card say one plain line, such as "This reads your index, names about 40 topics with gpt-5.6-luna, and makes a new topic index." Then show the card verbatim: a headline, three bullets, time and cost. Its `details` (download, sign-in, scoring profile) are shown only when asked.
4. Optional global `--title-field <field>` supplies titles as naming evidence. Leaf topics hold at most 100 chunks.
5. Use `--reader` or `--drop-reader` after `plan` only when the operator names a principal. If you re-plan, show the new card and ask again.

A verified Entity Graph content index needs no freeze.

Topic Graph reads the source index in place. Its vector field must be stored and retrievable with a `cosine` or `dotProduct` HNSW profile; otherwise planning stops with `NATIVE_SOURCE_INCOMPATIBLE`, `SOURCE_VECTORS_NOT_STORED` or `SOURCE_VECTORS_NOT_RETRIEVABLE`. Ask the source owner; never edit or copy a managed index yourself. Unknown or exhausted Search quotas block planning. The card states the most model calls the build may make.

## Apply and verify

1. Run `apply` and `verify` directly in the main session shell (`initial_wait: 600`), never inside a subagent. After the user approves:

   ```bash
   topic-graph-build --state-dir <absolute-state> apply --plan-id <plan-id> --confirm-writes
   ```

   Run the `apply_command` that `plan` printed, verbatim; never retype `--state-dir`. The saved plan holds every other setting. On `PLAN_NOT_FOUND`, tell the user in one plain line and run the command its next step names; doctor doesn't list plans.
2. Do not pass `--model-*` or `--reader` flags to `apply`; the plan holds them. On `PLAN_BOUND_FLAG`, drop them and rerun.
3. `apply` runs the TopicGraph executable against the source index, then uploads the topic release into the new index. On `MODEL_CALL_BUDGET_EXHAUSTED`, re-plan with a higher `--model-call-cap`, show the new card, and apply after approval; the build resumes where it stopped.
4. Run `topic-graph-build --state-dir <absolute-state> --json verify` after `apply`. It reads every document back and returns the publish card. `retrieval_setup` reports native retrieval as not checked. Publish is browsing-only; Search/KB use must finish [retrieval setup](retrieval-setup.md)'s separate gate.

`verify` also reports `topicgraph_output.directory`: the build's output folder, kept under `<absolute-state>/topicgraph-output/`. Pass that value unchanged to `ontology-build connect --topic-graph-output`; keep the folder if the operator wants an ontology.

## Return

Report the phase, exact plan ID, target index, whether the result is planned, applied, or verified, the output folder, and the single safe next action. Never claim a plan proves access, quota, or readiness to publish.
