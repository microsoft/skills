# Missing agent for a knowledge-base connection

Load only from Connect for a missing agent, not generic creation, replacement
or the existing-agent SDK connection fallback. Preserve existing agents/versions.

## Resolve and offer the creation capability

Use prompt/session/workspace and exact Azure readback to recommend project,
type/name and existing model deployment. Ask only unresolved choices.
Inventory all pages; permission denial or incomplete discovery is not absence.
An existing incompatible agent does not authorize a new name: require explicit
new-agent intent and prove the selected new identity absent.

Check the runtime registry or exact invocation for `microsoft-foundry`. Skill
availability and authenticated creation-tool availability are separate facts.
Unknown stays unknown; never claim unexecuted delegation.
If unavailable, ask one focused choice, unless already answered:

- Install Microsoft's Azure Skills plugin (recommended).
- Decline installation and review local CLI creation for a Prompt Agent.
- Stop with setup guidance.

Do not install automatically. Show the source, host/workspace scope and exact
commands. Installation consent is separate from Azure creation approval;
cancellation stops. In Copilot CLI these are interactive host commands, not
PowerShell commands:

```text
/plugin marketplace add microsoft/azure-skills
/plugin install azure@azure-skills
/mcp show
```

With MCP already configured, the skill-only option is:

```text
npx skills@1.7.4 add https://github.com/microsoft/azure-skills --skill microsoft-foundry
```

Skill-only installation does not install or authenticate MCP tools. After
installation, reload if required and recheck runtime visibility, authentication
and exact creation operations. If installation/reload cannot run here, give
the commands to the user. If tools remain unavailable, report
`creation-provider-unavailable`, zero Azure writes, and offer the CLI choice;
do not silently switch. Never bypass an authorization
denial through another surface.

## Creation plan and approval

Prefer available delegation. Do not scan policy before either creation path.
Use [policy diagnostics](../references/search-substrate.md#azure-policy-diagnostics-after-creation-failure)
only after a creation failure implicates policy. Preserve known required
settings. Present one immutable creation plan with:

- Exact tenant/subscription/project ID and matching endpoint, absent agent name,
  Prompt/Hosted type, model deployment and full initial definition.
- Provider, API/version, exact expanded commands and request bodies or delegated
  commands, local files/installations and digests.
- Identity/RBAC, network/data movement, known requirements,
  existing and incremental costs, verification, retained resources and owner.
- `plan_fingerprint` and `cleanup_approved: false`.

Let the user review delegated commands before execution. Changed commands,
model, scope, known requirements or definition require new approval. Approval to install
or select CLI does not approve creation. Creation does not approve the KB
connection, Search roles, invocation charges or cleanup.

## Local CLI fallback: Prompt only

Execute locally only after explicit CLI selection and creation-plan approval.
Reuse an accessible existing project and chat model deployment; read back the
deployment identity, model/version and status rather than copying a sample
model. Missing project/model/rights/network prerequisites block this fallback;
do not provision them, change permissions/networking or substitute a Hosted
Agent. Hosted creation remains delegated; if unavailable, return
`creation-provider-unavailable` with official guidance.

Use signed-in Azure CLI identity with Foundry v1 REST.
Verify `az version` and `az account show`; authenticate only if needed.
`az rest --resource https://ai.azure.com/` obtains tokens internally. Never use
keys, ask for tokens, print tokens or enable verbose/debug credential logging.

Before approval, review the complete body in a UTF-8 file:

```json
{
  "name": "<approved-agent-name>",
  "definition": {
    "kind": "prompt",
    "model": "<verified-model-deployment-name>",
    "instructions": "<approved-initial-instructions>",
    "tools": []
  }
}
```

No initial KB binding. These CLI templates use no shell variables (Bash,
PowerShell, cmd.exe). Replace placeholders before execution with the approved
endpoint (no trailing slash), name, returned version and OS-native absolute body
path. Keep URLs and the `@`-prefixed file argument quoted.

```text
az rest --method get --url "<project-endpoint>/agents/<agent-name>?api-version=v1" --resource https://ai.azure.com/
```

Inspect the actual HTTP result, not just a nonzero exit. A 404 is absence only
after successful project access and complete agent inventory; a 401/403, timeout
or malformed response blocks. For a present identity, list every version and
compare the full approved definition including model, instructions and tools.
A sole exact match is zero-write reuse; multiple matches or drift block.
Never choose latest automatically, overwrite, suffix-create or issue a version
POST on replay. Return connected versions to Connect; never reset their tools.

Before writing, refresh absence/access and recompute the
approved plan/body digests. Changed evidence needs new review. Only after all
gates pass, issue one create-agent POST, not an update or create-version call:

```text
az rest --method post --url "<project-endpoint>/agents?api-version=v1" --resource https://ai.azure.com/ --headers "Content-Type=application/json" --body "@<body-file>"
```

Retain exit status and the first error/status/request ID. Never blindly
retry POST, including on timeout/409/5xx. Reconcile an ambiguous write by reading
the same identity and all versions. If the exact result or ownership is
unproven, report `partial` with potentially created resources and stop; never
switch to SDK/delegation or delete to make it pass.

## Verify and return to Connect

For local Prompt creation, independently GET the agent and returned version,
and list all versions; command acceptance is not proof:

```text
az rest --method get --url "<project-endpoint>/agents/<agent-name>?api-version=v1" --resource https://ai.azure.com/
az rest --method get --url "<project-endpoint>/agents/<agent-name>/versions?api-version=v1" --resource https://ai.azure.com/
az rest --method get --url "<project-endpoint>/agents/<agent-name>/versions/<agent-version>?api-version=v1" --resource https://ai.azure.com/
```

Follow pagination. Require matching project/name/version, Prompt kind, full
definition and usable status, with no duplicate versions or unexpected tools.
Record actual project/agent identities; never guess a principal. Unknown
required identity blocks connection, even if agent creation succeeded.

Return `completed`, `blocked` or `partial`, IDs/version/model/status, definition
digest, identity evidence, first failure, API/provider/commands, approved
fingerprint, writes, ownership and retained resources. Return to Connect:
independently read back, use fresh discovery and a new fingerprinted connection
plan, and never carry creation approval. After connection approval, invoke the
exact version; require KB tool-call evidence, original citations and abstention.
Direct KB retrieval is not agent proof. Repeat Connect and compare
version/tool/connection IDs and counts with zero writes.

Before local creation, select [receipt capture](connect-prompt-sdk-fallback.md#initial-local-prompt-creation-only).
No automatic cleanup: separate ownership/approval; retain prior versions,
shared resources and container.

## Authorities

Authorities: failure/conflict/uncertainty only.

[Installation guide](https://learn.microsoft.com/azure/foundry/how-to/develop/use-microsoft-foundry-skill),
[Foundry v1 REST API](https://learn.microsoft.com/rest/api/microsoft-foundry/aiproject),
[Prompt quickstart](https://learn.microsoft.com/azure/foundry/agents/quickstarts/prompt-agent).
