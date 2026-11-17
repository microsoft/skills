# Graph, table and evidence inspection

Each new result starts in **Graph**. One **Graph / Table / Evidence** selector
changes how that same result is inspected, without another query, presenter call
or result session.

- **Table** provides accessible entity and relationship tables with explicit row
  selection, returned types, identities and source references. Missing source
  references are reported, not inferred from labels or neighboring entities.
- **Evidence** displays provenance already returned with the result. An explicit
  **Load exact source passages** action uses the existing bounded `entity_graph_query`
  read with the original query, query mode and bounds, and `detail: full`.
- The same selected-record inspector remains available in every view. Selected entity
  relationships and their exact per-edge sources appear in it; node labels never join
  source records.
- The original submitted query stays pinned even if the form has unsubmitted edits.
- Returned scalar projections use an accessible GQL column table, with actual
  diagnostics and statistics. Scalar-only results select Table rather than an empty Graph.
- Renderer failure or a graph display limit visibly selects the usable table
  alternative instead of leaving **Graph** falsely selected.
- A new query, **Clear search**, reconnect, or leaving the page releases the result session.
- View selection and loaded-record filters share a compact stage toolbar. **Query info**,
  **Schema info**, or **Index info** reveals the original scope, returned diagnostics and
  identifiers without displacing the graph.
- Returned paths float over the canvas. Executed GQL stays on one line; its full text
  remains available on hover and through **Copy GQL**.
- Passage cards show a compact source badge; **Exact returned provenance record**
  reveals every returned field and the original record.

In **Topics**, open a topic to load its members in the right dock,
then follow original source chunks, with the first scoped passage preview loaded
automatically above the member list. Header pills show actual returned counts;
missing indexed-chunk counts say **Chunks not returned**. Unnamed records use
**Cluster L<level> · #identifier** without inventing a topic.
In **Ontology**, select a type or relationship to load its scoped evidence
automatically into the right dock.
Its matching **Graph / Table** selector retains the current selection; class
and property tables show the actual loaded definitions and recorded endpoints.
Evidence follows the current result or selection, not a presentation dropdown.

These views cooperate through the same exploration pattern, not automatic joins:
ontology state, the Entity Graph descriptor and the TopicGraph descriptor remain independently
scoped. Matching labels do not establish common lineage. Supporting evidence and
full-provenance reads always route to the original server and scope. The browser
supports light/dark themes, narrow viewports, bounded size changes and
inline/fullscreen display requests. The desktop stage stays within one viewport,
with independently scrollable stage and evidence dock; narrow screens stack them.
Card nodes, directional predicate pills and a floating zoom/fit HUD share the
same light/dark design tokens in both deliveries.
**Settings** shows current source connections under **Connections**, not live upstream
Search health. Each configured source offers **Reconnect**.
Operator metadata and selection diagnostics are under **Technical details**.

[Prerequisites and setup](standalone-setup.md) | [Launch](standalone-launch.md)
