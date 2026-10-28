# AKS Node Scaling Bottlenecks

Diagnose cost caused by node constraints that trigger scale-out or block
scale-down despite apparently available compute. Do not assume low CPU or
memory utilization means a pod can fit.

## Establish the Constraint

Use this workflow for unexplained node growth, repeated scale churn, pod
evictions, pending pods, or stranded CPU and memory. Collect representative
history and current state for:

- node allocatable capacity, requests, utilization, pod count, conditions, and
  extended resources;
- pending and evicted pods, scheduler evidence, node-pressure events, and
  autoscaler decisions when available;
- pool VM SKU, node count and bounds, `maxPods`, zones, OS disk size/type,
  kubelet disk type, upgrade surge, and reservations;
- ephemeral-storage requests and limits, node filesystem and image filesystem
  usage when exposed, and workloads using `emptyDir` or node-local storage;
- placement-control evidence from the bin-packing workflow, including eligible
  nodes, excluded capacity, scheduling failures, and autoscaler/NAP actions;
- per-node disk, network, storage-attachment, and other capability limits.

Missing history means the cause is unverified. Do not infer storage pressure
from image size, scale-out from a pending pod alone, or savings from unused CPU.

## Correlate Cause and Cost

Identify the first proven limiting dimension:

| Dimension | Example evidence |
|---|---|
| Compute shape | CPU or memory fragmentation; largest pod cannot fit |
| Pod capacity | `maxPods` or DaemonSet overhead consumes available slots |
| Ephemeral storage | `DiskPressure`, eviction, or node/image filesystem exhaustion |
| Persistent storage | Attach limit or required PV zone/node affinity |
| Placement | Taint, selector, affinity, topology, zone, or host-port exclusion |
| Specialized capacity | GPU or another extended resource is unavailable |
| Node capability | Required disk, network, architecture, or VM feature is absent |
| Disruption | PDB, unmanaged pod, or node-local data blocks scale-down |

Confirm with time- and workload-aligned evidence that the bottleneck prevented
pod placement or node removal and caused capacity to be added or retained.
Otherwise report it as a likely contributor, not a proven cost cause.
Do not call scale-out a false positive or added nodes unnecessary until a
supported counterfactual shows the workloads could run with fewer nodes after
the proposed correction.
Low CPU and memory rule out only CPU or memory saturation; do not rule out VM
shape because the SKU can determine local disk capacity and performance.

## Compare Remedies

Evaluate the lowest-risk correction first:

1. Correct workload requests, image footprint, logs, caches, writable layers,
   `emptyDir`, or an obsolete placement restriction.
2. Adjust a supported node limit or capability, such as pod capacity, OS disk,
   kubelet storage placement, or VM shape. Verify OS, kubelet, image, and
   temporary filesystem roles independently; an Ephemeral OS disk is not
   automatically a separate kubelet or container-data disk.
3. Reconfigure or replace a pool while preserving required isolation,
   availability, zones, reservations, and autoscaling behavior.
4. Change workload architecture only when simpler corrections cannot satisfy
   the requirement.

Compare the avoidable VM, managed OS disk, reservation, and related costs with
the correction's storage or VM cost and migration overlap. A cheaper component
is not an optimization when total cluster cost or reliability worsens.

## Return to Bin-Packing

Return the limiting dimension, causal evidence, affected pools and workloads,
scaling consequence, attributable cost, remedy candidates, and confidence.
Keep unverified causation or cost unknown rather than zero. Do not execute
changes without approval. Require explicit approval before pool creation or
reconfiguration, cordon, drain, or scaling.
