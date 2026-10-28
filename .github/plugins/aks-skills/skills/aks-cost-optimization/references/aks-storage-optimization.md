# AKS Storage Optimization

Reduce AKS persistent-volume and disk cost without weakening durability or performance. Never delete, migrate, change tier/redundancy, or recreate a node pool without explicit approval.

This workflow provides detailed rightsizing for Azure Disk CSI volumes and snapshots. For Azure Files or Blob CSI volumes, first verify the Kubernetes-to-Azure mapping, then invoke `cost-optimization` when available for service-specific lifecycle, tier, and pricing analysis. Use `azure-storage` for non-cost configuration guidance.

## Collect Evidence

1. Bind the cluster and kube context. Prefer a fitting host-advertised Azure MCP AKS read. Use the following command only with approved shell access; use `kubectl` only when the bound context is available:

```bash
az aks show --name "<cluster-name>" --resource-group "<resource-group>" \
  --query "{id:id,nodeResourceGroup:nodeResourceGroup,location:location,workspace:addonProfiles.omsagent.config.logAnalyticsWorkspaceResourceID}" \
  -o json
```

2. Collect the Kubernetes storage graph:

```bash
kubectl get pvc,pv,storageclass --all-namespaces -o json
```

Map PVC -> PV -> StorageClass -> `spec.csi.volumeHandle`. Retain PVC/PV UIDs, requested capacity, status, claim reference, provisioner, SKU, reclaim policy, access modes, and volume binding mode; distinguish Azure Disk, Files, and Blob CSI volumes.

3. Query Resource Graph for `microsoft.compute/disks` and `microsoft.compute/snapshots` when the resource is in the node resource group, its ID matches a PV volume handle, or its snapshot source is a mapped disk. Project ID, name, resource group, location, SKU, size, disk state, `managedBy`, creation time, snapshot source ID, provisioned IOPS/throughput, and tags. Compare exact case-insensitive resource IDs with PV volume handles, then classify each resource under the applicable path:
   - **Mapped-volume optimization:** classify the mapping as verified, ambiguous, or broken. For a mapped-volume candidate, require an exact verified PVC -> PV -> Azure resource mapping before recommending deletion or tier/capacity changes, attributing cost, or estimating savings.
   - **Orphan investigation:** a disk without a PV is expected to be unmapped. Require its exact Azure resource identity; cluster and owner provenance from resource group, creation history, and tags; no attachment; an exhaustive check for Kubernetes volume handles and Azure compute, snapshot, backup, restore, and other references; and owner confirmation of backup and recovery requirements. Only then classify it as a verified orphan candidate. Ambiguous identity, provenance, ownership, or references blocks cleanup advice.

4. If `cost-analysis` is available in the host skill inventory, invoke it to retrieve billed `ActualCost` grouped by `ResourceId` for verified mapped resources and verified orphan candidates at the smallest applicable scope. Correlate only exact resource IDs. If the skill or required cost data is unavailable, continue with utilization and performance evidence, report attributable cost and monetary savings as unavailable rather than zero.

5. For active verified Azure Disk mappings, use [storage metrics](storage-metrics.md) for binding-scoped capacity, IOPS, throughput, latency, and throttling evidence. Retain identity/interval verification, coverage/gaps, units, aggregation basis, and capacity changes per disk. Missing, sparse, ambiguous, or unrepresentative history means unknown utilization, not zero.

After collecting applicable evidence, use
[storage decisions](storage-decisions.md) to classify candidates and recommend
changes.