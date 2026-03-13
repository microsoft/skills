---
name: agents
description: "Build AI agents and multi-agent workflows with Foundry Local. Covers single agents with personas, multi-agent sequential pipelines, feedback loops, the Microsoft Agent Framework, and conversation history management. WHEN: foundry agent, AI agent local, multi-agent, agent orchestration, feedback loop, agent persona, system instructions, sequential pipeline, researcher writer editor, on-device agent, agent framework, FoundryLocalClient, AsAIAgent."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Foundry Local Agents & Multi-Agent Workflows

This skill provides patterns for building single agents and multi-agent workflows that run entirely on-device with Foundry Local.

## Triggers

Activate this skill when the user wants to:
- Create an AI agent with custom instructions and persona
- Build multi-agent pipelines (Researcher → Writer → Editor)
- Implement feedback loops between agents
- Use the Microsoft Agent Framework with Foundry Local
- Manage conversation history across agent interactions

## Rules

1. **Agents are stateless by default.** Multi-turn agents must explicitly maintain a `history` list.
2. **Use the Agent Framework when available** — it simplifies agent creation. Python uses `agent_framework_foundry_local`, C# uses `Microsoft.Agents.AI.OpenAI`.
3. **JavaScript has no high-level agent framework** — implement agents manually with OpenAI SDK + history management.
4. **Feedback loops need a retry limit** — prevent infinite loops with a max iteration count (typically 2-3).
5. For service setup, refer to **setup** skill.

---

## Single Agent — Using the Agent Framework

### Python (Recommended — Agent Framework)

```python
import asyncio
from agent_framework_foundry_local import FoundryLocalClient

async def main():
    alias = "phi-4-mini"

    # FoundryLocalClient handles service start, model download, and loading
    client = FoundryLocalClient(model_id=alias)

    # Create an agent with system instructions
    agent = client.as_agent(
        name="Joker",
        instructions="You are good at telling jokes.",
    )

    # Non-streaming
    result = await agent.run("Tell me a joke about a pirate.")
    print(result)

    # Streaming
    async for chunk in agent.run("Tell me a joke about a programmer.", stream=True):
        if chunk.text:
            print(chunk.text, end="", flush=True)

asyncio.run(main())
```

### C# (Recommended — Agent Framework)

```csharp
using Microsoft.Agents.AI;

// After setting up manager, model, and OpenAI client (see setup)...
AIAgent joker = client
    .GetChatClient(model.Id)
    .AsAIAgent(
        instructions: "You are good at telling jokes.",
        name: "Joker"
    );

// Non-streaming
var response = await joker.RunAsync("Tell me a joke about a pirate.");
Console.WriteLine(response);

// Streaming
await foreach (var chunk in joker.RunStreamingAsync("Tell me another joke."))
{
    Console.Write(chunk.Text);
}
```

### JavaScript (Manual — No Agent Framework)

```javascript
class ChatAgent {
    constructor(client, modelId, name, instructions) {
        this.client = client;
        this.modelId = modelId;
        this.name = name;
        this.history = [{ role: "system", content: instructions }];
    }

    async run(userMessage) {
        this.history.push({ role: "user", content: userMessage });

        const response = await this.client.chat.completions.create({
            model: this.modelId,
            messages: this.history,
            temperature: 0.7,
            max_tokens: 1024,
        });

        const reply = response.choices[0].message.content;
        this.history.push({ role: "assistant", content: reply });
        return reply;
    }
}

// Usage
const joker = new ChatAgent(client, modelInfo.id, "Joker", "You are good at telling jokes.");
const joke = await joker.run("Tell me a joke about a pirate.");
```

---

## Multi-Agent Pipeline — Sequential Workflow

The canonical multi-agent pattern is a sequential pipeline where each agent's output feeds the next:

```
Topic → [Researcher] → Research Notes → [Writer] → Draft → [Editor] → Verdict
```

### Python

```python
import asyncio
from agent_framework_foundry_local import FoundryLocalClient

async def main():
    client = FoundryLocalClient(model_id="phi-4-mini")

    researcher = client.as_agent(
        name="Researcher",
        instructions=(
            "You are a research assistant. When given a topic, provide a concise "
            "collection of key facts as bullet points."
        ),
    )

    writer = client.as_agent(
        name="Writer",
        instructions=(
            "You are a skilled blog writer. Using the research notes provided, "
            "write a short, engaging blog post (3-4 paragraphs)."
        ),
    )

    editor = client.as_agent(
        name="Editor",
        instructions=(
            "You are a senior editor. Review the blog post for clarity, grammar, "
            "and factual consistency. Provide a verdict: ACCEPT or REVISE."
        ),
    )

    topic = "The history of renewable energy"

    # Sequential pipeline
    research = await researcher.run(f"Research this topic:\n{topic}")
    draft = await writer.run(f"Write a blog post from these notes:\n\n{research}")
    verdict = await editor.run(
        f"Review this article.\n\nResearch notes:\n{research}\n\nArticle:\n{draft}"
    )

asyncio.run(main())
```

### C#

```csharp
AIAgent researcher = chatClient.AsAIAgent(
    name: "Researcher",
    instructions: "You are a research assistant. Provide key facts as bullet points.");

AIAgent writer = chatClient.AsAIAgent(
    name: "Writer",
    instructions: "You are a skilled blog writer. Write a short blog post.");

AIAgent editor = chatClient.AsAIAgent(
    name: "Editor",
    instructions: "Review the blog post. Provide a verdict: ACCEPT or REVISE.");

var topic = "The history of renewable energy";

var research = await researcher.RunAsync($"Research this topic:\n{topic}");
var draft = await writer.RunAsync($"Write a blog post from these notes:\n\n{research}");
var verdict = await editor.RunAsync(
    $"Review this article.\n\nResearch notes:\n{research}\n\nArticle:\n{draft}");
```

---

## Feedback Loop Pattern

Add a feedback loop where the Editor can reject the draft and trigger a rewrite:

```python
MAX_RETRIES = 2

for attempt in range(MAX_RETRIES + 1):
    draft = await writer.run(f"Write a blog post from these notes:\n\n{research}")

    verdict = await editor.run(
        f"Review this article.\n\nResearch:\n{research}\n\nArticle:\n{draft}"
    )

    if "ACCEPT" in verdict.upper():
        print("Article accepted!")
        break
    elif attempt < MAX_RETRIES:
        print(f"Revising (attempt {attempt + 2})...")
        research = await researcher.run(
            f"The editor wants revisions:\n{verdict}\n\nOriginal topic:\n{topic}"
        )
    else:
        print("Max retries reached — publishing best effort.")
```

---

## Agent Design Best Practices

| Practice | Rationale |
|----------|-----------|
| Give each agent a specific, focused persona | Broad instructions produce vague outputs |
| Include output format in instructions | "Organize as bullet points" or "Respond with ACCEPT or REVISE" |
| Pass context from previous agents explicitly | Agents don't share memory implicitly |
| Limit context passed between agents | Don't forward entire conversations — summarise |
| Set retry limits on feedback loops | Prevent infinite loops (2-3 retries is typical) |

---

## Production Pattern — Shared Configuration

For production apps (like the Zava Creative Writer), extract common configuration:

### Python (FastAPI service)
```python
# foundry_config.py — shared across all agents
from foundry_local import FoundryLocalManager

manager = FoundryLocalManager()
manager.start_service()

ALIAS = "phi-4-mini"
manager.load_model(ALIAS)

MODEL_ID = manager.get_model_info(ALIAS).id
ENDPOINT = manager.endpoint
API_KEY = manager.api_key
```

```python
# Each agent module imports the shared config
from foundry_config import MODEL_ID, ENDPOINT, API_KEY
```

---

## Key Packages

| Language | Package | Purpose |
|----------|---------|---------|
| Python | `agent-framework-foundry-local` | High-level agent abstraction with streaming |
| C# | `Microsoft.Agents.AI.OpenAI` | `AsAIAgent()` extension method |
| JavaScript | — | No framework; use OpenAI SDK directly |

---

## Cross-References

- For service setup, see **setup**
- For basic chat patterns, see **chat**
- For grounding agents with local data, see **rag**
- For testing agent quality, see **evaluation**
