#Requires -Version 7.0
<#
.SYNOPSIS
Run vally skill effectiveness experiments for specified skills.

.DESCRIPTION
Executes skill_effectiveness_experiment.yaml files for all or specified skills.
Each experiment runs two variants (baseline without skill, skill with skill context) and
stores results organized by timestamp.

Use -SkillPattern to filter by language (e.g., '*-py' for Python, '*-rs' for Rust)
or by service (e.g., 'azure-cosmos*' for Cosmos DB).

Results can be compared using compare-experiment.mjs to analyze skill impact on performance.

.PARAMETER ScenariosRoot
Root directory containing skill scenario subdirectories.
Defaults to: <script-dir>/scenarios

.PARAMETER ResultsRoot
Root directory where experiment results will be stored.
Defaults to: <script-dir>/vally-experiment-results

.PARAMETER SkillPattern
Filter which skills to run. Supports wildcards.
Defaults to '*-py' (all Python skills).
Examples: -SkillPattern '*-rust', -SkillPattern 'azure-ai-*'

.PARAMETER Workers
Number of parallel experiment runs. Defaults to 1 (sequential).

.PARAMETER DryRun
If set, shows what experiments would be run without actually running them.

.PARAMETER Compare
If set, runs compare-experiment.mjs after completion to generate A/B reports.

.PARAMETER AnalysisOnly
If set, skips vally execution and regenerates narratives/comparisons from existing outputs.

.PARAMETER ExperimentOutputDir
Existing experiment output root to analyze when using -AnalysisOnly.
If omitted in analysis-only mode, the latest directory under ResultsRoot is used.

.PARAMETER CopilotMaxAttempts
Maximum retries per copilot invocation path for narrative generation.

.PARAMETER NoNodeLoaderFallback
Disable node-loader fallback and use only documented copilot invocation methods.

.EXAMPLE
./run-skill-experiments.ps1
# Run all Python skill experiments sequentially

.EXAMPLE
./run-skill-experiments.ps1 -SkillPattern '*-rust' -Workers 4
# Run all Rust skill experiments with 4 parallel workers

.EXAMPLE
./run-skill-experiments.ps1 -SkillPattern 'azure-cosmos*' -Verbose
# Run only Cosmos DB skill experiments with verbose output

.EXAMPLE
./run-skill-experiments.ps1 -Workers 5 -Compare
# Run all (Python) experiments with 5 parallel workers, then generate comparison reports

.EXAMPLE
./run-skill-experiments.ps1 -DryRun
# Preview which experiments would be run

.EXAMPLE
./run-skill-experiments.ps1 -AnalysisOnly -ExperimentOutputDir "q:\src\skills\tests\vally-experiment-results\2026-07-06T17-00-00-000Z"
# Regenerate narratives/comparisons from an existing experiment output without rerunning vally
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ScenariosRoot = (Join-Path $PSScriptRoot "scenarios"),
    
    [Parameter(Mandatory = $false)]
    [string]$ResultsRoot = (Join-Path $PSScriptRoot "vally-experiment-results"),
    
    [Parameter(Mandatory = $false)]
    [string]$SkillPattern = "*-py",
    
    [Parameter(Mandatory = $false)]
    [ValidateRange(1, 128)]
    [int]$Workers = 1,
    
    [Parameter(Mandatory = $false)]
    [switch]$DryRun,
    
    [Parameter(Mandatory = $false)]
    [switch]$Compare

    ,
    [Parameter(Mandatory = $false)]
    [switch]$AnalysisOnly

    ,
    [Parameter(Mandatory = $false)]
    [string]$ExperimentOutputDir

    ,
    [Parameter(Mandatory = $false)]
    [ValidateRange(1, 10)]
    [int]$CopilotMaxAttempts = 2,

    [Parameter(Mandatory = $false)]
    [switch]$NoNodeLoaderFallback
)

$ErrorActionPreference = "Stop"

function Get-ExperimentOutputDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$OutputText
    )

    $outputMatches = [regex]::Matches($OutputText, 'Output:\s*(.+)')
    if ($outputMatches.Count -eq 0) {
        return $null
    }

    for ($i = $outputMatches.Count - 1; $i -ge 0; $i--) {
        $candidate = $outputMatches[$i].Groups[1].Value.Trim()
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    return $outputMatches[$outputMatches.Count - 1].Groups[1].Value.Trim()
}

function Get-VariantDigest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ResultsJsonlPath
    )

    if (-not (Test-Path $ResultsJsonlPath)) {
        return $null
    }

    $records = @()
    foreach ($line in (Get-Content -Path $ResultsJsonlPath -ErrorAction SilentlyContinue)) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        try {
            $obj = $line | ConvertFrom-Json
            if ($obj.type -eq "trial-result") {
                $records += $obj
            }
        }
        catch {
            continue
        }
    }

    if ($records.Count -eq 0) {
        return $null
    }

    $variantName = $records[0].variant
    $evalName = $records[0].evalName
    $model = $records[0].model

    $scores = @()
    $tokens = @()
    $turns = @()
    $toolCalls = @()
    $wallTimesMs = @()
    $errors = @()
    $skillActivations = @()
    $toolBreakdownTotals = @{}
    $skillBreakdownTotals = @{}
    $failedGraderBreakdown = @{}
    $timeoutGraderBreakdown = @{}
    $totalFailedGraders = 0
    $totalTimeoutGraders = 0
    $stimuli = @()

    foreach ($record in $records) {
        if ($record.gradeResult -and $null -ne $record.gradeResult.score) {
            $scores += [double]$record.gradeResult.score
        }

        $traj = $record.trajectory
        $metrics = $traj.metrics
        if ($metrics) {
            if ($metrics.tokenUsage -and $null -ne $metrics.tokenUsage.totalTokens) {
                $tokens += [int]$metrics.tokenUsage.totalTokens
            }
            if ($null -ne $metrics.turnCount) {
                $turns += [int]$metrics.turnCount
            }
            if ($null -ne $metrics.toolCallCount) {
                $toolCalls += [int]$metrics.toolCallCount
            }
            if ($null -ne $metrics.wallTimeMs) {
                $wallTimesMs += [int]$metrics.wallTimeMs
            }
            if ($null -ne $metrics.errorCount) {
                $errors += [int]$metrics.errorCount
            }
            if ($null -ne $metrics.skillActivationCount) {
                $skillActivations += [int]$metrics.skillActivationCount
            }

            if ($metrics.toolCallBreakdown) {
                $metrics.toolCallBreakdown.psobject.Properties | ForEach-Object {
                    if (-not $toolBreakdownTotals.ContainsKey($_.Name)) {
                        $toolBreakdownTotals[$_.Name] = 0
                    }
                    $toolBreakdownTotals[$_.Name] += [int]$_.Value
                }
            }

            if ($metrics.skillActivationBreakdown) {
                $metrics.skillActivationBreakdown.psobject.Properties | ForEach-Object {
                    if (-not $skillBreakdownTotals.ContainsKey($_.Name)) {
                        $skillBreakdownTotals[$_.Name] = 0
                    }
                    $skillBreakdownTotals[$_.Name] += [int]$_.Value
                }
            }
        }

        $stimulus = $traj.stimulus
        $graderOutcomes = @()
        if ($record.gradeResult -and $record.gradeResult.details) {
            foreach ($detail in $record.gradeResult.details) {
                $graderEvidence = if ($null -ne $detail.evidence) { [string]$detail.evidence } else { "" }
                $isTimeout = (-not [bool]$detail.passed) -and ($graderEvidence -match '(?i)\btime(d)?\s*out\b|\btimeout\b')

                if (-not [bool]$detail.passed) {
                    $totalFailedGraders++

                    if (-not $failedGraderBreakdown.ContainsKey($detail.name)) {
                        $failedGraderBreakdown[$detail.name] = 0
                    }
                    $failedGraderBreakdown[$detail.name] += 1

                    if ($isTimeout) {
                        $totalTimeoutGraders++
                        if (-not $timeoutGraderBreakdown.ContainsKey($detail.name)) {
                            $timeoutGraderBreakdown[$detail.name] = 0
                        }
                        $timeoutGraderBreakdown[$detail.name] += 1
                    }
                }

                $graderOutcomes += [ordered]@{
                    name      = $detail.name
                    passed    = [bool]$detail.passed
                    score     = if ($null -ne $detail.score) { [double]$detail.score } else { $null }
                    evidence  = $detail.evidence
                    isTimeout = $isTimeout
                }
            }
        }

        $outputPreview = ""
        if ($traj -and $traj.output) {
            $outputString = [string]$traj.output
            $maxLen = 800
            $outputPreview = if ($outputString.Length -gt $maxLen) { $outputString.Substring(0, $maxLen) } else { $outputString }
        }

        $stimuli += [ordered]@{
            name              = $record.stimulus
            passed            = [bool]$record.gradeResult.passed
            scorePct          = if ($null -ne $record.gradeResult.score) { [math]::Round(([double]$record.gradeResult.score * 100), 1) } else { $null }
            durationSec       = [math]::Round(([double]$record.durationMs / 1000), 1)
            prompt            = if ($stimulus) { $stimulus.prompt } else { $null }
            rubric            = if ($stimulus) { $stimulus.rubric } else { @() }
            toolCallBreakdown = if ($metrics) { $metrics.toolCallBreakdown } else { $null }
            graderOutcomes    = $graderOutcomes
            outputPreview     = $outputPreview
        }
    }

    return [ordered]@{
        variant                        = $variantName
        eval                           = $evalName
        model                          = $model
        trialCount                     = $records.Count
        avgScorePct                    = if ($scores.Count -gt 0) { [math]::Round((($scores | Measure-Object -Average).Average * 100), 1) } else { $null }
        avgTokens                      = if ($tokens.Count -gt 0) { [int](($tokens | Measure-Object -Average).Average) } else { $null }
        avgTurns                       = if ($turns.Count -gt 0) { [math]::Round((($turns | Measure-Object -Average).Average), 1) } else { $null }
        avgToolCalls                   = if ($toolCalls.Count -gt 0) { [math]::Round((($toolCalls | Measure-Object -Average).Average), 1) } else { $null }
        avgWallTimeSec                 = if ($wallTimesMs.Count -gt 0) { [math]::Round(((($wallTimesMs | Measure-Object -Average).Average) / 1000), 1) } else { $null }
        totalErrors                    = if ($errors.Count -gt 0) { [int](($errors | Measure-Object -Sum).Sum) } else { 0 }
        totalSkillActivations          = if ($skillActivations.Count -gt 0) { [int](($skillActivations | Measure-Object -Sum).Sum) } else { 0 }
        toolCallBreakdownTotals        = $toolBreakdownTotals
        skillActivationBreakdownTotals = $skillBreakdownTotals
        totalFailedGraders             = $totalFailedGraders
        totalTimeoutGraders            = $totalTimeoutGraders
        failedGraderBreakdown          = $failedGraderBreakdown
        timeoutGraderBreakdown         = $timeoutGraderBreakdown
        stimuli                        = $stimuli
    }
}

function Invoke-ExternalProcessCaptured {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $false)]
        [string[]]$ArgumentList = @()
    )

    try {
        $resolvedPath = $FilePath
        $resolvedCommand = Get-Command -Name $FilePath -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($resolvedCommand -and -not [string]::IsNullOrWhiteSpace($resolvedCommand.Source)) {
            $resolvedPath = $resolvedCommand.Source
        }

        $effectiveFilePath = $resolvedPath
        $effectiveArgs = New-Object System.Collections.Generic.List[string]
        foreach ($arg in $ArgumentList) {
            [void]$effectiveArgs.Add([string]$arg)
        }

        if ($resolvedPath -and $resolvedPath.EndsWith('.ps1', [System.StringComparison]::OrdinalIgnoreCase)) {
            $pwshCommand = Get-Command -Name pwsh -ErrorAction SilentlyContinue | Select-Object -First 1
            if (-not $pwshCommand) {
                $pwshCommand = Get-Command -Name powershell -ErrorAction SilentlyContinue | Select-Object -First 1
            }

            if (-not $pwshCommand -or [string]::IsNullOrWhiteSpace($pwshCommand.Source)) {
                throw "PowerShell executable not found while attempting to launch script: $resolvedPath"
            }

            $effectiveFilePath = $pwshCommand.Source
            $scriptArgs = New-Object System.Collections.Generic.List[string]
            [void]$scriptArgs.Add('-NoProfile')
            [void]$scriptArgs.Add('-File')
            [void]$scriptArgs.Add($resolvedPath)
            foreach ($arg in $effectiveArgs) {
                [void]$scriptArgs.Add($arg)
            }
            $effectiveArgs = $scriptArgs
        }

        $psi = [System.Diagnostics.ProcessStartInfo]::new()
        $psi.FileName = $effectiveFilePath
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true

        foreach ($arg in $effectiveArgs) {
            [void]$psi.ArgumentList.Add([string]$arg)
        }

        $process = [System.Diagnostics.Process]::new()
        $process.StartInfo = $psi

        [void]$process.Start()
        $stdoutText = $process.StandardOutput.ReadToEnd()
        $stderrText = $process.StandardError.ReadToEnd()
        $process.WaitForExit()

        $combinedOutput = $stdoutText
        if (-not [string]::IsNullOrWhiteSpace($stderrText)) {
            if (-not [string]::IsNullOrWhiteSpace($combinedOutput)) {
                $combinedOutput += "`n"
            }
            $combinedOutput += $stderrText
        }

        return [pscustomobject]@{
            ExitCode = $process.ExitCode
            Output   = $combinedOutput.Trim()
            Stderr   = $stderrText.Trim()
        }
    }
    catch {
        return [pscustomobject]@{
            ExitCode = -1
            Output   = ""
            Stderr   = $_.Exception.Message
        }
    }
}

function Invoke-CopilotNarrative {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Prompt,

        [Parameter(Mandatory = $false)]
        [ValidateRange(1, 10)]
        [int]$MaxAttempts = 2,

        [Parameter(Mandatory = $false)]
        [bool]$EnableNodeLoaderFallback = $true
    )

    $copilotCommand = Get-Command copilot -ErrorAction SilentlyContinue
    if (-not $copilotCommand) {
        return $null
    }

    $copilotSource = $copilotCommand.Source
    $copilotDir = Split-Path -Path $copilotSource -Parent

    $npmLoaderPath = $null
    $loaderCandidates = @(
        (Join-Path $copilotDir "node_modules\@github\copilot\npm-loader.js"),
        "q:\.tools\.npm-global\node_modules\@github\copilot\npm-loader.js"
    )

    try {
        $npmGlobalRoot = (& npm root -g 2>$null | Select-Object -First 1)
        if (-not [string]::IsNullOrWhiteSpace($npmGlobalRoot)) {
            $loaderCandidates += (Join-Path $npmGlobalRoot.Trim() "@github\copilot\npm-loader.js")
        }
    }
    catch {
        # Ignore npm-root discovery failures and continue with known candidates.
    }

    foreach ($candidate in $loaderCandidates) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path $candidate)) {
            $npmLoaderPath = $candidate
            break
        }
    }

    $baseArgs = @("--silent", "--allow-all-tools", "--allow-all-paths", "-p", $Prompt)

    $attempts = @()

    $npxInvoker = $null
    $npxCandidates = @("npx.ps1", "npx.cmd", "npx")
    foreach ($candidate in $npxCandidates) {
        $npxCommand = Get-Command -Name $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($npxCommand -and -not [string]::IsNullOrWhiteSpace($npxCommand.Source)) {
            $npxInvoker = $npxCommand.Source
            break
        }
    }

    if (-not $npxInvoker) {
        $npxInvoker = "npx"
    }

    # First choice: documented npx invocation.
    $attempts += [pscustomobject]@{
        Name = "npx"
        Cmd  = $npxInvoker
        Args = @("@github/copilot") + $baseArgs
    }

    # Final fallback: use discovered copilot command path (prefer .cmd over .ps1).
    $fallbackInvoker = $copilotSource
    if ($fallbackInvoker -and $fallbackInvoker.EndsWith('.ps1', [System.StringComparison]::OrdinalIgnoreCase)) {
        $cmdCandidate = [System.IO.Path]::ChangeExtension($fallbackInvoker, '.cmd')
        if (Test-Path $cmdCandidate) {
            $fallbackInvoker = $cmdCandidate
        }
    }

    $attempts += [pscustomobject]@{
        Name = "copilot-wrapper"
        Cmd  = $fallbackInvoker
        Args = $baseArgs
    }

    # Final fallback: npm-loader.js via node (undocumented implementation detail).
    if ($EnableNodeLoaderFallback -and (Test-Path $npmLoaderPath)) {
        $attempts += [pscustomobject]@{
            Name = "node-loader"
            Cmd  = "node"
            Args = @($npmLoaderPath) + $baseArgs
        }
    }

    foreach ($attempt in $attempts) {
        for ($i = 1; $i -le $MaxAttempts; $i++) {
            Write-Verbose "Copilot narrative attempt '$($attempt.Name)' try $i/$MaxAttempts"
            $execution = Invoke-ExternalProcessCaptured -FilePath $attempt.Cmd -ArgumentList @($attempt.Args)

            if ($execution.ExitCode -eq 0) {
                Write-Verbose "Copilot narrative succeeded via '$($attempt.Name)'"
                return $execution.Output
            }

            if (-not [string]::IsNullOrWhiteSpace($execution.Stderr)) {
                Write-Verbose "Copilot narrative '$($attempt.Name)' failed: $($execution.Stderr)"
            }
            else {
                Write-Verbose "Copilot narrative '$($attempt.Name)' exited with code $($execution.ExitCode)"
            }

            if ($i -lt $MaxAttempts) {
                Start-Sleep -Milliseconds (250 * $i)
            }
        }
    }

    return $null
}

function Resolve-ExperimentOutputDir {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SkillDirPath
    )

    if (-not (Test-Path $SkillDirPath)) {
        return $null
    }

    $directVariantDirs = Get-ChildItem -Path $SkillDirPath -Directory -ErrorAction SilentlyContinue | Where-Object {
        Test-Path (Join-Path $_.FullName "results.jsonl")
    }

    if ($directVariantDirs.Count -ge 2) {
        return $SkillDirPath
    }

    $candidateRuns = Get-ChildItem -Path $SkillDirPath -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending
    foreach ($candidate in $candidateRuns) {
        $variantDirs = Get-ChildItem -Path $candidate.FullName -Directory -ErrorAction SilentlyContinue | Where-Object {
            Test-Path (Join-Path $_.FullName "results.jsonl")
        }
        if ($variantDirs.Count -ge 2) {
            return $candidate.FullName
        }
    }

    return $null
}

function Get-LatestResultsDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RootPath
    )

    if (-not (Test-Path $RootPath)) {
        return $null
    }

    $dirs = Get-ChildItem -Path $RootPath -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending
    if ($dirs.Count -eq 0) {
        return $null
    }

    return $dirs[0].FullName
}

function Generate-NarrativesOnly {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AnalysisRoot,

        [Parameter(Mandatory = $true)]
        [string]$SkillNamePattern,

        [Parameter(Mandatory = $false)]
        [int]$NarrativeMaxAttempts = 2,

        [Parameter(Mandatory = $false)]
        [bool]$EnableNodeLoaderFallback = $true
    )

    Write-Information ""
    Write-Information "Analysis-Only Mode"
    Write-Information "Source Results Directory: $AnalysisRoot"

    $skillDirs = Get-ChildItem -Path $AnalysisRoot -Directory -Filter $SkillNamePattern -ErrorAction SilentlyContinue | Sort-Object Name
    if ($skillDirs.Count -eq 0) {
        Write-Warning "No skill result directories found in $AnalysisRoot matching pattern: $SkillNamePattern"
        return 1
    }

    $generated = 0
    $failed = 0

    foreach ($skillDir in $skillDirs) {
        $experimentDir = Resolve-ExperimentOutputDir -SkillDirPath $skillDir.FullName
        if (-not $experimentDir) {
            Write-Host "  ✗ No valid experiment output found for $($skillDir.Name)" -ForegroundColor Yellow
            $failed++
            continue
        }

        $ok = Generate-SkillNarratives -SkillName $skillDir.Name -ExperimentOutputDir $experimentDir -SkillResultsDir $skillDir.FullName -NarrativeMaxAttempts $NarrativeMaxAttempts -EnableNodeLoaderFallback $EnableNodeLoaderFallback
        if ($ok) {
            $generated++
            Write-Host "  ✓ Narratives generated for $($skillDir.Name)" -ForegroundColor Green
        }
        else {
            $failed++
            Write-Host "  ✗ Narrative generation failed for $($skillDir.Name)" -ForegroundColor Yellow
            continue
        }
    }

    Write-Host "Narrative Summary: generated=$generated failed=$failed" -ForegroundColor Cyan
    if ($failed -gt 0) {
        return 1
    }
    return 0
}

function Normalize-NarrativeText {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    # Keep markdown output plain ASCII to avoid rendering/encoding mismatches.
    $normalized = $Text
    $normalized = $normalized -replace '[^\x09\x0A\x0D\x20-\x7E]', ''

    return $normalized
}

function Convert-ToolBreakdownToText {
    param(
        [Parameter(Mandatory = $false)]
        $Breakdown
    )

    if (-not $Breakdown) {
        return "none"
    }

    $parts = @()
    if ($Breakdown -is [System.Collections.IDictionary]) {
        foreach ($key in $Breakdown.Keys) {
            $parts += "${key}: $($Breakdown[$key])"
        }
    }
    else {
        $Breakdown.psobject.Properties | ForEach-Object {
            $parts += "$($_.Name): $($_.Value)"
        }
    }

    if ($parts.Count -eq 0) {
        return "none"
    }

    return ($parts -join ", ")
}

function Get-PromptFocusSummary {
    param(
        [Parameter(Mandatory = $false)]
        [string]$Prompt
    )

    if ([string]::IsNullOrWhiteSpace($Prompt)) {
        return "Prompt text not available in digest."
    }

    $singleLine = ($Prompt -replace "`r?`n", " ").Trim()
    $maxLen = 260
    if ($singleLine.Length -le $maxLen) {
        return $singleLine
    }

    return $singleLine.Substring(0, $maxLen).Trim() + "..."
}

function Format-ElapsedDuration {
    param(
        [Parameter(Mandatory = $true)]
        [double]$Seconds
    )

    $duration = [TimeSpan]::FromSeconds($Seconds)
    return "{0}h {1}m {2:F1}s" -f [int]$duration.TotalHours, $duration.Minutes, ($duration.Seconds + ($duration.Milliseconds / 1000))
}

function New-VariantNarrativeFromDigest {
    param(
        [Parameter(Mandatory = $true)]
        $Digest
    )

    $sb = New-Object System.Text.StringBuilder
    $failedGraderNamesText = if ($Digest.failedGraderBreakdown -and $Digest.failedGraderBreakdown.Count -gt 0) { ($Digest.failedGraderBreakdown.Keys | Sort-Object) -join ", " } else { "none" }
    $timeoutGraderNamesText = if ($Digest.timeoutGraderBreakdown -and $Digest.timeoutGraderBreakdown.Count -gt 0) { ($Digest.timeoutGraderBreakdown.Keys | Sort-Object) -join ", " } else { "none" }

    [void]$sb.AppendLine("# Execution Summary")
    [void]$sb.AppendLine()
    [void]$sb.AppendLine("Variant $($Digest.variant) in eval $($Digest.eval) with model $($Digest.model) ran $($Digest.trialCount) trials.")
    [void]$sb.AppendLine("Average metrics for this variant: score $($Digest.avgScorePct)%, tokens $($Digest.avgTokens), turns $($Digest.avgTurns), tool calls $($Digest.avgToolCalls), wall time $($Digest.avgWallTimeSec)s.")
    [void]$sb.AppendLine("Run totals for this variant: errors $($Digest.totalErrors), skill activations $($Digest.totalSkillActivations), tool usage $(Convert-ToolBreakdownToText -Breakdown $Digest.toolCallBreakdownTotals).")
    [void]$sb.AppendLine("Grader outcomes across this variant: failed graders $($Digest.totalFailedGraders), timeout-related grader failures $($Digest.totalTimeoutGraders).")
    [void]$sb.AppendLine("Failed grader names: $failedGraderNamesText. Timeout-related grader names: $timeoutGraderNamesText.")
    [void]$sb.AppendLine()

    [void]$sb.AppendLine("# Stimulus Narratives")
    [void]$sb.AppendLine()

    foreach ($stimulus in $Digest.stimuli) {
        [void]$sb.AppendLine("### Stimulus: $($stimulus.name)")
        [void]$sb.AppendLine("- Prompt Focus: $(Get-PromptFocusSummary -Prompt $stimulus.prompt)")
        [void]$sb.AppendLine("- Actions Taken: turns $($Digest.avgTurns) average for this variant; tool calls for this stimulus were $(Convert-ToolBreakdownToText -Breakdown $stimulus.toolCallBreakdown).")

        $graderParts = @()
        foreach ($grader in $stimulus.graderOutcomes) {
            $graderStatus = if ($grader.passed) { "passed" } else { "failed" }
            $graderParts += "$($grader.name): $graderStatus ($($grader.score))"
        }
        $graderText = if ($graderParts.Count -gt 0) { $graderParts -join "; " } else { "none" }

        $resultStatus = if ($stimulus.passed) { "passed" } else { "failed" }
        [void]$sb.AppendLine("- Result: stimulus $resultStatus with score $($stimulus.scorePct)% in $($stimulus.durationSec)s; graders: $graderText.")

        $failedGraders = @($stimulus.graderOutcomes | Where-Object { -not $_.passed })
        $timeoutGraders = @($failedGraders | Where-Object { $_.isTimeout })
        $nonTimeoutGraders = @($failedGraders | Where-Object { -not $_.isTimeout })

        if ($failedGraders.Count -eq 0) {
            [void]$sb.AppendLine("- Failed graders: none.")
        }
        else {
            $nonTimeoutText = if ($nonTimeoutGraders.Count -gt 0) { ($nonTimeoutGraders | ForEach-Object { $_.name } | Sort-Object -Unique) -join ", " } else { "none" }
            $timeoutText = if ($timeoutGraders.Count -gt 0) { ($timeoutGraders | ForEach-Object { $_.name } | Sort-Object -Unique) -join ", " } else { "none" }
            [void]$sb.AppendLine("- Failed graders: non-timeout = $nonTimeoutText; timeout-related = $timeoutText.")
            if ($timeoutGraders.Count -gt 0) {
                [void]$sb.AppendLine("- Timeout note: one or more grader failures indicate timeout behavior; consider checking whether the stimulus timeout budget is too low for this scenario.")
            }
        }
        [void]$sb.AppendLine()
    }

    [void]$sb.AppendLine("# Tool and Turn Behavior")
    [void]$sb.AppendLine()
    [void]$sb.AppendLine("This variant averaged $($Digest.avgTurns) turns and $($Digest.avgToolCalls) tool calls per trial.")
    [void]$sb.AppendLine("Aggregate tool breakdown for this variant: $(Convert-ToolBreakdownToText -Breakdown $Digest.toolCallBreakdownTotals).")
    [void]$sb.AppendLine()

    [void]$sb.AppendLine("# Grading Outcome")
    [void]$sb.AppendLine()
    [void]$sb.AppendLine("Trials run: $($Digest.trialCount). Average score for this variant: $($Digest.avgScorePct)%.")
    [void]$sb.AppendLine("Total errors recorded: $($Digest.totalErrors).")
    [void]$sb.AppendLine("Failed grader count: $($Digest.totalFailedGraders). Timeout-related grader failures: $($Digest.totalTimeoutGraders).")
    [void]$sb.AppendLine("Failed grader names: $failedGraderNamesText. Timeout-related grader names: $timeoutGraderNamesText.")
    [void]$sb.AppendLine()

    [void]$sb.AppendLine("# Notable Strengths")
    [void]$sb.AppendLine()
    [void]$sb.AppendLine("- Completed $($Digest.trialCount) trials with total errors $($Digest.totalErrors).")
    [void]$sb.AppendLine("- Produced runnable code artifacts validated during each trial.")
    [void]$sb.AppendLine()

    [void]$sb.AppendLine("# Notable Weaknesses")
    [void]$sb.AppendLine()
    if ([int]$Digest.totalFailedGraders -gt 0) {
        [void]$sb.AppendLine("- Failed graders were recorded: $(Convert-ToolBreakdownToText -Breakdown $Digest.failedGraderBreakdown).")
    }
    else {
        [void]$sb.AppendLine("- No failed graders were recorded in this variant.")
    }

    if ([int]$Digest.totalTimeoutGraders -gt 0) {
        [void]$sb.AppendLine("- Timeout-related grader failures were recorded: $(Convert-ToolBreakdownToText -Breakdown $Digest.timeoutGraderBreakdown). This often points to an undersized stimulus timeout budget rather than a logic error.")
    }

    return $sb.ToString().Trim()
}

function Get-PassRatePct {
    param(
        [Parameter(Mandatory = $true)]
        $Digest
    )

    if (-not $Digest.stimuli -or $Digest.stimuli.Count -eq 0) {
        return 0.0
    }

    $passedCount = @($Digest.stimuli | Where-Object { $_.passed }).Count
    return [math]::Round((100.0 * $passedCount / $Digest.stimuli.Count), 1)
}

function Get-OverallEffectLabel {
    param(
        [Parameter(Mandatory = $true)]
        [double]$ScoreDelta,

        [Parameter(Mandatory = $true)]
        [double]$PassRateDelta,

        [Parameter(Mandatory = $true)]
        [double]$TokenDeltaPct,

        [Parameter(Mandatory = $true)]
        [double]$WallTimeDeltaPct
    )

    $qualityImproved = ($ScoreDelta -ge 1.0) -or ($PassRateDelta -gt 0)
    $qualityRegressed = ($ScoreDelta -le -1.0) -or ($PassRateDelta -lt 0)
    $efficiencyImproved = ($TokenDeltaPct -le -5.0) -or ($WallTimeDeltaPct -le -5.0)
    $efficiencyRegressed = ($TokenDeltaPct -ge 5.0) -or ($WallTimeDeltaPct -ge 5.0)

    if ($qualityImproved -and -not $qualityRegressed -and -not $efficiencyRegressed) {
        return "Improved"
    }
    if ($qualityRegressed -and -not $qualityImproved -and -not $efficiencyImproved) {
        return "Regressed"
    }
    if (($qualityImproved -and $efficiencyRegressed) -or ($qualityRegressed -and $efficiencyImproved)) {
        return "Mixed"
    }

    return "Neutral"
}

function New-ComparisonNarrativeFromDigests {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SkillName,

        [Parameter(Mandatory = $true)]
        [string]$BaselineVariant,

        [Parameter(Mandatory = $true)]
        [string]$SkillVariant,

        [Parameter(Mandatory = $true)]
        $BaselineDigest,

        [Parameter(Mandatory = $true)]
        $SkillDigest
    )

    $baselineScore = [double]$BaselineDigest.avgScorePct
    $skillScore = [double]$SkillDigest.avgScorePct
    $scoreDelta = [math]::Round(($skillScore - $baselineScore), 1)

    $baselinePassRate = Get-PassRatePct -Digest $BaselineDigest
    $skillPassRate = Get-PassRatePct -Digest $SkillDigest
    $passRateDelta = [math]::Round(($skillPassRate - $baselinePassRate), 1)

    $baselineTokens = [double]$BaselineDigest.avgTokens
    $skillTokens = [double]$SkillDigest.avgTokens
    $tokenDeltaPct = if ($baselineTokens -gt 0) { [math]::Round((($skillTokens - $baselineTokens) / $baselineTokens) * 100.0, 1) } else { 0.0 }

    $baselineWall = [double]$BaselineDigest.avgWallTimeSec
    $skillWall = [double]$SkillDigest.avgWallTimeSec
    $wallTimeDeltaPct = if ($baselineWall -gt 0) { [math]::Round((($skillWall - $baselineWall) / $baselineWall) * 100.0, 1) } else { 0.0 }

    $overallEffect = Get-OverallEffectLabel -ScoreDelta $scoreDelta -PassRateDelta $passRateDelta -TokenDeltaPct $tokenDeltaPct -WallTimeDeltaPct $wallTimeDeltaPct

    $sb = New-Object System.Text.StringBuilder

    [void]$sb.AppendLine("# Overall Effect")
    [void]$sb.AppendLine()
    [void]$sb.AppendLine("$overallEffect")
    [void]$sb.AppendLine()

    [void]$sb.AppendLine("# Evidence From Process")
    [void]$sb.AppendLine()
    [void]$sb.AppendLine("- Turns: $BaselineVariant = $($BaselineDigest.avgTurns), $SkillVariant = $($SkillDigest.avgTurns) (delta $([math]::Round(([double]$SkillDigest.avgTurns - [double]$BaselineDigest.avgTurns), 1))).")
    [void]$sb.AppendLine("- Tool calls: $BaselineVariant = $($BaselineDigest.avgToolCalls), $SkillVariant = $($SkillDigest.avgToolCalls) (delta $([math]::Round(([double]$SkillDigest.avgToolCalls - [double]$BaselineDigest.avgToolCalls), 1))).")
    [void]$sb.AppendLine("- Skill activations: $BaselineVariant = $($BaselineDigest.totalSkillActivations), $SkillVariant = $($SkillDigest.totalSkillActivations).")
    [void]$sb.AppendLine()

    [void]$sb.AppendLine("# Evidence From Outcomes")
    [void]$sb.AppendLine()
    [void]$sb.AppendLine("- Average score: $BaselineVariant = $baselineScore%, $SkillVariant = $skillScore% (delta $scoreDelta points).")
    [void]$sb.AppendLine("- Stimulus pass rate: $BaselineVariant = $baselinePassRate%, $SkillVariant = $skillPassRate% (delta $passRateDelta points).")
    [void]$sb.AppendLine("- Total errors: $BaselineVariant = $($BaselineDigest.totalErrors), $SkillVariant = $($SkillDigest.totalErrors).")
    [void]$sb.AppendLine("- Failed graders: $BaselineVariant = $($BaselineDigest.totalFailedGraders), $SkillVariant = $($SkillDigest.totalFailedGraders) (delta $([int]$SkillDigest.totalFailedGraders - [int]$BaselineDigest.totalFailedGraders)).")
    [void]$sb.AppendLine("- Timeout-related grader failures: $BaselineVariant = $($BaselineDigest.totalTimeoutGraders), $SkillVariant = $($SkillDigest.totalTimeoutGraders) (delta $([int]$SkillDigest.totalTimeoutGraders - [int]$BaselineDigest.totalTimeoutGraders)).")
    [void]$sb.AppendLine()

    [void]$sb.AppendLine("# Efficiency Tradeoffs")
    [void]$sb.AppendLine()
    [void]$sb.AppendLine("- Tokens: $BaselineVariant = $([int]$baselineTokens), $SkillVariant = $([int]$skillTokens) (delta $tokenDeltaPct%).")
    [void]$sb.AppendLine("- Wall time: $BaselineVariant = $baselineWall s, $SkillVariant = $skillWall s (delta $wallTimeDeltaPct%).")
    [void]$sb.AppendLine()

    [void]$sb.AppendLine("# Final Assessment")
    [void]$sb.AppendLine()
    [void]$sb.AppendLine("For $SkillName, the deterministic comparison indicates $overallEffect.")
    if ([int]$SkillDigest.totalTimeoutGraders -gt [int]$BaselineDigest.totalTimeoutGraders) {
        [void]$sb.AppendLine("Timeout-related grader failures increased in $SkillVariant; this may indicate the stimulus timeout threshold is too low for the executed workflow and should be reviewed.")
    }
    [void]$sb.AppendLine("This assessment is computed directly from trajectory digests to avoid narrative drift or missing-context artifacts.")

    return $sb.ToString().Trim()
}

function Generate-SkillNarratives {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SkillName,

        [Parameter(Mandatory = $true)]
        [string]$ExperimentOutputDir,

        [Parameter(Mandatory = $true)]
        [string]$SkillResultsDir,

        [Parameter(Mandatory = $false)]
        [ValidateRange(1, 10)]
        [int]$NarrativeMaxAttempts = 2,

        [Parameter(Mandatory = $false)]
        [bool]$EnableNodeLoaderFallback = $true
    )

    if (-not (Test-Path $ExperimentOutputDir)) {
        return $false
    }

    New-Item -ItemType Directory -Path $SkillResultsDir -Force | Out-Null

    $variantDirs = Get-ChildItem -Path $ExperimentOutputDir -Directory | Where-Object {
        Test-Path (Join-Path $_.FullName "results.jsonl")
    }

    if ($variantDirs.Count -lt 2) {
        Write-Warning "Expected at least 2 variants in $ExperimentOutputDir for $SkillName. Found $($variantDirs.Count)."
        return $false
    }

    $digests = @{}
    $narratives = @{}

    foreach ($variantDir in $variantDirs) {
        $resultsJsonlPath = Join-Path $variantDir.FullName "results.jsonl"
        $digest = Get-VariantDigest -ResultsJsonlPath $resultsJsonlPath
        if (-not $digest) {
            continue
        }

        $variantName = [string]$digest.variant
        $digests[$variantName] = $digest

        $digestPath = Join-Path $SkillResultsDir ("trajectory-digest-" + $variantName + ".json")
        $digest | ConvertTo-Json -Depth 12 | Set-Content -Path $digestPath -Encoding UTF8

        $narrative = New-VariantNarrativeFromDigest -Digest $digest

        $narrative = Normalize-NarrativeText -Text $narrative

        $narrativePath = Join-Path $SkillResultsDir ("narrative-" + $variantName + ".md")
        $narrative | Set-Content -Path $narrativePath -Encoding UTF8BOM
        $narratives[$variantName] = $narrative
    }

    if ($digests.Count -lt 2 -or $narratives.Count -lt 2) {
        Write-Warning "Could not build both variant narratives for $SkillName"
        return $false
    }

    $variantNames = @($digests.Keys | Sort-Object)
    $baselineVariant = $variantNames | Where-Object { $_ -match 'baseline' } | Select-Object -First 1
    $skillVariant = $variantNames | Where-Object { $_ -match 'skill' } | Select-Object -First 1

    if (-not $baselineVariant) {
        $baselineVariant = $variantNames[0]
    }
    if (-not $skillVariant) {
        $skillVariant = $variantNames | Where-Object { $_ -ne $baselineVariant } | Select-Object -First 1
    }

    if (-not $skillVariant) {
        Write-Warning "Unable to identify comparison pair for $SkillName"
        return $false
    }

    $baselineDigest = $digests[$baselineVariant]
    $skillDigest = $digests[$skillVariant]

    $comparison = New-ComparisonNarrativeFromDigests -SkillName $SkillName -BaselineVariant $baselineVariant -SkillVariant $skillVariant -BaselineDigest $baselineDigest -SkillDigest $skillDigest

    $comparison = Normalize-NarrativeText -Text $comparison

    $comparisonPath = Join-Path $SkillResultsDir "narrative-comparison.md"
    $comparison | Set-Content -Path $comparisonPath -Encoding UTF8BOM

    return $true
}

$copilotCmd = Get-Command copilot -ErrorAction SilentlyContinue
if ($copilotCmd) {
    Write-Information "Copilot CLI: $($copilotCmd.Source)"
}
else {
    Write-Warning "copilot CLI not found. Narrative generation will be skipped."
}

if ($AnalysisOnly) {
    $analysisRoot = $ExperimentOutputDir
    if ([string]::IsNullOrWhiteSpace($analysisRoot)) {
        $analysisRoot = Get-LatestResultsDirectory -RootPath $ResultsRoot
    }

    if (-not $analysisRoot) {
        Write-Error "Analysis-only mode could not resolve a results directory. Provide -ExperimentOutputDir explicitly."
        exit 1
    }

    $analysisExitCode = Generate-NarrativesOnly -AnalysisRoot $analysisRoot -SkillNamePattern $SkillPattern -NarrativeMaxAttempts $CopilotMaxAttempts -EnableNodeLoaderFallback (-not $NoNodeLoaderFallback)
    exit $analysisExitCode
}

# Validate vally is available
$vallyCmd = Get-Command vally -ErrorAction SilentlyContinue
if (-not $vallyCmd) {
    Write-Error "vally command not found. Please install Vally to run experiments."
    exit 1
}

Write-Information "Vally: $($vallyCmd.Source)"

# Find all matching skill scenarios with experiments
$skillDirs = Get-ChildItem -Path $ScenariosRoot -Directory -Filter $SkillPattern | 
Where-Object { Test-Path (Join-Path $_.FullName "vally" "skill_effectiveness_experiment.yaml") } |
Sort-Object Name

Write-Information "Found $($skillDirs.Count) skills with experiments matching pattern: $SkillPattern"

if ($skillDirs.Count -eq 0) {
    Write-Warning "No skills found matching pattern: $SkillPattern"
    exit 0
}

if ($DryRun) {
    Write-Information ""
    Write-Information "DRY RUN - Would execute the following experiments:"
    foreach ($skillDir in $skillDirs) {
        Write-Information "  - $($skillDir.Name): $(Join-Path $skillDir.FullName 'vally' 'skill_effectiveness_experiment.yaml')"
    }
    exit 0
}

# Create results directory with timestamp
$timestamp = Get-Date -Format "yyyy-MM-ddTHH-mm-ss-fffZ"
$experimentResultsDir = Join-Path $ResultsRoot $timestamp
New-Item -ItemType Directory -Path $experimentResultsDir -Force | Out-Null

Write-Information ""
Write-Information "Results Directory: $experimentResultsDir"
Write-Information "Parallel Workers: $Workers"
Write-Information ""

# Track results and timing
$results = @()
$completed = 0
$failed = 0
$totalSkills = $skillDirs.Count
$overallStartTime = Get-Date
$skillTimings = @()  # Track timings for ETA calculation

# Execute experiments
$scriptBlock = {
    param($SkillDir, $ExperimentResultsDir, $ResultsRoot, $SkillIndex, $TotalSkills)
    
    $skillName = $SkillDir.Name
    $vallyDir = Join-Path $SkillDir.FullName "vally"
    try {
        Write-Host "[$SkillIndex/$TotalSkills] ▶ Starting: $skillName"
        
        $startTime = Get-Date
        $skillOutputRoot = Join-Path $ExperimentResultsDir $skillName
        
        # Run the experiment
        # Note: vally experiment run expects to be run from the scenario directory
        Push-Location $vallyDir
        try {
            $output = & vally experiment run skill_effectiveness_experiment.yaml --output-dir $skillOutputRoot 2>&1
            $exitCode = $LASTEXITCODE
        }
        finally {
            Pop-Location
        }
        
        $duration = (Get-Date) - $startTime
        
        # Check for success by looking at output and exit code
        # Vally returns 0 on success, but also check for "passed" keyword in output
        $outputString = $output -join "`n"
        
        # Strip ANSI color codes from output to allow proper regex matching
        # vally uses ANSI codes for colored output which blocks metric extraction
        $outputString = $outputString -replace "`e\[[0-9;]*m", ''

        # Parse experiment output directory locally so this works in Start-Job scope.
        $experimentOutputDir = $null
        $localOutputMatches = [regex]::Matches($outputString, 'Output:\s*(.+)')
        if ($localOutputMatches.Count -gt 0) {
            for ($m = $localOutputMatches.Count - 1; $m -ge 0; $m--) {
                $candidatePath = $localOutputMatches[$m].Groups[1].Value.Trim()
                if (Test-Path $candidatePath) {
                    $experimentOutputDir = $candidatePath
                    break
                }
            }

            if (-not $experimentOutputDir) {
                $experimentOutputDir = $localOutputMatches[$localOutputMatches.Count - 1].Groups[1].Value.Trim()
            }
        }
        
        # Prefer deterministic per-variant metrics from JSONL results over parsing console text.
        $baselineScore = $null
        $skillScore = $null
        $delta = $null
        $baselineTokens = $null
        $skillTokens = $null
        $baselineTurns = $null
        $skillTurns = $null
        $baselineErrors = 0
        $skillErrors = 0
        $baselineFailedGraders = 0
        $skillFailedGraders = 0
        $baselineTimeoutGraders = 0
        $skillTimeoutGraders = 0
        $baselineEvalStatus = "UNKNOWN"
        $skillEvalStatus = "UNKNOWN"
        $succeeded = $false

        $variantStats = @{}
        if ($experimentOutputDir -and (Test-Path $experimentOutputDir)) {
            $variantDirs = Get-ChildItem -Path $experimentOutputDir -Directory -ErrorAction SilentlyContinue
            foreach ($variantDir in $variantDirs) {
                $resultsFile = Join-Path $variantDir.FullName "results.jsonl"
                if (-not (Test-Path $resultsFile)) {
                    continue
                }

                $scores = @()
                $tokens = @()
                $turns = @()
                $errors = 0
                $failedGraders = 0
                $timeoutGraders = 0
                $trialCount = 0
                $passedCount = 0

                foreach ($line in (Get-Content -Path $resultsFile -ErrorAction SilentlyContinue)) {
                    if ([string]::IsNullOrWhiteSpace($line)) {
                        continue
                    }

                    try {
                        $record = $line | ConvertFrom-Json -ErrorAction Stop
                    }
                    catch {
                        continue
                    }

                    if ($record.type -ne "trial-result") {
                        continue
                    }

                    $trialCount++
                    if ($record.gradeResult.passed) {
                        $passedCount++
                    }

                    if ($null -ne $record.gradeResult.score) {
                        $scores += ([double]$record.gradeResult.score * 100)
                    }

                    if ($null -ne $record.trajectory.metrics.turnCount) {
                        $turns += [int]$record.trajectory.metrics.turnCount
                    }

                    if ($null -ne $record.trajectory.metrics.tokenUsage.totalTokens) {
                        $tokens += [int]$record.trajectory.metrics.tokenUsage.totalTokens
                    }

                    if ($null -ne $record.trajectory.metrics.errorCount) {
                        $errors += [int]$record.trajectory.metrics.errorCount
                    }

                    if ($record.gradeResult -and $record.gradeResult.details) {
                        foreach ($detail in $record.gradeResult.details) {
                            if (-not [bool]$detail.passed) {
                                $failedGraders++
                                $detailEvidence = if ($null -ne $detail.evidence) { [string]$detail.evidence } else { "" }
                                if ($detailEvidence -match '(?i)\btime(d)?\s*out\b|\btimeout\b') {
                                    $timeoutGraders++
                                }
                            }
                        }
                    }
                }

                if ($trialCount -gt 0) {
                    $variantStats[$variantDir.Name] = @{
                        AvgScore       = if ($scores.Count -gt 0) { [double]($scores | Measure-Object -Average).Average } else { $null }
                        AvgTokens      = if ($tokens.Count -gt 0) { [int](($tokens | Measure-Object -Average).Average) } else { $null }
                        AvgTurns       = if ($turns.Count -gt 0) { [int](($turns | Measure-Object -Average).Average) } else { $null }
                        TotalErrors    = $errors
                        FailedGraders  = $failedGraders
                        TimeoutGraders = $timeoutGraders
                        TrialCount     = $trialCount
                        PassedCount    = $passedCount
                    }
                }
            }
        }

        $baselineVariantName = $null
        $skillVariantName = $null
        if ($variantStats.Count -gt 0) {
            $variantNames = @($variantStats.Keys | Sort-Object)
            $baselineVariantName = $variantNames | Where-Object { $_ -match 'baseline' } | Select-Object -First 1
            $skillVariantName = $variantNames | Where-Object { $_ -match 'skill' } | Select-Object -First 1

            if (-not $baselineVariantName) {
                $baselineVariantName = $variantNames | Select-Object -First 1
            }
            if (-not $skillVariantName) {
                $skillVariantName = $variantNames | Where-Object { $_ -ne $baselineVariantName } | Select-Object -First 1
            }
        }

        if ($baselineVariantName -and $variantStats.ContainsKey($baselineVariantName)) {
            $baselineStats = $variantStats[$baselineVariantName]
            $baselineScore = $baselineStats.AvgScore
            $baselineTokens = $baselineStats.AvgTokens
            $baselineTurns = $baselineStats.AvgTurns
            $baselineErrors = $baselineStats.TotalErrors
            $baselineFailedGraders = $baselineStats.FailedGraders
            $baselineTimeoutGraders = $baselineStats.TimeoutGraders
            if ($baselineStats.TrialCount -gt 0) {
                $baselineEvalStatus = if ($baselineStats.PassedCount -eq $baselineStats.TrialCount) { "PASSED" } else { "FAILED" }
            }
        }

        if ($skillVariantName -and $variantStats.ContainsKey($skillVariantName)) {
            $skillStats = $variantStats[$skillVariantName]
            $skillScore = $skillStats.AvgScore
            $skillTokens = $skillStats.AvgTokens
            $skillTurns = $skillStats.AvgTurns
            $skillErrors = $skillStats.TotalErrors
            $skillFailedGraders = $skillStats.FailedGraders
            $skillTimeoutGraders = $skillStats.TimeoutGraders
            $succeeded = ($exitCode -eq 0) -and ($skillStats.TrialCount -gt 0) -and ($skillStats.PassedCount -eq $skillStats.TrialCount)
            if ($skillStats.TrialCount -gt 0) {
                $skillEvalStatus = if ($skillStats.PassedCount -eq $skillStats.TrialCount) { "PASSED" } else { "FAILED" }
            }
        }
        else {
            # Fallback for older outputs when per-variant JSONL is unavailable.
            $succeeded = ($exitCode -eq 0) -and ($outputString -match "passed")
        }

        if (($null -ne $baselineScore) -and ($null -ne $skillScore)) {
            $delta = [double]$skillScore - [double]$baselineScore
        }
        
        if ($succeeded) {
            # Format impact indicator with efficiency metrics
            $impactStr = ""
            if ($delta -ne $null) {
                $impactDirection = if ($delta -ge 0) { "↑" } else { "↓" }
                $impactStr = " [baseline: $($baselineScore.ToString('F1'))% → skill: $($skillScore.ToString('F1'))% $impactDirection $($delta.ToString('+0.0;-0.0'))%]"
            }
            elseif ($skillScore) {
                $impactStr = " [skill: $($skillScore.ToString('F1'))%]"
            }
            if ($skillEvalStatus -ne "UNKNOWN") {
                $impactStr += " [skill eval: $skillEvalStatus]"
            }
            if ($skillFailedGraders -gt 0) {
                $impactStr += " [failed graders: $skillFailedGraders"
                if ($skillTimeoutGraders -gt 0) {
                    $impactStr += ", timeout-related: $skillTimeoutGraders"
                }
                $impactStr += "]"
            }

            $durationText = "{0}h {1}m {2:F1}s" -f [int]$duration.TotalHours, $duration.Minutes, ($duration.Seconds + ($duration.Milliseconds / 1000))
            
            Write-Host "[$SkillIndex/$TotalSkills] ✓ PASSED (run): $skillName ($durationText)$impactStr" -ForegroundColor Green
            return @{
                Skill                  = $skillName
                Status                 = "PASSED"
                SkillEvalStatus        = $skillEvalStatus
                Duration               = $duration.TotalSeconds
                BaselineScore          = $baselineScore
                SkillScore             = $skillScore
                Delta                  = $delta
                BaselineTokens         = $baselineTokens
                SkillTokens            = $skillTokens
                BaselineTurns          = $baselineTurns
                SkillTurns             = $skillTurns
                BaselineErrors         = $baselineErrors
                SkillErrors            = $skillErrors
                BaselineFailedGraders  = $baselineFailedGraders
                SkillFailedGraders     = $skillFailedGraders
                BaselineTimeoutGraders = $baselineTimeoutGraders
                SkillTimeoutGraders    = $skillTimeoutGraders
                BaselineEvalStatus     = $baselineEvalStatus
                ExperimentDir          = $experimentOutputDir
                Output                 = $output
            }
        }
        else {
            Write-Host "[$SkillIndex/$TotalSkills] ✗ FAILED: $skillName (exit code: $exitCode)" -ForegroundColor Red
            return @{
                Skill                  = $skillName
                Status                 = "FAILED"
                SkillEvalStatus        = $skillEvalStatus
                Duration               = $duration.TotalSeconds
                BaselineScore          = $baselineScore
                SkillScore             = $skillScore
                Delta                  = $delta
                BaselineTokens         = $baselineTokens
                SkillTokens            = $skillTokens
                BaselineTurns          = $baselineTurns
                SkillTurns             = $skillTurns
                BaselineErrors         = $baselineErrors
                SkillErrors            = $skillErrors
                BaselineFailedGraders  = $baselineFailedGraders
                SkillFailedGraders     = $skillFailedGraders
                BaselineTimeoutGraders = $baselineTimeoutGraders
                SkillTimeoutGraders    = $skillTimeoutGraders
                BaselineEvalStatus     = $baselineEvalStatus
                ExperimentDir          = $experimentOutputDir
                Output                 = $output
            }
        }
    }
    catch {
        Write-Host "[$SkillIndex/$TotalSkills] ✗ Error running $skillName : $_"
        return @{
            Skill    = $skillName
            Status   = "ERROR"
            Duration = 0
            Score    = $null
            Output   = $_.Exception.Message
        }
    }
}

# Run experiments with sequential or throttled-parallel execution
$skillIndex = 0

if ($Workers -eq 1) {
    foreach ($skillDir in $skillDirs) {
        $skillIndex++

        $result = & $scriptBlock $skillDir $experimentResultsDir $ResultsRoot $skillIndex $totalSkills
        $results += $result
        $skillTimings += $result.Duration

        if ($result.Status -ne "PASSED") {
            $failed++
        }
        else {
            $completed++
        }

        # Show ETA for sequential execution
        if ($skillIndex -lt $totalSkills -and $skillTimings.Count -gt 0) {
            $avgTime = ($skillTimings | Measure-Object -Average).Average
            $remainingSkills = $totalSkills - $skillIndex
            $estimatedSeconds = [int]($avgTime * $remainingSkills)
            $estimatedTime = "{0:D2}:{1:D2}" -f [int]($estimatedSeconds / 60), [int]($estimatedSeconds % 60)
            Write-Host "  → Estimated time remaining: $estimatedTime" -ForegroundColor Cyan
        }
    }
}
else {
    Write-Host "Launching experiments with worker limit: $Workers" -ForegroundColor Cyan

    $activeJobs = @()
    $pendingSkills = [System.Collections.Queue]::new()
    foreach ($skillDir in $skillDirs) {
        [void]$pendingSkills.Enqueue($skillDir)
    }

    function Start-NextExperimentJob {
        param(
            [Parameter(Mandatory = $true)]
            [System.Collections.Queue]$Queue,

            [Parameter(Mandatory = $true)]
            [int]$NextIndex,

            [Parameter(Mandatory = $true)]
            [string]$ExpResultsDir,

            [Parameter(Mandatory = $true)]
            [string]$ResRoot,

            [Parameter(Mandatory = $true)]
            [int]$TotalCount,

            [Parameter(Mandatory = $true)]
            [scriptblock]$RunnerScript
        )

        if ($Queue.Count -eq 0) {
            return $null
        }

        $nextSkillDir = $Queue.Dequeue()
        $newJob = Start-Job -ScriptBlock $RunnerScript -ArgumentList $nextSkillDir, $ExpResultsDir, $ResRoot, $NextIndex, $TotalCount

        return @{
            Job        = $newJob
            Skill      = $nextSkillDir.Name
            SkillIndex = $NextIndex
        }
    }

    # Seed up to worker limit.
    while ($activeJobs.Count -lt $Workers -and $pendingSkills.Count -gt 0) {
        $skillIndex++
        $jobInfo = Start-NextExperimentJob -Queue $pendingSkills -NextIndex $skillIndex -ExpResultsDir $experimentResultsDir -ResRoot $ResultsRoot -TotalCount $totalSkills -RunnerScript $scriptBlock
        if ($jobInfo) {
            $activeJobs += $jobInfo
            Write-Host "  queued [$($jobInfo.SkillIndex)/$totalSkills] $($jobInfo.Skill) (active: $($activeJobs.Count)/$Workers)" -ForegroundColor DarkCyan
        }
    }

    # As jobs finish, consume output and backfill from queue.
    while ($activeJobs.Count -gt 0) {
        $jobObjects = @($activeJobs | ForEach-Object { $_.Job })
        $finishedJob = Wait-Job -Job $jobObjects -Any
        if (-not $finishedJob) {
            continue
        }

        $jobInfo = $activeJobs | Where-Object { $_.Job.Id -eq $finishedJob.Id } | Select-Object -First 1
        $result = Receive-Job -Job $finishedJob -Wait -InformationAction SilentlyContinue
        Remove-Job -Job $finishedJob

        $activeJobs = @($activeJobs | Where-Object { $_.Job.Id -ne $finishedJob.Id })

        $results += $result
        $skillTimings += $result.Duration

        if ($result.Status -ne "PASSED") {
            $failed++
        }
        else {
            $completed++
        }

        $done = $completed + $failed
        Write-Host "  progress: $done/$totalSkills complete (active: $($activeJobs.Count), queued: $($pendingSkills.Count))" -ForegroundColor Cyan

        if ($pendingSkills.Count -gt 0) {
            $skillIndex++
            $nextJobInfo = Start-NextExperimentJob -Queue $pendingSkills -NextIndex $skillIndex -ExpResultsDir $experimentResultsDir -ResRoot $ResultsRoot -TotalCount $totalSkills -RunnerScript $scriptBlock
            if ($nextJobInfo) {
                $activeJobs += $nextJobInfo
                Write-Host "  queued [$($nextJobInfo.SkillIndex)/$totalSkills] $($nextJobInfo.Skill) (active: $($activeJobs.Count)/$Workers)" -ForegroundColor DarkCyan
            }
        }
    }
}

Write-Information ""
Write-Information "Generating trajectory narratives and skill-impact comparisons..."

$narrativeCount = 0
$narrativeFailures = 0

foreach ($result in $results) {
    if (-not $result.ExperimentDir) {
        continue
    }

    $skillNarrativeDir = Join-Path $experimentResultsDir $result.Skill
    $generated = Generate-SkillNarratives -SkillName $result.Skill -ExperimentOutputDir $result.ExperimentDir -SkillResultsDir $skillNarrativeDir -NarrativeMaxAttempts $CopilotMaxAttempts -EnableNodeLoaderFallback (-not $NoNodeLoaderFallback)

    if ($generated) {
        $narrativeCount++
        Write-Host "  ✓ Narratives generated for $($result.Skill)" -ForegroundColor Green
    }
    else {
        $narrativeFailures++
        Write-Host "  ✗ Narrative generation skipped/failed for $($result.Skill)" -ForegroundColor Yellow
    }
}

if ($narrativeCount -gt 0 -or $narrativeFailures -gt 0) {
    Write-Host "Narrative Summary: generated=$narrativeCount failed=$narrativeFailures" -ForegroundColor Cyan
}

# Calculate overall timing
$overallDuration = (Get-Date) - $overallStartTime
$totalDurationStr = "{0}h {1}m {2}s" -f `
    [int]($overallDuration.TotalSeconds / 3600), `
    [int](($overallDuration.TotalSeconds % 3600) / 60), `
    [int]($overallDuration.TotalSeconds % 60)

Write-Host "`n" + ("=" * 80)
Write-Host "Skill Effectiveness Experiments Summary" -ForegroundColor Green
Write-Host ("=" * 80)

# Build results table with verdict and efficiency analysis
$resultsTable = @()
foreach ($result in $results) {
    # Determine verdict based on pass/fail logic
    $verdict = ""
    $evalStatus = if ($result.SkillEvalStatus) { [string]$result.SkillEvalStatus } else { "UNKNOWN" }
    $baselineEvalStatus = if ($result.BaselineEvalStatus) { [string]$result.BaselineEvalStatus } else { "UNKNOWN" }
    $failureArm = "unknown"

    if ($result.Status -eq "FAILED") {
        if ($baselineEvalStatus -eq "FAILED" -and $evalStatus -ne "FAILED") {
            $failureArm = "baseline"
        }
        elseif ($evalStatus -eq "FAILED" -and $baselineEvalStatus -ne "FAILED") {
            $failureArm = "skill"
        }
        elseif ($baselineEvalStatus -eq "FAILED" -and $evalStatus -eq "FAILED") {
            $failureArm = "both"
        }
        else {
            $failureArm = "run"
        }
    }
    
    if ($result.Status -eq "PASSED" -and $evalStatus -eq "PASSED") {
        # Skill passed - check efficiency
        if ($result.SkillTokens -and $result.BaselineTokens) {
            $tokenDelta = [int](($result.SkillTokens - $result.BaselineTokens) / $result.BaselineTokens * 100)
            if ($tokenDelta -lt -5) {
                $verdict = "✓ Effective"
            }
            elseif ($tokenDelta -gt 5) {
                $verdict = "✗ Inefficient"
            }
            else {
                $verdict = "~ Neutral"
            }
        }
        else {
            $verdict = "✓ Passed"
        }
    }
    elseif ($result.Status -eq "PASSED" -and $evalStatus -eq "FAILED") {
        if (($result.SkillTimeoutGraders -as [int]) -gt 0) {
            $verdict = "✗ Eval failed (timeout)"
        }
        else {
            $verdict = "✗ Eval failed"
        }
    }
    else {
        $verdict = "✗ Failed"
    }
    
    # Calculate efficiency deltas
    $tokensDelta = ""
    $turnsDelta = ""
    
    if ($result.SkillTokens -and $result.BaselineTokens) {
        $pctChange = [int](($result.SkillTokens - $result.BaselineTokens) / $result.BaselineTokens * 100)
        $dir = if ($pctChange -ge 0) { "↑" } else { "↓" }
        $tokensDelta = "$dir $($pctChange.ToString('+0;-0'))%"
    }
    
    if ($result.SkillTurns -and $result.BaselineTurns) {
        $turnChange = $result.SkillTurns - $result.BaselineTurns
        $dir = if ($turnChange -ge 0) { "↑" } else { "↓" }
        $turnsDelta = "$dir $($turnChange.ToString('+0;-0'))"
    }
    
    # Build status indicator
    $statusIcon = if ($result.Status -eq "PASSED") { "RUN PASS" } else { "RUN FAIL" }
    
    # Build verdict display
    $verdictDisplay = $verdict -replace "✓ ", "[GOOD] " -replace "✗ ", "[BAD]  " -replace "~ ", "[NEUT] "
    
    $resultsTable += [PSCustomObject]@{
        Skill             = $result.Skill
        Status            = $statusIcon
        Eval              = $evalStatus
        'Failure Arm'     = if ($result.Status -eq "FAILED") { $failureArm } else { "none" }
        Verdict           = $verdictDisplay
        'Graders Failed'  = if ($null -ne $result.SkillFailedGraders) { $result.SkillFailedGraders } else { "N/A" }
        'Graders Timeout' = if ($null -ne $result.SkillTimeoutGraders) { $result.SkillTimeoutGraders } else { "N/A" }
        'Tokens %'        = if ($tokensDelta) { $tokensDelta } else { "N/A" }
        'Turns'           = if ($turnsDelta) { $turnsDelta } else { "N/A" }
        Errors            = $result.SkillErrors
        'Duration'        = Format-ElapsedDuration -Seconds $result.Duration
    }
}

# Display results table
$resultsTable | Format-Table -AutoSize

Write-Host ("=" * 80)
Write-Host "Results Summary" -ForegroundColor Cyan
Write-Host ("  Total Skills:   $totalSkills")
Write-Host ("  Passed:         $completed") -ForegroundColor Green
if ($failed -gt 0) {
    Write-Host ("  Failed:         $failed") -ForegroundColor Red
}
else {
    Write-Host ("  Failed:         $failed") -ForegroundColor Green
}
Write-Host ("  Total Duration: $totalDurationStr") -ForegroundColor Cyan
Write-Host ("  Results Dir:    $experimentResultsDir") -ForegroundColor Cyan
Write-Host ("=" * 80)
Write-Information ""

if ($Compare) {
    Write-Information ""
    Write-Information "Generating comparison reports..."
    
    # Run compare-experiment.mjs for the experiment directory
    $compareScript = Join-Path $PSScriptRoot "compare-experiment.mjs"
    if (Test-Path $compareScript) {
        & node $compareScript $experimentResultsDir
    }
    else {
        Write-Warning "compare-experiment.mjs not found at: $compareScript"
    }
}

if ($failed -gt 0) {
    exit 1
}
