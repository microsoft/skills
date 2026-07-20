#Requires -Version 7.0
<#
.SYNOPSIS
Generate vally skill effectiveness experiments for specified skills.

.DESCRIPTION
Creates skill_effectiveness_experiment.yaml files
for all matching skills in the scenarios directory. Each experiment compares
performance with and without the skill context (baseline vs. skill variants).

Use -SkillPattern to filter by language (e.g., '*-py' for Python, '*-rs' for Rust)
or by service (e.g., 'azure-cosmos*' for Cosmos DB).

.PARAMETER ScenariosRoot
Root directory containing skill scenario subdirectories.
Defaults to: <script-dir>/scenarios

.PARAMETER SkillPattern
Filter which skills to process. Supports wildcards.
Defaults to '*-py' (all Python skills).
Examples: -SkillPattern '*-rust', -SkillPattern 'azure-ai-*'

.PARAMETER DryRun
If set, shows what would be created without actually creating files.

.PARAMETER Force
If set, overwrites existing experiment files. Otherwise skips existing files.

.EXAMPLE
./generate-skill-experiments.ps1
# Generates experiments for all Python skills with default settings

.EXAMPLE
./generate-skill-experiments.ps1 -SkillPattern '*-rust'
# Generates experiments for all Rust skills

.EXAMPLE
./generate-skill-experiments.ps1 -SkillPattern 'azure-cosmos*' -DryRun -Verbose
# Preview Cosmos DB experiment files that would be created

.EXAMPLE
./generate-skill-experiments.ps1 -Force
# Regenerate all experiment files, overwriting existing ones
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ScenariosRoot = (Join-Path $PSScriptRoot "scenarios"),
    
    [Parameter(Mandatory = $false)]
    [string]$SkillPattern = "*-py",
    
    [Parameter(Mandatory = $false)]
    [switch]$DryRun,
    
    [Parameter(Mandatory = $false)]
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function New-ExperimentFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SkillName,
        
        [Parameter(Mandatory = $true)]
        [string]$SkillPath,
        
        [Parameter(Mandatory = $true)]
        [string]$OutputPath,
        
        [Parameter(Mandatory = $false)]
        [switch]$DryRun
    )
    
    $experimentName = "$SkillName-skill-experiment"
    $content = @"
# Purpose: Measure skill effectiveness by comparing the same stimulus with and without the corresponding skill.
name: $experimentName
evals:
    - eval.yaml
vary:
  - /defaults/model
  - /environment/skills
baseline: sonnet_baseline
variants:
  sonnet_skill:
    overrides:
      model: claude-sonnet-4.6
    environment:
      skills:
        - $SkillPath
  sonnet_baseline:
    overrides:
      model: claude-sonnet-4.6
    environment:
      skills: []
"@
    
    if ($DryRun) {
        Write-Verbose "Would create: $OutputPath"
        Write-Verbose $content
    }
    else {
        Set-Content -Path $OutputPath -Value $content -Encoding UTF8
        Write-Information "✓ Created: $OutputPath"
    }
}

# Find all matching skill scenario directories
$skillDirs = Get-ChildItem -Path $ScenariosRoot -Directory -Filter $SkillPattern | 
Sort-Object Name

Write-Information "Found $($skillDirs.Count) skills matching pattern: $SkillPattern"

$created = 0
$skipped = 0
$failed = 0

foreach ($skillDir in $skillDirs) {
    $skillName = $skillDir.Name
    $vallyDir = Join-Path $skillDir.FullName "vally"
    
    if (-not (Test-Path $vallyDir)) {
        Write-Warning "No vally directory found for $skillName (expected: $vallyDir)"
        $skipped++
        continue
    }
    
    # Determine skill path for the skills array
    # Extract language suffix from skill name (e.g., azure-cosmos-db-py -> py)
    $languageMap = @{
        '-py'     = 'azure-sdk-python'
        '-dotnet' = 'azure-sdk-dotnet'
        '-ts'     = 'azure-sdk-typescript'
        '-java'   = 'azure-sdk-java'
        '-rust'   = 'azure-sdk-rust'
    }
    
    $language = 'py'  # default
    foreach ($suffix in $languageMap.Keys) {
        if ($skillName -match "$suffix`$") {
            $language = $languageMap[$suffix]
            break
        }
    }
    
    $skillPath = "../../../../.github/plugins/$language/skills/$skillName"
    
    # Paths for experiment files
    $experimentFile = Join-Path $vallyDir "skill_effectiveness_experiment.yaml"
    $evalFile = Join-Path $vallyDir "eval.yaml"
    
    # Create experiment file
    if ((Test-Path $experimentFile) -and -not $Force) {
        Write-Verbose "Skipping (exists): $experimentFile"
        $skipped++
    }
    else {
        if (-not (Test-Path $evalFile)) {
            Write-Warning "Source eval.yaml not found for $skillName"
            $skipped++
            continue
        }

        try {
            New-ExperimentFile -SkillName $skillName -SkillPath $skillPath -OutputPath $experimentFile -DryRun:$DryRun
            $created++
        }
        catch {
            Write-Error "Failed to create experiment file for $skillName : $_"
            $failed++
        }
    }
}

Write-Information ""
Write-Information "Summary:"
Write-Information "--------"
Write-Information "Created: $created"
Write-Information "Skipped: $skipped"
if ($failed -gt 0) {
    Write-Information "Failed:  $failed"
}
if ($DryRun) {
    Write-Information ""
    Write-Information "DRY RUN - No files were actually created. Use -Force to create files."
}
