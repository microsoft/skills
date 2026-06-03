# Copilot Widget Protocol

Language-agnostic protocol requirements for MCP servers that render widgets in Microsoft 365 Copilot Chat. This document describes **what** your server must implement, regardless of programming language. For a complete TypeScript reference implementation, see [mcp-server-pattern.md](mcp-server-pattern.md).

## Table of Contents
- [Transport: Streamable HTTP](#transport-streamable-http)
- [CORS Configuration](#cors-configuration)
- [Server Capabilities](#server-capabilities)
- [MCP Resources for Widgets](#mcp-resources-for-widgets)
- [MCP Tool Response Format](#mcp-tool-response-format)
- [Widget Shell and Asset Serving](#widget-shell-and-asset-serving)
- [Widget-Resource-Tool Triplet](#widget-resource-tool-triplet)
- [Environment Configuration](#environment-configuration)
- [Adaptation Checklist: Existing MCP Server](#adaptation-checklist-existing-mcp-server)
- [Language SDK References](#language-sdk-references)

## Transport: Streamable HTTP

Your server must expose a single `/mcp` endpoint that handles three HTTP methods:

| Method | Purpose | Key Headers |
|--------|---------|-------------|
| `POST /mcp` | Send JSON-RPC messages (initialize, tool calls, resource reads) | `Content-Type: application/json`, `mcp-session-id` (after init) |
| `GET /mcp` | Open SSE stream for server-to-client notifications | `mcp-session-id` (required) |
| `DELETE /mcp` | Terminate a session | `mcp-session-id` (required) |

**Session lifecycle:**
1. Client sends `POST /mcp` with an `initialize` request (no `mcp-session-id` header)
2. Server generates a session ID and returns it in the `mcp-session-id` response header
3. All subsequent requests include the `mcp-session-id` header

**Initialize request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-03-26",
    "capabilities": {},
    "clientInfo": { "name": "copilot", "version": "1.0.0" }
  }
}
```

**Initialize response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": { "resources": {}, "tools": {} },
    "serverInfo": { "name": "my-server", "version": "1.0.0" }
  }
}
```

## CORS Configuration

The `/mcp` endpoint must handle CORS for cross-origin requests from Copilot. Use **origin-checking** rather than a blanket wildcard — validate the request's `Origin` header against an allowlist and reflect the origin back if it matches.

**Required allowed origins** (at minimum):
- `m365.cloud.microsoft` — the base Copilot Chat domain
- `*.m365.cloud.microsoft` — any subdomain (e.g., `copilot.m365.cloud.microsoft`)

**Preflight (OPTIONS /mcp):**
```
Access-Control-Allow-Origin: <reflected-origin>
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, mcp-session-id, Last-Event-ID, mcp-protocol-version
Access-Control-Expose-Headers: mcp-session-id, mcp-protocol-version
```

**All /mcp responses:**
```
Access-Control-Allow-Origin: <reflected-origin>
Access-Control-Expose-Headers: mcp-session-id, mcp-protocol-version
```

Where `<reflected-origin>` is the value of the request's `Origin` header, set only when it matches the allowlist. If the origin does not match, omit the `Access-Control-Allow-Origin` header entirely.

**Origin-checking pseudocode:**
```
function isAllowedOrigin(origin):
    hostname = parseURL(origin).hostname
    return hostname == "m365.cloud.microsoft"
        OR hostname ends with ".m365.cloud.microsoft"
```

> **Note**: Do not use a blanket `Access-Control-Allow-Origin: *`. Origin-checking prevents your MCP server from being called by arbitrary web pages.

## Server Capabilities

The `initialize` response **must** declare both `resources` and `tools` capabilities:

```json
{
  "capabilities": {
    "resources": {},
    "tools": {}
  }
}
```

Without `resources: {}`, Copilot will not call `resources/list` or `resources/read`, and widgets will not render.

## MCP Resources for Widgets

Each widget requires an MCP resource registration. Resources tell Copilot how to fetch the widget shell via the MCP protocol.

**`resources/list` response:**
```json
{
  "resources": [
    {
      "name": "My Widget",
      "uri": "ui://widget/my-widget.html",
      "description": "Widget for displaying data",
      "mimeType": "text/html+skybridge",
      "_meta": {
        "openai/widgetDomain": "https://your-server.example.com",
        "openai/widgetCSP": {
          "connect_domains": ["https://your-server.example.com"],
          "resource_domains": ["https://your-server.example.com"]
        }
      }
    }
  ]
}
```

**`resources/read` response** (when Copilot requests `uri: "ui://widget/my-widget.html"`):
```json
{
  "contents": [
    {
      "uri": "ui://widget/my-widget.html",
      "mimeType": "text/html+skybridge",
      "text": "<!DOCTYPE html><html>...widget shell HTML...</html>",
      "_meta": {
        "openai/widgetDomain": "https://your-server.example.com",
        "openai/widgetCSP": {
          "connect_domains": ["https://your-server.example.com"],
          "resource_domains": ["https://your-server.example.com"]
        }
      }
    }
  ]
}
```

Key fields:
- **`uri`**: Must use the `ui://widget/<name>.html` scheme
- **`mimeType`**: Must be `"text/html+skybridge"` — this signals Copilot to render as a widget
- **`_meta.openai/widgetDomain`**: The server URL for CSP allowlisting
- **`_meta.openai/widgetCSP`**: Content Security Policy domains the widget may contact

## MCP Tool Response Format

Tool responses must include three parts: a text summary, structured data for the widget, and metadata linking to the widget template.

```json
{
  "content": [
    { "type": "text", "text": "Human-readable summary (fallback and accessibility)" }
  ],
  "structuredContent": {
    "title": "Widget Title",
    "items": [{ "name": "Item 1", "value": "Value 1" }]
  },
  "_meta": {
    "openai/outputTemplate": "ui://widget/my-widget.html",
    "openai/widgetAccessible": true,
    "openai/toolInvocation/invoking": "Processing...",
    "openai/toolInvocation/invoked": "Complete"
  }
}
```

| Field | Purpose |
|-------|---------|
| `content` | Text fallback — displayed if widget can't render |
| `structuredContent` | JSON data passed to the widget as `window.openai.toolOutput` |
| `_meta.openai/outputTemplate` | URI linking this tool to its widget (must match a registered resource URI) |
| `_meta.openai/widgetAccessible` | Set `true` to enable widget rendering |
| `_meta.openai/toolInvocation/invoking` | Status text shown while tool executes |
| `_meta.openai/toolInvocation/invoked` | Status text shown when tool completes |

## Widget Shell and Asset Serving

Your server must serve widget shell HTML files over HTTP at a `/widgets/` route:

```
GET /widgets/my-widget.html → 200 OK (Content-Type: text/html, Access-Control-Allow-Origin: <reflected-origin>)
```

Requirements:
- Serve shell files from a `widgets/` directory (or equivalent)
- Serve built JS/CSS bundles from an `/assets/` route
- Apply the same origin-checking CORS as the `/mcp` endpoint (see [CORS Configuration](#cors-configuration))
- Guard against path traversal for both widgets and assets directories

Widgets should be built with React + Fluent UI and loaded by the shell. See [widget-patterns.md](widget-patterns.md) for templates and patterns. Key points:
- Wrap app UI with `FluentProvider` (`webLightTheme`/`webDarkTheme`)
- Build UI with `@fluentui/react-components` and `@fluentui/react-icons`
- Read data from `window.openai` through shared hooks (for example, `useOpenAiGlobal("toolOutput")`)
- Include debug fallback data for local testing

## Widget-Resource-Tool Triplet

Every widget requires three coordinated parts. If any part is missing, the widget will not work correctly.

| Part | What it does | Key identifiers |
|------|-------------|-----------------|
| **Widget shell + assets** | Shell returned by resource loads built React bundle | `GET /widgets/<name>.html`, `GET /assets/<name>.js` |
| **MCP Resource** | Serves shell HTML to Copilot via MCP protocol | `uri: "ui://widget/<name>.html"`, `mimeType: "text/html+skybridge"` |
| **MCP Tool** | Triggers widget rendering, returns data | `_meta.openai/outputTemplate: "ui://widget/<name>.html"` |

**When a part is missing:**
- **No Resource** → Copilot can't fetch the shell, widget won't render
- **No Tool** → Widget exists but nothing triggers it
- **No shell/assets** → Resource loads empty/404 or missing scripts, tool invocation shows empty widget

Always create all three parts together for each new widget. See [best-practices.md](best-practices.md#20-widget-resource-tool-triplet) for additional detail.

## Environment Configuration

Three environment variables connect your server to devtunnels and CSP configuration:

| Variable | Example | Purpose |
|----------|---------|---------|
| `MCP_SERVER_URL` | `https://xxxxx-3001.usw2.devtunnels.ms` | Full server URL — used in resource `_meta` for CSP |
| `MCP_SERVER_DOMAIN` | `xxxxx-3001.usw2.devtunnels.ms` | Domain only — used in CSP `connect_domains` and `resource_domains` |
| `DEVTUNNEL_PORT` | `3001` | Local port the server listens on |

These are auto-populated by the devtunnel setup script. See [devtunnels.md](devtunnels.md) for the automated setup.

The resource `_meta` CSP fields must reference these values so that Copilot's Content Security Policy allows the widget to contact your server:

```json
{
  "openai/widgetDomain": "${MCP_SERVER_URL}",
  "openai/widgetCSP": {
    "connect_domains": ["${MCP_SERVER_URL}", "https://${MCP_SERVER_DOMAIN}"],
    "resource_domains": ["${MCP_SERVER_URL}", "https://${MCP_SERVER_DOMAIN}"]
  }
}
```

## Adaptation Checklist: Existing MCP Server

If you have an existing MCP server and want to add Copilot widget support, complete this checklist:

- [ ] Add `resources: {}` capability to your server's `initialize` response (see [Server Capabilities](#server-capabilities))
- [ ] Create widget shell HTML files in `widgets/` and build React + Fluent UI bundles into `assets/` (see [widget-patterns.md](widget-patterns.md))
- [ ] Register MCP resources with `ui://widget/<name>.html` URIs and `text/html+skybridge` mime type (see [MCP Resources for Widgets](#mcp-resources-for-widgets))
- [ ] Add `_meta` to resources with CSP configuration (`openai/widgetDomain`, `openai/widgetCSP`)
- [ ] Implement `resources/read` handler that returns shell HTML for each registered URI
- [ ] Update tool responses to return `structuredContent` + `_meta` with `openai/outputTemplate` (see [MCP Tool Response Format](#mcp-tool-response-format))
- [ ] Add `/widgets/*.html` and `/assets/*` HTTP serving routes with origin-checking CORS (see [CORS Configuration](#cors-configuration))
- [ ] Configure CORS on `/mcp` endpoint (see [CORS Configuration](#cors-configuration))
- [ ] Create `mcpPlugin.json` manifest (see [plugin-schema.md](plugin-schema.md))
- [ ] Set up devtunnel for local testing (see [devtunnels.md](devtunnels.md))

## Language SDK References

| Language | SDK Package | Transport Support | Notes |
|----------|-------------|-------------------|-------|
| TypeScript / Node.js | `@modelcontextprotocol/sdk` | `StreamableHTTPServerTransport` | Most mature; see [mcp-server-pattern.md](mcp-server-pattern.md) for complete reference |
| Python | `mcp` (PyPI) | Built-in Streamable HTTP | Use FastMCP or low-level server |
| C# / .NET | `ModelContextProtocol` (NuGet) | ASP.NET integration | Community SDK with Streamable HTTP support |

The TypeScript implementation in [mcp-server-pattern.md](mcp-server-pattern.md) demonstrates every protocol requirement listed in this document. Use it as a reference when implementing in other languages.
