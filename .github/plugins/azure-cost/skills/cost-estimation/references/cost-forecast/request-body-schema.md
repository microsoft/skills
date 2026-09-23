# Cost Forecast Tool Contract

`forecast_costs` accepts typed MCP parameters. Use this contract for MCP calls;
an API fallback must use the official Cost Management Forecast API schema.

| Parameter | Required | Values or format |
|---|---|---|
| `scope` | Yes | Azure scope path |
| `from`, `to` | Together | `YYYY-MM-DD`; defaults to current-month boundaries |
| `granularity` | No | `Daily` (default), `Monthly` |
| `filterDimension` | With `filterValues` | One supported cost dimension |
| `filterValues` | With `filterDimension` | Comma-separated exact values |
| `metric` | No | `PreTaxCost` (default), `Cost`, `AmortizedCost` |

The server sets `timeframe=Custom`, builds the time period and aggregation, and
uses the same dimension whitelist as `query_costs`. Callers cannot pass
grouping, sorting, request-body JSON, or actual-cost flags.

The structured response preserves upstream columns and rows. Interpret each row
using its matching column definition, including currency and `CostStatus` when
returned.
