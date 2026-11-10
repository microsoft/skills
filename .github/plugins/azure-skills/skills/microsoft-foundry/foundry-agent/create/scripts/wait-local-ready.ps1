<#
.SYNOPSIS
    Waits for the local agent port to accept TCP connections.
.DESCRIPTION
    Polls every 2 seconds for up to 5 minutes.
    Exit codes: 0 = ready, 1 = timeout, 2 = invalid arguments.
.EXAMPLE
    ./wait-local-ready.ps1 -Port 8088
#>

param(
    [string]$Port
)

if ($args.Count -ne 0 -or $Port -notmatch '^[0-9]{1,5}$' -or [int]$Port -lt 1 -or [int]$Port -gt 65535) {
    Write-Error "Usage: ./wait-local-ready.ps1 -Port <1-65535>" -ErrorAction Continue
    exit 2
}

$portNumber = [int]$Port
$elapsed = [System.Diagnostics.Stopwatch]::StartNew()

while ($elapsed.Elapsed.TotalSeconds -lt 300) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $connection = $client.ConnectAsync("127.0.0.1", $portNumber)
        if ($connection.Wait(1000) -and $client.Connected) {
            Write-Output "[READY] localhost:$portNumber accepts TCP connections. Keep the server running and proceed to the local smoke invocation."
            exit 0
        }
    } catch [System.AggregateException] {
        # A refused connection means the agent is still starting.
    } finally {
        $client.Dispose()
    }

    Start-Sleep -Seconds 2
}

Write-Error "[ERROR] localhost:$portNumber did not become ready within 300 seconds. Inspect the server logs and resolve the cause before retrying." -ErrorAction Continue
exit 1
