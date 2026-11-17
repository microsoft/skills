---
name: foundry-iq
description: 'Use for Azure AI Search, Foundry IQ, document-grounded agents and graphs built over documents. WHEN: search, indexes, queries, access/connectivity failures, ingestion/freshness failures, retrieval quality, grounding, guidance or REST payloads; entity knowledge graphs (entities, relationships, multi-hop questions), topic graphs (corpus-wide themes), graph-backed grounding passages, ontologies (OWL drafts, versions, validation, export), or a Foundry IQ graph demo. Invoke before answering or making calls, even without Azure access. Covers vector/semantic/BM25 search. Not for other Azure products, Microsoft Graph API, or continuous evaluation.'
license: MIT
metadata:
  author: Microsoft
  version: "0.3.1"
---

## Intent routing

Failures first; one route. Ask if unclear.
Diagnose before setup or quality; relevance needs proven freshness.

| Intent | Load |
|---|---|
| Graphs or ontologies | `workflows/graph/graph.md` |
| Other Search requests | [Azure AI Search documentation](https://learn.microsoft.com/en-us/azure/search/), using [context](references/context-resolution.md) and the shared rules below |

Use official documentation and shared guidance for Search requests.
Cleanup follows [shared safety](references/safety-and-idempotency.md#scenario-cleanup).

## Shared rules

Read [HTTP](references/http-contract.md), [versions](references/api-version-policy.md), [safety](references/safety-and-idempotency.md); return [handoff](references/output-contract.md). Resolve/reuse `managementApiVersion`/`dataApiVersion` before requests.
For errors, provisioning/429, or private access/DNS/connectivity, use [errors](references/error-taxonomy.md), [limits](references/limits-and-capacity.md) and [networking](references/networking.md).

For protected content, source access, or permission changes, load the matching
[source security section](references/source-security.md).
Keep caller, Search outbound identity, and end-user authorization distinct.
Entra/least privilege/reuse; approve billable/permission/network/production/destructive/credential/data-movement. No data/secrets.
