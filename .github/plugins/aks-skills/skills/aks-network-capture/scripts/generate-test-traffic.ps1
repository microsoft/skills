# Generate bounded test traffic from a pod network namespace.
# Exit codes: 0 = success/help, 1 = execution failure, 2 = usage/argument error.
[CmdletBinding()]
param(
    [string]$SourcePod,
    [string]$Target,
    [string]$Type = "http",
    [string]$TargetPort,
    [string]$SourceNamespace = "default",
    [string]$Duration = "30s",
    [string]$Interval = "1",
    [switch]$AllowDebugContainer,
    [switch]$Help
)

$DebugImage = "mcr.microsoft.com/cbl-mariner/busybox:2.0@sha256:e4fb4d51fc9b70d6cdc1ce66a0af02ab40554d2ca632e1d188fabc760e432fdd"

function Write-Usage {
    @"
Usage: generate-test-traffic.ps1 -SourcePod <pod> -Target <host> [options]

Options:
  -Type <type>            http, https, dns, tcp, or ping (default: http)
  -TargetPort <1-65535>   Target port; required for tcp
  -SourceNamespace <ns>   Source namespace (default: default)
  -Duration <Ns|Nm|Nh>    Duration (default: 30s; maximum: 1h)
  -Interval <seconds>     Whole seconds between attempts (default: 1)
  -AllowDebugContainer    Use an ephemeral debug container after separate approval
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

function Test-DnsSubdomain {
    param([string]$Value)
    return $Value.Length -le 253 -and
        $Value -cmatch "^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$"
}

if ($Help) {
    Write-Usage
    exit 0
}
if ([string]::IsNullOrWhiteSpace($SourcePod)) {
    Stop-Usage "-SourcePod is required"
}
if ([string]::IsNullOrWhiteSpace($Target)) {
    Stop-Usage "-Target is required"
}
if (-not (Test-DnsSubdomain $SourcePod)) {
    Stop-Usage "-SourcePod must be a DNS subdomain"
}
if (-not (Test-DnsSubdomain $SourceNamespace)) {
    Stop-Usage "-SourceNamespace must be a DNS subdomain"
}
if ($Target.Length -gt 253 -or $Target -notmatch "^[A-Za-z0-9._:-]+$") {
    Stop-Usage "-Target has invalid characters"
}
if ($Duration -cnotmatch "^([0-9]+)([smh])$") {
    Stop-Usage "-Duration must look like 30s, 5m, or 1h"
}
$durationNumber = [int64]$Matches[1]
$durationSeconds = switch ($Matches[2]) {
    "s" { $durationNumber }
    "m" { $durationNumber * 60 }
    "h" { $durationNumber * 3600 }
}
if ($durationSeconds -lt 1 -or $durationSeconds -gt 3600) {
    Stop-Usage "-Duration must be between 1s and 1h"
}
if ($Interval -notmatch "^[0-9]+$") {
    Stop-Usage "-Interval must be a non-negative integer"
}

switch -CaseSensitive ($Type) {
    "dns" { if (-not $TargetPort) { $TargetPort = "53" } }
    "https" { if (-not $TargetPort) { $TargetPort = "443" } }
    "http" { if (-not $TargetPort) { $TargetPort = "80" } }
    "tcp" { if (-not $TargetPort) { Stop-Usage "-TargetPort is required for tcp" } }
    "ping" { $TargetPort = "0" }
    default { Stop-Usage "-Type must be one of: http https dns tcp ping" }
}
if ($TargetPort -notmatch "^[0-9]+$") {
    Stop-Usage "-TargetPort must be an integer"
}
$targetPortValue = [int64]$TargetPort
if ($Type -ne "ping" -and ($targetPortValue -lt 1 -or $targetPortValue -gt 65535)) {
    Stop-Usage "-TargetPort must be between 1 and 65535"
}
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
    Stop-Failure "kubectl is not installed or not on PATH"
}

$PodScript = @'
set -u
target="$1"; port="$2"; duration="$3"; interval="$4"; traffic_type="$5"
case "$target" in *:*) url_host="[$target]";; *) url_host="$target";; esac
end=$(( $(date +%s) + duration ))
while [ "$(date +%s)" -lt "$end" ]; do
  case "$traffic_type" in
    http)  wget -q -O /dev/null -T 5 "http://$url_host:$port/" && echo "http ok" || echo "http fail" ;;
    https) wget -q -O /dev/null -T 5 --no-check-certificate "https://$url_host:$port/" && echo "https ok" || echo "https fail" ;;
    dns)   nslookup "$target" >/dev/null 2>&1 && echo "dns ok" || echo "dns fail" ;;
    tcp)   nc -z -w 5 "$target" "$port" && echo "tcp ok" || echo "tcp fail" ;;
    ping)  ping -c 1 -W 5 "$target" >/dev/null 2>&1 && echo "ping ok" || echo "ping fail" ;;
  esac
  [ "$interval" -eq 0 ] || sleep "$interval"
done
'@

Write-Output "Generating $Type traffic from $SourcePod to $Target for ${durationSeconds}s"
& kubectl exec -n $SourceNamespace $SourcePod -- sh -c "exit 0" 2>$null
$directExecAvailable = $LASTEXITCODE -eq 0

if ($directExecAvailable) {
    & kubectl exec -n $SourceNamespace $SourcePod -- sh -c $PodScript _ `
        $Target $targetPortValue $durationSeconds $Interval $Type
    if ($LASTEXITCODE -ne 0) {
        Stop-Failure "traffic generation failed in the source pod"
    }
} else {
    if (-not $AllowDebugContainer) {
        Stop-Failure "direct pod exec is unavailable; obtain separate approval before retrying with -AllowDebugContainer"
    }
    $targetContainer = (& kubectl get pod -n $SourceNamespace $SourcePod `
        -o 'jsonpath={.spec.containers[0].name}' 2>&1) -join "`n"
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($targetContainer)) {
        Stop-Failure "could not resolve the source pod container: $targetContainer"
    }
    & kubectl debug -n $SourceNamespace $SourcePod --image=$DebugImage `
        --target=$($targetContainer.Trim()) -q -- sh -c $PodScript _ `
        $Target $targetPortValue $durationSeconds $Interval $Type
    if ($LASTEXITCODE -ne 0) {
        Stop-Failure "traffic generation failed in the ephemeral debug container"
    }
}

Write-Output "Traffic generation complete"
