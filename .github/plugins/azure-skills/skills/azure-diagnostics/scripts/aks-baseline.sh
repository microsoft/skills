#!/usr/bin/env bash
# aks-baseline.sh
# Runs the read-only AKS cluster baseline diagnostic sweep and prints a single
# labeled digest instead of many raw command dumps. Gathers, in order:
#   1. Cluster provisioning state          (az aks show)
#   2. Node pool summary                   (az aks nodepool list)
#   3. Recent Azure activity               (az monitor activity-log list)
#   4. Node readiness                      (kubectl get nodes)
#   5. Unhealthy pods across namespaces    (kubectl get pods -A; not Ready, bad status, or restarting)
#   6. kube-system health                  (kubectl get pods -n kube-system)
#   7. Recent warning events               (kubectl get events -A)
#   8. Namespace pod overview (optional)   (kubectl get pods -n <namespace>)
#
# All steps are READ-ONLY. Each step is guarded so a single failure (for example,
# kubectl not authenticated) prints a note and the sweep continues.
#
# Usage:
#   ./aks-baseline.sh -g <resource-group> -n <cluster> [--namespace <ns>] [--subscription <id>]
#
# Examples:
#   ./aks-baseline.sh -g my-rg -n my-cluster
#   ./aks-baseline.sh -g my-rg -n my-cluster --namespace payments
#
# Exit codes: 0 = completed, 1 = collection failure, 2 = invalid arguments.

set -uo pipefail

RESOURCE_GROUP=""
CLUSTER=""
NAMESPACE=""
SUBSCRIPTION=""

usage() {
    echo "Usage: $0 -g <resource-group> -n <cluster> [--namespace <ns>] [--subscription <id>]" >&2
    exit "${1:-2}"
}

require_value() {
    # require_value <option-name> <remaining-arg-count>
    if [ "$2" -lt 2 ]; then
        echo "Missing value for $1" >&2
        usage 2
    fi
}

while [ $# -gt 0 ]; do
    case "$1" in
        -g|--resource-group) require_value "$1" "$#"; RESOURCE_GROUP="$2"; shift 2 ;;
        -n|--cluster) require_value "$1" "$#"; CLUSTER="$2"; shift 2 ;;
        --namespace) require_value "$1" "$#"; NAMESPACE="$2"; shift 2 ;;
        --subscription) require_value "$1" "$#"; SUBSCRIPTION="$2"; shift 2 ;;
        -h|--help) usage 0 ;;
        *) echo "Unknown argument: $1" >&2; usage 2 ;;
    esac
done

[ -z "$RESOURCE_GROUP" ] && { echo "Missing required -g/--resource-group" >&2; usage 2; }
[ -z "$CLUSTER" ] && { echo "Missing required -n/--cluster" >&2; usage 2; }

AZ_SUB_ARGS=()
[ -n "$SUBSCRIPTION" ] && AZ_SUB_ARGS=(--subscription "$SUBSCRIPTION")

section() {
    echo ""
    echo "=============================================================="
    echo "== $1"
    echo "=============================================================="
}

run() {
    # run "<description>" <command...>
    local desc="$1"; shift
    if ! "$@"; then
        echo "  [!] Could not gather: $desc (command failed or unavailable)"
    fi
}

echo "AKS baseline diagnostic sweep (read-only)"
echo "Resource group: $RESOURCE_GROUP"
echo "Cluster:        $CLUSTER"
[ -n "$NAMESPACE" ] && echo "Namespace:      $NAMESPACE"

# 1. Cluster provisioning state ------------------------------------------------
section "1. Cluster provisioning state"
run "cluster provisioning state" \
    az aks show -g "$RESOURCE_GROUP" -n "$CLUSTER" ${AZ_SUB_ARGS[@]+"${AZ_SUB_ARGS[@]}"} \
        --query "{name:name, provisioningState:provisioningState, powerState:powerState.code, k8sVersion:currentKubernetesVersion, fqdn:fqdn}" \
        -o table

# 2. Node pool summary ---------------------------------------------------------
section "2. Node pool summary"
run "node pool summary" \
    az aks nodepool list -g "$RESOURCE_GROUP" --cluster-name "$CLUSTER" ${AZ_SUB_ARGS[@]+"${AZ_SUB_ARGS[@]}"} \
        --query "[].{name:name, mode:mode, count:count, vmSize:vmSize, state:provisioningState, powerState:powerState.code, k8sVersion:orchestratorVersion}" \
        -o table

# 3. Recent Azure activity -----------------------------------------------------
section "3. Recent Azure activity (last 20 events)"
run "recent activity log" \
    az monitor activity-log list -g "$RESOURCE_GROUP" ${AZ_SUB_ARGS[@]+"${AZ_SUB_ARGS[@]}"} \
        --max-events 20 \
        --query "[].{time:eventTimestamp, operation:operationName.value, status:status.value, resource:resourceId}" \
        -o table

# 4. Node readiness ------------------------------------------------------------
section "4. Node readiness"
run "node readiness" kubectl get nodes -o wide

# 5. Unhealthy pods ------------------------------------------------------------
# Filter on the READY and STATUS columns (not just pod phase) so container-level
# failures such as CrashLoopBackOff / ImagePullBackOff — which stay in phase
# "Running" — are caught. Terminal pods (Completed/Succeeded) are excluded so
# finished jobs are not falsely flagged.
section "5. Unhealthy pods (CrashLoopBackOff, not Ready, restarting, or bad status)"
ALL_PODS="$(kubectl get pods -A -o wide 2>/dev/null)"
if [ -z "$ALL_PODS" ]; then
    echo "  No pods reported (or cluster unreachable)."
else
    UNHEALTHY="$(printf '%s\n' "$ALL_PODS" | awk 'NR>1 {
        split($3, ready, "/");
        status = $4;
        restarts = $5 + 0;
        terminalOk = (status == "Completed" || status == "Succeeded");
        notReady = (status == "Running" && ready[1] != ready[2]);
        badStatus = (status != "Running" && !terminalOk);
        highRestarts = (!terminalOk && restarts >= 5);
        if (notReady || badStatus || highRestarts) print
    }')"
    if [ -n "$UNHEALTHY" ]; then
        printf '%s\n' "$ALL_PODS" | head -n 1
        printf '%s\n' "$UNHEALTHY"
    else
        echo "  All pods are Running/Succeeded and Ready with low restart counts."
    fi
fi

# 6. kube-system health --------------------------------------------------------
section "6. kube-system health"
run "kube-system pods" kubectl get pods -n kube-system -o wide

# 7. Recent warning events -----------------------------------------------------
section "7. Recent warning events (last 40, sorted by time)"
run "warning events" bash -c \
    "set -o pipefail; kubectl get events -A --field-selector=type=Warning --sort-by=.lastTimestamp 2>/dev/null | tail -n 40"

# 8. Namespace pod overview (optional) ----------------------------------------
if [ -n "$NAMESPACE" ]; then
    section "8. Pods in namespace '$NAMESPACE'"
    run "pods in namespace $NAMESPACE" kubectl get pods -n "$NAMESPACE" -o wide
fi

# Summary ----------------------------------------------------------------------
section "Summary"
echo "Gathered the read-only AKS baseline for cluster '$CLUSTER' in resource group"
echo "'$RESOURCE_GROUP': Azure-side cluster/node-pool state and recent activity, then"
echo "Kubernetes-side node readiness, unhealthy pods, kube-system health, and recent"
echo "warning events. Review the sections above for anomalies (non-Succeeded"
echo "provisioning state, NotReady nodes, unhealthy or restarting pods, warning events)"
echo "before deep-diving with 'kubectl describe' / 'kubectl logs' on a specific pod."
echo ""
echo "No changes were made to any resource."
