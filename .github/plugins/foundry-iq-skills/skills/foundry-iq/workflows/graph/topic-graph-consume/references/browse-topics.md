# Browse topics

## Quick starts

- "What topics does this corpus cover?"
- "Show me a sitemap of this corpus."
- "List the biggest Topic Graph topics and a few example articles from each."
- "Show me the evidence chunk behind this topic."

## Use this path

Use this path to answer "what is in this corpus?" from a published Topic Graph build, with plain-language topics, sizes, and example articles.

## Flow

Run these commands directly in the main session shell (omit `--descriptor` to use the last published build when only one source is published, or pass `--descriptor <absolute-path>`, which `CURRENT_AMBIGUOUS` requires; endpoint, Entra auth, and tenant hydrate automatically):

1. `topic-graph-consume --json status` returns the topics per level (`topics_per_level`) and `browse_level`, the level with about 10 to 30 topics.
2. `topic-graph-consume --json list-topics` lists that level, largest first. Pass `--level` to go broader (0 is broadest) or more specific, and `--cursor` to page. `--page-size` is 1 to 1,000 (default 100); every command's `--help` lists its defaults, so never read runtime files for them.
3. `topic-graph-consume --json sitemap` returns the whole named hierarchy at once, broadest first, as flat `nodes` with `children` IDs; `--topic <topic-id>` limits it to one branch, `--depth` and `--max-nodes` (default 500) bound it, and `truncated` says when nodes were left out. `coverage` is a topic's share of passages in topics and `parent_coverage` its share of the parent. Version, coverage and build facts under `graph` are null when the build did not record them.
4. `topic-graph-consume --json get-topic <topic-id>` returns one topic with parent and subtopics; page large child lists with `--children-page-size` (default 1,000) and `--children-cursor`. Topic IDs look like `topic:0`.
5. `topic-graph-consume --json list-members <topic-id>` pages through a topic's chunks, closest to the topic's center first (`rank`, `score`); follow `next_cursor` with `--cursor`. At most 1,000 members are listed per topic; `member_count` is the full estimate.
6. `topic-graph-consume --json get-chunk <chunk-id>` returns the chunk text and provenance.

## Answering

- Answer in plain language: topics, sizes, and example articles. Mention topic IDs or levels only when the user drills in.
- Each topic has the name the build gave it (`label`). If `label_status` is `unnamed`, infer a topic from member `source_id` values and say the label is yours.
- Cite a `chunk_id` and `source_id` for every claim; do not summarize documents you did not retrieve.

## Optional Apps

An Apps-capable host can show topics, evidence and the sitemap with the optional `topicgraph-mcp` adapter; it reads the same published build and never replaces the CLI.


## Return

Give the topics with sizes and cited example articles, name the level browsed, and suggest one next drill-down.
