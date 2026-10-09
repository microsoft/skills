#!/bin/sh
# pod-deep-dive.sh — Full diagnostic dump for a single pod
# Usage: pod-deep-dive.sh <namespace> <pod> <resource-group> <cluster> <context> <artifacts-dir>
set -e

NS="${1:-}"
POD="${2:-}"
RG="${3:-${AKS_RESOURCE_GROUP:-}}"
CLUSTER="${4:-${AKS_CLUSTER_NAME:-}}"
CONTEXT="${5:-${AKS_KUBE_CONTEXT:-}}"
ARTIFACTS="${6:-${AKS_ARTIFACTS_DIR:-}}"
LOG_LINES=50

[ -n "$NS" ] && [ -n "$POD" ] && [ -n "$RG" ] && [ -n "$CLUSTER" ] &&
  [ -n "$CONTEXT" ] && [ -n "$ARTIFACTS" ] || {
  echo "usage: pod-deep-dive.sh <namespace> <pod> <resource-group> <cluster> <context> <artifacts-dir>" >&2
  exit 2
}
[ "$ARTIFACTS" != "/" ] && [ ! -L "$ARTIFACTS" ] || {
  echo "invalid artifacts directory" >&2
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

mkdir -p "$ARTIFACTS"
chmod 700 "$ARTIFACTS"

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
redact() {
  sed -E \
    -e 's/(Authorization:).*/\1 [REDACTED]/I' \
    -e 's/((client[_-]?secret|password|token|api[_-]?key)[[:space:]]*[:=][[:space:]]*)[^[:space:]]+/\1[REDACTED]/Ig' \
    -e 's/([?&]sig=)[^&[:space:]]+/\1[REDACTED]/Ig'
}
logs() {
  label="$1"
  shift
  raw="$ARTIFACTS/$label.raw.log"
  kube logs "$POD" -n "$NS" --all-containers=true --prefix=true \
    --tail="$LOG_LINES" "$@" >"$raw" 2>&1 || true
  chmod 600 "$raw"
  redact <"$raw" | sed -n "1,${LOG_LINES}p"
}

echo "=== Pod Deep Dive: $NS/$POD $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "targetProof=matched cluster=$RG/$CLUSTER context=$CONTEXT"
echo "rawArtifacts=$ARTIFACTS"

echo ""
echo "--- Pod Status ---"
kube get pod "$POD" -n "$NS" -o wide 2>/dev/null || { echo "Pod not found"; exit 1; }

echo ""
echo "--- Describe ---"
kube describe pod "$POD" -n "$NS" 2>/dev/null

echo ""
echo "--- Container Resources ---"
kube get pod "$POD" -n "$NS" -o json | \
  jq '.spec.containers[] | {name, resources}' 2>/dev/null || true

echo ""
echo "--- Current Logs (all containers) ---"
logs current

echo ""
echo "--- Previous Logs (all containers) ---"
logs previous --previous

echo ""
echo "--- Events ---"
kube get events -n "$NS" --field-selector "involvedObject.name=$POD" --sort-by='.lastTimestamp' 2>/dev/null || true

echo ""
echo "--- Resource Usage ---"
kube top pod "$POD" -n "$NS" --containers 2>/dev/null || echo "(metrics not available)"

echo ""
echo "=== End Deep Dive ==="
