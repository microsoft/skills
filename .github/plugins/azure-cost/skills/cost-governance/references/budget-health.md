# Budget Health

## Measure Current Pace

1. Call `list_budgets` for the target scope. Distinguish no budgets from denied
   access and preserve each budget's amount, time grain, filters, thresholds,
   contacts, and current-spend period.
2. Calculate percent used from the budget response. Compare it with the percent
   of the budget period elapsed to identify whether spend is ahead of, near, or
   behind an even pace. Do not treat even pacing as a business target.
3. Call `forecast_costs` on the same scope and period. For each date, use Actual
   when present, otherwise Forecast, then sum by currency. If no forecast exists,
   report current spend and pace without presenting a projection.

## Explain Risk

4. Compare the end-of-period forecast with the budget amount and configured
   thresholds. Distinguish a forecasted overrun from a high current burn rate;
   either can occur without the other.
5. Call `query_costs` for current-period spend grouped by `ServiceName`, then
   narrow the leading driver when needed. Use the budget's current spend as the
   source of truth for percentage; use cost queries only for attribution.
6. Compare equal prior budget periods when available. Label a driver recurring
   only when it appears consistently; do not infer recurrence from one period.
7. Call `list_alerts`. Treat alerts whose `periodStartDate` matches the current
   period as current. Label older alerts as history and identify configured
   thresholds that have not fired. Inspect the returned alert fields directly;
   do not use a shell or local interpreter to search or reshape the response.

## Report

Show amount, current spend, percent used, period elapsed, pace, forecast,
forecasted variance, current and historical alerts, top drivers, recurrence,
currency, and one owner action. Never imply that a budget caps or stops spend.

If no budget exists, offer the [Budget Setup](budget-setup.md) workflow.
