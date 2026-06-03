# MCP Server Pattern (TypeScript)

> **This is the TypeScript reference implementation.** It demonstrates all Copilot widget protocol
> requirements using Node.js and `@modelcontextprotocol/sdk`. For a language-agnostic description
> of what your MCP server must implement, see [copilot-widget-protocol.md](copilot-widget-protocol.md).

## Table of Contents
- [Dependencies](#dependencies)
- [Server Implementation](#server-implementation)
- [tsconfig.json](#tsconfigjson)
- [package.json scripts](#packagejson-scripts)
- [Static Asset Serving (Local Development)](#static-asset-serving-local-development)
  - [Configurable Widget Base URL](#configurable-widget-base-url)
- [Next Steps](#next-steps)

Complete implementation pattern for MCP servers with Copilot Chat widget support.

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/node": "^22.x",
    "tsx": "^4.x",
    "typescript": "^5.x"
  }
}
```

## Server Implementation

```typescript
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";
import { config } from "dotenv";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type Tool,
  type Resource,
} from "@modelcontextprotocol/sdk/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIDGETS_DIR = path.resolve(__dirname, "..", "widgets");

// Load environment from .env.local (auto-populated by devtunnel script)
config({ path: path.resolve(__dirname, "../../env/.env.local") });

// Widget URIs use ui:// protocol
const WIDGET_URI = "ui://widget/my-widget.html";
const MIME_TYPE = "text/html+skybridge";

// Read from environment (populated by devtunnel script)
const port = Number(process.env.DEVTUNNEL_PORT ?? process.env.PORT ?? 3001);
const serverUrl = process.env.MCP_SERVER_URL ?? `http://localhost:${port}`;
const serverDomain = process.env.MCP_SERVER_DOMAIN ?? "localhost";

console.log(`MCP Server URL: ${serverUrl}`);
console.log(`MCP Server Domain: ${serverDomain}`);

// Tool metadata for OpenAI Apps SDK
function toolMeta(templateUri: string) {
  return {
    "openai/outputTemplate": templateUri,
    "openai/widgetAccessible": true,
    "openai/toolInvocation/invoking": "Processing...",
    "openai/toolInvocation/invoked": "Complete",
  };
}

// Resource metadata with CSP from environment
function resourceMeta() {
  return {
    "openai/widgetDomain": serverUrl,
    "openai/widgetCSP": {
      connect_domains: [serverUrl, `https://${serverDomain}`],
      resource_domains: [serverUrl, `https://${serverDomain}`],
    },
  };
}

// Define tools with input schema
const tools: Tool[] = [
  {
    name: "render_data",
    title: "Render Data Widget",
    description: "Renders data in a rich widget. Pass the data to display.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Widget title" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              value: { type: "string" },
            },
            required: ["name", "value"],
          },
        },
      },
      required: ["title", "items"],
      additionalProperties: false,
    },
    _meta: toolMeta(WIDGET_URI),
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true,
    },
  },
];

// Define resources (widgets)
const resources: Resource[] = [
  {
    name: "My Widget",
    uri: WIDGET_URI,
    description: "Widget for displaying data",
    mimeType: MIME_TYPE,
    _meta: resourceMeta(),
  },
];

function createMCPServer(): Server {
  const server = new Server(
    { name: "my-mcp-server", version: "1.0.0" },
    { capabilities: { resources: {}, tools: {} } }
  );

  // List resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources }));

  // Read resource (return widget HTML)
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    if (uri === WIDGET_URI) {
      const html = fs.readFileSync(path.join(WIDGETS_DIR, "my-widget.html"), "utf8");
      return {
        contents: [{ uri: WIDGET_URI, mimeType: MIME_TYPE, text: html, _meta: resourceMeta() }],
      };
    }
    throw new Error(`Unknown resource: ${uri}`);
  });

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    if (request.params.name === "render_data") {
      const args = request.params.arguments as { title: string; items: Array<{ name: string; value: string }> };

      // Validate
      if (!args.title || !args.items) {
        throw new Error("Missing required fields: title and items");
      }

      // Build structuredContent for widget
      const structuredContent = {
        title: args.title,
        items: args.items,
        processedAt: new Date().toISOString(),
      };

      return {
        content: [{ type: "text", text: `Rendered ${args.items.length} items` }],
        structuredContent,
        _meta: toolMeta(WIDGET_URI),
      };
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  });

  return server;
}

// Session management
type SessionRecord = { server: Server; transport: StreamableHTTPServerTransport };
const sessions = new Map<string, SessionRecord>();

function isInitializeRequest(body: unknown): boolean {
  return typeof body === "object" && body !== null && "method" in body &&
         (body as { method: string }).method === "initialize";
}

async function handleMcpRequest(req: IncomingMessage, res: ServerResponse, parsedBody?: unknown) {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  let transport: StreamableHTTPServerTransport;

  if (sessionId && sessions.has(sessionId)) {
    transport = sessions.get(sessionId)!.transport;
  } else if (!sessionId && isInitializeRequest(parsedBody)) {
    const server = createMCPServer();
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId) => {
        sessions.set(newSessionId, { server, transport });
      },
    });
    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) sessions.delete(sid);
    };
    await server.connect(transport);
  } else {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Bad Request" }, id: null }));
    return;
  }

  await transport.handleRequest(req, res, parsedBody);
}

// CORS origin checking — allow *.m365.cloud.microsoft and m365.cloud.microsoft
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === "m365.cloud.microsoft" || hostname.endsWith(".m365.cloud.microsoft");
  } catch {
    return false;
  }
}

function setCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin!);
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id, mcp-protocol-version");
  }
}

// HTTP Server
const httpServer = createServer(async (req, res) => {
  if (!req.url) { res.writeHead(400).end(); return; }
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  // CORS preflight
  if (req.method === "OPTIONS" && url.pathname === "/mcp") {
    const origin = req.headers.origin;
    if (isAllowedOrigin(origin)) {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": origin!,
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, mcp-session-id, Last-Event-ID, mcp-protocol-version",
        "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
      });
    } else {
      res.writeHead(204);
    }
    res.end();
    return;
  }

  // Set CORS for MCP
  if (url.pathname === "/mcp") {
    setCorsHeaders(req, res);
  }

  // Health check
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // MCP POST (messages)
  if (req.method === "POST" && url.pathname === "/mcp") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const parsedBody = JSON.parse(body);
    await handleMcpRequest(req, res, parsedBody);
    return;
  }

  // MCP GET (SSE)
  if (req.method === "GET" && url.pathname === "/mcp") {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.writeHead(400).end();
      return;
    }
    await sessions.get(sessionId)!.transport.handleRequest(req, res);
    return;
  }

  // MCP DELETE (session termination)
  if (req.method === "DELETE" && url.pathname === "/mcp") {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      await sessions.get(sessionId)!.transport.handleRequest(req, res);
    }
    return;
  }

  // Serve widgets
  if (req.method === "GET" && url.pathname.startsWith("/widgets/")) {
    const widgetFile = url.pathname.replace("/widgets/", "");
    const widgetPath = path.join(WIDGETS_DIR, widgetFile);
    const resolvedPath = path.resolve(widgetPath);

    // Security check: prevent path traversal attacks
    // Ensure the resolved path is actually within WIDGETS_DIR
    const relativePath = path.relative(WIDGETS_DIR, resolvedPath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    if (fs.existsSync(resolvedPath)) {
      const headers: Record<string, string> = { "Content-Type": "text/html" };
      const origin = req.headers.origin;
      if (isAllowedOrigin(origin)) headers["Access-Control-Allow-Origin"] = origin!;
      res.writeHead(200, headers);
      res.end(fs.readFileSync(resolvedPath, "utf8"));
      return;
    }
    res.writeHead(404).end("Not found");
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`MCP Server running on http://localhost:${port}`);
  console.log(`MCP endpoint: http://localhost:${port}/mcp`);
});
```

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

## package.json scripts

```json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  }
}
```

## Static Asset Serving (Local Development)

For local development, the MCP server can serve static assets (JS, CSS, images) that widgets reference via `<script>` and `<link>` tags. This avoids needing a separate asset server during development.

> **Note**: This pattern is for local development convenience only. For production distribution, assets should be hosted on a CDN or packaged with your deployment pipeline.

Add an `/assets/*` route to the HTTP server:

```typescript
// MIME type map for static assets
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const ASSETS_DIR = path.resolve(__dirname, "..", "assets");

// Static asset serving (local development only)
if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
  const assetFile = url.pathname.replace("/assets/", "");
  const assetPath = path.join(ASSETS_DIR, assetFile);
  const resolvedPath = path.resolve(assetPath);

  // Path traversal guard: ensure resolved path stays within ASSETS_DIR
  const relativePath = path.relative(ASSETS_DIR, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  if (fs.existsSync(resolvedPath)) {
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const assetHeaders: Record<string, string> = { "Content-Type": contentType };
    const origin = req.headers.origin;
    if (isAllowedOrigin(origin)) assetHeaders["Access-Control-Allow-Origin"] = origin!;
    res.writeHead(200, assetHeaders);
    res.end(fs.readFileSync(resolvedPath));
    return;
  }
  res.writeHead(404).end("Not found");
  return;
}
```

### Configurable Widget Base URL

When the MCP server is behind a devtunnel, widgets that load external JS/CSS need to reference the tunnel URL instead of `localhost`. Use the `WIDGET_BASE_URL` environment variable to make this configurable:

```typescript
// Widget base URL: use tunnel URL in remote mode, localhost in local mode
const widgetBaseUrl = process.env.WIDGET_BASE_URL ?? process.env.MCP_SERVER_URL ?? `http://localhost:${port}`;

// Use in widget templates or pass via structuredContent
const structuredContent = {
  baseUrl: widgetBaseUrl,
  // ... other widget data
};
```

Set in `env/.env.local` (auto-populated by the devtunnel script):
```bash
WIDGET_BASE_URL=https://xxxxx-3001.usw2.devtunnels.ms
```

This allows widgets to reference `<script src="${baseUrl}/assets/app.js">` and work correctly whether running locally or through a tunnel.

## Next Steps

After the MCP server is running:

1. **Start the devtunnel** - See [devtunnels.md](devtunnels.md) for automated setup
2. **Configure the agent** - Use the `m365-json-agent-developer` skill to set up:
   - `mcpPlugin.json` with `RemoteMCPServer` runtime
   - `declarativeAgent.json` with capabilities and actions
3. **Deploy** - Run `npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local`
