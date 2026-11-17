# Document retrieval

## Quick starts

- "Which documents mention `<topic>`? Cite the original files."
- "Find the passages that support this answer about `<entity>`."

## Use this path

Use this path when the user needs cited document evidence from a published Entity Graph deployment and graph traversal is unnecessary or unavailable.

## Retrieval flow

1. Confirm the request is about reading evidence, not changing the deployment.
2. Run `entity-graph-consume query --descriptor <path> --query "<question>" --json`.
3. Retrieval is hybrid by default and needs the published OpenAI endpoint and embedding deployment. Add `--lexical` for keyword-only retrieval when vectors are unavailable or unwanted.
4. Use `--top` only when the user needs more or fewer hits than the default.

## Safety and limits

- Return cited provenance from the result, not summaries of unseen documents.
- If the evidence contradicts the question, say that first.
- On a read-only backend error, return the safe message and next diagnostic step; never retry with a mutation.
- Telemetry is observational. Summarize latency from the returned `telemetry` block, or from `entity-graph-build telemetry` over local files.

## Return

Answer from the retrieved evidence, name whether the search was lexical or hybrid, and cite the returned sources.
