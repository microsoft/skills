# Acceptance Criteria — maf-hosting-deployment-py

Patterns and anti-patterns to validate code generated using this skill.

---

## 0a. Import Paths

#### CORRECT: DevUI imports
```python
from agent_framework.devui import serve
from agent_framework_devui import register_cleanup
```

#### CORRECT: AG-UI imports
```python
from agent_framework_ag_ui import add_agent_framework_fastapi_endpoint
from fastapi import FastAPI
```

#### CORRECT: Azure Functions imports
```python
from agent_framework.azure import AgentFunctionApp, AzureOpenAIChatClient
```

#### INCORRECT: Wrong import paths
```python
from agent_framework_devui import serve             # Works but prefer agent_framework.devui
from agent_framework.ag_ui import add_agent_framework_fastapi_endpoint  # Wrong — separate package
from agent_framework import AgentFunctionApp        # Wrong — use agent_framework.azure
```

---

## 0b. Authentication Patterns

Hosting platforms delegate auth to the agent's chat client.

#### CORRECT: Azure OpenAI with credential for DevUI
```python
from agent_framework.azure import AzureOpenAIChatClient
from azure.identity import AzureCliCredential

agent = AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
    instructions="...", name="MyAgent"
)
serve(entities=[agent])
```

#### CORRECT: OpenAI with API key for AG-UI
```python
from agent_framework.openai import OpenAIChatClient

agent = OpenAIChatClient(api_key="your-key").as_agent(instructions="...", name="MyAgent")
app = FastAPI()
add_agent_framework_fastapi_endpoint(app, agent, "/")
```

#### CORRECT: Azure Functions with DefaultAzureCredential
```python
from azure.identity import DefaultAzureCredential

agent = AzureOpenAIChatClient(
    credential=DefaultAzureCredential(),
    endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    deployment_name=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
).as_agent(instructions="...", name="MyAgent")
app = AgentFunctionApp(agents=[agent])
```

#### INCORRECT: Passing credentials to hosting functions
```python
serve(entities=[agent], credential=AzureCliCredential())  # Wrong — no credential param on serve
add_agent_framework_fastapi_endpoint(app, agent, "/", api_key="...")  # Wrong — no auth param
```

---

## 0c. Async Variants

#### CORRECT: DevUI serve() is synchronous (blocking)
```python
serve(entities=[agent], auto_open=True)  # Blocks — runs the server
```

#### CORRECT: AG-UI with uvicorn (async server)
```python
import uvicorn

app = FastAPI()
add_agent_framework_fastapi_endpoint(app, agent, "/")
uvicorn.run(app, host="0.0.0.0", port=8000)
```

#### CORRECT: Async resource cleanup with DevUI
```python
from azure.identity.aio import DefaultAzureCredential

credential = DefaultAzureCredential()
register_cleanup(agent, credential.close)  # Async cleanup registered
serve(entities=[agent])
```

#### Key Rules

- `serve()` is synchronous and blocks the main thread.
- `add_agent_framework_fastapi_endpoint()` is synchronous (registers routes).
- The underlying agent `run()`/`run_stream()` calls are async (handled by FastAPI/AG-UI internally).
- `AgentFunctionApp` manages async orchestration via Azure Functions runtime.
- Use `register_cleanup()` for async resource disposal in DevUI.

---

## 1. DevUI Installation and Launch

#### CORRECT: Install DevUI

```bash
pip install agent-framework-devui --pre
```

#### CORRECT: Programmatic launch

```python
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIChatClient
from agent_framework.devui import serve

agent = ChatAgent(
    name="MyAgent",
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful assistant."
)
serve(entities=[agent], auto_open=True)
```

#### CORRECT: CLI launch with directory discovery

```bash
devui ./agents --port 8080
```

#### INCORRECT: Using DevUI for production

```python
serve(entities=[agent], host="0.0.0.0")
# Wrong — DevUI is a sample app for development only, not production
```

#### INCORRECT: Wrong import path for serve

```python
from agent_framework_devui import serve  # Works but prefer dotted import
from agent_framework.devui import serve  # Preferred
```

---

## 2. Directory Discovery Structure

#### CORRECT: Agent directory with __init__.py

```
entities/
    weather_agent/
        __init__.py      # Must export: agent = ChatAgent(...)
        .env             # Optional: API keys
```

```python
# weather_agent/__init__.py
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIChatClient

agent = ChatAgent(
    name="weather_agent",
    chat_client=OpenAIChatClient(),
    instructions="You are a weather assistant."
)
```

#### CORRECT: Workflow directory

```python
# my_workflow/__init__.py
from agent_framework.workflows import WorkflowBuilder

workflow = (
    WorkflowBuilder()
    .add_executor(...)
    .add_edge(...)
    .build()
)
```

#### INCORRECT: Wrong export variable name

```python
# __init__.py
my_agent = ChatAgent(...)  # Wrong — must be named `agent` for agents
my_workflow = WorkflowBuilder()...  # Wrong — must be named `workflow`
```

#### INCORRECT: Missing __init__.py

```
entities/
    weather_agent/
        agent.py         # Wrong — no __init__.py means discovery won't find it
```

---

## 3. AG-UI + FastAPI Production Hosting

#### CORRECT: Minimal AG-UI endpoint

```python
from agent_framework import ChatAgent
from agent_framework_ag_ui import add_agent_framework_fastapi_endpoint
from fastapi import FastAPI

agent = ChatAgent(chat_client=..., instructions="...")
app = FastAPI()
add_agent_framework_fastapi_endpoint(app, agent, "/")
```

#### CORRECT: Multiple agents on different paths

```python
add_agent_framework_fastapi_endpoint(app, weather_agent, "/weather")
add_agent_framework_fastapi_endpoint(app, finance_agent, "/finance")
```

#### INCORRECT: Wrong import path for AG-UI

```python
from agent_framework.ag_ui import add_agent_framework_fastapi_endpoint  # Wrong module
from agent_framework_ag_ui import add_agent_framework_fastapi_endpoint  # Correct
```

#### INCORRECT: Using DevUI serve() for production

```python
from agent_framework.devui import serve
serve(entities=[agent], host="0.0.0.0", port=80)
# Wrong — DevUI is not for production; use AG-UI + FastAPI instead
```

---

## 4. Azure Functions (Durable Agents)

#### CORRECT: AgentFunctionApp setup

```python
from agent_framework.azure import AgentFunctionApp, AzureOpenAIChatClient

agent = AzureOpenAIChatClient(...).as_agent(instructions="...", name="Joker")
app = AgentFunctionApp(agents=[agent])
```

#### INCORRECT: Missing agent name for durable agents

```python
agent = AzureOpenAIChatClient(...).as_agent(instructions="...")
app = AgentFunctionApp(agents=[agent])
# Wrong — durable agents require a name for routing
```

---

## 5. DevUI OpenAI SDK Integration

#### CORRECT: Basic request via OpenAI SDK

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

#### CORRECT: Streaming via OpenAI SDK

```python
response = client.responses.create(
    metadata={"entity_id": "weather_agent"},
    input="What's the weather?",
    stream=True
)
for event in response:
    print(event)
```

#### CORRECT: Multi-turn conversation

```python
conversation = client.conversations.create(
    metadata={"agent_id": "weather_agent"}
)
response = client.responses.create(
    metadata={"entity_id": "weather_agent"},
    input="What's the weather?",
    conversation=conversation.id
)
```

#### INCORRECT: Missing entity_id in metadata

```python
response = client.responses.create(
    input="Hello"  # Wrong — must specify metadata with entity_id
)
```

---

## 6. Tracing Configuration

#### CORRECT: CLI tracing

```bash
devui ./agents --tracing
```

#### CORRECT: Programmatic tracing

```python
serve(entities=[agent], tracing_enabled=True)
```

#### CORRECT: Export to external collector

```bash
export OTLP_ENDPOINT="http://localhost:4317"
devui ./agents --tracing
```

#### INCORRECT: Wrong environment variable name

```bash
export OTLP_ENDPEINT="http://localhost:4317"  # Typo — should be OTLP_ENDPOINT
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"  # This is the standard OTel var, DevUI uses OTLP_ENDPOINT
```

---

## 7. Security Configuration

#### CORRECT: Development (default)

```bash
devui ./agents  # Binds to 127.0.0.1, developer mode, no auth
```

#### CORRECT: Shared use (restricted)

```bash
devui ./agents --mode user --auth --host 0.0.0.0
```

#### CORRECT: Custom auth token

```bash
devui ./agents --auth --auth-token "your-secure-token"
# Or via environment variable:
export DEVUI_AUTH_TOKEN="your-secure-token"
devui ./agents --auth --host 0.0.0.0
```

#### INCORRECT: Exposing without security

```bash
devui ./agents --host 0.0.0.0  # Wrong — exposed to network without auth or user mode
```

---

## 8. Resource Cleanup

#### CORRECT: Register cleanup hooks

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

#### CORRECT: MCP tools without async context manager

```python
mcp_tool = MCPStreamableHTTPTool(url="http://localhost:8011/mcp", chat_client=chat_client)
agent = ChatAgent(tools=mcp_tool)
serve(entities=[agent])
```

#### INCORRECT: async with for MCP tools in DevUI

```python
async with MCPStreamableHTTPTool(...) as mcp_tool:
    agent = ChatAgent(tools=mcp_tool)
    serve(entities=[agent])
# Wrong — connection closes before execution; DevUI handles cleanup
```

---

## 9. Platform Selection

#### CORRECT decision tree:

| Scenario | Use |
|---|---|
| Local development and debugging | DevUI |
| Production web hosting with SSE | AG-UI + FastAPI |
| Serverless / durable orchestration | Azure Functions (`AgentFunctionApp`) |
| OpenAI-compatible HTTP endpoints (.NET) | ASP.NET `MapOpenAIChatCompletions` / `MapOpenAIResponses` |
| Agent-to-agent communication (.NET) | ASP.NET `MapA2A` |

#### INCORRECT: Using .NET-only features in Python

```python
# These are .NET-only — no Python equivalent:
app.MapOpenAIChatCompletions(agent)  # .NET only
app.MapOpenAIResponses(agent)        # .NET only
app.MapA2A(agent)                    # .NET only
```

