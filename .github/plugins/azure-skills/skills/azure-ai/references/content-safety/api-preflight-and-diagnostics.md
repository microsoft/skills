# Standalone Azure AI Content Safety preflight and diagnostics

For direct **standalone Azure AI Content Safety** REST/SDK calls
(`POST {endpoint}/contentsafety/text:analyze`, `image:analyze`,
`text:shieldPrompt`, `text/blocklists`, API `2024-09-01`). Route Azure API
Management `llm-content-safety` policies to `azure-aigateway`, and Microsoft
Foundry model/agent Guardrails to `microsoft-foundry`.

> ⚠️ **Warning:** Public preview Analyze Multimodal, Custom categories (rapid),
> Groundedness detection, Embedded SDK and Connected/Disconnected Content Safety
> containers retire **April 30, 2027**.

## Workflow

1. Confirm operation (`text:analyze`, `image:analyze`, `text:shieldPrompt` or
   blocklists), tier (`F0`: `5 RPS`; `S0`: `1000 RP10S`) and region. Never ask
   for keys or echo raw prompts, documents, blocklist terms or base64 images.
2. Check `node --version` (Node.js 22+). **Without Node** (don't install it
   unasked), compare the request JSON with the table in step 3 without printing
   its text; for images check only file size and extension and report pixel
   dimensions as `unknown`. Otherwise run the
   [local validator](../../scripts/validate-content-safety-request.mjs):

   ```bash
   node "<skill-directory>/scripts/validate-content-safety-request.mjs" --operation text-analyze --payload "<request.json>"
   ```

   ```powershell
   & node "<skill-directory>\scripts\validate-content-safety-request.mjs" --operation text-analyze --payload "<request.json>"
   ```

   Operations: `text-analyze`, `image-analyze` (`--payload` and/or `--image`),
   `shield-prompt`. [Bash](../../scripts/validate-content-safety-request.sh) and
   [PowerShell](../../scripts/validate-content-safety-request.ps1) launchers use
   exit codes `0` report/`--help`, `1` file/JSON error, `2` usage error, `3` Node 22+ missing.
3. Check payload limits and semantics (`2024-09-01`):

| Operation / field | Public contract check |
|---|---|
| `text:analyze` | `text <= 10,000` characters (chunk longer text). Categories: `Hate`, `SelfHarm`, `Sexual`, `Violence`; omit `categories` for the default set. `outputType`: `"FourSeverityLevels"` (`0,2,4,6`, default) or `"EightSeverityLevels"` (`0..7`); with four levels, equality checks against odd values never match. |
| Blocklists | `blocklistNames` allow `0-9 A-Z a-z - . _ ~` (`<= 64` chars). `haltOnBlocklistHit: true` skips harm-category analysis when a blocklist matches. |
| `image:analyze` | Image `<= 4 MB`, at least `50x50` px; the maximum is `2048x2048` in the 2024-09-01 API reference and `7200x7200` in the input-requirements table. `JPEG`/`PNG`/`GIF`/`BMP`/`TIFF`/`WEBP`. Send raw base64 (no `data:` prefix). `outputType` supports `"FourSeverityLevels"` only. |
| `text:shieldPrompt` | `userPrompt <= 10,000` chars; `documents` `<= 5` strings and `<= 10,000` combined chars. Returns `attackDetected` booleans for prompt/indirect injection (not general harm moderation). |
| Auth & region | Entra ID requires a custom subdomain and `Cognitive Services User`. Features vary by region; on `404`/`400` check region support and record the error `code` and `apim-request-id`. |

## Sources

- [Content Safety overview and deprecations](https://learn.microsoft.com/azure/ai-services/content-safety/overview)
- [Region availability and input limits](https://learn.microsoft.com/azure/ai-services/content-safety/region-availability#service-limits)
- [Analyze Text](https://learn.microsoft.com/azure/ai-services/content-safety/quickstart-text) | [Analyze Image (2024-09-01)](https://learn.microsoft.com/rest/api/contentsafety/image-operations/analyze-image?view=rest-contentsafety-2024-09-01) | [Prompt Shields](https://learn.microsoft.com/azure/ai-services/content-safety/quickstart-jailbreak)
