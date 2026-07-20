---
name: azure-ai-vision-imageanalysis-py
description: |
  Azure AI Vision Image Analysis SDK for captions, tags, objects, OCR, people detection, and smart cropping. Use for computer vision and image understanding tasks.
  Triggers: "image analysis", "computer vision", "OCR", "object detection", "ImageAnalysisClient", "image caption".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-ai-vision-imageanalysis
---

# Azure AI Vision Image Analysis SDK for Python

Client library for Azure AI Vision 4.0 image analysis including captions, tags, objects, OCR, and more.

## Installation

```bash
pip install azure-ai-vision-imageanalysis
```

## Environment Variables

```bash
VISION_ENDPOINT=https://<resource>.cognitiveservices.azure.com  # Required for all auth methods
AZURE_TOKEN_CREDENTIALS=prod # Required only if DefaultAzureCredential is used in production
VISION_KEY=<your-api-key>  # Only required for the legacy API-key auth path below
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
from azure.ai.vision.imageanalysis import ImageAnalysisClient
from azure.ai.vision.imageanalysis.models import VisualFeatures

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()

with ImageAnalysisClient(
    endpoint=os.environ["VISION_ENDPOINT"],
    credential=credential,
) as client:
    result = client.analyze_from_url(
        image_url="https://aka.ms/azsdk/image-analysis/sample.jpg",
        visual_features=[VisualFeatures.CAPTION],
    )
```

### Legacy: API Key (existing keyed deployments)

New code should use `DefaultAzureCredential` above. Use `AzureKeyCredential` only if you have an existing keyed deployment that hasn't been migrated to Entra ID yet — for example, regulated environments still completing their Entra rollout.

```python
import os
from azure.core.credentials import AzureKeyCredential
from azure.ai.vision.imageanalysis import ImageAnalysisClient
from azure.ai.vision.imageanalysis.models import VisualFeatures

with ImageAnalysisClient(
    endpoint=os.environ["VISION_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["VISION_KEY"]),
) as client:
    result = client.analyze_from_url(
        image_url="https://aka.ms/azsdk/image-analysis/sample.jpg",
        visual_features=[VisualFeatures.CAPTION],
    )
```

## Analyze Image from URL

```python
from azure.ai.vision.imageanalysis.models import VisualFeatures

image_url = "https://example.com/image.jpg"

result = client.analyze_from_url(
    image_url=image_url,
    visual_features=[
        VisualFeatures.CAPTION,
        VisualFeatures.TAGS,
        VisualFeatures.OBJECTS,
        VisualFeatures.READ,
        VisualFeatures.PEOPLE,
        VisualFeatures.SMART_CROPS,
        VisualFeatures.DENSE_CAPTIONS
    ],
    gender_neutral_caption=True,
    language="en"
)
```

## Analyze Image from File

```python
with open("image.jpg", "rb") as f:
    image_data = f.read()

result = client.analyze(
    image_data=image_data,
    visual_features=[VisualFeatures.CAPTION, VisualFeatures.TAGS]
)
```

## Image Caption

```python
result = client.analyze_from_url(
    image_url=image_url,
    visual_features=[VisualFeatures.CAPTION],
    gender_neutral_caption=True
)

if result.caption:
    print(f"Caption: {result.caption.text}")
    print(f"Confidence: {result.caption.confidence:.2f}")
```

## Dense Captions (Multiple Regions)

```python
result = client.analyze_from_url(
    image_url=image_url,
    visual_features=[VisualFeatures.DENSE_CAPTIONS]
)

if result.dense_captions:
    for caption in result.dense_captions.list:
        print(f"Caption: {caption.text}")
        print(f"  Confidence: {caption.confidence:.2f}")
        print(f"  Bounding box: {caption.bounding_box}")
```

## Tags

```python
result = client.analyze_from_url(
    image_url=image_url,
    visual_features=[VisualFeatures.TAGS]
)

if result.tags:
    for tag in result.tags.list:
        print(f"Tag: {tag.name} (confidence: {tag.confidence:.2f})")
```

## Object Detection

```python
result = client.analyze_from_url(
    image_url=image_url,
    visual_features=[VisualFeatures.OBJECTS]
)

if result.objects:
    for obj in result.objects.list:
        print(f"Object: {obj.tags[0].name}")
        print(f"  Confidence: {obj.tags[0].confidence:.2f}")
        box = obj.bounding_box
        print(f"  Bounding box: x={box.x}, y={box.y}, w={box.width}, h={box.height}")
```

## OCR (Text Extraction)

```python
result = client.analyze_from_url(
    image_url=image_url,
    visual_features=[VisualFeatures.READ]
)

if result.read:
    for block in result.read.blocks:
        for line in block.lines:
            print(f"Line: {line.text}")
            print(f"  Bounding polygon: {line.bounding_polygon}")
            
            # Word-level details
            for word in line.words:
                print(f"  Word: {word.text} (confidence: {word.confidence:.2f})")
```

## People Detection

```python
result = client.analyze_from_url(
    image_url=image_url,
    visual_features=[VisualFeatures.PEOPLE]
)

if result.people:
    for person in result.people.list:
        print(f"Person detected:")
        print(f"  Confidence: {person.confidence:.2f}")
        box = person.bounding_box
        print(f"  Bounding box: x={box.x}, y={box.y}, w={box.width}, h={box.height}")
```

## Smart Cropping

```python
result = client.analyze_from_url(
    image_url=image_url,
    visual_features=[VisualFeatures.SMART_CROPS],
    smart_crops_aspect_ratios=[0.9, 1.33, 1.78]  # Portrait, 4:3, 16:9
)

if result.smart_crops:
    for crop in result.smart_crops.list:
        print(f"Aspect ratio: {crop.aspect_ratio}")
        box = crop.bounding_box
        print(f"  Crop region: x={box.x}, y={box.y}, w={box.width}, h={box.height}")
```

## Async Client

```python
from azure.ai.vision.imageanalysis.aio import ImageAnalysisClient
from azure.identity.aio import DefaultAzureCredential

async def analyze_image():
    async with DefaultAzureCredential() as credential:
        async with ImageAnalysisClient(
            endpoint=endpoint,
            credential=credential
        ) as client:
            result = await client.analyze_from_url(
                image_url=image_url,
                visual_features=[VisualFeatures.CAPTION]
            )
            print(result.caption.text)
```

## Visual Features

| Feature | Description |
|---------|-------------|
| `CAPTION` | Single sentence describing the image |
| `DENSE_CAPTIONS` | Captions for multiple regions |
| `TAGS` | Content tags (objects, scenes, actions) |
| `OBJECTS` | Object detection with bounding boxes |
| `READ` | OCR text extraction |
| `PEOPLE` | People detection with bounding boxes |
| `SMART_CROPS` | Suggested crop regions for thumbnails |

## Error Handling

```python
from azure.core.exceptions import HttpResponseError

try:
    result = client.analyze_from_url(
        image_url=image_url,
        visual_features=[VisualFeatures.CAPTION]
    )
except HttpResponseError as e:
    print(f"Status code: {e.status_code}")
    print(f"Reason: {e.reason}")
    print(f"Message: {e.error.message}")
```

## Image Requirements

- Formats: JPEG, PNG, GIF, BMP, WEBP, ICO, TIFF, MPO
- Max size: 20 MB
- Dimensions: 50x50 to 16000x16000 pixels

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.ai.vision.imageanalysis` sync clients with `azure.ai.vision.imageanalysis.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with ImageAnalysisClient(...) as client:` (sync) or `async with ImageAnalysisClient(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Select only needed features** to optimize latency and cost
4. **Use async client** for high-throughput scenarios
5. **Handle HttpResponseError** for invalid images or auth issues
6. **Enable gender_neutral_caption** for inclusive descriptions
7. **Specify language** for localized captions
8. **Use smart_crops_aspect_ratios** matching your thumbnail requirements
9. **Cache results** when analyzing the same image multiple times

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Additional non-hero capabilities, operation-group coverage, and production checklists. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples for secondary/advanced scenarios. |
