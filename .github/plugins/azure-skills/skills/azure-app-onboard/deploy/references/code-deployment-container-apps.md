# Code Deployment — Container Apps

After IaC deployment creates the Container App with a placeholder image (`mcr.microsoft.com/azuredocs/containerapps-helloworld:latest`), deploy the actual application code. This is **Phase 2** of the two-phase Container Apps deployment pattern.

> ⛔ **`--subscription {subscriptionId}` on EVERY `az` command** (from `context.json.azure.subscriptionId`). Without it, the CLI uses whatever subscription is currently active — which may have changed since the prepare phase. This applies to ALL commands below.

> ⛔ **Phase 2 is NOT optional.** If IaC deployed a Container App with a placeholder image, you MUST execute Phase 2 before health checks. Do NOT leave a placeholder image and tell the user to deploy code manually.

**Determine the code deploy path:**

| Condition | Path | Steps |
|-----------|------|-------|
| ACR exists in IaC (`services[]` has Container Registry) | ACR build + image update | Steps 1–4 below |
| No ACR in IaC, simple app (single Dockerfile or source) | Add ACR to IaC + redeploy, then ACR build | Step 0 + Steps 1–4 |
| No ACR in IaC, no Dockerfile, Oryx-compatible (Node/Python/Go/.NET) | `az containerapp update --source .` | Step 5 (Oryx shortcut) |

## Step 0 — Add ACR to IaC (if not already present)

Add `container-registry.bicep` module (ACR Basic, `adminUserEnabled: false`) + AcrPull role assignment for CA's managed identity (role GUID: `7f951dda-4ed3-4680-a7ca-43fe172d538d`). Redeploy IaC, wait ~60s for AcrPull role propagation. Log as healing attempt.

⛔ Update `prepare-plan.json` (add ACR to `services[]`), `scaffold-manifest.json.files[]`, and `costEstimate`.

## Steps 1–4 — ACR Build + Image Update (IaC-compliant)

| Step | Command | Notes |
|------|---------|-------|
| 1. Build image | `az acr build --subscription {subscriptionId} -r {acrName} -t {appName}:latest . --no-logs` | Builds from workspace root. If `buildRequirements.hasBuildKitSyntax`, use `-f Dockerfile.azure` (see BuildKit handling below). ⛔ **Build-time env vars:** If Dockerfile has `ARG NEXT_PUBLIC_*` or `ARG VITE_*`, pass `--build-arg NEXT_PUBLIC_API_URL=https://{api-fqdn}` to inject the deployed API URL. These vars are baked into the JS bundle at build time — runtime env vars have no effect on client-side code. Get the API FQDN from Phase 1 output: `az containerapp show -g {rg} -n {apiApp} --query properties.configuration.ingress.fqdn -o tsv`. |
| 2. Update Bicep image | Edit `infra/modules/{containerapp}.bicep`: replace placeholder with `image: '{acrLoginServer}/{appName}:latest'`. Add ACR registry config: `registries: [{ server: acrLoginServer, identity: 'system' }]` | IaC-only — no imperative `az containerapp update` |
| 3. Redeploy | `az deployment sub create --subscription {subscriptionId} --location {location} --template-file infra/main.bicep --parameters @infra/main.parameters.json --parameters administratorLoginPassword=$dbPassword --name app-onboard-code-deploy-{timestamp} --query properties.provisioningState -o tsv` | Emit new portal link. ⛔ `$dbPassword` = existing KV secret, never new/placeholder — see [Parameter Pass-Through](#parameter-pass-through-bicep-redeploy-safety). |
| 4. Verify revision | `az containerapp show --subscription {subscriptionId} -g {rg} -n {ca} --query "{revision:properties.latestReadyRevisionName, image:properties.template.containers[0].image}" -o json` | Confirm image is not the placeholder |

> ⛔ **`az acr build` failures count toward the `deploy-result.json.healingAttempts[]` counter.** After 3 failed builds (even with different root causes), pause and present a diagnosis to the user: "Web image build failed 3 times: [root causes]. Continue healing? (Yes / Cancel)." Each build fix attempt = 1 healing entry. Cross-reference deploy PHASE.md healing loop rule.

> ⛔ **Windows: `az acr build` may fail with `UnicodeEncodeError`.** Azure CLI log streaming crashes on non-ASCII characters (✓, ✗) using Windows `charmap` codec. Append `--no-logs` to the build command. Build success/failure is still reported via exit code.

## Step 5 — Oryx Shortcut (no ACR needed, no Dockerfile)

```powershell
az containerapp update --subscription {subscriptionId} -g {rg} -n {ca} --source . --set-env-vars NODE_ENV=production
```

> ⛔ **`az containerapp update --source` is allowed for code deploy ONLY.** This is different from `az containerapp up --source` (which is ⛔ BLOCKED because it creates resources imperatively). `update --source` updates an EXISTING Container App — no state drift.

## Seed KV Secrets (between Phase 1 and Phase 2)

After Phase 1, seed real secret values into KV before Phase 2 activates `secretRef`:

```powershell
az keyvault secret set --subscription {subscriptionId} --vault-name {kvName} --name {secret-name} --value $generatedValue
```

> ⛔ Use the SAME generated password passed to `az deployment sub create`. Shell variables don't persist between tool calls — reload from `deploy-secrets.env` (see deploy-safety.md § Deploy Checklist) or pass to BOTH commands in the same block.

## After Code Deploy (all paths)

- Wait 30–60s for the new revision to become ready
- Proceed to Step 7 (Health-Check Endpoints)
- If health check returns placeholder content → image update didn't take effect. Check `az containerapp revision list`

> ⛔ **`az containerapp revision restart` does NOT re-resolve KV secrets.** Container Apps caches KV-backed `secretRef` values at revision *creation* time. To pick up updated KV secrets, create a NEW revision by redeploying Bicep (preferred) or `az containerapp update --revision-suffix rev{timestamp}`. Do NOT use `revision restart` for KV secret rotation — it only restarts the container with the same cached values.

> ⛔ **KV secretRef AND ACR registries require managed identity + roles to exist first.** Phase 1 of the two-phase deploy creates the Container App with a placeholder image, `registries: []`, and `secrets: []`. Both KV `secretRef` and ACR `registries` with `identity: 'system'` fail in Phase 1 because the CA's managed identity doesn't exist yet (no principalId → AcrPull/KV role assignment fails → "Operation expired"). After Phase 1 completes and RBAC propagates (~60s), Phase 2 redeploys with ACR registries + KV secretRef + real image + correct `targetPort`.

## Config-File Apps (Go/Viper, Spring Boot, etc.)

Creating Azure-specific config (e.g., `config-azure.yml`) is fine for non-secret values.

> ⛔ **NEVER bake secrets into config files COPY'd into Docker images.**

**Secret injection:** Config uses placeholders → `az containerapp secret set` → `az containerapp update --set-env-vars KEY=secretref:name` → framework env var override.

> **Go/Viper:** `AutomaticEnv()` maps `POSTGRES_PASSWORD` → `postgres_password` (underscores), NOT `postgres.password`. Without `SetEnvKeyReplacer(strings.NewReplacer(".", "_"))`, env vars can't override nested keys.

## BuildKit Dockerfile Handling

ACR's `az acr build` uses the classic Docker builder — it does NOT support BuildKit. When `buildRequirements.hasBuildKitSyntax == true`: build using the ACR-compatible copy instead: `az acr build -f Dockerfile.azure .`. The user's original Dockerfile stays untouched. If `Dockerfile.azure` doesn't exist yet, create it by stripping BuildKit syntax from the original Dockerfile per [`dockerfile-generation.md § ACR Build Compatibility`](../../scaffold/references/dockerfile-generation.md).

## Parameter Pass-Through (Bicep Redeploy Safety)

⛔ **On every redeploy, pass the SAME values you originally used** — a full desired-state apply, not a patch, so an omitted param reverts to its default and a regenerated secret overwrites the live value. Two params bite:

- **`containerImage`** — omitting it reverts the Container App to the placeholder image.
- **`administratorLoginPassword`** (DB modules) — passing a new or placeholder value silently RESETS the database admin password, desyncing it from the Key Vault secret the app reads → runtime auth failures (`Access denied for user`).

```powershell
$dbPassword = az keyvault secret show --subscription {subscriptionId} --vault-name {kvName} --name {db-secret} --query value -o tsv
az deployment sub create ... `
  --parameters containerImage='{acrLoginServer}/{appName}:latest' `
  --parameters administratorLoginPassword=$dbPassword `
  --query properties.provisioningState -o tsv
```

## Database Post-Deploy Verification

> ⛔ **You MUST read [`database-post-deploy.md`](database-post-deploy.md)** for migration discovery, execution via Container Apps exec, error handling, and PostgreSQL-specific checks.
