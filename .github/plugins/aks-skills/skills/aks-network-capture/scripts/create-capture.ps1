# Create bounded packet-capture Jobs on selected AKS nodes.
# Exit codes: 0 = success/help, 1 = execution failure, 2 = usage/argument error.
[CmdletBinding()]
param(
    [string]$Name,
    [string]$Duration = "60s",
    [string]$NodeSelector = "kubernetes.io/os=linux",
    [string]$NodeNames,
    [string]$PodSelector,
    [string]$PodNames,
    [string]$Namespace = "default",
    [string]$TcpdumpFilter = "",
    [string]$PacketSize = "0",
    [switch]$Help
)

$CaptureImage = "mcr.microsoft.com/containernetworking/retina-shell:v1.2.3@sha256:c7dfe8e0c0dc7fa28e4cfbad04ade270c3051c42a5495488d4d897b49fb3366f"
$ConfigMapName = "network-capture-scripts"
$OutputBase = "/var/log/aks-network-captures"
$CaptureMountPath = "/capture-output"
$MaxDurationSeconds = 1800

function Write-Usage {
    @"
Usage: create-capture.ps1 -Name <capture-name> [options]

Target options:
  -NodeSelector <key=val>  Node selector (default: kubernetes.io/os=linux)
  -NodeNames <n1,n2>       Comma-separated node names
  -PodSelector <key=val>   Pod selector; resolves pods to nodes and IPs
  -PodNames <p1,p2>        Comma-separated pod names
  -Namespace <name>        Pod, ConfigMap, and Job namespace

Capture options:
  -Duration <Ns|Nm|Nh>     Duration (default: 60s; maximum: 1800s)
  -PacketSize <bytes>      Snapshot length (default: 0, full packet)
  -TcpdumpFilter <expr>    Plain BPF expression; no flags or metacharacters
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

function Test-Rfc1123Label {
    param([string]$Value)
    return $Value.Length -le 63 -and
        $Value -cmatch "^[a-z0-9]([-a-z0-9]*[a-z0-9])?$"
}

function Test-DnsSubdomain {
    param([string]$Value)
    return $Value.Length -le 253 -and
        $Value -cmatch "^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$"
}

function Invoke-KubectlText {
    param([string[]]$KubectlArguments, [string]$FailureMessage)
    $output = (& kubectl @KubectlArguments 2>&1) -join "`n"
    if ($LASTEXITCODE -ne 0) {
        Stop-Failure "$FailureMessage`n$output"
    }
    return $output.Trim()
}

if ($Help) {
    Write-Usage
    exit 0
}
if ([string]::IsNullOrWhiteSpace($Name)) {
    Stop-Usage "-Name is required"
}
if (-not (Test-Rfc1123Label $Name)) {
    Stop-Usage "-Name must be an RFC 1123 label"
}
if (-not (Test-Rfc1123Label $Namespace)) {
    Stop-Usage "-Namespace must be an RFC 1123 label"
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
if ($durationSeconds -lt 1 -or $durationSeconds -gt $MaxDurationSeconds) {
    Stop-Usage "-Duration must be between 1s and ${MaxDurationSeconds}s"
}
if ($PacketSize -notmatch "^[0-9]+$") {
    Stop-Usage "-PacketSize must be a non-negative integer"
}
$packetSizeValue = [int64]$PacketSize
if ($packetSizeValue -gt 262144) {
    Stop-Usage "-PacketSize exceeds 262144 bytes"
}
if ($NodeSelector -notmatch "^[A-Za-z0-9._/=,!()-]+$") {
    Stop-Usage "-NodeSelector has invalid characters"
}
if ($PodSelector -and $PodSelector -notmatch "^[A-Za-z0-9._/=,!()-]+$") {
    Stop-Usage "-PodSelector has invalid characters"
}
if ($TcpdumpFilter.Length -gt 1024 -or $TcpdumpFilter -match "[`r`n]") {
    Stop-Usage "-TcpdumpFilter must be one line and no more than 1024 characters"
}
if ($TcpdumpFilter -and $TcpdumpFilter -notmatch "^[A-Za-z0-9 ._:/()&|<>=!-]+$") {
    Stop-Usage "-TcpdumpFilter contains disallowed characters"
}
foreach ($token in ($TcpdumpFilter -split "\s+")) {
    if ($token.StartsWith("-")) {
        Stop-Usage "-TcpdumpFilter may not contain flag tokens"
    }
}

$selectionCount = 0
foreach ($selection in @($NodeNames, $PodSelector, $PodNames)) {
    if (-not [string]::IsNullOrWhiteSpace($selection)) {
        $selectionCount++
    }
}
if ($selectionCount -gt 1) {
    Stop-Usage "choose only one of -NodeNames, -PodSelector, or -PodNames"
}
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
    Stop-Failure "kubectl is not installed or not on PATH"
}

$deployedRunner = Invoke-KubectlText -KubectlArguments @(
    "get", "configmap", $ConfigMapName, "-n", $Namespace,
    "-o", "go-template={{ index .data `"run-capture.sh`" }}"
) -FailureMessage "ConfigMap '$ConfigMapName' was not found; run setup-capture-configmap first"
$runnerPath = Join-Path $PSScriptRoot "run-capture.sh"
try {
    $localRunner = Get-Content -LiteralPath $runnerPath -Raw -ErrorAction Stop
} catch {
    Stop-Failure "could not read the local capture runner: $($_.Exception.Message)"
}
if ($deployedRunner.TrimEnd("`r", "`n") -ne $localRunner.TrimEnd("`r", "`n")) {
    Stop-Failure "ConfigMap '$ConfigMapName' is stale; run setup-capture-configmap again"
}

$targetNodes = New-Object System.Collections.Generic.List[string]
$podIpTerms = New-Object System.Collections.Generic.List[string]
$podJsonPath = '{range .items[*]}{.metadata.name}{"|"}{.spec.nodeName}{"|"}{range .status.podIPs[*]}{.ip}{","}{end}{"\n"}{end}'

if ($PodNames -or $PodSelector) {
    if ($PodNames) {
        $pods = @($PodNames.Split(","))
        foreach ($pod in $pods) {
            if (-not (Test-Rfc1123Label $pod)) {
                Stop-Usage "pod name '$pod' is not an RFC 1123 label"
            }
        }
        $podOutput = Invoke-KubectlText -KubectlArguments (@(
            "get", "pods", "-n", $Namespace
        ) + $pods + @("-o", "jsonpath=$podJsonPath")) -FailureMessage "could not resolve the selected pods"
    } else {
        $podOutput = Invoke-KubectlText -KubectlArguments @(
            "get", "pods", "-n", $Namespace, "-l", $PodSelector,
            "-o", "jsonpath=$podJsonPath"
        ) -FailureMessage "could not resolve the pod selector"
    }

    foreach ($record in @($podOutput -split "`n")) {
        if ([string]::IsNullOrWhiteSpace($record)) {
            continue
        }
        $parts = $record.TrimEnd("`r").Split("|")
        if ($parts.Count -ne 3 -or [string]::IsNullOrWhiteSpace($parts[1])) {
            Stop-Failure "Kubernetes returned an invalid pod placement record"
        }
        $targetNodes.Add($parts[1])
        $ips = @($parts[2].Split(",") | Where-Object { $_ })
        if ($ips.Count -eq 0) {
            Stop-Failure "selected pod '$($parts[0])' has no assigned IP"
        }
        foreach ($ip in $ips) {
            if ($ip -notmatch "^[A-Fa-f0-9.:]+$") {
                Stop-Failure "selected pod '$($parts[0])' returned an invalid IP"
            }
            $podIpTerms.Add("host $ip")
        }
    }
} elseif ($NodeNames) {
    foreach ($node in $NodeNames.Split(",")) {
        $targetNodes.Add($node)
    }
} else {
    $nodeOutput = Invoke-KubectlText -KubectlArguments @(
        "get", "nodes", "-l", $NodeSelector,
        "-o", 'jsonpath={range .items[*]}{.metadata.name}{"\n"}{end}'
    ) -FailureMessage "could not resolve the node selector"
    foreach ($node in @($nodeOutput -split "`n")) {
        if (-not [string]::IsNullOrWhiteSpace($node)) {
            $targetNodes.Add($node.TrimEnd("`r"))
        }
    }
}
if ($targetNodes.Count -eq 0) {
    Stop-Failure "no nodes matched the selection"
}

$uniqueNodes = New-Object System.Collections.Generic.List[string]
foreach ($node in $targetNodes) {
    if (-not (Test-DnsSubdomain $node)) {
        Stop-Usage "node name '$node' is invalid"
    }
    if (-not $uniqueNodes.Contains($node)) {
        $uniqueNodes.Add($node)
    }
}

$effectiveFilter = $TcpdumpFilter
if ($podIpTerms.Count -gt 0) {
    $podFilter = "(" + ($podIpTerms -join " or ") + ")"
    $effectiveFilter = if ($effectiveFilter) {
        "($effectiveFilter) and $podFilter"
    } else {
        $podFilter
    }
}

$randomBytes = New-Object byte[] 12
$rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
try {
    $rng.GetBytes($randomBytes)
} finally {
    $rng.Dispose()
}
$runToken = -join ($randomBytes | ForEach-Object { $_.ToString("x2") })
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
$runId = "$timestamp-$runToken"
$captureOutputPath = "$OutputBase/$Name/$runId"
$createdJobs = New-Object System.Collections.Generic.List[string]

function Remove-PartialJobs {
    if ($createdJobs.Count -eq 0) {
        return $true
    }
    & kubectl delete jobs -n $Namespace @($createdJobs) --ignore-not-found | Out-Null
    return $LASTEXITCODE -eq 0
}

Write-Output "Creating capture '$Name' on $($uniqueNodes.Count) node(s)"
foreach ($node in $uniqueNodes) {
    $nodeSlug = (($node -replace "[._]", "-").Substring(0, [Math]::Min(40, $node.Length))).TrimEnd("-")
    $captureSlug = $Name.Substring(0, [Math]::Min(15, $Name.Length)).TrimEnd("-")
    $nodePrefix = $nodeSlug.Substring(0, [Math]::Min(8, $nodeSlug.Length)).TrimEnd("-")
    $jobPrefix = "$captureSlug-$nodePrefix-$runToken-"
    $jobYaml = @"
apiVersion: batch/v1
kind: Job
metadata:
  generateName: $jobPrefix
  namespace: $Namespace
  labels: { app: aks-network-capture, capture-id: "$Name", capture-node: "$nodeSlug", capture-run: "$runId" }
spec:
  ttlSecondsAfterFinished: 3600
  backoffLimit: 0
  template:
    metadata:
      labels: { app: aks-network-capture, capture-id: "$Name", capture-run: "$runId" }
    spec:
      hostNetwork: true
      nodeName: "$node"
      restartPolicy: Never
      terminationGracePeriodSeconds: $MaxDurationSeconds
      containers:
      - name: capture
        image: "$CaptureImage"
        securityContext:
          privileged: false
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsUser: 0
          capabilities:
            drop: ["ALL"]
            add: ["NET_ADMIN", "NET_RAW"]
        env:
        - { name: PCAP_FILTER, value: "$effectiveFilter" }
        - { name: CAPTURE_DURATION, value: "$durationSeconds" }
        - { name: PACKET_SIZE, value: "$packetSizeValue" }
        - { name: OUT_DIR, value: "$CaptureMountPath" }
        - { name: CAPTURE_ID, value: "$Name" }
        - { name: RUN_ID, value: "$runId" }
        - { name: NODE_NAME, valueFrom: { fieldRef: { fieldPath: spec.nodeName } } }
        command: ["/bin/sh", "/capture-scripts/run-capture.sh"]
        volumeMounts:
        - { name: capture-output, mountPath: "$CaptureMountPath" }
        - { name: capture-scripts, mountPath: /capture-scripts, readOnly: true }
      volumes:
      - name: capture-output
        hostPath: { path: "$captureOutputPath", type: DirectoryOrCreate }
      - name: capture-scripts
        configMap:
          name: $ConfigMapName
          defaultMode: 0555
"@
    $createdJobOutput = ($jobYaml | & kubectl create -f - -o 'jsonpath={.metadata.name}' 2>&1) -join "`n"
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($createdJobOutput)) {
        $cleanupSucceeded = Remove-PartialJobs
        if (-not $cleanupSucceeded) {
            Stop-Failure "failed to create a Job for '$node' and failed to remove partial Jobs"
        }
        Stop-Failure "failed to create a capture Job for '$node': $createdJobOutput"
    }
    $createdJobs.Add($createdJobOutput.Trim())
    Write-Output "Job created for node: $node ($($createdJobOutput.Trim()))"
}

Write-Output ""
Write-Output "Capture started."
Write-Output "Run ID: $runId"
Write-Output "Monitor: kubectl get jobs -n $Namespace -l capture-id=$Name -w"
Write-Output "Retrieve: ./scripts/retrieve-captures.ps1 -Name $Name -RunId $runId -Namespace $Namespace"
Write-Output "Bundles: $captureOutputPath"
