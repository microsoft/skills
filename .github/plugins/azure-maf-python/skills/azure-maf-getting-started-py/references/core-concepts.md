# Core Concepts - Python Reference

Detailed reference for Microsoft Agent Framework core abstractions in Python.

## Agent Type Hierarchy

All MAF agents derive from a common abstraction:

- **BaseAgent / AgentProtocol** -- Core base for all agents. Defines `run()` and `run_stream()`.
- **ChatAgent** -- Wraps a chat client. Supports function calling, multi-turn conversations, tools (MCP, code interpreter, web search), structured output, and streaming.
- **Provider-specific clients** -- `OpenAIChatClient`, `AzureOpenAIChatClient`, `AzureAIAgentClient`, `AnthropicClient`, etc. Each has an `.as_agent()` method that returns a `ChatAgent`.

### ChatAgent Creation Patterns

```python
# Via client's as_agent() method (recommended)
agent = OpenAIChatClient().as_agent(
    instructions="You are helpful.",
    tools=[my_function],
)

# Via ChatAgent constructor
agent = ChatAgent(
    chat_client=my_client,
    instructions="You are helpful.",
    tools=[my_function],
)
```

### Custom Agents

Subclass `BaseAgent` for full control:

```python
from agent_framework import BaseAgent, AgentResponse, AgentResponseUpdate

class MyAgent(BaseAgent):
    async def run(self, messages, **kwargs) -> AgentResponse:
        # Custom logic
        ...

    async def run_stream(self, messages, **kwargs):
        # Custom streaming logic
        yield AgentResponseUpdate(text="chunk")
```

## AgentThread Lifecycle

Agents are stateless. All conversation state lives in `AgentThread` objects. The same agent instance can serve multiple threads concurrently.

### Creating Threads

```python
# Explicit thread creation
thread = agent.get_new_thread()

# Implicit (throwaway thread for single-turn)
result = await agent.run("Hello")  # No thread = single-turn
```

### Thread State Storage

| Storage Location | Description | Examples |
|-----------------|-------------|----------|
| In-memory | Messages stored in `AgentThread` object | OpenAI ChatCompletion, Azure OpenAI |
| In-service | Messages stored remotely; thread holds reference | Azure AI Foundry, OpenAI Responses |
| Custom store | Messages stored in Redis, database, etc. | `RedisChatMessageStore` |

### Thread Serialization

```python
# Serialize for persistence
serialized = await thread.serialize()
# Returns a dict suitable for JSON serialization

# Deserialize with the same agent type
restored_thread = await agent.deserialize_thread(serialized)
```

Thread serialization captures the full state including message store references and context provider state. Always deserialize with the same agent type and configuration.

## Message and Content Types

### Input Messages

Pass a string, `ChatMessage`, or list of `ChatMessage` objects:

```python
# Simple string
result = await agent.run("Hello world")

# Single ChatMessage
from agent_framework import ChatMessage, TextContent, UriContent, Role

msg = ChatMessage(role=Role.USER, contents=[
    TextContent(text="Describe this image."),
    UriContent(uri="https://example.com/photo.jpg", media_type="image/jpeg"),
])
result = await agent.run(msg, thread=thread)

# Multiple messages (including system override)
messages = [
    ChatMessage(role=Role.SYSTEM, contents=[TextContent(text="You are a pirate.")]),
    ChatMessage(role=Role.USER, contents=[TextContent(text="Hello!")]),
]
result = await agent.run(messages, thread=thread)
```

### Content Types

| Type | Description | Use Case |
|------|-------------|----------|
| `TextContent` | Plain text | Standard text messages |
| `UriContent` | URI reference | Images, audio, documents via URL |
| `DataContent` | Binary data | Inline images, files |
| `FunctionCallContent` | Tool invocation | Agent requesting tool call |
| `FunctionResultContent` | Tool result | Result returned to agent |
| `ErrorContent` | Error information | Python-specific error handling |
| `UsageContent` | Token usage stats | Python-specific usage tracking |

## Response Types

### AgentResponse (Non-Streaming)

Returned by `agent.run()`. Contains:

- `.text` -- Aggregated text from all `TextContent` in response messages
- `.messages` -- List of `ChatMessage` objects with full content detail

```python
result = await agent.run("What is 2+2?", thread=thread)
print(result.text)  # "4"
for msg in result.messages:
    for content in msg.contents:
        print(type(content).__name__, content)
```

### AgentResponseUpdate (Streaming)

Yielded by `agent.run_stream()`. Contains:

- `.text` -- Incremental text chunk
- `.contents` -- List of content objects in this update

```python
async for update in agent.run_stream("Tell me a story"):
    if update.text:
        print(update.text, end="", flush=True)
```

## Run Options

Provider-specific options passed via the `options` parameter:

```python
result = await agent.run(
    "What is 2+2?",
    thread=thread,
    options={
        "model_id": "gpt-4o",
        "temperature": 0.7,
        "max_tokens": 1000,
    },
)
```

Options are TypedDicts specific to each provider. Common fields:

| Field | Type | Description |
|-------|------|-------------|
| `model_id` | `str` | Override model for this run |
| `temperature` | `float` | Sampling temperature (0.0-2.0) |
| `max_tokens` | `int` | Maximum tokens in response |
| `top_p` | `float` | Nucleus sampling parameter |
| `response_format` | `dict` | Structured output schema |

## Streaming Patterns

### Basic Streaming

```python
async for chunk in agent.run_stream("Hello"):
    if chunk.text:
        print(chunk.text, end="")
```

### Streaming with Thread

```python
thread = agent.get_new_thread()
async for chunk in agent.run_stream("Tell me a story", thread=thread):
    if chunk.text:
        print(chunk.text, end="")
# Thread is updated with the full conversation
```

### Collecting Full Response from Stream

```python
full_text = ""
async for chunk in agent.run_stream("Hello"):
    if chunk.text:
        full_text += chunk.text
print(full_text)
```

## Conversation History by Service

| Service | How History is Stored |
|---------|----------------------|
| Azure AI Foundry Agents | Service-stored (persistent) |
| OpenAI Responses | Service-stored or in-memory |
| OpenAI ChatCompletion | In-memory (sent on each call) |
| OpenAI Assistants | Service-stored (persistent) |
| A2A | Service-stored (persistent) |

For ChatCompletion services, history lives in the `AgentThread` and is sent to the service on each call. For Foundry/Responses, history lives in the service and only a reference is sent.
