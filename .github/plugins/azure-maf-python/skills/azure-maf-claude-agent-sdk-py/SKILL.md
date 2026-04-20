---
name: azure-maf-claude-agent-sdk-py
description: This skill should be used when the user asks to "use ClaudeAgent", "claude agent sdk", "agent-framework-claude", "Claude Code agent", "managed Claude agent", "Claude built-in tools", "Claude permission mode", "Claude MCP integration", "ClaudeAgentOptions", "RawClaudeAgent", "Claude in MAF workflow", "Claude session management", "Claude hooks", or needs guidance on building agents with the Claude Agent SDK integration in Microsoft Agent Framework (Python). Make sure to use this skill whenever the user mentions ClaudeAgent, the agent-framework-claude package, Claude Code CLI integration, Claude built-in tools (Read/Write/Bash), Claude permission modes, Claude hooks or session management, or combining Claude agents with other MAF providers in multi-agent workflows, even if they don't explicitly say "Claude Agent SDK".
version: 0.1.0
---

# MAF Claude Agent SDK Integration - Python

Use this skill when building agents that leverage Claude's full agentic capabilities through the `agent-framework-claude` package. This is distinct from `AnthropicClient` (chat-completion style) — `ClaudeAgent` wraps the Claude Agent SDK to provide a managed agent with built-in tools, file editing, code execution, MCP servers, permission controls, hooks, and session management.

## When to Use ClaudeAgent vs AnthropicClient

| Need | Use | Package |
|------|-----|---------|
| Chat-completion with Claude models | `AnthropicClient` | `agent-framework-anthropic` |
| Full agentic capabilities (file ops, shell, tools, MCP) | `ClaudeAgent` | `agent-framework-claude` |
| Claude in multi-agent workflows with agentic tools | `ClaudeAgent` | `agent-framework-claude` |
| Extended thinking, hosted tools, web search | `AnthropicClient` | `agent-framework-anthropic` |

## Installation

```bash
pip install agent-framework-claude --pre
```

The Claude Code CLI is automatically bundled — no separate installation required. To use a custom CLI path, set `cli_path` in options or the `CLAUDE_AGENT_CLI_PATH` environment variable.

## Environment Variables

Settings resolve in this order: explicit keyword arguments > `.env` file values > environment variables with `CLAUDE_AGENT_` prefix.

```bash
CLAUDE_AGENT_CLI_PATH="/path/to/claude"      # Optional: custom CLI path
CLAUDE_AGENT_MODEL="sonnet"                  # Optional: model (sonnet, opus, haiku)
CLAUDE_AGENT_CWD="/path/to/project"          # Optional: working directory
CLAUDE_AGENT_PERMISSION_MODE="acceptEdits"   # Optional: permission handling
CLAUDE_AGENT_MAX_TURNS=10                    # Optional: max conversation turns
CLAUDE_AGENT_MAX_BUDGET_USD=5.0              # Optional: budget limit in USD
```

## Core Workflow

### Basic Agent

`ClaudeAgent` requires an async context manager to manage the Claude Code CLI lifecycle:

```python
import asyncio
from agent_framework_claude import ClaudeAgent

async def main():
    async with ClaudeAgent(
        instructions="You are a helpful assistant.",
    ) as agent:
        response = await agent.run("What is Microsoft Agent Framework?")
        print(response.text)

asyncio.run(main())
```

### Built-in Tools

Pass tool names as strings to enable Claude's native tools (file ops, shell, search):

```python
async def main():
    async with ClaudeAgent(
        instructions="You are a helpful coding assistant.",
        tools=["Read", "Write", "Bash", "Glob"],
    ) as agent:
        response = await agent.run("List all Python files in the current directory")
        print(response.text)
```

### Function Tools

Add custom business logic as function tools. Use Pydantic `Annotated` and `Field` for parameter schemas. These are automatically converted to in-process MCP tools:

```python
from typing import Annotated
from pydantic import Field
from agent_framework_claude import ClaudeAgent

def get_weather(
    location: Annotated[str, Field(description="The location to get the weather for.")],
) -> str:
    """Get the weather for a given location."""
    return f"The weather in {location} is sunny with a high of 25C."

async def main():
    async with ClaudeAgent(
        instructions="You are a helpful weather agent.",
        tools=[get_weather],
    ) as agent:
        response = await agent.run("What's the weather like in Seattle?")
```

Built-in tools (strings) and function tools (callables) can be mixed in the same `tools` list.

### Streaming Responses

Use `run_stream()` for incremental output:

```python
async def main():
    async with ClaudeAgent(
        instructions="You are a helpful assistant.",
    ) as agent:
        print("Agent: ", end="", flush=True)
        async for chunk in agent.run_stream("Tell me a short story."):
            if chunk.text:
                print(chunk.text, end="", flush=True)
        print()
```

### Multi-Turn Conversations

For multi-turn conversations, prefer the provider-agnostic thread API (`get_new_thread`) when available in your installed Agent Framework version. For `agent-framework-claude`, the underlying implementation uses session resumption (`create_session`, `session=`). If `thread` is unavailable or does not preserve context in your installed version, use `session` explicitly.

Thread-style example (provider-agnostic pattern shown in MAF docs/blogs):

```python
async def main():
    async with ClaudeAgent(
        instructions="You are a helpful assistant. Keep your answers short.",
    ) as agent:
        thread = agent.get_new_thread()
        await agent.run("My name is Alice.", thread=thread)
        response = await agent.run("What is my name?", thread=thread)
        print(response.text)  # Mentions "Alice"
```

Session-style example (provider-specific fallback aligned with current `agent-framework-claude` implementation):

```python
async def main():
    async with ClaudeAgent(
        instructions="You are a helpful assistant. Keep your answers short.",
    ) as agent:
        session = agent.create_session()
        await agent.run("My name is Alice.", session=session)
        response = await agent.run("What is my name?", session=session)
        print(response.text)  # Mentions "Alice"
```

## Configuration

### Permission Modes

Control how the agent handles file and command permissions:

```python
async with ClaudeAgent(
    instructions="You are a coding assistant that can edit files.",
    tools=["Read", "Write", "Bash"],
    default_options={
        "permission_mode": "acceptEdits",
    },
) as agent:
    response = await agent.run("Create a hello.py file that prints 'Hello, World!'")
```

| Mode | Behavior |
|------|----------|
| `default` | Prompt for permissions (interactive) |
| `acceptEdits` | Auto-accept file edits, prompt for shell |
| `plan` | Plan-only mode |
| `bypassPermissions` | Auto-accept all (use with caution) |

### MCP Server Integration

Connect external MCP servers to give the agent additional tools:

```python
async with ClaudeAgent(
    instructions="You are a helpful assistant with access to the filesystem.",
    default_options={
        "mcp_servers": {
            "filesystem": {
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
            },
        },
    },
) as agent:
    response = await agent.run("List all files using MCP")
```

Some SDK versions or MCP server configurations may require an explicit `"type": "stdio"` field in the server definition. Include it when connecting to external subprocess-based servers for maximum compatibility.

### Additional Options

Configure via `default_options` dict or `ClaudeAgentOptions` TypedDict:

| Option | Type | Purpose |
|--------|------|---------|
| `model` | `str` | Model selection (`"sonnet"`, `"opus"`, `"haiku"`) |
| `max_turns` | `int` | Maximum conversation turns |
| `max_budget_usd` | `float` | Budget limit in USD |
| `hooks` | `dict` | Pre/post tool hooks for validation |
| `sandbox` | `SandboxSettings` | Bash isolation settings |
| `thinking` | `ThinkingConfig` | Extended thinking (`adaptive`, `enabled`, `disabled`) |
| `effort` | `str` | Thinking depth (`"low"`, `"medium"`, `"high"`, `"max"`) |
| `output_format` | `dict` | Structured output (JSON schema) |
| `allowed_tools` | `list[str]` | Tool permission allowlist |
| `disallowed_tools` | `list[str]` | Tool blocklist |
| `agents` | `dict` | Custom agent definitions |
| `plugins` | `list` | Plugin configurations |

See `references/claude-agent-api.md` for the full `ClaudeAgentOptions` reference.

## Multi-Agent Workflows

A key benefit of `ClaudeAgent` is composability with other MAF providers. Claude agents implement the same `BaseAgent` interface, so they work in any MAF orchestration pattern.

### Sequential: Writer (Azure OpenAI) -> Reviewer (Claude)

```python
from agent_framework import SequentialBuilder, WorkflowOutputEvent, ChatMessage, Role
from agent_framework.azure import AzureOpenAIChatClient
from agent_framework_claude import ClaudeAgent
from azure.identity import AzureCliCredential
from typing import cast

chat_client = AzureOpenAIChatClient(credential=AzureCliCredential())

writer = chat_client.as_agent(
    instructions="You are a concise copywriter. Provide a single, punchy marketing sentence.",
    name="writer",
)

reviewer = ClaudeAgent(
    instructions="You are a thoughtful reviewer. Give brief feedback on the previous message.",
    name="reviewer",
)

workflow = SequentialBuilder().participants([writer, reviewer]).build()

async for event in workflow.run_stream("Write a tagline for a budget-friendly electric bike."):
    if isinstance(event, WorkflowOutputEvent):
        messages = cast(list[ChatMessage], event.data)
        for msg in messages:
            name = msg.author_name or ("assistant" if msg.role == Role.ASSISTANT else "user")
            print(f"[{name}]: {msg.text}\n")
```

When `ClaudeAgent` is used as a workflow participant, the orchestration layer manages its lifecycle — no `async with` is needed on the agent itself. This pattern extends to Concurrent, GroupChat, Handoff, and Magentic workflows — see **maf-orchestration-patterns-py** for orchestration details.

## Key Classes

| Class | Import | Purpose |
|-------|--------|---------|
| `ClaudeAgent` | `from agent_framework_claude import ClaudeAgent` | Main agent with OpenTelemetry instrumentation |
| `RawClaudeAgent` | `from agent_framework_claude import RawClaudeAgent` | Core agent without telemetry (advanced) |
| `ClaudeAgentOptions` | `from agent_framework_claude import ClaudeAgentOptions` | TypedDict for configuration options |
| `ClaudeAgentSettings` | `from agent_framework_claude import ClaudeAgentSettings` | TypedDict settings (env var resolution via `load_settings`) |

## Best Practices

1. **Always use `async with`** — `ClaudeAgent` manages a CLI subprocess; the context manager ensures cleanup
2. **Prefer `ClaudeAgent` over `RawClaudeAgent`** — it adds OpenTelemetry instrumentation at no extra cost
3. **Separate built-in tools from function tools** — pass strings for built-in tools (`"Read"`, `"Write"`, `"Bash"`) and callables for custom tools
4. **Set `permission_mode`** for non-interactive use — `"acceptEdits"` or `"bypassPermissions"` avoids hanging on permission prompts
5. **Use sessions for multi-turn** — create a session and pass it to each `run()` call to maintain context
6. **Budget and turn limits** — set `max_turns` and `max_budget_usd` to prevent runaway agents in production

## Additional Resources

### Reference Files

- **`references/claude-agent-api.md`** -- Full `ClaudeAgentOptions` TypedDict reference, `ClaudeAgentSettings` env variable resolution, hook configuration, streaming internals, structured output, sandbox settings
- **`references/acceptance-criteria.md`** -- Correct/incorrect patterns for imports, context manager usage, tool configuration, permission modes, MCP setup, session management, and common mistakes

### Related MAF Skills

| Topic | Skill |
|-------|-------|
| Anthropic chat-completion agents | **maf-agent-types-py** (Anthropic section) |
| Multi-agent orchestration patterns | **maf-orchestration-patterns-py** |
| Function tools and MCP integration | **maf-tools-rag-py** |
| Hosting and deployment | **maf-hosting-deployment-py** |
| Middleware and observability | **maf-middleware-observability-py** |
