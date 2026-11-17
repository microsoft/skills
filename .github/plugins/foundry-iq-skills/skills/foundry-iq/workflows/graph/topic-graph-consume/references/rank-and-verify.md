# Rank and verify

## Quick starts

- "Why is `<topic>` the largest topic?" (premise check)
- "Which articles best represent this topic?"

## Use this path

Use this path to test whether a question's premise matches the build, or to show a topic's most typical articles.

## Premise check

A question such as "why is X the largest topic?" assumes facts. Compare them with the sizes and levels from `topic-graph-consume --json status` and `list-topics` and the text from `get-chunk`.

1. If the evidence contradicts the premise, say so first and cite the `topic_id`, `chunk_id`, and `source_id`, then answer the corrected question.
2. If it neither confirms nor contradicts it, say it is unverified in this build and answer what you can.
3. Never answer as if a contradicted premise were true.

## Most typical articles

`topic-graph-consume --json list-members <topic-id>` returns members closest to the topic's center first, with `rank` and `score`. The first page is the topic's most representative evidence; fetch text with `get-chunk` before quoting it.

This ranking reflects the topic, not the user's question. Topic Graph consume does not search by question; for question-relevant passages, use the source index's own search or a knowledge base, and say which you used.

## Return

Give the ranked evidence with citations, state any premise correction first, and say that the ranking is by closeness to the topic's center.
