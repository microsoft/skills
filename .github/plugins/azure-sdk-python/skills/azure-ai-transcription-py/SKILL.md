---
name: azure-ai-transcription-py
description: |
  Azure AI Transcription SDK for Python. Use for real-time and batch speech-to-text transcription with timestamps and diarization.
  Triggers: "transcription", "speech to text", "Azure AI Transcription", "TranscriptionClient".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-ai-transcription
---

# Azure AI Transcription SDK for Python

Client library for Azure AI Transcription (speech-to-text) with real-time and batch transcription.

## Installation

```bash
pip install azure-ai-transcription
```

## Environment Variables

```bash
TRANSCRIPTION_ENDPOINT=https://<resource>.cognitiveservices.azure.com
TRANSCRIPTION_KEY=<your-key>  # For key auth; not needed when using DefaultAzureCredential/TokenCredential
```

## Authentication & Lifecycle

> **🔑 Two rules apply to every code sample below:**
>
> 1. **Two auth modes are supported:** `AzureKeyCredential(os.environ["TRANSCRIPTION_KEY"])` for key-based auth, or `DefaultAzureCredential()` / any `TokenCredential` for Entra ID. Prefer `DefaultAzureCredential` in production; never hardcode credentials in code.
> 2. **Wrap every client in a context manager** so HTTP transports and sockets are released deterministically:
>    - Sync: `with <Client>(...) as client:`
>    - Async: `async with <Client>(...) as client:`
>
> Snippets may abbreviate this setup, but production code should always follow both rules.

Use subscription key authentication:

```python
import os
from azure.core.credentials import AzureKeyCredential
from azure.ai.transcription import TranscriptionClient

with TranscriptionClient(
    endpoint=os.environ["TRANSCRIPTION_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["TRANSCRIPTION_KEY"]),
) as client:
    transcriptions = list(client.list_transcriptions())
```

## Transcription (Batch)

```python
import os
from azure.core.credentials import AzureKeyCredential
from azure.ai.transcription import TranscriptionClient

with TranscriptionClient(
    endpoint=os.environ["TRANSCRIPTION_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["TRANSCRIPTION_KEY"]),
) as client:
    job = client.begin_transcription(
        name="meeting-transcription",
        locale="en-US",
        content_urls=["https://<storage>/audio.wav"],
        diarization_enabled=True,
    )
    result = job.result()
    print(result.status)
```

## Transcription (Real-time)

```python
import os
from azure.core.credentials import AzureKeyCredential
from azure.ai.transcription import TranscriptionClient

with TranscriptionClient(
    endpoint=os.environ["TRANSCRIPTION_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["TRANSCRIPTION_KEY"]),
) as client:
    stream = client.begin_stream_transcription(locale="en-US")
    stream.send_audio_file("audio.wav")
    for event in stream:
        print(event.text)
```

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.xxx` sync clients with `azure.xxx.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with Client(...) as client:` (sync) or `async with Client(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Enable diarization** when multiple speakers are present
4. **Use batch transcription** for long files stored in blob storage
5. **Capture timestamps** for subtitle generation
6. **Specify language** to improve recognition accuracy
7. **Handle streaming backpressure** for real-time transcription
8. **Close transcription sessions** when complete

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Additional non-hero capabilities, operation-group coverage, and production checklists. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples for secondary/advanced scenarios. |
