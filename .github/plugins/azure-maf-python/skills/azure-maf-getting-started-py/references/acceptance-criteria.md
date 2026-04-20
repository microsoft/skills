# Acceptance Criteria — maf-getting-started-py

Patterns and anti-patterns to validate code generated using this skill.

---

## 1. Installation Commands

#### CORRECT: Full framework install

```bash
pip install agent-framework --pre
```

#### CORRECT: Minimal install (core only)

```bash
pip install agent-framework-core --pre
```

#### CORRECT: Azure AI Foundry provider

```bash
pip install agent-framework-azure-ai --pre
```

#### INCORRECT: Missing `--pre` flag

```bash
pip install agent-framework          # Wrong — packages are pre-release and require --pre
pip install agent-framework-core     # Wrong — same reason
```

#### INCORRECT: Wrong package name

```bash
pip install microsoft-agent-framework --pre   # Wrong — not the real package name
pip install agent_framework --pre             # Wrong — hyphen not underscore
```

---

## 2. Import Paths

#### CORRECT: OpenAI provider import

```python
from agent_framework.openai import OpenAIChatClient
```

#### CORRECT: Azure OpenAI provider import (sync credential)

```python
from agent_framework.azure import AzureOpenAIChatClient
from azure.identity import AzureCliCredential
```

#### CORRECT: Azure AI Foundry provider import (async credential)

```python
from agent_framework.azure import AzureAIClient
from azure.identity.aio import AzureCliCredential
```

#### CORRECT: Message and content type imports

```python
from agent_framework import ChatMessage, TextContent, UriContent, DataContent, Role
```

#### INCORRECT: Wrong module path

```python
from agent_framework.openai_chat import OpenAIChatClient    # Wrong module
from agent_framework.azure_openai import AzureOpenAIChatClient  # Wrong module
from agent_framework import OpenAIChatClient                 # Wrong — providers are submodules
```

---

## 3. Agent Creation

#### CORRECT: OpenAI agent via as_agent()

```python
agent = OpenAIChatClient().as_agent(
    instructions="You are a helpful assistant."
)
```

#### CORRECT: OpenAI agent with explicit model and API key

```python
agent = OpenAIChatClient(
    ai_model_id="gpt-4o-mini",
    api_key="your-api-key",
).as_agent(instructions="You are helpful.")
```

#### CORRECT: Azure AI Foundry agent with async context manager

```python
async with (
    AzureCliCredential() as credential,
    AzureAIClient(async_credential=credential).as_agent(
        instructions="You are helpful."
    ) as agent,
):
    result = await agent.run("Hello")
```

#### CORRECT: Azure OpenAI agent with sync credential

```python
agent = AzureOpenAIChatClient(
    credential=AzureCliCredential(),
).as_agent(instructions="You are helpful.")
```

#### CORRECT: ChatAgent constructor

```python
from agent_framework import ChatAgent

agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    instructions="You are helpful.",
    tools=[my_function],
)
```

#### INCORRECT: Missing async context manager for Azure AI Foundry

```python
credential = AzureCliCredential()
agent = AzureAIClient(async_credential=credential).as_agent(
    instructions="You are helpful."
)
# Wrong — AzureCliCredential (aio) and AzureAIClient require async with
```

#### INCORRECT: Wrong credential type for Azure AI Foundry

```python
from azure.identity import AzureCliCredential  # Wrong — sync credential
agent = AzureAIClient(async_credential=AzureCliCredential())  # Needs azure.identity.aio
```

---

## 4. Credential Patterns

#### CORRECT: Async credential for Azure AI Foundry

```python
from azure.identity.aio import AzureCliCredential

async with AzureCliCredential() as credential:
    # Use with AzureAIClient or AzureAIAgentClient
```

#### CORRECT: Sync credential for Azure OpenAI

```python
from azure.identity import AzureCliCredential

agent = AzureOpenAIChatClient(
    credential=AzureCliCredential(),
).as_agent(instructions="You are helpful.")
```

#### INCORRECT: Mixing sync/async credential

```python
from azure.identity import AzureCliCredential  # Sync
AzureAIClient(async_credential=AzureCliCredential())  # Wrong — needs aio variant
```

---

## 5. Running Agents

#### CORRECT: Non-streaming

```python
result = await agent.run("What is 2+2?")
print(result.text)
```

#### CORRECT: Streaming

```python
async for chunk in agent.run_stream("Tell me a story"):
    if chunk.text:
        print(chunk.text, end="", flush=True)
```

#### CORRECT: With thread for multi-turn

```python
thread = agent.get_new_thread()
r1 = await agent.run("My name is Alice", thread=thread)
r2 = await agent.run("What's my name?", thread=thread)
```

#### INCORRECT: Forgetting async

```python
result = agent.run("Hello")      # Wrong — run() is async, must use await
for chunk in agent.run_stream():  # Wrong — run_stream() is async generator
```

#### INCORRECT: Expecting thread to persist without passing it

```python
r1 = await agent.run("My name is Alice")
r2 = await agent.run("What's my name?")  # Wrong — no thread, context is lost
```

---

## 6. Thread Serialization

#### CORRECT: Serialize and deserialize

```python
serialized = await thread.serialize()
restored = await agent.deserialize_thread(serialized)
r = await agent.run("Continue our chat", thread=restored)
```

#### INCORRECT: Synchronous serialize

```python
serialized = thread.serialize()  # Wrong — serialize() is async, must await
```

---

## 7. Multimodal Input

#### CORRECT: Image via URI with Role enum and media_type

```python
from agent_framework import ChatMessage, TextContent, UriContent, Role

messages = [
    ChatMessage(role=Role.USER, contents=[
        TextContent(text="What is in this image?"),
        UriContent(uri="https://example.com/photo.jpg", media_type="image/jpeg"),
    ])
]
result = await agent.run(messages, thread=thread)
```

#### INCORRECT: Missing Role import / using string role

```python
ChatMessage(role="user", contents=[...])  # Acceptable but prefer Role.USER enum
```

#### INCORRECT: Wrong content type for binary data

```python
UriContent(uri=base64_string)  # Wrong — use DataContent for inline binary data
```

---

## 8. Environment Variables

#### CORRECT: OpenAI

```bash
export OPENAI_API_KEY="your-api-key"
export OPENAI_CHAT_MODEL_ID="gpt-4o-mini"
```

#### CORRECT: Azure OpenAI

```bash
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
export AZURE_OPENAI_CHAT_DEPLOYMENT_NAME="gpt-4o-mini"
```

#### CORRECT: Azure AI Foundry (full endpoint path)

```bash
export AZURE_AI_PROJECT_ENDPOINT="https://<your-project>.services.ai.azure.com/api/projects/<project-id>"
export AZURE_AI_MODEL_DEPLOYMENT_NAME="gpt-4o-mini"
```

#### INCORRECT: Azure AI Foundry endpoint missing path

```bash
export AZURE_AI_PROJECT_ENDPOINT="https://your-project.services.ai.azure.com/"
# Wrong — must include /api/projects/<project-id>
```

---

## 9. asyncio.run Pattern

#### CORRECT: Entry point

```python
import asyncio

async def main():
    agent = OpenAIChatClient().as_agent(instructions="You are helpful.")
    result = await agent.run("Hello")
    print(result.text)

asyncio.run(main())
```

#### INCORRECT: Missing asyncio.run

```python
async def main():
    result = await agent.run("Hello")
    print(result.text)

main()  # Wrong — coroutine is never awaited
```

---

## 10. Run Options

#### CORRECT: Provider-specific options

```python
from agent_framework.openai import OpenAIChatOptions

result = await agent.run(
    "Hello",
    options={"temperature": 0.7, "max_tokens": 500, "model_id": "gpt-4o"},
)
```

#### INCORRECT: Passing tools/instructions via options

```python
result = await agent.run(
    "Hello",
    options={"tools": [my_tool], "instructions": "Be brief"},  # Wrong — these are keyword args, not options
)
```

#### CORRECT: Tools and instructions as keyword args

```python
result = await agent.run(
    "Hello",
    tools=[my_tool],  # Keyword arg, not in options dict
)
```

---

## 11. Async Variants

#### CORRECT: Non-streaming (async)

```python
import asyncio

async def main():
    agent = OpenAIChatClient().as_agent(instructions="You are helpful.")
    result = await agent.run("What is 2+2?")
    print(result.text)

asyncio.run(main())
```

#### CORRECT: Streaming (async generator)

```python
async def main():
    agent = OpenAIChatClient().as_agent(instructions="You are helpful.")
    async for chunk in agent.run_stream("Tell me a story"):
        if chunk.text:
            print(chunk.text, end="", flush=True)

asyncio.run(main())
```

#### CORRECT: Azure AI Foundry with async context manager

```python
from agent_framework.azure import AzureAIClient
from azure.identity.aio import AzureCliCredential

async def main():
    async with (
        AzureCliCredential() as credential,
        AzureAIClient(async_credential=credential).as_agent(
            instructions="You are helpful."
        ) as agent,
    ):
        result = await agent.run("Hello")
        print(result.text)

asyncio.run(main())
```

#### INCORRECT: Synchronous usage

```python
result = agent.run("Hello")               # Wrong — run() is async, must await
for chunk in agent.run_stream("Hello"):   # Wrong — run_stream() is async generator
    print(chunk)
```

#### INCORRECT: Missing asyncio.run

```python
async def main():
    result = await agent.run("Hello")

main()  # Wrong — coroutine is never awaited; use asyncio.run(main())
```

#### Key Rules

- `agent.run()` must be awaited — returns `AgentResponse`.
- `agent.run_stream()` must be used with `async for` — yields `AgentResponseUpdate`.
- `thread.serialize()` and `agent.deserialize_thread()` are async.
- Azure AI Foundry and OpenAI Assistants agents require `async with` for lifecycle.
- Azure OpenAI ChatCompletion agents do NOT require `async with`.
- Always wrap async entry points in `asyncio.run(main())`.

