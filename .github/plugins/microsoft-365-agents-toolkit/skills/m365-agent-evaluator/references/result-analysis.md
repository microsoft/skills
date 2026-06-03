# Result analysis

Use this reference after an evaluation run has produced JSON, CSV, or HTML output.

## Current output shape

JSON output is an eval-document-style object:

```json
{
  "schemaVersion": "1.2.0",
  "metadata": {
    "evaluatedAt": "2025-01-01T00:00:00Z",
    "agentId": "<agent-id>",
    "agentName": "<agent-name>",
    "cliVersion": "<version>"
  },
  "default_evaluators": {},
  "items": [
    {
      "prompt": "What can this agent help me with?",
      "response": "The agent response.",
      "expected_response": "The expected behavior.",
      "scores": {
        "relevance": {
          "score": 4,
          "result": "pass",
          "threshold": 3
        }
      }
    }
  ]
}
```

The `scores` object is sparse. A missing score key usually means that evaluator was not configured for that item.

CSV output includes metadata comments, aggregate statistics, single-turn and multi-turn sections, and serialized score JSON. HTML output is best for human review and may open in a browser.

## Score keys and semantics

| Score key | Authoring evaluator | Interpretation |
|---|---|---|
| `relevance` | `Relevance` | 1-5 LLM score for whether the answer addresses the prompt. |
| `coherence` | `Coherence` | 1-5 LLM score for clarity and structure. |
| `groundedness` | `Groundedness` | 1-5 LLM score for support from provided or retrieved context. |
| `similarity` | `Similarity` | 1-5 LLM comparison to `expected_response`. |
| `citations` | `Citations` | Count-based citation result against the configured threshold. |
| `exactMatch` | `ExactMatch` | Boolean exact match result. |
| `partialMatch` | `PartialMatch` | 0.0-1.0 partial string match result. |

Analyze only keys that are present. Do not assume a missing evaluator failed.

## Triage patterns

| Signal | Likely root cause | Recommended remediation |
|---|---|---|
| Low `relevance` | Wrong intent, vague prompt, or agent ignored the ask | Clarify instructions, add examples, improve scenario routing, or update the eval prompt if it is ambiguous. |
| Low `coherence` | Response is disorganized, contradictory, or too verbose | Tighten response-format instructions and add expected structure. |
| Low `groundedness` | Response uses unsupported facts or ignores context | Improve grounding instructions, retrieval configuration, source selection, or refusal behavior when evidence is missing. |
| Low `similarity` | Actual response diverges from expected answer | Check whether expected response is too rigid; otherwise update instructions or data access. |
| Failed `citations` | Response lacks required source citations | Add citation requirements to instructions and verify source-citation support in the agent. |
| Failed `exactMatch` | Deterministic output is not exact | Use stricter formatting instructions or replace with `PartialMatch` if exact text is not necessary. |
| Low `partialMatch` | Key expected terms are missing | Add expected terminology to instructions or adjust expected response to match acceptable variants. |
| Auth, consent, schema, or model errors | Environment failure | Fix setup before judging agent quality. |

## Multi-turn analysis

For multi-turn items, check whether failure starts on the first failing turn or compounds across turns:

1. First-turn failure usually means prompt handling, grounding, or data access is broken.
2. Later-turn failure usually means the agent loses conversation context or mishandles follow-up references.
3. Mixed pass/fail patterns can indicate evaluator thresholds are too strict for some turns.

Keep conversation IDs and turn order stable when comparing runs.

## Comparing runs over time

For regression checks:

1. Keep the same dataset and expected responses.
2. Keep evaluator names and thresholds stable.
3. Use the same Azure OpenAI model deployment when comparing score movement.
4. Save outputs with explicit names, for example `.evals\2025-01-01-baseline.json` and `.evals\2025-01-02-after-instructions.json`.
5. Separate environment failures from quality failures before reporting a pass rate.

## Reporting recommendations

When summarizing results to the user:

- Lead with pass/fail themes, not raw JSON.
- Group failures by likely fix area: instructions, grounding/retrieval, citations, expected-answer quality, capability gap, or setup.
- Include the smallest concrete manifest/instruction change that is likely to address the issue.
- Do not paste raw prompts, retrieved data, responses, or logs if they may contain sensitive content.
