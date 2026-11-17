# Service provisioning

Reuse a compatible existing service using [context discovery](context-resolution.md). Use the [access safeguards](safety-and-idempotency.md#access-and-credentials) to reuse identities/access and include only missing grants in the proposal. Never reconfigure it without approval.

## Ask only for missing requirements

Recommend a setup rather than presenting a questionnaire. Reuse task/project answers and discover what you can; ask one question at a time, only when its answer changes the recommendation. Do not ask users to choose SKUs, replica counts, or network topology.

| Missing decision | Question to ask |
|---|---|
| Purpose | "Is this for trying things out or for a live application?" |
| Location | "Where should the data stay?" Recommend a nearby allowed region if no project/dependency location is available. |
| Documents | "Roughly how many documents will you search?" Estimate document sizes, vector footprint, and growth from available context rather than asking users for index metrics. |
| Search frequency | "How often will people search them?" Ask about document updates only if they materially affect sizing or cost. |

Default to the existing project/organization network policy. Without a private-network requirement, propose a public endpoint with Entra-only authentication, not anonymous access. Include this in creation approval, not a networking question. Never relax an existing network boundary. If unclear, ask "Does this need to stay on your organization's private network?" and resolve the details yourself.

When serverless fits, ask "Is serverless OK?" within the creation proposal. Show the estimated cost of the proposed paid resource, including currency, time period, usage assumptions, and additional model/storage charges, then ask permission to create it. Do not ask for a spending limit before making a proposal. For usage-based costs, show rates and an estimated range; identify uncertainty rather than inventing a fixed price. If sizing is unknown, propose a small, bounded pilot and measurement with its estimated cost.

## Select the pricing model and tier

Apply feature, residency, and reliability constraints before optimizing cost. Honor a compatible explicit choice; explain conflicts and ask before changing it.

Prefer serverless over Free or Basic for trying things out, development and testing, and variable or intermittent workloads when the required features and region are supported. Recommend dedicated capacity for consistent workloads, choosing Basic or a Standard tier based on expected scale and performance needs.

| Workload | Recommendation and limits |
|---|---|
| Trying things out, development and testing, variable or intermittent demand | Recommend Serverless (`serverless`) after region/feature checks. Limits: 10,000 indexes per service and 10 GB total storage per index. |
| Consistent, steady workload | Consider dedicated `basic` when anticipated storage, vector, object, file-size, and throughput needs fit. Basic supports production with appropriate replicas; production alone does not mandate Standard. A demo or managed-identity requirement alone is not a reason to prefer Basic over serverless. |
| Very large workloads or high expected throughput | Consider Standard tiers: S1 (`standard`), S2 (`standard2`), or S3 (`standard3`). Choose upfront based on anticipated capacity, performance, and growth needs, not simply because vectors are used. |
| Required private-link access from indexer skillsets, or private indexer execution unavailable on serverless | Require dedicated S2 or higher; verify the exact networking/skillset combination. An inbound private endpoint alone does not require S2. |
| Explicit no-paid-Search requirement or compatible explicit Free choice | Consider `free`: 50 MB, 3 indexes, one Free service per subscription. No SLA, scaling, outbound managed identity, or private endpoints. Not for managed-identity Blob/vector recipes. Other Azure dependencies can cost money. Do not silently substitute paid serverless. |

Recommend dedicated for consistent demand, sustained high utilization, or requirements that serverless cannot meet. Serverless is not automatically cheaper: compute is usage-based, storage remains billable while idle, and model/enrichment charges can be additional.

## Select region and capacity

1. Preserve a compatible explicit region. Otherwise recommend colocation with application/data/model resources, subject to residency, latency, Search features, model availability/quota, enrichment region requirements, and networking restrictions. Without dependencies, ask the user's geography. Do not hard-code a global default region or copy an API example's location.
2. Check regional capacity footnotes, tier/region subscription quota, and feature limits. Available quota does not guarantee regional capacity. If blocked, ask about compatible alternatives; never silently move data, switch tiers, or remove private networking.
3. For small dedicated development, recommend one partition and one replica, without an SLA. For production, budget at least two replicas for query-only SLA eligibility or three for queries plus indexing; scale from measured demand. Check availability-zone support when required. These counts do not apply to serverless or Free.
4. Compare index/vector sizes, object counts, and growth with actual limits; older services can have lower quotas. Preserve reused capacity unless a change is approved. Serverless has no user-configured replicas or partitions.

## Serverless API contract

The documented management alternative is `2026-03-01-preview`: its [example](https://github.com/Azure/azure-rest-api-specs/blob/main/specification/search/resource-manager/Microsoft.Search/Search/preview/2026-03-01-preview/examples/SearchCreateOrUpdateServiceWithServerless.json) uses `sku.name: "serverless"`, `hostingMode: "Default"`, and no replica/partition counts. "Developer" is a product label, not the REST SKU. Do not invent a serverless `computeType` or hosting mode.

The default management version lacks this SKU. Follow [API version policy](api-version-policy.md): verify and record a compatible `managementApiVersion` without a separate version-approval question. Ask only for a conflicting explicit version pin/GA-only policy or changed resource impact. Never silently replace the original context, change `dataApiVersion`, or assume a newer version works. If the exact contract or tool support cannot be verified, stop and offer a documented compatible path.

Serverless cannot be switched to or from another tier in place. Reuse does not authorize replacement; migration needs a separate data-movement/cutover plan.

## Approve and verify

Lead with the recommended setup, why it fits, estimated cost, and "May I create it?" Include important availability limits and cleanup ownership; retain the exact target, region, model/SKU, capacity, API versions, and identity/auth/network settings in the plan without turning them into separate questions. Obtain consolidated approval before billable, permission, network, production, or data-movement changes. Reuse approval for an unchanged plan. Preserve settings outside the approved diff.

Use [create/update](https://learn.microsoft.com/rest/api/searchmanagement/services?view=rest-searchmanagement-2025-05-01) or [partial update](https://learn.microsoft.com/rest/api/searchmanagement/services?view=rest-searchmanagement-2025-05-01). Wait for terminal success, GET and compare settings, then validate the workload. On failure, retain the error/request ID; do not retry with different region, SKU, version, or security. Follow [cleanup](safety-and-idempotency.md#scenario-cleanup); never delete a reused service.

## Official sources

- [Pricing models, tier features, and restrictions](https://learn.microsoft.com/azure/search/search-sku-tier)
- [Region and capacity availability](https://learn.microsoft.com/azure/search/search-region-support)
- [Storage, vector, indexer, and object limits](https://learn.microsoft.com/azure/search/search-limits-quotas-capacity)
- [Reliability and replica requirements](https://learn.microsoft.com/azure/reliability/reliability-ai-search)
- [Serverless cost behavior](https://learn.microsoft.com/azure/search/serverless-cost-optimization)
