# Launch the local Speech SDK log analyzer (requires Node.js 22 or later).
# Exit codes: 0 = analysis written to stdout or --help, 1 = file/read/size error,
# 2 = usage/argument error, 3 = Node.js 22+ missing or too old (nothing is run or installed).
$nodeHelp = 'Install Node.js 22 or later (Windows: winget install --id OpenJS.NodeJS.LTS -e; macOS: brew install node), or use references/speech/without-node.md in this skill. Nothing was run, changed or installed.'
$node = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $node) {
    [Console]::Error.WriteLine('{"error":"NODE_REQUIRED","help":"Node.js 22 or later is required to run the Speech SDK log analyzer but was not found on PATH. ' + $nodeHelp + '"}')
    exit 3
}
$version = "$(& $node.Source --version 2>$null)".Trim()
$supported = ($LASTEXITCODE -eq 0) -and ($version -match '^v(\d+)\.[\d.]+$') -and ([int]$Matches[1] -ge 22)
if (-not $supported) {
    $found = if ($version -match '^v\d+\.[\d.]+$') { $version } else { 'an unrecognized version' }
    [Console]::Error.WriteLine('{"error":"NODE_VERSION_UNSUPPORTED","help":"Node.js 22 or later is required to run the Speech SDK log analyzer; found ' + $found + '. ' + $nodeHelp + '"}')
    exit 3
}

& $node.Source (Join-Path $PSScriptRoot 'analyze-speech-sdk-log.mjs') @args
if ($null -ne $LASTEXITCODE) {
    exit $LASTEXITCODE
}
exit 1
