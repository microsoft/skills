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

for extension_id in microsoft.foundry azure.ai.evaluations; do
  extension_pattern="${extension_id//./[.]}"
  if printf '%s' "$extension_list" | grep -Eq "\"id\"[[:space:]]*:[[:space:]]*\"$extension_pattern\""; then
    continue
  fi

  echo "$extension_id is not installed. Installing it now..."
  azd extension install "$extension_id"
done

echo "Dependencies are ready: azd and the microsoft.foundry and azure.ai.evaluations extensions are ready."
