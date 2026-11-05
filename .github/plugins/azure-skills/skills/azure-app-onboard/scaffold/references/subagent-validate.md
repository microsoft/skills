# Subagent Template — Validation & Manifest (Steps 10–12)

Validate IaC syntax, write `scaffold-manifest.json`, and generate deploy checklist. Follow the workflow below.

## Critical Rules

- ⛔ **Do NOT invoke ANY skills** — no `{"skill": "azure-validate"}`, `{"skill": "azure-deploy"}`, `{"skill": "azure-prepare"}`, or any other skill call. Use the procedures in THIS file only.
- ⛔ **Do NOT create or modify Azure resources** — validation is syntax-only (`bicep build` / `terraform validate`), never `az deployment sub create`.
- ⛔ **Do NOT run `what-if` or `terraform plan`** — deploy runs the mandatory what-if with real secret params. Scaffold validates syntax only.

## Input (provided by caller)

| Field | Required |
|-------|----------|
| IaC file paths (all generated `.bicep` or `.tf` files) | YES |
| Self-review findings from Steps 6–9 | YES |
| `prepare-plan.json` — services, naming, region, subscriptionId | YES |
| `prereq-output.json.warnings[]` — prereq warnings with `fixPhase` | YES |
| `prereq-output.json.healthEndpoint` — detected health path (or `null`) | YES |
| Conformance result JSON (from main-thread Step 10a-conf) | YES |

## Output

| Artifact | Location |
|----------|----------|
| `scaffold-manifest.json` | Session folder |
| `deploy-result.json` skeleton | Session folder |
| Validation result status | Return to caller: `Validated` or `Failed` |
| Deploy checklist | `.copilot-azure/sessions/{id}/deploy-checklist.md` |

## Workflow

### Step 1 — Read validation + manifest rules

Read [validation-and-manifest.md](validation-and-manifest.md) and [scaffold-schemas.ts](scaffold-schemas.ts).

**Do:** Understand the `ScaffoldManifest` interface (field names, types, required fields) and the validation sequence.

### Step 2 — Format and validate IaC

**Do:**
1. Run `az bicep build --file infra/main.bicep --stdout > $null` (Bicep) or `terraform validate` (TF). Process output for BCP errors and warnings. Record pass/fail.

### Step 3 — Check RBAC completeness

**Do:** Verify every managed identity ↔ resource pair in the IaC has a corresponding `Microsoft.Authorization/roleAssignments` resource with the correct role GUID. Cross-reference with the review findings from Steps 6–9 input.

### Step 3b — Azure runtime constraint check (Container Apps)

> Skip if no Container Apps in the plan.

For each Container App resource in the generated Bicep:

1. **cpu/memory combo** — verify `cpu` (must be type `string`) + `memory` is one of: `0.25/0.5Gi`, `0.5/1Gi`, `0.75/1.5Gi`, `1/2Gi`, `1.25/2.5Gi`, `1.5/3Gi`, `1.75/3.5Gi`, `2/4Gi`. FIXABLE: adjust to nearest valid combo (use smallest valid combo for sidecars/companions).
2. **secretRef coverage** — every `secretRef` in container env vars must have a matching entry in `configuration.secrets[]`. Every KV secret URL in `secrets[]` must reference a `Microsoft.KeyVault/vaults/secrets` resource that exists in the generated modules. Missing secret resource → FIXABLE: add it to the KV module.
3. **probe path** — if `prereq-output.json.healthEndpoint` is non-null, verify `probePath` matches it. If null AND any `plainEnvVars` entry is named `BASE` or `PATH_PREFIX`, verify `probePath` starts with that value (not bare `/`). If null AND no BASE var: verify the app has a route handler for the probe path (check source entry point for `app.get('/')` or framework root handler) — bare `/` on a REST API with only sub-path routes (e.g., `/users`, `/messages`) returns 404 and blocks revision activation. FIXABLE: update `probePath` to a known GET endpoint from the app.

FIXABLE errors: fix the Bicep → re-run `az bicep build` → proceed to Step 3c.

### Step 3b2 — App Service security constraint check

> Skip if no App Service or Functions in the plan.

For each App Service / Functions resource in the generated Bicep:

1. **basicPublishingCredentialsPolicies** — verify both child resources exist: `basicPublishingCredentialsPolicies/scm` (with `allow: true`) and `basicPublishingCredentialsPolicies/ftp` (with `allow: false`). Missing → FIXABLE: add the child resources per [bicep-patterns-security.md](bicep-patterns-security.md) § Publishing Credential Lockdown.
2. **uniqueString in naming** — verify the App Service name uses `uniqueString()` or a unique suffix (not a hardcoded literal). Hardcoded names cause global collisions. Missing → FIXABLE: wrap name with `uniqueString(resourceGroup().id)`.

FIXABLE errors: fix the Bicep → re-run `az bicep build` → proceed to Step 3c.

### Step 3c — Record plan conformance result

The main thread (PHASE.md Step 10a-conf) already ran the conformance script and passed you its JSON. Record it in `scaffold-manifest.json.conformance` = `{ passed, failures, source: "script" }`. ⛔ Do NOT set `validationResult.status: "Validated"` while any BLOCK failure is unresolved.

**Fallback** (only if the caller passed NO result AND `infra/main.bicep` exists — the gate is Bicep-only, skip for Terraform): run `{scaffoldDir}/scripts/scaffold-conformance.ps1 -SessionPath "{sessionPath}" -InfraPath infra` (or `.sh` on bash) yourself, then record with `source: "script"`. Never hand-judge when a shell is available.

### Step 4 — Write scaffold-manifest.json

Read [scaffold-schemas.ts](scaffold-schemas.ts) for exact field names.

**Do:** Write `scaffold-manifest.json` to the session folder with: `sessionId`, `scaffoldCompletedUtc`, `iacFormat`, `targetScope`, `entryPoint`, `parametersFile`, `files[]`, `deployCommand`, `twoPhaseWiring` (if Container Apps), `phase2Steps` (if applicable), `selfReview` (from caller input), `validationResult` (from Steps 2–3). Use the exact field names from [scaffold-schemas.ts](scaffold-schemas.ts) § `ScaffoldManifest`.

### Step 5 — Handle failures (if any)

Read [scaffold-healing-rules.md](scaffold-healing-rules.md) ONLY if validation failed.

**Do:** Classify errors as FIXABLE or BLOCKING. FIXABLE: auto-fix IaC → re-validate (max 3 attempts before asking user). BLOCKING: surface to user and halt. PLAN_LEVEL_CHANGE: requires re-approval — do NOT auto-fix.

### Step 6 — Verify deploy checklist exists

**Do:** Check that `.copilot-azure/sessions/{id}/deploy-checklist.md` exists (written by the parallel checklist subagent at scaffold Step 5b). If missing, read [`deploy-checklist-template.md`](../../deploy/references/deploy-checklist-template.md) and write it now as a fallback — fill `{placeholders}` from `prepare-plan.json`, delete non-applicable sections. This file survives conversation compaction

### Step 7 — Create deploy-result.json skeleton (MANDATORY)

Read [`deploy-schemas.ts`](../../deploy/references/deploy-schemas.ts) — specifically the `DeployResult` interface.

**Do:** Create `.copilot-azure/sessions/{id}/deploy-result.json` conforming to the `DeployResult` interface. Populate fields from all session artifacts already written (`prepare-plan.json`, `context.json`, `scaffold-manifest.json`, `prereq-output.json`). Use sensible defaults for fields the deploy phase will fill later. The deploy main agent updates this file in-place at Step 8 with real values.

### Step 8 — Return results

**Do:** Return validation status (`Validated` or `Failed`) to the caller. Confirm deploy-checklist.md exists. Keep status report ≤500 tokens.
