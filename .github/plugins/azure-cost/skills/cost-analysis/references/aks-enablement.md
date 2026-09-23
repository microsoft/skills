# Azure Kubernetes Service (AKS) Cost Analysis Enablement

Enable namespace-level cost visibility using the built-in AKS cost monitoring
add-on.

## Check Status

Use `generate_query`, `validate_query`, then `execute_query` against AKS managed
clusters. Project the cluster name, resource group, SKU tier, and
`properties.metricsProfile.costAnalysis.enabled`. Follow any `skipToken`.

## Enable Add-on

If ARM MCP does not expose AKS cost-analysis enablement, identify the AKS
Managed Clusters API operation and follow the [fallback
guidance](tools-and-safety.md). Show the proposed change and require explicit
approval before using Azure CLI, Azure PowerShell, or REST. The Azure portal's
Kubernetes Cost Analysis view or the `azure-kubernetes` skill are also valid
handoffs. Do not claim the add-on was enabled without a successful response.

## If Cluster is Free Tier

Warn that upgrading from Free to Standard introduces an ongoing cluster
management fee. Use `get_retail_prices` to estimate the fee and label it as
public retail pricing, not the customer's negotiated price. Obtain explicit
approval before handing off the tier change.

## After Enabling

Namespace-level cost data is available in:
- Azure Portal: Cost Management -> Cost Analysis -> Kubernetes view
- ARM MCP: `query_aks_costs` grouped by `Cluster` and `Namespace`

> Risk: Low for enabling the add-on. Upgrading tier (Free -> Standard) has a cost — always confirm with user first.
