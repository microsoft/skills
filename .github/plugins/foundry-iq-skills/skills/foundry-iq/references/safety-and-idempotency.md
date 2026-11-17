# Safety and idempotency

Read before write. Prefer deterministic names and PUT upserts. Use ETags for concurrent updates. Deletes, resets, resync, upgrades, key rotation, document batch removal, role changes, and network changes require an explicit impact statement. Validate every mutation and retain a redacted prior definition or source-of-truth recreation path.

## Access and credentials

Resolve permissions from the exact operation's official documentation. Reuse
sufficient existing access, including inherited, group and custom grants;
approve only missing permissions at the narrowest supported scope. A 401/403
alone does not prove a missing grant. Check the actual identity, token audience,
request and effective access before proposing a change.

Identity enablement/attachment, authentication-setting and permission changes require
explicit approval covering the exact identity, action and resource scope.
Reuse approval already covering that exact change; never remove existing access
or broaden the approved corpus without it.
Verify grant authority at that scope separately from operation access. If authority
is missing or unverified, give the administrator the exact principal ID, required
permission, resource scope and blocked action; pause the dependent operation.
Never request broad Owner access or silently fall back to keys. After an approved
grant, bound propagation and verify the original operation with its actual
principal/runtime; an assignment write alone is not effective-access proof.

Never disclose, persist or log API keys or tokens, even on request, including
partial or encoded values and screenshots. Refuse disclosure without retrieving
the secret; direct the user to the Azure portal or their administrator and never
ask them to paste it back. Retrieve credentials only for an explicitly approved
credential operation, privately and without model-visible/output leakage.
Keep tokens in memory; if the tool cannot suppress secrets, stop. Credential
operation approval does not authorize disclosure or enabling key authentication.

## Shared resource updates

Preserve unrelated KB settings and sources. Reuse a compatible existing resource
only after checking its approved corpus, access and freshness. For an approved
update, retain its prior definition and use its ETag; a concurrent-update conflict
requires re-discovery, never an unconditional overwrite.

## Routine validation

Within the requested task's authorized identity, corpus, network and existing
resources, **fewer than 25 test queries in total** need no separate permission
for query/model charges. Count Search, KB and agent test calls, including retries,
across the task; do not split batches to evade the limit. At **25 or more**, obtain
testing/spend approval first, reusing an approval that already covers it.
Bound runtime/output and report usage; explicit user/organization restrictions
still apply. This does not authorize new resources, grants, data movement,
production changes or formal cloud evaluation/judge runs.

A manual run of an existing, idle indexer with unchanged source, configuration
and data boundary needs no extra confirmation. Check status first; do not
interrupt active work or blindly retry an uncertain run. Creating or changing
an automated schedule still requires approval, as do resets/resync, configuration,
permission and network changes. Diagnose and reuse existing authorization before
asking again.

## Existing-agent changes

For classic-tool or KB-MCP attachment, retain the pinned original definition and
metadata/description/blueprint privately. Preserve model, instructions, tools,
approval policy and unrelated behavior; review only the intended binding delta.
Approve corpus exposure, project-wide connection sharing, instruction changes,
one draft and costs before writes. Stage only an approved draft, not a release;
reuse an exact matching binding.

For project connections, list/get before writes; reuse only matching target,
category, authentication, audience and sharing. A 401/403 is not absence.
Never repoint or overwrite an incompatible connection, downgrade to keys or
silently enable project-wide sharing. Verify supported conditional creation;
if unavailable, coordinate name ownership and re-read/stop rather than claim
atomic create safety. Read back the approved properties before binding.

Before KB helper planning, verify the consuming application's per-user identity
flow for protected content. Missing support blocks with `user-authorization-required`.
When needed, include `--per-user-authorization` in both plan and apply; review
`perUserAuthorization` and the proposed header before approval. Keep tokens in
memory, out of files, prompts and logs. Preserve all reviewed binding options.
The helper defaults to MCP approval `always`; `never` needs explicit tool/corpus
approval. The helper is read-only without `--apply`; review its delta and
`latestReleasedVersion` before `--apply --expected-latest-version "<reviewed-version>"`.
Stale state or incompatible draft semantics block; never change production routing.

Read back the full candidate and compare preserved settings and unrelated behavior.
Invoke the returned, version-pinned candidate in the original runtime. Require the
actual KB tool call or native Search tool evidence, known fact, original-source
citations and no tool/source errors. Pending approvals or missing evidence are
incomplete; a draft or HTTP success is not grounding. Verify differently entitled
users where required; unavailable checks remain unverified.

An uncertain create requires list/reconciliation, never a blind retry.
Approved cleanup deletes only owned, unused candidate versions with
`agents.delete_version(agent_name, agent_version)` after dependency checks;
verify absence and retained application behavior. Never delete the original
agent, baseline or reused connections; ownership markers alone cannot authorize it.

## Scenario cleanup

1. During creation, track exact resource IDs/names, dependencies, and created versus reused ownership, including role assignments and KS `createdResources`. Read back this inventory before teardown; do not infer ownership from names.
2. An explicit request such as "tear down all resources created by this scenario" authorizes cleanup of that verified inventory. Show the exact resources and impact, then proceed without per-resource confirmation. Reuse this authorization at each operation's approval gate; ask only if ownership, scope, or impact is unclear or changes. Never delete reused/shared resources or alter their references under this authorization.
3. Delete owned KBs first. Before deleting a KS, inspect all KB definitions for references; preserve a source referenced by a retained KB unless reference removal is separately approved. Then delete owned KSs using their [delete contract](https://learn.microsoft.com/rest/api/searchservice/knowledge-sources?view=rest-searchservice-2026-08-01-preview), which handles generated assets; do not pre-delete their indexes.
4. For independently created pipelines, delete owned indexers before their skillsets, data sources, and indexes; remove authorized references first. Remove only scenario-created role assignments no longer needed. Delegate Storage/model cleanup to their owning skills within the same scope. Delete owned Search services or exclusively owned resource groups last, after checking for new or reused contents.
5. Verify each deletion by GET/404, including KS-generated assets, and confirm retained resources remain intact. Stop on dependency conflicts and re-discover; never widen the deletion scope to force success. Report failures and remaining resources rather than claiming complete cleanup.
