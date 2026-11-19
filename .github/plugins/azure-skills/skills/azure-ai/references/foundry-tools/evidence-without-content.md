# Evidence for Document Intelligence and Content Understanding without sharing content

Use when a team cannot share documents, analyze JSON, screenshots or raw
browser traces, but needs to show a teammate or support what failed. The goal
is facts that identify a request without revealing what was in it.

## Collect per failing request

| Item | Where it comes from |
|---|---|
| UTC time, resource region, API version | Your app log or the request URL (`api-version`) |
| Operation | analyze, analyzeBinary, GET result, build/train, analyzer create, defaults |
| HTTP status and error codes | Response body `error.code` and nested `innererror.code`, `x-ms-error-code` header; not the message text |
| Result ID | The last path segment of the `Operation-Location` response header (DI `analyzeResults/{resultId}`, CU `analyzerResults/{resultId}`) |
| Client request ID | `x-ms-client-request-id` that your client sets; send one per request so both sides can correlate |
| Service request ID | Response request-ID headers when present (for example `apim-request-id`); Learn does not document them for DI/CU, so treat absence as normal |
| Model or analyzer ID | Prebuilt IDs as-is; custom IDs only if they are not sensitive |
| What changed | Model or analyzer version, API version, SDK version, network or role changes, with dates |

Never include keys, tokens, SAS query strings, document text, field values,
file names that identify people, or full resource IDs when the audience does
not need them.

## Browser traces (Studio and Foundry portal)

A raw HAR file can contain cookies, bearer tokens, keys, SAS URLs, uploaded
document bytes and extracted results. Instead of sharing it:

1. Reproduce once with the browser developer tools Network tab open
   ("Preserve log" on), then export the HAR to a local folder.
2. Summarize it with the [HAR summarizer](../../scripts/sanitize-har.mjs)
   ([Bash](../../scripts/sanitize-har.sh) / [PowerShell](../../scripts/sanitize-har.ps1)):

   ```bash
   node "<skill-directory>/scripts/sanitize-har.mjs" --har "<trace.har>"
   ```

   ```powershell
   & node "<skill-directory>\scripts\sanitize-har.mjs" --har "<trace.har>"
   ```

   Launcher exit codes are `0` report/help, `1` file/read/JSON error, `2`
   usage error and `3` Node.js 22+ unavailable. The sanitizer accepts UTF-8,
   UTF-8-with-BOM and UTF-16 PowerShell 5.1 exports.

   It keeps method, host class with resource names masked, templated path,
   API version, status, timing, correlation IDs and JSON error codes. It drops
   bodies, cookies, auth and key headers, query strings, IP addresses and error
   messages. Status `0` entries usually mean the browser blocked the call (CORS,
   DNS, proxy); compare with the console tab.
3. Review the summary, share it, and delete the raw HAR.

Without Node.js, do not share the HAR; copy the status, `error.code` and the
request-ID headers of the failing rows by hand ([manual checks](without-node.md)).

## Separate document, model and service causes

- Same file, two models (or two API versions): if the layout text is identical
  but extracted fields differ, the difference is in the model or its training
  data, not in the file or OCR. Compare field presence and confidence only.
- Same model, two files: isolates input format, scan quality or layout variation.
- Same request, two networks or identities: isolates network rules and roles.

Azure Monitor diagnostic settings on the resource capture request metadata
from the moment they are enabled; they do not cover earlier requests. Query
them with `monitor_resource_log_query` or `az monitor log-analytics query`.

Sources (retrieved 2026-11-18): [DI analyze operation and result ID](https://learn.microsoft.com/rest/api/aiservices/document-models/analyze-document?view=rest-aiservices-v4.0%20%282024-11-30%29) ·
[CU analyze and results](https://learn.microsoft.com/rest/api/contentunderstanding/content-analyzers/analyze-binary?view=rest-contentunderstanding-2025-11-01) ·
[Diagnostic logging for Foundry Tools](https://learn.microsoft.com/azure/ai-services/diagnostic-logging)
