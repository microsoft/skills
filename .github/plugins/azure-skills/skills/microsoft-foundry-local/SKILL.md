---
name: microsoft-foundry-local
description: "Build AI applications with Foundry Local — a lightweight runtime that downloads, manages, and serves language models entirely on-device via an OpenAI-compatible API. No cloud, no API keys. Routes to specific skills for setup, chat, RAG, agents, whisper, custom models, and evaluation. WHEN: foundry local, on-device AI, local LLM, foundry local overview, what can foundry do, foundry local help, local inference, offline AI, private AI, no cloud AI, foundry capabilities."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Foundry Local — Skill Hub

Foundry Local is an on-device AI runtime that serves language models via an OpenAI-compatible API at `http://localhost:<port>/v1`. No cloud services, API keys, or Azure subscriptions required.

## Skill Routing

| Need | Skill | Triggers |
|------|-------|----------|
| Install CLI, start service, manage models | **setup** | install, CLI, service start/stop, model download, port discovery |
| Chat completions (streaming, multi-turn) | **chat** | chat, streaming, conversation history, OpenAI SDK |
| Retrieval-Augmented Generation | **rag** | RAG, knowledge base, context injection, document grounding |
| Single & multi-agent workflows | **agents** | agent, multi-agent, orchestration, Agent Framework |
| Audio transcription with Whisper | **whisper** | whisper, transcribe, speech-to-text, audio |
| Compile custom Hugging Face models | **custom-models** | custom model, ONNX, Model Builder, Hugging Face, quantize |
| Test & evaluate LLM output quality | **evaluation** | evaluate, golden dataset, LLM judge, prompt comparison |

## Quick Reference

- **API key**: Always `"not-required"`
- **Base URL**: Dynamic port — use SDK to discover: `manager.get_endpoint()`
- **Supported languages**: Python, JavaScript (Node.js), C# (.NET 9)
- **Key SDKs**: `foundry-local-sdk` (Python/JS), `Microsoft.AI.Foundry.Local` (C#)

## Common Starting Points

### Install Foundry Local
```bash
# Windows
winget install Microsoft.FoundryLocal

# macOS
brew install foundrylocal
```

### List available models
```bash
foundry model list
```

### Start a model
```bash
foundry model run phi-4-mini
```

### Connect with Python
```python
from foundry_local import FoundryLocalManager

manager = FoundryLocalManager("phi-4-mini")
client = manager.get_openai_client()
```

### Connect with JavaScript
```javascript
import { FoundryLocalManager } from "foundry-local-sdk";

const manager = await FoundryLocalManager.start("phi-4-mini");
const client = manager.getOpenAIClient();
```

### Connect with C#
```csharp
using Microsoft.AI.Foundry.Local;
using OpenAI;

var manager = await FoundryLocalManager.StartServiceAsync();
var client = new OpenAIClient(new("not-required"),
    new() { Endpoint = manager.Endpoint });
```

## Rules

1. Always use the SDK for endpoint discovery — never hard-code ports.
2. Set `api_key` to `"not-required"` — Foundry Local doesn't use API keys.
3. Route to the specific sub-skill for detailed patterns and troubleshooting.
4. All code runs entirely on-device — no network calls to cloud APIs.

## References

- [Foundry Local](https://learn.microsoft.com/en-us/azure/foundry-local/)
