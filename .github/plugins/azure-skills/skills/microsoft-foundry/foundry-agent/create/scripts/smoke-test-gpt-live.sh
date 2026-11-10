#!/usr/bin/env bash
# Smoke-test a deployed Microsoft Foundry GPT-Live Voice Agent.
#
# Usage:
#   ./foundry-agent/create/scripts/smoke-test-gpt-live.sh \
#     --endpoint <project-endpoint> \
#     --agent-name <gpt-live-agent-name> \
#     [--timeout <seconds>] \
#     [--dry-run] \
#     [--help]
#
# Exit Codes:
#   0  Smoke test passed (or --help / --dry-run succeeded)
#   1  Python, dependency, authentication, protocol, or validation failure
#   2  Usage or argument validation error

set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "ERROR: Python 3 is required to run the GPT-Live smoke test." >&2
  exit 1
fi

exec "$PYTHON_BIN" "$SCRIPT_DIR/smoke_test_gpt_live.py" "$@"
