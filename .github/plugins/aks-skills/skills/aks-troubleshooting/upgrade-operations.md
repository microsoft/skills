# Upgrade Operations

Use this guide when node image rotation, Kubernetes version changes, or node-pool upgrade settings appear to be the failure domain. If the complaint is that an *automatic* upgrade or node image update did not happen, use [references/auto-upgrade-evidence.md](references/auto-upgrade-evidence.md) first.

## Stuck or Failed Upgrade: Mandatory Read-only Evidence

A stuck-upgrade diagnosis is incomplete until every step below is collected, or the inability to collect it is recorded. Do not skip deprecated API, admission webhook, upgrade-path, PDB/drain/event, or current `maxSurge` evidence.

```bash
# 1. Control-plane and node-pool state, versions, image, and current maxSurge
az aks show \
  --resource-group <cluster-resource-group> \
  --name <cluster-name> \
  --query '{provisioningState:provisioningState,powerState:powerState.code,kubernetesVersion:kubernetesVersion,currentKubernetesVersion:currentKubernetesVersion}' \
  -o yaml
az aks nodepool list \
  --resource-group <cluster-resource-group> \
  --cluster-name <cluster-name> \
  --query '[].{name:name,provisioningState:provisioningState,powerState:powerState.code,orchestratorVersion:orchestratorVersion,currentOrchestratorVersion:currentOrchestratorVersion,nodeImageVersion:nodeImageVersion,maxSurge:upgradeSettings.maxSurge}' \
  -o table
kubectl get nodes -o wide

# 2. Supported control-plane and affected node-pool upgrade paths
az aks get-upgrades \
  --resource-group <cluster-resource-group> \
  --name <cluster-name> -o table
az aks nodepool get-upgrades \
  --resource-group <cluster-resource-group> \
  --cluster-name <cluster-name> \
  --nodepool-name <affected-nodepool> -o table

# 3. Deprecated API requests that can stop an upgrade
kubectl get --raw /metrics |
  grep 'apiserver_requested_deprecated_apis'

# 4. Admission webhooks that can reject or delay upgrade-time operations
kubectl get validatingwebhookconfigurations,mutatingwebhookconfigurations \
  -o yaml

# 5. PDB and drain-blocker evidence
kubectl get pdb -A \
  -o custom-columns='NAMESPACE:.metadata.namespace,NAME:.metadata.name,MIN_AVAILABLE:.spec.minAvailable,MAX_UNAVAILABLE:.spec.maxUnavailable,ALLOWED:.status.disruptionsAllowed,CURRENT_HEALTHY:.status.currentHealthy,DESIRED_HEALTHY:.status.desiredHealthy'
kubectl describe pdb <pdb-name> -n <ns>
kubectl get pods -A \
  -o custom-columns='NAMESPACE:.metadata.namespace,NAME:.metadata.name,NODE:.spec.nodeName,PHASE:.status.phase,GRACE_SECONDS:.spec.terminationGracePeriodSeconds'
kubectl get events --all-namespaces \
  --sort-by='.metadata.creationTimestamp'
```

Interpret this evidence before selecting remediation:

- A non-`Succeeded` provisioning state can block a new upgrade or indicate an operation still in progress.
- An unavailable target version is not a valid upgrade path.
- Deprecated API metrics identify clients that must be migrated before the target version removes the API.
- Webhook service failures, restrictive failure policies, or timeouts can block admission.
- `disruptionsAllowed: 0`, unhealthy replicas, long termination grace periods, and pod events can explain drain failure.
- The reported `upgradeSettings.maxSurge` is the current configuration; choose any change from workload capacity, quota, subnet address, PDB, and availability evidence rather than a hard-coded percentage.

## Mutation boundary: approval required

`az aks upgrade`, `az aks nodepool upgrade`, and `az aks nodepool update --max-surge` mutate cluster state. The signatures below classify the boundary; do not recommend or execute them unless the owner explicitly approves the target version or surge value and accepts the change window.

```bash
# Control-plane and cluster upgrade
az aks upgrade \
  --resource-group <cluster-resource-group> \
  --name <cluster-name> \
  --kubernetes-version <approved-version>

# Node-pool version or image upgrade
az aks nodepool upgrade \
  --resource-group <cluster-resource-group> \
  --cluster-name <cluster-name> \
  --name <nodepool-name> \
  --kubernetes-version <approved-version>

# Node-image-only upgrade uses the same mutating command with --node-image-only

# Change maxSurge
az aks nodepool update \
  --resource-group <cluster-resource-group> \
  --cluster-name <cluster-name> \
  --name <nodepool-name> \
  --max-surge <approved-count-or-percentage>
```

Changing or deleting a PDB, scaling a workload, retrying an upgrade, or changing a webhook is also mutating remediation. Preserve the original object, confirm workload availability requirements, and obtain explicit approval before making any of those changes.
