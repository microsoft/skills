# Chat History Storage Reference

This reference covers the full chat history storage system in Microsoft Agent Framework Python, including built-in stores, Redis integration, custom store implementation, and thread serialization.

## Table of Contents

- [Storage Architecture](#storage-architecture)
- [ChatMessageStoreProtocol](#chatmessagestoreprotocol)
- [Built-in ChatMessageStore](#built-in-chatmessagestore)
- [RedisChatMessageStore](#redischatmessagestore)
  - [Installation](#installation)
  - [Basic Usage](#basic-usage)
  - [Full Configuration](#full-configuration)
  - [Internal Implementation](#internal-implementation)
- [Custom Store Implementation](#custom-store-implementation)
  - [Database Example](#database-example)
  - [Full Redis Implementation](#full-redis-implementation)
- [chat_message_store_factory Pattern](#chat_message_store_factory-pattern)
- [Thread Serialization](#thread-serialization)
  - [Serialize a Thread](#serialize-a-thread)
  - [Restore a Thread](#restore-a-thread)
  - [What Gets Serialized](#what-gets-serialized)
  - [Compatibility Rules](#compatibility-rules)
- [Multi-Turn Conversation Patterns](#multi-turn-conversation-patterns)
  - [Basic Pattern](#basic-pattern)
  - [Persist and Resume](#persist-and-resume)
  - [Running Agents (Streaming and Non-Streaming)](#running-agents-streaming-and-non-streaming)
- [Service-Specific Storage](#service-specific-storage)
- [Chat History Reduction](#chat-history-reduction)
- [Common Pitfalls](#common-pitfalls)

## Storage Architecture

The Agent Framework uses a layered storage model:

1. **In-memory (default)** -- `ChatMessageStore` stores messages in memory during runtime. No configuration needed.
2. **Redis** -- `RedisChatMessageStore` persists messages in Redis Lists for production use.
3. **Custom** -- Implement `ChatMessageStoreProtocol` for any backend (PostgreSQL, MongoDB, vector stores, etc.).
4. **Service-stored** -- Services like Azure AI Foundry and OpenAI Responses manage history internally. The framework stores only a reference ID.

## ChatMessageStoreProtocol

The protocol that all custom stores must implement:

```python
from agent_framework import ChatMessage, ChatMessageStoreProtocol
from typing import Any
from collections.abc import Sequence

class MyCustomStore(ChatMessageStoreProtocol):
    async def add_messages(self, messages: Sequence[ChatMessage]) -> None:
        """Add messages to the store. Called after each agent invocation."""
        ...

    async def list_messages(self) -> list[ChatMessage]:
        """Return all messages in ascending chronological order (oldest first)."""
        ...

    async def serialize(self, **kwargs: Any) -> Any:
        """Serialize store state for thread persistence."""
        ...

    async def update_from_state(self, serialized_store_state: Any, **kwargs: Any) -> None:
        """Restore store state from serialized data."""
        ...
```

**Critical rules:**
- `list_messages` must return messages in ascending chronological order (oldest first)
- `list_messages` results are sent to the model. Ensure the count does not exceed the model's context window.
- Apply summarization or trimming in `list_messages` if needed.
- Each thread must get its own store instance (use `chat_message_store_factory`).

## Built-in ChatMessageStore

The default in-memory store requires no configuration:

```python
from agent_framework import ChatMessageStore, ChatAgent
from agent_framework.openai import OpenAIChatClient

def create_message_store():
    return ChatMessageStore()

agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful assistant.",
    chat_message_store_factory=create_message_store
)
```

Explicitly providing the factory is optional -- the framework creates an in-memory store by default when the service does not manage history internally.

## RedisChatMessageStore

Production-ready persistent storage using Redis Lists.

### Installation

```bash
pip install redis
```

### Basic Usage

```python
from agent_framework.redis import RedisChatMessageStore
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIChatClient

agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful assistant.",
    chat_message_store_factory=lambda: RedisChatMessageStore(
        redis_url="redis://localhost:6379"
    )
)

thread = agent.get_new_thread()
response = await agent.run("Tell me a joke about pirates", thread=thread)
print(response.text)
```

### Full Configuration

```python
RedisChatMessageStore(
    redis_url="redis://localhost:6379",   # Required: Redis connection URL
    thread_id="user_session_123",          # Optional: explicit thread ID (auto-generated if omitted)
    key_prefix="chat_messages",            # Optional: Redis key namespace (default: "chat_messages")
    max_messages=100,                      # Optional: message limit (trims oldest when exceeded)
)
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `redis_url` | `str` | Required | Redis connection URL |
| `thread_id` | `str` | Auto UUID | Unique thread identifier |
| `key_prefix` | `str` | `"chat_messages"` | Redis key namespace |
| `max_messages` | `int` | `None` | Max messages to retain |

### Internal Implementation

The Redis store uses Redis Lists (RPUSH / LRANGE / LTRIM):
- `add_messages`: Serializes each `ChatMessage` to JSON and appends via RPUSH
- `list_messages`: Retrieves all messages via LRANGE in chronological order
- Auto-trims when `max_messages` is exceeded using LTRIM
- Generates a unique thread key on first message: `{key_prefix}:{thread_id}`

## Custom Store Implementation

### Database Example

```python
from collections.abc import Sequence
from typing import Any
from agent_framework import ChatMessage, ChatMessageStoreProtocol

class DatabaseMessageStore(ChatMessageStoreProtocol):
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self._messages: list[ChatMessage] = []

    async def add_messages(self, messages: Sequence[ChatMessage]) -> None:
        """Add messages to database."""
        self._messages.extend(messages)

    async def list_messages(self) -> list[ChatMessage]:
        """Retrieve messages from database."""
        return self._messages

    async def serialize(self, **kwargs: Any) -> Any:
        """Serialize store state for persistence."""
        return {"connection_string": self.connection_string}

    async def update_from_state(self, serialized_store_state: Any, **kwargs: Any) -> None:
        """Update store from serialized state."""
        if serialized_store_state:
            self.connection_string = serialized_store_state["connection_string"]
```

### Full Redis Implementation

A complete Redis implementation using `redis.asyncio` and Pydantic for state serialization:

```python
from collections.abc import Sequence
from typing import Any
from uuid import uuid4
from pydantic import BaseModel
import json
import redis.asyncio as redis
from agent_framework import ChatMessage


class RedisStoreState(BaseModel):
    thread_id: str
    redis_url: str | None = None
    key_prefix: str = "chat_messages"
    max_messages: int | None = None


class RedisChatMessageStore:
    def __init__(
        self,
        redis_url: str | None = None,
        thread_id: str | None = None,
        key_prefix: str = "chat_messages",
        max_messages: int | None = None,
    ) -> None:
        if redis_url is None:
            raise ValueError("redis_url is required for Redis connection")
        self.redis_url = redis_url
        self.thread_id = thread_id or f"thread_{uuid4()}"
        self.key_prefix = key_prefix
        self.max_messages = max_messages
        self._redis_client = redis.from_url(redis_url, decode_responses=True)

    @property
    def redis_key(self) -> str:
        return f"{self.key_prefix}:{self.thread_id}"

    async def add_messages(self, messages: Sequence[ChatMessage]) -> None:
        if not messages:
            return
        serialized_messages = [self._serialize_message(msg) for msg in messages]
        await self._redis_client.rpush(self.redis_key, *serialized_messages)
        if self.max_messages is not None:
            current_count = await self._redis_client.llen(self.redis_key)
            if current_count > self.max_messages:
                await self._redis_client.ltrim(self.redis_key, -self.max_messages, -1)

    async def list_messages(self) -> list[ChatMessage]:
        redis_messages = await self._redis_client.lrange(self.redis_key, 0, -1)
        return [self._deserialize_message(msg) for msg in redis_messages]

    async def serialize(self, **kwargs: Any) -> Any:
        state = RedisStoreState(
            thread_id=self.thread_id,
            redis_url=self.redis_url,
            key_prefix=self.key_prefix,
            max_messages=self.max_messages,
        )
        return state.model_dump(**kwargs)

    async def update_from_state(self, serialized_store_state: Any, **kwargs: Any) -> None:
        if serialized_store_state:
            state = RedisStoreState.model_validate(serialized_store_state, **kwargs)
            self.thread_id = state.thread_id
            self.key_prefix = state.key_prefix
            self.max_messages = state.max_messages
            if state.redis_url and state.redis_url != self.redis_url:
                self.redis_url = state.redis_url
                self._redis_client = redis.from_url(self.redis_url, decode_responses=True)

    def _serialize_message(self, message: ChatMessage) -> str:
        return json.dumps(message.model_dump(), separators=(",", ":"))

    def _deserialize_message(self, serialized_message: str) -> ChatMessage:
        return ChatMessage.model_validate(json.loads(serialized_message))

    async def clear(self) -> None:
        await self._redis_client.delete(self.redis_key)

    async def aclose(self) -> None:
        await self._redis_client.aclose()
```

## chat_message_store_factory Pattern

The factory is a callable that returns a new store instance per thread. Pass it when creating the agent:

```python
agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful assistant.",
    chat_message_store_factory=lambda: RedisChatMessageStore(
        redis_url="redis://localhost:6379"
    )
)
```

For more complex configurations, use a function:

```python
def create_store():
    return RedisChatMessageStore(
        redis_url=os.environ["REDIS_URL"],
        key_prefix="myapp",
        max_messages=200,
    )

agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="...",
    chat_message_store_factory=create_store
)
```

**Important:** Each thread receives its own store instance from the factory. Do not share store instances across threads.

## Thread Serialization

### Serialize a Thread

```python
import json

thread = agent.get_new_thread()
await agent.run("My name is Alice", thread=thread)
await agent.run("I like hiking", thread=thread)

serialized_thread = await thread.serialize()

with open("thread_state.json", "w") as f:
    json.dump(serialized_thread, f)
```

### Restore a Thread

```python
with open("thread_state.json", "r") as f:
    thread_data = json.load(f)

restored_thread = await agent.deserialize_thread(thread_data)
response = await agent.run("What's my name and hobby?", thread=restored_thread)
```

### What Gets Serialized

Serialization captures the full thread state:
- Message store state (via `serialize`)
- Context provider state
- Thread metadata and references

### Compatibility Rules

- Always deserialize with the same agent type and configuration that created the thread
- Do not use a thread created by one agent with a different agent
- Thread formats vary by agent type and service

## Multi-Turn Conversation Patterns

### Basic Pattern

```python
async with ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful assistant."
) as agent:
    thread = agent.get_new_thread()
    r1 = await agent.run("My name is Alice", thread=thread)
    r2 = await agent.run("What's my name?", thread=thread)
    print(r2.text)  # Remembers "Alice"
```

### Persist and Resume

```python
import json

async with ChatAgent(chat_client=OpenAIChatClient()) as agent:
    thread = agent.get_new_thread()
    await agent.run("My name is Alice", thread=thread)

    serialized = await thread.serialize()
    with open("state.json", "w") as f:
        json.dump(serialized, f)

# Later, in a new session:
async with ChatAgent(chat_client=OpenAIChatClient()) as agent:
    with open("state.json", "r") as f:
        data = json.load(f)
    restored = await agent.deserialize_thread(data)
    r = await agent.run("What did we discuss?", thread=restored)
```

### Running Agents (Streaming and Non-Streaming)

Non-streaming:

```python
result = await agent.run("Hello", thread=thread)
print(result.text)
```

Streaming:

```python
async for update in agent.run_stream("Hello", thread=thread):
    if update.text:
        print(update.text, end="", flush=True)
```

Both methods accept a `thread` parameter for multi-turn context and a `tools` parameter for per-run tools.

## Service-Specific Storage

Different services handle chat history differently:

| Service | Storage Model | Thread Contains |
|---------|--------------|-----------------|
| OpenAI ChatCompletion | In-memory (default) or custom store | Full message history |
| OpenAI Responses (store=true) | Service-stored | Response chain ID |
| OpenAI Responses (store=false) | In-memory (default) or custom store | Full message history |
| Azure AI Foundry | Service-stored (persistent agents) | Agent and thread IDs |
| OpenAI Assistants | Service-stored | Assistant and thread IDs |

When using a service with built-in storage, `chat_message_store_factory` is not used -- the service manages history internally.

## Chat History Reduction

For in-memory stores, implement trimming or summarization in `list_messages` to prevent exceeding model context limits:

```python
class TruncatingStore(ChatMessageStoreProtocol):
    def __init__(self, max_messages: int = 50):
        self._messages: list[ChatMessage] = []
        self.max_messages = max_messages

    async def add_messages(self, messages: Sequence[ChatMessage]) -> None:
        self._messages.extend(messages)

    async def list_messages(self) -> list[ChatMessage]:
        # Return only the most recent messages
        return self._messages[-self.max_messages:]

    async def serialize(self, **kwargs: Any) -> Any:
        return {"max_messages": self.max_messages}

    async def update_from_state(self, serialized_store_state: Any, **kwargs: Any) -> None:
        if serialized_store_state:
            self.max_messages = serialized_store_state.get("max_messages", 50)
```

## Common Pitfalls

- **Shared store instances**: Always use a factory that creates a new store per thread. Sharing stores across threads causes message mixing.
- **Message ordering**: `list_messages` must return messages oldest-first. Incorrect ordering confuses the model.
- **Context overflow**: Monitor returned message count relative to the model's context window. Implement reduction in the store.
- **Serialization mismatch**: Deserializing a thread with a different agent type or configuration causes errors.
- **Redis connection management**: Call `aclose()` on Redis stores when done, or use `async with` patterns.
- **Service-stored threads**: Do not provide `chat_message_store_factory` for services that manage history internally (Foundry, Assistants) -- the factory is ignored.
