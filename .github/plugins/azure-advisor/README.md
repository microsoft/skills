# Azure Advisor

Use Azure Advisor recommendations to understand optimization opportunities, identify resources affected by service retirements, and generate customer-ready remediation guidance.

This plugin includes:

- `azure-advisor` for recommendation discovery, summaries, affected resources, metadata, service retirements, and lifecycle updates.
- `azure-advisor-actionability` for one-recommendation remediation, followed by resource-specific command placeholder resolution. When Advisor returns no usable remediation, it falls back to relevant public Microsoft Learn documentation. Responses identify whether guidance comes from Advisor or Microsoft Learn and cite documentation used for the fallback.

## Security

> [!WARNING]
> The `azure-advisor` plugin uses `npx` to download and run the Azure MCP Server, inheriting the local environment's `.npmrc` configuration. Install this plugin only on trusted devices. A compromised `.npmrc` configuration could cause `npx` to download and execute malicious code, potentially resulting in remote code execution.

## Telemetry

The shared telemetry hook records skill and MCP tool usage. Set `AZURE_MCP_COLLECT_TELEMETRY=false` to opt out.

## Setup

Authenticate with Azure CLI or another Azure Identity credential supported by Azure MCP, then install the plugin from the marketplace.
