# Use a Toolbox from Your Agent Code

A **toolbox** is a single MCP-compatible endpoint that exposes all the tools you've configured; your agent connects to that one URL and discovers every tool inside. For the concept, object model, and API/schema, see [toolbox.md](../../toolbox/toolbox.md).

There are three ways to consume it from agent code:

- **Default SDK — Microsoft Agent Framework (MAF).** The `FoundryToolbox` wrapper does all the plumbing (endpoint resolution, auth, per-request call-id, connect/close). This is the happy path below.
- **LangChain / LangGraph SDK.** Use `AzureAIProjectToolbox` from `langchain-azure-ai`; see the [SDK path](#langchain--langgraph-sdk) below.
- **Other — generic/BYO raw MCP client or C#.** You wire the MCP client yourself. See [Bring Your Own (BYO) — raw MCP client](#bring-your-own-byo--raw-mcp-client).

> 🚦 **Toolbox creation gate:** before creating a toolbox/connection, you MUST read the boundary rules in [create-hosted.md → Toolbox creation boundary](../create-hosted.md#toolbox-creation-boundary) and follow them, then continue with the rest of this file.

> 💡 **This skill covers *consuming* an existing toolbox from agent code.** To add a tool (`web_search`, `file_search`, `azure_ai_search`, `code_interpreter`, `openapi`, `mcp`, `a2a_preview`, …), don't wire it to the agent — put it in a toolbox first, via the `azd ai` CLI ([toolbox.md → Create & use a toolbox](../../toolbox/toolbox.md#create--use-a-toolbox-happy-path)), [Foundry Toolkit (VS Code)](https://code.visualstudio.com/docs/intelligentapps/tool-catalog), or [Foundry Portal](https://ai.azure.com/). The agent only talks to the toolbox's MCP endpoint; add/remove/reconfigure tools there, not in agent code. For supported `type` values and adjacent capabilities (Agent Memory, Routines), see [toolbox.md](../../toolbox/toolbox.md).

## Choose your integration

Pick the path that matches your framework, then start from its sample:

| Path | Framework | Sample | When to use |
|------|-----------|--------|-------------|
| **Default** | Agent Framework (MAF) | [`agent-framework/responses/04-foundry-toolbox/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/agent-framework/responses/04-foundry-toolbox) | Most agents — the `FoundryToolbox` wrapper handles the wiring. Follow the [happy path](#happy-path-default-sdk--maf) below. |
| SDK | LangChain / LangGraph (`langchain-azure-ai`) | [`langgraph/responses/02-langgraph-toolbox`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/langgraph/responses/02-langgraph-toolbox) | Use `AzureAIProjectToolbox`; for user OAuth use [`03-langgraph-toolbox-user-identity`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/langgraph/responses/03-langgraph-toolbox-user-identity). |
| Other | Generic MCP (BYO), Responses | [`bring-your-own/responses/bring-your-own-toolbox/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/responses/bring-your-own-toolbox) | Raw `httpx` MCP client — works with any framework. See [BYO](#bring-your-own-byo--raw-mcp-client). |
| Other | Generic MCP (BYO), Invocations | [`bring-your-own/invocations/toolbox/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/invocations/toolbox) | Toolbox via the Invocations protocol. See [BYO](#bring-your-own-byo--raw-mcp-client). |
| Other | C# (.NET), Agent Framework | [`csharp/hosted-agents/agent-framework/foundry-toolbox-server-side/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/csharp/hosted-agents/agent-framework/foundry-toolbox-server-side) | Agent Framework agent with toolbox MCP (Responses). |

## Happy path (default SDK — MAF)

### 1. Set `TOOLBOX_ENDPOINT`

Hosted agents read the MCP endpoint from one env var, conventionally **`TOOLBOX_ENDPOINT`** (not enforced, but prefer it). For the URL format, see [toolbox.md § MCP endpoint URL format](../../toolbox/toolbox.md#mcp-endpoint-url-format).

Set it in `.env` locally, or `azd env set TOOLBOX_ENDPOINT "<url>"` when deployed; get the URL via `azd ai toolbox show` (see [toolbox-azd.md § CLI surface](../../toolbox/references/toolbox-azd.md#cli-surface)).

> ⚠️ **Avoid `FOUNDRY_`-prefixed names** — the platform reserves them and may overwrite them at runtime. `FOUNDRY_TOOLBOX_ENDPOINT` in older samples is deprecated.

### 2. Start from the sample

Don't hand-write the MCP client wiring. Start from the [**MAF Default Sample**](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/agent-framework/responses/04-foundry-toolbox) and adapt its `main.py` + `requirements.txt` — refer to the repo for the latest code sample and dependencies.

### 3. Run and invoke

Run the agent locally with `azd ai agent run`, then invoke it (`azd ai agent invoke --local "..."`). See the sample's README for the exact commands.

**Verify the deployed wire end-to-end** — after `azd deploy`, confirm the toolbox exists and the deployed agent can enumerate its tools:

```bash
azd ai toolbox list --output json
azd ai toolbox show agent-tools --output json
azd deploy
azd ai agent invoke "list the tools you have access to"
```

## LangChain / LangGraph SDK

**Read the supplied error first.** When the request mentions an attached Toolbox MCP error, find it in the workspace (for example, `consent-error.json`) and open it with a file-reading tool before answering, even if the request does not name the file. Base the handler on the supplied payload, not the example below, and show the returned consent URL when present.

Set the toolbox name in the agent service's `TOOLBOX_NAME` environment variable and read it when constructing `AzureAIProjectToolbox` instead of hardcoding the name. Load and sanitize the schemas in the async graph factory before passing the tools to `create_agent`:

```python
import os
from langchain_azure_ai.tools import AzureAIProjectToolbox

async def load_tools():
    toolbox = AzureAIProjectToolbox(toolbox_name=os.environ["TOOLBOX_NAME"])
    tools = await toolbox.get_tools()
    for tool in tools:
        schema = tool.args_schema
        if isinstance(schema, dict) and schema.get("type") == "object":
            schema.setdefault("properties", {})
    return tools
```

Restore any missing required property definitions from the tool contract before binding.

For user OAuth, follow the user-identity sample. On discovery or invocation failure, check for `-32006` in the outer JSON-RPC `error.code` before decoding the JSON embedded in `error.message`. The embedded JSON contains `errors`, not the outer code. Extract the [nested `CONSENT_REQUIRED` URL](#handling-consent_required) from it and surface it to the affected user. Retry only after consent; preserve unrelated errors.

## Troubleshooting

| Error | Cause | Resolution |
|-------|-------|------------|
| `CONSENT_REQUIRED` (nested string code inside an outer `-32006` error) | OAuth MCP connection needs user consent | Parse the consent URL from the nested error `message`, open it in a browser, complete OAuth, retry |
| 401 on MCP calls | Expired token or wrong scope | Use scope `https://ai.azure.com/.default` (not `cognitiveservices`) and refresh token on every request |
| OAuth/ARA errors when calling MCP directly from agent | Direct MCP wiring without toolbox token passthrough | Wire the MCP server into a toolbox and call the toolbox endpoint instead — Foundry handles consent + refresh |
| Tool not found on `tools/call` | Missing `server_label___` prefix for MCP-sourced tools | Call as `{server_label}___{tool_name}` (three underscores) |
| 500 on `prompts/list` | Not supported by toolbox endpoint | Pass `load_prompts=False` if your MCP client library calls it automatically |
| 500 on `send_ping()` (MAF `MCPStreamableHTTPTool._ensure_connected`) | Toolbox MCP server doesn't implement `ping` | Disable the ping check or override with a no-op |
| 400 missing `api-version` | Query string dropped | Append `?api-version=v1` to every toolbox URL |
| Environment variable silently overwritten at runtime | Foundry reserves `FOUNDRY_`-prefixed env vars | Rename to a non-`FOUNDRY_` name (e.g. `TOOLBOX_ENDPOINT`) |

For toolbox-composition / provisioning errors (`Multiple tools without identifiers`, `tools/list` returns zero, `403` on toolbox/connection writes), see [mcp-protocol.md § Troubleshooting (create / provision)](../../toolbox/references/mcp-protocol.md#troubleshooting-create--provision).

---

## Bring Your Own (BYO) — raw MCP client

The MCP client wiring below is only needed when you **hand-write the MCP client** (generic frameworks, or the BYO samples). The consent error shape also applies to the LangChain / LangGraph SDK.

For the MCP protocol methods and tool-naming rules, see [mcp-protocol.md § MCP protocol](../../toolbox/references/mcp-protocol.md#mcp-protocol) and [§ Tool naming](../../toolbox/references/mcp-protocol.md#tool-naming).

### Authentication

- **Agent → Toolbox:** Azure AD bearer token, scope `https://ai.azure.com/.default` (NOT `cognitiveservices` — the endpoint rejects it with 401), refreshed on every request.
- **Toolbox → external services:** platform-managed via project connections (API keys, OAuth, managed identity).

### Handling `require_approval`

The toolbox proxy does **not** enforce `require_approval` — that's the client's responsibility. Pass `approval_mode="never_require"` to skip it, or wire your own approval handler.

### Handling `CONSENT_REQUIRED`

When a toolbox includes an OAuth-based MCP connection (e.g. GitHub OAuth), the **first** call from a new user surfaces a consent requirement — on `tools/list`, `initialize`, or `tools/call`, depending on when the server discovers the missing grant. It's wrapped in a JSON-RPC error with outer **code `-32006`**; the failing source's nested error carries string code `"CONSENT_REQUIRED"` and its `message` is the consent URL. This is a one-time flow per user per OAuth connection — don't silently swallow it.

Your code must:

1. On a `-32006` error, slice the embedded JSON off the human-readable prefix (**don't** parse the whole `message`):

   ```python
   msg = err["message"]
   payload = json.loads(msg[msg.index("{"):])   # slice off the prefix first
   ```

2. Read `"code":"CONSENT_REQUIRED"` in `payload["errors"][i]["error"]` and take the consent URL from that nested `message`.
3. Surface the URL to the user (stdout or the agent response).
4. After the user completes OAuth in a browser, retry — subsequent calls succeed without re-prompting.

Example error shape (note the prefix text before the JSON):

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32006,
    "message": "tools/list failed for 1 tool source(s), succeeded for 0 tool source(s) {\"errors\":[{\"name\":\"GitHub\",\"type\":\"mcp\",\"error\":{\"code\":\"CONSENT_REQUIRED\",\"message\":\"https://logic-apis-<region>.consent.azure-apim.net/login?data=...\"}}]}"
  }
}
```

### Azure AI Search Citation Pattern

When calling an `azure_ai_search` tool through the toolbox MCP endpoint, citation metadata is returned under `result.structuredContent.documents[]` — **not** in a separate `citations` array. Treat each document as one citation:

| Field | Meaning |
|-------|---------|
| `title` | Citation display text |
| `url` | Source link |
| `id` | Source identifier |
| `score` | Retrieval relevance score |

For the authoritative field list and the File Search / Web Search citation patterns (under `result.content[].resource._meta` and `..._meta.annotations[]` respectively), see the public [Toolbox docs](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox).

Verification checklist:

1. `tools/list` returns the tool name `azure_ai_search`.
2. `tools/call` succeeds with a `query` argument.
3. `result.structuredContent.documents` is present and non-empty.
4. At least one document has both `title` and `url`.

## References

- [Toolbox Docs](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox)
- [Configure tools in a toolbox](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox#configure-tools)
- [Supported Toolbox Scenarios (sample-side reference)](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/SUPPORTED_TOOLBOX_SCENARIOS.md)
