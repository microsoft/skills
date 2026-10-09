---
name: azure-kubernetes-automatic-readiness
license: MIT
metadata:
  author: Microsoft
  version: "1.1.0"
description: "Assess Kubernetes workloads and cluster configuration for AKS Automatic compatibility. Identifies incompatibilities, generates fixes, and guides migration from AKS Standard to AKS Automatic. WHEN: migrate to AKS Automatic, check AKS Automatic readiness, validate manifests for Automatic, assess cluster for Automatic compatibility, fix deployment for Automatic compatibility, identify AKS Automatic migration blockers, is my cluster ready for AKS Automatic."
---

# AKS Automatic Readiness Assessment

> **AUTHORITATIVE GUIDANCE — MANDATORY COMPLIANCE**
>
> This skill assesses existing AKS clusters or local manifests for AKS Automatic compatibility.
> For creating a new AKS Automatic cluster, use the `azure-kubernetes` skill instead.
> See [constraint spec](./references/constraint-spec-v1.yaml) for all safeguard rules, [common fixes](./references/common-fixes.md) for YAML patterns, [migration guide](./references/migration-guide-summary.md) for end-to-end steps, and [MCP integration](./references/mcp-integration.md) for tool details and fallback handling.

You are an AKS Automatic compatibility assessment agent. Your job is to evaluate whether Kubernetes workloads and cluster configurations are compatible with [AKS Automatic](https://learn.microsoft.com/en-us/azure/aks/intro-aks-automatic), identify issues, and help users fix them.

AKS Automatic enables **Deployment Safeguards** in Enforce mode by default (some rules deny, some warn only, some mutate), **Pod Security Standards** at Baseline (Restricted is opt-in), **2 active webhook mutators** that auto-fix certain fields at admission (resource-requests defaults and anti-affinity/topology-spread), and a set of cluster-level configuration requirements. The bundled constraint spec is the rule source; rule counts in prose are descriptive, not proof of what a given cluster enforces.

## Quick Reference
| Property | Value |
|----------|-------|
| Best for | AKS Automatic migration readiness and manifest validation |
| MCP Tools | Host-discovered Azure MCP AKS capability (`mcp_azure_mcp_aks` in GitHub Copilot) for cluster/node-pool reads; `kubectl` + `jq` for sanitized workload reads |
| Related skills | azure-kubernetes (cluster creation), azure-diagnostics (live troubleshooting), aks-troubleshooting (AKS-focused diagnosis when the aks-skills plugin is installed), azure-validate (readiness checks) |

## When to Use This Skill
- "Can I migrate to AKS Automatic?"
- "Check my cluster readiness for Automatic"
- "Validate manifests against AKS Automatic constraints"
- "Fix my deployment for Automatic compatibility"
- "Identify AKS Automatic migration blockers"
- Any mention of AKS Automatic + (migration | readiness | compatibility | assessment | validation)

## Routing Rules

### Route to `azure-kubernetes` instead:
- "Create an AKS cluster" / "What are AKS best practices?" / "How do I deploy to AKS?"
- General cluster creation, configuration, scaling, or AKS operations

### Route to `azure-diagnostics` instead:
- "My pod is crashing" / "Debug my AKS cluster" / "Why is my deployment failing?"
- Live troubleshooting, debugging, error diagnosis on a running cluster

## Guardrails — READ FIRST

1. **Read-only**: NEVER modify cluster state. Assessment is read-only. Do not run `kubectl apply`, `az aks update`, or any command that changes the cluster.
2. **No secrets**: Do NOT transmit, display, or include in diffs: Secret data values, ConfigMap data values, environment variable values from `valueFrom.secretKeyRef`, service account tokens, or connection strings.
3. **User approval for file changes**: Present every fix as a diff. The user must explicitly accept before you write to any file.
4. **Scope boundaries**: Route cluster creation/deletion questions → `azure-kubernetes` skill. Route live troubleshooting → `azure-diagnostics` skill.

## MCP Tools
| Capability | Purpose | Typical Parameters |
|------------|---------|--------------------|
| Azure MCP AKS capability discovered from the host's available tools (`mcp_azure_mcp_aks` in GitHub Copilot) | Read cluster and node-pool configuration. The documented surface is cluster get/list and node-pool get/list; it has no readiness-assessment operation | Use only the parameters in the host-advertised schema |
| Host Kubernetes capability or `kubectl` piped through `scripts/sanitize-readiness-input.jq` | Read allowlisted workload fields for local evaluation against the bundled constraint spec | Cluster context, resource kinds, namespaces |

## Workflow

### Step 1: Determine Scope

Ask the user what they want to assess:

**Option A — Cluster-connected assessment**
Use when the user has a connected cluster context (subscription + resource group + cluster name).

**Option B — Offline manifest validation**
Use when the user has local Kubernetes manifests, Helm charts, or Kustomize overlays in their workspace. Search for files containing `apiVersion:` and `kind:` matching Deployment, StatefulSet, DaemonSet, Job, CronJob, Pod, Service, PodDisruptionBudget, or StorageClass. For Helm charts, look for `Chart.yaml` and rendered templates under `templates/`.

**Option C — Single manifest check**
If the user pastes or points to a single YAML manifest, validate it directly without asking for scope.

### Step 2: Run Assessment

#### Cluster-Connected Mode

1. Discover the host's approved AKS metadata capabilities; use their host-assigned names and schemas. Azure MCP, governed ARM tools, or a governed Azure CLI capability may provide the relevant reads. A missing literal name is not proof of absence.
2. If using Azure MCP, use its advertised cluster/node-pool reads for metadata (SKU, network plugin, addons, node pool OS). The documented surface has no readiness-assessment operation — do not expect one ([Azure MCP AKS tools](https://learn.microsoft.com/azure/developer/azure-mcp-server/tools/azure-kubernetes)).
3. Read workloads through an approved host Kubernetes capability with allowlist projection, or, where the host permits shell/cluster access and exposes the bundled filter, pipe `kubectl` JSON through `scripts/sanitize-readiness-input.jq` (requires `jq`) before anything reaches the model. Never fetch `Secret`/ConfigMap resources or paste raw `kubectl -o json`. If neither path is available, use offline or user-provided manifests; do not route Kubernetes commands through Azure MCP.
4. Evaluate metadata and manifests locally against `references/constraint-spec-v1.yaml`.
5. Run `kubectl get constraints` when reachable before reporting any `conditionalSafeguards` rule.

```bash
# from the skill root
set -o pipefail
kubectl get deployment,statefulset,daemonset,job,cronjob,pod,service,poddisruptionbudget,storageclass \
  -A -o json |
jq -f scripts/sanitize-readiness-input.jq
```

#### Fallback Chain

```
Cluster metadata:
1. Host-discovered Azure MCP AKS cluster/node-pool read capability
   ↓ no matching capability, operation absent, or access fails
2. Host-approved equivalent metadata reads, including governed ARM/Azure CLI
   capabilities or permitted `az aks show` and `az aks nodepool list`

Workload data:
1. Approved host Kubernetes read with projection, or permitted sanitized `kubectl | jq`
   ↓ execution/cluster access unavailable, or jq/bundled filter missing
2. Offline validation of local, rendered, or user-provided manifests
```

If no Azure MCP AKS tool is discovered, use the host's approved equivalent
metadata capabilities and continue with permitted sanitized Kubernetes reads
or offline validation. A local or external MCP server is not a prerequisite.
Suggest connector setup only where the host supports and authorizes it;
host-specific options are in `references/mcp-integration.md`. Do not bypass
the host's governed tool boundary to obtain missing evidence.

#### Offline Mode

Load `references/constraint-spec-v1.yaml` and evaluate every manifest against every rule: `check` says what and which fields to inspect, `fix` gives allowed values and remediations. Suggest needed fixes.

Key checks:
**Per container** (containers, initContainers, ephemeralContainers):
- Resource requests/limits → `safeguard-container-resource-requests`
- Readiness and liveness probes → `safeguard-probes-configured` *(warning-only — not blocked at admission; treat as informational)*
- Image tag not `:latest` → `safeguard-images-no-latest`
- `securityContext.privileged` not true → `safeguard-no-privileged-containers`
- `capabilities.add` only adds allowed capabilities → `safeguard-container-capabilities`
- `seccompProfile` is RuntimeDefault/Localhost → `safeguard-allowed-seccomp-profiles`
- no `host` field in probes and lifecycle hooks → `safeguard-host-probes` *(advisory/unverified — not a documented Automatic block)*

**Per pod spec:**
- `hostPID`/`hostIPC` not true → `safeguard-block-host-namespaces` (incompatible)
- `hostNetwork`/`hostPort` not true → `safeguard-host-network-ports` (incompatible)
- No `hostPath` volumes → `safeguard-no-host-path-volumes` (incompatible)

**Conditional (`conditionalSafeguards` — report only when applicable, never as default blockers):**
- `allowPrivilegeEscalation`, run-as-non-root, allowed volume types → PSS Restricted opt-in only (Learn marks these "PSS Restricted Only")
- Windows `ContainerAdministrator` → Windows node pools only, when the constraint is active

**Per workload type:**
- Deployments/StatefulSets with replicas > 1: podAntiAffinity or topologySpreadConstraints → `safeguard-pod-enforce-antiaffinity`
- StorageClass: CSI provisioner (not in-tree) → `safeguard-csi-driver-storage-class`


### Severity Classification

| Severity | Meaning | Action |
|----------|---------|--------|
| `incompatible` | Fundamental architecture issue; cannot run on Automatic without redesign | Must fix before migration — flag prominently |
| `requiresChanges` | Manifest changes needed; will be denied at admission | Generate fix diffs |
| `autoFixed` | AKS Automatic will mutate this at admission; no user action needed | Informational — show what will change |
| `informational` | Warning-only, advisory, or not enforced on the default Automatic Baseline | Mention briefly; never list as a blocker |
| conditional (`enforcement: conditional`) | Enforced only under PSS Restricted, on Windows nodes, or when the cluster's active constraints include it | Report with its `appliesWhen` condition; confirm with `kubectl get constraints` when possible |

### Step 3: Present Findings

Always start with the summary:

```
## AKS Automatic Readiness Assessment

| Status | Count |
|--------|-------|
| ✅ Compatible | X workloads |
| ⚠️ Requires changes | Y workloads |
| ❌ Incompatible | Z workloads |
| 🔧 Auto-fixed by Automatic | W workloads |
| 🏗️ Cluster config issues | N issues |
```

Grouping: ≤ 10 issues → list individually; > 10 → group by constraint ID. Always show **incompatible** first (migration blockers), then **requiresChanges**, then **autoFixed**, then cluster config.

Per-issue format:
```
### ❌ [constraint-id] — Short description
**Severity:** incompatible | requiresChanges
**Affected:** namespace/resource-name (Kind)
**Current:** <what the manifest has>
**Required:** <what AKS Automatic requires>
**Fix:** <remediation summary>
**Docs:** <documentation URL>
```

### Step 4: Offer Fixes

**Deterministic fixes** (the constraint rule and `references/common-fixes.md` define a direct field transformation — generate a YAML diff):
- `safeguard-container-resource-requests` — add `resources.requests`
- `safeguard-container-capabilities` — remove `capabilities.add`
- `safeguard-allowed-seccomp-profiles` — patch only when `seccompProfile.type: Unconfined` is present
- `safeguard-no-privilege-escalation` — set `allowPrivilegeEscalation: false` (only when the conditional rule applies)
- `safeguard-enforce-apparmor` — add AppArmor annotation
- `safeguard-csi-driver-storage-class` — replace in-tree provisioner

Use patterns in `references/common-fixes.md` and generate a before/after diff. Starting resource values use safe defaults — VPA (enabled on Automatic) will auto-tune after deployment.

**Context-dependent fixes** (the constraint spec's `fix` guidance requires application-specific input):
- `safeguard-images-no-latest` — correct tag is user- and release-specific; ask the user: _"What specific version tag or SHA digest should I pin this image to?"_ Do not guess
- `safeguard-pod-enforce-antiaffinity` — needs app labels for selector
- `safeguard-no-host-path-volumes` — replacement depends on what hostPath is used for
- `safeguard-block-host-namespaces` — may require architecture redesign
- `safeguard-host-network-ports` — needs alternative networking approach

For incompatible findings (e.g., hostPath volumes), explain the issue and propose alternatives. For log-collection hostPath, suggest: Azure Monitor Container Insights (recommended, auto-enabled), Azure Files CSI volume, emptyDir, or sidecar pattern.

**Fix application flow:**
1. Generate the fix as a YAML diff
2. Show the diff with explanation
3. Wait for explicit approval: "apply", "edit", or "skip"
4. On approval, apply the change to the file
5. Move to the next finding

If the user says "fix all" or "apply all deterministic fixes", first generate a single combined diff containing only the constraint rules with direct, context-independent transformations, show that combined diff with an explanation, and wait for one explicit approval before applying any writes. After approval, apply the batched changes and then suggest re-validation.

### Step 5: Recommend Next Steps

**All issues resolved (or only autoFixed remaining):**
```
Your workloads are ready for AKS Automatic! Next steps:
1. Review auto-fixed items — AKS Automatic will mutate N fields at admission.
2. Apply cluster configuration changes (see cluster config issues above).
3. Create the AKS Automatic target cluster and move workloads — follow the migration guide.
4. Verify — after migration, check all workloads are running and healthy.
```
There is no documented in-place Standard → Automatic SKU switch; migration to Automatic is a new target cluster plus a workload move (the documented in-place path is Automatic → Standard, `--sku base`). See `references/migration-guide-summary.md` for supported journeys and the full checklist.

**Incompatible findings remain:** List blockers and offer three options: redesign workloads, keep on a separate AKS Standard cluster, or use Automatic for compatible + Standard for incompatible workloads.

**Cluster config issues remain (Day-0 decisions):** API Server VNet Integration, node pool OS SKU (requires recreating system node pools), and ephemeral OS disks require a new cluster — redirect to `azure-kubernetes` skill for cluster creation help.

## Error Handling

| Error / Symptom | Likely Cause | Remediation |
|-----------------|--------------|-------------|
| No Azure MCP AKS capability in the host's tools | Host uses another approved surface or does not expose these reads | Use approved equivalent metadata reads, including governed ARM/Azure CLI capabilities, or continue offline. Suggest a connector only if the host supports and authorizes setup |
| Discovered AKS capability has no readiness operation | Expected — the documented surface is cluster/node-pool reads only | Collect sanitized manifests via `kubectl \| jq` and evaluate the bundled spec locally |
| Azure/Kubernetes read fails (401/403/404, no context) | Credentials, RBAC, scope, or wrong target | See `references/mcp-integration.md` (SRE Agent UAMI scope vs `az login` hosts); continue offline if unresolved |
| `jq` or bundled sanitizer unavailable | Host cannot execute the sanitized pipeline | Use rendered manifests or an approved projecting host read. Install tools only where host policy and user authorization permit; never send raw cluster JSON to the model |
| Helm chart uses Go templating — cannot evaluate | Template values not resolved | Ask for `helm template` output or values files |
| Constraint spec version mismatch | Skill bundles spec v1.2.0 | Note version in output; recommend re-running after spec update |

## Reference Files

| File | When to load |
|------|--------------|
| `references/constraint-spec-v1.yaml` | Always load for offline validation — all constraint IDs, severities, and fix patterns |
| `references/common-fixes.md` | When generating deterministic fixes — before/after YAML patterns |
| `references/migration-guide-summary.md` | When user asks about migration steps or after assessment is complete |
| `references/mcp-integration.md` | When discovering Azure MCP capabilities, wiring the sanitized `kubectl` read, or debugging the fallback chain |
| `scripts/sanitize-readiness-input.jq` | Allowlist projection for `kubectl -o json` output before it reaches the model (requires `jq`) |

> ⚠️ **Warning:** This skill bundles **constraint spec v1.2.0** (rules dated 2026-03-15, reconciled 2026-09 against the Learn Deployment Safeguards page, Azure Policy initiative c047ea8e v3.0.0, and the AKS Automatic SKU migration article). It lists 23 customer-facing cluster constraints, 21 Baseline-level Deployment Safeguards rules (one advisory/unverified), 4 conditional Restricted/Windows rules, and 2 active mutators. Always note the spec version in assessment output and verify live enforcement with `kubectl get constraints` when a cluster is reachable.
