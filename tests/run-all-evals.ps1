#Requires -Version 7.0
<#
.SYNOPSIS
    Runs all Vally evaluations across skill scenarios.

.DESCRIPTION
    Discovers eval.yaml files under the scenarios directory and runs them in parallel
    using the Vally evaluation harness. Supports filtering by language and Azure service,
    and optional JUnit XML output for CI integration.

.PARAMETER ScenariosRoot
    Path to the directory containing skill scenario folders.
    Defaults to: <script-dir>/scenarios

.PARAMETER ResultsRoot
    Path to the directory where evaluation results are written.
    Defaults to: <script-dir>/scenario-results

.PARAMETER Workers
    Number of parallel evaluation workers. Default: 5

.PARAMETER JUnit
    If specified, emit JUnit-compatible XML output alongside the standard results.

.PARAMETER Language
    Filter evaluations to only skills matching the given language suffix(es).
    Examples: -Language py, -Language py,ts, -Language rust

.PARAMETER AzureService
    Filter evaluations to only skills matching the given Azure service name(s).
    Examples: -AzureService cosmos, -AzureService storage,servicebus

.EXAMPLE
    # Run all evaluations
    .\run-all-evals.ps1

.EXAMPLE
    # Run only Python evaluations
    .\run-all-evals.ps1 -Language py

.EXAMPLE
    # Run only Cosmos DB evaluations with JUnit output
    .\run-all-evals.ps1 -AzureService cosmos -JUnit

.EXAMPLE
    # Run storage evaluations with 10 parallel workers
    .\run-all-evals.ps1 -AzureService storage -Workers 10

.EXAMPLE
    # Run against a custom scenarios directory
    .\run-all-evals.ps1 -ScenariosRoot C:\my-scenarios -ResultsRoot C:\my-results

.EXAMPLE
    # Run with verbose output
    .\run-all-evals.ps1 -Verbose

.EXAMPLE
    # Run with debug information
    .\run-all-evals.ps1 -Debug

.NOTES
    Supports standard PowerShell switches: -Verbose, -Debug, -InformationAction, -WarningAction, -ErrorAction
#>
[CmdletBinding()]
param(
    [Parameter(HelpMessage = "Path to the directory containing skill scenario folders")]
    [string]$ScenariosRoot,

    [Parameter(HelpMessage = "Path to the directory where evaluation results are written")]
    [string]$ResultsRoot,

    [Parameter(HelpMessage = "Number of parallel evaluation workers")]
    [int]$Workers = 5,

    [Parameter(HelpMessage = "Emit JUnit-compatible XML output")]
    [switch]$JUnit,

    [Parameter(HelpMessage = "Filter by language suffix(es): py, ts, dotnet, java, rust")]
    [string[]]$Language,

    [Parameter(HelpMessage = "Filter by Azure service name(s)")]
    [string[]]$AzureService
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $PSBoundParameters.ContainsKey("ScenariosRoot")) {
    $ScenariosRoot = Join-Path $PSScriptRoot "scenarios"
}

if (-not $PSBoundParameters.ContainsKey("ResultsRoot")) {
    $ResultsRoot = Join-Path $PSScriptRoot "scenario-results"
}

if (-not (Test-Path -LiteralPath $ScenariosRoot)) {
    Write-Error "Scenarios root not found: $ScenariosRoot"
    exit 1
}

$resolvedScenariosRoot = (Resolve-Path -LiteralPath $ScenariosRoot).ProviderPath
$resolvedResultsRoot = [System.IO.Path]::GetFullPath($ResultsRoot)

$testsPackageJsonPath = Join-Path $PSScriptRoot "package.json"
$pnpmWorkspaceYamlPath = Join-Path $PSScriptRoot "pnpm-workspace.yaml"
$pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmCmd) {
    Write-Error "pnpm was not found on PATH. Install/enable pnpm via Corepack, then retry.`nExample:`n  corepack enable`n  corepack prepare pnpm@11.10.0 --activate"
    exit 1
}

if (Test-Path -LiteralPath $pnpmWorkspaceYamlPath) {
    $workspacePolicyBlocksEsbuild = $false
    try {
        $pnpmWorkspaceYaml = Get-Content -LiteralPath $pnpmWorkspaceYamlPath -Raw
        if ($pnpmWorkspaceYaml -match '(?ms)^\s*allowBuilds\s*:\s*.*?^\s*esbuild\s*:\s*false\s*$') {
            $workspacePolicyBlocksEsbuild = $true
        }
    }
    catch {
        Write-Warning "Could not inspect pnpm workspace policy at ${pnpmWorkspaceYamlPath}: $($_.Exception.Message)"
    }

    if ($workspacePolicyBlocksEsbuild) {
        Write-Error "pnpm workspace policy currently blocks esbuild in $pnpmWorkspaceYamlPath (allowBuilds.esbuild=false).`nRun:`n  pnpm --dir $PSScriptRoot approve-builds`nThen select/allow esbuild and rerun this script."
        exit 1
    }
}

$requiredPnpmVersion = $null
if (Test-Path -LiteralPath $testsPackageJsonPath) {
    try {
        $testsPackageJson = Get-Content -LiteralPath $testsPackageJsonPath -Raw | ConvertFrom-Json -Depth 20
        $packageManagerValue = [string]$testsPackageJson.packageManager
        if ($packageManagerValue -match '^pnpm@([^+]+)') {
            $requiredPnpmVersion = $Matches[1]
        }
    }
    catch {
        Write-Warning "Could not validate pnpm packageManager pin from ${testsPackageJsonPath}: $($_.Exception.Message)"
    }
}
if ($requiredPnpmVersion) {
    $activePnpmVersion = (& pnpm --version 2>&1 | Select-Object -First 1).ToString().Trim()
    if ([string]::IsNullOrWhiteSpace($activePnpmVersion) -or $activePnpmVersion -ne $requiredPnpmVersion) {
        Write-Error "pnpm version mismatch. Required: $requiredPnpmVersion (from tests/package.json), active: $activePnpmVersion.`nRun:`n  corepack prepare pnpm@$requiredPnpmVersion --activate"
        exit 1
    }
}

# Validate install policy once up front so we do not fail repeatedly per eval.
$pnpmInstallCheckOutput = & pnpm --dir $PSScriptRoot install --frozen-lockfile --reporter=append-only 2>&1
$pnpmInstallCheckExitCode = $LASTEXITCODE
if ($pnpmInstallCheckExitCode -ne 0) {
    $pnpmInstallCheckText = ($pnpmInstallCheckOutput | Out-String)
    if ($pnpmInstallCheckText -match 'ERR_PNPM_IGNORED_BUILDS') {
        Write-Error "pnpm install is blocked by unapproved build scripts.`nRun:`n  pnpm --dir $PSScriptRoot approve-builds`nThen rerun this script."
        exit 1
    }

    Write-Error "Preflight pnpm install check failed in $PSScriptRoot."
    $pnpmInstallCheckOutput | ForEach-Object { Write-Error $_ }
    exit 1
}

$languageFilter = @($Language | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { $_.Trim().ToLowerInvariant() })
$serviceFilter = @($AzureService | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { $_.Trim().ToLowerInvariant() })

$evalFiles = Get-ChildItem -Path $resolvedScenariosRoot -Filter "*eval.yaml" -File -Recurse |
Where-Object {
    $fullPath = $_.FullName
    if ($fullPath -notmatch '[\\/]vally[\\/]') {
        return $false
    }

    $relativeDir = [System.IO.Path]::GetRelativePath($resolvedScenariosRoot, $_.DirectoryName).TrimStart('\', '/')
    if ([string]::IsNullOrWhiteSpace($relativeDir)) { return $false }

    $skillName = ($relativeDir -split '[\\/]', 2)[0]
    if ([string]::IsNullOrWhiteSpace($skillName)) { return $false }

    $languageFromSkill = ""
    if ($skillName -match '-([^-]+)$') {
        $languageFromSkill = $Matches[1].ToLowerInvariant()
    }

    $serviceFromSkill = $skillName.ToLowerInvariant()
    if ($languageFromSkill) {
        $serviceFromSkill = $serviceFromSkill -replace ("-{0}$" -f [regex]::Escape($languageFromSkill)), ""
    }

    $includeLanguage = $true
    if ($languageFilter.Count -gt 0) {
        $includeLanguage = $languageFromSkill -and ($languageFilter -contains $languageFromSkill)
    }

    $includeService = $true
    if ($serviceFilter.Count -gt 0) {
        $includeService = $false
        foreach ($svc in $serviceFilter) {
            if ($serviceFromSkill -eq $svc -or $serviceFromSkill -like "*$svc*") {
                $includeService = $true
                break
            }
        }
    }

    return $includeLanguage -and $includeService
} |
Sort-Object FullName

if (-not $evalFiles) {
    $filterSummary = @()
    if ($languageFilter.Count -gt 0) { $filterSummary += "language=$($languageFilter -join ',')" }
    if ($serviceFilter.Count -gt 0) { $filterSummary += "service=$($serviceFilter -join ',')" }
    if ($filterSummary.Count -eq 0) { $filterSummary += "no filters" }
    Write-Error "No Vally *eval.yaml files found under $resolvedScenariosRoot with $($filterSummary -join '; ')"
    exit 1
}

New-Item -ItemType Directory -Path $resolvedResultsRoot -Force | Out-Null

$customGraderPluginDir = Join-Path $PSScriptRoot "scenarios/_shared/vally/grader-plugins/rust-cargo-build-failure"
$customGraderSource = Join-Path $customGraderPluginDir "index.ts"
$customGraderPackage = Join-Path $customGraderPluginDir "package.json"
$customGraderTsConfig = Join-Path $customGraderPluginDir "tsconfig.json"
$customGraderDistEntry = Join-Path $customGraderPluginDir "dist/index.js"
$vallyCmd = Join-Path $PSScriptRoot "node_modules/.bin/vally.cmd"
if (-not (Test-Path -LiteralPath $vallyCmd)) {
    Write-Warning "Local Vally executable not found at $vallyCmd; using 'pnpm exec vally' for this run."
    $vallyCmd = "pnpm-exec"
}

$requiresRustCustomGrader = $false
foreach ($eval in $evalFiles) {
    $match = Select-String -Path $eval.FullName -Pattern 'type:\s*rust-cargo-build-failure-check' -CaseSensitive:$false -ErrorAction SilentlyContinue
    if ($match) {
        $requiresRustCustomGrader = $true
        break
    }
}

if ($requiresRustCustomGrader) {
    if (-not (Test-Path $customGraderPluginDir)) {
        Write-Error "Custom grader plugin directory not found: $customGraderPluginDir"
        exit 1
    }

    $customGraderRebuildReasons = @()
    if (-not (Test-Path $customGraderDistEntry)) {
        $customGraderRebuildReasons += "dist/index.js is missing"
    }
    else {
        $distTime = (Get-Item $customGraderDistEntry).LastWriteTimeUtc
        foreach ($sourcePath in @($customGraderSource, $customGraderTsConfig, $customGraderPackage)) {
            if (Test-Path $sourcePath) {
                $sourceTime = (Get-Item $sourcePath).LastWriteTimeUtc
                if ($sourceTime -gt $distTime) {
                    $customGraderRebuildReasons += "$(Split-Path -Leaf $sourcePath) is newer than dist/index.js"
                }
            }
        }
    }

    if ($customGraderRebuildReasons.Count -gt 0) {
        Write-Host "Custom grader plugin rebuild required: $($customGraderRebuildReasons -join '; ')"

        $buildOutput = $null
        $buildExitCode = 1

        $pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
        if ($pnpmCmd) {
            Write-Host "Rebuilding custom grader plugin via pnpm exec tsc..."
            $buildOutput = & pnpm --dir $PSScriptRoot exec tsc --project $customGraderTsConfig 2>&1
            $buildExitCode = $LASTEXITCODE
        }
        else {
            Write-Host "pnpm not found; rebuilding custom grader plugin via npx tsc..."
            $buildOutput = & npx tsc --project $customGraderTsConfig 2>&1
            $buildExitCode = $LASTEXITCODE
        }

        if ($buildExitCode -ne 0 -or -not (Test-Path $customGraderDistEntry)) {
            if ($buildOutput) {
                $buildOutput | ForEach-Object { Write-Error $_ }
            }
            Write-Error "Failed to build custom grader plugin at $customGraderPluginDir"
            exit 1
        }

        Write-Host "Custom grader plugin rebuilt successfully."
    }
    else {
        Write-Host "Custom grader plugin is up to date."
    }
}

$results = [System.Collections.Concurrent.ConcurrentBag[object]]::new()

$evalFiles | ForEach-Object -ThrottleLimit $Workers -Parallel {
    $evalFile = $_
    $resolvedScenariosRoot = $using:resolvedScenariosRoot
    $resolvedResultsRoot = $using:resolvedResultsRoot
    $requiresRustCustomGrader = $using:requiresRustCustomGrader
    $customGraderPluginDir = $using:customGraderPluginDir
    $JUnit = $using:JUnit
    $PSScriptRoot = $using:PSScriptRoot
    $vallyCmd = $using:vallyCmd
    $results = $using:results

    $relativeDir = [System.IO.Path]::GetRelativePath($resolvedScenariosRoot, $evalFile.DirectoryName).TrimStart('\', '/')
    if ([string]::IsNullOrWhiteSpace($relativeDir)) { $relativeDir = "root" }

    $evalBaseName = [System.IO.Path]::GetFileNameWithoutExtension($evalFile.Name)
    $safeOutDirName = ($relativeDir + "/" + $evalBaseName) -replace '[\\/:*?"<>|]', "_"
    $scenarioOutDir = Join-Path $resolvedResultsRoot $safeOutDirName
    New-Item -ItemType Directory -Path $scenarioOutDir -Force | Out-Null

    Write-Host "`n=== Running eval: $($evalFile.FullName) ==="

    $start = Get-Date
    $vallyArgs = @("eval", "--eval-spec", $evalFile.FullName, "--output-dir", $scenarioOutDir, "--workers", "1")
    if ($requiresRustCustomGrader) { $vallyArgs += @("--grader-plugin", $customGraderPluginDir) }
    if ($JUnit) { $vallyArgs += @("--junit") }

    $evalOutput = @()
    $exitCode = 1
    $PSNativeCommandUseErrorActionPreference = $false
    if ($vallyCmd -and $vallyCmd -ne "pnpm-exec") {
        $evalOutput = & $vallyCmd @vallyArgs 2>&1
        $exitCode = $LASTEXITCODE
    }
    else {
        $evalOutput = & pnpm --dir $PSScriptRoot exec vally @vallyArgs 2>&1
        $exitCode = $LASTEXITCODE
    }

    if ($exitCode -ne 0) {
        Write-Host "Eval failed with exit code ${exitCode}: $($evalFile.FullName)"
        if ($evalOutput) {
            $evalOutput | ForEach-Object { Write-Host $_ }
        }
    }

    $durationSec = [math]::Round(((Get-Date) - $start).TotalSeconds, 1)

    $runDir = $null
    if ($exitCode -eq 0) {
        $runDir = Get-ChildItem -Path $scenarioOutDir -Directory -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1
    }

    $summary = $null
    if ($runDir) {
        $jsonlPath = Join-Path $runDir.FullName "run-summary.jsonl"
        if (Test-Path -LiteralPath $jsonlPath) {
            $line = Get-Content -Path $jsonlPath |
            Select-Object -Last 1
            if ($line) {
                try { $summary = $line | ConvertFrom-Json -Depth 20 } catch {}
            }
        }
    }

    $passed = if ($summary) { [bool]$summary.passed } else { $exitCode -eq 0 }

    $details = ""

    $normalizeDetailText = {
        param([string]$text)

        if ([string]::IsNullOrEmpty($text)) {
            return ""
        }

        # Strip ANSI escape sequences and normalize common status glyphs to ASCII.
        $normalized = $text -replace "`e\[[0-9;?]*[A-Za-z]", ""
        $normalized = $normalized -replace "✅", "PASS"
        $normalized = $normalized -replace "❌", "FAIL"
        $normalized = $normalized -replace "✔", "PASS"
        $normalized = $normalized -replace "✗", "FAIL"

        # Remove non-ASCII characters that can render as mojibake in Windows terminals.
        $normalized = $normalized -replace "[^\u0009\u000A\u000D\u0020-\u007E]", ""
        $normalized = $normalized -replace "\s+", " "

        return $normalized.Trim()
    }

    if ($exitCode -ne 0 -and $evalOutput) {
        $detailLines = $evalOutput |
        Select-Object -Last 8 |
        ForEach-Object {
            & $normalizeDetailText ([string]$_)
        } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

        $details = ($detailLines -join " | ")
    }
    if ($summary -and $summary.evals) {
        $detailItems = foreach ($e in $summary.evals) {
            $status = if ($e.passed) { "PASS" } else { "FAIL" }
            if ($e.scoringApplied -and $null -ne $e.overallScore -and $null -ne $e.threshold) {
                "{0}:{1} ({2}%/{3}%)" -f $e.name, $status, ([math]::Round([double]$e.overallScore * 100, 1)), ([math]::Round([double]$e.threshold * 100, 1))
            }
            elseif ($e.error) {
                "{0}:{1} ({2})" -f $e.name, $status, $e.error
            }
            else {
                "{0}:{1}" -f $e.name, $status
            }
        }
        $details = ($detailItems -join "; ")
    }

    $results.Add([pscustomobject]@{
            Scenario    = $relativeDir
            EvalSpec    = $evalFile.FullName
            Status      = if ($passed) { "PASS" } else { "FAIL" }
            ExitCode    = $exitCode
            DurationSec = $durationSec
            RunDir      = if ($runDir) { $runDir.FullName } else { "" }
            Details     = $details
        })
}

$results = $results | Sort-Object Scenario

Write-Host "`n=== Vally evaluation summary ==="
$results | Sort-Object Scenario | Format-Table -AutoSize Scenario, Status, ExitCode, DurationSec, RunDir

$reportPath = Join-Path $resolvedResultsRoot ("summary-{0}.csv" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
$results | Export-Csv -NoTypeInformation -Path $reportPath
Write-Host "`nDetailed report saved to: $reportPath"

$failed = $results | Where-Object { $_.Status -eq "FAIL" }
if ($failed) {
    Write-Host "`n=== Failed eval details ==="
    $failed | Format-Table -AutoSize Scenario, Details
    exit 1
}

Write-Host "`nAll evaluations passed."
exit 0
