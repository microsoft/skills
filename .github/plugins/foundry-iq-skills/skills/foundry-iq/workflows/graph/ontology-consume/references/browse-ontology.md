# Browse ontology

## Quick starts

- "Is ontology-consume set up, and which ontology versions exist?"
- "Which ontology is my current approved one?"
- "Show me the classes and relationships in the latest version as a diagram."

## Use this path

Use this path to check setup, list versions, locate the current approved ontology, list classes and properties, or draw a diagram.

## CLI

| Question | CLI |
|---|---|
| Is everything set up? | `ontology-consume doctor --json` |
| Which versions exist and which is approved? | `ontology-consume status` |
| Which is my current approved ontology? | `ontology-consume current` |
| What does it contain? | `ontology-consume show [--version N]` |
| Show a picture | `ontology-consume diagram [--version N] [--output file.mmd]` |

## Rules

- Doctor always exits 0. When `ready` is false, do its single `next_step` before going on.
- `current` returns the path, SHA-256, IRI, counts, source generation, and approval time. It re-hashes the file each time and blocks with `NO_CURRENT` when none is recorded, `CURRENT_INVALID` when the file changed, or `CURRENT_AMBIGUOUS` when several state folders have one (pass `--state-dir`).
- `ontology-consume diagram` prints an exact Mermaid flowchart: every class, every relationship as a labelled arrow, and unrelated classes grouped together. `--with-datatype` adds datatype properties. `show --mermaid` is a class diagram capped for large ontologies; it says how many classes it shows, so say so too.
- `show` pages with `--limit` and `--offset` for large ontologies.

## Optional Apps

An Apps-capable host can show the schema and evidence with `ontology-apps --state-dir <absolute-state-directory>`; it never replaces the CLI.


## Return

Report what the ontology contains in plain words, which version you read, and one safe next action. Building, approving, and exporting belong to ontology-build.
