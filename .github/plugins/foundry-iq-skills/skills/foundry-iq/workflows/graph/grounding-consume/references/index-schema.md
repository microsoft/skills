# Index schema

## Quick starts

- "Why does `check` say a graph profile role is unmapped?"
- "What fields does a grounding index need?"
- "Which document key and sentinel values does the build write?"

## Profile

A grounding index carries `graphProfile` with `kind: "edgeList"`, validated against Azure AI Search API `2026-11-01-preview`. One document per edge; no node rows, no vector field, no semantic configuration. Every role must name an existing field; two roles may not share a field except `assertionIdField` and `factIdField`, which share the key. Mapped string fields must not have a normalizer. `provenanceIndexName` stays unset. `tripleIdField` and `namespaceField` do not exist and are rejected.

## Roles

| Role | Field | Type |
|---|---|---|
| assertionIdField, factIdField | id (key) | String |
| subjectField, predicateField, objectField | subject, predicate, object | String |
| objectStringField, objectDoubleField, objectBoolField, objectDateTimeField | object_string, object_double, object_bool, object_datetime | String, Double, Boolean, DateTimeOffset |
| subjectTypeField, subjectIdField, objectTypeField, objectIdField | subject_type, subject_id, object_type, object_id | String |
| graphNameField | graph_name | String |
| confidenceField and subject/predicate/object confidence | edge_confidence, s_confidence, p_confidence, o_confidence | Double |
| sourceChunkIdField, sourceParentIdField | chunk_id, parent_id | String |
| subject/object display name | subject_id_display_name, object_id_display_name | String |

Note the capital T in `objectDateTimeField`. Subject, predicate, object, ids, and graph name must be filterable. Two extra non-profile fields exist: `edge_hash` and `namespace` (origin label, filterable).

## Conventions

- Key: `edge-` plus 40 hex characters of a SHA-256 over the normalized edge identity, so re-uploads are idempotent.
- Confidence is required: own-data edges default to 1.0, Wikidata edges 0.9; the per-part confidences repeat it.
- `chunk_id` is the sentinel `grounding` and `parent_id` is the edge's `graph_name`. Empty values are skipped by the graph engine, so the sentinels are required.
- Origin lives in `graph_name` plus the extra `namespace` field; the licence is recorded in the plan and local descriptor.
- The index is created with POST, never PUT, so an existing index is never overwritten.
- Free-text predicates are accepted, including Wikidata property IDs.
