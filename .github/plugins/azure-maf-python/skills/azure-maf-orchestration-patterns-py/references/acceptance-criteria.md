# Acceptance Criteria — maf-orchestration-patterns-py

Use these patterns to validate that generated code follows the correct Microsoft Agent Framework orchestration APIs.

---

## 0a. Import Paths

#### CORRECT: Orchestration builder imports
```python
from agent_framework import SequentialBuilder, ConcurrentBuilder
from agent_framework import GroupChatBuilder, GroupChatState
from agent_framework import MagenticBuilder
from agent_framework import HandoffBuilder
```

#### CORRECT: Event imports for orchestration
```python
from agent_framework import WorkflowOutputEvent, AgentResponseUpdateEvent, RequestInfoEvent
from agent_framework import MagenticOrchestratorEvent, MagenticProgressLedger
from agent_framework import AgentRequestInfoResponse
```

#### CORRECT: Handoff-specific imports
```python
from agent_framework import FileCheckpointStorage
from agent_framework import ai_function
```

#### INCORRECT: Wrong class names or paths
```python
from agent_framework import SequentialWorkflow       # Wrong — use SequentialBuilder
from agent_framework import ConcurrentWorkflow       # Wrong — use ConcurrentBuilder
from agent_framework import GroupChat                 # Wrong — use GroupChatBuilder
from agent_framework.orchestration import HandoffBuilder  # Wrong — top-level import
```

---

## 0b. Authentication Patterns

Orchestration builders don't handle authentication directly. Authentication is configured at the **agent level** before passing agents to builders.

#### CORRECT: Agents with credentials passed to builder
```python
from agent_framework.azure import AzureOpenAIChatClient
from azure.identity import AzureCliCredential

writer = AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
    instructions="You are a writer.", name="writer"
)
reviewer = AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
    instructions="You are a reviewer.", name="reviewer"
)
workflow = SequentialBuilder().participants([writer, reviewer]).build()
```

#### CORRECT: Mixed providers in same orchestration
```python
from agent_framework.openai import OpenAIChatClient
from agent_framework.azure import AzureOpenAIChatClient
from azure.identity import AzureCliCredential

agent_a = OpenAIChatClient(api_key="...").as_agent(instructions="...", name="a")
agent_b = AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(instructions="...", name="b")
workflow = SequentialBuilder().participants([agent_a, agent_b]).build()
```

#### INCORRECT: Passing credentials to builder
```python
workflow = SequentialBuilder(credential=AzureCliCredential()).participants([...]).build()
# Wrong — builders have no credential parameter
```

---

## 0c. Async Variants

#### CORRECT: All orchestration execution is async
```python
import asyncio

async def main():
    workflow = SequentialBuilder().participants([writer, reviewer]).build()
    async for event in workflow.run_stream("Write a poem about clouds"):
        if isinstance(event, WorkflowOutputEvent):
            print(event.data)

asyncio.run(main())
```

#### INCORRECT: Synchronous iteration
```python
for event in workflow.run_stream("Write a poem"):  # Wrong — must use async for
    print(event)

result = workflow.run("Write a poem")  # Wrong — must await
```

#### Key Rules

- `workflow.run_stream()` must be used with `async for`.
- `workflow.run()` must be awaited.
- All orchestration patterns produce async event streams.
- There are no synchronous variants of any orchestration API.

---

## 1. Sequential Orchestration

### Correct

```python
from agent_framework import SequentialBuilder, WorkflowOutputEvent

workflow = SequentialBuilder().participants([writer, reviewer]).build()

output_evt: WorkflowOutputEvent | None = None
async for event in workflow.run_stream(prompt):
    if isinstance(event, WorkflowOutputEvent):
        output_evt = event
```

### Incorrect

```python
# Wrong: Using a non-existent class name
workflow = SequentialWorkflow([writer, reviewer])

# Wrong: Calling .run() instead of .run_stream()
result = await workflow.run(prompt)

# Wrong: Not using the builder pattern
workflow = SequentialBuilder([writer, reviewer]).build()
```

### Key Rules

- Use `SequentialBuilder().participants([...]).build()` — participants is a method call, not a constructor arg.
- Iterate with `async for event in workflow.run_stream(...)`.
- Collect results from `WorkflowOutputEvent`.
- Full conversation history flows to each participant automatically.
- Participants execute in the exact order passed to `.participants()`.

---

## 2. Concurrent Orchestration

### Correct

```python
from agent_framework import ConcurrentBuilder, WorkflowOutputEvent

workflow = ConcurrentBuilder().participants([researcher, marketer, legal]).build()

output_evt: WorkflowOutputEvent | None = None
async for event in workflow.run_stream(prompt):
    if isinstance(event, WorkflowOutputEvent):
        output_evt = event
```

### Correct — Custom Aggregator

```python
workflow = (
    ConcurrentBuilder()
    .participants([researcher, marketer, legal])
    .with_aggregator(summarize_results)
    .build()
)
```

### Incorrect

```python
# Wrong: Passing aggregator to constructor
workflow = ConcurrentBuilder(aggregator=summarize_results).participants([...]).build()

# Wrong: Using sequential pattern for concurrent
workflow = SequentialBuilder().participants([researcher, marketer, legal]).build()
```

### Key Rules

- Use `ConcurrentBuilder().participants([...]).build()`.
- All agents run in parallel on the same input.
- Default aggregation collects all messages; use `.with_aggregator(fn)` for custom synthesis.
- Agents and custom executors can be mixed as participants.

---

## 3. Group Chat Orchestration

### Correct — Function-Based Selector

```python
from agent_framework import GroupChatBuilder, GroupChatState

def round_robin_selector(state: GroupChatState) -> str:
    names = list(state.participants.keys())
    return names[state.current_round % len(names)]

workflow = (
    GroupChatBuilder()
    .with_select_speaker_func(round_robin_selector)
    .participants([researcher, writer])
    .with_termination_condition(lambda conversation: len(conversation) >= 4)
    .build()
)
```

### Correct — Agent-Based Orchestrator

```python
workflow = (
    GroupChatBuilder()
    .with_agent_orchestrator(orchestrator_agent)
    .with_termination_condition(
        lambda messages: sum(1 for msg in messages if msg.role == Role.ASSISTANT) >= 4
    )
    .participants([researcher, writer])
    .build()
)
```

### Incorrect

```python
# Wrong: Passing selector as constructor arg
workflow = GroupChatBuilder(selector=round_robin_selector).build()

# Wrong: Missing termination condition (may run forever)
workflow = GroupChatBuilder().with_select_speaker_func(fn).participants([...]).build()

# Wrong: Selector returns agent object instead of name string
def bad_selector(state: GroupChatState) -> ChatAgent:
    return state.participants["Writer"]
```

### Key Rules

- Selector function receives `GroupChatState` and must return a participant **name** (string).
- Use `.with_select_speaker_func(fn)` for function-based or `.with_agent_orchestrator(agent)` for agent-based selection.
- Always set `.with_termination_condition(fn)` to prevent infinite loops.
- Star topology: orchestrator in the center, agents as spokes.
- All agents see the full conversation history (context sync handled by orchestrator).

---

## 4. Magentic Orchestration

### Correct

```python
from agent_framework import MagenticBuilder

workflow = (
    MagenticBuilder()
    .participants([researcher_agent, coder_agent])
    .with_standard_manager(
        agent=manager_agent,
        max_round_count=10,
        max_stall_count=3,
        max_reset_count=2,
    )
    .build()
)
```

### Correct — With Plan Review

```python
workflow = (
    MagenticBuilder()
    .participants([researcher_agent, coder_agent])
    .with_standard_manager(agent=manager_agent, max_round_count=10, max_stall_count=1, max_reset_count=2)
    .with_plan_review()
    .build()
)
```

### Incorrect

```python
# Wrong: No manager specified
workflow = MagenticBuilder().participants([agent1, agent2]).build()

# Wrong: Including manager in participants list
workflow = (
    MagenticBuilder()
    .participants([researcher_agent, coder_agent, manager_agent])
    .with_standard_manager(agent=manager_agent, max_round_count=10)
    .build()
)
```

### Key Rules

- Manager agent is separate from participants — do not include it in `.participants()`.
- Use `.with_standard_manager(agent=..., max_round_count=..., max_stall_count=..., max_reset_count=...)`.
- `.with_plan_review()` enables human plan approval via `RequestInfoEvent` / `MagenticPlanReviewRequest`.
- Plan review responses use `event_data.approve()` or `event_data.revise(feedback)`.
- Handle `MagenticOrchestratorEvent` for progress tracking and `MagenticProgressLedger` for ledger data.

---

## 5. Handoff Orchestration

### Correct

```python
from agent_framework import HandoffBuilder

workflow = (
    HandoffBuilder(
        name="customer_support",
        participants=[triage_agent, refund_agent, order_agent],
    )
    .with_start_agent(triage_agent)
    .with_termination_condition(
        lambda conversation: len(conversation) > 0
        and "welcome" in conversation[-1].text.lower()
    )
    .build()
)
```

### Correct — Custom Handoff Rules

```python
workflow = (
    HandoffBuilder(name="support", participants=[triage, refund, order])
    .with_start_agent(triage)
    .add_handoff(triage, [refund, order])
    .add_handoff(refund, [triage])
    .add_handoff(order, [triage])
    .build()
)
```

### Correct — Autonomous Mode

```python
workflow = (
    HandoffBuilder(name="auto_support", participants=[triage, refund, order])
    .with_start_agent(triage)
    .with_autonomous_mode(
        agents=[triage],
        prompts={triage.name: "Continue with your best judgment."},
        turn_limits={triage.name: 3},
    )
    .build()
)
```

### Correct — Checkpointing

```python
from agent_framework import FileCheckpointStorage

storage = FileCheckpointStorage(storage_path="./checkpoints")
workflow = (
    HandoffBuilder(name="durable", participants=[triage, refund])
    .with_start_agent(triage)
    .with_checkpointing(storage)
    .build()
)
```

### Incorrect

```python
# Wrong: HandoffBuilder without name kwarg
workflow = HandoffBuilder(participants=[triage, refund]).build()

# Wrong: Missing .with_start_agent()
workflow = HandoffBuilder(name="support", participants=[triage, refund]).build()

# Wrong: Using GroupChatBuilder for handoff scenario
workflow = GroupChatBuilder().participants([triage, refund]).build()
```

### Key Rules

- `HandoffBuilder` requires `name` and `participants` as constructor args plus `.with_start_agent()`.
- Only `ChatAgent` with local tools execution is supported.
- Default: all agents can hand off to each other. Use `.add_handoff(from, [to])` to restrict.
- Request/response cycle: `RequestInfoEvent` with `HandoffAgentUserRequest` for user input.
- Use `HandoffAgentUserRequest.create_response(text)` to reply, `.terminate()` to end early.
- `.with_autonomous_mode()` auto-continues without user input; optionally scope to specific agents.
- `.with_checkpointing(storage)` persists state for long-running workflows.
- Tool approval: `@ai_function(approval_mode="always_require")` emits `FunctionApprovalRequestContent`.

---

## 6. Human-in-the-Loop (HITL)

### Correct

```python
from agent_framework import SequentialBuilder

builder = (
    SequentialBuilder()
    .participants([agent1, agent2, agent3])
    .with_request_info(agents=[agent2])
)
```

### Correct — Handling Responses

```python
from agent_framework import AgentRequestInfoResponse

# Approve agent output
response = AgentRequestInfoResponse.approve()

# Provide feedback
response = AgentRequestInfoResponse.from_strings(["Please be more concise"])

# Provide feedback as messages
response = AgentRequestInfoResponse.from_messages([feedback_message])
```

### Incorrect

```python
# Wrong: with_request_info without specifying agents
builder = SequentialBuilder().participants([a1, a2]).with_request_info()

# Wrong: Sending raw string as response
responses = {request_id: "looks good"}
```

### Key Rules

- `with_request_info(agents=[...])` on any builder enables HITL for specified agents.
- Agent output is routed through `AgentRequestInfoExecutor` subworkflow.
- Responses must be `AgentRequestInfoResponse` objects: `.approve()`, `.from_strings()`, or `.from_messages()`.
- Handoff orchestration has its own HITL design (`HandoffAgentUserRequest`, tool approval); do not mix patterns.
- `@ai_function(approval_mode="always_require")` integrates function approval into the HITL flow.

---

## 7. Event Handling

### Correct — Streaming Events

```python
from agent_framework import (
    AgentResponseUpdateEvent,
    AgentRunUpdateEvent,
    WorkflowOutputEvent,
)

async for event in workflow.run_stream(prompt):
    if isinstance(event, AgentResponseUpdateEvent):
        print(f"[{event.executor_id}]: {event.data}", end="", flush=True)
    elif isinstance(event, WorkflowOutputEvent):
        final_messages = event.data
```

### Correct — Magentic Events

```python
from agent_framework import MagenticOrchestratorEvent, MagenticProgressLedger

async for event in workflow.run_stream(task):
    if isinstance(event, MagenticOrchestratorEvent):
        if isinstance(event.data, MagenticProgressLedger):
            print(json.dumps(event.data.to_dict(), indent=2))
```

### Key Rules

- `WorkflowOutputEvent.data` contains `list[ChatMessage]` for most orchestrations.
- `AgentResponseUpdateEvent` / `AgentRunUpdateEvent` for streaming progress tokens.
- `RequestInfoEvent` for HITL pause points (both handoff and non-handoff).
- `MagenticOrchestratorEvent` for Magentic-specific planner events.

---

## 8. Pattern Selection

| Requirement | Correct Pattern |
|---|---|
| Fixed pipeline order | `SequentialBuilder` |
| Parallel independent analysis | `ConcurrentBuilder` |
| Iterative multi-agent refinement | `GroupChatBuilder` |
| Complex dynamic planning | `MagenticBuilder` |
| Dynamic routing / escalation | `HandoffBuilder` |
| Human approval overlay | Any builder + `.with_request_info()` |
| Durable long-running workflows | `HandoffBuilder` + `.with_checkpointing()` |
| Tool-level approval gates | `@ai_function(approval_mode="always_require")` |

