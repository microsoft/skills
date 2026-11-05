# Deploy Checklist Template (compaction-safe — generated at Step 5b)

Long-running deploy sessions lose rules when the conversation compacts. At Step 5b, generate a checklist file tailored to this deployment. Write it to disk so it survives compaction — re-reading costs ~100 tokens.

**Write** to `.copilot-azure/sessions/{id}/deploy-checklist.md` using the `create` tool at Step 5b.
**Re-read** via `view` after every long-running command (`az deployment`, `az webapp deploy`, `az acr build`), after each failed health check, and after any conversation compaction.

## How to generate

Read `prepare-plan.json` to determine the service types, then build the checklist from the template below. **Replace `{placeholders}` with real values** and **delete sections that don't apply** (e.g., remove the App Service section for a Container Apps deploy).

```markdown
# Deploy Checklist for {appName}
# RG: {rgName} | Sub: {subscriptionId} | Session: {sessionId}

## ⛔ Secret generation (BEFORE first az deployment)
- Auto-generate ALL `@secure()` params before first `az deployment sub create` — NEVER `ask_user`
- ⛔ On ANY retry OR redeploy (incl. after a conversation compaction): read the SAME `@secure()` value back from Key Vault (source of truth) or `deploy-audit.log` — NEVER regenerate. A secret that's both applied to a resource AND stored in KV desyncs if regenerated: e.g. a DB module re-applying `administratorLoginPassword` re-sets the server admin but not the KV secret the app reads → auth 500s while provisioning still reports success.

## ⛔ Read deploy/PHASE.md
- You MUST `view` deploy/PHASE.md BEFORE running any `az deployment` command
- Path: `plugin/skills/azure-app-onboard/deploy/PHASE.md`
- If you have not read it in this conversation (or since the last compaction), read it NOW
- It covers preflight checks, portal links, what-if, SCM lifecycle, deploy-result.json schema, audit logging, and health checks — skip it and none of these happen

## After every `az` command
- Append 2 lines to `deploy-audit.log`: `{timestamp} | {command} | started` then `{timestamp} | {command} | succeeded/failed`

## After IaC deployment (Step 6)
- Verify 5 tags: `az group show -n {rgName} --query tags`
- ⛔ Do NOT set startup command or app settings via CLI — they are already in Bicep from scaffold. If `az webapp show` doesn't reflect them yet, wait 30s and re-check (ARM propagation delay). Do NOT run `az webapp config` imperatively.
  Required: app-onboard-skill, app-onboard-session-id, created-at, environment, deployed-by
- Verify portal link is still correct if healing changed the deployment name

## Code deploy — App Service (delete if not using App Service)
- ⛔ **Deploy command: `az webapp deploy --type zip`** (Entra-capable, supports `--async`). NEVER `az webapp deployment source config-zip` — it needs SCM basic auth and is disallowed.
- Wait for stabilization: `az webapp show -g {rgName} -n {appName} --query state` → "Running"
- Verify `SCM_DO_BUILD_DURING_DEPLOYMENT=true` is active before deploy (ARM timing can delay)
- If build reports "0 seconds" but app needs deps: re-set the setting, wait 10s, retry
- If 0s persists after 2 retries: fall back to Kudu `/api/zipdeploy`
- Python: if no `antenv/` after deploy, use Kudu `/api/zipdeploy` immediately (OneDeploy may skip Oryx)
- Windows zip paths: normalize with `.Replace('\', '/')` before creating zip entries
- ⛔ Verify ORYX_DISABLE_COMPRESSION=true is set (prevents output.tar.zst extraction failures at startup — applies to ALL tiers, not just F1)
- Set WEBSITES_CONTAINER_START_TIME_LIMIT=1800 for safety
- TypeScript apps: verify `typescript` and `@types/*` are in `dependencies` (not devDependencies) — Oryx with NODE_ENV=production skips devDeps. Alternative: set app setting NPM_CONFIG_PRODUCTION=false
- Enable SCM before zip deploy, re-disable after: `az rest --method put` → allow:false → verify
- After deploy: check response body for Azure default page ("Your app service is up and running" = app didn't start)

## Code deploy — Container Apps (delete if not using Container Apps)
- Phase 2 is NOT optional — deploy actual image, don't leave placeholder
- Wait ~60s for RBAC propagation (AcrPull role) before code deploy
- BuildKit Dockerfiles: create Dockerfile.azure without --mount syntax
- Pass real image on EVERY Bicep redeploy: --parameters containerImage='{acr}/{app}:latest'
- KV secrets: `revision restart` does NOT refresh — must create new revision
- ACR build failures count toward healing counter
- Windows: append `--no-logs` to `az acr build` to avoid UnicodeEncodeError
- ⛔ After the revision is ready, run an explicit live HTTP probe against the ingress FQDN (`curl -sSfL`/`iwr` on `*.azurecontainerapps.io`) — this call IS the health check; capture the result into `deploy-result.json.endpoints[].healthStatus`.

## Code deploy — Static Web Apps (delete if not using SWA)
- ⛔ **Build before deploy (SPA only):** If the SWA component has a manifest (`package.json`) with a `build` script: detect the package manager from the lockfile, run install + build, then deploy the build output directory (not raw source). Plain HTML repos (no manifest): skip build, deploy source directly.
- ⛔ **Build-time env vars:** Before `npm run build`, set `VITE_API_BASE_URL` / `NEXT_PUBLIC_API_URL` / `REACT_APP_API_URL` to the deployed backend URL from `deploy-result.json.endpoints[]`. These are baked into the JS bundle at build time — runtime SWA env vars have no effect on client-side code.
- If frontend config references cloud SDK endpoints (AWS API Gateway, GCP), update with deployed Azure backend URLs from `deploy-result.json.endpoints[]` before `swa deploy`
- Use `swa deploy` (NOT `az staticwebapp deploy` — doesn't exist)
- `--app-name {swaName}` is mandatory
- Store token in $env:SWA_CLI_DEPLOYMENT_TOKEN — never as CLI arg

## During healing / retries
- ⛔ REGION LOCK: Deploy region MUST match plan region ({region}). Any region change → RE-PRESENT deploy approval gate with old and new region. Do NOT silently switch. After approval: update `prepare-plan.json.services[].region`, `deploymentVariables.location`, AND append attempt number to `naming.suffix` (e.g., `edd6` → `edd602`). Recompute ALL resource names from the new suffix before redeploying — globally unique names (App Service, Key Vault) from the old region may be soft-deleted and unavailable.
- ⛔ IaC-only: NEVER use `az containerapp update --image`, `az webapp update`, `az appservice plan delete`, or `az group create` — fix the Bicep and redeploy via `az deployment sub create`
- ⛔ IaC-only for app-managed roles: NEVER `az role assignment create` for AcrPull or KV Secrets User — Bicep-managed (deterministic GUID), so an imperative grant collides on redeploy (`RoleAssignmentExists`). Missing app role = fix the Bicep module and redeploy. (Deployer/subscription-scope 403s are the ONLY exception — see [`error-classification.md`](error-classification.md).)
- ⛔ **On error: read [`error-classification.md`](error-classification.md)** to classify the failure and follow the prescribed remediation. Do NOT ad-hoc heal without reading the classification.
- ⛔ **Never weaken a security control to unblock** — do NOT flip `require_secure_transport`/TLS, HTTPS-only, KV purge protection, or auth OFF to make a failing deploy pass. A DB TLS handshake failure = fix the client SSL config (prereq `W-MYSQL-SSL`) or ask the user; never downgrade the server.
- Count ALL attempts in deploy-result.json.healingAttempts[]
  After 3: STOP and ask user ("Yes / I have a suggestion / Stop")
- NEVER run `az group delete` — track in orphanedResourceGroups[]
- ⛔ **RG deletion timeout:** If you ran `az group delete --no-wait`, wait max 2 minutes then `ask_user`: "Resource group deletion is slow. Wait longer / Proceed without cleanup / Cancel." Do NOT poll indefinitely.
- Region/SKU/service changes require re-approval gate

## Before handoff (Step 8)
- ⛔ Read [`deploy-schemas.ts`](deploy-schemas.ts) for exact DeployResult field names
- Finalize `deploy-result.json` — overwrite skeleton IN PLACE (keep exact field names, do NOT rename): status (lowercase `succeeded`/`failed`), resourceGroupName, subscriptionId, deploymentNames (all used), resourceIds, endpoints, healthStatus (worst across endpoints), duration.completedUtc, resourceResults from `az deployment operation list`. Read back to verify.
- ⛔ `deployment-summary.md` — generate from `deploy-result.json` fields (Status, Health, Portal Links, Cleanup). NOT a separate data source.
- ⛔ `context.json` — add "deploy" to completedPhases, set currentPhase to null, update lastModifiedUtc. VERIFY by reading back.
- SCM re-disabled (App Service) or image param set (Container Apps)
- If prereq found migration frameworks: run migrations before declaring healthy

## Artifact verification (Step 8 — MANDATORY)
⛔ Before returning to orchestrator, verify ALL artifacts exist by reading each one back:
1. `deploy-result.json` — MUST contain (exact names): `status` (lowercase `succeeded`/`failed`), `resourceGroupName`, `subscriptionId`, `deploymentNames[]`, `resourceIds[]`, `endpoints[]`, `healthStatus`, `duration.completedUtc`, `resourceResults[]`. Missing/renamed fields → rewrite with real values NOW
2. `deploy-audit.log` — MUST exist with ≥2 entries (started + result for at least 1 command). Missing → reconstruct from memory
3. `deployment-summary.md` — MUST contain Status, Health, Portal Links sections. Missing → generate from deploy-result.json
4. `context.json` — MUST have `"deploy"` in `completedPhases`, `currentPhase: null`, updated `lastModifiedUtc`
5. ⛔ **Endpoint completeness** — EVERY service in `prepare-plan.json.services[]` that hosts application code MUST have a corresponding entry in `deploy-result.json.endpoints[]` with code deployed and a valid `healthStatus` (`healthy`, `degraded`, `unreachable`, `unknown`). If ANY compute endpoint is missing or has code not deployed, set `partial: true` and `status: "failed"`. A deployment with undeployed user components is NOT `"succeeded"`.

If ANY artifact is missing or incomplete, write it NOW — do NOT return to orchestrator without all 5 checks passing.

⛔ **Then STOP — return to orchestrator. No further CLI commands or skill invocations.**
```
