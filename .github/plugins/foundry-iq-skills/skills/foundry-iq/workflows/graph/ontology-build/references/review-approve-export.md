# Review, approve, export

## Quick starts

- "Review the latest ontology version and show what changed from the previous one."
- "Approve version 3 and export it as `wiki.jsonld`."
- "Which ontology is my current approved one?"

## Use this path

Use this path to review a version, pin it by its schema ID, export the OWL ontology serialized as JSON-LD (`.jsonld`), import an existing ontology, or hand the approved ontology to a consumer.

## Review and approve

1. `ontology-build review --details` shows the counts, the change from the previous version, hygiene notes, and after refine what changed and why it stopped. Say the counts in plain words: types of things, links between them, attributes.
2. Show the review `approval` card exactly, then ask one Approve/Stop question; never ask the user to type an ID. The schema ID is in the review output.
3. After the user approves, run the `ontology-build approve` command that `review` printed with that exact `--schema-id`. Never construct or reuse a schema ID. Approving also records the version as the current approved ontology (`ontologies/<schema_id>.jsonld`).

## Export and hand off

- `ontology-build export --output <path>.jsonld` writes the OWL ontology serialized as JSON-LD (`.jsonld`). Export fails if the ontology exceeds the service limits; the error names the limit. It refuses any unapproved version, never overwrites a file unless the user asked for `--force`, and updates the current pointer. When classes or properties carry lexical aliases, it also writes `<path>.jsonld.aliases.json`.
- `ontology-build current --json` (or `ontology-consume current --json`) returns the current approved ontology's `.jsonld` path, SHA-256, IRI, counts, source generation, and approval time. Blocks with `NO_CURRENT` until a version is approved and `CURRENT_INVALID` when the file changed.
- Offer `ontology-consume check <path>.jsonld` to validate the exported OWL ontology file against the ontology profile (OWL in JSON-LD).
- For an Entity Graph created without an ontology, the next action is `entity-graph-build plan-attach-ontology` with `--ontology inline_jsonld --ontology-path <path>.jsonld` (or `--ontology owl_file --ontology-path <path>.jsonld`), owned by `entity-graph-build`. Stop here and the build can still attach `--ontology schema_org`.

## Import

`ontology-build import <file>` imports an existing customer ontology (`.owl`, `.rdf`, `.xml`, `.ttl`, `.nt`, or `.json`) and converts it as a new version to review, approve, and export as JSON-LD. Offline, import, review, approve, and export need no Azure.

## Return

Report the exported path or current pointer, the SHA-256, and one safe next action. If blocked, relay `error` in plain words and do exactly `next_step`; use `ontology-build reconcile` only for a stale lock or changed state files.
