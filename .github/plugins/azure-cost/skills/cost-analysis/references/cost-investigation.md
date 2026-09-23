# Cost Investigation

Explain what changed before recommending remediation.

## Establish the Baseline

1. Confirm scope, anomaly window, currency, and whether the concern is a daily
   spike, sustained increase, or invoice-level change. Exclude an incomplete
   current day unless the user explicitly wants partial data.
2. Call `query_costs` with daily granularity for the anomaly and an equal-length
   baseline. Prefer comparable weekdays, billing-cycle position, and known
   seasonal or deployment periods over an arbitrary preceding window.
3. Request separate `granularity=None` totals for the anomaly and baseline;
   never sum daily rows in a shell or local interpreter. Calculate the absolute
   and percentage delta from those returned totals per currency. Keep actual
   and amortized cost separate; use amortized cost when commitment purchases
   could distort the usage trend.

## Find the Driver

4. Start with `ServiceName`, rank by absolute delta, then narrow the leading
   service through separate bounded queries by `ResourceGroupName`,
   `ResourceId`, and `Meter` where those dimensions are supported. Reuse exact
   values returned by the broader query instead of guessing filter values.
5. Query `ChargeType` and `PricingModel` to distinguish recurring usage,
   purchases, refunds, credits, marketplace charges, and commitment effects.
   Do not attribute a shared or unallocated charge to one resource without
   evidence.
6. Prefer one billing-scope request over many subscription requests when the
   subscriptions share an accessible billing scope. Otherwise limit fan-out,
   sort by cost descending, and disclose partial results.

## Correlate the Cause

7. For the leading resources, query Resource Graph `resourcechanges` around the
   anomaly. Run `generate_query`, `validate_query`, then `execute_query`.
   Inspect creates, deletes, SKU or tier changes, scale events, region changes,
   and ownership-tag changes.
8. Correlate only evidence from matching resources and time windows. A change
   near a spike is a candidate cause, not proof. Resolve likely ownership from
   resource groups and the organization's actual owner or cost-allocation tags;
   tag names are case-sensitive.
9. Classify the result as recurring or one-time and controllable or expected.
   Assign high confidence only when cost, resource, meter, and change evidence
   align. Use medium or low confidence when attribution is indirect.

Use the [cost-query workflow](cost-query/workflow.md) for limits, pagination,
query errors, and API fallback.

## Report

Present:

- anomaly and baseline windows;
- absolute and percentage change per currency;
- leading service, resource group, resource, meter, charge type, and pricing
  model;
- correlated resource changes and likely owner;
- classification, confidence, evidence gaps, and one next action.

Change history is short-lived, and empty results can reflect retention,
permissions, or unsupported attribution. Never treat missing evidence as proof
that nothing changed.

## Handoffs

- Overprovisioning or cleanup opportunity: `cost-optimization`.
- Reservation or Savings Plan change: `cost-optimization` commitment workflow.
- AKS driver: [AKS cost analysis](aks-cost-analysis.md).
