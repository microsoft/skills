<#
.SYNOPSIS
    Runs the Terraform pre-deployment validation preflight sequence and prints a
    compact PASS/FAIL/SKIP summary plus captured error text for any failed step.
.DESCRIPTION
    Runs every check even if an earlier one fails, so you get a complete verdict in
    a single call. It never fixes anything - it only runs and reports, so you can
    jump straight to remediation for any failed step.

    Steps: terraform present, az present, authenticated, init, fmt -check, validate,
    plan, state list, Go-style {{ .Env.* }} template-variable scan.
.PARAMETER InfraDir
    Path to the Terraform infra directory (default: ./infra).
.PARAMETER SubscriptionId
    Optional subscription to select before checks.
.EXAMPLE
    .\validate-terraform.ps1
    # Validate ./infra
.EXAMPLE
    .\validate-terraform.ps1 -InfraDir ./infra -SubscriptionId 00000000-0000-0000-0000-000000000000
    # Validate an explicit directory against a specific subscription
.NOTES
    Exit code: 0 when every non-skipped step passes, 1 when any step fails.
#>
param(
    [string]$InfraDir = "./infra",
    [string]$SubscriptionId
)

$ErrorActionPreference = "Continue"

$steps = [System.Collections.Generic.List[object]]::new()

function Add-Result {
    param([string]$Name, [string]$Status, [string]$ErrorText = "")
    # Results are collected here and rendered once in the summary at the end.
    $steps.Add([pscustomobject]@{ Name = $Name; Status = $Status; Error = $ErrorText })
}

function Test-Command {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host "Terraform validation preflight - infra dir: $InfraDir"
Write-Host ""

# --- 1. Terraform installed --------------------------------------------------
if (Test-Command "terraform") {
    Add-Result "Terraform installed" "PASS"
} else {
    Add-Result "Terraform installed" "FAIL" "terraform not found on PATH. Install: https://developer.hashicorp.com/terraform/install"
}

# --- 2. Azure CLI installed --------------------------------------------------
$hasAz = Test-Command "az"
if ($hasAz) {
    Add-Result "Azure CLI installed" "PASS"
} else {
    Add-Result "Azure CLI installed" "FAIL" "az not found on PATH. Install the Azure CLI: mcp_azure_mcp_extension_cli_install(cli-type: `"az`")"
}

# --- 3. Authentication -------------------------------------------------------
if ($hasAz) {
    if ($SubscriptionId) {
        $subOut = az account set --subscription $SubscriptionId 2>&1
        if ($LASTEXITCODE -eq 0) {
            Add-Result "Select subscription" "PASS"
        } else {
            Add-Result "Select subscription" "FAIL" ($subOut | Out-String).Trim()
        }
    }
    $accountOut = az account show -o none 2>&1
    if ($LASTEXITCODE -eq 0) {
        Add-Result "Authenticated (az account show)" "PASS"
    } else {
        Add-Result "Authenticated (az account show)" "FAIL" ($accountOut | Out-String).Trim()
    }
} else {
    Add-Result "Authenticated (az account show)" "SKIP" "Azure CLI not installed"
}

# --- infra dir presence gate -------------------------------------------------
$haveTf = (Test-Command "terraform") -and (Test-Path -Path $InfraDir -PathType Container)

function Invoke-Tf {
    param([string]$Name, [string[]]$Args)
    if (-not $haveTf) {
        Add-Result $Name "SKIP" "terraform unavailable or infra dir '$InfraDir' not found"
        return
    }
    Push-Location $InfraDir
    try {
        # Stream output to a temp file so large output (e.g. terraform plan) is
        # not held in memory; only read it back when the command fails.
        $tmp = New-TemporaryFile
        & terraform @Args *> $tmp.FullName
        if ($LASTEXITCODE -eq 0) {
            Add-Result $Name "PASS"
        } else {
            $content = Get-Content -Raw $tmp.FullName
            if ($null -eq $content) { $content = "" }
            Add-Result $Name "FAIL" $content.Trim()
        }
        Remove-Item $tmp.FullName -ErrorAction SilentlyContinue
    } finally {
        Pop-Location
    }
}

# --- 4. Initialize -----------------------------------------------------------
Invoke-Tf "terraform init" @("init", "-input=false")

# --- 5. Format check ---------------------------------------------------------
Invoke-Tf "terraform fmt -check" @("fmt", "-check", "-recursive")

# --- 6. Validate syntax ------------------------------------------------------
Invoke-Tf "terraform validate" @("validate")

# --- 7. Plan preview ---------------------------------------------------------
Invoke-Tf "terraform plan" @("plan", "-input=false", "-out=tfplan")

# --- 8. State backend --------------------------------------------------------
Invoke-Tf "terraform state list" @("state", "list")

# --- 9. Go-style template-variable scan --------------------------------------
if (Test-Path -Path $InfraDir -PathType Container) {
    $hits = Get-ChildItem -Path $InfraDir -Recurse -Include "*.tf", "*.tfvars.json" -ErrorAction SilentlyContinue |
        Select-String -Pattern '{{ *\.Env\.' |
        ForEach-Object { "{0}:{1}:{2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
    if ($hits) {
        $detail = "Found unresolved Go-style template variables - replace {{ .Env.VAR }} with `${VAR} (azd envsubst format):`n" + ($hits -join "`n")
        Add-Result "Template-variable scan ({{ .Env.* }})" "FAIL" $detail
    } else {
        Add-Result "Template-variable scan ({{ .Env.* }})" "PASS"
    }
} else {
    Add-Result "Template-variable scan ({{ .Env.* }})" "SKIP" "infra dir '$InfraDir' not found"
}

# --- 10. main.tfvars.json JSON syntax ----------------------------------------
$tfvars = Join-Path $InfraDir "main.tfvars.json"
if (Test-Path -Path $tfvars -PathType Leaf) {
    try {
        Get-Content -Raw $tfvars | ConvertFrom-Json -ErrorAction Stop | Out-Null
        Add-Result "main.tfvars.json is valid JSON" "PASS"
    } catch {
        Add-Result "main.tfvars.json is valid JSON" "FAIL" $_.Exception.Message
    }
} else {
    Add-Result "main.tfvars.json is valid JSON" "SKIP" "$tfvars not found"
}

# --- summary -----------------------------------------------------------------
Write-Host ""
Write-Host "==================== SUMMARY ===================="
"{0,-40} {1}" -f "STEP", "RESULT" | Write-Host
"{0,-40} {1}" -f "----", "------" | Write-Host
foreach ($s in $steps) {
    "{0,-40} {1}" -f $s.Name, $s.Status | Write-Host
}
Write-Host "================================================="

$failed = @($steps | Where-Object { $_.Status -eq "FAIL" })
if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "----- FAILURE DETAILS -----"
    foreach ($s in $failed) {
        Write-Host ""
        Write-Host "### $($s.Name)"
        Write-Host $s.Error
    }
    Write-Host ""
    Write-Host "RESULT: $($failed.Count) step(s) failed. See remediation guidance in README.md."
    exit 1
}

Write-Host ""
Write-Host "RESULT: All checks passed. Ready for azure-deploy."
exit 0
