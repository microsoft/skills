# Acceptance Criteria — maf-agent-types-py

Correct and incorrect patterns for MAF agent type configuration in Python, derived from official Microsoft Agent Framework documentation.

## 1. Import Paths

#### CORRECT: OpenAI clients from agent_framework.openai

```python
from agent_framework.openai import OpenAIChatClient
from agent_framework.openai import OpenAIResponsesClient
from agent_framework.openai import OpenAIAssistantsClient
```

#### CORRECT: Azure clients from agent_framework.azure

```python
from agent_framework.azure import AzureOpenAIChatClient
from agent_framework.azure import AzureOpenAIResponsesClient
from agent_framework.azure import AzureAIAgentClient
```

#### CORRECT: Anthropic client from agent_framework.anthropic

```python
from agent_framework.anthropic import AnthropicClient
```

#### CORRECT: A2A client from agent_framework.a2a

```python
from agent_framework.a2a import A2AAgent
```

#### CORRECT: Core types from agent_framework

```python
from agent_framework import ChatAgent, BaseAgent, AgentProtocol
from agent_framework import AgentResponse, AgentResponseUpdate, AgentThread, ChatMessage
```

#### INCORRECT: Wrong module paths

```python
from agent_framework import OpenAIChatClient          # Wrong — use agent_framework.openai
from agent_framework.openai import AzureOpenAIChatClient  # Wrong — Azure clients are in agent_framework.azure
from agent_framework import AzureAIAgentClient        # Wrong — use agent_framework.azure
from agent_framework import AnthropicClient           # Wrong — use agent_framework.anthropic
from agent_framework import A2AAgent                  # Wrong — use agent_framework.a2a
```

## 2. Credential Patterns

#### CORRECT: Sync credential for Azure OpenAI (ChatCompletion and Responses)

```python
from azure.identity import AzureCliCredential

agent = AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
    instructions="You are a helpful assistant."
)
```

#### CORRECT: Async credential for Azure AI Foundry

```python
from azure.identity.aio import AzureCliCredential

async with (
    AzureCliCredential() as credential,
    AzureAIAgentClient(async_credential=credential).as_agent(
        instructions="You are a helpful assistant."
    ) as agent,
):
    result = await agent.run("Hello!")
```

#### INCORRECT: Using sync credential with AzureAIAgentClient

```python
from azure.identity import AzureCliCredential  # Wrong — Foundry needs azure.identity.aio

agent = AzureAIAgentClient(credential=AzureCliCredential())  # Wrong parameter name
```

#### INCORRECT: Missing async context manager for Azure AI Foundry

```python
agent = AzureAIAgentClient(async_credential=credential).as_agent(
    instructions="You are helpful."
)
# Wrong — AzureAIAgentClient requires async with for proper cleanup
```

## 3. Agent Creation Patterns

#### CORRECT: Convenience method via .as_agent()

```python
agent = OpenAIChatClient().as_agent(
    name="Assistant",
    instructions="You are a helpful assistant.",
)
```

#### CORRECT: Explicit ChatAgent wrapper

```python
agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful assistant.",
    tools=get_weather,
)
```

#### INCORRECT: Mixing up constructor parameters

```python
agent = OpenAIChatClient(instructions="You are helpful.")  # Wrong — instructions go in .as_agent()
agent = ChatAgent(instructions="You are helpful.")         # Wrong — missing chat_client
```

## 4. Environment Variables

#### CORRECT: OpenAI ChatCompletion

```bash
OPENAI_API_KEY="your-key"
OPENAI_CHAT_MODEL_ID="gpt-4o-mini"
```

#### CORRECT: OpenAI Responses

```bash
OPENAI_API_KEY="your-key"
OPENAI_RESPONSES_MODEL_ID="gpt-4o"
```

#### CORRECT: Azure OpenAI ChatCompletion

```bash
AZURE_OPENAI_ENDPOINT="https://<resource>.openai.azure.com"
AZURE_OPENAI_CHAT_DEPLOYMENT_NAME="gpt-4o-mini"
```

#### CORRECT: Azure OpenAI Responses

```bash
AZURE_OPENAI_ENDPOINT="https://<resource>.openai.azure.com"
AZURE_OPENAI_RESPONSES_DEPLOYMENT_NAME="gpt-4o-mini"
```

#### CORRECT: Azure AI Foundry

```bash
AZURE_AI_PROJECT_ENDPOINT="https://<project>.services.ai.azure.com/api/projects/<project-id>"
AZURE_AI_MODEL_DEPLOYMENT_NAME="gpt-4o-mini"
```

#### CORRECT: Anthropic (public API)

```bash
ANTHROPIC_API_KEY="your-key"
ANTHROPIC_CHAT_MODEL_ID="claude-sonnet-4-5-20250929"
```

#### CORRECT: Anthropic on Foundry

```bash
ANTHROPIC_FOUNDRY_API_KEY="your-key"
ANTHROPIC_FOUNDRY_RESOURCE="your-resource-name"
```

#### INCORRECT: Mixed-up env var names

```bash
OPENAI_RESPONSES_MODEL_ID="gpt-4o"       # Wrong for ChatCompletion — use OPENAI_CHAT_MODEL_ID
OPENAI_CHAT_MODEL_ID="gpt-4o"            # Wrong for Responses — use OPENAI_RESPONSES_MODEL_ID
AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o"    # Wrong for ChatCompletion — use AZURE_OPENAI_CHAT_DEPLOYMENT_NAME
AZURE_OPENAI_CHAT_DEPLOYMENT_NAME="gpt"  # Wrong for Responses — use AZURE_OPENAI_RESPONSES_DEPLOYMENT_NAME
AZURE_OPENAI_ENDPOINT="https://<project>.services.ai.azure.com/..."  # Wrong — this is the Foundry endpoint format
```

## 5. Package Installation

#### CORRECT: Install the right package per provider

```bash
pip install agent-framework-core --pre       # OpenAI ChatCompletion, Responses; Azure OpenAI ChatCompletion, Responses
pip install agent-framework --pre            # Full framework (includes Assistants, ChatClient)
pip install agent-framework-azure-ai --pre   # Azure AI Foundry
pip install agent-framework-anthropic --pre  # Anthropic
pip install agent-framework-a2a --pre        # A2A
pip install agent-framework-azurefunctions --pre  # Durable agents
```

#### INCORRECT: Wrong package names

```bash
pip install agent-framework-openai --pre      # Wrong — OpenAI is in agent-framework-core
pip install agent-framework-azure --pre       # Wrong — use agent-framework-azure-ai for Foundry, agent-framework-core for Azure OpenAI
pip install microsoft-agent-framework --pre   # Wrong package name
```

## 6. Function Tools

#### CORRECT: Annotated with Pydantic Field for type annotations

```python
from typing import Annotated
from pydantic import Field

def get_weather(
    location: Annotated[str, Field(description="The location to get weather for")]
) -> str:
    """Get the weather for a given location."""
    return f"The weather in {location} is sunny."
```

#### CORRECT: Annotated with string for Anthropic (simpler pattern)

```python
from typing import Annotated

def get_weather(
    location: Annotated[str, "The location to get the weather for."],
) -> str:
    """Get the weather for a given location."""
    return f"The weather in {location} is sunny."
```

#### CORRECT: Passing tools to agent

```python
agent = client.as_agent(instructions="...", tools=get_weather)
agent = client.as_agent(instructions="...", tools=[get_weather, another_tool])
```

#### INCORRECT: Wrong tool passing patterns

```python
agent = client.as_agent(instructions="...", tools=[get_weather()])  # Wrong — pass the function, not a call
agent = client.as_agent(instructions="...", functions=get_weather)   # Wrong param name — use tools
```

## 7. Async Context Managers

#### CORRECT: Azure AI Foundry requires async with for both credential and agent

```python
async with (
    AzureCliCredential() as credential,
    AzureAIAgentClient(async_credential=credential).as_agent(
        instructions="You are helpful."
    ) as agent,
):
    result = await agent.run("Hello!")
```

#### CORRECT: OpenAI Assistants requires async with for agent

```python
async with OpenAIAssistantsClient().as_agent(
    instructions="You are a helpful assistant.",
    name="MyAssistant"
) as agent:
    result = await agent.run("Hello!")
```

#### CORRECT: Azure OpenAI does NOT require async with

```python
agent = AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
    instructions="You are helpful."
)
result = await agent.run("Hello!")
```

#### INCORRECT: Forgetting async context manager

```python
agent = AzureAIAgentClient(async_credential=credential).as_agent(
    instructions="You are helpful."
)
# Wrong — resources will leak without async with
```

## 8. Streaming Responses

#### CORRECT: Standard streaming pattern

```python
async for chunk in agent.run_stream("Tell me a story"):
    if chunk.text:
        print(chunk.text, end="", flush=True)
```

#### INCORRECT: Treating run_stream like run

```python
result = await agent.run_stream("Tell me a story")  # Wrong — run_stream is an async iterable, not awaitable
```

## 9. Thread Management

#### CORRECT: Creating and using threads

```python
thread = agent.get_new_thread()
result = await agent.run("My name is Alice.", thread=thread, store=True)
```

#### INCORRECT: Thread misuse

```python
thread = AgentThread()                                # Wrong — use agent.get_new_thread()
result = await agent.run("Hello", thread="thread-id") # Wrong — pass an AgentThread object, not a string
```

## 10. Custom Agent Implementation

#### CORRECT: Extending BaseAgent with required methods

```python
from agent_framework import BaseAgent, AgentResponse, AgentResponseUpdate, AgentThread, ChatMessage
from collections.abc import AsyncIterable
from typing import Any

class MyAgent(BaseAgent):
    async def run(
        self,
        messages: str | ChatMessage | list[str] | list[ChatMessage] | None = None,
        *,
        thread: AgentThread | None = None,
        **kwargs: Any,
    ) -> AgentResponse:
        normalized = self._normalize_messages(messages)
        # ... process messages ...
        if thread is not None:
            await self._notify_thread_of_new_messages(thread, normalized, response_msg)
        return AgentResponse(messages=[response_msg])

    async def run_stream(self, messages=None, *, thread=None, **kwargs) -> AsyncIterable[AgentResponseUpdate]:
        # ... yield AgentResponseUpdate objects ...
        ...
```

#### INCORRECT: Forgetting thread notification

```python
class MyAgent(BaseAgent):
    async def run(self, messages=None, *, thread=None, **kwargs):
        # ... process messages ...
        return AgentResponse(messages=[response_msg])
        # Wrong — _notify_thread_of_new_messages must be called when thread is provided
```

## 11. Durable Agents

#### CORRECT: Basic durable agent setup

```python
from agent_framework.azure import AzureOpenAIChatClient, AgentFunctionApp
from azure.identity import DefaultAzureCredential

agent = AzureOpenAIChatClient(
    endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    deployment_name=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini"),
    credential=DefaultAzureCredential()
).as_agent(instructions="You are helpful.", name="MyAgent")

app = AgentFunctionApp(agents=[agent])
```

#### CORRECT: Getting durable agent in orchestrations

```python
@app.orchestration_trigger(context_name="context")
def my_orchestration(context):
    agent = app.get_agent(context, "MyAgent")
```

#### INCORRECT: Using raw agent in orchestrations

```python
@app.orchestration_trigger(context_name="context")
def my_orchestration(context):
    result = yield agent.run("Hello")  # Wrong — use app.get_agent(context, agent_name)
```

## 12. A2A Agents

#### CORRECT: Agent card discovery

```python
import httpx
from a2a.client import A2ACardResolver
from agent_framework.a2a import A2AAgent

async with httpx.AsyncClient(timeout=60.0) as http_client:
    resolver = A2ACardResolver(httpx_client=http_client, base_url="https://your-host")
    card = await resolver.get_agent_card(relative_card_path="/.well-known/agent.json")
    agent = A2AAgent(name=card.name, description=card.description, agent_card=card, url="https://your-host")
```

#### CORRECT: Direct URL configuration

```python
agent = A2AAgent(name="My Agent", description="...", url="https://your-host/endpoint")
```

#### INCORRECT: Wrong well-known path

```python
card = await resolver.get_agent_card(relative_card_path="/.well-known/agent-card.json")
# Wrong — the path is /.well-known/agent.json (not agent-card.json)
```

## 13. Async Variants

#### CORRECT: OpenAI/Azure OpenAI ChatCompletion (no async context manager needed)

```python
import asyncio

async def main():
    agent = OpenAIChatClient().as_agent(instructions="You are helpful.")
    result = await agent.run("Hello")
    print(result.text)

asyncio.run(main())
```

#### CORRECT: Azure AI Foundry (requires async context manager)

```python
async def main():
    async with (
        AzureCliCredential() as credential,
        AzureAIAgentClient(async_credential=credential).as_agent(
            instructions="You are helpful."
        ) as agent,
    ):
        result = await agent.run("Hello")
        async for chunk in agent.run_stream("Tell a story"):
            if chunk.text:
                print(chunk.text, end="", flush=True)

asyncio.run(main())
```

#### CORRECT: OpenAI Assistants (requires async context manager for agent only)

```python
async def main():
    async with OpenAIAssistantsClient().as_agent(
        instructions="You are helpful.", name="Assistant"
    ) as agent:
        result = await agent.run("Hello")

asyncio.run(main())
```

#### CORRECT: A2A agent (requires async httpx client)

```python
async def main():
    async with httpx.AsyncClient(timeout=60.0) as http_client:
        resolver = A2ACardResolver(httpx_client=http_client, base_url="https://host")
        card = await resolver.get_agent_card(relative_card_path="/.well-known/agent.json")
        agent = A2AAgent(name=card.name, description=card.description, agent_card=card, url="https://host")
        result = await agent.run("Hello")

asyncio.run(main())
```

#### INCORRECT: Synchronous usage

```python
result = agent.run("Hello")              # Wrong — must await
for chunk in agent.run_stream("Hello"):  # Wrong — must use async for
    print(chunk)
```

#### Key Rules

| Provider | `async with` Required? |
|---|---|
| OpenAI ChatCompletion | No |
| OpenAI Responses | No |
| Azure OpenAI ChatCompletion | No |
| Azure OpenAI Responses | No |
| Azure AI Foundry (`AzureAIAgentClient`) | Yes (credential + agent) |
| OpenAI Assistants | Yes (agent only) |
| Anthropic (`AnthropicClient`) | No |
| A2A | Yes (httpx client) |

- All `run()` calls must be awaited.
- All `run_stream()` calls must use `async for`.
- There are no synchronous agent variants in MAF.

