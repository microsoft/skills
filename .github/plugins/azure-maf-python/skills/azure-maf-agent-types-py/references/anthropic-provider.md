# Anthropic Provider Reference (Python)

This reference covers configuring Anthropic Claude agents in Microsoft Agent Framework. Supports both the public Anthropic API and Anthropic on Azure AI Foundry.

## Prerequisites

```bash
pip install agent-framework-anthropic --pre
```

For Anthropic on Foundry, ensure `anthropic>=0.74.0` is installed.

## Environment Variables

### Public API

```bash
ANTHROPIC_API_KEY="your-anthropic-api-key"
ANTHROPIC_CHAT_MODEL_ID="<current-claude-model-id>"
```

Or use a `.env` file:

```env
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_CHAT_MODEL_ID=<current-claude-model-id>
```

### Anthropic on Foundry

```bash
ANTHROPIC_FOUNDRY_API_KEY="your-foundry-api-key"
ANTHROPIC_FOUNDRY_RESOURCE="your-foundry-resource-name"
```

Obtain an API key from the [Anthropic Console](https://console.anthropic.com/).

## Basic Agent Creation

```python
import asyncio
from agent_framework.anthropic import AnthropicClient

async def basic_example():
    agent = AnthropicClient().as_agent(
        name="HelpfulAssistant",
        instructions="You are a helpful assistant.",
    )
    result = await agent.run("Hello, how can you help me?")
    print(result.text)
```

## Explicit Configuration

```python
async def explicit_config_example():
    agent = AnthropicClient(
        model_id="<current-claude-model-id>",
        api_key="your-api-key-here",
    ).as_agent(
        name="HelpfulAssistant",
        instructions="You are a helpful assistant.",
    )
    result = await agent.run("What can you do?")
    print(result.text)
```

## Anthropic on Foundry

Use `AsyncAnthropicFoundry` as the underlying client:

```python
from agent_framework.anthropic import AnthropicClient
from anthropic import AsyncAnthropicFoundry

async def foundry_example():
    agent = AnthropicClient(
        anthropic_client=AsyncAnthropicFoundry()
    ).as_agent(
        name="FoundryAgent",
        instructions="You are a helpful assistant using Anthropic on Foundry.",
    )
    result = await agent.run("How do I use Anthropic on Foundry?")
    print(result.text)
```

Ensure environment variables `ANTHROPIC_FOUNDRY_API_KEY` and `ANTHROPIC_FOUNDRY_RESOURCE` are set.

## Agent Features

### Function Tools

Use `Annotated` for parameter descriptions. Pydantic `Field` can be used for more structured schemas:

```python
from typing import Annotated

def get_weather(
    location: Annotated[str, "The location to get the weather for."],
) -> str:
    """Get the weather for a given location."""
    from random import randint
    conditions = ["sunny", "cloudy", "rainy", "stormy"]
    return f"The weather in {location} is {conditions[randint(0, 3)]} with a high of {randint(10, 30)}°C."

async def tools_example():
    agent = AnthropicClient().as_agent(
        name="WeatherAgent",
        instructions="You are a helpful weather assistant.",
        tools=get_weather,
    )
    result = await agent.run("What's the weather like in Seattle?")
    print(result.text)
```

### Streaming Responses

```python
async def streaming_example():
    agent = AnthropicClient().as_agent(
        name="WeatherAgent",
        instructions="You are a helpful weather agent.",
        tools=get_weather,
    )
    query = "What's the weather like in Portland and in Paris?"
    print(f"User: {query}")
    print("Agent: ", end="", flush=True)
    async for chunk in agent.run_stream(query):
        if chunk.text:
            print(chunk.text, end="", flush=True)
    print()
```

### Hosted Tools

Support for web search, MCP, and code execution:

```python
from agent_framework import HostedMCPTool, HostedWebSearchTool

async def hosted_tools_example():
    agent = AnthropicClient().as_agent(
        name="DocsAgent",
        instructions="You are a helpful agent for both Microsoft docs questions and general questions.",
        tools=[
            HostedMCPTool(
                name="Microsoft Learn MCP",
                url="https://learn.microsoft.com/api/mcp",
            ),
            HostedWebSearchTool(),
        ],
        max_tokens=20000,
    )
    result = await agent.run("Can you compare Python decorators with C# attributes?")
    print(result.text)
```

### Extended Thinking (Reasoning)

Enable thinking/reasoning to surface the model's reasoning process:

```python
from agent_framework import HostedWebSearchTool, TextReasoningContent, UsageContent

async def thinking_example():
    agent = AnthropicClient().as_agent(
        name="DocsAgent",
        instructions="You are a helpful agent.",
        tools=[HostedWebSearchTool()],
        default_options={
            "max_tokens": 20000,
            "thinking": {"type": "enabled", "budget_tokens": 10000}
        },
    )
    query = "Can you compare Python decorators with C# attributes?"
    print(f"User: {query}")
    print("Agent: ", end="", flush=True)

    async for chunk in agent.run_stream(query):
        for content in chunk.contents:
            if isinstance(content, TextReasoningContent):
                print(f"\033[32m{content.text}\033[0m", end="", flush=True)
            if isinstance(content, UsageContent):
                print(f"\n\033[34m[Usage: {content.details}]\033[0m\n", end="", flush=True)
        if chunk.text:
            print(chunk.text, end="", flush=True)
    print()
```

### Anthropic Skills

Anthropic provides managed skills (e.g., creating PowerPoint presentations). Skills require the Code Interpreter tool:

```python
from agent_framework import HostedCodeInterpreterTool, HostedFileContent
from agent_framework.anthropic import AnthropicClient

async def skills_example():
    client = AnthropicClient(additional_beta_flags=["skills-2025-10-02"])
    agent = client.as_agent(
        name="PresentationAgent",
        instructions="You are a helpful agent for creating PowerPoint presentations.",
        tools=HostedCodeInterpreterTool(),
        default_options={
            "max_tokens": 20000,
            "thinking": {"type": "enabled", "budget_tokens": 10000},
            "container": {
                "skills": [{"type": "anthropic", "skill_id": "pptx", "version": "latest"}]
            },
        },
    )
    query = "Create a presentation about renewable energy with 5 slides"
    print(f"User: {query}")
    print("Agent: ", end="", flush=True)

    files: list[HostedFileContent] = []
    async for chunk in agent.run_stream(query):
        for content in chunk.contents:
            match content.type:
                case "text":
                    print(content.text, end="", flush=True)
                case "text_reasoning":
                    print(f"\033[32m{content.text}\033[0m", end="", flush=True)
                case "hosted_file":
                    files.append(content)

    print("\n")
    if files:
        print("Generated files:")
        for idx, file in enumerate(files):
            file_content = await client.anthropic_client.beta.files.download(
                file_id=file.file_id,
                betas=["files-api-2025-04-14"]
            )
            filename = f"presentation-{idx}.pptx"
            with open(filename, "wb") as f:
                await file_content.write_to_file(f.name)
            print(f"File {idx}: {filename} saved to disk.")
```

## Configuration Summary

| Setting | Public API | Foundry |
|---------|------------|---------|
| Client class | `AnthropicClient()` | `AnthropicClient(anthropic_client=AsyncAnthropicFoundry())` |
| API key env | `ANTHROPIC_API_KEY` | `ANTHROPIC_FOUNDRY_API_KEY` |
| Model env | `ANTHROPIC_CHAT_MODEL_ID` | Uses Foundry deployment |
| Resource env | N/A | `ANTHROPIC_FOUNDRY_RESOURCE` |

## Common Pitfalls and Tips

1. **Foundry version**: Anthropic on Foundry requires `anthropic>=0.74.0`.
2. **Skills beta**: Skills use `additional_beta_flags=["skills-2025-10-02"]` and require Code Interpreter.
3. **Thinking format**: `TextReasoningContent` and `UsageContent` appear in streaming chunks; check `chunk.contents` for structured content.
4. **Hosted file download**: Use `client.anthropic_client.beta.files.download()` with the appropriate betas to retrieve generated files.
5. **Model IDs**: Use current provider-supported model IDs and treat examples in this file as placeholders; Foundry uses deployment/resource configuration.
