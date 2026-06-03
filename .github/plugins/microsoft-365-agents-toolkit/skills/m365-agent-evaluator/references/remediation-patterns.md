# Remediation patterns

Use these patterns when converting eval failures into concrete changes to agent instructions, manifest configuration, knowledge sources, or the eval dataset.

## Before recommending changes

1. Confirm the run reached the agent and evaluator model successfully.
2. Separate setup failures from quality failures.
3. Check whether the failed evaluator was configured for that item.
4. Inspect prompt, expected response, actual response, and context for ambiguity or sensitive content.
5. Recommend the smallest targeted change.

## Failure-to-fix map

| Failure | Likely cause | Targeted fix |
|---|---|---|
| Low relevance | Agent answers adjacent intent or ignores constraints | Strengthen instructions about supported scope and task routing; add examples for common intents. |
| Low coherence | Answer is hard to scan or mixes unrelated content | Add response format requirements, length limits, headings, or ordered steps. |
| Low groundedness | Answer includes unsupported facts | Require source-backed answers, clarify source priority, and instruct the agent to say when evidence is missing. |
| Low similarity | Actual content differs from expected behavior | Update instructions/data access, or relax the expected response if multiple valid answers exist. |
| Failed citations | No citation when one is required | Add citation requirements and verify the underlying agent capability can surface citations. |
| Failed exact match | Formatting or deterministic value differs | Add strict output-only instructions, or switch to `PartialMatch` if exact text is too brittle. |
| Low partial match | Key terms missing | Add expected terms to instructions/examples or improve retrieval for the missing concepts. |
| Multi-turn follow-up failure | Agent loses conversation context | Add follow-up handling examples and clarify how to resolve pronouns or references. |

## Instruction remediation examples

Grounding:

```text
Answer using only information available from the retrieved workplace sources. If the sources do not contain enough evidence, say what is missing instead of guessing.
```

Citations:

```text
When summarizing workplace information, include citations for the source messages, meetings, or documents whenever citations are available.
```

Scope:

```text
If the user asks for work outside this agent's supported scenarios, briefly explain the supported scope and offer a related prompt the agent can answer.
```

Format:

```text
Use this response shape: Summary, Key details, Open risks, Next actions. Keep each section concise.
```

Multi-turn:

```text
For follow-up questions, preserve the active project, customer, and time window from the prior turn unless the user changes them.
```

## Eval dataset remediation

Sometimes the eval is the problem. Update the dataset when:

- the prompt is ambiguous outside hidden context,
- the expected response demands exact phrasing when flexible phrasing is acceptable,
- the evaluator threshold is stricter than the user requirement,
- the prompt contains stale or unavailable source data,
- a setup failure was recorded as if it were an agent-quality failure.

Prefer adding a new regression item for each distinct production issue instead of overloading one prompt with many requirements.

## Reporting format

When handing back recommendations, use this shape:

```text
Primary issue: <one-sentence theme>
Evidence: <sanitized score/prompt/response observation>
Recommended change: <specific instruction, manifest, data, or eval update>
Expected effect: <which evaluator should improve and why>
```

Do not include raw sensitive prompts, responses, retrieved data, or debug logs.
