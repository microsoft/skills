# Self-Hosted Karpenter to Managed NAP

Use this path only when Karpenter runs in the user cluster and managed NAP is
disabled. Do not use normal NAP enablement.

Never delete Karpenter CRDs, `NodePools`, or `NodeClaims`; deleting the CRDs
deletes underlying `NodeClaims` and can disrupt workloads. Require explicit
approval before each metadata change, Helm uninstall, or AKS update.

## Assess and Plan

1. Confirm the Karpenter controller deployment, Helm release/namespace, chart
   version, and ownership annotations on Karpenter CRDs.
2. Record Helm values and all existing `NodePool`, `NodeClaim`, and
   `AKSNodeClass` resources. Upgrade self-hosted Karpenter to a version
   compatible with current managed NAP before migration.
3. Verify current nodes, pending workloads, PDBs, disruption controls, and
   capacity. Agree on an observation window and a rollback that reinstalls the
   recorded release and values.

## Migrate

Remove these ownership entries from each Helm-owned Karpenter CRD so Helm
preserves it:

```bash
kubectl annotate crd "<CRD_NAME>" \
  meta.helm.sh/release-name- meta.helm.sh/release-namespace-
kubectl label crd "<CRD_NAME>" app.kubernetes.io/managed-by-
```

Uninstall the recorded self-hosted release. Scaling pauses until managed NAP
starts, but existing nodes must remain:

```bash
helm uninstall "<RELEASE_NAME>" --namespace "<RELEASE_NAMESPACE>"
```

Enable managed NAP without creating default pools so it adopts the preserved
configuration:

```bash
az aks update \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --node-provisioning-mode Auto --node-provisioning-default-pools None
```

## Verify

Confirm the cluster reports NAP mode `Auto`, AKS has assumed ownership of the
preserved Karpenter CRDs, and existing `NodePools`, `NodeClaims`, and nodes
remain. Verify provisioning, consolidation, pending-pod time, workload SLOs,
and NAP events during the observation window. If enablement or ownership
transfer fails, stop and reinstall the recorded self-hosted Karpenter release
with its saved chart version, namespace, and Helm values, following the
pre-approved rollback plan.