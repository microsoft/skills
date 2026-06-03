# Example: analyze existing failures

User intent: "Here is my eval output. What should I fix?"

## Inputs

Expected files:

```text
.evals\latest.json
evals\evals.json
```

Do not paste raw prompts, responses, retrieved data, or logs into chat if they may contain sensitive content.

## Process

1. Load `references\result-analysis.md` and `references\remediation-patterns.md`.
2. Inspect `metadata` for CLI version, agent ID/name, and evaluated time.
3. Inspect each item under `items`.
4. For each item, read sparse `scores` keys such as `relevance`, `coherence`, `groundedness`, `similarity`, `citations`, `exactMatch`, and `partialMatch`.
5. Treat missing score keys as "not configured", not failed.
6. Summarize the smallest targeted changes.

## Example finding

```text
Primary issue: Citation behavior is inconsistent.
Evidence: The citation evaluator failed on prompts that ask for workplace-source summaries, while relevance and coherence passed.
Recommended change: Add an instruction requiring citations for source-backed summaries and verify the agent path can surface citations.
Expected effect: `citations` should meet the minimum count threshold without changing the response content.
```

## Common false positives

- Expected response is too specific for a legitimately variable answer.
- `ExactMatch` is used for natural language text.
- A prompt assumes source data that is not available to the deployed agent.
- The run failed during auth, schema validation, or evaluator-model setup.
