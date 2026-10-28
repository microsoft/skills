# Container Insights PVC Capacity History

Use for one verified PVC/PV mapping. Reuse the cluster ID, namespace, PVC, and PV verified by the storage workflow.
Use the requested UTC window (maximum 30 days), otherwise the last 30 days.
Limit it to the verified current binding and available history, with `start < stop`.
Report actual boundaries.

Summarize usage and inventory separately, then join by namespace/PVC within the
target cluster, not collection time. Aggregate usage per minute before p95 to
avoid weighting by pod count.

```kusto
let start = datetime(<assessment-start-utc>);
let stop = datetime(<end-utc>);
let cluster = "<aks-resource-id>";
let ns = "<namespace>";
let claim = "<pvc>";
let expectedPV = "<verified-pv>";
let inventory = KubePVInventory
| where TimeGenerated >= start and TimeGenerated < stop
| where ClusterId =~ cluster and PVCNamespace == ns and PVCName == claim
| summarize inventoryRows=count(),
    conflictingRows=countif(PVName != expectedPV or PVStatus != "Bound"),
    firstInventory=min(TimeGenerated), lastInventory=max(TimeGenerated)
| extend PVCNamespace=ns, PVCName=claim;
let usage = InsightsMetrics
| where TimeGenerated >= start and TimeGenerated < stop
| where Namespace == "container.azm.ms/pv" and Name == "pvUsedBytes"
| extend t=todynamic(Tags)
| where tostring(t.clusterId) =~ cluster
    and tostring(t.pvcNamespace) == ns and tostring(t.pvcName) == claim
| summarize usedBytes=max(Val),
    firstSample=min(TimeGenerated), lastSample=max(TimeGenerated)
    by bucket=bin(TimeGenerated, 1m)
| summarize usageBuckets=count(),
    firstSample=min(firstSample), lastSample=max(lastSample),
    p95ObservedBytes=percentile(usedBytes, 95),
    maxObservedBytes=max(usedBytes)
| extend PVCNamespace=ns, PVCName=claim;
usage
| join kind=leftouter inventory on PVCNamespace, PVCName
| extend bindingMatches=inventoryRows > 0 and conflictingRows == 0
```

Zero usage buckets means unavailable, never zero utilization.
Before attributing history to the current PV or rightsizing, require
`bindingMatches` and representative inventory/usage coverage.

Compare counts and first/last timestamps with the requested window and actual
collection cadence and confirm relevant workload cycles are represented.
Matching observations, counts, and endpoints cannot prove continuity or exclude
same-name PVC recreation; these tables lack PVC UID. Inspect bounded source
history or lifecycle evidence when needed.

Conflicts or unresolved gaps make attribution ambiguous. If evidence establishes
a narrower current-binding period, rerun once for that window. If binding or
coverage remains uncertain, report insufficient evidence.

If collection is slower than one minute, adjust the usage bucket to that cadence
and report it. Use verified positive current capacity for explicitly labeled
current-capacity ratios, not historical utilization percentages.
Retain growth/recovery headroom.
