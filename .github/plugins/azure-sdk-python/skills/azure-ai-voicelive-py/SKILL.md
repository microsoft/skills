---
name: azure-ai-voicelive-py
description: Build real-time voice AI applications using Azure AI Voice Live SDK (azure-ai-voicelive). Use this skill when creating Python applications that need real-time bidirectional audio communication with Azure AI, including voice assistants, voice-enabled chatbots, real-time speech-to-speech translation, voice-driven avatars, or any WebSocket-based audio streaming with AI models. Supports Server VAD (Voice Activity Detection), turn-based conversation, function calling, MCP tools, avatar integration, and transcription.
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-ai-voicelive
---

# Azure AI Voice Live SDK

Build real-time voice AI applications with bidirectional WebSocket communication.

## Installation

```bash
pip install azure-ai-voicelive aiohttp azure-identity
```

## Environment Variables

```bash
AZURE_COGNITIVE_SERVICES_ENDPOINT=https://<region>.api.cognitive.microsoft.com  # Required for all auth methods
AZURE_TOKEN_CREDENTIALS=prod # Required only if DefaultAzureCredential is used in production
AZURE_COGNITIVE_SERVICES_KEY=<api-key>  # Only required for the legacy API-key auth path below
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
from azure.ai.voicelive.aio import connect
from azure.identity.aio import DefaultAzureCredential, ManagedIdentityCredential

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()

async with DefaultAzureCredential(require_envvar=True) as credential:
    async with connect(
        endpoint=os.environ["AZURE_COGNITIVE_SERVICES_ENDPOINT"],
        credential=credential,
        model="gpt-4o-realtime-preview",
        credential_scopes=["https://cognitiveservices.azure.com/.default"]
    ) as conn:
        ...
```

### Legacy: API Key (existing keyed deployments)

New code should use `DefaultAzureCredential` above. Use `AzureKeyCredential` only if you have an existing keyed deployment that hasn't been migrated to Entra ID yet — for example, regulated environments still completing their Entra rollout.

```python
import os
from azure.core.credentials import AzureKeyCredential
from azure.ai.voicelive.aio import connect

async with connect(
    endpoint=os.environ["AZURE_COGNITIVE_SERVICES_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["AZURE_COGNITIVE_SERVICES_KEY"]),
    model="gpt-4o-realtime-preview",
) as conn:
    ...
```

## Quick Start

```python
import asyncio
import os
from azure.ai.voicelive.aio import connect
from azure.identity.aio import DefaultAzureCredential

async def main():
    async with connect(
        endpoint=os.environ["AZURE_COGNITIVE_SERVICES_ENDPOINT"],
        credential=DefaultAzureCredential(),
        model="gpt-4o-realtime-preview",
        credential_scopes=["https://cognitiveservices.azure.com/.default"]
    ) as conn:
        # Update session with instructions
        await conn.session.update(session={
            "instructions": "You are a helpful assistant.",
            "modalities": ["text", "audio"],
            "voice": "alloy"
        })
        
        # Listen for events
        async for event in conn:
            print(f"Event: {event.type}")
            if event.type == "response.audio_transcript.done":
                print(f"Transcript: {event.transcript}")
            elif event.type == "response.done":
                break

asyncio.run(main())
```

## Core Architecture

### Connection Resources

The `VoiceLiveConnection` exposes these resources:

| Resource | Purpose | Key Methods |
|----------|---------|-------------|
| `conn.session` | Session configuration | `update(session=...)` |
| `conn.response` | Model responses | `create()`, `cancel()` |
| `conn.input_audio_buffer` | Audio input | `append()`, `commit()`, `clear()` |
| `conn.output_audio_buffer` | Audio output | `clear()` |
| `conn.conversation` | Conversation state | `item.create()`, `item.delete()`, `item.truncate()` |
| `conn.transcription_session` | Transcription config | `update(session=...)` |

## Session Configuration

```python
from azure.ai.voicelive.models import RequestSession, FunctionTool

await conn.session.update(session=RequestSession(
    instructions="You are a helpful voice assistant.",
    modalities=["text", "audio"],
    voice="alloy",  # or "echo", "shimmer", "sage", etc.
    input_audio_format="pcm16",
    output_audio_format="pcm16",
    turn_detection={
        "type": "server_vad",
        "threshold": 0.5,
        "prefix_padding_ms": 300,
        "silence_duration_ms": 500
    },
    tools=[
        FunctionTool(
            type="function",
            name="get_weather",
            description="Get current weather",
            parameters={
                "type": "object",
                "properties": {
                    "location": {"type": "string"}
                },
                "required": ["location"]
            }
        )
    ]
))
```

## Audio Streaming

### Send Audio (Base64 PCM16)

```python
import base64

# Read audio chunk (16-bit PCM, 24kHz mono)
audio_chunk = await read_audio_from_microphone()
b64_audio = base64.b64encode(audio_chunk).decode()

await conn.input_audio_buffer.append(audio=b64_audio)
```

### Receive Audio

```python
async for event in conn:
    if event.type == "response.audio.delta":
        audio_bytes = base64.b64decode(event.delta)
        await play_audio(audio_bytes)
    elif event.type == "response.audio.done":
        print("Audio complete")
```

## Event Handling

```python
async for event in conn:
    match event.type:
        # Session events
        case "session.created":
            print(f"Session: {event.session}")
        case "session.updated":
            print("Session updated")
        
        # Audio input events
        case "input_audio_buffer.speech_started":
            print(f"Speech started at {event.audio_start_ms}ms")
        case "input_audio_buffer.speech_stopped":
            print(f"Speech stopped at {event.audio_end_ms}ms")
        
        # Transcription events
        case "conversation.item.input_audio_transcription.completed":
            print(f"User said: {event.transcript}")
        case "conversation.item.input_audio_transcription.delta":
            print(f"Partial: {event.delta}")
        
        # Response events
        case "response.created":
            print(f"Response started: {event.response.id}")
        case "response.audio_transcript.delta":
            print(event.delta, end="", flush=True)
        case "response.audio.delta":
            audio = base64.b64decode(event.delta)
        case "response.done":
            print(f"Response complete: {event.response.status}")
        
        # Function calls
        case "response.function_call_arguments.done":
            result = handle_function(event.name, event.arguments)
            await conn.conversation.item.create(item={
                "type": "function_call_output",
                "call_id": event.call_id,
                "output": json.dumps(result)
            })
            await conn.response.create()
        
        # Errors
        case "error":
            print(f"Error: {event.error.message}")
```

## Common Patterns

### Manual Turn Mode (No VAD)

```python
await conn.session.update(session={"turn_detection": None})

# Manually control turns
await conn.input_audio_buffer.append(audio=b64_audio)
await conn.input_audio_buffer.commit()  # End of user turn
await conn.response.create()  # Trigger response
```

### Interrupt Handling

```python
async for event in conn:
    if event.type == "input_audio_buffer.speech_started":
        # User interrupted - cancel current response
        await conn.response.cancel()
        await conn.output_audio_buffer.clear()
```

### Conversation History

```python
# Add system message
await conn.conversation.item.create(item={
    "type": "message",
    "role": "system",
    "content": [{"type": "input_text", "text": "Be concise."}]
})

# Add user message
await conn.conversation.item.create(item={
    "type": "message",
    "role": "user", 
    "content": [{"type": "input_text", "text": "Hello!"}]
})

await conn.response.create()
```

## Voice Options

| Voice | Description |
|-------|-------------|
| `alloy` | Neutral, balanced |
| `echo` | Warm, conversational |
| `shimmer` | Clear, professional |
| `sage` | Calm, authoritative |
| `coral` | Friendly, upbeat |
| `ash` | Deep, measured |
| `ballad` | Expressive |
| `verse` | Storytelling |

Azure voices: Use `AzureStandardVoice`, `AzureCustomVoice`, or `AzurePersonalVoice` models.

## Audio Formats

| Format | Sample Rate | Use Case |
|--------|-------------|----------|
| `pcm16` | 24kHz | Default, high quality |
| `pcm16-8000hz` | 8kHz | Telephony |
| `pcm16-16000hz` | 16kHz | Voice assistants |
| `g711_ulaw` | 8kHz | Telephony (US) |
| `g711_alaw` | 8kHz | Telephony (EU) |

## Turn Detection Options

```python
# Server VAD (default)
{"type": "server_vad", "threshold": 0.5, "silence_duration_ms": 500}

# Azure Semantic VAD (smarter detection)
{"type": "azure_semantic_vad"}
{"type": "azure_semantic_vad_en"}  # English optimized
{"type": "azure_semantic_vad_multilingual"}
```

## Error Handling

```python
from azure.ai.voicelive.aio import ConnectionError, ConnectionClosed

try:
    async with connect(...) as conn:
        async for event in conn:
            if event.type == "error":
                print(f"API Error: {event.error.code} - {event.error.message}")
except ConnectionClosed as e:
    print(f"Connection closed: {e.code} - {e.reason}")
except ConnectionError as e:
    print(f"Connection error: {e}")
```

## Best Practices

1. **This SDK is async-only; use the `.aio` namespace throughout.** Do not try to pair it with sync clients from other Azure SDKs in the same call path — keep the whole request path async.
2. **Always use context managers for clients and async credentials.** Wrap every connection in `async with connect(...) as conn:`. For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.

## References

- **Detailed API Reference**: See [references/api-reference.md](references/api-reference.md)
- **Complete Examples**: See [references/examples.md](references/examples.md)
- **All Models & Types**: See [references/models.md](references/models.md)
