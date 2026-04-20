# OpenAI Provider Reference (Python)

This reference covers configuring OpenAI-backed agents in Microsoft Agent Framework: ChatCompletion, Responses, and Assistants.

## Table of Contents

- **Prerequisites** — Package installation
- **OpenAI ChatCompletion Agent** — Basic creation, explicit config, function tools, web search, MCP tools, thread management, streaming
- **OpenAI Responses Agent** — Basic creation, reasoning models, structured output, code interpreter with file upload, file search, image analysis/generation, hosted MCP tools
- **OpenAI Assistants Agent** — Basic creation, using existing assistants, function tools, code interpreter, file search with vector store
- **Common Pitfalls and Tips** — ChatCompletion vs Responses guidance, deprecation notes, file upload tips

## Prerequisites

```bash
pip install agent-framework-core --pre   # ChatCompletion, Responses
pip install agent-framework --pre       # Assistants (includes core)
```

## OpenAI ChatCompletion Agent

Uses the [OpenAI Chat Completion API](https://platform.openai.com/docs/api-reference/chat/create). Supports function calling, threads, and streaming. Does not use service-managed chat history.

### Environment Variables

```bash
OPENAI_API_KEY="your-openai-api-key"
OPENAI_CHAT_MODEL_ID="gpt-4o-mini"
```

### Basic Agent Creation

```python
import asyncio
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIChatClient

async def basic_example():
    agent = OpenAIChatClient().as_agent(
        name="HelpfulAssistant",
        instructions="You are a helpful assistant.",
    )
    result = await agent.run("Hello, how can you help me?")
    print(result.text)
```

### Explicit Configuration

```python
async def explicit_config_example():
    agent = OpenAIChatClient(
        ai_model_id="gpt-4o-mini",
        api_key="your-api-key-here",
    ).as_agent(
        instructions="You are a helpful assistant.",
    )
    result = await agent.run("What can you do?")
    print(result.text)
```

### Function Tools

```python
from typing import Annotated
from pydantic import Field

def get_weather(
    location: Annotated[str, Field(description="The location to get weather for")]
) -> str:
    """Get the weather for a given location."""
    return f"The weather in {location} is sunny with 25°C."

async def tools_example():
    agent = ChatAgent(
        chat_client=OpenAIChatClient(),
        instructions="You are a helpful weather assistant.",
        tools=get_weather,
    )
    result = await agent.run("What's the weather like in Tokyo?")
    print(result.text)
```

### Web Search

```python
from agent_framework import HostedWebSearchTool

async def web_search_example():
    agent = OpenAIChatClient(model_id="gpt-4o-search-preview").as_agent(
        name="SearchBot",
        instructions="You are a helpful assistant that can search the web for current information.",
        tools=HostedWebSearchTool(),
    )
    result = await agent.run("What are the latest developments in artificial intelligence?")
    print(result.text)
```

### MCP Tools

```python
from agent_framework import MCPStreamableHTTPTool

async def local_mcp_example():
    agent = OpenAIChatClient().as_agent(
        name="DocsAgent",
        instructions="You are a helpful assistant that can help with Microsoft documentation.",
        tools=MCPStreamableHTTPTool(
            name="Microsoft Learn MCP",
            url="https://learn.microsoft.com/api/mcp",
        ),
    )
    result = await agent.run("How do I create an Azure storage account using az cli?")
    print(result.text)
```

### Thread Management

```python
async def thread_example():
    agent = OpenAIChatClient().as_agent(
        name="Agent",
        instructions="You are a helpful assistant.",
    )
    thread = agent.get_new_thread()

    first_result = await agent.run("My name is Alice", thread=thread)
    print(first_result.text)

    second_result = await agent.run("What's my name?", thread=thread)
    print(second_result.text)  # Remembers "Alice"
```

### Streaming

```python
async def streaming_example():
    agent = OpenAIChatClient().as_agent(
        name="StoryTeller",
        instructions="You are a creative storyteller.",
    )
    print("Agent: ", end="", flush=True)
    async for chunk in agent.run_stream("Tell me a short story about AI."):
        if chunk.text:
            print(chunk.text, end="", flush=True)
    print()
```

---

## OpenAI Responses Agent

Uses the [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses/create). Supports service-managed chat history, reasoning models, structured output, code interpreter, file search, image analysis, image generation, and MCP.

### Environment Variables

```bash
OPENAI_API_KEY="your-openai-api-key"
OPENAI_RESPONSES_MODEL_ID="gpt-4o"
```

### Basic Agent Creation

```python
from agent_framework.openai import OpenAIResponsesClient

async def basic_example():
    agent = OpenAIResponsesClient().as_agent(
        name="WeatherBot",
        instructions="You are a helpful weather assistant.",
    )
    result = await agent.run("What's a good way to check the weather?")
    print(result.text)
```

### Reasoning Models

```python
from agent_framework import HostedCodeInterpreterTool, TextContent, TextReasoningContent

async def reasoning_example():
    agent = OpenAIResponsesClient(ai_model_id="gpt-5").as_agent(
        name="MathTutor",
        instructions="You are a personal math tutor. When asked a math question, "
                    "write and run code to answer the question.",
        tools=HostedCodeInterpreterTool(),
        default_options={"reasoning": {"effort": "high", "summary": "detailed"}},
    )
    async for chunk in agent.run_stream("Solve: 3x + 11 = 14"):
        if chunk.contents:
            for content in chunk.contents:
                if isinstance(content, TextReasoningContent):
                    print(f"\033[97m{content.text}\033[0m", end="", flush=True)
                elif isinstance(content, TextContent):
                    print(content.text, end="", flush=True)
```

### Structured Output

```python
from pydantic import BaseModel
from agent_framework import AgentResponse

class CityInfo(BaseModel):
    city: str
    description: str

async def structured_output_example():
    agent = OpenAIResponsesClient().as_agent(
        name="CityExpert",
        instructions="You describe cities in a structured format.",
    )
    result = await agent.run("Tell me about Paris, France", options={"response_format": CityInfo})
    if result.value:
        print(f"City: {result.value.city}")
        print(f"Description: {result.value.description}")
```

### Code Interpreter with File Upload

```python
import os
import tempfile
from agent_framework import ChatAgent, HostedCodeInterpreterTool
from agent_framework.openai import OpenAIResponsesClient
from openai import AsyncOpenAI

async def code_interpreter_with_files_example():
    openai_client = AsyncOpenAI()
    csv_data = """name,department,salary,years_experience
Alice Johnson,Engineering,95000,5
Bob Smith,Sales,75000,3
"""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as temp_file:
        temp_file.write(csv_data)
        temp_file_path = temp_file.name

    with open(temp_file_path, "rb") as file:
        uploaded_file = await openai_client.files.create(
            file=file,
            purpose="assistants",
        )

    agent = ChatAgent(
        chat_client=OpenAIResponsesClient(async_client=openai_client),
        instructions="You are a helpful assistant that can analyze data files using Python code.",
        tools=HostedCodeInterpreterTool(inputs=[{"file_id": uploaded_file.id}]),
    )

    result = await agent.run("Analyze the employee data in the uploaded CSV file.")
    print(result.text)

    await openai_client.files.delete(uploaded_file.id)
    os.unlink(temp_file_path)
```

### File Search

```python
from agent_framework import ChatAgent, HostedFileSearchTool, HostedVectorStoreContent
from agent_framework.openai import OpenAIResponsesClient

async def file_search_example():
    client = OpenAIResponsesClient()
    file = await client.client.files.create(
        file=("todays_weather.txt", b"The weather today is sunny with a high of 75F."),
        purpose="user_data"
    )
    vector_store = await client.client.vector_stores.create(
        name="knowledge_base",
        expires_after={"anchor": "last_active_at", "days": 1},
    )
    await client.client.vector_stores.files.create_and_poll(
        vector_store_id=vector_store.id,
        file_id=file.id
    )
    vector_store_content = HostedVectorStoreContent(vector_store_id=vector_store.id)

    agent = ChatAgent(
        chat_client=client,
        instructions="You are a helpful assistant that can search through files to find information.",
        tools=[HostedFileSearchTool(inputs=vector_store_content)],
    )

    response = await agent.run("What is the weather today? Do a file search to find the answer.")
    print(response.text)

    await client.client.vector_stores.delete(vector_store.id)
    await client.client.files.delete(file.id)
```

### Image Analysis

```python
from agent_framework import ChatMessage, TextContent, UriContent

async def image_analysis_example():
    agent = OpenAIResponsesClient().as_agent(
        name="VisionAgent",
        instructions="You are a helpful agent that can analyze images.",
    )
    message = ChatMessage(
        role="user",
        contents=[
            TextContent(text="What do you see in this image?"),
            UriContent(uri="your-image-uri", media_type="image/jpeg"),
        ],
    )
    result = await agent.run(message)
    print(result.text)
```

### Image Generation

```python
from agent_framework import DataContent, HostedImageGenerationTool, ImageGenerationToolResultContent, UriContent

async def image_generation_example():
    agent = OpenAIResponsesClient().as_agent(
        instructions="You are a helpful AI that can generate images.",
        tools=[
            HostedImageGenerationTool(
                options={"size": "1024x1024", "output_format": "webp"}
            )
        ],
    )
    result = await agent.run("Generate an image of a sunset over the ocean.")
    for message in result.messages:
        for content in message.contents:
            if isinstance(content, ImageGenerationToolResultContent) and content.outputs:
                for output in content.outputs:
                    if isinstance(output, (DataContent, UriContent)) and output.uri:
                        print(f"Image generated: {output.uri}")
```

### Hosted MCP Tools

```python
from agent_framework import HostedMCPTool

async def hosted_mcp_example():
    agent = OpenAIResponsesClient().as_agent(
        name="DocsBot",
        instructions="You are a helpful assistant with access to various tools.",
        tools=HostedMCPTool(
            name="Microsoft Learn MCP",
            url="https://learn.microsoft.com/api/mcp",
        ),
    )
    result = await agent.run("How do I create an Azure storage account?")
    print(result.text)
```

---

## OpenAI Assistants Agent

Uses the [OpenAI Assistants API](https://platform.openai.com/docs/api-reference/assistants/createAssistant). Supports service-managed assistants, threads, function tools, code interpreter, and file search.

> **Warning:** The OpenAI Assistants API is deprecated and will be shut down. See [OpenAI documentation](https://platform.openai.com/docs/assistants/migration).

### Environment Variables

```bash
OPENAI_API_KEY="your-openai-api-key"
OPENAI_CHAT_MODEL_ID="gpt-4o-mini"
```

### Basic Agent Creation

```python
from agent_framework.openai import OpenAIAssistantsClient

async def basic_example():
    async with OpenAIAssistantsClient().as_agent(
        instructions="You are a helpful assistant.",
        name="MyAssistant"
    ) as agent:
        result = await agent.run("Hello, how are you?")
        print(result.text)
```

### Using an Existing Assistant

```python
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIAssistantsClient
from openai import AsyncOpenAI

async def existing_assistant_example():
    client = AsyncOpenAI()
    assistant = await client.beta.assistants.create(
        model="gpt-4o-mini",
        name="WeatherAssistant",
        instructions="You are a weather forecasting assistant."
    )

    try:
        async with ChatAgent(
            chat_client=OpenAIAssistantsClient(
                async_client=client,
                assistant_id=assistant.id
            ),
            instructions="You are a helpful weather agent.",
        ) as agent:
            result = await agent.run("What's the weather like in Seattle?")
            print(result.text)
    finally:
        await client.beta.assistants.delete(assistant.id)
```

### Function Tools

```python
from typing import Annotated
from pydantic import Field
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIAssistantsClient

def get_weather(
    location: Annotated[str, Field(description="The location to get the weather for.")]
) -> str:
    """Get the weather for a given location."""
    return f"The weather in {location} is sunny with 25°C."

async def tools_example():
    async with ChatAgent(
        chat_client=OpenAIAssistantsClient(),
        instructions="You are a helpful weather assistant.",
        tools=get_weather,
    ) as agent:
        result = await agent.run("What's the weather like in Tokyo?")
        print(result.text)
```

### Code Interpreter

```python
from agent_framework import ChatAgent, HostedCodeInterpreterTool
from agent_framework.openai import OpenAIAssistantsClient

async def code_interpreter_example():
    async with ChatAgent(
        chat_client=OpenAIAssistantsClient(),
        instructions="You are a helpful assistant that can write and execute Python code.",
        tools=HostedCodeInterpreterTool(),
    ) as agent:
        result = await agent.run("Calculate the factorial of 100 using Python code.")
        print(result.text)
```

### File Search with Vector Store

```python
from agent_framework import ChatAgent, HostedFileSearchTool
from agent_framework.openai import OpenAIAssistantsClient

async def file_search_example():
    client = OpenAIAssistantsClient()
    async with ChatAgent(
        chat_client=client,
        instructions="You are a helpful assistant that searches files in a knowledge base.",
        tools=HostedFileSearchTool(),
    ) as agent:
        file = await client.client.files.create(
            file=("todays_weather.txt", b"The weather today is sunny with a high of 75F."),
            purpose="user_data"
        )
        vector_store = await client.client.vector_stores.create(
            name="knowledge_base",
            expires_after={"anchor": "last_active_at", "days": 1},
        )
        await client.client.vector_stores.files.create_and_poll(
            vector_store_id=vector_store.id,
            file_id=file.id
        )

        async for chunk in agent.run_stream(
            "What is the weather today? Do a file search to find the answer.",
            tool_resources={"file_search": {"vector_store_ids": [vector_store.id]}}
        ):
            if chunk.text:
                print(chunk.text, end="", flush=True)

        await client.client.vector_stores.delete(vector_store.id)
        await client.client.files.delete(file.id)
```

## Common Pitfalls and Tips

1. **ChatCompletion vs Responses**: Use ChatCompletion for simple chat; use Responses for reasoning models, structured output, file search, and image generation.
2. **Assistants deprecation**: Prefer ChatCompletion or Responses for new projects.
3. **File uploads**: For Responses and Assistants code interpreter, use `purpose="assistants"` when uploading files.
4. **Vector store lifetime**: Clean up vector stores and files after use to avoid billing.
5. **Async context**: OpenAI Assistants agent requires `async with` for proper resource cleanup.
