# Route table

## Quick starts

- "I have contract documents and need to know which vendors an outage affects."
- "I have earnings call transcripts and want to discover topic clusters and an ontology."

## Pick one row

The Ontology column is the Entity Graph `--ontology` mode at creation; `-` means no Entity Graph.

| You have | You want | Route | Ontology |
|---|---|---|---|
| Documents or only an Azure subscription; want to see it all, or unsure | Guided demo, sample documents to a queryable graph | [`graph-demo`](../../graph-demo/graph-demo.md) (default) | `deferred`, then attach `schema_org` |
| Documents | One passage, with citations | `foundry-iq` skill in `foundry-iq-skills` | - |
| Documents | Facts from single passages | [`entity-graph-provision`](../../entity-graph-provision/entity-graph-provision.md), [`entity-graph-build`](../../entity-graph-build/entity-graph-build.md), [`entity-graph-consume`](../../entity-graph-consume/entity-graph-consume.md) | `schema_org` |
| Documents, no ontology file | Multi-hop answers in your domain | Entity Graph without an ontology, [`topic-graph-build`](../../topic-graph-build/topic-graph-build.md), [`ontology-build`](../../ontology-build/ontology-build.md), then attach with `entity-graph-build` | `deferred`, then attach the generated `.jsonld` |
| Documents and an OWL ontology (`.jsonld`) | Multi-hop answers in your domain | Entity Graph | `inline_jsonld` or `owl_file` with `--ontology-path` |
| A Search index with chunk vectors | Themes; what the corpus covers | [`topic-graph-build`](../../topic-graph-build/topic-graph-build.md), [`topic-graph-consume`](../../topic-graph-consume/topic-graph-consume.md) | - |
| A Topic Graph build output folder | A custom domain ontology | [`ontology-build`](../../ontology-build/ontology-build.md), [`ontology-consume`](../../ontology-consume/ontology-consume.md) | - |
| An existing ontology file | Review or extend it | [`ontology-build`](../../ontology-build/ontology-build.md); extending needs a Topic Graph build output folder and a priced proposal | - |
| Known entities with canonical IDs | One ID per entity in answers | [`grounding-provision`](../../grounding-provision/grounding-provision.md), [`grounding-build`](../../grounding-build/grounding-build.md), [`grounding-consume`](../../grounding-consume/grounding-consume.md), then Entity Graph's grounding index | any mode |

Reuse what is published: Entity Graph -> `entity-graph-consume`, Topic Graph -> `topic-graph-consume`, an ontology -> `ontology-consume`. Never route a read through provisioning. Multi-hop answers need a published build whose ontology is attached.

## Rules of thumb

- Two hops and no single document states the link: knowledge graph (`entity-graph-build plan`).
- Without an ontology file, create with `--ontology deferred`: Search only chunks and embeds until an ontology is attached. Generate one from the topics with `ontology-build`, or attach built-in `schema_org`.
- A question that starts from a wrong fact: `entity-graph-consume` and `topic-graph-consume` check the premise first.
- An attached ontology cannot be removed: offer a strict-subset trial (`--sample <N>`) of a custom `.jsonld` ontology first to review populated classes, relationships, time, and cost.
- Topic Graph and `ontology-skills` are previews. Ontology needs a Topic Graph build output folder, not a published one.
- Grounding is optional and independent of Topic Graph. Name the index before Entity Graph planning; pass `--grounding-index <name>` and hand `grounding.graph_name`, endpoint and index to its producer. After `ready`, re-plan Entity Graph and approve that exact plan. Never reuse an ungrounded name.

## Handoff

1. Run only the read-only checks in [install and checks](../../graph-guide/references/install-and-checks.md) for the chosen route.
2. Show its install lines only if something is missing; wait for the user.
3. Hand off in plain language to the first owning skill.
