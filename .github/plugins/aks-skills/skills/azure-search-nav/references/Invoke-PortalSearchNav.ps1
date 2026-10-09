<#
.SYNOPSIS
    Calls the Azure portal search API for a supported Azure resource and constructs
    the resulting Azure portal deep link from the returned menu id.

.DESCRIPTION
    Given a portal link to a supported Container Service, Arc-enabled Kubernetes,
    or Compute resource and a natural-language search query, this script:
      1. Parses the ARM resource id and tenant id out of the resource link.
      2. Signs in to Azure and acquires a bearer token.
      3. POSTs a semantic search to the aks-search-direct-mid endpoint.
      4. Extracts the menu id(s) from the response and rebuilds the portal link
         against https://portal.azure.com.

.PARAMETER ResourceUrl
    A portal URL (or bare ARM resource id) pointing at a supported Azure resource.

.PARAMETER Query
    The natural-language search query, e.g. "image cleaner".

.PARAMETER ArmProvider
    Override for the armProvider filter value. Auto-derived from ResourceUrl when omitted.

.PARAMETER AppTenantId
    Value for the App-Tenant-Id header. Auto-derived from the URL or the signed-in token.

.PARAMETER Locale
    Value for the locale filter. Default "en.en-us".

.PARAMETER UseDeviceAuthentication
    Use device-code authentication instead of opening an interactive browser window.

.PARAMETER Raw
    When set, only prints the raw JSON API response (skip link construction).

.EXAMPLE
    ./Invoke-PortalSearchNav.ps1 -ResourceUrl $aksPortalLink -Query 'image cleaner'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $ResourceUrl,

    [Parameter(Mandatory = $true)]
    [string] $Query,

    [string] $ArmProvider,

    [string] $AppTenantId,

    [string] $Locale = 'en.en-us',

    [switch] $UseDeviceAuthentication,

    [switch] $Raw
)

$ErrorActionPreference = 'Stop'

# Pinned production endpoint and token audience. Not exposed as parameters.
$ApiUrl = 'https://PCNX-AI-etc5bra3fscchrew.b02.azurefd.net/aks-search-direct-mid'
$TokenResourceUrl = 'https://management.azure.com/'

# ---------------------------------------------------------------------------
# 1. Parse the resource link.
# ---------------------------------------------------------------------------
$resourcePattern = '(?i)^(?<prefix>.*?)/resource/(?<resourceId>subscriptions/(?<sub>[^/]+)/resourceGroups/(?<rg>[^/]+)/providers/(?<provider>[^/]+)/(?<type>[^/]+)/(?<name>[^/?#]+))(?<trailing>/[^?#]*)?'
$match = [regex]::Match($ResourceUrl, $resourcePattern)

if (-not $match.Success) {
    $resourcePattern = '(?i)^/?(?<resourceId>subscriptions/(?<sub>[^/]+)/resourceGroups/(?<rg>[^/]+)/providers/(?<provider>[^/]+)/(?<type>[^/]+)/(?<name>[^/?#]+))/?$'
    $match = [regex]::Match($ResourceUrl, $resourcePattern)
}

if (-not $match.Success) {
    throw "Could not parse a resource id out of -ResourceUrl. Expected a portal resource URL or '/subscriptions/.../resourceGroups/.../providers/<provider>/<type>/<name>'."
}

$resourceId     = '/' + $match.Groups['resourceId'].Value
$subscriptionId = $match.Groups['sub'].Value
$providerNs     = $match.Groups['provider'].Value
$resourceType   = $match.Groups['type'].Value

if (-not $ArmProvider) {
    $ArmProvider = "$providerNs/$resourceType"
}

# Validate and normalise armProvider casing from resource-types.json.
$resourceTypesPath = Join-Path $PSScriptRoot 'resource-types.json'
$resourceTypes = Get-Content $resourceTypesPath -Raw | ConvertFrom-Json
$armKey = $ArmProvider.ToLowerInvariant()
$entry = $resourceTypes.PSObject.Properties[$armKey]
if ($entry) {
    $ArmProvider = $entry.Value.armProvider
}
else {
    throw "Resource type '$ArmProvider' is not enabled for portal navigation search."
}

if (-not $AppTenantId) {
    $tenantMatch = [regex]::Match($ResourceUrl, '#@(?<tenant>[^/]+)')
    if ($tenantMatch.Success) {
        $AppTenantId = $tenantMatch.Groups['tenant'].Value
    }
}

# Output links are always built against the production portal host.
$prefix = if ($AppTenantId) { "https://portal.azure.com/#@$AppTenantId" } else { 'https://portal.azure.com' }

# ---------------------------------------------------------------------------
# 2. Sign in to Azure and acquire the API token.
# ---------------------------------------------------------------------------
if (-not (Get-Module -ListAvailable -Name Az.Accounts)) {
    throw "The Az.Accounts PowerShell module is required. Install it with 'Install-Module Az.Accounts -Scope CurrentUser'."
}

Import-Module Az.Accounts

$connectParameters = @{ SkipContextPopulation = $true }
if ($AppTenantId)    { $connectParameters['Tenant']       = $AppTenantId }
if ($subscriptionId) { $connectParameters['Subscription']  = $subscriptionId }
if ($UseDeviceAuthentication) { $connectParameters['UseDeviceAuthentication'] = $true }

Write-Host 'Sign in with the Microsoft account that has access to this Azure resource.' -ForegroundColor Cyan
Connect-AzAccount @connectParameters | Out-Null

$tokenParameters = @{ ResourceUrl = $TokenResourceUrl }
$azTenant = (Get-AzContext).Tenant.Id
if ($azTenant) { $tokenParameters['TenantId'] = $azTenant }
$accessToken = Get-AzAccessToken @tokenParameters

if ($accessToken.Token -is [System.Security.SecureString]) {
    $tokenCredential = [System.Net.NetworkCredential]::new('', $accessToken.Token)
    $BearerToken = $tokenCredential.Password
}
else {
    $BearerToken = [string] $accessToken.Token
}

if ([string]::IsNullOrWhiteSpace($BearerToken)) {
    throw "Azure sign-in succeeded, but no access token was returned for '$TokenResourceUrl'."
}

# The API's APIM issuer check requires App-Tenant-Id to be the GUID that
# issued the token, not the domain from the URL.
try {
    $jwtParts = $BearerToken.Split('.')
    $payloadSeg = $jwtParts[1].Replace('-','+').Replace('_','/')
    switch ($payloadSeg.Length % 4) { 2 { $payloadSeg += '==' } 3 { $payloadSeg += '=' } }
    $claims = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payloadSeg)) | ConvertFrom-Json
    if ($claims.tid) { $AppTenantId = $claims.tid }
} catch {
    Write-Verbose "Could not decode tid from JWT: $_"
}

# ---------------------------------------------------------------------------
# 3. Build and send the request.
# ---------------------------------------------------------------------------
$payload = [ordered]@{
    search                = $Query
    count                 = 'true'
    filter                = "armProvider eq '$ArmProvider' and locale eq '$Locale'"
    queryType             = 'semantic'
    semanticConfiguration = 'semantic'
}

$headers = @{
    'Accept'              = '*/*'
    'User-Data-Boundary'  = 'Global'
}
$headers['Authorization'] = "Bearer $BearerToken"
if ($AppTenantId) {
    $headers['App-Tenant-Id'] = $AppTenantId
}

Write-Verbose "POST $ApiUrl"
Write-Verbose ($payload | ConvertTo-Json -Depth 10)

$response = Invoke-RestMethod -Uri $ApiUrl -Method Post -Headers $headers -ContentType 'application/json' -Body ($payload | ConvertTo-Json -Depth 10)

if ($Raw) {
    $response | ConvertTo-Json -Depth 20
    return
}

# ---------------------------------------------------------------------------
# 3. Find menu id(s) in the response (schema-tolerant recursive search).
# ---------------------------------------------------------------------------
function Find-MenuIdCandidates {
    param(
        [Parameter(Mandatory)] $Object,
        [string[]] $Names = @('menuId', 'menuID', 'menu_id', 'bladeName', 'blade')
    )

    $found = New-Object System.Collections.Generic.List[object]

    function Recurse($obj) {
        if ($null -eq $obj) { return }

        if ($obj -is [string]) { return }

        if ($obj -is [System.Collections.IEnumerable]) {
            foreach ($item in $obj) { Recurse $item }
            return
        }

        if ($obj -is [System.Management.Automation.PSCustomObject]) {
            $menuValue = $null
            foreach ($name in $Names) {
                $prop = $obj.PSObject.Properties[$name]
                if ($prop -and -not [string]::IsNullOrWhiteSpace([string]$prop.Value)) {
                    $menuValue = $prop.Value
                    break
                }
            }
            if ($menuValue) {
                $title = $null
                foreach ($titleName in @('title', 'name', 'displayName', 'label')) {
                    $titleProp = $obj.PSObject.Properties[$titleName]
                    if ($titleProp) { $title = $titleProp.Value; break }
                }
                $score = $null
                $scoreProp = $obj.PSObject.Properties['score']
                if ($scoreProp) { $score = $scoreProp.Value }

                $found.Add([PSCustomObject]@{ MenuId = $menuValue; Title = $title; Score = $score })
            }
            foreach ($prop in $obj.PSObject.Properties) {
                Recurse $prop.Value
            }
        }
    }

    Recurse $Object
    return $found
}

$candidates = Find-MenuIdCandidates -Object $response

if (-not $candidates -or $candidates.Count -eq 0) {
    Write-Warning 'No menu id found in the API response with the known property names (menuId, menuID, menu_id, bladeName, blade). Dumping raw response for inspection:'
    $response | ConvertTo-Json -Depth 20
    return
}

# ---------------------------------------------------------------------------
# 4. Rebuild the portal link for every candidate menu id.
# ---------------------------------------------------------------------------
$results = foreach ($candidate in $candidates) {
    [PSCustomObject]@{
        Title   = $candidate.Title
        Score   = $candidate.Score
        MenuId  = $candidate.MenuId
        PortalLink = "$prefix/resource$resourceId/$($candidate.MenuId)"
    }
}

$results | Format-Table -AutoSize -Wrap

Write-Host ''
Write-Host 'Best match portal link:' -ForegroundColor Green
Write-Host $results[0].PortalLink
