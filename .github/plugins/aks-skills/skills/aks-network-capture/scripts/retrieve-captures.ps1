# Retrieve exact-run capture bundles from nodes and clean up capture resources.
# Exit codes: 0 = success/help, 1 = retrieval/cleanup failure, 2 = usage/argument error.
[CmdletBinding()]
param(
    [string]$Name,
    [string]$OutputPath = "/var/log/aks-network-captures",
    [string]$WorkspaceDir = $(if ($env:WORKSPACE_DIR) {
        $env:WORKSPACE_DIR
    } else {
        Join-Path "." "aks-network-captures"
    }),
    [string]$Namespace = "default",
    [string]$RunId,
    [switch]$Help
)

function Write-Usage {
    @"
Usage: retrieve-captures.ps1 -Name <capture-name> [options]

Options:
  -OutputPath <path>      Node hostPath base
  -WorkspaceDir <path>    Local workspace directory
  -Namespace <name>       Capture Job namespace (default: default)
  -RunId <id>             Exact run ID; required when multiple runs exist
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

function Test-RunId {
    param([string]$Value)
    return $Value -cmatch "^[0-9]{8}-[0-9]{6}-[0-9a-f]{24}$"
}

function Invoke-KubectlChecked {
    param([string[]]$KubectlArguments, [string]$FailureMessage)
    $output = (& kubectl @KubectlArguments 2>&1) -join "`n"
    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage`n$output"
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
if ($OutputPath -notmatch "^/[A-Za-z0-9/_.-]+$" -or $OutputPath.Contains("..")) {
    Stop-Usage "-OutputPath must be absolute and contain only letters, digits, '/', '_', '.', or '-'"
}
if ([string]::IsNullOrWhiteSpace($WorkspaceDir) -or $WorkspaceDir -match "[`r`n]") {
    Stop-Usage "-WorkspaceDir must be a non-empty single-line path"
}
if ($RunId -and -not (Test-RunId $RunId)) {
    Stop-Usage "-RunId has an invalid format"
}
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
    Stop-Failure "kubectl is not installed or not on PATH"
}

try {
    if (-not $RunId) {
        $runsOutput = Invoke-KubectlChecked -KubectlArguments @(
            "get", "jobs", "-n", $Namespace, "-l", "capture-id=$Name",
            "-o", 'jsonpath={range .items[*]}{.metadata.labels.capture-run}{"\n"}{end}'
        ) -FailureMessage "could not list capture runs"
        $runs = @($runsOutput -split "`n" |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ } |
            Sort-Object -Unique)
        if ($runs.Count -eq 0) {
            throw "no capture runs found for '$Name'"
        }
        if ($runs.Count -gt 1) {
            throw "multiple capture runs found; specify -RunId"
        }
        $RunId = $runs[0]
    }
    if (-not (Test-RunId $RunId)) {
        throw "Kubernetes returned an invalid capture run identity"
    }

    $jobsOutput = Invoke-KubectlChecked -KubectlArguments @(
        "get", "jobs", "-n", $Namespace,
        "-l", "capture-id=$Name,capture-run=$RunId",
        "-o", "jsonpath={.items[*].metadata.name}"
    ) -FailureMessage "could not list capture Jobs"
    $captureJobs = @($jobsOutput -split "\s+" | Where-Object { $_ })
    if ($captureJobs.Count -eq 0) {
        throw "no Jobs found for the requested capture run"
    }
} catch {
    Stop-Failure $_.Exception.Message
}

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
$captureOutputDir = Join-Path (Join-Path $WorkspaceDir "network-captures") "$Name-$RunId-$timestamp"
try {
    New-Item -ItemType Directory -Path $captureOutputDir -Force -ErrorAction Stop | Out-Null
} catch {
    Stop-Failure "could not create the local capture directory: $($_.Exception.Message)"
}

$tempPods = New-Object System.Collections.Generic.List[string]
$operationError = $null
$cleanupErrors = New-Object System.Collections.Generic.List[string]

try {
    foreach ($job in $captureJobs) {
        $nodeName = Invoke-KubectlChecked -KubectlArguments @(
            "get", "job", $job, "-n", $Namespace,
            "-o", "jsonpath={.spec.template.spec.nodeName}"
        ) -FailureMessage "could not read the node for Job '$job'"
        $jobRunId = Invoke-KubectlChecked -KubectlArguments @(
            "get", "job", $job, "-n", $Namespace,
            "-o", 'jsonpath={.spec.template.spec.containers[0].env[?(@.name=="RUN_ID")].value}'
        ) -FailureMessage "could not read the run identity for Job '$job'"
        if (-not (Test-DnsSubdomain $nodeName)) {
            throw "Job '$job' returned an invalid node name"
        }
        if (-not (Test-RunId $jobRunId) -or $jobRunId -ne $RunId) {
            throw "Job '$job' does not match the requested run"
        }

        $podName = Invoke-KubectlChecked -KubectlArguments @(
            "get", "pods", "-n", $Namespace, "-l", "job-name=$job",
            "-o", "jsonpath={.items[0].metadata.name}"
        ) -FailureMessage "could not find the capture pod for Job '$job'"
        if ([string]::IsNullOrWhiteSpace($podName)) {
            throw "no capture pod found for Job '$job'"
        }
        $podStatus = Invoke-KubectlChecked -KubectlArguments @(
            "get", "pod", $podName, "-n", $Namespace,
            "-o", "jsonpath={.status.phase}"
        ) -FailureMessage "could not read capture pod status"
        if ($podStatus -ne "Succeeded") {
            throw "capture pod '$podName' did not succeed; inspect its logs before retrying"
        }

        $captureSlug = $Name.Substring(0, [Math]::Min(20, $Name.Length))
        $normalizedNode = $nodeName -replace "[._]", "-"
        $nodeSlug = $normalizedNode.Substring(0, [Math]::Min(20, $normalizedNode.Length))
        $retrievalYaml = @"
apiVersion: v1
kind: Pod
metadata:
  generateName: retrieve-$captureSlug-$nodeSlug-
  namespace: $Namespace
  labels: { app: aks-network-capture, capture-id: "$Name", role: retrieval }
spec:
  hostNetwork: true
  nodeName: "$nodeName"
  restartPolicy: Never
  containers:
  - name: retrieve
    image: mcr.microsoft.com/cbl-mariner/busybox:2.0@sha256:e4fb4d51fc9b70d6cdc1ce66a0af02ab40554d2ca632e1d188fabc760e432fdd
    command: ["sh", "-c", "sleep 300"]
    volumeMounts:
    - name: capture-output
      mountPath: /capture-root
  volumes:
  - name: capture-output
    hostPath:
      path: $OutputPath/$Name
      type: Directory
"@
        $tempPodName = ($retrievalYaml |
            & kubectl create -f - -o "jsonpath={.metadata.name}" 2>&1) -join "`n"
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($tempPodName)) {
            throw "failed to create a retrieval pod on '$nodeName': $tempPodName"
        }
        $tempPodName = $tempPodName.Trim()
        $tempPods.Add($tempPodName)

        & kubectl wait -n $Namespace --for=condition=Ready `
            "pod/$tempPodName" --timeout=60s
        if ($LASTEXITCODE -ne 0) {
            throw "retrieval pod '$tempPodName' did not become ready"
        }

        $bundleName = "capture-$Name-$nodeName-$jobRunId.tar.gz"
        $runDir = "/capture-root/$jobRunId"
        $localBundle = Join-Path $captureOutputDir $bundleName
        & kubectl cp -n $Namespace "${tempPodName}:${runDir}/${bundleName}" `
            $localBundle -c retrieve
        if ($LASTEXITCODE -ne 0) {
            throw "failed to copy '$bundleName' from node '$nodeName'"
        }
        if (-not (Test-Path -LiteralPath $localBundle -PathType Leaf) -or
            (Get-Item -LiteralPath $localBundle).Length -eq 0) {
            throw "the copied capture bundle '$bundleName' is empty"
        }

        & kubectl exec -n $Namespace $tempPodName -c retrieve -- sh -c `
            'rm -f "$1/$2" "$1/$3" && rmdir "$1"' sh `
            $runDir $bundleName "capture-$Name-$nodeName-$jobRunId.pcap"
        if ($LASTEXITCODE -ne 0) {
            throw "failed to remove the retrieved node artifacts"
        }
        & kubectl delete pod $tempPodName -n $Namespace --ignore-not-found
        if ($LASTEXITCODE -ne 0) {
            throw "failed to delete retrieval pod '$tempPodName'"
        }
    }
} catch {
    $operationError = $_.Exception.Message
} finally {
    foreach ($tempPod in $tempPods) {
        & kubectl delete pod $tempPod -n $Namespace --ignore-not-found 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            $cleanupErrors.Add("failed to delete retrieval pod '$tempPod'")
        }
    }
    & kubectl delete jobs -n $Namespace @($captureJobs) --ignore-not-found 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $cleanupErrors.Add("failed to delete capture Jobs")
    }
}

if ($operationError) {
    if ($cleanupErrors.Count -gt 0) {
        Stop-Failure "$operationError; cleanup also failed: $($cleanupErrors -join '; ')"
    }
    Stop-Failure $operationError
}
if ($cleanupErrors.Count -gt 0) {
    Stop-Failure ($cleanupErrors -join "; ")
}

Write-Output "Capture bundles saved to: $captureOutputDir"
Get-ChildItem -LiteralPath $captureOutputDir
