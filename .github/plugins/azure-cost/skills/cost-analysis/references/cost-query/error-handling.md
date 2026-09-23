# Cost Query Errors

Handle errors returned by `query_costs`. Use an API fallback only when the
operation itself is unavailable, as defined in
[tool and safety guidance](../tools-and-safety.md).

| Error | Likely cause | Remediation |
|---|---|---|
| Unsupported timeframe | Value is outside the MCP allowlist | Use a supported timeframe or `Custom` with dates. |
| Unsupported dimension | Dimension is not whitelisted | Use [dimensions by scope](dimensions-by-scope.md). |
| Subscription-only dimension | Resource or meter dimension used at a broader scope | Narrow to a subscription/resource group or choose another dimension. |
| Missing paired parameter | Only one date or filter field supplied | Supply both `from`/`to` or `filterDimension`/`filterValues`. |
| Date outside lookback | Start is older than 92 days, range is too long, or end is future | Narrow the historical window. |
| Invalid `top` | Outside 1-5000 | Choose a supported row limit. |
| Unauthorized or forbidden | Authentication or RBAC failure | Reauthenticate or request Cost Management Reader access. |
| Throttled | Excessive Cost Management fan-out | Honor returned retry guidance and reduce calls. |
| MCP server error | Transient service failure | Retry once; if the operation remains unavailable, use the Cost Management Query API fallback. |
| Empty rows | No data or unavailable data | Do not report zero unless the response establishes zero. |

Do not assume upstream HTTP headers or error-body fields are exposed by the MCP
client. Surface the tool's user-visible message.
