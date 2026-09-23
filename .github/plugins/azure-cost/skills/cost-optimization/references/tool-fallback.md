# Optimization Tool Fallback

Use ARM MCP first. If the required operation is unavailable, name the API and
use an already authenticated Azure CLI, Azure PowerShell, or REST client.

| Workflow | Fallback API |
|---|---|
| Cost baseline | Cost Management Query API |
| Inventory or configuration | Azure Resource Graph Resources API |
| Optimization recommendations | Azure Advisor Recommendations API |
| Utilization evidence | Azure Monitor Metrics API |
| Commitment recommendations | Cost Management Benefit Recommendations API |
| Commitment utilization | Cost Management Benefit Utilization Summaries API |
| Reservation history | Reservations Transactions API |

Prefer native commands when they expose the required fields; otherwise use
`az rest`, `Invoke-AzRestMethod`, or authenticated REST. Preserve scope,
currency, period, pagination, recommendation text, savings period, and
utilization semantics. State which fallback was used and never expose tokens.

Do not invoke Bash, PowerShell, Python, or another local interpreter merely to
parse or aggregate an MCP response. Request server-side grouping or sorting, or
issue smaller bounded MCP queries. Use shell clients only for an approved API
fallback when the required MCP operation is unavailable.

Do not fall back for denied access, invalid input, throttling, or empty data.
Require explicit approval before any resize, delete, purchase, exchange, refund,
policy, or configuration write.
