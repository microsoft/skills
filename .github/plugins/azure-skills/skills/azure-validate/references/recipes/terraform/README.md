# Terraform Validation

Validation steps for Terraform deployments.

## Prerequisites

- `./infra/main.tf` exists
- State backend accessible

## Run the preflight script

Run the pre-built validation script instead of executing each check by hand. It runs the
full deterministic preflight sequence in one call and prints a compact **PASS / FAIL / SKIP**
summary plus captured error text for any failed step — jump straight to remediation without
re-parsing raw command output.

| Script | Purpose |
|--------|---------|
| [`scripts/validate-terraform.sh`](scripts/validate-terraform.sh) | Bash preflight runner |
| [`scripts/validate-terraform.ps1`](scripts/validate-terraform.ps1) | PowerShell preflight runner |

The script runs, in order: Terraform installed → Azure CLI installed → authenticated
(`az account show`) → `terraform init` → `fmt -check` → `validate` → `plan` →
`state list` → Go-style `{{ .Env.* }}` template-variable scan → `main.tfvars.json`
JSON-syntax check. A subscription-selection step is added when a subscription id is
supplied. It runs **every** check even if an earlier one fails, and exits non-zero when
any step fails.

**Usage:**

```bash
./scripts/validate-terraform.sh [infra-dir] [subscription-id]   # infra-dir defaults to ./infra
```
```powershell
.\scripts\validate-terraform.ps1 [-InfraDir <path>] [-SubscriptionId <id>]
```

**Examples:**

```bash
./scripts/validate-terraform.sh                 # validate ./infra
./scripts/validate-terraform.sh ./infra 00000000-0000-0000-0000-000000000000
```
```powershell
.\scripts\validate-terraform.ps1 -InfraDir ./infra
```

**Reading the output:** the summary table lists every step as `PASS`, `FAIL`, or `SKIP`
(skipped when a prerequisite such as Terraform or the infra directory is missing). Each
`FAIL` is expanded in a **FAILURE DETAILS** section with the captured error text. Fix
failed steps using the guidance below, then re-run the script.

## Remediation

The script only **runs and reports** — fixing failures is manual. Guidance per step:

### Terraform / Azure CLI not installed

- Terraform: see https://developer.hashicorp.com/terraform/install
- Azure CLI: `mcp_azure_mcp_extension_cli_install(cli-type: "az")`

### Not authenticated / wrong subscription

```bash
az login
az account set --subscription <subscription-id>
```

### Format check failed

```bash
terraform fmt -recursive
```

### Init / validate / plan / state failures

Read the captured error text in the script output, then consult
[Error handling](./errors.md).

### Azure Policy Validation

The script does not cover policy checks. See
[Policy Validation Guide](../../policy-validation.md) for retrieving and validating Azure
policies for your subscription.

### Template Variable Resolution (AZD+Terraform)

> ⚠️ **CRITICAL for azd+Terraform projects.** azd substitutes `${VAR}` references in
> `main.tfvars.json` via envsubst, but does NOT interpolate Go-style template variables
> (`{{ .Env.* }}`). Unresolved Go-style template strings passed to Terraform cause
> cascading deployment failures, state conflicts, and timeouts.

When the template-variable scan reports `FAIL`:

1. **Fix the syntax** in `main.tfvars.json` — replace `{{ .Env.VAR }}` with `${VAR}`:
   ```json
   { "environment_name": "${AZURE_ENV_NAME}", "location": "${AZURE_LOCATION}" }
   ```
2. For additional variables, use **`TF_VAR_*` environment variables**:
   ```bash
   azd env set TF_VAR_environment_name "$(azd env get-value AZURE_ENV_NAME)"
   ```
3. **Verify** that `variables.tf` declares all required variables.
4. **Re-run** the script to confirm `terraform validate` / `plan` and the scan now pass.

> Prefer putting static defaults in `variables.tf` `default` values. Using `terraform.tfvars`
> (HCL) for static defaults is acceptable if your team prefers it; this restriction is
> specifically about avoiding Go-style template expressions in `.tfvars.json` files.

## References

- [Error handling](./errors.md)

## Next

All checks pass → **azure-deploy**
