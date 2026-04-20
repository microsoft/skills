# Acceptance Criteria — maf-workflow-fundamentals-py

Use these patterns to validate that generated code follows the correct Microsoft Agent Framework workflow APIs.

---

## 0a. Import Paths

#### CORRECT: Core workflow imports
```python
from agent_framework import WorkflowBuilder, Executor, WorkflowContext, handler, executor
from agent_framework import WorkflowOutputEvent, ExecutorInvokedEvent, ExecutorCompletedEvent
from agent_framework import Case, Default
```

#### CORRECT: Checkpoint imports
```python
from agent_framework import InMemoryCheckpointStorage
```

#### CORRECT: Visualization imports
```python
from agent_framework import WorkflowViz
```

#### INCORRECT: Wrong module paths
```python
from agent_framework.workflows import WorkflowBuilder  # Wrong — WorkflowBuilder is top-level
from agent_framework.executors import Executor          # Wrong — Executor is top-level
from agent_framework import Workflow                    # Wrong — no such class, use WorkflowBuilder
```

---

## 0b. Authentication Patterns

Workflows themselves do not require authentication. Authentication is handled at the **agent/chat client level** when registering agents as executors.

#### CORRECT: Agent factory with credentials in a workflow
```python
from agent_framework.azure import AzureOpenAIChatClient
from azure.identity import AzureCliCredential

def create_agent():
    return AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
        instructions="You are helpful.", name="worker"
    )

builder = WorkflowBuilder()
builder.register_agent(factory_func=create_agent, name="worker")
```

#### CORRECT: OpenAI agent in workflow (API key via env var)
```python
from agent_framework.openai import OpenAIChatClient
import os

os.environ["OPENAI_API_KEY"] = "your-key"

def create_agent():
    return OpenAIChatClient().as_agent(instructions="You are helpful.", name="worker")

builder = WorkflowBuilder()
builder.register_agent(factory_func=create_agent, name="worker")
```

#### INCORRECT: Passing credentials to WorkflowBuilder
```python
builder = WorkflowBuilder(credential=AzureCliCredential())  # Wrong — WorkflowBuilder has no credential param
```

---

## 0c. Async Variants

#### CORRECT: All workflow execution is async
```python
import asyncio

async def main():
    workflow = builder.build()
    
    # Non-streaming (async)
    events = await workflow.run(input_message)
    outputs = events.get_outputs()
    
    # Streaming (async generator)
    async for event in workflow.run_stream(input_message):
        if isinstance(event, WorkflowOutputEvent):
            print(event.data)

asyncio.run(main())
```

#### INCORRECT: Synchronous workflow execution
```python
events = workflow.run(input_message)      # Wrong — run() is async, must await
for event in workflow.run_stream(input):  # Wrong — run_stream() is async generator
    print(event)
```

#### Key Rules

- `workflow.run()` must be awaited — returns workflow events.
- `workflow.run_stream()` must be used with `async for` — yields events.
- Executor handlers are always `async def` methods.
- `ctx.send_message()`, `ctx.yield_output()`, `ctx.set_shared_state()`, `ctx.get_shared_state()` are all async.
- There are no synchronous variants of any workflow API.

---

## 1. Executors

### Correct — Class-Based

```python
from agent_framework import Executor, WorkflowContext, handler

class UpperCase(Executor):
    @handler
    async def to_upper_case(self, text: str, ctx: WorkflowContext[str]) -> None:
        await ctx.send_message(text.upper())
```

### Correct — Function-Based

```python
from agent_framework import WorkflowContext, executor

@executor(id="upper_case_executor")
async def upper_case(text: str, ctx: WorkflowContext[str]) -> None:
    await ctx.send_message(text.upper())
```

### Correct — Multiple Handlers

```python
class SampleExecutor(Executor):
    @handler
    async def handle_str(self, text: str, ctx: WorkflowContext[str]) -> None:
        await ctx.send_message(text.upper())

    @handler
    async def handle_int(self, number: int, ctx: WorkflowContext[int]) -> None:
        await ctx.send_message(number * 2)
```

### Incorrect

```python
# Wrong: Missing @handler decorator
class BadExecutor(Executor):
    async def handle(self, text: str, ctx: WorkflowContext[str]) -> None:
        await ctx.send_message(text)

# Wrong: Not inheriting from Executor
class NotAnExecutor:
    @handler
    async def handle(self, text: str, ctx: WorkflowContext[str]) -> None:
        await ctx.send_message(text)

# Wrong: Missing WorkflowContext parameter
class BadExecutor(Executor):
    @handler
    async def handle(self, text: str) -> None:
        print(text)
```

### Key Rules

- Class-based: inherit `Executor`, use `@handler` on async methods.
- Function-based: use `@executor(id="...")` decorator.
- `WorkflowContext[T]` is parameterized with the output message type.
- `WorkflowContext[Never, T]` for handlers that only yield output (no downstream messages).
- Methods: `ctx.send_message(msg)`, `ctx.yield_output(value)`, `ctx.add_event(event)`.

---

## 2. Edges

### Correct — Direct

```python
from agent_framework import WorkflowBuilder

builder = WorkflowBuilder()
builder.add_edge(source_executor, target_executor)
builder.set_start_executor(source_executor)
workflow = builder.build()
```

### Correct — Conditional

```python
builder.add_edge(
    spam_detector, email_processor,
    condition=lambda result: isinstance(result, SpamResult) and not result.is_spam
)
```

### Correct — Switch-Case

```python
from agent_framework import Case, Default

builder.add_switch_case_edge_group(
    router_executor,
    [
        Case(condition=lambda msg: msg.priority < Priority.NORMAL, target=executor_a),
        Case(condition=lambda msg: msg.priority < Priority.HIGH, target=executor_b),
        Default(target=executor_c),
    ],
)
```

### Correct — Fan-Out

```python
builder.add_fan_out_edges(splitter, [worker1, worker2, worker3])
```

### Correct — Fan-Out with Selection

```python
builder.add_fan_out_edges(
    splitter, [worker1, worker2, worker3],
    selection_func=lambda message, target_ids: [0] if message.priority == "high" else [1, 2]
)
```

### Correct — Fan-In

```python
builder.add_fan_in_edge([worker1, worker2, worker3], aggregator)
```

### Incorrect

```python
# Wrong: Using add_fan_in_edges (plural) — correct is add_fan_in_edge (singular)
builder.add_fan_in_edges([w1, w2], aggregator)

# Wrong: Missing set_start_executor
builder.add_edge(a, b)
workflow = builder.build()  # Validation error

# Wrong: Incompatible message types between connected executors
# (handler emits int, but downstream expects str)
```

### Key Rules

- `add_edge(source, target, condition=...)` for direct and conditional edges.
- `add_switch_case_edge_group(source, [Case(...), ..., Default(...)])` for multi-way.
- `add_fan_out_edges(source, [targets], selection_func=...)` for fan-out.
- `add_fan_in_edge([sources], target)` for fan-in (singular, not plural).
- Always call `set_start_executor(executor)` exactly once.
- Message types must be compatible between connected executors.

---

## 3. WorkflowBuilder and Execution

### Correct — Build and Run

```python
from agent_framework import WorkflowBuilder, WorkflowOutputEvent

builder = WorkflowBuilder()
builder.set_start_executor(processor)
builder.add_edge(processor, validator)
builder.add_edge(validator, formatter)
workflow = builder.build()

# Streaming
async for event in workflow.run_stream(input_message):
    if isinstance(event, WorkflowOutputEvent):
        print(event.data)

# Non-streaming
events = await workflow.run(input_message)
outputs = events.get_outputs()
```

### Incorrect

```python
# Wrong: Using run_streaming (correct is run_stream)
async for event in workflow.run_streaming(input):
    ...

# Wrong: Modifying workflow after build
workflow = builder.build()
workflow.add_edge(a, b)  # No such API — workflows are immutable

# Wrong: Reusing workflow instance for concurrent tasks
workflow = builder.build()
asyncio.gather(workflow.run(task1), workflow.run(task2))  # Unsafe
```

### Key Rules

- Use `workflow.run_stream(input)` for streaming, `workflow.run(input)` for non-streaming.
- The method is `run_stream` (not `run_streaming`).
- Workflows are **immutable** after `build()`. Builders are mutable.
- Create a new workflow instance per task for state isolation.

---

## 4. State Isolation (Executor Factories)

### Correct — Thread-Safe

```python
builder = WorkflowBuilder()
builder.register_executor(factory_func=CustomExecutorA, name="executor_a")
builder.register_executor(factory_func=CustomExecutorB, name="executor_b")
builder.add_edge("executor_a", "executor_b")
builder.set_start_executor("executor_a")
workflow = builder.build()
```

### Correct — Agent Factories

```python
def create_writer():
    return AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
        instructions="...", name="writer"
    )

builder = WorkflowBuilder()
builder.register_agent(factory_func=create_writer, name="writer")
builder.set_start_executor("writer")
```

### Incorrect

```python
# Wrong: Sharing mutable executor instances across builds
shared_exec = CustomExecutor()
workflow_a = WorkflowBuilder().set_start_executor(shared_exec).build()
workflow_b = WorkflowBuilder().set_start_executor(shared_exec).build()
# Both share same mutable state — unsafe for concurrent use
```

### Key Rules

- Use `register_executor(factory_func=..., name="...")` for fresh instances per build.
- Use `register_agent(factory_func=..., name="...")` for agent state isolation.
- When using factories, reference executors by name (string) in `add_edge` and `set_start_executor`.
- Factory functions must not return shared mutable objects.

---

## 5. Shared State

### Correct

```python
class Producer(Executor):
    @handler
    async def handle(self, data: str, ctx: WorkflowContext[str]) -> None:
        await ctx.set_shared_state("key", data)
        await ctx.send_message("key")

class Consumer(Executor):
    @handler
    async def handle(self, key: str, ctx: WorkflowContext[str]) -> None:
        value = await ctx.get_shared_state(key)
        await ctx.send_message(f"Got: {value}")
```

### Key Rules

- `ctx.set_shared_state(key, value)` writes; `ctx.get_shared_state(key)` reads.
- Shared state is scoped to a single workflow run.
- Returns `None` if key not found — always check for `None`.

---

## 6. Checkpoints

### Correct — Enable

```python
from agent_framework import InMemoryCheckpointStorage, WorkflowBuilder

storage = InMemoryCheckpointStorage()
workflow = builder.with_checkpointing(storage).build()
```

### Correct — Resume

```python
checkpoints = await storage.list_checkpoints()
saved = checkpoints[5]
async for event in workflow.run_stream(input, checkpoint_id=saved.checkpoint_id):
    ...
```

### Correct — Rehydrate (New Instance)

```python
workflow = builder.build()
async for event in workflow.run_stream(
    input,
    checkpoint_id=saved.checkpoint_id,
    checkpoint_storage=storage,
):
    ...
```

### Correct — Custom State

```python
class StatefulExecutor(Executor):
    def __init__(self, id: str):
        super().__init__(id=id)
        self._messages: list[str] = []

    async def on_checkpoint_save(self) -> dict[str, Any]:
        return {"messages": self._messages}

    async def on_checkpoint_restore(self, state: dict[str, Any]) -> None:
        self._messages = state.get("messages", [])
```

### Key Rules

- Call `with_checkpointing(storage)` on the builder before `build()`.
- Checkpoints are created at **superstep boundaries** (after all executors complete).
- Resume on same instance: pass `checkpoint_id` to `run_stream`.
- Rehydrate on new instance: pass both `checkpoint_id` and `checkpoint_storage`.
- Override `on_checkpoint_save` / `on_checkpoint_restore` for custom executor state.

---

## 7. Workflows as Agents

### Correct

```python
workflow_agent = workflow.as_agent(name="Pipeline Agent")
thread = workflow_agent.get_new_thread()
response = await workflow_agent.run(messages, thread=thread)
```

### Correct — Streaming

```python
async for update in workflow_agent.run_stream(messages, thread=thread):
    if update.text:
        print(update.text, end="", flush=True)
```

### Incorrect

```python
# Wrong: Start executor can't handle list[ChatMessage]
class NumberProcessor(Executor):
    @handler
    async def handle(self, number: int, ctx: WorkflowContext) -> None: ...

workflow = builder.set_start_executor(NumberProcessor()).build()
agent = workflow.as_agent()  # Validation error — start executor must accept list[ChatMessage]
```

### Key Rules

- Start executor must handle `list[ChatMessage]` as input (satisfied by `ChatAgent` or agent executor).
- `as_agent(name=...)` returns an agent with standard `run`/`run_stream`/`get_new_thread` API.
- Workflow events map to agent responses (`AgentResponseUpdateEvent` → streaming updates, `RequestInfoEvent` → function calls).

---

## 8. Events

### Correct — Consuming Events

```python
from agent_framework import (
    ExecutorInvokedEvent, ExecutorCompletedEvent,
    WorkflowOutputEvent, WorkflowErrorEvent,
)

async for event in workflow.run_stream(input):
    match event:
        case ExecutorInvokedEvent() as e:
            print(f"Starting {e.executor_id}")
        case ExecutorCompletedEvent() as e:
            print(f"Completed {e.executor_id}")
        case WorkflowOutputEvent() as e:
            print(f"Output: {e.data}")
        case WorkflowErrorEvent() as e:
            print(f"Error: {e.exception}")
```

### Key Event Types

| Category | Events |
|---|---|
| Workflow lifecycle | `WorkflowStartedEvent`, `WorkflowOutputEvent`, `WorkflowErrorEvent`, `WorkflowWarningEvent` |
| Executor | `ExecutorInvokedEvent`, `ExecutorCompletedEvent`, `ExecutorFailedEvent` |
| Agent | `AgentRunEvent`, `AgentResponseUpdateEvent` |
| Superstep | `SuperStepStartedEvent`, `SuperStepCompletedEvent` |
| Request | `RequestInfoEvent` |

---

## 9. Visualization

### Correct

```python
from agent_framework import WorkflowViz

viz = WorkflowViz(workflow)
print(viz.to_mermaid())
print(viz.to_digraph())
viz.export(format="svg")
viz.save_png("workflow.png")
```

### Key Rules

- `WorkflowViz(workflow)` wraps a built workflow.
- `to_mermaid()` and `to_digraph()` produce text (no extra deps).
- `export(format=...)` and `save_svg/save_png/save_pdf` require `graphviz>=0.20.0` installed.
