# Budget Setup

## Assess the Existing State

1. Call `list_budgets` at the requested scope before proposing another budget.
   Surface an existing budget and ask whether the user wants another one. Flag a
   budget far below current spend as potentially stale rather than replacing it.
2. Build a baseline with last-month `query_costs` and current-month
   `forecast_costs`, keeping currencies separate. Forecast output can contain
   Actual and Forecast rows for the same date; count the Actual row when present,
   otherwise count the Forecast row. Summarize the trend as growing, stable, or
   declining.

## Shape the Proposal

3. Ask whether this is a firm business limit or a tracking threshold and whether
   planned deployments, migrations, commitments, or seasonal peaks will change
   expected spend. Azure budgets only send alerts; they do not stop, throttle, or
   disable resources.
4. Ground the amount in the baseline and stated business context. Never add a
   growth buffer silently. For a firm limit, use that limit and consider earlier
   thresholds. For planned changes, show the expected delta separately before
   adding it. If the user wants a growth buffer, show it separately.
5. Prefer subscription scope for environment-level control or resource-group
   scope for a workload in a shared subscription. `create_budget` supports those
   scopes. For management-group or billing scopes, explain that this tool cannot
   create the budget and direct the user to a supported management experience.
6. Recommend no more than five notifications. A useful starting model is 80%
   and 100% Actual plus 80% and 100% Forecasted, adjusted for the user's desired
   response time.

## Confirm and Create

7. Present the complete proposal and obtain explicit confirmation of scope,
   budget name, amount and currency, time period, thresholds, recipient emails,
   and optional action-group resource ID.
8. Only after that confirmation, call `create_budget`. Put recipient emails
   inside every notification object; top-level contacts do not apply when custom
   notifications are supplied. Every notification must have a recipient.
9. Never overwrite a budget with the same name. If a conflict exists, preserve
   it and ask whether to use a different name. Explain that changing the existing
   budget requires a separate supported update path; do not simulate an update by
   deleting it. Verify a successful creation with `list_budgets` and report the
   resulting configuration.

Never infer recipients, fabricate an action group, or claim creation before the
verification call succeeds.
