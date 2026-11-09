# Artifact Generation

Generate infrastructure and configuration files based on selected recipe.

## ⛔ CRITICAL: Check for .NET Aspire Projects FIRST

**MANDATORY: Before generating any files, detect .NET Aspire projects:**

```bash
# Method 1: Find AppHost project files
find . -name "*.AppHost.csproj" -o -name "*AppHost.csproj"

# Method 2: Search for Aspire packages
grep -r "Aspire\.Hosting\|Aspire\.AppHost\.Sdk" . --include="*.csproj"
```

**If Aspire is detected:**
1. ⛔ **STOP** - Do NOT manually create `azure.yaml`
2. ⛔ **STOP** - Do NOT manually create `infra/` files
3. ✅ **USE** - `azd init --from-code -e <env-name>` instead
4. 📖 **READ** - [aspire.md](aspire.md) and [recipes/azd/aspire.md](recipes/azd/aspire.md) for complete guidance

**Why this is critical:**
- Aspire AppHost auto-generates infrastructure from code
- Manual `azure.yaml` without `services` section causes "infra\main.bicep not found" error
- `azd init --from-code` correctly detects AppHost and generates proper configuration

> ⚠️ **Manually creating azure.yaml for Aspire projects is the most common deployment failure.** Always use `azd init --from-code`.

## Check for Other Special Patterns

After verifying the project is NOT Aspire, check for these patterns:

| Pattern | Detection | Action |
|---------|-----------|--------|
| **Complex existing codebase** | Multiple services, existing structure | Consider `azd init --from-code` |
| **Existing azure.yaml** | File already present | MODIFY mode - update existing config |

> **CRITICAL:** After running `azd init --from-code`, you **MUST** immediately set the user-confirmed subscription with `azd env set AZURE_SUBSCRIPTION_ID <id>`. Do NOT skip this step. See [aspire.md](aspire.md) Step 3 for the complete sequence.

## CRITICAL: Research Must Be Complete

**DO NOT generate any files without first completing the [Research Components](research.md) step.**

The research step loads service-specific references and invokes related skills to gather best practices. Apply all research findings to generated artifacts.

## Research Checklist

1. ✅ Completed [Research Components](research.md) step
2. ✅ Loaded all relevant `services/*.md` references
3. ✅ Invoked related skills for specialized guidance
4. ✅ Documented findings in `.azure/deployment-plan.md`

## Generation Order

| Order | Artifact | Notes |
|-------|----------|-------|
| 1 | Application config (azure.yaml) | AZD only—defines services and hosting |
| 2 | Application code scaffolding | Entry points, health endpoints, config |
| 3 | Dockerfiles | If containerized |
| 4 | Infrastructure (Bicep/Terraform) | IaC templates in `./infra/` |
| 5 | CI/CD pipelines | If requested |

## Recipe-Specific Generation

Load the appropriate recipe for detailed generation steps:

| Recipe | Guide |
|--------|-------|
| AZD | [AZD Recipe](recipes/azd/README.md) |
| AZCLI | [AZCLI Recipe](recipes/azcli/README.md) |
| Bicep | [Bicep Recipe](recipes/bicep/README.md) |
| Terraform | [Terraform Recipe](recipes/terraform/README.md) |

## Common Standards

### File Structure

```
project-root/
├── .azure/
│   └── deployment-plan.md
├── infra/
│   ├── main.bicep (or main.tf)
│   └── modules/
├── src/
│   └── <component>/
│       └── Dockerfile
└── azure.yaml (AZD only)
```

### Directory Creation

> ⚠️ **Warning:** The `create` tool fails with `Parent directory does not exist` when intermediate directories are missing. Always create the full directory tree before writing files.

**Before creating nested files** (e.g., `src/frontend/src/App.jsx`), create all parent directories first:

```bash
mkdir -p src/frontend/src src/api
```

- Use **absolute paths** in `mkdir -p` when the working directory may differ from the project root
- Create directories for **all components** in a single command before writing any files
- Do **not** rely on the `create` tool to create parent directories — it will not

### Security Requirements

- No hardcoded secrets
- Use Key Vault for sensitive values
- Managed Identity for service auth
- HTTPS only, TLS 1.2+
- SQL Server Bicep MUST use Entra-only auth — omit `administratorLogin` and `administratorLoginPassword` entirely, including from conditional/ternary branches (see [services/sql-database/bicep.md](services/sql-database/bicep.md)). These property names must not appear anywhere in a generated `.bicep` file.
- **SQL + Managed Identity: MUST add postprovision hook** — ARM role assignments only grant control-plane access; you MUST also generate `scripts/grant-sql-access.sh` + `.ps1` and add a `postprovision` hook in `azure.yaml` to run T-SQL grants. See [services/sql-database/bicep.md](services/sql-database/bicep.md).
- **App Service Bicep: MUST include `azd-service-name` tag** — Every App Service `Microsoft.Web/sites` resource MUST have `tags: union(tags, { 'azd-service-name': serviceName })`. Without this tag, `azd deploy` cannot locate the resource. See [services/app-service/bicep.md](services/app-service/bicep.md).

### Runtime Configuration

Apply language-specific production settings for containerized apps:

| Runtime | Reference |
|---------|-----------|
| Node.js/Express | [runtimes/nodejs.md](runtimes/nodejs.md) |

## After Generation

1. Update `.azure/deployment-plan.md` with generated file list
2. Run validation checks
3. Proceed to **azure-validate** skill
