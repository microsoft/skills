# AKS Commitment-Demand Handoff

Prepare stable, post-optimization AKS compute demand for `cost-optimization`,
which owns Reservation and Savings Plan analysis. Direct commitment requests
start there. Use this workflow only when AKS optimization could materially
change steady node demand; do not calculate economics or purchase commitments.

## Preconditions

Complete applicable rightsizing, autoscaler, NAP, and bin-packing analysis. Confirm the cluster, representative lookback, planned compute changes, and retained Capacity Reservation Group (CRG) requirements.

## Collect AKS Demand

1. Use Azure MCP AKS or an approved `az aks show` fallback for node resource
   group, region, provisioning mode, and regular pool metadata.
2. For manual provisioning, collect each pool's VM size, current/min/max count,
   autoscaling, priority, CRG association, and upgrade surge. Map it to exact
   VMSS or VM resource IDs from pool metadata, not names alone.
3. For NAP, map each observed node or `NodeClaim` through `providerID` to exact
   Azure compute IDs; do not infer demand from the AKS pool list. Retain
   time-aligned SKU, region, zone, architecture, OS, and
   `karpenter.sh/capacity-type`; report unmapped resources as an evidence gap.
4. Exclude Spot capacity from stable commitment demand. Group non-Spot
   observations by compatible compute characteristics.
5. Reuse representative history; otherwise range-query managed Prometheus
   `kube_node_info` hourly over the requested 30-60 days, joining node and
   `provider_id` to the time-aligned mapping. Fall back to Container Insights
   only when Prometheus history is unsuitable. Report the requested/observed
   periods, observed hours, min/p05/p50/p95/max counts, and candidate-baseline
   hours and coverage. Retention limits the lookback. If neither source
   provides representative history, stable demand is unknown and no baseline may be produced.
6. Query associated CRGs through Resource Graph. Keep SKU, region, zone,
   reserved, associated, unused, and retained quantities separate. Unused CRG
   capacity remains billable.
7. Account for approved rightsizing, consolidation, NAP, migration, and
   reliability changes. Record seasonal, temporary, surge, outage, and planned
   demand that makes the lookback unrepresentative.

## Handoff

Provide `cost-optimization` with:

| Field | Content |
|---|---|
| AKS scope | Cluster ID, node resource group, region |
| Compute mapping | Provisioning mode, compatible compute group, exact VMSS/VM resource IDs, SKU, region/zone, architecture, OS, capacity type |
| Continuous baseline | Candidate non-Spot counts by compatible compute group, hours covered, coverage percentage, p05/p50/p95, lookback |
| Variability | Peak, seasonal, temporary, surge, outage, and planned-demand exceptions |
| Planned changes | Rightsizing, consolidation, NAP, migration, SKU/region changes |
| Capacity reservations | CRG reserved, associated, unused, and retained quantities |
| Evidence gaps | Missing history, inaccessible pools, or unresolved owner intent |

Ask `cost-optimization` to evaluate utilization, coverage, scope, expiry, and
renewal; retrieve Azure recommendations; correlate them with exact AKS mappings
and approved changes; disclose broader-scope benefits; and return term, scope,
coverage, expected utilization, reported savings/currency, assumptions, risks,
and next review date.

This workflow does not query benefit APIs, recommend quantities, or claim
expiry/renewal actions. If `cost-optimization` is unavailable, return the
demand evidence and mark commitment analysis unavailable.
