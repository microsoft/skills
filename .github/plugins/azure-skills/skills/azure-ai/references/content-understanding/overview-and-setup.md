# Content Understanding setup: surfaces, API versions, endpoints and model defaults

For Azure Content Understanding (CU) in Foundry Tools: which tool to use, which
API version, how to call an analyzer, and how CU uses your model deployments.
Custom analyzer design is in [custom analyzers](custom-analyzers.md); errors in
[diagnostics](diagnostics.md); roles, network and data handling in
[access and roles](../foundry-tools/access-and-roles.md),
[private networking](../foundry-tools/private-network.md) and
[data handling](../foundry-tools/data-handling.md). Foundry IQ ingestion that
uses CU belongs to `foundry-iq`.

## Surfaces and versions

| Surface | Use for |
|---|---|
| Content Understanding Studio (`https://contentunderstanding.ai.azure.com`) | GA and preview; custom analyzer authoring, labeling, testing |
| Microsoft Foundry (new) portal CU playground | Preview API only, partial analyzer catalog; no custom analyzer authoring or labeling |
| Foundry (classic) | No longer a CU experience (deprecated July 15, 2026) |

- GA REST API `2025-11-01` is the default for production. Use
  `2026-06-01-preview` only for preview features: agentic mode
  (`config.workflow`), synchronous read/layout, signature detection, document
  metadata, layout-based classification and segmentation, training that
  distills labeled samples, automatic diagnostics.
- Pin the same `api-version` on create, analyze and every poll.

## Resource, endpoint and calls

- CU needs a Microsoft Foundry resource in a [supported region](https://learn.microsoft.com/azure/ai-services/content-understanding/language-region-support).
  Learn samples use both `https://<name>.services.ai.azure.com/` and
  `https://<name>.cognitiveservices.azure.com/`; use the resource's custom
  subdomain endpoint, not a project endpoint.
- Auth: key, or Microsoft Entra ID with scope `https://cognitiveservices.azure.com/.default`
  and a CU role at the resource scope.
- A custom analyzer has no separate endpoint. Create it, then call
  `POST {endpoint}/contentunderstanding/analyzers/{analyzerId}:analyze?api-version=2025-11-01`
  (URL input; GA accepts one input) or `:analyzeBinary` (file bytes). Both
  return `202` with `Operation-Location`; poll
  `GET {endpoint}/contentunderstanding/analyzerResults/{resultId}` until the body
  status is `Succeeded`. Results are kept up to 24 hours.

## Model deployments and defaults

- Generative steps run on **your** model deployments; their tokens are billed
  there and their deployment type affects where processing happens.
- Read defaults with `GET {endpoint}/contentunderstanding/defaults`; set them
  with `PATCH` (REST media type `application/merge-patch+json`), in Studio
  settings, or per request with `modelDeployments`.
- An analyzer's `models` lists catalog model names (from its `supportedModels`,
  visible with `GET` on the analyzer), not deployment names. `prebuilt-read`,
  `prebuilt-layout` and `prebuilt-digitalParse` need no language or embedding model.
  Learn conflict: the model deployment page says CU "requires a chat completion
  model and an embeddings model", while the read/layout pages need neither.
- A deployment on another resource is referenced as
  `{ConnectionName}/{DeploymentName}`; with managed identity the CU resource
  identity needs Cognitive Services User on that resource, and key auth needs
  public network access on it.

## Read-only checks

| Check | Azure MCP (if enabled) | Without MCP |
|---|---|---|
| Resource kind, region, endpoint | `foundryextensions_resource_get` | `az cognitiveservices account show -n <name> -g <rg> --query "{kind:kind, location:location, endpoint:properties.endpoint}"` |
| Model deployments | `foundryextensions_openai_models-list` | `az cognitiveservices account deployment list -n <name> -g <rg> --query "[].{name:name, model:properties.model.name, sku:sku.name}" -o table` |
| CU defaults | none | `GET {endpoint}/contentunderstanding/defaults?api-version=2025-11-01` with an Entra token |

Choosing between Document Intelligence and CU: see [choose the right tool](https://learn.microsoft.com/azure/ai-services/content-understanding/choosing-right-ai-tool).

Sources (retrieved 2026-11-18): [CU overview](https://learn.microsoft.com/azure/ai-services/content-understanding/overview) ·
[Foundry vs CU Studio](https://learn.microsoft.com/azure/ai-services/content-understanding/foundry-vs-content-understanding-studio) ·
[Models and deployments](https://learn.microsoft.com/azure/ai-services/content-understanding/concepts/models-deployments) ·
[CU REST quickstart](https://learn.microsoft.com/azure/ai-services/content-understanding/quickstart/use-rest-api) ·
[Service limits](https://learn.microsoft.com/azure/ai-services/content-understanding/service-limits)
