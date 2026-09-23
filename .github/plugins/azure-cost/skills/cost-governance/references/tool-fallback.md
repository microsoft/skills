# Governance Tool Fallback

Use ARM MCP first. If the required operation is unavailable, name the API and
use an already authenticated Azure CLI, Azure PowerShell, or REST client.

| Workflow | Fallback API |
|---|---|
| Budget read or write | Cost Management Budgets API |
| Cost alerts | Cost Management Alerts API |
| Spend or forecast | Cost Management Query or Forecast API |
| Tag and policy inventory | Azure Resource Graph Resources API |
| Policy details | Azure Policy Assignments and Definitions APIs |

Prefer native commands when they expose the required fields; otherwise use
`az rest`, `Invoke-AzRestMethod`, or authenticated REST. Preserve scope,
currency, time grain, thresholds, contacts, filters, and pagination. State
which fallback was used and never expose access tokens.

Do not invoke Bash, PowerShell, Python, or another local interpreter merely to
parse or aggregate an MCP response. Request server-side grouping or filtering,
or issue smaller bounded MCP queries. Use shell clients only for an approved API
fallback when the required MCP operation is unavailable.

Do not fall back for denied access, invalid input, throttling, or empty data.
Budget or policy writes still require an explicit preview and user confirmation.
