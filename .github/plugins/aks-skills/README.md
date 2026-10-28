# AKS Skills

Optional Azure Kubernetes Service (AKS) operational skills for live incident
diagnosis, advanced cost-efficiency analysis, known-issue matching, GPU
inference troubleshooting, and packet capture. Install it alongside the base
`azure` plugin when you operate AKS clusters.

## Security

- The troubleshooting and capture skills read cluster and Azure state with your
  existing `az` and `kubectl` credentials. They do not change resources or
  start a packet capture without your explicit approval.
- `azure-search-nav` signs you in with `Connect-AzAccount` and sends your Azure
  Resource Manager access token to the Azure portal navigation search service,
  the same pattern Azure Copilot uses in the portal. It returns links only and
  does not modify resources. See its
  [authentication and data flow notes](skills/azure-search-nav/references/README.md#authentication-and-data-flow).

## Telemetry

The `track-telemetry` hook installs a pinned native `ghcfa-telem` release asset
when needed, verifies its platform-specific SHA-256 digest before extraction,
and caches the executable for reuse. To opt out of telemetry collection, set
`AZURE_MCP_COLLECT_TELEMETRY=false` in the environment of the process running
the agent.

## Skills

| Skill | Use it to |
|-------|-----------|
| **aks-troubleshooting** | Investigate live AKS incidents with read-only evidence collection and a structured root-cause report |
| **aks-known-issues** | Match a named AKS error signature to its documented cause, fix, and Microsoft Learn reference |
| **aks-network-capture** | Collect bounded packet captures from selected AKS nodes for wire-level troubleshooting |
| **aks-gpu-inference** | Diagnose GPU and KAITO inference workloads: scheduling, out-of-memory, observability, and scaling |
| **aks-cost-optimization** | Assess NAP readiness, diagnose node-scaling bottlenecks, model node-pool bin-packing, optimize Kubernetes-aware storage, and prepare AKS demand evidence for commitment analysis |
| **azure-search-nav** | Get an Azure portal deep link to a specific blade for a supported AKS, Arc-enabled Kubernetes, or Compute resource |

## Relationship to the base `azure` plugin

The base `azure` plugin keeps AKS planning, cluster setup, deployment, and
baseline diagnostics. This plugin adds deeper operational skills and is never
installed automatically: when one would help, the agent explains why and asks
before installing it. If you decline, or your host can't install it, the agent
continues with the base guidance.

## Relationship to the optional `azure-cost` plugin

`aks-cost-optimization` contributes Kubernetes-aware storage, placement, and
stable node-demand evidence. Use `cost-analysis` for billed AKS spend, namespace
allocation, and anomalies. Use `cost-optimization` for Reservation and Savings
Plan utilization, coverage, recommendations, economics, purchases, and
renewals.

## Install

Install the base `azure` plugin first, then add this plugin. This plugin is
published in the `microsoft/azure-skills` marketplace. Its manifests don't
declare `azure` as a dependency, because a client could then install a second
copy of `azure` next to the one you already have. Keep exactly one copy of
`azure`, from whichever marketplace you installed it.

### Copilot CLI

1. Add the marketplace: `/plugin marketplace add microsoft/azure-skills`
2. Install this plugin: `/plugin install aks-skills@azure-skills`
3. Update it later with `/plugin update aks-skills@azure-skills`

### Claude Code

`aks-skills` isn't listed in `claude-plugins-official`, so add the
`azure-skills` marketplace even if you installed `azure` from
`claude-plugins-official`.

1. If you don't have the base plugin yet, install it:
   `/plugin install azure@claude-plugins-official`
2. Add the marketplace: `/plugin marketplace add microsoft/azure-skills`
3. Install this plugin: `/plugin install aks-skills@azure-skills`
4. Run `/reload-plugins`, or start a new session, so the skills appear.
5. Update it later with `/plugin update aks-skills@azure-skills`

### Codex

Codex reads the same Claude-style marketplace.

1. Add the marketplace: `codex plugin marketplace add microsoft/azure-skills`
2. In the Codex plugin browser, open the `azure-skills` marketplace and install
   `azure` (if you don't have it yet) and `aks-skills`.
3. Start a new session so the skills appear.

If your organization's plugin policy blocks this plugin, the base `azure`
plugin's AKS guidance remains available.
