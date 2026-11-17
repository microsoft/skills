# Knowledge Graph Playground and query modes

Open the printed `http://127.0.0.1:<port>/#k=<key>` address, not
`localhost` or a machine name; keep it private. Startup discovers real MCP
resources and App-only reads. Readiness and `/health` describe MCP connections, not upstream Search
health, corpus availability or successful model calls.

**Settings** (the gear) counts set-up sources out of four and checks their health when it
opens. Set-up sources offer **Reconnect**; others say **Not set up** with **How to set up**, which
opens Help on the matching path (New Corpus when nothing is set up).
Disconnected servers reconnect on page load without querying.
A submitted query reconnects a disconnected source and retries a stale
connection once; other failures remain visible without replay.
**Technical details** has operator diagnostics; **Display** switches the theme.

The **Knowledge Graph Playground** has keyboard-accessible **Why use a graph?**, **Entities**
and **Topics** tabs. **Entities** holds the **Graph**, **Ontology (schema)** and
**Grounding index (known entity lookup)** pages in every state. An unpublished view says what
creates it, with a prompt to ask Copilot; no sample data is shown. A published source whose
resource is gone or whose sign-in expired shows **Couldn't reach** with **Reconnect** and
**Open Settings**; other views keep working.
Tabs retain inputs, results and context. Topics, Ontology and Grounding
load once on first activation; reopening reuses the result.
The **Graph** page never submits an initial query.

**Why use a graph?**:

- Never runs on activation, reopening or reconnect. It types the first discovered
  question into an untouched box; **Run** or a suggestion submits. Typing stops the prefill.
- **Cancel** stops a run; the view reconnects its server (the connector closes it on
  cancel) before **Run** returns.
- Both columns stay visible in every state and show only returned values.
- Comparison and **Synthesize (KB)** require a nonempty KB endpoint and explicit
  document, graph and agentic retrieval in the selected descriptor. Otherwise a card
  with the reason and next step replaces the question box; graph queries still work.
- Local metadata is checked at connection and KB dispatch without Azure probes.
- Reconnect clears comparison results and discovered questions but keeps the question
  box; results are not cached. Descriptor changes require reconnect and explicit submit.

Ontology, Grounding and Topics present when shown and after reconnect. Entities opens
on the first discovered entity, or an empty state; it never invents a query.

**Question or entity** suggests discovered entities and questions. An explored entity
becomes a chip; an empty box re-explores it and **Clear search** releases the result.
Blank queries are rejected. `InvalidParams` errors are sanitized without retiring
healthy connections. Sources with `query_mode` offer **Entity / Ask / GQL** (Ask uses
the Knowledge Base, or NL→GQL without one); older sources offer Entity only. Mode
switches and **Edit in GQL →** never execute. **Show GQL** reveals only the returned
statement. Ontology chips are syntax helpers, not proof of the graph's schema.

The **Entity types** rail shows each class's whole-graph count from
`entity_graph_counts`; failed counts are omitted, never summed. A class filters the
loaded result. The inspector's class opens Ontology and **View in grounding index →**
opens Grounding, as `workspace_action` selections.

Without an entity graph, the first published view opens; with nothing published, **Why use a
graph?** shows how to start. Cross-tab exploration
requires a discovered `entity_present`; unavailable targets fail visibly without
navigation. `hostContext.knowledgeWorkspace.knowledgeGraph` and `queryModes`
are app-owned navigation/editor flags, not MCP capabilities; `focus` names the class
the Ontology app should select.

[Prerequisites and setup](standalone-setup.md) | [Launch](standalone-launch.md)
