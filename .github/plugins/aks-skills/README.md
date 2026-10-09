# AKS Skills

Optional Azure Kubernetes Service (AKS) operational skills for live incident
diagnosis, known-issue matching, GPU inference troubleshooting, and packet
capture. Install it alongside the base `azure` plugin when you operate AKS
clusters.

## Security

> [!WARNING]
> The `aks-skills` plugin's bundled telemetry hooks use `npx` to download and run the Azure MCP Server, inheriting the local environment's `.npmrc` configuration. Install this plugin only on trusted devices. A compromised `.npmrc` configuration could cause `npx` to download and execute malicious code, potentially resulting in remote code execution.

- The troubleshooting and capture skills read cluster and Azure state with your
  existing `az` and `kubectl` credentials. They do not change resources or
  start a packet capture without your explicit approval.
- `azure-search-nav` signs you in with `Connect-AzAccount` and sends your Azure
  Resource Manager access token to the Azure portal navigation search service,
  the same pattern Azure Copilot uses in the portal. It returns links only and
  does not modify resources. See its
  [authentication and data flow notes](skills/azure-search-nav/references/README.md#authentication-and-data-flow).

## Telemetry

The `track-telemetry` hook script uses `npx` to download and run Azure MCP to
collect telemetry for usage of skills from this plugin. To opt out of telemetry
collection, set `AZURE_MCP_COLLECT_TELEMETRY=false` in the environment of the
process running the agent.

## Skills

| Skill | Use it to |
|-------|-----------|
| **aks-troubleshooting** | Investigate live AKS incidents with read-only evidence collection and a structured root-cause report |
| **aks-known-issues** | Match a named AKS error signature to its documented cause, fix, and Microsoft Learn reference |
| **aks-network-capture** | Collect bounded packet captures from selected AKS nodes for wire-level troubleshooting |
| **aks-gpu-inference** | Diagnose GPU and KAITO inference workloads: scheduling, out-of-memory, observability, and scaling |
| **azure-search-nav** | Get an Azure portal deep link to a specific blade for a supported AKS, Arc-enabled Kubernetes, or Compute resource |

## Relationship to the base `azure` plugin

The base `azure` plugin keeps AKS planning, cluster setup, deployment, and
baseline diagnostics. This plugin adds deeper operational skills and is never
installed automatically: when one would help, the agent explains why and asks
before installing it. If you decline, or your host can't install it, the agent
continues with the base guidance.

## Install

In Copilot CLI:

1. Add the marketplace: `/plugin marketplace add microsoft/azure-skills`
2. Install this plugin: `/plugin install aks-skills@azure-skills`
3. Update it later with `/plugin update aks-skills@azure-skills`

If your organization's plugin policy blocks this plugin, the base `azure`
plugin's AKS guidance remains available.
