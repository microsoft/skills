# Document Intelligence input preflight and diagnostics

For Azure AI Document Intelligence (`v4.0`, API `2024-11-30` GA) local input/label
preflight, v3-to-v4 migration errors, source Blob access and async
`Operation-Location` polling. Do not use for Microsoft Foundry agent creation,
model deployments or Foundry IQ knowledge bases (`microsoft-foundry` / `foundry-iq`).

## Workflow

1. Reuse supplied tier (`F0` or `S0`), model ID (`prebuilt-read`,
   `prebuilt-layout`, domain prebuilts or custom), API version, route and HTTP
   status/`apim-request-id`. Never ask for keys/SAS tokens or paste document
   text/field values into chat.
2. Check `node --version` (needs Node.js 22+). If missing/older, do not install
   unasked; use [analysis without Node](without-node.md). Otherwise run the
   [local inspector](../../scripts/inspect-document-input.mjs) from `<skill-directory>`:

   ```bash
   node "<skill-directory>/scripts/inspect-document-input.mjs" --file "<local-doc>" --tier S0 --model-kind layout
   ```

   ```powershell
   & node "<skill-directory>\scripts\inspect-document-input.mjs" --file "<local-doc>" --tier S0 --model-kind layout
   ```

   Add `--labels "<file.labels.json>"` (`--ocr "<file.ocr.json>"`) for custom
   training checks. [Bash](../../scripts/inspect-document-input.sh) and
   [PowerShell](../../scripts/inspect-document-input.ps1) launchers forward flags
   (`0` report/`--help`, `1` file/JSON error, `2` usage error, `3` Node 22+ missing).
3. Check contract alignment (`2024-11-30`):

| Symptom | Public contract check |
|---|---|
| `404 Resource Not Found` | v4 uses `/documentintelligence/documentModels/{modelId}:analyze?api-version=2024-11-30`; v3 uses `/formrecognizer/documentModels/...` (`2023-07-31`). Confirm custom `modelId` exists in the same resource/region. |
| `InvalidContent` / `InvalidContentDimensions` / `InvalidContentLength` / `UnsupportedContent` | Check `detectedFormat` vs extension (e.g. HTML error saved as `.pdf`), encryption, image dimensions (`50x50`–`10000x10000` px) and size (`F0` 4 MB, `S0` 500 MB). |
| Office (`DOCX`/`PPTX`/`XLSX`) or `HTML` rejected | Listed for `prebuilt-read` and `prebuilt-layout`, not domain prebuilts or custom extraction. Learn pages disagree for custom classification (`--model-kind classifier` warns). Office/HTML results have no bounding polygons or `lines`. |
| Only 2 pages returned | `F0` processes only the first 2 pages; up to 2,000 pages can be processed (`pages` selects a range). |
| `ContentSourceNotAccessible` / `InvalidSasToken` (`urlSource`) | Verify SAS expiry and read permission without logging secrets, or the managed identity's storage role and firewall settings. |
| `429 Too Many Requests` | Separate POST Analyze (`S0` `15 TPS`, `F0` `1 TPS`) from GET polling (`S0` `50 TPS`); honor `retry-after`. |
| Custom training data | Learn limits: template `50 MB`/`500` pages, neural `1 GB`/`50,000` pages. With `--labels`, duplicates, boxes outside `0..1` and overlaps are review signals only (no public `labels.json` schema). |

4. For permitted live checks, inspect `az cognitiveservices account show` (SKU,
   `customSubdomainName`, `publicNetworkAccess`, `disableLocalAuth`) and Azure
   Monitor metrics/logs. Missing MCP/CLI access never blocks offline preflight.

## Report and sources

Separate **observed** facts (file bytes, dimensions, HTTP code, `apim-request-id`),
bounded **interpretation**, and **unknown** items (server-side parsing, uncollected
diagnostics). Passing local checks does not guarantee extraction quality.

- [Service quotas and limits (v4.0)](https://learn.microsoft.com/azure/ai-services/document-intelligence/service-limits?view=doc-intel-4.0.0)
- [Input requirements (v4.0)](https://learn.microsoft.com/azure/ai-services/document-intelligence/prebuilt/read?view=doc-intel-4.0.0#input-requirements-v4)
