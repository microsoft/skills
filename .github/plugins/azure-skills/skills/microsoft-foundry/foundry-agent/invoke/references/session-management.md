# Hosted Session Management with azd

Use azd to manage session-backed compute and filesystem state for Hosted Agents.

## Automatic Session Handling

For `responses` and `invocations`, start with `azd ai agent invoke`. Do not create a session first unless the workflow needs a known session before invocation.

Within an azd project, azd resolves session state for a normal remote invoke in this order:

1. Use and persist an explicit `--session-id`.
2. Reuse the session saved for the agent endpoint.
3. If no session exists, let the server assign one, capture the returned session ID, and save it for later commands.

`--new-session` ignores the saved session and starts fresh session-backed state. `--version <version>` creates or reuses a session bound to that deployed version. Do not combine `--version` with `--session-id`.

File and monitor commands automatically use the session saved by invoke or `sessions create`. They also accept `--session-id <id>`.

## Session and Conversation State

| State | Used by | azd behavior |
|-------|---------|--------------|
| Session | All directly invocable Hosted protocols | Persisted per agent; controls compute affinity and filesystem state |
| Conversation | `responses` | Platform-managed; azd can persist the `conversationId` for reuse |

Use `--new-conversation` to reset responses history without replacing the session. Use `--new-session` to reset session-backed memory for invocations. `--new-conversation` has no effect for invocations. For completely fresh responses state, combine `--new-session` and `--new-conversation`.

## Explicit Session Commands

Create a session when files must be uploaded before the first invoke, when a caller-selected ID is required, or when binding to a specific version:

```bash
azd ai agent sessions create
azd ai agent sessions create my-agent <version>
azd ai agent sessions create --session-id my-session
```

The create command auto-detects a single agent and resolves the deployed version from the azd environment. It prints JSON by default and persists `agent_session_id` as the current session.

Inspect and enumerate sessions:

```bash
azd ai agent sessions show <session-id>
azd ai agent sessions list
azd ai agent sessions list --limit 10 --output table
azd ai agent sessions list --pagination-token <token>
```

Use `--agent-name <service-name>` for show, stop, delete, or list when the project has multiple agent services. For header-based isolation, pass the same `--user-identity` on every session, invoke, file, and monitor command.

## Stop Versus Delete

```bash
azd ai agent sessions stop <session-id>
azd ai agent sessions delete <session-id>
```

`stop` terminates running compute and preserves the persistent filesystem. It is idempotent, and a later invocation can resume the session.

`delete` synchronously removes compute and filesystem state. If the deleted ID is the saved current session, azd clears it from its session store.

## Common Patterns

Continue a multi-turn interaction:

```bash
azd ai agent invoke "First question"
azd ai agent invoke "Follow-up question"
```

Reset responses history while keeping session files:

```bash
azd ai agent invoke --new-conversation "Start a new topic"
```

Reset session-backed memory:

```bash
azd ai agent invoke --new-session "Start fresh"
```

Preserve files without keeping compute running:

```bash
azd ai agent sessions stop <session-id>
```

## WebSocket Sessions

`invocations_ws` is not called by `azd ai agent invoke`. Its client supplies `agent_session_id` on the WebSocket URL. Follow [Invocations WebSocket](../../invocations-ws/invocations-ws.md) for that connection lifecycle.
