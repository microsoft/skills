# AKS known-issue catalog

Match the exact signature **and** AKS operation context. Every answer must include,
in order: the match and cause; citation; **Read-only verification (not run)**;
and **Proposed fix (requires explicit user approval)**. Never present a mutation
without that gate.

## VM extension and CSE provisioning

The outer `VMExtensionProvisioningError` or a number alone is insufficient; a
numeric exit requires AKS `vmssCSE`/CSE context.

| Signature | Cause | Verify, then documented fix | Microsoft Learn |
|---|---|---|---|
| `VMExtensionError_OutboundConnFail`, `ERR_OUTBOUND_CONN_FAIL`, or exit **50** | CSE cannot reach endpoints needed for node packages | Test `mcr.microsoft.com:443`; inspect firewall, proxy, NSG, UDR, and AKS egress rules; correct the blocking path | [OutboundConnFail](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/error-codes/vmextensionerror-outboundconnfail) |
| `VMExtensionError_K8SAPIServerConnFail`, `ERR_K8S_API_SERVER_CONN_FAIL`, or exit **51** | Node cannot reach the API server on TCP 443 | Test the API FQDN on 443; inspect NSG, UDR, firewall/proxy, authorized IPs, private endpoint, and TLS inspection; correct the failing path | [APIServerConnFail](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/error-codes/vmextensionerror-k8sapiserverconnfail) |
| `VMExtensionError_K8SAPIServerDNSLookupFail`, `ERR_K8S_API_SERVER_DNS_LOOKUP_FAIL`, or exit **52** | Node cannot resolve the API-server FQDN | Resolve the FQDN and inspect DNS port 53, forwarders, and private-zone records/links; correct DNS | [APIServerDNSLookupFail](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/error-codes/vmextensionerror-k8sapiserverdnslookupfail) |

## Node-pool provisioning and allocation

| Signature | Cause | Verify, then documented fix | Microsoft Learn |
|---|---|---|---|
| `VMCannotFitEphemeralOSDisk` | Requested ephemeral OS disk exceeds the SKU cache/temp capacity | Compare disk size with SKU storage; choose a fitting SKU, smaller disk, or managed disk. Type and size require a new pool | [Ephemeral OS disks](https://learn.microsoft.com/azure/aks/concepts-storage#ephemeral-os-disks-in-aks) |
| AKS node-pool `SkuNotAvailable` naming size, location, and zone | SKU is unavailable for that subscription and placement; Spot capacity can also cause it | Inspect `az vm list-skus`; choose another size, zone, or region, or request SKU access. Do not call it quota exhaustion | [SkuNotAvailable](https://learn.microsoft.com/azure/azure-resource-manager/troubleshooting/error-sku-not-available) |
| AKS `ZonalAllocationFailed` stating insufficient capacity in a zone | Requested placement lacks capacity; a proximity placement group can constrain it | Check PPG association; use another SKU, zone, region, or pool. For upgrades, consider `maxUnavailable` with `maxSurge=0` | [AKS allocation errors](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/error-codes/zonalallocation-allocationfailed-error) |
| AKS `OverconstrainedAllocationRequest` listing constraints | The named SKU, networking, zone, disk, or PPG combination cannot allocate | Read the listed constraints; relax only a named constraint or choose another placement | [AKS allocation errors](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/error-codes/zonalallocation-allocationfailed-error) |
| AKS `AllocationFailed`: `The VM allocation failed due to an internal error` | Internal allocation error | Confirm the failed operation and full message read-only; only after approval, retry later or deploy elsewhere. Do not recast it as quota or capacity | [AKS AllocationFailed](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/error-codes/zonalallocation-allocationfailed-error) |
| AKS/backing VMSS `AllocationFailed` stating insufficient regional capacity | Requested regional placement lacks VM capacity | Confirm the full message; retry later or use another SKU, zone, region, or pool | [VMSS allocation failures](https://learn.microsoft.com/troubleshoot/azure/virtual-machine-scale-sets/deploy/allocationfailed-or-zonalallocationfailed) |

## Images and upgrades

| Signature | Cause | Verify, then documented fix | Microsoft Learn |
|---|---|---|---|
| `NodeImageVersion ... is not accepted` and says only current or `latest` is allowed | Snapshot/rollback-pinned pool requested another image | Compare current and requested images; run a node-image-only upgrade without `--snapshot-id` to use the latest supported image | [Node-pool snapshots](https://learn.microsoft.com/azure/aks/node-pool-snapshot#upgrading-a-node-pool-to-a-snapshot) |
| `NodePoolMcVersionIncompatible` | Pool is over two minor versions behind, or newer than the control plane | Read both versions and available upgrades; only after approval, upgrade within two minors without exceeding the control plane | [NodePoolMcVersionIncompatible](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/error-codes/nodepoolmcversionincompatible-error) |
| `K8sVersionNotSupported` during AKS upgrade | Target version is unsupported in the region | Read supported versions and choose one offered in that region | [AKS upgrade blocked](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/error-codes/aks-upgrade-blocked) |
| `OperationNotAllowed` stating the requested upgrade is unavailable | Requested path skips a required minor version | Read available upgrades and upgrade through supported minor versions | [AKS upgrade blocked](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/error-codes/aks-upgrade-blocked) |

## Identity and image pulls

| Signature | Cause | Verify, then documented fix | Microsoft Learn |
|---|---|---|---|
| AKS create/deploy `LinkedAuthorizationFailed` naming a linked scope and action | Deployment identity lacks that action on the linked resource | Read the identity, action, scope, and assignments; grant the required role at the linked scope | [LinkedAuthorizationFailed](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/error-codes/linkedauthorizationfailed-error) |
| Network-isolated AKS `OrasPullUnauthorizedVMExtensionError` / CSE exit **212** | Kubelet identity lacks bootstrap ACR pull access or VM binding | Inspect logs, identity binding, and ACR roles; assign `AcrPull` or the ABAC repository-reader role as applicable | [OrasPullUnauthorized](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/error-codes/vmextensionerror-oraspullunauthorized) |
| AKS pod image pull `401 Unauthorized` / `failed to authorize` from ACR | Kubelet identity, service principal, or pull secret lacks registry authorization | Inspect pod events and `az aks check-acr`; correct the applicable ACR role or credential | [AKS image-pull errors](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/connectivity/cannot-pull-image-from-acr-to-aks-cluster) |
