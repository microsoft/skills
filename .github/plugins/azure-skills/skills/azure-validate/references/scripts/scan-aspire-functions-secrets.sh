#!/usr/bin/env bash
# scan-aspire-functions-secrets.sh
# Aspire + Azure Functions secret-storage pre-provisioning scan.
#
# Decides whether the AzureWebJobsSecretStorageType=Files fix is required by
# scanning C# source for the Aspire Functions builder call and the setting.
#
# Logic:
#   1. Find *.cs files that call AddAzureFunctionsProject.
#   2. For each, check whether the same file already sets AzureWebJobsSecretStorageType.
#   3. Files with the call but missing the setting -> fix required.
#
# Usage:
#   ./scan-aspire-functions-secrets.sh [directory]
#
# Examples:
#   ./scan-aspire-functions-secrets.sh              # Scan current directory
#   ./scan-aspire-functions-secrets.sh ./src        # Scan a specific directory
#
# Output: a single verdict — NOT APPLICABLE, ALREADY CONFIGURED, or FIX REQUIRED
# (with the matching file(s) and line(s)). Exit code is 0 for every verdict;
# a non-zero exit only indicates a usage/environment error.

set -euo pipefail

ROOT="${1:-.}"

if [ ! -d "$ROOT" ]; then
  echo "ERROR: '$ROOT' is not a directory." >&2
  exit 2
fi

CALL="AddAzureFunctionsProject"
SETTING="AzureWebJobsSecretStorageType"

# file_contains <fixed-string> <file>
# Returns 0 if the file contains the literal string, 1 if not.
# A grep read error (exit code 2) is fatal: this is a critical pre-provision
# scan, so a file we cannot read must not be silently reported as "no match".
file_contains() {
  local pattern="$1" file="$2" rc
  if grep -Fq -- "$pattern" "$file"; then
    return 0
  fi
  rc=$?
  if [ "$rc" -eq 2 ]; then
    echo "ERROR: failed to read '$file' while scanning for '$pattern'." >&2
    exit 3
  fi
  return 1
}

# first_line <fixed-string> <file>
# Prints the 1-based line number of the first literal match (or nothing).
first_line() {
  grep -Fn -- "$1" "$2" | head -n1 | cut -d: -f1
}

# Collect *.cs files that reference AddAzureFunctionsProject into an array.
# find ... -print0 + read -d '' keeps paths intact even if they contain
# newlines or spaces (genuinely NUL-safe, unlike a newline-joined string).
matches=()
while IFS= read -r -d '' file; do
  if file_contains "$CALL" "$file"; then
    matches+=("$file")
  fi
done < <(find "$ROOT" -type f -name "*.cs" -print0)

if [ "${#matches[@]}" -eq 0 ]; then
  echo "VERDICT: NOT APPLICABLE"
  echo "No '$CALL' call found in any *.cs file under '$ROOT'."
  echo "The Functions secret-storage check does not apply — skip it."
  exit 0
fi

# Partition matching files by whether they already configure the setting.
needs_fix=()
configured=()
for file in "${matches[@]}"; do
  if file_contains "$SETTING" "$file"; then
    configured+=("$file")
  else
    needs_fix+=("$file")
  fi
done

if [ "${#needs_fix[@]}" -eq 0 ]; then
  echo "VERDICT: ALREADY CONFIGURED"
  echo "Every file that calls '$CALL' already sets '$SETTING':"
  for file in "${configured[@]}"; do
    echo "  - $file (line $(first_line "$SETTING" "$file"))"
  done
  echo "No change required."
  exit 0
fi

echo "VERDICT: FIX REQUIRED"
echo "The following file(s) call '$CALL' but do NOT set '$SETTING':"
for file in "${needs_fix[@]}"; do
  echo "  - $file (line $(first_line "$CALL" "$file"))"
done
echo ""
echo "Add .WithEnvironment(\"$SETTING\", \"Files\") to the AddAzureFunctionsProject"
echo "builder chain in each file above BEFORE running 'azd provision'."
exit 0
