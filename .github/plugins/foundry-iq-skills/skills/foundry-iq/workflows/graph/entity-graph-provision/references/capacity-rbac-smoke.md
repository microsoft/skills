# Capacity, RBAC, smoke

## Quick starts

- "Review TPM quota, RBAC, and the smoke plan for this environment."
- "Raise the chat deployment capacity."

## Use this path

Use this path for model quota and capacity, role checks, and cleanup evidence. Public-data `apply` and connect's setup plan already grant the required roles.

## Capacity

New deployments use the free quota up to 200K TPM for embeddings and 250K TPM for chat; with less free, the card says what it took (at least 50K).
Explicit role capacities override these defaults. Connect preserves observed
existing capacities and never automatically resizes a deployment. Even when
200K is desired, resizing an existing deployment needs its own exact approval.

1. `entity-graph-provision quota` (read-only) reads regional usage and the model catalog with the same deployment flags.
2. `entity-graph-provision plan-capacity --capacity-deployment <name> --capacity <K>` shows current and desired capacity (thousands of tokens per minute), quota headroom, and the plan ID. Only SKU capacity changes; PTU is out of scope.
3. After the user approves the card, run `entity-graph-provision capacity-update` with the same flags plus `--plan-id <id> --confirm-writes`. It refuses on drift or insufficient quota and verifies by fresh read. Above the quota limit, a quota request comes first.

## RBAC

`plan-rbac`, `rbac-check`, `rbac-grant`, `plan-smoke` and `smoke-run` require `--public-test`, a maintainer-only synthetic test mode. For a user's resources, review roles with `connect` instead.

1. `plan-rbac` and `rbac-check` are read-only and check the active tenant, subscription and object ID. A role you already hold directly, through a group (nested too) or at a parent scope is left off the card with an "Already held" note.
2. After approval, `entity-graph-provision rbac-grant` grants only the remaining exact scoped data roles; it rereads first and stops if what you hold changed.
3. Content Understanding lets Build read PDFs, Office files and images; text-only corpora never need it. Use `--content-understanding-name` only in public-data plans, which create the account and grant the Search identities Cognitive Services User on it. `--public-test` refuses the flag, so `rbac-grant` never covers it. For an account provision didn't create, the account owner grants that role. The account must be in a Content Understanding region (australiaeast, canadacentral, eastus, eastus2, japaneast, southcentralus, southeastasia, swedencentral, uksouth, westeurope, westus, westus3, as listed on [language and region support](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/language-region-support) on 2026-11-13). It also needs an embedding model deployment named like the Build's embedding deployment, but no chat deployment because Build turns off image verbalization. Build apply checks all three read-only: it blocks with `CONTENT_UNDERSTANDING_EMBEDDING_MISSING` or `CONTENT_UNDERSTANDING_ROLE_MISSING`, and warns with `CONTENT_UNDERSTANDING_REGION_UNSUPPORTED`. Create a missing deployment in an approved step, never mid-flow.

## Smoke test

`plan-smoke` then `smoke-run` (synthetic test mode only, own approval) checks Blob, Search and embedding access, not an Entity Graph workflow.

## Cleanup

`plan-cleanup --run-id <id>` is offline and manual-only. `cleanup-approve --run-id <id> --plan-id <id>` records approval and never deletes Azure resources.

## Return

Separate reviewed plans from applied changes, and give one safe next action.
