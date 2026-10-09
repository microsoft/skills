# AKS Command Flows

## Cluster Baseline Flow

```text
Resolve subscription -> resolve resource group -> resolve cluster -> inspect cluster state -> inspect node pools -> inspect resource health -> inspect recent operations
```

Portable flow (the Azure MCP AKS area covers cluster and node-pool metadata only) — run the **[`aks-baseline`](../../../scripts/aks-baseline.sh)** script, which gathers cluster state, node pools, and recent operations as one read-only digest:

```bash
# bash
./scripts/aks-baseline.sh -g <resource-group> -n <cluster-name>
```

```powershell
# PowerShell
.\scripts\aks-baseline.ps1 -ResourceGroup <resource-group> -Cluster <cluster-name>
```

## Kubernetes Baseline Flow

```text
Check API reachability -> inspect nodes -> inspect kube-system -> inspect events -> inspect affected namespace -> inspect pod details and logs
```

Portable Kubernetes flow (no MCP area runs `kubectl`) — the same **[`aks-baseline`](../../../scripts/aks-baseline.sh)** script also covers node readiness, unhealthy pods, kube-system health, and recent warning events. Pass `--namespace` to include an affected namespace, then deep-dive on a specific pod:

```bash
kubectl cluster-info
kubectl get nodes -o wide
kubectl get pods -n kube-system
kubectl get events -A --sort-by=.lastTimestamp
kubectl get pods -n <namespace>
```

For pod detail and logs, gather the read-only evidence bundle (describe, current + previous logs, resources vs usage) with the pod-evidence script — [`../../../scripts/pod-evidence.sh`](../../../scripts/pod-evidence.sh) / [`../../../scripts/pod-evidence.ps1`](../../../scripts/pod-evidence.ps1):

```bash
../../../scripts/pod-evidence.sh <pod-name> -n <namespace>
../../../scripts/pod-evidence.sh --all-failing
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace> --previous
```
```powershell
../../../scripts/pod-evidence.ps1 <pod-name> -Namespace <namespace>
../../../scripts/pod-evidence.ps1 -AllFailing
```

```powershell
# PowerShell
.\scripts\aks-baseline.ps1 -ResourceGroup <resource-group> -Cluster <cluster-name> -Namespace <namespace>
```

## Connectivity Flow

```text
pod -> service -> endpoints -> ingress or load balancer -> DNS -> network controls
```

Portable Kubernetes flow:

```bash
kubectl get pods -n <namespace> -o wide
kubectl get svc -n <namespace>
kubectl get endpoints -n <namespace>
kubectl get ingress -n <namespace>
kubectl describe ingress <ingress-name> -n <namespace>
```

## Detector Flow

```text
resolve cluster resource ID -> list detectors or choose category -> select a focused time window -> run the detector or category -> rank critical findings above warnings -> ignore emerging issues when choosing the primary root cause
```

## Monitoring Flow

```text
check resource health -> inspect metrics -> verify diagnostics settings -> inspect control plane logs if available -> correlate with Application Insights or namespace symptoms
```

## Scheduling Flow

```text
pod events -> node capacity -> taints and tolerations -> affinity rules -> PVC state -> quotas
```

Portable Kubernetes flow:

```bash
kubectl describe pod <pod-name> -n <namespace>
kubectl get nodes -o wide
kubectl describe node <node-name>
kubectl get pvc -n <namespace>
kubectl describe quota -n <namespace>
```

## Deep Diagnostics Flow (Inspektor Gadget)

```text
Standard diagnostics inconclusive -> select gadget from symptom-to-gadget map -> run `scripts/run-ig.sh` (or `run-ig.ps1`; resolves node, applies timeout) -> interpret output -> correlate with prior evidence
```

Use when the standard checks relevant to the symptom do not reveal root cause; collect Azure-side, Kubernetes-side, or detector evidence as the investigation requires, not in a mandatory cross-platform sequence. See [inspektor-gadget.md](inspektor-gadget.md) for the full gadget catalog and command patterns.

## Safety Boundary

Treat the following as change operations and avoid them unless the user explicitly asks for remediation:

- deleting or restarting pods
- cordon and drain operations
- scaling workloads or node pools
- cluster upgrade operations
- DNS, route, NSG, or firewall changes
