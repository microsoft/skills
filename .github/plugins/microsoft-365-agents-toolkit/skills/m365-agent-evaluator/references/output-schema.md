# Output schema reference

The current `runevals --output <file>` JSON output is schema-compatible with the eval document format. It is not the older `{ "summary": ..., "results": [...] }` shape.

Use `references\output-schema.json` for a compact validation-oriented schema and `references\prompts-schema.json` for the full package schema.

## JSON output

Typical JSON output:

```json
{
  "schemaVersion": "1.2.0",
  "metadata": {
    "evaluatedAt": "2025-01-01T00:00:00Z",
    "agentId": "00000000-0000-0000-0000-000000000000",
    "agentName": "Contoso Agent",
    "cliVersion": "1.5.0-preview.1"
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
        },
        "coherence": {
          "score": 5,
          "result": "pass",
          "threshold": 3
        }
      }
    }
  ]
}
```

Multi-turn output uses an item with `turns` and may include `summary`.

## Score object

Scores are sparse. Keys appear only for evaluators that ran.

| Score key | Value shape |
|---|---|
| `relevance` | `{ "score": 1-5, "result": "pass" | "fail", "threshold": number }` |
| `coherence` | `{ "score": 1-5, "result": "pass" | "fail", "threshold": number }` |
| `groundedness` | `{ "score": 1-5, "result": "pass" | "fail", "threshold": number }` |
| `similarity` | `{ "score": 1-5, "result": "pass" | "fail", "threshold": number }` |
| `citations` | `{ "count": number, "result": "pass" | "fail", "threshold": number }` |
| `exactMatch` | `{ "score": 0 | 1, "result": "pass" | "fail", "threshold": number }` |
| `partialMatch` | `{ "score": 0.0-1.0, "result": "pass" | "fail", "threshold": number }` |

Do not treat missing score keys as failures.

## CSV output

CSV reports include:

- metadata comments at the top,
- aggregate statistics,
- single-turn sections,
- multi-turn sections,
- serialized score JSON.

Use CSV when the user wants spreadsheet review or lightweight automation without parsing full JSON.

## HTML output

HTML reports are for human review and may open in the default browser. Treat them as sensitive because they can contain prompts, retrieved data, and agent responses.

## Automation guidance

When parsing JSON results:

1. Read `items`.
2. For each item, handle either single-turn `prompt` or multi-turn `turns`.
3. Check only `scores` keys that exist.
4. Treat setup/auth/model/schema errors separately from quality scores.
5. Compare runs only when datasets, evaluators, thresholds, and model configuration are stable.
