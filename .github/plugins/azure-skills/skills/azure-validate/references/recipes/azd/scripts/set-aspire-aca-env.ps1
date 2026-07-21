<#
.SYNOPSIS
    Set the Container Apps environment variables that Aspire "limited mode" leaves unpopulated.

.DESCRIPTION
    When Aspire runs in "limited mode", `azd provision` creates the Azure resources
    (Container Registry, Managed Identity, Container Apps Environment) but does NOT populate the
    env vars that `azd deploy` needs to reference them. This script fills that gap.

    Run it AFTER `azd provision` but BEFORE `azd deploy`.

    The script only sets a variable if it is currently missing, and prints what it did so the
    result can be understood without re-inspecting `azd env get-values`:
      AZURE_CONTAINER_REGISTRY_ENDPOINT              <- az acr list ... [0].loginServer
      AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID   <- az identity list ... [0].id
      MANAGED_IDENTITY_CLIENT_ID                     <- az identity list ... [0].clientId

.PARAMETER Environment
    Optional azd environment name (forwarded to `azd env` calls).
    Defaults to the current/default azd environment.

.EXAMPLE
    ./set-aspire-aca-env.ps1

.EXAMPLE
    ./set-aspire-aca-env.ps1 -Environment my-azd-env
#>

param(
    [string]$Environment
)

# Shared `-e <name>` argument list for azd calls (empty when no env name given).
$azdEnvArgs = @()
if ($Environment) {
    $azdEnvArgs = @('-e', $Environment)
}

# Capture azd environment values and verify the call succeeded. PowerShell does not treat a
# native command's non-zero exit code as a terminating error, so check $LASTEXITCODE explicitly
# rather than relying on $ErrorActionPreference.
$azdOutput = azd env get-values @azdEnvArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "'azd env get-values' failed with exit code $LASTEXITCODE. Run 'azd provision' before this script so the azd environment is available."
    exit 1
}

# Load azd environment values into a hashtable.
$azdValues = @{}
foreach ($line in $azdOutput) {
    if (-not $line) { continue }
    $name, $value = $line.Split('=', 2)
    $azdValues[$name] = $value.Trim('"')
}

$rgName = $azdValues['AZURE_RESOURCE_GROUP']
if (-not $rgName) {
    Write-Error "AZURE_RESOURCE_GROUP is not set in the azd environment. Run 'azd provision' before this script so the resource group is available."
    exit 1
}

function Set-IfMissing {
    param(
        [string]$VarName,
        [string]$Description,
        [scriptblock]$ValueCommand
    )

    $existing = $azdValues[$VarName]
    if ($existing) {
        Write-Host "${VarName}: already present ($existing)"
        return
    }

    $value = (& $ValueCommand)
    if (-not $value) {
        Write-Error "Could not resolve $VarName ($Description) in resource group '$rgName'. Confirm 'azd provision' completed and the resource exists."
        exit 1
    }

    azd env set @azdEnvArgs $VarName $value
    Write-Host "${VarName}: set to $value"
}

Write-Host "Resource group: $rgName"

Set-IfMissing `
    -VarName 'AZURE_CONTAINER_REGISTRY_ENDPOINT' `
    -Description 'container registry login server' `
    -ValueCommand { az acr list --resource-group $rgName --query "[0].loginServer" -o tsv }

Set-IfMissing `
    -VarName 'AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID' `
    -Description 'managed identity resource id' `
    -ValueCommand { az identity list --resource-group $rgName --query "[0].id" -o tsv }

Set-IfMissing `
    -VarName 'MANAGED_IDENTITY_CLIENT_ID' `
    -Description 'managed identity client id' `
    -ValueCommand { az identity list --resource-group $rgName --query "[0].clientId" -o tsv }

Write-Host "Aspire Container Apps environment variables are ready for 'azd deploy'."
