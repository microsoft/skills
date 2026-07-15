# azure-ai-contentunderstanding-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

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
from azure.ai.contentunderstanding.models import (
    AnalyzeInput,
    ContentAnalyzer,
    ContentFieldDefinition,
    ContentFieldSchema,
)

# Create custom analyzer - returns an LRO poller; wait for provisioning to complete
poller = client.begin_create_analyzer(
    analyzer_id="my-invoice-analyzer",
    resource=ContentAnalyzer(
        description="Custom invoice analyzer",
        base_analyzer_id="prebuilt-documentSearch",
        field_schema=ContentFieldSchema(
            fields={
                "vendor_name": ContentFieldDefinition(type="string"),
                "invoice_total": ContentFieldDefinition(type="number"),
                "line_items": ContentFieldDefinition(
                    type="array",
                    item_definition=ContentFieldDefinition(
                        type="object",
                        properties={
                            "description": ContentFieldDefinition(type="string"),
                            "amount": ContentFieldDefinition(type="number"),
                        },
                    ),
                ),
            }
        ),
    ),
)
poller.result()  # wait until analyzer is ready

# Use custom analyzer
analyze_poller = client.begin_analyze(
    analyzer_id="my-invoice-analyzer",
    inputs=[AnalyzeInput(url="https://example.com/invoice.pdf")]
)

result = analyze_poller.result()

# Access extracted fields from analyzed content
content = result.contents[0]
print(content.fields["vendor_name"].value_string)
print(content.fields["invoice_total"].value_number)
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

Both derive from `AnalysisContent`, which provides basic information and a markdown representation.

## Model Imports

```python
from azure.ai.contentunderstanding.models import (
    AnalyzeInput,
    AnalyzeResult,
    DocumentContent,
    AudioVisualContent,
)
```

## Client Types

| Client | Purpose |
|--------|---------|
| `ContentUnderstandingClient` | Sync client for all operations |
| `ContentUnderstandingClient` (aio) | Async client for all operations |
