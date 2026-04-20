---
name: azure-maf-workflow-fundamentals-py
description: This skill should be used when the user asks to "create workflow", "workflow builder", "executor", "edges", "workflow events", "superstep", "shared state", "checkpoints", "workflow visualization", "state isolation", "WorkflowBuilder", or needs guidance on building programmatic workflows, graph-based execution, or workflow state management in Microsoft Agent Framework Python. Make sure to use this skill whenever the user mentions building a processing pipeline, routing messages between components, fan-out/fan-in patterns, conditional branching in workflows, workflow checkpointing or resumption, converting workflows to agents, Pregel execution model, directed graph execution, or any custom executor or handler pattern, even if they don't explicitly say "workflow".
version: 0.1.0
---

# MAF Workflow Fundamentals — Python

This skill covers building workflows from scratch in Microsoft Agent Framework Python: core APIs, executors, edges, events, state isolation, and hands-on patterns.

## Workflow Architecture Overview

Workflows are directed graphs composed of **executors** and **edges**. Executors are processing units that receive typed messages, perform operations, and produce output. Edges define how messages flow between executors. Use `WorkflowBuilder` to construct workflows; call `build()` to obtain an immutable `Workflow` instance ready for execution.

### Core Components

- **Executors** — Handle messages via `@handler` methods; use `WorkflowContext` for `send_message`, `yield_output`, and shared state. Create executors as classes inheriting `Executor` or via the `@executor` decorator on functions.
- **Edges** — Connect executors: direct edges, conditional edges, switch-case, fan-out, and fan-in. Add edges with `add_edge`, `add_switch_case_edge_group`, `add_fan_out_edges`, and `add_fan_in_edge`.
- **Workflows** — Orchestrate executor execution, message routing, and event streaming. Build with `WorkflowBuilder().set_start_executor(...).add_edge(...).build()`.
- **Events** — Provide observability: `WorkflowStartedEvent`, `WorkflowOutputEvent`, `ExecutorInvokedEvent`, `ExecutorCompletedEvent`, `SuperStepStartedEvent`, `SuperStepCompletedEvent`, and custom events.

## Pregel Execution Model and Supersteps

The framework uses a modified Pregel (Bulk Synchronous Parallel) execution model. Execution is organized into discrete **supersteps**:

1. Collect pending messages from the previous superstep.
2. Route messages to target executors based on edge definitions and conditions.
3. Run all target executors concurrently within the superstep.
4. Wait for all executors to complete before advancing (synchronization barrier).
5. Queue new messages for the next superstep.

All executors in a superstep run concurrently but do not advance until every one completes. Fan-out paths that chain multiple executors will block until the slowest parallel path finishes. To reduce blocking, consolidate sequential steps into a single executor. Superstep boundaries are ideal for checkpointing and state capture.

The BSP model provides deterministic execution (same input yields same order), reliable checkpointing at superstep boundaries, and simpler reasoning (no race conditions between supersteps). When fan-out creates paths of different lengths, the shorter path waits for the longer one. To avoid unnecessary blocking, consolidate sequential steps into a single executor so parallel branches complete in one superstep.

## Building and Running Workflows

Define executors, add them to a builder, connect them with edges, set the start executor, and build:

```python
from agent_framework import Executor, WorkflowBuilder, WorkflowContext, handler

class Processor(Executor):
    @handler
    async def handle(self, text: str, ctx: WorkflowContext[str]) -> None:
        await ctx.send_message(text.upper())

processor = Processor()
builder = WorkflowBuilder()
builder.set_start_executor(processor)
builder.add_edge(processor, next_executor)
workflow = builder.build()
```

Run workflows in streaming or non-streaming mode:

```python
from agent_framework import WorkflowOutputEvent

# Streaming
async for event in workflow.run_stream(input_message):
    if isinstance(event, WorkflowOutputEvent):
        print(event.data)

# Non-streaming
events = await workflow.run(input_message)
outputs = events.get_outputs()
```

## Hands-On Tutorial Checklist

To build a workflow from scratch:

1. Define one or more executors (class with `@handler` or function with `@executor`).
2. Create a `WorkflowBuilder` and call `set_start_executor` with the initial executor.
3. Add edges with `add_edge`, `add_switch_case_edge_group`, `add_fan_out_edges`, or `add_fan_in_edge`.
4. Call `build()` to obtain an immutable workflow.
5. Run with `workflow.run(input)` or `workflow.run_stream(input)` and consume events.

For production: use `register_executor` with factory functions for state isolation, enable checkpointing with `with_checkpointing(storage)` when resumability is needed, and use `WorkflowViz` to verify graph structure before deployment.

## State Management Overview

- **Mutable builders vs immutable workflows** — Builders are mutable; workflows are immutable once built. Avoid reusing a single workflow instance across multiple tasks; create a new workflow per task for state isolation.
- **Executor factories** — Use `register_executor` with factory functions to ensure each workflow instance gets fresh executor instances. Avoid passing shared executor instances when multiple concurrent runs are expected.
- **Shared state** — Use `ctx.set_shared_state(key, value)` and `ctx.get_shared_state(key)` for data shared across executors within a run.
- **Checkpoints** — Enable with `with_checkpointing(checkpoint_storage)` on the builder. Checkpoints are created at superstep boundaries. Override `on_checkpoint_save` and `on_checkpoint_restore` in executors to persist custom state.

## Validation and Graph Rules

The framework validates workflows at build time. Ensure message types match between connected executors: a handler that emits `str` must connect to executors that accept `str`. All executors must be reachable from the start executor. Use `set_start_executor` exactly once. For fan-out and fan-in, the selection function receives the message and target IDs; return a list of target indices to route to.

## Common Patterns

- **Linear pipeline** — Chain executors with `add_edge` in sequence; set the first as the start executor.
- **Conditional routing** — Use `add_edge` with a `condition` lambda, or `add_switch_case_edge_group` for multi-way branching.
- **Parallel workers** — Use `add_fan_out_edges` from a dispatcher to workers, then `add_fan_in_edge` to an aggregator.
- **State isolation** — Call `register_executor` and `register_agent` with factory functions instead of passing shared instances.
- **Agent pipelines** — Add agents via `add_edge`; they are wrapped as executors. Convert a workflow to an agent with `as_agent()` for a unified chat API.

## Key Classes and APIs

| Class / API | Purpose |
|-------------|---------|
| `WorkflowBuilder` | Fluent API for defining workflow structure |
| `Executor`, `@handler`, `@executor` | Define processing units and handlers |
| `WorkflowContext` | `send_message`, `yield_output`, `set_shared_state`, `get_shared_state` |
| `add_edge`, `add_switch_case_edge_group`, `add_fan_out_edges`, `add_fan_in_edge` | Edge types and routing |
| `workflow.run`, `workflow.run_stream` | Non-streaming and streaming execution |
| `on_checkpoint_save`, `on_checkpoint_restore` | Persist and restore executor state |
| `WorkflowViz` | Mermaid, Graphviz DOT, SVG/PNG/PDF export |

## Additional Resources

### Reference Files

For detailed patterns and Python code examples:

- **`references/core-api.md`** — Executors (class-based, function-based, multiple handlers), edges (direct, conditional, switch-case, fan-out, fan-in), `WorkflowBuilder`, streaming vs non-streaming, validation, and events.
- **`references/state-and-checkpoints.md`** — Mutable builders vs immutable workflows, executor factories, shared state, checkpoints (when created, capturing, resuming, rehydration), `on_checkpoint_save`, requests and responses (`request_info`, `@response_handler`).
- **`references/workflow-agents.md`** — Adding agents via edges, built-in agent executor, message types, streaming with agents, custom agent executor, workflows as agents (`as_agent()`), unified API, threads, external input, event conversion, `WorkflowViz`.
- **`references/acceptance-criteria.md`** — Correct vs incorrect patterns for executors, edges, WorkflowBuilder, state isolation, shared state, checkpoints, workflows as agents, events, and visualization.

### Provider and Version Caveats

- Prefer canonical event names from the Python workflow docs when examples differ across versions.
- Keep state isolation guidance tied to factory registration (`register_executor`, `register_agent`) for concurrent safety.
