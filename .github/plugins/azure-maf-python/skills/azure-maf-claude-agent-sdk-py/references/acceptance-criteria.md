# Acceptance Criteria — maf-claude-agent-sdk-py

Correct and incorrect patterns for the Claude Agent SDK integration in Microsoft Agent Framework (Python), derived from official documentation and source code.

---

## 1. Import Paths

#### ✅ CORRECT: ClaudeAgent from agent_framework_claude

```python
from agent_framework_claude import ClaudeAgent
```

#### ✅ CORRECT: RawClaudeAgent for advanced use without telemetry

```python
from agent_framework_claude import RawClaudeAgent
```

#### ✅ CORRECT: Options and settings types

```python
from agent_framework_claude import ClaudeAgentOptions, ClaudeAgentSettings
```

#### ❌ INCORRECT: Wrong module paths

```python
from agent_framework.claude import ClaudeAgent          # Wrong — use agent_framework_claude (underscore, not dot)
from agent_framework import ClaudeAgent                  # Wrong — ClaudeAgent is in its own package
from agent_framework.anthropic import ClaudeAgent        # Wrong — ClaudeAgent is NOT AnthropicClient
from claude_agent_sdk import ClaudeAgent                 # Wrong — that's the raw SDK, not the MAF wrapper
```

---

## 2. Authentication Patterns

#### ✅ CORRECT: Anthropic API key via environment variable
```python
import os
os.environ["ANTHROPIC_API_KEY"] = "your-api-key"

async with ClaudeAgent(instructions="...") as agent:
    response = await agent.run("Hello")
```

#### ✅ CORRECT: Anthropic API key in default_options
```python
async with ClaudeAgent(
    instructions="...",
    default_options={"api_key": "your-api-key"},
) as agent:
    response = await agent.run("Hello")
```

#### ✅ CORRECT: Environment variables for Claude agent
```bash
export ANTHROPIC_API_KEY="your-api-key"
export CLAUDE_AGENT_MODEL="sonnet"
```

#### ❌ INCORRECT: Passing API key as constructor kwarg
```python
async with ClaudeAgent(
    instructions="...",
    api_key="your-api-key",  # Wrong — use env var or default_options
) as agent:
    pass
```

#### ❌ INCORRECT: Using Azure credential with ClaudeAgent
```python
from azure.identity import DefaultAzureCredential

async with ClaudeAgent(
    instructions="...",
    credential=DefaultAzureCredential(),  # Wrong — ClaudeAgent uses Anthropic API keys, not Azure credentials
) as agent:
    pass
```

---

## 3. Async Context Manager

#### ✅ CORRECT: Use async with for lifecycle management

```python
async with ClaudeAgent(
    instructions="You are a helpful assistant.",
) as agent:
    response = await agent.run("Hello!")
    print(response.text)
```

#### ✅ CORRECT: Manual start/stop (advanced)

```python
agent = ClaudeAgent(instructions="You are a helpful assistant.")
await agent.start()
try:
    response = await agent.run("Hello!")
finally:
    await agent.stop()
```

#### ❌ INCORRECT: Using ClaudeAgent without context manager or start/stop

```python
agent = ClaudeAgent(instructions="You are a helpful assistant.")
response = await agent.run("Hello!")  # Wrong — client not started, will fail
```

#### ❌ INCORRECT: Using synchronous context manager

```python
with ClaudeAgent(instructions="...") as agent:  # Wrong — must be async with
    pass
```

---

## 4. Built-in Tools vs Function Tools

#### ✅ CORRECT: Built-in tools as strings

```python
async with ClaudeAgent(
    instructions="You are a coding assistant.",
    tools=["Read", "Write", "Bash", "Glob"],
) as agent:
    response = await agent.run("List Python files")
```

#### ✅ CORRECT: Function tools as callables

```python
from typing import Annotated
from pydantic import Field

def get_weather(
    location: Annotated[str, Field(description="The location.")],
) -> str:
    """Get the weather for a given location."""
    return f"Sunny in {location}."

async with ClaudeAgent(
    instructions="Weather assistant.",
    tools=[get_weather],
) as agent:
    response = await agent.run("Weather in Seattle?")
```

#### ❌ INCORRECT: Passing built-in tools as objects instead of strings

```python
from agent_framework import HostedWebSearchTool

async with ClaudeAgent(
    tools=[HostedWebSearchTool()],  # Wrong — ClaudeAgent uses string tool names, not hosted tool objects
) as agent:
    pass
```

#### ✅ CORRECT: Mixing built-in and function tools in one list

```python
def lookup_user(user_id: Annotated[str, Field(description="User ID.")]) -> str:
    """Look up a user by ID."""
    return f"User {user_id}: Alice"

async with ClaudeAgent(
    instructions="Assistant with file access and user lookup.",
    tools=["Read", "Bash", lookup_user],
) as agent:
    response = await agent.run("Read config.yaml and look up user 123")
```

#### ❌ INCORRECT: Using @ai_function decorator (MAF ChatAgent pattern)

```python
from agent_framework import ai_function

@ai_function
def my_tool():  # Wrong — ClaudeAgent uses plain functions, not @ai_function
    pass
```

---

## 5. Permission Modes

#### ✅ CORRECT: Permission mode in default_options

```python
async with ClaudeAgent(
    instructions="Coding assistant.",
    tools=["Read", "Write", "Bash"],
    default_options={
        "permission_mode": "acceptEdits",
    },
) as agent:
    response = await agent.run("Create hello.py")
```

#### ✅ CORRECT: Valid permission mode values

```python
# "default"            — Prompt for all permissions (interactive)
# "acceptEdits"        — Auto-accept file edits, prompt for shell
# "plan"               — Plan-only mode
# "bypassPermissions"  — Auto-accept all (use with caution)
```

#### ❌ INCORRECT: Permission mode as top-level parameter

```python
async with ClaudeAgent(
    instructions="...",
    permission_mode="acceptEdits",  # Wrong — must be in default_options
) as agent:
    pass
```

#### ❌ INCORRECT: Invalid permission mode values

```python
default_options={
    "permission_mode": "auto",       # Wrong — not a valid mode
    "permission_mode": "allow_all",  # Wrong — use "bypassPermissions"
    "permission_mode": True,         # Wrong — must be a string
}
```

---

## 6. MCP Server Configuration

#### ✅ CORRECT: MCP servers in default_options

```python
async with ClaudeAgent(
    instructions="Assistant with filesystem access.",
    default_options={
        "mcp_servers": {
            "filesystem": {
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
            },
        },
    },
) as agent:
    response = await agent.run("List files via MCP")
```

#### ✅ CORRECT: External MCP server with explicit type (recommended for compatibility)

```python
async with ClaudeAgent(
    instructions="Assistant with calculator.",
    default_options={
        "mcp_servers": {
            "calculator": {
                "type": "stdio",
                "command": "python",
                "args": ["-m", "calculator_server"],
            },
        },
    },
) as agent:
    response = await agent.run("What is 2 + 2?")
```

#### ❌ INCORRECT: MCP servers as top-level tools parameter

```python
from agent_framework import MCPStdioTool

async with ClaudeAgent(
    tools=[MCPStdioTool(...)],  # Wrong — ClaudeAgent uses mcp_servers in default_options
) as agent:
    pass
```

#### ❌ INCORRECT: Using MAF MCPStdioTool/MCPStreamableHTTPTool with ClaudeAgent

```python
from agent_framework import MCPStdioTool

async with ClaudeAgent(
    tools=[MCPStdioTool(command="npx", args=["server"])],  # Wrong — those are for ChatAgent
) as agent:
    pass
```

---

## 7. Multi-Turn Context (Thread and Session Compatibility)

#### ✅ CORRECT: Provider-agnostic thread pattern (when supported by installed version)

```python
async with ClaudeAgent(instructions="...") as agent:
    thread = agent.get_new_thread()
    await agent.run("My name is Alice.", thread=thread)
    response = await agent.run("What is my name?", thread=thread)
```

#### ✅ CORRECT: Create and reuse sessions (fallback for versions exposing session-based API)

```python
async with ClaudeAgent(instructions="...") as agent:
    session = agent.create_session()
    await agent.run("My name is Alice.", session=session)
    response = await agent.run("What is my name?", session=session)
```

#### ❌ INCORRECT: Mixing context styles in one call

```python
async with ClaudeAgent(instructions="...") as agent:
    thread = agent.get_new_thread()
    session = agent.create_session()
    await agent.run("Hello", thread=thread, session=session)  # Wrong — use one style per call
```

---

## 8. Model Configuration

#### ✅ CORRECT: Model in default_options

```python
async with ClaudeAgent(
    instructions="...",
    default_options={"model": "opus"},
) as agent:
    response = await agent.run("Complex reasoning task")
```

#### ✅ CORRECT: Model via environment variable

```bash
export CLAUDE_AGENT_MODEL="sonnet"
```

#### ❌ INCORRECT: Model as constructor keyword

```python
async with ClaudeAgent(
    instructions="...",
    model="opus",  # Wrong — model goes in default_options or env var
) as agent:
    pass
```

---

## 9. Multi-Agent Workflows

#### ✅ CORRECT: ClaudeAgent as participant in Sequential workflow

```python
from agent_framework import SequentialBuilder
from agent_framework.azure import AzureOpenAIChatClient
from agent_framework_claude import ClaudeAgent
from azure.identity import AzureCliCredential

writer = AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
    instructions="You are a copywriter.", name="writer",
)
reviewer = ClaudeAgent(
    instructions="You are a reviewer.", name="reviewer",
)
workflow = SequentialBuilder().participants([writer, reviewer]).build()
```

#### ❌ INCORRECT: Wrapping ClaudeAgent with .as_agent()

```python
agent = ClaudeAgent(instructions="...").as_agent()  # Wrong — ClaudeAgent IS already an agent
```

#### ❌ INCORRECT: Confusing AnthropicClient and ClaudeAgent

```python
from agent_framework.anthropic import AnthropicClient

# This creates a chat-completion agent, NOT a managed Claude agent
agent = AnthropicClient().as_agent(instructions="...")

# For full agentic capabilities, use ClaudeAgent instead:
from agent_framework_claude import ClaudeAgent
async with ClaudeAgent(instructions="...") as agent:
    pass
```

---

## 10. Streaming

#### ✅ CORRECT: Streaming with run method (stream=True)

```python
async with ClaudeAgent(instructions="...") as agent:
    async for chunk in agent.run("Tell a story", stream=True):
        if chunk.text:
            print(chunk.text, end="", flush=True)
```

#### ✅ CORRECT: Streaming with run_stream method

```python
async with ClaudeAgent(instructions="...") as agent:
    async for chunk in agent.run_stream("Tell a story"):
        if chunk.text:
            print(chunk.text, end="", flush=True)
```

#### ❌ INCORRECT: Expecting full response from run_stream

```python
async with ClaudeAgent(instructions="...") as agent:
    response = await agent.run_stream("Hello")  # Wrong — run_stream returns async iterable, not awaitable
    print(response.text)
```

---

## 11. Hooks

#### ✅ CORRECT: Hooks in default_options

```python
from claude_agent_sdk import HookMatcher

async def check_bash(input_data, tool_use_id, context):
    if input_data["tool_name"] == "Bash":
        command = input_data["tool_input"].get("command", "")
        if "rm -rf" in command:
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": "Dangerous command blocked.",
                }
            }
    return {}

async with ClaudeAgent(
    instructions="Coding assistant.",
    tools=["Bash"],
    default_options={
        "hooks": {
            "PreToolUse": [
                HookMatcher(matcher="Bash", hooks=[check_bash]),
            ],
        },
    },
) as agent:
    response = await agent.run("Run rm -rf /")
```

#### ❌ INCORRECT: Using MAF middleware pattern for hooks

```python
from agent_framework import AgentMiddleware

async with ClaudeAgent(
    middleware=[AgentMiddleware(...)],  # Wrong approach for tool-level hooks
) as agent:
    pass
```

Note: MAF middleware (agent-level, function-level, chat-level) still works with ClaudeAgent for cross-cutting concerns. Use `hooks` in `default_options` specifically for Claude Code tool permission hooks.

---

## 12. Async Variants

#### ✅ CORRECT: All ClaudeAgent operations are async-only
```python
import asyncio

async def main():
    async with ClaudeAgent(instructions="...") as agent:
        response = await agent.run("Hello")
        print(response.text)

asyncio.run(main())
```

#### ✅ CORRECT: Async streaming
```python
async def main():
    async with ClaudeAgent(instructions="...") as agent:
        async for chunk in agent.run_stream("Tell a story"):
            if chunk.text:
                print(chunk.text, end="", flush=True)

asyncio.run(main())
```

#### ❌ INCORRECT: Synchronous usage (ClaudeAgent has no sync API)
```python
with ClaudeAgent(instructions="...") as agent:  # Wrong — must be async with
    result = agent.run("Hello")  # Wrong — run() is async, must await
```

#### Key Rules

- ClaudeAgent is **async-only** — there is no synchronous variant.
- Always use `async with` for lifecycle management.
- Always `await` calls to `run()`, `start()`, `stop()`.
- Use `async for` with `run_stream()` or `run(..., stream=True)`.
- Wrap in `asyncio.run(main())` for script entry points.
