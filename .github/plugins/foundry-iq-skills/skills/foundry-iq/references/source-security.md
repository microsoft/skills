# Source-specific security

Apply the [access and approval safeguards](safety-and-idempotency.md#access-and-credentials).

Read only the section for the source involved in discovery, ingestion, retrieval
or diagnosis. For mixed-source retrieval, check each selected source separately;
one authorized source does not authorize the rest. Diagnose access or freshness
failures before changing ranking or starting quality optimization.

Keep three boundaries separate: caller access to Search, Search-to-dependency
access, and the end user's document authorization. Search Service Contributor
manages object definitions, not document access; content reads normally require
Search Index Data Reader, writes Search Index Data Contributor. Generated
indexed-source creation can require both definition and content-write access.
Verify the exact selected API's requirement; never choose roles from HTTP
method alone. A project connection authenticates the tool, not its end user.

### File uploads

Approved local-file access permits reading only the agreed files; uploading
copies content into Search. File sources do not automatically inherit local
filesystem ACLs. An upload receipt or generated index is not proof of per-user
authorization. If protected access is required, verify a supported deployed
permission mechanism before upload or retrieval; otherwise report the blocker.
Never substitute setup or project identity for a differently entitled user.

### Blob and ADLS Gen2

Check the Search managed identity actually selected by the source, including
system-assigned versus user-assigned identity, and Storage Blob Data Reader on
the approved storage scope. ADLS Gen2 source ACL requirements are separate from
Azure roles and Search content roles. Preserve the exact container/prefix;
an empty prefix needs whole-container approval.

For supported permission-aware ingestion, verify `ingestionPermissionOptions`,
the generated index's permission fields and exact approved container ARM IDs,
without stray delimiters. Ingestion success does not prove valid permission
metadata or effective query-time enforcement. Require an entitled known-answer
query and a differently entitled denial. Malformed scopes block readiness;
never edit a generated index or broaden grants to conceal them.

### Indexed SharePoint

Verify the configured application, same tenant, supported credential/federation,
documented permissions and tenant-admin consent for the actual content and ACL
features. With `Sites.Selected`, consent is not a site grant: every selected
site needs an explicit grant. Disclose whole-site impact and preserve approved
library scope. Do not grant this agent `Sites.FullControl.All` as a shortcut.
Search RBAC does not grant SharePoint access.

Copying content requires supported permission ingestion, group resolution and
query-time enforcement when source permissions must be preserved. Indexed
permission metadata is a snapshot, not live source authorization. Verify refresh
and revocation through the actual ingestion path and differently entitled users;
do not silently omit ACLs or change to remote retrieval to hide a failure.

### Remote SharePoint

No index/indexer or ingestion-time ACL snapshot: enforce source entitlement on
each request. Verify the same Entra tenant, each querying user's Copilot add-on
or approved Retrieval API pay-as-you-go eligibility, and private user token in
`x-ms-query-source-authorization`. Missing eligibility or identity blocks
retrieval; never borrow another user's license, token or setup identity.

`filterExpression` is a query restriction, not an authorization boundary.
Invalid filters can be silently ignored. Verify an entitled in-scope hit and an
entitled out-of-scope exclusion; permission denial alone does not prove filtering.
Do not change to indexed SharePoint to bypass entitlement or licensing.

### Indexed OneLake

Verify the actual Search managed identity, same Search/Fabric tenant, approved
workspace/lakehouse Files path and external OneLake access setting. Documented
workspace Contributor or Administrator is not Azure subscription Contributor;
disclose workspace-wide impact before a missing grant. Fabric workspace access
does not itself prove end-user document authorization. Verify supported
permission ingestion and query-time enforcement, or stop for protected content.
Never expand an omitted `targetPath` to the whole lakehouse without approval.

### Existing Search index

The index owner retains schema, ingestion and permission-refresh responsibility.
Verify the deployed security filters or native permission metadata and user
identity on the actual app/KB request. `searchFields` and `sourceDataFields`
select fields, not authorization. Wrapping an index does not add missing
permissions, refresh ACLs or justify rebuilding a shared index.

### Public Web

Approve allowed/blocked domains and data movement separately from private-source
access. Do not send private documents, secrets or restricted queries to public
retrieval. A mixed KB needs explicit approved disclosure boundaries; selecting
a source is not proof that the planner preserved them. Omitting domain
restrictions needs explicit approval for unrestricted internet retrieval.

If a Web KS was created, include this note in the final status update:

**Web Knowledge Source note:** The Microsoft Data Protection Addendum does not
apply to data sent to Web Knowledge Source. Customer data flows outside the Azure
compliance and Geo boundary, waiving applicable elevated Government Community
Cloud commitments, including data sovereignty and screened/citizenship-based support.

### Refresh, revocation and derived artifacts

Preserve permission metadata through chunks, citations, caches, graph triples,
topic summaries and ontologies. Source permissions do not automatically
propagate to derived artifacts. Verify their access checks and supported
refresh/revocation behavior before exposing them to another user or service.
If provenance or enforcement is unknown, stop with an authorization blocker.

For indexed content, diagnose stale permission metadata through the original
pipeline; use only a supported, approved permission resync or owner repair.
Do not reset all content or increase grants as a refresh workaround. Remote
authorization must remain per-request. Replay the original operation as the
original principal in its original runtime, preserving filters and pinned agent
version. Verify both authorized content and differently entitled denial,
including revoked access and derived/cached content where applicable. Missing
negative identities or unobservable propagation are unverified, not a pass.

## Official references

- [Document-level access](https://learn.microsoft.com/azure/search/search-document-level-access-overview)
- [SharePoint permissions and consent](https://learn.microsoft.com/azure/search/search-how-to-index-sharepoint-online)
- [Remote SharePoint entitlement](https://learn.microsoft.com/azure/search/agentic-knowledge-source-how-to-sharepoint-remote)
- [OneLake identity](https://learn.microsoft.com/azure/search/search-how-to-index-onelake-files)
- [Web source and terms](https://learn.microsoft.com/azure/search/agentic-knowledge-source-how-to-web)
