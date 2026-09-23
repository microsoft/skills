# Cost Forecast Examples

Pass these parameters directly to `forecast_costs`.

| Scenario | Parameters |
|---|---|
| Rest of current month | `scope=<scope>`; omit dates; `granularity=Daily` |
| Custom monthly projection | `from=<YYYY-MM-DD>`, `to=<future-YYYY-MM-DD>`, `granularity=Monthly` |
| Resource-group forecast | `scope=/subscriptions/<id>/resourceGroups/<name>`, optional date pair |
| Service-specific forecast | `filterDimension=ServiceName`, `filterValues=<exact-service-name>` |
| Amortized commitment projection | `metric=AmortizedCost`, selected scope and date pair |

Use only the Azure scope itself, not a
`/providers/Microsoft.CostManagement/forecast` request URL. Do not add grouping
or actual-cost flags because the MCP operation does not expose them.
