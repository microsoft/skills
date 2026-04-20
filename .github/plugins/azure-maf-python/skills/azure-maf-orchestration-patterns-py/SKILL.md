---
name: azure-maf-orchestration-patterns-py
description: This skill should be used when the user asks about "sequential orchestration", "concurrent orchestration", "group chat", "Magentic", "handoff", "human in the loop", "HITL", "multi-agent pattern", "orchestration", "SequentialBuilder", "ConcurrentBuilder", "GroupChatBuilder", "MagenticBuilder", "HandoffBuilder", or needs guidance on choosing or implementing pre-built multi-agent orchestration patterns in Microsoft Agent Framework Python. Make sure to use this skill whenever the user mentions chaining agents in a pipeline, running agents in parallel, coordinating multiple agents, dynamic agent routing, speaker selection, plan review, checkpointing workflows, agent-to-agent handoff, tool approval, fan-out/fan-in, or any multi-agent topology, even if they don't explicitly say "orchestration".
version: 0.1.0
---

# MAF Orchestration Patterns

This skill provides a decision guide for the six pre-built orchestration patterns in Microsoft Agent Framework Python. Use it when selecting the right multi-agent topology for a workflow or implementing a chosen pattern with correct Python APIs.

## Pattern Comparison

| Pattern | Topology | Use Case | Key Class |
|---------|----------|----------|-----------|
| **Sequential** | Pipeline (linear) | Step-by-step workflows, pipelines, multi-stage processing | `SequentialBuilder` |
| **Concurrent** | Fan-out/fan-in | Parallel analysis, independent subtasks, ensemble decision making | `ConcurrentBuilder` |
| **Group Chat** | Star (orchestrator) | Iterative refinement, collaborative problem-solving, content review | `GroupChatBuilder` |
| **Magentic** | Star (planner/manager) | Complex, generalist multi-agent collaboration, dynamic planning | `MagenticBuilder` |
| **Handoff** | Mesh | Dynamic workflows, escalation, fallback, expert handoff | `HandoffBuilder` |
| **HITL** | (Overlay) | Human feedback and approval within any orchestration | `with_request_info`, `AgentRequestInfoExecutor` |

## When to Use Each Pattern

**Sequential** – Each step builds on the previous. Use for pipelines such as writer→reviewer, content→summarizer, or any fixed order where later agents need earlier output. Full conversation history flows to each participant.

**Concurrent** – All agents work on the same input in parallel. Use for diverse perspectives (research, marketing, legal), ensemble reasoning, or voting. Results are aggregated; use `.with_aggregator()` for custom aggregation.

**Group Chat** – Central orchestrator selects who speaks next. Use for iterative refinement (writer/reviewer cycles), collaborative problem-solving, or multi-perspective analysis. Orchestrator can be a simple selector function or an agent-based orchestrator.

**Magentic** – Planner/manager coordinates agents based on evolving context and task progress. Use for open-ended complex tasks where the solution path is unknown. Supports plan review, stall detection, and auto-replanning.

**Handoff** – Agents hand control to each other directly. Use for customer support triage, expert routing, escalation, or fallback. Supports autonomous mode, tool approval, and checkpointing for durable workflows.

**HITL** – Overlay for any orchestration. Use when human feedback or approval is needed before proceeding. Apply `with_request_info()` on the builder; handle `RequestInfoEvent` and function approval requests.

## Quickstart Code

### Sequential

```python
from agent_framework import SequentialBuilder, WorkflowOutputEvent

workflow = SequentialBuilder().participants([writer, reviewer]).build()
output_evt: WorkflowOutputEvent | None = None
async for event in workflow.run_stream(prompt):
    if isinstance(event, WorkflowOutputEvent):
        output_evt = event
```

### Concurrent

```python
from agent_framework import ConcurrentBuilder, WorkflowOutputEvent

workflow = ConcurrentBuilder().participants([researcher, marketer, legal]).build()
# Optional: .with_aggregator(custom_aggregator)
output_evt: WorkflowOutputEvent | None = None
async for event in workflow.run_stream(prompt):
    if isinstance(event, WorkflowOutputEvent):
        output_evt = event
```

### Group Chat

```python
from agent_framework import GroupChatBuilder, GroupChatState

def round_robin_selector(state: GroupChatState) -> str:
    names = list(state.participants.keys())
    return names[state.current_round % len(names)]

workflow = (
    GroupChatBuilder()
    .with_select_speaker_func(round_robin_selector)
    .participants([researcher, writer])
    .with_termination_condition(lambda conv: len(conv) >= 4)
    .build()
)
```

### Magentic

```python
from agent_framework import MagenticBuilder

workflow = (
    MagenticBuilder()
    .participants([researcher_agent, coder_agent])
    .with_standard_manager(agent=manager_agent, max_round_count=10, max_stall_count=3, max_reset_count=2)
    .build()
)
# Optional: .with_plan_review() for human plan review
```

### Handoff

```python
from agent_framework import HandoffBuilder

workflow = (
    HandoffBuilder(name="support", participants=[triage_agent, refund_agent, order_agent])
    .with_start_agent(triage_agent)
    .with_termination_condition(lambda conv: len(conv) > 0 and "welcome" in conv[-1].text.lower())
    .build()
)
# Optional: .with_autonomous_mode(), .with_checkpointing(storage), add_handoff(from, [to])
```

### HITL (Sequential example)

```python
builder = (
    SequentialBuilder()
    .participants([agent1, agent2, agent3])
    .with_request_info(agents=[agent2])  # HITL only for agent2
)
```

## Decision Matrix

| Requirement | Recommended Pattern |
|-------------|---------------------|
| Fixed pipeline order | Sequential |
| Diverse perspectives in parallel | Concurrent |
| Custom result aggregation | Concurrent + `.with_aggregator()` |
| Iterative refinement, review cycles | Group Chat |
| Simple round-robin or agent-based selection | Group Chat |
| Complex dynamic planning, unknown solution path | Magentic |
| Human plan review before execution | Magentic + `.with_plan_review()` |
| Dynamic routing by context | Handoff |
| Customer support triage, specialist handoff | Handoff |
| Human feedback after agent output | Any + `with_request_info()` |
| Function approval before tool execution | Handoff (tool approval) or HITL |
| Durable workflow across restarts | Handoff + `.with_checkpointing()` |
| Autonomous continuation when no handoff | Handoff + `.with_autonomous_mode()` |

## Key APIs

- **SequentialBuilder**: `participants([...])`, `build()`
- **ConcurrentBuilder**: `participants([...])`, `with_aggregator(fn)`, `build()`
- **GroupChatBuilder**: `participants([...])`, `with_select_speaker_func(fn)`, `with_agent_orchestrator(agent)`, `with_termination_condition(fn)`, `build()`
- **MagenticBuilder**: `participants([...])`, `with_standard_manager(...)`, `with_plan_review()`, `build()`
- **HandoffBuilder**: `participants([...])`, `with_start_agent(agent)`, `with_termination_condition(fn)`, `add_handoff(from, [to])`, `with_autonomous_mode()`, `with_checkpointing(storage)`, `build()`
- **HITL**: `with_request_info(agents=[...])` on any builder; `AgentRequestInfoExecutor`, `AgentRequestInfoResponse.approve()`, `AgentRequestInfoResponse.from_messages()`, `@ai_function(approval_mode="always_require")`

## Output Format

All orchestrations return a `list[ChatMessage]` via `WorkflowOutputEvent.data`. Magentic typically emits a single final synthesizing message. Use `AgentResponseUpdateEvent` and `AgentRunUpdateEvent` for streaming progress.

HITL is treated as an overlay capability in this skill: it augments the five core orchestration patterns rather than replacing them.

## Additional Resources

### Reference Files

For detailed patterns and full Python examples:

- **`references/sequential-concurrent.md`** – Sequential pipelines (writer→reviewer, shared conversation history, mixing agents and executors), Concurrent agents (research/marketing/legal, aggregation, custom aggregators)
- **`references/group-chat-magentic.md`** – Group Chat (star topology, orchestrator, round-robin and agent-based selection, context sync), Magentic (planner/manager, researcher/coder agents, plan review, event handling)
- **`references/handoff-hitl.md`** – Handoff (mesh topology, request/response cycle, autonomous mode, tool approval, checkpointing), Human-in-the-Loop (feedback vs approval, `with_request_info()`, `AgentRequestInfoExecutor`, `@ai_function` approval mode)
- **`references/acceptance-criteria.md`** – Correct vs incorrect patterns for all six orchestration types, event handling, and pattern selection guidance

### Provider and Version Caveats

- Keep event names and builder APIs aligned to Python docs; .NET docs can use different naming and helper methods.
