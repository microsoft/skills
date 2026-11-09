# Output and savings

Read [Table format](table-format.md) before rendering tables.
Focused answers start with the requested result, not discovery; selected resources and
lifecycle reports use their scenario templates.

## Resource ownership

Recommendation `subscriptionName` is a top-level field, not inside `properties`.
When reading large responses or projecting compact rows, preserve it alongside the
resource ID, name, resource group and savings; do not extract only `properties`.
Reuse the returned subscription ID-to-name mapping in later reports, including
prevalidation responses that contain only resource IDs. Prefer returned or already
resolved names; use an ID only when neither provides a name. Do not query Azure again
just to recover names already returned, or claim those names were unavailable.

## Count semantics

Normal `groups[].count` and `totalRecommendations` count records: label Recommendations,
not unique resources. Prioritized counts are distinct Affected resources per type; the sum
can include a resource under multiple types, not globally unique resources.
These meanings also apply to `summary.cost.recommendationCount`, `typeTotals[]` and
`statusTotals[]`. Never substitute list length or visible-group sums.
Disclose hidden groups using `totalRecommendationGroupCount` and
`remainingRecommendationGroupCount`; full Cost totals can cover undisplayed types.

## Authoritative money

Use `summary.cost` independently of top/prioritization:

| Field | Meaning |
|---|---|
| `currencyTotals[].potentialSavings` | Yearly potential savings |
| `currencyTotals[].accumulatedWaste` | Cost: accumulated Advisor cost, not yearly savings |
| `currencyTotals[].realizedSavings` | Realized savings in the appropriate lifecycle |
| `typeTotals[]` | Match `recommendationTypeId`; use returned names/measures |
| `statusTotals[]` | Lifecycle counts, not monetary totals |
| `billReducingOpportunityCount`, `zeroSavingsCount`, `unavailablePricingCount` | Opportunity/pricing coverage |
| `asOfUtc`, `fromUtc`, `toUtc` | Calculation cutoff/window |

Current `currencyTotals` calculations are Retail USD; an empty array is not zero.
`potentialValueCount`, `accumulatedWasteCount`, `realizedSavingsCount` measure availability,
not extra opportunities. Disclose missing pricing and partial monetary coverage.

List money comes directly from `properties.savings.retail.yearlyPotentialSavings`, `.cost`,
`.realizedSavings`. Use only returned type totals
in detail introductions; omit unavailable totals rather than summing capped rows.

## Pricing basis and unknowns

| Calculation source | Basis |
|---|---|
| `summary.cost.pricingBasis`, matching `typeTotals[].pricingBasis`, `prioritizationSignals.pricingBasis` | Returned basis |
| Documented retail-only summary | Retail |
| `properties.savings.retail` | Retail |
| Unidentified source without a documented contract | Unavailable |

Calculated savings use Retail USD.
State counts or unrelated raw pricing do not establish basis/currency. Raw contractual input
alongside retail calculations is not a contractual estimate.
One basis line covers shared-basis amounts; never infer or convert contractual calculations
from raw provider data. Do not invent discounts or contractual availability/calculations.
Failed/empty queries are not zero.
