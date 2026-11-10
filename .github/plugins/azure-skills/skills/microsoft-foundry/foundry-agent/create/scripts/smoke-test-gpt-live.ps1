# Smoke-test a deployed Microsoft Foundry GPT-Live Voice Agent.
#
# Usage:
#   .\foundry-agent\create\scripts\smoke-test-gpt-live.ps1 `
#     -Endpoint <project-endpoint> `
#     -AgentName <gpt-live-agent-name> `
#     [-Timeout <seconds>] `
#     [-DryRun] `
#     [-Help]
#
# Exit Codes:
#   0  Smoke test passed (or -Help / -DryRun succeeded)
#   1  Python, dependency, authentication, protocol, or validation failure
#   2  Usage or argument validation error

param(
    [string]$Endpoint = "",
    [string]$AgentName = "",
    [string]$Timeout = "180",
    [switch]$DryRun,
    [switch]$Help,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemainingArgs
)

function Show-Usage {
    $lines = Get-Content -LiteralPath $PSCommandPath | Select-Object -First 18
    foreach ($line in $lines) {
        if ($line -match '^#\s?(.*)$') {
            Write-Output $Matches[1]
        }
    }
}

if ($Help) {
    Show-Usage
    exit 0
}

if ($null -ne $RemainingArgs -and $RemainingArgs.Count -gt 0) {
    Write-Error "ERROR: Unknown argument(s): $($RemainingArgs -join ' ')"
    Show-Usage
    exit 2
}

if ([string]::IsNullOrWhiteSpace($Endpoint)) {
    Write-Error "ERROR: -Endpoint is required."
    Show-Usage
    exit 2
}

if ([string]::IsNullOrWhiteSpace($AgentName)) {
    Write-Error "ERROR: -AgentName is required."
    Show-Usage
    exit 2
}

if ($Timeout -notmatch '^[1-9][0-9]*$') {
    Write-Error "ERROR: -Timeout must be a positive integer (got '$Timeout')."
    exit 2
}

$pythonCmd = $null
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} else {
    Write-Error "ERROR: Python 3 is required to run the GPT-Live smoke test."
    exit 1
}

$arguments = @(
    (Join-Path $PSScriptRoot "smoke_test_gpt_live.py"),
    "--endpoint", $Endpoint,
    "--agent-name", $AgentName,
    "--timeout", $Timeout
)

if ($DryRun) {
    $arguments += "--dry-run"
}

& $pythonCmd @arguments
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
exit 0
