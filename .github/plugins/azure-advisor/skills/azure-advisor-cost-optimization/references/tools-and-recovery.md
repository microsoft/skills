# Tools, filters and recovery

Use existing Advisor operations. Never invent cost-specific tools, SG discovery/membership,
scope-only summary or alternative deletion-validation tools. SG resolution belongs to existing tools;
ask for an ID only after their scope failure. Use connected schemas for supported inputs.
If required scope inputs or `summary.cost` are absent, report the requested operation or
savings report as unavailable; never substitute default scope or capped totals.

In consolidated mode, list, summary and prevalidate share
`list_azure_advisor_recommendations`; they are not separately exposed tools.
Use the connected schema to select the operation.

For deletion evidence, verdicts and already-deleted resources, follow
[Read-only prevalidation](selection-and-handoff.md#read-only-prevalidation).

| Tool | Contract |
|---|---|
| `advisor_recommendation_summary` | Selected scope, Cost/IdleResources; grouping/status/priority/filters/dates/top |
| `advisor_recommendation_list` | Same scope/filters; status/type IDs/resource filters/top; single-type priority |
| `advisor_recommendation_prevalidate` | One exact recommendation type; same scope/tenant; exact full affected-resource ARM IDs in `resources`, or omit for type-wide validation. Follow [Prevalidation](selection-and-handoff.md#read-only-prevalidation) for selection and coverage; use connected-schema limits/defaults |
| `advisor_recommendation_update` | Either one stable recommendation-id or selected recommendation-ids batch; one shared scope/status/date/reason/tenant; server destructive approval |
| `advisor_metadata_list` | Resolve recognizable recommendation names using supported metadata filters |
| `advisor_remediation_get` | Selected recommendationTypeId; actionability only, not discovery |

```javascript
const parameters = {
  "subscriptions": ["<resolved-subscription-id>"],
  "category": "Cost",
  "sub-category": "IdleResources",
  "prioritized": true
};
// For SG, replace subscriptions with "service-group": "<supplied-name-or-id>".
```

Frequency/count/grouping uses normal summary and requested group-by; both modes return Cost.
List and summary use only `subscriptions`, `recommendation-type-ids` and `resource-types`
arrays, including one-element arrays for single values. Prevalidation also uses
`subscriptions` but keeps its one required scalar `recommendation-type-id`. Metadata list
keeps scalar `resource-type`; metadata/remediation get keep scalar `recommendation-type-id`.
Updates retain scalar `subscription` and their existing single-ID/batch-ID inputs.
Do not send removed singular read aliases. Read arrays use OR within each filter;
subscription and SG scope cannot combine. `minimum-savings` is non-negative annual retail USD
potential savings, not monthly/contractual. Minimum-savings and summary as-of/from/to require
both Cost and IdleResources; dates use UTC ISO 8601;
from <= to, no future as-of. List has no historical inputs.

Use the connected schema for supported filter values and limits.
Map friendly wording to a supported product family only when unambiguous; no provider mappings.
Only send fully qualified resource-type(s) when supplied. For unresolved recognizable names
or empty family-filtered results, resolve stable IDs with metadata_list, retry and disclose
fallback. Search matches instance problem text, not metadata labels.
Preserve product-family with prioritization; filtering precedes totals/ranking.
Prioritized summary groups by type; prioritized list requires exactly one distinct type
in a `recommendation-type-ids` array.
Summary limits affect displayed groups, not Cost totals.
Capped list rows cannot establish full population or totals; leave optional defaults to the tool.

## Retrieval continuation

Recommendation list, metadata list and Service Group status return bounded pages. When the
connected schema supports `continuation-token`, pass the returned `continuationToken`
unchanged with the same scope, tenant, filters, ordering and page size. Keep each type's
cursor separate. Do not mix cursors between tools or scopes, parse them, or follow a URL.

Ordinary reads keep the tool defaults or explicit user limit. An explicit "more" retrieves
the next page for the selected listing; "all" follows its remaining pages. Metadata lookup
may follow pages to resolve an otherwise unresolved name; a partial catalog cannot establish
absence or uniqueness. Stop at no token, a repeated token, no new records, an error, or an
execution limit. If a token remains, or the terminal page is truncated without one, report
partial coverage and the retrieved count; never claim all matches. De-duplicate stable IDs
without changing returned order. Across calls the live inventory can change; this is not a
point-in-time snapshot.

The 15-row inline disclosures reveal already-retrieved rows only: clicking them never calls
Azure. A full table is not proof of complete retrieval, and a collapsed table is not truncation.
Do not fetch more just to render supplied rows. Summary totals remain server aggregates, not
sums of pages. Summary remaining-group counts describe hidden groups, not a continuation token.
Prevalidation follows its discovery pages internally; its processing batches are not pages.
Retrieval never selects new write targets or grants approval; use the selection safeguards.

| Situation | Response |
|---|---|
| Empty result/missing measure | No matching findings or Unavailable; preserve explicit zero |
| Truncation/partial scope | Disclose partial coverage, never completeness |
| Authentication/tenant/scope failure | Safely report failed scope, never default-subscription fallback |
| Malformed/incomplete summary failure | Surface error, not partial/zero-valued success |
| Partial update failure | Separate successful/failed selected records |
| Requested basis absent | Explain limitation, preserve returned basis |
| Explicit deletion safety requested | [Prevalidation](selection-and-handoff.md#read-only-prevalidation); automated evidence and manual checks, never deletion authorization |
| Prevalidation unavailable | Report the limitation; never fabricate a verdict or substitute direct checks |

After Advisor errors never substitute billing, Cost Management, ARM, CLI or runtime KQL.
Subscription-discovery exception is defined in [Scope resolution](scope-resolution.md).
Preserve unknown money; no reconstruction from daily rates or dates.
