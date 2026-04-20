# AG-UI Server Setup (Python)

This reference provides comprehensive guidance for setting up AG-UI servers with FastAPI, including basic configuration, multiple agents, and the `AgentFrameworkAgent` wrapper.

## Table of Contents

- [Installation](#installation) — Package install with pip/uv
- [Prerequisites](#prerequisites) — Python, Azure setup, environment variables
- [Basic Server Implementation](#basic-server-implementation) — Minimal `server.py` with `add_agent_framework_fastapi_endpoint`
- [Running the Server](#running-the-server) — Python and uvicorn launch
- [Server with Backend Tools](#server-with-backend-tools) — `@ai_function` tools in the server
- [Using AgentFrameworkAgent Wrapper](#using-agentframeworkagent-wrapper) — HITL, state management, custom confirmation
- [Multiple Agents on One Server](#multiple-agents-on-one-server) — Multi-path endpoint registration
- [Custom Server Configuration](#custom-server-configuration) — CORS, endpoint paths
- [Orchestrator Agents](#orchestrator-agents) — Event bridge, message adapters
- [Verification with curl](#verification-with-curl) — Manual testing
- [Troubleshooting](#troubleshooting) — Connection, auth, timeout issues

## Installation

Install the AG-UI integration package:

```bash
pip install agent-framework-ag-ui --pre
```

Or using uv:

```bash
uv pip install agent-framework-ag-ui --prerelease=allow
```

This installs `agent-framework-core`, `fastapi`, and `uvicorn` as dependencies.

## Prerequisites

Before setting up the server:

- Python 3.10 or later
- Azure OpenAI service endpoint and deployment configured
- Azure CLI installed and authenticated (`az login`)
- User has `Cognitive Services OpenAI Contributor` role for the Azure OpenAI resource

Configure environment variables:

```bash
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
export AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o-mini"
```

## Basic Server Implementation

Create a file named `server.py`:

```python
"""AG-UI server example."""

import os

from agent_framework import ChatAgent
from agent_framework.azure import AzureOpenAIChatClient
from agent_framework_ag_ui import add_agent_framework_fastapi_endpoint
from azure.identity import AzureCliCredential
from fastapi import FastAPI

endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
deployment_name = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME")

if not endpoint:
    raise ValueError("AZURE_OPENAI_ENDPOINT environment variable is required")
if not deployment_name:
    raise ValueError("AZURE_OPENAI_DEPLOYMENT_NAME environment variable is required")

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

### Key Concepts

- **`add_agent_framework_fastapi_endpoint`**: Registers the AG-UI endpoint with automatic request/response handling and SSE streaming
- **`ChatAgent`**: The Agent Framework agent that handles incoming requests
- **FastAPI Integration**: Uses FastAPI's native async support for streaming responses
- **Instructions**: Default instructions can be overridden by client system messages

## Running the Server

Run the server:

```bash
python server.py
```

Or using uvicorn directly:

```bash
uvicorn server:app --host 127.0.0.1 --port 8888
```

The server listens on `http://127.0.0.1:8888` by default.

## Server with Backend Tools

Add function tools using the `@ai_function` decorator:

```python
"""AG-UI server with backend tool rendering."""

import os
from typing import Annotated, Any

from agent_framework import ChatAgent, ai_function
from agent_framework.azure import AzureOpenAIChatClient
from agent_framework_ag_ui import add_agent_framework_fastapi_endpoint
from azure.identity import AzureCliCredential
from fastapi import FastAPI
from pydantic import Field


@ai_function
def get_weather(
    location: Annotated[str, Field(description="The city")],
) -> str:
    """Get the current weather for a location."""
    return f"The weather in {location} is sunny with a temperature of 22°C."


@ai_function
def search_restaurants(
    location: Annotated[str, Field(description="The city to search in")],
    cuisine: Annotated[str, Field(description="Type of cuisine")] = "any",
) -> dict[str, Any]:
    """Search for restaurants in a location."""
    return {
        "location": location,
        "cuisine": cuisine,
        "results": [
            {"name": "The Golden Fork", "rating": 4.5, "price": "$$"},
            {"name": "Bella Italia", "rating": 4.2, "price": "$$$"},
            {"name": "Spice Garden", "rating": 4.7, "price": "$$"},
        ],
    }


# ... chat_client setup as above ...

agent = ChatAgent(
    name="TravelAssistant",
    instructions="You are a helpful travel assistant. Use the available tools to help users plan their trips.",
    chat_client=chat_client,
    tools=[get_weather, search_restaurants],
)

app = FastAPI(title="AG-UI Travel Assistant")
add_agent_framework_fastapi_endpoint(app, agent, "/")
```

## Using AgentFrameworkAgent Wrapper

The `AgentFrameworkAgent` wrapper enables advanced AG-UI features: human-in-the-loop, state management, and custom confirmation messages.

### Human-in-the-Loop

```python
from agent_framework_ag_ui import AgentFrameworkAgent, add_agent_framework_fastapi_endpoint

# Tools marked with approval_mode="always_require" require user approval
wrapped_agent = AgentFrameworkAgent(
    agent=agent,
    require_confirmation=True,
)

add_agent_framework_fastapi_endpoint(app, wrapped_agent, "/")
```

### State Management

```python
from agent_framework_ag_ui import (
    AgentFrameworkAgent,
    RecipeConfirmationStrategy,
    add_agent_framework_fastapi_endpoint,
)

recipe_agent = AgentFrameworkAgent(
    agent=agent,
    name="RecipeAgent",
    description="Creates and modifies recipes with streaming state updates",
    state_schema={
        "recipe": {"type": "object", "description": "The current recipe"},
    },
    predict_state_config={
        "recipe": {"tool": "update_recipe", "tool_argument": "recipe"},
    },
    confirmation_strategy=RecipeConfirmationStrategy(),
)

add_agent_framework_fastapi_endpoint(app, recipe_agent, "/")
```

### Custom Confirmation Strategy

```python
from typing import Any
from agent_framework_ag_ui import AgentFrameworkAgent, ConfirmationStrategy


class BankingConfirmationStrategy(ConfirmationStrategy):
    """Custom confirmation messages for banking operations."""
    
    def on_approval_accepted(self, steps: list[dict[str, Any]]) -> str:
        tool_name = steps[0].get("toolCallName", "action")
        return f"Thank you for confirming. Proceeding with {tool_name}..."
    
    def on_approval_rejected(self, steps: list[dict[str, Any]]) -> str:
        return "Action cancelled. No changes have been made to your account."
    
    def on_state_confirmed(self) -> str:
        return "Changes confirmed and applied."
    
    def on_state_rejected(self) -> str:
        return "Changes discarded."


wrapped_agent = AgentFrameworkAgent(
    agent=agent,
    require_confirmation=True,
    confirmation_strategy=BankingConfirmationStrategy(),
)
```

## Multiple Agents on One Server

Register multiple agents on different paths:

```python
app = FastAPI()

weather_agent = ChatAgent(name="weather", chat_client=chat_client, ...)
finance_agent = ChatAgent(name="finance", chat_client=chat_client, ...)

add_agent_framework_fastapi_endpoint(app, weather_agent, "/weather")
add_agent_framework_fastapi_endpoint(app, finance_agent, "/finance")
```

## Custom Server Configuration

Add CORS for web clients:

```python
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

add_agent_framework_fastapi_endpoint(app, agent, "/agent")
```

## Endpoint Path Configuration

The third argument to `add_agent_framework_fastapi_endpoint` is the path:

- `"/"` – Root endpoint; requests go to `http://localhost:8888/`
- `"/agent"` – Mounted at `/agent`; requests go to `http://localhost:8888/agent`

All AG-UI protocol requests (POST with messages) and SSE streaming use this path.

## Orchestrator Agents

For complex flows, the `AgentFrameworkAgent` wrapper provides:

- **Event Bridge**: Converts Agent Framework events to AG-UI protocol events
- **Message Adapters**: Bidirectional conversion between AG-UI and Agent Framework message formats
- **Confirmation Strategies**: Extensible strategies for domain-specific confirmation messages

The underlying `ChatAgent` handles execution flow; `AgentFrameworkAgent` adds protocol translation and optional HITL/state middleware.

## Verification with curl

Test the server manually:

```bash
curl -N http://127.0.0.1:8888/ \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is 2 + 2?"}
    ]
  }'
```

Expected output format:

```
data: {"type":"RUN_STARTED","threadId":"...","runId":"..."}

data: {"type":"TEXT_MESSAGE_START","messageId":"...","role":"assistant"}

data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"...","delta":"The"}

data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"...","delta":" answer"}

...

data: {"type":"TEXT_MESSAGE_END","messageId":"..."}

data: {"type":"RUN_FINISHED","threadId":"...","runId":"..."}
```

## Troubleshooting

### Connection Refused

Ensure the server is running before starting the client:

```bash
# Terminal 1
python server.py

# Terminal 2 (after server starts)
python client.py
```

### Authentication Errors

Authenticate with Azure:

```bash
az login
```

Verify role assignment on the Azure OpenAI resource.

### Streaming Timeouts

For long-running agents, configure timeouts:

```python
# Client-side - increase timeout
httpx.AsyncClient(timeout=60.0)
```

For very long runs, increase further or implement chunked streaming.
