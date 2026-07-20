# Tools and Toolboxes (azd ai)

How to attach tools (web search, Azure AI Search, MCP, A2A) to a hosted agent using `azd ai toolbox` and `azd ai connection`.

A **toolbox** is a curated bundle of connection-backed tools that Foundry exposes as a single MCP-compatible endpoint. The agent connects to one URL and discovers every tool inside.

> 🚦 **Toolbox creation gate:** before creating a toolbox/connection, you MUST read the boundary rules in [create-hosted.md → Toolbox creation boundary](../create-hosted.md#toolbox-creation-boundary) and follow them, then continue with the rest of this file.

## Install the extension once

```bash
azd extension install azure.ai.toolboxes
```

## The flow (every recipe)

1. Create the **connection** (`azd ai connection create ...`).
2. Create the **toolbox** (`azd ai toolbox create`) or add tools to an existing one (`azd ai toolbox connection add`).
3. If you added to an existing toolbox, **promote the new version** (`azd ai toolbox publish <name> <version>`) — `create` publishes its first version automatically, but later mutations do not.
4. Read the endpoint (`azd ai toolbox show <name> --output json`).
5. `azd env set TOOLBOX_<NAME>_MCP_ENDPOINT "<endpoint>"`.
6. Reference it in the agent service's `environmentVariables` in `azure.yaml`.
7. `azd deploy`.

## Env var naming convention

Uppercase the toolbox name, collapse non-alphanumeric to `_`, prefix `TOOLBOX_`, suffix `_MCP_ENDPOINT`. Examples: `agent-tools` -> `TOOLBOX_AGENT_TOOLS_MCP_ENDPOINT`, `agent.tools.v2` -> `TOOLBOX_AGENT_TOOLS_V2_MCP_ENDPOINT`.

## Endpoint URL shapes

- `{project}/toolboxes/{name}/versions/{version}/mcp?api-version=v1` -- version-pinned. What `azd ai toolbox show` returns.
- `{project}/toolboxes/{name}/mcp?api-version=v1` -- default version (consumer). Always serves `default_version`.

To auto-pick up new default versions without redeploying, drop the `/versions/<ver>` segment and store the consumer URL.

## CLI surface

| Command | What it does |
|---------|--------------|
| `azd ai toolbox create <name> --from-file <path>` | Create toolbox + its first version. File must list at least one connection, skill, or tool. |
| `azd ai toolbox connection add <toolbox> <connection> [--index ...] [--instance-name ...]` | Attach one; creates a new version (default unchanged). |
| `azd ai toolbox connection add <toolbox> --from-file <path>` | Attach many in one call; ONE new version (default unchanged). |
| `azd ai toolbox connection remove <toolbox> <connection>` | Detach; creates a new version (default unchanged). Refuses to leave zero tools. |
| `azd ai toolbox show <name> [--version <ver>]` | Show toolbox + MCP endpoint URL. |
| `azd ai toolbox list` | List toolboxes. |
| `azd ai toolbox versions list <toolbox>` | List versions. |
| `azd ai toolbox publish <name> <version>` | Promote a version to default (also used to roll back). |
| `azd ai toolbox delete <name> [--version <ver>] [--force]` | Delete toolbox or one version. |

Every mutation publishes a new immutable version but does **not** change the default; run `azd ai toolbox publish <name> <version>` to promote one.

## `--from-file` shape

```yaml
description: research toolbox    # only on `create`
connections:
  - name: my-mcp                 # RemoteTool
  - name: my-search              # CognitiveSearch -- needs index
    index: products
  - name: my-bing                # GroundingWithCustomSearch -- needs instance_name
    instance_name: docs-config
  - name: my-a2a                 # RemoteA2A
```

## Recipe: GitHub MCP

```bash
# 1. Connection
azd ai connection create github-mcp-conn \
  --kind remote-tool \
  --target https://api.githubcopilot.com/mcp \
  --auth-type custom-keys \
  --custom-key Authorization="Bearer ghp_xxx..."

# 2. Toolbox (initial create needs a file; otherwise use `connection add`)
cat > tools.json <<EOF
{ "description": "GitHub MCP", "connections": [{ "name": "github-mcp-conn" }] }
EOF
azd ai toolbox create agent-tools --from-file tools.json

# 3. Wire the env var
ENDPOINT=$(azd ai toolbox show agent-tools --output json | jq -r .endpoint)
azd env set TOOLBOX_AGENT_TOOLS_MCP_ENDPOINT "$ENDPOINT"
```

Add the env var to the agent service's `environmentVariables` in `azure.yaml`:

```yaml
environmentVariables:
  - name: TOOLBOX_AGENT_TOOLS_MCP_ENDPOINT
    value: ${TOOLBOX_AGENT_TOOLS_MCP_ENDPOINT}
```

Then `azd deploy`.

## Recipe: Azure AI Search RAG

```bash
azd ai connection create my-search-conn \
  --kind cognitive-search \
  --target https://my-search.search.windows.net/ \
  --auth-type api-key --key "<search-admin-key>"

azd ai toolbox connection add agent-tools my-search-conn --index contoso-outdoors
```

For multiple indexes, add multiple entries with different `index` values.

## Recipe: A2A peer agent

Call any A2A-compatible agent (Foundry or external) as a tool. The target must already expose an A2A endpoint before you can wire a connection to it.

**Step 1 (Foundry peers only) — Enable incoming A2A on the target agent.** If the peer already returns 200 on `/endpoint/protocols/a2a/agentCard/v1.0`, skip. Otherwise follow [enable-incoming-a2a.md](enable-incoming-a2a.md). For external A2A services, assume the peer owner has already done this — no action here.

**Step 2 — Create the `remote-a2a` connection.** See [tool-a2a.md](tool-a2a.md) for the full connection command, including the Foundry-specific values (auth type, audience, agent-card path, RBAC) and non-Foundry variants.

**Step 3 — Attach to the toolbox.**

```bash
azd ai toolbox connection add agent-tools peer-agent-conn
azd ai toolbox publish agent-tools <new-version>
```

## Recipe: multi-tool toolbox in one call

```yaml
# tools.yaml
description: "GitHub MCP + AI Search + A2A peer."
connections:
  - name: github-mcp-conn
  - name: my-search-conn
    index: contoso-outdoors
  - name: peer-agent-conn
```

```bash
azd ai toolbox create agent-tools --from-file tools.yaml
# OR (existing toolbox): azd ai toolbox connection add agent-tools --from-file tools.yaml
#   then promote it: azd ai toolbox publish agent-tools <version>
```

One new version regardless of how many connections you attach in one call. `create` publishes it as the first (default) version; `connection add` leaves the default unchanged until you `publish`.

## Tools the CLI does NOT manage today

`azd ai toolbox` only handles connection-backed tools (`RemoteTool`, `CognitiveSearch`, `RemoteA2A`, `GroundingWithCustomSearch`). These built-ins have no connection and are NOT addable via this CLI: `web_search`, `code_interpreter`, `file_search`, `function`, `toolbox_search_preview`.

To include any built-in in a toolbox today, use the Python / .NET / JS SDK or call the REST API directly.

## Token and RBAC (agent code)

Token scope: `https://ai.azure.com/.default`. RBAC: the calling identity (developer + agent identity at runtime) needs **Foundry User** on the Foundry project.

## Agent code (Python, Microsoft Agent Framework)

```python
import os, httpx
from azure.identity import DefaultAzureCredential
from agent_framework.tools.mcp import MCPStreamableHTTPTool

_credential = DefaultAzureCredential()

def _inject_auth(request: httpx.Request) -> None:
    # Per-request token refresh -- static tokens expire in ~1 hour.
    token = _credential.get_token("https://ai.azure.com/.default").token
    request.headers["Authorization"] = f"Bearer {token}"

tool = MCPStreamableHTTPTool(
    name="github",                    # becomes server_label prefix
    url=os.environ["TOOLBOX_AGENT_TOOLS_MCP_ENDPOINT"],
    httpx_client=httpx.AsyncClient(event_hooks={"request": [_inject_auth]}),
    load_prompts=False,               # Foundry doesn't implement prompts/list
    approval_mode="never_require",    # for require_approval:always tools
)
```

Install: `pip install httpx azure-identity agent-framework`.

## MCP client gotchas

- **Always stream.** Non-streaming is not supported.
- **Don't call `prompts/list`.** Returns `500`. Pass `load_prompts=False`.
- **Don't `send_ping()`** with generic clients (returns `500`). Agent Framework handles this.
- **Tool names are prefixed with `server_label`.** `name="myserver"` -> tools appear as `myserver___<tool>` (joined by three underscores).
- **`require_approval`** is the client's responsibility -- the toolbox proxy does NOT enforce it. Pass `approval_mode="never_require"` or wire an approval handler.

## Verify the wire end-to-end

```bash
azd ai toolbox list --output json
azd ai toolbox show agent-tools --output json
azd deploy
azd ai agent invoke "list the tools you have access to"
```

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `TOOLBOX_<NAME>_MCP_ENDPOINT` not set | Run `azd ai toolbox show` + `azd env set`. |
| Env var missing in deployed agent | Add to the agent service's `environmentVariables` in `azure.yaml`, `azd deploy`. |
| `401` on MCP calls | Expired / wrong-scope token. Use `https://ai.azure.com/.default`; refresh per request. |
| `403 Forbidden` | Caller missing `Foundry User` role. |
| `500` on `prompts/list` / ping | Disable in MCP client (`load_prompts=False`). |
| Empty response, tool never called | `require_approval: always` with no handler. Pass `approval_mode="never_require"`. |
| `tools/list` returns zero | Bad credentials, or toolbox version still provisioning. |
| Tool names don't match | Use `{server_label}___{tool_name}` (three underscores). |
