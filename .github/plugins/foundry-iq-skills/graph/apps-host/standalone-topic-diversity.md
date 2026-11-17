# L1 topic diversity in Why Graph

The **Topic diversity** select at the right end of the **Try:** row controls L1
retrieval on both sides of the next comparison, not results already displayed.
It is locked while a comparison runs. An explicit choice is named on the Knowledge
Graph column's provenance line (`· Topic diversity: On (balanced)` or `Off`); that is
the requested setting, not a service-verified effective diversity score. Default adds
nothing. Runtimes without `topic_diversity` show no select and keep their behavior.

| Selection | November preview request |
|---|---|
| Default | Omit `topicGraph`; preserve service/KS/profile inheritance |
| On (balanced) | `topicGraph: {"kind":"balanced"}` |
| Off | `topicGraph: {"kind":"none"}`; omission is not an off switch |

Both comparison arms use KB-owned answer synthesis. Both receive the same
`knowledgeSourceParams[].topicGraph` override with `2026-11-01-preview`; the
passage-only arm additionally instructs the KB not to use graphs. The runtime
validates its activity, references and citations; an invalid or failed baseline
is shown as unavailable, never replaced with the graph answer. Rejected requests
are not silently retried with default diversity or dropped graph parameters.
Supporting full-detail reads retain the original setting. Raw GQL, traversal and
Topics-to-KG chunk scopes do not accept explicit diversity overrides.

Standalone document retrieval, separate from the comparison, sends explicit
diversity in `vectorQueries[].topicGraph`. Managed vector requests use November
even without an override so native defaults can apply. Lexical searches and
document hydration retain their existing SDK path.

## Native setup prerequisite

Explicit On and Off both require a compatible native topic graph profile on the
content vector field. `fields[].topicGraphProfile` names an entry in
`vectorSearch.topicGraphProfiles` with `name`, topic `indexName` and `defaultKind`
(`none`, `diverse` or `balanced`). Diverse defaults may set
`defaultDiversityFactor` (default 0.2); diverse/balanced may set
`defaultMinDiversityPoolSize` (250..10000, default 1000).
A topic explorer index is not automatically a compatible native topic index.
Off is not a workaround for missing bindings. Default remains available.

Omitted KB overrides inherit the stored KS `topicGraph` under
`azureBlobParameters` or `searchIndexParameters`. Inspect the KS and field/profile
rather than assuming absence means Off. The selector changes retrieval, not
graph layout, and never modifies indexes, topic graphs, KSs or KBs.

For missing bindings, use the installed TopicGraph setup workflow at
`skills\foundry-iq\workflows\graph\topic-graph-build\references\retrieval-setup.md`.
It provides `plan-retrieval`, separately approval-gated `configure-retrieval` and
read-only `verify-retrieval` for new or verified generations. It binds the native
source profile/vector field, aligns an existing selected KS and verifies KB
membership without changing the KB. Default setup is relevance-only
(`--topic-diversity off`); `on` explicitly approves a balanced default.
Configuration verification does not run live comparison/model calls.
Preserve complete index definitions and concurrency checks during changes.

[Launch](standalone-launch.md) | [Protocol and scope](standalone-protocol.md)
