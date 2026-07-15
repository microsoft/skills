---
name: azure-ai-contentunderstanding-py
description: |
  Azure AI Content Understanding SDK for Python. Use for multimodal content extraction from documents, images, audio, and video.
  Triggers: "azure-ai-contentunderstanding", "ContentUnderstandingClient", "multimodal analysis", "document extraction", "video analysis", "audio transcription".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-ai-contentunderstanding
---

# Azure AI Content Understanding SDK for Python

Multimodal AI service that extracts semantic content from documents, video, audio, and image files for RAG and automated workflows.

## Installation

```bash
pip install azure-ai-contentunderstanding
```

## Environment Variables

```bash
CONTENTUNDERSTANDING_ENDPOINT=https://<resource>.cognitiveservices.azure.com/  # Required for all auth methods
AZURE_TOKEN_CREDENTIALS=prod # Required only if DefaultAzureCredential is used in production
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
from azure.ai.contentunderstanding import ContentUnderstandingClient
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential

endpoint = os.environ["CONTENTUNDERSTANDING_ENDPOINT"]
# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()
with ContentUnderstandingClient(endpoint=endpoint, credential=credential) as client:
    analyzers = list(client.list_analyzers())
```

## Core Workflow

Content Understanding operations are asynchronous long-running operations:

1. **Begin Analysis** — Start the analysis operation with `begin_analyze()` (returns a poller)
2. **Poll for Results** — Poll until analysis completes (SDK handles this with `.result()`)
3. **Process Results** — Extract structured results from `AnalyzeResult.contents`

## Prebuilt Analyzers

| Analyzer | Content Type | Purpose |
|----------|--------------|---------|
| `prebuilt-documentSearch` | Documents | Extract markdown for RAG applications |
| `prebuilt-imageSearch` | Images | Extract content from images |
| `prebuilt-audioSearch` | Audio | Transcribe audio with timing |
| `prebuilt-videoSearch` | Video | Extract frames, transcripts, summaries |
| `prebuilt-invoice` | Documents | Extract invoice fields |

## Analyze Document

```python
import os
from azure.ai.contentunderstanding import ContentUnderstandingClient
from azure.ai.contentunderstanding.models import AnalyzeInput
from azure.identity import DefaultAzureCredential

endpoint = os.environ["CONTENTUNDERSTANDING_ENDPOINT"]
with ContentUnderstandingClient(
    endpoint=endpoint,
    credential=DefaultAzureCredential()
) as client:
    # Analyze document from URL
    poller = client.begin_analyze(
        analyzer_id="prebuilt-documentSearch",
        inputs=[AnalyzeInput(url="https://example.com/document.pdf")]
    )

    result = poller.result()

    # Access markdown content (contents is a list)
    content = result.contents[0]
    print(content.markdown)
```

## Access Document Content Details

```python
from azure.ai.contentunderstanding.models import MediaContentKind, DocumentContent

content = result.contents[0]
if content.kind == MediaContentKind.DOCUMENT:
    document_content: DocumentContent = content  # type: ignore
    print(document_content.start_page_number)
```

## Analyze Image

```python
from azure.ai.contentunderstanding.models import AnalyzeInput

poller = client.begin_analyze(
    analyzer_id="prebuilt-imageSearch",
    inputs=[AnalyzeInput(url="https://example.com/image.jpg")]
)
result = poller.result()
content = result.contents[0]
print(content.markdown)
```

## Analyze Video

```python
from azure.ai.contentunderstanding.models import AnalyzeInput

poller = client.begin_analyze(
    analyzer_id="prebuilt-videoSearch",
    inputs=[AnalyzeInput(url="https://example.com/video.mp4")]
)

result = poller.result()

# Access video content (AudioVisualContent)
content = result.contents[0]

# Get transcript phrases with timing
for phrase in content.transcript_phrases:
    print(f"[{phrase.start_time} - {phrase.end_time}]: {phrase.text}")

# Get key frames (for video)
for frame in content.key_frames:
    print(f"Frame at {frame.time}: {frame.description}")
```

## Analyze Audio

```python
from azure.ai.contentunderstanding.models import AnalyzeInput

poller = client.begin_analyze(
    analyzer_id="prebuilt-audioSearch",
    inputs=[AnalyzeInput(url="https://example.com/audio.mp3")]
)

result = poller.result()

# Access audio transcript
content = result.contents[0]
for phrase in content.transcript_phrases:
    print(f"[{phrase.start_time}] {phrase.text}")
```

## Custom Analyzers

Create custom analyzers with field schemas for specialized extraction:

```python
# Create custom analyzer
analyzer = client.create_analyzer(
    analyzer_id="my-invoice-analyzer",
    analyzer={
        "description": "Custom invoice analyzer",
        "base_analyzer_id": "prebuilt-documentSearch",
        "field_schema": {
            "fields": {
                "vendor_name": {"type": "string"},
                "invoice_total": {"type": "number"},
                "line_items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "description": {"type": "string"},
                            "amount": {"type": "number"}
                        }
                    }
                }
            }
        }
    }
)

# Use custom analyzer
from azure.ai.contentunderstanding.models import AnalyzeInput

poller = client.begin_analyze(
    analyzer_id="my-invoice-analyzer",
    inputs=[AnalyzeInput(url="https://example.com/invoice.pdf")]
)

result = poller.result()

# Access extracted fields
print(result.fields["vendor_name"])
print(result.fields["invoice_total"])
```

## Analyzer Management

```python
# List all analyzers
analyzers = client.list_analyzers()
for analyzer in analyzers:
    print(f"{analyzer.analyzer_id}: {analyzer.description}")

# Get specific analyzer
analyzer = client.get_analyzer("prebuilt-documentSearch")

# Delete custom analyzer
client.delete_analyzer("my-custom-analyzer")
```

## Async Client

```python
import asyncio
import os
from azure.ai.contentunderstanding.aio import ContentUnderstandingClient
from azure.ai.contentunderstanding.models import AnalyzeInput
from azure.identity.aio import DefaultAzureCredential

async def analyze_document():
    endpoint = os.environ["CONTENTUNDERSTANDING_ENDPOINT"]
    async with DefaultAzureCredential() as credential:
        async with ContentUnderstandingClient(
            endpoint=endpoint,
            credential=credential
        ) as client:
            poller = await client.begin_analyze(
                analyzer_id="prebuilt-documentSearch",
                inputs=[AnalyzeInput(url="https://example.com/doc.pdf")]
            )
            result = await poller.result()
            content = result.contents[0]
            return content.markdown

asyncio.run(analyze_document())
```

## Content Types

| Class | For | Provides |
|-------|-----|----------|
| `DocumentContent` | PDF, images, Office docs | Pages, tables, figures, paragraphs |
| `AudioVisualContent` | Audio, video files | Transcript phrases, timing, key frames |

Both derive from `MediaContent` which provides basic info and markdown representation.

## Model Imports

```python
from azure.ai.contentunderstanding.models import (
    AnalyzeInput,
    AnalyzeResult,
    MediaContentKind,
    DocumentContent,
    AudioVisualContent,
)
```

## Client Types

| Client | Purpose |
|--------|---------|
| `ContentUnderstandingClient` | Sync client for all operations |
| `ContentUnderstandingClient` (aio) | Async client for all operations |

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.ai.contentunderstanding` sync clients with `azure.ai.contentunderstanding.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with ContentUnderstandingClient(...) as client:` (sync) or `async with ContentUnderstandingClient(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use `begin_analyze` with `AnalyzeInput`** — this is the correct method signature
4. **Access results via `result.contents[0]`** — results are returned as a list
5. **Use prebuilt analyzers** for common scenarios (document/image/audio/video search)
6. **Create custom analyzers** only for domain-specific field extraction
7. **Use async client** for high-throughput scenarios with `azure.identity.aio` credentials
8. **Handle long-running operations** — video/audio analysis can take minutes
9. **Use URL sources** when possible to avoid upload overhead

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Additional non-hero capabilities, operation-group coverage, and production checklists. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples for secondary/advanced scenarios. |
