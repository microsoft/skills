#!/usr/bin/env bash
# Generate bounded test traffic from a pod network namespace.
# Exit codes: 0 = success/help, 1 = execution failure, 2 = usage/argument error.
set -euo pipefail

DEBUG_IMAGE="mcr.microsoft.com/cbl-mariner/busybox:2.0@sha256:e4fb4d51fc9b70d6cdc1ce66a0af02ab40554d2ca632e1d188fabc760e432fdd"

TRAFFIC_TYPE="http"
TARGET=""
TARGET_PORT=""
SOURCE_POD=""
SOURCE_NAMESPACE="default"
DURATION="30s"
INTERVAL="1"
ALLOW_DEBUG_CONTAINER=0

usage() {
  cat <<EOF
Usage: $0 --source-pod <pod> --target <ip-or-hostname> [options]

Required:
  --source-pod <name>       Source pod
  --target <host>           Target IP address or hostname

Options:
  --type <type>             http, https, dns, tcp, or ping (default: http)
  --target-port <1-65535>   Target port; required for tcp
  --source-namespace <ns>   Source namespace (default: default)
  --duration <Ns|Nm|Nh>     Duration (default: 30s; maximum: 1h)
  --interval <seconds>      Whole seconds between attempts (default: 1)
  --allow-debug-container   Use an ephemeral debug container after separate approval
  -h, --help                Show this help
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
  valid_single_line "$1" && [ "${#1}" -le 253 ] \
    && printf '%s' "$1" \
      | grep -Eq '^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$'
}

valid_host() {
  valid_single_line "$1" && [ "${#1}" -le 253 ] \
    && printf '%s' "$1" | grep -Eq '^[A-Za-z0-9._:-]+$'
}

valid_uint() {
  valid_single_line "$1" && printf '%s' "$1" | grep -Eq '^[0-9]+$'
}

valid_duration() {
  valid_single_line "$1" && printf '%s' "$1" | grep -Eq '^[0-9]+[smh]$'
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

while [ "$#" -gt 0 ]; do
  case "$1" in
    --source-pod)
      require_value "$@"; SOURCE_POD="$2"; shift 2 ;;
    --source-namespace)
      require_value "$@"; SOURCE_NAMESPACE="$2"; shift 2 ;;
    --target)
      require_value "$@"; TARGET="$2"; shift 2 ;;
    --target-port)
      require_value "$@"; TARGET_PORT="$2"; shift 2 ;;
    --type)
      require_value "$@"; TRAFFIC_TYPE="$2"; shift 2 ;;
    --duration)
      require_value "$@"; DURATION="$2"; shift 2 ;;
    --interval)
      require_value "$@"; INTERVAL="$2"; shift 2 ;;
    --allow-debug-container)
      ALLOW_DEBUG_CONTAINER=1; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      usage_error "unknown option: $1" ;;
  esac
done

[ -n "$SOURCE_POD" ] || usage_error "--source-pod is required"
[ -n "$TARGET" ] || usage_error "--target is required"
valid_rfc1123 "$SOURCE_POD" || usage_error "--source-pod must be a DNS subdomain"
valid_rfc1123 "$SOURCE_NAMESPACE" || usage_error "--source-namespace must be a DNS subdomain"
valid_host "$TARGET" || usage_error "--target has invalid characters"
valid_duration "$DURATION" || usage_error "--duration must look like 30s, 5m, or 1h"
DURATION_SECONDS="$(duration_to_seconds "$DURATION")"
[ "$DURATION_SECONDS" -ge 1 ] && [ "$DURATION_SECONDS" -le 3600 ] \
  || usage_error "--duration must be between 1s and 1h"
valid_uint "$INTERVAL" || usage_error "--interval must be a non-negative integer"

case "$TRAFFIC_TYPE" in
  dns) TARGET_PORT="${TARGET_PORT:-53}" ;;
  https) TARGET_PORT="${TARGET_PORT:-443}" ;;
  http) TARGET_PORT="${TARGET_PORT:-80}" ;;
  tcp) [ -n "$TARGET_PORT" ] || usage_error "--target-port is required for tcp" ;;
  ping) TARGET_PORT="0" ;;
  *) usage_error "--type must be one of: http https dns tcp ping" ;;
esac
valid_uint "$TARGET_PORT" || usage_error "--target-port must be an integer"
if [ "$TRAFFIC_TYPE" != "ping" ]; then
  [ "$TARGET_PORT" -ge 1 ] && [ "$TARGET_PORT" -le 65535 ] \
    || usage_error "--target-port must be between 1 and 65535"
fi

command -v kubectl >/dev/null 2>&1 || die "kubectl is not installed or not on PATH"

# This fixed script must expand only inside the target pod.
# shellcheck disable=SC2016
POD_SCRIPT='
set -u
target="$1"; port="$2"; duration="$3"; interval="$4"; traffic_type="$5"
case "$target" in *:*) url_host="[$target]";; *) url_host="$target";; esac
end=$(( $(date +%s) + duration ))
while [ "$(date +%s)" -lt "$end" ]; do
  case "$traffic_type" in
    http)  wget -q -O /dev/null -T 5 "http://$url_host:$port/" && echo "http ok" || echo "http fail" ;;
    https) wget -q -O /dev/null -T 5 --no-check-certificate "https://$url_host:$port/" && echo "https ok" || echo "https fail" ;;
    dns)   nslookup "$target" >/dev/null 2>&1 && echo "dns ok" || echo "dns fail" ;;
    tcp)   nc -z -w 5 "$target" "$port" && echo "tcp ok" || echo "tcp fail" ;;
    ping)  ping -c 1 -W 5 "$target" >/dev/null 2>&1 && echo "ping ok" || echo "ping fail" ;;
  esac
  [ "$interval" -eq 0 ] || sleep "$interval"
done
'

echo "Generating $TRAFFIC_TYPE traffic from $SOURCE_POD to $TARGET for ${DURATION_SECONDS}s"
if kubectl exec -n "$SOURCE_NAMESPACE" "$SOURCE_POD" -- sh -c 'exit 0' >/dev/null 2>&1; then
  kubectl exec -n "$SOURCE_NAMESPACE" "$SOURCE_POD" -- \
    sh -c "$POD_SCRIPT" _ "$TARGET" "$TARGET_PORT" "$DURATION_SECONDS" "$INTERVAL" "$TRAFFIC_TYPE"
else
  [ "$ALLOW_DEBUG_CONTAINER" -eq 1 ] || die \
    "direct pod exec is unavailable; obtain separate approval before retrying with --allow-debug-container"
  if ! target_container="$(kubectl get pod -n "$SOURCE_NAMESPACE" "$SOURCE_POD" \
    -o jsonpath='{.spec.containers[0].name}')"; then
    die "could not resolve the source pod container"
  fi
  [ -n "$target_container" ] || die "source pod has no application container"
  kubectl debug -n "$SOURCE_NAMESPACE" "$SOURCE_POD" \
    --image="$DEBUG_IMAGE" --target="$target_container" -q -- \
    sh -c "$POD_SCRIPT" _ "$TARGET" "$TARGET_PORT" "$DURATION_SECONDS" "$INTERVAL" "$TRAFFIC_TYPE"
fi

echo "Traffic generation complete"
