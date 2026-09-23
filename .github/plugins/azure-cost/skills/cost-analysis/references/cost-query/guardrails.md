# Cost Query Guardrails

These limits match the Azure Resource Manager MCP `query_costs` implementation.

| Rule | Limit |
|---|---|
| Historical lookback | Rolling 92 days |
| Custom dates | `from` and `to` required together in `YYYY-MM-DD` |
| Historical end date | Cannot be in the future |
| Grouping | Maximum five dimensions |
| Rows | Default 100; `top` maximum 5000 |
| Filters | One dimension with exact `In` values |
| Tags | Grouping and filtering unsupported |
| Fan-out | Ask the user to narrow requests spanning more than about 10 subscriptions |

Resource- and meter-level dimensions are limited to subscription and
resource-group scopes. Other whitelisted dimensions can be attempted at broader
scopes, but upstream agreement and scope rules may still reject them.

## Query efficiency

- Prefer one bounded query that answers the question instead of splitting the
  same scope and period across multiple calls.
- Filter early and request only the grouping dimensions needed for the answer.
- Use cost-descending sorting with an appropriate `top` for rankings.
- Shorten the time range or reduce grouping dimensions for expensive resource,
  meter, or high-cardinality queries.
- For subscriptions under the same billing account, prefer one supported
  billing-account query over separate per-subscription calls.

The tool rejects invalid dates, unsupported dimensions, incomplete
`from`/`to` or filter pairs, and invalid row limits. It does not silently swap,
truncate, or shift requested dates.

The tool exposes no continuation parameter. If 5000 rows are insufficient,
narrow the request and disclose that the result is partial. Do not call an
upstream `nextLink` directly.
