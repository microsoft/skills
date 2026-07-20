# Aspire Validation

> ⚠️ **Only load this file when the project is a .NET Aspire application.**

Validation steps specific to .NET Aspire projects deployed via AZD.

## Detection

A project is Aspire-based if any of these are true:

| Indicator | Check |
|-----------|-------|
| AppHost project | `find . -name "*.AppHost.csproj"` |
| Aspire.Hosting package | `grep -r "Aspire.Hosting" . --include="*.csproj"` |

**If none found → skip this file entirely.**

---

## Pre-Provisioning: Functions Secret Storage

> ⚠️ **CRITICAL — Must run BEFORE `azd provision`.**

Check if the project uses Azure Functions within Aspire and ensure `AzureWebJobsSecretStorageType` is configured.
See [Aspire Functions Secrets Reference](../../aspire-functions-secrets.md) for detection commands, fix examples, and full details.

**If `AddAzureFunctionsProject` is NOT found**, skip this section.

---

## Post-Provisioning: Container Apps Environment Variables

> ⚠️ **CRITICAL — Run AFTER `azd provision` but BEFORE `azd deploy`.**

When using Aspire with Container Apps in "limited mode" (in-memory infrastructure generation), `azd provision` creates Azure resources but doesn't automatically populate environment variables that `azd deploy` needs.

**Run the helper script** ([scripts/set-aspire-aca-env.sh](scripts/set-aspire-aca-env.sh) or [scripts/set-aspire-aca-env.ps1](scripts/set-aspire-aca-env.ps1)). It sets `AZURE_CONTAINER_REGISTRY_ENDPOINT`, `AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID`, and `MANAGED_IDENTITY_CLIENT_ID` (only the ones that are missing).

**bash:**
```bash
./scripts/set-aspire-aca-env.sh          # or: -e <azd-env-name>
```

**PowerShell:**
```powershell
./scripts/set-aspire-aca-env.ps1         # or: -Environment <azd-env-name>
```
