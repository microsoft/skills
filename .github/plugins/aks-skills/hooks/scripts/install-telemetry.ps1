# Installs the standalone telemetry reporter for the current operating system
# and native architecture.
#
# Exit codes:
#   0 = installed or already present
#   1 = detection, download, extraction, or installation failure
#   2 = usage or argument error

param(
    [string] $Version
)

$toolName = 'ghcfa-telem'

# Writes an installer failure to the error stream without terminating the script.
function Write-InstallerError {
    param([string] $Message)
    Write-Error -Message $Message -ErrorAction Continue
}

# Detects the native operating system and architecture and returns the matching runtime target.
function Get-TelemetryTarget {
    $runtime = [System.Runtime.InteropServices.RuntimeInformation]
    $platform = [System.Runtime.InteropServices.OSPlatform]

    if ($runtime::IsOSPlatform($platform::Windows)) {
        $operatingSystem = 'win'
    }
    elseif ($runtime::IsOSPlatform($platform::OSX)) {
        $operatingSystem = 'osx'
    }
    elseif ($runtime::IsOSPlatform($platform::Linux)) {
        $operatingSystem = 'linux'
        $isMusl = Test-Path -LiteralPath '/etc/alpine-release' -PathType Leaf

        if (-not $isMusl -and (Test-Path -LiteralPath '/etc/os-release' -PathType Leaf)) {
            try {
                foreach ($line in [System.IO.File]::ReadAllLines('/etc/os-release')) {
                    if ($line -match '^\s*ID\s*=\s*"?alpine"?\s*$') {
                        $isMusl = $true
                        break
                    }
                }
            }
            catch {
                throw "Unable to inspect /etc/os-release: $($_.Exception.Message)"
            }
        }

        if (-not $isMusl -and (Test-Path -LiteralPath '/lib' -PathType Container)) {
            try {
                $isMusl = [System.IO.Directory]::GetFiles('/lib', 'ld-musl-*.so.1').Count -gt 0
            }
            catch {
                throw "Unable to inspect Linux C runtime files: $($_.Exception.Message)"
            }
        }

        if ($isMusl) {
            $operatingSystem = 'linux-musl'
        }
    }
    else {
        throw "Unsupported operating system: $($runtime::OSDescription)"
    }

    $architecture = switch ($runtime::OSArchitecture.ToString()) {
        'X64' { 'x64' }
        'Arm64' { 'arm64' }
        default { throw "Unsupported native architecture: $($runtime::OSArchitecture)" }
    }

    [pscustomobject]@{
        OperatingSystem = $operatingSystem
        Architecture = $architecture
        RuntimeIdentifier = "$operatingSystem-$architecture"
        BinaryName = $(if ($operatingSystem -eq 'win') { "${toolName}.exe" } else { $toolName })
    }
}

# Resolves the platform-specific root directory used to cache installed reporter versions.
function Get-TelemetryCacheRoot {
    param([string] $OperatingSystem)

    if ($OperatingSystem -eq 'win') {
        $localAppData = $env:LOCALAPPDATA
        if ([string]::IsNullOrWhiteSpace($localAppData)) {
            $localAppData = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
        }
        if ([string]::IsNullOrWhiteSpace($localAppData)) {
            throw 'LOCALAPPDATA is required to install the telemetry reporter on Windows.'
        }
        return Join-Path $localAppData 'GitHubCopilotForAzure\telemetry'
    }

    if (-not [string]::IsNullOrWhiteSpace($env:XDG_CACHE_HOME)) {
        return Join-Path $env:XDG_CACHE_HOME 'github-copilot-for-azure/telemetry'
    }
    if ([string]::IsNullOrWhiteSpace($env:HOME)) {
        throw 'HOME or XDG_CACHE_HOME is required to install the telemetry reporter.'
    }
    return Join-Path $env:HOME '.cache/github-copilot-for-azure/telemetry'
}

if ([string]::IsNullOrWhiteSpace($Version)) {
    Write-InstallerError 'The -Version parameter is required.'
    exit 2
}
if ($Version -notmatch '^[0-9A-Za-z][0-9A-Za-z.+-]*$') {
    Write-InstallerError "Invalid telemetry reporter version: $Version"
    exit 2
}

$temporaryDirectory = $null
$stagedBinary = $null

try {
    $target = Get-TelemetryTarget
    $cacheRoot = Get-TelemetryCacheRoot -OperatingSystem $target.OperatingSystem
    $installDirectory = Join-Path (Join-Path $cacheRoot $Version) $target.RuntimeIdentifier
    $binaryPath = Join-Path $installDirectory $target.BinaryName

    if (Test-Path -LiteralPath $binaryPath -PathType Leaf) {
        Write-Output $binaryPath
        exit 0
    }

    $temporaryDirectory = Join-Path `
        ([System.IO.Path]::GetTempPath()) `
        "${toolName}-$([guid]::NewGuid().ToString('N'))"
    $extractDirectory = Join-Path $temporaryDirectory 'extracted'
    $assetName = "${toolName}-$Version-$($target.RuntimeIdentifier).zip"
    $archivePath = Join-Path $temporaryDirectory $assetName

    New-Item -ItemType Directory -Path $extractDirectory -Force -ErrorAction Stop | Out-Null

    if (-not [string]::IsNullOrWhiteSpace($env:AZURE_SKILLS_TELEMETRY_ZIP_PATH)) {
        if (-not (Test-Path -LiteralPath $env:AZURE_SKILLS_TELEMETRY_ZIP_PATH -PathType Leaf)) {
            throw "Telemetry ZIP not found: $($env:AZURE_SKILLS_TELEMETRY_ZIP_PATH)"
        }
        Copy-Item `
            -LiteralPath $env:AZURE_SKILLS_TELEMETRY_ZIP_PATH `
            -Destination $archivePath `
            -ErrorAction Stop
    }
    else {
        $downloadUrl = "https://github.com/microsoft/GitHub-Copilot-for-Azure/releases/download/${toolName}-$Version/$assetName"
        Invoke-WebRequest `
            -Uri $downloadUrl `
            -OutFile $archivePath `
            -UseBasicParsing `
            -ErrorAction Stop
    }

    Expand-Archive `
        -LiteralPath $archivePath `
        -DestinationPath $extractDirectory `
        -ErrorAction Stop

    $extractedBinaries = @(
        Get-ChildItem `
            -LiteralPath $extractDirectory `
            -Filter $target.BinaryName `
            -File `
            -Recurse `
            -ErrorAction Stop
    )
    if ($extractedBinaries.Count -eq 0) {
        throw "The telemetry ZIP does not contain $($target.BinaryName)."
    }
    if ($extractedBinaries.Count -gt 1) {
        throw "The telemetry ZIP contains multiple files named $($target.BinaryName)."
    }

    New-Item -ItemType Directory -Path $installDirectory -Force -ErrorAction Stop | Out-Null
    $stagedBinary = Join-Path `
        $installDirectory `
        ".$($target.BinaryName).$([guid]::NewGuid().ToString('N')).tmp"
    Copy-Item `
        -LiteralPath $extractedBinaries[0].FullName `
        -Destination $stagedBinary `
        -ErrorAction Stop

    if ($target.OperatingSystem -ne 'win') {
        & chmod 0755 $stagedBinary
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to make the telemetry executable runnable; chmod exited with $LASTEXITCODE."
        }
    }

    try {
        Move-Item -LiteralPath $stagedBinary -Destination $binaryPath -ErrorAction Stop
        $stagedBinary = $null
    }
    catch {
        if (-not (Test-Path -LiteralPath $binaryPath -PathType Leaf)) {
            throw
        }
    }

    Write-Output $binaryPath
    exit 0
}
catch {
    Write-InstallerError $_.Exception.Message
    exit 1
}
finally {
    if ($stagedBinary -and (Test-Path -LiteralPath $stagedBinary -PathType Leaf)) {
        Remove-Item -LiteralPath $stagedBinary -Force -ErrorAction SilentlyContinue
    }
    if ($temporaryDirectory -and (Test-Path -LiteralPath $temporaryDirectory -PathType Container)) {
        Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }
}
