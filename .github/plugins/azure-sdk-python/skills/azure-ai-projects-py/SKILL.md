---
name: azure-ai-projects-py
description: Build AI applications using the Azure AI Projects Python SDK (azure-ai-projects). Use when working with Foundry project clients, creating versioned agents with PromptAgentDefinition, running evaluations, managing connections/deployments/datasets/indexes, or using OpenAI-compatible clients. This is the high-level Foundry SDK - for low-level agent operations, use azure-ai-agents-python skill.
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-ai-projects
---

# Azure AI Projects Python SDK (Foundry SDK)

Build AI applications on Microsoft Foundry using the `azure-ai-projects` SDK.

## Installation

```bash
pip install azure-ai-projects azure-identity
```

## Environment Variables

```bash
AZURE_AI_PROJECT_ENDPOINT="https://<resource>.services.ai.azure.com/api/projects/<project>"  # Required for all auth methods
AZURE_AI_MODEL_DEPLOYMENT_NAME="gpt-4o-mini"  # Required for all auth methods
AZURE_TOKEN_CREDENTIALS=prod # Required only if DefaultAzureCredential is used in production
```

## Authentication & Lifecycle

> **🔑 Two rules apply to every code sample below:**
>
> 1. **Prefer `DefaultAzureCredential`.** It works locally (Azure CLI / VS Code / Developer CLI) and in Azure (managed identity, workload identity) with no code change. Avoid connection strings, account/API keys — they bypass Entra audit and rotation.
>    - Local dev: `DefaultAzureCredential` works as-is.
>    - Production: set `AZURE_TOKEN_CREDENTIALS=prod` (or `AZURE_TOKEN_CREDENTIALS=<specific_credential>`) to constrain the credential chain to production-safe credentials.
> 2. **Wrap every client in a context manager** so HTTP transports, sockets, and token caches are released deterministically:
>    - Sync: `with <Client>(...) as client:`
>    - Async: `async with <Client>(...) as client:` **and** `async with DefaultAzureCredential() as credential:` (from `azure.identity.aio`)
>
> Snippets may abbreviate this setup, but production code should always follow both rules.

```python
import os
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential
from azure.ai.projects import AIProjectClient

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential()
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()
with AIProjectClient(
    endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
    credential=credential,
) as client:
    deployments = list(client.deployments.list())
```

## Client Operations Overview

| Operation | Access | Purpose |
|-----------|--------|---------|
| `client.agents` | `.agents.*` | Agent CRUD, versions, threads, runs |
| `client.connections` | `.connections.*` | List/get project connections |
| `client.deployments` | `.deployments.*` | List model deployments |
| `client.datasets` | `.datasets.*` | Dataset management |
| `client.indexes` | `.indexes.*` | Index management |
| `client.evaluations` | `.evaluations.*` | Run evaluations |
| `client.red_teams` | `.red_teams.*` | Red team operations |

## Two Client Approaches

### 1. AIProjectClient (Native Foundry)

```python
from azure.ai.projects import AIProjectClient

with AIProjectClient(
    endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
) as client:
    # Use Foundry-native operations
    agent = client.agents.create_agent(
        model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
        name="my-agent",
        instructions="You are helpful.",
    )
```

### 2. OpenAI-Compatible Client

```python
# Get OpenAI-compatible client from project
openai_client = client.get_openai_client()

# Use standard OpenAI API
response = openai_client.chat.completions.create(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    messages=[{"role": "user", "content": "Hello!"}],
)
```

## Agent Operations

### Create Agent (Basic)

```python
agent = client.agents.create_agent(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    name="my-agent",
    instructions="You are a helpful assistant.",
)
```

### Create Agent with Tools

```python
from azure.ai.agents.models import CodeInterpreterTool, FileSearchTool

agent = client.agents.create_agent(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    name="tool-agent",
    instructions="You can execute code and search files.",
    tools=[CodeInterpreterTool(), FileSearchTool()],
)
```

### Versioned Agents with PromptAgentDefinition

```python
from azure.ai.projects.models import PromptAgentDefinition

# Create a versioned agent
agent_version = client.agents.create_version(
    agent_name="customer-support-agent",
    definition=PromptAgentDefinition(
        model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
        instructions="You are a customer support specialist.",
        tools=[],  # Add tools as needed
    ),
    version_label="v1.0",
)
```

See [references/agents.md](references/agents.md) for detailed agent patterns.

## Tools Overview

| Tool | Class | Use Case |
|------|-------|----------|
| Code Interpreter | `CodeInterpreterTool` | Execute Python, generate files |
| File Search | `FileSearchTool` | RAG over uploaded documents |
| Bing Grounding | `BingGroundingTool` | Web search (requires connection) |
| Azure AI Search | `AzureAISearchTool` | Search your indexes |
| Function Calling | `FunctionTool` | Call your Python functions |
| OpenAPI | `OpenApiTool` | Call REST APIs |
| MCP | `McpTool` | Model Context Protocol servers |
| Memory Search | `MemorySearchTool` | Search agent memory stores |
| SharePoint | `SharepointGroundingTool` | Search SharePoint content |

See [references/tools.md](references/tools.md) for all tool patterns.

## Thread and Message Flow

```python
# 1. Create thread
thread = client.agents.threads.create()

# 2. Add message
client.agents.messages.create(
    thread_id=thread.id,
    role="user",
    content="What's the weather like?",
)

# 3. Create and process run
run = client.agents.runs.create_and_process(
    thread_id=thread.id,
    agent_id=agent.id,
)

# 4. Get response
if run.status == "completed":
    messages = client.agents.messages.list(thread_id=thread.id)
    for msg in messages:
        if msg.role == "assistant":
            print(msg.content[0].text.value)
```

## Connections

```python
# List all connections
connections = client.connections.list()
for conn in connections:
    print(f"{conn.name}: {conn.connection_type}")

# Get specific connection
connection = client.connections.get(connection_name="my-search-connection")
```

See [references/connections.md](references/connections.md) for connection patterns.

## Deployments

```python
# List available model deployments
deployments = client.deployments.list()
for deployment in deployments:
    print(f"{deployment.name}: {deployment.model}")
```

See [references/deployments.md](references/deployments.md) for deployment patterns.

## Datasets and Indexes

```python
# List datasets
datasets = client.datasets.list()

# List indexes
indexes = client.indexes.list()
```

See [references/datasets-indexes.md](references/datasets-indexes.md) for data operations.

## Evaluation

```python
# Using OpenAI client for evals
openai_client = client.get_openai_client()

# Create evaluation with built-in evaluators
eval_run = openai_client.evals.runs.create(
    eval_id="my-eval",
    name="quality-check",
    data_source={
        "type": "custom",
        "item_references": [{"item_id": "test-1"}],
    },
    testing_criteria=[
        {"type": "fluency"},
        {"type": "task_adherence"},
    ],
)
```

See [references/evaluation.md](references/evaluation.md) for evaluation patterns.

## Async Client

```python
from azure.ai.projects.aio import AIProjectClient

async with AIProjectClient(
    endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
) as client:
    agent = await client.agents.create_agent(...)
    # ... async operations
```

See [references/async-patterns.md](references/async-patterns.md) for async patterns.

## Memory Stores

```python
# Create memory store for agent
memory_store = client.agents.create_memory_store(
    name="conversation-memory",
)

# Attach to agent for persistent memory
agent = client.agents.create_agent(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    name="memory-agent",
    tools=[MemorySearchTool()],
    tool_resources={"memory": {"store_ids": [memory_store.id]}},
)
```

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.ai.projects` sync clients with `azure.ai.projects.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with AIProjectClient(...) as client:` (sync) or `async with AIProjectClient(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Clean up agents** when done: `client.agents.delete_agent(agent.id)`
4. **Use `create_and_process`** for simple runs, **streaming** for real-time UX
5. **Use versioned agents** for production deployments
6. **Prefer connections** for external service integration (AI Search, Bing, etc.)

## SDK Comparison

| Feature | `azure-ai-projects` | `azure-ai-agents` |
|---------|---------------------|-------------------|
| Level | High-level (Foundry) | Low-level (Agents) |
| Client | `AIProjectClient` | `AgentsClient` |
| Versioning | `create_version()` | Not available |
| Connections | Yes | No |
| Deployments | Yes | No |
| Datasets/Indexes | Yes | No |
| Evaluation | Via OpenAI client | No |
| When to use | Full Foundry integration | Standalone agent apps |

## Reference Files

- [references/agents.md](references/agents.md): Agent operations with PromptAgentDefinition
- [references/tools.md](references/tools.md): All agent tools with examples
- [references/evaluation.md](references/evaluation.md): Evaluation operations overview
- [references/built-in-evaluators.md](references/built-in-evaluators.md): Complete built-in evaluator reference
- [references/custom-evaluators.md](references/custom-evaluators.md): Code and prompt-based evaluator patterns
- [references/connections.md](references/connections.md): Connection operations
- [references/deployments.md](references/deployments.md): Deployment enumeration
- [references/datasets-indexes.md](references/datasets-indexes.md): Dataset and index operations
- [references/async-patterns.md](references/async-patterns.md): Async client usage
- [references/api-reference.md](references/api-reference.md): Complete API reference for all 373 SDK exports (v2.0.0b4)
- [scripts/run_batch_evaluation.py](scripts/run_batch_evaluation.py): CLI tool for batch evaluations
