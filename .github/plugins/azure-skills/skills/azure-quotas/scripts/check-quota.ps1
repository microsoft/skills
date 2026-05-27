<#
.SYNOPSIS
    Checks Azure quota limits and current usage for a resource provider.
.DESCRIPTION
    Installs the quota CLI extension if needed, then queries quota limits and
    current usage in a single call. Returns a table with limit, usage, and
    available capacity for every quota (or a single quota when ResourceName is provided).
.PARAMETER ResourceProvider
    Azure resource provider namespace (e.g., "Microsoft.Compute", "Microsoft.Network").
.PARAMETER Region
    Azure region to check (e.g., "eastus", "westus2").
.PARAMETER ResourceName
    Quota resource name (e.g., "standardDSv3Family"). If omitted, returns all quotas.
.PARAMETER SubscriptionId
    Azure subscription ID. Defaults to the current subscription.
.EXAMPLE
    .\check-quota.ps1 -ResourceProvider Microsoft.Compute -Region eastus
    # Shows limit, usage, and available capacity for ALL compute quotas in eastus
.EXAMPLE
    .\check-quota.ps1 -ResourceProvider Microsoft.Compute -Region eastus -ResourceName standardDSv3Family
    # Shows limit, usage, and available capacity for the DSv3 VM family only
#>
param(
    [Parameter(Mandatory)][string]$ResourceProvider,
    [Parameter(Mandatory)][string]$Region,
    [string]$ResourceName,
    [string]$SubscriptionId
)

$ErrorActionPreference = "Stop"

# Ensure the quota extension is installed
$ext = az extension list --query "[?name=='quota'].name" -o tsv 2>$null
if (-not $ext) {
    Write-Host "Installing quota extension..."
    az extension add --name quota --yes 2>$null
}

# Resolve subscription
if (-not $SubscriptionId) {
    $SubscriptionId = az account show --query id -o tsv
}

$scope = "/subscriptions/$SubscriptionId/providers/$ResourceProvider/locations/$Region"

Write-Host "Checking quotas in scope $scope"

if ($ResourceName) {
    # Single-resource mode
    Write-Host "Quota for '$ResourceName' ($ResourceProvider, $Region):"
    Write-Host ""

    $limit = az quota show --resource-name $ResourceName --scope $scope -o json 2>$null | ConvertFrom-Json
    $usage = az quota usage show --resource-name $ResourceName --scope $scope -o json 2>$null | ConvertFrom-Json

    $limitValue = $limit.properties.limit.value
    $usageValue = $usage.properties.usages.value
    $available = $limitValue - $usageValue

    [PSCustomObject]@{
        Resource  = $ResourceName
        Region    = $Region
        Limit     = $limitValue
        Usage     = $usageValue
        Available = $available
    } | Format-Table -AutoSize
} else {
    # All-quotas mode: fetch limits and usage, join by name
    Write-Host "Quotas for $ResourceProvider in ${Region}:"
    Write-Host ""

    $quotas = az quota list --scope $scope -o json 2>$null | ConvertFrom-Json
    $usages = az quota usage list --scope $scope -o json 2>$null | ConvertFrom-Json

    $usageLookup = @{}
    foreach ($u in $usages) {
        $usageLookup[$u.name] = $u.properties.usages.value
    }

    $results = foreach ($q in $quotas) {
        $name = $q.name
        $limitValue = $q.properties.limit.value
        $usageValue = if ($usageLookup.ContainsKey($name)) { $usageLookup[$name] } else { 0 }
        $available = $limitValue - $usageValue
        [PSCustomObject]@{
            Resource  = $name
            Region    = $Region
            Limit     = $limitValue
            Usage     = $usageValue
            Available = $available
        }
    }

    $results | Format-Table -AutoSize
}
