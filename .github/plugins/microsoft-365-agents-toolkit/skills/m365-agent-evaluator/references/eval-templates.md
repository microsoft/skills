# Evaluation dataset templates

Use these templates when creating or editing `@microsoft/m365-copilot-eval` datasets. The current public schema uses `schemaVersion: "1.2.0"` and a root `items` array.

Use `references\prompts-schema.json` as the local schema source.

## Minimal single-turn dataset

```json
{
  "schemaVersion": "1.2.0",
  "metadata": {
    "name": "Agent starter evaluation",
    "description": "Smoke tests for core agent behavior.",
    "tags": ["starter", "single-turn"]
  },
  "default_evaluators": {
    "Relevance": {},
    "Coherence": {}
  },
  "items": [
    {
      "prompt": "What can this agent help me with?",
      "expected_response": "The agent explains its supported scope without claiming unsupported capabilities."
    },
    {
      "prompt": "Summarize the latest status for Contoso renewal.",
      "expected_response": "The agent summarizes available status and avoids inventing facts when source data is unavailable."
    }
  ]
}
```

## Single-turn item with context and groundedness

Use `context` when you have source material the answer must stay grounded in.

```json
{
  "prompt": "What is the renewal deadline?",
  "expected_response": "The renewal deadline is May 31.",
  "context": "The Contoso renewal brief says the renewal deadline is May 31.",
  "evaluators": {
    "Groundedness": {
      "threshold": 4
    },
    "Similarity": {
      "threshold": 3
    }
  },
  "evaluators_mode": "extend"
}
```

`evaluators_mode: "extend"` adds item-level evaluators to `default_evaluators`. Use `"replace"` when the item should use only the item-level evaluator set.

## Evaluator threshold examples

Public configurable evaluator names are case-sensitive:

```json
{
  "default_evaluators": {
    "Relevance": {
      "threshold": 3
    },
    "Coherence": {
      "threshold": 3
    },
    "Groundedness": {
      "threshold": 3
    },
    "Similarity": {
      "threshold": 3
    },
    "Citations": {
      "threshold": 1
    },
    "PartialMatch": {
      "threshold": 0.5
    }
  }
}
```

Use `ExactMatch` sparingly. It is best for deterministic values such as IDs, dates, or fixed policy labels:

```json
{
  "prompt": "Return only the ticket ID for the escalation.",
  "expected_response": "INC-12345",
  "evaluators": {
    "ExactMatch": {}
  },
  "evaluators_mode": "replace"
}
```

## Multi-turn dataset

Use multi-turn items when the agent must preserve context across a conversation. The schema allows up to 20 turns.

```json
{
  "schemaVersion": "1.2.0",
  "metadata": {
    "name": "Multi-turn follow-up suite",
    "tags": ["multi-turn", "regression"]
  },
  "default_evaluators": {
    "Relevance": {},
    "Coherence": {}
  },
  "items": [
    {
      "name": "Follow-up retains project context",
      "description": "The agent should remember that the user is discussing the Contoso renewal.",
      "conversation_id": "contoso-renewal-followup",
      "turns": [
        {
          "prompt": "What is the latest status for the Contoso renewal?",
          "expected_response": "The agent gives the available Contoso renewal status without inventing missing details."
        },
        {
          "prompt": "Who owns the next step?",
          "expected_response": "The agent answers in the context of the Contoso renewal and cites or qualifies the source of the owner."
        }
      ]
    }
  ]
}
```

Do not put top-level `prompt` on a multi-turn item. Put prompts inside `turns`.

## PRA scenario design

Use PRA to choose what to test, then express tests with public evaluators.

| PRA area | Test intent | Useful evaluators |
|---|---|---|
| Perceive | Finds the right source, respects available context, uses citations where required | `Groundedness`, `Citations`, `Relevance` |
| Reason | Synthesizes, follows instructions, handles ambiguity, avoids hallucination | `Relevance`, `Coherence`, `Similarity` |
| Act | Performs or describes declared capabilities accurately | `Relevance`, `Coherence`, `ExactMatch`, `PartialMatch`, `Similarity` |

Do not add legacy/private evaluator names to generated datasets unless a current authoritative public schema includes them.

## Tags and custom metadata

Use root `metadata.tags` for suite-level tags. Use `extensions` for local metadata that the CLI should preserve:

```json
{
  "prompt": "List the open actions from the last planning discussion.",
  "expected_response": "The agent lists action items with owners when available.",
  "extensions": {
    "scenario": "action-items",
    "risk": "hallucinated-owner",
    "priority": "high"
  }
}
```

## Authoring checklist

1. Use `schemaVersion: "1.2.0"` and root `items`.
2. Include clear `expected_response` text for every item where comparison matters.
3. Keep prompts realistic but sanitized.
4. Use only public evaluator names: `Relevance`, `Coherence`, `Groundedness`, `Similarity`, `Citations`, `ExactMatch`, `PartialMatch`.
5. Use `Citations` as a minimum citation count, not as a 1-5 LLM score.
6. Prefer `Similarity` or `PartialMatch` for flexible expected answers; use `ExactMatch` only when exact text is intended.
7. Keep generated datasets in `evals\`; write run outputs under `.evals\`.
