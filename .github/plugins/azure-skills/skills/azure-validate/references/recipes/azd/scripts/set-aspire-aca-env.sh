#!/usr/bin/env bash
# Set the Container Apps environment variables that Aspire "limited mode" leaves unpopulated.
#
# When Aspire runs in "limited mode", `azd provision` creates the Azure resources
# (Container Registry, Managed Identity, Container Apps Environment) but does NOT populate the
# env vars that `azd deploy` needs to reference them. This script fills that gap.
#
# Run it AFTER `azd provision` but BEFORE `azd deploy`.
#
# USAGE:
#   ./set-aspire-aca-env.sh [-e <azd-env-name>]
#
#   -e, --environment   Optional azd environment name (forwarded to `azd env` calls).
#                       Defaults to the current/default azd environment.
#
# The script only sets a variable if it is currently missing, and prints what it did so the
# result can be understood without re-inspecting `azd env get-values`:
#   AZURE_CONTAINER_REGISTRY_ENDPOINT              <- az acr list ... [0].loginServer
#   AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID   <- az identity list ... [0].id
#   MANAGED_IDENTITY_CLIENT_ID                     <- az identity list ... [0].clientId

set -e

AZD_ENV_NAME=""
while [ $# -gt 0 ]; do
  case "$1" in
    -e|--environment)
      AZD_ENV_NAME="$2"
      shift 2
      ;;
    *)
      echo "ERROR: Unknown argument: $1" >&2
      echo "USAGE: ./set-aspire-aca-env.sh [-e <azd-env-name>]" >&2
      exit 1
      ;;
  esac
done

# Build the shared `-e <name>` argument list for azd calls (empty when no env name given).
AZD_ENV_ARGS=""
if [ -n "$AZD_ENV_NAME" ]; then
  AZD_ENV_ARGS="-e $AZD_ENV_NAME"
fi

# Capture azd environment values via command substitution so `set -e` aborts if the
# `azd env get-values` call itself fails (rather than silently continuing with no values).
AZD_VALUES=$(azd env get-values $AZD_ENV_ARGS)

# get_env_value <KEY> — print the (unquoted) value of KEY from AZD_VALUES, empty if absent.
# Uses only POSIX-friendly tools so it works on the widely-available Bash 3.2 (e.g. macOS).
get_env_value() {
  printf '%s\n' "$AZD_VALUES" \
    | grep "^$1=" \
    | head -n 1 \
    | sed -e "s/^$1=//" -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

RG_NAME=$(get_env_value AZURE_RESOURCE_GROUP)
if [ -z "$RG_NAME" ]; then
  echo "ERROR: AZURE_RESOURCE_GROUP is not set in the azd environment." >&2
  echo "Run 'azd provision' before this script so the resource group is available." >&2
  exit 1
fi

# set_if_missing <ENV_VAR_NAME> <description> <resolver command...>
# The resolver command is passed as arguments and run via "$@" — no eval.
set_if_missing() {
  var_name="$1"
  description="$2"
  shift 2

  existing=$(get_env_value "$var_name")
  if [ -n "$existing" ]; then
    echo "$var_name: already present ($existing)"
    return 0
  fi

  value=$("$@")
  if [ -z "$value" ]; then
    echo "ERROR: Could not resolve $var_name ($description) in resource group '$RG_NAME'." >&2
    echo "Confirm 'azd provision' completed and the resource exists." >&2
    exit 1
  fi

  azd env set $AZD_ENV_ARGS "$var_name" "$value"
  echo "$var_name: set to $value"
}

echo "Resource group: $RG_NAME"

set_if_missing \
  "AZURE_CONTAINER_REGISTRY_ENDPOINT" \
  "container registry login server" \
  az acr list --resource-group "$RG_NAME" --query "[0].loginServer" -o tsv

set_if_missing \
  "AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID" \
  "managed identity resource id" \
  az identity list --resource-group "$RG_NAME" --query "[0].id" -o tsv

set_if_missing \
  "MANAGED_IDENTITY_CLIENT_ID" \
  "managed identity client id" \
  az identity list --resource-group "$RG_NAME" --query "[0].clientId" -o tsv

echo "Aspire Container Apps environment variables are ready for 'azd deploy'."
