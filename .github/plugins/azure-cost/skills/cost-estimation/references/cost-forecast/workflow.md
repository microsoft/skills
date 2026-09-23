# Cost Forecast Workflow

Use this workflow to project costs for an existing Azure scope.

## 1. Determine scope and period

`forecast_costs` defaults to the current month: first day through last day. For
custom dates, supply `from` and `to` together in `YYYY-MM-DD`. `from` must be
within the rolling 92-day lookback; `to` may be in the future.

## 2. Configure the tool call

| Parameter | Contract |
|---|---|
| `scope` | Azure scope path; never a tenant ID |
| `from`, `to` | Optional pair; defaults to current month |
| `granularity` | `Daily` (default) or `Monthly` |
| `filterDimension` + `filterValues` | Optional pair using one exact-match dimension |
| `metric` | `PreTaxCost` (default), `Cost`, or `AmortizedCost` |

The MCP tool does not expose grouping, sorting, arbitrary aggregations,
`includeActualCost`, or `includeFreshPartialCost`.

## 3. Execute and interpret

Call `forecast_costs`. If it is unavailable, use the Cost Management Forecast
API through [tool fallback](../tool-fallback.md). Preserve currency, date,
scope, actual-versus-forecast status, and the 100-row response limit. Empty or
unavailable forecast data is not zero.

For grouped historical data, hand off to `cost-analysis`. If the requested
forecast cannot fit the supported contract, explain the limitation; fallback
does not relax it.

## Error handling

| Error | Action |
|---|---|
| Missing date or filter pair | Supply both fields. |
| Historical start older than 92 days | Move `from` inside the supported window. |
| Unsupported metric, granularity, or dimension | Use an exposed value. |
| Forecast unavailable | Report unavailable data and offer historical analysis. |
| Throttled | Honor tool retry guidance and reduce fan-out. |

See [examples](examples.md), [parameter contract](request-body-schema.md), and
[guardrails](guardrails.md). Use [forecast errors](error-handling.md) for
tool-specific remediation.
