# AKS Bin-Packing and Placement Optimization

Find safe node and placement consolidation candidates without claiming scheduler equivalence or a guaranteed minimum. Require approval before placement changes, pool resize/deletion, or drains.

## Evidence

Collect and validate the bounded inputs in [bin-packing evidence](bin-packing-evidence.md)
before assessment. Do not model incomplete evidence.

## Assess

Calculate each node's allocatable CPU, memory, and pod slots; subtract the effective requests of all scheduled pods, including DaemonSet pods and pod overhead, counting each resource once. Report actual usage separately: requests determine scheduler fit, while history identifies candidates for the `azure-kubernetes` rightsizing workflow when that skill is available.

## Model Scenarios

For each compatible target pool or SKU, calculate a **theoretical minimum node count** from scheduled workloads and confirmed eligible persistent pending demand:

```text
max(
  ceil(total CPU requests / allocatable CPU per node),
  ceil(total memory requests / allocatable memory per node),
  ceil(total pods / available pod slots per node)
)
```

Calculate each required zone/placement partition separately, including per-node overhead, replicas, and operational headroom. Verify largest-pod fit and eligible nodes for required constraints. Reject blocked scenarios; otherwise require staged validation and do not claim the theoretical minimum is achievable or optimal.

For an owner-approved placement change, compare the baseline with one relaxed alternative, such as `DoNotSchedule` to `ScheduleAnyway`, required to preferred anti-affinity, or a corrected taint/toleration. Report eligible nodes/domains and excluded capacity before and after; verify replicas, SLOs, isolation, and compliance.

For a pool associated with a Capacity Reservation Group, retrieve the reserved VM size, region, zone, quantity, associated instances, unused quantity, and surge requirement. Verify that the proposed SKU, zone, node count, and migration or upgrade surge fit the reservation. Disclose capacity that would remain billable but unused, or a required CRG change, before recommending consolidation.

Recommend in this order:

1. Route oversized requests to rightsizing using historical evidence.
2. Recommend removing or relaxing a selector, taint, topology-spread constraint, or required affinity/anti-affinity rule only when its owner confirms the original placement, isolation, and availability requirement no longer applies.
3. Merge compatible pools or adjust VM shape while preserving failure-domain and performance requirements.
4. For idle nodes, identify the manager: `karpenter.sh/nodepool` means NAP; otherwise a matching agent pool with `enableAutoScaling: true` means CAS; neither means fixed capacity. For CAS nodes, invoke `azure-kubernetes` for tuning when available. For NAP nodes, inspect the owning `NodePool`'s `consolidationPolicy`, `consolidateAfter`, disruption budgets, PDBs, and `karpenter.sh/do-not-disrupt` blockers. Report fixed nodes as unmanaged and evaluate each manager separately in mixed clusters. Use [NAP readiness](./aks-nap.md) only for NAP adoption or migration decisions.

Do not recommend a VM solely for its CPU:memory ratio. For candidate SKUs, verify largest-pod fit, architecture, disk/network capabilities, regional availability, quota, and workload performance.

## Proposed Changes

Present constraints, causal evidence, cost consequence, proposed changes, CRG impact, rollback, and confidence. Require approval before placement/pool changes, cordon, drain, or scaling. Validate scheduling, SLOs, and zone coverage after each workload-, pool-, or node-scoped stage before proceeding. Scale down through the identified manager, or approved AKS pool resizing for fixed capacity; never delete nodes directly.