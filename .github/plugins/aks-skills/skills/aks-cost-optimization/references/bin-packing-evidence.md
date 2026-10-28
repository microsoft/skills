# Bin-Packing Evidence

Collect bounded evidence for one candidate pool at a time. Include all nodes and
scheduled pods across namespaces; add only pools losing nodes or receiving
workloads.

## Cluster and Workloads

Use Azure MCP AKS for cluster/pool, autoscaling/NAP, node resource group, CRG,
and surge data; otherwise use an approved `az aks show`. With approved shell
access and target-bound `kubectl`, run:

```bash
kubectl get nodes -l "kubernetes.azure.com/agentpool=<POOL>" \
  -o custom-columns="NAME:.metadata.name,NAP_POOL:.metadata.labels.karpenter\.sh/nodepool,SKU:.metadata.labels.node\.kubernetes\.io/instance-type,ZONE:.metadata.labels.topology\.kubernetes\.io/zone,CPU:.status.allocatable.cpu,MEM:.status.allocatable.memory,PODS:.status.allocatable.pods,TAINTS:.spec.taints"

kubectl get pods -A --field-selector "spec.nodeName=<NODE_NAME>" \
  -o custom-columns="NAMESPACE:.metadata.namespace,NAME:.metadata.name,NODE:.spec.nodeName,OWNER_KIND:.metadata.ownerReferences[0].kind,OWNER_NAME:.metadata.ownerReferences[0].name,REQUESTS:.spec.containers[*].resources.requests,INIT_REQUESTS:.spec.initContainers[*].resources.requests,OVERHEAD:.spec.overhead,SELECTOR:.spec.nodeSelector,AFFINITY:.spec.affinity,TOLERATIONS:.spec.tolerations,SPREAD:.spec.topologySpreadConstraints,PVCS:.spec.volumes[*].persistentVolumeClaim.claimName"
```

Aggregate all nodes before modeling. For discovered namespaces, project PDBs;
collect `FailedScheduling` only for known pending pods eligible for affected
pools. Resolve referenced owners, following ReplicaSets to Deployments.
Retrieve other details only for identified constraints. Never retrieve full
nodes; they include cached images. Report covered pools, nodes, namespaces,
owners, and omissions.

Reuse rightsizing metrics or retrieve 7-14 days of CPU/memory history. Current
usage alone cannot justify consolidation. If requests or history are missing,
invoke `azure-kubernetes` for rightsizing if available; otherwise stop. Read
PVC/PV topology or SKU/quota only when it constrains placement.

For unexplained scaling, evictions, or pending pods despite available compute,
use [node scaling bottlenecks](node-scaling-bottlenecks.md) before consolidation.

## Signals

- compatible small pools with sustained low requested and actual utilization;
- nodes with stranded CPU but insufficient memory, or the reverse;
- oversized pod requests that prevent otherwise available capacity from being used;
- required node/pod affinity, anti-affinity, topology spread, selectors, taints, zones, host ports, PV node/zone affinity, `maxPods`, or extended resources that restrict placement;
- PDBs, unmanaged pods, node-local storage, or do-not-disrupt settings that block safe eviction;
- persistent pending pods confirmed eligible for affected pools; include their requests in the theoretical minimum, exclude unrelated pods, and do not model unresolved scheduling failures.

Pools are merge candidates only when workload isolation, OS/architecture,
priority, zones, networking, security/compliance, storage, accelerator, and
availability requirements remain compatible. Preserve a dedicated production
system pool.

## Placement Controls

For every workload and pool, inventory controls that limit eligible nodes or
block eviction. Record the source, hard or preferred behavior, scope, eligible
nodes/domains, excluded capacity, and documented intent. Include topology
spread, affinity/anti-affinity, selectors, taints/tolerations, zones, host
ports, storage locality, extended resources, and disruption controls.

Correlate each control with scheduling failures, evictions, blocked scale-down,
or autoscaler/NAP node creation; presence alone does not prove cost impact.
Preserve confirmed requirements and unknown intent. Flag owner review only when
evidence shows a control is stale, redundant, conflicting, broader than its
intent, or disproportionately strands capacity.
