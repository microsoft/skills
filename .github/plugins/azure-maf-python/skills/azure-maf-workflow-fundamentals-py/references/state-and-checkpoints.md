# MAF Workflow State and Checkpoints — Python Reference

This reference covers state isolation, shared state, checkpoints, and request/response handling in Microsoft Agent Framework Python.

## Table of Contents

- Mutable builders vs immutable workflows
- Executor factories and concurrency safety
- Shared state patterns
- Checkpoint creation and restore
- Request/response and human-in-the-loop hooks

## Mutable Builders vs Immutable Workflows

Workflow builders are mutable: add executors, edges, and configuration after creation. Workflows are immutable once built—no public API to modify a workflow after `build()`.

Avoid reusing a single workflow instance for multiple tasks or requests. Create a new workflow instance from the builder for each task to ensure state isolation and thread safety.

## Executor Factories for State Isolation

When passing executor instances directly to a workflow builder, those instances are shared among all workflow instances created from the builder. If executors hold mutable state, this can cause unintended sharing across runs.

Use factory functions with `register_executor` so each workflow instance gets fresh executor instances.

### Non-Thread-Safe Pattern

```python
executor_a = CustomExecutorA()
executor_b = CustomExecutorB()

workflow_builder = WorkflowBuilder()
workflow_builder.add_edge(executor_a, executor_b)
workflow_builder.set_start_executor(executor_b)

# All workflow instances share the same executor instances
workflow_a = workflow_builder.build()
workflow_b = workflow_builder.build()
```

### Thread-Safe Pattern

```python
workflow_builder = WorkflowBuilder()
workflow_builder.register_executor(factory_func=CustomExecutorA, name="executor_a")
workflow_builder.register_executor(factory_func=CustomExecutorB, name="executor_b")
workflow_builder.add_edge("executor_a", "executor_b")
workflow_builder.set_start_executor("executor_b")

# Each workflow instance gets its own executor instances
workflow_a = workflow_builder.build()
workflow_b = workflow_builder.build()
```

Ensure factory functions do not return executors that share mutable state.

## Agent State Management

Each agent in a workflow gets its own thread by default unless managed by a custom executor. Agent threads persist across workflow runs; content from one run is available in subsequent runs of the same workflow instance.

To isolate agent state per task, use agent factory functions with `register_agent`.

### Non-Thread-Safe Agent Pattern

```python
writer_agent = AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
    instructions="You are an excellent content writer...",
    name="writer_agent",
)
reviewer_agent = AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
    instructions="You are an excellent content reviewer...",
    name="reviewer_agent",
)

builder = WorkflowBuilder()
builder.add_edge(writer_agent, reviewer_agent)
builder.set_start_executor(writer_agent)
# All workflow instances share the same agent instances and threads
workflow = builder.build()
```

### Thread-Safe Agent Pattern

```python
def create_writer_agent() -> ChatAgent:
    return AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
        instructions="You are an excellent content writer...",
        name="writer_agent",
    )

def create_reviewer_agent() -> ChatAgent:
    return AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
        instructions="You are an excellent content reviewer...",
        name="reviewer_agent",
    )

builder = WorkflowBuilder()
builder.register_agent(factory_func=create_writer_agent, name="writer_agent")
builder.register_agent(factory_func=create_reviewer_agent, name="reviewer_agent")
builder.add_edge("writer_agent", "reviewer_agent")
builder.set_start_executor("writer_agent")
# Each workflow instance gets its own agent instances and threads
workflow = builder.build()
```

## Shared State

Shared state allows multiple executors to access and modify common data. Use `set_shared_state` to write and `get_shared_state` to read.

### Writing Shared State

```python
from agent_framework import Executor, WorkflowContext, handler
import uuid

class FileReadExecutor(Executor):

    @handler
    async def handle(self, file_path: str, ctx: WorkflowContext[str]) -> None:
        with open(file_path, "r") as file:
            file_content = file.read()
        file_id = str(uuid.uuid4())
        await ctx.set_shared_state(file_id, file_content)
        await ctx.send_message(file_id)
```

### Reading Shared State

```python
class WordCountingExecutor(Executor):

    @handler
    async def handle(self, file_id: str, ctx: WorkflowContext[int]) -> None:
        file_content = await ctx.get_shared_state(file_id)
        if file_content is None:
            raise ValueError("File content state not found")
        await ctx.send_message(len(file_content.split()))
```

## Checkpoints

Checkpoints save workflow state at superstep boundaries and support resumption and rehydration.

### When Checkpoints Are Created

Checkpoints are created at the end of each superstep, after all executors in that superstep complete. A checkpoint captures:

- Current state of all executors
- Pending messages for the next superstep
- Pending requests and responses
- Shared states

### Enabling Checkpointing

Provide a `CheckpointStorage` when building the workflow:

```python
from agent_framework import InMemoryCheckpointStorage, WorkflowBuilder

checkpoint_storage = InMemoryCheckpointStorage()

builder = WorkflowBuilder()
builder.set_start_executor(start_executor)
builder.add_edge(start_executor, executor_b)
builder.add_edge(executor_b, executor_c)
builder.add_edge(executor_b, end_executor)
workflow = builder.with_checkpointing(checkpoint_storage).build()
```

### Capturing Checkpoints

```python
async for event in workflow.run_stream(input):
    ...

checkpoints = await checkpoint_storage.list_checkpoints()
```

### Resuming from a Checkpoint

Resume on the same workflow instance:

```python
saved_checkpoint = checkpoints[5]
async for event in workflow.run_stream(
    input,
    checkpoint_id=saved_checkpoint.checkpoint_id,
):
    ...
```

### Rehydrating from a Checkpoint

Start a new workflow instance from a checkpoint:

```python
builder = WorkflowBuilder()
builder.set_start_executor(start_executor)
builder.add_edge(start_executor, executor_b)
builder.add_edge(executor_b, executor_c)
workflow = builder.build()

saved_checkpoint = checkpoints[5]
async for event in workflow.run_stream(
    input,
    checkpoint_id=saved_checkpoint.checkpoint_id,
    checkpoint_storage=checkpoint_storage,
):
    ...
```

### Saving Executor State

Override `on_checkpoint_save` to include custom executor state in checkpoints. Override `on_checkpoint_restore` to restore it when resuming.

```python
from typing import Any

class CustomExecutor(Executor):
    def __init__(self, id: str) -> None:
        super().__init__(id=id)
        self._messages: list[str] = []

    @handler
    async def handle(self, message: str, ctx: WorkflowContext) -> None:
        self._messages.append(message)
        # Executor logic...

    async def on_checkpoint_save(self) -> dict[str, Any]:
        return {"messages": self._messages}

    async def on_checkpoint_restore(self, state: dict[str, Any]) -> None:
        self._messages = state.get("messages", [])
```

## Requests and Responses

Executors can request external input and handle responses. Use `ctx.request_info()` to send requests and `@response_handler` to handle responses.

### Sending Requests and Handling Responses

```python
from agent_framework import Executor, WorkflowContext, handler, response_handler

class SomeExecutor(Executor):

    @handler
    async def handle_data(
        self,
        data: OtherDataType,
        context: WorkflowContext,
    ) -> None:
        # Process the message...
        await context.request_info(
            request_data=CustomRequestType(...),
            response_type=CustomResponseType,
        )

    @response_handler
    async def handle_response(
        self,
        original_request: CustomRequestType,
        response: CustomResponseType,
        context: WorkflowContext,
    ) -> None:
        # Process the response...
```

The `@response_handler` decorator registers the method to handle responses for the specified request and response types.

### Handling RequestInfoEvent from the Workflow

When an executor calls `request_info`, the workflow emits `RequestInfoEvent`. Subscribe to these events to provide responses:

```python
from agent_framework import RequestInfoEvent

pending_responses: dict[str, CustomResponseType] = {}
request_info_events: list[RequestInfoEvent] = []

stream = workflow.run_stream(input) if not pending_responses else workflow.send_responses_streaming(pending_responses)

async for event in stream:
    if isinstance(event, RequestInfoEvent):
        request_info_events.append(event)

for request_info_event in request_info_events:
    response = CustomResponseType(...)
    pending_responses[request_info_event.request_id] = response
```

### Checkpoints and Pending Requests

When a checkpoint is created, pending requests are saved. On restore, pending requests are re-emitted as `RequestInfoEvent` objects. Listen for these events and respond using the standard response mechanism; do not provide responses during the resume operation itself.
