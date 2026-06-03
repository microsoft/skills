# PRA scenario framework

Use PRA to design a balanced evaluation suite. PRA is a test-design taxonomy, not a set of evaluator names.

## Perceive

Perceive scenarios test whether the agent finds, uses, and cites the right information.

Good prompts:

```text
Summarize the latest status for the Contoso renewal and cite the source.
What risks were identified in the most recent planning discussion?
List the open action items with owners, using only available source data.
```

Useful evaluators:

| Evaluator | Why |
|---|---|
| `Groundedness` | Checks support from source/context. |
| `Citations` | Checks that required citations are present. |
| `Relevance` | Checks that the answer addresses the request. |

Common fixes: improve grounding instructions, clarify source priority, require citations, or update the agent's knowledge/action configuration.

## Reason

Reason scenarios test synthesis, instruction following, ambiguity handling, and refusal behavior.

Good prompts:

```text
Compare the two proposed launch plans and recommend the lower-risk option.
The request is ambiguous: ask one clarifying question before answering.
Create a concise executive summary from the available project context.
```

Useful evaluators:

| Evaluator | Why |
|---|---|
| `Relevance` | Checks that reasoning addresses the ask. |
| `Coherence` | Checks clarity and structure. |
| `Similarity` | Checks alignment with an expected conclusion. |
| `PartialMatch` | Checks that key terms or decisions are present without requiring exact text. |

Common fixes: add response-format guidance, examples, ambiguity rules, refusal guidance, or priority rules for conflicting evidence.

## Act

Act scenarios test declared capability behavior, such as whether the agent can produce the expected final artifact, answer, or action-oriented output.

Good prompts:

```text
Draft a follow-up message with the three agreed actions.
Return only the escalation ticket ID.
Create a prioritized list of next steps for the renewal owner.
```

Useful evaluators:

| Evaluator | Why |
|---|---|
| `ExactMatch` | Best for deterministic IDs or labels. |
| `PartialMatch` | Best for key-term coverage. |
| `Similarity` | Best for flexible expected outputs. |
| `Relevance` | Checks that the action output matches the prompt. |
| `Coherence` | Checks structure and readability. |

Do not use legacy/private action-specific evaluator names in authored datasets unless the current public schema explicitly supports them.

## Suite balance

A strong suite usually includes:

1. Happy-path prompts for the most important user jobs.
2. Edge cases where data is missing, ambiguous, stale, or conflicting.
3. Citation/grounding prompts for answers based on workplace data.
4. Deterministic output prompts for IDs, dates, statuses, or labels.
5. Multi-turn prompts that require follow-up context.
6. Regression prompts for bugs found in production feedback.

Use `metadata.tags` or item `extensions` to label PRA coverage.

Example item metadata:

```json
{
  "prompt": "Who owns the next step for the Contoso renewal?",
  "expected_response": "The agent identifies the owner only if source data supports it.",
  "evaluators": {
    "Groundedness": {},
    "Citations": {}
  },
  "extensions": {
    "pra": "perceive",
    "risk": "unsupported-owner"
  }
}
```
