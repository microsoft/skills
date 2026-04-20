---
name: azure-maf-tools-rag-py
description: This skill should be used when the user asks to "add tools to agent", "function tool", "hosted tool", "MCP tool", "RAG", "agent as tool", "code interpreter", "web search tool", "file search tool", "@ai_function", or needs guidance on tool integration, retrieval augmented generation, or agent composition patterns in Microsoft Agent Framework Python. Make sure to use this skill whenever the user mentions giving an agent access to external functions, connecting to an MCP server, performing web searches from an agent, running code in a sandbox, searching documents or knowledge bases, exposing an agent over MCP, calling one agent from another, VectorStore search tools, tool approval workflows, or mixing different tool types, even if they don't explicitly say "tools" or "RAG".
version: 0.1.0
---

# MAF Tools and RAG

This skill provides guidance for adding tools (function, hosted, MCP) and RAG capabilities to agents in Microsoft Agent Framework Python. Use it when implementing tool integration, retrieval augmented generation, or agent composition.

## Tool Type Taxonomy

Microsoft Agent Framework Python supports three categories of tools:

### Function Tools

Plain Python functions or methods exposed as tools. Execute in-process with your agent. Use for domain logic, API calls, and custom behaviors.

### Hosted Tools

Tools managed by the inference service (e.g., Azure AI Foundry). The service hosts and executes them. Use for web search, code interpreter, file search, and hosted MCP endpoints.

### MCP Tools

Tools from external Model Context Protocol servers. Connect via stdio, HTTP/SSE, or WebSocket. Use for third-party capabilities (GitHub, filesystem, SQLite, Microsoft Learn documentation).

## Quick Decision Guide

| Need | Use |
|------|-----|
| Custom business logic, API integration | Function tool |
| Web search, live data | `HostedWebSearchTool` |
| Code execution, data analysis | `HostedCodeInterpreterTool` |
| Document/knowledge search | `HostedFileSearchTool` or Semantic Kernel VectorStore |
| Third-party MCP server (local process) | `MCPStdioTool` |
| Third-party MCP server (HTTP endpoint) | `MCPStreamableHTTPTool` |
| Third-party MCP server (WebSocket) | `MCPWebsocketTool` |
| Azure-hosted MCP server | `HostedMCPTool` |
| Compose agents (one agent calls another) | `agent.as_tool()` |
| Expose agent for MCP clients | `agent.as_mcp_server()` |

## Function Tools (Minimal Pattern)

Define a Python function with type annotations and pass it to the agent:

```python
from typing import Annotated
from pydantic import Field

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

Use `@ai_function` to customize name/description or set `approval_mode="always_require"` for human-in-the-loop. Group related tools in a class (e.g., `WeatherTools`) and pass methods as tools.

## Hosted and MCP Tools (Minimal Patterns)

**Web search:**

```python
from agent_framework import HostedWebSearchTool

agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful assistant with web search",
    tools=[HostedWebSearchTool(additional_properties={"user_location": {"city": "Seattle", "country": "US"}})]
)
```

**Code interpreter:**

```python
from agent_framework import HostedCodeInterpreterTool

agent = ChatAgent(chat_client=client, instructions="You analyze data.", tools=[HostedCodeInterpreterTool()])
```

**Hosted MCP (e.g., Microsoft Learn):**

```python
from agent_framework import HostedMCPTool

agent = ChatAgent(
    chat_client=AzureAIAgentClient(async_credential=credential),
    instructions="You help with documentation.",
    tools=[HostedMCPTool(name="Microsoft Learn MCP", url="https://learn.microsoft.com/api/mcp")]
)
```

**Local MCP (stdio):**

```python
from agent_framework import MCPStdioTool

async with MCPStdioTool(name="calculator", command="uvx", args=["mcp-server-calculator"]) as mcp_server:
    result = await agent.run("What is 15 * 23 + 45?", tools=mcp_server)
```

**HTTP MCP:**

```python
from agent_framework import MCPStreamableHTTPTool

async with MCPStreamableHTTPTool(name="Microsoft Learn MCP", url="https://learn.microsoft.com/api/mcp") as mcp_server:
    result = await agent.run("How to create an Azure storage account?", tools=mcp_server)
```

**WebSocket MCP:**

```python
from agent_framework import MCPWebsocketTool

async with MCPWebsocketTool(name="realtime-data", url="wss://api.example.com/mcp") as mcp_server:
    result = await agent.run("What is the current market status?", tools=mcp_server)
```

## Mixing Tools

Combine agent-level and run-level tools. Agent-level tools are available for all runs; run-level tools add per-invocation capabilities and take precedence when both provide the same tool.

```python
agent = ChatAgent(chat_client=client, instructions="Helpful assistant", tools=[get_time])

result = await agent.run("What's the weather and time in New York?", tools=[get_weather])
```

## RAG via VectorStore

Use Semantic Kernel VectorStore to create search tools for RAG. Requires `semantic-kernel` 1.38+.

1. Create a VectorStore collection (e.g., `AzureAISearchCollection`, `QdrantCollection`).
2. Call `collection.create_search_function()` with name, description, `search_type`, `parameters`, and `string_mapper`.
3. Convert to Agent Framework tool via `.as_agent_framework_tool()`.
4. Pass the tool to the agent.

```python
search_function = collection.create_search_function(
    function_name="search_knowledge_base",
    description="Search the knowledge base for support articles.",
    search_type="keyword_hybrid",
    parameters=[KernelParameterMetadata(name="query", type="str", ...)],
    string_mapper=lambda x: f"[{x.record.category}] {x.record.title}: {x.record.content}",
)
search_tool = search_function.as_agent_framework_tool()
agent = client.as_agent(instructions="...", tools=search_tool)
```

Support multiple search tools (different knowledge bases or search strategies) by passing multiple tools to the agent.

## Agent Composition

**Agent as function tool:** Convert an agent to a tool so another agent can call it:

```python
weather_agent = client.as_agent(name="WeatherAgent", description="Answers weather questions.", tools=get_weather)
main_agent = client.as_agent(instructions="Respond in French.", tools=weather_agent.as_tool())
result = await main_agent.run("What is the weather like in Amsterdam?")
```

Customize with `as_tool(name="...", description="...", arg_name="...", arg_description="...")`.

**Agent as MCP server:** Expose an agent over MCP for MCP-compatible clients (e.g., VS Code GitHub Copilot Agents):

```python
agent = client.as_agent(name="RestaurantAgent", description="Answers menu questions.", tools=[get_specials, get_item_price])
server = agent.as_mcp_server()
# Run server with stdio_server() for stdio transport
```

## Tool Support by Provider

Tool support varies by chat client and service. Azure AI Foundry supports hosted tools (web search, code interpreter, file search, hosted MCP). Open AI and other providers may support different subsets. Check service documentation for capabilities.

### Provider Tool-Support Matrix (Quick Reference)

| Provider/Client | Function Tools | Hosted Web Search | Hosted Code Interpreter | Hosted File Search | Hosted MCP | MCP Client Tools |
|-----------------|----------------|-------------------|-------------------------|--------------------|-----------|------------------|
| OpenAI Chat/Responses | Yes | Provider-dependent | Provider-dependent | Provider-dependent | Provider-dependent | Yes (`MCPStdioTool`, `MCPStreamableHTTPTool`, `MCPWebsocketTool`) |
| Azure OpenAI Chat/Responses | Yes | Provider-dependent | Provider-dependent | Provider-dependent | Provider-dependent | Yes |
| Azure AI Foundry (`AzureAIAgentClient`) | Yes | Yes | Yes | Yes | Yes | Yes |
| Anthropic | Yes | Provider-dependent | Provider-dependent | Provider-dependent | Provider-dependent | Yes |

Use this matrix as a planning aid; verify exact runtime support in provider docs for your deployed model/service.

## Additional Resources

### Reference Files

For detailed patterns and full examples:

- **`references/function-tools.md`** – `@ai_function` decorator, approval mode, WeatherTools pattern, per-run tools
- **`references/hosted-and-mcp-tools.md`** – HostedWebSearchTool, HostedCodeInterpreterTool, HostedFileSearchTool, HostedMCPTool, MCPStdioTool, MCPStreamableHTTPTool, MCPWebsocketTool
- **`references/rag-and-composition.md`** – RAG via VectorStore, multiple search functions, agent composition (`as_tool`, `as_mcp_server`)
- **`references/acceptance-criteria.md`** – Correct vs incorrect patterns for function tools, hosted tools, MCP tools, RAG, agent composition, per-run vs agent-level tools, and mixing tool types

