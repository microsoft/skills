# GPU scheduling, stack, quota, and capacity

Use this flow for a GPU pod that is Pending, especially with
`Insufficient nvidia.com/gpu`. Keep every read bound to the named subscription,
cluster, context, pool, namespace, and pod.

## Capture the four walls

```bash
az account show --query '{subscription:id,tenant:tenantId}' -o json
az aks show --subscription <subscription> -g <resource-group> -n <cluster> \
  --query '{id:id,fqdn:fqdn,location:location}' -o json
kubectl config current-context
kubectl describe pod -n <namespace> <pod>
kubectl get node <gpu-node> \
  -o jsonpath='{.metadata.name}{"\n"}{.spec.taints}{"\n"}{.status.capacity}{"\n"}{.status.allocatable}{"\n"}'
az aks nodepool show --subscription <subscription> -g <resource-group> \
  --cluster-name <cluster> -n <pool> \
  --query '{id:id,vmSize:vmSize,gpuProfile:gpuProfile,enableAutoScaling:enableAutoScaling,provisioningState:provisioningState}' -o json
```

1. **Regional and family quota:** use the failed operation's region and exact
   GPU VM family. Read `az vm list-usage --location <region> -o json`; compare
   that family's current value and limit. Do not claim a universal default.
2. **Capacity and SKU eligibility:** retain the exact allocation error, then
   inspect `az vm list-skus --location <region> --resource-type virtualMachines --all -o json`
   for the selected SKU and restrictions. Quota, regional/zone capacity, and
   SKU eligibility are separate conclusions.
3. **Scheduling contract:** compare node taints with pod tolerations and verify
   the container requests or limits `nvidia.com/gpu`. A selector must also
   match an eligible node. Quote the mismatched fields.
4. **Install profile:** branch only on the observed `gpuProfile`.

| Observed profile | AKS responsibility | Day-2 interpretation |
|---|---|---|
| `managementMode: Managed`, `driver: Install` | Driver, device plugin, DCGM exporter, GPU health | The profile establishes AKS ownership, but missing `nvidia.com/gpu` remains an unconfirmed incident cause until component status and node conditions support a managed-stack or node-health fault |
| `managementMode: Unmanaged`, `driver: Install` | Driver only | Verify the customer-managed device plugin; the driver alone does not advertise `nvidia.com/gpu` |
| `managementMode: Unmanaged`, `driver: None` | None | Verify the BYO driver and device plugin owners and status |
| Missing or contradictory | Unknown | Do not guess; preserve outputs and hand off |

`managementMode`, `migStrategy`, and `driver` are creation-time settings.
Changing profile means a new pool and requires authorization. Managed GPU pools
are preview and **do not support cluster autoscaler**; never recommend
cluster-autoscaler scale-to-zero for them. For a non-managed profile, inspect
the actual autoscaler setting before discussing node scaling.

Treat the managed-pool autoscaler restriction as a supported platform fact, not
as the observed cause of a Pending pod. It may be a relevant configuration
hypothesis, but the incident cause stays unconfirmed until managed component
status and node-condition evidence support it.

Sources:
[AKS-managed GPU node pools](https://learn.microsoft.com/azure/aks/aks-managed-gpu-nodes),
[self-managed NVIDIA GPUs](https://learn.microsoft.com/azure/aks/use-nvidia-gpu).
