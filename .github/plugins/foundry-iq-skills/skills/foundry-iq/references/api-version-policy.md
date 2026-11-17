# API version policy

## Task-scoped parameters and defaults

Resolve only the planes needed by the current task. Management and data-plane versions are independent; a Search service does not have one service-wide API version.

| Task parameter | Default field in [API version defaults](api-version-defaults.json) |
|---|---|
| `managementApiVersion` | `managementPlaneApiVersion` |
| `dataApiVersion` | `dataPlaneApiVersion` |

The JSON file is the single runtime source of default version values. These defaults
describe the shared recipe baselines, not a promise to use the latest release.
Verify the selected operation and exact version against authoritative API
documentation before execution. Versioned reference
links and example payloads describe the default baseline; they do not establish
compatibility with other versions.

Only load defaults when the task lacks a resolved, compatible version after
checking the user's selection, project configuration and original request.
Resolve the file from the loaded `SKILL.md`, not the working directory.
Missing/malformed defaults or invalid fields block default lookup; never
substitute a literal or use the repository-only benchmark inventory.

```powershell
$skillRoot = Split-Path -Parent (Resolve-Path -LiteralPath $loadedSkillPath -ErrorAction Stop).Path
$apiDefaultsPath = Join-Path $skillRoot 'references\api-version-defaults.json'
$apiDefaults = Get-Content -LiteralPath $apiDefaultsPath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
foreach ($name in 'managementPlaneApiVersion', 'dataPlaneApiVersion') {
    $value = $apiDefaults.$name
    if ($value -isnot [string] -or $value -notmatch '\A[0-9]{4}-[0-9]{2}-[0-9]{2}(-preview)?\z') {
        throw "Invalid API default field: $name."
    }
}
```

This reads defaults only; it does not assign or overwrite `managementApiVersion`
or `dataApiVersion`. Use the matching field only for the unresolved plane after
the precedence and compatibility checks below.

These parameters are instructions for the agent, not automatic skill arguments. Record the exact version, plane, target, selection source (`user`, `project`, `original-request`, or `policy`), and compatibility evidence in the task context. When filling a request template, substitute the resolved task value directly in the same invocation. Do not infer task context from a leftover shell variable or an unrelated earlier task.

## Resolve before every entry point executes

1. **Reuse a resolved value:** if the current task already has a compatible version for this plane and target, reuse it. When a capability needs another version, reconcile the plan and record an operation-scoped override; do not silently overwrite the original request context.
2. **Resolve a missing value:** use the customer's explicit version first, then the relevant existing project configuration (or original request version when troubleshooting), then the policy default for that plane. Clarify an ambiguous version when the task spans both planes. Do not interpret a version requested for one plane as an override for the other.
3. **Check compatibility:** verify that the selected version supports every required operation and feature, including region/tier constraints. For an override, consult authoritative documentation for that exact version and compare request bodies, response shapes, pagination, and SDK/tool support with the recipe. Do not merely replace the URL version. The agent's documentation check is not retained live-test evidence.
4. **Select compatible alternatives without a separate permission question:** newer or preview versions are allowed for read-only discovery, including properties absent from the default management API. For writes, a different version is also allowed after the documentation/contract check above, within the authorized scope. Record the choice and adapted payload; version selection alone needs no user approval. Disclose preview use before mutations. Respect explicit version pins, GA-only requirements and organization policy; ask only if these conflict or scope/impact changes. If unsupported, retired, incompatible, or cannot be verified, stop and explain the blocker. Never silently fall back to the policy default or strip requested functionality.
5. **Keep the task consistent:** pass the resolved context to each operation and use the appropriate plane's value in every constructed request. If a helper or SDK cannot honor it, use a compatible interface or explain the blocker. Follow service-returned continuation and status URLs as documented rather than rewriting their query parameters.

Workflows and standalone API requests resolve needed planes before requests.
Troubleshooting preserves the original version for reproducing the failing
request, while documented read-only discovery can use an operation-scoped
override. Never change versions as a generic retry strategy. Approval for
resource changes remains separate from API-version selection.

## Scenario contracts

Resolve these independently within the task's explicit version constraints:

- **Foundry KB connection:** `connectionApiVersion = 2025-10-01-preview`
  is the documented ARM contract in [official KB integration](https://learn.microsoft.com/azure/foundry/agents/how-to/foundry-iq-connect).
  Modern Agent API uses `v1` and project `/openai/v1/responses`; verify SDK/draft
  support separately from Search versions.
- **Remote SharePoint:** use compatible `2026-08-01-preview` contracts across
  source creation, KB composition and retrieval, including their payload and
  response shapes. See the official
  [source contract](https://learn.microsoft.com/azure/search/agentic-knowledge-source-how-to-sharepoint-remote).

Include preview use in mutation approval. These scenario contracts leave the
policy defaults unchanged.

## Discovery and maintenance

When the user asks for "latest" or an unfamiliar version, consult the official [data-plane versions](https://learn.microsoft.com/rest/api/searchservice/search-service-api-versions), [management-plane versions](https://learn.microsoft.com/rest/api/searchmanagement/management-api-versions), and [upgrade guidance](https://learn.microsoft.com/azure/search/search-api-migration). Resolve an exact version and perform the compatibility checks above; do not automatically select the newest date on every run or assume GA is a superset of preview.

Review new releases and retirements, then promote defaults only with matching
recipe, reference, and validation updates. Prefer a validated GA contract when
it supports the scenario; retain an explicit preview requirement when necessary.
Repository-only benchmark inventories bind their own reviewed versions; they
are neither runtime defaults nor evidence for arbitrary customer overrides.
