# Azure Redis Cost Optimization

Use Resource Graph and Azure Advisor to collect authoritative Redis
recommendations and configuration evidence.

## Scope

Resolve subscription names to subscription scope paths. For cross-subscription
requests, process no more than ten accessible subscriptions per batch. Tenant
IDs are not Cost Management scopes.

## Resource Graph workflow

1. Query `AdvisorResources` for Cost recommendations whose resource ID belongs
   to an Azure Redis resource.
2. Query `Resources` for the matching cache configuration, including resource
   ID, SKU, capacity, location, provisioning state, and ownership tags.
3. Join recommendations to inventory by resource ID. Preserve the Advisor
   recommendation text, impact, savings fields, currency, and period.
4. Use observed utilization metrics only when an Azure Resource Manager MCP
   (ARM MCP) monitoring operation returns them for the same resource and period.

Do not infer that a cache is idle, oversized, or safe to downgrade from its age,
SKU, tags, or configuration alone. If Advisor and metrics provide no
recommendation, report the inventory without manufacturing one.

Quantify savings with current cost and live candidate-SKU prices. Do not use
generic savings ranges.

## Report Templates

### Subscription-Level Summary
Quick overview of costs and issues per subscription (use for multi-subscription scans). Include: subscription name/ID, total monthly cost, number of caches, cache count by SKU tier, and top issues found.

### Detailed Cache Analysis
Individual cache breakdown with evidence-backed recommendations. Include cache
name, resource group, SKU tier, current cost, Advisor evidence, available
utilization metrics, and any evidence gaps.

## ARM MCP Tools

Use Resource Graph's `generate_query`, `validate_query`, and `execute_query` to
inventory cache resources and configuration. Use ARM MCP monitoring operations
for utilization metrics when available. If an operation is unavailable, use the
Azure Resource Graph, Advisor, or Monitor API mapped in
[tool fallback](../tool-fallback.md). Preserve evidence gaps when the fallback
also returns no data.
