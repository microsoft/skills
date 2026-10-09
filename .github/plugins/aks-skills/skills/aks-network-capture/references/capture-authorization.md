# Capture authorization and target binding

Selecting packet capture or asking where packets drop is not approval to create
resources. Before setup, capture, generated traffic, a debug container, or
retrieval:

1. Bind the current kube context to the named AKS resource. Compare the
   context's API endpoint and cluster identity with `az aks show`; a context
   name is not an Azure resource ID.
2. Confirm selected nodes or pods, namespace, endpoints, BPF filter, duration,
   and whether packet payloads rather than headers can be captured.
3. Confirm the local artifact destination and authorized readers. Captures can
   contain credentials and customer data.
4. List every planned ConfigMap, capture Job, retrieval pod, generated traffic
   stream, debug container, and file, plus run-ID-scoped cleanup.
5. Proceed only after explicit approval for that plan.

If direct pod exec fails, stop and present the pinned ephemeral debug container
as a separate decision. Use `--allow-debug-container` (Bash) or
`-AllowDebugContainer` (PowerShell) only after approval; never escalate
automatically.

Retrieve and delete only resources carrying the exact capture run ID. Report
cleanup failures rather than widening deletion to other capture resources.

Sources: [AKS support policies](https://learn.microsoft.com/azure/aks/support-policies)
and [Kubernetes ephemeral-container debugging](https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/#ephemeral-container).
