#Requires -Version 7.0
<#
.SYNOPSIS
Runs fixture-based Vally evaluations and creates trajectory narratives and an aggregate usage report.

.DESCRIPTION
Discovers eval.yaml files under evaluations/, executes each selected evaluation,
and writes raw results, per-operation turn narratives, summary.json, and report.md
to a timestamped results directory. Reports include tokens, tools, time, and
Copilot AI Credit usage.

.PARAMETER EvaluationPattern
Wildcard matched against each evaluation directory name. Defaults to '*'.

.PARAMETER Workers
Number of Vally trial workers for each evaluation. Defaults to 1.

.PARAMETER Model
Optional evaluated-agent model override. When omitted, each eval.yaml default is used.
Multiple model names can be supplied as a PowerShell comma-separated list or as
a quoted comma-separated value.

.PARAMETER JudgeModel
Optional LLM judge model override. When omitted, each eval.yaml default is used.

.PARAMETER ResultsDirectory
Explicit output directory. A timestamped directory is created when omitted.

.PARAMETER DryRun
Lists matching evaluations without executing them.

.PARAMETER ReportOnly
Skips execution and regenerates reports from ResultsDirectory, or the latest run.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$EvaluationPattern = "*",

    [Parameter(Mandatory = $false)]
    [ValidateRange(1, 128)]
    [int]$Workers = 1,

    [Parameter(Mandatory = $false)]
    [ValidateNotNullOrEmpty()]
    [string[]]$Model,

    [Parameter(Mandatory = $false)]
    [ValidateNotNullOrEmpty()]
    [string]$JudgeModel,

    [Parameter(Mandatory = $false)]
    [string]$ResultsDirectory,

    [Parameter(Mandatory = $false)]
    [switch]$DryRun,

    [Parameter(Mandatory = $false)]
    [switch]$ReportOnly
)

$ErrorActionPreference = "Stop"
$evaluationsRoot = Join-Path $PSScriptRoot "evaluations"
$defaultResultsRoot = Join-Path $PSScriptRoot "results"
$reportScript = Join-Path $PSScriptRoot "scripts\summarize-results.mjs"

function Resolve-LatestResultsDirectory {
    if (-not (Test-Path $defaultResultsRoot)) {
        return $null
    }

    return Get-ChildItem -Path $defaultResultsRoot -Directory |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}

function Resolve-VallyCommand {
    $candidates = if ($IsWindows) {
        @(
            (Join-Path $PSScriptRoot "node_modules\.bin\vally.cmd"),
            (Join-Path $PSScriptRoot "node_modules\.bin\vally")
        )
    }
    else {
        @((Join-Path $PSScriptRoot "node_modules/.bin/vally"))
    }

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    throw "Vally is not installed. Run 'npm ci' in $PSScriptRoot first."
}

if ($ReportOnly) {
    if ([string]::IsNullOrWhiteSpace($ResultsDirectory)) {
        $ResultsDirectory = Resolve-LatestResultsDirectory
    }

    if ([string]::IsNullOrWhiteSpace($ResultsDirectory) -or -not (Test-Path $ResultsDirectory)) {
        throw "No results directory was found. Pass -ResultsDirectory with an existing Vally run."
    }

    & node $reportScript (Resolve-Path $ResultsDirectory).Path
    exit $LASTEXITCODE
}

$evaluations = @(
    Get-ChildItem -Path $evaluationsRoot -Recurse -File -Filter "eval.yaml" |
        Where-Object { $_.Directory.Name -like $EvaluationPattern } |
        Sort-Object FullName
)

if ($evaluations.Count -eq 0) {
    throw "No evaluations matched '$EvaluationPattern' under $evaluationsRoot."
}

$modelsToRun = @(
    $Model |
        ForEach-Object { $_ -split "," } |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ } |
        Select-Object -Unique
)

$modelDisplay = if ($modelsToRun.Count -eq 0) {
    "eval.yaml default"
}
else {
    $modelsToRun -join ","
}
$judgeModelDisplay = if ([string]::IsNullOrWhiteSpace($JudgeModel)) {
    "eval.yaml default"
}
else {
    $JudgeModel
}

Write-Host "Selected $($evaluations.Count) evaluation(s):"
foreach ($evaluation in $evaluations) {
    Write-Host "  - $($evaluation.Directory.Name)"
}
Write-Host "Agent model: $modelDisplay"
Write-Host "Judge model: $judgeModelDisplay"

if ($DryRun) {
    Write-Host "Planned runs:"
    foreach ($evaluation in $evaluations) {
        if ($modelsToRun.Count -eq 0) {
            Write-Host "  - $($evaluation.Directory.Name) [eval.yaml default]"
            continue
        }

        foreach ($selectedModel in $modelsToRun) {
            Write-Host "  - $($evaluation.Directory.Name) [$selectedModel]"
        }
    }
    exit 0
}

$vally = Resolve-VallyCommand
if ([string]::IsNullOrWhiteSpace($ResultsDirectory)) {
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ss-fffZ")
    $ResultsDirectory = Join-Path $defaultResultsRoot $timestamp
}

$ResultsDirectory = [System.IO.Path]::GetFullPath($ResultsDirectory)
New-Item -ItemType Directory -Path $ResultsDirectory -Force | Out-Null

$failures = [System.Collections.Generic.List[string]]::new()
Push-Location $PSScriptRoot
try {
    foreach ($evaluation in $evaluations) {
        $name = $evaluation.Directory.Name
        $outputDirectory = Join-Path $ResultsDirectory $name
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

        $modelRuns = if ($modelsToRun.Count -gt 0) { $modelsToRun } else { @("") }
        $modelIndex = 0
        foreach ($currentModel in $modelRuns) {
            $modelIndex++
            $workspaceDirectory = Join-Path $outputDirectory "workspaces"
            $runLabel = $name

            if (-not [string]::IsNullOrWhiteSpace($currentModel)) {
                $safeModelName = $currentModel -replace '[^A-Za-z0-9._-]', '_'
                $workspaceDirectory = Join-Path $workspaceDirectory ("{0:D2}-{1}" -f $modelIndex, $safeModelName)
                $runLabel = "$name [$currentModel]"
            }

            Write-Host ""
            Write-Host "Running $runLabel..." -ForegroundColor Cyan
            $vallyArguments = @(
                "eval"
                "--eval-spec", $evaluation.FullName
                "--output-dir", $outputDirectory
                "--workspace", $workspaceDirectory
                "--workers", $Workers
            )
            if (-not [string]::IsNullOrWhiteSpace($currentModel)) {
                $vallyArguments += @("--model", $currentModel)
            }
            if (-not [string]::IsNullOrWhiteSpace($JudgeModel)) {
                $vallyArguments += @("--judge-model", $JudgeModel)
            }

            & $vally @vallyArguments

            if ($LASTEXITCODE -ne 0) {
                $failures.Add($runLabel)
                Write-Warning "$runLabel exited with code $LASTEXITCODE."
            }
        }
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Generating aggregate report..." -ForegroundColor Cyan
& node $reportScript $ResultsDirectory
if ($LASTEXITCODE -ne 0) {
    throw "The evaluation report could not be generated."
}

Write-Host "Results: $ResultsDirectory"
if ($failures.Count -gt 0) {
    Write-Error "Failed evaluations: $($failures -join ', ')"
    exit 1
}
