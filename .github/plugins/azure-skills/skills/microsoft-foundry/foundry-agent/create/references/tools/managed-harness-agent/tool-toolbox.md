# Toolbox

Attach an existing Foundry Toolbox to a Managed Harness Agent through an authenticated direct MCP tool. Manage the Toolbox and connection separately; the Agent consumes their published values.

## Resolve the exact Toolbox version

Create or update the Toolbox only when explicitly requested, following [Foundry Toolbox](../../../../toolbox/toolbox.md). Resolve the intended version's exact MCP endpoint:

```bash
azd ai toolbox show <toolbox-name> \
  --version <version> \
  --project-endpoint "<project-endpoint>" \
  --output json
```

Use the returned endpoint, including `/versions/<version>/mcp?api-version=v1`. Do not substitute a default or unversioned endpoint.

## Create or reuse the authentication connection

The Toolbox endpoint requires a matching project connection:

- category/kind: `RemoteTool` / `remote-tool`
- auth type: `UserEntraToken` / `user-entra-token`
- audience: `https://ai.azure.com`
- target: exactly the versioned MCP endpoint
- metadata: `type=toolbox_MCP`, Toolbox name, and Toolbox version

The released CLI supports this shape:

```bash
azd ai connection create <connection-name> \
  --kind remote-tool \
  --target "<versioned-toolbox-mcp-endpoint>" \
  --auth-type user-entra-token \
  --audience https://ai.azure.com \
  --metadata type=toolbox_MCP \
  --metadata toolboxName=<toolbox-name> \
  --metadata toolboxVersion=<version> \
  --project-endpoint "<project-endpoint>"
```

Reuse an existing connection only when all fields match. Do not overwrite or repoint a connection used by another Toolbox version; create a distinct connection instead.

## Attach the Toolbox

Use the connection's short name as `project_connection_id`:

```yaml
tools:
  - type: mcp
    server_label: <toolbox-name>
    server_url: <versioned-toolbox-mcp-endpoint>
    project_connection_id: <connection-name>
    require_approval: always
```

The connection target and `server_url` must match exactly. Keep `require_approval: always` unless the user explicitly chooses a different policy. Do not fall back to a connectionless Toolbox MCP entry.

This is separate from generic MCP authoring.
