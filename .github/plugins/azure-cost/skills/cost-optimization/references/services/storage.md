## Azure Storage Cost Optimization

Reference guide for identifying cost savings opportunities in Azure Storage accounts through tier analysis, lifecycle policies, and orphaned resource detection.

## Scope

Resolve subscription names to subscription scope paths. For cross-subscription
requests, process no more than ten accessible subscriptions per batch. Tenant
IDs are not Cost Management scopes.

## Resource Graph workflow

1. Query `AdvisorResources` for Cost recommendations whose resource ID belongs
   to a storage account or managed disk.
2. Query `Resources` for matching configuration such as SKU, redundancy, kind,
   access tier, location, attachment state, management-policy presence when
   exposed, and ownership tags.
3. Join recommendations to inventory by resource ID. Preserve the Advisor
   recommendation text, impact, savings fields, currency, and period.
4. Use access, capacity, and transaction metrics only when an Azure Resource
   Manager MCP (ARM MCP) operation returns them for the same resource and
   period.

An unattached disk, missing policy, SKU, redundancy choice, or resource tag is
an inventory fact, not proof of waste. Do not classify storage as idle,
underutilized, or safe to tier, resize, or delete without an authoritative
recommendation or matching observed usage evidence.

Quantify opportunities with actual usage, current cost, and live prices. Do not
use generic savings ranges.

When Advisor or observed access evidence supports tiering analysis, load
[Lifecycle guidance](storage-lifecycle.md).

## Resource Graph Queries

**Find storage accounts without lifecycle policies:**

Lifecycle policy contents are not queryable through Resource Graph. Use the
applicable ARM MCP storage operation. If unavailable, use the Storage Resource
Provider API through the [fallback process](../tool-fallback.md).

**Find Premium storage accounts in non-production:**

```kql
Resources
| where type =~ 'microsoft.storage/storageaccounts'
| where sku.name contains 'Premium'
| where tags.environment in~ ('dev', 'test', 'staging', 'sandbox')
| project name, resourceGroup, sku=sku.name, tags
```

**Find GRS/GZRS accounts in dev/test (redundancy downgrade candidates):**

```kql
Resources
| where type =~ 'microsoft.storage/storageaccounts'
| where sku.name contains 'GRS' or sku.name contains 'GZRS'
| where tags.environment in~ ('dev', 'test', 'staging')
| project name, resourceGroup, sku=sku.name, location, tags
```

**Find classic (v1) storage accounts:**

```kql
Resources
| where type =~ 'microsoft.storage/storageaccounts'
| where kind =~ 'Storage'
| project name, resourceGroup, location, kind
```

**Find orphaned managed disks (unattached):**

```kql
Resources
| where type =~ 'microsoft.compute/disks'
| where isempty(managedBy)
| project name, resourceGroup, location, diskSizeGb=properties.diskSizeGB, sku=sku.name
```

## Report Templates

### Subscription-Level Summary
Include: subscription name/ID, total monthly storage cost, account count by SKU/tier, total data stored (TB), top issues found.

### Detailed Storage Account Analysis
Include: account name, resource group, SKU/redundancy, kind, monthly cost, capacity (GB), access tier distribution (%), lifecycle policy status, and optimization recommendations.

## ARM MCP Tools

Use Azure Resource Graph (ARG) operations for inventory and configuration.
Use ARM MCP storage operations for management policies and access tracking, and
ARM MCP monitoring operations for capacity and transaction metrics. Use the
Storage Resource Provider or Azure Monitor API fallback when needed, and report
an evidence gap if neither source returns the required data.

## Pricing

Use `get_retail_prices` for the requested region, redundancy, tier, and
currency. Include storage, transaction, retrieval, early-deletion, and
rehydration costs when relevant; never rely on embedded rates.
