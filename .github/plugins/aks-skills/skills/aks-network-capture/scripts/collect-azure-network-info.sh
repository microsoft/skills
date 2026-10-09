#!/usr/bin/env bash
# Collect Azure network resource configuration for an AKS cluster.
# Exit codes: 0 = success/help, 1 = collection failure, 2 = usage/argument error.
set -euo pipefail

export AZURE_HTTP_USER_AGENT="${AZURE_HTTP_USER_AGENT:+$AZURE_HTTP_USER_AGENT }AKS-Skills"

RESOURCE_GROUP=""
CLUSTER_NAME=""
OUTPUT_DIR="${WORKSPACE_DIR:-./aks-network-captures}/network-captures"

usage() {
  cat <<EOF
Usage: $0 --resource-group <rg> --cluster-name <name> [options]

Required:
  --resource-group <string>  Resource group containing the AKS cluster
  --cluster-name <string>    AKS cluster name

Options:
  --output-dir <path>        Output directory (default: ${OUTPUT_DIR})
  -h, --help                 Show this help
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

single_line() {
  case "$1" in
    *$'\r'*|*$'\n'*) return 1 ;;
  esac
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --resource-group)
      require_value "$@"
      RESOURCE_GROUP="$2"
      shift 2
      ;;
    --cluster-name)
      require_value "$@"
      CLUSTER_NAME="$2"
      shift 2
      ;;
    --output-dir)
      require_value "$@"
      OUTPUT_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage_error "unknown option: $1"
      ;;
  esac
done

[ -n "$RESOURCE_GROUP" ] || usage_error "--resource-group is required"
[ -n "$CLUSTER_NAME" ] || usage_error "--cluster-name is required"
single_line "$RESOURCE_GROUP" || usage_error "--resource-group must be a single line"
single_line "$CLUSTER_NAME" || usage_error "--cluster-name must be a single line"
case "$CLUSTER_NAME" in
  *[!A-Za-z0-9_-]*|_*|-*|*_|*-) usage_error "--cluster-name has an invalid format" ;;
esac
single_line "$OUTPUT_DIR" || usage_error "--output-dir must be a single line"

command -v az >/dev/null 2>&1 || die "Azure CLI (az) is not installed or not on PATH"
command -v jq >/dev/null 2>&1 || die "jq is not installed or not on PATH"

if ! az account show --output none; then
  die "not logged in to Azure CLI; run 'az login' first"
fi

if ! NODE_RESOURCE_GROUP="$(az aks show --resource-group "$RESOURCE_GROUP" \
  --name "$CLUSTER_NAME" --query nodeResourceGroup -o tsv)"; then
  die "could not retrieve AKS cluster information"
fi
[ -n "$NODE_RESOURCE_GROUP" ] || die "AKS cluster has no node resource group"

if ! VNET_SUBNET_ID="$(az aks show --resource-group "$RESOURCE_GROUP" \
  --name "$CLUSTER_NAME" --query 'agentPoolProfiles[0].vnetSubnetId' -o tsv)"; then
  die "could not retrieve the AKS subnet"
fi
if ! NETWORK_PLUGIN="$(az aks show --resource-group "$RESOURCE_GROUP" \
  --name "$CLUSTER_NAME" --query networkProfile.networkPlugin -o tsv)"; then
  die "could not retrieve the AKS network plugin"
fi
if ! NETWORK_POLICY="$(az aks show --resource-group "$RESOURCE_GROUP" \
  --name "$CLUSTER_NAME" --query 'networkProfile.networkPolicy' -o tsv)"; then
  die "could not retrieve the AKS network policy"
fi
NETWORK_POLICY="${NETWORK_POLICY:-none}"

TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
OUTPUT_FILE="${OUTPUT_DIR}/azure-network-info-${CLUSTER_NAME}-${TIMESTAMP}.json"
mkdir -p "$OUTPUT_DIR"

jq -n \
  --arg name "$CLUSTER_NAME" \
  --arg resourceGroup "$RESOURCE_GROUP" \
  --arg nodeResourceGroup "$NODE_RESOURCE_GROUP" \
  --arg networkPlugin "$NETWORK_PLUGIN" \
  --arg networkPolicy "$NETWORK_POLICY" \
  --arg timestamp "$TIMESTAMP" \
  '{
    cluster: {
      name: $name,
      resourceGroup: $resourceGroup,
      nodeResourceGroup: $nodeResourceGroup,
      networkPlugin: $networkPlugin,
      networkPolicy: $networkPolicy,
      timestamp: $timestamp
    },
    vnet: {},
    subnets: [],
    nodeSubnet: {},
    nsgs: [],
    routeTables: [],
    loadBalancers: [],
    publicIPs: [],
    vnetPeerings: [],
    privateDnsZones: []
  }' >"$OUTPUT_FILE"

update_json() {
  local filter="$1"
  local value="$2"
  jq --argjson value "$value" "$filter" "$OUTPUT_FILE" >"${OUTPUT_FILE}.tmp"
  mv "${OUTPUT_FILE}.tmp" "$OUTPUT_FILE"
}

if [ -n "$VNET_SUBNET_ID" ]; then
  vnet_tail=${VNET_SUBNET_ID#*/virtualNetworks/}
  resource_group_tail=${VNET_SUBNET_ID#*/resourceGroups/}
  VNET_NAME=${vnet_tail%%/*}
  subnet_tail=${VNET_SUBNET_ID#*/subnets/}
  SUBNET_NAME=${subnet_tail%%/*}
  VNET_RG=${resource_group_tail%%/*}
  [ "$vnet_tail" != "$VNET_SUBNET_ID" ] \
    && [ "$subnet_tail" != "$VNET_SUBNET_ID" ] \
    && [ "$resource_group_tail" != "$VNET_SUBNET_ID" ] \
    || die "AKS returned an invalid VNET subnet resource ID"

  if ! VNET_INFO="$(az network vnet show --resource-group "$VNET_RG" \
    --name "$VNET_NAME" -o json)"; then
    die "could not collect VNET information"
  fi
  if ! SUBNETS="$(az network vnet subnet list --resource-group "$VNET_RG" \
    --vnet-name "$VNET_NAME" -o json)"; then
    die "could not collect subnet information"
  fi
  if ! NODE_SUBNET="$(az network vnet subnet show --resource-group "$VNET_RG" \
    --vnet-name "$VNET_NAME" --name "$SUBNET_NAME" \
    --query '{name:name,addressPrefix:addressPrefix,udr:routeTable,nsg:networkSecurityGroup,delegations:delegations,serviceEndpoints:serviceEndpoints,privateEndpointNetworkPolicies:privateEndpointNetworkPolicies}' \
    -o json)"; then
    die "could not collect the cluster subnet details"
  fi
  if ! PEERINGS="$(az network vnet peering list --resource-group "$VNET_RG" \
    --vnet-name "$VNET_NAME" -o json)"; then
    die "could not collect VNET peerings"
  fi

  update_json ".vnet = \$value" "$VNET_INFO"
  update_json ".subnets = \$value" "$SUBNETS"
  update_json ".nodeSubnet = \$value" "$NODE_SUBNET"
  update_json ".vnetPeerings = \$value" "$PEERINGS"
fi

if ! NSGS="$(az network nsg list --resource-group "$NODE_RESOURCE_GROUP" -o json)"; then
  die "could not collect network security groups"
fi
if ! ROUTE_TABLES="$(az network route-table list --resource-group "$NODE_RESOURCE_GROUP" -o json)"; then
  die "could not collect route tables"
fi
if ! LOAD_BALANCERS="$(az network lb list --resource-group "$NODE_RESOURCE_GROUP" -o json)"; then
  die "could not collect load balancers"
fi
if ! PUBLIC_IPS="$(az network public-ip list --resource-group "$NODE_RESOURCE_GROUP" -o json)"; then
  die "could not collect public IPs"
fi
if ! PRIVATE_DNS_ZONES="$(az network private-dns zone list -o json)"; then
  die "could not collect private DNS zones"
fi

update_json ".nsgs = \$value" "$NSGS"
update_json ".routeTables = \$value" "$ROUTE_TABLES"
update_json ".loadBalancers = \$value" "$LOAD_BALANCERS"
update_json ".publicIPs = \$value" "$PUBLIC_IPS"
update_json ".privateDnsZones = \$value" "$PRIVATE_DNS_ZONES"

echo "Azure network information saved to: $OUTPUT_FILE"
jq -r '
  "Cluster: \(.cluster.name)",
  "Network Plugin: \(.cluster.networkPlugin)",
  "Network Policy: \(.cluster.networkPolicy)",
  "NSGs: \(.nsgs | length)",
  "Route Tables: \(.routeTables | length)",
  "Load Balancers: \(.loadBalancers | length)",
  "Public IPs: \(.publicIPs | length)",
  "VNET Peerings: \(.vnetPeerings | length)",
  "Private DNS Zones: \(.privateDnsZones | length)"
' "$OUTPUT_FILE"
