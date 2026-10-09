# AKS Automatic Migration Guide

Loaded when user asks about migration steps or after assessment is complete.

---

## Supported Journeys — Read First

Migrating **to** AKS Automatic means creating a new AKS Automatic target cluster and moving workloads to it. There is **no** documented in-place `az aks update --sku automatic` path for an existing Standard cluster.

| Journey | Documented today | Guidance |
|---|---|---|
| AKS Standard → AKS Automatic | Not in place; new target cluster + workload move | Follow the checklist below |
| AKS Automatic (managed system pool) → AKS Standard (`base` SKU) | Yes, in place: `az aks nodepool add --mode System …` then `az aks update --sku base` | Rollback/exit path; see the Learn article |
| Standard → Automatic in place; Automatic without managed system pool → with managed system pool | Listed by Microsoft as "coming soon" | Do not promise it or script it; re-check the Learn article |

Source: [AKS Automatic cluster SKU migration](https://learn.microsoft.com/azure/aks/automatic/aks-automatic-sku-migration). If that article changes, it wins over this summary.

---

## Migration Checklist

### Phase 1 — Assessment (this skill)

- [ ] Collect cluster/node-pool metadata through a host-discovered Azure MCP AKS capability (or `az`), then evaluate sanitized Kubernetes manifests locally against the bundled constraint spec
- [ ] Resolve all `incompatible` findings — these are hard blockers
- [ ] Apply all `requiresChanges` fixes — these will be denied at admission
- [ ] Review `autoFixed` items — understand what AKS Automatic will mutate at runtime
- [ ] Decide whether the target will opt into PSS Restricted or run Windows node pools; only then apply the `conditionalSafeguards` rules
- [ ] Address cluster-level Day-0 config issues (see below)

### Phase 2 — Create AKS Automatic Cluster (`azure-kubernetes` handoff)

This skill does not implement cluster creation. Hand off the assessed target requirements to the `azure-kubernetes` skill, including region, network and private-connectivity requirements, identities, policy constraints, and the Day-0 boundaries below.

```bash
az aks create \
  --resource-group <resource-group> \
  --name <new-cluster-name> \
  --sku automatic \
  --location <location> \
  --generate-ssh-keys
```

Do not continue to validation or cutover until the target cluster exists and its cluster/resource-group context is verified.

### Phase 3 — Dry-run and Staging Evidence on the New Cluster

```bash
# Keep target credentials in a dedicated file so source and target contexts never mix
az aks get-credentials \
  --resource-group <target-resource-group> \
  --name <target-cluster-name> \
  --file <target-kubeconfig>

# Dry-run server-side apply — catches admission policy rejections
KUBECONFIG=<target-kubeconfig> kubectl apply \
  --dry-run=server -f <manifests-directory>/
```

Creating a staging namespace and applying workloads mutate the target cluster. Run them only after the dry-run evidence is reviewed and the owner explicitly approves staging:

```bash
KUBECONFIG=<target-kubeconfig> kubectl create namespace <staging-namespace>
KUBECONFIG=<target-kubeconfig> kubectl apply \
  -f <manifests-directory>/ -n <staging-namespace>

# Preserve workload and admission evidence
KUBECONFIG=<target-kubeconfig> kubectl get pods \
  -n <staging-namespace> -o wide
KUBECONFIG=<target-kubeconfig> kubectl get events \
  -n <staging-namespace> --sort-by=.metadata.creationTimestamp
```

### Phase 4 — Cutover and Rollback Window

Cutover changes traffic and requires an owner-approved plan. Keep the old cluster available for an owner-approved rollback window. Close that window only after the owner accepts explicit evidence that:

- workload health and service objectives remain stable on the target;
- required data is synchronized and integrity checks pass;
- production traffic is fully served by the target without unresolved errors or regressions; and
- the rollback path has remained executable until the closure decision.

### Phase 5 — Decommission Old Cluster

```bash
# Destructive: only after the owner closes the rollback window
az aks delete \
  --resource-group <source-resource-group> \
  --name <old-cluster-name> \
  --yes --no-wait
```

---

## Day-0 Decisions — Cluster-Level Configuration Requirements

AKS Automatic is a new target cluster, and `azure-kubernetes` owns its creation. Preserve these source-to-target boundaries in the handoff:

| Boundary | Required target state | Handoff evidence |
|---|---|---|
| Network plugin | A kubenet source maps to Azure CNI Overlay on the Automatic target | Record source CIDRs, UDR/firewall dependencies, private endpoints, DNS, and non-overlapping target address spaces |
| API Server VNet Integration | Select the target VNet/subnet design at cluster creation | Record private/public API access, DNS, peering, and authorized administration paths |
| System node pool OS | The Automatic target system-pool OS is Azure Linux | Inventory source user-pool OS (including Windows) and workload OS requirements separately |
| OIDC issuer and workload identity | Use the Automatic target capabilities | Inventory service accounts, federated credentials, and identity/RBAC dependencies for staging validation |

---

## What AKS Automatic Auto-Enables

No manual setup needed for these — show this list when user asks "what do I get for free":

| Feature | Benefit |
|---|---|
| Node Auto Provisioning (NAP) | Replaces cluster autoscaler; right-sizes node pools automatically |
| Vertical Pod Autoscaler (VPA) | Auto-tunes resource requests after deployment |
| Azure Monitor Container Insights | Logs, metrics, and dashboards out of the box |
| Deployment Safeguards | Enabled in Enforce by default; admission policies plus webhook mutations for resource defaults and placement. Namespaces can be excluded; the level cannot be switched to Warn |
| Pod Security Standards (Baseline) | Enforced cluster-wide; Restricted available opt-in |
| Managed OIDC Issuer | Required for workload identity |
| Azure Key Vault CSI Driver | Secret injection without static credentials |
| Ephemeral OS disks | Faster node provisioning by default |
| Azure Linux node OS | Smaller footprint, faster boot times |

---

## Post-Migration Verification Commands

```bash
KUBECONFIG=<target-kubeconfig> kubectl get pods -A |
  grep -v Running | grep -v Completed

KUBECONFIG=<target-kubeconfig> kubectl get pods -A \
  --field-selector status.phase=Pending

# Deployment Safeguards / PSS constraints active on the target
KUBECONFIG=<target-kubeconfig> kubectl get constrainttemplate
KUBECONFIG=<target-kubeconfig> kubectl get constraints

KUBECONFIG=<target-kubeconfig> kubectl get vpa -A

az aks nodepool list \
  --resource-group <target-resource-group> \
  --cluster-name <target-cluster-name> \
  --query "[].{name:name, mode:mode, osType:osType, count:count}" \
  -o table

az aks show \
  --resource-group <target-resource-group> \
  --name <target-cluster-name> \
  --query addonProfiles.omsagent.enabled
```
