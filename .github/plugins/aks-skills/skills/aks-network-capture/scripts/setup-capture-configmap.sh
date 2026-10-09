#!/usr/bin/env bash
# Deploy the fixed Linux capture runner as a ConfigMap.
# Exit codes: 0 = success/help, 1 = kubectl/read failure, 2 = usage/argument error.
set -euo pipefail

usage() {
  cat <<EOF
Usage: $0 [namespace]

Deploy run-capture.sh as the network-capture-scripts ConfigMap.
The namespace defaults to "default".
EOF
}

usage_error() {
  echo "Error: $*" >&2
  usage >&2
  exit 2
}

die() {
  echo "Error: $*" >&2
  exit 1
}

case "${1:-}" in
  -h|--help)
    usage
    exit 0
    ;;
esac
[ "$#" -le 1 ] || usage_error "expected at most one namespace"

NAMESPACE="${1:-default}"
case "$NAMESPACE" in
  ""|-*|*-|*[!a-z0-9-]*) usage_error "namespace must be an RFC 1123 label" ;;
esac
[ "${#NAMESPACE}" -le 63 ] || usage_error "namespace must not exceed 63 characters"

command -v kubectl >/dev/null 2>&1 || die "kubectl is not installed or not on PATH"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -r "$SCRIPT_DIR/run-capture.sh" ] || die "run-capture.sh is not readable"

kubectl create configmap network-capture-scripts \
  --from-file=run-capture.sh="$SCRIPT_DIR/run-capture.sh" \
  --namespace="$NAMESPACE" \
  --dry-run=client -o yaml \
  | kubectl apply -f -

echo "ConfigMap network-capture-scripts created or updated in namespace: $NAMESPACE"
