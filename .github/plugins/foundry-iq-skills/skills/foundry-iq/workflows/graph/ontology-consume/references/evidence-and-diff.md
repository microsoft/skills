# Evidence and diff

## Quick starts

- "Why does the Organization class exist? Show the passages behind it."
- "What changed between version 2 and version 3?"
- "Did version 3 lose any coverage compared with version 2?"

## Use this path

Use this path to explain a class from its cited passages or to compare two saved versions.

## Evidence

- `ontology-consume evidence <Class> [--version N] [--limit N]` lists the passages that support a class. Quote each excerpt as returned and name its source.
- If a class has no evidence, say so. Imported versions carry no passages. Do not invent a justification.

## Diff

- `ontology-consume diff <a> <b>` shows classes and properties added, removed, and changed between two versions, including coverage regressions.
- Explain the change in plain words first. Give version numbers only because the question named them.

## Return

Report the answer, the source of each quoted passage, and any uncertainty the tool returned. This path never writes; if the user wants a change, point to ontology-build, which has its own approval gates.
