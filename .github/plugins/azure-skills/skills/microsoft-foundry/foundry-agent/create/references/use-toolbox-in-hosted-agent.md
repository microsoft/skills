# Use Toolbox in a Hosted Agent

Hosted agents access Foundry-managed tools through a **Toolbox MCP endpoint**. Unlike prompt agents that wire tools directly, hosted agents connect to a single MCP-compatible endpoint that exposes all configured tools. The platform handles credential injection, token refresh, and policy enforcement.

> 🚦 **Toolbox creation gate:** before creating a toolbox/connection, you MUST read the boundary rules in [create-hosted.md → Toolbox creation boundary](../create-hosted.md#toolbox-creation-boundary) and follow them, then continue with the rest of this file.

> 📘 For endpoint format, MCP protocol details, auth, OAuth consent handling, testing, citation pattern, and troubleshooting, see [toolbox-reference.md](toolbox-reference.md).
>
> 📘 For wiring a remote tool (catalog tile or generic MCP server) into a project connection that a toolbox can attach to, see [foundry-tool-catalog.md](foundry-tool-catalog.md).
>
> 📘 For the supported tool types and their per-type fields, see the table below and the public [Toolbox docs (Configure tools)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox#configure-tools).

> 💡 **This skill is scoped to *consuming* an existing toolbox from agent code** — endpoint resolution, env-var contract, payload shape gathered before agent runtime, verification, and tracing. **Toolbox and connection CRUD belongs in [Foundry Toolkit (VS Code)](https://code.visualstudio.com/docs/intelligentapps/tool-catalog) or the [Foundry Portal](https://ai.azure.com/)** — those surfaces give you tool browsing, metadata, connection wizards, and validation. Use the imperative `azd ai` CLI only for *operational* tasks (retarget the default version, smoke-test an endpoint).

## ✨ Recommendation: enable Tool Search

**Before adding more than ~5 tools to a toolbox, add `{ "type": "toolbox_search_preview" }` to the toolbox.** This replaces the full `tools/list` shown to the model with two meta-tools — `tool_search` (natural-language discovery) and `call_tool` (invoke a discovered tool) — so context cost stays flat as the toolbox grows.

- The `toolbox_search_preview` entry **doesn't count** toward the unnamed-tool-per-type limit.
- All other tools in the toolbox are hidden from the initial `tools/list` and surfaced only by `tool_search` (or by per-user auto-pinning of hot tools).
- Pin specific high-traffic tools or add ranking-only keywords via `tool_configs.{tool_name}` (with `pin: true` and `additional_search_text`).
- In the agent's system prompt, instruct the model to call `tool_search` whenever a needed capability isn't already visible.

Full configuration recipe in [tool-tool-search.md](tool-tool-search.md) and the public [Tool Search (preview) docs](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/tool-search).

## Quick Reference

| Property | Value |
|----------|-------|
| **Toolbox Docs** | https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox |
| **Tool Catalog Docs** | https://learn.microsoft.com/azure/foundry/agents/concepts/tool-catalog |
| **Tool Search Docs** | https://learn.microsoft.com/azure/foundry/agents/how-to/tools/tool-search |
| **Foundry Toolkit (VS Code) — set up tools/toolboxes** | https://code.visualstudio.com/docs/intelligentapps/tool-catalog |
| **Foundry Portal** | https://ai.azure.com/ |
| **Default Sample (Python, Agent Framework + toolbox)** | https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/agent-framework/responses/04-foundry-toolbox |
| **Python Hosted Agent — `responses` (BYO)** | https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/responses |
| **Python Hosted Agent — `invocations` (BYO)** | https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/invocations |
| **C# (.NET) Hosted Agent + toolbox** | https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/csharp/hosted-agents/agent-framework/foundry-toolbox-server-side |
| **Supported Toolbox Scenarios (sample-side reference)** | https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/SUPPORTED_TOOLBOX_SCENARIOS.md |

## Resolve Toolbox Endpoint

If the user provides a toolbox name or endpoint URL, or the project already references a toolbox (e.g., in `.env` or `agent.manifest.yaml`) → use it directly.

Otherwise, ask one question:

> _"Would you like to provide your toolbox endpoint? (you can create one with the [Foundry Toolkit in VS Code](https://code.visualstudio.com/docs/intelligentapps/tool-catalog) or the [Foundry Portal](https://ai.azure.com/))"_

Once the user supplies the toolbox name/endpoint — either an existing one or a new one they create via the Foundry Toolkit or Foundry Portal — set it on the agent (e.g., `TOOLBOX_ENDPOINT` in `.env`) and continue with verification.

> Use the env var name **`TOOLBOX_ENDPOINT`** (no `FOUNDRY_` prefix). The Foundry platform reserves `FOUNDRY_`-prefixed env vars and may silently overwrite them at runtime — see [toolbox-reference.md § Agent env contract](toolbox-reference.md#agent-env-contract).

> **When asking the question, always include the doc links inline** for the manual options — the [Foundry Toolkit in VS Code](https://code.visualstudio.com/docs/intelligentapps/tool-catalog) and the [Foundry Portal](https://ai.azure.com/) — so the user knows where to go to create a tool/toolbox themselves. Don't just name the options; render them as clickable links every time.

> **Before printing out any step-by-step guidance** for the Foundry Toolkit (VS Code) path, fetch and read [Use Tool Catalog to connect tools and Toolboxes in Foundry Toolkit](https://code.visualstudio.com/docs/intelligentapps/tool-catalog) first, then summarize the relevant steps for them. Don't paraphrase from memory — the Toolkit UI changes; quote the current doc.

## Available tool types

The full set is documented — authoritatively — in the public [Toolbox docs (Configure tools)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox#configure-tools). At time of writing the supported `type` values are:

| `type` | Tool | Connection required? |
|---|---|---|
| `mcp` | Remote MCP server (third-party via catalog, BYO OAuth, or generic) | Optional (none / static key / project MI / OAuth) |
| `web_search` | Web search (basic Bing; optional `web_search.custom_search_configuration` for Bing Custom Search to scope grounding to specific domains) | No (basic); Yes for Custom Search |
| `azure_ai_search` | Azure AI Search index | Yes (Search service connection) |
| `code_interpreter` | Sandboxed Python execution | No |
| `file_search` | Vector-store-backed retrieval over uploaded files | No (vector store is part of the toolbox) |
| `openapi` | REST API exposed via an OpenAPI 3.x spec | Conditional (`connection` requires `project_connection_id`; `managed_identity` does not — uses project MI + `audience`) |
| `a2a_preview` | Call another Foundry agent as a tool | Optional |
| `work_iq_preview` | Microsoft 365 work context (mail / meetings / files / chats) via Work IQ | Yes (Work IQ `RemoteA2A` OAuth connection; BYO Entra app; M365 Copilot license per user) |
| `fabric_iq_preview` | Microsoft Fabric data (Ontology / Fabric data agent / Power BI semantic model) | Yes (Fabric IQ OAuth connection; tenant admin consent) |
| `toolbox_search_preview` | **Tool Search** — a directive (not a tool) that swaps `tools/list` for `tool_search` + `call_tool` meta-tools | No |

**Adjacent (not a `type` in a toolbox version):**

- **Agent Memory** — for hosted agents, configure the memory store at the **project** level (separate from the toolbox); it is not a toolbox `type` and is not wired through agent code. See the public [Memory docs](https://learn.microsoft.com/azure/ai-foundry/agents/how-to/memory-usage?view=foundry).
- **Routines (preview)** — not a tool; an agent **trigger** (`schedule` / `timer` / `github_issue` / `custom`) that invokes an existing agent. See the [public Routines docs](https://learn.microsoft.com/azure/foundry/agents/how-to/use-routines).

## Information to Gather Before Building a Toolbox Payload

When the user asks to "add an MCP tool" or similar, **never guess**. Confirm each field before generating a toolbox payload:

| # | Question | Why needed |
|---|----------|------------|
| 1 | **MCP server URL?** | The `server_url` field on the `mcp` tool entry |
| 2 | **Auth type?** `none` / `key` / `mi` / `oauth` | Determines whether a project connection is required and which shape to create (see [foundry-tool-catalog.md](foundry-tool-catalog.md)) |
| 3 | **Project connection name** (if auth ≠ `none`) | The `project_connection_id` field; must already exist in the Foundry project |
| 4 | **`server_label`** | Short prefix for the tool names exposed by this server (e.g. `myserver`) |
| 5 | **Toolbox name** | The container that will hold the tool entries |
| 6 | **Foundry project endpoint** | Where the toolbox is created — read from `PROJECT_ENDPOINT` / `AZURE_AI_PROJECT_ENDPOINT` (avoid `FOUNDRY_`-prefixed names) |
| 7 | **Many tools planned?** (> ~5) | If yes, also add `{ "type": "toolbox_search_preview" }` so the model uses [Tool Search](#-recommendation-enable-tool-search) instead of seeing the full list. |

### Toolbox payload — MCP with a project connection

```json
{
  "name": "<TOOLBOX_NAME>",
  "description": "MCP server with key or OAuth auth",
  "tools": [
    {
      "type": "mcp",
      "server_label": "<LABEL>",
      "server_url": "<SERVER_URL>",
      "require_approval": "never",
      "project_connection_id": "<CONNECTION_NAME>"
    }
  ]
}
```

### Toolbox payload — public MCP (no auth)

```json
{
  "name": "api-specs",
  "description": "Public MCP server, no connection needed",
  "tools": [
    {
      "type": "mcp",
      "server_label": "api_specs",
      "server_url": "https://gitmcp.io/Azure/azure-rest-api-specs",
      "require_approval": "never"
    }
  ]
}
```

### Toolbox payload — large toolbox with Tool Search

```json
{
  "name": "big-toolbox",
  "description": "Many tools — model uses tool_search to discover",
  "tools": [
    { "type": "toolbox_search_preview" },
    { "type": "web_search" },
    { "type": "azure_ai_search", "name": "docs_index", "project_connection_id": "search-conn", "index_name": "docs" },
    {
      "type": "mcp", "server_label": "github", "server_url": "<github-mcp-url>",
      "project_connection_id": "gh-conn",
      "tool_configs": {
        "search_issues": { "pin": true, "additional_search_text": "GitHub issues bug tracking" },
        "*":             { "additional_search_text": "GitHub repositories code" }
      }
    }
  ]
}
```

## Operational helpers via `azd ai` CLI

> The `azd ai` CLI also exposes `connection create`, `toolbox create`, `toolbox list`, and `toolbox delete`. Prefer **Foundry Toolkit (VS Code)** or the **Foundry Portal** for those — the UI gives you tool browsing, connection wizards, and validation. The two commands below are the ones the skill should still drive directly because they're *operational*, not setup.

> All commands require `--project-endpoint <PROJECT_ENDPOINT>` (the value of `PROJECT_ENDPOINT`, e.g. `https://<account>.services.ai.azure.com/api/projects/<project>`). To avoid repeating it, export it once:
>
> ```pwsh
> $PE = "https://<account>.services.ai.azure.com/api/projects/<project>"
> ```

### Retarget the default version — `azd ai toolbox publish`

Each toolbox version is **immutable**. The version an agent actually hits is the one marked `*` in `versions list` — i.e. the **default version**. Use `publish` to point that pointer at any existing version (e.g. rollback to a known-good version after a bad publish).

```pwsh
# Inspect first — current default is marked with '*'
azd ai toolbox versions list my-toolbox --project-endpoint $PE

# Retarget the default
azd ai toolbox publish my-toolbox 20 --project-endpoint $PE --no-prompt

# Verify (Default version / Shown version / Endpoint all reflect the new value)
azd ai toolbox show my-toolbox --project-endpoint $PE
```

- `publish <name> <version>` promotes an existing version to default (also used to roll back).
- Validated: switched `default-tb` from version 21 → 20 → 21; both `show` and the computed MCP endpoint (`.../toolboxes/<name>/versions/<n>/mcp?api-version=v1`) tracked the change immediately.

### End-to-end smoke test

After the toolbox is created (via Toolkit / Portal / `azd`), hit the MCP endpoint directly to confirm the tool is reachable before pointing an agent at it:

```pwsh
$TOK = az account get-access-token --resource "https://ai.azure.com" --query accessToken -o tsv
$H   = @{
  Authorization      = "Bearer $TOK"
  "Content-Type"     = "application/json"
}
$URL = "$PE/toolboxes/my-toolbox/mcp?api-version=v1"
$body = @{ jsonrpc = "2.0"; id = 1; method = "tools/list"; params = @{} } | ConvertTo-Json
(Invoke-RestMethod -Method POST -Uri $URL -Headers $H -Body $body).result.tools | Select-Object name
```

`?api-version=v1` is required.

> ⚠️ **Agent-identity-authed tools won't work locally — that's expected, not a blocker.** The token above is your **user** identity, not the deployed agent's.

## Code Integration Patterns

The sample repo provides integration patterns for both Python and C#. Read the sample code and adapt it to the user's project.

**Python samples:**

| Sample | Framework | Protocol | When to use |
|--------|-----------|----------|-------------|
| [`agent-framework/responses/04-foundry-toolbox/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/agent-framework/responses/04-foundry-toolbox) — recommended | Agent Framework (MAF) | Responses | **Default choice** |
| [`bring-your-own/responses/langgraph-toolbox/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/responses/langgraph-toolbox) | LangGraph (BYO) | Responses | LangGraph hosted agent with toolbox |
| [`bring-your-own/responses/bring-your-own-toolbox/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/responses/bring-your-own-toolbox) | Generic MCP (BYO) | Responses | Raw `httpx` MCP client — works with any framework |
| [`bring-your-own/invocations/toolbox/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/invocations/toolbox) | Generic MCP (BYO) | Invocations | Toolbox via Invocations protocol |

**C# (.NET) samples:**

| Sample | Description |
|--------|-------------|
| [`csharp/hosted-agents/agent-framework/foundry-toolbox-server-side/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/csharp/hosted-agents/agent-framework/foundry-toolbox-server-side) — recommended | Agent Framework agent with toolbox MCP (Responses protocol) |

**Notes** (apply to all patterns, both Python and C#):

- Auth: Inject a bearer token with scope `https://ai.azure.com/.default` on every request (Python: `httpx.Auth` subclass; C#: `DefaultAzureCredential` + `BearerTokenAuthenticationPolicy`).
- MCP client: Pass `load_prompts=False` — the toolbox endpoint does not support `prompts/list`.
- Endpoint: Construct from `{project_endpoint}/toolboxes/{toolbox_name}/mcp?api-version=v1`.
- Multi-tool toolboxes: at most one tool per unnamed type, and unique `server_label` per MCP tool (see [toolbox-reference.md](toolbox-reference.md#multi-tool-toolbox-constraint)). `toolbox_search_preview` doesn't count toward this limit.
- Tool naming: MCP-sourced tools are prefixed `{server_label}___{tool_name}` (three underscores); **all other tool types** use the entry's `name` field value (or the default tool name).

> 💡 **Tip:** If MCP tools have `require_approval: "always"` in `_meta.tool_configuration`, the agent runtime must ask the user for confirmation before invoking. The toolbox endpoint does not enforce this — your agent code is responsible.

## Tracing

All toolbox samples emit OpenTelemetry traces. No code changes are required to enable export to Azure Monitor — it's purely a configuration step.

- **Local development:** set `APPLICATIONINSIGHTS_CONNECTION_STRING` in the agent's `.env`.
- **Deployed:** the platform injects `APPLICATIONINSIGHTS_CONNECTION_STRING` automatically when the Foundry project is linked to an Application Insights resource.
- **Per-framework instrumentation hooks** (already present in the samples):
  - `maf` — `main.py` calls `enable_instrumentation()`.
  - `langgraph` / `azd` — auto-instrumented by `azure-ai-agentserver-core[tracing]`.
- **Viewing traces:** Azure Portal → Application Insights → **Investigate → Transaction search** (per-trace) or **Application map** (dependency graph).
