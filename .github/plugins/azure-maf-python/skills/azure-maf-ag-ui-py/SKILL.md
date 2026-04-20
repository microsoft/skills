---
name: azure-maf-ag-ui-py
description: This skill should be used when the user asks about "AG-UI", "AGUI", "frontend agent", "FastAPI agent", "SSE streaming", "AGUIChatClient", "state sync", "frontend tools", "Dojo testing", "add_agent_framework_fastapi_endpoint", "AgentFrameworkAgent", or needs guidance on integrating Microsoft Agent Framework agents with frontend applications via the AG-UI protocol in Python. Make sure to use this skill whenever the user mentions hosting agents with FastAPI, building agent UIs, streaming agent responses to a browser, state synchronization between client and server, or approval workflows, even if they don't explicitly mention "AG-UI".
version: 0.1.0
---

# MAF AG-UI Protocol (Python)

This skill provides guidance for integrating Microsoft Agent Framework agents with web and mobile frontends via the AG-UI (Agent Generative UI) protocol. AG-UI enables real-time streaming, state management, human-in-the-loop approvals, and custom UI rendering for AI agent applications.

## What is AG-UI?

AG-UI is a standardized protocol for building AI agent interfaces that provides:

- **Remote Agent Hosting**: Deploy AI agents as web services accessible by multiple clients
- **Real-time Streaming**: Stream agent responses using Server-Sent Events (SSE) for immediate feedback
- **Standardized Communication**: Consistent message format for reliable agent interactions
- **Thread Management**: Maintain conversation context across multiple requests via `threadId`
- **Advanced Features**: Human-in-the-loop approvals, state synchronization, frontend and backend tools, predictive state updates

## When to Use AG-UI

Use AG-UI when:

- Building web or mobile applications that interact with AI agents
- Deploying agents as services accessible by multiple concurrent users
- Streaming agent responses in real-time for immediate user feedback
- Implementing approval workflows where users confirm actions before execution
- Synchronizing state between client and server for interactive experiences
- Rendering custom UI components based on agent tool calls

## Architecture Overview

The Python AG-UI integration uses FastAPI and a modular architecture:

```
┌─────────────────┐
│  Web Client     │
│  (Browser/App)  │
└────────┬────────┘
         │ HTTP POST + SSE
         ▼
┌─────────────────────────┐
│  FastAPI Endpoint       │
│  add_agent_framework_   │
│  fastapi_endpoint       │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  AgentFrameworkAgent    │
│  (Protocol Wrapper)     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  ChatAgent              │
│  (Agent Framework)      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Chat Client            │
│  (Azure OpenAI, etc.)   │
└─────────────────────────┘
```

**Key Components:**

- **FastAPI Endpoint**: `add_agent_framework_fastapi_endpoint` handles HTTP requests and SSE streaming
- **AgentFrameworkAgent**: Lightweight wrapper that adapts `ChatAgent` to the AG-UI protocol (optional for basic setups)
- **Event Bridge**: Converts Agent Framework events to AG-UI protocol events
- **AGUIChatClient**: Client library for connecting to AG-UI servers from Python

## Quick Server Setup

Install the package and create a minimal server:

```bash
pip install agent-framework-ag-ui --pre
```

```python
import os
from agent_framework import ChatAgent
from agent_framework.azure import AzureOpenAIChatClient
from agent_framework_ag_ui import add_agent_framework_fastapi_endpoint
from azure.identity import AzureCliCredential
from fastapi import FastAPI

endpoint = os.environ["AZURE_OPENAI_ENDPOINT"]
deployment_name = os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"]

chat_client = AzureOpenAIChatClient(
    credential=AzureCliCredential(),
    endpoint=endpoint,
    deployment_name=deployment_name,
)

agent = ChatAgent(
    name="AGUIAssistant",
    instructions="You are a helpful assistant.",
    chat_client=chat_client,
)

app = FastAPI(title="AG-UI Server")
add_agent_framework_fastapi_endpoint(app, agent, "/")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8888)
```

## Key Concepts

### Threads and Runs

- **Thread ID (`threadId`)**: Maintains conversation context across requests. Capture from `RUN_STARTED` events.
- **Run ID (`runId`)**: Identifies individual executions within a thread.
- Pass `thread_id` in subsequent requests to continue the conversation.

### Event Types

AG-UI uses UPPERCASE event types with underscores:

| Event | Purpose |
|-------|---------|
| `RUN_STARTED` | Agent has begun processing; contains `threadId` and `runId` |
| `TEXT_MESSAGE_START` | Start of a text message from the agent |
| `TEXT_MESSAGE_CONTENT` | Incremental text streamed (with `delta` field) |
| `TEXT_MESSAGE_END` | End of a text message |
| `RUN_FINISHED` | Successful completion |
| `RUN_ERROR` | Error information |
| `TOOL_CALL_START` | Tool execution begins |
| `TOOL_CALL_ARGS` | Tool arguments (may stream in chunks) |
| `TOOL_CALL_RESULT` | Tool execution result |
| `STATE_SNAPSHOT` | Complete state snapshot |
| `STATE_DELTA` | Incremental state update (JSON Patch) |
| `TOOL_CALL_REQUEST` | Frontend tool execution requested |

Field names use camelCase (e.g., `threadId`, `runId`, `messageId`).

### Backend vs. Frontend Tools

- **Backend Tools**: Defined with `@ai_function`, execute on the server, results streamed to client
- **Frontend Tools**: Registered on the client, execute locally; server sends `TOOL_CALL_REQUEST`, client returns results
- Use backend tools for sensitive operations; use frontend tools for client-specific data (GPS, storage, UI)

### State Management

- Define state with Pydantic models and `state_schema`
- Use `predict_state_config` to map state fields to tool arguments for streaming updates
- Receive `STATE_SNAPSHOT` (full) and `STATE_DELTA` (JSON Patch) events
- Wrap agent with `AgentFrameworkAgent` for state support

### Human-in-the-Loop (HITL)

- Mark tools with `approval_mode="always_require"` in `@ai_function`
- Wrap agent with `AgentFrameworkAgent(require_confirmation=True)`
- Customize via `ConfirmationStrategy` subclass
- Client receives approval requests and sends approval responses before tool execution

### Client Selection Guidance

- Use raw `AGUIChatClient` when you need low-level protocol control or custom event handling.
- Use CopilotKit integration when you need a higher-level frontend framework abstraction.
- Keep protocol-level examples (`threadId`, `runId`, event stream parsing) available even when using higher-level client frameworks.

## Supported Features Summary

| Feature | Description |
|---------|-------------|
| 1. Agentic Chat | Basic streaming chat with automatic tool calling |
| 2. Backend Tool Rendering | Tools executed on backend, results streamed to client |
| 3. Human in the Loop | Function approval requests for user confirmation |
| 4. Agentic Generative UI | Async tools with progress updates |
| 5. Tool-based Generative UI | Custom UI components rendered from tool calls |
| 6. Shared State | Bidirectional state synchronization |
| 7. Predictive State Updates | Stream tool arguments as optimistic state updates |

## Agent Framework to AG-UI Mapping

| Agent Framework Concept | AG-UI Equivalent |
|------------------------|------------------|
| `ChatAgent` | Agent Endpoint |
| `agent.run()` | HTTP POST Request |
| `agent.run_stream()` | Server-Sent Events |
| Agent response updates | `TEXT_MESSAGE_CONTENT`, `TOOL_CALL_START`, etc. |
| Function tools (`@ai_function`) | Backend Tools |
| Tool approval mode | Human-in-the-Loop |
| Conversation history | `threadId` maintains context |

## Additional Resources

For detailed implementation guides, consult:

- **`references/server-setup.md`** – FastAPI server setup, `add_agent_framework_fastapi_endpoint`, `AgentFrameworkAgent` wrapper, ChatAgent with tools, uvicorn, multiple agents, orchestrators
- **`references/client-and-events.md`** – AGUIChatClient, `run_stream`, thread ID management, event types, consuming events, error handling
- **`references/tools-hitl-state.md`** – Backend tools with `@ai_function`, frontend tools with AGUIClientWithTools, HITL approvals, state schema, `predict_state_config`, `STATE_SNAPSHOT`, `STATE_DELTA`
- **`references/testing-security.md`** – Dojo testing setup, testing each feature, security considerations, trust boundaries, input validation

External documentation:

- [AG-UI Protocol Documentation](https://docs.ag-ui.com/introduction)
- [AG-UI Dojo App](https://dojo.ag-ui.com/)
- [Agent Framework GitHub](https://github.com/microsoft/agent-framework)

