# Azure Cost

Azure cost analysis, estimation, optimization, and governance skills backed by
the Azure Resource Manager MCP server.

## Security

> [!WARNING]
> The `azure-cost` plugin uses `npx` to download and run the Azure MCP Server, inheriting the local environment's `.npmrc` configuration. Install this plugin only on trusted devices. A compromised `.npmrc` configuration could cause `npx` to download and execute malicious code, potentially resulting in remote code execution.

## Skills

| Skill | Workflows |
|-------|-----------|
| **cost-analysis** | Cost query, cost investigation, and AKS cost analysis |
| **cost-estimation** | Cost forecast and pricing estimate |
| **cost-optimization** | Cost optimization and commitment analysis |
| **cost-governance** | Budget health, budget setup, and cost guardrails |

## Install or migrate

In Copilot CLI:

1. Add the marketplace: `/plugin marketplace add microsoft/azure-skills`
2. Install this plugin: `/plugin install azure-cost@azure-skills`
3. Update it later with `/plugin update azure-cost@azure-skills`

## MCP server

The plugin connects to `https://mcp.management.azure.com` and opts into the
`CostManagement` toolset. Core query and pricing tools are enabled by default:
`query_costs`, `query_aks_costs`, `get_retail_prices`,
`start_pricesheet_download`, and `get_pricesheet_status`. Opt-in Cost Management
operations support forecasts, budgets, alerts, and benefit analysis.