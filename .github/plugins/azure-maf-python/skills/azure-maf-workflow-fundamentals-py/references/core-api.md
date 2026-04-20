# MAF Workflow Core API — Python Reference

This reference covers executors, edges, workflows, and events in Microsoft Agent Framework Python. All examples are Python-only.

## Table of Contents

- Executors
- Edges and routing
- Workflow building and execution
- Streaming and non-streaming runs
- Event model and naming
- Validation rules and common pitfalls

## Executors

Executors are processing units that receive typed messages, perform operations, and produce output. Define them as classes inheriting `Executor` with `@handler` methods, or as functions decorated with `@executor`.

### Basic Executor (Class-Based)

```python
from agent_framework import Executor, WorkflowContext, handler

class UpperCase(Executor):

    @handler
    async def to_upper_case(self, text: str, ctx: WorkflowContext[str]) -> None:
        """Convert the input to uppercase and forward it to the next node."""
        await ctx.send_message(text.upper())
```

`WorkflowContext` is parameterized with the type the handler will emit. `WorkflowContext[str]` means downstream nodes expect `str`.

### Function-Based Executor

```python
from agent_framework import WorkflowContext, executor

@executor(id="upper_case_executor")
async def upper_case(text: str, ctx: WorkflowContext[str]) -> None:
    """Convert the input to uppercase and forward it to the next node."""
    await ctx.send_message(text.upper())
```

### Multiple Handlers

Support multiple input types by defining multiple handlers:

```python
class SampleExecutor(Executor):

    @handler
    async def to_upper_case(self, text: str, ctx: WorkflowContext[str]) -> None:
        await ctx.send_message(text.upper())

    @handler
    async def double_integer(self, number: int, ctx: WorkflowContext[int]) -> None:
        await ctx.send_message(number * 2)
```

### WorkflowContext Methods

- **`send_message(msg)`** — Send a message to connected executors downstream.
- **`yield_output(value)`** — Produce workflow output returned/streamed to the caller. Use `WorkflowContext[Never, str]` when the handler yields output but does not send messages.
- **`add_event(event)`** — Emit a custom workflow event for observability.

Handlers that neither send messages nor yield outputs use `WorkflowContext` with no type parameters:

```python
@handler
async def some_handler(self, message: str, ctx: WorkflowContext) -> None:
    print("Doing some work...")
```

## Edges

Edges define how messages flow between executors. Add them via `WorkflowBuilder` methods.

### Direct Edges

Simple one-to-one connections:

```python
from agent_framework import WorkflowBuilder

builder = WorkflowBuilder()
builder.add_edge(source_executor, target_executor)
builder.set_start_executor(source_executor)
workflow = builder.build()
```

### Conditional Edges

Route messages based on conditions:

```python
builder = WorkflowBuilder()
builder.add_edge(
    spam_detector, email_processor,
    condition=lambda result: isinstance(result, SpamResult) and not result.is_spam
)
builder.add_edge(
    spam_detector, spam_handler,
    condition=lambda result: isinstance(result, SpamResult) and result.is_spam
)
builder.set_start_executor(spam_detector)
workflow = builder.build()
```

### Switch-Case Edges

Route to different executors based on predicates:

```python
from agent_framework import Case, Default, WorkflowBuilder

builder = WorkflowBuilder()
builder.set_start_executor(router_executor)
builder.add_switch_case_edge_group(
    router_executor,
    [
        Case(
            condition=lambda message: message.priority < Priority.NORMAL,
            target=executor_a,
        ),
        Case(
            condition=lambda message: message.priority < Priority.HIGH,
            target=executor_b,
        ),
        Default(target=executor_c),
    ],
)
workflow = builder.build()
```

### Fan-Out Edges

Distribute messages from one executor to multiple targets:

```python
builder = WorkflowBuilder()
builder.set_start_executor(splitter_executor)
builder.add_fan_out_edges(splitter_executor, [worker1, worker2, worker3])
workflow = builder.build()
```

Fan-out with a selection function to route to specific targets:

```python
builder.add_fan_out_edges(
    splitter_executor,
    [worker1, worker2, worker3],
    selection_func=lambda message, target_ids: (
        [0] if message.priority == Priority.HIGH else
        [1, 2] if message.priority == Priority.NORMAL else
        list(range(len(target_ids)))
    )
)
```

### Fan-In Edges

Collect messages from multiple sources into a single target:

```python
builder.add_fan_in_edge([worker1, worker2, worker3], aggregator_executor)
```

## WorkflowBuilder and Workflows

### Building Workflows

```python
from agent_framework import WorkflowBuilder

processor = DataProcessor()
validator = Validator()
formatter = Formatter()

builder = WorkflowBuilder()
builder.set_start_executor(processor)
builder.add_edge(processor, validator)
builder.add_edge(validator, formatter)
workflow = builder.build()
```

### Streaming vs Non-Streaming Execution

**Streaming** — Consume events as they occur:

```python
from agent_framework import WorkflowOutputEvent

async for event in workflow.run_stream(input_message):
    if isinstance(event, WorkflowOutputEvent):
        print(f"Workflow completed: {event.data}")
```

**Non-streaming** — Wait for completion and inspect all events:

```python
events = await workflow.run(input_message)
print(f"Final result: {events.get_outputs()}")
```

### Workflow Validation

The framework validates workflows when building:

- **Type compatibility** — Message types between connected executors are compatible.
- **Graph connectivity** — All executors are reachable from the start executor.
- **Executor binding** — All executors are properly instantiated.
- **Edge validation** — No duplicate edges or invalid connections.

## Events

### Built-in Event Types

**Workflow lifecycle:**
- `WorkflowStartedEvent` — Workflow execution begins.
- `WorkflowOutputEvent` — Workflow produces an output.
- `WorkflowErrorEvent` — Workflow encounters an error.
- `WorkflowWarningEvent` — Workflow encountered a warning.

**Executor events:**
- `ExecutorInvokedEvent` — Executor starts processing.
- `ExecutorCompletedEvent` — Executor finishes processing.
- `ExecutorFailedEvent` — Executor encounters an error.
- `AgentRunEvent` — An agent run produces output.
- `AgentResponseUpdateEvent` — An agent run produces a streaming update.

**Superstep events:**
- `SuperStepStartedEvent` — Superstep begins.
- `SuperStepCompletedEvent` — Superstep completes.

**Request events:**
- `RequestInfoEvent` — A request is issued.

### Consuming Events

```python
from agent_framework import (
    ExecutorCompletedEvent,
    ExecutorInvokedEvent,
    WorkflowOutputEvent,
    WorkflowErrorEvent,
)

async for event in workflow.run_stream(input_message):
    match event:
        case ExecutorInvokedEvent() as invoke:
            print(f"Starting {invoke.executor_id}")
        case ExecutorCompletedEvent() as complete:
            print(f"Completed {complete.executor_id}: {complete.data}")
        case WorkflowOutputEvent() as output:
            print(f"Workflow produced output: {output.data}")
            return
        case WorkflowErrorEvent() as error:
            print(f"Workflow error: {error.exception}")
            return
```

### Custom Events

Define and emit custom events for observability:

```python
from agent_framework import (
    Executor,
    WorkflowContext,
    WorkflowEvent,
    handler,
)

class CustomEvent(WorkflowEvent):
    def __init__(self, message: str):
        super().__init__(message)

class CustomExecutor(Executor):

    @handler
    async def handle(self, message: str, ctx: WorkflowContext[str]) -> None:
        await ctx.add_event(CustomEvent(f"Processing message: {message}"))
        # Executor logic...
```

## Pregel Execution Model

Workflow execution uses a modified Pregel (BSP) model:

1. **Collect** — Gather pending messages from the previous superstep.
2. **Route** — Deliver messages to target executors based on edge type and conditions.
3. **Execute** — Run all target executors concurrently.
4. **Barrier** — Wait for all executors in the superstep to complete.
5. **Emit** — Queue new messages for the next superstep.

Within a superstep, executors run in parallel. The workflow does not advance until every executor in the current superstep finishes. This enables deterministic execution, reliable checkpointing at superstep boundaries, and consistent message views.
