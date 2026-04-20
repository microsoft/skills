---
name: azure-maf-getting-started-py
description: This skill should be used when the user asks to "get started with MAF", "create first agent", "install agent-framework", "set up MAF project", "run basic agent", "ChatAgent", "agent.run", "run_stream", "AgentThread", "agent-framework-core", "pip install agent-framework", or needs guidance on Microsoft Agent Framework fundamentals, project setup, or first agent creation in Python. Make sure to use this skill whenever the user mentions installing or setting up Agent Framework, creating their first agent, running a simple agent example, multi-turn conversations with threads, streaming agent output, or sending multimodal input to an agent, even if they don't explicitly say "getting started".
version: 0.1.0
---

# MAF Getting Started - Python

This skill provides guidance for setting up and running first agents with Microsoft Agent Framework (MAF) in Python. Use it when installing the framework, creating a basic agent, understanding core abstractions, or running first multi-turn conversations.

## What is MAF?

Microsoft Agent Framework is an open-source development kit for building AI agents and multi-agent workflows in Python and .NET. It unifies ideas from Semantic Kernel and AutoGen, combining simple agent abstractions with enterprise features: thread-based state, type safety, middleware, telemetry, and broad model support.

## Two Primary Categories

| Category | Description | When to Use |
|----------|-------------|-------------|
| **AI Agents** | Individual agents using LLMs to process inputs, call tools, and generate responses | Autonomous decision-making, ad hoc planning, conversation-based interactions |
| **Workflows** | Graph-based orchestration of multiple agents and functions | Predefined sequences, multi-step coordination, checkpointing, human-in-the-loop |

## Prerequisites

- Python 3.10 or later
- Azure AI project or OpenAI API key
- Azure CLI installed and authenticated (`az login`) if using Azure

## Installation

```bash
# Stable release (recommended default)
pip install -U agent-framework

# Full framework (all official packages)
pip install agent-framework --pre

# Minimal: core only (OpenAI, Azure OpenAI)
pip install agent-framework-core --pre

# Azure AI Foundry
pip install agent-framework-azure-ai --pre
```

Use `--pre` only when you need preview or nightly features that are not in the stable release.

## Quick Start: Create and Run an Agent

```python
import asyncio
from agent_framework.openai import OpenAIChatClient

async def main():
    agent = OpenAIChatClient().as_agent(
        instructions="You are a helpful assistant."
    )
    result = await agent.run("What is the capital of France?")
    print(result.text)

asyncio.run(main())
```

With Azure AI:

```python
import asyncio
from agent_framework.azure import AzureAIClient
from azure.identity.aio import AzureCliCredential

async def main():
    async with (
        AzureCliCredential() as credential,
        AzureAIClient(async_credential=credential).as_agent(
            instructions="You are good at telling jokes."
        ) as agent,
    ):
        result = await agent.run("Tell me a joke about a pirate.")
        print(result.text)

asyncio.run(main())
```

## Core Abstractions

| Abstraction | Role |
|-------------|------|
| `ChatAgent` | Wraps a chat client. Created via `client.as_agent()` or `ChatAgent(chat_client=..., instructions=..., tools=...)` |
| `BaseAgent` / `AgentProtocol` | Base for custom agents. Implement `run()` and `run_stream()` |
| `AgentThread` | Holds conversation state. Agents are stateless; all state lives in the thread |
| `AgentResponse` | Non-streaming result with `.text` and `.messages` |
| `AgentResponseUpdate` | Streaming chunk with `.text` and `.contents` |
| `ChatMessage` | Input/output message with `TextContent`, `UriContent`, or `DataContent` |

## Multi-Turn Conversations

Create a thread and pass it to each run:

```python
thread = agent.get_new_thread()
r1 = await agent.run("My name is Alice", thread=thread)
r2 = await agent.run("What's my name?", thread=thread)  # Remembers Alice
```

Serialize threads for persistence across sessions:

```python
serialized = await thread.serialize()
# Store to file or database
restored = await agent.deserialize_thread(loaded_data)
```

## Streaming

Use `run_stream()` for real-time output:

```python
async for chunk in agent.run_stream("Tell me a story"):
    if chunk.text:
        print(chunk.text, end="", flush=True)
```

## Run Options and Defaults

Use per-call `options` or agent-level `default_options` to control provider-specific behavior (for example, temperature and max tokens).

```python
agent = OpenAIChatClient().as_agent(
    instructions="You are concise.",
    default_options={"temperature": 0.2, "max_tokens": 300},
)

result = await agent.run(
    "Summarize this change list.",
    options={"temperature": 0.0},
)
```

## Chat History Store Intro

For providers that do not store history server-side, use `chat_message_store_factory` to create one message store per thread. For full persistence patterns, see `maf-memory-state-py`.

## Multimodal Input

Pass images, audio, or documents via `ChatMessage`:

```python
from agent_framework import ChatMessage, TextContent, UriContent, Role

messages = [
    ChatMessage(role=Role.USER, contents=[
        TextContent(text="What is in this image?"),
        UriContent(uri="https://example.com/photo.jpg", media_type="image/jpeg"),
    ])
]
result = await agent.run(messages, thread=thread)
```

## What to Learn Next

| Topic | Skill |
|-------|-------|
| Configure specific providers (OpenAI, Azure, Anthropic) | **maf-agent-types-py** |
| Add tools, RAG, MCP integration | **maf-tools-rag-py** |
| Memory and chat history persistence | **maf-memory-state-py** |
| Build multi-agent workflows | **maf-workflow-fundamentals-py** |
| Orchestration patterns (sequential, concurrent, group chat) | **maf-orchestration-patterns-py** |
| Host and deploy agents | **maf-hosting-deployment-py** |

## Additional Resources

### Reference Files

For detailed setup, tutorials, and core concept deep-dives:

- **`references/quick-start.md`** -- Full step-by-step project setup, environment configuration, package options, Azure CLI authentication, nightly builds
- **`references/core-concepts.md`** -- Agent type hierarchy, AgentThread lifecycle, message and content types, run options, streaming patterns, response handling
- **`references/tutorials.md`** -- Hands-on tutorials: create and run agents, multi-turn conversations, multimodal input, system messages, thread serialization
- **`references/acceptance-criteria.md`** -- Correct/incorrect patterns for installation, imports, agent creation, credentials, running agents, threading, multimodal input, environment variables, and run options

### Provider and Version Caveats

- Prefer stable packages by default; use `--pre` only when preview features are required.
- Some agent types support server-managed history while others require local/custom chat stores.
