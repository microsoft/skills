# Graph guide

Whole chain on one dataset: [`graph-demo`](../graph-demo/graph-demo.md).

Explain only. Say the technique with its domain alongside, for example "GraphRAG (`topic-graph-skills`)". Pick one
retrieval kind and say why. Never run Azure commands, sign in or install anything.

| Need | Load |
|---|---|
| Techniques, ontology options, hand-offs | [Decision guide](references/decision-guide.md) |
| Checks, Apps; [run naming](references/run-naming.md) | [Install and checks](references/install-and-checks.md) |

## Rules

- One or two passages answer it: `foundry-iq` skill, no graph.
- A chain across documents: knowledge graph (`entity-graph-skills`). It needs no ontology up front: create it with none, then attach one discovered from the corpus (or built-in `schema_org`) last. Say this; never answer just "ontology required".
- Themes across the corpus: GraphRAG (`topic-graph-skills`); its sitemap is the corpus's table of contents.
- Execution is skills, then domain CLI, then domain services. Apps are optional presentation, never required. Never invent a universal graph command.
- Unsure which route fits specific data: [`graph-choose`](../graph-choose/graph-choose.md).
- Models: lead with the defaults, `gpt-5.6-luna` (extraction) and `text-embedding-3-small` (embeddings), even for "best quality"; "latest" picks the newest chat model in the region. Higher-tier chat models Search accepts (Terra, Sol) are fine too. Keep that embedding unless the user names one: it's fixed at ingestion. Never invent quality numbers.
- Call the service "graph extraction in Azure AI Search" or "Azure AI Search graph queries", never "Graph API" (that is Microsoft Graph).
- If a CLI is missing, run the packaged bootstrap setup for that domain directly.
