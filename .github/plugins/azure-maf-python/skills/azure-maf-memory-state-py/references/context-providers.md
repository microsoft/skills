# Context Providers and Long-Term Memory - Microsoft Agent Framework Python

This reference covers context providers in Microsoft Agent Framework Python: the `ContextProvider` abstraction, custom implementations, Mem0 integration for long-term memory, serialization for persistence, and background responses.

## Overview

Context providers enable dynamic memory patterns by injecting relevant context before each agent invocation and extracting new information after each run. They run custom logic around the underlying inference call, allowing agents to maintain long-term memories, user preferences, and other cross-turn state.

Not all agent types support context providers. `ChatAgent` (and `ChatClientAgent`-based agents) support them. Attach context providers when creating the agent via the `context_providers` parameter.

## ContextProvider Base

`ContextProvider` is an abstract class with two core methods:

1. **`invoking(messages, **kwargs)`** – Called before the agent invokes the underlying chat client. Return a `Context` object to add instructions, messages, or tools that are merged with the agent’s existing context.
2. **`invoked(request_messages, response_messages, invoke_exception, **kwargs)`** – Called after the agent receives a response. Inspect request and response messages and update the context provider’s state (e.g., extract and store memories).

Context providers are created and attached to an `AgentThread` when the thread is created or deserialized. Each thread gets its own context provider instance.

## Basic Context Provider Example

The following example remembers a user’s name and age and injects that into each invocation. If information is missing, it instructs the agent to ask for it.

```python
from collections.abc import MutableSequence, Sequence
from typing import Any
from pydantic import BaseModel
from agent_framework import ContextProvider, Context, ChatAgent, ChatClientProtocol, ChatMessage, ChatOptions


class UserInfo(BaseModel):
    name: str | None = None
    age: int | None = None


class UserInfoMemory(ContextProvider):
    def __init__(
        self,
        chat_client: ChatClientProtocol,
        user_info: UserInfo | None = None,
        **kwargs: Any,
    ) -> None:
        self._chat_client = chat_client
        if user_info:
            self.user_info = user_info
        elif kwargs:
            self.user_info = UserInfo.model_validate(kwargs)
        else:
            self.user_info = UserInfo()

    async def invoked(
        self,
        request_messages: ChatMessage | Sequence[ChatMessage],
        response_messages: ChatMessage | Sequence[ChatMessage] | None = None,
        invoke_exception: Exception | None = None,
        **kwargs: Any,
    ) -> None:
        """Extract user information from messages after each agent call."""
        messages_list = (
            [request_messages]
            if isinstance(request_messages, ChatMessage)
            else list(request_messages)
        )
        user_messages = [msg for msg in messages_list if msg.role.value == "user"]

        if (self.user_info.name is None or self.user_info.age is None) and user_messages:
            try:
                result = await self._chat_client.get_response(
                    messages=messages_list,
                    chat_options=ChatOptions(
                        instructions=(
                            "Extract the user's name and age from the message if present. "
                            "If not present return nulls."
                        ),
                        response_format=UserInfo,
                    ),
                )
                if result.value and isinstance(result.value, UserInfo):
                    if self.user_info.name is None and result.value.name:
                        self.user_info.name = result.value.name
                    if self.user_info.age is None and result.value.age:
                        self.user_info.age = result.value.age
            except Exception:
                pass

    async def invoking(
        self,
        messages: ChatMessage | MutableSequence[ChatMessage],
        **kwargs: Any,
    ) -> Context:
        """Provide user information context before each agent call."""
        instructions: list[str] = []

        if self.user_info.name is None:
            instructions.append(
                "Ask the user for their name and politely decline to answer any "
                "questions until they provide it."
            )
        else:
            instructions.append(f"The user's name is {self.user_info.name}.")

        if self.user_info.age is None:
            instructions.append(
                "Ask the user for their age and politely decline to answer any "
                "questions until they provide it."
            )
        else:
            instructions.append(f"The user's age is {self.user_info.age}.")

        return Context(instructions=" ".join(instructions))

    def serialize(self) -> str:
        """Serialize the user info for thread persistence."""
        return self.user_info.model_dump_json()
```

## Using Context Providers with an Agent

Pass the context provider instance when creating the agent. The agent will create and attach provider instances per thread.

```python
import asyncio
from agent_framework import ChatAgent
from agent_framework.azure import AzureAIAgentClient
from azure.identity.aio import AzureCliCredential


async def main():
    async with AzureCliCredential() as credential:
        chat_client = AzureAIAgentClient(credential=credential)
        memory_provider = UserInfoMemory(chat_client)

        async with ChatAgent(
            chat_client=chat_client,
            instructions="You are a friendly assistant. Always address the user by their name.",
            context_providers=memory_provider,
        ) as agent:
            thread = agent.get_new_thread()

            print(await agent.run("Hello, what is the square root of 9?", thread=thread))
            print(await agent.run("My name is Ruaidhrí", thread=thread))
            print(await agent.run("I am 20 years old", thread=thread))

            if thread.context_provider:
                user_info_memory = thread.context_provider.providers[0]
                if isinstance(user_info_memory, UserInfoMemory):
                    print(f"MEMORY - User Name: {user_info_memory.user_info.name}")
                    print(f"MEMORY - User Age: {user_info_memory.user_info.age}")


if __name__ == "__main__":
    asyncio.run(main())
```

## Mem0Provider for Long-Term Memory

Mem0 is an external memory service that provides semantic memory storage and retrieval. Use `Mem0Provider` from `agent_framework.mem0` to integrate long-term memory:

```python
from agent_framework.mem0 import Mem0Provider
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIChatClient


memory_provider = Mem0Provider(
    api_key="your-mem0-api-key",
    user_id="user_123",
    application_id="my_app"
)

agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful assistant with memory.",
    context_providers=memory_provider
)
```

### Mem0Provider Parameters

| Parameter | Description |
|-----------|-------------|
| `api_key` | Mem0 API key for authentication. |
| `user_id` | User identifier to scope memories per user. |
| `application_id` | Application identifier to scope memories per application. |

Mem0 handles memory extraction and injection automatically. Memories are stored remotely and retrieved based on relevance to the current conversation.

## Context Object

The `Context` object returned from `invoking` supports:

| Field | Description |
|-------|-------------|
| `instructions` | Additional system instructions merged with the agent’s instructions. |
| `messages` | Additional messages to prepend to the conversation. |
| `tools` | Additional tools to make available for this invocation. |

Return an empty `Context()` if no additional context is needed.

```python
return Context(instructions="User prefers metric units.")
return Context(messages=[ChatMessage(role=Role.USER, text="Reminder: use Celsius")])
return Context()
```

## Serialization for Persistence

Context providers may hold state that must persist across thread serialization (e.g., extracted memories). Implement `serialize()` to return a representation of that state. The framework passes serialized state back when deserializing the thread so the provider can restore itself.

For `UserInfoMemory`, `serialize()` returns JSON from the `UserInfo` model:

```python
def serialize(self) -> str:
    return self.user_info.model_dump_json()
```

The framework will call this when `thread.serialize()` is invoked. When `agent.deserialize_thread()` is called, the agent reconstructs the context provider and restores its state from the serialized data. Ensure the provider’s constructor or a dedicated deserialization path can accept the serialized format.

## Long-Term Memory Patterns

### Pattern 1: In-Thread State

Store state in the context provider instance. It lives as long as the thread and is serialized with the thread.

- **Use when**: State is scoped to a single conversation or user session.
- **Example**: User preferences extracted during the conversation.

### Pattern 2: External Store

Context provider reads from and writes to an external store (database, Redis, vector store) keyed by user or thread ID.

- **Use when**: State must persist across threads or applications.
- **Example**: User profile, cross-session preferences.

### Pattern 3: Mem0 or Similar Service

Use Mem0Provider or another memory service for semantic storage and retrieval.

- **Use when**: Need semantic search over memories, automatic summarization, or managed memory lifecycle.
- **Example**: Knowledge bases, user fact recall across many conversations.

### Pattern 4: Hybrid

Combine in-thread state for short-term context with an external store or Mem0 for long-term facts.

```python
class HybridMemory(ContextProvider):
    def __init__(self, chat_client: ChatClientProtocol, db: Database) -> None:
        self._chat_client = chat_client
        self._db = db
        self._session_facts: list[str] = []

    async def invoked(self, request_messages, response_messages, invoke_exception, **kwargs):
        # Extract facts, store in _session_facts and optionally in _db
        pass

    async def invoking(self, messages, **kwargs) -> Context:
        # Merge session facts with DB facts
        db_facts = await self._db.get_facts(user_id=...)
        all_facts = self._session_facts + db_facts
        return Context(instructions=f"Known facts: {'; '.join(all_facts)}")
```

## Background Responses

Background responses allow agents to handle long-running operations by returning a continuation token instead of the final result. The client can poll for completion (non-streaming) or resume an interrupted stream (streaming) using the token.

**Note**: Background responses may not be available in the Python SDK yet (check release notes for current status). This feature is available in the .NET implementation. When it ships in Python, expect:

- An `AllowBackgroundResponses` (or equivalent) option in run options.
- A `continuation_token` on responses and stream updates.
- Support for polling with the token and resuming streams.

For now, long-running operations should use standard `run` or `run_stream` and handle timeouts or partial results at the application level.

## Best Practices

1. **Keep `invoking` fast**: It runs before every agent call. Avoid heavy I/O or LLM calls unless necessary.
2. **Handle errors in `invoked`**: Check `invoke_exception` and avoid updating state when the agent run failed.
3. **Idempotent extraction**: Extraction in `invoked` should be robust to duplicate or partial messages.
4. **Scope memories**: Use `user_id` or `thread_id` to scope memories so different users do not share state.
5. **Serialize fully**: Include all state needed to restore the provider in `serialize()`.

## Summary

| Task | Approach |
|------|----------|
| Add context before each call | Implement `invoking`, return `Context`. |
| Extract info after each call | Implement `invoked`, update internal state. |
| Use Mem0 | Use `Mem0Provider` with `api_key`, `user_id`, `application_id`. |
| Persist provider state | Implement `serialize()`. |
| Access provider from thread | Use `thread.context_provider.providers[N]` and cast to your type. |
