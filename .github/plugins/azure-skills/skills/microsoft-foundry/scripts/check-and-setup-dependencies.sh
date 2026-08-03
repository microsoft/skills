#!/usr/bin/env bash

set -euo pipefail

if ! command -v azd >/dev/null 2>&1; then
  echo "Azure Developer CLI (azd) is required. Install it from https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd, then rerun this script." >&2
  exit 1
fi

export AZURE_DEV_USER_AGENT=microsoft_foundry_skill

if ! extension_list="$(azd extension list --installed --output json)"; then
  echo "Failed to list installed azd extensions." >&2
  exit 1
fi

if printf '%s' "$extension_list" | grep -Eq '"id"[[:space:]]*:[[:space:]]*"microsoft\.foundry"'; then
  echo "Dependencies are ready: azd and the microsoft.foundry extension are ready."
  exit 0
fi

echo "microsoft.foundry is not installed. Installing it now..."
azd extension install microsoft.foundry
echo "Dependencies are ready: azd and the microsoft.foundry extension are ready."
