# Document Intelligence custom models: labels, confidence, training and composition

For custom extraction (template or neural), custom classification and composed
models on v4.0 (API `2024-11-30`): fields returned empty or with unexpected
confidence, accuracy that dropped after retraining, dataset design, classifier
or composed-model routing, and copying models. Input files and label-file
syntax are in [preflight and diagnostics](preflight-and-diagnostics.md);
storage and Studio permissions in [Studio and storage](../foundry-tools/storage-and-studio.md).

## Read confidence correctly

- Field confidence is an estimated probability (0–1) and reflects confidence in
  the position of the extracted value. Neural models report no model accuracy score.
- Not all fields return a confidence score: a missing `confidence` is unknown,
  not `0`.
- Learn (accuracy-confidence, "Table, row, and cell confidence" FAQ): "You
  should expect an empty field with high confidence for missing values that are
  mostly empty in the training set too." A high-confidence empty field is
  usually a training-data signal, not proof that the value is absent.

## Diagnose an empty or wrong field

1. **Audit label coverage offline.** Download the training container to a
   local folder (`az storage blob download-batch --auth-mode login -s <container> -d <folder>`),
   then run the [training-set auditor](../../scripts/audit-di-training-set.mjs)
   ([Bash](../../scripts/audit-di-training-set.sh) / [PowerShell](../../scripts/audit-di-training-set.ps1);
   no Node: [manual counts](without-node.md#training-set-label-coverage)):

   ```bash
   node "<skill-directory>/scripts/audit-di-training-set.mjs" --dir "<local-training-folder>"
   ```

   ```powershell
   & node "<skill-directory>\scripts\audit-di-training-set.mjs" --dir "<local-training-folder>"
   ```

   It reports, per field, how many documents carry a labeled value overall and
   per file type, fields never labeled, label names missing from `fields.json`,
   missing `.ocr.json` files and OCR `apiVersion` drift. It prints counts and
   field names only (`--anonymize-fields` hides names). A field labeled in some
   documents but not others needs review: confirm the value is truly absent in
   the unlabeled ones. The launcher exit codes are `0` report/help, `1`
   folder/read/JSON error, `2` usage error and `3` Node.js 22+ unavailable.
2. **Same input, two models.** Analyze the same file with the previous and the
   new model. If the layout text is the same but fields differ, the cause is the
   model or its training data. Compare field presence and confidence, never values.
3. **Compare model metadata:** `GET {endpoint}/documentintelligence/documentModels/{modelId}?api-version=2024-11-30`
   returns `buildMode`, `apiVersion`, `createdDateTime`, `expirationDateTime`,
   `trainingHours` and `docTypes.*.fieldSchema` (and `fieldConfidence` where provided).

## Dataset rules from Learn

- At least five labeled documents; for neural models at least five labeled
  samples for each variation. About 15 or fewer variations: one model with
  samples of each; more: separate models and compose them.
- Include documents where optional fields are present. Label consistently: pick
  the same context for a value across documents; label the value, not its caption.
- Neural models don't recognize values split across page boundaries. Signature
  fields need at least five labeled samples. A token can be labeled for at most
  two overlapping fields, using region labeling.
- Retraining with a newer API version needs `.ocr.json` files produced by that
  version (`analyzeResult.apiVersion`). Models built with a GA API expire after
  two years.
- Neural training time is capped by `maxTrainingHours` and billed with a
  30-minute minimum per job. Learn conflict on free training: "10 hours of free
  model training" vs "over 20 requests in a calendar month are billed".

## Classify first, then extract

- Custom classifier: 2–1,000 classes, 5–100 samples per class; `splitMode`
  defaults to `none` in `2024-11-30`; handle unknown documents with a score
  threshold or an `other` class; incremental training uses `baseClassifierId`
  with the same API version.
- Composed model (v4): needs an explicit classifier, up to 500 component models
  (F0: 5), optional `confidenceThreshold`; unmapped document types are ignored.
  Classification is billed on all pages, extraction only on routed pages.
- Two calls (classify, then the chosen extraction model) give full control;
  a composed model routes in one call.

## Copy and migrate

`authorizeCopy` on the **target** resource, then `copyTo` on the **source**
with the unchanged payload (valid 24 hours), then poll. Copying between
encrypted and unencrypted resources needs `x-ms-forms-copy-degrade: true`.
Copy moves the model, not the training data.

Sources (retrieved 2026-11-18): [Accuracy and confidence](https://learn.microsoft.com/azure/ai-services/document-intelligence/concept/accuracy-confidence?view=doc-intel-4.0.0) ·
[Labeled datasets](https://learn.microsoft.com/azure/ai-services/document-intelligence/train/custom-labels?view=doc-intel-4.0.0) ·
[Label tips](https://learn.microsoft.com/azure/ai-services/document-intelligence/train/custom-label-tips?view=doc-intel-4.0.0) ·
[Custom neural](https://learn.microsoft.com/azure/ai-services/document-intelligence/train/custom-neural?view=doc-intel-4.0.0) ·
[Model lifecycle](https://learn.microsoft.com/azure/ai-services/document-intelligence/train/custom-lifecycle?view=doc-intel-4.0.0) ·
[Custom classifier](https://learn.microsoft.com/azure/ai-services/document-intelligence/train/custom-classifier?view=doc-intel-4.0.0) ·
[Composed models](https://learn.microsoft.com/azure/ai-services/document-intelligence/train/composed-models?view=doc-intel-4.0.0) ·
[Disaster recovery (copy)](https://learn.microsoft.com/azure/ai-services/document-intelligence/how-to-guides/disaster-recovery?view=doc-intel-4.0.0)
