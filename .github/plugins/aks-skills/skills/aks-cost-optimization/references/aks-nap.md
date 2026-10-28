# AKS Node Auto-Provisioning (NAP)

Assess whether adopting NAP would benefit the cluster and whether it is ready. Recommend enablement only when NAP has a demonstrated placement, cost, or operational advantage over fixed pools or Cluster Autoscaler (CAS).

Use [NAP evidence collection](nap-evidence-collection.md) with approved
capabilities and a bound target. Prefer fitting Azure MCP AKS reads over its
CLI fallbacks.

## 1. Determine Path and Eligibility

Collect SKU, NAP mode, identity, networking, pools, and Karpenter ownership.

If mode is `Auto`, do not run enablement readiness. Route idle-node and consolidation analysis to [bin-packing](./aks-bin-packing.md).

Before enablement, detect self-hosted Karpenter. If present, use the [self-hosted Karpenter migration](self-hosted-karpenter-migration.md), not normal enablement.

Stop enablement for Windows pools, IPv6, service-principal identity, Basic Load Balancer in a custom VNet, kubenet, Calico, or Azure CNI Pod Subnet with `podIpAllocationMode: DynamicIndividual`. Confirm acceptance of losing cluster stop and outbound-type changes.

If CAS is enabled, explain the transition to NAP and obtain explicit approval before changing or disabling CAS. Side-by-side CAS and NAP is a temporary migration state only because long-term coexistence can cause unpredictable scaling and double provisioning. Registering the subscription-wide `AllowClusterAutoscalerAndNAP` feature requires separate explicit approval. Coexistence also requires exclusive taints/tolerations, custom pools, and `--node-provisioning-default-pools None`.

## 2. Scheduling Evidence

Read pods and events first. For scheduling issues, fetch nodes once to compare with pod requirements; otherwise skip nodes. Without Kubernetes access, use supplied evidence or provide a scoped plan.

Use unassigned pods whose `PodScheduled` condition is `False` with reason `Unschedulable`. Correlate events by pod UID/time.

For each affected pod, retain node selectors, required affinity/anti-affinity, topology-spread constraints, tolerations, and referenced volume topology. Compare them with existing nodes, including capacity excluded by taints.

### Seven-Day Scheduling History

Use seven days of available unschedulable-pod metrics to identify recurring pressure, unless equivalent history exists. Correlate events to determine whether NAP helps; report missing history.

### Capacity and Cost History

Reuse verified stranded-capacity and workload-shape findings from [bin-packing analysis](./aks-bin-packing.md) when available. Otherwise collect
only enough node-count, pool-floor, request, utilization, scaling, and cost history to determine whether fixed pools serve the demand poorly. NAP does not
repeat consolidation or placement-relaxation modeling. Low utilization alone is not evidence that NAP will save cost.

If `cost-analysis` is available, invoke it for attributable cluster compute cost. Compare current fixed-pool cost with the expected NAP capacity and any
migration overlap. Keep unavailable cost or savings unknown rather than zero.

After eligibility and evidence collection, use [NAP decisions](nap-decisions.md)
to compare alternatives, determine the verdict, and report recommendations.