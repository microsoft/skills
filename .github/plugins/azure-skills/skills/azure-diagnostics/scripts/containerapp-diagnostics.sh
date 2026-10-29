#!/usr/bin/env bash
# containerapp-diagnostics.sh
# Collects diagnostic information for an Azure Container App in one pass and
# prints it as clearly labeled sections: revisions, registry config, ingress
# config, and recent logs. The script only gathers and labels output; it does
# not interpret the results.
#
# Usage:
#   ./containerapp-diagnostics.sh --name <app> --resource-group <rg> [--subscription <id>]
#   ./containerapp-diagnostics.sh <app> <rg> [subscription-id]
#
# Examples:
#   ./containerapp-diagnostics.sh --name my-app --resource-group my-rg
#   ./containerapp-diagnostics.sh my-app my-rg
#
# Exit codes: 0 = completed, 1 = collection failure, 2 = invalid arguments.

set -euo pipefail

APP=""
RG=""
SUBSCRIPTION=""

usage() {
    echo "Usage: $0 --name <app> --resource-group <rg> [--subscription <id>]" >&2
}

# Requires a value to follow the given flag; errors out otherwise.
require_value() {
    if [ "$2" -lt 2 ]; then
        echo "Error: option '$1' requires a value." >&2
        usage
        exit 2
    fi
}

# Support both --flag and positional styles.
POSITIONAL=()
while [ $# -gt 0 ]; do
    case "$1" in
        --name|-n)             require_value "$1" "$#"; APP="$2"; shift 2 ;;
        --resource-group|-g)   require_value "$1" "$#"; RG="$2"; shift 2 ;;
        --subscription|-s)     require_value "$1" "$#"; SUBSCRIPTION="$2"; shift 2 ;;
        -h|--help)             usage; exit 0 ;;
        --*|-?)                echo "Error: unknown option '$1'." >&2; usage; exit 2 ;;
        *)                     POSITIONAL+=("$1"); shift ;;
    esac
done

if [ -z "$APP" ] && [ "${#POSITIONAL[@]}" -ge 1 ]; then APP="${POSITIONAL[0]}"; fi
if [ -z "$RG" ] && [ "${#POSITIONAL[@]}" -ge 2 ]; then RG="${POSITIONAL[1]}"; fi
if [ -z "$SUBSCRIPTION" ] && [ "${#POSITIONAL[@]}" -ge 3 ]; then SUBSCRIPTION="${POSITIONAL[2]}"; fi

if [ -z "$APP" ] || [ -z "$RG" ]; then
    usage
    exit 2
fi

SUB_ARGS=()
if [ -n "$SUBSCRIPTION" ]; then SUB_ARGS=(--subscription "$SUBSCRIPTION"); fi
COLLECTION_FAILED=0

run_step() {
    local failure_message="$1"
    shift
    if ! "$@"; then
        echo "$failure_message" >&2
        COLLECTION_FAILED=1
    fi
}

echo "=== Container App Diagnostics: $APP (resource group: $RG) ==="
echo "Collecting revisions, registry/ingress configuration, and recent logs."
echo ""

echo "--- Revisions ---"
run_step "(failed to list revisions)" \
    az containerapp revision list --name "$APP" -g "$RG" ${SUB_ARGS[@]+"${SUB_ARGS[@]}"} -o table
echo ""

echo "--- Registry Config ---"
run_step "(failed to read registry config)" \
    az containerapp show --name "$APP" -g "$RG" ${SUB_ARGS[@]+"${SUB_ARGS[@]}"} \
    --query "properties.configuration.registries"
echo ""

echo "--- Ingress Config ---"
run_step "(failed to read ingress config)" \
    az containerapp show --name "$APP" -g "$RG" ${SUB_ARGS[@]+"${SUB_ARGS[@]}"} \
    --query "properties.configuration.ingress"
echo ""

echo "--- Recent Logs (last 20 lines) ---"
run_step "(failed to read logs)" \
    az containerapp logs show --name "$APP" -g "$RG" ${SUB_ARGS[@]+"${SUB_ARGS[@]}"} --tail 20
echo ""

echo "=== Diagnostics collection complete for $APP ==="
exit "$COLLECTION_FAILED"
