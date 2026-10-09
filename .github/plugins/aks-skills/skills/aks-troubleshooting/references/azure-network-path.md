# AKS Azure Network Path Evidence

Use after Kubernetes evidence places the failure outside the cluster data
plane. Bind the target, failing five-tuple, and incident window first.

## Resolve the source node NIC

```bash
AKS_SUBSCRIPTION_ID="<subscription-id>"
AKS_RG="<cluster-resource-group>"
AKS_NAME="<cluster-name>"
KUBE_CONTEXT="<verified-context>"
NS="<namespace>"
POD="<source-pod>"
DEST_IP="<destination-ip>"
DEST_PORT="<destination-port>"
PROTOCOL="TCP"

NODE_RG=$(az aks show --subscription "$AKS_SUBSCRIPTION_ID" \
  -g "$AKS_RG" -n "$AKS_NAME" --query nodeResourceGroup -o tsv)
NODE=$(kubectl --context "$KUBE_CONTEXT" get pod "$POD" -n "$NS" \
  -o jsonpath='{.spec.nodeName}')
NODE_IP=$(kubectl --context "$KUBE_CONTEXT" get node "$NODE" \
  -o jsonpath='{.status.addresses[?(@.type=="InternalIP")].address}')
PROVIDER_ID=$(kubectl --context "$KUBE_CONTEXT" get node "$NODE" \
  -o jsonpath='{.spec.providerID}')
VMSS_NAME=$(printf '%s\n' "$PROVIDER_ID" |
  awk -F'/virtualMachineScaleSets/' '{print $2}' | cut -d/ -f1)
INSTANCE_ID=${PROVIDER_ID##*/}
VMSS_VM_ID=${PROVIDER_ID#azure://}
NODE_NIC_ID=$(az vmss nic list-vm-nics \
  --subscription "$AKS_SUBSCRIPTION_ID" \
  -g "$NODE_RG" --vmss-name "$VMSS_NAME" --instance-id "$INSTANCE_ID" \
  --query '[0].id' -o tsv)
NODE_SUBNET_ID=$(az network nic show --ids "$NODE_NIC_ID" \
  --query 'ipConfigurations[0].subnet.id' -o tsv)
POOL=$(kubectl --context "$KUBE_CONTEXT" get node "$NODE" \
  -o jsonpath='{.metadata.labels.agentpool}')
POD_SUBNET_ID=$(az aks nodepool show --subscription "$AKS_SUBSCRIPTION_ID" \
  -g "$AKS_RG" --cluster-name "$AKS_NAME" -n "$POOL" \
  --query podSubnetId -o tsv)
SOURCE_SUBNET_ID=${POD_SUBNET_ID:-$NODE_SUBNET_ID}
```

`az vmss nic list-vm-nics` is Uniform-VMSS-specific. For Flexible VMSS, use
`az network nic`. Never guess among multiple NICs or IP configurations.

## Prove NSG and route decisions

```bash
az network nic list-effective-nsg --ids "$NODE_NIC_ID" -o json
az network nic show-effective-route-table --ids "$NODE_NIC_ID" -o json
az network vnet subnet show --ids "$SOURCE_SUBNET_ID" \
  --query '{nsg:networkSecurityGroup.id,routeTable:routeTable.id,natGateway:natGateway.id,serviceEndpoints:serviceEndpoints}' \
  -o yaml

# Network Watcher models the VMSS instance/node NIC, not Kubernetes
# NetworkPolicy or every CNI pod path. Use the node NIC's private IP.
az network watcher show-next-hop \
  --vm "$VMSS_VM_ID" --nic "$NODE_NIC_ID" \
  --source-ip "$NODE_IP" --dest-ip "$DEST_IP" -o json
az network watcher test-ip-flow \
  --vm "$VMSS_VM_ID" --nic "$NODE_NIC_ID" \
  --direction Outbound --protocol "$PROTOCOL" \
  --local "$NODE_IP:*" --remote "$DEST_IP:$DEST_PORT" -o json
```

The CLI requires `--vm` even with `--nic`. If Network Watcher rejects the VMSS
instance or is unavailable, use effective NIC evidence and record the gap. Its
`Allow` result does not clear NetworkPolicy, CNI, firewall/NVA policy,
destination ACLs, or the application.

Interpret the route chosen by longest-prefix match:

| Effective next hop | Continue with |
|---|---|
| `None` | Identify the active blackhole UDR or invalid route |
| `VirtualAppliance` | Resolve Azure Firewall versus NVA; inspect policy, health, logs, and onward route |
| `VirtualNetworkGateway` | Verify gateway/BGP routes; do not assume transit |
| `VNetPeering` | Inspect both peering objects and the return path |
| `Internet` | Resolve the actual SNAT identity for the cluster outbound type |

For an NVA, verify `enableIPForwarding: true`; appliance commands need separate
authorization.

## Egress and asymmetric routing

```bash
az aks show --subscription "$AKS_SUBSCRIPTION_ID" -g "$AKS_RG" -n "$AKS_NAME" \
  --query '{outboundType:networkProfile.outboundType,effectiveOutboundIPs:networkProfile.loadBalancerProfile.effectiveOutboundIPs[].id}' \
  -o yaml
az network vnet subnet show --ids "$SOURCE_SUBNET_ID" \
  --query '{natGateway:natGateway.id,routeTable:routeTable.id}' -o yaml
```

| Outbound evidence | Diagnostic rule |
|---|---|
| Subnet NAT gateway | Inspect its public identity and incident-window `DroppedSNATConnections` |
| `loadBalancer` | Inspect managed LB outbound rules and effective outbound IPs; node count is not exhaustion evidence |
| `userDefinedRouting` or `none` | Follow `0.0.0.0/0` and prove the next hop's SNAT identity |
| `block` | Public egress is intentionally blocked except for evidenced paths |

For LB/Application Gateway inbound traffic, compare the backend return route
toward the client. A UDR through a stateful firewall/NVA can make the path
asymmetric. Require forward, return, and stateful-hop evidence.

## Private endpoints and DNS

Preserve the pod's CNAME/A response and compare it with the endpoint NIC:

```bash
kubectl --context "$KUBE_CONTEXT" exec "$POD" -n "$NS" -- \
  nslookup <service-fqdn>
az network private-endpoint show --ids <private-endpoint-id> \
  --query '{state:provisioningState,subnet:subnet.id,nics:networkInterfaces[].id,connections:privateLinkServiceConnections[].privateLinkServiceConnectionState.status}' \
  -o yaml
az network private-endpoint dns-zone-group list \
  -g <private-endpoint-resource-group> --endpoint-name <private-endpoint-name> \
  -o json
az network private-dns record-set a list \
  -g <private-dns-resource-group> -z <privatelink-zone> -o table
az network private-dns link vnet list \
  -g <private-dns-resource-group> -z <privatelink-zone> -o table
```

- The FQDN must reach the expected `privatelink.*` name and endpoint IP.
- With custom VNet DNS, inspect the server/Private Resolver forwarding path.
  A zone link alone does not prove the pod's configured resolver can query it.
- For a private cluster, apply the same chain to `privateFqdn`; keep
  client-to-API DNS separate from pod-to-service DNS.
- An approved endpoint with correct DNS but failed TCP moves the investigation
  to NSG, UDR, peering, destination policy, and application evidence.

## Service endpoints

A service endpoint keeps public DNS. Require a `Succeeded` endpoint on the
source subnet and a target-service firewall/VNet rule for that exact subnet.
It is not transitive from another VNet or on-premises.

## VNet peering and hub-spoke

```bash
az network vnet peering show -g <source-vnet-rg> \
  --vnet-name <source-vnet> -n <source-to-remote-peering> \
  --query '{state:peeringState,access:allowVirtualNetworkAccess,forwarded:allowForwardedTraffic,gatewayTransit:allowGatewayTransit,useRemoteGateways:useRemoteGateways,remote:remoteVirtualNetwork.id}' \
  -o yaml
az network vnet peering show -g <remote-vnet-rg> \
  --vnet-name <remote-vnet> -n <remote-to-source-peering> \
  --query '{state:peeringState,access:allowVirtualNetworkAccess,forwarded:allowForwardedTraffic,gatewayTransit:allowGatewayTransit,useRemoteGateways:useRemoteGateways,remote:remoteVirtualNetwork.id}' \
  -o yaml
```

- Both directions must be `Connected`; verify address spaces and routes.
- Peering is not transitive. Spoke-to-spoke traffic needs an evidenced routed
  path, commonly UDRs through a hub firewall/NVA.
- Gateway transit pairs hub `allowGatewayTransit` with spoke
  `useRemoteGateways`; appliance transit also needs forwarded traffic and
  symmetric routes.

Sources: [AKS outbound types](https://learn.microsoft.com/azure/aks/egress-outboundtype),
[Network Watcher next hop](https://learn.microsoft.com/azure/network-watcher/diagnose-vm-network-routing-problem-cli),
[IP flow verify](https://learn.microsoft.com/azure/network-watcher/diagnose-vm-network-traffic-filtering-problem-cli),
[private endpoint DNS](https://learn.microsoft.com/azure/private-link/private-endpoint-dns),
and [VNet peering](https://learn.microsoft.com/azure/virtual-network/virtual-network-peering-overview).
