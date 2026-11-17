# HTTP contract

Use HTTPS, the plane's resolved `api-version` ([API version policy](api-version-policy.md)), `Authorization: Bearer`, JSON and a generated client request ID. Preserve service IDs and continuation URLs. Honor `Retry-After`; bound retries to idempotent 408/429/5xx. Unsafe writes require an idempotency/state check.

Construct Search requests with resolved `managementApiVersion` or `dataApiVersion`,
never a copied default. A documentation URL's `view=...` selects a reference
contract, not the task's request version; adapt and verify the selected contract.

Search data-plane `az rest` needs `--resource https://search.azure.com` for the
Search audience, not ARM. Binary uploads use `application/octet-stream` and a
privately acquired Search token, never `az rest --body`.

## User-agent attribution

Add `foundry-iq-skill-v{skillVersion}` to `User-Agent` for skill-executed Search requests, including troubleshooting, retries, polling and pagination. Resolve `skillVersion` from `metadata.version` in the [loaded skill](../SKILL.md).

Preserve the client's identity and append the token once, scoped to these requests.
Respect user or organization telemetry restrictions; never include private data or secrets.

Use [request_attribution.py](../scripts/request_attribution.py) (standard library).
Resolve `$skillRoot` from the loaded skill, not the current directory.
The helper takes no workflow, operation or graph context. Reuse its output
through retries, polling and pagination.

| Interface | How to apply the token |
|---|---|
| Azure CLI `az rest` | Add `"User-Agent=$skillUserAgent"` to `--headers`; CLI retains identity. Do not also use `AZURE_HTTP_USER_AGENT`. |
| SDK | Use its user-agent extension; retain `azsdk-*`. Multi-label output is not a size-limited application ID. |
| Direct HTTP/file upload | Append to existing `User-Agent`; preserve other headers. |
| MCP/managed client | Use documented attribution. If unavailable, report it; never invent arguments or switch clients for telemetry. |

Direct HTTP: use `--existing-user-agent`; replace stale skill labels, including
retired context labels. Preserve inherited test/live markers.
`--disabled` removes inherited skill labels; omit an empty result.
Do not tag generated customer application code or copy Search labels into agents.

If Python or metadata is unavailable, omit labels; continue approved work.
Never install a runtime or enable telemetry for this. Never add
device/session IDs, tenant/subscription/resource names, prompts, URLs, paths,
credentials or error text.

Never send extra requests for attribution.

Resolve `$dataApiVersion`; apply [Windows quoting](#windows-quoting) for `az.cmd`.

```powershell
$helper = Join-Path (Join-Path $skillRoot 'scripts') 'request_attribution.py'
try {
    $skillUserAgent = python $helper
    if ($LASTEXITCODE -ne 0) { $skillUserAgent = $null }
} catch {
    $skillUserAgent = $null
}
$requestHeaders = @("Content-Type=application/json", "x-ms-client-request-id=$([guid]::NewGuid())")
if ($skillUserAgent) { $requestHeaders += "User-Agent=$skillUserAgent" }
$url = "https://<search-service>.search.windows.net/indexes?api-version=$dataApiVersion"
az rest --method get --url $url --resource https://search.azure.com --headers @requestHeaders
```

## Windows quoting

Use the installed `az rest` directly; no separate Python launcher is required.
When `az` resolves to `az.cmd` or `az.bat`, preserve literal double quotes
around the validated URL: `--url ('"' + $url + '"')`. This keeps `&` and OData
parentheses as data. Reject raw double quotes/newlines; URI/OData-encode dynamic
values. This is not general escaping for untrusted input.

Use Windows PowerShell 5.1's normal argument passing, or PowerShell 7's
`Windows`/`Legacy` mode; if PowerShell 7 was explicitly set to `Standard`,
restore `$PSNativeCommandArgumentPassing = 'Windows'` for the request.
Do not add literal quotes for native `az` or on Linux.
Do not add `--%`: it stops variables and `$()` from expanding.

Malformed quoting/headers are not expired sign-in. Keep each header one
`Name=Value` argument. For quoted ETags/metacharacters, use
`--headers '@headers.json'` with an approved JSON object; never put credentials in that file.
Use `--body '@request.json'` for JSON; quote file arguments containing spaces.
Never print tokens, private payloads/responses or `--debug`. Parse captured JSON
for ETags/continuations, and use documented OData paths, including slash-style
paths where supported. Clean up owned payload/header files per the
[retention and cleanup contract](safety-and-idempotency.md#scenario-cleanup).

## Discovery and pagination

PowerShell selection without `$select`; versions and endpoint come from task
context. Apply Windows quoting above when invoking `az.cmd`.

```powershell
$helper = Join-Path (Join-Path $skillRoot 'scripts') 'request_attribution.py'
try {
    $skillUserAgent = python $helper
    if ($LASTEXITCODE -ne 0) { $skillUserAgent = $null }
} catch {
    $skillUserAgent = $null
}
$endpoint = "https://<search-service>.search.windows.net"
$next = "$endpoint/knowledgesources?api-version=$dataApiVersion"
while ($next) {
    if (([uri]$next).Scheme -ne 'https' -or ([uri]$next).Authority -ne ([uri]$endpoint).Authority) {
        throw 'Unverified continuation origin.'
    }
    $requestHeaders = @("Content-Type=application/json", "x-ms-client-request-id=$([guid]::NewGuid())")
    if ($skillUserAgent) { $requestHeaders += "User-Agent=$skillUserAgent" }
    $url = $next
    $json = az rest --method get --url $url --resource https://search.azure.com --headers @requestHeaders
    if ($LASTEXITCODE -ne 0) { throw 'Discovery failed; inspect the redacted error before retrying.' }
    $page = $json | ConvertFrom-Json
    $page.value | Select-Object name, kind, @{Name='etag'; Expression={$_.'@odata.etag'}}
    $next = $page.'@odata.nextLink'
}
```

Follow continuations unchanged, including their version and escaping.
For `$select`, use a literal single-quoted fragment plus the resolved version;
never let PowerShell expand `$select`.

Bash uses task context, not leftover shells. Azure CLI generates
`x-ms-client-request-id` automatically; no Python UUID step is needed.

```bash
skillUserAgent="$(python "${skillRoot}/scripts/request_attribution.py")" || skillUserAgent=""
requestHeaders=("Content-Type=application/json")
if [ -n "$skillUserAgent" ]; then requestHeaders+=("User-Agent=${skillUserAgent}"); fi
az rest --method get \
  --url "${endpoint}/indexes?api-version=${dataApiVersion}" \
  --resource https://search.azure.com --headers "${requestHeaders[@]}"
```
