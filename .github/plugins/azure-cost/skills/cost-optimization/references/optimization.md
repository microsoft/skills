# Optimization Workflow

## Build the Candidate Set

1. Call `query_costs` for current and prior comparable periods grouped by
   `ServiceName` and `ResourceGroupName`. Rank contributors and deltas per
   currency; do not optimize only by resource count.
2. Use `generate_query`, `validate_query`, then `execute_query` to retrieve
   Azure Advisor cost recommendations and factual inventory. Put the exact
   subscription predicate and required projection in the validated query;
   never isolate subscription rows by saving and parsing the response locally.
3. Deduplicate recommendations by resource ID, recommendation type, and target
   configuration in the validated Resource Graph query when possible. Otherwise
   narrow or page the query and preserve unresolved duplicates rather than
   aggregating them in a shell or local interpreter. Keep the newest active
   recommendation and preserve Advisor's impact, savings amount, currency, and
   period.

## Validate Feasibility

4. Separate quantified Advisor recommendations, observed-metric candidates, and
   inventory-only signals. Use tool-reported savings only. Missing policies,
   unattached state, empty backend pools, age, SKU, or tags require owner and
   workload confirmation.
5. Check each proposed SKU, region, shutdown, or deletion against Azure Policy,
   availability, reliability requirements, ownership, dependencies, and
   rollback options. Mark feasibility as allowed, blocked, or unknown.
6. If commitments exist, load [Commitment Analysis](commitments.md). Identify
   rightsizing or shutdown actions that could strand reserved capacity, and
   avoid counting commitment and rightsizing savings twice.

## Prioritize and Report

7. Prioritize high-confidence quantified savings that are feasible and do not
   conflict with commitments or reliability requirements. Follow with
   non-quantified or lower-confidence investigations. Do not create an invented
   composite score.
8. Present current cost, evidence source, savings and period when reported,
   confidence, feasibility, commitment interaction, owner, validation step,
   rollback, and next action. Never classify a resource as idle or
   underutilized without an authoritative recommendation or matching metrics.

Load service-specific Resource Graph guidance only when relevant:

- [Azure Cache for Redis](services/redis.md)
- [Azure Storage](services/storage.md)
- [Resource Graph queries](resource-graph.md)
- [Report template](report-template.md)

## Cleanup safety

Inventory signals such as an unattached disk or empty backend pool are
candidates for investigation, not proof that a resource is unused. Surface
owner tags and require owner confirmation before any delete, stop, resize,
tier, or reservation purchase action.

## Pricing

Use `get_retail_prices` for public prices. For negotiated pricesheets, call
`start_pricesheet_download`, poll `get_pricesheet_status`, and keep retail and
negotiated values clearly labeled. Do not claim realized savings from retail
price comparisons alone.
