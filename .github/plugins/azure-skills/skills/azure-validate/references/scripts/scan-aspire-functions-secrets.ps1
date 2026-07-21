<#
.SYNOPSIS
    Aspire + Azure Functions secret-storage pre-provisioning scan.
.DESCRIPTION
    Decides whether the AzureWebJobsSecretStorageType=Files fix is required by
    scanning C# source for the Aspire Functions builder call and the setting.

    Logic:
      1. Find *.cs files that call AddAzureFunctionsProject.
      2. For each, check whether the same file already sets AzureWebJobsSecretStorageType.
      3. Files with the call but missing the setting -> fix required.

    Prints a single verdict — NOT APPLICABLE, ALREADY CONFIGURED, or FIX REQUIRED
    (with the matching file(s) and line(s)). Exit code is 0 for every verdict;
    a non-zero exit only indicates a usage/environment error.
.PARAMETER Path
    Directory to scan. Defaults to the current directory.
.EXAMPLE
    .\scan-aspire-functions-secrets.ps1
    # Scan the current directory
.EXAMPLE
    .\scan-aspire-functions-secrets.ps1 -Path ./src
    # Scan a specific directory
#>
param(
    [string]$Path = "."
)

# Leave $ErrorActionPreference at its default ("Continue") so that Write-Error
# below is non-terminating and the explicit `exit` codes are honored.

if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
    Write-Error "'$Path' is not a directory."
    exit 2
}

$call = "AddAzureFunctionsProject"
$setting = "AzureWebJobsSecretStorageType"

# Collect *.cs files that reference AddAzureFunctionsProject.
$matches = Get-ChildItem -Path $Path -Recurse -File -Filter "*.cs" |
    Where-Object { Select-String -Path $_.FullName -SimpleMatch -Pattern $call -Quiet }

if (-not $matches) {
    Write-Output "VERDICT: NOT APPLICABLE"
    Write-Output "No '$call' call found in any *.cs file under '$Path'."
    Write-Output "The Functions secret-storage check does not apply - skip it."
    exit 0
}

# Partition matching files by whether they already configure the setting.
$needsFix = @()
$configured = @()
foreach ($file in $matches) {
    if (Select-String -Path $file.FullName -SimpleMatch -Pattern $setting -Quiet) {
        $configured += $file
    } else {
        $needsFix += $file
    }
}

if ($needsFix.Count -eq 0) {
    Write-Output "VERDICT: ALREADY CONFIGURED"
    Write-Output "Every file that calls '$call' already sets '$setting':"
    foreach ($file in $configured) {
        $line = (Select-String -Path $file.FullName -SimpleMatch -Pattern $setting |
            Select-Object -First 1).LineNumber
        Write-Output "  - $($file.FullName) (line $line)"
    }
    Write-Output "No change required."
    exit 0
}

Write-Output "VERDICT: FIX REQUIRED"
Write-Output "The following file(s) call '$call' but do NOT set '$setting':"
foreach ($file in $needsFix) {
    $line = (Select-String -Path $file.FullName -SimpleMatch -Pattern $call |
        Select-Object -First 1).LineNumber
    Write-Output "  - $($file.FullName) (line $line)"
}
Write-Output ""
Write-Output "Add .WithEnvironment(`"$setting`", `"Files`") to the AddAzureFunctionsProject"
Write-Output "builder chain in each file above BEFORE running 'azd provision'."
exit 0
