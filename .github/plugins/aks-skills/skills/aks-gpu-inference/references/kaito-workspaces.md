# KAITO Workspace Day-2 readiness

This is diagnosis only. Route add-on enablement, Workspace creation, model
selection, and provider selection to `airunway-aks-setup`.

## Read-only evidence

```bash
kubectl get workspace <workspace> -o yaml
kubectl describe workspace <workspace>
az aks show --subscription <subscription> -g <resource-group> -n <cluster> \
  --query '{id:id,location:location,provisioningState:provisioningState}' -o json
az vm list-usage --location <region> -o json
az vm list-skus --location <region> --resource-type virtualMachines \
  --all -o json
```

Microsoft Learn says machine readiness can take up to 10 minutes and Workspace
readiness up to 20 minutes depending on model size. After the observed duration
exceeds the applicable documented window, use only status and conditions
reported by the Workspace, including documented `ResourceReady`,
`InferenceReady`, and `WorkspaceSucceeded` when present. Do not invent
NodeClaim, controller-log, or private condition chains.

Correlate a not-ready status with:

1. exact GPU-family quota usage and limit in the AKS region; and
2. exact Workspace GPU instance type availability or restrictions in that
   region.

If neither is decisive, preserve the status, timestamps, region, instance type,
and missing evidence, then hand off to the cluster/quota owner or Azure Support.

Deleting a Workspace does not remove GPU node pools provisioned for it;
Microsoft Learn requires those pools to be found and deleted manually. Present
Workspace deletion and each pool deletion as separate charged-resource
mutations, explain the cleanup dependency, and wait for explicit authorization.
Do not stop/start the cluster as a diagnostic action.

Source:
[AI toolchain operator](https://learn.microsoft.com/azure/aks/ai-toolchain-operator).
