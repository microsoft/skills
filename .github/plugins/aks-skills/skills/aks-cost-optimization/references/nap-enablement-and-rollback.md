# NAP Enablement and Rollback

Use this procedure only after NAP readiness produces a recommendation and the
user requests enablement.

## Approve the Change

Resolve every eligibility and readiness gap identified during the NAP
assessment before enablement. Obtain approval for the default configuration or
proposed custom `NodePool`/`AKSNodeClass` settings. Explain capacity limits,
disruption behavior, including proposed expiration or termination deadlines,
and any CAS migration.

Before enablement, agree on an observation period, cost and capacity bounds,
workload SLOs, success and failure criteria, and rollback. Verify that fixed
pools can be created or scaled to absorb all NAP workloads during rollback,
including DaemonSet overhead and operational headroom.

## Enable and Verify

For default pools with CAS disabled:

```bash
az aks update \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --node-provisioning-mode Auto
```

For custom pools, add `--node-provisioning-default-pools None` to disable
default-pool creation, then apply the approved `NodePool` and `AKSNodeClass`
manifests.

Verify pending-pod time, provisioned configurations, node count, workload SLOs,
and cost against the agreed criteria. Do not remove fallback fixed capacity
until validation succeeds.

## Rollback

If criteria fail, stop expansion:

1. Set `limits.cpu: 0` on every NAP `NodePool` to stop new NAP capacity.
2. Add the `karpenter.azure.com/disable:NoSchedule` taint to each `NodePool`.
3. Create or scale fixed pools to the verified capacity needed by the workloads.
4. Allow the scheduler and NAP disruption process to move workloads, honoring
   PDBs, until no NAP nodes remain. Do not delete nodes directly.
5. Disable NAP:

   ```bash
   az aks update \
     --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
     --node-provisioning-mode Manual
   ```
