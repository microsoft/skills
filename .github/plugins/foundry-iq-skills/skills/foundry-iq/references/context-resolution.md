# Context resolution

Discover tenant, subscription, resource group, Search service, endpoint, location, SKU, identity, local-auth state, public-network state, current objects, ETags, quotas, and dependent resource IDs read-only. Keep demos in a dedicated tagged resource group. Stop on tenant/subscription mismatch or an unresolved ownership boundary.

## Script paths

Set `$loadedSkillPath` to the absolute path of the loaded `SKILL.md`, not an
assumed checkout or current directory. Resolve it before invoking a packaged
helper; stop if the loaded file is unavailable:

```powershell
$skillRoot = Split-Path -Parent (Resolve-Path -LiteralPath $loadedSkillPath -ErrorAction Stop).Path
```

Helpers use `Join-Path $skillRoot` with their packaged path, including
workflow-owned helpers under `workflows\<id>\scripts`.

For shell-neutral examples, replace `<helper>` with the absolute packaged script
path resolved from that same loaded skill, not the current working directory.

## Retrieval setup decisions

Recommend from discovered evidence; ask when confidence is low.

| Decision | Guidance |
|---|---|
| Extraction | Start with basic text extraction. Choose Content Understanding Standard when representative diagrams, tables or layouts need richer extraction. |
| Architecture | Keep small one-off context local. Use classic Search for bounded lookup or custom indexing/ranking; prefer a KB for managed ingestion, source selection, multi-search/synthesis or agentic citations. A KB runs on a Search service. |
| Retrieval | Prefer hybrid keyword + vector retrieval for better coverage; choose keyword-only or vector-only when the data type calls for it. Verify index/model support and include embedding costs in approval. |
| Reuse | Prefer compatible existing services, sources, KBs and pipelines; provision missing resources with [service approval](service-provisioning.md). |

Customer goals are sufficient inputs. Inspect size, freshness, permissions and
representative questions before writes. Standard setup and REST operations use
official documentation. Load only the shared reference needed by the selected task.

KS -> KB: verify readiness, then resolve composition and retrieval through official API discovery.
For source configuration, select the source's contract from the official
[knowledge-source documentation](https://learn.microsoft.com/azure/search/agentic-knowledge-source-overview).
Load only the selected source's documentation and verify the resolved API version.
For protected content or source access, also read the matching
[source-specific security](source-security.md) section.
For classic-index ingestion, resolve the selected source and indexing contract
through official API discovery.
Vector ingestion requires a verified embedding/indexing contract through API discovery.
For agent attachment, select [classic-index binding](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/ai-search)
or [official KB MCP integration](https://learn.microsoft.com/azure/foundry/agents/how-to/foundry-iq-connect)
from the actual retrieval architecture. Apply [existing-agent safety](safety-and-idempotency.md#existing-agent-changes).
For KB connection reuse, creation or repair, verify the official integration
contract before writes. Do not copy Search labels into created agents.
Delegate new agent creation to `microsoft-foundry`; if unavailable, return
`microsoft-foundry-required`, not a replacement creation flow.

## Official API discovery

For an API operation not fully specified by shared guidance, resolve its plane,
target and exact version under [API policy](api-version-policy.md), then consult
[Search data-plane REST](https://learn.microsoft.com/rest/api/searchservice/)
or [Search management REST](https://learn.microsoft.com/rest/api/searchmanagement/).
Verify the method, path, complete writable body, permissions, pagination,
concurrency and response for that version before executing. A documentation
link alone is not an executable contract. Unavailable or incompatible
documentation blocks execution; never invent a request, payload or permission.
Apply [HTTP](http-contract.md),
[safety and recovery](safety-and-idempotency.md), and
[readback](validation.md). Existing failure, approval and ownership boundaries
remain mandatory even for a documented standard operation.
