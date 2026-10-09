# AKS Troubleshooting Guide

Primary AKS troubleshooting guide for incidents routed from [../../SKILL.md](../../SKILL.md).

## When to Use This Guide

- lifecycle, access, node, `kube-system`, workload, ingress, DNS, or scaling issues
- `kubectl` cannot connect, nodes are `NotReady`, or pods are unhealthy

## Scenario Playbooks

| Scenario                                                      | Reference                                        |
| ------------------------------------------------------------- | ------------------------------------------------ |
| broad cluster investigation                                   | [general-diagnostics.md](general-diagnostics.md) |
| workload, crash, image pull, readiness, or pending pod issues | [pod-failures.md](pod-failures.md)               |
| node health, scaling, pressure, upgrade, or zone issues       | [node-issues.md](node-issues.md)                 |
| service, ingress, DNS, or network policy issues               | [networking.md](networking.md)                   |

## Tool Selection For Diagnostics

When gathering AKS diagnostic evidence, use the host-assigned Azure MCP AKS area for cluster and node-pool metadata, then separate Azure MCP areas such as AppLens, Monitor, or Resource Health when their advertised schemas fit the read. Use `az aks` and `kubectl` for every check those surfaces do not provide, including all Kubernetes-side inspection; the AKS area does not run `kubectl`.

When standard diagnostics do not reveal root cause, use **Inspektor Gadget** for real-time, low-level node and pod observability (DNS traces, TCP traces, process snapshots, file access traces). See [references/inspektor-gadget.md](references/inspektor-gadget.md) for the gadget catalog, the `run-ig` script, and symptom-to-gadget mapping.

See [references/aks-mcp.md](references/aks-mcp.md), [references/structured-input-modes.md](references/structured-input-modes.md), [references/command-flows.md](references/command-flows.md)

The optional, consent-gated `aks-skills` add-on is handled by the Workflow's
focused-skill checkpoint below; this baseline guide remains usable when it is
not installed or cannot execute.

## Required Inputs

- subscription or active Azure context
- resource group and cluster name
- symptom summary
- first observed time or recent change window
- impacted namespace, workload, service, or ingress when known

If cluster identity is missing and no `kubectl` context is active, don't stop and ask
immediately. Resolve the subscription from the request or confirmed existing context.
If none is known, list accessible subscriptions and ask the user to select one; don't
scan AKS resources across every subscription automatically. Run `az aks list
--subscription <subscription-id>` in the selected subscription. If exactly one cluster
is found, establish context with `az aks get-credentials --subscription
<subscription-id> --resource-group <resource-group> --name <cluster-name>`, then use the
relevant script's discovery/auto-select mode (e.g. `pod-evidence.sh --all-failing`). If
zero or multiple clusters are found, ask the user to identify the target. If
`kubectl` already has an active context, verify that its cluster matches the incident
before collecting evidence. Use the context only when the user confirms it or its
cluster/subscription/resource-group matches known incident details; otherwise ask which
cluster to use. After confirmation, use the script's discovery/auto-select mode and ask
for remaining details only if discovery comes up empty.

## Scope Buckets

- Lifecycle: create, update, start, stop, upgrade, or provisioning failures
- API access: kubeconfig, auth, private endpoint, DNS, or reachability problems
- Nodes: missing nodes, `NotReady`, pressure, CNI, kubelet, certificate, or VMSS drift
- `kube-system`: CoreDNS, metrics-server, konnectivity, ingress, CNI, CSI, or add-on failures
- Workloads: `Pending`, `CrashLoopBackOff`, `OOMKilled`, PVC, quota, secret, readiness, or dependency issues
- Connectivity and DNS: pod -> service -> endpoints -> ingress/load balancer -> DNS -> network controls
- Scaling: node pool sizing, pending pods, autoscaler config, metrics, quota, or subnet constraints

## Evidence Order

1. The classified symptom selects the first read. For lifecycle, API-access, node, scaling, quota, upgrade, or broad and unclassified symptoms, start Azure-side: cluster state, resource health, recent operations, node pool state, detector or monitoring output.
2. For a clearly identified workload failure (a named pod in `CrashLoopBackOff`, `ImagePullBackOff`, `OOMKilled`, or a similar pod-local state), start with pod state, events, and current/previous logs — supplied or collected — then expand to node and Azure evidence only as the causal branch requires; no broad Azure sweep first. Otherwise Kubernetes-side state follows the Azure-side read: reachability, nodes, `kube-system`, events, affected namespace, pod detail, logs.
3. Use detector, warning-event, or metrics modes when the incoming data already matches them.
4. Deep diagnostics; when the symptom-relevant checks above do not reveal root cause, use [inspektor-gadget.md](references/inspektor-gadget.md) for real-time tracing on the affected node.

## Workflow

1. Get cluster context.
2. Classify the problem by scope bucket.
3. Focused-skill checkpoint. For any incident in the Scope Buckets above,
   complete the handoff in [optional-aks-operations.md](optional-aks-operations.md)
   once before gathering evidence: check the host's available-skill inventory;
   use the focused skill if present; if it is missing and deeper investigation
   would materially help the current task, make one offer and ask before
   installing — never install merely to interpret supplied evidence that
   already answers the task; if the customer declines or the host cannot
   install or execute it, continue with this guide and do not ask again. An
   application-level cause (for example a `CrashLoopBackOff` from bad config)
   does not exempt an AKS workload incident from this checkpoint.
4. Follow the Evidence Order above.
5. Use the matching Azure MCP area for Azure-side metadata where its schema fits, then the documented `az`/`kubectl` flows for everything else.
6. Return evidence, failure domain, confidence, next checks, remediation, and escalation.

## Error Patterns

- No cluster context: ask for subscription, resource group, and cluster name.
- MCP unavailable: fall back to safe `az aks` and `kubectl` reads.
- `kubectl` blocked: separate auth problems from network reachability.
- Logs or metrics missing: use events, node state, and resource descriptions.
- Detector noise: ignore `emergingIssues`, prefer critical findings, rank the most actionable signal first.

## Safe Fallback Checks

When the Azure MCP areas cannot perform the baseline read, run the **[`aks-baseline`](../../scripts/aks-baseline.sh)** script. It executes the read-only cluster + Kubernetes baseline sweep (provisioning state, node pools, activity log, node readiness, unhealthy pods, kube-system health, warning events) and returns a single labeled digest:

```bash
# bash
./scripts/aks-baseline.sh -g <resource-group> -n <cluster-name> [--namespace <namespace>]
```

```powershell
# PowerShell
.\scripts\aks-baseline.ps1 -ResourceGroup <resource-group> -Cluster <cluster-name> [-Namespace <namespace>]
```

For unhealthy pods, go straight to the pod-evidence script rather than running
`describe`/`logs`/`top` one at a time — it gathers the full read-only evidence bundle
(describe, current + previous logs, resources vs usage) in a single call:
[`../../scripts/pod-evidence.sh`](../../scripts/pod-evidence.sh) /
[`../../scripts/pod-evidence.ps1`](../../scripts/pod-evidence.ps1). If the pod name isn't
known yet, use `--all-failing` to auto-discover it instead of asking the user for it:

```bash
../../scripts/pod-evidence.sh <pod-name> -n <namespace>
../../scripts/pod-evidence.sh --all-failing
```
```powershell
../../scripts/pod-evidence.ps1 <pod-name> -Namespace <namespace>
../../scripts/pod-evidence.ps1 -AllFailing
```

See [pod-failures.md](pod-failures.md) for how to interpret the digest.

Only fall back to the individual commands below if the bundled script is unavailable or
you need a check it doesn't cover. If `kubectl` is missing or unconfigured, install or
configure it before running Kubernetes-side checks:

```bash
az aks show -g <resource-group> -n <cluster-name>
az aks nodepool list -g <resource-group> --cluster-name <cluster-name>
kubectl cluster-info
kubectl get nodes -o wide
kubectl get pods -n kube-system
kubectl get events -A --sort-by=.lastTimestamp
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace> --previous
```

Keep these read-only unless the user explicitly asks for remediation.

## Guardrails

- default to read-only diagnostics
- do not restart, delete, cordon, drain, scale, upgrade, or reconfigure resources unless the user explicitly asks for remediation
- do not conclude root cause without quoting the evidence that supports it

## Output Checklist

Return scope and impact, evidence, failure domain, root cause, confidence, next checks, remediation, and escalation. State once which focused optional AKS skill applied and its status: used, offered and awaiting consent, installed but not yet active, declined, or not available on this host.
