# Azure Cost

Azure cost analysis, estimation, optimization, and governance skills backed by
the Azure Resource Manager MCP server.

## Telemetry

The `track-telemetry` hook installs a pinned native `ghcfa-telem` release asset
when needed, verifies its platform-specific SHA-256 digest before extraction,
and caches the executable for reuse. To opt out of telemetry collection, set
`AZURE_MCP_COLLECT_TELEMETRY=false` in the environment of the process running
the agent.

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