# Sequential and Concurrent Orchestration (Python)

This reference covers `SequentialBuilder`, `ConcurrentBuilder`, custom aggregators, and mixing agents with executors in Microsoft Agent Framework Python.

---

## Sequential Orchestration

Sequential orchestration arranges agents in a pipeline. Each agent processes the task in turn, passing output to the next. Full conversation history is passed to each participant, so later agents see all prior messages.

### Writer→Reviewer Pattern

```python
from agent_framework.azure import AzureOpenAIChatClient
from azure.identity import AzureCliCredential
from agent_framework import SequentialBuilder, ChatMessage, WorkflowOutputEvent, Role
from typing import Any

chat_client = AzureOpenAIChatClient(credential=AzureCliCredential())

writer = chat_client.as_agent(
    instructions=(
        "You are a concise copywriter. Provide a single, punchy marketing sentence based on the prompt."
    ),
    name="writer",
)

reviewer = chat_client.as_agent(
    instructions=(
        "You are a thoughtful reviewer. Give brief feedback on the previous assistant message."
    ),
    name="reviewer",
)

# Build sequential workflow: writer -> reviewer
workflow = SequentialBuilder().participants([writer, reviewer]).build()

# Run and collect final conversation
output_evt: WorkflowOutputEvent | None = None
async for event in workflow.run_stream("Write a tagline for a budget-friendly eBike."):
    if isinstance(event, WorkflowOutputEvent):
        output_evt = event

if output_evt:
    messages: list[ChatMessage] | Any = output_evt.data
    for i, msg in enumerate(messages, start=1):
        name = msg.author_name or ("assistant" if msg.role == Role.ASSISTANT else "user")
        print(f"{i:02d} [{name}]\n{msg.text}\n{'-' * 60}")
```

### Shared Conversation History

The full conversation from previous agents is passed to the next in the sequence. Each agent sees all prior messages and adds its own response. Order is strictly defined by the `participants()` list.

### Mixing Agents and Custom Executors

Sequential orchestration supports mixing agents with custom executors. Define an executor that consumes the conversation and appends its output:

```python
from agent_framework import Executor, WorkflowContext, handler, ChatMessage, Role

class Summarizer(Executor):
    """Simple summarizer: consumes full conversation and appends an assistant summary."""

    @handler
    async def summarize(
        self,
        conversation: list[ChatMessage],
        ctx: WorkflowContext[list[ChatMessage]],
    ) -> None:
        users = sum(1 for m in conversation if m.role == Role.USER)
        assistants = sum(1 for m in conversation if m.role == Role.ASSISTANT)
        summary = ChatMessage(
            role=Role.ASSISTANT,
            text=f"Summary -> users:{users} assistants:{assistants}",
        )
        await ctx.send_message(list(conversation) + [summary])
```

Build a mixed pipeline:

```python
content = chat_client.as_agent(
    instructions="Produce a concise paragraph answering the user's request.",
    name="content",
)

summarizer = Summarizer(id="summarizer")
workflow = SequentialBuilder().participants([content, summarizer]).build()
```

### Key Concepts

- **Shared context**: Each participant receives the full conversation history.
- **Order matters**: Agents execute in the order specified in `participants()`.
- **Flexible participants**: Mix agents and custom executors in any order.
- **Conversation flow**: Each participant appends to the conversation.

---

## Concurrent Orchestration

Concurrent orchestration runs multiple agents on the same task in parallel. Each agent processes the input independently; results are collected and optionally aggregated.

### Research/Marketing/Legal Example

```python
from agent_framework.azure import AzureOpenAIChatClient
from azure.identity import AzureCliCredential
from agent_framework import ConcurrentBuilder, ChatMessage, WorkflowOutputEvent
from typing import Any

chat_client = AzureOpenAIChatClient(credential=AzureCliCredential())

researcher = chat_client.as_agent(
    instructions=(
        "You're an expert market and product researcher. Given a prompt, provide concise, factual insights,"
        " opportunities, and risks."
    ),
    name="researcher",
)

marketer = chat_client.as_agent(
    instructions=(
        "You're a creative marketing strategist. Craft compelling value propositions and target messaging"
        " aligned to the prompt."
    ),
    name="marketer",
)

legal = chat_client.as_agent(
    instructions=(
        "You're a cautious legal/compliance reviewer. Highlight constraints, disclaimers, and policy concerns"
        " based on the prompt."
    ),
    name="legal",
)

# Build concurrent workflow
workflow = ConcurrentBuilder().participants([researcher, marketer, legal]).build()

# Run and collect aggregated results
output_evt: WorkflowOutputEvent | None = None
async for event in workflow.run_stream(
    "We are launching a new budget-friendly electric bike for urban commuters."
):
    if isinstance(event, WorkflowOutputEvent):
        output_evt = event

if output_evt:
    messages: list[ChatMessage] | Any = output_evt.data
    for i, msg in enumerate(messages, start=1):
        name = msg.author_name if msg.author_name else "user"
        print(f"{i:02d} [{name}]:\n{msg.text}\n{'-' * 60}")
```

### Custom Executors Wrapping Agents

Wrap agents in custom executors when you need more control over initialization and request handling:

```python
from agent_framework import (
    AgentExecutorRequest,
    AgentExecutorResponse,
    ChatAgent,
    Executor,
    WorkflowContext,
    handler,
)

class ResearcherExec(Executor):
    agent: ChatAgent

    def __init__(self, chat_client: AzureOpenAIChatClient, id: str = "researcher"):
        agent = chat_client.as_agent(
            instructions=(
                "You're an expert market and product researcher. Given a prompt, provide concise, factual insights,"
                " opportunities, and risks."
            ),
            name=id,
        )
        super().__init__(agent=agent, id=id)

    @handler
    async def run(
        self, request: AgentExecutorRequest, ctx: WorkflowContext[AgentExecutorResponse]
    ) -> None:
        response = await self.agent.run(request.messages)
        full_conversation = list(request.messages) + list(response.messages)
        await ctx.send_message(
            AgentExecutorResponse(self.id, response, full_conversation=full_conversation)
        )
```

Pattern is analogous for `MarketerExec` and `LegalExec`. Build with:

```python
researcher = ResearcherExec(chat_client)
marketer = MarketerExec(chat_client)
legal = LegalExec(chat_client)
workflow = ConcurrentBuilder().participants([researcher, marketer, legal]).build()
```

### Custom Aggregator

By default, concurrent orchestration aggregates all agent responses into a list of messages. Override with a custom aggregator to synthesize results (e.g., via an LLM):

```python
from agent_framework import ChatMessage, Role

async def summarize_results(results: list[Any]) -> str:
    expert_sections: list[str] = []
    for r in results:
        try:
            messages = getattr(r.agent_run_response, "messages", [])
            final_text = (
                messages[-1].text
                if messages and hasattr(messages[-1], "text")
                else "(no content)"
            )
            expert_sections.append(
                f"{getattr(r, 'executor_id', 'expert')}:\n{final_text}"
            )
        except Exception as e:
            expert_sections.append(
                f"{getattr(r, 'executor_id', 'expert')}: (error: {type(e).__name__}: {e})"
            )

    system_msg = ChatMessage(
        Role.SYSTEM,
        text=(
            "You are a helpful assistant that consolidates multiple domain expert outputs "
            "into one cohesive, concise summary with clear takeaways. Keep it under 200 words."
        ),
    )
    user_msg = ChatMessage(Role.USER, text="\n\n".join(expert_sections))

    response = await chat_client.get_response([system_msg, user_msg])
    return response.messages[-1].text if response.messages else ""
```

Build workflow with custom aggregator:

```python
workflow = (
    ConcurrentBuilder()
    .participants([researcher, marketer, legal])
    .with_aggregator(summarize_results)
    .build()
)

output_evt: WorkflowOutputEvent | None = None
async for event in workflow.run_stream(
    "We are launching a new budget-friendly electric bike for urban commuters."
):
    if isinstance(event, WorkflowOutputEvent):
        output_evt = event

if output_evt:
    # With custom aggregator, data may be the aggregated string
    print("===== Final Consolidated Output =====")
    print(output_evt.data)
```

### Key Concepts

- **Parallel execution**: All agents run on the same input simultaneously and independently.
- **Result aggregation**: Default aggregation collects messages; use `.with_aggregator()` for custom synthesis.
- **Flexible participants**: Use agents directly or wrap them in custom executors.
- **Custom processing**: Override the default aggregator for domain-specific synthesis.
