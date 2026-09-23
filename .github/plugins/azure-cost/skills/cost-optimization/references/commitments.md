# Commitment Analysis

## Resolve Scope and Terms

1. Require an accessible billing scope for portfolio utilization. If the user
   supplies only a subscription, resolve or ask for its billing account and
   billing profile before calling `list_benefit_utilization`.
2. Keep Reservations and Savings Plans separate. Report commitment name, term,
   scope, region or service constraints, quantity or hourly commitment,
   utilization period, currency, and expiration when available.
3. Distinguish:
   - **utilization**: how much purchased commitment was consumed;
   - **coverage**: how much eligible usage received commitment pricing;
   - **savings**: tool-reported benefit for its stated period.
   High utilization can coexist with low coverage, and low utilization does not
   prove that a new purchase is needed.

## Analyze Current Commitments

4. Report utilization per commitment. Treat less than 90% as an investigation
   signal, not an automatic exchange or refund recommendation.
5. Call `query_costs` with `AmortizedCost`, grouped by `PricingModel`, for the
   same period. Report committed and eligible on-demand spend per currency.
   Compare actual and amortized views when a recent purchase distorts cash cost.
6. For low utilization, inspect `list_reservation_transactions` over the
   supported lookback and correlate purchases, refunds, or exchanges with scope,
   region, family, and resource-inventory changes. Missing history is
   inconclusive.

## Evaluate New Recommendations

7. Call `get_benefit_recommendations`. Preserve lookback, term, scope, savings
   amount and percentage, coverage, and expected utilization. Do not relabel
   period savings as monthly savings or combine currencies.
8. Check whether rightsizing, shutdowns, migrations, expiring commitments, or
   policy restrictions would invalidate the recommendation. Present exchange,
   scope adjustment, workload alignment, expiration planning, or a new purchase
   as distinct options with evidence and tradeoffs.

## Report and Safety

Present utilization and coverage separately, eligible on-demand spend, current
commitment risks, new recommendations, confidence, and the next review date.
Never purchase, exchange, or refund without explicit approval.

If a benefit or reservation tool is unavailable, use the API mapped in
[tool fallback](tool-fallback.md). Preserve its period and scope semantics.
