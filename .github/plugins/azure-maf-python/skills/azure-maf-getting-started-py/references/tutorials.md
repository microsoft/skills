# Hands-on Tutorials - Python

Step-by-step tutorials for common Microsoft Agent Framework tasks in Python.

## Tutorial 1: Create and Run an Agent

### Goal

Create a basic agent and run it with a single prompt.

### Prerequisites

```bash
pip install agent-framework --pre
```

Set environment variables for your provider (see `quick-start.md` for details).

### Steps

**1. Create the agent:**

```python
import asyncio
from agent_framework.azure import AzureAIClient
from azure.identity.aio import AzureCliCredential

async def main():
    async with (
        AzureCliCredential() as credential,
        AzureAIClient(async_credential=credential).as_agent(
            instructions="You are good at telling jokes.",
            name="Joker",
        ) as agent,
    ):
        # Non-streaming
        result = await agent.run("Tell me a joke about a pirate.")
        print(result.text)

asyncio.run(main())
```

**2. Add streaming:**

```python
        # Streaming
        async for chunk in agent.run_stream("Tell me another joke."):
            if chunk.text:
                print(chunk.text, end="", flush=True)
        print()
```

**3. Send multimodal input:**

```python
from agent_framework import ChatMessage, TextContent, UriContent, Role

messages = [
    ChatMessage(role=Role.USER, contents=[
        TextContent(text="What do you see in this image?"),
        UriContent(uri="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg", media_type="image/jpeg"),
    ])
]
result = await agent.run(messages)
print(result.text)
```

**4. Override instructions with system message:**

```python
messages = [
    ChatMessage(role=Role.SYSTEM, contents=[TextContent(text="Respond only in French.")]),
    ChatMessage(role=Role.USER, contents=[TextContent(text="What is the capital of Japan?")]),
]
result = await agent.run(messages)
print(result.text)
```

---

## Tutorial 2: Multi-Turn Conversations

### Goal

Maintain conversation context across multiple interactions using `AgentThread`.

### Steps

**1. Create a thread and run multiple turns:**

```python
import asyncio
from agent_framework.openai import OpenAIChatClient

async def main():
    agent = OpenAIChatClient().as_agent(
        instructions="You are a helpful assistant with good memory."
    )
    thread = agent.get_new_thread()

    # Turn 1
    r1 = await agent.run("My name is Alice and I live in Seattle.", thread=thread)
    print(f"Turn 1: {r1.text}")

    # Turn 2
    r2 = await agent.run("What's my name?", thread=thread)
    print(f"Turn 2: {r2.text}")  # Should say Alice

    # Turn 3
    r3 = await agent.run("Where do I live?", thread=thread)
    print(f"Turn 3: {r3.text}")  # Should say Seattle

asyncio.run(main())
```

**2. Multiple independent conversations:**

```python
    thread_a = agent.get_new_thread()
    thread_b = agent.get_new_thread()

    await agent.run("My name is Alice.", thread=thread_a)
    await agent.run("My name is Bob.", thread=thread_b)

    r_a = await agent.run("What's my name?", thread=thread_a)
    print(f"Thread A: {r_a.text}")  # Alice

    r_b = await agent.run("What's my name?", thread=thread_b)
    print(f"Thread B: {r_b.text}")  # Bob
```

**3. Serialize and resume a conversation:**

```python
import json

    # Serialize
    serialized = await thread.serialize()
    with open("conversation.json", "w") as f:
        json.dump(serialized, f)

    # Later: restore
    with open("conversation.json") as f:
        loaded = json.load(f)
    restored = await agent.deserialize_thread(loaded)

    r = await agent.run("Remind me what we discussed.", thread=restored)
    print(f"Restored: {r.text}")
```

---

## Tutorial 3: Add Function Tools

### Goal

Give the agent a custom tool it can call to perform actions.

### Steps

**1. Define a function tool:**

```python
from typing import Annotated
from pydantic import Field

def get_weather(
    location: Annotated[str, Field(description="City name")],
    unit: Annotated[str, Field(description="Temperature unit: celsius or fahrenheit")] = "celsius",
) -> str:
    """Get the current weather for a location."""
    return f"The weather in {location} is 22 degrees {unit}."
```

**2. Create an agent with tools:**

```python
agent = OpenAIChatClient().as_agent(
    instructions="You are a weather assistant. Use the get_weather tool when asked about weather.",
    tools=[get_weather],
)
```

**3. Run the agent -- it calls the tool automatically:**

```python
result = await agent.run("What's the weather in Paris?")
print(result.text)
# Agent calls get_weather("Paris", "celsius") internally
# and incorporates the result into its response
```

---

## Tutorial 4: Enable Observability

### Goal

Add OpenTelemetry tracing to see what the agent does internally.

### Steps

**1. Install and configure:**

```bash
pip install agent-framework --pre
```

```python
from agent_framework.observability import configure_otel_providers

configure_otel_providers(enable_console_exporters=True)
```

**2. Run the agent -- traces appear in console:**

```python
agent = OpenAIChatClient().as_agent(instructions="You are helpful.")
result = await agent.run("Hello!")
# Console shows spans: invoke_agent, chat, execute_tool (if tools used)
```

**3. For production, export to OTLP:**

```bash
export ENABLE_INSTRUMENTATION=true
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

```python
configure_otel_providers()  # Reads OTEL_EXPORTER_OTLP_* env vars
```

---

## Tutorial 5: Test with DevUI

### Goal

Use the DevUI web interface to interactively test an agent.

### Steps

**1. Install DevUI:**

```bash
pip install agent-framework-devui --pre
```

**2. Serve an agent:**

```python
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIChatClient
from agent_framework.devui import serve

agent = ChatAgent(
    name="MyAssistant",
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful assistant.",
)
serve(entities=[agent], auto_open=True)
```

**3. Or use the CLI with directory discovery:**

```bash
devui ./agents --port 8080
```

**4. Open the browser** at `http://localhost:8080` and chat with the agent interactively.
