---
name: cost-optimization
description: "Optimize existing Azure resources and analyze Reservations or Savings Plans. WHEN: \"optimize Azure costs\", \"reduce cloud spending\", \"rightsize resources\", \"find idle resources\", \"orphaned disk\", \"deleted VM still charged\", \"public IP still charging\", \"reservation utilization\", \"Savings Plan coverage\", \"commitment recommendation\", \"why is pay-as-you-go still charged\". DO NOT USE FOR: cost spikes, forecasts, pricing estimates, budgets, or governance."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.1"
---

# Azure Cost Optimization

## Quick Reference

| Intent | Workflow | Primary tools |
|--------|----------|---------------|
| Reduce waste or rightsize | [Optimization](references/optimization.md) | Cost and Resource Graph tools |
| Review commitments | [Commitments](references/commitments.md) | `list_benefit_utilization`, `list_reservation_transactions`, `get_benefit_recommendations` |

## When to Use This Skill

Use for waste, rightsizing, and commitments.

## MCP Tools

Use cost and Resource Graph tools for optimization and benefit tools for
commitments. Validate queries. Fallback: [API mappings](references/tool-fallback.md).

## Workflow

1. Confirm scope, period, currency, and commitment intent.
2. Load only the matching workflow above.
3. Never transform MCP results in a shell or interpreter; request validated
   server-side projection, aggregation, or bounded follow-up queries.
4. Separate measured cost, reported savings, and qualitative opportunities.
5. Recommend changes only; do not delete, resize, purchase, or deploy resources.

## Error Handling

| Error | Action |
|-------|--------|
| Access denied | Name the scope and permission. |
| Multiple currencies | Group and report each currency separately. |
| Missing evidence | State the gap; do not invent values. |
| Server error | Retry once; then report the trace ID. |
