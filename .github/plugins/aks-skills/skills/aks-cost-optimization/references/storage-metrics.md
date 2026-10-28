# AKS Storage Capacity and Performance Evidence

For active, verified Azure Disk mappings. Reuse evidence for the same cluster/period.

## Capacity History

Use history only for the verified current PVC/PV/disk binding. Prefer managed Prometheus
through an approved query API. Confirm the target's unique cluster label/alias
and use it in both selectors and groupings, replacing `cluster` if needed.
Substitute the verified cluster value, namespace, PVC, and lookback below.
Unresolved identity means ambiguous history, not rightsizing evidence.

Use the requested period, otherwise up to 30 days, within verified binding and
retention. Replace `<lookback>` with that duration, e.g. `30d`; never include
samples from an earlier binding.

Run instant queries at assessment end for current capacity, maximum per-series
p95, and overall peak usage:

```promql
max by (cluster, namespace, persistentvolumeclaim) (
  kubelet_volume_stats_capacity_bytes{
    cluster="<cluster-label-value>", namespace="<namespace>",
    persistentvolumeclaim="<pvc>"
  }
)

max by (cluster, namespace, persistentvolumeclaim) (
  quantile_over_time(0.95, kubelet_volume_stats_used_bytes{
    cluster="<cluster-label-value>", namespace="<namespace>",
    persistentvolumeclaim="<pvc>"
  }[<lookback>])
)

max by (cluster, namespace, persistentvolumeclaim) (
  max_over_time(kubelet_volume_stats_used_bytes{
    cluster="<cluster-label-value>", namespace="<namespace>",
    persistentvolumeclaim="<pvc>"
  }[<lookback>])
)
```

Report p95 as maximum per-series p95, not combined PVC-history p95; use peak
usage and headroom for sizing. Verify representative coverage and capacity
changes; investigate uncertain gaps over short windows. Missing/invalid data
is unknown, not zero; never sum duplicate volume reports.

If unavailable, use the [Container Insights query](storage-container-insights.md).
Report requested/observed periods, retention, binding verification, coverage/gaps,
current capacity, p95/max used bytes and aggregation basis, capacity changes,
and growth/batch/recovery headroom. Divide by verified positive current capacity
only when labeling percentages relative to current capacity, not historical
utilization. Missing, sparse, ambiguous, or unrepresentative history means unknown utilization, not zero.
 `azureblob-*` lacks Container Insights PV usage.

## Disk Performance

Discover each disk's Azure Monitor metric definitions; query supported read/write
operations/sec and bytes/sec. Preserve units; rates are not totals.

For latency and consumed IOPS/bandwidth percentage, map the exact disk resource
ID to each VMSS instance where it was attached and obtain its LUN from that
instance's data-disk configuration. Query the VM instance's Data Disk Latency,
Data Disk IOPS Consumed Percentage, and Data Disk Bandwidth Consumed Percentage
metrics for that LUN. Verify metric availability for the VM/controller.
Check available disk throttling and VM-level saturation evidence; missing
metrics mean unknown, not zero.

Track disk/instance/LUN attachment intervals as disks move between nodes.
Combine only verified intervals; if
historical attachment timing is unavailable, report incomplete performance
history rather than attributing another disk's LUN metrics. For each source,
report coverage, average and maximum, plus p95 of collected samples when
supported. Label aggregation/grain: p95 of minute averages is not per-I/O p95.

Compare historical demand with the candidate disk's capacity, IOPS, throughput,
burst behavior, and the attached VM or node aggregate disk limits. A lower tier
is eligible only when it preserves workload latency, durability, zone,
redundancy, and recovery requirements. Do not recommend a tier from allocation
or capacity usage alone.
