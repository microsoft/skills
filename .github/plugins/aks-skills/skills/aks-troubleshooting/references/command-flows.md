# AKS Command Flows

## Cluster Baseline Flow

```text
Resolve subscription -> resolve resource group -> resolve cluster -> inspect cluster state -> inspect node pools -> inspect resource health -> inspect recent operations
```

Portable target-bound fallback for cluster metadata and Kubernetes state:

```bash
AKS_SUBSCRIPTION_ID=<subscription-id> \
  scripts/cluster-snapshot.sh <resource-group> <cluster-name> <kube-context>
```

Gather resource health and recent Azure operations before this Kubernetes phase.

## Kubernetes Baseline Flow

```text
Check API reachability -> inspect nodes -> inspect kube-system -> inspect events -> inspect affected namespace -> inspect pod details and logs
```

The snapshot verifies the kube endpoint before any Kubernetes API read. Use the pod collector for the final pod-detail/log phase:

```bash
AKS_SUBSCRIPTION_ID=<subscription-id> \
  scripts/pod-deep-dive.sh \
  <namespace> <pod-name> <resource-group> <cluster-name> <kube-context> \
  <artifacts-directory>
```

## Connectivity Flow

```text
pod -> service -> endpoints -> ingress or load balancer -> DNS -> network controls
```

Portable Kubernetes CLI flow:

```bash
kubectl get pods -n <namespace> -o wide
kubectl get svc -n <namespace>
kubectl get endpoints -n <namespace>
kubectl get ingress -n <namespace>
kubectl describe ingress <ingress-name> -n <namespace>
```

## Detector Flow

Use the separately advertised Azure MCP AppLens area when available; this is not part of the Azure MCP AKS metadata area.

```text
resolve cluster resource ID -> list detectors or choose category -> select a focused time window -> run the detector or category -> rank critical findings above warnings -> ignore emerging issues when choosing the primary root cause
```

## Monitoring Flow

Use separately advertised Azure MCP Monitor and Resource Health areas when available, or their Azure CLI equivalents.

```text
check resource health -> inspect metrics -> verify diagnostics settings -> inspect control plane logs if available -> correlate with Application Insights or namespace symptoms
```

## Scheduling Flow

```text
pod events -> node capacity -> taints and tolerations -> affinity rules -> PVC state -> quotas
```

Portable Kubernetes CLI flow:

```bash
kubectl describe pod <pod-name> -n <namespace>
kubectl get nodes -o wide
kubectl describe node <node-name>
kubectl get pvc -n <namespace>
kubectl describe quota -n <namespace>
```

## Deep Diagnostics Flow (Inspektor Gadget)

```text
Standard diagnostics inconclusive -> prove the AKS/kube target -> select one symptom-specific gadget -> obtain privileged-debug approval -> run the digest-pinned command with finite bounds -> clean up the exact debug pod -> correlate output with prior evidence
```

Use when the standard checks relevant to the symptom do not reveal root cause; collect Azure-side, Kubernetes-side, or detector evidence as the investigation requires, not in a mandatory cross-platform sequence. See [inspektor-gadget.md](inspektor-gadget.md) for the pinned command pattern and gadget catalog.

## Safety Boundary

Treat the following as change operations and avoid them unless the user explicitly asks for remediation:

- deleting or restarting pods
- cordon and drain operations
- scaling workloads or node pools
- cluster upgrade operations
- DNS, route, NSG, or firewall changes
