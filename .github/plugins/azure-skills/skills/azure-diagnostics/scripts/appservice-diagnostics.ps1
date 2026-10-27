<#
.SYNOPSIS
    Collects diagnostic information for an Azure App Service web app in one pass.
.DESCRIPTION
    Prints clearly labeled sections for the given web app: app config, recent
    deployments, app settings, and custom domains. The script only gathers and
    labels output; it does not interpret the results.
.PARAMETER Name
    Name of the App Service web app.
.PARAMETER ResourceGroup
    Resource group that contains the web app.
.PARAMETER Subscription
    Azure subscription ID. Defaults to the current subscription.
.EXAMPLE
    .\appservice-diagnostics.ps1 -Name my-app -ResourceGroup my-rg
    # Collects config, recent deployments, app settings, and custom domains for my-app
.NOTES
    Exit codes: 0 = completed, 1 = collection failure, 2 = invalid arguments.
#>
param(
    [string]$Name,
    [string]$ResourceGroup,
    [string]$Subscription
)

if (-not $Name -or -not $ResourceGroup) {
    Write-Error "Usage: .\appservice-diagnostics.ps1 -Name <app> -ResourceGroup <rg> [-Subscription <id>]"
    exit 2
}

$subArgs = @()
if ($Subscription) { $subArgs = @("--subscription", $Subscription) }

Write-Host "=== App Service Diagnostics: $Name (resource group: $ResourceGroup) ==="
Write-Host "Collecting app config, recent deployments, app settings, and custom domains."
Write-Host ""

Write-Host "--- App Config ---"
az webapp show -n $Name -g $ResourceGroup @subArgs --query "{state:state, runtime:siteConfig.linuxFxVersion, healthCheck:siteConfig.healthCheckPath, alwaysOn:siteConfig.alwaysOn}" -o table
if ($LASTEXITCODE -ne 0) { Write-Host "(failed to read app config)" }
Write-Host ""

Write-Host "--- Recent Deployments (last 3) ---"
az webapp deployment list -n $Name -g $ResourceGroup @subArgs --query "[:3].{id:id, status:status, time:end_time}" -o table
if ($LASTEXITCODE -ne 0) { Write-Host "(failed to list deployments)" }
Write-Host ""

Write-Host "--- App Settings (names only) ---"
az webapp config appsettings list -n $Name -g $ResourceGroup @subArgs --query "[].name" -o tsv
if ($LASTEXITCODE -ne 0) { Write-Host "(failed to list app settings)" }
Write-Host ""

Write-Host "--- Custom Domains ---"
az webapp config hostname list -g $ResourceGroup --webapp-name $Name @subArgs -o table
if ($LASTEXITCODE -ne 0) { Write-Host "(failed to list custom domains)" }
Write-Host ""

Write-Host "=== Diagnostics collection complete for $Name ==="
