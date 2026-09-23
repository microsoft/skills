# Azure Resource Graph Queries for Cost Optimization

Azure Resource Graph (ARG) enables fast, cross-subscription resource querying
through Azure Resource Manager MCP (ARM MCP). Use it to retrieve Azure Advisor
recommendations and factual resource inventory for optimization analysis.

## How to Query

Use `generate_query`, `validate_query`, then `execute_query`. Never execute an
unvalidated query. Follow any `skipToken` returned by `execute_query`.

## Key Tables

| Table | Contains |
|-------|----------|
| `Resources` | All ARM resources (name, type, location, properties, tags) |
| `ResourceContainers` | Subscriptions, resource groups, management groups |
| `AdvisorResources` | Cost and performance recommendations |

## Cost Optimization Query Patterns

**Find orphaned (unattached) managed disks:**

```kql
Resources
| where type =~ 'microsoft.compute/disks'
| where isempty(managedBy)
| project name, resourceGroup, location, diskSizeGb=properties.diskSizeGB, sku=sku.name
```

**Find unattached public IP addresses:**

```kql
Resources
| where type =~ 'microsoft.network/publicipaddresses'
| where isempty(properties.ipConfiguration)
| project name, resourceGroup, location, sku=sku.name
```

**Find orphaned network interfaces:**

```kql
Resources
| where type =~ 'microsoft.network/networkinterfaces'
| where isempty(properties.virtualMachine)
| project name, resourceGroup, location
```

**Resource count by SKU/tier (spot oversized resources):**

```kql
Resources
| where isnotempty(sku.name)
| summarize count() by type, tostring(sku.name)
| order by count_ desc
```

**Tag coverage for cost allocation:**

```kql
Resources
| extend hasCostCenter = isnotnull(tags['CostCenter'])
| summarize total=count(), tagged=countif(hasCostCenter) by type
| extend coverage=round(100.0 * tagged / total, 1)
| order by total desc
```

**Find load balancers with no backend pools:**

```kql
Resources
| where type =~ 'microsoft.network/loadbalancers'
| where array_length(properties.backendAddressPools) == 0
| project name, resourceGroup, location, sku=sku.name
```

An empty backend-pool configuration is an investigation signal, not proof that
the load balancer is unused or safe to remove.

**Get Advisor cost recommendations:**

```kql
AdvisorResources
| where subscriptionId =~ '{subscription-id}'
| where properties.category == 'Cost'
| extend resourceId=tostring(properties.resourceMetadata.resourceId)
| project subscriptionId,
    name,
    resourceId,
    impact=properties.impact,
    description=properties.shortDescription.solution,
    savingsDetails=tostring(properties.extendedProperties)
```

Replace the placeholder with the exact target subscription returned by Azure.
Apply both the MCP subscription scope and the KQL subscription predicate before
execution. Project only fields needed for the report. If duplicate or
cross-scope rows remain, narrow or page the validated query; do not save and
parse the response with a local tool.

Report savings, currency, and period only when those fields are present in
`savingsDetails`; otherwise label the recommendation qualitative.

## Tips

- Use `=~` for case-insensitive type matching (resource types are lowercase)
- Navigate properties with `properties.fieldName`
- Add a KQL `limit` clause to bound result count.
- Pass subscription scope through the ARM MCP tool parameters.
- Cross-reference orphaned resources with `query_costs` results.
