# Middleware Patterns - Microsoft Agent Framework Python

This reference covers all three middleware types in Microsoft Agent Framework Python: agent run, function invocation, and chat middleware. It details context objects, decorators, class-based middleware, termination, result overrides, run-level middleware, and factory patterns.

## Table of Contents

- [Agent Run Middleware](#agent-run-middleware)
- [Function Middleware](#function-middleware)
- [Chat Middleware](#chat-middleware)
- [Agent-Level vs Run-Level Middleware](#agent-level-vs-run-level-middleware)
- [Factory Patterns](#factory-patterns)
- [Combining Middleware Types](#combining-middleware-types)
- [Summary](#summary)

---

## Agent Run Middleware

Agent run middleware intercepts each agent invocation. It receives an `AgentRunContext` and a `next` callable. Call `await next(context)` to continue; optionally modify `context.result` afterward or set `context.terminate = True` to stop execution.

### AgentRunContext

| Attribute | Description |
|-----------|-------------|
| `agent` | The agent being invoked |
| `messages` | List of chat messages in the conversation |
| `is_streaming` | Boolean indicating if the response is streaming |
| `metadata` | Dictionary for storing data between middleware |
| `result` | The agent's response (can be modified after `next`) |
| `terminate` | Flag to stop further processing when set to `True` |
| `kwargs` | Additional keyword arguments passed to `agent.run()` |

### Function-Based Agent Middleware

```python
from typing import Awaitable, Callable
from agent_framework import AgentRunContext

async def logging_agent_middleware(
    context: AgentRunContext,
    next: Callable[[AgentRunContext], Awaitable[None]],
) -> None:
    """Agent middleware that logs execution timing."""
    print("[Agent] Starting execution")

    await next(context)

    print("[Agent] Execution completed")
```

### Decorator-Based Agent Middleware

Use `@agent_middleware` when type annotations are not used or when explicit middleware type declaration is needed:

```python
from agent_framework import agent_middleware

@agent_middleware
async def simple_agent_middleware(context, next):
    """Agent middleware with decorator - types are inferred."""
    print("Before agent execution")
    await next(context)
    print("After agent execution")
```

### Class-Based Agent Middleware

Implement `AgentMiddleware` and override `process`:

```python
from agent_framework import AgentMiddleware, AgentRunContext
from typing import Awaitable, Callable

class LoggingAgentMiddleware(AgentMiddleware):
    """Agent middleware that logs execution."""

    async def process(
        self,
        context: AgentRunContext,
        next: Callable[[AgentRunContext], Awaitable[None]],
    ) -> None:
        print("[Agent Class] Starting execution")
        await next(context)
        print("[Agent Class] Execution completed")
```

### Agent Middleware with Termination

Use `context.terminate = True` to block execution for security or validation failures:

```python
async def blocking_middleware(
    context: AgentRunContext,
    next: Callable[[AgentRunContext], Awaitable[None]],
) -> None:
    last_message = context.messages[-1] if context.messages else None
    if last_message and last_message.text:
        if "blocked" in last_message.text.lower():
            print("Request blocked by middleware")
            context.terminate = True
            return

    await next(context)
```

### Agent Middleware Result Override

Modify `context.result` after `next`. Handle both non-streaming and streaming:

```python
from agent_framework import AgentResponse, AgentResponseUpdate, ChatMessage, Role, TextContent

async def weather_override_middleware(
    context: AgentRunContext,
    next: Callable[[AgentRunContext], Awaitable[None]],
) -> None:
    await next(context)

    if context.result is not None:
        custom_message_parts = [
            "Weather Override: ",
            "Perfect weather everywhere today! ",
            "22°C with gentle breezes.",
        ]

        if context.is_streaming:
            async def override_stream():
                for chunk in custom_message_parts:
                    yield AgentResponseUpdate(contents=[TextContent(text=chunk)])

            context.result = override_stream()
        else:
            custom_message = "".join(custom_message_parts)
            context.result = AgentResponse(
                messages=[ChatMessage(role=Role.ASSISTANT, text=custom_message)]
            )
```

### Registering Agent Middleware

**Agent-level (all runs):**

```python
from agent_framework.azure import AzureAIAgentClient
from azure.identity.aio import AzureCliCredential

async with AzureAIAgentClient(async_credential=credential).as_agent(
    name="GreetingAgent",
    instructions="You are a friendly greeting assistant.",
    middleware=logging_agent_middleware,
) as agent:
    result = await agent.run("Hello!")
```

**Run-level (single run):**

```python
result = await agent.run(
    "This is important!",
    middleware=[logging_agent_middleware]
)
```

---

## Function Middleware

Function middleware intercepts function tool invocations. It uses `FunctionInvocationContext`. Call `await next(context)` to continue; modify `context.result` before returning or set `context.terminate = True` to stop.

### FunctionInvocationContext

| Attribute | Description |
|-----------|-------------|
| `function` | The function being invoked |
| `arguments` | The validated arguments for the function |
| `metadata` | Dictionary for storing data between middleware |
| `result` | The function's return value (can be modified) |
| `terminate` | Flag to stop further processing |
| `kwargs` | Additional keyword arguments from the chat method |

### Function-Based Function Middleware

```python
from agent_framework import FunctionInvocationContext
from typing import Awaitable, Callable

async def logging_function_middleware(
    context: FunctionInvocationContext,
    next: Callable[[FunctionInvocationContext], Awaitable[None]],
) -> None:
    """Function middleware that logs function execution."""
    print(f"[Function] Calling {context.function.name}")

    await next(context)

    print(f"[Function] {context.function.name} completed, result: {context.result}")
```

### Decorator-Based Function Middleware

```python
from agent_framework import function_middleware

@function_middleware
async def simple_function_middleware(context, next):
    """Function middleware with decorator."""
    print(f"Calling function: {context.function.name}")
    await next(context)
    print("Function call completed")
```

### Class-Based Function Middleware

```python
from agent_framework import FunctionMiddleware, FunctionInvocationContext
from typing import Awaitable, Callable

class LoggingFunctionMiddleware(FunctionMiddleware):
    """Function middleware that logs function execution."""

    async def process(
        self,
        context: FunctionInvocationContext,
        next: Callable[[FunctionInvocationContext], Awaitable[None]],
    ) -> None:
        print(f"[Function Class] Calling {context.function.name}")
        await next(context)
        print(f"[Function Class] {context.function.name} completed")
```

### Function Middleware with Result Override

```python
# Assume get_from_cache() and set_cache() are user-defined
async def caching_function_middleware(
    context: FunctionInvocationContext,
    next: Callable[[FunctionInvocationContext], Awaitable[None]],
) -> None:
    cache_key = f"{context.function.name}:{hash(str(context.arguments))}"
    cached = get_from_cache(cache_key)
    if cached is not None:
        context.result = cached
        return

    await next(context)
    set_cache(cache_key, context.result)
```

### Function Middleware with Termination

Setting `context.terminate = True` in function middleware stops the function call loop. Remaining functions in that iteration may not execute. Use with caution: the thread may be left in an inconsistent state.

```python
async def rate_limit_function_middleware(
    context: FunctionInvocationContext,
    next: Callable[[FunctionInvocationContext], Awaitable[None]],
) -> None:
    if not check_rate_limit(context.function.name):
        context.result = "Rate limit exceeded. Try again later."
        context.terminate = True
        return

    await next(context)
```

---

## Chat Middleware

Chat middleware intercepts chat requests sent to the AI model (before and after inference). Use for inspecting or modifying prompts and responses at the chat client boundary.

### ChatContext

| Attribute | Description |
|-----------|-------------|
| `chat_client` | The chat client being invoked |
| `messages` | List of messages being sent to the AI service |
| `options` | The options for the chat request |
| `is_streaming` | Boolean indicating if this is a streaming invocation |
| `metadata` | Dictionary for storing data between middleware |
| `result` | The chat response from the AI (can be modified) |
| `terminate` | Flag to stop further processing |
| `kwargs` | Additional keyword arguments passed to the chat client |

### Function-Based Chat Middleware

```python
from agent_framework import ChatContext
from typing import Awaitable, Callable

async def logging_chat_middleware(
    context: ChatContext,
    next: Callable[[ChatContext], Awaitable[None]],
) -> None:
    """Chat middleware that logs AI interactions."""
    print(f"[Chat] Sending {len(context.messages)} messages to AI")

    await next(context)

    print("[Chat] AI response received")
```

### Decorator-Based Chat Middleware

```python
from agent_framework import chat_middleware

@chat_middleware
async def simple_chat_middleware(context, next):
    """Chat middleware with decorator."""
    print(f"Processing {len(context.messages)} chat messages")
    await next(context)
    print("Chat processing completed")
```

### Class-Based Chat Middleware

```python
from agent_framework import ChatMiddleware, ChatContext
from typing import Awaitable, Callable

class LoggingChatMiddleware(ChatMiddleware):
    """Chat middleware that logs AI interactions."""

    async def process(
        self,
        context: ChatContext,
        next: Callable[[ChatContext], Awaitable[None]],
    ) -> None:
        print(f"[Chat Class] Sending {len(context.messages)} messages to AI")
        await next(context)
        print("[Chat Class] AI response received")
```

---

## Agent-Level vs Run-Level Middleware

Middleware can be registered at two scopes:

| Scope | Where to Register | Applies To |
|-------|-------------------|------------|
| Agent-level | `middleware=[...]` when creating the agent | All runs of the agent |
| Run-level | `middleware=[...]` in `agent.run()` | Only that specific run |

Execution order: agent-level middleware (outermost) → run-level middleware (innermost) → agent execution.

```python
# Agent-level middleware: Applied to ALL runs
async with AzureAIAgentClient(async_credential=credential).as_agent(
    name="WeatherAgent",
    instructions="You are a helpful weather assistant.",
    tools=get_weather,
    middleware=[
        SecurityAgentMiddleware(),
        TimingFunctionMiddleware(),
    ],
) as agent:

    # Uses agent-level middleware only
    result1 = await agent.run("What's the weather in Seattle?")

    # Uses agent-level + run-level middleware
    result2 = await agent.run(
        "What's the weather in Portland?",
        middleware=[logging_chat_middleware]
    )

    # Uses agent-level middleware only
    result3 = await agent.run("What's the weather in Vancouver?")
```

---

## Factory Patterns

When middleware requires configuration or dependencies, use factory functions or classes:

```python
def create_rate_limit_middleware(calls_per_minute: int):
    """Factory that returns middleware with configured rate limit."""
    async def rate_limit_middleware(
        context: AgentRunContext,
        next: Callable[[AgentRunContext], Awaitable[None]],
    ) -> None:
        if not check_rate_limit(calls_per_minute):
            context.terminate = True
            context.result = AgentResponse(messages=[ChatMessage(role=Role.ASSISTANT, text="Rate limited.")])
            return
        await next(context)

    return rate_limit_middleware

# Usage
middleware = create_rate_limit_middleware(calls_per_minute=60)
agent = ChatAgent(..., middleware=[middleware])
```

Or use a configurable class:

```python
class ConfigurableAgentMiddleware(AgentMiddleware):
    def __init__(self, prefix: str = "[Middleware]"):
        self.prefix = prefix

    async def process(
        self,
        context: AgentRunContext,
        next: Callable[[AgentRunContext], Awaitable[None]],
    ) -> None:
        print(f"{self.prefix} Starting")
        await next(context)
        print(f"{self.prefix} Completed")

# Usage
agent = ChatAgent(..., middleware=[ConfigurableAgentMiddleware(prefix="[Custom]")])
```

---

## Combining Middleware Types

Register multiple middleware types on the same agent:

```python
async with AzureAIAgentClient(async_credential=credential).as_agent(
    name="TimeAgent",
    instructions="You can tell the current time.",
    tools=[get_time],
    middleware=[
        logging_agent_middleware,    # Agent run
        logging_function_middleware, # Function
        logging_chat_middleware,     # Chat
    ],
) as agent:
    result = await agent.run("What time is it?")
```

Order of middleware in the list defines the chain. The first middleware is the outermost layer.

---

## Summary

| Middleware Type | Context | Use For |
|-----------------|---------|---------|
| Agent run | `AgentRunContext` | Logging runs, timing, security, response transformation |
| Function | `FunctionInvocationContext` | Logging function calls, argument validation, result caching |
| Chat | `ChatContext` | Inspecting/modifying prompts and chat responses |

Use `@agent_middleware`, `@function_middleware`, or `@chat_middleware` decorators for explicit type declaration. Use `AgentMiddleware`, `FunctionMiddleware`, or `ChatMiddleware` base classes for stateful or configurable middleware. Set `context.terminate = True` to stop execution; modify `context.result` after `await next(context)` to override outputs.
