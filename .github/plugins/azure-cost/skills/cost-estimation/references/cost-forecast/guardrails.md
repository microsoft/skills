# Cost Forecast Guardrails

These limits match the Azure Resource Manager MCP `forecast_costs`
implementation.

| Rule | Limit |
|---|---|
| Default period | First through last day of the current month |
| Custom dates | `from` and `to` required together in `YYYY-MM-DD` |
| Historical lookback for `from` | Rolling 92 days |
| Forecast end | May be in the future |
| Date span | Maximum 92 days |
| Granularity | `Daily` or `Monthly` |
| Response rows | Maximum 100 |
| Filters | One dimension with exact `In` values |
| Grouping | Not exposed |

The tool does not expose `includeActualCost`, `includeFreshPartialCost`,
sorting, or arbitrary dataset fields. Do not infer these controls from the
underlying REST API.

Forecasts may be unavailable for new or inactive scopes. Treat unavailable data
separately from a numeric zero and hand off to `cost-analysis` for available
history.
