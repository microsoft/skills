# AG-UI Client and Events (Python)

This reference covers the `AGUIChatClient`, the `run_stream` method, thread management, event types, and consuming events in Python AG-UI clients.

## Table of Contents

- [Installation](#installation) — Package install
- [Basic Client Setup](#basic-client-setup) — `AGUIChatClient` with `ChatAgent`
- [run_stream Method](#run_stream-method) — Streaming async iteration
- [Thread ID Management](#thread-id-management) — Conversation continuity
- [Event Types](#event-types) — Core, text message, tool, state, and custom events
- [Consuming Events](#consuming-events) — High-level (ChatAgent) and low-level (raw SSE)
- [Enhanced Client for Tool Events](#enhanced-client-for-tool-events) — Real-time tool display
- [Error Handling](#error-handling) — Graceful error recovery
- [Server-Side Flow](#server-side-flow) — Request processing pipeline
- [Client-Side Flow](#client-side-flow) — Event consumption pipeline
- [Protocol Details](#protocol-details) — HTTP, SSE, JSON, naming conventions

## Installation

The AG-UI package includes the client:

```bash
pip install agent-framework-ag-ui --pre
```

## Basic Client Setup

Create a client using `AGUIChatClient` and wrap it with `ChatAgent`:

```python
"""AG-UI client example."""

import asyncio
import os

from agent_framework import ChatAgent
from agent_framework_ag_ui import AGUIChatClient


async def main():
    server_url = os.environ.get("AGUI_SERVER_URL", "http://127.0.0.1:8888/")
    print(f"Connecting to AG-UI server at: {server_url}\n")

    chat_client = AGUIChatClient(server_url=server_url)

    agent = ChatAgent(
        name="ClientAgent",
        chat_client=chat_client,
        instructions="You are a helpful assistant.",
    )

    thread = agent.get_new_thread()

    try:
        while True:
            message = input("\nUser (:q or quit to exit): ")
            if not message.strip():
                print("Request cannot be empty.")
                continue

            if message.lower() in (":q", "quit"):
                break

            print("\nAssistant: ", end="", flush=True)
            async for update in agent.run_stream(message, thread=thread):
                if update.text:
                    print(f"\033[96m{update.text}\033[0m", end="", flush=True)

            print("\n")

    except KeyboardInterrupt:
        print("\n\nExiting...")
    except Exception as e:
        print(f"\n\033[91mAn error occurred: {e}\033[0m")


if __name__ == "__main__":
    asyncio.run(main())
```

## run_stream Method

`run_stream` streams agent responses as async iterations:

```python
async for update in agent.run_stream(message, thread=thread):
    # Each update may contain:
    # - update.text: Streamed text content
    # - update.contents: List of content objects (ToolCallContent, ToolResultContent, etc.)
```

Pass `thread=thread` to maintain conversation continuity. The thread object tracks `threadId` across requests.

## Thread ID Management

Thread IDs maintain conversation context:

1. **First request**: Server may assign a new `threadId` in the `RUN_STARTED` event
2. **Subsequent requests**: Pass the same `thread_id` to continue the conversation
3. **New conversation**: Call `agent.get_new_thread()` for a fresh thread

The `AGUIChatClient` and `ChatAgent` handle thread capture and passing transparently when using `run_stream` with a thread object.

## Event Types

AG-UI uses Server-Sent Events (SSE) with JSON payloads. Event types are UPPERCASE with underscores; field names use camelCase.

### Core Events

| Event | Purpose |
|-------|---------|
| `RUN_STARTED` | Agent has started processing; contains `threadId`, `runId` |
| `RUN_FINISHED` | Successful completion |
| `RUN_ERROR` | Error information with `message` field |

### Text Message Events

| Event | Purpose |
|-------|---------|
| `TEXT_MESSAGE_START` | Start of a text message; contains `messageId`, `role` |
| `TEXT_MESSAGE_CONTENT` | Incremental text; contains `delta` |
| `TEXT_MESSAGE_END` | End of a text message |

### Tool Events

| Event | Purpose |
|-------|---------|
| `TOOL_CALL_START` | Tool execution begins; `toolCallId`, `toolCallName` |
| `TOOL_CALL_ARGS` | Tool arguments (may stream); `toolCallId`, `delta` |
| `TOOL_CALL_END` | Arguments complete |
| `TOOL_CALL_RESULT` | Tool execution result; `toolCallId`, `content` |
| `TOOL_CALL_REQUEST` | Frontend tool execution requested by server |

### State Events

| Event | Purpose |
|-------|---------|
| `STATE_SNAPSHOT` | Complete state snapshot; `snapshot` object |
| `STATE_DELTA` | Incremental update; `delta` as JSON Patch |

### Custom Events

| Event | Purpose |
|-------|---------|
| `CUSTOM` | Custom event type for extensions |

## Consuming Events

### With ChatAgent (High-Level)

When using `ChatAgent` with `AGUIChatClient`, updates are abstracted:

```python
async for update in agent.run_stream(message, thread=thread):
    if update.text:
        print(update.text, end="", flush=True)

    for content in update.contents:
        if isinstance(content, ToolCallContent):
            print(f"\n[Calling tool: {content.name}]")
        elif isinstance(content, ToolResultContent):
            result_text = content.result if isinstance(content.result, str) else str(content.result)
            print(f"[Tool result: {result_text}]")
```

### With Raw SSE (Low-Level)

For direct event handling, stream over HTTP and parse `data:` lines:

```python
async with httpx.AsyncClient(timeout=60.0) as client:
    async with client.stream(
        "POST",
        server_url,
        json={"messages": [{"role": "user", "content": message}]},
        headers={"Accept": "text/event-stream"},
    ) as response:
        response.raise_for_status()
        async for line in response.aiter_lines():
            if line.startswith("data: "):
                data = line[6:]
                try:
                    event = json.loads(data)
                    event_type = event.get("type", "")

                    if event_type == "RUN_STARTED":
                        thread_id = event.get("threadId")
                        run_id = event.get("runId")

                    elif event_type == "TEXT_MESSAGE_CONTENT":
                        delta = event.get("delta", "")
                        print(delta, end="", flush=True)

                    elif event_type == "TOOL_CALL_RESULT":
                        tool_call_id = event.get("toolCallId")
                        content = event.get("content")

                    elif event_type == "RUN_FINISHED":
                        # Run complete
                        break

                    elif event_type == "RUN_ERROR":
                        error_msg = event.get("message", "Unknown error")
                        print(f"\n[Error: {error_msg}]")

                except json.JSONDecodeError:
                    continue
```

## Enhanced Client for Tool Events

Display tool calls and results in real-time:

```python
"""AG-UI client with tool event handling."""

import asyncio
import os

from agent_framework import ChatAgent, ToolCallContent, ToolResultContent
from agent_framework_ag_ui import AGUIChatClient


async def main():
    server_url = os.environ.get("AGUI_SERVER_URL", "http://127.0.0.1:8888/")
    print(f"Connecting to AG-UI server at: {server_url}\n")

    chat_client = AGUIChatClient(server_url=server_url)

    agent = ChatAgent(
        name="ClientAgent",
        chat_client=chat_client,
        instructions="You are a helpful assistant.",
    )

    thread = agent.get_new_thread()

    try:
        while True:
            message = input("\nUser (:q or quit to exit): ")
            if not message.strip():
                continue

            if message.lower() in (":q", "quit"):
                break

            print("\nAssistant: ", end="", flush=True)
            async for update in agent.run_stream(message, thread=thread):
                if update.text:
                    print(f"\033[96m{update.text}\033[0m", end="", flush=True)

                for content in update.contents:
                    if isinstance(content, ToolCallContent):
                        print(f"\n\033[95m[Calling tool: {content.name}]\033[0m")
                    elif isinstance(content, ToolResultContent):
                        result_text = content.result if isinstance(content.result, str) else str(content.result)
                        print(f"\033[94m[Tool result: {result_text}]\033[0m")

            print("\n")

    except KeyboardInterrupt:
        print("\n\nExiting...")
    except Exception as e:
        print(f"\n\033[91mError: {e}\033[0m")


if __name__ == "__main__":
    asyncio.run(main())
```

## Error Handling

Handle errors gracefully:

```python
try:
    async for event in client.send_message(message):
        if event.get("type") == "RUN_ERROR":
            error_msg = event.get("message", "Unknown error")
            print(f"Error: {error_msg}")
            # Handle error appropriately
except httpx.HTTPError as e:
    print(f"HTTP error: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

## Server-Side Flow

1. Client sends HTTP POST request with messages
2. FastAPI endpoint receives the request
3. `AgentFrameworkAgent` wrapper (if used) orchestrates execution
4. Agent processes messages using Agent Framework
5. `AgentFrameworkEventBridge` converts agent updates to AG-UI events
6. Events streamed back as Server-Sent Events (SSE)
7. Connection closes when run completes

## Client-Side Flow

1. Client sends HTTP POST request to server endpoint
2. Server responds with SSE stream
3. Client parses `data:` lines as JSON events
4. Each event processed based on `type` field
5. `threadId` captured for conversation continuity
6. Stream completes when `RUN_FINISHED` arrives

## Protocol Details

- **HTTP POST**: Sending requests
- **Server-Sent Events (SSE)**: Streaming responses
- **JSON**: Event serialization
- **Thread IDs**: Maintain conversation context
- **Run IDs**: Track individual executions
- **Event naming**: UPPERCASE with underscores (e.g., `RUN_STARTED`, `TEXT_MESSAGE_CONTENT`)
- **Field naming**: camelCase (e.g., `threadId`, `runId`, `messageId`)

## Client Configuration

Set custom server URL:

```bash
export AGUI_SERVER_URL="http://127.0.0.1:8888/"
```

For long-running agents, increase client timeout:

```python
httpx.AsyncClient(timeout=120.0)
```
