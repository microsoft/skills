# Connect, plan, propose

## Quick starts

- "Set up ontology-build against my Topic Graph build output and Azure OpenAI deployment."
- "Inspect the topic levels and plan an ontology proposal with a one-dollar cap."
- "Run the approved proposal and tell me what version it wrote."

## Use this path

Use this path to bind a state directory to one Topic Graph build output folder and one model deployment, price a proposal, and run it after approval.

## Setup

1. Follow [runtime setup](../../graph-guide/references/install-and-checks.md#plugin-and-clis): explicit `setup ontology`, then `run ontology ontology-build --help`. Retain the `run <domain>` launcher on later commands; warm run never installs.
2. Run `ontology-build doctor --json` first, and again after any blocked result. It only reads, always exits 0, and ends with one `next_step`. Before connecting, pass the same `--tenant-id`, `--model-endpoint`, and `--model-deployment` you will pass to `connect`; Topic Graph checks wait for `connect`. After connecting, keep `--state-dir` to check the saved binding. Read each `warn` detail; it can name a missing flag or an unverified check.
3. Name the tenant before sign-in, then the user runs `az login --tenant <id>`.

### Model readiness

With `--build-args <file>`, the chat deployment comes from the binding. Otherwise `ontology-build doctor --json` names the missing model. Doctor and connect never call the model; the first approved call tests chat access.

### Topic Graph input

`--topic-graph-output <dir>` is required. Pass the `topicgraph_output.directory` that `topic-graph-build verify` reported, unchanged. Keep that folder: ontology-build reads it locally, reads no Topic Graph index, and needs nothing published.

- The source index (endpoint, index name, field mapping, dimensions and filter) comes from the build's own record in that folder. No flag overrides it, and the source index is never changed.
- If the folder holds several topic structures, the build's latest is used; pass `--structure-id <id>` for another. Topic labels are optional: when several labels files match, the latest release's is used, or pass `--labels-id <id>`. With none, the run is unlabeled.
- Connect checks file hashes, membership, hierarchy counts and label identity. Level 0 is the broadest, same numbering as Topic Graph, so a topic has the same level in both. `plan --level N` picks the sampled level; the default is the broadest level with at least 20 topics.
- `--accept-current-source` is required: passage text is read from the source index as it is now, not as it was when Topic Graph ran. The source schema is pinned at connect and checked around each read; missing, blank or duplicate passages block instead of being skipped. Restore source content separately if historical fidelity matters.
- Source access is read-only and Entra only: the signed-in user needs index-schema and document read access on the source index. Only Azure AI Search service hosts are contacted.
- `inspect` and `plan` use local files only. Approved `propose` reads only the selected passages, in batches, and keeps them for resume.
- A changed structure, labels file, source or model needs a new state directory.
- A Topic Graph structure other than version 3 fails with `TOPICGRAPH_STRUCTURE_INVALID`; rebuild it with the pinned build tool.

## Steps

Fill placeholders, nothing else; never ask the user for them.

- `<state>`: one absolute directory kept on every build/consume command (demo: `<run_directory>\ontology`; CLI default `.ontology-state`).
- `<topic-graph-output>`: the absolute `topicgraph_output.directory` from `topic-graph-build verify`.
- Model flags: with an Entity Graph connect file, pass `--build-args <file>`; it fills the tenant, chat model and list price, so skip discovery and ask nothing. Otherwise offer the signed-in subscription by name (`az account show`), list others with `bootstrap.py run entity entity-graph-provision discover --tenant-id <tenant>` only if asked, run `discover --tenant-id <tenant> --subscription-id <sub>`, show its table, ask for a chat model by name (never default, guess or narrow the scope), then run `discover --tenant-id <tenant> --subscription-id <sub> --row <N> --discovery-id <id> --role chat` and use its `args.ontology` flags.
- Prices: never look them up. On `MODEL_PRICE_UNKNOWN`, say the cost is unknown and ask the user for both rates.

On an error, fix only the flag it names; never probe flags with trial runs.

1. Connect. It binds only when doctor has no failing checks; the unverified-chat warning does not block binding. Add `--structure-id` or `--labels-id` only when connect asks for them. `--subscription-id` and `--model-resource-group` add the deployment check:

   ```bash
   ontology-build connect --state-dir <state> --tenant-id <tenant> --topic-graph-output <topic-graph-output> --accept-current-source <args.ontology flags> --model-input-price-per-1m <usd> --model-output-price-per-1m <usd> --json
   ```

2. `ontology-build inspect --state-dir <state> --json` lists topic levels and default sampling. It is free.
3. Plan is free and saves an estimate. If it blocks because the estimate is above the cap, tell the user the cap `next_step` names and ask before re-planning. Show the plan `approval` card and stop.

   ```bash
   ontology-build plan --state-dir <state> --model-max-spend-usd <cap> --json
   ```

4. After the user approves, propose. The amount is the card's "at most" figure unless the user names a lower one at or above the estimate. If it stops part way, rerun the same command; completed calls are not sent again.

   ```bash
   ontology-build propose --state-dir <state> --plan-id <plan-id> --approved-budget-usd <amount> --approve-model-calls --json
   ```

5. To extend an existing ontology, run `ontology-build import --state-dir <state> --as-seed <file> --json` before `plan`.

## After propose

Go to review. Outside the guided demo, also offer a priced [refine](refine-critique-revise.md) with the user's questions; in the demo, refine is only offered in the recap.

## Return

Say what each step is for and what it costs in dollars. Report the new version and its counts in the result's words (types of things, links between them, attributes), and one safe next action, usually review. Never show fingerprints, shards, or the journal unless asked.
