---
name: aks-known-issues
license: MIT
metadata:
  author: Microsoft
  version: "1.2.1"
description: "Lookup documented AKS fixes only when the prompt includes an exact catalog signature and all of its qualifiers: VMCannotFitEphemeralOSDisk; NodePoolMcVersionIncompatible; 'NodeImageVersion is not accepted'; AKS SkuNotAvailable with size, location, and zone; ZonalAllocationFailed with insufficient zone capacity; OverconstrainedAllocationRequest with listed constraints; nested AKS vmssCSE/CSE VMExtensionError_OutboundConnFail, VMExtensionError_K8SAPIServerConnFail, or VMExtensionError_K8SAPIServerDNSLookupFail; or AllocationFailed with the full cataloged internal-error or insufficient-regional-capacity message. Never use for quota errors, code-only or bare wrappers, generic symptoms, incomplete signatures, or failures outside AKS; use aks-troubleshooting or azure-diagnostics."
---

# AKS Known Issues

## Quick Reference

| Property | Value |
|---|---|
| Best for | Exact signature plus AKS operation |
| Output | Cause, fix, and Learn citation |

Use the [catalog](references/error-code-map.md).

## When to Use This Skill

Named catalog signatures only. Generic AKS → `aks-troubleshooting`; non-AKS →
no AKS skill.

If every qualifier for a catalog row is not present, do not use this skill.
This catalog has no quota-error rows; route AKS quota incidents to
`aks-troubleshooting`.

## MCP Tools

None required. Use advertised read-only Azure tools or CLI queries.

## Workflow

1. Capture exact code, nested message, operation, and AKS resource.
2. Require every qualifier; codes are not substrings.
3. Give cause, fix, citation, and read-only verification.
4. State what ran; require explicit approval before every mutation.

## Error Handling

| Input | Response |
|---|---|
| Bare wrapper/number | Request nested signature and CSE context |
| Generic AKS | `aks-troubleshooting` |
| Non-AKS | No AKS skill |
