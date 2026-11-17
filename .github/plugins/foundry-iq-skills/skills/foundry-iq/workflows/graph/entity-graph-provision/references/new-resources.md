# New resources setup

Have Search, storage and models already? Use [connect existing](connect-existing-resources.md) instead.

## Quick starts

- "Plan new Azure resources for Entity Graph."

## Use this path

Use this path to create all resources in a new resource group, in one approval: public endpoints with Entra (RBAC) authentication, no keys, IP rules or private networking.

New Search services default to Serverless. Search goes in a region where the graph features are available; ask the user if unsure, and never pick one yourself. Pass the user's region as `--search-location`; without it, everything uses `--location` (default `westus3`). There is no automatic Dedicated fallback.

## Plan: run exactly

Confirm the tenant before sign-in. Resolve the [run name](../../graph-guide/references/run-naming.md) once; the resource group and every resource name default from its prefix. Never ask for names one by one.

- `<tenant>`, `<sub>`: `az account show --query "[tenantId,id]" -o tsv`. Never run `az account tenant list` or install extensions.
- `<oid>`: `az ad signed-in-user show --query id -o tsv`. The operator gets four roles and the Search identity four more; roles already held show as "Already held" and are never re-added.

Before `plan`, show one defaults view: tenant and subscription, the resource group and resource names, Serverless Search in the user's region (default: with the models), storage and models in `westus3`, and models `text-embedding-3-small` and `gpt-5.6-luna` (or "latest"). Ask once: use defaults (recommended) or override any? Never pick another region yourself.

```bash
entity-graph-provision plan --tenant-id <tenant> --subscription-id <sub> --run-prefix <prefix> --state-dir <state-dir> --create-resource-group --public-data-entra --storage-container public-documents --operator-object-id <oid> --embedding-deployment embedding --chat-deployment chat
```

Models are checked against quota read-only. If the corpus has PDFs, Office files or images, add `--content-understanding-name <prefix>-content`: provision then creates that Content Understanding account in `--location` and grants the Search identities Cognitive Services User on it. Leave it off for text-only corpora. On `CONTENT_UNDERSTANDING_REGION_UNSUPPORTED`, offer a re-plan with a supported `--location`. Do not add `--network-*` or `--search-sku`. Do not probe flags with trial runs; on an error, fix only the flag it names. Overrides may add `--location`, `--search-location`, `--openai-location`, `--search-subscription-id` with `--search-resource-group` (Search apart from data), `--embedding-model`, `--chat-model`, `--embedding-capacity` or `--chat-capacity`.

To reuse a model account the user already has (in any subscription, but not the plan's or Search's resource group; for example when short on quota), add `--existing-openai-resource-id <account ARM ID>`, omit `--openai-name` if set, and pass its existing deployment names as `--embedding-deployment` and `--chat-deployment`; `entity-graph-provision discover --row <n>` lists them. Drop `--openai-location`. The plan only grants roles on that account and shows it as "existing, kept"; on `EXISTING_DEPLOYMENT_MISSING` or `EXISTING_DEPLOYMENT_MISMATCH`, ask for the right deployment.

## Apply

1. If `plan` is blocked (`POLICY_DENIED`, `SEARCH_REGION_UNAVAILABLE`, `EXISTING_RESOURCE_CONFLICT`), nothing was created: follow its `next_step`, asking the user for another subscription or region. On `MODEL_QUOTA_SHORT`, show no card; offer a re-plan within the reported headroom (`--embedding-capacity`, `--chat-capacity`) or with another model or region (`--chat-model`, `--location`), or reuse an existing model account (above). Otherwise show the card; the plan already checked region, quota, roles and existing resources, so look nothing up.
2. Ask one Approve/Stop question; never ask the user to type an ID, and re-show the card if cancelled. Then run the plan's `apply_command` exactly, in this conversation with `initial_wait: 600`, and wait; never a subagent or background shell. Status questions while it runs: [apply status](apply-status.md). On `APPROVAL_REQUIRED`, read `differences`: changed flags are your execution error (rerun `apply_command`, no new approval); only changed held roles need a new plan and card.
3. Apply then runs a read-only connect. When it's `ready`, pass `--build-args <build_args_file>` to later steps. Otherwise wait a few minutes and run the connect command its next step prints. With a Content Understanding account, Build also needs `--content-understanding-endpoint https://<name>.services.ai.azure.com` and an embedding deployment on that account, which provision doesn't create.

Stopped run: re-plan with the same flags and the stopped `--run-id` through `plan-resume`, then run `resume-apply --plan-id <new-id> --confirm-writes` after its approval. Never rerun ordinary `apply` or create missing pieces by hand.

## Advanced

- Private networking: without `--public-data-entra`, `plan` renders a review-only private template (`entity-graph-provision render`). The template refuses Serverless and allows private networking only in `westus3` with exact plan approval.
- `--public-test` is a maintainer mode for synthetic data with a 72-hour or shorter expiry label; see [capacity, RBAC and smoke](capacity-rbac-smoke.md).

## Return

State what was planned or applied and the next action. Upload, build and publish need separate approvals.
