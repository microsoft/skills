# Handoff and Human-in-the-Loop (Python)

This reference covers `HandoffBuilder`, autonomous mode, tool approval, checkpointing, context synchronization, and Human-in-the-Loop (HITL) patterns in Microsoft Agent Framework Python. It also clarifies differences between handoff and agent-as-tools.

## Table of Contents

- [Handoff Orchestration](#handoff-orchestration)
  - [Handoff vs Agent-as-Tools](#handoff-vs-agent-as-tools)
  - [Basic Handoff Setup](#basic-handoff-setup)
  - [Build Handoff Workflow](#build-handoff-workflow)
  - [Custom Handoff Rules](#custom-handoff-rules)
  - [Request/Response Cycle](#requestresponse-cycle)
  - [Autonomous Mode](#autonomous-mode)
  - [Tool Approval](#tool-approval)
  - [Checkpointing for Durable Workflows](#checkpointing-for-durable-workflows)
  - [Context Synchronization](#context-synchronization)
- [Human-in-the-Loop (HITL)](#human-in-the-loop-hitl)
  - [Feedback vs Approval](#feedback-vs-approval)
  - [Enable HITL with with_request_info()](#enable-hitl-with-with_request_info)
  - [Subset of Agents](#subset-of-agents)
  - [Function Approval with HITL](#function-approval-with-hitl)
  - [Key Concepts](#key-concepts)

---

## Handoff Orchestration

Handoff orchestration uses a mesh topology: agents are connected directly without a central orchestrator. Each agent can hand off the conversation to another based on context. Handoff orchestration supports only `ChatAgent` with local tools execution.

### Handoff vs Agent-as-Tools

| Aspect | Handoff | Agent-as-Tools |
|--------|---------|----------------|
| **Control flow** | Control passes between agents based on rules; no central authority | Primary agent delegates subtasks; control returns to primary after each subtask |
| **Task ownership** | Receiving agent takes full ownership | Primary agent retains overall responsibility |
| **Context** | Full conversation handed off; receiving agent has full context | Primary manages context; may pass only relevant information to tool agents |

### Basic Handoff Setup

```python
from typing import Annotated
from agent_framework import ai_function
from agent_framework.azure import AzureOpenAIChatClient
from azure.identity import AzureCliCredential

# Define tools for demonstration
@ai_function
def process_refund(order_number: Annotated[str, "Order number to process refund for"]) -> str:
    """Simulated function to process a refund for a given order number."""
    return f"Refund processed successfully for order {order_number}."


@ai_function
def check_order_status(order_number: Annotated[str, "Order number to check status for"]) -> str:
    """Simulated function to check the status of a given order number."""
    return f"Order {order_number} is currently being processed and will ship in 2 business days."


@ai_function
def process_return(order_number: Annotated[str, "Order number to process return for"]) -> str:
    """Simulated function to process a return for a given order number."""
    return f"Return initiated successfully for order {order_number}. You will receive return instructions via email."


chat_client = AzureOpenAIChatClient(credential=AzureCliCredential())

# Create triage/coordinator agent
triage_agent = chat_client.as_agent(
    instructions=(
        "You are frontline support triage. Route customer issues to the appropriate specialist agents "
        "based on the problem described."
    ),
    description="Triage agent that handles general inquiries.",
    name="triage_agent",
)

refund_agent = chat_client.as_agent(
    instructions="You process refund requests.",
    description="Agent that handles refund requests.",
    name="refund_agent",
    tools=[process_refund],
)

order_agent = chat_client.as_agent(
    instructions="You handle order and shipping inquiries.",
    description="Agent that handles order tracking and shipping issues.",
    name="order_agent",
    tools=[check_order_status],
)

return_agent = chat_client.as_agent(
    instructions="You manage product return requests.",
    description="Agent that handles return processing.",
    name="return_agent",
    tools=[process_return],
)
```

### Build Handoff Workflow

```python
from agent_framework import HandoffBuilder

# Default: all agents can handoff to each other
workflow = (
    HandoffBuilder(
        name="customer_support_handoff",
        participants=[triage_agent, refund_agent, order_agent, return_agent],
    )
    .with_start_agent(triage_agent)
    .with_termination_condition(
        lambda conversation: len(conversation) > 0
        and "welcome" in conversation[-1].text.lower()
    )
    .build()
)
```

### Custom Handoff Rules

Restrict which agents can hand off to which:

```python
workflow = (
    HandoffBuilder(
        name="customer_support_handoff",
        participants=[triage_agent, refund_agent, order_agent, return_agent],
    )
    .with_start_agent(triage_agent)
    .with_termination_condition(
        lambda conversation: len(conversation) > 0
        and "welcome" in conversation[-1].text.lower()
    )
    .add_handoff(triage_agent, [order_agent, return_agent])
    .add_handoff(return_agent, [refund_agent])
    .add_handoff(order_agent, [triage_agent])
    .add_handoff(return_agent, [triage_agent])
    .add_handoff(refund_agent, [triage_agent])
    .build()
)
```

> Agents still share context in a mesh; handoff rules only govern which agent can take over the conversation next.

### Request/Response Cycle

Handoff is interactive: when an agent does not hand off (no handoff tool call), the workflow emits a `RequestInfoEvent` with `HandoffAgentUserRequest` and waits for user input to continue.

```python
from agent_framework import RequestInfoEvent, HandoffAgentUserRequest, WorkflowOutputEvent

events = [event async for event in workflow.run_stream("I need help with my order")]

pending_requests = []
for event in events:
    if isinstance(event, RequestInfoEvent) and isinstance(event.data, HandoffAgentUserRequest):
        pending_requests.append(event)
        request_data = event.data
        print(f"Agent {event.source_executor_id} is awaiting your input")
        for msg in request_data.agent_response.messages[-3:]:
            print(f"{msg.author_name}: {msg.text}")

while pending_requests:
    user_input = input("You: ")
    responses = {
        req.request_id: HandoffAgentUserRequest.create_response(user_input)
        for req in pending_requests
    }
    events = [event async for event in workflow.send_responses_streaming(responses)]

    pending_requests = []
    for event in events:
        if isinstance(event, RequestInfoEvent) and isinstance(event.data, HandoffAgentUserRequest):
            pending_requests.append(event)
```

Use `HandoffAgentUserRequest.terminate()` to end the workflow early.

### Autonomous Mode

Enable autonomous mode so the workflow continues when an agent does not hand off, without waiting for human input. A default message (e.g., "User did not respond. Continue assisting autonomously.") is sent automatically.

```python
workflow = (
    HandoffBuilder(
        name="autonomous_customer_support",
        participants=[triage_agent, refund_agent, order_agent, return_agent],
    )
    .with_start_agent(triage_agent)
    .with_autonomous_mode()
    .build()
)
```

Restrict to a subset of agents:

```python
workflow = (
    HandoffBuilder(
        name="partially_autonomous_support",
        participants=[triage_agent, refund_agent, order_agent, return_agent],
    )
    .with_start_agent(triage_agent)
    .with_autonomous_mode(agents=[triage_agent])
    .build()
)
```

Customize the default response and turn limits:

```python
workflow = (
    HandoffBuilder(
        name="custom_autonomous_support",
        participants=[triage_agent, refund_agent, order_agent, return_agent],
    )
    .with_start_agent(triage_agent)
    .with_autonomous_mode(
        agents=[triage_agent],
        prompts={triage_agent.name: "Continue with your best judgment as the user is unavailable."},
        turn_limits={triage_agent.name: 3},
    )
    .build()
)
```

### Tool Approval

Use `@ai_function(approval_mode="always_require")` for sensitive operations:

```python
@ai_function(approval_mode="always_require")
def process_refund(order_number: Annotated[str, "Order number to process refund for"]) -> str:
    """Simulated function to process a refund for a given order number."""
    return f"Refund processed successfully for order {order_number}."
```

When an agent calls such a tool, the workflow emits `FunctionApprovalRequestContent`. Handle both user input and tool approval:

```python
from agent_framework import (
    FunctionApprovalRequestContent,
    HandoffBuilder,
    HandoffAgentUserRequest,
    RequestInfoEvent,
    WorkflowOutputEvent,
)

workflow = (
    HandoffBuilder(
        name="support_with_approvals",
        participants=[triage_agent, refund_agent, order_agent],
    )
    .with_start_agent(triage_agent)
    .build()
)

pending_requests: list[RequestInfoEvent] = []

async for event in workflow.run_stream("My order 12345 arrived damaged. I need a refund."):
    if isinstance(event, RequestInfoEvent):
        pending_requests.append(event)

while pending_requests:
    responses: dict[str, object] = {}

    for request in pending_requests:
        if isinstance(request.data, HandoffAgentUserRequest):
            print(f"Agent {request.source_executor_id} asks:")
            for msg in request.data.agent_response.messages[-2:]:
                print(f"  {msg.author_name}: {msg.text}")
            user_input = input("You: ")
            responses[request.request_id] = HandoffAgentUserRequest.create_response(user_input)

        elif isinstance(request.data, FunctionApprovalRequestContent):
            func_call = request.data.function_call
            args = func_call.parse_arguments() or {}
            print(f"\nTool approval requested: {func_call.name}")
            print(f"Arguments: {args}")
            approval = input("Approve? (y/n): ").strip().lower() == "y"
            responses[request.request_id] = request.data.create_response(approved=approval)

    pending_requests = []
    async for event in workflow.send_responses_streaming(responses):
        if isinstance(event, RequestInfoEvent):
            pending_requests.append(event)
        elif isinstance(event, WorkflowOutputEvent):
            print("\nWorkflow completed!")
```

### Checkpointing for Durable Workflows

Use checkpointing for long-running workflows where approvals may happen hours or days later:

```python
from agent_framework import FileCheckpointStorage

storage = FileCheckpointStorage(storage_path="./checkpoints")

workflow = (
    HandoffBuilder(
        name="durable_support",
        participants=[triage_agent, refund_agent, order_agent],
    )
    .with_start_agent(triage_agent)
    .with_checkpointing(storage)
    .build()
)

# Initial run - workflow pauses when approval is needed
pending_requests = []
async for event in workflow.run_stream("I need a refund for order 12345"):
    if isinstance(event, RequestInfoEvent):
        pending_requests.append(event)

# Process can exit; checkpoint is saved automatically.

# Later: resume from checkpoint
checkpoints = await storage.list_checkpoints()
latest = sorted(checkpoints, key=lambda c: c.timestamp, reverse=True)[0]

restored_requests = []
async for event in workflow.run_stream(checkpoint_id=latest.checkpoint_id):
    if isinstance(event, RequestInfoEvent):
        restored_requests.append(event)

responses = {}
for req in restored_requests:
    if isinstance(req.data, FunctionApprovalRequestContent):
        responses[req.request_id] = req.data.create_response(approved=True)
    elif isinstance(req.data, HandoffAgentUserRequest):
        responses[req.request_id] = HandoffAgentUserRequest.create_response(
            "Yes, please process the refund."
        )

async for event in workflow.send_responses_streaming(responses):
    if isinstance(event, WorkflowOutputEvent):
        print("Refund workflow completed!")
```

### Context Synchronization

Participants broadcast user and agent messages to all others to keep context consistent. Tool-related content (including handoff tool calls) is not broadcast. After broadcasting, the participant checks whether to hand off; if not, it requests user input or continues autonomously based on workflow configuration.

---

## Human-in-the-Loop (HITL)

HITL allows workflows to pause and request human input before proceeding. Use it for feedback on agent output or approval of sensitive actions. Handoff orchestration has its own HITL design (e.g., `HandoffAgentUserRequest`, tool approval); this section covers HITL for other orchestrations.

### Feedback vs Approval

1. **Feedback**: Human provides feedback on agent output; it is sent back to the agent for refinement. Use `AgentRequestInfoResponse.from_messages()` or `AgentRequestInfoResponse.from_strings()`.
2. **Approval**: Human approves agent output; the subworkflow continues. Use `AgentRequestInfoResponse.approve()`.

### Enable HITL with `with_request_info()`

When HITL is enabled, agent participants are wired through an `AgentRequestInfoExecutor` subworkflow. Agent output is sent as a request; the workflow waits for an `AgentRequestInfoResponse` before continuing.

```python
from agent_framework import SequentialBuilder

builder = (
    SequentialBuilder()
    .participants([agent1, agent2, agent3])
    .with_request_info(agents=[agent2])
)
```

### Subset of Agents

Apply HITL only to specific agents by passing agent IDs to `with_request_info()`:

```python
builder = (
    SequentialBuilder()
    .participants([agent1, agent2, agent3])
    .with_request_info(agents=[agent2])
)
```

### Function Approval with HITL

When agents call functions with `@ai_function(approval_mode="always_require")`, the HITL mechanism integrates function approval requests. The workflow emits `FunctionApprovalRequestContent` and pauses until the user approves or rejects the call. The user response is sent back to the agent to continue.

```python
from agent_framework import ai_function
from typing import Annotated

@ai_function(approval_mode="always_require")
def sensitive_operation(param: Annotated[str, "Parameter description"]) -> str:
    """Performs a sensitive operation requiring human approval."""
    return f"Operation completed with {param}"
```

### Key Concepts

- **AgentRequestInfoExecutor**: Subworkflow component that sends agent output as requests and waits for responses.
- **with_request_info(agents=[...])**: Enables HITL; optionally specify which agents require human interaction.
- **AgentRequestInfoResponse**: Use `approve()` to proceed, or `from_messages()` / `from_strings()` for feedback.
- **@ai_function(approval_mode="always_require")**: Marks tools that require human approval before execution.
