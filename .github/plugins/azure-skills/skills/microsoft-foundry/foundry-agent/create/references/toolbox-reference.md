# Toolbox Reference

Endpoint format, MCP protocol details, authentication, OAuth consent handling, endpoint testing, and troubleshooting for Foundry Toolboxes.

## Endpoint Format

The toolbox MCP endpoint is constructed from the **project endpoint** + **toolbox name**:

| Endpoint | URL |
|----------|-----|
| Latest version (default) | `{project_endpoint}/toolboxes/{toolbox_name}/mcp?api-version=v1` |
| Specific version | `{project_endpoint}/toolboxes/{toolbox_name}/versions/{version}/mcp?api-version=v1` |

- **Project endpoint** format: `https://<account>.services.ai.azure.com/api/projects/<project>`
- The latest-version endpoint always serves the toolbox's `default_version`.
- Use the specific-version endpoint to test a version before promoting it.
- **Required header** on every request: `Foundry-Features: Toolboxes=V1Preview`
- `?api-version=v1` query parameter is **required** — requests without it return HTTP 400.

## MCP Protocol

Toolboxes use **Model Context Protocol (MCP)** — JSON-RPC 2.0 over HTTP POST:

- **`initialize`** — Handshake to establish an MCP session. Returns a `mcp-session-id` header to include in subsequent requests.
- **`tools/list`** — Returns all available tools with names, descriptions, and input schemas.
- **`tools/call`** — Invokes a tool with arguments and returns structured results.

> `prompts/list` is **not supported** by the toolbox endpoint. Always pass `load_prompts=False` to MCP client constructors.

## Authentication

- **Agent → Toolbox:** Azure AD bearer token with scope `https://ai.azure.com/.default`, refreshed on every request.
- **Toolbox → External Services:** Managed by the platform via project connections (API keys, OAuth, managed identity).

## OAuth Consent Handling

When a toolbox includes an OAuth-based MCP connection (e.g., GitHub OAuth), the first call triggers a `CONSENT_REQUIRED` error (MCP error code `-32006`). The error message contains the consent URL.

**Agent code must handle this:**
1. Catch MCP error code `-32006` from `tools/call` or during MCP session initialization.
2. Extract the consent URL from the error message.
3. Log the URL and surface it to the user (e.g., print to stdout or return in the agent response).
4. After the user completes the OAuth flow in a browser, retry the call — subsequent calls succeed without re-prompting.

> This is a one-time flow per user per OAuth connection in a project. The agent should not silently swallow this error.

## Testing the Toolbox Endpoint

Before running the full agent, verify the toolbox MCP endpoint works end-to-end. Use `az login` for authentication, then test the three MCP operations in order:

**1. Get a bearer token:**
```bash
TOKEN=$(az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv)
TOOLBOX_URL="https://<account>.services.ai.azure.com/api/projects/<project>/toolboxes/<name>/mcp?api-version=v1"
```

**2. Initialize MCP session:**
```bash
curl -sS -X POST "$TOOLBOX_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Foundry-Features: Toolboxes=V1Preview" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"debug","version":"1.0.0"}}}' \
  -D - | head -20
```
Save the `mcp-session-id` header from the response for subsequent calls.

**3. List tools:**
```bash
curl -sS -X POST "$TOOLBOX_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Foundry-Features: Toolboxes=V1Preview" \
  -H "mcp-session-id: <session-id-from-step-2>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | jq .
```

**Checklist:**
- Response contains `result.tools[]` with `len > 0`
- Each tool has `name`, `description`, and `inputSchema` with a `properties` field
- MCP tool names for remote servers are prefixed with `server_label` (e.g., `myserver.get_info`)

**4. Call a tool (optional):**
```bash
curl -sS -X POST "$TOOLBOX_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Foundry-Features: Toolboxes=V1Preview" \
  -H "mcp-session-id: <session-id-from-step-2>" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"<tool_name>","arguments":{"query":"test"}}}' | jq .
```

> For a Python-based debug client, see the `_McpToolboxClient` class in the [BYO toolbox sample `main.py`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/bring-your-own/responses/bring-your-own-toolbox/main.py) — it implements `initialize`, `list_tools`, and `call_tool` using raw `httpx` calls.

## Troubleshooting

| Error | Cause | Resolution |
|-------|-------|------------|
| CONSENT_REQUIRED (code -32006) | OAuth MCP connection needs user consent | Open consent URL in browser, complete OAuth flow, retry |
| 401 on MCP calls | Expired token or wrong scope | Use scope `https://ai.azure.com/.default` and refresh token |
| 500 on `prompts/list` | Not supported by toolbox endpoint | Pass `load_prompts=False` to MCP client constructor |
| 500 with non-streaming `tools/call` | Non-streaming not supported | Always use `stream=True` for toolbox MCP tools |
