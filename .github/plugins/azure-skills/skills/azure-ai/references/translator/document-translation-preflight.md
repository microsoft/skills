# Translator Document Translation and glossary preflight

For Azure AI Translator Document Translation (async batch and sync single-file),
glossary validation and Blob storage authorization. Do not use for Microsoft
Foundry project connections (`microsoft-foundry`).

## Workflow

1. Confirm mode (`async` batch vs `sync` single-file vs Text API), tier (`S1` or
   `C2-C4`/`D3` required for Document Translation; `F0` is Text API only) and
   auth (Managed Identity vs SAS). Never ask for keys/SAS or echo document/glossary text.
2. Check `node --version` (Node.js 22+). If missing/older, follow
   [validation without Node](without-node.md). Otherwise run the
   [local validator](../../scripts/validate-document-translation.mjs):

   ```bash
   node "<skill-directory>/scripts/validate-document-translation.mjs" --mode async --dir "<source-folder>" --glossary "<glossary.tsv>" --target-count 2
   ```

   ```powershell
   & node "<skill-directory>\scripts\validate-document-translation.mjs" --mode async --dir "<source-folder>" --glossary "<glossary.tsv>" --target-count 2
   ```

   Or pass `--document "<file>"`. [Bash](../../scripts/validate-document-translation.sh)
   and [PowerShell](../../scripts/validate-document-translation.ps1) launchers
   use exit codes `0` report/`--help`, `1` file error, `2` usage error, `3` Node 22+ missing.
3. Verify documented limits and authorization rules:

| Area | Public contract |
|---|---|
| Async batch | Document `<= 40 MB` (preview image `.jpeg/.png/.bmp/.webp <= 5 MB` on `2025-12-01-preview`), `<= 1,000` files, `<= 250 MB` batch total, `<= 10` target languages, glossary `<= 10 MB`. Secured documents (password-encrypted or copy-restricted) can't be translated. |
| Sync single-file | Document `<= 10 MB`, `1` file, `1` target language, glossary `<= 1 MB`. Formats: txt, tsv/tab, csv, html/htm, mhtml/mht, docx, xlsx, pptx, msg, xlf. |
| Formats | `GET /translator/document/formats` (`?type=glossary`) is authoritative; validator list misses only warn. |
| Text API | `<= 50,000` chars/request across all target languages, `<= 1,000` elements; sliding hourly quota (`F0` 2M/hr ≈ 33.3K/min, `S1` 40M/hr, Custom `3,600` chars/sec/model). |
| Glossary | `.tsv`/`.tab`/`.csv` or `.xlf`. Partial-sentence matching is **case-sensitive**; full-sentence matching is case-insensitive. |
| Endpoint | Requires custom domain `https://<custom>.cognitiveservices.azure.com`. |
| Managed Identity | Translator must be in a **geographic region** (not `Global`) with a **system-assigned** identity. Assign `Storage Blob Data Contributor` at storage scope, **omit SAS query strings**, and on firewalled storage allow trusted Azure services plus a `Microsoft.CognitiveServices/accounts` resource-instance rule (up to 5 min to propagate). |
| SAS fallback | Source `rl`, target `wl`, glossary `rl`, valid expiry. |

4. For permitted live checks, inspect `az cognitiveservices account show`
   (`location`, `sku.name`, `properties.customSubdomainName`, `identity.type`)
   and storage RBAC/firewall without listing keys.

## Report and sources

Separate **observed** defects (row numbers, byte sizes, HTTP error codes),
bounded **interpretation**, and **unknown** items. Passing local validation does
not guarantee server translation accuracy.

- [Translator service limits](https://learn.microsoft.com/azure/ai-services/translator/service-limits)
- [Document translation overview](https://learn.microsoft.com/azure/ai-services/translator/document-translation/overview) | [Glossaries](https://learn.microsoft.com/azure/ai-services/translator/document-translation/how-to-guides/create-use-glossaries) | [Managed identities](https://learn.microsoft.com/azure/ai-services/translator/document-translation/how-to-guides/create-use-managed-identities) | [SAS](https://learn.microsoft.com/azure/ai-services/translator/document-translation/how-to-guides/use-rest-api-programmatically#create-azure-blob-storage-containers)
