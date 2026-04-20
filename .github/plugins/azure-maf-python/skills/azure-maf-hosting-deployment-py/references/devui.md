# DevUI - Developer Testing for Microsoft Agent Framework (Python)

DevUI is a lightweight, standalone sample application for running and testing agents and workflows in the Microsoft Agent Framework. It provides a web interface for interactive testing along with an OpenAI-compatible API backend. DevUI is intended for **development and debugging only** — it is not for production use.

## Table of Contents

- [Overview and Purpose](#overview-and-purpose)
- [Installation](#installation)
- [Setup and Launch Options](#setup-and-launch-options)
- [Directory Discovery](#directory-discovery)
- [Tracing and Observability](#tracing-and-observability)
- [Security Considerations](#security-considerations)
- [API Reference](#api-reference)
- [Event Mapping](#event-mapping)
- [OpenAI Proxy Mode](#openai-proxy-mode)
- [CLI Options](#cli-options)
- [Sample Gallery and Samples](#sample-gallery-and-samples)
- [Testing Workflows with DevUI](#testing-workflows-with-devui)

## Overview and Purpose

DevUI helps developers:

- Visually debug and test agents and workflows before integrating them into applications
- Use the OpenAI Python SDK to interact with agents via the Responses API
- Inspect OpenTelemetry traces to understand execution flow and identify performance issues
- Iterate quickly on agent design without building custom hosting infrastructure

DevUI is Python-centric. C# DevUI support may become available in future releases; the concepts in this guide apply primarily to Python.

## Installation

Install DevUI from PyPI:

```bash
pip install agent-framework-devui --pre
```

This installs the DevUI package and required Agent Framework dependencies.

## Setup and Launch Options

### Option 1: Programmatic Registration

Launch DevUI with agents registered in-memory. Use when agents are defined in code and you do not need directory discovery.

```python
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIChatClient
from agent_framework.devui import serve

def get_weather(location: str) -> str:
    """Get weather for a location."""
    return f"Weather in {location}: 72F and sunny"

agent = ChatAgent(
    name="WeatherAgent",
    chat_client=OpenAIChatClient(),
    tools=[get_weather],
    instructions="You are a helpful weather assistant."
)

serve(entities=[agent], auto_open=True)
```

Parameters:

- `entities`: List of `ChatAgent` or workflow instances to expose
- `auto_open`: Whether to automatically open the browser (default `True`)
- `tracing_enabled`: Set to `True` to enable OpenTelemetry tracing
- `port`: Port for the server (default 8080)
- `host`: Host to bind (default 127.0.0.1)

### Option 2: Directory Discovery (CLI)

Launch DevUI from the command line to discover agents and workflows from a directory structure:

```bash
devui ./agents --port 8080
```

Web UI: `http://localhost:8080`  
API base: `http://localhost:8080/v1/*`

## Directory Discovery

DevUI discovers agents and workflows by scanning directories for an `__init__.py` that exports either `agent` or `workflow`.

### Required Directory Structure

```
entities/
    weather_agent/
        __init__.py      # Must export: agent = ChatAgent(...)
        agent.py         # Optional: implementation
        .env             # Optional: API keys, config
    my_workflow/
        __init__.py      # Must export: workflow = WorkflowBuilder()...
        workflow.py      # Optional: implementation
        .env             # Optional: environment variables
    .env                 # Optional: shared environment variables
```

### Agent Example

**`weather_agent/__init__.py`**:

```python
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIChatClient

def get_weather(location: str) -> str:
    """Get weather for a location."""
    return f"Weather in {location}: 72F and sunny"

agent = ChatAgent(
    name="weather_agent",
    chat_client=OpenAIChatClient(),
    tools=[get_weather],
    instructions="You are a helpful weather assistant."
)
```

The exported variable must be named `agent` for agents.

### Workflow Example

**`my_workflow/__init__.py`**:

```python
from agent_framework.workflows import WorkflowBuilder

workflow = (
    WorkflowBuilder()
    .add_executor(...)
    .add_edge(...)
    .build()
)
```

The exported variable must be named `workflow` for workflows.

### Environment Variables

DevUI loads `.env` files automatically:

1. **Entity-level `.env`**: In the agent/workflow directory; loaded only for that entity
2. **Parent-level `.env`**: In the entities root; loaded for all entities

Example:

```bash
OPENAI_API_KEY=sk-...
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
```

Use `.env.example` to document required variables without committing secrets.

### Launching with Directory Discovery

```bash
devui ./entities
devui ./entities --port 9000
devui ./entities --reload   # Auto-reload for development
```

### Troubleshooting Discovery

- Ensure `__init__.py` exports `agent` or `workflow`
- Check for syntax errors in Python files
- Confirm the directory is directly under the path passed to `devui`
- Verify `.env` location and file permissions
- Use `--reload` during development to pick up changes

## Tracing and Observability

DevUI integrates with OpenTelemetry to capture and display traces from Agent Framework operations. DevUI does not create its own spans; it collects spans emitted by the framework during agent and workflow execution.

### Enabling Tracing

**CLI:**

```bash
devui ./agents --tracing
```

**Programmatic:**

```python
serve(
    entities=[agent],
    tracing_enabled=True
)
```

### Viewing Traces

1. Run an agent or workflow through the DevUI interface
2. Open the debug panel (available in developer mode)
3. Inspect the trace timeline for:
   - Span hierarchy
   - Timing information
   - Agent/workflow events
   - Tool calls and results

### Trace Structure

Typical agent trace:

```
Agent Execution
    LLM Call
        Prompt
        Response
    Tool Call
        Tool Execution
        Tool Result
    LLM Call
        Prompt
        Response
```

Typical workflow trace:

```
Workflow Execution
    Executor A
        Agent Execution
            ...
    Executor B
        Agent Execution
            ...
```

### Exporting to External Tools

Set `OTLP_ENDPOINT` to export traces to external collectors:

```bash
export OTLP_ENDPOINT="http://localhost:4317"
devui ./agents --tracing
```

Supported backends include Jaeger, Zipkin, Azure Monitor, and Datadog. Without an OTLP endpoint, traces are shown only in the DevUI debug panel.

## Security Considerations

DevUI is designed for local development. Exposing it beyond localhost requires additional security measures.

### UI Modes

**Developer mode (default):**

- Full access: debug panel, hot reload, deployment tools, verbose errors

```bash
devui ./agents
```

**User mode:**

- Chat interface and conversation management
- Entity listing and basic info
- Developer APIs disabled (hot reload, deployment)
- Generic error messages (details logged server-side)

```bash
devui ./agents --mode user
```

### Authentication

Enable Bearer token authentication:

```bash
devui ./agents --auth
```

- **Localhost**: Token is auto-generated and shown in the console
- **Network-exposed**: Provide token via `DEVUI_AUTH_TOKEN` or `--auth-token`

```bash
devui ./agents --auth --auth-token "your-secure-token"
export DEVUI_AUTH_TOKEN="your-secure-token"
devui ./agents --auth --host 0.0.0.0
```

API requests require the Bearer token:

```bash
curl http://localhost:8080/v1/entities \
  -H "Authorization: Bearer your-token-here"
```

### Recommended Configuration for Shared Use

If DevUI must be exposed to other users (still not recommended for production):

```bash
devui ./agents --mode user --auth --host 0.0.0.0
```

### Best Practices

- Keep DevUI bound to localhost for development
- Use a reverse proxy (nginx, Caddy) for external access with HTTPS
- Store API keys in `.env`, never commit them
- Use `.env.example` for documentation
- Review agent/workflow code before running; only load entities from trusted sources
- Be cautious with tools that perform file access or network calls

### Resource Cleanup

Register cleanup hooks for credentials and resources:

```python
from azure.identity.aio import DefaultAzureCredential
from agent_framework import ChatAgent
from agent_framework.azure import AzureOpenAIChatClient
from agent_framework_devui import register_cleanup, serve

credential = DefaultAzureCredential()
client = AzureOpenAIChatClient()
agent = ChatAgent(name="MyAgent", chat_client=client)

register_cleanup(agent, credential.close)
serve(entities=[agent])
```

### MCP Tools

When using MCP tools with DevUI, avoid `async with` context managers; connections can close before execution. DevUI handles cleanup automatically:

```python
mcp_tool = MCPStreamableHTTPTool(url="http://localhost:8011/mcp", chat_client=chat_client)
agent = ChatAgent(tools=mcp_tool)
serve(entities=[agent])
```

## API Reference

DevUI exposes an OpenAI-compatible Responses API at `http://localhost:8080/v1`.

### Base URL

```
http://localhost:8080/v1
```

Port is configurable via `--port`.

### Authentication

By default, no authentication for local development. With `--auth`, Bearer token is required.

### Using the OpenAI SDK

**Basic request:**

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="not-needed"
)

response = client.responses.create(
    metadata={"entity_id": "weather_agent"},
    input="What's the weather in Seattle?"
)
print(response.output[0].content[0].text)
```

**Streaming:**

```python
response = client.responses.create(
    metadata={"entity_id": "weather_agent"},
    input="What's the weather in Seattle?",
    stream=True
)
for event in response:
    print(event)
```

**Multi-turn conversations:**

```python
conversation = client.conversations.create(
    metadata={"agent_id": "weather_agent"}
)

response1 = client.responses.create(
    metadata={"entity_id": "weather_agent"},
    input="What's the weather in Seattle?",
    conversation=conversation.id
)

response2 = client.responses.create(
    metadata={"entity_id": "weather_agent"},
    input="How about tomorrow?",
    conversation=conversation.id
)
```

### REST Endpoints

**Responses API (OpenAI standard):**

```bash
curl -X POST http://localhost:8080/v1/responses \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {"entity_id": "weather_agent"},
    "input": "What is the weather in Seattle?"
  }'
```

**Conversations API:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/conversations` | POST | Create a conversation |
| `/v1/conversations/{id}` | GET | Get conversation details |
| `/v1/conversations/{id}` | POST | Update metadata |
| `/v1/conversations/{id}` | DELETE | Delete conversation |
| `/v1/conversations?agent_id={id}` | GET | List conversations (DevUI extension) |
| `/v1/conversations/{id}/items` | POST | Add items |
| `/v1/conversations/{id}/items` | GET | List items |
| `/v1/conversations/{id}/items/{item_id}` | GET | Get item |

**Entity management (DevUI extension):**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/entities` | GET | List discovered agents/workflows |
| `/v1/entities/{entity_id}/info` | GET | Get entity details |
| `/v1/entities/{entity_id}/reload` | POST | Hot reload (developer mode) |

**Health and metadata:**

```bash
curl http://localhost:8080/health
curl http://localhost:8080/meta
```

`/meta` returns: `ui_mode`, `version`, `framework`, `runtime`, `capabilities`, `auth_required`.

## Event Mapping

DevUI maps Agent Framework events to OpenAI Responses API events for streaming responses.

### Lifecycle Events

| OpenAI Event | Agent Framework Event |
|---|---|
| `response.created` + `response.in_progress` | `AgentStartedEvent` |
| `response.completed` | `AgentCompletedEvent` |
| `response.failed` | `AgentFailedEvent` |
| `response.created` + `response.in_progress` | `WorkflowStartedEvent` |
| `response.completed` | `WorkflowCompletedEvent` |
| `response.failed` | `WorkflowFailedEvent` |

### Content Types

| OpenAI Event | Agent Framework Content |
|---|---|
| `response.content_part.added` + `response.output_text.delta` | `TextContent` |
| `response.reasoning_text.delta` | `TextReasoningContent` |
| `response.output_item.added` | `FunctionCallContent` (initial) |
| `response.function_call_arguments.delta` | `FunctionCallContent` (args) |
| `response.function_result.complete` | `FunctionResultContent` |
| `response.output_item.added` (image) | `DataContent` (images) |
| `response.output_item.added` (file) | `DataContent` (files) |
| `error` | `ErrorContent` |

### Workflow Events

| OpenAI Event | Agent Framework Event |
|---|---|
| `response.output_item.added` (ExecutorActionItem) | `ExecutorInvokedEvent` |
| `response.output_item.done` (ExecutorActionItem) | `ExecutorCompletedEvent` |
| `response.output_item.added` (ResponseOutputMessage) | `WorkflowOutputEvent` |

### DevUI Custom Extensions

DevUI adds custom event types for Agent Framework-specific functionality:

- `response.function_approval.requested` — Function approval requests
- `response.function_approval.responded` — Function approval responses
- `response.function_result.complete` — Server-side function execution results
- `response.workflow_event.complete` — Workflow events
- `response.trace.complete` — Execution traces

These custom extensions are namespaced and can be safely ignored by standard OpenAI clients.

## OpenAI Proxy Mode

DevUI provides an **OpenAI Proxy** feature for testing OpenAI models directly through the interface without creating custom agents. Enable via Settings in the DevUI UI.

```bash
curl -X POST http://localhost:8080/v1/responses \
  -H "X-Proxy-Backend: openai" \
  -d '{"model": "gpt-4.1-mini", "input": "Hello"}'
```

Proxy mode requires the `OPENAI_API_KEY` environment variable configured on the backend.

## CLI Options

```bash
devui [directory] [options]

Options:
  --port, -p      Port (default: 8080)
  --host          Host (default: 127.0.0.1)
  --headless      API only, no UI
  --no-open       Don't automatically open browser
  --tracing       Enable OpenTelemetry tracing
  --reload        Enable auto-reload
  --mode          developer|user (default: developer)
  --auth          Enable Bearer token authentication
  --auth-token    Custom authentication token
```

## Sample Gallery and Samples

When no entities are discovered, DevUI shows a **sample gallery** with curated examples. From the gallery you can browse, download, and run samples locally.

Official samples are in `python/samples/getting_started/devui/` in the [Agent Framework repository](https://github.com/microsoft/agent-framework):

| Sample | Description |
|--------|-------------|
| weather_agent_azure | Weather agent with Azure OpenAI |
| foundry_agent | Agent using Azure AI Foundry |
| azure_responses_agent | Agent using Azure Responses API |
| fanout_workflow | Workflow with fan-out pattern |
| spam_workflow | Spam detection workflow |
| workflow_agents | Multiple agents in a workflow |

To run samples:

```bash
git clone https://github.com/microsoft/agent-framework.git
cd agent-framework/python/samples/getting_started/devui
devui .
```

## Testing Workflows with DevUI

DevUI adapts its input interface to the entity type:

- **Agents**: Text input and file attachments (images, documents, etc.)
- **Workflows**: Input interface derived from the first executor's input type; DevUI reflects the expected input schema

This lets you test workflows with structured or custom input types as they would be used in a real application.
