---
name: ui-widget-developer
description: |
  Build MCP servers for Copilot Chat using the OpenAI Apps SDK or MCP Apps SDK widget rendering support (any language). Use this skill when:
  - Creating MCP servers that integrate with M365 Copilot declarative agents
  - Building rich interactive widgets (React + Fluent UI) that render in Copilot Chat
  - Implementing tools that return structuredContent for widget rendering
  - Adapting an existing MCP server to support Copilot widget rendering
  - Setting up devtunnels for localhost MCP server exposure
  - Configuring mcpPlugin.json manifests with RemoteMCPServer runtime
  Do NOT use this skill for general agent development (scaffolding, manifests, deployment) — use declarative-agent-developer instead. This skill is ONLY for MCP server + widget development.
  Triggers: "MCP server for Copilot", "OpenAI Apps SDK", "Copilot widget", "structuredContent", "MCP plugin", "devtunnels MCP", "OAI app", "widget rendering", "UI widget"
---

# Copilot MCP Server Development

## Telemetry Tagging

Before running any `atk` CLI commands, set the session environment variable so all CLI invocations are tagged as skill-initiated:
```bash
export ATK_CLI_SKILL=true
```
Run this once at the start of the session. All subsequent `atk` commands in the same terminal will inherit it.

## 🔀 PATH SELECTION

**Before proceeding, ask the user which path they want to take using AskUserQuestion.** Both are supported for M365 Copilot widget rendering. Present the tradeoffs and let them choose:

| | **OAI Apps** (this skill) | **MCP Apps Extension** (`modelcontextprotocol/ext-apps`) |
|---|---|---|
| **Standard** | OpenAI-specific | Official MCP standard |
| **Works in** | ChatGPT + M365 Copilot | M365 Copilot, ChatGPT, VSCode, and more |
| **Maturity** | Battle-tested, production-ready | New official standard, growing ecosystem |
| **Design** | OpenAI Apps SDK | MCP Apps protocol (cross-platform) |
| **When to choose** | Existing OAI app investment | Prefer the open standard, want broadest client support |

**Ask:** _"Would you like to build an OAI app (OpenAI Apps SDK — battle-tested, works in ChatGPT and M365 Copilot) or an MCP app (new official standard — works in M365 Copilot, ChatGPT, VSCode, and more)?"_

- **OAI apps** → Continue below. This skill covers everything you need.
- **MCP apps** → Install the `modelcontextprotocol/ext-apps` plugin (see below), then use the appropriate skill from that plugin.

### MCP Apps: Install ext-apps Plugin

If the user chooses MCP Apps, do this automatically (do not stop at explanation-only):

1. Run `/plugin marketplace add modelcontextprotocol/ext-apps`
2. Run `/plugin install mcp-apps@mcp-apps`
3. Confirm the plugin is available, then invoke the correct ext-apps skill based on user intent

If plugin commands are unavailable in the current environment, provide the exact commands below and ask the user to run them once, then continue by invoking the selected ext-apps skill.

Reference commands:

```
To build an MCP App, install the ext-apps plugin from the marketplace:

1. /plugin marketplace add modelcontextprotocol/ext-apps
2. /plugin install mcp-apps@mcp-apps

Then use one of these skills from that plugin:
- create-mcp-app      — Scaffold a new MCP App with interactive UI from scratch
- add-app-to-server   — Add interactive UI to an existing MCP server's tools
- migrate-oai-app     — Convert an existing OAI app to use MCP Apps
- convert-web-app     — Turn a web app into a hybrid web + MCP App

After installing, invoke the relevant skill to continue.
```

> **Note:** The ext-apps plugin lives in the external `modelcontextprotocol/ext-apps` marketplace — it is not part of this plugin collection.

**Handoff mapping after install:**
- New MCP app from scratch → `create-mcp-app`
- Add app UI to existing MCP server → `add-app-to-server`
- Migrate existing OAI app → `migrate-oai-app`
- Convert an existing web app → `convert-web-app`

---

## 📛 PROJECT DETECTION 📛

This skill triggers when building MCP servers with OAI app or widget rendering for Microsoft 365 Copilot Chat. The MCP server can be written in any language that supports the MCP protocol (TypeScript, Python, C#, etc.). The agent project and MCP server may live in the same repo, separate folders, or entirely different projects.

## Scenario Routing

| Starting Point | What You Need | Path |
|---------------|---------------|------|
| **Prefer MCP Apps standard** | Cross-platform widget support (M365 Copilot, ChatGPT, VSCode, and more) | Install `modelcontextprotocol/ext-apps`, then use `create-mcp-app` or `add-app-to-server` — see [Path Selection](#-path-selection) above |
| **From scratch** (no agent, no MCP server) | Full OAI app setup | Delegate agent scaffolding to `declarative-agent-developer` first, then return here for MCP server + widgets |
| **Existing M365 agent, new MCP server** | MCP server + widgets + mcpPlugin.json | Start at [Implementation](#implementation) |
| **Existing MCP server, add Copilot widgets** | Widget support added to existing server | Start at [Copilot Widget Protocol](references/copilot-widget-protocol.md#adaptation-checklist-existing-mcp-server) |
| **Language choice** (non-TypeScript) | Protocol requirements | See [Copilot Widget Protocol](references/copilot-widget-protocol.md) for what to implement, [MCP Server Pattern (TypeScript)](references/mcp-server-pattern.md) as a reference |

---

## 🚨 CRITICAL EXECUTION RULES 🚨


**FLUENT UI ENFORCEMENT (REQUIRED):** Widget implementations MUST use React + Fluent UI components. Before writing any widget code, the agent MUST read and follow:
- `references/widget-patterns.md`
- `references/best-practices.md`
**FLUENT UI PACKAGE REQUIREMENT (REQUIRED):** The widget project MUST include Fluent UI dependencies before implementation. At minimum, install and keep these in the widget package dependencies:
- `@fluentui/react-components`
- `react`
- `react-dom`

If any of these packages are missing, install them automatically before continuing with widget code generation.

If the generated widget does not include React entry files (for example `widgets/src/<widget-name>/main.tsx` and a React component file) and Fluent imports from `@fluentui/react-components`, the task is incomplete and MUST be corrected before returning results.

**NO RAW HTML-ONLY WIDGETS (DEFAULT):** Do not implement app content directly with static HTML templates and inline JS as the final widget solution. A minimal shell HTML file is allowed only as a loader for built React assets. Raw/self-contained HTML-only widgets are allowed only when the user explicitly requests a non-React prototype.

**BACKGROUND PROCESSES:** MCP server and devtunnel MUST be spawned as independent OS processes — NOT run inside the agent's shell session. `isBackground: true`, `mode: "async"`, and `Start-Job` all run inside the agent's shell session and will be killed between messages. The only reliable approach is to spawn a detached OS process.

**Windows — use `Start-Process -WindowStyle Hidden`:**
```powershell
# Start devtunnel
$t = Start-Process -FilePath "devtunnel" `
    -ArgumentList "host","<tunnel-name>","-a" `
    -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput "tunnel.log" -RedirectStandardError "tunnel-err.log"

# Start MCP server — use cmd.exe /c to set the working directory and inherit PATH
$s = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c","cd /d <abs-path-to-mcp-server> && <start-command>" `
    -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput "server.log" -RedirectStandardError "server-err.log"

# Save PIDs so they can be stopped later
"$($t.Id),$($s.Id)" | Out-File pids.txt
Write-Host "Started tunnel PID $($t.Id), server PID $($s.Id)"
```
To stop: `Stop-Process -Id (Get-Content pids.txt).Split(',')` or `Stop-Process -Id <pid>`.

**Linux/Mac — use `nohup` with `&`:**
```bash
nohup devtunnel host <tunnel-name> > tunnel.log 2>tunnel-err.log &
echo "tunnel:$!" >> pids.txt
nohup <start-command> > server.log 2>server-err.log &
echo "server:$!" >> pids.txt
```
To stop: `kill $(grep -oP '\d+' pids.txt)`.

After starting, tail the logs to confirm both processes are up before proceeding:
```powershell
# Windows
Start-Sleep 3; Get-Content tunnel.log, server.log
```
```bash
# Linux/Mac
sleep 3 && tail tunnel.log server.log
```

**FULL AUTOMATION:** Never tell the user to run commands manually. Install tools, authenticate, start services — do everything automatically. Only ask the user for interactive input that truly requires them (like device code confirmation during `devtunnel user login -g -d`). If a tool isn't installed, install it. If a service needs starting, start it. The user expects full automation.

**PATH SELECTION (REQUIRED — STOP BEFORE ANY CODE):** You MUST use `AskUserQuestion` to ask the user whether they want OAI Apps or MCP Apps Extension before writing any code, running any commands, or making any architectural decisions.

**There is no exception to this rule.** The most common failure mode is reasoning "the user's request makes it obvious, so asking is redundant." This reasoning is always wrong — invoke `AskUserQuestion` regardless. A user saying "build an MCP server with widgets" is NOT an answer to this question. A user invoking this skill by name is NOT an answer. Only an explicit answer to the question counts. See [PATH SELECTION](#-path-selection) above for the exact question to ask.

**AGENT PROVISIONING:** Re-provisioning is only required when the **agent manifest** changes (e.g., mcpPlugin.json tool definitions, MCP server URL, declarativeAgent.json, instruction.txt). MCP server code changes (tool implementations, React widget code, server logic) do **NOT** require re-provisioning the agent — running or deploying the server picks up changes automatically.

When provisioning is needed:
1. **Bump the version** in `manifest.json` (increment the patch version, e.g., `1.0.0` → `1.0.1`)
2. **Deploy the agent:**
   ```bash
   npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local
   ```

**WIDGET TESTING LINKS:** Every time you return to the user with a result while the MCP server is running, you MUST include links to ALL widgets so they can test them locally. Format:
```
🧪 Test widgets locally:
- http://localhost:3001/widgets/widget-name.html
- http://localhost:3001/widgets/another-widget.html
```
List every `.html` file in the `mcp-server/widgets/` directory (or equivalent widget folder). This helps users verify widget rendering before testing in Copilot.

**AUTO-DEPLOY ON COMPLETION (REQUIRED — DO NOT SKIP):** When coding is complete, proceed automatically without waiting for the user:
1. Start MCP server + devtunnel in the background (per BACKGROUND PROCESSES above)
2. Run E2E verification with MCP Inspector (per MCP TOOL CONFIGURATION RULE below) — fix any failures before continuing
3. Provision the agent if needed (per AGENT PROVISIONING above)
4. Print a project summary in this format:
```
## ✅ <Project Name> — Ready

### Widgets
- [widget-name.html](http://localhost:<PORT>/widgets/widget-name.html)
- [widget-name2.html](http://localhost:<PORT>/widgets/widget-name2.html)

### Endpoints
- MCP server: http://localhost:<PORT>/mcp
- MCP via tunnel: https://<tunnel-url>/mcp

### Test in Copilot
Local:      https://m365.cloud.microsoft/chat/?titleId={M365_TITLE_ID from env/.env.local}
Other envs: {SHARE_LINK from env/.env.{environment}}
```

**AGENT PROJECT DELEGATION:** This skill builds MCP servers and widgets, NOT declarative agent projects. If the user's request involves creating or configuring the declarative agent itself (scaffolding, `m365agents.yml`, `m365agents.local.yml`, `declarativeAgent.json`, manifest lifecycle), delegate to the `declarative-agent-developer` skill.

**MCP RESOURCE REGISTRATION:** Every widget MUST have a matching MCP resource. Without resources, Copilot cannot fetch widget shells through the MCP protocol and widgets will not render.

For each new widget, complete this checklist:
1. ☐ Create a widget shell HTML file in `widgets/` and a React widget entry under `widgets/src/<widget-name>/` (see widget-patterns.md)
2. ☐ Define a `ui://widget/<name>.html` URI constant
3. ☐ Add a `Resource` entry to the `resources` array with:
   - `uri`: the `ui://widget/<name>.html` URI
   - `mimeType`: `"text/html+skybridge"`
   - `_meta`: CSP config with `openai/widgetDomain` and `openai/widgetCSP` (from environment)
4. ☐ Add a handler for `resources/read` that returns the widget shell HTML for this URI
5. ☐ Add the tool with `_meta.openai/outputTemplate` pointing to the same `ui://widget/<name>.html` URI
6. ☐ Verify the server capabilities include `resources: {}` in the initialize response

**Widget shell + asset considerations:**
- **Preferred (React + Fluent UI)**: Resource HTML should be a minimal shell that links to built JS/CSS assets served from the MCP server's `/assets/` route.
- **Exception only**: Self-contained HTML via `resources/read` is for explicit user-requested prototypes only. Default and production path is React + Fluent UI.

Example shell for React build output:
  ```html
  <!doctype html><html><head>
    <script type="module" src="${serverUrl}/assets/my-widget.js"></script>
    <link rel="stylesheet" href="${serverUrl}/assets/my-widget.css">
  </head><body>
    <div id="widget-root"></div>
  </body></html>
  ```
  Use the `WIDGET_BASE_URL` or `MCP_SERVER_URL` environment variable for the asset URL base (see mcp-server-pattern.md "Configurable Widget Base URL" section).

See [mcp-server-pattern.md](references/mcp-server-pattern.md) for the complete resource and asset serving patterns.

---

## ⚠️ MCP TOOL CONFIGURATION RULE ⚠️

**NEVER manually write tool definitions in `mcpPlugin.json`.** Always use MCP Inspector to get the complete tool definitions from the running MCP server.

**TOOL NAMING CONVENTION:** Tool names MUST match the pattern `^[A-Za-z0-9_]+$` (letters, numbers, and underscores only). **NEVER use hyphens (-) in tool names.** Use underscores instead (e.g., `render_profile` not `render-profile`).

**MANDATORY WORKFLOW:**
1. **Start the MCP server** (in background)
2. **Use MCP Inspector** to get the latest tool definitions:
   ```bash
   npx @modelcontextprotocol/inspector@0.20.0 --cli https://my-mcp-server.example.com --transport http --method tools/list
   ```
3. **Copy the COMPLETE tool definition** from the inspector (including `name`, `description`, `inputSchema`, `_meta`, `annotations`, `title`)
4. **Paste into `mcpPlugin.json`** under `runtimes[].spec.mcp_tool_description.tools` (inside the `RemoteMCPServer` runtime's `spec` object)
5. **Run E2E verification** through the devtunnel — call each tool and confirm the response contains `structuredContent` and `_meta.openai/widgetAccessible: true`:
   ```bash
   npx @modelcontextprotocol/inspector@0.20.0 --cli https://<tunnel-url>/mcp --transport http --method tools/call --tool-name <tool_name>
   ```
   Also verify `GET https://<tunnel-url>/health` returns `{"status":"ok"}`. Fix any failures before provisioning.

The MCP Inspector shows the exact tool schema from your server. Copy it completely — do not manually write or modify these definitions. This ensures `mcpPlugin.json` stays in sync with the MCP server.

---

Build MCP servers that integrate with Microsoft 365 Copilot Chat and render rich interactive widgets.

## Architecture

```
M365 Copilot ──▶ mcpPlugin.json ──▶ MCP Server ──▶ structuredContent ──▶ React + Fluent UI Widget
     │              (RemoteMCPServer)    (Streamable HTTP)                  (window.openai.toolOutput)
     │
     └── Capabilities (People, etc.) provide data to pass to MCP tools
```

## Project Structure

Example project structure, not a hard requirement but a common pattern for organizing MCP server + widget development:

```
project/
├── appPackage/
│   ├── manifest.json           # Teams manifest (bump version on deploy)
│   ├── declarativeAgent.json   # Agent config + capabilities
│   ├── mcpPlugin.json          # Tool definitions with _meta
│   └── instruction.txt         # Agent behavior instructions
├── mcp-server/
│   ├── src/index.ts            # Server with Streamable HTTP
│   ├── widgets/                # Widget shells + React source
│   │   ├── my-widget.html      # Minimal shell returned by resources/read
│   │   └── src/my-widget/      # React + Fluent UI source
│   ├── assets/                 # Built widget bundles served at /assets
│   └── package.json
├── scripts/
│   ├── setup-devtunnel.sh      # Linux/Mac devtunnel setup
│   └── setup-devtunnel.ps1     # Windows devtunnel setup
└── env/.env.local              # MCP_SERVER_URL, MCP_SERVER_DOMAIN
```

**Language note**: This shows a TypeScript project layout. For Python, replace `mcp-server/src/index.ts` with your Python entry point (e.g., `server.py`). For C#, use a standard .NET project structure. The `appPackage/`, `widgets/`, `scripts/`, and `env/` directories are language-agnostic.

## Copilot Widget Protocol

Your MCP server must implement these protocol requirements to render widgets in Copilot Chat. This applies regardless of language:

1. **Streamable HTTP transport** — `/mcp` endpoint handling POST, GET, DELETE with session management
2. **CORS headers** — Origin-checking on `/mcp` allowing `m365.cloud.microsoft` and `*.m365.cloud.microsoft`, with required MCP headers
3. **Server capabilities** — `initialize` response must declare `resources: {}` and `tools: {}`
4. **MCP resources** — Register widgets with `ui://widget/<name>.html` URIs, `text/html+skybridge` mime type, and CSP `_meta`
5. **Tool response format** — Return `content` (text) + `structuredContent` (widget data) + `_meta` with `openai/outputTemplate`
6. **Widget serving** — HTTP route at `/widgets/*.html` for shell files and `/assets/*` for built bundles, both with origin-checking CORS

For full protocol details, JSON shapes, and an adaptation checklist for existing MCP servers, see [references/copilot-widget-protocol.md](references/copilot-widget-protocol.md).

## Implementation

### MCP Server Pattern (TypeScript Reference)

See [references/mcp-server-pattern.md](references/mcp-server-pattern.md) for complete implementation.

> For other languages, implement the requirements described in [Copilot Widget Protocol](references/copilot-widget-protocol.md) using your language's MCP SDK. See the [Language SDK References](references/copilot-widget-protocol.md#language-sdk-references) table for SDK packages.

Core requirements:
- Expose Streamable HTTP transport on `/mcp`
- Return `structuredContent` + `_meta` with `openai/outputTemplate`
- Serve widgets via HTTP endpoint
- Handle CORS for cross-origin requests
- Handle partial data gracefully (fill in "Unknown" for missing fields)

Tool response format:
```typescript
return {
  content: [{ type: "text", text: "Summary" }],
  structuredContent: { /* widget data */ },
  _meta: { "openai/outputTemplate": "ui://widget/name.html", "openai/widgetAccessible": true }
};
```

### Handling Partial Data

Always normalize input data to handle missing fields:

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const args = request.params.arguments as { title?: string; items?: Partial<Item>[] };

  // Normalize data - fill in "Unknown" for missing fields
  const title = args.title || "Default Title";
  const items = (args.items || []).map(item => ({
    name: item.name || "Unknown",
    value: item.value || "Unknown",
  }));

  // Build structuredContent for widget
  const structuredContent = { title, items };
  // ...
});
```

### Widget Pattern

See [references/widget-patterns.md](references/widget-patterns.md) for complete examples.

Core requirements:
- Use React + Fluent UI components (`@fluentui/react-components`)
- Ensure widget package dependencies include `@fluentui/react-components`, `react`, and `react-dom`
- Theme with `FluentProvider` (`webLightTheme`/`webDarkTheme`) and Fluent `tokens`
- Access data through shared hooks (e.g., `useOpenAiGlobal("toolOutput")`)
- Debug fallback: embedded mock data when `window.openai` unavailable
- Handle "Unknown" values gracefully (e.g., hide action buttons)

### Plugin Schema

See [references/plugin-schema.md](references/plugin-schema.md) for mcpPlugin.json format.

Core requirements:
- Schema `v2.4` with `RemoteMCPServer` runtime
- `run_for_functions` array matching tool names
- `_meta` in tool definitions for widget binding
- `inputSchema` - make properties optional for flexibility, describe defaults in descriptions

## DevTunnels Setup

> **Local testing only.** DevTunnels are for development and testing on your machine. Before sharing the agent more broadly, deploy both the MCP server and widget assets to a hosted environment (e.g., Azure App Service, Azure Static Web Apps, or another hosting provider) and update the agent manifest URLs accordingly.

DevTunnels expose your localhost MCP server to M365 Copilot using **named tunnels** for stable URLs. See [references/devtunnels.md](references/devtunnels.md) for setup scripts, command reference, and troubleshooting.

The setup script (`npm run tunnel` / `npm run tunnel:win`):
1. Creates a named tunnel on first run (or reuses the existing one)
2. Starts hosting the tunnel on the configured port
3. Updates `env/.env.local` with `MCP_SERVER_URL` and `MCP_SERVER_DOMAIN` (first run only)
4. Continues hosting the tunnel

### Quick Start

**Terminal 1 - Start MCP Server:**
```bash
cd mcp-server
npm install
npm run dev
```

**Terminal 2 - Start DevTunnel:**
```bash
npm run tunnel
# Or on Windows:
npm run tunnel:win
```

On first run, provision the agent once the tunnel is up (see AGENT PROVISIONING rule). On subsequent runs the tunnel URL is stable — no re-provisioning needed unless the agent manifest changes.

## Development Workflow

1. **Start the MCP server** (dev mode with hot reload):
   - TypeScript: `cd mcp-server && npm install && npm run dev`
   - Python: `cd mcp-server && pip install -r requirements.txt && python server.py`
   - C#: `cd mcp-server && dotnet run`

2. **Start the devtunnel** (creates named tunnel on first run, reuses on subsequent runs):
   ```bash
   npm run tunnel
   ```

3. **Provision + test** — see AGENT PROVISIONING rule for when this is needed; bump `version` in manifest.json if Copilot doesn't reflect changes

## Best Practices

See [references/best-practices.md](references/best-practices.md) for detailed guidance.

Key points:
1. **Rendering tools**: Accept data as input, don't fetch internally
2. **Instructions**: Tell agent to use capabilities FIRST, then pass data to MCP tools
3. **Themes**: Use `FluentProvider` + Fluent `tokens` for dark/light support
4. **Debug mode**: Include fallback data for local widget testing
5. **Partial data**: Handle missing fields with "Unknown" defaults
6. **Action buttons**: Hide email/chat buttons when data is "Unknown"
7. **Version bumping**: Bump manifest version when changes aren't reflected in Copilot
