# Custom and Advanced Agent Types (Python)

This reference covers custom agents (BaseAgent/AgentProtocol), ChatClient-based agents, A2A agents, and durable agents in Microsoft Agent Framework.

## Table of Contents

- **Custom Agents** — AgentProtocol interface, BaseAgent (recommended), key implementation notes
- **ChatClient Agent** — Built-in chat clients, choosing a client
- **A2A Agent** — Well-known agent card discovery, direct URL configuration, usage
- **Durable Agents** — Basic hosting with Azure Functions, env vars, HTTP interaction, deterministic orchestrations, parallel orchestrations, human-in-the-loop, when to use
- **Common Pitfalls and Tips** — Thread notification, client selection, A2A spec, durable agent naming, structured output

## Custom Agents

Build fully custom agents by implementing `AgentProtocol` or extending `BaseAgent`. Use when wrapping non-chat backends, implementing custom logic, or integrating with proprietary services.

### Prerequisites

```bash
pip install agent-framework-core --pre
```

### AgentProtocol Interface

Implement the protocol directly for maximum flexibility:

```python
from agent_framework import AgentProtocol, AgentResponse, AgentResponseUpdate, AgentThread, ChatMessage
from collections.abc import AsyncIterable
from typing import Any

class MyCustomAgent(AgentProtocol):
    """A custom agent that implements the AgentProtocol directly."""

    @property
    def id(self) -> str:
        """Returns the ID of the agent."""
        return "my-custom-agent"

    async def run(
        self,
        messages: str | ChatMessage | list[str] | list[ChatMessage] | None = None,
        *,
        thread: AgentThread | None = None,
        **kwargs: Any,
    ) -> AgentResponse:
        """Execute the agent and return a complete response."""
        # Custom implementation
        return AgentResponse(messages=[])

    def run_stream(
        self,
        messages: str | ChatMessage | list[str] | list[ChatMessage] | None = None,
        *,
        thread: AgentThread | None = None,
        **kwargs: Any,
    ) -> AsyncIterable[AgentResponseUpdate]:
        """Execute the agent and yield streaming response updates."""
        # Custom implementation
        ...
```

### BaseAgent (Recommended)

Extend `BaseAgent` for common functionality and helper methods:

```python
import asyncio
from agent_framework import (
    BaseAgent,
    AgentResponse,
    AgentResponseUpdate,
    AgentThread,
    ChatMessage,
    Role,
    TextContent,
)
from collections.abc import AsyncIterable
from typing import Any


class EchoAgent(BaseAgent):
    """A simple custom agent that echoes user messages with a prefix."""

    echo_prefix: str = "Echo: "

    def __init__(
        self,
        *,
        name: str | None = None,
        description: str | None = None,
        echo_prefix: str = "Echo: ",
        **kwargs: Any,
    ) -> None:
        super().__init__(
            name=name,
            description=description,
            echo_prefix=echo_prefix,
            **kwargs,
        )

    async def run(
        self,
        messages: str | ChatMessage | list[str] | list[ChatMessage] | None = None,
        *,
        thread: AgentThread | None = None,
        **kwargs: Any,
    ) -> AgentResponse:
        normalized_messages = self._normalize_messages(messages)

        if not normalized_messages:
            response_message = ChatMessage(
                role=Role.ASSISTANT,
                contents=[TextContent(text="Hello! I'm a custom echo agent. Send me a message and I'll echo it back.")],
            )
        else:
            last_message = normalized_messages[-1]
            if last_message.text:
                echo_text = f"{self.echo_prefix}{last_message.text}"
            else:
                echo_text = f"{self.echo_prefix}[Non-text message received]"
            response_message = ChatMessage(role=Role.ASSISTANT, contents=[TextContent(text=echo_text)])

        if thread is not None:
            await self._notify_thread_of_new_messages(thread, normalized_messages, response_message)

        return AgentResponse(messages=[response_message])

    async def run_stream(
        self,
        messages: str | ChatMessage | list[str] | list[ChatMessage] | None = None,
        *,
        thread: AgentThread | None = None,
        **kwargs: Any,
    ) -> AsyncIterable[AgentResponseUpdate]:
        normalized_messages = self._normalize_messages(messages)

        if not normalized_messages:
            response_text = "Hello! I'm a custom echo agent. Send me a message and I'll echo it back."
        else:
            last_message = normalized_messages[-1]
            if last_message.text:
                response_text = f"{self.echo_prefix}{last_message.text}"
            else:
                response_text = f"{self.echo_prefix}[Non-text message received]"

        words = response_text.split()
        for i, word in enumerate(words):
            chunk_text = f" {word}" if i > 0 else word
            yield AgentResponseUpdate(
                contents=[TextContent(text=chunk_text)],
                role=Role.ASSISTANT,
            )
            await asyncio.sleep(0.1)

        if thread is not None:
            complete_response = ChatMessage(role=Role.ASSISTANT, contents=[TextContent(text=response_text)])
            await self._notify_thread_of_new_messages(thread, normalized_messages, complete_response)
```

### Key Implementation Notes

- Use `_normalize_messages()` to convert `str` or mixed input into a list of `ChatMessage`.
- Call `_notify_thread_of_new_messages()` when a thread is provided so conversation history is preserved.
- Return `AgentResponse(messages=[...])` from `run()`.
- Yield `AgentResponseUpdate` objects from `run_stream()`.

---

## ChatClient Agent

Use any chat client implementation that conforms to `ChatClientProtocol`. Enables integration with local models (e.g., Ollama), custom backends, and third-party services.

### Prerequisites

```bash
pip install agent-framework --pre
pip install agent-framework-azure-ai --pre  # For Azure AI
```

### Built-in Chat Clients

The framework provides several built-in clients. Wrap any of them with `ChatAgent`:

```python
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIChatClient

agent = ChatAgent(
    chat_client=OpenAIChatClient(model_id="gpt-4o"),
    instructions="You are a helpful assistant.",
    name="OpenAI Assistant"
)
```

```python
from agent_framework import ChatAgent
from agent_framework.azure import AzureOpenAIChatClient

agent = ChatAgent(
    chat_client=AzureOpenAIChatClient(
        model_id="gpt-4o",
        endpoint="https://your-resource.openai.azure.com/",
        api_key="your-api-key"
    ),
    instructions="You are a helpful assistant.",
    name="Azure OpenAI Assistant"
)
```

```python
from agent_framework import ChatAgent
from agent_framework.azure import AzureAIAgentClient
from azure.identity.aio import AzureCliCredential

async with AzureCliCredential() as credential:
    agent = ChatAgent(
        chat_client=AzureAIAgentClient(async_credential=credential),
        instructions="You are a helpful assistant.",
        name="Azure AI Assistant"
    )
```

### Choosing a Client

Select a client that supports function calling if tools are required. Ensure the underlying model and service support the features you need (streaming, structured output, etc.).

---

## A2A Agent

Connect to remote agents that expose the [Agent-to-Agent (A2A)](https://github.com/microsoft/agent2agent-spec) protocol. The local `A2AAgent` acts as a proxy to the remote agent.

### Prerequisites

```bash
pip install agent-framework-a2a --pre
```

### Well-Known Agent Card

Discover the agent via the well-known agent card at `/.well-known/agent.json`:

```python
import httpx
from a2a.client import A2ACardResolver

async with httpx.AsyncClient(timeout=60.0) as http_client:
    resolver = A2ACardResolver(httpx_client=http_client, base_url="https://your-a2a-agent-host")
```

```python
from agent_framework.a2a import A2AAgent

agent_card = await resolver.get_agent_card(relative_card_path="/.well-known/agent.json")

agent = A2AAgent(
    name=agent_card.name,
    description=agent_card.description,
    agent_card=agent_card,
    url="https://your-a2a-agent-host"
)
```

### Direct URL Configuration

Use when the agent URL is known (private agents, development):

```python
from agent_framework.a2a import A2AAgent

agent = A2AAgent(
    name="My A2A Agent",
    description="A directly configured A2A agent",
    url="https://your-a2a-agent-host/echo"
)
```

### Usage

A2A agents support all standard agent operations: `run()`, `run_stream()`, and thread management where the remote agent supports it.

---

## Durable Agents

Host agents in Azure Functions with durable state management. Conversation history and orchestration state survive failures, restarts, and long-running operations. Ideal for serverless, multi-agent workflows, and human-in-the-loop scenarios.

### Prerequisites

```bash
pip install azure-identity
pip install agent-framework-azurefunctions --pre
```

Requires an Azure Functions Python project with Microsoft.Azure.Functions.Worker 2.2.0 or later.

### Basic Durable Agent Hosting

```python
import os
from agent_framework.azure import AzureOpenAIChatClient, AgentFunctionApp
from azure.identity import DefaultAzureCredential

endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini")

agent = AzureOpenAIChatClient(
    endpoint=endpoint,
    deployment_name=deployment_name,
    credential=DefaultAzureCredential()
).as_agent(
    instructions="You are good at telling jokes.",
    name="Joker"
)

app = AgentFunctionApp(agents=[agent])
```

### Environment Variables

```bash
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o-mini"
```

### HTTP Interaction

The extension creates HTTP endpoints. Example `curl`:

```bash
# Start a thread
curl -X POST https://your-function-app.azurewebsites.net/api/agents/Joker/run \
  -H "Content-Type: text/plain" \
  -d "Tell me a joke about pirates"

# Continue the same thread (use thread_id from x-ms-thread-id header)
curl -X POST "https://your-function-app.azurewebsites.net/api/agents/Joker/run?thread_id=@dafx-joker@263fa373-fa01-4705-abf2-5a114c2bb87d" \
  -H "Content-Type: text/plain" \
  -d "Tell me another one about the same topic"
```

### Deterministic Orchestrations

Use `app.get_agent()` to obtain a durable agent wrapper for use in orchestrations:

```python
import azure.durable_functions as df
from typing import cast
from agent_framework.azure import AgentFunctionApp
from pydantic import BaseModel

class SpamDetectionResult(BaseModel):
    is_spam: bool
    reason: str

class EmailResponse(BaseModel):
    response: str

app = AgentFunctionApp(agents=[spam_detection_agent, email_assistant_agent])

@app.orchestration_trigger(context_name="context")
def spam_detection_orchestration(context: df.DurableOrchestrationContext):
    email = context.get_input()

    spam_agent = app.get_agent(context, "SpamDetectionAgent")
    spam_thread = spam_agent.get_new_thread()

    spam_result_raw = yield spam_agent.run(
        messages=f"Analyze this email for spam: {email['content']}",
        thread=spam_thread,
        response_format=SpamDetectionResult
    )
    spam_result = cast(SpamDetectionResult, spam_result_raw.get("structured_response"))

    if spam_result.is_spam:
        result = yield context.call_activity("handle_spam_email", spam_result.reason)
        return result

    email_agent = app.get_agent(context, "EmailAssistantAgent")
    email_thread = email_agent.get_new_thread()

    email_response_raw = yield email_agent.run(
        messages=f"Draft a professional response to: {email['content']}",
        thread=email_thread,
        response_format=EmailResponse
    )
    email_response = cast(EmailResponse, email_response_raw.get("structured_response"))

    result = yield context.call_activity("send_email", email_response.response)
    return result
```

### Parallel Orchestrations

```python
@app.orchestration_trigger(context_name="context")
def research_orchestration(context: df.DurableOrchestrationContext):
    topic = context.get_input()

    technical_agent = app.get_agent(context, "TechnicalResearchAgent")
    market_agent = app.get_agent(context, "MarketResearchAgent")
    competitor_agent = app.get_agent(context, "CompetitorResearchAgent")

    technical_task = technical_agent.run(messages=f"Research technical aspects of {topic}")
    market_task = market_agent.run(messages=f"Research market trends for {topic}")
    competitor_task = competitor_agent.run(messages=f"Research competitors in {topic}")

    results = yield context.task_all([technical_task, market_task, competitor_task])
    all_research = "\n\n".join([r.get('response', '') for r in results])

    summary_agent = app.get_agent(context, "SummaryAgent")
    summary = yield summary_agent.run(messages=f"Summarize this research:\n{all_research}")

    return summary.get('response', '')
```

### Human-in-the-Loop

Orchestrations can wait for external events (e.g., human approval):

```python
from datetime import timedelta

@app.orchestration_trigger(context_name="context")
def content_approval_workflow(context: df.DurableOrchestrationContext):
    topic = context.get_input()

    content_agent = app.get_agent(context, "ContentGenerationAgent")
    draft_content = yield content_agent.run(messages=f"Write an article about {topic}")

    yield context.call_activity("notify_reviewer", draft_content)

    approval_task = context.wait_for_external_event("ApprovalDecision")
    timeout_task = context.create_timer(
        context.current_utc_datetime + timedelta(hours=24)
    )

    winner = yield context.task_any([approval_task, timeout_task])

    if winner == approval_task:
        timeout_task.cancel()
        approval_data = approval_task.result
        if approval_data.get("approved"):
            result = yield context.call_activity("publish_content", draft_content)
            return result
        return "Content rejected"

    result = yield context.call_activity("escalate_for_review", draft_content)
    return result
```

To send approval from external code:

```python
approval_data = {"approved": True, "feedback": "Looks great!"}
await client.raise_event(instance_id, "ApprovalDecision", approval_data)
```

### When to Use Durable Agents

- **Full control**: Deploy your own Azure Functions while keeping serverless benefits.
- **Complex workflows**: Coordinate multiple agents with deterministic, fault-tolerant orchestrations.
- **Event-driven**: Integrate with HTTP, timers, queues, and other Azure Functions triggers.
- **Automatic state**: Conversation history is persisted without manual handling.
- **Cost efficiency**: On Flex Consumption, pay only for execution time; no compute during long waits for human input.

## Common Pitfalls and Tips

1. **Custom agents**: Always call `_notify_thread_of_new_messages()` when a thread is provided; otherwise multi-turn context is lost.
2. **ChatClient**: Choose a client that supports the features you need (tools, streaming, etc.).
3. **A2A**: The well-known path is `/.well-known/agent.json`; verify the remote agent implements the A2A spec.
4. **Durable agents**: Use `app.get_agent(context, agent_name)` inside orchestrations, not the raw agent. Agent names must match those registered in `AgentFunctionApp(agents=[...])`.
5. **Durable structured output**: Access `spam_result_raw.get("structured_response")` for Pydantic-typed results.
