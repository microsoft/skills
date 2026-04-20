# Azure Provider Reference (Python)

This reference covers configuring Azure-backed agents in Microsoft Agent Framework: Azure OpenAI ChatCompletion, Azure OpenAI Responses, and Azure AI Foundry.

## Table of Contents

- **Prerequisites** — Package installation and Azure CLI login
- **Azure OpenAI ChatCompletion Agent** — Env vars, basic creation, explicit config, function tools, thread management, streaming
- **Azure OpenAI Responses Agent** — Env vars, basic creation, reasoning models, structured output, code interpreter (with file upload), file search, MCP tools (local and hosted), image analysis, thread management, streaming
- **Azure AI Foundry Agent** — Env vars, basic creation, explicit config, existing agent by ID, persistent agent lifecycle, function tools, code interpreter, streaming
- **Common Pitfalls and Tips** — Sync vs async credential, async context managers, Responses API version, endpoint formats, file upload patterns

## Prerequisites

```bash
pip install agent-framework-core --pre   # Azure OpenAI ChatCompletion, Responses
pip install agent-framework-azure-ai --pre  # Azure AI Foundry
```

Run `az login` before using Azure credentials.

## Azure OpenAI ChatCompletion Agent

Uses the [Azure OpenAI Chat Completion](https://learn.microsoft.com/azure/ai-foundry/openai/how-to/chatgpt) service. Supports function tools, threads, and streaming. No service-managed chat history.

### Environment Variables

```bash
export AZURE_OPENAI_ENDPOINT="https://<myresource>.openai.azure.com"
export AZURE_OPENAI_CHAT_DEPLOYMENT_NAME="gpt-4o-mini"
```

Optional:

```bash
export AZURE_OPENAI_API_VERSION="2024-10-21"
export AZURE_OPENAI_API_KEY="<your-api-key>"  # If not using Azure CLI
```

### Basic Agent Creation

```python
import asyncio
from agent_framework.azure import AzureOpenAIChatClient
from azure.identity import AzureCliCredential

async def main():
    agent = AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
        instructions="You are good at telling jokes.",
        name="Joker"
    )
    result = await agent.run("Tell me a joke about a pirate.")
    print(result.text)

asyncio.run(main())
```

### Explicit Configuration

```python
agent = AzureOpenAIChatClient(
    endpoint="https://<myresource>.openai.azure.com",
    deployment_name="gpt-4o-mini",
    credential=AzureCliCredential()
).as_agent(
    instructions="You are good at telling jokes.",
    name="Joker"
)
```

### Function Tools

```python
from typing import Annotated
from agent_framework.azure import AzureOpenAIChatClient
from azure.identity import AzureCliCredential
from pydantic import Field

def get_weather(
    location: Annotated[str, Field(description="The location to get the weather for.")],
) -> str:
    """Get the weather for a given location."""
    return f"The weather in {location} is sunny with a high of 25°C."

async def main():
    agent = AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
        instructions="You are a helpful weather assistant.",
        tools=get_weather
    )
    result = await agent.run("What's the weather like in Seattle?")
    print(result.text)
```

### Thread Management

```python
async def main():
    agent = AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
        instructions="You are a helpful programming assistant."
    )
    thread = agent.get_new_thread()

    result1 = await agent.run("I'm working on a Python web application.", thread=thread, store=True)
    print(f"Assistant: {result1.text}")

    result2 = await agent.run("What framework should I use?", thread=thread, store=True)
    print(f"Assistant: {result2.text}")
```

### Streaming

```python
async def main():
    agent = AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
        instructions="You are a helpful assistant."
    )
    print("Agent: ", end="", flush=True)
    async for chunk in agent.run_stream("Tell me a short story about a robot"):
        if chunk.text:
            print(chunk.text, end="", flush=True)
    print()
```

---

## Azure OpenAI Responses Agent

Uses the [Azure OpenAI Responses](https://learn.microsoft.com/azure/ai-foundry/openai/how-to/responses) service. Supports service chat history, reasoning models, structured output, code interpreter, file search, image analysis, and MCP tools.

### Environment Variables

```bash
export AZURE_OPENAI_ENDPOINT="https://<myresource>.openai.azure.com"
export AZURE_OPENAI_RESPONSES_DEPLOYMENT_NAME="gpt-4o-mini"
```

Optional:

```bash
export AZURE_OPENAI_API_VERSION="preview"  # Required for Responses API
export AZURE_OPENAI_API_KEY="<your-api-key>"
```

### Basic Agent Creation

```python
from agent_framework.azure import AzureOpenAIResponsesClient
from azure.identity import AzureCliCredential

async def main():
    agent = AzureOpenAIResponsesClient(credential=AzureCliCredential()).as_agent(
        instructions="You are good at telling jokes.",
        name="Joker"
    )
    result = await agent.run("Tell me a joke about a pirate.")
    print(result.text)
```

### Reasoning Models

```python
async def main():
    agent = AzureOpenAIResponsesClient(
        deployment_name="o1-preview",
        credential=AzureCliCredential()
    ).as_agent(
        instructions="You are a helpful assistant that excels at complex reasoning.",
        name="ReasoningAgent"
    )
    result = await agent.run(
        "Solve this logic puzzle: If A > B, B > C, and C > D, and we know D = 5, B = 10, what can we determine about A?"
    )
    print(result.text)
```

### Structured Output

```python
from typing import Annotated
from pydantic import BaseModel, Field

class WeatherForecast(BaseModel):
    location: Annotated[str, Field(description="The location")]
    temperature: Annotated[int, Field(description="Temperature in Celsius")]
    condition: Annotated[str, Field(description="Weather condition")]
    humidity: Annotated[int, Field(description="Humidity percentage")]

async def main():
    agent = AzureOpenAIResponsesClient(credential=AzureCliCredential()).as_agent(
        instructions="You are a weather assistant that provides structured forecasts.",
        response_format=WeatherForecast
    )
    result = await agent.run("What's the weather like in Paris today?")
    weather_data = result.value
    print(f"Location: {weather_data.location}")
    print(f"Temperature: {weather_data.temperature}°C")
```

### Code Interpreter

```python
from agent_framework import ChatAgent, HostedCodeInterpreterTool
from agent_framework.azure import AzureOpenAIResponsesClient
from azure.identity import AzureCliCredential

async def main():
    async with ChatAgent(
        chat_client=AzureOpenAIResponsesClient(credential=AzureCliCredential()),
        instructions="You are a helpful assistant that can write and execute Python code.",
        tools=HostedCodeInterpreterTool()
    ) as agent:
        result = await agent.run("Calculate the factorial of 20 using Python code.")
        print(result.text)
```

### Code Interpreter with File Upload

```python
import asyncio
import os
import tempfile
from agent_framework import ChatAgent, HostedCodeInterpreterTool
from agent_framework.azure import AzureOpenAIResponsesClient
from azure.identity import AzureCliCredential
from openai import AsyncAzureOpenAI

async def create_sample_file_and_upload(openai_client: AsyncAzureOpenAI) -> tuple[str, str]:
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
    return temp_file_path, uploaded_file.id

async def main():
    credential = AzureCliCredential()

    async def get_token():
        token = credential.get_token("https://cognitiveservices.azure.com/.default")
        return token.token

    openai_client = AsyncAzureOpenAI(
        azure_ad_token_provider=get_token,
        api_version="2024-05-01-preview",
    )

    temp_file_path, file_id = await create_sample_file_and_upload(openai_client)

    async with ChatAgent(
        chat_client=AzureOpenAIResponsesClient(credential=credential),
        instructions="You are a helpful assistant that can analyze data files using Python code.",
        tools=HostedCodeInterpreterTool(inputs=[{"file_id": file_id}]),
    ) as agent:
        result = await agent.run(
            "Analyze the employee data in the uploaded CSV file. Calculate average salary by department."
        )
        print(result.text)

    await openai_client.files.delete(file_id)
    os.unlink(temp_file_path)
```

### File Search

```python
from agent_framework import ChatAgent, HostedFileSearchTool, HostedVectorStoreContent
from agent_framework.azure import AzureOpenAIResponsesClient
from azure.identity import AzureCliCredential

async def create_vector_store(client: AzureOpenAIResponsesClient) -> tuple[str, HostedVectorStoreContent]:
    file = await client.client.files.create(
        file=("todays_weather.txt", b"The weather today is sunny with a high of 75F."),
        purpose="assistants"
    )
    vector_store = await client.client.vector_stores.create(
        name="knowledge_base",
        expires_after={"anchor": "last_active_at", "days": 1},
    )
    result = await client.client.vector_stores.files.create_and_poll(
        vector_store_id=vector_store.id,
        file_id=file.id
    )
    if result.last_error is not None:
        raise Exception(f"Vector store file processing failed: {result.last_error.message}")
    return file.id, HostedVectorStoreContent(vector_store_id=vector_store.id)

async def main():
    client = AzureOpenAIResponsesClient(credential=AzureCliCredential())
    file_id, vector_store = await create_vector_store(client)

    async with ChatAgent(
        chat_client=client,
        instructions="You are a helpful assistant that can search through files to find information.",
        tools=[HostedFileSearchTool(inputs=vector_store)],
    ) as agent:
        result = await agent.run("What is the weather today? Do a file search to find the answer.")
        print(result)

    await client.client.vector_stores.delete(vector_store.vector_store_id)
    await client.client.files.delete(file_id)
```

### MCP Tools

```python
from agent_framework import ChatAgent, MCPStreamableHTTPTool, HostedMCPTool

# Local MCP (Streamable HTTP)
async def local_mcp_example():
    responses_client = AzureOpenAIResponsesClient(credential=AzureCliCredential())
    agent = responses_client.as_agent(
        name="DocsAgent",
        instructions="You are a helpful assistant that can help with Microsoft documentation questions.",
    )
    async with MCPStreamableHTTPTool(
        name="Microsoft Learn MCP",
        url="https://learn.microsoft.com/api/mcp",
    ) as mcp_tool:
        result = await agent.run("How to create an Azure storage account using az cli?", tools=mcp_tool)
        print(result.text)

# Hosted MCP with approval control
async def hosted_mcp_example():
    async with ChatAgent(
        chat_client=AzureOpenAIResponsesClient(credential=AzureCliCredential()),
        name="DocsAgent",
        instructions="You are a helpful assistant that can help with microsoft documentation questions.",
        tools=HostedMCPTool(
            name="Microsoft Learn MCP",
            url="https://learn.microsoft.com/api/mcp",
            approval_mode="never_require",
        ),
    ) as agent:
        result = await agent.run("How to create an Azure storage account using az cli?")
        print(result.text)
```

### Image Analysis

```python
from agent_framework import ChatMessage, TextContent, UriContent

async def main():
    agent = AzureOpenAIResponsesClient(credential=AzureCliCredential()).as_agent(
        name="VisionAgent",
        instructions="You are a helpful agent that can analyze images.",
    )
    user_message = ChatMessage(
        role="user",
        contents=[
            TextContent(text="What do you see in this image?"),
            UriContent(
                uri="https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg",
                media_type="image/jpeg",
            ),
        ],
    )
    result = await agent.run(user_message)
    print(result.text)
```

---

## Azure AI Foundry Agent

Uses the [Azure AI Foundry Agents](https://learn.microsoft.com/azure/ai-foundry/agents/overview) service. Persistent service-based agents with service-managed conversation threads. Requires `agent-framework-azure-ai`.

### Environment Variables

```bash
export AZURE_AI_PROJECT_ENDPOINT="https://<your-project>.services.ai.azure.com/api/projects/<project-id>"
export AZURE_AI_MODEL_DEPLOYMENT_NAME="gpt-4o-mini"
```

### Basic Agent Creation

```python
import asyncio
from agent_framework.azure import AzureAIAgentClient
from azure.identity.aio import AzureCliCredential

async def main():
    async with (
        AzureCliCredential() as credential,
        AzureAIAgentClient(async_credential=credential).as_agent(
            name="HelperAgent",
            instructions="You are a helpful assistant."
        ) as agent,
    ):
        result = await agent.run("Hello!")
        print(result.text)

asyncio.run(main())
```

### Explicit Configuration

```python
async with (
    AzureCliCredential() as credential,
    AzureAIAgentClient(
        project_endpoint="https://<your-project>.services.ai.azure.com/api/projects/<project-id>",
        model_deployment_name="gpt-4o-mini",
        async_credential=credential,
        agent_name="HelperAgent"
    ).as_agent(
        instructions="You are a helpful assistant."
    ) as agent,
):
    result = await agent.run("Hello!")
    print(result.text)
```

### Using an Existing Agent by ID

```python
from agent_framework import ChatAgent
from agent_framework.azure import AzureAIAgentClient
from azure.identity.aio import AzureCliCredential

async def main():
    async with (
        AzureCliCredential() as credential,
        ChatAgent(
            chat_client=AzureAIAgentClient(
                async_credential=credential,
                agent_id="<existing-agent-id>"
            ),
            instructions="You are a helpful assistant."
        ) as agent,
    ):
        result = await agent.run("Hello!")
        print(result.text)
```

### Create and Manage Persistent Agents

```python
import os
from agent_framework import ChatAgent
from agent_framework.azure import AzureAIAgentClient
from azure.ai.projects.aio import AIProjectClient
from azure.identity.aio import AzureCliCredential

async def main():
    async with (
        AzureCliCredential() as credential,
        AIProjectClient(
            endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
            credential=credential
        ) as project_client,
    ):
        created_agent = await project_client.agents.create_agent(
            model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
            name="PersistentAgent",
            instructions="You are a helpful assistant."
        )

        try:
            async with ChatAgent(
                chat_client=AzureAIAgentClient(
                    project_client=project_client,
                    agent_id=created_agent.id
                ),
                instructions="You are a helpful assistant."
            ) as agent:
                result = await agent.run("Hello!")
                print(result.text)
        finally:
            await project_client.agents.delete_agent(created_agent.id)
```

### Function Tools

```python
from typing import Annotated
from pydantic import Field

def get_weather(
    location: Annotated[str, Field(description="The location to get the weather for.")],
) -> str:
    """Get the weather for a given location."""
    return f"The weather in {location} is sunny with a high of 25°C."

async with (
    AzureCliCredential() as credential,
    AzureAIAgentClient(async_credential=credential).as_agent(
        name="WeatherAgent",
        instructions="You are a helpful weather assistant.",
        tools=get_weather
    ) as agent,
):
    result = await agent.run("What's the weather like in Seattle?")
    print(result.text)
```

### Code Interpreter

```python
from agent_framework import HostedCodeInterpreterTool

async with (
    AzureCliCredential() as credential,
    AzureAIAgentClient(async_credential=credential).as_agent(
        name="CodingAgent",
        instructions="You are a helpful assistant that can write and execute Python code.",
        tools=HostedCodeInterpreterTool()
    ) as agent,
):
    result = await agent.run("Calculate the factorial of 20 using Python code.")
    print(result.text)
```

### Streaming

```python
async with (
    AzureCliCredential() as credential,
    AzureAIAgentClient(async_credential=credential).as_agent(
        name="StreamingAgent",
        instructions="You are a helpful assistant."
    ) as agent,
):
    print("Agent: ", end="", flush=True)
    async for chunk in agent.run_stream("Tell me a short story"):
        if chunk.text:
            print(chunk.text, end="", flush=True)
    print()
```

## Common Pitfalls and Tips

1. **Credential type**: Use `AzureCliCredential` (sync) for Azure OpenAI; use `AzureCliCredential` from `azure.identity.aio` for Azure AI Foundry (async).
2. **Async context**: Azure AI Foundry agents require `async with` for both the credential and the agent.
3. **Responses API version**: For Azure OpenAI Responses, use `api_version="preview"` or ensure the deployment supports the Responses API.
4. **Endpoint format**: Azure OpenAI: `https://<resource>.openai.azure.com`. Azure AI Foundry: `https://<resource>.services.ai.azure.com/api/projects/<project-id>`.
5. **File upload with Azure**: For Responses code interpreter, use `AsyncAzureOpenAI` with `azure_ad_token_provider` when uploading files, and ensure `purpose="assistants"`.
