# Quick Start Guide - Python

Complete step-by-step setup for creating and running a basic agent with Microsoft Agent Framework in Python.

## Prerequisites

- [Python 3.10 or later](https://www.python.org/downloads/)
- An [Azure AI](/azure/ai-foundry/) project with a deployed model (e.g., `gpt-4o-mini`) or an OpenAI API key
- [Azure CLI](/cli/azure/install-azure-cli) installed and authenticated (`az login`) if using Azure

## Installation Options

### Full Framework

Install the meta-package that includes all official sub-packages:

```bash
pip install -U agent-framework
```

Use this stable command by default. Use pre-release packages only if you need preview features:

```bash
pip install agent-framework --pre
```

This installs `agent-framework-core` and all provider packages (Azure AI, OpenAI Assistants, etc.).

### Minimal Install

Install only the core package for OpenAI and Azure OpenAI ChatCompletion/Responses:

```bash
pip install agent-framework-core --pre
```

### Provider-Specific Packages

```bash
# Azure AI Foundry
pip install agent-framework-azure-ai --pre

# Anthropic
pip install agent-framework-anthropic --pre

# A2A (Agent-to-Agent)
pip install agent-framework-a2a --pre

# Durable agents (Azure Functions)
pip install agent-framework-azurefunctions --pre

# Mem0 long-term memory
pip install agent-framework-mem0 --pre

# DevUI (development testing)
pip install agent-framework-devui --pre

# AG-UI (production hosting)
pip install agent-framework-ag-ui --pre

# Declarative workflows
pip install agent-framework-declarative --pre
```

All provider packages depend on `agent-framework-core`, so it installs automatically.

## Environment Variables

### OpenAI

```bash
export OPENAI_API_KEY="your-api-key"
export OPENAI_CHAT_MODEL_ID="gpt-4o-mini"  # Optional, can pass explicitly
```

### Azure OpenAI

```bash
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
export AZURE_OPENAI_CHAT_DEPLOYMENT_NAME="gpt-4o-mini"
# If using API key instead of Azure CLI:
export AZURE_OPENAI_API_KEY="your-api-key"
```

### Azure AI Foundry

```bash
export AZURE_AI_PROJECT_ENDPOINT="https://<your-project>.services.ai.azure.com/api/projects/<project-id>"
export AZURE_AI_MODEL_DEPLOYMENT_NAME="gpt-4o-mini"
```

## Quick Start with OpenAI

```python
import asyncio
from agent_framework.openai import OpenAIChatClient

async def main():
    agent = OpenAIChatClient(
        ai_model_id="gpt-4o-mini",
        api_key="your-api-key",  # Or set OPENAI_API_KEY env var
    ).as_agent(instructions="You are good at telling jokes.")

    result = await agent.run("Tell me a joke about a pirate.")
    print(result.text)

asyncio.run(main())
```

## Quick Start with Azure AI Foundry

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

## Quick Start with Azure OpenAI

```python
import asyncio
from agent_framework.azure import AzureOpenAIChatClient
from azure.identity import AzureCliCredential

async def main():
    agent = AzureOpenAIChatClient(
        credential=AzureCliCredential(),
    ).as_agent(instructions="You are good at telling jokes.")

    result = await agent.run("Tell me a joke about a pirate.")
    print(result.text)

asyncio.run(main())
```

## Streaming Quick Start

```python
import asyncio
from agent_framework.openai import OpenAIChatClient

async def main():
    agent = OpenAIChatClient().as_agent(
        instructions="You are a storyteller."
    )
    async for chunk in agent.run_stream("Tell me a short story about a robot."):
        if chunk.text:
            print(chunk.text, end="", flush=True)
    print()

asyncio.run(main())
```

## Run Options Quick Start

Use `default_options` on the agent, then override with per-run `options` when needed.

```python
agent = OpenAIChatClient().as_agent(
    instructions="You are concise.",
    default_options={"temperature": 0.2, "max_tokens": 300},
)

result = await agent.run(
    "Summarize this paragraph.",
    options={"temperature": 0.0},
)
```

## Message Store Quick Start

For providers without service-managed history, pass `chat_message_store_factory` so each thread gets its own store instance.

## Multi-Turn Quick Start

```python
import asyncio
from agent_framework.openai import OpenAIChatClient

async def main():
    agent = OpenAIChatClient().as_agent(
        instructions="You are a helpful assistant."
    )
    thread = agent.get_new_thread()

    r1 = await agent.run("My name is Alice.", thread=thread)
    print(f"Agent: {r1.text}")

    r2 = await agent.run("What's my name?", thread=thread)
    print(f"Agent: {r2.text}")  # Should remember Alice

asyncio.run(main())
```

## Thread Persistence

Serialize a thread to resume later:

```python
import json

# Save
serialized = await thread.serialize()
with open("thread.json", "w") as f:
    json.dump(serialized, f)

# Restore
with open("thread.json") as f:
    loaded = json.load(f)
restored_thread = await agent.deserialize_thread(loaded)
r3 = await agent.run("What did we discuss?", thread=restored_thread)
```

## Nightly Builds

Nightly builds are available from the [Agent Framework GitHub repository](https://github.com/microsoft/agent-framework). Install nightly packages using pip with the GitHub Packages index:

```bash
pip install --extra-index-url https://github.com/microsoft/agent-framework/releases agent-framework --pre
```

Consult the [GitHub repository](https://github.com/microsoft/agent-framework) for the latest nightly build instructions and package availability.

## Common Issues

| Issue | Resolution |
|-------|------------|
| `ModuleNotFoundError: agent_framework` | Install package: `pip install agent-framework --pre` |
| Authentication error with Azure CLI | Run `az login` and ensure correct subscription |
| Model not found | Verify `AZURE_AI_MODEL_DEPLOYMENT_NAME` matches deployed model |
| `async with` required | Some clients (Azure AI, Assistants) require async context manager usage |
| Python version error | Ensure Python 3.10 or later |
