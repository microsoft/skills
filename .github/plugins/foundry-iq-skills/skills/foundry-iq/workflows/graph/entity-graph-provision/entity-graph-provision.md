# Entity Graph provision

Use [setup's launcher](../graph-guide/references/install-and-checks.md#plugin-and-clis). Load one path.

| Intent | Load |
|---|---|
| Readiness | Only `entity-graph-provision doctor`: CLI, sign-in, tenant/sub, journal; no reference or questions. |
| Existing resources | [Connect existing](references/connect-existing-resources.md) |
| New resources (default) | [New resources](references/new-resources.md) |
| Quota, TPM, RBAC, smoke, cleanup | [Capacity, RBAC, smoke](references/capacity-rbac-smoke.md) |

## Shared rules

Named runs: [run naming](../graph-guide/references/run-naming.md); retain the binding.

Run that doctor first and after any block; follow `next_step`. Name tenant before sign-in; never run `az account tenant list` or `az account set`. Offer **Use existing** or **Create new** Azure resources; never ask for tenant, sub or RG in `az account show`.

Write gates (`plan`, `connect`, `plan-capacity`, `plan-rbac`) return `APPROVAL:`. On a blocker, explain it, offer a re-plan, show no card, and stop and report the blocker. Otherwise show the runtime `approval_card` verbatim; never write or paraphrase your own approval text, never promise behavior the plan omits, and create nothing outside the CLI (no raw `az`/REST). Show each `discover` tier verbatim; the user picks the subscription, models and cache account; never guess or reuse source as cache. Ask one Approve/Stop question; never ask the user to type an ID. Then run `apply`, `connect-apply`, `rbac-grant` or `capacity-update` with `--plan-id <id> --confirm-writes` here and wait. Never retry or clean up alone.

Defaults: `gpt-5.6-luna`, `text-embedding-3-small`. `--chat-model latest` selects newest; Terra/Sol are fine. Embeddings stay unless named: fixed at ingestion. No invented scores.

Only the new-resources plan and connect write. No secrets or build/query.
