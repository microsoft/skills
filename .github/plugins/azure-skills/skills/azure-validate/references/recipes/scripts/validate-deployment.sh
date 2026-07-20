#!/usr/bin/env bash
# validate-deployment.sh
# Runs the standard Azure CLI pre-deployment validation sequence for a Bicep
# template and reports PASS/FAIL for each step. Shared by the AZCLI and Bicep
# validation recipes.
#
# Steps (in order):
#   1. az version         - Azure CLI is installed
#   2. az account show    - authenticated to Azure
#   3. az bicep build     - template compiles cleanly
#   4. az deployment ... validate  - template validates against the target scope
#   5. az deployment ... what-if   - preview changes (with a Create/Modify/Delete summary)
#
# Usage:
#   ./validate-deployment.sh --scope sub   --location <location>       [options]
#   ./validate-deployment.sh --scope group --resource-group <rg-name>  [options]
#
# Options:
#   --scope <sub|group>       Deployment scope (required)
#   --location <location>     Location (required when --scope sub)
#   --resource-group <name>   Resource group (required when --scope group)
#   --template <path>         Bicep template (default: ./infra/main.bicep)
#   --parameters <path>       Parameters file (default: ./infra/main.parameters.json;
#                             skipped automatically if the file does not exist)
#   --subscription <id>       Subscription to target (optional)
#
# Examples:
#   ./validate-deployment.sh --scope sub --location eastus
#   ./validate-deployment.sh --scope group --resource-group my-rg \
#       --template ./infra/main.bicep --parameters ./infra/main.parameters.json
#
# Exit codes:
#   0 - every validation step passed
#   1 - a validation step failed
#   2 - usage / argument error (unknown or valueless option, missing required flag)

set -uo pipefail

# Ensure an option that consumes a value actually has one ($@ = remaining args).
need_val() {
    [ "$#" -ge 2 ] || { echo "ERROR: $1 requires a value." >&2; exit 2; }
}

SCOPE=""
LOCATION=""
RESOURCE_GROUP=""
TEMPLATE="./infra/main.bicep"
PARAMETERS="./infra/main.parameters.json"
SUBSCRIPTION=""

while [ $# -gt 0 ]; do
    case "$1" in
        --scope)          need_val "$@"; SCOPE="$2"; shift 2 ;;
        --location)       need_val "$@"; LOCATION="$2"; shift 2 ;;
        --resource-group) need_val "$@"; RESOURCE_GROUP="$2"; shift 2 ;;
        --template)       need_val "$@"; TEMPLATE="$2"; shift 2 ;;
        --parameters)     need_val "$@"; PARAMETERS="$2"; shift 2 ;;
        --subscription)   need_val "$@"; SUBSCRIPTION="$2"; shift 2 ;;
        -h|--help)
            grep '^#' "$0" | grep -v '^#!' | sed 's/^# \{0,1\}//'
            exit 0 ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 2 ;;
    esac
done

# Validate arguments
if [ "$SCOPE" != "sub" ] && [ "$SCOPE" != "group" ]; then
    echo "ERROR: --scope must be 'sub' or 'group'." >&2
    exit 2
fi
if [ "$SCOPE" = "sub" ] && [ -z "$LOCATION" ]; then
    echo "ERROR: --location is required when --scope is 'sub'." >&2
    exit 2
fi
if [ "$SCOPE" = "group" ] && [ -z "$RESOURCE_GROUP" ]; then
    echo "ERROR: --resource-group is required when --scope is 'group'." >&2
    exit 2
fi

# Build shared argument arrays
SUB_ARGS=()
[ -n "$SUBSCRIPTION" ] && SUB_ARGS=(--subscription "$SUBSCRIPTION")

PARAM_ARGS=()
if [ -f "$PARAMETERS" ]; then
    PARAM_ARGS=(--parameters "$PARAMETERS")
else
    echo "NOTE: parameters file '$PARAMETERS' not found; validating without --parameters."
fi

if [ "$SCOPE" = "sub" ]; then
    SCOPE_TARGET_ARGS=(--location "$LOCATION")
    SCOPE_DESC="subscription (location: $LOCATION)"
else
    SCOPE_TARGET_ARGS=(--resource-group "$RESOURCE_GROUP")
    SCOPE_DESC="resource group '$RESOURCE_GROUP'"
fi

# Track overall result (0 = all passed, 1 = at least one failure).
OVERALL=0

echo "=== Azure deployment validation ==="
echo "Template:   $TEMPLATE"
echo "Scope:      $SCOPE_DESC"
echo ""

# Step 1: Azure CLI installed
echo "--- Step 1: Azure CLI installed (az version) ---"
if az version >/dev/null 2>&1; then
    echo "PASS: Azure CLI is installed."
else
    echo "FAIL: Azure CLI not found. Install it, then re-run."
    # Nothing else can run without the CLI.
    echo ""
    echo "OVERALL: FAIL"
    exit 1
fi
echo ""

# Step 2: Authenticated
echo "--- Step 2: Authenticated (az account show) ---"
if ACCOUNT_NAME=$(az account show "${SUB_ARGS[@]}" --query name -o tsv 2>/dev/null); then
    echo "PASS: Authenticated (subscription: ${ACCOUNT_NAME:-unknown})."
else
    echo "FAIL: Not logged in. Run 'az login' (and 'az account set --subscription <id>')."
    OVERALL=1
fi
echo ""

# Step 3: Bicep compilation
echo "--- Step 3: Bicep compilation (az bicep build) ---"
BUILD_OUTPUT=$(az bicep build --file "$TEMPLATE" 2>&1)
BUILD_RC=$?
if [ $BUILD_RC -eq 0 ]; then
    echo "PASS: Template compiles cleanly."
else
    echo "FAIL: Bicep compilation errors:"
    echo "$BUILD_OUTPUT"
    OVERALL=1
fi
echo ""

# Step 4: Template validation
echo "--- Step 4: Template validation (az deployment $SCOPE validate) ---"
VALIDATE_OUTPUT=$(az deployment "$SCOPE" validate "${SCOPE_TARGET_ARGS[@]}" \
    --template-file "$TEMPLATE" \
    "${PARAM_ARGS[@]}" "${SUB_ARGS[@]}" 2>&1)
VALIDATE_RC=$?
if [ $VALIDATE_RC -eq 0 ]; then
    echo "PASS: Template validated against the target scope."
else
    echo "FAIL: Template validation errors:"
    echo "$VALIDATE_OUTPUT"
    OVERALL=1
fi
echo ""

# Step 5: What-if preview
echo "--- Step 5: What-if preview (az deployment $SCOPE what-if) ---"
WHATIF_OUTPUT=$(az deployment "$SCOPE" what-if "${SCOPE_TARGET_ARGS[@]}" \
    --template-file "$TEMPLATE" \
    "${PARAM_ARGS[@]}" "${SUB_ARGS[@]}" 2>&1)
WHATIF_RC=$?
if [ $WHATIF_RC -eq 0 ]; then
    CREATE_COUNT=$(echo "$WHATIF_OUTPUT" | grep -c '^[[:space:]]*+ ')
    MODIFY_COUNT=$(echo "$WHATIF_OUTPUT" | grep -c '^[[:space:]]*~ ')
    DELETE_COUNT=$(echo "$WHATIF_OUTPUT" | grep -c '^[[:space:]]*- ')
    echo "PASS: What-if completed. Changes -> Create: $CREATE_COUNT, Modify: $MODIFY_COUNT, Delete: $DELETE_COUNT"
else
    echo "FAIL: What-if errors:"
    echo "$WHATIF_OUTPUT"
    OVERALL=1
fi
echo ""

# Overall result
if [ $OVERALL -eq 0 ]; then
    echo "OVERALL: PASS"
else
    echo "OVERALL: FAIL"
fi
exit $OVERALL
