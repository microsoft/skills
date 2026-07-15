#!/usr/bin/env pwsh
<#
.SYNOPSIS
Run harness evaluations on all skills for a specified language.

.DESCRIPTION
Discovers all skills matching a language pattern (e.g., *-rust, *-py, *-dotnet, *-ts, *-java)
and runs both mock and real Copilot harness evaluations for each skill.

.PARAMETER Language
The language suffix to filter skills by (e.g., 'rust', 'py', 'dotnet', 'ts', 'java').
Case-insensitive.

.PARAMETER Mock
If specified, only run mock harness evaluations (skips real Copilot).

.PARAMETER Real
If specified, only run real Copilot evaluations (skips mock).

.PARAMETER ShowDetails
Show per-scenario details, including generated code and findings.

.PARAMETER OutputFile
Optional path to save results as JSON. Defaults to stdout only.

.EXAMPLE
# Run both mock and real harness for all Rust skills
.\run-harness-by-language.ps1 -Language rust

# Run only mock harness for Python skills
.\run-harness-by-language.ps1 -Language py -Mock

# Run real harness with details output and save results
.\run-harness-by-language.ps1 -Language dotnet -Real -ShowDetails -OutputFile results.json

.NOTES
Requires pnpm to be installed and in PATH.
Must be run from the tests directory or with proper CWD setup.
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Language,
    
    [switch]$Mock,
    [switch]$Real,
    [switch]$ShowDetails,
    [string]$OutputFile,
    [ValidateRange(1, 100)]
    [int]$MaxConcurrent = 1  # Sequential by default; set higher for parallel (use with caution)
)

# Normalize language
$Language = $Language.ToLower().TrimStart('*-').TrimEnd('-*')

# Determine which modes to run
$runMock = $true
$runReal = $true
if ($Mock -and -not $Real) { $runReal = $false }
if ($Real -and -not $Mock) { $runMock = $false }

# Find repository root
function Find-RepoRoot {
    $current = Get-Location
    for ($i = 0; $i -lt 5; $i++) {
        if (Test-Path (Join-Path $current ".github/skills")) {
            return $current
        }
        if (Test-Path (Join-Path $current "tests/scenarios")) {
            return Split-Path $current
        }
        $current = Split-Path $current
    }
    return $PWD
}

$repoRoot = Find-RepoRoot
$testsDir = Join-Path $repoRoot "tests"
$scenariosDir = Join-Path $testsDir "scenarios"

if (-not (Test-Path $scenariosDir)) {
    Write-Host "Error: scenarios directory not found at $scenariosDir" -ForegroundColor Red
    exit 1
}

# Discover skills
$skillPattern = "*-$Language"
$skills = @()
if (Test-Path $scenariosDir) {
    $skills = Get-ChildItem $scenariosDir -Directory `
    | Where-Object { $_.Name -like $skillPattern } `
    | Select-Object -ExpandProperty Name `
    | Sort-Object
}

if ($skills.Count -eq 0) {
    Write-Host "No skills found matching pattern: $skillPattern" -ForegroundColor Yellow
    exit 0
}

Write-Host "Found $($skills.Count) skill(s) for language '$Language':" -ForegroundColor Cyan
$skills | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
Write-Host ""

# Initialize results tracking
$results = @{
    language  = $Language
    timestamp = Get-Date -AsUTC
    skills    = @()
    summary   = @{
        mock = @{ passed = 0; failed = 0; errors = @() }
        real = @{ passed = 0; failed = 0; errors = @() }
    }
}

function Get-DiagnosticErrorKind {
    param(
        [string[]]$Diagnostics
    )

    $joined = ($Diagnostics -join "`n").ToLowerInvariant()

    if ($joined -match "authentication failed|bad credentials|github cli user login|401") {
        return "auth"
    }
    if ($joined -match "timeout|session\.idle|timed out") {
        return "timeout"
    }
    if ($joined -match "rate limit|429|econnreset|etimedout|socket hang up|temporarily unavailable|service unavailable") {
        return "transient"
    }
    if ($joined -match "empty or invalid|failed to parse|did not produce json output file") {
        return "parse"
    }

    return "fatal"
}

function Test-HarnessAuthPreflight {
    if ($env:GH_TOKEN -or $env:GITHUB_TOKEN) {
        return $true
    }

    try {
        $null = & gh auth status 2>&1
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

function Get-HarnessModeResult {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Skill,

        [Parameter(Mandatory = $true)]
        [bool]$UseMock,

        [switch]$IncludeDetails
    )

    $tempJson = [System.IO.Path]::GetTempFileName()
    $args = @("harness", $Skill, "--output", "json", "--output-file", $tempJson)

    if ($UseMock) {
        $args += "--mock"
    }

    # Capture stdout/stderr as plain strings in case parsing fails and we need diagnostics.
    $rawOutput = & pnpm @args 2>&1 | ForEach-Object { "$_" }
    $exitCode = $LASTEXITCODE

    try {
        if (-not (Test-Path $tempJson)) {
            $kind = Get-DiagnosticErrorKind -Diagnostics @($rawOutput)
            return @{
                status      = "ERROR"
                error_kind  = $kind
                exit_code   = $exitCode
                error       = "Harness did not produce JSON output file."
                diagnostics = @($rawOutput)
            }
        }

        $jsonText = Get-Content $tempJson -Raw
        if ([string]::IsNullOrWhiteSpace($jsonText)) {
            $kind = Get-DiagnosticErrorKind -Diagnostics @($rawOutput)
            return @{
                status      = "ERROR"
                error_kind  = $kind
                exit_code   = $exitCode
                error       = "Harness JSON output file was empty."
                diagnostics = @($rawOutput)
            }
        }

        $parsed = $jsonText | ConvertFrom-Json -Depth 100

        if ($null -eq $parsed) {
            $kind = Get-DiagnosticErrorKind -Diagnostics @($rawOutput)
            return @{
                status      = "ERROR"
                error_kind  = $kind
                exit_code   = $exitCode
                error       = "Harness JSON output was empty or invalid."
                diagnostics = @($rawOutput)
            }
        }

        if ($parsed.status -eq "ERROR") {
            $combinedDiagnostics = @($rawOutput)
            if ($parsed.diagnostics) {
                $combinedDiagnostics += @($parsed.diagnostics)
            }

            return @{
                status      = "ERROR"
                error_kind  = if ($parsed.error_kind) { $parsed.error_kind } else { Get-DiagnosticErrorKind -Diagnostics $combinedDiagnostics }
                exit_code   = $exitCode
                error       = if ($parsed.error) { $parsed.error } else { "Harness reported an execution error." }
                diagnostics = $combinedDiagnostics
            }
        }

        $result = @{
            status           = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }
            exit_code        = $exitCode
            summary          = @{
                total_scenarios = $parsed.total_scenarios
                passed          = $parsed.passed
                failed          = $parsed.failed
                pass_rate       = $parsed.pass_rate
                avg_score       = $parsed.avg_score
                duration_ms     = $parsed.duration_ms
            }
            failed_scenarios = @()
        }

        foreach ($scenarioResult in @($parsed.results)) {
            if (-not $scenarioResult.passed) {
                $result.failed_scenarios += @{
                    scenario = $scenarioResult.scenario
                    score    = $scenarioResult.score
                    findings = @($scenarioResult.findings)
                }
            }
        }

        if ($IncludeDetails) {
            $result.scenarios = @()
            foreach ($scenarioResult in @($parsed.results)) {
                $result.scenarios += @{
                    scenario       = $scenarioResult.scenario
                    passed         = $scenarioResult.passed
                    score          = $scenarioResult.score
                    generated_code = $scenarioResult.generated_code
                    raw_response   = $scenarioResult.raw_response
                    findings       = @($scenarioResult.findings)
                }
            }
        }

        return $result
    }
    catch {
        $kind = Get-DiagnosticErrorKind -Diagnostics @($rawOutput)
        return @{
            status      = "ERROR"
            error_kind  = $kind
            exit_code   = $exitCode
            error       = "Failed to parse harness JSON output: $($_.Exception.Message)"
            diagnostics = @($rawOutput)
        }
    }
    finally {
        Remove-Item -Path $tempJson -Force -ErrorAction SilentlyContinue
    }
}

# Run harness for each skill
Set-Location $testsDir

$canRunRealHarness = $true
if ($runReal) {
    $canRunRealHarness = Test-HarnessAuthPreflight
    if (-not $canRunRealHarness) {
        Write-Host "Real harness auth preflight failed. Skipping all real-mode runs." -ForegroundColor Red
        Write-Host "Run 'gh auth login' or set GH_TOKEN/GITHUB_TOKEN, then rerun." -ForegroundColor Yellow
        Write-Host ""
    }
}

foreach ($skill in $skills) {
    $skillResult = @{
        name = $skill
        mock = $null
        real = $null
    }
    
    Write-Host "Evaluating: $skill" -ForegroundColor Yellow
    Write-Host "-" * 60
    
    # Mock harness
    if ($runMock) {
        Write-Host "  [MOCK] Running..." -ForegroundColor Gray -NoNewline
        try {
            $mockResult = Get-HarnessModeResult -Skill $skill -UseMock $true -IncludeDetails:$ShowDetails
            $mockSuccess = $mockResult.status -eq "PASS"
            
            if ($mockSuccess) {
                Write-Host " ✓ PASS" -ForegroundColor Green
                $results.summary.mock.passed++
                $skillResult.mock = $mockResult
            }
            else {
                $statusColor = if ($mockResult.status -eq "ERROR") { "Red" } else { "Red" }
                Write-Host " ✗ $($mockResult.status)" -ForegroundColor $statusColor
                $results.summary.mock.failed++
                $results.summary.mock.errors += $skill
                $skillResult.mock = $mockResult
            }
            
            if ($ShowDetails -and $skillResult.mock.summary) {
                $mockSummary = $skillResult.mock.summary
                Write-Host "    scenarios: $($mockSummary.passed)/$($mockSummary.total_scenarios), avg score: $([math]::Round([double]$mockSummary.avg_score, 1))" -ForegroundColor DarkGray
            }
        }
        catch {
            Write-Host " ✗ ERROR" -ForegroundColor Red
            $results.summary.mock.failed++
            $results.summary.mock.errors += "$skill (Exception: $_)"
            $skillResult.mock = @{
                status = "ERROR"
                error  = $_.Exception.Message
            }
        }
    }
    
    # Real harness
    if ($runReal) {
        if (-not $canRunRealHarness) {
            Write-Host "  [REAL]  Skipped (auth preflight failed)" -ForegroundColor Red
            $results.summary.real.failed++
            $results.summary.real.errors += "$skill (AUTH_ERROR)"
            $skillResult.real = @{
                status     = "ERROR"
                error_kind = "auth"
                error      = "Skipped due to failed auth preflight. Run 'gh auth login' or set GH_TOKEN/GITHUB_TOKEN."
            }
            Write-Host ""
            $results.skills += $skillResult
            continue
        }

        Write-Host "  [REAL]  Running..." -ForegroundColor Gray -NoNewline
        try {
            $realResult = Get-HarnessModeResult -Skill $skill -UseMock $false -IncludeDetails:$ShowDetails
            $realSuccess = $realResult.status -eq "PASS"
            
            if ($realSuccess) {
                Write-Host " ✓ PASS" -ForegroundColor Green
                $results.summary.real.passed++
                $skillResult.real = $realResult
            }
            else {
                $statusColor = if ($realResult.status -eq "ERROR") { "Red" } else { "Red" }
                Write-Host " ✗ $($realResult.status)" -ForegroundColor $statusColor
                $results.summary.real.failed++
                $results.summary.real.errors += $skill
                $skillResult.real = $realResult
            }
            
            if ($ShowDetails -and $skillResult.real.summary) {
                $realSummary = $skillResult.real.summary
                Write-Host "    scenarios: $($realSummary.passed)/$($realSummary.total_scenarios), avg score: $([math]::Round([double]$realSummary.avg_score, 1))" -ForegroundColor DarkGray
            }
        }
        catch {
            Write-Host " ✗ ERROR" -ForegroundColor Red
            $results.summary.real.failed++
            $results.summary.real.errors += "$skill (Exception: $_)"
            $skillResult.real = @{
                status = "ERROR"
                error  = $_.Exception.Message
            }
        }
    }
    
    Write-Host ""
    $results.skills += $skillResult
}

# Summary Report
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "EVALUATION SUMMARY - Language: $Language" -ForegroundColor Cyan
Write-Host "=" * 60

if ($runMock) {
    $mockTotal = $results.summary.mock.passed + $results.summary.mock.failed
    $mockPassRate = if ($mockTotal -gt 0) { [math]::Round(($results.summary.mock.passed / $mockTotal) * 100, 1) } else { 0 }
    
    Write-Host ""
    Write-Host "MOCK MODE:" -ForegroundColor Yellow
    Write-Host "  Passed:  $($results.summary.mock.passed)/$mockTotal ($mockPassRate%)" -ForegroundColor $(if ($results.summary.mock.failed -eq 0) { "Green" } else { "Yellow" })
    if ($results.summary.mock.errors.Count -gt 0) {
        Write-Host "  Failed skills: $($results.summary.mock.errors -join ', ')" -ForegroundColor Red
    }
}

if ($runReal) {
    $realTotal = $results.summary.real.passed + $results.summary.real.failed
    $realPassRate = if ($realTotal -gt 0) { [math]::Round(($results.summary.real.passed / $realTotal) * 100, 1) } else { 0 }
    
    Write-Host ""
    Write-Host "REAL COPILOT MODE:" -ForegroundColor Yellow
    Write-Host "  Passed:  $($results.summary.real.passed)/$realTotal ($realPassRate%)" -ForegroundColor $(if ($results.summary.real.failed -eq 0) { "Green" } else { "Yellow" })
    if ($results.summary.real.errors.Count -gt 0) {
        Write-Host "  Failed skills: $($results.summary.real.errors -join ', ')" -ForegroundColor Red
    }
}

# Save results if requested
if ($OutputFile) {
    try {
        $results | ConvertTo-Json -Depth 10 | Out-File -FilePath $OutputFile -Encoding UTF8
        Write-Host ""
        Write-Host "Results saved to: $OutputFile" -ForegroundColor Green
    }
    catch {
        Write-Host "Warning: Could not save results to $OutputFile - $_" -ForegroundColor Yellow
    }
}

# Final status
$totalFailed = $results.summary.mock.failed + $results.summary.real.failed
if ($totalFailed -gt 0) {
    Write-Host ""
    Write-Host "Some evaluations failed. Check output above." -ForegroundColor Red
    exit 1
}
else {
    Write-Host ""
    Write-Host "All evaluations passed!" -ForegroundColor Green
    exit 0
}
