# GPU workload scaling versus node-pool scaling

Treat these as separate control loops.

| Loop | Scales | Evidence |
|---|---|---|
| KEDA with DCGM and Managed Prometheus | Workload replicas through an HPA | `ScaledObject`, HPA conditions, external metric, target workload |
| AKS node scaling | GPU node-pool capacity | Observed `gpuProfile`, autoscaler setting, pool state, Pending demand |

For KEDA diagnosis, read without mutation:

```bash
kubectl get scaledobject -n <namespace> <name> -o yaml
kubectl describe hpa -n <namespace> <hpa>
kubectl get --raw \
  '/apis/external.metrics.k8s.io/v1beta1/namespaces/<namespace>/<metric>'
```

Confirm that the Prometheus query selects the intended workload and that the
HPA reports `AbleToScale` and `ScalingActive`. KEDA responding to
`DCGM_FI_DEV_GPU_UTIL` changes pod replicas; it does not prove that a GPU node
can be provisioned.

Before discussing node capacity, read `gpuProfile` and
`enableAutoScaling`. Managed GPU preview node pools do not support cluster
autoscaler, so do not recommend cluster-autoscaler scale-to-zero for that
profile. For driver-only or BYO pools, diagnose the observed node-scaling
configuration separately from KEDA.

Do not enable KEDA, monitoring, or autoscaling, and do not scale a workload or
pool, without explicit authorization. Route generic cost analysis to
`cost-analysis` from the optional `azure-cost` plugin; if it is unavailable,
direct the user to their client's supported plugin installation flow.

Source:
[KEDA and DCGM workload autoscaling](https://learn.microsoft.com/azure/aks/autoscale-gpu-workloads-with-keda).
