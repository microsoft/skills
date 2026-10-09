# Collect Azure network resource configuration for an AKS cluster.
# Exit codes: 0 = success/help, 1 = collection failure, 2 = usage/argument error.
[CmdletBinding()]
param(
    [string]$ResourceGroup,
    [string]$ClusterName,
    [string]$OutputDir = $(if ($env:WORKSPACE_DIR) {
        Join-Path $env:WORKSPACE_DIR "network-captures"
    } else {
        Join-Path "." "aks-network-captures/network-captures"
    }),
    [switch]$Help
)

function Write-Usage {
    @"
Usage: collect-azure-network-info.ps1 -ResourceGroup <rg> -ClusterName <name> [-OutputDir <path>]

Collect AKS VNET, subnet, NSG, route, load-balancer, public-IP, peering,
and private-DNS configuration into one JSON evidence file.
"@
}

function Stop-Usage {
    param([string]$Message)
    [Console]::Error.WriteLine("Error: $Message")
    [Console]::Error.WriteLine((Write-Usage))
    exit 2
}

function Stop-Failure {
    param([string]$Message)
    [Console]::Error.WriteLine("Error: $Message")
    exit 1
}

function Invoke-AzText {
    param([string[]]$AzArguments, [string]$FailureMessage)
    $output = (& az @AzArguments 2>&1) -join "`n"
    if ($LASTEXITCODE -ne 0) {
        Stop-Failure "$FailureMessage`n$output"
    }
    return $output.Trim()
}

function Invoke-AzJson {
    param([string[]]$AzArguments, [string]$FailureMessage)
    $raw = Invoke-AzText -AzArguments $AzArguments -FailureMessage $FailureMessage
    try {
        return $raw | ConvertFrom-Json -ErrorAction Stop
    } catch {
        Stop-Failure "$FailureMessage returned invalid JSON: $($_.Exception.Message)"
    }
}

if ($Help) {
    Write-Usage
    exit 0
}
if ([string]::IsNullOrWhiteSpace($ResourceGroup)) {
    Stop-Usage "-ResourceGroup is required"
}
if ([string]::IsNullOrWhiteSpace($ClusterName)) {
    Stop-Usage "-ClusterName is required"
}
if ($ResourceGroup -match "[`r`n]") {
    Stop-Usage "-ResourceGroup must be a single line"
}
if ($ClusterName -notmatch "^[A-Za-z0-9][A-Za-z0-9_-]{0,61}[A-Za-z0-9]$" -and
    $ClusterName -notmatch "^[A-Za-z0-9]$") {
    Stop-Usage "-ClusterName has an invalid format"
}
if ([string]::IsNullOrWhiteSpace($OutputDir) -or $OutputDir -match "[`r`n]") {
    Stop-Usage "-OutputDir must be a non-empty single-line path"
}
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Stop-Failure "Azure CLI (az) is not installed or not on PATH"
}

$existingUserAgent = $env:AZURE_HTTP_USER_AGENT
$env:AZURE_HTTP_USER_AGENT = if ($existingUserAgent) {
    "$existingUserAgent AKS-Skills"
} else {
    "AKS-Skills"
}

& az account show --output none
if ($LASTEXITCODE -ne 0) {
    Stop-Failure "not logged in to Azure CLI; run 'az login' first"
}

$nodeResourceGroup = Invoke-AzText -AzArguments @(
    "aks", "show", "--resource-group", $ResourceGroup, "--name", $ClusterName,
    "--query", "nodeResourceGroup", "-o", "tsv"
) -FailureMessage "could not retrieve the AKS node resource group"
if ([string]::IsNullOrWhiteSpace($nodeResourceGroup)) {
    Stop-Failure "AKS cluster has no node resource group"
}
$vnetSubnetId = Invoke-AzText -AzArguments @(
    "aks", "show", "--resource-group", $ResourceGroup, "--name", $ClusterName,
    "--query", "agentPoolProfiles[0].vnetSubnetId", "-o", "tsv"
) -FailureMessage "could not retrieve the AKS subnet"
$networkPlugin = Invoke-AzText -AzArguments @(
    "aks", "show", "--resource-group", $ResourceGroup, "--name", $ClusterName,
    "--query", "networkProfile.networkPlugin", "-o", "tsv"
) -FailureMessage "could not retrieve the AKS network plugin"
$networkPolicy = Invoke-AzText -AzArguments @(
    "aks", "show", "--resource-group", $ResourceGroup, "--name", $ClusterName,
    "--query", "networkProfile.networkPolicy", "-o", "tsv"
) -FailureMessage "could not retrieve the AKS network policy"
if ([string]::IsNullOrWhiteSpace($networkPolicy)) {
    $networkPolicy = "none"
}

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
$result = [ordered]@{
    cluster = [ordered]@{
        name = $ClusterName
        resourceGroup = $ResourceGroup
        nodeResourceGroup = $nodeResourceGroup
        networkPlugin = $networkPlugin
        networkPolicy = $networkPolicy
        timestamp = $timestamp
    }
    vnet = @{}
    subnets = @()
    nodeSubnet = @{}
    nsgs = @()
    routeTables = @()
    loadBalancers = @()
    publicIPs = @()
    vnetPeerings = @()
    privateDnsZones = @()
}

if (-not [string]::IsNullOrWhiteSpace($vnetSubnetId)) {
    $segments = $vnetSubnetId.Trim("/").Split("/")
    $vnetIndex = [Array]::IndexOf($segments, "virtualNetworks")
    $subnetIndex = [Array]::IndexOf($segments, "subnets")
    $resourceGroupIndex = [Array]::IndexOf($segments, "resourceGroups")
    if ($vnetIndex -lt 0 -or $subnetIndex -lt 0 -or $resourceGroupIndex -lt 0) {
        Stop-Failure "AKS returned an invalid VNET subnet resource ID"
    }
    $vnetName = $segments[$vnetIndex + 1]
    $subnetName = $segments[$subnetIndex + 1]
    $vnetResourceGroup = $segments[$resourceGroupIndex + 1]

    $result.vnet = Invoke-AzJson -AzArguments @(
        "network", "vnet", "show", "--resource-group", $vnetResourceGroup,
        "--name", $vnetName, "-o", "json"
    ) -FailureMessage "could not collect VNET information"
    $result.subnets = @(Invoke-AzJson -AzArguments @(
        "network", "vnet", "subnet", "list", "--resource-group", $vnetResourceGroup,
        "--vnet-name", $vnetName, "-o", "json"
    ) -FailureMessage "could not collect subnet information")
    $result.nodeSubnet = Invoke-AzJson -AzArguments @(
        "network", "vnet", "subnet", "show", "--resource-group", $vnetResourceGroup,
        "--vnet-name", $vnetName, "--name", $subnetName,
        "--query", "{name:name,addressPrefix:addressPrefix,udr:routeTable,nsg:networkSecurityGroup,delegations:delegations,serviceEndpoints:serviceEndpoints,privateEndpointNetworkPolicies:privateEndpointNetworkPolicies}",
        "-o", "json"
    ) -FailureMessage "could not collect the cluster subnet details"
    $result.vnetPeerings = @(Invoke-AzJson -AzArguments @(
        "network", "vnet", "peering", "list", "--resource-group", $vnetResourceGroup,
        "--vnet-name", $vnetName, "-o", "json"
    ) -FailureMessage "could not collect VNET peerings")
}

$result.nsgs = @(Invoke-AzJson -AzArguments @(
    "network", "nsg", "list", "--resource-group", $nodeResourceGroup, "-o", "json"
) -FailureMessage "could not collect network security groups")
$result.routeTables = @(Invoke-AzJson -AzArguments @(
    "network", "route-table", "list", "--resource-group", $nodeResourceGroup, "-o", "json"
) -FailureMessage "could not collect route tables")
$result.loadBalancers = @(Invoke-AzJson -AzArguments @(
    "network", "lb", "list", "--resource-group", $nodeResourceGroup, "-o", "json"
) -FailureMessage "could not collect load balancers")
$result.publicIPs = @(Invoke-AzJson -AzArguments @(
    "network", "public-ip", "list", "--resource-group", $nodeResourceGroup, "-o", "json"
) -FailureMessage "could not collect public IPs")
$result.privateDnsZones = @(Invoke-AzJson -AzArguments @(
    "network", "private-dns", "zone", "list", "-o", "json"
) -FailureMessage "could not collect private DNS zones")

try {
    New-Item -ItemType Directory -Path $OutputDir -Force -ErrorAction Stop | Out-Null
    $outputFile = Join-Path $OutputDir "azure-network-info-$ClusterName-$timestamp.json"
    $result | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $outputFile -Encoding UTF8 -ErrorAction Stop
} catch {
    Stop-Failure "could not write the evidence file: $($_.Exception.Message)"
}

Write-Output "Azure network information saved to: $outputFile"
Write-Output "Cluster: $ClusterName"
Write-Output "Network Plugin: $networkPlugin"
Write-Output "Network Policy: $networkPolicy"
Write-Output "NSGs: $($result.nsgs.Count)"
Write-Output "Route Tables: $($result.routeTables.Count)"
Write-Output "Load Balancers: $($result.loadBalancers.Count)"
Write-Output "Public IPs: $($result.publicIPs.Count)"
Write-Output "VNET Peerings: $($result.vnetPeerings.Count)"
Write-Output "Private DNS Zones: $($result.privateDnsZones.Count)"
