#!/usr/bin/env bash
# Retrieve exact-run capture bundles from nodes and clean up capture resources.
# Exit codes: 0 = success/help, 1 = retrieval/cleanup failure, 2 = usage/argument error.
set -euo pipefail

CAPTURE_NAME=""
OUTPUT_PATH="/var/log/aks-network-captures"
WORKSPACE_DIR="${WORKSPACE_DIR:-./aks-network-captures}"
NAMESPACE="default"
RETRIEVE_RUN_ID=""

usage() {
  cat <<EOF
Usage: $0 --name <capture-name> [options]

Required:
  --name <string>          Capture name used during creation

Options:
  --output-path <path>     Node hostPath base (default: ${OUTPUT_PATH})
  --workspace-dir <path>   Local workspace directory (default: ${WORKSPACE_DIR})
  --namespace <string>     Capture Job namespace (default: default)
  --run-id <string>        Exact run ID; required when multiple runs exist
  -h, --help               Show this help
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

require_value() {
  [ "$#" -ge 2 ] && [ -n "$2" ] || usage_error "$1 requires a value"
}

valid_single_line() {
  case "$1" in
    *$'\r'*|*$'\n'*) return 1 ;;
  esac
}

valid_rfc1123() {
  valid_single_line "$1" && [ "${#1}" -le 63 ] \
    && printf '%s' "$1" | grep -Eq '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$'
}

valid_node_name() {
  valid_single_line "$1" && [ "${#1}" -le 253 ] \
    && printf '%s' "$1" \
      | grep -Eq '^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$'
}

valid_hostpath() {
  case "$1" in
    /*) ;;
    *) return 1 ;;
  esac
  case "$1" in
    *..*|*[!A-Za-z0-9/_.-]*) return 1 ;;
  esac
}

valid_run_id() {
  local run_date="${1%%-*}"
  local remainder="${1#*-}"
  local run_time="${remainder%%-*}"
  local run_token="${remainder#*-}"
  case "$1" in
    *[!0-9a-f-]*) return 1 ;;
  esac
  [ "${#run_date}" -eq 8 ] && [ "${#run_time}" -eq 6 ] \
    && [ "${#run_token}" -eq 24 ] || return 1
  case "${run_date}${run_time}${run_token}" in
    *[!0-9a-f]*) return 1 ;;
  esac
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --name)
      require_value "$@"; CAPTURE_NAME="$2"; shift 2 ;;
    --output-path)
      require_value "$@"; OUTPUT_PATH="$2"; shift 2 ;;
    --workspace-dir)
      require_value "$@"; WORKSPACE_DIR="$2"; shift 2 ;;
    --namespace)
      require_value "$@"; NAMESPACE="$2"; shift 2 ;;
    --run-id)
      require_value "$@"; RETRIEVE_RUN_ID="$2"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      usage_error "unknown option: $1" ;;
  esac
done

[ -n "$CAPTURE_NAME" ] || usage_error "--name is required"
valid_rfc1123 "$CAPTURE_NAME" || usage_error "--name must be an RFC 1123 label"
valid_hostpath "$OUTPUT_PATH" \
  || usage_error "--output-path must be absolute and contain only letters, digits, '/', '_', '.', or '-'"
valid_single_line "$WORKSPACE_DIR" || usage_error "--workspace-dir must be a single line"
valid_rfc1123 "$NAMESPACE" || usage_error "--namespace must be an RFC 1123 label"
[ -z "$RETRIEVE_RUN_ID" ] || valid_run_id "$RETRIEVE_RUN_ID" \
  || usage_error "--run-id has an invalid format"

command -v kubectl >/dev/null 2>&1 || die "kubectl is not installed or not on PATH"

if [ -z "$RETRIEVE_RUN_ID" ]; then
  if ! CAPTURE_RUNS="$(kubectl get jobs -n "$NAMESPACE" \
    -l "capture-id=${CAPTURE_NAME}" \
    -o jsonpath='{range .items[*]}{.metadata.labels.capture-run}{"\n"}{end}' \
    | sed '/^$/d' | sort -u)"; then
    die "could not list capture runs"
  fi
  RUN_COUNT="$(printf '%s\n' "$CAPTURE_RUNS" | sed '/^$/d' | wc -l | tr -d '[:space:]')"
  case "$RUN_COUNT" in
    0) die "no capture runs found for '$CAPTURE_NAME'" ;;
    1) RETRIEVE_RUN_ID="$CAPTURE_RUNS" ;;
    *) die "multiple capture runs found; specify --run-id" ;;
  esac
fi
valid_run_id "$RETRIEVE_RUN_ID" || die "Kubernetes returned an invalid capture run identity"

if ! CAPTURE_JOBS="$(kubectl get jobs -n "$NAMESPACE" \
  -l "capture-id=${CAPTURE_NAME},capture-run=${RETRIEVE_RUN_ID}" \
  -o jsonpath='{.items[*].metadata.name}')"; then
  die "could not list capture Jobs"
fi
[ -n "$CAPTURE_JOBS" ] || die "no Jobs found for the requested capture run"
read -r -a CAPTURE_JOB_NAMES <<<"$CAPTURE_JOBS"

CAPTURES_DIR="${WORKSPACE_DIR}/network-captures"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
CAPTURE_OUTPUT_DIR="${CAPTURES_DIR}/${CAPTURE_NAME}-${RETRIEVE_RUN_ID}-${TIMESTAMP}"
mkdir -p "$CAPTURE_OUTPUT_DIR"

TEMP_PODS=()
cleanup_resources() {
  local failed=0
  local pod
  if [ "${#TEMP_PODS[@]}" -gt 0 ]; then
    for pod in "${TEMP_PODS[@]}"; do
      if ! kubectl delete pod "$pod" -n "$NAMESPACE" --ignore-not-found >/dev/null; then
        echo "Error: failed to delete retrieval pod '$pod'" >&2
        failed=1
      fi
    done
  fi
  if ! kubectl delete jobs -n "$NAMESPACE" "${CAPTURE_JOB_NAMES[@]}" \
    --ignore-not-found >/dev/null; then
    echo "Error: failed to delete capture Jobs" >&2
    failed=1
  fi
  return "$failed"
}

cleanup_on_exit() {
  local status=$?
  trap - EXIT
  if ! cleanup_resources; then
    status=1
  fi
  exit "$status"
}
trap cleanup_on_exit EXIT

for job in "${CAPTURE_JOB_NAMES[@]}"; do
  if ! NODE_NAME="$(kubectl get job "$job" -n "$NAMESPACE" \
    -o jsonpath='{.spec.template.spec.nodeName}')"; then
    die "could not read the node for Job '$job'"
  fi
  if ! RUN_ID="$(kubectl get job "$job" -n "$NAMESPACE" \
    -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="RUN_ID")].value}')"; then
    die "could not read the run identity for Job '$job'"
  fi
  valid_node_name "$NODE_NAME" || die "Job '$job' returned an invalid node name"
  valid_run_id "$RUN_ID" || die "Job '$job' returned an invalid run identity"
  [ "$RUN_ID" = "$RETRIEVE_RUN_ID" ] || die "Job '$job' does not match the requested run"

  if ! POD_NAME="$(kubectl get pods -n "$NAMESPACE" -l "job-name=${job}" \
    -o jsonpath='{.items[0].metadata.name}')"; then
    die "could not find the capture pod for Job '$job'"
  fi
  [ -n "$POD_NAME" ] || die "no capture pod found for Job '$job'"
  if ! POD_STATUS="$(kubectl get pod "$POD_NAME" -n "$NAMESPACE" \
    -o jsonpath='{.status.phase}')"; then
    die "could not read capture pod status"
  fi
  [ "$POD_STATUS" = "Succeeded" ] \
    || die "capture pod '$POD_NAME' did not succeed; inspect its logs before retrying"

  capture_slug="$(printf '%s' "$CAPTURE_NAME" | cut -c1-20)"
  node_slug="$(printf '%s' "$NODE_NAME" | tr '._' '--' | cut -c1-20)"
  if ! TEMP_POD_NAME="$(kubectl create -f - -o jsonpath='{.metadata.name}' <<EOF
apiVersion: v1
kind: Pod
metadata:
  generateName: retrieve-${capture_slug}-${node_slug}-
  namespace: ${NAMESPACE}
  labels: { app: aks-network-capture, capture-id: "${CAPTURE_NAME}", role: retrieval }
spec:
  hostNetwork: true
  nodeName: "${NODE_NAME}"
  restartPolicy: Never
  containers:
  - name: retrieve
    image: mcr.microsoft.com/cbl-mariner/busybox:2.0@sha256:e4fb4d51fc9b70d6cdc1ce66a0af02ab40554d2ca632e1d188fabc760e432fdd
    command: ["sh", "-c", "sleep 300"]
    volumeMounts:
    - name: capture-output
      mountPath: /capture-root
  volumes:
  - name: capture-output
    hostPath:
      path: ${OUTPUT_PATH}/${CAPTURE_NAME}
      type: Directory
EOF
)"; then
    die "failed to create a retrieval pod on node '$NODE_NAME'"
  fi
  [ -n "$TEMP_POD_NAME" ] || die "Kubernetes did not return a retrieval pod name"
  TEMP_PODS+=("$TEMP_POD_NAME")

  kubectl wait -n "$NAMESPACE" --for=condition=Ready \
    "pod/${TEMP_POD_NAME}" --timeout=60s

  BUNDLE_NAME="capture-${CAPTURE_NAME}-${NODE_NAME}-${RUN_ID}.tar.gz"
  RUN_DIR="/capture-root/${RUN_ID}"
  kubectl cp -n "$NAMESPACE" "${TEMP_POD_NAME}:${RUN_DIR}/${BUNDLE_NAME}" \
    "${CAPTURE_OUTPUT_DIR}/${BUNDLE_NAME}" -c retrieve
  [ -s "${CAPTURE_OUTPUT_DIR}/${BUNDLE_NAME}" ] \
    || die "the copied capture bundle '$BUNDLE_NAME' is empty"

  # Positional arguments keep validated values out of the fixed remote command.
  # shellcheck disable=SC2016
  kubectl exec -n "$NAMESPACE" "$TEMP_POD_NAME" -c retrieve -- sh -c \
    'rm -f "$1/$2" "$1/$3" && rmdir "$1"' sh \
    "$RUN_DIR" "$BUNDLE_NAME" "capture-${CAPTURE_NAME}-${NODE_NAME}-${RUN_ID}.pcap"
  kubectl delete pod "$TEMP_POD_NAME" -n "$NAMESPACE" --ignore-not-found
done

cleanup_resources || die "failed to clean up one or more capture resources"
trap - EXIT

echo "Capture bundles saved to: $CAPTURE_OUTPUT_DIR"
ls -lh "$CAPTURE_OUTPUT_DIR"
