# Networking Troubleshooting

For CNI-specific issues, check CNI pod health and review [AKS networking concepts](https://learn.microsoft.com/azure/aks/concepts-network).

First define the failing flow: source pod, destination (Service, pod, or host), port and protocol, and direction. Walk DNS → Service → Endpoints → pod → network policy/CNI → Azure NSG/UDR/egress, and stop at the first layer that blocks. After any fix, re-test the same flow from the same source.

## Service Unreachable / Connection Refused

**Diagnostics - always start here:**

```bash
# 1. Verify service exists and has endpoints (read-only)
kubectl get svc <service-name> -n <ns>
kubectl get endpoints <service-name> -n <ns>
kubectl get endpointslice -n <ns> \
  -l kubernetes.io/service-name=<service-name> -o wide
kubectl get pods -n <ns> -l <service-selector> -o wide
```

**Decision tree:**

| Observation                             | Cause                              | Fix                                             |
| --------------------------------------- | ---------------------------------- | ----------------------------------------------- |
| Endpoints shows `<none>`                | Label selector mismatch            | Align selector with pod labels; check for typos |
| Endpoints has IPs but unreachable       | Port mismatch or app not listening | Confirm `targetPort` = actual container port    |
| Works from some pods, fails from others | Network policy blocking            | See Network Policy section                      |
| Works inside cluster, fails externally  | Load balancer issue                | See Load Balancer section                       |
| `ECONNREFUSED` immediately              | App not listening on that port     | Check listening ports in the pod                |

Pods that are running but not Ready are removed from Endpoints. Check `kubectl get pod <pod> -n <ns>`.

**Deep diagnostics with Inspektor Gadget** (when the above checks are inconclusive):

Use the [IG base command pattern](references/inspektor-gadget.md) with `--k8s-namespace <ns> --k8s-podname <pod-name>` and these gadgets:

- `snapshot_socket` (timeout 5) — check what ports the pod is listening on
- `trace_tcp` (timeout 30) — trace connect/accept/close events
- `trace_tcpretrans` (timeout 30) — packet retransmissions

See [references/inspektor-gadget.md](references/inspektor-gadget.md).

---

## DNS Resolution Failures

Use the affected pod; do not create a test pod or change DNS, NetworkPolicy, NSG, route, or firewall configuration without explicit approval.

### Select the resolver path first

Inspect the affected pod's resolver inputs and determine whether its node pool
uses LocalDNS before assuming every query goes directly through kube-dns and
CoreDNS. AKS Automatic preconfigures LocalDNS; AKS Standard can enable it per
node pool.

```bash
# 1. Preserve and explicitly inspect every nameserver, search suffix, and option
kubectl exec <affected-pod> -n <ns> -- cat /etc/resolv.conf

# 2. Inspect the affected node pool and resolver path
kubectl get pod <affected-pod> -n <ns> -o wide
az aks nodepool show \
  --resource-group <cluster-resource-group> \
  --cluster-name <cluster-name> \
  --name <affected-node-pool> -o json
```

If LocalDNS is enabled, scope the failure before changing anything: all pools
or one pool, all nodes or one node, UDP or TCP, and cluster zones or external
zones. Inspect the effective LocalDNS forwarding configuration and logs on the
affected node using an approved node-access method. LocalDNS forwards different
zones to CoreDNS or VNet DNS, so a node-, pool-, protocol-, or zone-specific
failure can be local even when CoreDNS is healthy. Query logging has resource
cost and requires approval. Updating a node pool's LocalDNS configuration can
reimage nodes; disclose that impact before proposing it.

If LocalDNS is disabled, or once its forwarding path reaches CoreDNS, continue
with the CoreDNS branch:

```bash
# 3. Check the kube-dns Service, backends, CoreDNS pods, logs, and config
kubectl get service kube-dns -n kube-system -o wide
kubectl get endpoints kube-dns -n kube-system -o wide
kubectl get endpointslice -n kube-system \
  -l kubernetes.io/service-name=kube-dns -o wide
kubectl get pods -n kube-system -l k8s-app=kube-dns -o wide
kubectl logs -n kube-system -l k8s-app=kube-dns \
  --all-containers --prefix --tail=-1
kubectl get configmap coredns -n kube-system -o yaml
kubectl get configmap -n kube-system

# 4. Prove CoreDNS query health through the kube-dns ClusterIP, then compare
# direct UDP and TCP 53 behavior for every configured upstream forwarder.
# Use clients already present in the affected pod; do not install packages.
kubectl exec <affected-pod> -n <ns> -- \
  nslookup <failing-fqdn> <kube-dns-cluster-ip>
kubectl exec <affected-pod> -n <ns> -- \
  dig +notcp +time=<timeout-seconds> +tries=<attempt-count> \
  @<custom-forwarder-ip> <failing-fqdn>
kubectl exec <affected-pod> -n <ns> -- \
  dig +tcp +time=<timeout-seconds> +tries=<attempt-count> \
  @<custom-forwarder-ip> <failing-fqdn>

# 5. Preserve policy plus the node-NIC NSG/route path used by each CoreDNS pod
kubectl get networkpolicy -n <ns> -o yaml
kubectl get networkpolicy -n kube-system -o yaml
kubectl get pods -n kube-system -l k8s-app=kube-dns \
  -o custom-columns='POD:.metadata.name,POD_IP:.status.podIP,NODE:.spec.nodeName'
NODE_RESOURCE_GROUP=$(az aks show \
  --resource-group <cluster-resource-group> \
  --name <cluster-name> \
  --query nodeResourceGroup -o tsv)
COREDNS_PROVIDER_ID=$(kubectl get node <coredns-node> \
  -o jsonpath='{.spec.providerID}')
COREDNS_POOL=$(kubectl get node <coredns-node> \
  -o jsonpath='{.metadata.labels.agentpool}')
COREDNS_VMSS_NAME=$(printf '%s\n' "$COREDNS_PROVIDER_ID" |
  awk -F'/virtualMachineScaleSets/' '{print $2}' | cut -d/ -f1)
COREDNS_INSTANCE_ID=${COREDNS_PROVIDER_ID##*/}
COREDNS_NODE_NIC_ID=$(az vmss nic list-vm-nics \
  --resource-group "$NODE_RESOURCE_GROUP" \
  --vmss-name "$COREDNS_VMSS_NAME" \
  --instance-id "$COREDNS_INSTANCE_ID" \
  --query '[0].id' -o tsv)
COREDNS_NODE_SUBNET_ID=$(az network nic show \
  --ids "$COREDNS_NODE_NIC_ID" \
  --query 'ipConfigurations[0].subnet.id' -o tsv)
COREDNS_POD_SUBNET_ID=$(az aks nodepool show \
  --resource-group <cluster-resource-group> \
  --cluster-name <cluster-name> \
  --name "$COREDNS_POOL" \
  --query podSubnetId -o tsv)
COREDNS_SOURCE_SUBNET_ID=${COREDNS_POD_SUBNET_ID:-$COREDNS_NODE_SUBNET_ID}

# Effective node-NIC evidence, then explicit source-subnet NSG and UDR evidence
az network nic list-effective-nsg \
  --ids "$COREDNS_NODE_NIC_ID" -o json
az network nic show-effective-route-table \
  --ids "$COREDNS_NODE_NIC_ID" -o table
if COREDNS_SUBNET_NSG_ID=$(az network vnet subnet show \
  --ids "$COREDNS_SOURCE_SUBNET_ID" \
  --query networkSecurityGroup.id -o tsv); then
  if [ -n "$COREDNS_SUBNET_NSG_ID" ]; then
    if COREDNS_SUBNET_NSG=$(az network nsg show \
      --ids "$COREDNS_SUBNET_NSG_ID" \
      --query '{customOutbound:securityRules[?direction==`Outbound`],defaultOutbound:defaultSecurityRules[?direction==`Outbound`]}' \
      -o json); then
      if [ -n "$COREDNS_SUBNET_NSG" ]; then
        printf '%s\n' "$COREDNS_SUBNET_NSG"
      else
        printf 'subnetNsg=unknown: command=az network nsg show succeeded with empty output; id=%s\n' \
          "$COREDNS_SUBNET_NSG_ID"
      fi
    else
      printf 'subnetNsg=inaccessible: command=az network nsg show; id=%s\n' \
        "$COREDNS_SUBNET_NSG_ID"
    fi
  else
    printf 'subnetNsg=absent\n'
  fi
else
  COREDNS_SUBNET_NSG_ID=""
  printf 'subnetNsg=inaccessible: command=az network vnet subnet show; ids=%s; query=networkSecurityGroup.id\n' \
    "$COREDNS_SOURCE_SUBNET_ID"
fi
if COREDNS_ROUTE_TABLE_ID=$(az network vnet subnet show \
  --ids "$COREDNS_SOURCE_SUBNET_ID" \
  --query routeTable.id -o tsv); then
  if [ -n "$COREDNS_ROUTE_TABLE_ID" ]; then
    if COREDNS_ROUTE_TABLE=$(az network route-table show \
      --ids "$COREDNS_ROUTE_TABLE_ID" \
      --query 'routes[].{name:name,addressPrefix:addressPrefix,nextHopType:nextHopType,nextHopIpAddress:nextHopIpAddress}' \
      -o table); then
      if [ -n "$COREDNS_ROUTE_TABLE" ]; then
        printf '%s\n' "$COREDNS_ROUTE_TABLE"
      else
        printf 'routeTableRoutes=absent: command=az network route-table show succeeded with empty routes output; id=%s\n' \
          "$COREDNS_ROUTE_TABLE_ID"
      fi
    else
      printf 'routeTable=inaccessible: command=az network route-table show; id=%s\n' \
        "$COREDNS_ROUTE_TABLE_ID"
    fi
  else
    printf 'routeTable=absent\n'
  fi
else
  COREDNS_ROUTE_TABLE_ID=""
  printf 'routeTable=inaccessible: command=az network vnet subnet show; ids=%s; query=routeTable.id\n' \
    "$COREDNS_SOURCE_SUBNET_ID"
fi
```

Repeat these checks for each node hosting a CoreDNS pod. For Azure CNI Pod Subnet, `COREDNS_SOURCE_SUBNET_ID` is the pod subnet; otherwise it is the CoreDNS node NIC subnet. Record an NSG or route table as absent only when its association lookup succeeds with an empty ID; record a failed lookup as inaccessible instead of running its dependent `show` command. Evaluate outbound rules and routes from the CoreDNS pod/node source to every configured upstream on both UDP and TCP destination port 53.

If the selected route has a `VirtualAppliance` next hop, run the exact policy or classic network-rule collection commands in [Mandatory Firewall or NVA branch when traversed](#3-mandatory-firewall-or-nva-branch-when-traversed), then query the matching DNS decisions:

```bash
az monitor log-analytics query \
  --workspace <log-analytics-workspace-id> \
  --timespan <incident-start-utc>/<incident-end-utc> \
  --analytics-query "union isfuzzy=true AZFWNetworkRule, AzureDiagnostics | where _ResourceId =~ '<firewall-resource-id>' | where (SourceIp in ('<coredns-pod-ip>','<coredns-node-ip>') and DestinationIp == '<custom-forwarder-ip>' and DestinationPort == 53 and Protocol in ('UDP','TCP')) or (Category == 'AzureFirewallNetworkRule' and (msg_s has '<coredns-pod-ip>' or msg_s has '<coredns-node-ip>') and msg_s has '<custom-forwarder-ip>' and msg_s has '53' and (msg_s has 'UDP' or msg_s has 'TCP')) | project TimeGenerated,Category,Action,Protocol,SourceIp,DestinationIp,DestinationPort,RuleCollection,Rule,msg_s"
```

For a custom NVA, collect equivalent network-rule and log evidence filtered to the same CoreDNS source, upstream destination, incident window, and UDP/TCP 53.

If CoreDNS imports a custom ConfigMap, retrieve the named ConfigMap shown by the inventory before evaluating its forwarding rules. A successful direct query to a custom forwarder with a failed query through kube-dns points to CoreDNS configuration or service-path evidence; failure to reach the forwarder points to routing, NSG, firewall, or NetworkPolicy evidence.

Do not name UDP source-port reuse as the cause of CoreDNS imbalance until logs
show the same client source IP and port repeatedly reaching one replica.

**DNS failure patterns:**

| Symptom | Evidence boundary |
|---|---|
| `NXDOMAIN` for `svc.cluster.local` | Confirm search domains, kube-dns endpoints, and the CoreDNS `kubernetes` plugin before changing CoreDNS |
| Internal names resolve; external names return `NXDOMAIN` | Compare CoreDNS forwarding configuration and direct queries to each configured upstream |
| `SERVFAIL` | Correlate CoreDNS logs with upstream reachability and forwarder responses |
| Private endpoint FQDN resolves publicly | Inspect the `privatelink.*` private DNS zone, record set, virtual network links, and conditional forwarders |
| `i/o timeout` | Inspect NetworkPolicy plus effective node-NIC NSG, route, and present firewall rules for both UDP and TCP 53 |

Changing CoreDNS replicas/configuration, custom forwarders, NetworkPolicy, NSGs, routes, or firewall rules is remediation and requires explicit approval.

Sources: [LocalDNS troubleshooting](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/connectivity/dns/troubleshoot-localdns),
[LocalDNS configuration](https://learn.microsoft.com/azure/aks/localdns-custom),
and [CoreDNS troubleshooting](https://learn.microsoft.com/azure/aks/coredns-troubleshoot).

**Deep diagnostics with Inspektor Gadget** (when the above checks are inconclusive):

Use the [IG base command pattern](references/inspektor-gadget.md) with `--k8s-namespace <ns> --k8s-podname <pod-name>` and `trace_dns` (timeout 30). Key signals: `rcode=3` (NXDOMAIN), `rcode=2` (SERVFAIL), high `latency` values, queries going to unexpected destinations.

See [references/inspektor-gadget.md](references/inspektor-gadget.md).

---

## AKS to an External Azure Service

Use [references/azure-network-path.md](references/azure-network-path.md) to
derive the source node/VMSS NIC, prove the effective NSG and route, and inspect
the selected UDR, NAT gateway, load-balancer outbound rule, firewall/NVA,
private endpoint, service endpoint, or peering path. It includes current
Network Watcher `show-next-hop` and `test-ip-flow` syntax plus their AKS VMSS
limitations.

Before concluding, require:

1. DNS and TCP evidence from the affected pod using tools already present;
2. the cluster network profile and outbound type;
3. effective node-NIC NSG and route evidence;
4. the target service's public-access, firewall/VNet-rule, or private-endpoint
   configuration; and
5. matching firewall/NVA policy and incident-window logs when the selected
   route traverses a stateful appliance.

Record a skipped branch and why. A successful empty association means absent;
a failed lookup means inaccessible, not absent. Do not change DNS, endpoint
policy, NSGs, UDRs, peering, NetworkPolicy, or firewall/NVA rules until the
first blocking layer is proven and remediation is explicitly approved.

---

## Detailed Networking Guides

- [Load Balancer And Ingress Troubleshooting](load-balancer-and-ingress.md) for pending services, ingress controller state, backend routing, and TLS failures.
- [Network Policy Troubleshooting](network-policy.md) for default-deny checks, Azure NPM or Calico validation, and ingress or egress rule audits.
- [AKS Azure Network Path Evidence](references/azure-network-path.md) for node NIC/VMSS mapping, effective routes and NSGs, Network Watcher, egress/SNAT, private endpoints, service endpoints, and peering.
