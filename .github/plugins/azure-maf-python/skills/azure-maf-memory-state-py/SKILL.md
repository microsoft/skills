---
name: azure-maf-memory-state-py
description: This skill should be used when the user asks about "chat history", "memory", "conversation storage", "Redis store", "thread serialization", "context provider", "Mem0", "multi-turn conversation", "persist conversation", "ChatMessageStore", or needs guidance on conversation persistence, chat history management, or long-term memory patterns in Microsoft Agent Framework Python. Make sure to use this skill whenever the user mentions saving conversation state, resuming conversations across sessions, custom message stores, remembering user preferences, injecting context before agent calls, AgentThread serialization, chat history reduction, or any form of agent memory or conversation persistence, even if they don't explicitly say "memory" or "chat history".
version: 0.1.0
---

# MAF Memory and State - Python Reference

This skill provides guidance for conversation persistence, chat history storage, and long-term memory in Microsoft Agent Framework (MAF) Python. Use this skill when implementing multi-turn conversations, persisting thread state across sessions, or integrating external memory services.

## Memory Architecture Overview

The Agent Framework supports several memory types to accommodate different use cases:

1. **In-memory storage (default)** – Conversation history stored in memory during application runtime. No additional configuration required.
2. **Persistent message stores** – `ChatMessageStore` implementations that persist across sessions (e.g., Redis, custom databases).
3. **Context providers** – Components that inject dynamic context before each agent invocation, enabling long-term memory and user preference recall.

Agents are stateless. All conversation and thread state live in `AgentThread` objects. The same agent instance can serve multiple threads concurrently.

## Thread Lifecycle

Obtain a new thread by calling `agent.get_new_thread()`. Run the agent with the thread to maintain context:

```python
thread = agent.get_new_thread()
response = await agent.run("My name is Alice", thread=thread)
response = await agent.run("What's my name?", thread=thread)  # Remembers Alice
```

Alternatively, omit the thread to create a throwaway thread for a single run. For services that require in-service storage, the underlying service may create persistent threads or response chains; cleanup is the caller's responsibility.

## Storage Options Comparison

| Storage Type | Use Case | Persistence | Custom Store Support |
|--------------|----------|-------------|------------------------|
| In-memory (default) | Development, single-session | No | N/A |
| Redis | Production, multi-session | Yes | Use `RedisChatMessageStore` |
| Custom backend | Database, vector store, etc. | Yes | Implement `ChatMessageStoreProtocol` |
| Service-stored | Foundry, Responses, Assistants | In-service | No (service manages history) |

When using OpenAI ChatCompletion or similar services without in-service storage, the framework defaults to in-memory storage. Provide `chat_message_store_factory` to use persistent or custom stores instead.

## Key Classes and Roles

| Class / Protocol | Role |
|------------------|------|
| `AgentThread` | Holds conversation state, message store reference, and context provider state. Supports `serialize()` and deserialization via agent. |
| `ChatMessageStoreProtocol` | Protocol for message storage. Implement `add_messages`, `list_messages`, `serialize`, and `update_from_state` (or the equivalent methods required by your installed SDK version). |
| `RedisChatMessageStore` | Built-in Redis-backed store. Use for production persistence. |
| `chat_message_store_factory` | Factory callable passed to `ChatAgent`. Returns a new store instance per thread. |
| `ContextProvider` | Provides dynamic context before each invocation and extracts information after. Used for long-term memory. |
| `Mem0Provider` | External memory service integration (Mem0) for advanced long-term memory. |

## Thread Serialization and Persistence

Serialize the entire thread state to persist across application restarts or sessions:

```python
serialized_thread = await thread.serialize()
# Store: json.dump(serialized_thread, f) or save to database
```

Restore a thread using the same agent that created it:

```python
restored_thread = await agent.deserialize_thread(loaded_data)
await agent.run("What did we talk about?", thread=restored_thread)
```

Serialization captures the full thread state, including message store references and context provider state. Deserialize with the same agent type and configuration to avoid errors or unexpected behavior.

## Multi-Turn Conversation Pattern

For in-memory or custom store threads, maintain context by passing the same thread across runs:

```python
async with ChatAgent(...) as agent:
    thread = agent.get_new_thread()
    r1 = await agent.run("My name is Alice", thread=thread)
    r2 = await agent.run("What's my name?", thread=thread)
    serialized = await thread.serialize()
    # Later:
    new_thread = await agent.deserialize_thread(serialized)
    r3 = await agent.run("What did we discuss?", thread=new_thread)
```

## Context Provider and Long-Term Memory

Use `ContextProvider` to inject memories or user preferences before each invocation and to extract new information after each run. Attach via `context_providers` when creating the agent:

```python
agent = ChatAgent(
    chat_client=...,
    instructions="You are a helpful assistant with memory.",
    context_providers=memory_provider
)
```

For Mem0 integration, use `Mem0Provider` from `agent_framework.mem0` with `user_id` and `application_id` for scoped long-term memory.

## Important Notes

- **Background responses**: Continuation tokens and stream resumption may not be available in the Python SDK yet. Check release notes for current availability.
- **Thread-agent compatibility**: Do not use a thread created by one agent with a different agent. Thread formats vary by agent type and service.
- **Message order**: Custom stores must return messages from `list_messages` in ascending chronological order (oldest first).
- **Context limits**: When implementing custom stores, ensure returned message count does not exceed the model's context window. Apply summarization or trimming in the store if needed.
- **History reduction**: Prefer explicit reducer/trimming strategies for long threads (for example, message counting or summarization) to stay within model context limits.

## Additional Resources

### Reference Files

For detailed patterns and implementations:

- **`references/chat-history-storage.md`** – `ChatMessageStore` protocol, `RedisChatMessageStore` setup, custom store implementation, `chat_message_store_factory` pattern, `thread.serialize()` / `agent.deserialize_thread()`, multi-turn conversation patterns
- **`references/context-providers.md`** – `ContextProvider`, `Mem0Provider` for long-term memory, creating custom context providers, serialization for persistence
- **`references/acceptance-criteria.md`** – Correct vs incorrect patterns for thread lifecycle, store factories, custom stores, Redis, serialization, context providers, Mem0, and service-specific storage

### Provider and Version Caveats

- Chat store protocol method names can differ across SDK versions; verify against your installed package docs.
- Background/continuation capabilities may roll out incrementally across providers in Python.
