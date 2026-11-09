# Confirmed state changes

Read [Selection](selection-and-handoff.md) and [Table format](table-format.md).
Preserve Cost/IdleResources, selected type/scope/tenant; never broaden to other types/states.
Postpone/dismiss lists active New rows. Completion preserves supplied source state, otherwise
New. Reactivation lists its selected source state (Postponed/Dismissed/Completed), asks if
unknown, then updates to New only after confirmation.

Show the eligible active New resources from the selected type and scope before asking which
to postpone/dismiss. Exclude confirmed-deleted rows and any row with canPostponeDismiss=false.
Ask for exact selected rows or all eligible shown rows when selection is unresolved; never
choose the whole list implicitly. Reuse an explicit selection already given by the user,
including an unambiguous prevalidation bucket. Reuse returned stable recommendation IDs;
do not ask the user to type IDs or repeat the list just to select them. No cross-type update-all.
Use the [proposal/result layout](table-format.md#state-update-proposal-and-result).
Keep full affected-resource IDs and stable recommendation IDs separately labeled in the
expandable exact-target table before confirmation; reuse an unchanged identifier table
already shown instead of repeating it. Never confuse the two identifiers.

- Postpone: after resource selection, ask which future return date to use unless the user
  already supplied one. Offer One week (7 calendar days), One month (one calendar month),
  Choose a date and time, and Cancel. Show each preset's concrete return date/time and
  timezone, preserving local clock time; clamp an invalid month-end day to the month's
  last day. Do not select a preset implicitly. For the custom choice, ask for the date/time
  and any missing timezone. This is date selection, not approval to update. Resolve the exact
  future ISO 8601 date/time and timezone before displaying the final batch proposal.
- Dismiss: reuse a supplied shared reason, otherwise ask once. Supported reasons:
  `ExcessiveCostInvestmentRequired`, `ImplementationStepsAreUnclear`,
  `IncompatibleWithTheCurrentConfiguration`, `RiskIsAcceptable`,
  `TooComplexOrImpracticalToImplement`, `AnAlternativeSolutionIsAlreadyInPlace`, `Other`.

Visibly show the entire selected batch, total count, exact scope/resources, intended status,
chosen date/reason, Yearly potential savings and accumulated Cost as separate columns.
For truncated lists disclose that the chosen target set
contains only shown rows, including collapsed rows, never all matching resources.

Use one existing `advisor_recommendation_update` call with `recommendation-ids` containing
all and only the selected stable record names. The MCP server's destructive-operation
Approve/Reject request is the batch confirmation. Do not add a separate `Confirm these changes`
question or a per-record confirmation. A date answer, resource selection, or bare "continue"
does not bypass that server approval. If the user asked only to prepare/preview, show the
proposal and stop without calling update. Cancel/rejection means no updates and no retries.

All batch IDs must share one subscription or scalar Service Group, tenant, status and
date/reason. Never silently split one approved batch into per-record calls or cross-scope
batches. For a multi-subscription list without a common selected Service Group, resolve one
eligible batch scope with the user before the date question. The existing scalar
`recommendation-id` remains valid for a single record; never supply both ID options.
Inspect the connected tool contract for batch support. If unavailable, report the limitation;
do not substitute a shell loop, per-record calls or disable consent.

Use stable `name` as the update ID, never the affected-resource ARM ID/type GUID. Preserve
the chosen scope/tenant/action/date/reason in the single call. Server approval is specific to
that invocation, not reusable for another call after interruption or for later reactivation.
Do not repeat successful updates or automatically retry failed, unverified or unattempted
items; report outcomes first and obtain a new explicit request for further work.
Postpone uses `recommendation-status=Postponed`, future ISO 8601
`postponed-until-date-time` with timezone; dismiss uses Dismissed and
`recommendation-dismiss-reason`. Completion/reactivation use Completed/New only when requested.
List `status` is source state, not the update's `recommendation-status`.
Use the result table once the batch finishes. Map each returned item by recommendationId to
its selected resource; distinguish Succeeded, Failed, Unverified and NotAttempted. Preserve
partial successes and do not claim the batch was atomic or a canceled write definitely failed.
Use the existing update response's outcome and returned status/date/reason; do not
reclassify a successful update from a subsequent stale or empty list.
Do not issue another confirmation to report results or silently retry a failed subset.
State updates do not delete resources;
an absent row proves neither deletion nor completion. State timestamps come from Advisor,
not provisional local times.
