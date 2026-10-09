# AKS Cluster Autoscaler (CAS)

Enable and tune the Cluster Autoscaler to automatically scale down idle nodes.

## Check CAS Status

```bash
az aks show \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --query "agentPoolProfiles[].{name:name, casEnabled:enableAutoScaling, min:minCount, max:maxCount, count:count}" \
  -o table

az aks show \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --query "autoScalerProfile" -o json
```

## Check Node Utilization (7 days)

Follow the metrics discovery steps in [azure-aks-rightsizing.md](./azure-aks-rightsizing.md#historical-metrics-azure-monitor--use-when-prometheus-or-container-insights-is-enabled) to list available metric definitions and query node CPU utilization. Use metric names such as `node_cpu_usage_percentage` or `cpuUsagePercentage` depending on what's available on the cluster.

## Enable CAS

```bash
# Cluster-level
az aks update \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --enable-cluster-autoscaler \
  --min-count <MIN_NODES> --max-count <MAX_NODES>

# Specific node pool
az aks nodepool update \
  --cluster-name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --name "<NODEPOOL_NAME>" \
  --enable-cluster-autoscaler \
  --min-count <MIN_NODES> --max-count <MAX_NODES>
```

## Recommended min/max Defaults

| Scenario | min-count | max-count |
|----------|-----------|-----------|
| Dev/test | 1 | current_count |
| Production (web/API) | 2 | current_count * 3 |
| Production (batch) | 0 | current_count * 5 |

> Risk: Low. CAS only scales down when pods can be safely rescheduled. Set min-count >= 2 for production HA.

## Tune CAS Profile

Apply when CAS is already on but idle nodes persist. The following
cost-oriented profile is an example, not a universal default. The two scale-down
timers are shorter than their documented 10-minute defaults, while the
utilization threshold remains at its 0.5 default:

```bash
az aks update \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --cluster-autoscaler-profile \
    scale-down-delay-after-add=5m \
    scale-down-unneeded-time=5m \
    scale-down-utilization-threshold=0.5 \
    max-graceful-termination-sec=600
```

> Risk: Medium. Shorter scale-down timers can reduce idle cost, but they can
> also cause node reprovisioning after brief demand changes. This thrashing
> adds provisioning latency; use a less aggressive profile for workloads with
> frequent short scale-out and scale-in cycles. See
> [AKS cluster autoscaler profile settings](https://learn.microsoft.com/azure/aks/cluster-autoscaler#cluster-autoscaler-profile-settings)
> and [aggressive scale-down guidance](https://learn.microsoft.com/azure/aks/cluster-autoscaler#configure-cluster-autoscaler-profile-for-aggressive-scale-down).
>
> Keep `skip-nodes-with-system-pods` at its default `true`. It prevents
> scale-down of nodes that host non-DaemonSet `kube-system` pods. Do not use
> `skip-nodes-with-system-pods=false` as a cost lever or assume every
> Microsoft-managed system component can be protected by a customer-managed
> PDB. See [AKS support policies](https://learn.microsoft.com/azure/aks/support-policies#managed-features-in-aks).

To roll back to CAS defaults:

```bash
az aks update \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --cluster-autoscaler-profile ""
```

## Profile Comparison

| Profile | scale-down-delay-after-add | scale-down-unneeded-time | utilization-threshold | Best For |
|---------|----------------------------|--------------------------|----------------------|----------|
| Default | 10m | 10m | 0.5 | General workloads |
| Cost-Optimized | 5m | 5m | 0.5 | Cost-sensitive, non-critical |
| Conservative | 30m | 30m | 0.7 | Stateful / production |
| Aggressive | 2m | 2m | 0.4 | Dev/test, batch |

> Risk: High for aggressive tuning. Ensure PodDisruptionBudgets (PDBs) are set on critical workloads before tuning. Always confirm with user before applying.
>
> Check existing PDBs before tuning:
> ```bash
> kubectl get pdb --all-namespaces
> ```

