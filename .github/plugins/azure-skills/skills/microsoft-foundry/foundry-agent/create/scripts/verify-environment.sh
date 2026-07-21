#!/usr/bin/env bash
# verify-environment.sh
# Verifies the local environment for creating a hosted Foundry agent with `azd ai`.
# Runs all the read-only checks in one pass and prints a single concise summary,
# so the agent does not have to run (and reason over) each azd command separately.
#
# Usage:
#   ./verify-environment.sh
#
# Output: human-readable summary lines, each prefixed with [OK], [WARN], or [ACTION].
# Exit code: 0 if no blocking actions, 1 if at least one [ACTION] is required.

set -uo pipefail

# Tag azd telemetry
export AZURE_DEV_USER_AGENT="microsoft_foundry_skill"

ACTION_REQUIRED=0

note_ok()     { echo "[OK] $1"; }
note_warn()   { echo "[WARN] $1"; }
note_action() { echo "[ACTION] $1"; ACTION_REQUIRED=1; }

# Refresh PATH to pick up recently-installed tools (e.g. azd installed in same session)
if [ -f /etc/environment ]; then
  # shellcheck disable=SC1091
  . /etc/environment 2>/dev/null || true
fi
hash -r 2>/dev/null || true

# 1. Required CLIs
AZD_AVAILABLE=1
AZ_AVAILABLE=1

if ! command -v azd >/dev/null 2>&1; then
  note_action "Azure Developer CLI (azd) is not installed. Install it from https://aka.ms/azd-install, then re-run."
  AZD_AVAILABLE=0
fi

if ! command -v az >/dev/null 2>&1; then
  note_action "Azure CLI (az) is not installed. Install it from https://aka.ms/installazurecli, then re-run."
  AZ_AVAILABLE=0
fi

if [ "$AZD_AVAILABLE" -eq 0 ] || [ "$AZ_AVAILABLE" -eq 0 ]; then
  echo ""
  echo "Summary: CLI missing -- cannot continue."
  exit 1
fi

AZD_VERSION="$(azd version --output json 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("azd",{}).get("version","unknown"))' 2>/dev/null || echo unknown)"
note_ok "azd installed (version ${AZD_VERSION})."

AZ_VERSION="$(az version --query '"azure-cli"' -o tsv 2>/dev/null || echo unknown)"
note_ok "Azure CLI installed (version ${AZ_VERSION})."

# 2. Required azd extensions
EXT_JSON="$(azd extension list --installed --output json 2>/dev/null || echo '[]')"
for ext in azure.ai.agents azure.ai.projects microsoft.foundry; do
  if printf '%s' "$EXT_JSON" | grep -q "$ext"; then
    note_ok "Extension '$ext' is installed."
  else
    note_action "Extension '$ext' is missing. Run: azd extension install $ext"
  fi
done

# 3. Auth status
AZD_AUTH_OUTPUT="$(azd auth login --check-status 2>&1)"; AZD_AUTH_EXIT=$?
if printf '%s' "$AZD_AUTH_OUTPUT" | grep -Eiq '(not[[:space:]]+logged[[:space:]]+in|not[[:space:]]+authenticated|no[[:space:]]+account|login[[:space:]]+required|please[[:space:]]+run.*azd[[:space:]]+auth[[:space:]]+login|run.*azd[[:space:]]+auth[[:space:]]+login|expired)'; then
  note_action "Not logged in to azd. Ask the user to run 'azd auth login' (it opens a browser; never run it for them)."
elif printf '%s' "$AZD_AUTH_OUTPUT" | grep -Eiq '(logged[[:space:]]+in|authenticated|already[[:space:]]+logged[[:space:]]+in)'; then
  note_ok "Logged in to azd."
elif [ "$AZD_AUTH_EXIT" -eq 0 ]; then
  # Unrecognized output -- fall back to exit code
  note_ok "Logged in to azd."
else
  note_action "Unable to verify azd auth status. Ask the user to run 'azd auth login' and re-run this script."
fi

AZ_ACCOUNT_JSON="$(az account show --output json 2>/dev/null || true)"
if [ -z "$AZ_ACCOUNT_JSON" ]; then
  note_action "Not logged in to Azure CLI. Ask the user to run 'az login' (it opens a browser; never run it for them)."
else
  AZ_ACCOUNT_PARSED="$(printf '%s' "$AZ_ACCOUNT_JSON" | python3 -c 'import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    raise SystemExit(1)
if not isinstance(d, dict):
    raise SystemExit(1)
print((d.get("name") or "unknown").replace("\t", " "), d.get("state") or "", sep="\t")
' 2>/dev/null || true)"
  if [ -z "$AZ_ACCOUNT_PARSED" ]; then
    note_action "Unable to verify Azure CLI login status. Ask the user to run 'az login' and re-run this script."
  else
    IFS=$'\t' read -r AZ_SUB_NAME AZ_SUB_STATE <<< "$AZ_ACCOUNT_PARSED"
    AZ_SUB_STATE="${AZ_SUB_STATE//$'\r'/}"
    if [ -n "$AZ_SUB_STATE" ] && [ "$AZ_SUB_STATE" != "Enabled" ]; then
      note_action "Azure CLI active subscription state is '${AZ_SUB_STATE}'. Ask the user to select an enabled subscription with 'az account set --subscription <id>'."
    else
      note_ok "Azure CLI logged in (subscription: ${AZ_SUB_NAME:-unknown})."
    fi
  fi
fi

if [ "$ACTION_REQUIRED" -eq 1 ]; then
  echo ""
  echo "Summary: action required -- resolve the [ACTION] items above before continuing."
  exit 1
fi

# 4. Foundry project endpoint (optional at this stage)
# Short-circuit when there's no azd project in cwd: `azd ai project show` / `agent show`
# would just return nothing after a ~3s subprocess each.
if [ ! -f "azure.yaml" ]; then
  note_warn "No Foundry project endpoint set yet. A new project will be created at provision/deploy time, or supply an existing project resource ID."
  note_ok "No agent deployed yet. Proceed with create."
else
  PROJECT_JSON="$(azd ai project show --output json 2>/dev/null || echo '')"
  ENDPOINT=""
  if [ -n "$PROJECT_JSON" ]; then
    ENDPOINT="$(printf '%s' "$PROJECT_JSON" | python3 -c 'import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    print(""); raise SystemExit
if isinstance(d,dict):
    for k in ("endpoint","projectEndpoint","aiProjectEndpoint"):
        if d.get(k):
            print(d[k]); break
' 2>/dev/null)"
  fi
  if [ -n "$ENDPOINT" ]; then
    note_ok "Foundry project endpoint configured: ${ENDPOINT}"
  else
    note_warn "No Foundry project endpoint set yet. A new project will be created at provision/deploy time, or supply an existing project resource ID."
  fi

  # 5. Agent deployment status
  AGENT_JSON="$(azd ai agent show --output json 2>/dev/null || echo '')"
  if [ -n "$AGENT_JSON" ]; then
    STATUS="$(printf '%s' "$AGENT_JSON" | python3 -c 'import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    print("unknown"); raise SystemExit
print(d.get("status","unknown") if isinstance(d,dict) else "unknown")' 2>/dev/null)"
    case "$STATUS" in
      active|deployed) note_ok "An agent is already deployed (status: ${STATUS}). Skip to deploy.md to redeploy, or tools to add a tool." ;;
      not_deployed)    note_ok "No agent deployed yet (status: not_deployed). Proceed with create." ;;
      *)               note_warn "Agent status: ${STATUS}." ;;
    esac
  else
    note_ok "No agent deployed yet. Proceed with create."
  fi
fi

echo ""
if [ "$ACTION_REQUIRED" -eq 1 ]; then
  echo "Summary: action required -- resolve the [ACTION] items above before continuing."
  exit 1
else
  echo "Summary: environment ready for 'azd ai' hosted-agent creation."
  exit 0
fi
