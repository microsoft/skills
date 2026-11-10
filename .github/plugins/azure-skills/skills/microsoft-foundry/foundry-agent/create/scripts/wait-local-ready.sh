#!/usr/bin/env bash
# Waits for the local agent port to accept TCP connections.
# Polls every 2 seconds for up to 5 minutes.
# Usage: ./wait-local-ready.sh <port>
# Exit codes: 0 = ready, 1 = timeout, 2 = invalid arguments.

set -uo pipefail

if [[ $# -eq 1 && ( $1 == --help || $1 == -h ) ]]; then
  echo "Usage: $0 <port: 1-65535>"
  exit 0
fi

if [[ $# -ne 1 || ! $1 =~ ^[0-9]{1,5}$ ]]; then
  echo "Usage: $0 <port: 1-65535>" >&2
  exit 2
fi

port=$((10#$1))
if ((port < 1 || port > 65535)); then
  echo "Port must be between 1 and 65535." >&2
  exit 2
fi

deadline=$((SECONDS + 300))
while ((SECONDS < deadline)); do
  if (: > "/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    echo "[READY] localhost:$port accepts TCP connections. Keep the server running and proceed to the local smoke invocation."
    exit 0
  fi
  sleep 2
done

echo "[ERROR] localhost:$port did not become ready within 300 seconds. Inspect the server logs and resolve the cause before retrying." >&2
exit 1
