# RAG and Agent Composition Reference

This reference covers Retrieval Augmented Generation (RAG) using Semantic Kernel VectorStore and agent composition via `as_tool()` and `as_mcp_server()` in Microsoft Agent Framework Python.

## Table of Contents

- [RAG via Semantic Kernel VectorStore](#rag-via-semantic-kernel-vectorstore)
  - [Creating a Search Tool from VectorStore](#creating-a-search-tool-from-vectorstore)
  - [Customizing Search Behavior](#customizing-search-behavior)
  - [Multiple Search Functions (Different Knowledge Bases)](#multiple-search-functions-different-knowledge-bases)
  - [Multiple Search Functions (Same Collection, Different Strategies)](#multiple-search-functions-same-collection-different-strategies)
  - [Supported VectorStore Connectors](#supported-vectorstore-connectors)
- [Agent as Function Tool (as_tool)](#agent-as-function-tool-as_tool)
  - [Basic Pattern](#basic-pattern)
  - [Customizing the Tool](#customizing-the-tool)
  - [Use Cases](#use-cases)
- [Agent as MCP Server (as_mcp_server)](#agent-as-mcp-server-as_mcp_server)
  - [Basic Pattern](#basic-pattern-1)
  - [Running the MCP Server](#running-the-mcp-server)
  - [Use Cases](#use-cases-1)
- [Combining RAG, Function Tools, and Composition](#combining-rag-function-tools-and-composition)

## Overview

**RAG** augments agent responses with retrieved context from a knowledge base. Use Semantic Kernel VectorStore collections to create search functions, then convert them to Agent Framework tools.

**Agent composition** lets one agent call another as a tool (`as_tool()`) or expose an agent as an MCP server (`as_mcp_server()`) for external MCP clients.

## RAG via Semantic Kernel VectorStore

Requires `semantic-kernel` version 1.38 or higher.

### Creating a Search Tool from VectorStore

1. Create a VectorStore collection (e.g., Azure AI Search, Qdrant, Pinecone).
2. Call `create_search_function()` to define the search tool.
3. Use `.as_agent_framework_tool()` to convert it to an Agent Framework tool.
4. Pass the tool to the agent.

```python
from dataclasses import dataclass
from semantic_kernel.connectors.ai.open_ai import OpenAITextEmbedding
from semantic_kernel.connectors.azure_ai_search import AzureAISearchCollection
from semantic_kernel.functions import KernelParameterMetadata
from agent_framework.openai import OpenAIResponsesClient

@dataclass
class SupportArticle:
    article_id: str
    title: str
    content: str
    category: str

collection = AzureAISearchCollection[str, SupportArticle](
    record_type=SupportArticle,
    embedding_generator=OpenAITextEmbedding()
)

async with collection:
    await collection.ensure_collection_exists()
    # await collection.upsert(articles)

    search_function = collection.create_search_function(
        function_name="search_knowledge_base",
        description="Search the knowledge base for support articles and product information.",
        search_type="keyword_hybrid",
        parameters=[
            KernelParameterMetadata(
                name="query",
                description="The search query to find relevant information.",
                type="str",
                is_required=True,
                type_object=str,
            ),
            KernelParameterMetadata(
                name="top",
                description="Number of results to return.",
                type="int",
                default_value=3,
                type_object=int,
            ),
        ],
        string_mapper=lambda x: f"[{x.record.category}] {x.record.title}: {x.record.content}",
    )

    search_tool = search_function.as_agent_framework_tool()

    agent = OpenAIResponsesClient(model_id="gpt-4o").as_agent(
        instructions="You are a helpful support specialist. Use the search tool to find relevant information before answering questions. Always cite your sources.",
        tools=search_tool
    )

    response = await agent.run("How do I return a product?")
    print(response.text)
```

### Customizing Search Behavior

Add filters and custom result formatting:

```python
search_function = collection.create_search_function(
    function_name="search_support_articles",
    description="Search for support articles in specific categories.",
    search_type="keyword_hybrid",
    filter=lambda x: x.is_published == True,
    parameters=[
        KernelParameterMetadata(
            name="query",
            description="What to search for in the knowledge base.",
            type="str",
            is_required=True,
            type_object=str,
        ),
        KernelParameterMetadata(
            name="category",
            description="Filter by category: returns, shipping, products, or billing.",
            type="str",
            type_object=str,
        ),
        KernelParameterMetadata(
            name="top",
            description="Maximum number of results to return.",
            type="int",
            default_value=5,
            type_object=int,
        ),
    ],
    string_mapper=lambda x: f"Article: {x.record.title}\nCategory: {x.record.category}\nContent: {x.record.content}\nSource: {x.record.article_id}",
)

search_tool = search_function.as_agent_framework_tool()
```

**`create_search_function` parameters:**

- **`function_name`** – Name of the tool exposed to the agent.
- **`description`** – Description for the model.
- **`search_type`** – `"keyword"`, `"semantic"`, `"keyword_hybrid"`, or `"semantic_hybrid"` (depends on connector).
- **`parameters`** – List of `KernelParameterMetadata` for the search parameters.
- **`string_mapper`** – Maps each result record to a string for the model.
- **`filter`** – Optional predicate to restrict search scope.
- **`top`** – Default number of results when not specified as a parameter.

See Semantic Kernel VectorStore documentation for full parameter details.

### Multiple Search Functions (Different Knowledge Bases)

Provide separate search tools for different domains:

```python
product_search = product_collection.create_search_function(
    function_name="search_products",
    description="Search for product information and specifications.",
    search_type="semantic_hybrid",
    string_mapper=lambda x: f"{x.record.name}: {x.record.description}",
).as_agent_framework_tool()

policy_search = policy_collection.create_search_function(
    function_name="search_policies",
    description="Search for company policies and procedures.",
    search_type="keyword_hybrid",
    string_mapper=lambda x: f"Policy: {x.record.title}\n{x.record.content}",
).as_agent_framework_tool()

agent = chat_client.as_agent(
    instructions="You are a support agent. Use the appropriate search tool to find information before answering. Cite your sources.",
    tools=[product_search, policy_search]
)
```

### Multiple Search Functions (Same Collection, Different Strategies)

Create specialized search functions from one collection:

```python
general_search = support_collection.create_search_function(
    function_name="search_all_articles",
    description="Search all support articles for general information.",
    search_type="semantic_hybrid",
    parameters=[
        KernelParameterMetadata(
            name="query",
            description="The search query.",
            type="str",
            is_required=True,
            type_object=str,
        ),
    ],
    string_mapper=lambda x: f"{x.record.title}: {x.record.content}",
).as_agent_framework_tool()

detail_lookup = support_collection.create_search_function(
    function_name="get_article_details",
    description="Get detailed information for a specific article by its ID.",
    search_type="keyword",
    top=1,
    parameters=[
        KernelParameterMetadata(
            name="article_id",
            description="The specific article ID to retrieve.",
            type="str",
            is_required=True,
            type_object=str,
        ),
    ],
    string_mapper=lambda x: f"Title: {x.record.title}\nFull Content: {x.record.content}\nLast Updated: {x.record.updated_date}",
).as_agent_framework_tool()

agent = chat_client.as_agent(
    instructions="You are a support agent. Use search_all_articles for general queries and get_article_details when you need full details about a specific article.",
    tools=[general_search, detail_lookup]
)
```

This lets the agent choose between broad search and targeted lookup.

### Supported VectorStore Connectors

This pattern works with Semantic Kernel VectorStore connectors such as:

- Azure AI Search (`AzureAISearchCollection`)
- Qdrant (`QdrantCollection`)
- Pinecone (`PineconeCollection`)
- Redis (`RedisCollection`)
- Weaviate (`WeaviateCollection`)
- In-Memory (`InMemoryVectorStoreCollection`)

Each exposes `create_search_function()` and can be bridged with `.as_agent_framework_tool()`.

## Agent as Function Tool (as_tool)

Use `.as_tool()` to expose an agent as a tool for another agent. Enables agent composition and delegation.

### Basic Pattern

```python
from agent_framework.azure import AzureOpenAIChatClient
from azure.identity import AzureCliCredential

# Sub-agent with its own tools
weather_agent = AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
    name="WeatherAgent",
    description="An agent that answers questions about the weather.",
    instructions="You answer questions about the weather.",
    tools=get_weather
)

# Main agent uses weather agent as a tool
main_agent = AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
    instructions="You are a helpful assistant who responds in French.",
    tools=weather_agent.as_tool()
)

result = await main_agent.run("What is the weather like in Amsterdam?")
print(result.text)
```

The main agent invokes the weather agent as a tool and can combine its output with other reasoning. The tool name and description come from the agent's `name` and `description`.

### Customizing the Tool

Override name, description, and argument metadata:

```python
weather_tool = weather_agent.as_tool(
    name="WeatherLookup",
    description="Look up weather information for any location",
    arg_name="query",
    arg_description="The weather query or location"
)

main_agent = client.as_agent(
    instructions="You are a helpful assistant who responds in French.",
    tools=weather_tool
)
```

**Parameters:**

- **`name`** – Tool name exposed to the calling agent.
- **`description`** – Tool description for the model.
- **`arg_name`** – Parameter name for the query passed to the sub-agent.
- **`arg_description`** – Parameter description for the model.

### Use Cases

- **Specialists:** Weather agent, pricing agent, documentation agent.
- **Orchestration:** Main agent routes to domain experts.
- **Localization:** Main agent translates while sub-agents fetch data.
- **Escalation:** Main agent hands off complex cases to specialized agents.

## Agent as MCP Server (as_mcp_server)

Use `.as_mcp_server()` to expose an agent over the Model Context Protocol so MCP-compatible clients (e.g., VS Code GitHub Copilot Agents) can invoke it.

### Basic Pattern

```python
from agent_framework.openai import OpenAIResponsesClient

def get_specials() -> Annotated[str, "Returns the specials from the menu."]:
    return """
        Special Soup: Clam Chowder
        Special Salad: Cobb Salad
        Special Drink: Chai Tea
        """

def get_item_price(
    menu_item: Annotated[str, "The name of the menu item."],
) -> Annotated[str, "Returns the price of the menu item."]:
    return "$9.99"

agent = OpenAIResponsesClient().as_agent(
    name="RestaurantAgent",
    description="Answer questions about the menu.",
    tools=[get_specials, get_item_price],
)

server = agent.as_mcp_server()
```

The agent's `name` and `description` become MCP server metadata.

### Running the MCP Server

Start the server with stdio transport for compatibility with MCP clients:

```python
import anyio
from mcp.server.stdio import stdio_server

async def run():
    async def handle_stdin():
        async with stdio_server() as (read_stream, write_stream):
            await server.run(read_stream, write_stream, server.create_initialization_options())

    await handle_stdin()

if __name__ == "__main__":
    anyio.run(run)
```

This starts an MCP server that listens on stdin/stdout. Clients connect and invoke the agent as an MCP tool.

### Use Cases

- **IDE integrations:** Expose agents to VS Code, Cursor, or other MCP clients.
- **Tool reuse:** One agent implementation, multiple consumers via MCP.
- **Standard protocol:** Use MCP for interoperability across tools and platforms.

## Combining RAG, Function Tools, and Composition

Example combining RAG search, function tools, and agent composition:

```python
# RAG search tool from VectorStore
search_tool = collection.create_search_function(...).as_agent_framework_tool()

# Specialist agent with RAG and function tools
support_agent = client.as_agent(
    name="SupportAgent",
    description="Answers support questions using the knowledge base.",
    instructions="Search before answering. Cite sources.",
    tools=[search_tool, escalate_to_human]
)

# Main agent that can call support agent
main_agent = client.as_agent(
    instructions="You route questions to specialists. For support, use the support agent.",
    tools=[support_agent.as_tool(), get_time]
)
```

RAG supplies context, function tools add custom logic, and composition enables delegation between agents.
