# Cost Tool and Safety Guidance

## Tool preference

Use Azure Resource Manager MCP (ARM MCP) first. For Resource Graph, use the
generate, validate, execute sequence.

If a required operation is unavailable, name the fallback API and use an
already authenticated Azure CLI, Azure PowerShell, or direct REST client. Prefer
a native command when it exposes the required fields; otherwise use `az rest`,
`Invoke-AzRestMethod`, or authenticated REST. Do not fall back for invalid
input, denied access, throttling, or empty data.

| Workflow | Fallback API |
|---|---|
| Historical or AI cost | Cost Management Query API |
| AKS cost | Cost Management Query API for Kubernetes cost data |
| Resource inventory or changes | Azure Resource Graph Resources API |
| AKS utilization | Azure Monitor Metrics API |
| Enable AKS cost analysis | AKS Managed Clusters API |

Preserve the MCP workflow's scope, period, row limits, pagination, currency, and
evidence labels. State which fallback was used. Never expose access tokens.
Require explicit approval before a fallback write or configuration change.
Do not invoke Bash, PowerShell, Python, or another local interpreter merely to
parse or aggregate an MCP response. Request server-side grouping or sorting, or
issue smaller bounded MCP queries. Use shell clients only for an approved API
fallback when the required MCP operation is unavailable.

## Evidence labels

| Label | Meaning |
|-------|---------|
| Actual cost | Returned by Cost Management for the selected scope and period. |
| Actual metric | Returned by Azure Monitor or Kubernetes metrics. |
| Retail price | Returned by official Azure retail pricing. |
| Negotiated price | Returned from the user's pricesheet. |
| Estimate | Calculated from stated assumptions. |

Follow Resource Graph `skipToken` pages. For cost tools without continuation
input, increase `top` within the tool limit or narrow scope and label incomplete
results. Preserve currencies and reporting periods. Do not turn missing data
into zero, combine currencies, or present retail comparisons as realized
savings.

Require explicit approval before writes, purchases, tier changes, stops,
resizes, or deletes. Budget creation additionally requires confirmed scope,
name, amount, period, thresholds, and recipients.
