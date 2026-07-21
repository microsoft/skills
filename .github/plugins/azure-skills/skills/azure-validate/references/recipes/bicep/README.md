# Bicep Validation

Validation steps for standalone Bicep deployments.

## Prerequisites

- `./infra/main.bicep` exists
- `./infra/main.parameters.json` exists
- Azure CLI authenticated

## Validation Steps

- [ ] 1. Core Validation (CLI, auth, build, validate, what-if) — run [`validate-deployment` script](../scripts/validate-deployment.sh)
- [ ] 2. Linting (optional)
- [ ] 3. Azure Policy Validation

## Validation Details

### 1. Core Validation Script

The core validation checks are a fixed, deterministic sequence — identical to the AZCLI
recipe. Run the shared **validate-deployment** helper instead of executing and parsing each
command by hand. It confirms the Azure CLI is installed and authenticated, compiles the Bicep
template (`az bicep build`), validates it against the target scope (`az deployment ...
validate`), and runs a what-if preview — printing a compact PASS/FAIL summary plus a what-if
change count (Create/Modify/Delete).

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

- `OVERALL: PASS` — all checks passed; record the summary in Section 7 (Validation Proof).
- Any step `FAIL` — the script prints the failing command's error. If **Authenticated** fails,
  run `az login`. Otherwise see [Error handling](./errors.md).

### 2. Linting (optional)

Use Bicep linter rules:

```bash
az bicep lint --file ./infra/main.bicep
```

### 3. Azure Policy Validation

See [Policy Validation Guide](../../policy-validation.md) for instructions on retrieving and validating Azure policies for your subscription.

## Checklist

| Check | Command | Pass |
|-------|---------|------|
| Core validation (CLI, auth, build, validate, what-if) | `validate-deployment` script | ☐ |
| Policies validated | MCP Policy tool | ☐ |

## References

- [Error handling](./errors.md)

## Next

All checks pass → **azure-deploy**
