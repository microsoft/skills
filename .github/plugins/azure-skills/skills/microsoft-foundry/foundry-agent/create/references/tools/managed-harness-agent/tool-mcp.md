# MCP

Connect a Managed Harness Agent directly to a remote MCP server.

Public server:

```yaml
tools:
  - type: mcp
    server_label: learn
    server_url: https://learn.microsoft.com/api/mcp
    require_approval: always
```

Authenticated server:

```yaml
tools:
  - type: mcp
    server_label: internal
    server_url: https://tools.example.com/mcp
    project_connection_id: <connection-name-or-id>
    require_approval: always
    allowed_tools:
      - search
```

`server_label` and `server_url` are required. Keep `require_approval: always` unless the user explicitly trusts the server. Use `allowed_tools` to restrict exposure.

Use a connection supplied by the user or already referenced by the Agent. Create one only when explicitly requested. Select the matching azd connection flow:

- [No authentication](../../../../toolbox/references/tool-mcp-noauth.md)
- [Static key](../../../../toolbox/references/tool-mcp-key-auth.md)
- [Custom OAuth](../../../../toolbox/references/tool-mcp-custom-oauth.md)
- [Agent or project identity](../../../../toolbox/references/tool-mcp-agent-identity.md)
- [User Entra token](../../../../toolbox/references/tool-mcp-user-entra-token.md)

Follow only the connection-creation and validation sections; do not create a Toolbox unless explicitly requested.

Agent Service requires a remotely reachable MCP endpoint. Do not place literal credentials in `headers` or `azure.yaml`.

A generic MCP URL remains a generic MCP workflow. Do not infer that it is a Foundry Toolbox or automatically create a Toolbox connection merely because its URL contains `/toolboxes/`. When the user explicitly requests a Foundry Toolbox, follow [Toolbox](tool-toolbox.md).
