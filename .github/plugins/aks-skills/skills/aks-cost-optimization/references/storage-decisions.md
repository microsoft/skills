# AKS Storage Decisions

Use after storage mapping, ownership, and applicable metric evidence has
been collected.

## Recommend in Order

| Priority | Evidence | Recommendation |
|---|---|---|
| Remove unused | Verified mapped volume is unused; verified orphan disk is unattached and exhaustively unreferenced; obsolete snapshot is not required for recovery/compliance | Confirm owner, failure cause, backend state, backup, and recovery requirements before proposing deletion |
| Right-size capacity | Active Azure Disk PVC has representative usage plus growth/recovery headroom below a cheaper billable size | Managed disks cannot shrink; back up, create a smaller PVC, copy and validate, cut over, then remove the old volume |
| Right-size performance | Lower SKU or provisioned IOPS/throughput meets historical demand and latency/SLA needs | If Azure supports the SKU transition, scale the workload to zero, verify detachment, change the disk SKU in place, then restore and validate; otherwise migrate through a new StorageClass/PVC. Lower configurable Premium SSD v2/Ultra performance in place when supported |
| Prevent recurrence | Disposable dynamic volumes use `Retain` or retained resources lack review | Use `Delete` only for future disposable volumes; preserve `Retain` for recovery/compliance |

Deleting a PVC/PV produces savings only when its reclaim flow or approved follow-up deletes the billable Azure resource. Do not recommend a tier or capacity change from allocation alone. Exclude active backups, shared disks, database/log volumes, and compliance-retained data until owners confirm recovery, latency, performance, access-mode, zone, and redundancy needs.

Classify each candidate as **recommend optimization**, **potentially unused**,
**investigate further**, **insufficient evidence**, or **no change
recommended**. A Failed PV can indicate a broken backend, failed provisioning,
recovery issue, or stale metadata. An unattached disk or Released, Available,
or Failed PV alone does not prove it is unused; verify the Azure resource and
all Kubernetes/Azure references, ownership, backup, recovery, and backend state
before recommending cleanup.

## Migration and Approval Gates

Require explicit approval before migration/cutover; accepting downtime is not
authorization. Before migration, take or verify a current recoverable backup;
a previously tested restore alone is insufficient. Validate the new volume
before cutover. Even after verification, require separate explicit approval
before deleting any PVC, PV, snapshot, or Azure storage resource.

## Output

Return applicable fields for each candidate: namespace/PVC/PV, exact Azure
resource ID, current size/SKU/reclaim behavior, utilization/performance
evidence, attributable cost, proposed state, estimated savings,
migration/rollback, downtime, risk, and confidence. For mapped volumes, name
both sides of the verified mapping. For orphan candidates, report provenance,
attachment state, reference checks, owner, and recovery decision.

For migrations, report whether a current recoverable backup is verified or
still required, and state which migration or deletion actions still require approval.

Recommend deletion only for verified unused mapped resources or verified orphan
candidates, and rightsizing only with required evidence. Otherwise report
insufficient telemetry without estimating savings.
