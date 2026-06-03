# MCP Plugin Schema

mcpPlugin.json configuration for M365 Copilot declarative agents.

> **Naming note:** The property key for tool definitions in the runtime spec is `mcp_tool_description`. Older documentation may reference `x-mcp_tool_description` with the `x-` prefix — this older form is no longer supported and can cause MCP agent provisioning failures. Always use `mcp_tool_description` (without `x-`) in new configurations.

## ⚠️ CRITICAL: Use MCP Inspector ⚠️

**NEVER manually write tool definitions.** Always use MCP Inspector to get the complete tool definitions from your running MCP server:

```bash
npx @modelcontextprotocol/inspector@0.20.0
```

Copy the COMPLETE tool definition from the inspector (including `name`, `description`, `inputSchema`, `_meta`, `annotations`, `title`) and paste into `mcpPlugin.json`.

## Complete Example

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/copilot/plugin/v2.4/schema.json",
  "schema_version": "v2.4",
  "name_for_human": "My Plugin",
  "description_for_human": "Short description for users",
  "description_for_model": "Detailed description for Copilot. Explain when and how to use each tool. Be specific about what data to pass.",
  "contact_email": "support@example.com",
  "namespace": "myplugin",
  "legal_info_url": "https://example.com/legal",
  "privacy_policy_url": "https://example.com/privacy",
  "capabilities": {
    "conversation_starters": [
      {
        "title": "Starter title",
        "text": "What Copilot says when clicked"
      }
    ]
  },
  "runtimes": [
    {
      "type": "RemoteMCPServer",
      "auth": {
        "type": "None"
      },
      "run_for_functions": [
        "tool_name_1",
        "tool_name_2"
      ],
      "spec": {
        "url": "${{MCP_SERVER_URL}}/mcp",
        "mcp_tool_description": {
          "tools": [
            {
              "name": "tool_name_1",
              "title": "Human-Readable Title",
              "description": "Detailed description of what the tool does and when to use it.",
              "inputSchema": {
                "type": "object",
                "properties": {
                  "param1": {
                    "type": "string",
                    "description": "Description with examples"
                  },
                  "param2": {
                    "type": "array",
                    "description": "Array description",
                    "items": {
                      "type": "object",
                      "properties": {
                        "field1": { "type": "string" },
                        "field2": { "type": "string" }
                      },
                      "required": ["field1"]
                    }
                  }
                },
                "required": ["param1", "param2"],
                "additionalProperties": false
              },
              "_meta": {
                "openai/outputTemplate": "ui://widget/my-widget.html",
                "openai/widgetAccessible": true,
                "openai/toolInvocation/invoking": "Processing...",
                "openai/toolInvocation/invoked": "Done"
              },
              "annotations": {
                "destructiveHint": false,
                "openWorldHint": false,
                "readOnlyHint": true
              }
            }
          ]
        }
      }
    }
  ],
  "functions": [
    {
      "name": "tool_name_1",
      "description": "Same description as in tools array"
    }
  ]
}
```

**Note:** The tool definition above should be copied from MCP Inspector, not manually written.

## Required Fields

| Field | Description |
|-------|-------------|
| `$schema` | Must be `v2.4` schema URL |
| `schema_version` | Must be `"v2.4"` |
| `name_for_human` | Display name |
| `description_for_human` | Short user-facing description |
| `description_for_model` | Detailed description for Copilot |
| `runtimes` | Array with RemoteMCPServer config |
| `functions` | Array of function name/description pairs |

## Runtime Configuration

```json
{
  "type": "RemoteMCPServer",
  "auth": { "type": "None" },
  "run_for_functions": ["tool1", "tool2"],
  "spec": {
    "url": "${{MCP_SERVER_URL}}/mcp",
    "mcp_tool_description": { "tools": [...] }
  }
}
```

### Auth Types

- `"None"` - No authentication
- `"OAuthPluginVault"` - OAuth via plugin vault

## Tool Definition

```json
{
  "name": "tool_name",
  "title": "Display Title",
  "description": "When and how to use this tool",
  "inputSchema": { /* JSON Schema */ },
  "_meta": {
    "openai/outputTemplate": "ui://widget/name.html",
    "openai/widgetAccessible": true,
    "openai/toolInvocation/invoking": "Loading...",
    "openai/toolInvocation/invoked": "Loaded"
  },
  "annotations": {
    "destructiveHint": false,
    "openWorldHint": false,
    "readOnlyHint": true
  }
}
```

## _meta Fields

| Field | Description |
|-------|-------------|
| `openai/outputTemplate` | Widget URI (`ui://widget/name.html`) |
| `openai/widgetAccessible` | Enable widget rendering (`true`) |
| `openai/toolInvocation/invoking` | Message while executing |
| `openai/toolInvocation/invoked` | Message when complete |

## Annotations

| Field | Description |
|-------|-------------|
| `destructiveHint` | Tool modifies data (`false` for rendering tools) |
| `openWorldHint` | Tool accesses external systems |
| `readOnlyHint` | Tool only reads/renders data (`true` for rendering tools) |

## Input Schema Patterns

### Object with required fields

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string", "description": "Full name (e.g., 'John Doe')" },
    "email": { "type": "string", "description": "Email address" }
  },
  "required": ["name", "email"],
  "additionalProperties": false
}
```

### Nested object

```json
{
  "type": "object",
  "properties": {
    "person": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "title": { "type": "string" }
      },
      "required": ["name"]
    }
  },
  "required": ["person"]
}
```

### Array of objects

```json
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "value": { "type": "string" }
    },
    "required": ["id", "value"]
  }
}
```

## Environment Variables

Use `${{VAR_NAME}}` syntax for environment variables:

- `${{MCP_SERVER_URL}}` - Full server URL (e.g., `https://tunnel.devtunnels.ms`)
- `${{MCP_SERVER_DOMAIN}}` - Domain only for validDomains

Define in `env/.env.local`:

```
MCP_SERVER_URL=https://your-tunnel.devtunnels.ms
MCP_SERVER_DOMAIN=your-tunnel.devtunnels.ms
```

## Common Errors

| Error | Fix |
|-------|-----|
| `name_for_model` unrecognized | Remove it (not in v2.4) |
| `MCP` runtime type invalid | Use `RemoteMCPServer` |
| `transport` unrecognized | Remove it |
| `run_for_functions` required | Add array of tool names |
| Missing `auth` | Add `{ "type": "None" }` |
