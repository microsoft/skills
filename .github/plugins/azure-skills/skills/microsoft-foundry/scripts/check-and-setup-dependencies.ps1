$azd = Get-Command azd -ErrorAction SilentlyContinue
if (-not $azd) {
    Write-Host "Azure Developer CLI (azd) is required. Install it from https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd, then rerun this script."
    exit 1
}

$env:AZURE_DEV_USER_AGENT = "microsoft_foundry_skill"

try {
    $extensionList = (& azd extension list --installed --output json) -join "`n"
    if ($LASTEXITCODE -ne 0) {
        throw "azd extension list failed with exit code $LASTEXITCODE."
    }
    $extensions = $extensionList | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-Error "Failed to list installed azd extensions: $_"
    exit 1
}

foreach ($extensionId in @("microsoft.foundry", "azure.ai.evaluations")) {
    $installed = @($extensions) | Where-Object { $_.id -eq $extensionId } | Select-Object -First 1
    if ($installed) {
        continue
    }

    Write-Host "$extensionId is not installed. Installing it now..."
    & azd extension install $extensionId
    $installExitCode = $LASTEXITCODE
    if ($installExitCode -ne 0) {
        Write-Error "Failed to install the $extensionId azd extension."
        exit $installExitCode
    }
}

Write-Host "Dependencies are ready: azd and the microsoft.foundry and azure.ai.evaluations extensions are ready."
exit 0
