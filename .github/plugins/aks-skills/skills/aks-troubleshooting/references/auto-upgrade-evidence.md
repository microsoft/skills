# Auto-upgrade did not happen / node image is stale

Use this decision block when the owner expected an automatic Kubernetes version
or node OS image upgrade that has not occurred. Everything here is read-only;
`az aks upgrade`, `az aks nodepool upgrade`, and channel or maintenance-window
changes are mutations covered by [upgrade-operations.md](../upgrade-operations.md).

## Evidence, in order

```bash
az aks show -g <rg> -n <cluster> --query '{sku:sku.name, upgradeChannel:autoUpgradeProfile.upgradeChannel, nodeOSUpgradeChannel:autoUpgradeProfile.nodeOSUpgradeChannel, kubernetesVersion:kubernetesVersion, currentKubernetesVersion:currentKubernetesVersion}'
az aks nodepool list -g <rg> --cluster-name <cluster> --query '[].{name:name, powerState:powerState.code, orchestratorVersion:orchestratorVersion, nodeImageVersion:nodeImageVersion}' -o table
az aks maintenanceconfiguration list -g <rg> --cluster-name <cluster> -o table
az aks maintenanceconfiguration show -g <rg> --cluster-name <cluster> -n aksManagedAutoUpgradeSchedule
az aks maintenanceconfiguration show -g <rg> --cluster-name <cluster> -n aksManagedNodeOSUpgradeSchedule
az aks get-upgrades -g <rg> -n <cluster> -o table
az aks nodepool get-upgrades -g <rg> --cluster-name <cluster> -n <pool>
az aks operation show-latest -g <rg> -n <cluster>          # aks-preview extension; last operation and its result
az monitor activity-log list -g <rg> --resource <cluster-resource-id> --offset 14d --query "[?contains(operationName.value,'Microsoft.ContainerService')]" -o table
```

## Decision block

| Observation | Meaning | What to say |
|---|---|---|
| `upgradeChannel` is `none` or null | Cluster auto-upgrade is not enabled. A maintenance window (`default`, `aksManagedAutoUpgradeSchedule`) only schedules upgrades; enabling or disabling planned maintenance does not enable or disable auto-upgrade. | The cluster was never configured to auto-upgrade Kubernetes; choosing a channel is an owner decision. |
| `nodeOSUpgradeChannel` is `None` or `Unmanaged` | Node image auto-upgrade is not managed by AKS (`Unmanaged` applies OS security patches in-VM on Linux only; Windows behaves like `None`). | Stale `nodeImageVersion` is expected; `NodeImage` or `SecurityPatch` is the owner's choice. |
| Channel set, no maintenance window run yet | Planned maintenance is best effort; runs are not guaranteed inside a given window. | Report the window and last successful operation; do not assert a failure from one missed window. |
| Channel changed recently | Node OS channel changes can take up to 24 hours to take effect; some transitions (for example to or from `Unmanaged`) reimage nodes. | Wait out the documented delay before treating it as stuck. |
| Cluster already on the channel's target (for example `stable` → latest patch of N-1) | Nothing to upgrade. Compare with `az aks get-upgrades`. | The cluster is current for its channel. |
| Node pool `powerState` is `Stopped` | Stopped pools are included in an auto-upgrade, but the upgrade is applied when the pool starts. | The pool will pick up the version on start; no action while stopped. |
| Cluster is at N-3 and about to fall out of support | AKS force-upgrades N-3 clusters that would drop to N-4, moving them to N-2, to keep them in the support window. | An unexpected upgrade may be the support-window forced upgrade, not a channel setting. |
| `sku.name` is `Automatic` | AKS Automatic is preconfigured: cluster channel `stable` (latest patch of N-1) and node OS channel `NodeImage`; the channels cannot be changed, maintenance windows can. | Do not recommend changing channels; use maintenance windows. |
| A recent `Microsoft.ContainerService` operation failed | The upgrade was attempted and failed. | Switch to the stuck/failed upgrade evidence in [upgrade-operations.md](../upgrade-operations.md). |

Channel semantics (Standard clusters): `none` (off), `patch` (latest patch of
the current minor), `stable` (latest patch of N-1), `rapid` (latest patch of
N), `node-image` (legacy, planned for deprecation; use the node OS channel
instead). Node OS channels: `None`, `Unmanaged`, `SecurityPatch`, `NodeImage`
(default for new Standard clusters and always used by Automatic).

Sources: [Auto-upgrade cluster](https://learn.microsoft.com/azure/aks/auto-upgrade-cluster),
[Auto-upgrade node OS image](https://learn.microsoft.com/azure/aks/auto-upgrade-node-os-image),
[Planned maintenance](https://learn.microsoft.com/azure/aks/planned-maintenance).
