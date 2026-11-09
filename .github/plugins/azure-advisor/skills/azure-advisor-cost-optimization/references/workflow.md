# Workflow and expansion

Apply [Scope resolution](scope-resolution.md); preserve scope, tenant, filters and requested
limits. This workflow covers only Advisor Cost/IdleResources.

## Choose the operation

| Intent | Existing operation |
|---|---|
| Unused-resource savings or highest-priority opportunities | Summary with `prioritized=true` |
| Counts, frequency or requested grouping | Normal summary with requested `group-by`, no prioritization |
| Named type, selected records or explicit list-all | List directly |
| Completed cleanup or historical savings | [Lifecycle](lifecycle.md): resolve All/period, summary then details; honor totals-only |
| Completed/Postponed/Dismissed details | List with explicit status |
| State changes/remediation artifacts | [Selection](selection-and-handoff.md), direct-list flow |
| Explicit safety, dependency, lock, or pre-deletion checks | [Read-only prevalidation](selection-and-handoff.md#read-only-prevalidation) |

Current summaries default to New except unfiltered status grouping, which includes all states.
Historical `as-of`/`from`/`to` default summaries to Completed. Explicit status always wins,
including New with historical inputs. Preserve the effective status for expansion; list defaults
to New and has no historical inputs. A status-breakdown drill-down must select its state.

## Discover and expand

Prevalidation is an explicit safety flow, not ordinary discovery or a savings estimate.
When the exact type is already known, call prevalidation directly with preserved selections
and scope; do not expand list/summary solely to produce another table.

1. For broad discovery use prioritized summary without `group-by`; retain requested filters
   and limits. Do not introduce a family/threshold question.
2. Display the [opening format](table-format.md#opening-discovery-format) before asking for a type.
3. If usable type GUIDs exist, immediately ask once, even for one type. Choices begin with
   exact displayed names, include returned counts/savings and follow table order.
   `Expand all recommendation types shown` is last, never first/recommended.
   Unknown buckets get no invented IDs; no usable types means no expansion question.
4. List each selected type separately with original scope/status, list-supported filters and
   requested ordering. Each type gets its own page and continuation; do not put multiple types
   into one globally capped list for per-type expansion. List prioritization requires one
   distinct type in a one-element `recommendation-type-ids` array.
   Expand-all covers shown types only, not hidden types.
5. Use [selected-resource layout](table-format.md#resource-detail), not opening discovery again.
   Include every returned row using inline disclosures; report server truncation separately.
   Do not ask for resource selection or another prompt for ordinary reading.

Preserve returned group order: priority order for discovery, count order for frequency.
Match `summary.cost.typeTotals` by ID for money; do not substitute its order for group rank.
Use returned total/remaining group counts to disclose hidden types.
Explicit list-all follows [retrieval continuation](tools-and-recovery.md#retrieval-continuation).
Omit type filters only when the user requested all types; retain an already selected type.
Keep states and tenant partitions separate.
For friendly names/families and metadata fallback, read [Tools and recovery](tools-and-recovery.md).
