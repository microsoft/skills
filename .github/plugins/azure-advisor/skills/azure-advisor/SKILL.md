---
name: azure-advisor
description: "Use Azure Advisor recommendations. WHEN: \"show Advisor recommendations\", \"service retirements\", \"update recommendation status\". DO NOT USE FOR: fixes or remediation (use azure-advisor-actionability)."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.1"
---

# Azure Advisor

## Quick reference

Prefer Azure Advisor MCP tools over Resource Graph or generic ARM tools.

| Intent | Tool |
|---|---|
| Counts, breakdowns, rankings, or top types | `advisor_recommendation_summary` |
| Individual recommendations or affected resources | `advisor_recommendation_list` |
| Complete, dismiss, postpone, or reactivate | `advisor_recommendation_update` |
| Browse recommendation types | `advisor_metadata_list` |
| Get one type by ID | `advisor_metadata_get` |
| Retrieve remediation | `advisor_remediation_get`, then `azure-advisor-actionability` |

## Workflow

1. Identify subscription or service-group scope. Resource-group scope requires a subscription.
2. Reuse known scope and identifiers; ask only for missing values.
3. Use `summary` for aggregates and `list` for records. Never count a capped list.
4. Present only returned data, including truncation, access limitations, and errors.

Route requests to fix one recommendation to the `azure-advisor-actionability` skill. Otherwise choose the tool from the table, including `summary` or `list` for service retirements.

## Safety

Confirm before recommendation-state updates. The actionability skill owns remediation safeguards.
