# Hosted and MCP Tools Reference

This reference covers all hosted tool types and MCP (Model Context Protocol) tool integrations available in Microsoft Agent Framework Python.

## Table of Contents

- [Hosted Tools](#hosted-tools)
  - [HostedWebSearchTool](#hostedwebsearchtool)
  - [HostedCodeInterpreterTool](#hostedcodeinterpretertool)
  - [HostedFileSearchTool](#hostedfilesearchtool)
  - [HostedMCPTool](#hostedmcptool)
- [MCP Tools (External Servers)](#mcp-tools-external-servers)
  - [MCPStdioTool -- Local Process Servers](#mcpstdiotool----local-process-servers)
  - [MCPStreamableHTTPTool -- HTTP/SSE Servers](#mcpstreamablehttptool----httpsse-servers)
  - [MCPWebsocketTool -- WebSocket Servers](#mcpwebsockettool----websocket-servers)
- [Popular MCP Servers](#popular-mcp-servers)
- [Hosted vs External MCP Comparison](#hosted-vs-external-mcp-comparison)
- [Mixing Tool Types](#mixing-tool-types)
- [Security Considerations](#security-considerations)

## Hosted Tools

Hosted tools are managed and executed by the inference service (e.g., Azure AI Foundry). Pass them as tool instances at agent construction or per-run.

### HostedWebSearchTool

Enables agents to perform live web searches. The service executes the search and returns results to the agent.

```python
from agent_framework import HostedWebSearchTool, ChatAgent
from agent_framework.openai import OpenAIChatClient

agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful assistant with web search capabilities",
    tools=[
        HostedWebSearchTool(
            additional_properties={
                "user_location": {
                    "city": "Seattle",
                    "country": "US"
                }
            }
        )
    ]
)

result = await agent.run("What are the latest news about AI?")
print(result.text)
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `additional_properties` | `dict` | Optional properties like `user_location` to influence search results |

Use `HostedWebSearchTool` for live data, news, current events, and real-time information that the model's training data may not cover.

### HostedCodeInterpreterTool

Gives agents the ability to write and execute code in a sandboxed environment. Useful for data analysis, computation, and visualization.

```python
from agent_framework import HostedCodeInterpreterTool, ChatAgent
from agent_framework.azure import AzureAIAgentClient
from azure.identity.aio import AzureCliCredential

async with AzureCliCredential() as credential:
    agent = ChatAgent(
        chat_client=AzureAIAgentClient(async_credential=credential),
        instructions="You are a data analysis assistant",
        tools=[HostedCodeInterpreterTool()]
    )
    result = await agent.run("Analyze this dataset and create a visualization")
```

Code interpreter supports file uploads for analysis:

```python
from agent_framework import HostedCodeInterpreterTool

agent = client.as_agent(
    instructions="You analyze uploaded data files.",
    tools=[HostedCodeInterpreterTool()],
)

# Upload a file and reference it in the prompt
result = await agent.run("Analyze the trends in the uploaded CSV file.")
```

### HostedFileSearchTool

Enables document search over vector stores hosted by the service. Useful for knowledge bases and document retrieval.

```python
from agent_framework import HostedFileSearchTool, HostedVectorStoreContent, ChatAgent
from agent_framework.azure import AzureAIAgentClient
from azure.identity.aio import AzureCliCredential

async with AzureCliCredential() as credential:
    agent = ChatAgent(
        chat_client=AzureAIAgentClient(async_credential=credential),
        instructions="You are a document search assistant",
        tools=[
            HostedFileSearchTool(
                inputs=[
                    HostedVectorStoreContent(vector_store_id="vs_123")
                ],
                max_results=10
            )
        ]
    )
    result = await agent.run("Find information about quarterly reports")
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `inputs` | `list[HostedVectorStoreContent]` | Vector store references to search |
| `max_results` | `int` | Maximum number of results to return |

### HostedMCPTool

Connects to MCP servers hosted and managed by Azure AI Foundry. The service handles server lifecycle, authentication, and tool execution.

```python
from agent_framework import HostedMCPTool, ChatAgent
from agent_framework.azure import AzureAIAgentClient
from azure.identity.aio import AzureCliCredential

async with (
    AzureCliCredential() as credential,
    AzureAIAgentClient(async_credential=credential) as chat_client,
):
    agent = chat_client.as_agent(
        name="MicrosoftLearnAgent",
        instructions="You answer questions by searching Microsoft Learn content only.",
        tools=HostedMCPTool(
            name="Microsoft Learn MCP",
            url="https://learn.microsoft.com/api/mcp",
        ),
    )
    result = await agent.run(
        "Please summarize the Azure AI Agent documentation related to MCP tool calling?"
    )
    print(result)
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `str` | Display name for the MCP server |
| `url` | `str` | URL of the hosted MCP server endpoint |
| `approval_mode` | `str` | `"never_require"` or `"always_require"` for tool execution approval |
| `headers` | `dict` | Optional HTTP headers (e.g., authorization tokens) |

#### Multi-Tool Configuration

Combine multiple hosted MCP tools with different approval policies:

```python
agent = chat_client.as_agent(
    name="MultiToolAgent",
    instructions="You can search documentation and access GitHub repositories.",
    tools=[
        HostedMCPTool(
            name="Microsoft Learn MCP",
            url="https://learn.microsoft.com/api/mcp",
            approval_mode="never_require",
        ),
        HostedMCPTool(
            name="GitHub MCP",
            url="https://api.github.com/mcp",
            approval_mode="always_require",
            headers={"Authorization": "Bearer github-token"},
        ),
    ],
)
```

#### Approval Modes

| Mode | Behavior |
|------|----------|
| `"never_require"` | Tools execute automatically without user approval |
| `"always_require"` | All tool invocations require explicit user approval |

## MCP Tools (External Servers)

MCP tools connect to external Model Context Protocol servers that run outside the inference service. The Agent Framework supports three connection types.

### MCPStdioTool -- Local Process Servers

Connect to MCP servers running as local processes via standard input/output. Best for local development and command-line tools.

```python
import asyncio
from agent_framework import ChatAgent, MCPStdioTool
from agent_framework.openai import OpenAIChatClient

async def local_mcp_example():
    async with (
        MCPStdioTool(
            name="calculator",
            command="uvx",
            args=["mcp-server-calculator"]
        ) as mcp_server,
        ChatAgent(
            chat_client=OpenAIChatClient(),
            name="MathAgent",
            instructions="You are a helpful math assistant that can solve calculations.",
        ) as agent,
    ):
        result = await agent.run(
            "What is 15 * 23 + 45?",
            tools=mcp_server
        )
        print(result)

asyncio.run(local_mcp_example())
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `str` | Display name for the MCP server |
| `command` | `str` | Executable command to start the server |
| `args` | `list[str]` | Command-line arguments |

**Important:** Use `async with` to manage MCP server lifecycle. The server process starts on entry and terminates on exit.

### MCPStreamableHTTPTool -- HTTP/SSE Servers

Connect to MCP servers over HTTP with Server-Sent Events. Best for remote APIs and cloud-hosted services.

```python
import asyncio
from agent_framework import ChatAgent, MCPStreamableHTTPTool
from agent_framework.azure import AzureAIAgentClient
from azure.identity.aio import AzureCliCredential

async def http_mcp_example():
    async with (
        AzureCliCredential() as credential,
        MCPStreamableHTTPTool(
            name="Microsoft Learn MCP",
            url="https://learn.microsoft.com/api/mcp",
            headers={"Authorization": "Bearer your-token"},
        ) as mcp_server,
        ChatAgent(
            chat_client=AzureAIAgentClient(async_credential=credential),
            name="DocsAgent",
            instructions="You help with Microsoft documentation questions.",
        ) as agent,
    ):
        result = await agent.run(
            "How to create an Azure storage account using az cli?",
            tools=mcp_server
        )
        print(result)

asyncio.run(http_mcp_example())
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `str` | Display name for the MCP server |
| `url` | `str` | HTTP/HTTPS endpoint URL |
| `headers` | `dict` | Optional HTTP headers for authentication |

### MCPWebsocketTool -- WebSocket Servers

Connect to MCP servers over WebSocket for real-time bidirectional communication.

```python
import asyncio
from agent_framework import ChatAgent, MCPWebsocketTool
from agent_framework.openai import OpenAIChatClient

async def websocket_mcp_example():
    async with (
        MCPWebsocketTool(
            name="realtime-data",
            url="wss://api.example.com/mcp",
        ) as mcp_server,
        ChatAgent(
            chat_client=OpenAIChatClient(),
            name="DataAgent",
            instructions="You provide real-time data insights.",
        ) as agent,
    ):
        result = await agent.run(
            "What is the current market status?",
            tools=mcp_server
        )
        print(result)

asyncio.run(websocket_mcp_example())
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `str` | Display name for the MCP server |
| `url` | `str` | WebSocket URL (`wss://` or `ws://`) |

## Popular MCP Servers

Common MCP servers compatible with the Agent Framework:

| Server | Command | Use Case |
|--------|---------|----------|
| Calculator | `uvx mcp-server-calculator` | Mathematical computations |
| Filesystem | `uvx mcp-server-filesystem` | File system operations |
| GitHub | `npx @modelcontextprotocol/server-github` | GitHub repository access |
| SQLite | `uvx mcp-server-sqlite` | Database operations |
| Microsoft Learn | HTTP: `https://learn.microsoft.com/api/mcp` | Documentation search |

## Hosted vs External MCP Comparison

| Aspect | HostedMCPTool | MCPStdioTool / MCPStreamableHTTPTool / MCPWebsocketTool |
|--------|---------------|--------------------------------------------------------|
| Server management | Azure AI Foundry manages | Developer manages |
| Connection | Via service API | Direct stdio / HTTP / WebSocket |
| Authentication | Service-level | Developer configures headers |
| Approval workflow | Built-in `approval_mode` | Use `@ai_function(approval_mode=...)` on wrapper |
| Lifecycle | Service-managed | `async with` context manager |
| Best for | Production, Azure workloads | Local dev, third-party servers |

## Mixing Tool Types

Combine hosted, MCP, and function tools on a single agent:

```python
from agent_framework import ChatAgent, HostedWebSearchTool, MCPStdioTool

def get_time() -> str:
    """Get the current time."""
    from datetime import datetime
    return datetime.now().isoformat()

async with MCPStdioTool(name="calculator", command="uvx", args=["mcp-server-calculator"]) as calc:
    agent = ChatAgent(
        chat_client=client,
        instructions="You are a versatile assistant.",
        tools=[get_time, HostedWebSearchTool()]
    )
    result = await agent.run("What is 15 * 23, what time is it, and what's the news?", tools=calc)
```

Agent-level tools persist across all runs. Per-run tools (via `tools=` in `run()`) add capabilities for that invocation only and take precedence when names collide.

## Security Considerations

- Use `headers` on `MCPStreamableHTTPTool` for authentication tokens
- Set `approval_mode="always_require"` on `HostedMCPTool` for sensitive operations
- MCP servers accessed via stdio run as local processes with the caller's permissions
- Validate MCP server URLs and restrict to trusted endpoints in production
- Use `async with` to ensure proper cleanup of MCP server connections
