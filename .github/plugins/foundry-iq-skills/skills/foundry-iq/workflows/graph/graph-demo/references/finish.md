# Finish

## Act 7: see it

- **In a host that renders apps** (GitHub Copilot app, VS Code): show the graph explorer, the topic explorer and the Sitemap inline.
- **In a terminal**: run `graph-playground` ([Graph Playground](../../graph-guide/references/install-and-checks.md#graph-playground)) without asking, then say one line with its link: "Apps don't show in a terminal, so I opened the Graph Playground in your browser: <url>", with the full returned `url`, including the part after `#` (this launch's key; without it the page won't load). Never look for Node, write a config or make folders yourself.
- Without grounding, its Grounding view shows how to add one; don't call that a gap.

## Act 8: ask questions search can't answer well

Run the questions yourself, one at a time, and narrate each: what it asks, what the answer is, and which documents it cites. Every answer cites source documents. In a terminal, the user can follow each answer in the open Graph Playground. Run them in this conversation, not in a subagent.

A graph query returns entities, relationships, paths and their sources, with no written answer by design: tell the answer from those. Ask the Knowledge Base when a written answer is wanted. Each query saves its full result under `.entity/results/` and prints its path; narrate from that file, or run the same read-only query again. Never search session logs for a result.

A graph result with no relationships or paths, or that cites no document, is a stop, not something to narrate around. Say so in one line and name the step to re-check: the attach and its verify for an empty graph, the build for missing sources. When a question names a call, its answer cites only that call; if the result warns that Search merged calls, say so.

| Question | Type | What it shows |
|---|---|---|
| Q1–Q4 from the sample | Multi-hop, aggregation, custom class, topic to entity | The graph connects facts across calls |
| One question asked both ways | Search, then graph | What the graph added, rather than claiming it's better |
| Q5 | Wrong premise | It says the premise is false instead of making up an answer |

Q5 for the sample: "Which analyst from Goldman Sachs asked about AWS acquiring GitHub during the FY24 Fourth Quarter earnings call?" Don't predict its answer. For a folder, use the drafted questions from [my data](byo-data.md).

## Recap

- What was built, with resource names, including the grounding index if any.
- The approvals given.
- Model spend: one total, "about $X", adding what each paid step reported (topics, ontology, builds, trial); list a step that reported no number as not reported, never the whole total as unknown.
- What remains billable.
- How to close the Graph Playground, if it's open: "Say 'close the Graph Playground' and I'll run `graph-playground stop`."

## What's next

- "Try your own documents" or "Try your own ontology", with the same starter prompt.
- On the standard path, "Generate an ontology from the topics". After a generated one, "Improve the ontology": a reviewer model checks it against the sample's questions file, priced on its own card first.
- Learn more: [`graph-guide`](../../graph-guide/graph-guide.md); pick a route: [`graph-choose`](../../graph-choose/graph-choose.md).

## Cleanup offer

List exactly what this run created, and nothing else. Print the delete commands for the user to run. The demo never deletes anything itself, and there is no cleanup command.
