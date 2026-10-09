# Deploy the fixed Linux capture runner as a ConfigMap.
# Exit codes: 0 = success/help, 1 = kubectl/read failure, 2 = usage/argument error.
[CmdletBinding()]
param(
    [string]$Namespace = "default",
    [switch]$Help
)

function Write-Usage {
    @"
Usage: setup-capture-configmap.ps1 [-Namespace <name>]

Deploy run-capture.sh as the network-capture-scripts ConfigMap.
"@
}

function Stop-Usage {
    param([string]$Message)
    [Console]::Error.WriteLine("Error: $Message")
    [Console]::Error.WriteLine((Write-Usage))
    exit 2
}

function Stop-Failure {
    param([string]$Message)
    [Console]::Error.WriteLine("Error: $Message")
    exit 1
}

if ($Help) {
    Write-Usage
    exit 0
}
if ($Namespace.Length -gt 63 -or
    $Namespace -cnotmatch "^[a-z0-9]([-a-z0-9]*[a-z0-9])?$") {
    Stop-Usage "-Namespace must be an RFC 1123 label"
}
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
    Stop-Failure "kubectl is not installed or not on PATH"
}

$runnerPath = Join-Path $PSScriptRoot "run-capture.sh"
if (-not (Test-Path -LiteralPath $runnerPath -PathType Leaf)) {
    Stop-Failure "run-capture.sh is not readable"
}

$manifest = (& kubectl create configmap network-capture-scripts `
    "--from-file=run-capture.sh=$runnerPath" `
    "--namespace=$Namespace" --dry-run=client -o yaml 2>&1) -join "`n"
if ($LASTEXITCODE -ne 0) {
    Stop-Failure "failed to render the ConfigMap: $manifest"
}

$applyOutput = ($manifest | & kubectl apply -f - 2>&1) -join "`n"
if ($LASTEXITCODE -ne 0) {
    Stop-Failure "failed to apply the ConfigMap: $applyOutput"
}

Write-Output $applyOutput
Write-Output "ConfigMap network-capture-scripts created or updated in namespace: $Namespace"
