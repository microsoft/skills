# AKS Spot Node Pools

Recommend and create Spot VM node pools for batch, dev/test, or fault-tolerant workloads (60-90% cost reduction vs regular nodes).

## Check Existing Node Pools

```bash
az aks nodepool list \
  --cluster-name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --query "[].{name:name, vmSize:vmSize, priority:scaleSetPriority, count:count, mode:mode}" \
  -o table
```

## Identify Spot-Suitable Workloads

Before creating a Spot pool, identify which workloads can tolerate interruptions:

```bash
# List deployments without PodDisruptionBudgets (single-replica or no PDB = higher eviction risk)
kubectl get deployments --all-namespaces -o json | \
  jq -r '.items[] | select(.spec.replicas == 1) | "\(.metadata.namespace)/\(.metadata.name)"'

# Check which pods already have spot tolerations
kubectl get pods --all-namespaces -o json | \
  jq -r '.items[] | select(.spec.tolerations[]?.key == "kubernetes.azure.com/scalesetpriority") | "\(.metadata.namespace)/\(.metadata.name)"'
```

Use the suitability table below to decide which workloads to migrate.

## Mixed Node Pool Pattern (Spot + Regular)

For workloads that need resilience but want cost savings, use a mixed approach:

```bash
# Keep existing regular node pool as fallback (min 1-2 nodes)
az aks nodepool update \
  --cluster-name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --name "<REGULAR_POOL>" \
  --enable-cluster-autoscaler --min-count 1 --max-count 3

# Add Spot pool for the majority of workload capacity
# -1 means pay up to on-demand price (no cap); set e.g. 0.05 to cap hourly spend
az aks nodepool add \
  --cluster-name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --name "<SPOT_POOL_NAME>" \
  --priority Spot --eviction-policy Delete --spot-max-price -1 \
  --node-vm-size "<VM_SIZE>" \
  --node-count 3 --min-count 0 --max-count 10 \
  --enable-cluster-autoscaler \
  --node-taints "kubernetes.azure.com/scalesetpriority=spot:NoSchedule" \
  --labels "kubernetes.azure.com/scalesetpriority=spot"
```

The toleration below makes Spot nodes eligible, while preferred affinity biases
scheduling toward Spot when it is available. Because the affinity is preferred
rather than required, compatible regular nodes remain eligible when Spot
capacity is unavailable. This does not promise failover or capacity: the
regular pool must have compatible labels, resources, taints, and available
capacity. Pods pinned to Spot with a `nodeSelector` or required affinity remain
pending when Spot capacity is unavailable.

## Workload Toleration and Preference (add to Deployment YAML)

```yaml
tolerations:
- key: "kubernetes.azure.com/scalesetpriority"
  operator: "Equal"
  value: "spot"
  effect: "NoSchedule"
affinity:
  nodeAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      preference:
        matchExpressions:
        - key: "kubernetes.azure.com/scalesetpriority"
          operator: In
          values:
          - "spot"
```

## Suitability

| Workload | Spot-Suitable? |
|----------|----------------|
| Batch / data processing | Yes |
| Dev / test environments | Yes |
| Stateless web/API (replicas >= 2) | Yes (with care) |
| Jobs with checkpointing | Yes |
| Stateful workloads (databases) | No |
| Single-replica critical services | No |

> Risk: Low for batch/dev. High for production stateful workloads. Spot VMs evict with 30-second notice. Eviction policy Delete is recommended for AKS.

## Handling Eviction Gracefully

Configure workloads to handle the 30-second eviction notice:

```yaml
# Add to Deployment spec — terminationGracePeriodSeconds should be < 30s for Spot
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 25
      containers:
      - name: <CONTAINER_NAME>
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 5"]  # Drain in-flight requests
```

> A PodDisruptionBudget does not prevent Azure Spot node reclamation. PDBs
> constrain voluntary disruptions performed through the Kubernetes Eviction
> API, such as drains, upgrades, and cluster-autoscaler scale-down. Azure can
> reclaim or delete the underlying Spot VM involuntarily, reducing availability
> below the budget. See [AKS PDB guidance](https://learn.microsoft.com/azure/aks/operator-best-practices-scheduler#limit-disruption-impact-by-using-pod-disruption-budgets-pdbs)
> and [Spot node pool limitations](https://learn.microsoft.com/azure/aks/spot-node-pool).
>
> Use multiple replicas distributed across nodes or other failure domains, and
> retain enough compatible regular-pool capacity for the workload's availability
> requirements. Preferred Spot affinity permits that fallback but cannot
> guarantee scheduling capacity.
