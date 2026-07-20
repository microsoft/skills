<#
.SYNOPSIS
    Verifies the local environment for creating a hosted Foundry agent with `azd ai`.
.DESCRIPTION
    Runs all the read-only checks in one pass and prints a single concise summary,
    so the agent does not have to run (and reason over) each azd command separately.

    Output lines are prefixed with [OK], [WARN], or [ACTION].
    Exit code is 0 when no blocking actions remain, 1 when at least one [ACTION] is required.
.EXAMPLE
    ./verify-environment.ps1
#>

$ErrorActionPreference = "Stop"

# Tag azd telemetry
$env:AZURE_DEV_USER_AGENT = "microsoft_foundry_skill"

$actionRequired = $false

function Note-Ok     { param([string]$m) Write-Output "[OK] $m" }
function Note-Warn   { param([string]$m) Write-Output "[WARN] $m" }
function Note-Action { param([string]$m) Write-Output "[ACTION] $m"; $script:actionRequired = $true }

function Get-AzdJson {
    param([string[]]$AzdArgs)
    try {
        $raw = & azd @AzdArgs 2>$null
        if (-not $raw) { return $null }
        return ($raw | ConvertFrom-Json -ErrorAction Stop)
    } catch {
        return $null
    }
}

# Refresh PATH to pick up recently-installed tools (e.g. azd installed in same session)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

function Add-CommandFallbackPath {
    param(
        [string] $CommandName,
        [string[]] $Directories
    )

    if (Get-Command $CommandName -ErrorAction SilentlyContinue) {
        return [pscustomobject]@{ Found = $true; AddedPath = $null }
    }

    foreach ($dir in $Directories) {
        if (-not $dir) { continue }
        foreach ($ext in @(".exe", ".cmd", ".bat")) {
            $candidate = Join-Path $dir "$CommandName$ext"
            if (Test-Path $candidate) {
                $env:Path = "$dir;$env:Path"
                return [pscustomobject]@{ Found = $true; AddedPath = $dir }
            }
        }
    }

    return [pscustomobject]@{ Found = [bool](Get-Command $CommandName -ErrorAction SilentlyContinue); AddedPath = $null }
}

function Test-AzdAuthLoggedIn {
    $raw = ""
    try {
        $raw = (& azd auth login --check-status 2>&1) -join "`n"
    } catch {
        $raw = $_ | Out-String
    }
    $authExit = $LASTEXITCODE

    if ($raw -match "(?i)(not\s+logged\s+in|not\s+authenticated|no\s+account|login\s+required|please\s+run.*azd\s+auth\s+login|run.*azd\s+auth\s+login|expired)") {
        return $false
    }

    if ($raw -match "(?i)(logged\s+in|authenticated|already\s+logged\s+in)") {
        return $true
    }

    # Unrecognized output -- fall back to exit code
    return ($authExit -eq 0)
}

# 1. Required CLIs
# Check PATH first, then probe common install locations (winget, MSI, chocolatey)
$azdCommand = Add-CommandFallbackPath "azd" @(
    "$env:LOCALAPPDATA\Programs\Azure Dev CLI",
    "$env:ProgramFiles\Azure Dev CLI",
    "${env:ProgramFiles(x86)}\Azure Dev CLI",
    "$env:USERPROFILE\.azd\bin"
)
$azdInstalled = $azdCommand.Found
if ($azdCommand.AddedPath) {
    Note-Warn "azd found at '$($azdCommand.AddedPath)' but was not on PATH. Added automatically for this session."
}
if (-not $azdInstalled) {
    Note-Action "Azure Developer CLI (azd) is not installed. Install it from https://aka.ms/azd-install, then re-run."
}

$azCommand = Add-CommandFallbackPath "az" @(
    "$env:ProgramFiles\Microsoft SDKs\Azure\CLI2\wbin",
    "${env:ProgramFiles(x86)}\Microsoft SDKs\Azure\CLI2\wbin"
)
$azInstalled = $azCommand.Found
if ($azCommand.AddedPath) {
    Note-Warn "az found at '$($azCommand.AddedPath)' but was not on PATH. Added automatically for this session."
}
if (-not $azInstalled) {
    Note-Action "Azure CLI (az) is not installed. Install it from https://aka.ms/installazurecli, then re-run."
}

if (-not $azdInstalled -or -not $azInstalled) {
    Write-Output ""
    Write-Output "Summary: CLI missing -- cannot continue."
    exit 1
}

$verJson = Get-AzdJson @("version", "--output", "json")
$azdVersion = if ($verJson -and $verJson.azd -and $verJson.azd.version) { $verJson.azd.version } else { "unknown" }
Note-Ok "azd installed (version $azdVersion)."

try {
    $azVersionRaw = (& az version --query '"azure-cli"' -o tsv 2>$null) -join "`n"
} catch {
    $azVersionRaw = ""
}
$azVersion = if ($azVersionRaw) { $azVersionRaw.Trim() } else { "unknown" }
Note-Ok "Azure CLI installed (version $azVersion)."

# 2. Required azd extensions
try {
    $extRaw = (& azd extension list --installed --output json 2>$null) -join "`n"
} catch {
    $extRaw = ""
}
foreach ($ext in @("azure.ai.agents", "azure.ai.projects", "microsoft.foundry")) {
    if ($extRaw -match [regex]::Escape($ext)) {
        Note-Ok "Extension '$ext' is installed."
    } else {
        Note-Action "Extension '$ext' is missing. Run: azd extension install $ext"
    }
}

# 3. Auth status
if (Test-AzdAuthLoggedIn) {
    Note-Ok "Logged in to azd."
} else {
    Note-Action "Not logged in to azd. Ask the user to run 'azd auth login' (it opens a browser; never run it for them)."
}

try {
    $azAccountRaw = (& az account show --output json 2>$null) -join "`n"
} catch {
    $azAccountRaw = ""
}
if (-not $azAccountRaw) {
    Note-Action "Not logged in to Azure CLI. Ask the user to run 'az login' (it opens a browser; never run it for them)."
} else {
    try {
        $azAccount = $azAccountRaw | ConvertFrom-Json -ErrorAction Stop
        $state = if ($azAccount.PSObject.Properties.Name -contains "state") { $azAccount.state } else { "" }
        if ($state -and $state -ne "Enabled") {
            Note-Action "Azure CLI active subscription state is '$state'. Ask the user to select an enabled subscription with 'az account set --subscription <id>'."
        } else {
            $subName = if ($azAccount.PSObject.Properties.Name -contains "name" -and $azAccount.name) { $azAccount.name } else { "unknown" }
            Note-Ok "Azure CLI logged in (subscription: $subName)."
        }
    } catch {
        Note-Action "Unable to verify Azure CLI login status. Ask the user to run 'az login' and re-run this script."
    }
}

if ($actionRequired) {
    Write-Output ""
    Write-Output "Summary: action required -- resolve the [ACTION] items above before continuing."
    exit 1
}

# 4. Foundry project endpoint (optional at this stage)
# Short-circuit when there's no azd project in cwd: `azd ai project show` / `agent show`
# would just return nothing after a ~3s subprocess each.
if (-not (Test-Path "azure.yaml")) {
    Note-Warn "No Foundry project endpoint set yet. A new project will be created at provision/deploy time, or supply an existing project resource ID."
    Note-Ok "No agent deployed yet. Proceed with create."
} else {
    $projectJson = Get-AzdJson @("ai", "project", "show", "--output", "json")
    $endpoint = $null
    if ($projectJson) {
        foreach ($k in @("endpoint", "projectEndpoint", "aiProjectEndpoint")) {
            if ($projectJson.PSObject.Properties.Name -contains $k -and $projectJson.$k) {
                $endpoint = $projectJson.$k
                break
            }
        }
    }
    if ($endpoint) {
        Note-Ok "Foundry project endpoint configured: $endpoint"
    } else {
        Note-Warn "No Foundry project endpoint set yet. A new project will be created at provision/deploy time, or supply an existing project resource ID."
    }

    # 5. Agent deployment status
    $agentJson = Get-AzdJson @("ai", "agent", "show", "--output", "json")
    if ($agentJson) {
        $status = if ($agentJson.PSObject.Properties.Name -contains "status" -and $agentJson.status) { $agentJson.status } else { "unknown" }
        switch ($status) {
            { $_ -in @("active", "deployed") } { Note-Ok "An agent is already deployed (status: $status). Skip to deploy.md to redeploy, or tools to add a tool." }
            "not_deployed"                     { Note-Ok "No agent deployed yet (status: not_deployed). Proceed with create." }
            default                            { Note-Warn "Agent status: $status." }
        }
    } else {
        Note-Ok "No agent deployed yet. Proceed with create."
    }
}

Write-Output ""
if ($actionRequired) {
    Write-Output "Summary: action required -- resolve the [ACTION] items above before continuing."
    exit 1
} else {
    Write-Output "Summary: environment ready for 'azd ai' hosted-agent creation."
    exit 0
}
