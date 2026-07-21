# Invoke Foundry Agent

Invoke Prompt Agents with Foundry MCP. Invoke Hosted Agents and manage their sessions, files, and logs with azd.

## Route by Agent Type

| Agent type | Invoke path | State management |
|------------|-------------|------------------|
| Prompt | Foundry MCP `agent_invoke` | `conversationId`; no hosted session or file operations |
| Hosted | `azd ai agent invoke` | azd sessions, files, conversations, and monitor commands |

Treat an `azure.yaml` service with `host: azure.ai.agent` as Hosted. If the type is still unknown, use `agent_get` only to classify the agent. Do not use MCP invoke, session, or file tools for a Hosted Agent.

## Hosted Agent Workflow with azd

### Step 1: Verify the Agent

Inside an azd project, run:

```bash
azd ai agent show --output json
```

Verify that the deployed version is active. When multiple agent services exist, use the service name in subsequent commands.

When invoking outside an azd project with a known protocol endpoint, skip this step.

### Step 2: Invoke

Single-agent project:

```bash
azd ai agent invoke "hello, are you up?"
```

Multi-agent project:

```bash
azd ai agent invoke my-agent "hello, are you up?"
```

Protocol examples:

```bash
azd ai agent invoke --protocol invocations --input-file request.json
```

For invocations, inspect the agent source or OpenAPI contract before preparing the request body.

Outside an azd project, use a full protocol endpoint supplied by the user or previously returned by `azd ai agent show`:

```bash
azd ai agent invoke --agent-endpoint "<full-agent-protocol-endpoint>" "Hello!"
```

Invoke supports `default` and `raw` output. Do not pass `--output json`.

Remote invocation can incur model usage charges. Run it only when it is within the user's request.

### Step 3: Let azd Manage Session State

A normal remote invoke does not require a separate session create command. azd reuses the saved session for that agent. If none exists, the server assigns one and azd persists the returned session ID for later invoke, file, and monitor commands.

| Intent | Option |
|--------|--------|
| Reuse the current session | No session flag |
| Select and persist a known session | `--session-id <id>` |
| Start fresh session-backed state | `--new-session` |
| Target a deployed version | `--version <version>` |

For the responses protocol, azd creates a platform-managed conversation and can persist its `conversationId` for reuse. Use `--new-conversation` to reset response history or `--conversation-id <id>` to select one. For invocations, memory is session-backed, so `--new-conversation` has no effect.

Use explicit session commands only when a session must exist before invoke or file operations, or when inspecting and controlling its lifecycle. Read [Session Management](references/session-management.md).

### Step 4: Manage Files and Logs

File commands use the session saved by invoke or explicit session creation unless `--session-id` overrides it. Read [File Operations](references/file-operations.md).

Use the same saved session for logs:

```bash
azd ai agent monitor
azd ai agent monitor --session-id <id> --follow
```

### Step 5: Stop or Delete the Session

Use stop when the filesystem must remain available:

```bash
azd ai agent sessions stop <session-id>
```

A later invocation can resume the stopped session. Use delete only for permanent cleanup:

```bash
azd ai agent sessions delete <session-id>
```

Delete removes both compute and persistent filesystem state.

## Prompt Agent Workflow with Foundry MCP

1. Use `agent_get` to verify the Prompt Agent.
2. Invoke with `agent_invoke(projectEndpoint, agentName, inputText)`.
3. Reuse the returned `conversationId` for later turns.

Prompt Agents do not use hosted sessions or hosted file operations.

## Hosted Protocol Selection

| Protocol | Hosted caller | Restriction |
|----------|---------------|-------------|
| `responses` | `azd ai agent invoke` | Local and remote |
| `invocations` | `azd ai agent invoke --protocol invocations` | Local and remote; developer-defined body |
| `invocations_ws` | WebSocket client | Follow [invocations-ws](../invocations-ws/invocations-ws.md) |

See [Invocations Protocol Guide](references/invocations-protocol.md) for request schema discovery and examples.

## Error Handling

| Error | Resolution |
|-------|------------|
| Agent service cannot be resolved | Use the `azure.yaml` service name, correct the service block, or use `--agent-endpoint` outside the project |
| Hosted version is not active | Inspect `azd ai agent show --output json` and deployment logs |
| Session is missing or expired | Run `azd ai agent sessions list`, then use a valid ID or invoke with `--new-session` |
| Conversation is missing after a session was deleted | For the responses protocol, retry with `--new-session --new-conversation` |
| `session_not_ready` or `424 FailedDependency` | Inspect `azd ai agent monitor`, wait for readiness, and retry the same azd invoke |
| Invocations schema mismatch | Inspect the handler or OpenAPI contract and correct the input file |
| File operation fails | Run `azd ai agent sessions show <id>` and verify the path with `azd ai agent files list` or `stat` |
| Header-based isolation fails | Pass the same `--user-identity` on invoke, session, file, and monitor commands |
| Permission error | Follow [troubleshoot](../troubleshoot/troubleshoot.md) |

## References

- [Session Management](references/session-management.md)
- [File Operations](references/file-operations.md)
- [Invocations Protocol Guide](references/invocations-protocol.md)
- [Foundry Hosted Agents](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Foundry Samples](https://github.com/azure-ai-foundry/foundry-samples)
