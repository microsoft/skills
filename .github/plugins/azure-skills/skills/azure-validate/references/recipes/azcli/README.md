# AZCLI Validation

Validation steps for Azure CLI deployments.

## Prerequisites

- `./infra/main.bicep` exists
- Docker available (if containerized)

## Validation Steps

- [ ] 1. Core Validation (CLI, auth, build, validate, what-if) — run [`validate-deployment` script](../scripts/validate-deployment.sh)
- [ ] 2. Docker Build (if containerized)
- [ ] 3. Azure Policy Validation

## Validation Details

### 1. Core Validation Script

The core validation checks are a fixed, deterministic sequence. Run the shared
**validate-deployment** helper instead of executing and parsing each command by hand. It
confirms the Azure CLI is installed and authenticated, compiles the Bicep template
(`az bicep build`), validates it against the target scope (`az deployment ... validate`),
and runs a what-if preview — printing a compact PASS/FAIL summary plus a what-if change
count (Create/Modify/Delete).

- Bash: [`../scripts/validate-deployment.sh`](../scripts/validate-deployment.sh)
- PowerShell: [`../scripts/validate-deployment.ps1`](../scripts/validate-deployment.ps1)

**Subscription scope:**

```bash
../scripts/validate-deployment.sh --scope sub --location <location>
```
```powershell
../scripts/validate-deployment.ps1 -Scope sub -Location <location>
```

**Resource group scope:**

```bash
../scripts/validate-deployment.sh --scope group --resource-group <rg-name>
```
```powershell
../scripts/validate-deployment.ps1 -Scope group -ResourceGroup <rg-name>
```

Defaults: `--template ./infra/main.bicep`, `--parameters ./infra/main.parameters.json`
(skipped if absent). Pass `--subscription <id>` to target a specific subscription.

**Interpreting results:**

- `OVERALL: PASS` — all five checks passed; record the summary in Section 7 (Validation Proof).
- Any step `FAIL` — the script prints the failing command's error. Remediate:
  - **Authenticated** fails → `az login`, then `az account set --subscription <id>`.
  - **Azure CLI installed** fails → install via `mcp_azure_mcp_extension_cli_install(cli-type: "az")`.
  - Otherwise see [Error handling](./errors.md).

### 2. Docker Build (if containerized)

**Before building**, validate the Docker build context:

1. Read the `Dockerfile` in `./src/<service>`
2. If the Dockerfile contains `npm ci`, verify `package-lock.json` exists in the same directory
3. If `package-lock.json` is missing, generate it:

```bash
cd ./src/<service>
npm install --package-lock-only
```

**Then build:**

```bash
docker build -t <image>:test ./src/<service>
```

### 3. Azure Policy Validation

See [Policy Validation Guide](../../policy-validation.md) for instructions on retrieving and validating Azure policies for your subscription.

## References

- [Error handling](./errors.md)

## Next

All checks pass → **azure-deploy**
