#!/usr/bin/env bash
# Launch the local Speech SDK log analyzer (requires Node.js 22 or later).
# Exit codes: 0 = analysis written to stdout or --help, 1 = file/read/size error,
# 2 = usage/argument error, 3 = Node.js 22+ missing or too old (nothing is run or installed).
set -euo pipefail

node_help="Install Node.js 22 or later (Windows: winget install --id OpenJS.NodeJS.LTS -e; macOS: brew install node), or use references/speech/without-node.md in this skill. Nothing was run, changed or installed."
if ! command -v node >/dev/null 2>&1; then
  printf '{"error":"NODE_REQUIRED","help":"Node.js 22 or later is required to run the Speech SDK log analyzer but was not found on PATH. %s"}\n' "$node_help" >&2
  exit 3
fi
node_version="$(node --version 2>/dev/null || true)"
case "$node_version" in
  v[0-9]*.*) node_major="${node_version#v}"; node_major="${node_major%%.*}" ;;
  *) node_version="an unrecognized version"; node_major=0 ;;
esac
case "$node_major" in
  ''|*[!0-9]*) node_major=0 ;;
esac
if [ "$node_major" -lt 22 ]; then
  printf '{"error":"NODE_VERSION_UNSUPPORTED","help":"Node.js 22 or later is required to run the Speech SDK log analyzer; found %s. %s"}\n' "$node_version" "$node_help" >&2
  exit 3
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec node "$script_dir/analyze-speech-sdk-log.mjs" "$@"
