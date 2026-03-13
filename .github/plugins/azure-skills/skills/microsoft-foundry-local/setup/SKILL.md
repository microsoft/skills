---
name: setup
description: "Install, configure, and manage Foundry Local — the on-device AI runtime. Covers CLI installation, service lifecycle, model management, port discovery, and troubleshooting. WHEN: install foundry local, start foundry service, download model, list models, foundry CLI, model not loading, service not starting, port discovery, foundry status, foundry local setup, model alias, cache location, hardware detection, service restart, dynamic port."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Foundry Local Setup & Service Management

This skill provides guidance for installing, configuring, and managing the Foundry Local on-device AI runtime.

> **What is Foundry Local?** A lightweight runtime that downloads, manages, and serves language models entirely on your hardware. It exposes an **OpenAI-compatible API** — no cloud account or API keys required. See [foundrylocal.ai](https://foundrylocal.ai).

## Triggers

Activate this skill when the user wants to:
- Install Foundry Local CLI
- Start, stop, or restart the Foundry Local service
- Download, list, or manage models
- Discover the dynamic endpoint / port
- Understand model aliases vs hardware-specific IDs
- Troubleshoot service startup, model loading, or cache issues
- Set up a new project with Foundry Local SDK

## Rules

1. **Never hardcode ports.** The Foundry Local service uses a dynamic port — always use `manager.endpoint` (Python/JS) or `manager.Urls[0]` (C#).
2. **Cached ≠ loaded.** A model can be cached on disk but not loaded into memory. Always call `load_model()` / `loadModel()` / `LoadAsync()` after confirming the model is cached.
3. **Use aliases, not full IDs.** Aliases like `phi-3.5-mini` auto-select the best hardware variant (CUDA, QNN, CPU). Full IDs are hardware-specific.
4. **API key is always `"not-required"`.** Foundry Local does not authenticate — set `api_key="not-required"` or `"foundry-local"`.

---

## CLI Installation

### Windows
```powershell
winget install Microsoft.FoundryLocal
```

### macOS
```bash
brew tap microsoft/foundrylocal && brew install foundrylocal
```

### Verify
```bash
foundry --version
foundry service status
```

---

## CLI Quick Reference

| Command | Purpose |
|---------|---------|
| `foundry model list` | List all available models in the catalog |
| `foundry model list --source cache` | List only downloaded (cached) models |
| `foundry model run <alias>` | Download (if needed), load, and start interactive chat |
| `foundry service status` | Check if the service is running |
| `foundry service stop` | Stop the service |
| `foundry cache register --model-path <path> --alias <name>` | Register a custom compiled model |

---

## SDK Lifecycle — 7-Step Pattern (All Languages)

Every Foundry Local application follows the same architecture:

1. **Create manager** — no parameters required
2. **Start service** — spawns the inference server on a dynamic port
3. **Query catalog** — list available models
4. **Check cache** — distinguish "available" from "downloaded"
5. **Download if needed** — with progress callbacks
6. **Load into memory** — required before inference; resolves full model ID
7. **Create OpenAI client** — use `manager.endpoint` + dummy API key

### Python

```python
from foundry_local import FoundryLocalManager
import openai

alias = "phi-3.5-mini"

manager = FoundryLocalManager()
manager.start_service()

# Check cache and download if needed
cached = manager.list_cached_models()
catalog_info = manager.get_model_info(alias)
is_cached = any(m.id == catalog_info.id for m in cached) if catalog_info else False

if not is_cached:
    manager.download_model(alias, progress_callback=lambda p: print(f"{p:.0f}%"))

manager.load_model(alias)

client = openai.OpenAI(
    base_url=manager.endpoint,
    api_key=manager.api_key  # "not-required"
)
```

### JavaScript

```javascript
import { FoundryLocalManager } from "foundry-local-sdk";
import { OpenAI } from "openai";

const alias = "phi-3.5-mini";
const manager = new FoundryLocalManager();
await manager.startService();

const cached = await manager.listCachedModels();
const catalogInfo = await manager.getModelInfo(alias);
const isCached = cached.some(m => m.id === catalogInfo?.id);

if (!isCached) {
    await manager.downloadModel(alias, undefined, false, p => console.log(`${p}%`));
}

const modelInfo = await manager.loadModel(alias);

const client = new OpenAI({
    baseURL: manager.endpoint,
    apiKey: manager.apiKey,
});
```

### C#

```csharp
using Microsoft.AI.Foundry.Local;
using Microsoft.Extensions.Logging.Abstractions;
using OpenAI;
using System.ClientModel;

var alias = "phi-3.5-mini";

await FoundryLocalManager.CreateAsync(
    new Configuration
    {
        AppName = "MyApp",
        Web = new Configuration.WebService { Urls = "http://127.0.0.1:0" }
    }, NullLogger.Instance, default);

var manager = FoundryLocalManager.Instance;
await manager.StartWebServiceAsync(default);

var catalog = await manager.GetCatalogAsync(default);
var model = await catalog.GetModelAsync(alias, default);

if (!await model.IsCachedAsync(default))
    await model.DownloadAsync(null, default);

await model.LoadAsync(default);

var client = new OpenAIClient(
    new ApiKeyCredential("foundry-local"),
    new OpenAIClientOptions { Endpoint = new Uri(manager.Urls[0] + "/v1") });
```

> **C# Note:** The `Microsoft.AI.Foundry.Local` NuGet package requires an explicit `<RuntimeIdentifier>` in your `.csproj` (e.g., `win-x64`, `win-arm64`).

---

## Hardware Auto-Detection

When you use an alias like `phi-3.5-mini`, the SDK automatically selects the best variant:

| Hardware | Execution Provider | Selected Automatically |
|----------|-------------------|----------------------|
| NVIDIA GPU | CUDA | Yes |
| Qualcomm NPU | QNN | Yes (if available) |
| CPU (default) | CPU | Yes (fallback) |

Developers do not need to pick variants — hardware detection is transparent.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Service won't start | Port conflict or stale process | `foundry service stop` then retry |
| Model not found | Alias typo or outdated catalog | Run `foundry model list` to see valid aliases |
| `IsCachedAsync` NullReferenceException | Race condition on first run (C#) | Retry after delay; SDK may not be fully ready |
| HTTP 500 under sustained load | Resource exhaustion after ~13-15 completions | `foundry service stop` then restart; add try/catch with fallback |
| OGA memory leak warnings on exit | SDK doesn't expose Dispose for native resources | Non-blocking; can be ignored |
| Snapdragon CPU warnings | cpuinfo library doesn't recognise Oryon cores | Cosmetic only; inference works correctly |
| C# build fails with NETSDK1047 | Missing `<RuntimeIdentifier>` in `.csproj` | Add `<RuntimeIdentifier>win-x64</RuntimeIdentifier>` |

---

## Key SDK Properties

| Property | Python | JavaScript | C# |
|----------|--------|------------|-----|
| Endpoint | `manager.endpoint` | `manager.endpoint` | `manager.Urls[0] + "/v1"` |
| API key | `manager.api_key` | `manager.apiKey` | `"foundry-local"` (any string) |
| Model ID | `manager.get_model_info(alias).id` | `modelInfo.id` | `model.Id` |
| Cache path | `manager.get_cache_location()` | — | — |

---

## Cross-References

- For chat completion patterns, see **chat**
- For RAG pipelines, see **rag**
- For agent creation, see **agents**
- For custom model compilation, see **custom-models**
