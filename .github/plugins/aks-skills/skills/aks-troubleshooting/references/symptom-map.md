# Symptom → Investigation Map

Look up the symptom, run the commands in order. Each section is self-contained.

---

## Pod Pending

```bash
kubectl describe pod <pod> -n <ns>         # Check Events for scheduling failure reason
kubectl get events -n <ns> --sort-by='.lastTimestamp' --field-selector involvedObject.name=<pod>
kubectl get nodes -o wide                  # Node count and status
kubectl describe nodes | grep -A5 "Allocated resources"  # Resource pressure
kubectl get pv,pvc -n <ns>                 # PVC binding stuck?
```

Common causes: insufficient CPU/memory, node taints without tolerations, PVC pending, node selector mismatch, subnet IP exhaustion (Azure CNI).

---

## Pod CrashLoopBackOff

```bash
# Preserve the terminated container output before another restart replaces it
kubectl logs <pod> -n <ns> --previous --all-containers=true --prefix

# Then collect current output from every app and init container
kubectl logs <pod> -n <ns> --all-containers=true --prefix

# Preserve pod state, termination reason/exit code, restart count, and events
kubectl describe pod <pod> -n <ns>
kubectl get pod <pod> -n <ns> \
  -o jsonpath='{range .status.initContainerStatuses[*]}init/{.name}{"\t"}{.restartCount}{"\t"}{.lastState.terminated.reason}{"\t"}{.lastState.terminated.exitCode}{"\n"}{end}{range .status.containerStatuses[*]}container/{.name}{"\t"}{.restartCount}{"\t"}{.lastState.terminated.reason}{"\t"}{.lastState.terminated.exitCode}{"\n"}{end}'
kubectl get events -n <ns> \
  --field-selector involvedObject.kind=Pod,involvedObject.name=<pod> \
  --sort-by='.metadata.creationTimestamp'
```

Distinguish the evidence before choosing a fix:

- **Missing environment or Secret injection:** pod events report a missing Secret/key or `CreateContainerConfigError`, or the container log reports a required environment value is absent.
- **Unmounted ConfigMap or configuration file:** pod events report `FailedMount`/`MountVolume.SetUp`, or the process starts and reports that the expected file path is absent. This is not the same as a missing environment value.
- **OOM termination:** the terminated state reports `OOMKilled` or exit code `137`; compare limits and memory evidence.
- **Unreachable dependency:** the application starts far enough to log DNS, timeout, refused-connection, TLS, or authentication errors for a named dependency.
- **Probe-killed startup:** pod events show repeated startup/liveness probe failures and the termination/restart timeline follows those failures; distinguish a slow or invalid startup probe from an application crash.

---

## Node NotReady

```bash
AKS_RG="<cluster-resource-group>"
AKS_NAME="<cluster-name>"
NODE="<node-name>"

kubectl describe node "$NODE"
kubectl get node "$NODE" \
  -o jsonpath='{range .status.conditions[*]}{.lastTransitionTime}{"\t"}{.type}{"\t"}{.status}{"\t"}{.reason}{"\t"}{.message}{"\n"}{end}'
kubectl get events --all-namespaces \
  --field-selector involvedObject.kind=Node,involvedObject.name="$NODE" \
  --sort-by='.metadata.creationTimestamp'

# Derive the exact AKS node resource group, pool, VMSS, and instance
NODE_RG=$(az aks show \
  --resource-group "$AKS_RG" \
  --name "$AKS_NAME" \
  --query nodeResourceGroup -o tsv)
AGENT_POOL=$(kubectl get node "$NODE" \
  -o jsonpath='{.metadata.labels.agentpool}')
PROVIDER_ID=$(kubectl get node "$NODE" \
  -o jsonpath='{.spec.providerID}')
VMSS=$(printf '%s\n' "$PROVIDER_ID" |
  awk -F'/virtualMachineScaleSets/' '{print $2}' | cut -d/ -f1)
INSTANCE_ID=${PROVIDER_ID##*/}

printf 'nodeResourceGroup=%s\nagentPool=%s\nvmss=%s\ninstanceId=%s\n' \
  "$NODE_RG" "$AGENT_POOL" "$VMSS" "$INSTANCE_ID"

az aks nodepool show \
  --resource-group "$AKS_RG" \
  --cluster-name "$AKS_NAME" \
  --name "$AGENT_POOL" \
  --query '{provisioningState:provisioningState,powerState:powerState.code,nodeImageVersion:nodeImageVersion,orchestratorVersion:orchestratorVersion}' \
  -o yaml
az vmss get-instance-view \
  --resource-group "$NODE_RG" \
  --name "$VMSS" \
  --instance-id "$INSTANCE_ID" \
  -o json
az vmss get-instance-view \
  --resource-group "$NODE_RG" \
  --name "$VMSS" \
  --instance-id "$INSTANCE_ID" \
  --query 'extensions[].{name:name,statuses:statuses,substatuses:substatuses}' \
  -o json
```

Common causes: kubelet crash, containerd OOM, Azure host maintenance, disk full, NTP drift, CNI plugin crash.

---

## Image Pull Failure (ErrImagePull / ImagePullBackOff)

```bash
kubectl describe pod <pod> -n <ns>         # Image name and pull error in Events
az aks show -g <rg> -n <cluster> --query "identityProfile.kubeletidentity.clientId" -o tsv
az role assignment list --assignee <kubelet-id> --scope <acr-id> -o table
az acr repository show -n <acr> --image <image>:<tag>
```

Common causes: wrong image tag, ACR not attached (`az aks update --attach-acr`), kubelet identity missing AcrPull role, private ACR without private endpoint.

---

## OOMKilled (Exit Code 137)

```bash
kubectl describe pod <pod> -n <ns>         # Last State: OOMKilled
kubectl top pod -n <ns>                    # Current memory usage
kubectl get pod <pod> -n <ns> -o jsonpath='{.spec.containers[*].resources}'
kubectl logs <pod> -n <ns> --previous      # What was happening before OOM
```

Common causes: memory limit too low, memory leak, JVM heap exceeds container limit (set -Xmx), sidecar eating memory.

---

## Service Not Reachable / Connection Refused

```bash
kubectl get svc -n <ns>                    # ClusterIP, ports, selectors
kubectl get endpoints -n <ns>              # Are endpoints populated?
kubectl get pods -n <ns> -l <svc-selector> # Do pods match the selector?
kubectl exec <client-pod> -n <ns> -- curl -v <svc>:<port>/healthz
kubectl get networkpolicies -n <ns>        # Network policy blocking traffic?
```

Common causes: label selector mismatch (no endpoints), target port wrong, network policy denying ingress, pod not Ready.

---

## DNS Resolution Failure

```bash
kubectl exec <pod> -n <ns> -- nslookup kubernetes.default
kubectl exec <pod> -n <ns> -- cat /etc/resolv.conf
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns --all-containers
```

Common causes: coredns pods crashed/pending, custom DNS config overriding cluster DNS, network policy blocking UDP 53, ndots:5 causing excessive lookups.

---

## Load Balancer Not Working

```bash
kubectl get svc -n <ns> -o wide            # EXTERNAL-IP stuck <pending>?
kubectl describe svc <svc> -n <ns>         # Events for LoadBalancer provisioning errors
NODE_RG=$(az aks show -g <rg> -n <cluster> --query nodeResourceGroup -o tsv)
az network lb list -g "$NODE_RG" -o table
az network lb probe list -g "$NODE_RG" --lb-name <lb>
az network lb rule list -g "$NODE_RG" --lb-name <lb>
```

Common causes: effective node-NIC NSG blocking inbound/probes, health probe
path/port mismatch, subnet exhaustion, or a Service annotation mismatch. Deep
path: [load-balancer-and-ingress.md](../load-balancer-and-ingress.md).

---

## Storage / PVC Stuck

```bash
kubectl get pvc -n <ns>                    # Status: Pending?
kubectl describe pvc <pvc> -n <ns>         # Events for provisioning error
kubectl get sc                             # StorageClass exists and is default?
kubectl get pv                             # Volume available/bound?
az disk list -g MC_<rg>_<cluster>_<region> --query "[?managedBy=='']" -o table  # Orphaned disks
```

Common causes: wrong StorageClass, disk in wrong zone/region, kubelet identity lacks disk attach permissions, Azure Disk max attach limit per VM size reached.

---

## Managed Identity / Permission Denied

```bash
az aks show -g <rg> -n <cluster> --query "identity"
az aks show -g <rg> -n <cluster> --query "identityProfile"
az role assignment list --assignee <identity-client-id> -o table
az role assignment list --assignee <kubelet-client-id> -o table
# Check if workload identity is configured
kubectl get sa <sa> -n <ns> -o yaml | grep azure.workload.identity
```

Common causes: kubelet identity missing role, federated credential subject mismatch (namespace:sa typo), token audience wrong, identity not in same tenant.

---

## Node Pool Scaling Failure

```bash
az aks nodepool list -g <rg> --cluster-name <cluster> -o table
az aks nodepool show -g <rg> --cluster-name <cluster> -n <pool> --query provisioningState
# Failed state: read the operation record first (aks-preview extension), then the activity log
az aks operation show-latest -g <rg> -n <cluster> --nodepool-name <pool>
az monitor activity-log list -g <rg> --offset 1h --query "[?status.value=='Failed']"
az vm list-usage -l <region> -o table | grep -i "Total Regional vCPUs\|Standard.*Family"
```

Common causes: vCPU quota exhaustion, subnet IP exhaustion, VM SKU not available in region, system pool min-count prevents scale-down. For `provisioningState: Failed`, follow the Failed-state branch in [node-issues.md](../node-issues.md).

---

## API Server Unreachable / kubectl Can't Connect

```bash
az aks show -g <rg> -n <cluster> --query '{fqdn:fqdn, privateFqdn:privateFqdn, provisioningState:provisioningState, powerState:powerState.code}'
FQDN=$(az aks show -g <rg> -n <cluster> --query fqdn -o tsv)
nslookup "$FQDN"                           # DNS resolution of API server
curl -k -Iv "https://$FQDN"               # TCP + TLS connectivity
kubectl version --client                    # Must be within ±1 minor of every reachable API server
az aks show -g <rg> -n <cluster> --query kubernetesVersion -o tsv
az aks show -g <rg> -n <cluster> --query "apiServerAccessProfile" # Authorized IP ranges / private cluster
```

Common causes: cluster stopped (power state not Running), private cluster accessed from outside VNet, client IP not in authorized IP ranges, API server FQDN DNS changed after stop/start, `kubectl` more than one minor from a reachable API server, expired kubeconfig (`az aks get-credentials` to refresh). In an HA control plane with API-server version skew, use a `kubectl` version supported by every reachable API server.

---

## Cluster Create / Start Failure (VM Extension Errors)

```bash
az aks show -g <rg> -n <cluster> --query provisioningState -o tsv
az aks operation show-latest -g <rg> -n <cluster>   # aks-preview extension; exact failing operation and error
az monitor activity-log list -g <rg> --offset 1h --query "[?status.value=='Failed']" -o table
# Check egress connectivity from node's perspective
az aks show -g <rg> -n <cluster> --query "networkProfile.outboundType" -o tsv
az network nsg list -g MC_<rg>_<cluster>_<region> -o table
az network nsg rule list -g MC_<rg>_<cluster>_<region> --nsg-name <nsg> -o table
```

Read the operation record or activity-log error before interpreting node evidence; an exact catalog error code in the record routes to `aks-known-issues`. If the `aks-preview` extension is unavailable and cannot be installed, record the activity log as the only (degraded) operation evidence. See the Failed-state branch in [node-issues.md](../node-issues.md).

Common causes:
- **Error 50 (OutboundConnFailVMExtensionError):** Node can't reach required endpoints. NSG or firewall blocks outbound to MCR, management.azure.com, or packages.microsoft.com.
- **Error 51 (K8SAPIServerConnFailVMExtensionError):** Node can't connect to API server. Check NSG allows TCP 443 to API server IP.
- **Error 52 (K8SAPIServerDNSLookupFailVMExtensionError):** DNS resolution for API server FQDN fails from node. Custom DNS without proper forwarding.

---

## Upgrade Stuck / Slow

```bash
az aks show -g <rg> -n <cluster> --query '{provisioningState:provisioningState, kubernetesVersion:kubernetesVersion}'
az aks nodepool list -g <rg> --cluster-name <cluster> --query '[].{name:name, provisioningState:provisioningState, orchestratorVersion:orchestratorVersion, upgradeSettings:upgradeSettings}' -o table
kubectl get pdb -A                         # PDBs blocking drain?
kubectl get nodes -o wide                  # Nodes in mixed versions?
az monitor activity-log list -g <rg> --offset 2h --query "[?contains(operationName.value,'Microsoft.ContainerService')]" -o table
```

Common causes: PDB blocking pod eviction (especially system pods), max-surge set to 1 (default — slow for large clusters), node with pods that have `terminationGracePeriodSeconds` > 30m, insufficient subnet IPs to surge new nodes.

---

## Auto-Upgrade Didn't Happen / Node Image Stale

```bash
az aks show -g <rg> -n <cluster> --query '{sku:sku, autoUpgradeProfile:autoUpgradeProfile, kubernetesVersion:kubernetesVersion}'
az aks nodepool list -g <rg> --cluster-name <cluster> --query '[].{name:name, powerState:powerState.code, orchestratorVersion:orchestratorVersion, nodeImageVersion:nodeImageVersion}' -o table
az aks maintenanceconfiguration list -g <rg> --cluster-name <cluster> -o table
az aks nodepool get-upgrades -g <rg> --cluster-name <cluster> -n <pool>
az aks operation show-latest -g <rg> -n <cluster>   # aks-preview extension
```

Common causes: `upgradeChannel: none`/`nodeOSUpgradeChannel` not set (a maintenance window schedules upgrades but does not enable them), channel change made less than 24 hours ago, maintenance is best effort and the window has not yet been used, stopped node pools receive the upgrade only when started, cluster already on the channel's target version. Decision block: [auto-upgrade-evidence.md](auto-upgrade-evidence.md).

---

## Egress / SNAT Exhaustion (Intermittent Outbound Failures)

```bash
az aks show -g <rg> -n <cluster> --query "networkProfile.outboundType" -o tsv
NODE_RG=$(az aks show -g <rg> -n <cluster> --query nodeResourceGroup -o tsv)
az network lb list -g "$NODE_RG" -o table
az network lb outbound-rule list -g "$NODE_RG" --lb-name <lb> -o json
az network nat gateway list -g "$NODE_RG" -o table
# Reproduce the reported destination from the affected pod using an existing client
kubectl exec <pod> -n <ns> -- curl -sv --connect-timeout <seconds> https://<reported-host>/
```

Do not infer exhaustion from node count. Require failed SNAT metrics or matching
connection failures, and first follow the cluster's actual outbound type. For
UDR or NAT gateway paths, an Azure LB outbound-rule diagnosis is the wrong
branch. Full path: [azure-network-path.md](azure-network-path.md).

---

## Certificate Expiration / Rotation

```bash
az aks show -g <rg> -n <cluster> --query "certificateProfile" 2>/dev/null || echo "(check cluster version)"
# Check API server certificate expiry
FQDN=$(az aks show -g <rg> -n <cluster> --query fqdn -o tsv)
echo | openssl s_client -connect "$FQDN:443" -servername "$FQDN" 2>/dev/null | openssl x509 -noout -dates
# Check for pending CSRs (kubelet cert rotation)
kubectl get csr --sort-by='.metadata.creationTimestamp'
# Check node kubelet certificate
kubectl get nodes -o json | jq '.items[] | {name: .metadata.name, kubeletReady: (.status.conditions[] | select(.type=="Ready") | .status)}'
```

Common causes: AKS auto-rotates certs but rotation can fail if cluster is stopped for > 30 days, API server cert expired (nodes go NotReady), kubelet client cert expired (CSR stuck in Pending). Fix: `az aks rotate-certs` for full rotation.
