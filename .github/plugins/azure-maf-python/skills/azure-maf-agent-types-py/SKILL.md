---
name: azure-maf-agent-types-py
description: This skill should be used when the user asks to "configure agent", "OpenAI agent", "Azure agent", "Anthropic agent", "Foundry agent", "durable agent", "custom agent", "ChatClient agent", "agent type", or "provider configuration" and needs a single reference for configuring any Microsoft Agent Framework (MAF) provider backend in Python. Make sure to use this skill whenever the user asks about choosing between agent providers, setting up credentials or environment variables for an agent, creating any kind of MAF agent instance, or working with Azure OpenAI, OpenAI, Anthropic, A2A, or durable agents, even if they don't explicitly mention "agent type".
version: 0.1.0
---

# MAF Agent Types - Python Configuration Reference

This skill provides a single reference for configuring any Microsoft Agent Framework (MAF) provider backend in Python. Use this skill when selecting agent types, setting up provider credentials, or wiring agents to inference services.

## Agent Type Hierarchy Overview

All MAF agents derive from a common abstraction. In Python, the hierarchy is:

1. **ChatAgent** – Wraps any chat client. Created via `<ProviderClient>.as_agent(instructions=..., tools=...)` or `ChatAgent(chat_client=<ProviderClient>(), instructions=..., tools=...)`.
2. **BaseAgent / AgentProtocol** – Base for fully custom agents. Implement `run()` and `run_stream()` for complete control.
3. **Specialized clients** – Each provider exposes a client class (e.g., `OpenAIChatClient`, `AzureOpenAIChatClient`, `AzureAIAgentClient`, `AnthropicClient`) that produces a `ChatAgent` when `.as_agent()` is called.

Chat-based agents support function calling, multi-turn conversations (with thread management), custom tools (MCP, code interpreter, web search), structured output, and streaming responses.

## Quick-Start: Provider Selection Table

| Provider | Client Class | Package | Service Chat History | Custom Chat History |
|----------|--------------|---------|----------------------|---------------------|
| OpenAI ChatCompletion | `OpenAIChatClient` | `agent-framework-core` | No | Yes |
| OpenAI Responses | `OpenAIResponsesClient` | `agent-framework-core` | Yes | Yes |
| OpenAI Assistants | `OpenAIAssistantsClient` | `agent-framework` | Yes | No |
| Azure OpenAI ChatCompletion | `AzureOpenAIChatClient` | `agent-framework-core` | No | Yes |
| Azure OpenAI Responses | `AzureOpenAIResponsesClient` | `agent-framework-core` | Yes | Yes |
| Azure AI Foundry | `AzureAIAgentClient` | `agent-framework-azure-ai` | Yes | No |
| Anthropic | `AnthropicClient` | `agent-framework-anthropic` | Yes | Yes |
| Azure AI Foundry Models ChatCompletion | `OpenAIChatClient` with custom endpoint | `agent-framework-core` | No | Yes |
| Azure AI Foundry Models Responses | `OpenAIResponsesClient` with custom endpoint | `agent-framework-core` | No | Yes |
| Any ChatClient | `ChatAgent(chat_client=...)` | `agent-framework` | Varies | Varies |
| A2A (remote) | `A2AAgent` | `agent-framework-a2a` | Remote | N/A |
| Durable (Azure Functions) | `AgentFunctionApp` | `agent-framework-azurefunctions` | Durable | N/A |

## Provider Capability Snapshot

Use this as a high-level guide and verify final support in provider docs before shipping.

| Provider | Streaming | Function Tools | Hosted Tools | Service-Managed History |
|----------|-----------|----------------|--------------|--------------------------|
| OpenAI ChatCompletion | Yes | Yes | Limited | No |
| OpenAI Responses | Yes | Yes | Limited | Yes |
| Azure OpenAI ChatCompletion | Yes | Yes | Limited | No |
| Azure OpenAI Responses | Yes | Yes | Limited | Yes |
| Azure AI Foundry | Yes | Yes | Yes (`HostedWebSearchTool`, `HostedCodeInterpreterTool`, `HostedFileSearchTool`, `HostedMCPTool`) | Yes |
| Anthropic | Yes | Yes | Provider-dependent | Yes |

## Common Configuration Patterns

### Environment Variables First

Use environment variables for credentials and model IDs. Most clients read `OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `ANTHROPIC_API_KEY`, etc. automatically.

### Explicit Configuration

Pass credentials and endpoints explicitly when not using env vars:

```python
agent = OpenAIChatClient(
    ai_model_id="gpt-4o-mini",
    api_key="your-api-key-here",
).as_agent(instructions="You are a helpful assistant.")
```

### Azure Credentials

Use `AzureCliCredential` or `DefaultAzureCredential` for Azure OpenAI providers (sync credential):

```python
from azure.identity import AzureCliCredential
from agent_framework.azure import AzureOpenAIChatClient

agent = AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
    instructions="You are a helpful assistant."
)
```

### Async Context Managers

Azure AI Foundry and OpenAI Assistants agents require async context managers. Azure AI Foundry uses the **async** credential from `azure.identity.aio`:

```python
from azure.identity.aio import AzureCliCredential
from agent_framework.azure import AzureAIAgentClient

async with (
    AzureCliCredential() as credential,
    AzureAIAgentClient(async_credential=credential).as_agent(
        instructions="You are helpful."
    ) as agent,
):
    result = await agent.run("Hello!")
```

### Function Tools

Attach tools via the `tools` parameter. Use Pydantic `Annotated` and `Field` for schema:

```python
from typing import Annotated
from pydantic import Field

def get_weather(location: Annotated[str, Field(description="The location.")]) -> str:
    return f"Weather in {location} is sunny."

agent = client.as_agent(instructions="...", tools=get_weather)
```

### Thread Management

Maintain conversation context with threads:

```python
thread = agent.get_new_thread()
r1 = await agent.run("My name is Alice.", thread=thread, store=True)
r2 = await agent.run("What's my name?", thread=thread, store=True)  # Remembers Alice
```

### Streaming

Use `run_stream()` for incremental output:

```python
async for chunk in agent.run_stream("Tell me a story"):
    if chunk.text:
        print(chunk.text, end="", flush=True)
```

## Environment Variables Summary

| Provider | Required | Optional |
|----------|----------|----------|
| OpenAI ChatCompletion | `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL_ID` | — |
| OpenAI Responses | `OPENAI_API_KEY`, `OPENAI_RESPONSES_MODEL_ID` | — |
| OpenAI Assistants | `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL_ID` | — |
| Azure OpenAI ChatCompletion | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_CHAT_DEPLOYMENT_NAME` | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_API_VERSION` |
| Azure OpenAI Responses | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_RESPONSES_DEPLOYMENT_NAME` | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_API_VERSION` |
| Azure AI Foundry | `AZURE_AI_PROJECT_ENDPOINT`, `AZURE_AI_MODEL_DEPLOYMENT_NAME` | — |
| Anthropic | `ANTHROPIC_API_KEY`, `ANTHROPIC_CHAT_MODEL_ID` | — |
| Anthropic on Foundry | `ANTHROPIC_FOUNDRY_API_KEY`, `ANTHROPIC_FOUNDRY_RESOURCE` | — |
| Durable (Azure Functions) | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME` | — |

## Installation Quick Reference

```bash
# Core (OpenAI ChatCompletion, Responses; Azure OpenAI ChatCompletion, Responses)
pip install agent-framework-core --pre

# Full framework (includes Assistants, ChatClient)
pip install agent-framework --pre

# Azure AI Foundry
pip install agent-framework-azure-ai --pre

# Anthropic
pip install agent-framework-anthropic --pre

# A2A
pip install agent-framework-a2a --pre

# Durable (Azure Functions)
pip install agent-framework-azurefunctions --pre
```

## Additional Resources

### Reference Files

For detailed setup, code examples, and provider-specific patterns:

- **`references/openai-providers.md`** – OpenAI ChatCompletion, Responses, and Assistants agents
- **`references/azure-providers.md`** – Azure OpenAI ChatCompletion/Responses and Azure AI Foundry agents
- **`references/anthropic-provider.md`** – Anthropic Claude agent (public API and Azure Foundry)
- **`references/custom-and-advanced.md`** – Custom agents (BaseAgent/AgentProtocol), ChatClient, A2A, and durable agents
- **`references/acceptance-criteria.md`** – Correct/incorrect patterns for imports, credentials, env vars, tools, and more

### Provider and Version Caveats

- Treat specific model IDs as examples, not permanent values; verify current IDs in provider docs.
- Anthropic on Foundry requires `ANTHROPIC_FOUNDRY_API_KEY` and `ANTHROPIC_FOUNDRY_RESOURCE`.
