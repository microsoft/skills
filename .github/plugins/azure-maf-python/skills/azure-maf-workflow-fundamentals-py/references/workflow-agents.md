# MAF Workflow Agents and Visualization — Python Reference

This reference covers using agents in workflows, workflows as agents, and workflow visualization in Microsoft Agent Framework Python.

## Table of Contents

- Adding agents to workflows
- Agent executors and message types
- Workflows as agents (`as_agent`)
- External input and thread integration
- Visualization and export formats

## Adding Agents to Workflows

Agents can be added to workflows via edges. The built-in agent executor handles communication with the workflow. Agents are passed directly to `WorkflowBuilder` like any executor.

### Using the Built-in Agent Executor

```python
from agent_framework import WorkflowBuilder
from agent_framework.azure import AzureOpenAIChatClient
from azure.identity import AzureCliCredential

chat_client = AzureOpenAIChatClient(credential=AzureCliCredential())
writer_agent = chat_client.as_agent(
    instructions=(
        "You are an excellent content writer. "
        "You create new content and edit contents based on the feedback."
    ),
    name="writer_agent",
)
reviewer_agent = chat_client.as_agent(
    instructions=(
        "You are an excellent content reviewer. "
        "Provide actionable feedback to the writer about the provided content. "
        "Provide the feedback in the most concise manner possible."
    ),
    name="reviewer_agent",
)

builder = WorkflowBuilder()
builder.set_start_executor(writer_agent)
builder.add_edge(writer_agent, reviewer_agent)
workflow = builder.build()
```

### Message Types for Agent Executors

The built-in agent executor handles:

- `str` — A single chat message in string format
- `ChatMessage` — A single chat message
- `list[ChatMessage]` — A list of chat messages

When the executor receives a message of one of these types, it triggers the agent. The response type is `AgentExecutorResponse`, which includes:

- `executor_id` — ID of the executor that produced the response
- `agent_run_response` — Full response from the agent
- `full_conversation` — Full conversation history up to this point

### Streaming with Agents

Agents run in streaming mode by default. Emitted events:

- `AgentResponseUpdateEvent` — Chunks of the agent's response as they are generated
- `AgentRunEvent` — Full response in non-streaming mode

```python
last_executor_id = None
async for event in workflow.run_stream("Write a short blog post about AI agents."):
    if isinstance(event, AgentResponseUpdateEvent):
        if event.executor_id != last_executor_id:
            if last_executor_id is not None:
                print()
            print(f"{event.executor_id}:", end=" ", flush=True)
            last_executor_id = event.executor_id
        print(event.data, end="", flush=True)
```

### Custom Agent Executor

Create a custom executor when you need to control streaming vs non-streaming, message types, agent lifecycle, or integration with shared state and requests/responses.

```python
from agent_framework import ChatAgent, ChatMessage, Executor, WorkflowContext, handler

class Writer(Executor):
    agent: ChatAgent

    def __init__(self, chat_client: AzureOpenAIChatClient, id: str = "writer") -> None:
        agent = chat_client.as_agent(
            instructions=(
                "You are an excellent content writer. "
                "You create new content and edit contents based on the feedback."
            ),
        )
        super().__init__(agent=agent, id=id)

    @handler
    async def handle(self, message: ChatMessage, ctx: WorkflowContext[list[ChatMessage]]) -> None:
        messages: list[ChatMessage] = [message]
        response = await self.agent.run(messages)
        messages.extend(response.messages)
        await ctx.send_message(messages)
```

## Workflows as Agents

Convert a workflow to an agent with `as_agent()` for a unified API, thread management, and streaming support.

### Requirements

The workflow's start executor must handle `list[ChatMessage]` as input. This is satisfied when using `ChatAgent` or the built-in agent executor.

### Creating a Workflow Agent

```python
from agent_framework import WorkflowBuilder, ChatAgent, ChatMessage, Role
from agent_framework.azure import AzureOpenAIChatClient
from azure.identity import AzureCliCredential

chat_client = AzureOpenAIChatClient(credential=AzureCliCredential())

researcher = ChatAgent(
    name="Researcher",
    instructions="Research and gather information on the given topic.",
    chat_client=chat_client,
)
writer = ChatAgent(
    name="Writer",
    instructions="Write clear, engaging content based on research.",
    chat_client=chat_client,
)

workflow = (
    WorkflowBuilder()
    .set_start_executor(researcher)
    .add_edge(researcher, writer)
    .build()
)

workflow_agent = workflow.as_agent(name="Content Pipeline Agent")
```

### as_agent Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `str \| None` | Optional display name. Auto-generated if not provided. |

### Using Workflow Agents

**Create a thread:**

```python
thread = workflow_agent.get_new_thread()
```

**Non-streaming execution:**

```python
messages = [ChatMessage(role=Role.USER, content="Write an article about AI trends")]
response = await workflow_agent.run(messages, thread=thread)

for message in response.messages:
    print(f"{message.author_name}: {message.text}")
```

**Streaming execution:**

```python
messages = [ChatMessage(role=Role.USER, content="Write an article about AI trends")]

async for update in workflow_agent.run_stream(messages, thread=thread):
    if update.text:
        print(update.text, end="", flush=True)
```

### Handling External Input Requests

When a workflow contains executors that use `RequestInfoExecutor`, requests appear as function calls. Track pending requests and provide responses before continuing:

```python
from agent_framework import FunctionApprovalRequestContent, FunctionApprovalResponseContent

async for update in workflow_agent.run_stream(messages, thread=thread):
    for content in update.contents:
        if isinstance(content, FunctionApprovalRequestContent):
            request_id = content.id
            function_call = content.function_call
            print(f"Workflow requests input: {function_call.name}")
            # Store request_id to provide a response later

if workflow_agent.pending_requests:
    print(f"Pending requests: {list(workflow_agent.pending_requests.keys())}")
```

**Providing responses:**

```python
response_content = FunctionApprovalResponseContent(
    id=request_id,
    function_call=function_call,
    approved=True,
)
response_message = ChatMessage(role=Role.USER, contents=[response_content])

async for update in workflow_agent.run_stream([response_message], thread=thread):
    if update.text:
        print(update.text, end="", flush=True)
```

### Complete Workflow Agent Example

```python
import asyncio
from agent_framework import ChatAgent, ChatMessage, Role
from agent_framework.azure import AzureOpenAIChatClient
from agent_framework._workflows import SequentialBuilder
from azure.identity import AzureCliCredential


async def main():
    chat_client = AzureOpenAIChatClient(credential=AzureCliCredential())

    researcher = ChatAgent(
        name="Researcher",
        instructions="Research the given topic and provide key facts.",
        chat_client=chat_client,
    )
    writer = ChatAgent(
        name="Writer",
        instructions="Write engaging content based on the research provided.",
        chat_client=chat_client,
    )
    reviewer = ChatAgent(
        name="Reviewer",
        instructions="Review the content and provide a final polished version.",
        chat_client=chat_client,
    )

    workflow = (
        SequentialBuilder()
        .add_agents([researcher, writer, reviewer])
        .build()
    )
    workflow_agent = workflow.as_agent(name="Content Creation Pipeline")

    thread = workflow_agent.get_new_thread()
    messages = [ChatMessage(role=Role.USER, content="Write about quantum computing")]

    current_author = None
    async for update in workflow_agent.run_stream(messages, thread=thread):
        if update.author_name and update.author_name != current_author:
            if current_author:
                print("\n" + "-" * 40)
            print(f"\n[{update.author_name}]:")
            current_author = update.author_name
        if update.text:
            print(update.text, end="", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
```

### Event Conversion

When a workflow runs as an agent, workflow events map to agent responses:

| Workflow Event | Agent Response |
|----------------|----------------|
| `AgentResponseUpdateEvent` | Passed through as `AgentResponseUpdate` (streaming) or aggregated into `AgentResponse` (non-streaming) |
| `RequestInfoEvent` | Converted to `FunctionCallContent` and `FunctionApprovalRequestContent` |
| Other events | Included in `raw_representation` for observability |

## Workflow Visualization

Use `WorkflowViz` to generate Mermaid diagrams, Graphviz DOT strings, and export to SVG, PNG, or PDF.

### Creating a WorkflowViz

```python
from agent_framework import WorkflowBuilder, WorkflowViz

workflow = (
    WorkflowBuilder()
    .set_start_executor(dispatcher)
    .add_fan_out_edges(dispatcher, [researcher, marketer, legal])
    .add_fan_in_edge([researcher, marketer, legal], aggregator)
    .build()
)

viz = WorkflowViz(workflow)
```

### Text Output (No Extra Dependencies)

```python
# Mermaid diagram
print(viz.to_mermaid())

# Graphviz DOT format
print(viz.to_digraph())
```

### Image Export

Requires `pip install graphviz>=0.20.0` and [GraphViz](https://graphviz.org/download/) installed.

```python
# Export to various formats
viz.export(format="svg")
viz.export(format="png")
viz.export(format="pdf")
viz.export(format="dot")

# Custom filename
viz.export(format="svg", filename="my_workflow.svg")

# Convenience methods
viz.save_svg("workflow.svg")
viz.save_png("workflow.png")
viz.save_pdf("workflow.pdf")
```

### Visualization Features

- **Start executors** — Green background with "(Start)" label
- **Regular executors** — Blue background with executor ID
- **Fan-in nodes** — Golden background, ellipse shape (DOT) or double circles (Mermaid)
- **Conditional edges** — Dashed/dotted arrows with "conditional" labels
- **Top-down layout** — Clear hierarchical flow
