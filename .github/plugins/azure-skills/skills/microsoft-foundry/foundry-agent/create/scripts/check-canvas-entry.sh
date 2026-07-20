#!/usr/bin/env bash
# check-canvas-entry.sh
# Canvas-First Entry check for the Foundry "create a new agent" flow.
#
# Reports -- using the same [OK]/[WARN]/[ACTION] convention as verify-environment --
# whether the canvas-first gate applies before scaffolding a new hosted agent in the
# GitHub Copilot app, from two deterministic facts:
#   * copilot_app      - is AI_AGENT=github_copilot_app_agent?
#   * canvas_installed - is the Foundry Agent Canvas (foundry-agent-canvas)
#                        installed in the project, user, session, or
#                        plugin-contributed location?
#
# Output: summary lines, each prefixed with [OK], [WARN], or [ACTION].
# Exit code: 0 when the gate does not apply (not in the app, or the canvas is not
# installed), 1 when the canvas is installed and an [ACTION] is required.
#
# NOTE: whether the canvas is *open* is runtime UI state the agent reads from the
# message <canvas-context> (look for canvas="agent-builder"); a script cannot see it.

set -uo pipefail
ext="foundry-agent-canvas"

if [ "${AI_AGENT:-}" != "github_copilot_app_agent" ]; then
  echo "[OK] Not running in the GitHub Copilot app (AI_AGENT is not github_copilot_app_agent)."
  echo "[OK] Canvas-first gate does not apply -- continue with the normal create workflow."
  exit 0
fi

echo "[OK] GitHub Copilot app detected (AI_AGENT=github_copilot_app_agent)."

# Candidate install locations: project (repo), user, session, and plugin-contributed.
dirs=()
root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] && dirs+=("$root/.github/extensions/$ext")
dirs+=("$PWD/.github/extensions/$ext")
home_dir="${HOME:-${USERPROFILE:-}}"
[ -n "$home_dir" ] && dirs+=("$home_dir/.copilot/extensions/$ext")
[ -n "$home_dir" ] && [ -n "${COPILOT_AGENT_SESSION_ID:-}" ] && \
  dirs+=("$home_dir/.copilot/session-state/$COPILOT_AGENT_SESSION_ID/extensions/$ext")

installed_at=""
for d in "${dirs[@]}"; do
  if [ -f "$d/extension.mjs" ]; then installed_at="$d"; break; fi
done

# Plugin-contributed extensions live under ~/.copilot/installed-plugins/<repo>/<plugin>/...
# The layout varies (some nest the extension under an extensions/ subfolder, others place it
# directly), but the leaf directory holding extension.mjs is always named after the extension.
plugin_root="$home_dir/.copilot/installed-plugins"
if [ -z "$installed_at" ] && [ -n "$home_dir" ] && [ -d "$plugin_root" ]; then
  mjs="$(find "$plugin_root" -maxdepth 6 -type f -name extension.mjs -path "*/$ext/extension.mjs" -print -quit 2>/dev/null)"
  [ -n "$mjs" ] && installed_at="$(dirname "$mjs")"
fi

if [ -z "$installed_at" ]; then
  echo "[WARN] Foundry Agent Canvas is not installed -- canvas-first gate does not apply; continue with the normal create workflow."
  exit 0
fi

echo "[OK] Foundry Agent Canvas is installed."
echo '[ACTION] Canvas-first gate applies.'
exit 1
