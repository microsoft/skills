# Group Chat and Magentic Orchestration (Python)

This reference covers `GroupChatBuilder`, `MagenticBuilder`, orchestrator strategies, context synchronization, and Magentic plan review in Microsoft Agent Framework Python.

## Table of Contents

- [Group Chat Orchestration](#group-chat-orchestration)
  - [Differences from Other Patterns](#differences-from-other-patterns)
  - [Simple Round-Robin Selector](#simple-round-robin-selector)
  - [Agent-Based Orchestrator](#agent-based-orchestrator)
  - [Custom Speaker Selection Logic](#custom-speaker-selection-logic)
  - [Running the Workflow](#running-the-workflow)
  - [Context Synchronization](#context-synchronization)
- [Magentic Orchestration](#magentic-orchestration)
  - [Define Specialized Agents](#define-specialized-agents)
  - [Build the Magentic Workflow](#build-the-magentic-workflow)
  - [Run with Event Streaming](#run-with-event-streaming)
  - [Human-in-the-Loop Plan Review](#human-in-the-loop-plan-review)
  - [Magentic Execution Flow](#magentic-execution-flow)
  - [Key Concepts](#key-concepts)

---

## Group Chat Orchestration

Group chat models a collaborative conversation among multiple agents, coordinated by an orchestrator that selects the next speaker and controls conversation flow. Agents are arranged in a star topology with the orchestrator in the center.

### Differences from Other Patterns

- **Centralized coordination**: Unlike handoff, an orchestrator decides who speaks next.
- **Iterative refinement**: Agents review and build on each other's responses across multiple rounds.
- **Flexible speaker selection**: Round-robin, prompt-based, or custom logic.
- **Shared context**: All agents see the full conversation history.

### Simple Round-Robin Selector

```python
from agent_framework.azure import AzureOpenAIChatClient
from azure.identity import AzureCliCredential
from agent_framework import ChatAgent, GroupChatBuilder, GroupChatState, Role
from typing import cast

chat_client = AzureOpenAIChatClient(credential=AzureCliCredential())

researcher = ChatAgent(
    name="Researcher",
    description="Collects relevant background information.",
    instructions="Gather concise facts that help answer the question. Be brief and factual.",
    chat_client=chat_client,
)

writer = ChatAgent(
    name="Writer",
    description="Synthesizes polished answers using gathered information.",
    instructions="Compose clear, structured answers using any notes provided. Be comprehensive.",
    chat_client=chat_client,
)


def round_robin_selector(state: GroupChatState) -> str:
    """Picks the next speaker based on the current round index."""
    participant_names = list(state.participants.keys())
    return participant_names[state.current_round % len(participant_names)]


workflow = (
    GroupChatBuilder()
    .with_select_speaker_func(round_robin_selector)
    .participants([researcher, writer])
    .with_termination_condition(lambda conversation: len(conversation) >= 4)
    .build()
)
```

### Agent-Based Orchestrator

Use an agent as orchestrator for intelligent speaker selection with access to tools, context, and observability:

```python
orchestrator_agent = ChatAgent(
    name="Orchestrator",
    description="Coordinates multi-agent collaboration by selecting speakers",
    instructions="""
You coordinate a team conversation to solve the user's task.

Guidelines:
- Start with Researcher to gather information
- Then have Writer synthesize the final answer
- Only finish after both have contributed meaningfully
""",
    chat_client=chat_client,
)

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

### Custom Speaker Selection Logic

Implement selection based on conversation content:

```python
def smart_selector(state: GroupChatState) -> str:
    conversation = state.conversation
    last_message = conversation[-1] if conversation else None

    if not last_message:
        return "Researcher"

    last_text = last_message.text.lower()
    if "I have finished" in last_text and last_message.author_name == "Researcher":
        return "Writer"
    return "Researcher"


workflow = (
    GroupChatBuilder()
    .with_select_speaker_func(smart_selector, orchestrator_name="SmartOrchestrator")
    .participants([researcher, writer])
    .build()
)
```

### Running the Workflow

```python
from agent_framework import AgentResponseUpdateEvent, ChatMessage, WorkflowOutputEvent

task = "What are the key benefits of async/await in Python?"
final_conversation: list[ChatMessage] = []
last_executor_id: str | None = None

async for event in workflow.run_stream(task):
    if isinstance(event, AgentResponseUpdateEvent):
        eid = event.executor_id
        if eid != last_executor_id:
            if last_executor_id is not None:
                print()
            print(f"[{eid}]:", end=" ", flush=True)
            last_executor_id = eid
        print(event.data, end="", flush=True)
    elif isinstance(event, WorkflowOutputEvent):
        final_conversation = cast(list[ChatMessage], event.data)

if final_conversation:
    for msg in final_conversation:
        author = getattr(msg, "author_name", "Unknown")
        text = getattr(msg, "text", str(msg))
        print(f"\n[{author}]\n{text}\n{'-' * 80}")
```

### Context Synchronization

Agents in group chat do not share the same thread instance. The orchestrator synchronizes context by:

1. Broadcasting each agent's response to all other participants after every turn.
2. Ensuring each agent has the full conversation history before its next turn.
3. Sending a request to the selected agent with the complete context.

---

## Magentic Orchestration

Magentic orchestration is inspired by [Magentic-One](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/magentic-one.html). A planner/manager coordinates specialized agents dynamically based on evolving context, task progress, and agent capabilities. The architecture is similar to group chat but with a planning-based manager.

### Define Specialized Agents

```python
from agent_framework import ChatAgent, HostedCodeInterpreterTool
from agent_framework.openai import OpenAIChatClient, OpenAIResponsesClient

researcher_agent = ChatAgent(
    name="ResearcherAgent",
    description="Specialist in research and information gathering",
    instructions=(
        "You are a Researcher. You find information without additional computation or quantitative analysis."
    ),
    chat_client=OpenAIChatClient(model_id="gpt-4o-search-preview"),
)

coder_agent = ChatAgent(
    name="CoderAgent",
    description="A helpful assistant that writes and executes code to process and analyze data.",
    instructions="You solve questions using code. Please provide detailed analysis and computation process.",
    chat_client=OpenAIResponsesClient(),
    tools=HostedCodeInterpreterTool(),
)

manager_agent = ChatAgent(
    name="MagenticManager",
    description="Orchestrator that coordinates the research and coding workflow",
    instructions="You coordinate a team to complete complex tasks efficiently.",
    chat_client=OpenAIChatClient(),
)
```

### Build the Magentic Workflow

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

### Run with Event Streaming

```python
import json
import asyncio
from typing import cast

from agent_framework import (
    AgentRunUpdateEvent,
    ChatMessage,
    MagenticOrchestratorEvent,
    MagenticProgressLedger,
    WorkflowOutputEvent,
)

task = (
    "I am preparing a report on the energy efficiency of different machine learning model architectures. "
    "Compare the estimated training and inference energy consumption of ResNet-50, BERT-base, and GPT-2 "
    "on standard datasets. Then, estimate the CO2 emissions associated with each, assuming training on "
    "an Azure Standard_NC6s_v3 VM for 24 hours. Provide tables for clarity, and recommend the most "
    "energy-efficient model per task type."
)

last_message_id: str | None = None
output_event: WorkflowOutputEvent | None = None

async for event in workflow.run_stream(task):
    if isinstance(event, AgentRunUpdateEvent):
        message_id = event.data.message_id
        if message_id != last_message_id:
            if last_message_id is not None:
                print("\n")
            print(f"- {event.executor_id}:", end=" ", flush=True)
            last_message_id = message_id
        print(event.data, end="", flush=True)

    elif isinstance(event, MagenticOrchestratorEvent):
        print(f"\n[Magentic Orchestrator Event] Type: {event.event_type.name}")
        if isinstance(event.data, MagenticProgressLedger):
            print(f"Please review progress ledger:\n{json.dumps(event.data.to_dict(), indent=2)}")
        else:
            print(f"Unknown data type in MagenticOrchestratorEvent: {type(event.data)}")
        await asyncio.get_event_loop().run_in_executor(None, input, "Press Enter to continue...")

    elif isinstance(event, WorkflowOutputEvent):
        output_event = event

output_messages = cast(list[ChatMessage], output_event.data)
output = output_messages[-1].text
print(output)
```

### Human-in-the-Loop Plan Review

Enable plan review so humans can approve or revise the manager's plan before execution:

```python
from agent_framework import (
    MagenticBuilder,
    MagenticPlanReviewRequest,
    RequestInfoEvent,
)

workflow = (
    MagenticBuilder()
    .participants([researcher_agent, coder_agent])
    .with_standard_manager(
        agent=manager_agent,
        max_round_count=10,
        max_stall_count=1,
        max_reset_count=2,
    )
    .with_plan_review()
    .build()
)
```

Plan review requests arrive as `RequestInfoEvent` with `MagenticPlanReviewRequest` data. Handle them in the event stream:

```python
pending_request: RequestInfoEvent | None = None
pending_responses: dict | None = None
output_event: WorkflowOutputEvent | None = None

while not output_event:
    if pending_responses is not None:
        stream = workflow.send_responses_streaming(pending_responses)
    else:
        stream = workflow.run_stream(task)

    last_message_id: str | None = None
    async for event in stream:
        if isinstance(event, AgentRunUpdateEvent):
            message_id = event.data.message_id
            if message_id != last_message_id:
                if last_message_id is not None:
                    print("\n")
                print(f"- {event.executor_id}:", end=" ", flush=True)
                last_message_id = message_id
            print(event.data, end="", flush=True)

        elif isinstance(event, RequestInfoEvent) and event.request_type is MagenticPlanReviewRequest:
            pending_request = event

        elif isinstance(event, WorkflowOutputEvent):
            output_event = event

    pending_responses = None

    if pending_request is not None:
        event_data = cast(MagenticPlanReviewRequest, pending_request.data)
        print("\n\n[Magentic Plan Review Request]")
        if event_data.current_progress is not None:
            print("Current Progress Ledger:")
            print(json.dumps(event_data.current_progress.to_dict(), indent=2))
            print()
        print(f"Proposed Plan:\n{event_data.plan.text}\n")
        print("Please provide your feedback (press Enter to approve):")

        reply = await asyncio.get_event_loop().run_in_executor(None, input, "> ")
        if reply.strip() == "":
            print("Plan approved.\n")
            pending_responses = {pending_request.request_id: event_data.approve()}
        else:
            print("Plan revised by human.\n")
            pending_responses = {pending_request.request_id: event_data.revise(reply)}
        pending_request = None
```

### Magentic Execution Flow

1. **Planning**: Manager analyzes the task and creates an initial plan.
2. **Optional plan review**: Humans can approve or revise the plan.
3. **Agent selection**: Manager selects the appropriate agent for each subtask.
4. **Execution**: Selected agent runs its portion.
5. **Progress assessment**: Manager evaluates progress and updates the plan.
6. **Stall detection**: If progress stalls, auto-replan with optional human review.
7. **Iteration**: Steps 3–6 repeat until task completion or limits.
8. **Final synthesis**: Manager combines agent outputs into a final result.

### Key Concepts

- **Dynamic coordination**: Manager selects agents based on context.
- **Iterative refinement**: Multiple rounds of reasoning, research, and computation.
- **Progress tracking**: Built-in stall detection and plan reset.
- **Flexible collaboration**: Agents can be invoked multiple times in any order.
- **Human oversight**: Optional plan review via `with_plan_review()`.
