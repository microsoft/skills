# My data

Use when the intake names a local folder or existing Blob source instead of the sample.

## Check the folder

1. It exists and is not empty. If not, re-ask intake item 4.
2. Run the build's inventory on it (see [hand-offs](handoffs.md#2-documents)). Report, in plain words, how many documents will be indexed and which will be skipped and why. Promise only what the inventory accepts; there is no separate list of file types or size limit.
3. If nothing will be indexed, say so and re-ask item 4.

## Check the Blob scope

Obtain the exact account ARM ID, HTTPS account endpoint, container and intended
prefix. Before inventory, require explicit approval of the whole named container
if there is no prefix; never infer that scope from a missing answer. Use the exact
[source commands](handoffs.md#2-documents).

Run read-only inventory and retain its manifest and exact source flags through
plan, apply, verify and publish. It lists metadata without downloading documents;
Search reads the selected source in place, without staging copies. If inventory
fails or finds no eligible documents, re-ask only intake item 4.

A trial on a Blob source also points at the whole selected scope, and Search may
index all of it, so trial cost and time can approach a full build. Trial size N
does not cap that. For a bounded trial, the user first copies a small set of
documents to a separate prefix of their own and uses that prefix as the source.

The documents must be ones the user may store in their Search service. Topic indexes and the graph keep provenance to the source documents but do not inherit their permissions.

## Grounding default

Skip. Public Wikidata adds noise to private or niche documents. Offer an entity file of the user's own instead ([grounding](grounding.md)).

## Questions for Act 8

There is no question file for user data. After the attach, draft three to five questions from the user's own topics and ontology, one of each type where the data allows:

- multi-hop (connects facts across documents);
- aggregation (counts or ranks across documents);
- a custom class from the ontology;
- topic to entity (starts from a topic, backs it up with who or what);
- a wrong premise built from real names that the documents don't connect.

Show the drafted questions before running them, then run them as in [finish](finish.md).
