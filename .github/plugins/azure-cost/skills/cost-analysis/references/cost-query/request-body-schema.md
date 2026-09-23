# Cost Query Tool Contract

`query_costs` accepts typed MCP parameters. Use this contract for MCP calls; an
API fallback must use the official Cost Management Query API schema instead of
translating arbitrary fields.

| Parameter | Required | Values or format |
|---|---|---|
| `scope` | Yes | Azure scope path; never a tenant ID |
| `timeframe` | No | `MonthToDate`, `BillingMonthToDate`, `TheLastMonth`, `TheLastBillingMonth`, `WeekToDate`, `TheCurrentMonth`, `Custom` |
| `from`, `to` | Together | `YYYY-MM-DD`; supplying both selects `Custom` |
| `granularity` | No | `None` (default), `Daily`, `Monthly` |
| `groupBy` | No | Up to five comma-separated dimensions |
| `filterDimension` | With `filterValues` | One supported dimension |
| `filterValues` | With `filterDimension` | Comma-separated exact values; upstream operator is `In` |
| `metric` | No | `PreTaxCost` (default), `Cost`, `AmortizedCost` |
| `sortBy` | No | Cost column or selected grouping dimension |
| `sortDirection` | No | `desc` (default), `asc`, `descending`, `ascending` |
| `top` | No | 1-5000; default 100 |

The server creates the aggregation, grouping, filter, and sorting payload.
Callers cannot supply compound filters, tag filters, arbitrary aggregation
columns, request-body fields, or continuation URLs.

The structured response preserves the upstream `columns` and `rows`. Read each
row using the corresponding column index rather than assuming a fixed order.
