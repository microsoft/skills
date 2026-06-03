# MCP Server Plugin Integration

This guide explains how to integrate Model Context Protocol (MCP) servers as actions in your Microsoft 365 Copilot agent using JSON manifests. It covers both unauthenticated and OAuth-authenticated MCP servers.

> **⛔ SINGLE FILE ONLY:** MCP plugins require exactly **ONE file** — the plugin manifest (`{name}-plugin.json`). Tool descriptions are inlined directly in the manifest's `mcp_tool_description.tools` array. **Do NOT create a separate `{name}-mcp-tools.json` file.** There is no `"file"` property — only `"tools": [...]`.

## Overview

MCP servers expose tools that can be consumed by your agent. Unlike OpenAPI-based plugins, MCP plugins use a `RemoteMCPServer` runtime type and embed the tool descriptions directly in the plugin manifest.

> **⚠️ IMPORTANT:** `npx -y --package @microsoft/m365agentstoolkit-cli atk add action` does NOT support MCP servers — it only supports `--api-plugin-type api-spec` for OpenAPI plugins. MCP plugins MUST be created manually following the steps below. This is NOT a violation of the "Always Use `npx -y --package @microsoft/m365agentstoolkit-cli atk add action`" rule — that rule applies only to OpenAPI/REST API plugins.

## Prerequisites

- MCP server URL (must be accessible via HTTP/HTTPS)
- Node.js installed (for `mcp-remote` authentication helper)
- Logo images for the agent (color.png 192×192 and outline.png 32×32) — optional, see [Step 5: Logo Images](#step-5-logo-images-optional)

---

## Scaffold the Agent Project First

Before adding an MCP plugin, you **must** have a scaffolded agent project. Run `npx -y --package @microsoft/m365agentstoolkit-cli atk new` if you haven't already:

```bash
npx -y --package @microsoft/m365agentstoolkit-cli atk new \
  -n my-agent \
  -c declarative-agent \
  -i false
```

This creates `m365agents.yml` (and `m365agents.local.yml`) with the **5 required lifecycle steps**:

| Step | Lifecycle Action | What it does |
|------|-----------------|--------------|
| 1 | `teamsApp/create` | Registers the Teams app |
| 2 | `teamsApp/zipAppPackage` | Packages manifest + icons into a zip |
| 3 | `teamsApp/validateAppPackage` | Validates the package (icons, schema, etc.) |
| 4 | `teamsApp/update` | Uploads the package to Teams |
| 5 | `teamsApp/extendToM365` | **Extends the app to M365 Copilot** — generates `M365_TITLE_ID` |

**What breaks without `extendToM365`:** If this step is missing, `npx -y --package @microsoft/m365agentstoolkit-cli atk provision` will register the Teams app and generate `TEAMS_APP_ID`, but the agent will **never appear in Copilot Chat** because no `M365_TITLE_ID` is generated. This is the most common reason for "provision succeeded but agent not found" failures.

> **If you already have a project** but are missing `teamsApp/extendToM365`, add it to the `provision` lifecycle in `m365agents.yml` after `teamsApp/update`. See [deployment.md](deployment.md) for the full provisioning reference.

---

## Step-by-Step Integration

### Step 1: Get MCP Server URL

Ask the user for the MCP server URL. Example: `https://learn.microsoft.com/api/mcp`

Derive the **server root** (scheme + host only): e.g., `https://learn.microsoft.com`

### Step 2: Detect Authentication Requirements

Before discovering tools, determine if the MCP server requires OAuth authentication.

**Probe both well-known endpoints in parallel:**

```bash
curl -s <SERVER_ROOT>/.well-known/oauth-authorization-server
curl -s <SERVER_ROOT>/.well-known/openid-configuration
```

**Decision:**
- **OAuth metadata found** (either endpoint returns valid JSON with `authorization_endpoint`) → the server requires authentication. Follow [authentication.md](authentication.md) Steps 1-3 to discover endpoints, obtain credentials, and configure `oauth/register` in both `m365agents.yml` and `m365agents.local.yml`. Then continue to [Step 3](#step-3-discover-mcp-tools-mandatory) below for authenticated tool discovery.
- **No OAuth metadata** (both return 404 or non-JSON) → the server is unauthenticated. Skip directly to [Step 3](#step-3-discover-mcp-tools-mandatory) for unauthenticated tool discovery.

### Step 3: Discover MCP Tools (MANDATORY)

🚨 **THIS STEP IS MANDATORY — DO NOT SKIP**

You MUST discover tools via the MCP protocol directly. Tool discovery uses HTTP POST requests to the MCP server URL.

#### 3a. Authenticate (OAuth servers only)

If the server requires OAuth (detected in Step 2), perform a one-time authentication:

Tell the user:
> "I need to authenticate with [name]'s MCP server. A browser window will open — please sign in."

Run the command **interactively** (NOT backgrounded — do NOT append `&` or redirect to files):

```bash
npx -p mcp-remote@latest mcp-remote-client <MCP_SERVER_URL> --port 3334
```

Wait for it to complete. The command will open a browser for OAuth sign-in and then exit once authentication succeeds.

> **WSL / headless environments:** `mcp-remote` starts a local HTTP server for the OAuth callback and tries to open a browser. In WSL, the browser opens on the Windows host but the `http://127.0.0.1:3334/...` callback URL may not route back to WSL. If the browser opens but authentication seems stuck:
> 1. After signing in, copy the full callback URL from the browser (it will show an error or blank page)
> 2. Run `curl '<callback-url>'` inside WSL to deliver the auth code to mcp-remote
> 3. Alternatively, run `export BROWSER=wslview` before the command so WSL's browser opener is used, which handles the redirect correctly

**⛔ IMPORTANT:** Do NOT look for tokens in `/tmp/` or log files. Tokens are ONLY stored at `~/.mcp-auth/`.

**Read the cached access token from `~/.mcp-auth`:**

```bash
ls ~/.mcp-auth/mcp-remote-*/
```

Find the token file (pattern: `{url-hash}_tokens.json`), read it, and extract `access_token`.

**⛔ Security:** Do NOT print the token value in your output. Extract it silently and use it only in subsequent HTTP calls. Do NOT write it to any file or create copies.

#### 3b. MCP Session Handshake

Run three sequential HTTP calls to discover tools.

**⛔ Security:** Suppress raw HTTP responses that may contain tokens. Only extract the fields you need (`mcp-session-id`, tool definitions). Do NOT display Authorization headers or token values to the user.

**Call 1 — Initialize:**

```bash
curl -s -X POST <MCP_SERVER_URL> \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  [-H "Authorization: Bearer <access_token>"] \
  -D - \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"m365-agent-skill","version":"1.0.0"}}}'
```

Extract `mcp-session-id` from the response headers. Omit the `Authorization` header for unauthenticated servers.

**Call 2 — Initialized notification:**

```bash
curl -s -X POST <MCP_SERVER_URL> \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <session_id>" \
  [-H "Authorization: Bearer <access_token>"] \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
```

**Call 3 — List tools (with pagination):**

```bash
curl -s -X POST <MCP_SERVER_URL> \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <session_id>" \
  [-H "Authorization: Bearer <access_token>"] \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

If the response contains `nextCursor`, repeat with `{"params":{"cursor":"<nextCursor>"}}` until no cursor remains. Collect all tools.

**Extracting tools from the response:**

Save the raw tools/list response to a file, then use this script to extract the tools array:

```bash
python3 << 'EXTRACT_TOOLS'
import json, sys

with open("/tmp/mcp-tools-response.json") as f:
    data = json.load(f)

tools = data.get("result", {}).get("tools", [])
with open("/tmp/mcp-tools.json", "w") as out:
    json.dump(tools, out, indent=2)

print(f"Extracted {len(tools)} tools")
for t in tools:
    print(f"  - {t['name']}: {t.get('description', '')[:80]}")
EXTRACT_TOOLS
```

> **⛔ Do NOT use inline Python inside command substitutions** (e.g., `$(python3 -c '...')`). The shell security policy blocks nested command substitutions. Always use heredoc scripts (`<< 'EOF'`) or standalone `.py` files instead.

**Expected output structure:**
```json
{
  "result": {
    "tools": [
      {
        "name": "tool_name",
        "description": "Tool description",
        "inputSchema": {
          "type": "object",
          "properties": { ... },
          "required": [...]
        },
        "annotations": {
          "readOnlyHint": true
        },
        "execution": {
          "taskSupport": "forbidden"
        },
        "_meta": {
          "ui": {
            "resourceUri": "ui://namespace/view-name.html"
          }
        }
      }
    ]
  }
}
```

> **⚠️ IMPORTANT:** The example above shows commonly seen fields (`annotations`, `execution`, `_meta`), but MCP servers may return **any** additional properties on tool objects. You **MUST** preserve every property returned by tools/list — copy each tool object in its entirety into `mcp_tool_description.tools[]`. Do NOT cherry-pick known fields; treat the tools/list output as the source of truth and inline it verbatim.

#### 3c. Use All Discovered Tools

**Include ALL tools** returned by `tools/list` in the plugin manifest. Do NOT filter or exclude tools unless the developer explicitly asks to limit the tool set.

**Copy each tool object verbatim** — every property the server returns (`name`, `description`, `inputSchema`, `annotations`, `execution`, `_meta`, `outputSchema`, `title`, or any other field) must be preserved in `mcp_tool_description.tools[]`. Do NOT maintain a hardcoded list of "known" fields — the MCP protocol evolves and servers may return new properties at any time.

Tell the user how many tools were discovered and confirm they will all be included.

### Step 4: Create the Plugin Manifest

Create `{name}-plugin.json` in the `appPackage` folder:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/copilot/plugin/v2.4/schema.json",
  "schema_version": "v2.4",
  "name_for_human": "{NAME-FOR-HUMAN}",
  "description_for_human": "{DESCRIPTION-FOR-HUMAN}",
  "namespace": "simplename",
  "functions": [],
  "runtimes": []
}
```

**Required fields:**
| Field | Description |
|-------|-------------|
| `name_for_human` | Display name shown to users (max 20 characters) |
| `description_for_human` | Brief description of the plugin (max 100 characters) |
| `namespace` | Unique identifier, lowercase alphanumeric only (no hyphens, no underscores) |

### Step 4a: Add Functions from Discovered Tools

For EACH discovered tool from Step 3, add a function entry with `name`, `description`, and `capabilities` only. Do **NOT** duplicate `parameters`/`inputSchema` in the function — all tool schema data lives exclusively in `mcp_tool_description.tools[]` (see Step 6).

```json
{
  "functions": [
    {
      "name": "microsoft_docs_search",
      "description": "Search official Microsoft/Azure documentation to find the most relevant content for a user's query."
    }
  ]
}
```

**🚨 CRITICAL: Preserve ALL tool properties when creating function entries:**

| MCP tools/list Output | Plugin Manifest (`functions[]`) |
|---|---|
| `name` | `name` — copy EXACTLY, do not rename |
| `description` | `description` — use the **full** description text, do NOT abbreviate or summarize |
| `inputSchema` | Do NOT add to `functions[]` — this goes in `mcp_tool_description.tools[]` only |
| **Any other property** (`annotations`, `execution`, `_meta`, `outputSchema`, `title`, or any future field) | Do NOT add to `functions[]` — this goes in `mcp_tool_description.tools[]` only |

> **🔑 Full-fidelity rule:** Every tool object in `mcp_tool_description.tools[]` must be a **verbatim copy** of the corresponding tool from the tools/list response. Copy the entire object as-is — do NOT strip, rename, reorder, or omit any property. The MCP protocol evolves and servers may return fields not listed above. If the server returns it, the plugin must include it.

**Why this matters:** The model uses `description` from functions to decide when to invoke each tool. The runtime uses the full tool definitions from `mcp_tool_description.tools[]` to actually call the MCP server. These definitions include `inputSchema` (parameters), `annotations` (read-only/destructive hints), `execution` (task support behavior), `_meta` (UI widget resources), and potentially other properties. Stripping any of them breaks runtime behavior or loses capabilities. Do not duplicate schema data in both places — only `name` and `description` go into `functions[]`.

### Step 4b: Add Response Semantics

**ALWAYS** add `capabilities.response_semantics` to every function — even if no title or URL fields can be identified. Never omit it.

For each tool:
1. Check the tool's `outputSchema` field (optional in MCP — present on some servers). If present, read field names from it directly.
2. If `outputSchema` is absent (common), reason from the tool's `description` text to identify which fields are returned. Look for mentions of URL fields (`url`, `link`, `href`) and title fields (`title`, `name`, `label`).
3. If you can confidently identify BOTH a title-like field AND a navigable URL field → use the **rich pattern**.
4. Otherwise → use the **default pattern**.

**Rich pattern** (when title + URL field are identified):
```json
{
  "name": "tool_name",
  "description": "...",
  "capabilities": {
    "response_semantics": {
      "data_path": "$.items",
      "properties": {
        "title": "$.title",
        "url": "$.url"
      },
      "static_template": {
        "type": "AdaptiveCard",
        "$schema": "https://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.6",
        "body": [
          {
            "type": "TextBlock",
            "text": "[${title}](${url})",
            "wrap": true,
            "maxLines": 2
          }
        ]
      }
    }
  }
}
```

**Default pattern** (when title or URL cannot be confidently identified):
```json
{
  "name": "tool_name",
  "description": "...",
  "capabilities": {
    "response_semantics": {
      "data_path": "$",
      "properties": {},
      "static_template": {
        "type": "AdaptiveCard",
        "$schema": "https://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.6",
        "body": [
          {
            "type": "TextBlock",
            "text": "${if(title, title, description)}",
            "wrap": true
          }
        ]
      }
    }
  }
}
```

**Response semantics rules:**
- `$schema`: always `https://adaptivecards.io/schemas/adaptive-card.json` (not `http://`)
- `version`: always `"1.6"`
- Rich template body is always `"[${title}](${url})"` — the title IS the hyperlink
- Source name comes from `name_for_human` automatically — do NOT add it as a TextBlock
- `data_path` and field paths are connector-specific — derive them from the tool's actual response structure

### Step 5: Logo Images (Optional)

Logos are **not mandatory**. The default logos from `npx -y --package @microsoft/m365agentstoolkit-cli atk new` work fine. Ask the user casually:

> "Would you like to use a custom logo for [name], or is the default fine?"

If the user **does not** have a logo or says to skip → **move on**. Do NOT block the workflow for logos.

If the user **does** want a custom logo, they need two **PNG** files (no JPG, SVG, or other formats):

- **`color.png`** — 192×192 px, full colour
- **`outline.png`** — 32×32 px, white-on-transparent

**Resolving logo inputs — check in this order:**

1. **URL**: If the user provides a URL, download the image with `curl -L -o <tempfile> <url>`.
2. **Local file path**: If the user provides a path, use it directly.

**If the provided image is not PNG, convert it to PNG before processing.**

**Handling missing formats:**
- If the user provides only one image, ask: "I have your [color/outline] logo. For the [other format], would you like to provide it, or shall I generate it automatically?"
- If the user says to generate it, derive it from the provided image using jimp.
- If the user says the provided images already meet the size requirements, skip processing and use them directly.

**Processing with jimp** (only when resizing or conversion is needed):

```javascript
// Install: npm install jimp (in a temp directory)
// Import: const { Jimp } = require('jimp');

// color.png: resize to 192x192
// outline.png: resize to 32x32, convert all non-transparent pixels to white on transparent background
```

Output files: `appPackage/color.png` (192×192) and `appPackage/outline.png` (32×32 white-on-transparent).

Show the resulting icon(s) to the user for approval before proceeding. If the user rejects, ask them to provide their own images and do NOT proceed until approved.

### Step 6: Configure the Runtime

Add the `RemoteMCPServer` runtime with the tools inlined in `mcp_tool_description.tools`:

**For authenticated servers** (see [authentication.md](authentication.md)):
```json
{
  "runtimes": [
    {
      "type": "RemoteMCPServer",
      "auth": {
        "type": "OAuthPluginVault",
        "reference_id": "${{<PREFIX>_MCP_AUTH_ID}}"
      },
      "spec": {
        "url": "{MCP_SERVER_URL}",
        "mcp_tool_description": {
          "tools": [
            {
              "name": "function_name_1",
              "description": "Full tool description from tools/list output",
              "inputSchema": {
                "type": "object",
                "properties": { "..." : "..." },
                "required": ["..."]
              },
              "annotations": { "readOnlyHint": true },
              "execution": { "taskSupport": "forbidden" },
              "_meta": { "ui": { "resourceUri": "ui://namespace/view.html" } }
            }
          ]
        }
      },
      "run_for_functions": [
        "function_name_1",
        "function_name_2"
      ]
    }
  ]
}
```

**For unauthenticated servers:**
```json
{
  "runtimes": [
    {
      "type": "RemoteMCPServer",
      "auth": {
        "type": "None"
      },
      "spec": {
        "url": "{MCP_SERVER_URL}",
        "mcp_tool_description": {
          "tools": [ ... ]
        }
      },
      "run_for_functions": [ ... ]
    }
  ]
}
```

> **⚠️ IMPORTANT:**
> - The `mcp_tool_description.tools` array must be a **verbatim copy** of the tools from the tools/list output (Step 3). Copy every property on each tool object exactly as returned — `inputSchema`, `annotations`, `execution`, `_meta`, and any other field the server includes. Do NOT strip, rename, or omit any property. Do NOT use a `file` reference — inline the tools directly.
> - Do NOT fabricate properties that the server did not return. Only include what tools/list actually gives you.
> - For authenticated servers, both `m365agents.yml` and `m365agents.local.yml` must include the `oauth/register` step — see [authentication.md](authentication.md).

### Step 7: Register Plugin in Agent Manifest

Add the plugin to your `declarative-agent.json`:

```json
{
  "actions": [
    {
      "id": "mcpPlugin",
      "file": "{name}-plugin.json"
    }
  ]
}
```

---

## Complete Workflow Checklist

```
□ Step 0: Scaffold agent project with `npx -y --package @microsoft/m365agentstoolkit-cli atk new` (if not already scaffolded)      ← MANDATORY
□ Step 1: Get MCP server URL from user
□ Step 2: Detect authentication requirements (probe well-known endpoints)
□       → If OAuth: follow authentication.md (discover endpoints, get creds, configure oauth/register)
□ Step 3: Discover tools via MCP protocol (initialize → tools/list)               ← MANDATORY
□       → Include ALL tools (do not filter unless developer explicitly requests it)
□ Step 4: Create {name}-plugin.json with functions + response_semantics
□ Step 5: Ask user about custom logo (optional — skip if user declines)
□ Step 6: Add runtime with RemoteMCPServer type (OAuthPluginVault or None)
□ Step 7: Register plugin in declarativeAgent.json
□ Step 8: Run npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local --interactive false
```

---

## Complete Example — Unauthenticated Server

For the Zava Insurance MCP server at `https://zava-insurance-mcp.azurewebsites.net/mcp`:

### `appPackage/zava-plugin.json`

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/copilot/plugin/v2.4/schema.json",
  "schema_version": "v2.4",
  "name_for_human": "Zava Insurance",
  "description_for_human": "Manage insurance claims, inspections, contractors, and purchase orders",
  "namespace": "zavainsurance",
  "functions": [
    {
      "name": "show-claims-dashboard",
      "description": "Displays the Zava Insurance claims dashboard showing all claims with status overview, filters, and summary metrics. Supports filtering by status and/or policy holder name. When the user mentions a person's name, first name, last name, or partial name, always pass it as the policyHolderName parameter. The name filter is case-insensitive and supports partial matches.",
      "capabilities": { "response_semantics": { "data_path": "$", "properties": {}, "static_template": { "type": "AdaptiveCard", "$schema": "https://adaptivecards.io/schemas/adaptive-card.json", "version": "1.6", "body": [{ "type": "TextBlock", "text": "${if(title, title, description)}", "wrap": true }] } } }
    },
    {
      "name": "show-claim-detail",
      "description": "Displays detailed information about a specific insurance claim including related inspections, purchase orders, and contractor assignments. Use claim ID (e.g. '1', '2') or claim number (e.g. 'CN202504990').",
      "capabilities": { "response_semantics": { "data_path": "$", "properties": {}, "static_template": { "type": "AdaptiveCard", "$schema": "https://adaptivecards.io/schemas/adaptive-card.json", "version": "1.6", "body": [{ "type": "TextBlock", "text": "${if(title, title, description)}", "wrap": true }] } } }
    },
    {
      "name": "show-contractors",
      "description": "Displays the list of contractors available for insurance repair work. Optionally filter by specialty or preferred status.",
      "capabilities": { "response_semantics": { "data_path": "$", "properties": {}, "static_template": { "type": "AdaptiveCard", "$schema": "https://adaptivecards.io/schemas/adaptive-card.json", "version": "1.6", "body": [{ "type": "TextBlock", "text": "${if(title, title, description)}", "wrap": true }] } } }
    },
    {
      "name": "update-claim-status",
      "description": "Updates the status of an insurance claim. Use claim ID (e.g. '1', '2').",
      "capabilities": { "response_semantics": { "data_path": "$", "properties": {}, "static_template": { "type": "AdaptiveCard", "$schema": "https://adaptivecards.io/schemas/adaptive-card.json", "version": "1.6", "body": [{ "type": "TextBlock", "text": "${if(title, title, description)}", "wrap": true }] } } }
    },
    {
      "name": "update-inspection",
      "description": "Updates an inspection record — status, findings, recommended actions, property, or inspector assignment.",
      "capabilities": { "response_semantics": { "data_path": "$", "properties": {}, "static_template": { "type": "AdaptiveCard", "$schema": "https://adaptivecards.io/schemas/adaptive-card.json", "version": "1.6", "body": [{ "type": "TextBlock", "text": "${if(title, title, description)}", "wrap": true }] } } }
    },
    {
      "name": "update-purchase-order",
      "description": "Updates a purchase order status (e.g. approve, reject, complete).",
      "capabilities": { "response_semantics": { "data_path": "$", "properties": {}, "static_template": { "type": "AdaptiveCard", "$schema": "https://adaptivecards.io/schemas/adaptive-card.json", "version": "1.6", "body": [{ "type": "TextBlock", "text": "${if(title, title, description)}", "wrap": true }] } } }
    },
    {
      "name": "get-claim-summary",
      "description": "Returns a text summary for a specific claim with key details. Use claim ID or claim number.",
      "capabilities": { "response_semantics": { "data_path": "$", "properties": {}, "static_template": { "type": "AdaptiveCard", "$schema": "https://adaptivecards.io/schemas/adaptive-card.json", "version": "1.6", "body": [{ "type": "TextBlock", "text": "${if(title, title, description)}", "wrap": true }] } } }
    },
    {
      "name": "create-inspection",
      "description": "Creates a new inspection record. Only claimNumber is required. ID is auto-generated, status defaults to 'open'. claimId is optional.",
      "capabilities": { "response_semantics": { "data_path": "$", "properties": {}, "static_template": { "type": "AdaptiveCard", "$schema": "https://adaptivecards.io/schemas/adaptive-card.json", "version": "1.6", "body": [{ "type": "TextBlock", "text": "${if(title, title, description)}", "wrap": true }] } } }
    },
    {
      "name": "list-inspectors",
      "description": "Lists all available inspectors with their specializations.",
      "capabilities": { "response_semantics": { "data_path": "$", "properties": {}, "static_template": { "type": "AdaptiveCard", "$schema": "https://adaptivecards.io/schemas/adaptive-card.json", "version": "1.6", "body": [{ "type": "TextBlock", "text": "${if(title, title, description)}", "wrap": true }] } } }
    }
  ],
  "runtimes": [
    {
      "type": "RemoteMCPServer",
      "auth": { "type": "None" },
      "spec": {
        "url": "https://zava-insurance-mcp.azurewebsites.net/mcp",
        "mcp_tool_description": {
          "tools": [
            {
              "name": "show-claims-dashboard",
              "description": "Displays the Zava Insurance claims dashboard showing all claims with status overview, filters, and summary metrics. Supports filtering by status and/or policy holder name. When the user mentions a person's name, first name, last name, or partial name, always pass it as the policyHolderName parameter. The name filter is case-insensitive and supports partial matches.",
              "inputSchema": { "type": "object", "properties": { "status": { "type": "string", "description": "Filter claims by status keyword (e.g. 'Open', 'Approved', 'Pending', 'Denied', 'Closed')" }, "policyHolderName": { "type": "string", "description": "Filter claims by policy holder name. Supports partial, case-insensitive matching." } }, "additionalProperties": false },
              "annotations": { "readOnlyHint": true },
              "execution": { "taskSupport": "forbidden" },
              "_meta": { "ui": { "resourceUri": "ui://zava/claims-dashboard.html" } }
            },
            {
              "name": "show-claim-detail",
              "description": "Displays detailed information about a specific insurance claim including related inspections, purchase orders, and contractor assignments. Use claim ID (e.g. '1', '2') or claim number (e.g. 'CN202504990').",
              "inputSchema": { "type": "object", "properties": { "claimId": { "type": "string", "description": "The claim ID or claim number to look up" } }, "required": ["claimId"], "additionalProperties": false },
              "annotations": { "readOnlyHint": true },
              "execution": { "taskSupport": "forbidden" },
              "_meta": { "ui": { "resourceUri": "ui://zava/claim-detail.html" } }
            },
            {
              "name": "show-contractors",
              "description": "Displays the list of contractors available for insurance repair work. Optionally filter by specialty or preferred status.",
              "inputSchema": { "type": "object", "properties": { "specialty": { "type": "string", "description": "Filter by contractor specialty (e.g. 'Roofing', 'Water Damage', 'Fire')" }, "preferredOnly": { "type": "boolean", "description": "Show only preferred contractors" } }, "additionalProperties": false },
              "annotations": { "readOnlyHint": true },
              "execution": { "taskSupport": "forbidden" },
              "_meta": { "ui": { "resourceUri": "ui://zava/contractors-list.html" } }
            },
            {
              "name": "update-claim-status",
              "description": "Updates the status of an insurance claim. Use claim ID (e.g. '1', '2').",
              "inputSchema": { "type": "object", "properties": { "claimId": { "type": "string", "description": "The claim ID" }, "status": { "type": "string", "description": "New status (e.g. 'Approved', 'Denied', 'Closed', 'Open - Under Investigation')" }, "note": { "type": "string", "description": "Optional note to add to the claim" } }, "required": ["claimId", "status"], "additionalProperties": false },
              "execution": { "taskSupport": "forbidden" }
            },
            {
              "name": "update-inspection",
              "description": "Updates an inspection record — status, findings, recommended actions, property, or inspector assignment.",
              "inputSchema": { "type": "object", "properties": { "inspectionId": { "type": "string", "description": "The inspection ID (e.g. 'insp-001')" }, "status": { "type": "string", "description": "New status (e.g. 'completed', 'scheduled', 'in-progress', 'cancelled')" }, "findings": { "type": "string", "description": "Updated findings text" }, "recommendedActions": { "type": "array", "items": { "type": "string" }, "description": "Updated recommended actions" }, "property": { "type": "string", "description": "Updated property address" }, "inspectorId": { "type": "string", "description": "Inspector ID to assign (e.g. 'inspector-003')" } }, "required": ["inspectionId"], "additionalProperties": false },
              "execution": { "taskSupport": "forbidden" }
            },
            {
              "name": "update-purchase-order",
              "description": "Updates a purchase order status (e.g. approve, reject, complete).",
              "inputSchema": { "type": "object", "properties": { "purchaseOrderId": { "type": "string", "description": "The purchase order ID (e.g. 'po-001')" }, "status": { "type": "string", "description": "New status (e.g. 'approved', 'rejected', 'completed', 'in-progress')" }, "note": { "type": "string", "description": "Optional note to add" } }, "required": ["purchaseOrderId", "status"], "additionalProperties": false },
              "execution": { "taskSupport": "forbidden" }
            },
            {
              "name": "get-claim-summary",
              "description": "Returns a text summary for a specific claim with key details. Use claim ID or claim number.",
              "inputSchema": { "type": "object", "properties": { "claimId": { "type": "string", "description": "Claim ID or claim number" } }, "required": ["claimId"], "additionalProperties": false },
              "execution": { "taskSupport": "forbidden" }
            },
            {
              "name": "create-inspection",
              "description": "Creates a new inspection record. Only claimNumber is required. ID is auto-generated, status defaults to 'open'. claimId is optional.",
              "inputSchema": { "type": "object", "properties": { "claimNumber": { "type": "string", "description": "The claim number (e.g. 'CN202504990')" }, "claimId": { "type": "string", "description": "Optional claim ID" }, "taskType": { "type": "string", "description": "Type of inspection: 'initial', 're-inspection', 'final'. Defaults to 'initial'" }, "priority": { "type": "string", "description": "Priority: 'low', 'medium', 'high'. Defaults to 'medium'" }, "status": { "type": "string", "description": "Status. Defaults to 'open'" }, "scheduledDate": { "type": "string", "description": "Scheduled date (ISO string)" }, "inspectorId": { "type": "string", "description": "Inspector ID to assign" }, "property": { "type": "string", "description": "Property address" }, "instructions": { "type": "string", "description": "Inspection instructions" } }, "required": ["claimNumber"], "additionalProperties": false },
              "execution": { "taskSupport": "forbidden" }
            },
            {
              "name": "list-inspectors",
              "description": "Lists all available inspectors with their specializations.",
              "inputSchema": { "type": "object", "properties": {} },
              "execution": { "taskSupport": "forbidden" }
            }
          ]
        }
      },
      "run_for_functions": [
        "show-claims-dashboard",
        "show-claim-detail",
        "show-contractors",
        "update-claim-status",
        "update-inspection",
        "update-purchase-order",
        "get-claim-summary",
        "create-inspection",
        "list-inspectors"
      ]
    }
  ]
}
```

> **Note how tools with UI widgets** (e.g., `show-claims-dashboard`, `show-claim-detail`, `show-contractors`) include `annotations`, `execution`, AND `_meta` with `resourceUri` — all copied verbatim from the tools/list response. Tools without UI (e.g., `update-claim-status`) still include `execution` when the server returned it, but omit `annotations` and `_meta` since the server didn't provide them.

Register in `declarative-agent.json`: `{ "actions": [{ "id": "zavaPlugin", "file": "zava-plugin.json" }] }`

---

## Complete Example — Authenticated Server

For an OAuth-protected MCP server at `https://mcp.example.com/mcp`. See [authentication.md](authentication.md) for the full `oauth/register` template (must be added to both `m365agents.yml` and `m365agents.local.yml`).

### `appPackage/example-plugin.json`

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/copilot/plugin/v2.4/schema.json",
  "schema_version": "v2.4",
  "name_for_human": "Example Service",
  "description_for_human": "Search and browse Example Service content",
  "namespace": "example",
  "functions": [
    {
      "name": "search",
      "description": "Search Example Service for content matching a query.",
      "capabilities": { "response_semantics": { "data_path": "$.items", "properties": { "title": "$.title", "url": "$.url" }, "static_template": { "type": "AdaptiveCard", "$schema": "https://adaptivecards.io/schemas/adaptive-card.json", "version": "1.6", "body": [{ "type": "TextBlock", "text": "[${title}](${url})", "wrap": true, "maxLines": 2 }] } } }
    }
  ],
  "runtimes": [
    {
      "type": "RemoteMCPServer",
      "auth": { "type": "OAuthPluginVault", "reference_id": "${{<PREFIX>_MCP_AUTH_ID}}" },
      "spec": {
        "url": "https://mcp.example.com/mcp",
        "mcp_tool_description": {
          "tools": [
            { "name": "search", "description": "Search Example Service for content matching a query.", "inputSchema": { "type": "object", "properties": { "query": { "description": "Search query", "type": "string" } }, "required": ["query"] } }
          ]
        }
      },
      "run_for_functions": ["search"]
    }
  ]
}
```

---

## Multiple MCP Servers

You can integrate multiple MCP servers by adding multiple runtimes, each with its own auth type. Each runtime has its own `mcp_tool_description.tools` and `run_for_functions`:

```json
{
  "functions": [
    { "name": "docs_search", "description": "Search Microsoft docs.", "capabilities": { "response_semantics": { "data_path": "$", "properties": {}, "static_template": { "type": "AdaptiveCard", "$schema": "https://adaptivecards.io/schemas/adaptive-card.json", "version": "1.6", "body": [{ "type": "TextBlock", "text": "${if(title, title, description)}", "wrap": true }] } } } },
    { "name": "search", "description": "Search authenticated service.", "capabilities": { "response_semantics": { "data_path": "$", "properties": {}, "static_template": { "type": "AdaptiveCard", "$schema": "https://adaptivecards.io/schemas/adaptive-card.json", "version": "1.6", "body": [{ "type": "TextBlock", "text": "${if(title, title, description)}", "wrap": true }] } } } }
  ],
  "runtimes": [
    {
      "type": "RemoteMCPServer",
      "auth": { "type": "None" },
      "spec": { "url": "https://learn.microsoft.com/api/mcp", "mcp_tool_description": { "tools": [{ "name": "docs_search", "description": "Search Microsoft docs.", "inputSchema": { "type": "object", "properties": { "query": { "type": "string" } }, "required": ["query"] } }] } },
      "run_for_functions": ["docs_search"]
    },
    {
      "type": "RemoteMCPServer",
      "auth": { "type": "OAuthPluginVault", "reference_id": "${{<PREFIX>_MCP_AUTH_ID}}" },
      "spec": { "url": "https://mcp.example.com/mcp", "mcp_tool_description": { "tools": [{ "name": "search", "description": "Search authenticated service.", "inputSchema": { "type": "object", "properties": { "query": { "type": "string" } }, "required": ["query"] } }] } },
      "run_for_functions": ["search"]
    }
  ]
}
```

---

## Common Issues

| Issue | Solution |
|---|---|
| Plugin fails to load | Verify `{name}-plugin.json` exists and has correct `mcp_tool_description.tools` array |
| Tools not recognized | Verify function names match exactly between `functions[]` and `mcp_tool_description.tools[]` |
| Runtime errors | Check that `run_for_functions` includes all functions using that runtime |
| OAuth token errors | Re-authenticate with `mcp-remote` — cached tokens may have expired |
| `<PREFIX>_MCP_AUTH_ID` empty | Check `oauth/register` step in both `m365agents.yml` and `m365agents.local.yml` and verify credentials |
| "Invalid redirect URI" | Ensure redirect URI in DCR is `https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect` |

---

## Best Practices

1. **Always discover tools via MCP protocol** — run the full handshake (initialize → notifications/initialized → tools/list) before writing the plugin manifest. **NEVER fabricate tool names or descriptions.**
2. **Full-fidelity tool copying in `mcp_tool_description.tools`** — each tool object must be a verbatim copy of the tools/list output. Copy every property exactly as returned (`inputSchema`, `annotations`, `execution`, `_meta`, `outputSchema`, `title`, and any other field). The MCP protocol evolves — do NOT maintain a hardcoded allowlist of known fields. If the server returns it, the plugin must include it. Never abbreviate, omit, or rename properties. Do NOT duplicate `inputSchema` or other properties in `functions[]`.
3. **Inline tools in `mcp_tool_description.tools`** — do NOT use a separate tools file; embed the tools array directly in the runtime spec
4. **Match function names exactly** — copy tool names directly from the tools/list output
5. **Always add response semantics** — every function must have `capabilities.response_semantics`, even if using the default (empty body) pattern
6. **Include all tools by default** — inline every tool from `tools/list` unless the developer explicitly asks to limit the set; for all included tools always keep the complete tool object with all properties
7. **Logos are optional** — ask the user if they want a custom logo; if not, use the defaults from `npx -y --package @microsoft/m365agentstoolkit-cli atk new`. Logos must be **PNG only** (no JPG, SVG, etc.)
