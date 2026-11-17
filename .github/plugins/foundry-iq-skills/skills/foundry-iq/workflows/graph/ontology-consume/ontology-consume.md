# Ontology consume

First read [runtime setup](../graph-guide/references/install-and-checks.md#plugin-and-clis); use its `run <domain>` launcher.

Read-only only.

| Intent | Load |
|---|---|
| Check setup, list versions, find the current approved ontology, show classes or a diagram | [Browse ontology](references/browse-ontology.md) |
| Explain a class from its evidence, or diff two versions | [Evidence and diff](references/evidence-and-diff.md) |
| Validate an OWL file, or price a proposal | [Check and estimate](references/check-and-estimate.md) |

## Shared rules

Use the `ontology-consume` CLI with `--json` for every read. It never changes the state directory and makes no network calls. Pass `--state-dir` (demo: `<run_directory>\ontology`) when the state directory is not `.ontology-state` in the working folder. The optional Apps adapter only adds packaged ontology and evidence views; it does not replace the CLI.

Never propose, refine, approve, or export here. Answer in plain words with class and property names, descriptions, and cited passages; quote excerpts as returned and name their source. Mention schema IDs and version numbers only when asked. On a blocked result, relay `error` and do exactly `next_step`. Never guess. After answering, offer the [Graph Playground](../graph-guide/references/install-and-checks.md#graph-playground).
