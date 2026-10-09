---
name: aks-network-capture
description: "Collects bounded packet captures from AKS nodes and Azure network configuration for wire-level evidence. WHEN: \"capture packets on an AKS node\", \"take a pcap\", \"run tcpdump on AKS\", \"prove where packets drop\". Use for explicit packet-capture intent after read-only diagnostics, not general AKS connectivity or ingress troubleshooting."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.1"
---

# AKS Network Capture

## Quick Reference

| Use | Requires | Safety |
| --- | --- | --- |
| AKS pcap evidence | `kubectl`; `az` for Azure evidence | Bounded, pinned, least privilege |

## When to Use This Skill

Use for explicit packet capture after read-only checks, not generic connectivity failures.

## MCP Tools

Azure MCP's AKS area provides cluster and node-pool metadata, not Kubernetes
command execution or packet capture.

## Host Capability Gate

Before executing the workflow, confirm that the host permits the required
Bash or PowerShell execution, `kubectl` access to the bound cluster, `az` for
Azure evidence, access to the bundled scripts, and an approved artifact
destination. A governed Azure CLI tool alone does not establish that shell,
Kubernetes commands, or artifact operations are supported.

If a required capability is unavailable or prohibited, state that capture
execution is unavailable in this host. Analyze supplied, appropriately
redacted evidence or give the operator a target-bound collection/capture plan;
do not claim to have run it. Never route `kubectl` through Azure MCP, add an
unapproved execution path, or bypass host policy. Host support does not replace
the mutation and sensitive-data approvals below.

Run bundled scripts from the skill root only after this gate is satisfied.

## Workflow/Steps

0. Check host capabilities, then complete [authorization and target binding](references/capture-authorization.md).
   Capture intent is not mutation consent. Stop for separate approval before
   any debug-container fallback.
1. Install [Bash](scripts/setup-capture-configmap.sh) / [PowerShell](scripts/setup-capture-configmap.ps1).
2. Capture nodes or pods with [Bash](scripts/create-capture.sh) / [PowerShell](scripts/create-capture.ps1).
3. Generate traffic if approved with [Bash](scripts/generate-test-traffic.sh) / [PowerShell](scripts/generate-test-traffic.ps1).
4. Retrieve the exact run with [Bash](scripts/retrieve-captures.sh) / [PowerShell](scripts/retrieve-captures.ps1).
5. Gather Azure evidence with [Bash](scripts/collect-azure-network-info.sh) / [PowerShell](scripts/collect-azure-network-info.ps1).

The ConfigMap runs [run-capture.sh](scripts/run-capture.sh) inside its pinned Linux image.

## Error Handling

| Error | Action |
| --- | --- |
| Invalid input | Correct it before retrying. |
| Missing/stale ConfigMap | Run setup again. |
| Capture/retrieval failure | Inspect Job logs; missing evidence is not success. |
