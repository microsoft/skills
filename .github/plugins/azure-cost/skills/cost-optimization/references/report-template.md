# Cost Optimization Report Template

Use `create_file` with path `output/costoptimizereport<YYYYMMDD_HHMMSS>.md` and the following structure:

```markdown
# Azure Cost Optimization Report
**Generated**: <timestamp>

## Executive Summary
- Total Monthly Cost: $X (ACTUAL DATA from Azure Resource Manager MCP)
- Top Cost Drivers: [List top 3 services with costs]
- Potential Savings: $Y/month

## Cost Breakdown by Service
| Service | Cost (USD) | % of Total |
|---------|-----------|------------|
| ... | ... | ... |
| **Total** | **$X** | **100%** |

## Free Tier Analysis
[Resources operating within free tiers]

## Orphaned Resource Candidates
[Candidates from validated Resource Graph queries; confirm ownership before deletion]

## Optimization Recommendations

### Priority 1: High Impact, Low Risk
- ACTUAL cost: $X/month
- ESTIMATED savings: $Y/month
- Approval-required action

### Priority 2: Medium Impact, Medium Risk
- ACTUAL baseline, ACTUAL metrics, VALIDATED pricing
- ESTIMATED savings and approval-required action

### Priority 3: Long-term Optimization
[Reserved Instances, Storage tiering]

## Total Estimated Savings
- Monthly: $X | Annual: $Y

## Implementation Plan
[Approval gates, owner, validation, and rollback steps]

## Validation Appendix
- Cost Query Results: `output/cost-query-result<timestamp>.json`
- Pricing Sources: [Links]
```

## Portal Link Format

Include Azure Portal links for all resources using this format:

```text
https://portal.azure.com/#@<TENANT_ID>/resource/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP>/providers/<RESOURCE_PROVIDER>/<RESOURCE_TYPE>/<RESOURCE_NAME>/overview
```

## Audit Trail

Save cost query results to `output/cost-query-result<YYYYMMDD_HHMMSS>.json` for reproducibility.
