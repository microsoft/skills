# Decision guide

## Quick starts

- "Do I need a graph for vendor impact questions?"
- "What does the policy say about per diems?"

## Techniques

| Technique | Domain | What it gives you | Leaf skills |
|---|---|---|---|
| Knowledge graph | `entity-graph-skills` | Entities and relationships from documents; multi-hop answers with a path and a cited source per hop | [`entity-graph-provision`](../../entity-graph-provision/entity-graph-provision.md), [`entity-graph-build`](../../entity-graph-build/entity-graph-build.md), [`entity-graph-consume`](../../entity-graph-consume/entity-graph-consume.md) |
| GraphRAG | `topic-graph-skills` | A hierarchy of topics built from chunk vectors in a Search index, written to a separate topic index. Preview | [`topic-graph-build`](../../topic-graph-build/topic-graph-build.md), [`topic-graph-consume`](../../topic-graph-consume/topic-graph-consume.md) |
| Candidate ontology | `ontology-skills` | An OWL ontology proposed from a Topic Graph build's topics and original source passages, refined, approved by you and exported as JSON-LD. Preview | [`ontology-build`](../../ontology-build/ontology-build.md), [`ontology-consume`](../../ontology-consume/ontology-consume.md) |
| Grounding index (optional) | `grounding-skills` | An index of known entities and edges (CSV, JSONL, Parquet or a bounded Wikidata seed) so a knowledge graph build resolves names to canonical IDs. Independent of Topic Graph | [`grounding-provision`](../../grounding-provision/grounding-provision.md), [`grounding-build`](../../grounding-build/grounding-build.md), [`grounding-consume`](../../grounding-consume/grounding-consume.md) |

## Which retrieval

- **Plain retrieval:** the answer sits in one or two passages. Use the `foundry-iq` skill in `foundry-iq-skills`; every Entity Graph build extracts a graph.
- **Knowledge graph:** no passage links vendor to customer, so vector search finds the vendor and stops. The graph walks vendor, project, customer and cites each hop.
- **GraphRAG:** themes across the corpus. It needs an index that already holds chunk vectors, no ontology, and never changes that index.

GraphRAG gives coverage and a knowledge graph gives precision; GraphRAG topics (GraphRAG calls these communities) also feed a candidate ontology.

## Ontology for Entity Graph

| Option | Pick it when |
|---|---|
| `deferred` (Recommended default at creation) | Always, unless you already have the final ontology: the Knowledge Source gets graph extraction with no ontology, so Search only chunks and embeds. The ontology is attached afterwards |
| `schema_org` (default at attach) | The built-in business ontology (`Organization`, `Person`, `Product`, `Place`, `Event`). The demo attaches it to the `deferred` build |
| `inline_jsonld` / `owl_file` (custom schema, opt-in) | You bring your own OWL ontology serialized as JSON-LD (`.jsonld`), or `ontology-build` (`ontology-skills`) generated one from Topic Graph topics. Attach it to the `deferred` build, or set it at creation when you already have it |

**Why not set an ontology at creation:** any ontology on the new Knowledge Source starts triple extraction right away. Create it with `--ontology deferred`, then attach `schema_org` or a custom ontology with `entity-graph-build plan-attach-ontology`. Attaching reuses the cached chunks and embeddings, so only triple extraction runs. An attached ontology cannot be removed.

## Hand-offs between domains

The runtimes are independent; these are artifact hand-offs only:

1. Topic Graph reads any Search index with chunk vectors, including Entity Graph's.
2. `ontology-skills` (`ontology-build`) reads a Topic Graph build output folder locally, plus selected passages from the original source index. It does not need the Topic Graph to be published.
3. `ontology-build` exports an approved OWL ontology serialized as JSON-LD (`.jsonld`), which Entity Graph takes as `--ontology inline_jsonld --ontology-path <file.jsonld>` (or `--ontology owl_file --ontology-path <file.jsonld>`). Keep the same ontology flags through plan, apply, verify and publish.
4. `grounding-skills` (`grounding-build`) builds an index Entity Graph takes as `--grounding-index <name>`. Its `graph_name` must match the Entity Graph graph name and it needs label rows; `grounding-build` handles both.

Each domain owns its approvals. Nothing in Azure changes until you approve the exact change shown.

## Presentation

Optional Apps (ontology, Entity Graph, Topic Graph and grounding) render selected context in a compatible host; the CLI route never needs them.
