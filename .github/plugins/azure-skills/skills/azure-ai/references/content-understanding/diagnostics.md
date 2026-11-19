# Content Understanding diagnostics

For failing Content Understanding (CU) calls, Studio pages that fail, results
that look wrong, or analyses that never finish. Learn has no dedicated CU
error-code page: errors use the Azure Core error shape plus an
`x-ms-error-code` header, so branch on `error.code`, nested `innererror.code`
and the header, never on message text.

## Workflow

1. Record UTC time, `api-version`, operation (create, analyze, analyzeBinary,
   GET result, defaults), HTTP status and error codes, and the result ID from
   `Operation-Location` ([evidence without content](../foundry-tools/evidence-without-content.md)).
2. Match the symptom:

| Symptom | Check first |
|---|---|
| `401`/`403` on `/contentunderstanding/*`, Foundry portal CU page or CU Studio project list | Role at the **resource** scope, auth mode and `disableLocalAuth` ([access and roles](../foundry-tools/access-and-roles.md); run the access checker) |
| `403` with a valid role, timeouts, Studio loads but calls fail | Network rules, private endpoint DNS for each host ([private networking](../foundry-tools/private-network.md)) |
| Error about a missing default or model deployment | `GET .../contentunderstanding/defaults`, deployment names, the analyzer's `supportedModels`, or pass `modelDeployments` per request ([overview and setup](overview-and-setup.md)) |
| URL input cannot be fetched | The URL must point to one object the CU resource can reach: SAS validity, read permission, storage firewall; or send bytes with `analyzeBinary` ([Studio and storage](../foundry-tools/storage-and-studio.md)) |
| A property or operation is rejected | Preview-only feature on GA `2025-11-01`; move to `2026-06-01-preview` or remove it, and keep the same version on polls |
| `404` on a result ID | Wrong ID, wrong endpoint or version, or older than the up-to-24-hour retention; analyze again |
| HTTP `200`/`202` but status `Running` for long or `Failed` | Job state is in the body; capture the body status and error code and poll with backoff (every 1–2 s per Learn samples) |
| `Succeeded` but fields missing | `result.warnings` guardrail codes, field `method`, description quality, labeled samples ([custom analyzers](custom-analyzers.md)) |
| Slow or throttled generative steps | Quota and metrics of **your** model deployment (`429`s there surface in CU) |
| Studio cannot find the resource | Reader to discover the resource, CU role on it, region support, browser network path |

3. Confirm with a minimal plain HTTP call using the same identity, endpoint
   host and `api-version` as the app; record status and error codes only.

## Read-only Azure checks

| Check | Azure MCP (if enabled) | Without MCP |
|---|---|---|
| Model deployment metrics (throttling) | `monitor_metrics_definitions`, then `monitor_metrics_query` on the resource | `az monitor metrics list --resource <resource-id> --metric <name> --interval PT5M` after `az monitor metrics list-definitions --resource <resource-id>` |
| Configuration changes | `monitor_activitylog_list` | `az monitor activity-log list --resource-id <resource-id> --offset 7d` |
| Service health | `resourcehealth_availability-status_get` | Azure portal Resource Health / Service Health |

No incident or health event is not proof that the service is healthy, and a
successful test does not validate the app's identity, network or document.

Sources (retrieved 2026-11-18): [CU REST quickstart](https://learn.microsoft.com/azure/ai-services/content-understanding/quickstart/use-rest-api) ·
[Data privacy (retention)](https://learn.microsoft.com/azure/foundry/responsible-ai/content-understanding/data-privacy) ·
[Models and deployments](https://learn.microsoft.com/azure/ai-services/content-understanding/concepts/models-deployments) ·
[Guardrails](https://learn.microsoft.com/azure/ai-services/content-understanding/concepts/guardrails) ·
[Migrate preview to GA](https://learn.microsoft.com/azure/ai-services/content-understanding/how-to/migration-preview-to-ga)
