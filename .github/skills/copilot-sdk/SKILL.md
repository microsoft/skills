---
name: copilot-sdk
description: Build applications powered by GitHub Copilot using the Copilot SDK. Use when creating programmatic integrations with Copilot across Node.js/TypeScript, Python, Go, or .NET. Covers session management, custom tools, streaming, hooks, MCP servers, BYOK providers, session persistence, custom agents, skills, and deployment patterns. Requires GitHub Copilot CLI installed and a GitHub Copilot subscription (unless using BYOK).
---

# GitHub Copilot SDK

Build applications that programmatically interact with GitHub Copilot. The SDK wraps the Copilot CLI via JSON-RPC, providing session management, custom tools, hooks, MCP server integration, and streaming across Node.js, Python, Go, and .NET.

## Prerequisites

- **GitHub Copilot CLI** installed and authenticated (`copilot --version`)
- **GitHub Copilot subscription** (Individual, Business, or Enterprise) — not required for BYOK
- **Runtime:** Node.js 18+ / Python 3.8+ / Go 1.21+ / .NET 8.0+

## Installation

| Language | Package | Install |
|----------|---------|---------|
| Node.js | `@github/copilot-sdk` | `npm install @github/copilot-sdk` |
| Python | `github-copilot-sdk` | `pip install github-copilot-sdk` |
| Go | `github.com/github/copilot-sdk/go` | `go get github.com/github/copilot-sdk/go` |
| .NET | `GitHub.Copilot.SDK` | `dotnet add package GitHub.Copilot.SDK` |

## Architecture

The SDK communicates with the Copilot CLI via JSON-RPC over stdio (default) or TCP. The CLI manages model calls, tool execution, session state, and MCP server lifecycle.

```
Your App → SDK Client → [stdio/TCP] → Copilot CLI → Model Provider
                                          ↕
                                     MCP Servers
```

**Transport modes:**

| Mode | Description | Use Case |
|------|-------------|----------|
| **Stdio** (default) | CLI as subprocess via pipes | Local dev, single process |
| **TCP** | CLI as network server | Multi-client, backend services |

---

## Core Pattern: Client → Session → Message

All SDK usage follows: create a client, create a session, send messages.

### Node.js / TypeScript

```typescript
import { CopilotClient } from "@github/copilot-sdk";

const client = new CopilotClient();
const session = await client.createSession({ model: "gpt-4.1" });

const response = await session.sendAndWait({ prompt: "What is 2 + 2?" });
console.log(response?.data.content);

await client.stop();
```

### Python

```python
import asyncio
from copilot import CopilotClient

async def main():
    client = CopilotClient()
    await client.start()
    session = await client.create_session({"model": "gpt-4.1"})
    response = await session.send_and_wait({"prompt": "What is 2 + 2?"})
    print(response.data.content)
    await client.stop()

asyncio.run(main())
```

### Go

```go
client := copilot.NewClient(nil)
if err := client.Start(ctx); err != nil { log.Fatal(err) }
defer client.Stop()

session, _ := client.CreateSession(ctx, &copilot.SessionConfig{Model: "gpt-4.1"})
response, _ := session.SendAndWait(ctx, copilot.MessageOptions{Prompt: "What is 2 + 2?"})
fmt.Println(*response.Data.Content)
```

### .NET

```csharp
await using var client = new CopilotClient();
await using var session = await client.CreateSessionAsync(new SessionConfig { Model = "gpt-4.1" });
var response = await session.SendAndWaitAsync(new MessageOptions { Prompt = "What is 2 + 2?" });
Console.WriteLine(response?.Data.Content);
```

---

## Streaming Responses

Enable real-time output by setting `streaming: true` and subscribing to delta events.

### Node.js

```typescript
const session = await client.createSession({ model: "gpt-4.1", streaming: true });

session.on("assistant.message_delta", (event) => {
    process.stdout.write(event.data.deltaContent);
});
session.on("session.idle", () => console.log());

await session.sendAndWait({ prompt: "Tell me a joke" });
```

### Python

```python
from copilot.generated.session_events import SessionEventType

session = await client.create_session({"model": "gpt-4.1", "streaming": True})

def handle_event(event):
    if event.type == SessionEventType.ASSISTANT_MESSAGE_DELTA:
        sys.stdout.write(event.data.delta_content)
        sys.stdout.flush()
    if event.type == SessionEventType.SESSION_IDLE:
        print()

session.on(handle_event)
await session.send_and_wait({"prompt": "Tell me a joke"})
```

### Event Subscription

| Method | Description |
|--------|-------------|
| `on(handler)` | Subscribe to all events; returns unsubscribe function |
| `on(eventType, handler)` | Subscribe to specific event type (Node.js only) |

Call the returned function to unsubscribe. In .NET, call `.Dispose()` on the returned disposable.

---

## Custom Tools

Define tools that Copilot can call to extend its capabilities.

### Node.js

```typescript
import { CopilotClient, defineTool } from "@github/copilot-sdk";

const getWeather = defineTool("get_weather", {
    description: "Get the current weather for a city",
    parameters: {
        type: "object",
        properties: { city: { type: "string", description: "The city name" } },
        required: ["city"],
    },
    handler: async ({ city }) => ({ city, temperature: "72°F", condition: "sunny" }),
});

const session = await client.createSession({
    model: "gpt-4.1",
    tools: [getWeather],
});
```

### Python

```python
from copilot.tools import define_tool
from pydantic import BaseModel, Field

class GetWeatherParams(BaseModel):
    city: str = Field(description="The city name")

@define_tool(description="Get the current weather for a city")
async def get_weather(params: GetWeatherParams) -> dict:
    return {"city": params.city, "temperature": "72°F", "condition": "sunny"}

session = await client.create_session({"model": "gpt-4.1", "tools": [get_weather]})
```

### Go

```go
type WeatherParams struct {
    City string `json:"city" jsonschema:"The city name"`
}

getWeather := copilot.DefineTool("get_weather", "Get weather for a city",
    func(params WeatherParams, inv copilot.ToolInvocation) (WeatherResult, error) {
        return WeatherResult{City: params.City, Temperature: "72°F"}, nil
    },
)

session, _ := client.CreateSession(ctx, &copilot.SessionConfig{
    Model: "gpt-4.1",
    Tools: []copilot.Tool{getWeather},
})
```

### .NET

```csharp
using Microsoft.Extensions.AI;
using System.ComponentModel;

var getWeather = AIFunctionFactory.Create(
    ([Description("The city name")] string city) => new { city, temperature = "72°F" },
    "get_weather", "Get the current weather for a city");

await using var session = await client.CreateSessionAsync(new SessionConfig {
    Model = "gpt-4.1", Tools = [getWeather],
});
```

### Tool Requirements

- Handler must return JSON-serializable data (not `undefined`)
- Parameters must follow JSON Schema format
- Tool description should clearly state when the tool should be used

---

## Hooks

Intercept and customize session behavior at key lifecycle points.

| Hook | Trigger | Use Case |
|------|---------|----------|
| `onPreToolUse` | Before tool executes | Permission control, argument modification |
| `onPostToolUse` | After tool executes | Result transformation, logging, redaction |
| `onUserPromptSubmitted` | User sends message | Prompt modification, filtering, context injection |
| `onSessionStart` | Session begins (new or resumed) | Add context, configure session |
| `onSessionEnd` | Session ends | Cleanup, analytics, metrics |
| `onErrorOccurred` | Error happens | Custom error handling, retry logic, monitoring |

### Pre-Tool Use Hook

Control tool permissions, modify arguments, or inject context before tool execution.

```typescript
const session = await client.createSession({
    hooks: {
        onPreToolUse: async (input) => {
            if (["shell", "bash"].includes(input.toolName)) {
                return { permissionDecision: "deny", permissionDecisionReason: "Shell access not permitted" };
            }
            return { permissionDecision: "allow" };
        },
    },
});
```

**Input fields:** `timestamp`, `cwd`, `toolName`, `toolArgs`

**Output fields:**

| Field | Type | Description |
|-------|------|-------------|
| `permissionDecision` | `"allow"` \| `"deny"` \| `"ask"` | Whether to allow the tool call |
| `permissionDecisionReason` | string | Explanation for deny/ask |
| `modifiedArgs` | object | Modified arguments to pass |
| `additionalContext` | string | Extra context for conversation |
| `suppressOutput` | boolean | Hide tool output from conversation |

### Post-Tool Use Hook

Transform results, redact sensitive data, or log tool activity after execution.

```typescript
hooks: {
    onPostToolUse: async (input) => {
        // Redact sensitive data from results
        if (typeof input.toolResult === "string") {
            let redacted = input.toolResult;
            for (const pattern of SENSITIVE_PATTERNS) {
                redacted = redacted.replace(pattern, "[REDACTED]");
            }
            if (redacted !== input.toolResult) {
                return { modifiedResult: redacted };
            }
        }
        return null; // Pass through unchanged
    },
}
```

**Output fields:** `modifiedResult`, `additionalContext`, `suppressOutput`

### User Prompt Submitted Hook

Modify or enhance user prompts before processing. Useful for prompt templates, context injection, and input validation.

```typescript
hooks: {
    onUserPromptSubmitted: async (input) => {
        return {
            modifiedPrompt: `[User from engineering team] ${input.prompt}`,
            additionalContext: "Follow company coding standards.",
        };
    },
}
```

**Output fields:** `modifiedPrompt`, `additionalContext`, `suppressOutput`

### Session Lifecycle Hooks

```typescript
hooks: {
    onSessionStart: async (input, invocation) => {
        // input.source: "startup" | "resume" | "new"
        console.log(`Session ${invocation.sessionId} started (${input.source})`);
        return { additionalContext: "Project uses TypeScript and React." };
    },
    onSessionEnd: async (input, invocation) => {
        // input.reason: "complete" | "error" | "abort" | "timeout" | "user_exit"
        await recordMetrics({ sessionId: invocation.sessionId, reason: input.reason });
        return null;
    },
}
```

### Error Handling Hook

```typescript
hooks: {
    onErrorOccurred: async (input) => {
        // input.errorContext: "model_call" | "tool_execution" | "system" | "user_input"
        // input.recoverable: boolean
        if (input.errorContext === "model_call" && input.error.includes("rate")) {
            return { errorHandling: "retry", retryCount: 3, userNotification: "Rate limited. Retrying..." };
        }
        return null; // Default error handling
    },
}
```

**Output fields:** `suppressOutput`, `errorHandling` (`"retry"` | `"skip"` | `"abort"`), `retryCount`, `userNotification`

### Python Hook Example

```python
async def on_pre_tool_use(input_data, invocation):
    if input_data["toolName"] in ["shell", "bash"]:
        return {"permissionDecision": "deny", "permissionDecisionReason": "Not permitted"}
    return {"permissionDecision": "allow"}

session = await client.create_session({
    "hooks": {"on_pre_tool_use": on_pre_tool_use}
})
```

### Go Hook Example

```go
session, _ := client.CreateSession(ctx, &copilot.SessionConfig{
    Hooks: &copilot.SessionHooks{
        OnPreToolUse: func(input copilot.PreToolUseHookInput, inv copilot.HookInvocation) (*copilot.PreToolUseHookOutput, error) {
            return &copilot.PreToolUseHookOutput{PermissionDecision: "allow"}, nil
        },
    },
})
```

---

## MCP Server Integration

Connect to MCP (Model Context Protocol) servers for pre-built tool capabilities.

### Local Stdio Server

```typescript
const session = await client.createSession({
    mcpServers: {
        filesystem: {
            type: "local",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"],
            tools: ["*"],
            env: { DEBUG: "true" },
            cwd: "./servers",
            timeout: 30000,
        },
    },
});
```

### Remote HTTP Server

```typescript
const session = await client.createSession({
    mcpServers: {
        github: {
            type: "http",
            url: "https://api.githubcopilot.com/mcp/",
            headers: { Authorization: "Bearer ${TOKEN}" },
            tools: ["*"],
        },
    },
});
```

### MCP Config Fields

**Local/Stdio:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"local"` | No | Defaults to local |
| `command` | string | Yes | Executable path |
| `args` | string[] | Yes | Command arguments |
| `env` | object | No | Environment variables |
| `cwd` | string | No | Working directory |
| `tools` | string[] | No | `["*"]` for all, `[]` for none |
| `timeout` | number | No | Timeout in milliseconds |

**Remote HTTP:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"http"` | Yes | Server type |
| `url` | string | Yes | Server URL |
| `headers` | object | No | HTTP headers |
| `tools` | string[] | No | Tool filter |
| `timeout` | number | No | Timeout in ms |

### MCP Debugging

Test MCP servers independently before integrating:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | /path/to/your/mcp-server
```

Use the MCP Inspector for interactive debugging:

```bash
npx @modelcontextprotocol/inspector /path/to/your/mcp-server
```

**Common MCP issues:**
- Tools not appearing → Set `tools: ["*"]` and verify server responds to `tools/list`
- Server not starting → Use absolute command paths, check `cwd`
- Stdout pollution → Debug output must go to stderr, not stdout

---

## Authentication

### Methods (Priority Order)

1. **Explicit token** — `githubToken` in constructor
2. **HMAC key** — `CAPI_HMAC_KEY` or `COPILOT_HMAC_KEY` env vars
3. **Direct API token** — `GITHUB_COPILOT_API_TOKEN` with `COPILOT_API_URL`
4. **Environment variables** — `COPILOT_GITHUB_TOKEN` → `GH_TOKEN` → `GITHUB_TOKEN`
5. **Stored OAuth** — From `copilot auth login`
6. **GitHub CLI** — `gh auth` credentials

### Programmatic Token

```typescript
const client = new CopilotClient({ githubToken: process.env.GITHUB_TOKEN });
```

### OAuth GitHub App

For multi-user apps where users sign in with GitHub:

```typescript
const client = new CopilotClient({
    githubToken: userAccessToken,    // gho_ or ghu_ token from OAuth flow
    useLoggedInUser: false,          // Don't use stored CLI credentials
});
```

**Supported token types:** `gho_` (OAuth), `ghu_` (GitHub App), `github_pat_` (fine-grained PAT).
**Not supported:** `ghp_` (classic PAT — deprecated).

### Disable Auto-Login

Prevent the SDK from using stored credentials:

```typescript
const client = new CopilotClient({ useLoggedInUser: false });
```

---

## BYOK (Bring Your Own Key)

Use your own API keys — no Copilot subscription required. The CLI acts as agent runtime only.

### Provider Configurations

**OpenAI:**
```typescript
provider: { type: "openai", baseUrl: "https://api.openai.com/v1", apiKey: process.env.OPENAI_API_KEY }
```

**Azure AI Foundry (OpenAI-compatible):**
```typescript
provider: {
    type: "openai",
    baseUrl: "https://your-resource.openai.azure.com/openai/v1/",
    apiKey: process.env.FOUNDRY_API_KEY,
    wireApi: "responses",  // Use "responses" for GPT-5 series, "completions" for others
}
```

**Azure OpenAI (native endpoint):**
```typescript
provider: {
    type: "azure",
    baseUrl: "https://my-resource.openai.azure.com",  // Just the host — no /openai/v1
    apiKey: process.env.AZURE_OPENAI_KEY,
    azure: { apiVersion: "2024-10-21" },
}
```

**Anthropic:**
```typescript
provider: { type: "anthropic", baseUrl: "https://api.anthropic.com", apiKey: process.env.ANTHROPIC_API_KEY }
```

**Ollama (local):**
```typescript
provider: { type: "openai", baseUrl: "http://localhost:11434/v1" }
```

**OrcaRouter (OpenAI-compatible gateway):**
```typescript
provider: { type: "openai", baseUrl: "https://api.orcarouter.ai/v1", apiKey: process.env.ORCAROUTER_API_KEY }
```

### Provider Config Reference

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"openai"` \| `"azure"` \| `"anthropic"` | Provider type |
| `baseUrl` | string | **Required.** API endpoint URL |
| `apiKey` | string | API key (optional for local providers) |
| `bearerToken` | string | Bearer token auth (takes precedence over apiKey) |
| `wireApi` | `"completions"` \| `"responses"` | API format (default: `"completions"`) |
| `azure.apiVersion` | string | Azure API version (default: `"2024-10-21"`) |

### Azure Managed Identity with BYOK

Use `DefaultAzureCredential` to get short-lived bearer tokens for Azure deployments:

```python
from azure.identity import DefaultAzureCredential
from copilot import CopilotClient, ProviderConfig, SessionConfig

credential = DefaultAzureCredential()
token = credential.get_token("https://cognitiveservices.azure.com/.default").token

session = await client.create_session(SessionConfig(
    model="gpt-4.1",
    provider=ProviderConfig(
        type="openai",
        base_url=f"{foundry_url}/openai/v1/",
        bearer_token=token,
        wire_api="responses",
    ),
))
```

> **Note:** Bearer tokens expire (~1 hour). For long-running apps, refresh the token before each new session. The SDK does not auto-refresh tokens.

### BYOK Limitations

- **Static credentials only** — no native Entra ID, OIDC, or managed identity support
- **No auto-refresh** — expired tokens require creating a new session
- **Keys not persisted** — must re-provide `provider` config on session resume
- **Model availability** — limited to what your provider offers

---

## Session Persistence

Resume sessions across restarts by providing your own session ID.

```typescript
// Create with explicit ID
const session = await client.createSession({
    sessionId: "user-123-task-456",
    model: "gpt-4.1",
});

// Resume later (even from a different client instance)
const resumed = await client.resumeSession("user-123-task-456");
await resumed.sendAndWait({ prompt: "What did we discuss?" });
```

### Session Management

```typescript
const sessions = await client.listSessions();           // List all
const lastId = await client.getLastSessionId();          // Get most recent
await client.deleteSession("user-123-task-456");         // Delete from storage
await session.destroy();                                 // Destroy active session
```

### Resume Options

When resuming, you can reconfigure: `model`, `systemMessage`, `availableTools`, `excludedTools`, `provider` (required for BYOK), `reasoningEffort`, `streaming`, `mcpServers`, `customAgents`, `skillDirectories`, `infiniteSessions`.

### Session ID Best Practices

| Pattern | Example | Use Case |
|---------|---------|----------|
| `user-{userId}-{taskId}` | `user-alice-pr-review-42` | Multi-user apps |
| `tenant-{tenantId}-{workflow}` | `tenant-acme-onboarding` | Multi-tenant SaaS |
| `{userId}-{taskType}-{timestamp}` | `alice-deploy-1706932800` | Time-based cleanup |

### What Gets Persisted

Session state is saved to `~/.copilot/session-state/{sessionId}/`:

| Data | Persisted? | Notes |
|------|------------|-------|
| Conversation history | ✅ Yes | Full message thread |
| Tool call results | ✅ Yes | Cached for context |
| Agent planning state | ✅ Yes | `plan.md` file |
| Session artifacts | ✅ Yes | In `files/` directory |
| Provider/API keys | ❌ No | Must re-provide on resume |
| In-memory tool state | ❌ No | Design tools to be stateless |

### Infinite Sessions

For long-running workflows that may exceed context limits, enable auto-compaction:

```typescript
const session = await client.createSession({
    infiniteSessions: {
        enabled: true,
        backgroundCompactionThreshold: 0.80,  // Start background compaction at 80%
        bufferExhaustionThreshold: 0.95,       // Block and compact at 95%
    },
});
```

> Thresholds are context utilization ratios (0.0–1.0), not absolute token counts.

---

## Custom Agents

Define specialized AI personas:

```typescript
const session = await client.createSession({
    customAgents: [{
        name: "pr-reviewer",
        displayName: "PR Reviewer",
        description: "Reviews pull requests for best practices",
        prompt: "You are an expert code reviewer. Focus on security, performance, and maintainability.",
    }],
});
```

---

## System Message

Control AI behavior and personality:

```typescript
const session = await client.createSession({
    systemMessage: { content: "You are a helpful assistant. Always be concise." },
});
```

---

## Skills Integration

Load skill directories to extend Copilot's capabilities:

```typescript
const session = await client.createSession({
    skillDirectories: ["./skills/code-review", "./skills/documentation"],
    disabledSkills: ["experimental-feature"],
});
```

Skills can be combined with custom agents and MCP servers:

```typescript
const session = await client.createSession({
    skillDirectories: ["./skills/security"],
    customAgents: [{ name: "auditor", prompt: "Focus on OWASP Top 10." }],
    mcpServers: { postgres: { type: "local", command: "npx", args: ["-y", "@modelcontextprotocol/server-postgres"], tools: ["*"] } },
});
```

---

## Permission & Input Handlers

Handle tool permissions and user input requests programmatically. The SDK uses a **deny-by-default** permission model — all permission requests are denied unless you provide a handler.

```typescript
const session = await client.createSession({
    onPermissionRequest: async (request) => {
        if (request.kind === "shell") {
            return { approved: request.command.startsWith("git") };
        }
        return { approved: true };
    },
    onUserInputRequest: async (request) => {
        return { response: "yes" };
    },
});
```

### Token Usage Tracking

Subscribe to usage events instead of using CLI `/usage`:

```typescript
session.on("assistant.usage", (event) => {
    console.log("Tokens:", { input: event.data.inputTokens, output: event.data.outputTokens });
});
```

---

## Deployment Patterns

### Local CLI (Default)

SDK auto-spawns CLI as subprocess. Simplest setup — zero configuration.

```typescript
const client = new CopilotClient(); // Auto-manages CLI process
```

### External CLI Server (Backend Services)

Run CLI in headless mode, connect SDK over TCP:

```bash
copilot --headless --port 4321
```

```typescript
const client = new CopilotClient({ cliUrl: "localhost:4321" });
```

**Multi-client support:** Multiple SDK clients can share one CLI server.

### Bundled CLI (Desktop Apps)

Ship CLI binary with your app:

```typescript
const client = new CopilotClient({ cliPath: path.join(__dirname, "vendor", "copilot") });
```

### Docker Compose

```yaml
services:
  copilot-cli:
    image: ghcr.io/github/copilot-cli:latest
    command: ["--headless", "--port", "4321"]
    environment:
      - COPILOT_GITHUB_TOKEN=${COPILOT_GITHUB_TOKEN}
    volumes:
      - session-data:/root/.copilot/session-state
  api:
    build: .
    environment:
      - CLI_URL=copilot-cli:4321
    depends_on: [copilot-cli]
volumes:
  session-data:
```

### Session Isolation Patterns

| Pattern | Isolation | Resources | Best For |
|---------|-----------|-----------|----------|
| **CLI per user** | Complete | High | Multi-tenant SaaS, compliance |
| **Shared CLI + session IDs** | Logical | Low | Internal tools |
| **Shared sessions** | None | Low | Team collaboration (requires locking) |

### Production Checklist

- Session cleanup: periodic deletion of expired sessions
- Health checks: ping CLI server, restart if unresponsive
- Persistent storage: mount `~/.copilot/session-state/` for containers
- Secret management: use Vault/K8s Secrets for tokens
- Session locking: Redis or similar for shared session access
- Graceful shutdown: drain active sessions before stopping CLI

---

## Client Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cliPath` | string | Auto-detected | Path to Copilot CLI executable |
| `cliUrl` | string | — | URL of external CLI server |
| `githubToken` | string | — | GitHub token for auth |
| `useLoggedInUser` | boolean | `true` | Use stored CLI credentials |
| `logLevel` | string | `"none"` | `"none"` \| `"error"` \| `"warning"` \| `"info"` \| `"debug"` |
| `autoRestart` | boolean | `true` | Auto-restart CLI on crash |
| `useStdio` | boolean | `true` | Use stdio transport |

## Session Configuration

| Option | Type | Description |
|--------|------|-------------|
| `model` | string | Model to use (e.g., `"gpt-4.1"`, `"claude-sonnet-4"`) |
| `sessionId` | string | Custom ID for resumable sessions |
| `streaming` | boolean | Enable streaming responses |
| `tools` | Tool[] | Custom tools |
| `mcpServers` | object | MCP server configurations |
| `hooks` | object | Session hooks |
| `provider` | object | BYOK provider config |
| `customAgents` | object[] | Custom agent definitions |
| `systemMessage` | object | System message override |
| `skillDirectories` | string[] | Directories to load skills from |
| `disabledSkills` | string[] | Skills to disable |
| `reasoningEffort` | string | Reasoning effort level |
| `availableTools` | string[] | Restrict available tools |
| `excludedTools` | string[] | Exclude specific tools |
| `infiniteSessions` | object | Auto-compaction config |
| `workingDirectory` | string | Working directory |

---

## SDK vs CLI Feature Comparison

### ✅ Available in SDK

Session management, messaging (`send`/`sendAndWait`/`abort`), message history (`getMessages`), custom tools, tool permission hooks, MCP servers (local + HTTP), streaming, model selection, BYOK providers, custom agents, system message, skills, infinite sessions, permission handlers, 40+ event types.

### ❌ CLI-Only Features

Session export (`--share`), slash commands, interactive UI, terminal rendering, YOLO mode, login/logout flows, `/compact` (use `infiniteSessions` instead), `/usage` (use usage events), `/review`, `/delegate`.

**Workarounds:**
- Session export → Collect events manually with `session.on()` + `session.getMessages()`
- Permission control → Use `onPermissionRequest` handler instead of `--allow-all-paths`
- Context compaction → Use `infiniteSessions` config instead of `/compact`

---

## Debugging

Enable debug logging:

```typescript
const client = new CopilotClient({ logLevel: "debug" });
```

Custom log directory:

```typescript
const client = new CopilotClient({ cliArgs: ["--log-dir", "/path/to/logs"] });
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `CLI not found` | CLI not installed or not in PATH | Install CLI or set `cliPath` |
| `Not authenticated` | No valid credentials | Run `copilot auth login` or provide `githubToken` |
| `Session not found` | Using session after `destroy()` | Check `listSessions()` for valid IDs |
| `Connection refused` | CLI process crashed | Enable `autoRestart: true`, check port conflicts |
| MCP tools missing | Server init failure or tools not enabled | Set `tools: ["*"]`, test server independently |

### Connection State

```typescript
console.log("State:", client.getState());  // "connected" after start()
client.on("stateChange", (state) => console.log("Changed to:", state));
```

---

## Key API Summary

| Language | Client | Session Create | Send | Resume | Stop |
|----------|--------|---------------|------|--------|------|
| Node.js | `new CopilotClient()` | `client.createSession()` | `session.sendAndWait()` | `client.resumeSession()` | `client.stop()` |
| Python | `CopilotClient()` | `client.create_session()` | `session.send_and_wait()` | `client.resume_session()` | `client.stop()` |
| Go | `copilot.NewClient(nil)` | `client.CreateSession()` | `session.SendAndWait()` | `client.ResumeSession()` | `client.Stop()` |
| .NET | `new CopilotClient()` | `client.CreateSessionAsync()` | `session.SendAndWaitAsync()` | `client.ResumeSessionAsync()` | `client.DisposeAsync()` |

## References

- [GitHub Copilot SDK](https://github.com/github/copilot-sdk)
- [Copilot CLI Installation](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli)
- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [MCP Servers Directory](https://github.com/modelcontextprotocol/servers)
- [GitHub MCP Server](https://github.com/github/github-mcp-server)
