# Graph choose

If the request names a graph stage, load its guide below. Otherwise ask only what is missing, pick one row, say why in one sentence, then route.

| Need | Load |
|---|---|
| Not sure, or see it all (default) | [Graph demo](../graph-demo/graph-demo.md) |
| Route table, ontology option, rules of thumb | [Route table](references/route-table.md) |
| Read-only checks, install, optional Apps | [Install and checks](../graph-guide/references/install-and-checks.md) |
| Explain techniques; models | [Graph guide](../graph-guide/graph-guide.md) |
| Entity Graph | [Provision](../entity-graph-provision/entity-graph-provision.md), [Build](../entity-graph-build/entity-graph-build.md), [Consume](../entity-graph-consume/entity-graph-consume.md) |
| Topic Graph | [Build](../topic-graph-build/topic-graph-build.md), [Consume](../topic-graph-consume/topic-graph-consume.md) |
| Ontology | [Build](../ontology-build/ontology-build.md), [Consume](../ontology-consume/ontology-consume.md) |
| Grounding | [Provision](../grounding-provision/grounding-provision.md), [Build](../grounding-build/grounding-build.md), [Consume](../grounding-consume/grounding-consume.md) |

## Two questions

- What do you have: documents, an OWL file, a Search index with chunk vectors, or a Topic Graph build?
- What answer do you need: one passage, a multi-hop path, or corpus-wide themes?

## Rules

- Take a position; don't list options.
- Choose the CLI route first; add Apps only when a host asks for presentation.
- Never sign in, install software or run Azure writes for the user. Run only read-only checks for the chosen route. Preflight and bootstrap setup only prepare plugin runtimes.
- Name the tenant before sign-in. Omit plan IDs and journals unless asked.
- After the user approves the route (or immediately when clear), hand off to its skill. Route agreement is not write approval: the leaf shows the exact card and asks one Approve/Stop question.
