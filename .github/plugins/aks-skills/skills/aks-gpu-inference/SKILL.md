---
name: aks-gpu-inference
description: "Diagnose Day-2 AKS GPU and KAITO incidents using profile-aware, read-only evidence. WHEN: 'Insufficient nvidia.com/gpu', GPU pod Pending, model-load OOM, DCGM/VRAM, KAITO Workspace not ready, or GPU autoscaling. DO NOT USE FOR: setup (airunway-aks-setup), non-GPU incidents (aks-troubleshooting), standalone VM quota (azure-quotas), or generic cost (cost-analysis or cost-optimization from the optional azure-cost plugin)."
license: MIT
metadata:
  author: Microsoft
  version: "1.1.1"
---

# AKS GPU Inference Day-2

## Quick Reference

| Property | Value |
|---|---|
| Best for | AKS GPU/KAITO failures |
| Evidence | Bound target, events/status, `gpuProfile`, DCGM |

## When to Use This Skill

Use for scheduling, VRAM/OOM, KAITO readiness, and workload scaling. Route
exclusions as described above.

## MCP Tools

Use a fitting host-advertised Azure read or the references' read-only queries.

## Host Capability Gate

Before executing any referenced pipeline, verify that the host authorizes
the required shell and `kubectl`/`az` commands against the bound target.
File-backed collection also requires approved artifact storage and access to
any bundled files it uses. A governed Azure CLI tool alone does not establish
these capabilities. Equivalent host reads may replace commands only where
their advertised schemas provide the required evidence.

If execution is unavailable or prohibited, say so and analyze supplied or
redacted events, status, logs, and metrics, or give the operator a scoped
collection plan. State which reads did not run and leave conclusions requiring
missing evidence unconfirmed. Never route `kubectl` through Azure MCP or
bypass host policy. The authorization requirements below still apply.

## Workflow

1. Bind subscription, cluster, kube context, pool, and affected resource.
2. Capture exact events/status and observed `gpuProfile`; state which reads ran.
3. Route to [scheduling](references/gpu-scheduling.md),
   [observability](references/gpu-observability.md),
   [KAITO](references/kaito-workspaces.md), or
   [scaling](references/gpu-cost-and-scaling.md).
4. Separate container/host OOM from device-allocation failures. For `OOMKilled`,
   correlate container memory limits/usage and node conditions. For
   Managed+Install device-memory evidence, use the exporter on port 19400 and
   incident-window `FB_USED`/`FB_FREE`; sizing tables do not establish a cause.
5. For KAITO not-ready, warn that Workspace deletion leaves its GPU pools;
   cleanup is separate and needs explicit authorization.
6. Report evidence, confidence, missing evidence, and owner handoff.

Require explicit authorization before scaling, cordon/drain, deletion,
add-on enablement, or monitoring mutation.

## Error Handling

| Condition | Response |
|---|---|
| Missing/contradictory evidence | Mark unconfirmed; request the owner/read |
| Unknown profile | Preserve evidence; do not prescribe stack repair |
| Mutation required | Propose separately and wait for authorization |
