# Grounding

Grounding gives the people, companies and products the graph extracts canonical IDs, so "Satya", "Satya Nadella" and "Mr. Nadella" become one node.

## Choices (intake item 8)

| Choice | Use | Default for |
|---|---|---|
| Skip | Names stay as they appear in the documents; the graph still works | My folder |
| Wikidata seed | Microsoft (Q2283) at depth 1: a small public Wikidata slice (CC0) | Sample |
| My entity file | CSV, JSONL or Parquet of entities or edges, under the user's own licence | — |

An entity file needs: the columns the grounding build reads (entities: an id and a name, optionally a type and aliases; or edges: subject, predicate, object), a licence the user states, and no more edges than the grounding build's limit. Re-ask item 8 if any is missing.

## Set it up before the build card (Act 2)

The grounding index is written into the Knowledge Source when the build creates it. Attaching the ontology later only adds the ontology, so grounding can't be added after the graph exists.

1. Plan the build with the grounding index named. This plan shows no card; it gives the exact graph name the index must carry. Never type a graph name or reuse one from a plan without grounding.
2. Check grounding readiness on the new Search service. A missing role is the role-card stop: show it, then re-check.
3. Plan the grounding index for that graph name, with the index name from step 1, from the Wikidata seed or the user's file. No preview: the plan's card is the one to show. Say its first line plainly ("It will hold 545 facts about Microsoft from Wikidata, for example Satya Nadella, LinkedIn and Azure."), show the card, and apply after approval.
4. Check the index is ready for that graph name. If not, follow its single next step and check again.
5. Plan the build again with the same inputs, then announce and show the build card.

Exact commands: [hand-offs](handoffs.md#grounding).

Story beat: "Documents name the same person many ways. Before extraction runs, I'll give Search a list of known entities, so each one becomes one node with a canonical ID instead of several near-duplicates."

Show: the index name, its source (Wikidata seed or the user's file) and the named examples on its card. Say Wikidata entries are unreviewed and an entity file keeps its owner's licence.

## After the attach (Act 6)

Report how many relationships have both ends grounded, in plain words. A low share is reported as tentative, not hidden; the graph is still usable without grounding. With grounding, the Graph Playground's Grounding view shows the index; without it, don't mention the view.
