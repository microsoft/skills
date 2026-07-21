<#
.SYNOPSIS
    Canvas-First Entry check for the Foundry "create a new agent" flow.
.DESCRIPTION
    Reports -- using the same [OK]/[WARN]/[ACTION] convention as verify-environment --
    whether the canvas-first gate applies before scaffolding a new hosted agent in the
    GitHub Copilot app, from two deterministic facts:
      * copilot_app      - is AI_AGENT=github_copilot_app_agent?
      * canvas_installed - is the Foundry Agent Canvas (foundry-agent-canvas)
                           installed in the project, user, session, or
                           plugin-contributed location?

    Output lines are prefixed with [OK], [WARN], or [ACTION].
    Exit code is 0 when the gate does not apply (not in the app, or the canvas is
    not installed), 1 when the canvas is installed and an [ACTION] is required.

    NOTE: whether the canvas is *open* is runtime UI state the agent reads from the
    message <canvas-context> (look for canvas="agent-builder"); a script cannot see it.
.EXAMPLE
    ./check-canvas-entry.ps1
#>

$ErrorActionPreference = "Stop"
$ext = "foundry-agent-canvas"

if ($env:AI_AGENT -ne "github_copilot_app_agent") {
    Write-Output "[OK] Not running in the GitHub Copilot app (AI_AGENT is not github_copilot_app_agent)."
    Write-Output "[OK] Canvas-first gate does not apply -- continue with the normal create workflow."
    exit 0
}

Write-Output "[OK] GitHub Copilot app detected (AI_AGENT=github_copilot_app_agent)."

# Candidate install locations: project (repo), user, session, and plugin-contributed.
$dirs = @()
try { $root = (& git rev-parse --show-toplevel 2>$null); if ($root) { $dirs += (Join-Path $root ".github/extensions/$ext") } } catch {}
$dirs += (Join-Path (Get-Location) ".github/extensions/$ext")
$homeDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
if ($homeDir) { $dirs += (Join-Path $homeDir ".copilot/extensions/$ext") }
if ($homeDir -and $env:COPILOT_AGENT_SESSION_ID) {
    $dirs += (Join-Path $homeDir ".copilot/session-state/$($env:COPILOT_AGENT_SESSION_ID)/extensions/$ext")
}
# Plugin-contributed extensions live under ~/.copilot/installed-plugins/<repo>/<plugin>/...
# The layout varies (some nest the extension under an extensions/ subfolder, others place it
# directly), but the leaf directory holding extension.mjs is always named after the extension.
$installedAt = $null
foreach ($d in $dirs) {
    if (Test-Path (Join-Path $d "extension.mjs")) { $installedAt = $d; break }
}

if (-not $installedAt -and $homeDir) {
    $pluginRoot = Join-Path $homeDir ".copilot/installed-plugins"
    if (Test-Path $pluginRoot) {
        $installedAt = Get-ChildItem -Path $pluginRoot -Recurse -Depth 4 -Directory -Filter $ext -ErrorAction SilentlyContinue |
            Where-Object { Test-Path (Join-Path $_.FullName "extension.mjs") -PathType Leaf } |
            Select-Object -First 1 -ExpandProperty FullName
    }
}

if (-not $installedAt) {
    Write-Output "[WARN] Foundry Agent Canvas is not installed -- canvas-first gate does not apply; continue with the normal create workflow."
    exit 0
}

Write-Output "[OK] Foundry Agent Canvas is installed."
Write-Output '[ACTION] Canvas-first gate applies.'
exit 1
