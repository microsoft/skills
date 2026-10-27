<#
.SYNOPSIS
    Collects diagnostic information for an Azure Container App in one pass.
.DESCRIPTION
    Prints clearly labeled sections for the given Container App: revisions,
    registry configuration, ingress configuration, and recent logs. The script
    only gathers and labels output; it does not interpret the results.
.PARAMETER Name
    Name of the Container App.
.PARAMETER ResourceGroup
    Resource group that contains the Container App.
.PARAMETER Subscription
    Azure subscription ID. Defaults to the current subscription.
.EXAMPLE
    .\containerapp-diagnostics.ps1 -Name my-app -ResourceGroup my-rg
    # Collects revisions, registry/ingress config, and recent logs for my-app
.NOTES
    Exit codes: 0 = completed, 1 = collection failure, 2 = invalid arguments.
#>
param(
    [string]$Name,
    [string]$ResourceGroup,
    [string]$Subscription
)

if (-not $Name -or -not $ResourceGroup) {
    Write-Error "Usage: .\containerapp-diagnostics.ps1 -Name <app> -ResourceGroup <rg> [-Subscription <id>]"
    exit 2
}

$subArgs = @()
if ($Subscription) { $subArgs = @("--subscription", $Subscription) }

Write-Host "=== Container App Diagnostics: $Name (resource group: $ResourceGroup) ==="
Write-Host "Collecting revisions, registry/ingress configuration, and recent logs."
Write-Host ""

Write-Host "--- Revisions ---"
az containerapp revision list --name $Name -g $ResourceGroup @subArgs -o table
if ($LASTEXITCODE -ne 0) { Write-Host "(failed to list revisions)" }
Write-Host ""

Write-Host "--- Registry Config ---"
az containerapp show --name $Name -g $ResourceGroup @subArgs --query "properties.configuration.registries"
if ($LASTEXITCODE -ne 0) { Write-Host "(failed to read registry config)" }
Write-Host ""

Write-Host "--- Ingress Config ---"
az containerapp show --name $Name -g $ResourceGroup @subArgs --query "properties.configuration.ingress"
if ($LASTEXITCODE -ne 0) { Write-Host "(failed to read ingress config)" }
Write-Host ""

Write-Host "--- Recent Logs (last 20 lines) ---"
az containerapp logs show --name $Name -g $ResourceGroup @subArgs --tail 20
if ($LASTEXITCODE -ne 0) { Write-Host "(failed to read logs)" }
Write-Host ""

Write-Host "=== Diagnostics collection complete for $Name ==="
