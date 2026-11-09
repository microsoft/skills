---
name: azure-advisor
description: "Use Azure Advisor. WHEN: \"show recommendations\", \"top Advisor actions\", \"prioritize recommendations\", \"service retirements\", \"update status\". Unused-resource discovery and Cost/IdleResources requests use azure-advisor-cost-optimization; generic Cost and cross-category requests stay here. DO NOT USE FOR: fixes (use azure-advisor-actionability)."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.3"
---

# Azure Advisor

Prefer Advisor MCP tools over Resource Graph or generic ARM calls.
Reuse supplied scope and identifiers; ask only for missing input.

## Quick reference

Prefer Azure Advisor MCP tools. Use their current schemas for parameters and limits; discover unfamiliar parameters rather than inventing them.

| Intent | Tool |
|---|---|
| Counts, totals, breakdowns, or distributions | `advisor_recommendation_summary`; non-prioritized, with the requested `group-by` |
| Broad priorities: top recommendations/actions, most important, critical, or fix-first advice | `advisor_recommendation_summary`; `prioritized: true` (automatically groups by recommendation type) |
| Individual recommendations or affected resources, including status-filtered records | `advisor_recommendation_list`; no prior summary required; for priority ordering within a known type, pass one `recommendation-type-ids` array entry and `prioritized: true` |
| Complete, dismiss, postpone, or reactivate | `advisor_recommendation_update` |
| Browse recommendation types | `advisor_metadata_list` |
| Get one type by ID | `advisor_metadata_get` |
| Fix or remediate a recommendation | `azure-advisor-actionability` skill; it owns remediation tool calls and safeguards |

## Workflow

- For unused-resource discovery, including "what are we paying for that is no longer
  being used", or combined `category=Cost` and `sub-category=IdleResources`, load
  `azure-advisor-cost-optimization` first. It owns scope, sequencing and response templates;
  broad discovery must not skip to resource details.
- Generic/prioritized Cost outside IdleResources, cross-category and other requests stay here.
  Preserve requested filters; never silently add IdleResources.
- Before generic calls or reporting, read [Workflow](references/workflow.md).
- For remediation, load `azure-advisor-actionability`; it owns execution safeguards.

1. Reuse known scope and identifiers. Pass the requested count as `top`: groups for summary, records for list. "Critical" means priority, not an `impact` value.
2. For savings priorities, use `category: "Cost"`. Top retirements use prioritized summary, not list, with `sub-category: "ServiceUpgradeAndRetirement"` and `retirement-date: "le:<yyyy-MM-dd>"` for on-or-before cutoffs.
3. For drill-downs, preserve scope and filters; pass the selected recommendation-type group's actual GUID `key` as the sole entry in list `recommendation-type-ids`. Retain `prioritized: true` after a prioritized summary and add `category: "Cost"` for a Cost type. Do not copy summary `top` to list.
4. If broad priorities require `status` or `tracking-ids`, explain that cross-type ranking is unavailable. Use filtered, non-prioritized list and explicitly label results unranked, not "top". Never silently drop unsupported constraints.
5. Present returned data in server ranking order; disclose errors and truncation. Never count a capped list or filter capped results to simulate a server-side date query.

"Top actions" and "what should I fix first?" ask for prioritization advice, not permission to remediate.

## Safety

Ask for and wait for user confirmation before recommendation-state updates. The actionability skill owns remediation safeguards.
On every model, visibly present results/proposals before dependent questions.
Missing data stays `Unavailable`, not zero.
