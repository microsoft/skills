#!/usr/bin/env bash
# check-quota.sh
# Checks Azure quota limits and current usage for a resource provider.
# Returns a table with limit, usage, and available capacity for every quota
# (or a single quota when resource-name is provided).
#
# Usage:
#   ./check-quota.sh <resource-provider> <region> [resource-name] [subscription-id]
#
# Examples:
#   ./check-quota.sh Microsoft.Compute eastus                          # All compute quotas with usage
#   ./check-quota.sh Microsoft.Compute eastus standardDSv3Family       # Single quota with usage

set -euo pipefail

RESOURCE_PROVIDER="${1:?Usage: $0 <resource-provider> <region> [resource-name] [subscription-id]}"
REGION="${2:?Usage: $0 <resource-provider> <region> [resource-name] [subscription-id]}"
RESOURCE_NAME="${3:-}"
SUBSCRIPTION_ID="${4:-}"

# Ensure the quota extension is installed
if ! az extension list --query "[?name=='quota'].name" -o tsv 2>/dev/null | grep -q quota; then
    echo "Installing quota extension..."
    az extension add --name quota --yes 2>/dev/null
fi

# Resolve subscription
if [ -z "$SUBSCRIPTION_ID" ]; then
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
fi

SCOPE="/subscriptions/$SUBSCRIPTION_ID/providers/$RESOURCE_PROVIDER/locations/$REGION"

echo "Checking quotas in scope $SCOPE"

if [ -n "$RESOURCE_NAME" ]; then
    # Single-resource mode
    echo "Quota for '$RESOURCE_NAME' ($RESOURCE_PROVIDER, $REGION):"
    echo ""

    LIMIT=$(az quota show \
        --resource-name "$RESOURCE_NAME" \
        --scope "$SCOPE" \
        --query "properties.limit.value" -o tsv)

    USAGE=$(az quota usage show \
        --resource-name "$RESOURCE_NAME" \
        --scope "$SCOPE" \
        --query "properties.usages.value" -o tsv)

    AVAILABLE=$((LIMIT - USAGE))

    printf "%-30s %-10s %-10s %-10s %-10s\n" "Resource" "Region" "Limit" "Usage" "Available"
    printf "%-30s %-10s %-10s %-10s %-10s\n" "--------" "------" "-----" "-----" "---------"
    printf "%-30s %-10s %-10s %-10s %-10s\n" "$RESOURCE_NAME" "$REGION" "$LIMIT" "$USAGE" "$AVAILABLE"
else
    # All-quotas mode: fetch limits and usage, join by name
    echo "Quotas for $RESOURCE_PROVIDER in $REGION:"
    echo ""

    QUOTAS_JSON=$(az quota list --scope "$SCOPE" -o json 2>/dev/null)
    USAGES_JSON=$(az quota usage list --scope "$SCOPE" -o json 2>/dev/null)

    printf "%-40s %-10s %-10s %-10s %-10s\n" "Resource" "Region" "Limit" "Usage" "Available"
    printf "%-40s %-10s %-10s %-10s %-10s\n" "--------" "------" "-----" "-----" "---------"

    echo "$QUOTAS_JSON" | python3 -c "
import json, sys

quotas = json.load(sys.stdin)
usages = json.loads('''$USAGES_JSON''')

usage_lookup = {}
for u in usages:
    usage_lookup[u['name']] = u.get('properties', {}).get('usages', {}).get('value', 0)

for q in quotas:
    name = q['name']
    limit = q.get('properties', {}).get('limit', {}).get('value', 0)
    used = usage_lookup.get(name, 0)
    avail = limit - used
    print(f'{name:<40} $REGION{\"\":<4} {limit:<10} {used:<10} {avail:<10}')
"
fi
