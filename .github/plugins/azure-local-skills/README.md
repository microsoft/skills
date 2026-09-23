# Azure Local Skills

Azure Local planning, deployment, operations, and workload management skills, covering both standard and rack-scale deployments.

## Security

> [!WARNING]
> The `azure-local-skills` plugin uses `npx` to download and run the Azure MCP Server, inheriting the local environment's `.npmrc` configuration. Install this plugin only on trusted devices. A compromised `.npmrc` configuration could cause `npx` to download and execute malicious code, potentially resulting in remote code execution.

## Skills

- **azure-local** — Standard Azure Local (formerly Azure Stack HCI): 1-16 node hyperconverged, up to 64 disaggregated, and rack-aware clusters. Covers planning and deployment, day-2 operations and lifecycle updates, workloads (Azure Local VMs, AKS on Azure Local, images, disks, logical networks), SDN and network security, and troubleshooting.
- **azure-local-multi-rack** — Multi-rack (rack scale) deployments: preintegrated racks scaling to hundreds of machines, built on `Microsoft.NetworkCloud` and `Microsoft.ManagedNetworkFabric` with a Network Fabric Controller, Cluster Manager, SAN storage, and managed network fabric. Multi-rack is in preview.

### Choosing between them

Standard Azure Local and multi-rack use separate, non-interchangeable procedures for same-sounding tasks such as creating logical networks, VMs, and network security groups. Both skills establish the deployment scale before recommending procedures and hand off to each other when the scale does not match.

Both skills start read-only and ask for confirmation before updates, deletes, reimages, network or fabric changes, and VM power operations.

## Installation

```bash
# Copilot CLI
/plugin marketplace add microsoft/azure-skills
/plugin install azure-local-skills@azure-skills
```
