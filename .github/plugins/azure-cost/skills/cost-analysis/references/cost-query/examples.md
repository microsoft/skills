# Cost Query Examples

Pass these parameters to `query_costs`. If that operation is unavailable, use
the official Cost Management Query API schema and preserve these constraints.

| Scenario | Parameters |
|---|---|
| Month-to-date cost by service | `timeframe=MonthToDate`, `granularity=None`, `groupBy=ServiceName`, `metric=Cost` |
| Daily trend for a custom period | `from=<YYYY-MM-DD>`, `to=<YYYY-MM-DD>`, `granularity=Daily`, `metric=Cost` |
| Cost by resource group | `timeframe=MonthToDate`, `groupBy=ResourceGroupName`, `sortDirection=desc` |
| Amortized commitment cost | `timeframe=TheLastMonth`, `groupBy=BenefitName`, `metric=AmortizedCost` |
| Ten most expensive resources | subscription scope, `groupBy=ResourceId`, `top=10`, `sortDirection=desc` |
| One service only | `filterDimension=ServiceName`, `filterValues=<exact-service-name>` |

Use `list_dimensions` when an exact filter value or available dimension is
unknown. It belongs to the opt-in `CostManagement` toolset.

Tag queries are unsupported. For resource tag inventory, use the Resource Graph
`generate_query`, `validate_query`, and `execute_query` sequence, then correlate
resource IDs with cost results.
