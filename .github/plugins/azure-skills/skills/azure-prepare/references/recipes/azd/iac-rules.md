# AZD IAC Rules

IaC rules for AZD projects. **Additive** — for Bicep, apply `mcp_bicep_get_bicep_best_practices`, `mcp_bicep_list_avm_metadata`, and `mcp_bicep_get_az_resource_type_schema` first; for Terraform, apply `mcp_azure_mcp_azureterraformbestpractices` first; then apply these azd-specific rules.

## AVM Module Selection Order (MANDATORY)

Always prefer modules in provider-specific order:

For **Bicep**:
1. AVM Bicep Pattern Modules (AVM+AZD first when available)
2. AVM Bicep Resource Modules
3. AVM Bicep Utility Modules

For **Terraform**:
1. AVM Terraform Pattern Modules
2. AVM Terraform Resource Modules
3. AVM Terraform Utility Modules

If no pattern module exists for the active provider, default immediately to AVM modules in the same provider order (resource, then utility) instead of using non-AVM modules.

## Retrieval Strategy (azure-documentation MCP primary + optional Context7)

- **Primary (authoritative):** Use `mcp_azure_mcp_documentation` (`azure-documentation`) for current Azure guidance and AVM integration documentation.
- **Primary (module catalog):** Use `mcp_bicep_list_avm_metadata` plus official AVM indexes to select concrete modules.
- **Secondary (supplemental):** Use Context7 only for implementation examples when `mcp_azure_mcp_documentation` does not provide enough detail. If Context7 is not available, instruct the user to install it: `npx -y @upstash/context7-mcp@4.4.4`.

## Validation Plan

Before finalizing generated guidance:

1. Verify the selected module path uses the required AVM order above.
2. Verify AVM+AZD pattern modules were checked first, and fallback moved to AVM resource/utility modules when no pattern module exists.
3. Verify Terraform guidance follows pattern -> resource -> utility ordering.
4. Include selected module names and source links in the plan/output for traceability.

## File Structure

| Requirement | Details |
|-------------|---------|
| Location | `./infra/` folder |
| Entry point | `main.bicep` with `targetScope = 'subscription'` |
| Parameters | `main.parameters.json` (ARM JSON — see format below) |
| Modules | `./infra/modules/*.bicep` with `targetScope = 'resourceGroup'` |

## Parameter File Format

`main.parameters.json` uses ARM JSON syntax. Do **not** use `.bicepparam` syntax (`using`, `param`, `readEnvironmentVariable()`) in this file — `azd` will fail with a JSON parse error.

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environmentName": { "value": "${AZURE_ENV_NAME}" },
    "location": { "value": "${AZURE_LOCATION}" }
  }
}
```

Use `azd env set` to supply values. During `azd provision`, azd substitutes `${VAR}` placeholders with values from the environment.

## Naming Convention

> ⚠️ **Before generating any resource name in Bicep, check [Resource naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules) for that resource type's valid characters, length limits, and uniqueness scope.** Some resources forbid dashes or special characters, require globally unique names, or have short length limits. Adapt the pattern below accordingly.

**Default pattern:** `{resourceAbbreviation}-{name}-{uniqueHash}`

For resources that disallow dashes, omit separators: `{resourceAbbreviation}{name}{uniqueHash}`

- [Resource abbreviations](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations) — recommended prefixes per resource type

```bicep
var resourceSuffix = take(uniqueString(subscription().id, environmentName, location), 6)
// Adapt separator/format per resource naming rules
var defaultName = '${name}-${resourceSuffix}'
var alphanumericName = replace('${name}${resourceSuffix}', '-', '')
```

**Forbidden:** Hard-coded tenant IDs, subscription IDs, resource group names

## Required Tags

| Tag | Apply To | Value |
|-----|----------|-------|
| `azd-env-name` | Resource group | `{environmentName}` |
| `azd-service-name` | Hosting resources | Service name from azure.yaml |

## Module Parameters

All modules must accept: `name` (string), `location` (string), `tags` (object)

## Security

| Rule | Details |
|------|---------|
| No secrets | Use Key Vault references |
| Managed Identity | Least privilege |
| Diagnostics | Enable logging |
| API versions | Use latest |

## Recommended Outputs

`azd` reads `output` values from `main.bicep` and stores UPPERCASE names as environment variables (accessible via `azd env get-values`).

| Output | When |
|--------|------|
| `AZURE_RESOURCE_GROUP` | Always (required) |
| `AZURE_CONTAINER_REGISTRY_ENDPOINT` | If using containers |
| `AZURE_KEY_VAULT_NAME` | If using secrets |
| `AZURE_LOG_ANALYTICS_WORKSPACE_ID` | If using monitoring |
| `API_URL`, `WEB_URL`, etc. | One per service endpoint |

## Templates

**main.bicep:**

```bicep
targetScope = 'subscription'

param environmentName string
param location string

var resourceSuffix = take(uniqueString(subscription().id, environmentName, location), 6)
var tags = { 'azd-env-name': environmentName }

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module resources './modules/resources.bicep' = {
  name: 'resources'
  scope: rg
  params: { location: location, tags: tags }
}

// Outputs — UPPERCASE names become azd env vars
output AZURE_RESOURCE_GROUP string = rg.name
output API_URL string = resources.outputs.apiUrl
```

**Child module:**

```bicep
targetScope = 'resourceGroup'

param name string
param location string = resourceGroup().location
param tags object = {}

var resourceSuffix = take(uniqueString(subscription().id, resourceGroup().name, name), 6)
```

> ⚠️ **Container resources:** CPU must use `json()` wrapper: `cpu: json('0.5')`, memory as string: `memory: '1Gi'`
