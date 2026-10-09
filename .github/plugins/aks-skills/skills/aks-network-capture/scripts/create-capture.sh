#!/usr/bin/env bash
# Create bounded packet-capture Jobs on selected AKS nodes.
# Exit codes: 0 = success/help, 1 = execution failure, 2 = usage/argument error.
set -euo pipefail

CAPTURE_IMAGE="mcr.microsoft.com/containernetworking/retina-shell:v1.2.3@sha256:c7dfe8e0c0dc7fa28e4cfbad04ade270c3051c42a5495488d4d897b49fb3366f"
CONFIGMAP_NAME="network-capture-scripts"
OUTPUT_BASE="/var/log/aks-network-captures"
CAPTURE_MOUNT_PATH="/capture-output"
MAX_DURATION_SECONDS=1800

CAPTURE_NAME=""
DURATION="60s"
NODE_SELECTOR="kubernetes.io/os=linux"
NODE_NAMES=""
POD_SELECTOR=""
POD_NAMES=""
POD_SELECTOR_SET=0
POD_NAMES_SET=0
NAMESPACE="default"
TCPDUMP_FILTER=""
PACKET_SIZE="0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<EOF
Usage: $0 --name <capture-name> [options]

Required:
  --name <string>              Capture name (RFC 1123 label)

Target selection:
  --node-selector <key=val>    Node selector (default: kubernetes.io/os=linux)
  --node-names <n1,n2>         Comma-separated node names
  --pod-selector <key=val>     Pod selector; resolves pods to nodes and IPs
  --pod-names <p1,p2>          Comma-separated pod names
  --namespace <string>         Pod, ConfigMap, and Job namespace (default: default)

Capture configuration:
  --duration <Ns|Nm|Nh>        Duration (default: 60s; maximum: 1800s)
  --packet-size <bytes>        Snapshot length (default: 0, full packet)
  --tcpdump-filter <expr>      Plain BPF expression; no flags or metacharacters
  -h, --help                   Show this help
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

valid_label_selector() {
  valid_single_line "$1" \
    && printf '%s' "$1" | grep -Eq '^[A-Za-z0-9._/=,!()-]+$'
}

valid_duration() {
  valid_single_line "$1" && printf '%s' "$1" | grep -Eq '^[0-9]+[smh]$'
}

valid_uint() {
  valid_single_line "$1" && printf '%s' "$1" | grep -Eq '^[0-9]+$'
}

duration_to_seconds() {
  local duration="$1"
  local number="${duration%[smh]}"
  local unit="${duration##*[0-9]}"
  number=$((10#$number))
  case "$unit" in
    s) printf '%s\n' "$number" ;;
    m) printf '%s\n' "$((number * 60))" ;;
    h) printf '%s\n' "$((number * 3600))" ;;
  esac
}

validate_filter() {
  local filter="$1"
  local token
  [ -z "$filter" ] && return 0
  [ "${#filter}" -le 1024 ] || usage_error "--tcpdump-filter exceeds 1024 characters"
  valid_single_line "$filter" || usage_error "--tcpdump-filter must be a single line"
  printf '%s' "$filter" | grep -Eq '^[A-Za-z0-9 ._:/()&|<>=!-]+$' \
    || usage_error "--tcpdump-filter contains disallowed characters"
  for token in $filter; do
    case "$token" in
      -*) usage_error "--tcpdump-filter may not contain flag tokens" ;;
    esac
  done
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --name)
      require_value "$@"; CAPTURE_NAME="$2"; shift 2 ;;
    --duration)
      require_value "$@"; DURATION="$2"; shift 2 ;;
    --node-selector)
      require_value "$@"; NODE_SELECTOR="$2"; shift 2 ;;
    --node-names)
      require_value "$@"; NODE_NAMES="$2"; shift 2 ;;
    --pod-selector)
      require_value "$@"; POD_SELECTOR_SET=1; POD_SELECTOR="$2"; shift 2 ;;
    --pod-names)
      require_value "$@"; POD_NAMES_SET=1; POD_NAMES="$2"; shift 2 ;;
    --namespace)
      require_value "$@"; NAMESPACE="$2"; shift 2 ;;
    --tcpdump-filter)
      require_value "$@"; TCPDUMP_FILTER="$2"; shift 2 ;;
    --packet-size)
      require_value "$@"; PACKET_SIZE="$2"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      usage_error "unknown option: $1" ;;
  esac
done

[ -n "$CAPTURE_NAME" ] || usage_error "--name is required"
valid_rfc1123 "$CAPTURE_NAME" || usage_error "--name must be an RFC 1123 label"
valid_duration "$DURATION" || usage_error "--duration must look like 30s, 5m, or 1h"
DURATION_SECONDS="$(duration_to_seconds "$DURATION")"
[ "$DURATION_SECONDS" -ge 1 ] && [ "$DURATION_SECONDS" -le "$MAX_DURATION_SECONDS" ] \
  || usage_error "--duration must be between 1s and ${MAX_DURATION_SECONDS}s"
valid_uint "$PACKET_SIZE" || usage_error "--packet-size must be a non-negative integer"
[ "$PACKET_SIZE" -le 262144 ] || usage_error "--packet-size exceeds 262144 bytes"
valid_label_selector "$NODE_SELECTOR" || usage_error "--node-selector has invalid characters"
[ "$POD_SELECTOR_SET" -eq 0 ] || valid_label_selector "$POD_SELECTOR" \
  || usage_error "--pod-selector has invalid characters"
[ "$POD_NAMES_SET" -eq 0 ] || [ -n "$POD_NAMES" ] \
  || usage_error "--pod-names must not be empty"
valid_rfc1123 "$NAMESPACE" || usage_error "--namespace must be an RFC 1123 label"
validate_filter "$TCPDUMP_FILTER"

selection_count=0
[ -n "$NODE_NAMES" ] && selection_count=$((selection_count + 1))
[ "$POD_SELECTOR_SET" -eq 1 ] && selection_count=$((selection_count + 1))
[ "$POD_NAMES_SET" -eq 1 ] && selection_count=$((selection_count + 1))
[ "$selection_count" -le 1 ] \
  || usage_error "choose only one of --node-names, --pod-selector, or --pod-names"

command -v kubectl >/dev/null 2>&1 || die "kubectl is not installed or not on PATH"
command -v od >/dev/null 2>&1 || die "od is not installed or not on PATH"

if ! DEPLOYED_RUNNER="$(kubectl get configmap "$CONFIGMAP_NAME" -n "$NAMESPACE" \
  -o go-template='{{ index .data "run-capture.sh" }}')"; then
  die "ConfigMap '$CONFIGMAP_NAME' was not found; run setup-capture-configmap first"
fi
if ! LOCAL_RUNNER="$(cat "${SCRIPT_DIR}/run-capture.sh")"; then
  die "could not read the local capture runner"
fi
[ -n "$DEPLOYED_RUNNER" ] && [ "$DEPLOYED_RUNNER" = "$LOCAL_RUNNER" ] \
  || die "ConfigMap '$CONFIGMAP_NAME' is stale; run setup-capture-configmap again"

POD_IP_FILTER=""
TARGET_NODES=()

resolve_pod_targets() {
  local jsonpath
  local output
  local pod
  local node
  local ip_list
  local ip
  local ip_count
  local ips=""
  local pods=()
  jsonpath='{range .items[*]}{.metadata.name}{"|"}{.spec.nodeName}{"|"}{range .status.podIPs[*]}{.ip}{","}{end}{"\n"}{end}'

  if [ "$POD_NAMES_SET" -eq 1 ]; then
    IFS=',' read -r -a pods <<<"$POD_NAMES"
    for pod in "${pods[@]}"; do
      valid_rfc1123 "$pod" || usage_error "pod name '$pod' is not an RFC 1123 label"
    done
    if ! output="$(kubectl get pods -n "$NAMESPACE" "${pods[@]}" -o jsonpath="$jsonpath")"; then
      die "could not resolve the selected pods"
    fi
  else
    if ! output="$(kubectl get pods -n "$NAMESPACE" -l "$POD_SELECTOR" \
      -o jsonpath="$jsonpath")"; then
      die "could not resolve the pod selector"
    fi
  fi

  while IFS='|' read -r pod node ip_list; do
    [ -n "$pod" ] || continue
    [ -n "$node" ] || die "selected pod '$pod' is not scheduled"
    [ -n "$ip_list" ] || die "selected pod '$pod' has no assigned IP"
    TARGET_NODES+=("$node")
    IFS=',' read -r -a pod_ips <<<"$ip_list"
    ip_count=0
    for ip in "${pod_ips[@]}"; do
      [ -n "$ip" ] || continue
      case "$ip" in
        *[!A-Fa-f0-9.:]*) die "pod '$pod' returned an invalid IP address" ;;
      esac
      ips="${ips:+$ips or }host $ip"
      ip_count=$((ip_count + 1))
    done
    [ "$ip_count" -gt 0 ] || die "selected pod '$pod' has no assigned IP"
  done <<<"$output"

  [ "${#TARGET_NODES[@]}" -gt 0 ] || die "no pods matched the selection"
  POD_IP_FILTER="($ips)"
}

if [ "$POD_SELECTOR_SET" -eq 1 ] || [ "$POD_NAMES_SET" -eq 1 ]; then
  resolve_pod_targets
elif [ -n "$NODE_NAMES" ]; then
  IFS=',' read -r -a TARGET_NODES <<<"$NODE_NAMES"
else
  if ! node_output="$(kubectl get nodes -l "$NODE_SELECTOR" \
    -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}')"; then
    die "could not resolve the node selector"
  fi
  while IFS= read -r node; do
    [ -n "$node" ] && TARGET_NODES+=("$node")
  done <<<"$node_output"
fi

[ "${#TARGET_NODES[@]}" -gt 0 ] || die "no nodes matched the selection"
UNIQUE_TARGET_NODES=()
for node in "${TARGET_NODES[@]}"; do
  [ -n "$node" ] || die "node selection returned an empty node name"
  valid_node_name "$node" || usage_error "node name '$node' is invalid"
  seen=0
  if [ "${#UNIQUE_TARGET_NODES[@]}" -gt 0 ]; then
    for existing in "${UNIQUE_TARGET_NODES[@]}"; do
      if [ "$node" = "$existing" ]; then
        seen=1
        break
      fi
    done
  fi
  [ "$seen" -eq 1 ] || UNIQUE_TARGET_NODES+=("$node")
done
TARGET_NODES=("${UNIQUE_TARGET_NODES[@]}")

EFFECTIVE_FILTER="$TCPDUMP_FILTER"
if [ -n "$POD_IP_FILTER" ]; then
  if [ -n "$EFFECTIVE_FILTER" ]; then
    EFFECTIVE_FILTER="($EFFECTIVE_FILTER) and $POD_IP_FILTER"
  else
    EFFECTIVE_FILTER="$POD_IP_FILTER"
  fi
fi

TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
if ! RUN_TOKEN="$(LC_ALL=C od -An -N12 -tx1 /dev/urandom | tr -d ' \n')"; then
  die "failed to generate the capture run identity"
fi
[ "${#RUN_TOKEN}" -eq 24 ] || die "failed to generate the capture run identity"
RUN_ID="${TIMESTAMP}-${RUN_TOKEN}"
CAPTURE_OUTPUT_PATH="${OUTPUT_BASE}/${CAPTURE_NAME}/${RUN_ID}"
CREATED_JOBS=()

cleanup_partial_jobs() {
  local status=$?
  trap - EXIT
  if [ "$status" -ne 0 ] && [ "${#CREATED_JOBS[@]}" -gt 0 ]; then
    echo "Capture creation failed; removing partially created Jobs" >&2
    if ! kubectl delete jobs -n "$NAMESPACE" "${CREATED_JOBS[@]}" \
      --ignore-not-found >/dev/null; then
      echo "Error: failed to remove one or more partially created Jobs" >&2
      status=1
    fi
  fi
  exit "$status"
}
trap cleanup_partial_jobs EXIT

echo "Creating capture '$CAPTURE_NAME' on ${#TARGET_NODES[@]} node(s)"
for node in "${TARGET_NODES[@]}"; do
  node_slug="$(printf '%s' "$node" | tr '._' '--' | cut -c1-40 | sed 's/-*$//')"
  capture_slug="$(printf '%s' "$CAPTURE_NAME" | cut -c1-15 | sed 's/-*$//')"
  node_prefix="$(printf '%s' "$node_slug" | cut -c1-8 | sed 's/-*$//')"
  job_prefix="${capture_slug}-${node_prefix}-${RUN_TOKEN}-"

  if ! created_job="$(kubectl create -f - -o jsonpath='{.metadata.name}' <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  generateName: ${job_prefix}
  namespace: ${NAMESPACE}
  labels: { app: aks-network-capture, capture-id: "${CAPTURE_NAME}", capture-node: "${node_slug}", capture-run: "${RUN_ID}" }
spec:
  ttlSecondsAfterFinished: 3600
  backoffLimit: 0
  template:
    metadata:
      labels: { app: aks-network-capture, capture-id: "${CAPTURE_NAME}", capture-run: "${RUN_ID}" }
    spec:
      hostNetwork: true
      nodeName: "${node}"
      restartPolicy: Never
      terminationGracePeriodSeconds: ${MAX_DURATION_SECONDS}
      containers:
      - name: capture
        image: "${CAPTURE_IMAGE}"
        securityContext:
          privileged: false
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsUser: 0
          capabilities:
            drop: ["ALL"]
            add: ["NET_ADMIN", "NET_RAW"]
        env:
        - { name: PCAP_FILTER, value: "${EFFECTIVE_FILTER}" }
        - { name: CAPTURE_DURATION, value: "${DURATION_SECONDS}" }
        - { name: PACKET_SIZE, value: "${PACKET_SIZE}" }
        - { name: OUT_DIR, value: "${CAPTURE_MOUNT_PATH}" }
        - { name: CAPTURE_ID, value: "${CAPTURE_NAME}" }
        - { name: RUN_ID, value: "${RUN_ID}" }
        - { name: NODE_NAME, valueFrom: { fieldRef: { fieldPath: spec.nodeName } } }
        command: ["/bin/sh", "/capture-scripts/run-capture.sh"]
        volumeMounts:
        - { name: capture-output, mountPath: "${CAPTURE_MOUNT_PATH}" }
        - { name: capture-scripts, mountPath: /capture-scripts, readOnly: true }
      volumes:
      - name: capture-output
        hostPath: { path: "${CAPTURE_OUTPUT_PATH}", type: DirectoryOrCreate }
      - name: capture-scripts
        configMap:
          name: ${CONFIGMAP_NAME}
          defaultMode: 0555
EOF
)"; then
    die "failed to create a capture Job for node '$node'"
  fi
  [ -n "$created_job" ] || die "Kubernetes did not return the created Job name"
  CREATED_JOBS+=("$created_job")
  echo "Job created for node: $node ($created_job)"
done

trap - EXIT
cat <<EOF

Capture started.
Run ID: ${RUN_ID}
Monitor: kubectl get jobs -n ${NAMESPACE} -l capture-id=${CAPTURE_NAME} -w
Retrieve: ./scripts/retrieve-captures.sh --name ${CAPTURE_NAME} --run-id ${RUN_ID} --namespace ${NAMESPACE}
Bundles: ${CAPTURE_OUTPUT_PATH}
EOF
