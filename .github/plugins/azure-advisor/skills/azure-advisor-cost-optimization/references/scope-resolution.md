# Scope resolution

## Reuse first

Reuse conversation scope/IDs. Pass known subscription names/IDs to list, summary and
prevalidation as `subscriptions`, including a one-element array for one subscription;
tools resolve them. Updates keep scalar `subscription`. `<name> SG` or `<name> Service Group` selects SG scope: pass the name,
identifier or full `/providers/Microsoft.Management/serviceGroups/<identifier>` unchanged as
scalar `service-group`. Never require a subscription for SG or invent mappings/discover all SGs.

For genuinely missing scope ask once: All accessible subscriptions, One subscription,
A specific Service Group. Resolve a selected subscription through MCP listing only if needed.
If both scope families were supplied, show detected scopes/access/truncation then ask which
family before queries. For multiple/all SGs explain the single-SG contract and ask for one.

## Service Group resolution

Keep supplied tenant; without one disclose current authenticated tenant context.
No separate scope tool, ARM/ARG/CLI lookup or runtime KQL.
Matching is case-insensitive/exact: preserve punctuation/internal spaces, no partial matches
or name rewriting (`abc-def` differs from `abc def`).

For tool-reported ambiguity show returned matching IDs and ask. For no match, denied access
or incomplete coverage, explain failure and ask only for missing/corrected scope.
Never fabricate IDs, fall back to a subscription or treat failure as no idle findings.
Reuse a uniquely resolved SG ID from recommendation context for later calls.

## Subscription discovery

When needed, use MCP subscription listing once; preserve IDs/names, tenants, failures and
truncation. Do not expose credentials/raw auth details. Failed listing is not empty scope.
No inventory, ARM router or custom ARG substitute. Only after MCP listing fails may
`az account show` / `az account list` resolve subscription scope; retain the failure and label
discovery unverified. This exception never permits SG/recommendation queries.
Attempt listing before sign-in instructions.

All-accessible queries explicitly pass every returned ID, partitioned by tenant.
Keep tenant coverage/results/totals separate; no claimed global ranking across independently
ranked tenants. Same-tenant `subscriptions` accepts names, IDs or mixtures; tools deduplicate
aliases. Do not enumerate just to replace known names; discovery is needed for all-accessible
coverage or unknown tenant associations.
Empty/partial discovery must not become empty arrays, omitted scope or default-subscription
queries. Disclose partial coverage; truncated discovery or failed tenants is not all-accessible.

## Carry scope forward

Retain intent, scope family, supplied identifiers, resolved tenant/names, filters and discovery
limitations. Scope resolution is this skill's first phase, not a separate skill/query.

| Scope | Read | Update |
|---|---|---|
| One subscription | One-element `subscriptions` array with name/ID | Selected record's scalar `subscription` |
| Same-tenant subscriptions | Non-empty `subscriptions` names/IDs | One record's subscription per update |
| One SG | Scalar `service-group` name/ID/ARM ID | Same scope, resolved ID when available |

Preserve tenant. Resource-group requires subscription scope. No `service-groups` or update
scope arrays. The first summary is a recommendation query after scope selection, not scope
discovery. Generic/prioritized Cost outside IdleResources, cross-category and non-Cost use
azure-advisor; never silently add IdleResources.
