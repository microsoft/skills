# Function Tools Reference

This reference provides detailed guidance for implementing function tools with Microsoft Agent Framework Python, including the `@ai_function` decorator, approval mode, and the WeatherTools class pattern.

## Overview

Function tools are Python functions or methods that the agent can invoke during a run. They execute in-process and are ideal for domain logic, API integration, and custom behaviors. The framework infers tool schemas from type annotations and docstrings.

## Basic Function Tool

Define a function with type annotations and a docstring. Use `Annotated` with Pydantic's `Field` for parameter descriptions:

```python
from typing import Annotated
from pydantic import Field

def get_weather(
    location: Annotated[str, Field(description="The location to get the weather for.")],
) -> str:
    """Get the weather for a given location."""
    return f"The weather in {location} is cloudy with a high of 15°C."

# Pass to agent at construction
agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful assistant",
    tools=[get_weather]
)

result = await agent.run("What's the weather like in Amsterdam?")
```

The agent infers the tool name from the function name and the description from the docstring. Parameter descriptions come from `Field(description="...")`.

## @ai_function Decorator

Use the `@ai_function` decorator to explicitly set the tool name, description, and approval behavior:

```python
from agent_framework import ai_function

@ai_function(name="weather_tool", description="Retrieves weather information for any location")
def get_weather(
    location: Annotated[str, Field(description="The location to get the weather for.")],
) -> str:
    return f"The weather in {location} is cloudy with a high of 15°C."
```

**Decorator parameters:**

- **`name`** – Tool name exposed to the model. Default: function name.
- **`description`** – Tool description for the model. Default: function docstring.
- **`approval_mode`** – `"never_require"` (default) or `"always_require"` for human-in-the-loop approval.

If `name` and `description` are omitted, the framework uses the function name and docstring.

## Approval Mode (Human-in-the-Loop)

Set `approval_mode="always_require"` so the agent does not execute the tool until the user approves:

```python
@ai_function(approval_mode="always_require")
def get_weather_detail(location: Annotated[str, "The city and state, e.g. San Francisco, CA"]) -> str:
    """Get detailed weather information for a given location."""
    return f"The weather in {location} is cloudy with a high of 15°C, humidity 88%."
```

When the agent requests a tool that requires approval, the response includes `user_input_requests`. Handle them and pass the user's decision back:

```python
result = await agent.run("What is the detailed weather like in Amsterdam?")

if result.user_input_requests:
    for user_input_needed in result.user_input_requests:
        print(f"Function: {user_input_needed.function_call.name}")
        print(f"Arguments: {user_input_needed.function_call.arguments}")
        # Present to user, get approval
        user_approval = True  # or False to reject

        approval_message = ChatMessage(
            role=Role.USER,
            contents=[user_input_needed.create_response(user_approval)]
        )

        final_result = await agent.run([
            "What is the detailed weather like in Amsterdam?",
            ChatMessage(role=Role.ASSISTANT, contents=[user_input_needed]),
            approval_message
        ])
        print(final_result.text)
```

Use a loop when multiple approval requests may occur until `result.user_input_requests` is empty.

## WeatherTools Class Pattern

Group related tools in a class and pass methods as tools. Useful for shared state and organization:

```python
from typing import Annotated
from pydantic import Field

class WeatherTools:
    def __init__(self):
        self.last_location = None

    def get_weather(
        self,
        location: Annotated[str, Field(description="The location to get the weather for.")],
    ) -> str:
        """Get the weather for a given location."""
        self.last_location = location
        return f"The weather in {location} is cloudy with a high of 15°C."

    def get_weather_details(self) -> str:
        """Get the detailed weather for the last requested location."""
        if self.last_location is None:
            return "No location specified yet."
        return f"The detailed weather in {self.last_location} is cloudy with a high of 15°C, low of 7°C, and 60% humidity."

# Create instance and pass methods
tools_instance = WeatherTools()
agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful assistant",
    tools=[tools_instance.get_weather, tools_instance.get_weather_details]
)
```

Methods can use `@ai_function` for custom names and descriptions.

## Per-Run Tools

Provide tools for specific runs without adding them at construction:

```python
agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful assistant"
)

# Tool only for this run
result1 = await agent.run("What's the weather in Seattle?", tools=[get_weather])

# Different tool for different run
result2 = await agent.run("What's the current time?", tools=[get_time])

# Multiple tools for one run
result3 = await agent.run(
    "What's the weather and time in Chicago?",
    tools=[get_weather, get_time]
)
```

Per-run tools combine with agent-level tools; run-level tools take precedence when names collide. Both `run()` and `run_stream()` accept a `tools` parameter.

## Streaming with Tools

```python
async for update in agent.run_stream(
    "Tell me about the weather",
    tools=[get_weather]
):
    if update.text:
        print(update.text, end="", flush=True)
```

## Combining Agent-Level and Run-Level Tools

```python
agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful assistant",
    tools=[get_time]
)

# get_time (agent-level) and get_weather (run-level) both available
result = await agent.run(
    "What's the weather and time in New York?",
    tools=[get_weather]
)
```

## Type Annotations

Use `Annotated` for parameter metadata. `Field` supports:

- **`description`** – Shown to the model
- **`default`** – Optional parameters
- **`examples`** – Example values when applicable

```python
def search_articles(
    query: Annotated[str, Field(description="The search query.")],
    top: Annotated[int, Field(description="Number of results.", default=5)] = 5,
) -> str:
    """Search support articles."""
    # ...
```

## Async Function Tools

Async functions work as tools:

```python
async def fetch_external_data(
    resource_id: Annotated[str, Field(description="The resource identifier.")],
) -> str:
    """Fetch data from an external API."""
    async with aiohttp.ClientSession() as session:
        async with session.get(f"https://api.example.com/{resource_id}") as resp:
            return await resp.text()
```

## Best Practices

1. **Descriptions** – Use clear docstrings and `Field(description=...)` so the model chooses the right tool.
2. **Approval for sensitive tools** – Use `approval_mode="always_require"` for actions with external effects.
3. **Group related tools** – Use a class like WeatherTools when tools share state or domain.
4. **Per-run tools** – Use run-level tools for capabilities that vary by request.
5. **Validation** – Use Pydantic models for complex parameters when needed.
