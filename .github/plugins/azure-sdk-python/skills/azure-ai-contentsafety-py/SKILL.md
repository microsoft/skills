---
name: azure-ai-contentsafety-py
description: |
  Azure AI Content Safety SDK for Python. Use for detecting harmful content in text and images with multi-severity classification.
  Triggers: "azure-ai-contentsafety", "ContentSafetyClient", "content moderation", "harmful content", "text analysis", "image analysis".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-ai-contentsafety
---

# Azure AI Content Safety SDK for Python

Detect harmful user-generated and AI-generated content in applications.

## Installation

```bash
pip install azure-ai-contentsafety
```

## Environment Variables

```bash
CONTENT_SAFETY_ENDPOINT=https://<resource>.cognitiveservices.azure.com  # Required for all auth methods
AZURE_TOKEN_CREDENTIALS=prod # Required only if DefaultAzureCredential is used in production
CONTENT_SAFETY_KEY=<your-api-key>  # Only required for the legacy API-key auth path below
```

## Authentication & Lifecycle

> **🔑 Two rules apply to every code sample below:**
>
> 1. **Prefer `DefaultAzureCredential`.** It works locally (Azure CLI / VS Code / Developer CLI) and in Azure (managed identity, workload identity) with no code change. Avoid connection strings, account/API keys — they bypass Entra audit and rotation.
>    - Local dev: `DefaultAzureCredential` works as-is.
>    - Production: set `AZURE_TOKEN_CREDENTIALS=prod` (or `AZURE_TOKEN_CREDENTIALS=<specific_credential>`) to constrain the credential chain to production-safe credentials.
> 2. **Wrap every client in a context manager** so HTTP transports, sockets, and token caches are released deterministically:
>    - Sync: `with <Client>(...) as client:`
>    - Async: `async with <Client>(...) as client:` **and** `async with DefaultAzureCredential() as credential:` (from `azure.identity.aio`)
>
> Snippets may abbreviate this setup, but production code should always follow both rules.

```python
import os
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential
from azure.ai.contentsafety import ContentSafetyClient
from azure.ai.contentsafety.models import AnalyzeTextOptions

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()

with ContentSafetyClient(
    endpoint=os.environ["CONTENT_SAFETY_ENDPOINT"],
    credential=credential,
) as client:
    response = client.analyze_text(AnalyzeTextOptions(text="Hello, world!"))
```

### Legacy: API Key (existing keyed deployments)

New code should use `DefaultAzureCredential` above. Use `AzureKeyCredential` only if you have an existing keyed deployment that hasn't been migrated to Entra ID yet — for example, regulated environments still completing their Entra rollout.

```python
import os
from azure.core.credentials import AzureKeyCredential
from azure.ai.contentsafety import ContentSafetyClient
from azure.ai.contentsafety.models import AnalyzeTextOptions

with ContentSafetyClient(
    endpoint=os.environ["CONTENT_SAFETY_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["CONTENT_SAFETY_KEY"]),
) as client:
    response = client.analyze_text(AnalyzeTextOptions(text="Hello, world!"))
```

The `BlocklistClient` accepts the same `AzureKeyCredential` if you also need to manage blocklists with a key.

## Analyze Text

```python
from azure.ai.contentsafety import ContentSafetyClient
from azure.ai.contentsafety.models import AnalyzeTextOptions, TextCategory
from azure.identity import DefaultAzureCredential

with ContentSafetyClient(endpoint, DefaultAzureCredential()) as client:
    request = AnalyzeTextOptions(text="Your text content to analyze")
    response = client.analyze_text(request)

    # Check each category
    for category in [TextCategory.HATE, TextCategory.SELF_HARM, 
                     TextCategory.SEXUAL, TextCategory.VIOLENCE]:
        result = next((r for r in response.categories_analysis 
                       if r.category == category), None)
        if result:
            print(f"{category}: severity {result.severity}")
```

## Analyze Image

```python
from azure.ai.contentsafety import ContentSafetyClient
from azure.ai.contentsafety.models import AnalyzeImageOptions, ImageData
from azure.identity import DefaultAzureCredential
import base64

with ContentSafetyClient(endpoint, DefaultAzureCredential()) as client:
    # From file
    with open("image.jpg", "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")

    request = AnalyzeImageOptions(
        image=ImageData(content=image_data)
    )

    response = client.analyze_image(request)

    for result in response.categories_analysis:
        print(f"{result.category}: severity {result.severity}")
```

### Image from URL

```python
from azure.ai.contentsafety.models import AnalyzeImageOptions, ImageData

request = AnalyzeImageOptions(
    image=ImageData(blob_url="https://example.com/image.jpg")
)

response = client.analyze_image(request)
```

## Text Blocklist Management

### Create Blocklist

```python
from azure.ai.contentsafety import BlocklistClient
from azure.ai.contentsafety.models import TextBlocklist
from azure.identity import DefaultAzureCredential

with BlocklistClient(endpoint, DefaultAzureCredential()) as blocklist_client:
    blocklist = TextBlocklist(
        blocklist_name="my-blocklist",
        description="Custom terms to block"
    )

    result = blocklist_client.create_or_update_text_blocklist(
        blocklist_name="my-blocklist",
        options=blocklist
    )
```

### Add Block Items

```python
from azure.ai.contentsafety.models import AddOrUpdateTextBlocklistItemsOptions, TextBlocklistItem

items = AddOrUpdateTextBlocklistItemsOptions(
    blocklist_items=[
        TextBlocklistItem(text="blocked-term-1"),
        TextBlocklistItem(text="blocked-term-2")
    ]
)

result = blocklist_client.add_or_update_blocklist_items(
    blocklist_name="my-blocklist",
    options=items
)
```

### Analyze with Blocklist

```python
from azure.ai.contentsafety.models import AnalyzeTextOptions

request = AnalyzeTextOptions(
    text="Text containing blocked-term-1",
    blocklist_names=["my-blocklist"],
    halt_on_blocklist_hit=True
)

response = client.analyze_text(request)

if response.blocklists_match:
    for match in response.blocklists_match:
        print(f"Blocked: {match.blocklist_item_text}")
```

## Severity Levels

Text analysis returns 4 severity levels (0, 2, 4, 6) by default. For 8 levels (0-7):

```python
from azure.ai.contentsafety.models import AnalyzeTextOptions, AnalyzeTextOutputType

request = AnalyzeTextOptions(
    text="Your text",
    output_type=AnalyzeTextOutputType.EIGHT_SEVERITY_LEVELS
)
```

## Harm Categories

| Category | Description |
|----------|-------------|
| `Hate` | Attacks based on identity (race, religion, gender, etc.) |
| `Sexual` | Sexual content, relationships, anatomy |
| `Violence` | Physical harm, weapons, injury |
| `SelfHarm` | Self-injury, suicide, eating disorders |

## Severity Scale

| Level | Text Range | Image Range | Meaning |
|-------|------------|-------------|---------|
| 0 | Safe | Safe | No harmful content |
| 2 | Low | Low | Mild references |
| 4 | Medium | Medium | Moderate content |
| 6 | High | High | Severe content |

## Client Types

| Client | Purpose |
|--------|---------|
| `ContentSafetyClient` | Analyze text and images |
| `BlocklistClient` | Manage custom blocklists |

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.ai.contentsafety` sync clients with `azure.ai.contentsafety.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with ContentSafetyClient(...) as client:` (sync) or `async with ContentSafetyClient(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use blocklists** for domain-specific terms
4. **Set severity thresholds** appropriate for your use case
5. **Handle multiple categories** — content can be harmful in multiple ways
6. **Use halt_on_blocklist_hit** for immediate rejection
7. **Log analysis results** for audit and improvement
8. **Consider 8-severity mode** for finer-grained control
9. **Pre-moderate AI outputs** before showing to users

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Additional non-hero capabilities, operation-group coverage, and production checklists. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples for secondary/advanced scenarios. |
