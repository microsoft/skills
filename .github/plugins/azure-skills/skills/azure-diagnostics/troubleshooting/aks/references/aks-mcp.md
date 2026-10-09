# Azure MCP Reference for AKS

Use this reference when Azure MCP tools are available in the client. This
plugin configures the Azure MCP Server (`@azure/mcp`). It does not configure the
separate `Azure/aks-mcp` server, and none of that server's Kubernetes command
tools or `readonly`/`readwrite`/`admin` access levels apply here.

## Preference Order

1. The Azure MCP AKS area, under the name the host assigns it, for cluster and
   node-pool metadata
2. Separate Azure MCP areas such as AppLens, Monitor, and Resource Health, each
   only when its host-advertised schema fits the read
3. Portable `az aks` and `kubectl` reads for everything else, including all
   Kubernetes-side inspection

A literal tool name is never an availability check. Inspect the host's tool
catalog and schemas, use the smallest read that fits, and do not invent a
name-mapping layer between hosts.

## What the AKS area provides

The documented Azure MCP AKS surface is read-only metadata:

- get or list AKS clusters
- get or list AKS node pools

It does not run `kubectl`, execute detectors, query metrics, or check Resource
Health. Use the separate Azure MCP area that advertises the needed operation,
or use the portable command flows. Never route Kubernetes commands through the
AKS area. See [Azure Kubernetes Service tools for the Azure MCP Server](https://learn.microsoft.com/azure/developer/azure-mcp-server/tools/azure-kubernetes).

## Authentication And Access

Authentication is host-specific. In CLI-backed hosts the Azure MCP Server can
use the host's Azure CLI or service-principal context; in Azure SRE Agent,
built-in Azure operations use the agent's managed identity; an external MCP
connector uses the authentication configured on that connector. Inspect the
host rather than assuming one credential source.

## Detector Notes

For AppLens detector workflows, use the cluster resource ID, keep the time
window within the last 30 days, cap each run to 24 hours, and stay within the
supported AKS detector categories.

## Fallback Rule

If the host does not expose the Azure MCP area needed for a check, or its
schema does not provide the operation, fall back to:

- `az aks` for Azure-side AKS operations
- raw `kubectl` for Kubernetes-side inspection

These fallbacks require host-approved shell execution. On a host without it,
work from operator-supplied evidence and say that execution is unavailable.
