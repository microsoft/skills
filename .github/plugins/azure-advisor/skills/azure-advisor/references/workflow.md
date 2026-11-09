# Generic Advisor workflow

For combined Cost/IdleResources, use `azure-advisor-cost-optimization`, including its scope
phase and response templates. Do not mix generic layouts into that flow.
Generic Cost, prioritized Cost outside IdleResources, cross-category and other requests use
this workflow. Preserve requested filters; never silently add IdleResources.

## Scope and operation

Reuse known identifiers. Use one or more same-tenant subscriptions, or one supplied Service
Group; never combine these scope families. Resource-group scope requires a subscription.
List and summary accept only same-tenant `subscriptions` arrays of names/IDs, including
one-element arrays for one subscription; aliases are queried once. Updates retain scalar
`subscription`. Pass supplied SG names, identifiers or full ARM IDs unchanged as scalar
`service-group`; the tool resolves them. Ask only for missing values.

Use summary for aggregates/rankings and list for individual records, including service
retirements. Never infer full totals from a capped list. Browse types with
`advisor_metadata_list`, or fetch a known type with `advisor_metadata_get`.
For remediation, use `azure-advisor-actionability`, which retrieves `advisor_remediation_get`
and owns remediation safeguards. Confirm before recommendation-state updates.

Recommendation list, metadata list and Service Group status return bounded pages. For an
explicit "more"/"all", use the returned `continuationToken` as `continuation-token` with
unchanged scope, tenant, filters, ordering and page size, when the connected schema supports
it. Keep cursors separate per tool and selected type. Per-type expansion uses separate list
calls so one type cannot consume another's page. Do not follow pages merely to display
already-returned rows or expand the target set of a write. Metadata lookup may continue when
the current page cannot resolve a name; partial metadata cannot prove absence or uniqueness.
Stop at no token, a repeated token, no new records, an error or execution limit; remaining
tokens or terminal truncation without a token mean partial coverage. De-duplicate stable IDs,
preserve returned order and note that live pages are not a point-in-time snapshot.
Summary remaining-group counts are not continuation tokens; preserve aggregate totals.

## Filters and lifecycle

List defaults to New and supports explicit New, Postponed, Dismissed, and Completed across
categories. Generic summary status grouping includes all states; other summaries default to
New. Explicit summary status, historical inputs (`as-of`, `from`, `to`), and minimum-savings
require both Cost and IdleResources and belong to that specialized workflow, not generic Cost.
Do not silently add IdleResources to enable them.

Preserve `product-family` with `prioritized=true`. Prioritized summary groups by type;
prioritized list requires exactly one distinct type in `recommendation-type-ids`.
List and summary use only `recommendation-type-ids` and `resource-types` arrays, including
one-element arrays for one value; values use OR semantics within each filter.
Metadata list retains scalar `resource-type`; metadata/remediation get retain scalar
`recommendation-type-id`. Do not send removed singular list/summary aliases.

## Presentation

Only present returned data; disclose truncation, access limitations and failures.
Preserve priority order for ranked/top results. Show returned yearly potential savings with
currency and pricing basis when available. Missing savings are `Unavailable`, never zero or
an invented estimate. Specialized lifecycle and pricing rules stay in the Cost/IdleResources
workflow; do not broaden them to other categories or subcategories.

On every model, including Auto, visibly display results or proposals before dependent
questions. Reasoning, tool output and content only inside `ask_user` do not count.
Missing-input questions may be asked directly.

Honor the user's requested `top`, otherwise leave tool defaults intact. Disclose hidden
groups, server truncation, and partial coverage; never imply that visible rows are the whole
population. Do not impose a separate 15-row limit or nested-HTML presentation requirement.
