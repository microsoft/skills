# MAF Deployment Landscape: Python vs. .NET

This reference provides a detailed comparison of hosting and deployment capabilities for the Microsoft Agent Framework across Python and .NET. Most official hosting documentation targets ASP.NET Core; this guide clarifies what is available in Python today, what is .NET-only, and what is planned for the future.

## Full Comparison Table

| Capability | Python | .NET | Notes |
|------------|--------|------|-------|
| **DevUI (testing)** | Yes | Planned | Sample app for local testing; Python-first |
| **AG-UI + FastAPI** | Yes | N/A | `add_agent_framework_fastapi_endpoint`; primary Python hosting path |
| **AG-UI + ASP.NET** | N/A | Yes | `MapAGUI`; .NET hosting option |
| **OpenAI Chat Completions** | Planned | Yes | `MapOpenAIChatCompletions` (.NET); check release notes for Python |
| **OpenAI Responses API** | Planned | Yes | `MapOpenAIResponses` (.NET); check release notes for Python |
| **A2A protocol** | Planned | Yes | `MapA2A` (.NET); check release notes for Python |
| **Azure Functions (durable)** | Yes | Yes | `AgentFunctionApp`; serverless with durable state |
| **Protocol adapters** | N/A | Yes | NuGet packages: `Hosting.OpenAI`, `Hosting.A2A.AspNetCore` |
| **ASP.NET hosting** | N/A | Yes | `AddAIAgent`, `AddWorkflow`, DI integration |

## .NET-Only Features

The following hosting features are documented in the Agent Framework user guide but are **implemented only for .NET**. They have no Python equivalent today.

### ASP.NET Core Hosting Library

The `Microsoft.Agents.AI.Hosting` library is the foundation for .NET hosting:

- **AddAIAgent**: Register an `AIAgent` in the DI container with instructions, tools, and thread store
- **AddWorkflow**: Register workflows that coordinate multiple agents
- **AddAsAIAgent**: Expose a workflow as a standalone agent for integration

### OpenAI Integration (.NET)

`Microsoft.Agents.AI.Hosting.OpenAI` exposes agents via:

- **Chat Completions API**: Stateless request/response at `/{agent}/v1/chat/completions`
- **Responses API**: Stateful with conversation management at `/{agent}/v1/responses`

Both support streaming via Server-Sent Events. Multiple agents can be exposed at different paths. Python integration is planned — check release notes for availability.

### A2A Integration (.NET)

`Microsoft.Agents.AI.Hosting.A2A.AspNetCore` exposes agents via the Agent-to-Agent protocol:

- Agent discovery through agent cards at `GET /{path}/v1/card`
- Message-based communication at `POST /{path}/v1/message` or `v1/message:stream`
- Support for long-running agentic processes via tasks

Python integration is planned — check release notes for availability.

### Protocol Adapters

The hosting integration libraries act as protocol adapters: they retrieve the registered agent from DI, wrap it with protocol-specific middleware, translate incoming requests to Agent Framework types, invoke the agent, and translate responses back. This architecture is specific to the .NET hosting stack.

## Python-Available Features

### DevUI for Testing

DevUI is a Python-first sample application. It provides:

- Web interface for interactive agent and workflow testing
- Directory-based discovery of agents and workflows
- OpenAI-compatible Responses API at `/v1/responses`
- Conversations API at `/v1/conversations`
- OpenTelemetry tracing integration
- Sample gallery when no entities are discovered

DevUI is **not** for production. Use it during development to validate agent behavior, test workflows, and debug execution flow. See **`references/devui.md`** for setup and usage.

### AG-UI via FastAPI (Primary Python Hosting Path)

For production deployment of MAF agents in Python, use **AG-UI with FastAPI**. This is the main supported hosting path for Python.

**Package:** `agent-framework-ag-ui`

```bash
pip install agent-framework-ag-ui --pre
```

**Usage:**

```python
from agent_framework import ChatAgent
from agent_framework_ag_ui import add_agent_framework_fastapi_endpoint
from fastapi import FastAPI

agent = ChatAgent(chat_client=..., instructions="...")
app = FastAPI()
add_agent_framework_fastapi_endpoint(app, agent, "/")
```

`add_agent_framework_fastapi_endpoint` registers an HTTP endpoint that:

- Accepts AG-UI protocol requests (HTTP POST)
- Streams responses via Server-Sent Events (SSE)
- Manages conversation threads via protocol-level thread IDs
- Supports human-in-the-loop approvals when using `AgentFrameworkAgent` wrapper
- Supports state management, generative UI, and other AG-UI features

**Multiple agents:**

```python
add_agent_framework_fastapi_endpoint(app, weather_agent, "/weather")
add_agent_framework_fastapi_endpoint(app, finance_agent, "/finance")
```

For full AG-UI setup, human-in-the-loop, state management, and client configuration, consult the **maf-ag-ui** skill.

### Azure Functions (Durable Agents)

Python supports durable agents via `agent-framework-azurefunctions`:

```bash
pip install agent-framework-azurefunctions --pre
```

```python
from agent_framework.azure import AgentFunctionApp, AzureOpenAIChatClient

agent = AzureOpenAIChatClient(...).as_agent(instructions="...", name="Joker")
app = AgentFunctionApp(agents=[agent])
```

The extension creates HTTP endpoints for agent invocation. Conversation history and orchestration state are persisted and survive failures, restarts, and long-running operations. Use `app.get_agent(context, agent_name)` inside orchestrations.

For durable agent patterns, orchestration triggers, and human-in-the-loop workflows, consult the **maf-agent-types** skill (references/custom-and-advanced.md).

## Python Hosting: Planned Capabilities

The following capabilities are planned for Python but may not be available yet. Check the [Agent Framework release notes](https://github.com/microsoft/agent-framework/releases) for current availability.

1. **OpenAI Chat Completions / Responses**: Expose agents via OpenAI-compatible HTTP endpoints without AG-UI. Equivalent to .NET's `MapOpenAIChatCompletions` and `MapOpenAIResponses`.
2. **A2A protocol**: Expose agents via the Agent-to-Agent protocol for inter-agent communication. Equivalent to .NET's `MapA2A`.
3. **ASP.NET-equivalent hosting patterns**: A Python-native approach similar to the .NET hosting libraries (registration, DI, protocol adapters).

Until these become available, Python developers should use:

- **DevUI** for local testing and development
- **AG-UI + FastAPI** for production web hosting
- **Azure Functions** for serverless, durable agent hosting

## AG-UI as the Python Hosting Path

AG-UI fills the role that ASP.NET protocol adapters play in .NET: it provides a standardized way to expose agents over HTTP with streaming, thread management, and advanced features. The key differences:

| Aspect | .NET (ASP.NET) | Python (AG-UI + FastAPI) |
|--------|----------------|--------------------------|
| Framework | ASP.NET Core | FastAPI |
| Registration | `MapAGUI`, `MapOpenAIChatCompletions`, etc. | `add_agent_framework_fastapi_endpoint` |
| Protocol | AG-UI, OpenAI, A2A | AG-UI (OpenAI/A2A planned) |
| Streaming | Built-in middleware | FastAPI native async + SSE |
| Client | AGUIChatClient (C#) | AGUIChatClient (Python) |

Python's AG-UI integration uses a modular architecture:

- **FastAPI Endpoint**: Handles HTTP and SSE routing
- **AgentFrameworkAgent**: Wraps `ChatAgent` for AG-UI protocol
- **Event Bridge**: Converts Agent Framework events to AG-UI events
- **Message Adapters**: Bidirectional conversion between protocols

## Choosing a Hosting Option

**Use DevUI when:**

- Developing and debugging agents locally
- Validating workflows before integration
- Testing with the OpenAI SDK
- Inspecting traces for performance and flow

**Use AG-UI + FastAPI when:**

- Deploying agents for production web or mobile clients
- Needing multi-client access and SSE streaming
- Building applications with CopilotKit or other AG-UI clients
- Implementing human-in-the-loop or state synchronization

**Use Azure Functions when:**

- Building serverless, durable agent applications
- Coordinating multiple agents in orchestrations
- Needing fault-tolerant, long-running workflows
- Integrating with HTTP, timers, queues, or other Azure triggers

**Consider waiting for planned Python hosting when:**

- Requiring OpenAI Chat Completions or Responses API directly (without AG-UI)
- Needing A2A protocol for agent-to-agent communication
- Preferring a registration pattern similar to ASP.NET `AddAIAgent` + `Map*`

## Cross-References

- **maf-ag-ui-py skill**: FastAPI hosting with `add_agent_framework_fastapi_endpoint`, human-in-the-loop, state management, client setup, and Dojo testing
- **maf-agent-types-py skill**: Durable agents via `AgentFunctionApp`, Azure Functions hosting, orchestration patterns, and custom agents
- **`references/devui.md`**: DevUI setup, directory discovery, tracing, security, and API reference
