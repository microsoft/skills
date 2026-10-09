#!/bin/sh
# cluster-snapshot.sh — Quick cluster health overview
# Run at the start of any investigation to capture baseline state.
# Usage: sh cluster-snapshot.sh <resource-group> <cluster-name> <kube-context>
set -e

# Identify AKS Skills as the caller on Azure CLI requests so this traffic is
# attributable server-side. Appends to any user agent the caller already set.
export AZURE_HTTP_USER_AGENT="${AZURE_HTTP_USER_AGENT:+$AZURE_HTTP_USER_AGENT }AKS-Skills"

RG="${1:-${AKS_RESOURCE_GROUP:-}}"
CLUSTER="${2:-${AKS_CLUSTER_NAME:-}}"
CONTEXT="${3:-${AKS_KUBE_CONTEXT:-}}"

[ -n "$RG" ] && [ -n "$CLUSTER" ] && [ -n "$CONTEXT" ] || {
  echo "usage: cluster-snapshot.sh <resource-group> <cluster-name> <kube-context>" >&2
  exit 2
}

command -v az >/dev/null 2>&1 || {
  echo "Azure CLI (az) is required. Install it from https://aka.ms/installazurecli and retry." >&2
  exit 2
}
command -v kubectl >/dev/null 2>&1 || {
  echo "kubectl is required. Install it from https://kubernetes.io/docs/tasks/tools/ and retry." >&2
  exit 2
}
command -v jq >/dev/null 2>&1 || {
  echo "jq is required. Install it from https://jqlang.github.io/jq/download/ and retry." >&2
  exit 2
}

if [ -n "${AKS_SUBSCRIPTION_ID:-}" ]; then
  aks_json=$(az aks show --subscription "$AKS_SUBSCRIPTION_ID" \
    -g "$RG" -n "$CLUSTER" -o json 2>/dev/null)
else
  aks_json=$(az aks show -g "$RG" -n "$CLUSTER" -o json 2>/dev/null)
fi || {
  echo "AKS resource target is inaccessible" >&2
  exit 2
}
kube_server=$(kubectl --context "$CONTEXT" config view --minify \
  -o jsonpath='{.clusters[0].cluster.server}' 2>/dev/null) || {
  echo "kube context is inaccessible" >&2
  exit 2
}
normalize() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' |
    sed -E 's#^[a-z]+://##; s#/.*$##; s#:[0-9]+$##; s/\.$//'
}
kube_host=$(normalize "$kube_server")
public_host=$(normalize "$(printf '%s' "$aks_json" | jq -r '.fqdn // empty')")
private_host=$(normalize "$(printf '%s' "$aks_json" | jq -r '.privateFqdn // empty')")
[ -n "$kube_host" ] &&
  { [ "$kube_host" = "$public_host" ] || [ "$kube_host" = "$private_host" ]; } || {
  echo "kube context does not target the named AKS cluster" >&2
  exit 2
}
kube() {
  kubectl --context "$CONTEXT" "$@"
}

echo "=== Cluster Snapshot $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "targetProof=matched cluster=$RG/$CLUSTER context=$CONTEXT"

echo ""
echo "--- Nodes ---"
kube get nodes -o wide 2>/dev/null || echo "(kubectl not configured)"

echo ""
echo "--- Node Conditions (non-Ready or pressure) ---"
kube get nodes -o json 2>/dev/null | \
  jq -r '.items[] | .metadata.name as $n | .status.conditions[] | select(.type != "Ready" and .status == "True") | [$n, .type, .reason] | @tsv' 2>/dev/null || true
kube get nodes -o json 2>/dev/null | \
  jq -r '.items[] | .metadata.name as $n | .status.conditions[] | select(.type == "Ready" and .status != "True") | [$n, .type, .status, .reason] | @tsv' 2>/dev/null || true

echo ""
echo "--- Pods Not Running/Succeeded (all namespaces) ---"
kube get pods -A --field-selector 'status.phase!=Running,status.phase!=Succeeded' 2>/dev/null || echo "(none or error)"

echo ""
echo "--- Recent Warning Events (last 30m) ---"
kube get events -A --field-selector type=Warning --sort-by='.lastTimestamp' 2>/dev/null | tail -20 || true

echo ""
echo "--- Resource Pressure ---"
kube top nodes 2>/dev/null || echo "(metrics-server not available)"

if [ -n "$RG" ] && [ -n "$CLUSTER" ]; then
  echo ""
  echo "--- AKS Cluster State ---"
  printf '%s' "$aks_json" | \
    jq '{provisioningState, powerState: .powerState.code, kubernetesVersion, networkPlugin: .networkProfile.networkPlugin, networkPolicy: .networkProfile.networkPolicy, nodePools: [.agentPoolProfiles[] | {name, count, vmSize, provisioningState, mode, osType}]}' 2>/dev/null || echo "(unable to project AKS state)"
fi

echo ""
echo "=== End Snapshot ==="
