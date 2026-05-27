# Session Management

Manage hosted agent sessions — isolated compute environments that provide persistent state across invocations.

This document covers session creation and lifecycle for both HTTP-protocol agents (`responses`, `invocations`) and WebSocket agents (`invocations_ws`).

## Overview

Sessions bind a hosted agent to a dedicated compute instance. Files written to `$HOME` during a session persist across requests for the lifetime of that session. When a session is deleted, its compute resources and stored files are released.

## Session Creation

| Protocol | How a session is created | Session id |
|----------|--------------------------|------------|
| `responses`, `invocations` (HTTP) | Call the `session_create` MCP tool before invoking the agent | **Server-issued** `sessionId` (or a client-supplied one passed to `session_create`) |
| `invocations_ws` (WebSocket) | Implicitly, on the first WebSocket upgrade (no `session_create` call) | **Client-supplied** `agent_session_id` query parameter on the upgrade URL — **optional**; if omitted, the platform (or the container) generates a random id |

Both ids follow the same format rule: `^[A-Za-z0-9_-]{8,128}$`.

## Session Lifecycle

**HTTP (`responses`, `invocations`):**

```text
session_create → Running → (invoke, file ops) → session_delete
                    ↓
               Expired (platform auto-cleanup)
```

**WebSocket (`invocations_ws`):**

```text
client opens WS upgrade (optionally with ?agent_session_id=<id>)
  └─► first upgrade for that id ──► sandbox created, handler bound
        └─► frames flow ──► either side closes ──► WS connection ends
              └─► sandbox + $HOME persist ──► next WS upgrade with same id re-hydrates
                    └─► after the idle timeout, compute is deprovisioned; state is persisted
```

Key points for `invocations_ws`:

- There is **no `session_create` / `session_delete`** call. The first upgrade creates the session; the session outlives any individual WebSocket connection.
- The `agent_session_id` query parameter is **optional**. If you omit it, the platform (or the container) generates a random id; supply it explicitly only when you need a specific id to resume an existing session.
- The `agent_session_id` is the **affinity key** — the platform routes upgrades with the same id back to the same sandbox.
- Closing the WebSocket does **not** delete the session. To resume, open a new upgrade with the same `agent_session_id` and the container sees its previous `$HOME` state.
- After the idle timeout, the platform deprovisions compute but persists session state, so the next reconnect re-hydrates the sandbox.

## Session ID Format

Session IDs must match the pattern `^[A-Za-z0-9_-]{8,128}$`.

- If you provide a `sessionId` to `session_create`, it must conform to this pattern
- If you omit `sessionId`, the platform auto-generates one
- Store the returned `sessionId` — it is required for all subsequent operations

## MCP Tool Details

### Create Session

Use `session_create` to provision a new session:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `projectEndpoint` | ✅ | AI Foundry project endpoint |
| `agentName` | ✅ | Name of the hosted agent |
| `sessionId` | ❌ | Optional custom session ID (8-128 chars, alphanumeric + hyphens/underscores) |

Returns: Session resource with `sessionId`, status, and expiration.

### Get Session

Use `session_get` to check session status:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `projectEndpoint` | ✅ | AI Foundry project endpoint |
| `agentName` | ✅ | Name of the hosted agent |
| `sessionId` | ✅ | The session ID to inspect |

Returns: Session details including status, version, creation time, and expiration.

### Delete Session

Use `session_delete` to release compute resources:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `projectEndpoint` | ✅ | AI Foundry project endpoint |
| `agentName` | ✅ | Name of the hosted agent |
| `sessionId` | ✅ | The session ID to delete |

> ⚠️ **Warning:** Deleting a session permanently removes all files stored in `$HOME` for that session.

### List Sessions

Use `session_list` to enumerate sessions:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `projectEndpoint` | ✅ | AI Foundry project endpoint |
| `agentName` | ✅ | Name of the hosted agent |
| `limit` | ❌ | Max results to return (1-100, default 20) |
| `order` | ❌ | Sort order: `asc` or `desc` (default `asc`) |
| `after` | ❌ | Cursor for forward pagination |
| `before` | ❌ | Cursor for backward pagination |

> ⚠️ **Warning:** `after` and `before` are mutually exclusive — do not pass both.

## Session vs Conversation

| Concept | Purpose | Scope |
|---------|---------|-------|
| `sessionId` | Binds requests to a compute instance with persistent filesystem state | Hosted agents only |
| `conversationId` | Tracks conversation history across turns | Responses protocol only |

- A single session can host multiple conversations
- A conversation does not require a session (prompt agents use `conversationId` without sessions)
- For hosted agents using `responses` protocol, use **both**: `sessionId` for compute affinity and `conversationId` for history

## Best Practices

1. **Create sessions explicitly** — Always use `session_create` before invoking a hosted agent with `responses` or `invocations` protocol. Do not rely on implicit session creation.
2. **Reuse sessions** — Keep the same session for related multi-turn interactions to preserve agent state.
3. **Clean up when done** — Delete sessions after use to release compute resources and avoid quota consumption.
4. **Handle expiry** — Sessions expire based on platform policies. If `session_get` returns a non-running state, create a new session.
5. **Version awareness** — The platform auto-resolves the agent version at session creation time. If you need a specific version, ensure it is active before creating the session.
6. **Debug with logstream** — Use `session_logstream` to stream stdout/stderr from a running session for troubleshooting.
