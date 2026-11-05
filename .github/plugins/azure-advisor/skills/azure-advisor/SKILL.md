---
name: azure-advisor
description: "Use Azure Advisor. WHEN: \"show recommendations\", \"top Advisor actions\", \"prioritize recommendations\", \"service retirements\", \"update status\". DO NOT USE FOR: fixes (use azure-advisor-actionability)."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.2"
---

# Azure Advisor

## Quick reference

Prefer Azure Advisor MCP tools. Use their current schemas for parameters and limits; discover unfamiliar parameters rather than inventing them.

| Intent | Tool |
|---|---|
| Counts, totals, breakdowns, or distributions | `advisor_recommendation_summary`; non-prioritized, with the requested `group-by` |
| Broad priorities: top recommendations/actions, most important, critical, or fix-first advice | `advisor_recommendation_summary`; `prioritized: true` (automatically groups by recommendation type) |
| Individual recommendations or affected resources, including status-filtered records | `advisor_recommendation_list`; no prior summary required; for priority ordering within a known type, pass `recommendation-type-id` and `prioritized: true` |
| Complete, dismiss, postpone, or reactivate | `advisor_recommendation_update` |
| Browse recommendation types | `advisor_metadata_list` |
| Get one type by ID | `advisor_metadata_get` |
| Fix or remediate a recommendation | `azure-advisor-actionability` skill; it owns remediation tool calls and safeguards |

## Workflow

1. Reuse known scope and identifiers. Pass the requested count as `top`: groups for summary, records for list. "Critical" means priority, not an `impact` value.
2. For savings priorities, use `category: "Cost"`. Top retirements use prioritized summary, not list, with `sub-category: "ServiceUpgradeAndRetirement"` and `retirement-date: "le:<yyyy-MM-dd>"` for on-or-before cutoffs.
3. For drill-downs, preserve scope and filters; pass the selected recommendation-type group's actual GUID `key` as list `recommendation-type-id`. Retain `prioritized: true` after a prioritized summary and add `category: "Cost"` for a Cost type. Do not copy summary `top` to list.
4. If broad priorities require `status` or `tracking-ids`, explain that cross-type ranking is unavailable. Use filtered, non-prioritized list and explicitly label results unranked, not "top". Never silently drop unsupported constraints.
5. Present returned data in server ranking order; disclose errors and truncation. Never count a capped list or filter capped results to simulate a server-side date query.

"Top actions" and "what should I fix first?" ask for prioritization advice, not permission to remediate.

## Safety

Ask for and wait for user confirmation before recommendation-state updates. The actionability skill owns remediation safeguards.
