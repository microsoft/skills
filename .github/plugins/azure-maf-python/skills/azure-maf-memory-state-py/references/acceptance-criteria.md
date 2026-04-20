# Acceptance Criteria — maf-memory-state-py

Use these patterns to validate that generated code follows the correct Microsoft Agent Framework memory and state APIs.

---

## 0a. Import Paths

#### CORRECT: Core memory imports
```python
from agent_framework import ChatAgent, ChatMessage, ChatMessageStore, ChatMessageStoreProtocol
from agent_framework import ContextProvider, Context
```

#### CORRECT: Redis store import
```python
from agent_framework.redis import RedisChatMessageStore
```

#### CORRECT: Mem0 provider import
```python
from agent_framework.mem0 import Mem0Provider
```

#### INCORRECT: Wrong module paths
```python
from agent_framework.memory import ChatMessageStore      # Wrong — top-level import
from agent_framework.stores import RedisChatMessageStore  # Wrong — use agent_framework.redis
from agent_framework import RedisChatMessageStore         # Wrong — use agent_framework.redis
from agent_framework import Mem0Provider                  # Wrong — use agent_framework.mem0
```

---

## 0b. Authentication Patterns

Memory components don't handle authentication directly. Authentication is configured at the agent/chat client level.

#### CORRECT: Redis store with connection URL
```python
from agent_framework.redis import RedisChatMessageStore

store = RedisChatMessageStore(redis_url="redis://localhost:6379")
```

#### CORRECT: Redis with password
```python
store = RedisChatMessageStore(redis_url="redis://:password@hostname:6379/0")
```

#### CORRECT: Mem0 with API key
```python
from agent_framework.mem0 import Mem0Provider

provider = Mem0Provider(api_key="your-mem0-api-key", user_id="user_123", application_id="my_app")
```

#### INCORRECT: Passing Azure credentials to memory stores
```python
from azure.identity import DefaultAzureCredential
store = RedisChatMessageStore(credential=DefaultAzureCredential())  # Wrong — uses redis_url, not Azure cred
```

---

## 0c. Async Variants

#### CORRECT: All memory operations are async
```python
import asyncio

async def main():
    thread = agent.get_new_thread()
    response = await agent.run("Hello", thread=thread)
    
    # Serialization is async
    serialized = await thread.serialize()
    restored = await agent.deserialize_thread(serialized)
    
    # Store operations are async
    store = RedisChatMessageStore(redis_url="redis://localhost:6379")
    await store.add_messages([message])
    messages = await store.list_messages()
    await store.aclose()

asyncio.run(main())
```

#### INCORRECT: Synchronous memory operations
```python
serialized = thread.serialize()           # Wrong — must await
restored = agent.deserialize_thread(data) # Wrong — must await
messages = store.list_messages()          # Wrong — must await
```

#### Key Rules

- `thread.serialize()` and `agent.deserialize_thread()` are async.
- All `ChatMessageStoreProtocol` methods (`add_messages`, `list_messages`, `serialize`, `update_from_state`) are async.
- `RedisChatMessageStore.aclose()` must be awaited for cleanup.
- `ContextProvider.invoking()` and `invoked()` are async.
- There are no synchronous variants of any memory API.

---

## 1. Thread Lifecycle

### Correct

```python
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIChatClient

agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful assistant."
)

thread = agent.get_new_thread()
response = await agent.run("My name is Alice", thread=thread)
response = await agent.run("What's my name?", thread=thread)
```

### Incorrect

```python
# Wrong: Creating thread independently
from agent_framework import AgentThread
thread = AgentThread()

# Wrong: Omitting thread for multi-turn (creates throwaway each time)
r1 = await agent.run("My name is Alice")
r2 = await agent.run("What's my name?")  # Won't remember Alice
```

### Key Rules

- Obtain threads via `agent.get_new_thread()`.
- Pass the same `thread` across `.run()` calls for multi-turn conversations.
- Omitting `thread` creates a throwaway single-turn context.

---

## 2. ChatMessageStore Factory

### Correct

```python
from agent_framework import ChatAgent, ChatMessageStore
from agent_framework.openai import OpenAIChatClient

agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful assistant.",
    chat_message_store_factory=lambda: ChatMessageStore()
)
```

### Correct — Redis

```python
from agent_framework.redis import RedisChatMessageStore

agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="...",
    chat_message_store_factory=lambda: RedisChatMessageStore(
        redis_url="redis://localhost:6379"
    )
)
```

### Incorrect

```python
# Wrong: Passing a store instance instead of a factory
store = RedisChatMessageStore(redis_url="redis://localhost:6379")
agent = ChatAgent(chat_client=..., chat_message_store_factory=store)

# Wrong: Sharing a single store across threads
shared_store = ChatMessageStore()
agent = ChatAgent(chat_client=..., chat_message_store_factory=lambda: shared_store)

# Wrong: Providing factory for service-stored providers (Foundry, Assistants)
# The factory is ignored when the service manages history internally
```

### Key Rules

- `chat_message_store_factory` is a **callable** that returns a new store instance per thread.
- Each thread must get its own store instance — never share stores across threads.
- Do not provide `chat_message_store_factory` for services with built-in storage (Azure AI Foundry, OpenAI Assistants).

---

## 3. ChatMessageStoreProtocol

### Correct

```python
from agent_framework import ChatMessage, ChatMessageStoreProtocol
from typing import Any
from collections.abc import Sequence

class MyStore(ChatMessageStoreProtocol):
    async def add_messages(self, messages: Sequence[ChatMessage]) -> None:
        ...

    async def list_messages(self) -> list[ChatMessage]:
        ...

    async def serialize(self, **kwargs: Any) -> Any:
        ...

    async def update_from_state(self, serialized_store_state: Any, **kwargs: Any) -> None:
        ...
```

### Incorrect

```python
# Wrong: list_messages returns newest-first (must be oldest-first)
async def list_messages(self) -> list[ChatMessage]:
    return self._messages[::-1]

# Wrong: Missing serialize / update_from_state methods
class MyStore(ChatMessageStoreProtocol):
    async def add_messages(self, messages): ...
    async def list_messages(self): ...
```

### Key Rules

- `list_messages` must return messages in **ascending chronological order** (oldest first).
- Implement all four methods: `add_messages`, `list_messages`, `serialize`, `update_from_state`.
- `list_messages` results are sent to the model — ensure count does not exceed context window.
- Apply summarization or trimming in `list_messages` if needed.

---

## 4. RedisChatMessageStore

### Correct

```python
from agent_framework.redis import RedisChatMessageStore

store = RedisChatMessageStore(
    redis_url="redis://localhost:6379",
    thread_id="user_session_123",
    key_prefix="chat_messages",
    max_messages=100,
)
```

### Key Rules

| Parameter | Type | Default | Required |
|---|---|---|---|
| `redis_url` | `str` | — | Yes |
| `thread_id` | `str` | Auto UUID | No |
| `key_prefix` | `str` | `"chat_messages"` | No |
| `max_messages` | `int` | `None` | No |

- Uses Redis Lists (RPUSH / LRANGE / LTRIM).
- Auto-trims oldest messages when `max_messages` exceeded.
- Redis key format: `{key_prefix}:{thread_id}`.
- Call `aclose()` when done to release Redis connections.

---

## 5. Thread Serialization

### Correct

```python
import json

serialized_thread = await thread.serialize()
with open("thread_state.json", "w") as f:
    json.dump(serialized_thread, f)

restored_thread = await agent.deserialize_thread(loaded_data)
await agent.run("Continue conversation", thread=restored_thread)
```

### Incorrect

```python
# Wrong: Deserializing with a different agent type/config
agent_a = ChatAgent(chat_client=OpenAIChatClient(), instructions="A")
thread = agent_a.get_new_thread()
await agent_a.run("Hello", thread=thread)
data = await thread.serialize()

agent_b = ChatAgent(chat_client=OpenAIChatClient(), instructions="B")
restored = await agent_b.deserialize_thread(data)  # May cause errors

# Wrong: Using pickle instead of the framework serialization
import pickle
pickle.dump(thread, f)
```

### Key Rules

- Use `await thread.serialize()` and `await agent.deserialize_thread(data)`.
- Always deserialize with the **same agent type and configuration** that created the thread.
- Do not use a thread created by one agent with a different agent.
- Serialization captures message store state, context provider state, and thread metadata.

---

## 6. Context Providers

### Correct

```python
from agent_framework import ContextProvider, Context, ChatAgent, ChatMessage
from collections.abc import MutableSequence, Sequence
from typing import Any

class MyMemory(ContextProvider):
    async def invoking(
        self,
        messages: ChatMessage | MutableSequence[ChatMessage],
        **kwargs: Any,
    ) -> Context:
        return Context(instructions="Additional context here.")

    async def invoked(
        self,
        request_messages: ChatMessage | Sequence[ChatMessage],
        response_messages: ChatMessage | Sequence[ChatMessage] | None = None,
        invoke_exception: Exception | None = None,
        **kwargs: Any,
    ) -> None:
        pass

    def serialize(self) -> str:
        return "{}"

agent = ChatAgent(
    chat_client=...,
    instructions="...",
    context_providers=MyMemory()
)
```

### Incorrect

```python
# Wrong: Returning None from invoking (must return Context)
async def invoking(self, messages, **kwargs):
    return None

# Wrong: Missing serialize() for stateful provider
class StatefulMemory(ContextProvider):
    def __init__(self):
        self.facts = []
    # No serialize() — state will be lost on thread serialization
```

### Key Rules

- `invoking` is called **before** each agent call — return a `Context` object (even empty `Context()`).
- `invoked` is called **after** each agent call — use for extracting and storing information.
- `Context` supports `instructions`, `messages`, and `tools` fields.
- Implement `serialize()` for any stateful context provider to survive thread serialization.
- Access providers via `thread.context_provider.providers[N]`.

---

## 7. Mem0Provider

### Correct

```python
from agent_framework.mem0 import Mem0Provider

memory_provider = Mem0Provider(
    api_key="your-mem0-api-key",
    user_id="user_123",
    application_id="my_app"
)

agent = ChatAgent(
    chat_client=...,
    instructions="You are a helpful assistant with memory.",
    context_providers=memory_provider
)
```

### Key Rules

- Requires `api_key`, `user_id`, and `application_id`.
- Memories are stored remotely and retrieved based on conversational relevance.
- Handles memory extraction and injection automatically.

---

## 8. Service-Specific Storage

| Service | Storage Model | Thread Contains | `chat_message_store_factory` Used? |
|---|---|---|---|
| OpenAI ChatCompletion | In-memory or custom store | Full message history | Yes |
| OpenAI Responses (store=true) | Service-stored | Response chain ID | No |
| OpenAI Responses (store=false) | In-memory or custom store | Full message history | Yes |
| Azure AI Foundry | Service-stored (persistent agents) | Agent and thread IDs | No |
| OpenAI Assistants | Service-stored | Assistant and thread IDs | No |

---

## 9. Common Pitfalls

| Pitfall | Correct Approach |
|---|---|
| Sharing store instances across threads | Use a factory that returns a **new** instance per thread |
| `list_messages` returns newest-first | Must return **oldest-first** (ascending chronological) |
| Exceeding model context window | Implement truncation or summarization in `list_messages` |
| Deserializing with wrong agent config | Always deserialize with the same agent type and configuration |
| Forgetting `aclose()` on Redis stores | Call `aclose()` or use `async with` for cleanup |
| Providing factory for service-stored providers | Omit `chat_message_store_factory` — the service manages history |

