# Azure MCP Server Reference

Azure MCP Server is the `@azure/mcp` package configured by this repository. The **AKS MCP server** is the separate `Azure/aks-mcp` product; this repository does not configure it, and none of its deep Kubernetes tools or access-level flags are part of this reference.

Use this reference to select Azure MCP Server operations and portable fallbacks in the current host.

## Capability Discovery

1. Inspect the host's available tool catalog or tool descriptions.
2. Find the Azure MCP AKS area when cluster or node-pool metadata is needed.
3. Identify AppLens, Azure Monitor, and Resource Health as separate Azure MCP areas when the investigation needs those capabilities.
4. Use matching capabilities under the names assigned by the host. Names and prefixes are host-specific; a literal name is never an availability check.
5. Inspect each selected tool's advertised schema, then choose the smallest read operation that fits.

Do not guess names, translate one host's name to another, or build a mapping layer. Capability metadata supplied by the host is the source of truth.

## Preference Order

1. Host-discovered Azure MCP AKS cluster get/list or node-pool get/list operation
2. Separate host-discovered AppLens, Azure Monitor, or Resource Health operation when relevant
3. Portable `az` and `kubectl` flows for all other Azure-side and Kubernetes-side evidence

## Happy Path

After selecting the Azure MCP AKS area, inspect the exact operations and parameter schemas the host advertises. Its current scope is read-only metadata:

- get or list AKS clusters
- get or list AKS node pools

Do not infer detector execution, monitoring queries, Resource Health checks, or Kubernetes command execution from the AKS area. Use the separate Azure MCP area that advertises the needed operation, or use the portable command flows.

## Authentication And Access

Authentication is host-specific. In Azure SRE Agent, built-in Azure operations use the agent's user-assigned managed identity; verify its target scope and RBAC. An external MCP connector uses the authentication configured on that connector. In CLI-backed hosts, the Azure MCP server can use the host's Azure CLI or service-principal context. Inspect the host and tool schema rather than assuming one credential source.

## Fallback Rule

Use these portable fallbacks whenever the host lacks the relevant Azure MCP Server area or its advertised schema does not provide the needed operation:

- `az aks` for Azure-side AKS operations
- raw `kubectl` for Kubernetes-side inspection
