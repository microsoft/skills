# Data handling for Document Intelligence and Content Understanding

For "where does my document go", "how long is it kept", "can I delete it",
"does bring-your-own storage cover it" and data-residency questions. Quote the
linked Learn pages to security reviewers; where Learn pages disagree, show both
statements instead of choosing one.

| Topic | Document Intelligence (v4.0, `2024-11-30`) | Content Understanding (GA `2025-11-01`) |
|---|---|---|
| Where it is processed / stored | In the region of the resource | Data at rest stays in the resource region; generative steps run on **your** model deployment, so its deployment type (global, data zone, regional) decides where that processing can happen |
| Analyze input and result retention | Deleted after 24 hours. Learn conflict: "24 hours after an analysis operation completes" vs "from the time that you submit" | Input, intermediate data and results kept "for up to 24 hours", then deleted. An older wording (inputs deleted after processing) still appears in search results |
| Delete early | Delete Analyze Result on the result ID from `Operation-Location`. Learn conflict: "permanently deletes the submitted input data and analyze result" vs REST "mark … for deletion" | `DELETE {endpoint}/contentunderstanding/analyzerResults/{resultId}` returns `204`. Needs the `analyzerresults/delete` data action: CU **Reader lacks it**; CU Contributor, Cognitive Services User or Foundry User have it |
| Avoid service-side temporary storage | Not documented | Synchronous `analyzeInline` / `analyzeBinaryInline` process in memory; preview only and only for `prebuilt-read` and `prebuilt-layout` |
| Processing location control | Not documented | `processingLocation`. Learn conflict: data-privacy page limits it to `prebuilt-read`/`prebuilt-layout`; REST reference exposes it on every analyze call (default global) |
| Training / labeled data | Your Blob container (SAS or managed identity) | CU Studio projects keep samples and labels in your storage through a Foundry storage connection. GA analyzers keep the labeled data and use it at analysis time; `2026-06-01-preview` distills it into the analyzer |
| Customer-managed keys (CMK) | Covers models and results for resources created after 07/31/2023; Key Vault in the same region and tenant | Learn conflict: CU security page offers CMK double encryption; Foundry CMK table marks CU "N/A" on Foundry-managed storage and requires bring-your-own storage |

## Answering common requests

- **"Nothing may stay in Microsoft storage."** No documented CU mode removes
  the up-to-24-hour retention for asynchronous analysis. Options: delete
  results right after retrieval (grant a role that includes delete), use the
  synchronous preview operations for read/layout, keep Studio projects in your
  own storage, and choose model deployment types that match residency rules.
- **"Bring-your-own storage covers everything."** It covers CU Studio project
  data. The account-level `userOwnedStorage` property is documented for Speech
  and Language, not for DI or CU analysis.
- **"Is the service available in our region?"** Check
  [CU region support](https://learn.microsoft.com/azure/ai-services/content-understanding/language-region-support)
  or DI regional availability before designing around it; do not hardcode lists.
- Logs: CU logs the analyzer name for reporting and debugging. Your own Azure
  Monitor diagnostic settings decide what request metadata you keep.

## Verify instead of assuming

- Role for deletion: follow [access and roles](access-and-roles.md) and run its
  access checker with `--operation cu-delete-result`.
- After a delete, check whether a `GET` on the same result ID still returns the
  result; record the UTC time and HTTP status, not the content.
- Region, CMK and network settings: `az cognitiveservices account show -n <name> -g <rg> --query "{location:location, encryption:properties.encryption.keySource, publicNetworkAccess:properties.publicNetworkAccess}"`.

Sources (retrieved 2026-11-18): [DI data, privacy, security](https://learn.microsoft.com/azure/foundry/responsible-ai/document-intelligence/data-privacy-security) ·
[CU data, privacy, security](https://learn.microsoft.com/azure/foundry/responsible-ai/content-understanding/data-privacy) ·
[CU Delete Result](https://learn.microsoft.com/rest/api/contentunderstanding/content-analyzers/delete-result?view=rest-contentunderstanding-2025-11-01) ·
[CU synchronous operations](https://learn.microsoft.com/azure/ai-services/content-understanding/quickstart/use-synchronous-rest-api) ·
[DI CMK](https://learn.microsoft.com/azure/ai-services/document-intelligence/authentication/encrypt-data-at-rest?view=doc-intel-4.0.0) ·
[Foundry CMK](https://learn.microsoft.com/azure/foundry/concepts/encryption-keys-portal) ·
[Foundry: connect your own storage](https://learn.microsoft.com/azure/foundry/how-to/bring-your-own-azure-storage-foundry)
