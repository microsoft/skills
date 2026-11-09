# Lifecycle reports

Preserve Cost/IdleResources, scope, tenant and selected type unless the user broadens scope.

## Choose All or a period

For saved-after-cleanup requests without selected all/current findings or a reporting period,
ask once, before queries, with these choices in order:

1. `All Completed (Recommended)`
2. `Last 30 days (<start> to <end> UTC)`
3. `Last quarter (<start> to <end> UTC)`
4. `A specific period`

Show scope/concrete boundaries before asking. Resolve from current UTC: previous 30 complete
calendar days or previous completed calendar quarter. All Completed means every current
Completed finding in existing scope/type, not every state; calculate as of now without
from/to or a prior-day as-of. Explicit all/current wording or supplied dates/period skips
selection. Reuse the answer. Ask only for missing specific/unresolved dates.
As-of-only and one-sided windows are valid; never demand another bound or reuse example dates.

After selection, summary `status=Completed` gives full totals, then list with same scope/type/
status gives resources. Do not stop at types or ask to expand a selected type.
Honor totals-only. Historical windows use `group-by=recommendation-type`, from/to;
past periods use period-end as-of unless supplied, ongoing periods current UTC.
Never send future as-of. Show returned cutoffs/coverage and `summary.cost`, not capped sums.

## Current versus historical details

As-of controls money, not historical lifecycle/inventory reconstruction. From/to bound
Completed deletion dates. List has no historical inputs: follow list continuation and filter
Completed details by `properties.savings.resourceDeletedOn` before counting a requested
matching-row limit. Stop at that limit or source exhaustion; an empty filtered page is not
proof that the period has no matches. Explicit All Completed retrieves all remaining pages.
Show undated rows separately as unverified for
the window, not counted in its totals or silently dropped. Without a window retain all rows,
including missing prices/deletion dates. Truncated details remain partial.
List money is current, not recalculated at historical as-of: separate/disclose that limitation.
Never compare different cutoffs as if equal or reconstruct missing amounts.
Show pricing/record coverage; missing money stays Unavailable. Completed Cost is frozen
published accumulated Cost, distinct from realized savings. Estimates, not billing.

For Postponed/Dismissed totals summarize that status. Unfiltered state breakdowns use
`group-by=status`, not silently New. Separate New potential, Postponed remaining potential/Cost
and Dismissed Cost; do not invent recoverable dismissed savings, extrapolate costs, or sum
potential/accumulated/realized money.

## Presentation

Use `## Completed cleanup`, separate bold Realized savings and Cost fields, compact Scope,
Currency, Pricing basis and Status. Before tables show All/period, cutoff and coverage.
Never choose a historical cutoff merely to match an example.
Separate states/types: type summary then resource table per type. Completed summaries show
type, count, realized savings; Postponed/Dismissed show type, count, yearly potential and Cost.
Use returned record/resource count semantics, not invented uniqueness; distinguish full totals
from capped details. Read [Table format](table-format.md); Completed columns are:

```text
|Resource|Resource<br>group|Realized<br>savings|Cost|State last<br>changed|Completion<br>details|Deletion<br>date|
|---|---|---:|---:|---|---|---|
```

Insert Subscription after Resource for SG/multi-sub scope. Postponed appends Postponed until;
Dismissed appends State last changed and Dismiss reason.
State last changed uses supported `properties.lastUpdated` for every lifecycle state; it is
not a customer-specific/platform-specific completion time or deletion date.
Details: SystemVerified with deletion date =
Resource deleted; without = Verified completed; MarkedByUser = Completed by user; else Unavailable.
Deletion date is separate. Preserve postponed dates/
reasons. Missing fields are Unavailable; never substitute refreshed/local/deletion timestamps.
