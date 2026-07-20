<#
.SYNOPSIS
    Runs the standard Azure CLI pre-deployment validation sequence for a Bicep
    template and reports PASS/FAIL for each step. Shared by the AZCLI and Bicep
    validation recipes.
.DESCRIPTION
    Executes, in order:
      1. az version         - Azure CLI is installed
      2. az account show    - authenticated to Azure
      3. az bicep build     - template compiles cleanly
      4. az deployment ... validate  - template validates against the target scope
      5. az deployment ... what-if   - preview changes (Create/Modify/Delete summary)
    Emits per-step PASS/FAIL lines and an OVERALL result.
    Exit codes: 0 = every step passed; 1 = a validation step failed;
    2 = usage / argument error.
.PARAMETER Scope
    Deployment scope: 'sub' or 'group' (required).
.PARAMETER Location
    Location (required when -Scope sub).
.PARAMETER ResourceGroup
    Resource group name (required when -Scope group).
.PARAMETER Template
    Bicep template path. Default: ./infra/main.bicep
.PARAMETER Parameters
    Parameters file path. Default: ./infra/main.parameters.json
    (skipped automatically if the file does not exist).
.PARAMETER Subscription
    Subscription to target (optional).
.EXAMPLE
    .\validate-deployment.ps1 -Scope sub -Location eastus
.EXAMPLE
    .\validate-deployment.ps1 -Scope group -ResourceGroup my-rg `
        -Template ./infra/main.bicep -Parameters ./infra/main.parameters.json
#>
param(
    [ValidateSet("sub", "group")][string]$Scope,
    [string]$Location,
    [string]$ResourceGroup,
    [string]$Template = "./infra/main.bicep",
    [string]$Parameters = "./infra/main.parameters.json",
    [string]$Subscription
)

# Validate arguments
if (-not $Scope) {
    Write-Error "-Scope is required and must be 'sub' or 'group'."
    exit 2
}
if ($Scope -eq "sub" -and -not $Location) {
    Write-Error "-Location is required when -Scope is 'sub'."
    exit 2
}
if ($Scope -eq "group" -and -not $ResourceGroup) {
    Write-Error "-ResourceGroup is required when -Scope is 'group'."
    exit 2
}

# Build shared argument arrays
$subArgs = @()
if ($Subscription) { $subArgs = @("--subscription", $Subscription) }

$paramArgs = @()
if (Test-Path $Parameters) {
    $paramArgs = @("--parameters", $Parameters)
} else {
    Write-Host "NOTE: parameters file '$Parameters' not found; validating without --parameters."
}

if ($Scope -eq "sub") {
    $scopeTargetArgs = @("--location", $Location)
    $scopeDesc = "subscription (location: $Location)"
} else {
    $scopeTargetArgs = @("--resource-group", $ResourceGroup)
    $scopeDesc = "resource group '$ResourceGroup'"
}

# Track overall result (0 = all passed, 1 = at least one failure).
$overall = 0

Write-Host "=== Azure deployment validation ==="
Write-Host "Template:   $Template"
Write-Host "Scope:      $scopeDesc"
Write-Host ""

# Step 1: Azure CLI installed
Write-Host "--- Step 1: Azure CLI installed (az version) ---"
az version *> $null
if ($LASTEXITCODE -eq 0) {
    Write-Host "PASS: Azure CLI is installed."
} else {
    Write-Host "FAIL: Azure CLI not found. Install it, then re-run."
    Write-Host ""
    Write-Host "OVERALL: FAIL"
    exit 1
}
Write-Host ""

# Step 2: Authenticated
Write-Host "--- Step 2: Authenticated (az account show) ---"
$accountName = az account show @subArgs --query name -o tsv 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "PASS: Authenticated (subscription: $accountName)."
} else {
    Write-Host "FAIL: Not logged in. Run 'az login' (and 'az account set --subscription <id>')."
    $overall = 1
}
Write-Host ""

# Step 3: Bicep compilation
Write-Host "--- Step 3: Bicep compilation (az bicep build) ---"
$buildOutput = az bicep build --file $Template 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "PASS: Template compiles cleanly."
} else {
    Write-Host "FAIL: Bicep compilation errors:"
    Write-Host ($buildOutput | Out-String)
    $overall = 1
}
Write-Host ""

# Step 4: Template validation
Write-Host "--- Step 4: Template validation (az deployment $Scope validate) ---"
$validateOutput = az deployment $Scope validate @scopeTargetArgs --template-file $Template @paramArgs @subArgs 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "PASS: Template validated against the target scope."
} else {
    Write-Host "FAIL: Template validation errors:"
    Write-Host ($validateOutput | Out-String)
    $overall = 1
}
Write-Host ""

# Step 5: What-if preview
Write-Host "--- Step 5: What-if preview (az deployment $Scope what-if) ---"
$whatifOutput = az deployment $Scope what-if @scopeTargetArgs --template-file $Template @paramArgs @subArgs 2>&1
if ($LASTEXITCODE -eq 0) {
    $lines = $whatifOutput | Out-String -Stream
    $createCount = ($lines | Where-Object { $_ -match '^\s*\+ ' }).Count
    $modifyCount = ($lines | Where-Object { $_ -match '^\s*~ ' }).Count
    $deleteCount = ($lines | Where-Object { $_ -match '^\s*- ' }).Count
    Write-Host "PASS: What-if completed. Changes -> Create: $createCount, Modify: $modifyCount, Delete: $deleteCount"
} else {
    Write-Host "FAIL: What-if errors:"
    Write-Host ($whatifOutput | Out-String)
    $overall = 1
}
Write-Host ""

# Overall result (drives the exit code)
if ($overall -eq 0) {
    Write-Host "OVERALL: PASS"
} else {
    Write-Host "OVERALL: FAIL"
}
exit $overall
