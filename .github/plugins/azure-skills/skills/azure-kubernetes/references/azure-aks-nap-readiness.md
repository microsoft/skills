# Base NAP Readiness

Use this limited readiness check when `aks-cost-optimization` is unavailable or
declined. The optional skill provides deeper workload-fit, alternatives, cost,
and migration analysis.

## Collect Cluster State and Choose the Workflow

Prefer a fitting Azure MCP AKS read. If unavailable and shell access is
approved, collect only the required fields:

```bash
az aks show \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --query "{sku:sku.name,mode:nodeProvisioningProfile.mode,identity:identity.type,outboundType:networkProfile.outboundType,network:{plugin:networkProfile.networkPlugin,pluginMode:networkProfile.networkPluginMode,dataplane:networkProfile.networkDataplane,policy:networkProfile.networkPolicy,ipFamilies:networkProfile.ipFamilies,loadBalancerSku:networkProfile.loadBalancerSku},pools:agentPoolProfiles[].{name:name,os:osType,cas:enableAutoScaling,min:minCount,max:maxCount,count:count,subnet:vnetSubnetId,podSubnet:podSubnetId,podIpAllocationMode:podIpAllocationMode}}" \
  -o json
```

- If mode is `Auto`, NAP is already enabled; do not rerun enablement readiness.
- For a Standard cluster without NAP, present two assessment paths: use the
  checks below for existing-cluster NAP eligibility, or invoke
  `azure-kubernetes-automatic-readiness` when available for AKS Automatic
  migration compatibility. AKS Automatic is preferred for most production
  workloads.

## Check Eligibility

Do not recommend NAP for Windows pools, IPv6, service-principal identity, Basic
Load Balancer in a custom VNet, kubenet, Calico network policy, or Azure CNI Pod
Subnet with dynamic individual IP allocation.

Confirm acceptance that NAP removes cluster stop/start support and constrains
outbound-type changes.

If CAS is enabled, do not recommend NAP through this base workflow. Invoke
`aks-cost-optimization` when available to compare CAS tuning with a controlled
CAS-to-NAP migration. Otherwise, explain that migration requires either
disabling CAS first or a temporary, explicitly approved side-by-side transition
using the subscription-wide `AllowClusterAutoscalerAndNAP` feature and mutually
exclusive scheduling. State that neither migration path was assessed here.

## Decide

This base workflow assesses configuration eligibility only. If no blocker is
found, configuration eligibility alone does not justify NAP enablement; 
report the cluster as potentially eligible and identify workload-fit and 
cost analysis as missing. Require explicit approval before NAP
enablement.