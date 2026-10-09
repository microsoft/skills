# MCP Integration Reference

Loaded when discovering Azure MCP capabilities, collecting live cluster metadata, or debugging the fallback chain.

---

## Capability Discovery

Inspect the host's available tool catalog, descriptions, and input schemas for an Azure MCP capability that advertises AKS operations. In GitHub Copilot this is surfaced as `mcp_azure_mcp_aks`; other hosts assign their own names. Invoke the matching capability under its host-assigned name and advertised schema.

- If the host exposes a list, learn, or discovery operation, use it.
- Otherwise, rely on the tool catalog and schema the host already supplied.
- Never infer that Azure MCP is absent because a literal tool name is missing.
- Do not translate names between hosts or create a mapping layer.

Azure MCP is not a prerequisite for this assessment. If it is absent, use
equivalent reads exposed by the host's approved ARM, Azure CLI, or other
metadata capabilities, within their advertised schemas and authorized scope.
If no approved read fits, collect operator-provided evidence or validate
manifests offline. Do not add an external or local MCP server to work around a
governed host's tool policy.

The currently documented Azure MCP AKS surface provides read-only operations for:

- AKS cluster details (get/list)
- AKS node-pool details (get/list)

It does **not** document an AKS Automatic readiness-assessment operation, a workload assessment response schema, or an assessment polling action. Earlier versions of this skill described such an API; it does not exist. See [Azure Kubernetes Service tools for the Azure MCP Server](https://learn.microsoft.com/azure/developer/azure-mcp-server/tools/azure-kubernetes).

---

## Role in Readiness Assessment

Use the discovered Azure MCP AKS capability only for operations its schema advertises:

1. Read cluster configuration and status.
2. Read node-pool configuration and status.
3. Collect sanitized workload manifests through a host capability with an equivalent allowlist projection, or pipe `kubectl` JSON through [`scripts/sanitize-readiness-input.jq`](../scripts/sanitize-readiness-input.jq) (requires `jq`) before the result reaches the model.
4. Evaluate cluster metadata and manifests locally against `constraint-spec-v1.yaml`.

Do not request `Secret` or ConfigMap resources. The assessment needs selected workload fields, Services, PodDisruptionBudgets, and StorageClass provisioners, not secret values. The bundled filter uses an allowlist projection so unrecognized fields (env values, `envFrom`, volume sources, non-AppArmor annotations, `managedFields`, `status`) are dropped by default.

Representative redacted Kubernetes read (run from the skill root only where
the host authorizes shell and cluster access and exposes `kubectl`, `jq`, and
the bundled filter):

```bash
set -o pipefail
kubectl get deployment,statefulset,daemonset,job,cronjob,pod,service,poddisruptionbudget,storageclass \
  -A -o json |
jq -f scripts/sanitize-readiness-input.jq
```

If the execution capability, `jq`, or the filter is unavailable, do not paste
raw `kubectl -o json` output to the model. Ask the user for rendered manifests,
or use an approved host Kubernetes read that supports field projection.
Azure MCP's AKS metadata area is not a Kubernetes command runner.

All assessment conclusions and suggested patches come from the bundled constraint spec and the collected manifests, not from an assumed MCP response contract.

---

## Fallback Chain

Attempt the applicable path without asking the user to identify tool availability:

```text
Cluster and node-pool metadata:
1. Inspect host tools for an Azure MCP AKS read capability
   -> invoke the matching capability under its host-assigned name and schema
   -> if unavailable or insufficient, use approved equivalent metadata reads
      (governed ARM/Azure CLI capabilities or permitted `az aks show` / `az aks nodepool list`)

Workload manifests:
1. Use an approved host Kubernetes read with field projection, or a permitted `kubectl | jq` pipeline
   -> if execution, cluster access, or the sanitizer is unavailable, use local, rendered, or user-provided manifests

Assessment:
1. Evaluate collected data locally against `constraint-spec-v1.yaml`
2. When the cluster is reachable, confirm which conditional rules are active:
   `kubectl get constraints` (Gatekeeper) — report Restricted-only/Windows rules only if present
```

CLI metadata fallback:

```bash
az aks show \
  --resource-group <resource-group> \
  --name <cluster>

az aks nodepool list \
  --resource-group <resource-group> \
  --cluster-name <cluster>
```

---

## Azure SRE Agent

Azure SRE Agent's built-in Azure operations, diagnostics, monitoring, and `kubectl` tools use the agent's managed identity and require no connector. Prefer those built-in capabilities when they satisfy the read. See [Tools in Azure SRE Agent](https://learn.microsoft.com/azure/sre-agent/tools).

Installing this plugin records its `.mcp.json` requirement but does not provision the external connector. **Connector setup required** is a non-blocking plugin status. If the external Azure MCP surface is needed and this host supports and authorizes connector setup:

1. Open the plugin details and select **Add as connector**, or go to **Builder > Connectors**.
2. Complete the connector authentication.
3. Wait for the connector status to show **Connected**.
4. Select the required Azure MCP tools for the agent.

See the official [plugin marketplace guidance](https://learn.microsoft.com/azure/sre-agent/plugin-marketplace#what-the-plugin-marketplace-does) and [MCP connector tutorial](https://learn.microsoft.com/azure/sre-agent/mcp-connector).

If a built-in Azure or Kubernetes read fails, check that the target resource group is in the agent's scope and that its user-assigned managed identity has the required RBAC. Do not tell an SRE Agent user to configure Azure MCP "in the editor" or default to local `az login` remediation. See [SRE Agent permissions](https://learn.microsoft.com/azure/sre-agent/permissions).

---

## Other Hosts

If capability discovery finds no Azure MCP AKS tool, explain that the current
host does not expose it. Use approved equivalent metadata capabilities, such
as governed ARM or Azure CLI reads, and approved projected Kubernetes reads or
the permitted `kubectl`/`jq` fallback. Continue with offline validation when
live access is unavailable. Do not present a local or external MCP server as
a prerequisite. Only if the host supports and authorizes connector setup,
point to its configuration flow or the official
[Azure MCP Server setup overview](https://learn.microsoft.com/azure/developer/azure-mcp-server/get-started).

For CLI-backed hosts, verify:

```bash
az account show --query "{name:name, id:id, state:state}" -o table
kubectl config current-context
kubectl cluster-info
```

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| No Azure MCP AKS capability appears in the host catalog | Host uses another approved surface or does not expose these reads | Use approved equivalent metadata capabilities or offline validation. Suggest connector setup only where the host supports and authorizes it; absence is not a requirement to install MCP |
| Discovered AKS capability lacks a readiness-assessment operation | Expected for the currently documented Azure MCP AKS surface | Use advertised cluster/node-pool reads, collect sanitized manifests through Kubernetes-native tools, and evaluate `constraint-spec-v1.yaml` locally |
| Azure or Kubernetes read fails in Azure SRE Agent | Agent UAMI lacks target scope or RBAC | Check managed resource groups and role assignments in [SRE Agent permissions](https://learn.microsoft.com/azure/sre-agent/permissions) |
| `HTTP 401 Unauthorized` in a CLI-backed host | Azure CLI session is not authenticated | Run `az login` and verify `az account show` |
| `HTTP 403 Forbidden` | Identity lacks read access | Grant the least-privilege read role at the target scope (for example, Azure Kubernetes Service Cluster User Role for `kubectl` access) |
| `HTTP 404 Not Found` | Wrong subscription, resource group, or cluster name | Verify the target with the discovered Azure capability or `az aks list -o table` |
| `kubectl` cannot read workloads | Missing context or Kubernetes RBAC | Verify context and read permissions, or use local/rendered manifests |
| `jq` or bundled sanitizer unavailable | Host cannot execute the sanitized pipeline | Use rendered manifests or an approved projecting host read. Install tools only where host policy and user authorization permit; never send raw cluster JSON to the model |
