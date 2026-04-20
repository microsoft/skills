# Acceptance Criteria — maf-tools-rag-py

Use these patterns to validate that generated code follows the correct Microsoft Agent Framework tool, RAG, and agent composition APIs.

---

## 0a. Import Paths

#### CORRECT: Function tool imports
```python
from agent_framework import ChatAgent, ai_function
from typing import Annotated
from pydantic import Field
```

#### CORRECT: Hosted tool imports
```python
from agent_framework import HostedWebSearchTool, HostedCodeInterpreterTool
from agent_framework import HostedFileSearchTool, HostedVectorStoreContent, HostedMCPTool
```

#### CORRECT: MCP tool imports
```python
from agent_framework import MCPStdioTool, MCPStreamableHTTPTool, MCPWebsocketTool
```

#### CORRECT: Agent composition imports
```python
from agent_framework.openai import OpenAIResponsesClient
```

#### CORRECT: RAG / VectorStore imports
```python
from semantic_kernel.connectors.azure_ai_search import AzureAISearchCollection
from semantic_kernel.functions import KernelParameterMetadata
```

#### INCORRECT: Wrong import paths
```python
from agent_framework.tools import ai_function          # Wrong — ai_function is top-level
from agent_framework.tools import HostedWebSearchTool  # Wrong — top-level import
from agent_framework.mcp import MCPStdioTool           # Wrong — top-level import
from agent_framework import VectorStore                # Wrong — use semantic_kernel for RAG
```

---

## 0b. Authentication Patterns

Tools and RAG do not handle authentication directly. Authentication is configured at the **agent/chat client level**.

#### CORRECT: Azure AI Foundry agent with hosted tools
```python
from agent_framework.azure import AzureAIAgentClient
from azure.identity.aio import AzureCliCredential

async with (
    AzureCliCredential() as credential,
    AzureAIAgentClient(async_credential=credential).as_agent(
        instructions="...",
        tools=[HostedWebSearchTool(), HostedCodeInterpreterTool()]
    ) as agent,
):
    result = await agent.run("Search the web for Python news")
```

#### CORRECT: OpenAI agent with function tools
```python
from agent_framework.openai import OpenAIChatClient

agent = OpenAIChatClient(api_key="...").as_agent(
    instructions="...",
    tools=[get_weather]
)
```

#### CORRECT: MCP tool with auth headers
```python
async with MCPStreamableHTTPTool(
    name="My API",
    url="https://api.example.com/mcp",
    headers={"Authorization": "Bearer your-token"},
) as mcp_server:
    result = await agent.run("Query the API", tools=mcp_server)
```

#### INCORRECT: Passing credentials to tool classes
```python
tool = HostedWebSearchTool(credential=AzureCliCredential())  # Wrong — no credential param on tools
mcp = MCPStdioTool(api_key="...")  # Wrong — no api_key param
```

---

## 0c. Async Variants

#### CORRECT: MCP tools require async with
```python
import asyncio

async def main():
    async with MCPStdioTool(name="calc", command="uvx", args=["mcp-server-calculator"]) as mcp:
        result = await agent.run("What is 15 * 23?", tools=mcp)
        print(result.text)

asyncio.run(main())
```

#### CORRECT: Agent runs with tools are async
```python
async def main():
    result = await agent.run("Search for news", tools=[HostedWebSearchTool()])
    async for chunk in agent.run_stream("Analyze results"):
        if chunk.text:
            print(chunk.text, end="", flush=True)

asyncio.run(main())
```

#### INCORRECT: Synchronous MCP tool usage
```python
mcp = MCPStdioTool(name="calc", command="uvx", args=["calculator"])
result = agent.run("Calculate", tools=mcp)  # Wrong — missing async with and await
```

#### Key Rules

- `MCPStdioTool`, `MCPStreamableHTTPTool`, `MCPWebsocketTool` must be used with `async with`.
- `HostedMCPTool` does NOT need `async with` (managed by service).
- `agent.run()` and `agent.run_stream()` are always async.
- `HostedWebSearchTool`, `HostedCodeInterpreterTool`, `HostedFileSearchTool` have no async lifecycle.
- There are no synchronous variants of any tool API.

---

## 1. Function Tools

### Correct

```python
from typing import Annotated
from pydantic import Field
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIChatClient

def get_weather(
    location: Annotated[str, Field(description="The location to get the weather for.")],
) -> str:
    """Get the weather for a given location."""
    return f"The weather in {location} is cloudy with a high of 15°C."

agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful assistant",
    tools=[get_weather]
)
```

### Correct — @ai_function Decorator

```python
from agent_framework import ai_function

@ai_function(name="weather_tool", description="Retrieves weather information")
def get_weather(
    location: Annotated[str, Field(description="The location.")],
) -> str:
    return f"The weather in {location} is cloudy."
```

### Correct — Approval Mode

```python
@ai_function(approval_mode="always_require")
def sensitive_action(param: Annotated[str, "Parameter"]) -> str:
    """Performs a sensitive action requiring human approval."""
    return f"Done: {param}"
```

### Incorrect

```python
# Wrong: Missing type annotations (framework can't infer schema)
def get_weather(location):
    return f"Weather in {location}"

# Wrong: Using a non-existent decorator
@tool
def get_weather(location: str) -> str:
    ...

# Wrong: Passing class instead of instance methods
agent = ChatAgent(chat_client=..., tools=[WeatherTools])
```

### Key Rules

- Use `Annotated[type, Field(description="...")]` for parameter metadata.
- Docstrings become tool descriptions; function names become tool names.
- `@ai_function` overrides name, description, and approval behavior.
- `approval_mode="always_require"` pauses for human approval via `user_input_requests`.
- Group related tools in a class; pass bound methods (e.g., `instance.method`), not the class itself.

---

## 2. Per-Run vs Agent-Level Tools

### Correct

```python
agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="...",
    tools=[get_time]
)

result = await agent.run("Weather and time?", tools=[get_weather])
```

### Incorrect

```python
# Wrong: Adding tools after construction (no such API)
agent.add_tool(get_weather)

# Wrong: Expecting run-level tools to persist across runs
result1 = await agent.run("Weather?", tools=[get_weather])
result2 = await agent.run("Weather again?")  # get_weather not available here
```

### Key Rules

- Agent-level tools (via constructor `tools=`) persist for all runs.
- Run-level tools (via `run(tools=)` or `run_stream(tools=)`) are per-invocation only.
- When both provide the same tool name, run-level takes precedence.

---

## 3. Hosted Tools

### Correct — Web Search

```python
from agent_framework import HostedWebSearchTool

agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="...",
    tools=[HostedWebSearchTool(
        additional_properties={"user_location": {"city": "Seattle", "country": "US"}}
    )]
)
```

### Correct — Code Interpreter

```python
from agent_framework import HostedCodeInterpreterTool

agent = ChatAgent(
    chat_client=AzureAIAgentClient(async_credential=credential),
    instructions="...",
    tools=[HostedCodeInterpreterTool()]
)
```

### Correct — File Search

```python
from agent_framework import HostedFileSearchTool, HostedVectorStoreContent

agent = ChatAgent(
    chat_client=AzureAIAgentClient(async_credential=credential),
    instructions="...",
    tools=[HostedFileSearchTool(
        inputs=[HostedVectorStoreContent(vector_store_id="vs_123")],
        max_results=10
    )]
)
```

### Correct — Hosted MCP

```python
from agent_framework import HostedMCPTool

agent = chat_client.as_agent(
    instructions="...",
    tools=HostedMCPTool(
        name="Microsoft Learn MCP",
        url="https://learn.microsoft.com/api/mcp"
    )
)
```

### Key Rules

- Hosted tools are managed by the inference service (Azure AI Foundry).
- `HostedWebSearchTool` accepts `additional_properties` for location hints.
- `HostedFileSearchTool` requires `inputs` with `HostedVectorStoreContent`.
- `HostedMCPTool` accepts `name`, `url`, optional `approval_mode` and `headers`.

---

## 4. MCP Tools (External Servers)

### Correct — Stdio

```python
from agent_framework import MCPStdioTool

async with MCPStdioTool(name="calculator", command="uvx", args=["mcp-server-calculator"]) as mcp_server:
    result = await agent.run("What is 15 * 23?", tools=mcp_server)
```

### Correct — HTTP

```python
from agent_framework import MCPStreamableHTTPTool

async with MCPStreamableHTTPTool(
    name="Microsoft Learn MCP",
    url="https://learn.microsoft.com/api/mcp",
    headers={"Authorization": "Bearer token"},
) as mcp_server:
    result = await agent.run("How to create a storage account?", tools=mcp_server)
```

### Correct — WebSocket

```python
from agent_framework import MCPWebsocketTool

async with MCPWebsocketTool(name="realtime-data", url="wss://api.example.com/mcp") as mcp_server:
    result = await agent.run("Current market status?", tools=mcp_server)
```

### Incorrect

```python
# Wrong: Not using async with (server won't start/cleanup properly)
mcp = MCPStdioTool(name="calc", command="uvx", args=["mcp-server-calculator"])
result = await agent.run("...", tools=mcp)

# Wrong: Using HostedMCPTool for a local process server
server = HostedMCPTool(command="uvx", args=["mcp-server-calculator"])
```

### Key Rules

- **Always** use `async with` for MCP tool lifecycle management.
- `MCPStdioTool` — local processes via stdin/stdout. Params: `name`, `command`, `args`.
- `MCPStreamableHTTPTool` — remote HTTP/SSE. Params: `name`, `url`, `headers`.
- `MCPWebsocketTool` — WebSocket. Params: `name`, `url`.
- `HostedMCPTool` — Azure-managed MCP (different class, no `async with` needed).

---

## 5. RAG via VectorStore

### Correct

```python
from semantic_kernel.connectors.azure_ai_search import AzureAISearchCollection
from semantic_kernel.functions import KernelParameterMetadata

search_function = collection.create_search_function(
    function_name="search_knowledge_base",
    description="Search the knowledge base.",
    search_type="keyword_hybrid",
    parameters=[
        KernelParameterMetadata(
            name="query",
            description="The search query.",
            type="str",
            is_required=True,
            type_object=str,
        ),
    ],
    string_mapper=lambda x: f"[{x.record.category}] {x.record.title}: {x.record.content}",
)

search_tool = search_function.as_agent_framework_tool()
agent = client.as_agent(instructions="...", tools=search_tool)
```

### Incorrect

```python
# Wrong: Using search_function directly without conversion
agent = client.as_agent(tools=search_function)

# Wrong: Missing string_mapper (results won't be formatted for the model)
search_function = collection.create_search_function(
    function_name="search",
    description="...",
    search_type="keyword_hybrid",
)
```

### Key Rules

- Requires `semantic-kernel` version 1.38+.
- Call `collection.create_search_function(...)` then `.as_agent_framework_tool()`.
- `search_type` options: `"keyword"`, `"semantic"`, `"keyword_hybrid"`, `"semantic_hybrid"`.
- `string_mapper` converts each result to a string for the model.
- `parameters` uses `KernelParameterMetadata` with `name`, `description`, `type`, `type_object`.
- Multiple search tools (different knowledge bases or strategies) can be passed to one agent.

---

## 6. Agent Composition

### Correct — Agent as Tool

```python
weather_agent = client.as_agent(
    name="WeatherAgent",
    description="Answers weather questions.",
    tools=get_weather
)

main_agent = client.as_agent(
    instructions="Respond in French.",
    tools=weather_agent.as_tool()
)

result = await main_agent.run("Weather in Amsterdam?")
```

### Correct — Customized Tool

```python
weather_tool = weather_agent.as_tool(
    name="WeatherLookup",
    description="Look up weather information",
    arg_name="query",
    arg_description="The weather query or location"
)
```

### Correct — Agent as MCP Server

```python
from agent_framework.openai import OpenAIResponsesClient

agent = OpenAIResponsesClient().as_agent(
    name="RestaurantAgent",
    description="Answer questions about the menu.",
    tools=[get_specials, get_item_price],
)

server = agent.as_mcp_server()
```

### Incorrect

```python
# Wrong: Calling agent directly instead of using as_tool
main_agent = client.as_agent(tools=[weather_agent])

# Wrong: Missing name/description on sub-agent (used as MCP metadata)
agent = client.as_agent(instructions="...")
server = agent.as_mcp_server()  # No name/description for MCP metadata
```

### Key Rules

- `.as_tool()` converts an agent into a function tool for another agent.
- `.as_tool()` accepts optional `name`, `description`, `arg_name`, `arg_description`.
- Agent's `name` and `description` become the tool name/description by default.
- `.as_mcp_server()` exposes an agent over MCP for external MCP clients.
- Use `stdio_server()` from `mcp.server.stdio` for stdio transport.

---

## 7. Mixing Tool Types

### Correct

```python
from agent_framework import ChatAgent, HostedWebSearchTool, MCPStdioTool

async with MCPStdioTool(name="calc", command="uvx", args=["mcp-server-calculator"]) as calc:
    agent = ChatAgent(
        chat_client=client,
        instructions="Versatile assistant.",
        tools=[get_time, HostedWebSearchTool()]
    )
    result = await agent.run("Calculate 15*23, time, and news?", tools=calc)
```

### Key Rules

- Function tools, hosted tools, and MCP tools can all be combined on one agent.
- Agent-level tools + run-level tools are merged; run-level takes precedence on name collision.
- `HostedMCPTool` (Azure-managed) does not need `async with`; external MCP tools do.

