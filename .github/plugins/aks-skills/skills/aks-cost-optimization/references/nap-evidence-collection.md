# NAP Evidence Collection

Prefer Azure MCP AKS reads. Fallbacks require approved shell access and
`kubectl` requires a target-bound context.

## Cluster and Pools

```bash
az aks show \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --query "{id:id,location:location,sku:sku.name,mode:nodeProvisioningProfile.mode,identityType:identity.type,network:{plugin:networkProfile.networkPlugin,pluginMode:networkProfile.networkPluginMode,dataplane:networkProfile.networkDataplane,policy:networkProfile.networkPolicy,ipFamilies:networkProfile.ipFamilies,loadBalancerSku:networkProfile.loadBalancerSku},agentPools:agentPoolProfiles[].{name:name,mode:mode,os:osType,sku:vmSize,cas:enableAutoScaling,min:minCount,max:maxCount,count:count,zones:availabilityZones,subnet:vnetSubnetId,podSubnet:podSubnetId,podIpAllocationMode:podIpAllocationMode,labels:nodeLabels,taints:nodeTaints}}" -o json
```

## Scheduling State

Start with an identified namespace; otherwise discover it from projected
`FailedScheduling` events. Query pending pods per namespace and nodes only for
relevant pools. Report covered namespaces and pools.

```bash
kubectl get events --all-namespaces \
  --field-selector reason=FailedScheduling \
  -o custom-columns="LAST_SEEN:.lastTimestamp,NAMESPACE:.metadata.namespace,OBJECT:.involvedObject.name,MESSAGE:.message"

kubectl get pods -n "<NAMESPACE>" \
  --field-selector=status.phase=Pending \
  -o custom-columns="NAME:.metadata.name,OWNER_KIND:.metadata.ownerReferences[0].kind,OWNER_NAME:.metadata.ownerReferences[0].name,REQUESTS:.spec.containers[*].resources.requests,INIT_REQUESTS:.spec.initContainers[*].resources.requests,OVERHEAD:.spec.overhead,NODE_SELECTOR:.spec.nodeSelector,AFFINITY:.spec.affinity,TOLERATIONS:.spec.tolerations,TOPOLOGY_SPREAD:.spec.topologySpreadConstraints,PVCS:.spec.volumes[*].persistentVolumeClaim.claimName"

kubectl get nodes -l "kubernetes.azure.com/agentpool=<POOL>" \
  -o custom-columns="NAME:.metadata.name,SKU:.metadata.labels.node\.kubernetes\.io/instance-type,ZONE:.metadata.labels.topology\.kubernetes\.io/zone,CPU:.status.allocatable.cpu,MEMORY:.status.allocatable.memory,PODS:.status.allocatable.pods,TAINTS:.spec.taints"
```

Retrieve conditions, extended resources, owners, or storage objects only for
identified constraints. Never retrieve full nodes. Report covered and omitted
scope.

## Scheduling History

Discover the available metric and its aggregation before querying:

```bash
az monitor metrics list-definitions --resource "<AKS_RESOURCE_ID>" \
  --query "[].{name:name.value,aggregation:primaryAggregationType}" -o json

az monitor metrics list --resource "<AKS_RESOURCE_ID>" \
  --metrics "<DISCOVERED_UNSCHEDULABLE_METRIC>" \
  --start-time "<START_TIME>" --end-time "<END_TIME>" \
  --interval PT1H --aggregation "<PRIMARY_AGGREGATION>" -o json
```

## Conditional Readiness

Run only checks for an unresolved readiness question:

| Question | Minimal read and use |
|---|---|
| VM compatibility | Derive candidate families/sizes from workload fit and current pools. Query each with `az vm list-skus --location "<LOCATION>" --resource-type virtualMachines --size "<SIZE_OR_FAMILY>" --query "[].{name:name,zones:locationInfo[0].zones,capabilities:capabilities,restrictions:restrictions}" -o json`. Record queried sizes; add `--all` only when unavailable-SKU restrictions must be inspected |
| Quota headroom | `az vm list-usage --location "<LOCATION>" -o json`; check regional and family vCPU quota, plus Spot when proposed |
| Subnet capacity or access | `az network vnet subnet show --ids "<SUBNET_ID>" -o json`; verify growth and inspect identity access only when unresolved |
| Policy restriction | Inspect only the relevant definition and parameters at the affected scope |
| Volume topology | Read only referenced PVCs, StorageClasses, and bound PVs; exclude failures that another node cannot resolve |

SKU eligibility does not guarantee supply. Missing or inaccessible evidence remains unknown.
