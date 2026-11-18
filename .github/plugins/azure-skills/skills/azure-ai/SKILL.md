---
name: azure-ai
description: "Build and troubleshoot Azure AI Search, Speech, Document Intelligence, Translator, Content Safety, and OpenAI apps. WHEN: AI Search, vector search, hybrid search, semantic search, indexer, speech-to-text, text-to-speech, transcribe, fast or batch transcription, Speech SDK logs, session ID, result ID, OCR, document translation, glossary."
license: MIT
metadata:
  author: Microsoft
  version: "1.2.5"
---

# Azure AI Services

## Scope and Handoffs

| Request Scope | Route To |
|---------------|----------|
| Foundry projects, agents (Prompt/Hosted/Voice), model deployments, fine-tuning, quota, RBAC, Foundry VNet | `microsoft-foundry` |
| Foundry IQ knowledge bases and connectors | `foundry-iq` (separate `foundry-iq-skills` plugin; if absent, say so) |
| Azure API Management AI Gateway policies (`llm-content-safety`, semantic cache, token limits) | `azure-aigateway` |
| Classic AI Search, Speech SDK/REST/batch, Document Intelligence, Translator, standalone Content Safety, OpenAI SDK | Stay in `azure-ai` |

## Services and Diagnostic Workflows

Read the matching reference before diagnosing errors, validating local inputs, or collecting support evidence:

| Service | MCP / CLI | Preflight & Diagnostics |
|---------|-----------|-------------------------|
| **AI Search** (classic indexes, vector/hybrid/semantic queries, indexers/skillsets) | `azure__search` (`search_index_list`, `search_index_get`, `search_query`), `az search` | [Index, query, and indexer diagnostics](references/search/index-and-query-diagnostics.md) |
| **Speech** (STT, TTS, Fast/Batch Transcription, Batch Synthesis, SDK logs) | `azure__speech` (`speech_transcribe`, `speech_synthesize`), `az cognitiveservices` | [Speech SDK client diagnostics](references/speech/diagnostics.md) \| [Audio & REST/batch preflight](references/speech/transcription-and-audio-preflight.md) |
| **Document Intelligence** (`v4.0` Analyze, layout/OCR, custom labels) | `az cognitiveservices` | [Input, v4 migration, and Analyze diagnostics](references/document-intelligence/preflight-and-diagnostics.md) |
| **Translator** (Text & Document Translation, glossaries, Blob auth) | `az cognitiveservices` | [Document Translation & glossary preflight](references/translator/document-translation-preflight.md) |
| **Content Safety** (standalone `text:analyze`, `image:analyze`, `text:shieldPrompt`, blocklists) | `az cognitiveservices` | [Standalone API preflight & diagnostics](references/content-safety/api-preflight-and-diagnostics.md) |
| **OpenAI** (direct SDK/API usage) | `az cognitiveservices` | [.NET SDK](references/sdk/azure-ai-openai-dotnet.md) |

**If Azure MCP is not enabled:** In Copilot CLI or Claude Code, ask the user to run `/mcp` and enable Azure MCP; in other hosts, ask the user to enable Azure MCP through the host's MCP configuration. Offline local preflight scripts do not require Azure MCP or Azure sign-in.

For keyless authentication patterns across Azure AI SDKs, read [Azure Authentication Best Practices](references/auth-best-practices.md).

## SDK Quick References

- **AI Search**: [Python](references/sdk/azure-search-documents-py.md) | [TypeScript](references/sdk/azure-search-documents-ts.md) | [.NET](references/sdk/azure-search-documents-dotnet.md)
- **OpenAI**: [.NET](references/sdk/azure-ai-openai-dotnet.md)
- **Vision**: [Python](references/sdk/azure-ai-vision-imageanalysis-py.md) | [Java](references/sdk/azure-ai-vision-imageanalysis-java.md)
- **Transcription**: [Python](references/sdk/azure-ai-transcription-py.md)
- **Translation**: [Python](references/sdk/azure-ai-translation-text-py.md) | [TypeScript](references/sdk/azure-ai-translation-ts.md)
- **Document Intelligence**: [.NET](references/sdk/azure-ai-document-intelligence-dotnet.md) | [TypeScript](references/sdk/azure-ai-document-intelligence-ts.md)
- **Content Safety**: [Python](references/sdk/azure-ai-contentsafety-py.md) | [TypeScript](references/sdk/azure-ai-contentsafety-ts.md) | [Java](references/sdk/azure-ai-contentsafety-java.md)

## Service Documentation

- [Azure AI Search documentation](https://learn.microsoft.com/azure/search/search-what-is-azure-search)
- [Azure AI Speech documentation](https://learn.microsoft.com/azure/ai-services/speech-service/overview)
- [Azure AI Document Intelligence documentation](https://learn.microsoft.com/azure/ai-services/document-intelligence/overview)
- [Azure AI Translator documentation](https://learn.microsoft.com/azure/ai-services/translator/overview)
- [Azure AI Content Safety documentation](https://learn.microsoft.com/azure/ai-services/content-safety/overview)
