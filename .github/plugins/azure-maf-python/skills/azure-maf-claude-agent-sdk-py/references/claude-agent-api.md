# Claude Agent API Reference

Detailed API reference for the `agent-framework-claude` package, covering configuration types, tool internals, streaming, hooks, and advanced features.

## Table of Contents

- [ClaudeAgentOptions](#claudeagentoptions)
- [ClaudeAgentSettings](#claudeagentsettings)
- [Agent Classes](#agent-classes)
- [Built-in Tool Names](#built-in-tool-names)
- [Custom Tools (In-Process MCP)](#custom-tools-in-process-mcp)
- [Hook Configuration](#hook-configuration)
- [Streaming Internals](#streaming-internals)
- [Structured Output](#structured-output)
- [Sandbox Settings](#sandbox-settings)
- [Extended Thinking](#extended-thinking)
- [Agent Definitions and Plugins](#agent-definitions-and-plugins)

---

## ClaudeAgentOptions

`ClaudeAgentOptions` is a `TypedDict` passed via the `default_options` parameter. All fields are optional.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `system_prompt` | `str` | — | System prompt (also settable via `instructions` constructor param) |
| `cli_path` | `str \| Path` | Auto-detected | Path to Claude CLI executable |
| `cwd` | `str \| Path` | Current directory | Working directory for Claude CLI |
| `env` | `dict[str, str]` | — | Environment variables to pass to CLI |
| `settings` | `str` | — | Path to Claude settings file |
| `model` | `str` | `"sonnet"` | Model: `"sonnet"`, `"opus"`, `"haiku"` |
| `fallback_model` | `str` | — | Fallback model if primary fails |
| `allowed_tools` | `list[str]` | — | Tool permission allowlist |
| `disallowed_tools` | `list[str]` | — | Tool blocklist |
| `mcp_servers` | `dict[str, McpServerConfig]` | — | MCP server configurations |
| `permission_mode` | `PermissionMode` | `"default"` | `"default"`, `"acceptEdits"`, `"plan"`, `"bypassPermissions"` |
| `can_use_tool` | `CanUseTool` | — | Custom permission callback |
| `max_turns` | `int` | — | Maximum conversation turns |
| `max_budget_usd` | `float` | — | Budget limit in USD |
| `hooks` | `dict[str, list[HookMatcher]]` | — | Pre/post tool hooks |
| `add_dirs` | `list[str \| Path]` | — | Additional directories to add to context |
| `sandbox` | `SandboxSettings` | — | Sandbox configuration for bash isolation |
| `agents` | `dict[str, AgentDefinition]` | — | Custom agent definitions |
| `output_format` | `dict[str, Any]` | — | Structured output format (JSON schema) |
| `enable_file_checkpointing` | `bool` | — | Enable file checkpointing for rewind |
| `betas` | `list[SdkBeta]` | — | Beta features to enable |
| `plugins` | `list[SdkPluginConfig]` | — | Plugin configurations |
| `setting_sources` | `list[SettingSource]` | — | Which settings files to load (`"user"`, `"project"`, `"local"`) |
| `thinking` | `ThinkingConfig` | — | Extended thinking config |
| `effort` | `str` | — | Thinking depth: `"low"`, `"medium"`, `"high"`, `"max"` |

---

## ClaudeAgentSettings

TypedDict settings resolved via `load_settings` from explicit keyword arguments, optional `.env` file values, and environment variables with `CLAUDE_AGENT_` prefix.

| Setting | Env Variable | Type |
|---------|-------------|------|
| `cli_path` | `CLAUDE_AGENT_CLI_PATH` | `str \| None` |
| `model` | `CLAUDE_AGENT_MODEL` | `str \| None` |
| `cwd` | `CLAUDE_AGENT_CWD` | `str \| None` |
| `permission_mode` | `CLAUDE_AGENT_PERMISSION_MODE` | `str \| None` |
| `max_turns` | `CLAUDE_AGENT_MAX_TURNS` | `int \| None` |
| `max_budget_usd` | `CLAUDE_AGENT_MAX_BUDGET_USD` | `float \| None` |

**Resolution order**: explicit kwargs > `.env` file > environment variables.

---

## Agent Classes

### ClaudeAgent

The recommended agent class. Extends `RawClaudeAgent` with `AgentTelemetryLayer` for OpenTelemetry instrumentation.

```python
from agent_framework_claude import ClaudeAgent

async with ClaudeAgent(
    instructions="System prompt here.",
    name="my-agent",
    description="Agent description for orchestrators.",
    tools=["Read", "Write", "Bash", custom_function],
    default_options={"model": "sonnet", "permission_mode": "acceptEdits"},
) as agent:
    response = await agent.run("Task prompt")
```

**Constructor parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `instructions` | `str \| None` | System prompt |
| `client` | `ClaudeSDKClient \| None` | Pre-configured SDK client (advanced) |
| `id` | `str \| None` | Unique agent identifier |
| `name` | `str \| None` | Agent name (used in orchestration) |
| `description` | `str \| None` | Agent description (used by orchestrators for routing) |
| `context_providers` | `Sequence[BaseContextProvider] \| None` | Context providers |
| `middleware` | `Sequence[AgentMiddlewareTypes] \| None` | Middleware pipeline |
| `tools` | mixed | Strings for built-in, callables for custom |
| `default_options` | `ClaudeAgentOptions \| dict` | Default options |
| `env_file_path` | `str \| None` | Path to `.env` file |
| `env_file_encoding` | `str \| None` | Encoding for env file when `env_file_path` is provided |

### RawClaudeAgent

Core implementation without telemetry. Use only when you need to avoid OpenTelemetry overhead:

```python
from agent_framework_claude import RawClaudeAgent

async with RawClaudeAgent(instructions="...") as agent:
    response = await agent.run("Hello")
```

---

## Built-in Tool Names

These are Claude Code's native tools, passed as strings in the `tools` parameter:

| Tool | Purpose |
|------|---------|
| `"Read"` | Read file contents |
| `"Write"` | Write/create files |
| `"Edit"` | Edit existing files |
| `"Bash"` | Execute shell commands |
| `"Glob"` | Find files by pattern |
| `"Grep"` | Search file contents |
| `"LS"` | List directory contents |
| `"MultiEdit"` | Batch file edits |
| `"NotebookEdit"` | Edit Jupyter notebooks |
| `"WebFetch"` | Fetch web content |
| `"WebSearch"` | Search the web |
| `"TodoRead"` | Read task list |
| `"TodoWrite"` | Update task list |

Use `allowed_tools` in options to pre-approve specific tools without permission prompts. Use `disallowed_tools` to block specific tools.

---

## Custom Tools (In-Process MCP)

When you pass callable functions as tools, `ClaudeAgent` automatically:

1. Wraps each `FunctionTool` into an `SdkMcpTool`
2. Creates an in-process MCP server named `_agent_framework_tools`
3. Registers tools with names like `mcp___agent_framework_tools__<tool_name>`
4. Adds them to `allowed_tools` so they execute without permission prompts

This means custom tools run in-process with zero IPC overhead.

```python
def calculate(expression: Annotated[str, Field(description="Math expression.")]) -> str:
    """Evaluate a math expression."""
    return str(eval(expression))

async with ClaudeAgent(
    instructions="Math helper.",
    tools=["Read", calculate],  # "Read" = built-in, calculate = custom
) as agent:
    response = await agent.run("What is 2^10?")
```

---

## Hook Configuration

Hooks are Python functions invoked by the Claude Code application at specific points in the agent loop. Configure via `default_options["hooks"]`.

### Hook Events

| Event | When | Use Case |
|-------|------|----------|
| `PreToolUse` | Before a tool executes | Validate, block, or modify tool input |
| `PostToolUse` | After a tool executes | Log, validate output, provide feedback |

### Hook Structure

```python
from claude_agent_sdk import HookMatcher

async def my_hook(input_data: dict, tool_use_id: str, context: dict) -> dict:
    tool_name = input_data["tool_name"]
    tool_input = input_data["tool_input"]
    # Return empty dict to allow, or return decision to deny
    return {}

options = {
    "hooks": {
        "PreToolUse": [
            HookMatcher(matcher="Bash", hooks=[my_hook]),
        ],
    },
}
```

### Denying Tool Use

Return a permission decision to block a tool:

```python
async def block_dangerous_commands(input_data, tool_use_id, context):
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
```

---

## Streaming Internals

When using `run(stream=True)` or `run_stream()`, the agent yields `AgentResponseUpdate` objects built from three internal message types:

| SDK Type | What it Contains | How it Maps |
|----------|-----------------|-------------|
| `StreamEvent` | Real-time content deltas (`text_delta`, `thinking_delta`) | `AgentResponseUpdate` with `Content.from_text()` or `Content.from_text_reasoning()` |
| `AssistantMessage` | Complete message with possible error | Error detection — raises `AgentException` on API errors |
| `ResultMessage` | Session ID, structured output, error flag | Session tracking, structured output extraction |

Error types mapped from `AssistantMessage.error`:
- `authentication_failed`, `billing_error`, `rate_limit`, `invalid_request`, `server_error`, `unknown`

---

## Structured Output

Request structured JSON output via `output_format`:

```python
async with ClaudeAgent(
    instructions="Extract structured data.",
    default_options={
        "output_format": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "age": {"type": "integer"},
            },
            "required": ["name", "age"],
        },
    },
) as agent:
    response = await agent.run("Extract: John is 30 years old.")
    print(response.value)  # Structured output available via .value
```

---

## Sandbox Settings

Isolate bash execution via the `sandbox` option:

```python
async with ClaudeAgent(
    instructions="Sandboxed coding assistant.",
    tools=["Bash"],
    default_options={
        "sandbox": {
            "type": "docker",
            "image": "python:3.12-slim",
        },
    },
) as agent:
    response = await agent.run("Run pip list")
```

---

## Extended Thinking

Enable Claude's extended thinking for complex reasoning:

```python
async with ClaudeAgent(
    instructions="Deep reasoning assistant.",
    default_options={
        "thinking": {"type": "enabled", "budget_tokens": 10000},
    },
) as agent:
    response = await agent.run("Solve this complex problem...")
```

Thinking config options:
- `{"type": "adaptive"}` — Claude decides when to think
- `{"type": "enabled", "budget_tokens": N}` — Always think, with token budget
- `{"type": "disabled"}` — No extended thinking

Alternatively, use the `effort` shorthand:

```python
default_options={"effort": "high"}  # "low", "medium", "high", "max"
```

---

## Agent Definitions and Plugins

### Custom Agent Definitions

Define sub-agents that Claude can invoke:

```python
async with ClaudeAgent(
    instructions="Orchestrator.",
    default_options={
        "agents": {
            "researcher": {
                "instructions": "You research topics thoroughly.",
                "tools": ["WebSearch", "WebFetch"],
            },
        },
    },
) as agent:
    response = await agent.run("Research quantum computing trends")
```

### Plugin Configurations

Load Claude Code plugins for additional commands and capabilities:

```python
async with ClaudeAgent(
    instructions="Assistant with plugins.",
    default_options={
        "plugins": [
            {"path": "/path/to/plugin"},
        ],
    },
) as agent:
    response = await agent.run("Use plugin capability")
```

### Setting Sources

Control which Claude settings files are loaded:

```python
default_options={
    "setting_sources": ["user", "project", "local"],
}
```
