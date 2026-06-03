# Best Practices

> **Language note**: These best practices apply to any MCP server implementation. Code examples
> use TypeScript for illustration, but the patterns (rendering tools, partial data handling,
> tool response format, widget-resource-tool triplet) are language-agnostic concepts.

## Table of Contents
- [1. ALWAYS Use Fluent UI for Widgets](#1-always-use-fluent-ui-for-widgets)
- [2. Rendering Tools Pattern](#2-rendering-tools-pattern)
- [3. Handle Partial Data](#3-handle-partial-data)
- [4. Agent Instructions](#4-agent-instructions)
- [5. Theme Support with FluentProvider](#5-theme-support-with-fluentprovider)
- [6. Use Shared Hooks](#6-use-shared-hooks)
- [7. Build Before Serve](#7-build-before-serve)
- [8. Debug Mode](#8-debug-mode)
- [9. Version Management](#9-version-management)
- [10. Input Schema Descriptions](#10-input-schema-descriptions)
- [11. Consistent Tool Definitions](#11-consistent-tool-definitions)
- [12. CORS Configuration](#12-cors-configuration)
- [13. Widget Security](#13-widget-security)
- [14. DevTunnels](#14-devtunnels)
- [15. MCP Server Working Directory](#15-mcp-server-working-directory)
- [16. Environment Variable Initialization](#16-environment-variable-initialization)
- [17. Declarative Agent Capabilities](#17-declarative-agent-capabilities)
- [18. Tool Response Format](#18-tool-response-format)
- [19. Conversation Starters](#19-conversation-starters)
- [20. Widget-Resource-Tool Triplet](#20-widget-resource-tool-triplet)

## 1. ALWAYS Use Fluent UI for Widgets

MANDATORY: All widget UI must be built with React and `@fluentui/react-components`.
Do not use raw HTML/CSS templates or other UI frameworks for widget rendering.

Required Fluent UI components:
- `Card` for containers
- `Badge` for labels/status
- `Table` or `DataGrid` for tabular data
- `Button` for actions
- `Avatar` for entity visuals
- `Tooltip` for hints
- `Spinner` for loading states
- `tokens` and `makeStyles` for styling

```tsx
import { Card, Badge, makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
  root: {
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
  },
});

export function MyWidget() {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <Card>
        <Badge appearance="filled">Title</Badge>
      </Card>
    </div>
  );
}
```

## 2. Rendering Tools Pattern

Design MCP tools as **rendering tools** that accept data from the caller rather than fetching data internally.

**Why**: Copilot can use its capabilities (People, Graph, etc.) to fetch data, then pass it to your MCP tool for rendering. This separation:
- Leverages Copilot's built-in data access
- Makes tools reusable across different data sources
- Simplifies MCP server implementation

**Pattern**:
```typescript
// Good: accept and validate caller-provided data
const parser = z.object({
  items: z.array(z.object({ name: z.string(), value: z.string() })),
});

// Avoid: Fetching data internally
// const data = await fetchFromAPI(); // Don't do this
```

## 3. Handle Partial Data

Always normalize input data to handle missing fields gracefully. Fill in "Unknown" for any missing properties.

**Server Pattern** - use Zod defaults:
```typescript
const parser = z.object({
  title: z.string().default("Untitled"),
  items: z.array(z.object({
    name: z.string().default("Unknown"),
    email: z.string().default("Unknown"),
    location: z.string().default("Unknown"),
  })).default([]),
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const parsed = parser.parse(request.params.arguments ?? {});
  return {
    content: [{ type: "text", text: `Rendered ${parsed.items.length} items` }],
    structuredContent: parsed,
    _meta: invocationMeta(MY_WIDGET),
  };
});
```

**Widget Pattern** - hide action buttons when data is "Unknown":
```tsx
import { Button } from "@fluentui/react-components";
import { MailRegular, ChatRegular } from "@fluentui/react-icons";

function ContactActions({ email }: { email: string }) {
  if (!email || email === "Unknown") return null;
  return (
    <>
      <Button icon={<MailRegular />} as="a" href={`mailto:${email}`} appearance="subtle" size="small">
        Email
      </Button>
      <Button
        icon={<ChatRegular />}
        as="a"
        href={`https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(email)}`}
        appearance="subtle"
        size="small"
      >
        Chat
      </Button>
    </>
  );
}
```

**Schema Pattern** - Make properties optional and document defaults:
```json
{
  "properties": {
    "name": {
      "type": "string",
      "description": "Full name. Defaults to 'Unknown' if not provided."
    }
  }
}
```

## 4. Agent Instructions

Tell the agent to use capabilities FIRST, then pass data to MCP tools.

**Pattern** (instruction.txt):
```
IMPORTANT: You MUST ALWAYS use the [Capability] capability FIRST to retrieve data
before calling MCP tools. The MCP tools are RENDERING tools only - they do NOT
fetch data. You must:
1. Query the capability to get the data
2. Pass that retrieved data to the appropriate MCP tool to render it

CRITICAL: Never call the MCP tools without first retrieving data from the capability.
```

## 5. Theme Support with FluentProvider

Theme should be handled by `FluentProvider` in widget entry points.

```tsx
import { FluentProvider, webLightTheme, webDarkTheme } from "@fluentui/react-components";

function getTheme() {
  const openaiTheme = (window as any).openai?.theme;
  if (openaiTheme === "dark") return webDarkTheme;
  if (openaiTheme === "light") return webLightTheme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? webDarkTheme
    : webLightTheme;
}
```

Never hand-code color systems for widget UI. Use Fluent `tokens` + `makeStyles`.

## 6. Use Shared Hooks

Reuse shared hooks from [widget-patterns.md](widget-patterns.md):
- `useOpenAiGlobal(key)` for polling `window.openai[key]`
- `useThemeColors()` for semantic theme palette
- `useWidgetState(initial)` for state persistence through Apps SDK host

```tsx
function MyWidget() {
  const toolOutput = useOpenAiGlobal("toolOutput");
  const [state, setState] = useWidgetState({ expanded: false });

  if (!toolOutput) return <Spinner label="Loading..." />;

  return <Card>{/* render with toolOutput */}</Card>;
}
```

## 7. Build Before Serve

Always build widgets before starting the server. The server serves pre-built assets.

```bash
npm run install:all
npm run build:widgets
npm run dev:server
```

After every widget code change:

```bash
npm run build:widgets
```

Server reads assets on each request; restart is typically not required after rebuild.

## 8. Debug Mode

Include fallback data for local widget testing without BizChat.

```tsx
const DEBUG_DATA = { title: "Test", items: [{ name: "Alice", value: "123" }] };

function useToolData() {
  const toolOutput = useOpenAiGlobal("toolOutput");
  if (toolOutput) return toolOutput;
  console.log("Debug mode - using DEBUG_DATA");
  return DEBUG_DATA;
}
```

## 9. Version Management

Bump manifest version for each deployment when changes aren't reflected.

```json
// manifest.json
{ "version": "1.0.5" }  // Increment on each change
```

## 10. Input Schema Descriptions

Provide detailed descriptions with examples and default values in inputSchema.

```json
{
  "properties": {
    "email": {
      "type": "string",
      "description": "Email address (e.g., 'john.doe@microsoft.com'). Defaults to 'Unknown' if not provided."
    },
    "location": {
      "type": "string",
      "description": "Work location (e.g., 'Redmond, WA'). Defaults to 'Unknown' if not provided."
    }
  }
}
```

## 11. Consistent Tool Definitions

Keep inputSchema identical in:
1. MCP server tool definitions
2. mcpPlugin.json tool definitions

Mismatches cause runtime errors.

## 12. CORS Configuration

Always configure CORS with an allowlist origin check.

```typescript
import cors from "cors";

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, origin ?? true);
    } else {
      callback(null, false);
    }
  },
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", "Accept",
    "Mcp-Session-Id", "mcp-session-id",
    "Last-Event-ID",
    "Mcp-Protocol-Version", "mcp-protocol-version",
  ],
  exposedHeaders: ["Mcp-Session-Id"],
  credentials: false,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
```

See [mcp-server-pattern.md](mcp-server-pattern.md) for full allowlist and `isOriginAllowed()` implementation.

## 13. Widget Security

React escapes JSX by default. Do not use `dangerouslySetInnerHTML`.

```tsx
// Safe
<Text>{userData.name}</Text>

// Unsafe in widgets
// <div dangerouslySetInnerHTML={{ __html: userData.name }} />
```

Validate dynamic URLs before rendering links.

## 14. DevTunnels

Use random tunnels for simple local loops:

```bash
devtunnel host -p 3001 --allow-anonymous
```

Pre-flight:
1. Kill old tunnels: `pkill -f "devtunnel host" 2>/dev/null`
2. Verify auth: `devtunnel user show`
3. Verify server: `curl -s http://localhost:3001/health`

Because URL changes each run, update `SERVER_BASE_URL` and provision again.

## 15. MCP Server Working Directory

Monorepo pattern (`server/` and `widgets/` each with separate package files):

```bash
# From mcp-server root
npm run install:all
npm run build:widgets
npm run dev:server
npm run start

# Directly
cd server && npm run dev
cd widgets && npm run build
```

Common failure: running `npm run dev` at root when only `dev:server` is defined.

## 16. Environment Variable Initialization

Before first provision, populate all `${{VAR_NAME}}` placeholders used by `appPackage/`
in `env/.env.local`.

Set at least:

```env
SERVER_BASE_URL=http://localhost:3001
```

This placeholder allows initial provision before a tunnel URL is available.

## 17. Declarative Agent Capabilities

Only enable capabilities you need.

```json
{
  "capabilities": [
    { "name": "People" }
  ]
}
```

Available:
- `People` - Organizational data, manager/reports
- `GraphConnectors` - Custom Graph connectors
- `OneDriveAndSharePoint` - File access
- `WebSearch` - Web search

## 18. Tool Response Format

Always include both text content and structuredContent.

```typescript
return {
  content: [{ type: "text", text: "Human-readable summary" }],
  structuredContent: { /* data for widget */ },
  _meta: invocationMeta(MY_WIDGET),
};
```

The text content serves as fallback and accessibility.

## 19. Conversation Starters

Add relevant conversation starters to help users discover your agent's capabilities.

```json
{
  "capabilities": {
    "conversation_starters": [
      {
        "title": "Short button label",
        "text": "Full prompt that will be sent when clicked"
      }
    ]
  }
}
```

## 20. Widget-Resource-Tool Triplet

Every widget in a Copilot MCP server requires three coordinated parts:

| Part | What it does | Where it lives |
|------|-------------|----------------|
| **Widget shell + assets** | Shell HTML loads rendered React + Fluent UI bundle | `widgets/<name>.html` + `assets/<name>.js` |
| **MCP Resource** | Serves widget shell to Copilot via `ui://widget/<name>.html` | `resources` array + `ReadResourceRequestSchema` handler |
| **MCP Tool** | Triggers widget rendering via `_meta.openai/outputTemplate` | `tools` array + `CallToolRequestSchema` handler |

If any part is missing:
- No Resource → Copilot can't fetch widget shell, widget won't render
- No Tool → Widget exists but nothing triggers it
- No shell/assets → Resource returns 404 or shell loads without scripts, tool invocation shows empty widget

**Simple vs Complex widgets:**
- Simple: Self-contained shell/widget for quick validation → `ReadResource` returns full file
- Complex (React + Fluent UI, preferred): Minimal HTML shell linking to JS/CSS assets served via `/assets/` route → `ReadResource` returns shell HTML, assets load from `MCP_SERVER_URL/assets/`

Always create all three parts together. When adding a new tool+widget, start from the resource pattern in [mcp-server-pattern.md](mcp-server-pattern.md).
