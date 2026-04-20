# Acceptance Criteria: maf-ag-ui-py

**SDK**: `agent-framework-ag-ui`
**Repository**: https://github.com/microsoft/agent-framework
**Purpose**: Skill testing acceptance criteria for AG-UI protocol integration

---

## 1. Correct Import Patterns

### 1.1 Server-Side Imports

#### CORRECT: Main AG-UI endpoint registration
```python
from agent_framework_ag_ui import add_agent_framework_fastapi_endpoint
from fastapi import FastAPI
```

#### CORRECT: AgentFrameworkAgent wrapper for HITL/state
```python
from agent_framework_ag_ui import AgentFrameworkAgent, add_agent_framework_fastapi_endpoint
```

#### CORRECT: Confirmation strategy
```python
from agent_framework_ag_ui import AgentFrameworkAgent, ConfirmationStrategy
```

#### INCORRECT: Wrong module path
```python
from agent_framework.ag_ui import add_agent_framework_fastapi_endpoint  # Wrong - ag_ui is a separate package
from agent_framework_ag_ui.server import add_agent_framework_fastapi_endpoint  # Wrong - not a submodule
```

### 1.2 Client-Side Imports

#### CORRECT: AGUIChatClient
```python
from agent_framework_ag_ui import AGUIChatClient
```

#### INCORRECT: Wrong client class name
```python
from agent_framework_ag_ui import AgUIChatClient  # Wrong casing
from agent_framework_ag_ui import AGUIClient  # Wrong name
```

### 1.3 Agent Framework Core Imports

#### CORRECT: ChatAgent and tools
```python
from agent_framework import ChatAgent, ai_function
```

#### INCORRECT: Wrong import path for ai_function
```python
from agent_framework.tools import ai_function  # Wrong - ai_function is top-level
from agent_framework_ag_ui import ai_function  # Wrong - ai_function comes from agent_framework
```

---

## 2. Server Setup Patterns

### 2.1 Basic Server

#### CORRECT: Minimal AG-UI server
```python
from agent_framework import ChatAgent
from agent_framework.azure import AzureOpenAIChatClient
from agent_framework_ag_ui import add_agent_framework_fastapi_endpoint
from azure.identity import AzureCliCredential
from fastapi import FastAPI

chat_client = AzureOpenAIChatClient(
    credential=AzureCliCredential(),
    endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    deployment_name=os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"],
)
agent = ChatAgent(name="MyAgent", instructions="...", chat_client=chat_client)
app = FastAPI()
add_agent_framework_fastapi_endpoint(app, agent, "/")
```

#### INCORRECT: Missing FastAPI app
```python
add_agent_framework_fastapi_endpoint(agent, "/")  # Wrong - app is required first argument
```

#### INCORRECT: Using Flask instead of FastAPI
```python
from flask import Flask
app = Flask(__name__)
add_agent_framework_fastapi_endpoint(app, agent, "/")  # Wrong - requires FastAPI, not Flask
```

### 2.2 Endpoint Path

#### CORRECT: Path as third argument
```python
add_agent_framework_fastapi_endpoint(app, agent, "/")
add_agent_framework_fastapi_endpoint(app, agent, "/chat")
```

#### INCORRECT: Named parameter confusion
```python
add_agent_framework_fastapi_endpoint(app, path="/", agent=agent)  # Wrong argument order
```

---

## 3. Authentication Patterns

#### CORRECT: AzureCliCredential for development
```python
from azure.identity import AzureCliCredential
chat_client = AzureOpenAIChatClient(credential=AzureCliCredential(), ...)
```

#### CORRECT: DefaultAzureCredential for production
```python
from azure.identity import DefaultAzureCredential
chat_client = AzureOpenAIChatClient(credential=DefaultAzureCredential(), ...)
```

#### INCORRECT: Hardcoded API key
```python
chat_client = AzureOpenAIChatClient(api_key="sk-abc123...", ...)  # Security risk
```

#### INCORRECT: Missing credential entirely
```python
chat_client = AzureOpenAIChatClient(endpoint=endpoint)  # Missing credential
```

---

## 4. Tool Patterns

### 4.1 Backend Tools

#### CORRECT: @ai_function decorator with type annotations
```python
from agent_framework import ai_function
from typing import Annotated
from pydantic import Field

@ai_function
def get_weather(location: Annotated[str, Field(description="The city")]) -> str:
    """Get the current weather."""
    return f"Weather in {location}: sunny"
```

#### INCORRECT: Missing @ai_function decorator
```python
def get_weather(location: str) -> str:  # Not registered as a tool without decorator
    return f"Weather in {location}: sunny"
```

#### INCORRECT: Missing type annotations
```python
@ai_function
def get_weather(location):  # No type annotations - schema generation will fail
    return f"Weather in {location}: sunny"
```

### 4.2 HITL Approval Mode

#### CORRECT: approval_mode on decorator
```python
@ai_function(approval_mode="always_require")
def transfer_money(...) -> str:
    ...
```

#### INCORRECT: approval_mode as string on agent
```python
agent = ChatAgent(..., approval_mode="always_require")  # Wrong - goes on @ai_function, not agent
```

---

## 5. AgentFrameworkAgent Wrapper

### 5.1 HITL with Wrapper

#### CORRECT: Wrapping for confirmation
```python
from agent_framework_ag_ui import AgentFrameworkAgent

wrapped = AgentFrameworkAgent(agent=agent, require_confirmation=True)
add_agent_framework_fastapi_endpoint(app, wrapped, "/")
```

#### INCORRECT: Passing ChatAgent directly with HITL expectation
```python
add_agent_framework_fastapi_endpoint(app, agent, "/")
# HITL will NOT work without AgentFrameworkAgent wrapper
```

### 5.2 State Management

#### CORRECT: state_schema and predict_state_config
```python
wrapped = AgentFrameworkAgent(
    agent=agent,
    state_schema={"recipe": {"type": "object", "description": "The recipe"}},
    predict_state_config={"recipe": {"tool": "update_recipe", "tool_argument": "recipe"}},
)
```

#### INCORRECT: predict_state_config tool_argument mismatch
```python
# Tool parameter is named "data" but predict_state_config says "recipe"
@ai_function
def update_recipe(data: Recipe) -> str:  # Parameter name is "data"
    return "Updated"

predict_state_config={"recipe": {"tool": "update_recipe", "tool_argument": "recipe"}}
# Wrong - tool_argument must match the function parameter name ("data", not "recipe")
```

---

## 6. Event Handling Patterns

### 6.1 Event Type Names

#### CORRECT: UPPERCASE with underscores
```python
if event.get("type") == "RUN_STARTED": ...
if event.get("type") == "TEXT_MESSAGE_CONTENT": ...
if event.get("type") == "STATE_SNAPSHOT": ...
```

#### INCORRECT: Wrong casing
```python
if event.get("type") == "run_started": ...  # Wrong - must be UPPERCASE
if event.get("type") == "RunStarted": ...  # Wrong - not PascalCase
```

### 6.2 Field Names

#### CORRECT: camelCase field names
```python
thread_id = event.get("threadId")
run_id = event.get("runId")
message_id = event.get("messageId")
```

#### INCORRECT: snake_case field names
```python
thread_id = event.get("thread_id")  # Wrong - protocol uses camelCase
```

---

## 7. Client Patterns

### 7.1 AGUIChatClient Usage

#### CORRECT: Client with ChatAgent
```python
from agent_framework_ag_ui import AGUIChatClient
from agent_framework import ChatAgent

chat_client = AGUIChatClient(server_url="http://127.0.0.1:8888/")
agent = ChatAgent(name="Client", chat_client=chat_client, instructions="...")
thread = agent.get_new_thread()

async for update in agent.run_stream("Hello", thread=thread):
    if update.text:
        print(update.text, end="", flush=True)
```

#### INCORRECT: Using AGUIChatClient without ChatAgent wrapper
```python
client = AGUIChatClient(server_url="http://127.0.0.1:8888/")
result = await client.run("Hello")  # Wrong - AGUIChatClient is a chat client, not an agent
```

---

## 8. State Event Handling

#### CORRECT: Applying STATE_DELTA with jsonpatch
```python
import jsonpatch

if event.get("type") == "STATE_DELTA":
    patch = jsonpatch.JsonPatch(event["delta"])
    state = patch.apply(state)
elif event.get("type") == "STATE_SNAPSHOT":
    state = event["snapshot"]
```

#### INCORRECT: Treating STATE_DELTA as a full replacement
```python
if event.get("type") == "STATE_DELTA":
    state = event["delta"]  # Wrong - delta is a JSON Patch, not a full state
```

---

## 9. Installation

#### CORRECT: Pre-release install
```bash
pip install agent-framework-ag-ui --pre
```

#### INCORRECT: Without --pre flag (package is in preview)
```bash
pip install agent-framework-ag-ui  # May fail - package requires --pre during preview
```

#### INCORRECT: Wrong package name
```bash
pip install agent-framework-agui  # Wrong - missing hyphen
pip install agui  # Wrong package entirely
```

---

## 10. Async Variants

#### CORRECT: Server-side is sync setup, async execution
```python
from agent_framework import ChatAgent
from agent_framework_ag_ui import add_agent_framework_fastapi_endpoint
from fastapi import FastAPI
import uvicorn

agent = ChatAgent(chat_client=chat_client, instructions="...", name="MyAgent")
app = FastAPI()
add_agent_framework_fastapi_endpoint(app, agent, "/")
uvicorn.run(app, host="0.0.0.0", port=8000)
```

#### CORRECT: Client-side is fully async
```python
import asyncio
from agent_framework import ChatAgent
from agent_framework_ag_ui import AGUIChatClient

async def main():
    chat_client = AGUIChatClient(server_url="http://127.0.0.1:8888/")
    agent = ChatAgent(name="Client", chat_client=chat_client, instructions="...")
    thread = agent.get_new_thread()

    # Non-streaming
    result = await agent.run("Hello", thread=thread)
    print(result.text)

    # Streaming
    async for update in agent.run_stream("Tell a story", thread=thread):
        if update.text:
            print(update.text, end="", flush=True)

asyncio.run(main())
```

#### INCORRECT: Synchronous client usage
```python
client = AGUIChatClient(server_url="http://127.0.0.1:8888/")
agent = ChatAgent(name="Client", chat_client=client, instructions="...")
result = agent.run("Hello")  # Wrong - run() is async, must await
```

#### Key Rules

- `add_agent_framework_fastapi_endpoint()` is synchronous (route registration).
- All agent `run()` / `run_stream()` calls are async (handled internally by FastAPI).
- `AGUIChatClient` is used as a chat client inside `ChatAgent` — all agent calls are async.
- SSE streaming is handled by the AG-UI protocol automatically.
- There are no synchronous variants of the client-side API.

