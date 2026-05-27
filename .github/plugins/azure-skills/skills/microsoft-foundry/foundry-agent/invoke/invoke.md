# Invoke Foundry Agent

Invoke deployed agents in Azure AI Foundry. Manage sessions and file operations for hosted agents.

## Quick Reference

| Property | Value |
|----------|-------|
| Agent types | Prompt (LLM-based), Hosted |
| MCP server | `azure` |
| Key Foundry MCP tools | `agent_invoke`, `agent_get`, `session_create`, `session_get`, `session_delete`, `session_list` |
| File operation tools | `session_file_upload`, `session_file_download`, `session_file_list`, `session_file_delete`, `session_file_stat`, `session_file_mkdir` |
| Conversation support | Single-turn and multi-turn (via `conversationId` for responses protocol, via session state for invocations protocol) |
| Session support | Managed sessions for hosted agents (via `session_create`) |
| Protocols | `responses` (OpenAI-compatible), `invocations` (custom payloads) |

## When to Use This Skill

- Send messages to a deployed agent (single or multi-turn)
- Create/manage sessions for hosted agents
- Upload/download files to/from hosted agent sessions
- Test agent behavior after creation or deployment

## MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `agent_invoke` | Send a message to an agent and get a response | `projectEndpoint`, `agentName`, `inputText` (required); `agentVersion`, `conversationId`, `sessionId`, `protocol`, `stream` (optional) |
| `agent_get` | Get agent details to verify existence and type | `projectEndpoint` (required), `agentName` (optional) |
| `session_create` | Create a new session for a hosted agent | `projectEndpoint`, `agentName` (required); `sessionId` (optional) |
| `session_get` | Get session status and details | `projectEndpoint`, `agentName`, `sessionId` (required) |
| `session_delete` | Delete a session and release compute | `projectEndpoint`, `agentName`, `sessionId` (required) |
| `session_list` | List sessions with pagination | `projectEndpoint`, `agentName` (required); `limit`, `order`, `after`, `before` (optional) |
| `session_logstream` | Stream console logs (stdout/stderr) from a session | `projectEndpoint`, `agentName`, `sessionId` (required); `maxLines` (optional) |

For session file operation tools (`session_file_upload`, `session_file_download`, `session_file_list`, `session_file_delete`, `session_file_stat`, `session_file_mkdir`), see [File Operations](references/file-operations.md).

## Protocols

Hosted agents support three protocols declared at deployment time. They are distinct contracts — pick per use case (an agent may declare more than one and serve them from the same container):

| Protocol | Recommended Version | Route | Best For |
|----------|-------------------|-------|----------|
| `responses` | `1.0.0` | `.../agents/{agentName}/endpoint/protocols/openai/responses` | Conversational agents, OpenAI-compatible |
| `invocations` | `1.0.0` | `.../agents/{agentName}/endpoint/protocols/invocations` | Custom payloads, protocol bridges, webhook callers |
| `invocations_ws` | `1.0.0` | `wss://.../agents/endpoint/protocols/invocations_ws` | Duplex WebSocket — voice, WebRTC signaling, custom real-time streams. See the dedicated [invocations-ws skill](../invocations-ws/invocations-ws.md); `agent_invoke` does **not** speak WebSocket. |

Key difference: `responses` takes a natural language `inputText` message with platform-managed history. `invocations` is **bytes in, bytes out** — the request body is forwarded as-is to the container and the raw response is returned. The developer defines the schema; the platform is pure pass-through. See [Invocations Protocol Guide](references/invocations-protocol.md) for I/O details, schema discovery, and examples.

> ⚠️ **Critical for invocations:** `inputText` is forwarded as the raw HTTP request body. The agent developer defines what the container accepts. **Do not guess** — fetch the agent's OpenAPI spec or inspect its source code first.

> 💡 **Tip:** The `agent_invoke` MCP tool supports both `responses` and `invocations` protocols. Set `protocol: 'invocations'` when targeting an invocations-protocol agent.

## Workflow

### Step 1: Verify Agent Readiness

Use `agent_get` to verify the agent exists. For hosted agents, also verify the targeted version is `active`.

### Step 2: Create Session (Hosted Agents)

For hosted agents, create a session before invoking using `session_create` with `projectEndpoint` and `agentName`. Optionally provide a `sessionId` (must match `^[A-Za-z0-9_-]{8,128}$`). Store the returned `sessionId` for subsequent calls.

> ⚠️ Skip this step for prompt agents — they do not use sessions.

For full session lifecycle details, see [Session Management](references/session-management.md).

### Step 3: Invoke Agent

Use the project endpoint and agent name from the project context. Use `agent_invoke` with:
- `projectEndpoint`, `agentName`, `inputText` (required)
- `agentVersion`, `conversationId`, `sessionId`, `protocol`, `stream` (optional)

**Responses protocol** (default): `inputText` is a natural language message string. Multi-turn via `conversationId`.

**Invocations protocol**: Set `protocol: 'invocations'`. This is **bytes in, bytes out** — `inputText` is forwarded as the raw HTTP request body to the container. The developer defines the expected schema.

> ⚠️ **Do not guess the invocations request body.** To discover the expected schema:
> 1. **Fetch the OpenAPI spec**: `GET {projectEndpoint}/agents/{agentName}/endpoint/protocols/invocations/docs/openapi.json` (if the developer registered one)
> 2. Inspect the agent's **route handler code** or README for the expected payload shape
> 3. If unknown, ask the user for the agent's API contract before invoking

Example invocations call (agent expects `{"message": "<text>"}`):

```text
agent_invoke(projectEndpoint, agentName, inputText: "{\"message\":\"hello\"}", protocol: "invocations", sessionId: "<id>")
```

See [Invocations Protocol Guide](references/invocations-protocol.md) for full details and examples.

### Step 4: Multi-Turn Conversations

**Responses protocol** → Pass `conversationId` from previous response to continue the thread. Platform manages history.

**Invocations protocol** → Reuse same `sessionId`; conversation state is agent-managed via `$HOME`. Do **not** pass `conversationId` — it has no effect for invocations.

### Step 5: File Operations (Hosted Agents)

Upload/download files to pass data to and retrieve results from agents. All file operations require an active session. See [File Operations](references/file-operations.md).

### Step 6: Clean Up

Use `session_delete` to release compute resources when done. Undeleted sessions expire per platform policies.

## Agent Type Differences

| Behavior | Prompt Agent | Hosted Agent |
|----------|--------------|--------------|
| Readiness | Immediate | After deployment, version must be `active` |
| Session | Not applicable | Required via `session_create` |
| Multi-turn | Via `conversationId` | Via `conversationId` (responses) or session state (invocations) |
| File operations | ❌ | ✅ via session file tools |
| Protocol | `responses` only | `responses` or `invocations` |

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Agent not found | Invalid name or endpoint | Use `agent_get` to list agents |
| Hosted agent not active | Version still provisioning or failed | Check version status via `agent_get` |
| Session not found | Invalid ID or expired | Create new session with `session_create` |
| `424 FailedDependency` or `session_not_ready` | Hosted agent session is still warming up or readiness has not completed | Wait 15-30 seconds, check `session_logstream` if needed, then retry `agent_invoke` with the same `sessionId` if one was returned; if no `sessionId` was returned, retry `session_create` |
| Invocation failed | Model error, timeout, or invalid input | Check agent logs, verify model deployment |
| Invocations schema mismatch | Request body does not match what the agent expects | Inspect agent's route handler or API docs for the correct JSON schema; do not guess |
| File operation failed | Session not active or invalid path | Verify session with `session_get` |
| Permission error | Missing RBAC | Follow [troubleshoot skill](../troubleshoot/troubleshoot.md) |
| Rate limit exceeded | Too many requests | Implement backoff and retry |

## Additional Resources

- [Session Management](references/session-management.md)
- [File Operations](references/file-operations.md)
- [Foundry Hosted Agents](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Foundry Samples](https://github.com/azure-ai-foundry/foundry-samples)
