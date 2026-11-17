# Topic Graph consume (preview)

First read [runtime setup](../graph-guide/references/install-and-checks.md#plugin-and-clis); use its `run <domain>` launcher.

Read-only only.

| Intent | Load |
|---|---|
| Check the environment, descriptor, sign-in, or reader access | [Health and access](references/health-and-access.md) |
| Answer what topics a corpus covers; show its sitemap; list topics and members; fetch evidence | [Browse topics](references/browse-topics.md) |
| Test a question's premise or rank a topic's most typical passages | [Rank and verify](references/rank-and-verify.md) |
| Table of contents / sitemap | [Browse topics](references/browse-topics.md) |

## Shared rules

Use `topic-graph-consume` directly in the main session shell with `--json` on every command and require `schema_version: "topic-graph-consume-v1"`; read the domain result from `result`. Blocked JSON goes to stderr with `error_code` and `next_step`. Omit `--descriptor` to browse the last published build of the only published source (or pass an absolute path; endpoint, Entra auth, and tenant hydrate automatically). On a 403, don't retry or assume a missing role: check the service error, the network path the call takes, Search firewall or private-network settings, and the caller's effective access; suggest Search Index Data Reader on that index only when access is the cause.

Never build, publish, or modify indexes here. Cite a `chunk_id` and `source_id` for each claim. If a topic is `unnamed`, say any label is your inference. Check a question's premise against the evidence first and say so when contradicted or unverified. After answering, offer the [Graph Playground](../graph-guide/references/install-and-checks.md#graph-playground). Never print keys or tokens.
