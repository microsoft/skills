# Entity Graph consume

First read [runtime setup](../graph-guide/references/install-and-checks.md#plugin-and-clis); use its `run <domain>` launcher.

Read-only only.

| Intent | Load |
|---|---|
| Install the CLI, check the descriptor, environment, or advertised capabilities | [Health and capabilities](references/health-and-capabilities.md) |
| Retrieve cited passages; choose lexical or hybrid search | [Document retrieval](references/document-retrieval.md) |
| Traverse relationships, test a premise, answer a set of questions, or explain graph limits | [Graph traversal](references/graph-traversal.md) |

## Shared rules

Use the `entity-graph-consume` CLI with `--json`. Run `entity-graph-consume doctor` before a live query and follow its one `next_step`. `--descriptor` defaults to `ENTITY_DESCRIPTOR`, then the current published descriptor; pass an absolute path when another is intended. On a 403, don't retry or assume a missing role: check the service error, the network path the call takes, Search firewall or private-network settings, and the caller's effective access; suggest a Search reader grant only when access is the cause.

Never provision, upload, repair, or mutate indexes here.

Answer only from returned evidence and cite its provenance. Check the question's premise first. If graph retrieval is disabled, say so before falling back to document retrieval. Never expose secrets or private content beyond the requested evidence.

After answering, offer the [Graph Playground](../graph-guide/references/install-and-checks.md#graph-playground). Call the service "Azure AI Search graph queries", never "Graph API" (that is Microsoft Graph).
