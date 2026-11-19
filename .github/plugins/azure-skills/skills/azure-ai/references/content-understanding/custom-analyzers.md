# Content Understanding custom analyzers: create, label, tune and copy

For designing or improving custom analyzers in Azure Content Understanding
(GA `2025-11-01` unless noted): field schema, extraction methods, confidence and
grounding, labeled samples, classification, guardrail warnings and analyzer
lifecycle. Setup and model defaults are in [overview and setup](overview-and-setup.md).

## Create and replace

- `PUT {endpoint}/contentunderstanding/analyzers/{analyzerId}?api-version=2025-11-01`
  returns `200`/`201` with `Operation-Location`; poll it before analyzing.
- Base analyzers: `prebuilt-document`, `prebuilt-image`, `prebuilt-audio`,
  `prebuilt-video`.
- Learn conflicts to plan around: analyzer ID characters (`[a-zA-Z0-9._]` in
  service limits vs hyphen allowed in the REST reference, so avoid hyphens), and
  reusing a name (migration guide: delete first; REST: `allowReplace`).
- Limits: 100,000 analyzers per resource, 1,000 fields, 64-character field names,
  4,096-character descriptions, 300 classify categories per field.

## Field schema

- Methods: `extract` (documents only; set `estimateSourceAndConfidence: true` on
  the field), `generate`, `classify`. If `method` is omitted the service picks
  one. Learn conflict: best practices say set it explicitly; the migration
  guide says add it only when you need verbatim extraction. Decide per field
  and test both on your validation set.
- Descriptions drive quality: be specific, list aliases and abbreviations used
  in your documents, phrase affirmatively, and write in the document language.
- Confidence and grounding are opt-in (`estimateFieldSourceAndConfidence`,
  documents only; extract, classify and generate fields). `returnDetails`
  defaults to `false`.

## Labeled samples

- Add labeled documents in CU Studio; the API represents them as
  `knowledgeSources` of kind `labeledData` (`containerUrl`, `prefix`,
  `fileListPath`). Documents only; not used for `generate` fields.
- GA analyzers keep the labeled data and use it at analysis time;
  `2026-06-01-preview` distills it into the analyzer (and preview analyzers with
  labeled data are billed at the advanced contextualization rate).
- Storage and identity for Studio projects: [Studio and storage](../foundry-tools/storage-and-studio.md).

## Classification

GA classification lives in the analyzer (`contentCategories`, `enableSegment`):
up to 200 categories for documents. Without an "other" category every input is
forced into one of the defined categories.

## Tune with evidence

1. Keep a fixed validation set that reflects production variation.
2. Change one thing per iteration (description, method, labeled samples).
3. Compare per-field presence, confidence and grounding across analyzer
   versions; do not share field values. `result.infos` `LLMStats` entries show
   model usage per call.
4. Promote by analyzer ID only after the new version matches or beats the old one.

## Guardrail warnings

CU applies the guardrails of your model deployment and can return `Succeeded`
with fields suppressed. Branch on `result.warnings[].code` and `target`, not on
the message: `HarmfulContentDetected` (review) vs `HarmfulContentFiltered`
(fields suppressed). Change the guardrail on your deployment;
annotate-only mode needs approval.

## Copy and delete

Copy is two calls in the opposite direction from Document Intelligence:
`:grantCopyAuthorization` on the **source** (returns `expiresAt`), then `:copy`
on the **target**. Delete with `DELETE` on the analyzer path (CU Contributor
cannot delete analyzers; CU Owner can).

Sources (retrieved 2026-11-18): [CU Studio quickstart](https://learn.microsoft.com/azure/ai-services/content-understanding/quickstart/content-understanding-studio) ·
[Analyzer improvement](https://learn.microsoft.com/azure/ai-services/content-understanding/document/analyzer-improvement) ·
[Best practices](https://learn.microsoft.com/azure/ai-services/content-understanding/concepts/best-practices) ·
[Analyzer reference](https://learn.microsoft.com/azure/ai-services/content-understanding/concepts/analyzer-reference) ·
[Service limits](https://learn.microsoft.com/azure/ai-services/content-understanding/service-limits) ·
[Guardrails](https://learn.microsoft.com/azure/ai-services/content-understanding/concepts/guardrails) ·
[Migrate preview to GA](https://learn.microsoft.com/azure/ai-services/content-understanding/how-to/migration-preview-to-ga)
