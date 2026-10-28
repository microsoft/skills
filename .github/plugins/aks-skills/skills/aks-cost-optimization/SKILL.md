---
name: aks-cost-optimization
license: MIT
metadata:
  author: Microsoft
  version: "1.0.10"
description: "Analyze advanced AKS cost efficiency. WHEN: \"AKS NAP readiness\", \"AKS bin packing\", \"AKS node scaling bottleneck\", \"AKS blocked scale-down\", \"AKS storage cost\". DO NOT USE AS DIRECT ENTRY FOR: overall AKS cost assessments or rightsizing/VPA/CAS/Spot (azure-kubernetes); spend/anomalies/commitments (cost-analysis/cost-optimization); incidents (aks-troubleshooting)."
---

# AKS Cost Optimization

## When to Use This Skill

Use for advanced existing-cluster analysis requiring scheduling, placement, or
verified storage mapping. Route overall AKS cost assessments to
`azure-kubernetes`, spend/anomalies to `cost-analysis`, commitments to
`cost-optimization`, and incidents to `aks-troubleshooting` when those skills are available. When called from an overall assessment, return findings for its ranked report.

## MCP Tools

Prefer fitting Azure MCP reads. Never invent tools or use `az`/`kubectl`
without approved shell access and a target-bound context.

## Workflow/Steps

1. Bind the subscription, cluster, resource group, and kube context.
2. Route to [NAP readiness](references/aks-nap.md),
   [bin-packing](references/aks-bin-packing.md),
   [node-scaling bottlenecks](references/node-scaling-bottlenecks.md), or
   [storage optimization](references/aks-storage-optimization.md).
3. When invoked for AKS commitment context, use the
   [commitment-demand handoff](references/aks-savings-plans-reservations.md)
   and return demand evidence without benefit analysis or a transaction.
4. Keep reads non-mutating; require approval for every change.

## Error Handling

- Missing capability: analyze supplied evidence or provide a collection plan;
  mark dependent cost or commitment results unavailable.
- Evidence conflict: mark the conclusion unconfirmed.
