# NAP Decisions

Use only after completing NAP path selection, eligibility, and applicable
evidence collection.

## Assess Signals

A primary signal is verified evidence that NAP could address an existing
capacity, placement, or stranded-capacity problem. Insufficient resources, a
missing compatible node, and stranded or mismatched fixed capacity are primary
signals. Persistence or recurrence increases confidence but is not a primary
signal by itself.

Require at least one confirmed primary signal. For each signal, identify an
allowed NAP node configuration that fits workload requests, DaemonSet overhead,
architecture, zones, networking, storage, policy, quota, and budget.

| Signal | Evidence | Decision role |
|---|---|---|
| Insufficient resources | Matching `FailedScheduling` message reports insufficient CPU/memory or exhausted pod capacity; affected pod requests | Compatible capacity could resolve the shortage |
| Missing compatible node | Scheduling failure and placement/storage requirements compared with existing capacity | A different configuration is valid only when the restriction is intentional or preferable to safely relaxing it |
| Stranded or mismatched fixed capacity | Verified bin-packing findings, or pool-floor, node-count, request/utilization, scaling, workload-shape, and cost evidence | Dynamic configurations could serve demand with less stranded capacity |
| Persistence/recurrence | Seven-day history correlated with event or incident causes | Increases confidence but is not a primary signal alone |

Compare the same demand under NAP, CAS tuning, raised pool limits, and an added
fixed pool. Prefer NAP only when varying requirements or stranded capacity
create a supported cost or operational advantage. Prefer simpler scaling for
stable demand that fits an existing pool. Respect availability, reservation,
and budget limits.

Consider AKS Automatic for production workloads. If it could meet control and
networking boundaries, invoke `azure-kubernetes-automatic-readiness` for
migration compatibility when `azure-kubernetes` is available.

Do not treat a likely stale placement rule as a primary signal. Route it to
[bin-packing analysis](aks-bin-packing.md) and preserve it until its owner
approves a change.

## Readiness and Verdict

After a primary signal, run only triggered VM, quota, subnet, policy, or volume
checks from [NAP evidence collection](nap-evidence-collection.md). Reuse data;
do not perform a broad readiness audit.

| Verdict | Rule |
|---|---|
| Recommend | Eligibility and readiness pass, a primary signal persists or recurs, and NAP clearly beats simpler scaling |
| Limited trial | Eligibility and readiness pass and NAP has an advantage, but history is limited; agree on trial workloads, capacity limits, and success criteria before enablement |
| Insufficient evidence | No primary signal or missing cause/fit data |
| Do not enable | Readiness failed or is unknown, migration is unapproved, only non-NAP causes exist, or simpler scaling suffices |

Report the verdict, evidence, affected workloads, timeframe, cost or capacity
baseline, expected effect and assumptions, advantage over simpler scaling,
readiness gaps, risk, and confidence.

Only after a recommendation and at the user's request, follow
[NAP enablement and rollback](nap-enablement-and-rollback.md).
