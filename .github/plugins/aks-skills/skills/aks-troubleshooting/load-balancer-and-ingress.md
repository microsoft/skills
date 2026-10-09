# Load Balancer And Ingress Troubleshooting

Use this guide when AKS networking symptoms point at Azure load balancer provisioning, ingress controller behavior, or backend routing.

## Load Balancer Stuck In Pending

**Diagnostics:**

```bash
kubectl describe svc <svc> -n <ns>
# Events section reveals the actual Azure error

kubectl logs -n kube-system -l component=cloud-controller-manager --tail=100
```

**Error decision table:**

| Error in Events / CCM Logs                             | Cause                                  | Fix                                                                          |
| ------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------- |
| `InsufficientFreeAddresses`                            | Subnet has no free IPs                 | Expand subnet CIDR; use Azure CNI Overlay; use NAT gateway instead           |
| `ensure(default/svc): failed... PublicIPAddress quota` | Public IP quota exhausted              | Request quota increase for Public IP Addresses in the region                 |
| `cannot find NSG`                                      | NSG name changed or detached           | Re-associate NSG to the AKS subnet; check `az aks show` for NSG name         |
| `reconciling NSG rules: failed`                        | NSG is locked or has conflicting rules | Remove resource lock; check for deny-all rules above AKS-managed rules       |
| `subnet not found`                                     | Wrong subnet name in annotation        | Verify subnet name: `az network vnet subnet list -g <rg> --vnet-name <vnet>` |
| No events, stuck Pending                               | CCM can't authenticate to Azure        | Check cluster managed identity access on the VNet resource group             |

---

## Ingress Not Routing Traffic

**Diagnostics:**

```bash
# Confirm controller is running
kubectl get pods -n <ingress-ns> -l 'app.kubernetes.io/name in (ingress-nginx,nginx-ingress)'
kubectl logs -n <ingress-ns> -l app.kubernetes.io/name=ingress-nginx --tail=100

# Check the ingress resource state
kubectl describe ingress <name> -n <ns>
kubectl get ingress <name> -n <ns>

# Check backend
kubectl get endpoints <backend-svc> -n <ns>
```

**Ingress failure patterns:**

| Symptom                          | Cause                                          | Fix                                                          |
| -------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| ADDRESS empty                    | LB not provisioned or wrong `ingressClassName` | Check controller service; set correct `ingressClassName`     |
| 404 for all paths                | No matching host rule                          | Check `host` field; `pathType: Prefix` vs `Exact`            |
| 404 for some paths               | Trailing slash mismatch                        | `Prefix /api` matches `/api/foo` not `/api` - add both       |
| 502 Bad Gateway                  | Backend pods unhealthy or wrong port           | Verify Endpoints has IPs; confirm `targetPort` and readiness |
| 503 Service Unavailable          | All backend pods down                          | Check pod restarts and readiness probe                       |
| TLS handshake fail               | cert-manager not issuing                       | Check certificate status and ACME challenge                  |
| Works for host-a, 404 for host-b | DNS not pointing to ingress IP                 | Verify `nslookup <host>` resolves to the ingress address     |

---

## Azure Load Balancer: Probe or Outbound Failure

Map the Service to the managed load balancer in the AKS node resource group,
then inspect the exact rule, probe, backend pool, and outbound rule:

```bash
kubectl get svc <svc> -n <ns> -o yaml
NODE_RG=$(az aks show -g <cluster-rg> -n <cluster> \
  --query nodeResourceGroup -o tsv)
az network lb list -g "$NODE_RG" \
  --query '[].{name:name,sku:sku.name,frontends:frontendIPConfigurations[].privateIPAddress}' \
  -o table
az network lb rule list -g "$NODE_RG" --lb-name <lb> -o json
az network lb probe list -g "$NODE_RG" --lb-name <lb> -o json
az network lb address-pool list -g "$NODE_RG" --lb-name <lb> -o json
az network lb outbound-rule list -g "$NODE_RG" --lb-name <lb> -o json
```

| Evidence | Interpretation |
|---|---|
| `externalTrafficPolicy: Local` | The probe uses the Service's `healthCheckNodePort`; only nodes with local ready endpoints should pass |
| Probe port/path differs from Service health behavior | The Azure backend can be unhealthy while ClusterIP traffic works |
| Effective NSG denies `AzureLoadBalancer` on the probe port | Probe traffic cannot mark the node healthy |
| No outbound rule and cluster `outboundType` is not load balancer | Do not diagnose LB SNAT; follow the configured NAT gateway or UDR path |
| Failed SNAT metrics in the incident window | Supports exhaustion; node count or connection volume alone does not |

For an inbound Service whose backend replies follow a UDR to Azure Firewall or
an NVA, check for asymmetric routing: a stateful appliance or load balancer that
sees only one direction can drop the flow. Use
[references/azure-network-path.md](references/azure-network-path.md).

Sources: [AKS service health-probe modes](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/availability-performance/cluster-service-health-probe-mode-issues)
and [AKS SNAT exhaustion](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/connectivity/snat-port-exhaustion).

---

## Application Gateway / AGIC 502

Do not infer a probe error from the Ingress manifest alone. Read Application
Gateway's live backend reason first, then correlate it with AGIC reconciliation
and Kubernetes endpoints:

```bash
az network application-gateway show-backend-health \
  -g <appgw-rg> -n <appgw-name> -o json
az network application-gateway probe list \
  -g <appgw-rg> --gateway-name <appgw-name> -o json
az network application-gateway http-settings list \
  -g <appgw-rg> --gateway-name <appgw-name> -o json
kubectl get ingress <ingress> -n <ns> -o yaml
kubectl get service,endpoints,endpointslice -n <ns>
# AKS add-on labels AGIC app=ingress-appgw; Helm installs use app=ingress-azure
kubectl get pods -A -l 'app in (ingress-appgw,ingress-azure)' -o wide
```

| Backend-health reason | Next evidence |
|---|---|
| Timeout / cannot connect | AKS endpoint readiness, backend port, App Gateway-subnet-to-AKS NSG and UDR |
| Status code mismatch | Probe host/path and accepted status range versus the actual backend response |
| DNS resolution failure | Resolver path visible to the Application Gateway VNet, not only pod DNS |
| Certificate / hostname failure | Backend HTTP settings host name, SNI, certificate SAN, chain, and trusted root |
| Healthy, but reported 502 | Incident-window access/metrics evidence; request timestamp, client IP, host, and path rather than inventing a transient cause |

If AGIC is absent, restarting, or logging authorization/resource lookup errors,
separate controller reconciliation from the Application Gateway data plane.
Role changes, probe changes, and App Gateway updates require explicit approval.

Sources: [Application Gateway backend health](https://learn.microsoft.com/azure/application-gateway/application-gateway-backend-health)
and [AGIC connectivity troubleshooting](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/load-bal-ingress-c/troubleshoot-app-gateway-ingress-controller-connectivity-issues).
