---
name: azure-ai
description: "Build and troubleshoot Azure AI Search, Speech, OpenAI, and Document Intelligence apps. WHEN: AI Search, vector search, hybrid search, semantic search, speech-to-text, text-to-speech, transcribe, fast or batch transcription, Speech SDK logs, session ID, result ID, OCR."
license: MIT
metadata:
  author: Microsoft
  version: "1.2.4"
---

# Azure AI Services

## Scope and Handoffs

| Request Scope | Route To |
|---------------|----------|
| Foundry projects, agents (Prompt/Hosted/Voice), model deployments, fine-tuning, quota, RBAC, Foundry VNet | `microsoft-foundry` |
| Classic AI Search, Speech SDK/REST/batch, Document Intelligence, OpenAI SDK | Stay in `azure-ai` |

## Services and Diagnostic Workflows

Read the matching reference before diagnosing errors, validating local inputs, or collecting support evidence:

| Service | MCP / CLI | Preflight & Diagnostics |
|---------|-----------|-------------------------|
| **AI Search** (full-text, vector, hybrid, semantic search) | `azure__search` (`search_index_list`, `search_index_get`, `search_query`), `az search` | [Python](references/sdk/azure-search-documents-py.md) \| [TypeScript](references/sdk/azure-search-documents-ts.md) \| [.NET](references/sdk/azure-search-documents-dotnet.md) |
| **Speech** (STT, TTS, Fast/Batch Transcription, Batch Synthesis, SDK logs) | `azure__speech` (`speech_transcribe`, `speech_synthesize`), `az cognitiveservices` | [Speech SDK client diagnostics](references/speech/diagnostics.md) \| [Audio & REST/batch preflight](references/speech/transcription-and-audio-preflight.md) |
| **Document Intelligence** (form extraction, layout, OCR) | `az cognitiveservices` | [.NET](references/sdk/azure-ai-document-intelligence-dotnet.md) \| [TypeScript](references/sdk/azure-ai-document-intelligence-ts.md) |
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
