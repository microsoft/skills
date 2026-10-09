# General AKS Investigation & Diagnostics

## "What happened in my cluster?"

When a user asks a broad question like "what happened in my AKS cluster?" or "check my AKS status", follow this systematic flow:

1. Cluster health
2. Recent events
3. Node status
4. Unhealthy pods
5. All pods overview
6. System pods health
7. Activity log

Gather Azure-side resource health, recent operations, and node-pool state first. Then run the target-bound snapshot rather than an ambient-context Kubernetes command chain:

```bash
AKS_SUBSCRIPTION_ID=<subscription-id> \
  scripts/cluster-snapshot.sh <resource-group> <cluster-name> <kube-context>
```

The script stops before Kubernetes API reads unless the kube context endpoint matches the named AKS resource. Continue with affected-namespace pod detail and logs only after the cluster, node, `kube-system`, and event evidence is complete.

Kubernetes events are short-lived. For anything older than the event retention window, control-plane history exists only if a diagnostic setting routed it to `AKSAudit`/`AKSAuditAdmin`/`AKSControlPlane` (or legacy `AzureDiagnostics`); see [references/structured-input-modes.md](references/structured-input-modes.md). Missing history is unavailable evidence, not proof that nothing happened.

---

## AKS CLI Tools

```bash
# Get cluster credentials (required before kubectl commands)
az aks get-credentials -g <rg> -n <cluster>

# View node pools
az aks nodepool list -g <rg> --cluster-name <cluster> -o table
```

### Azure MCP AppLens area for AKS

AppLens is a separate Azure MCP Server area, not part of its AKS cluster/node-pool metadata area. For AI-powered diagnostics:

```text
<host-assigned Azure MCP AppLens tool>
  resource: "<cluster-name>"
  question: "Diagnose the reported AKS cluster issue and recommend remediation."
  resource-group: "<resource-group>"  # optional disambiguation
  resource-type: "Microsoft.ContainerService/managedClusters"  # optional disambiguation
```

The angle-bracketed token is a placeholder, not a literal tool name. Inspect the host's available tools for the Azure MCP capability that advertises AppLens diagnostics, use its assigned name, and follow its advertised schema. The representative inputs above match the current AppLens capability; omit or rename them if the host advertises a different schema.

> 💡 **Tip:** AppLens uses the resource name and diagnostic question; provide the resource group and type only when needed to disambiguate the cluster.

---

## Best Practices

1. **Start with kubectl get/describe** - Always check basic status first
2. **Check events** - `kubectl get events -A` reveals recent issues
3. **Use systematic isolation** - Pod -> Node -> Cluster -> Network
4. **Document changes** - Note what you tried and what worked
5. **Escalate when needed** - For control plane issues, contact Azure support
