# Node & Cluster Troubleshooting

## Node NotReady — executable evidence first

Derive the cluster, subscription, resource group, and node from the user's
selected target and the host's approved metadata capabilities. Stay within
that scope; access available to a local Azure CLI identity is not permission
to enumerate other subscriptions. If the target is unavailable or ambiguous,
use the host's elicitation mechanism to ask the user to select or identify it.
Do not require a local kubeconfig or an all-subscriptions sweep before asking.

Only where the host capability gate is satisfied, a scoped CLI read can
resolve the cluster within an authorized subscription and resource group:

```bash
az aks list \
  --subscription <authorized-subscription-id> \
  --resource-group <authorized-resource-group> \
  --query "[].{id:id,name:name,resourceGroup:resourceGroup,fqdn:fqdn,privateFqdn:privateFqdn}" \
  -o json
```

For approved `kubectl` execution, verify that the selected context's API
endpoint matches the selected AKS resource's `fqdn` or `privateFqdn`; do not
assume the current context is the requested cluster. If no node was named,
list non-Ready nodes only in that bound cluster through an approved host read
or `kubectl --context <verified-context> get nodes`. Ask which node to
investigate when the selection is ambiguous. Derive the VMSS name and instance
ID from the selected node's `providerID` when available; otherwise request
targeted metadata or operator-provided evidence rather than widening scope.

The following pipeline assumes that scope and context verification succeeded.
If its execution capabilities are unavailable, request redacted equivalent
outputs and record the missing evidence instead of running it:

```bash
AKS_SUBSCRIPTION_ID="<authorized-subscription-id>"
AKS_RG="<cluster-resource-group>"
AKS_NAME="<cluster-name>"
KUBE_CONTEXT="<verified-context>"
NODE="<node-name>"

# Kubernetes description, conditions, and node-scoped events
kubectl --context "$KUBE_CONTEXT" describe node "$NODE"
kubectl --context "$KUBE_CONTEXT" get node "$NODE" \
  -o jsonpath='{range .status.conditions[*]}{.lastTransitionTime}{"\t"}{.type}{"\t"}{.status}{"\t"}{.reason}{"\t"}{.message}{"\n"}{end}'
kubectl --context "$KUBE_CONTEXT" get events --all-namespaces \
  --field-selector involvedObject.kind=Node,involvedObject.name="$NODE" \
  --sort-by='.metadata.creationTimestamp'

# AKS node resource group and Kubernetes node to VMSS instance mapping
NODE_RG=$(az aks show \
  --subscription "$AKS_SUBSCRIPTION_ID" \
  --resource-group "$AKS_RG" \
  --name "$AKS_NAME" \
  --query nodeResourceGroup -o tsv)
AGENT_POOL=$(kubectl --context "$KUBE_CONTEXT" get node "$NODE" \
  -o jsonpath='{.metadata.labels.agentpool}')
PROVIDER_ID=$(kubectl --context "$KUBE_CONTEXT" get node "$NODE" \
  -o jsonpath='{.spec.providerID}')
VMSS=$(printf '%s\n' "$PROVIDER_ID" |
  awk -F'/virtualMachineScaleSets/' '{print $2}' | cut -d/ -f1)
INSTANCE_ID=${PROVIDER_ID##*/}

printf 'nodeResourceGroup=%s\nagentPool=%s\nvmss=%s\ninstanceId=%s\n' \
  "$NODE_RG" "$AGENT_POOL" "$VMSS" "$INSTANCE_ID"

# AKS pool state
az aks nodepool show \
  --subscription "$AKS_SUBSCRIPTION_ID" \
  --resource-group "$AKS_RG" \
  --cluster-name "$AKS_NAME" \
  --name "$AGENT_POOL" \
  --query '{provisioningState:provisioningState,powerState:powerState.code,nodeImageVersion:nodeImageVersion,orchestratorVersion:orchestratorVersion}' \
  -o yaml

# Exact VMSS instance view and extension statuses
az vmss get-instance-view \
  --subscription "$AKS_SUBSCRIPTION_ID" \
  --resource-group "$NODE_RG" \
  --name "$VMSS" \
  --instance-id "$INSTANCE_ID" \
  -o json
az vmss get-instance-view \
  --subscription "$AKS_SUBSCRIPTION_ID" \
  --resource-group "$NODE_RG" \
  --name "$VMSS" \
  --instance-id "$INSTANCE_ID" \
  --query 'extensions[].{name:name,statuses:statuses,substatuses:substatuses}' \
  -o json
```

This block is the minimum Node NotReady evidence. It is incomplete until every command in it has produced output or the inability to collect it is recorded. Collect it before narrowing the failure to kubelet, host, provisioning, pressure, or network causes.

### Privileged and service mutation boundary

Kubelet/service inspection through privileged node access requires explicit approval after the mandatory block identifies a node-local evidence gap. Restarting kubelet, cordoning, draining, deleting, reimaging, or replacing a node are separate remediations and require explicit approval with workload, PodDisruptionBudget, and change-control impact understood. None is part of the default evidence path.

**Condition decision tree:**

| Condition | Value | Evidence boundary | Next investigation |
|---|---|---|---|
| `Ready` | `False` | Compare the transition time and reason with VMSS instance and extension statuses | Determine whether the failure is kubelet, host, provisioning, or network related before requesting node access |
| `MemoryPressure` | `True` | Review allocated resources, pod requests/limits, eviction events, and metrics | Identify the workload or node-pool capacity constraint |
| `DiskPressure` | `True` | Review eviction events, pod ephemeral-storage requests/limits, and node image/OS state | Determine whether workload storage use or node storage capacity is responsible |
| `PIDPressure` | `True` | Correlate condition transitions with workload placement and process evidence | Use IG `snapshot_process` if process-level evidence is required |
| `NetworkUnavailable` | `True` | Review CNI pod state and logs plus node NIC routes and NSG evidence | Continue with [Networking Troubleshooting](networking.md) |

Do not infer that a `Ready=False` condition requires a kubelet restart or node replacement. The Kubernetes condition reason, node events, VMSS provisioning state, and extension substatus determine the next branch.

---

## Cluster or Node Pool in `provisioningState: Failed`

Read the failed operation record before reasoning from node or VMSS symptoms:

```bash
# 1. Operation record first. `az aks operation` is part of the aks-preview extension;
#    the CLI auto-installs it on first use, which may be disallowed on managed hosts.
az aks operation show-latest -g <rg> -n <cluster>
az aks operation show-latest -g <rg> -n <cluster> --nodepool-name <pool>
az aks operation show -g <rg> -n <cluster> --operation-id <id>

# 2. Activity-log fallback (documented Learn path; the only evidence if aks-preview is unavailable)
az monitor activity-log list -g <rg> --resource <cluster-resource-id> --status Failed --offset 24h -o table

# 3. Pool, scale set, and instance provisioning state
az aks nodepool show -g <rg> --cluster-name <cluster> -n <pool> --query '{state:provisioningState,power:powerState.code}'
az vmss show -g <node-rg> -n <vmss> --query provisioningState -o tsv
az vmss list-instances -g <node-rg> -n <vmss> --query '[].{id:instanceId,state:provisioningState}' -o table
```

- The operation record carries the exact error code and message for the failing
  operation. An exact catalog error (for example the `VMExtensionError_*` codes)
  routes to `aks-known-issues`; quota errors follow the quota section below.
- If the extension is missing and cannot be installed, say so and label the
  activity-log entry as degraded evidence: it identifies the failed operation
  and status message but is not the full operation record.
- `az resource update --ids <cluster-id>` (reconcile) and `az vmss update-instances`
  are mutations. Report them as the documented recovery path only after the
  cause is understood and the owner approves.

## Node Pool Not Scaling

### Cluster Autoscaler Not Triggering

Confirm the precondition first: the cluster autoscaler scales up on **Pending
(unschedulable) pods**, not on node CPU/memory pressure and not on HPA state. If
the HPA is at `maxReplicas` and every pod is `Running`, the ceiling is the HPA,
not the autoscaler; if `kubectl get pods -A --field-selector=status.phase=Pending`
is empty, there is nothing for the autoscaler to act on.

**Diagnostics:**

```bash
# Autoscaler logs
kubectl logs -n kube-system -l app=cluster-autoscaler --tail=100

# Autoscaler status
kubectl get configmap cluster-autoscaler-status -n kube-system -o yaml

# Verify autoscaler is enabled on the node pool
az aks nodepool show -g <rg> --cluster-name <cluster> -n <nodepool> \
  --query "{autoscaleEnabled:enableAutoScaling, min:minCount, max:maxCount}"

# HPA ceiling versus autoscaler: are any pods actually unschedulable?
kubectl get hpa -A
kubectl get pods -A --field-selector=status.phase=Pending
```

**Platform metrics (Azure Monitor, `Microsoft.ContainerService/managedClusters`):**
`cluster_autoscaler_unschedulable_pods_count` (pods the autoscaler must place),
`cluster_autoscaler_cluster_safe_to_autoscale` (0 means the autoscaler is
refusing to act, for example after failed scale-ups or too many unready nodes),
`cluster_autoscaler_scale_down_in_cooldown`, `cluster_autoscaler_unneeded_nodes_count`,
and `cluster_autoscaler_failed_scale_ups_total`. Read them through an Azure
Monitor capability or `az monitor metrics list --resource <cluster-id> --metric <name>`;
Pending pods with `safe_to_autoscale=0` is the autoscaler branch, Running pods
with the HPA at max is not.

**Autoscaler won't scale up - common reasons:**

- No Pending pods: the HPA is at `maxReplicas`, or requests fit on existing nodes
- Node pool already at `maxCount`
- VM quota exhausted (confirm the binding tier and operation evidence below)
- Pod `nodeAffinity` is unsatisfiable on any new node template
- A recent autoscaler decision is still governed by the cluster's configured autoscaler profile; compare the status ConfigMap timestamps and profile settings before concluding scaling is stuck

#### Quota evidence and owner action

Stay read-only by default. Do not conclude that quota is exhausted from an autoscaler symptom or a quota-usage listing alone. Require the failed activity or operation error plus the quota evidence exposed by that error for the same subscription and region. `QuotaExceeded` records provide `Current Usage`, `Current Limit`, and `Additional Required`; `ErrCode_InsufficientVCPUQuota` records provide requested and remaining vCPUs. Record the subscription ID, region, intended node-pool scale target, VM size and family, and other quota consumers. Report any missing item as an evidence gap.

Standard vCPU quota is enforced at two tiers per subscription and region: total regional vCPUs and VM-family vCPUs. Identify the binding tier from the exact error and usage evidence. `Total Regional Cores` identifies the regional tier, while a named family such as `standardDSv5Family` identifies the family tier. A scale operation must fit within both tiers.

If stating a minimum new limit for `QuotaExceeded`, calculate only `Current Limit + Additional Required`. Do not add unrequested headroom. Leave any larger request to the owner based on planned capacity.

For a binding quota limit, direct an authorized owner to the Azure portal **Quotas** flow for **Compute** and the affected region and VM family or regional tier. Submitting the request changes subscription quota state, so it requires owner approval and suitable subscription-scope permission. A request is reviewed; do not promise approval, timing, or retries, and do not submit quota changes by default.

After any approved quota change, re-read the AKS operation, node-pool state, and activity evidence before proposing a follow-up action. Do not assume the failed operation will or will not self-heal, and do not prescribe a retry without observing the post-approval state. Suggest another VM family, SKU, region, or scale target only after verifying support, quota, and capacity for the exact subscription and target; that choice belongs to the workload owner.

Sources: [AKS `QuotaExceeded` troubleshooting](https://learn.microsoft.com/en-us/troubleshoot/azure/azure-kubernetes/create-upgrade-delete/quota-exceeded-during-creation-upgrade), [VM-family vCPU quota requests](https://learn.microsoft.com/en-us/azure/quotas/per-vm-quota-requests), and the [`az quota` reference](https://learn.microsoft.com/en-us/cli/azure/quota?view=azure-cli-latest). The portal is preferred for requests; CLI `create` and `update` operations are writes and must remain owner-executed.

**Autoscaler won't scale down - common reasons:**

- Pods with `emptyDir` local storage (configure `--skip-nodes-with-local-storage=false` if safe)
- Standalone pods with no controller (not in a ReplicaSet)
- `cluster-autoscaler.kubernetes.io/safe-to-evict: "false"` annotation on a pod

### Manual Scaling

```bash
az aks nodepool scale -g <rg> --cluster-name <cluster> -n <nodepool> --node-count <n>
```

---

## Resource Pressure & Capacity Planning

Separate node pressure, container limits, and scheduler capacity. A high current
usage sample is not a leak, and a Pending pod is not proof of node pressure.

```bash
kubectl top node <node>
kubectl top pod -A --containers --sort-by=memory
kubectl get pods -A --field-selector spec.nodeName=<node> \
  -o custom-columns='NS:.metadata.namespace,POD:.metadata.name,CPU_REQ:.spec.containers[*].resources.requests.cpu,CPU_LIMIT:.spec.containers[*].resources.limits.cpu,MEM_REQ:.spec.containers[*].resources.requests.memory,MEM_LIMIT:.spec.containers[*].resources.limits.memory'
kubectl describe node <node>
```

| Signal | Meaning |
|---|---|
| `MemoryPressure=True` plus eviction events | Node-wide memory pressure; identify consumers and reservation/capacity before changing pod limits |
| Container `OOMKilled` without node pressure | Container crossed its cgroup memory limit; compare the affected container, sidecars, and previous logs |
| CPU usage near a container limit with throttling telemetry | Limit-induced throttling is plausible; CPU usage alone does not prove throttling |
| Requests near allocatable but low live usage | Scheduler capacity constraint, not runtime pressure |

`kubectl top` requires Metrics Server and is a current sample, not historical
evidence. If unavailable, use already-configured Azure Monitor or Prometheus
telemetry for the incident window; do not enable monitoring during diagnosis.
Use IG only after aggregate evidence identifies a node/pod scope.

See [AKS resource reservations](https://learn.microsoft.com/azure/aks/concepts-clusters-workloads#resource-reservations) for allocatable math.

**Ephemeral storage pressure:**

```bash
# Correlate node pressure with workload requests, limits, placement, and events
kubectl describe node <node>
kubectl get pods -A --field-selector spec.nodeName=<node> \
  -o custom-columns='NAMESPACE:.metadata.namespace,NAME:.metadata.name,EPHEMERAL_REQUESTS:.spec.containers[*].resources.requests.ephemeral-storage,EPHEMERAL_LIMITS:.spec.containers[*].resources.limits.ephemeral-storage'
kubectl get events --all-namespaces \
  --field-selector involvedObject.kind=Node,involvedObject.name=<node> \
  --sort-by='.metadata.creationTimestamp'
```

If this evidence cannot identify the consumer, request approval before privileged node filesystem inspection.

**Deep diagnostics with Inspektor Gadget** (PID pressure or unknown process load):

Use `snapshot_process` (timeout 5) to list all processes on the node. For node-wide scope, omit pod filters. See [references/inspektor-gadget.md](references/inspektor-gadget.md).

---

## Detailed Node And Cluster Guides

- [Upgrade Operations](upgrade-operations.md) for node images, Kubernetes version upgrades, surge settings, and PDB-related drain blockers.
- [Auto-upgrade evidence](references/auto-upgrade-evidence.md) when an expected automatic cluster or node OS upgrade did not happen.
- [Spot And Zone Issues](spot-and-zone-issues.md) for spot evictions, tolerations, zone skew, and zonal storage or service behavior.
