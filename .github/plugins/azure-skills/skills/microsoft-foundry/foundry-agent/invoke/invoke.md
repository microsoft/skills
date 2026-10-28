# Invoke Foundry Agent

Invoke ordinary Prompt Agents with Foundry MCP. Invoke Hosted and Managed Harness Agents with azd. Invoke Voice Agents over the managed Foundry `voice` WebSocket endpoint (not `azd ai agent invoke`).

## Route by Agent Type

| Agent type | Protocol | Invoke path | State management |
|------------|----------|-------------|------------------|
| Prompt | — | Foundry MCP `agent_invoke` | `conversationId`; no hosted session or file operations |
| Managed Harness Agent | Responses | `azd ai agent invoke` | Managed response history; no Hosted session/file operations |
| Voice (Prompt Voice or Hosted Voice wrapper) | `voice` (`wss://.../protocols/voice?api-version=v1`) | Smoke helper for minimal programmatic verification; Foundry Voice playground for interactive audio-to-audio testing; **never** `azd ai agent invoke` | Real-time Voice session; no Hosted session/file commands on `kind: voice` |
| Hosted Voice target (diagnostic only) | `invocations_ws` + Bridge `1.0` | Bridge-compatible WebSocket client; see [voice-agent-hosted-bridge.md](../create/references/voice-agent-hosted-bridge.md) | Target container session (`agent_session_id`); does not validate the Voice wrapper |
| Hosted | `responses` | `azd ai agent invoke` | azd sessions, files, conversations, and monitor commands |
| Hosted | `invocations` | `azd ai agent invoke --protocol invocations` | azd sessions, files, conversations, and monitor commands |
| Hosted | `activity` | Microsoft 365 channel, such as Teams | Activity conversation and channel state |
| Hosted (custom real-time/audio) | `invocations_ws` | Custom WebSocket client; follow [invocations-ws](../invocations-ws/invocations-ws.md) | Agent-managed state keyed by `agent_session_id` |

Classify `azure.yaml` services in order: Voice is a **Voice Agent** (`conversationEngine.type: hosted_agent` for Hosted Voice wrapper, `modelType: managed` or `self_deployed` for Prompt Voice); apply the top-level compatibility classification for legacy manifests. `kind: hosted` is **Hosted**; `kind: prompt` plus `harness.type: microsoft_copilot_preview` or legacy `github_copilot_preview` is a **Managed Harness Agent**; other `kind: prompt` services are ordinary **Prompt Agents**. If still unknown, use `agent_get` only to classify.

## Voice Agent Workflow (Prompt Voice and Hosted Voice Wrapper)

> **Critical**: `azd ai agent invoke` does **not** support Voice Agents, including Hosted Voice wrappers. Use the bundled smoke helper for minimal programmatic/single-turn verification. For "talk to," interactive testing, microphone/audio-to-audio, voice quality, VAD, interruption, or full-experience requests, provide the Voice Agent Playground URL from `azd ai agent show --output json`.

### Step 1: Verify Deployed Version(s)

Inside the azd project, run:

```bash
azd ai agent show --output json
```

- For **Prompt Voice**, confirm the `kind: voice` agent version is active.
- For **Hosted Voice**, confirm **both** the `kind: hosted` target and the `kind: voice` wrapper versions are active, and target the **`kind: voice` wrapper's** name for end-to-end Voice invocation.

### Step 2: Choose the Invocation Experience

- **Minimal programmatic or single-turn verification:** run the bundled smoke helper over the managed `voice` WebSocket.
- **Interactive or full audio-to-audio testing:** direct the user to the Foundry Voice Agent playground URL returned by `azd ai agent show --output json`. This is the path for microphone capture, STT quality, VAD/turn-taking, barge-in/interruption, playback/voice quality, browser/device behavior, and perceived latency.

The smoke helper is a text-driven technical verification client, not a complete interactive microphone client. See [voice-agent-smoke-test.md](../create/references/voice-agent-smoke-test.md) for the validation boundary.

#### Automated Smoke Test

Run the paired smoke-test helper from the `microsoft-foundry` skill root (`plugins/azure-skills/skills/microsoft-foundry`) using `DefaultAzureCredential` (`https://ai.azure.com/.default`). Note that PowerShell uses PascalCase parameters (`-Endpoint`, `-AgentName`, `-Text`, `-Timeout`, `-OutputAudio`, `-DryRun`).

**Bash** ([../create/scripts/smoke-test-voice.sh](../create/scripts/smoke-test-voice.sh))
```bash
./foundry-agent/create/scripts/smoke-test-voice.sh \
  --endpoint "$AZURE_AI_PROJECT_ENDPOINT" \
  --agent-name "<voice-agent-name>" \
  --text "Hello, briefly introduce yourself." \
  --timeout 180
```

**PowerShell** ([../create/scripts/smoke-test-voice.ps1](../create/scripts/smoke-test-voice.ps1))
```powershell
.\foundry-agent\create\scripts\smoke-test-voice.ps1 `
  -Endpoint $env:AZURE_AI_PROJECT_ENDPOINT `
  -AgentName "<voice-agent-name>" `
  -Text "Hello, briefly introduce yourself." `
  -Timeout 180
```

See [voice-agent-smoke-test.md](../create/references/voice-agent-smoke-test.md) for `--dry-run` / `-DryRun`, `--output-audio` / `-OutputAudio`, and exit code semantics (`0` pass, `1` failure, `2` usage error).

### Optional Step 3: Hosted Voice Target Bridge `1.0` Diagnostic

When a **Hosted Voice Agent** fails or needs target-level isolation, test the `kind: hosted` target directly over `/invocations_ws` using the diagnostic sequence in [voice-agent-hosted-bridge.md](../create/references/voice-agent-hosted-bridge.md). Target-only testing does **not** replace end-to-end wrapper verification in Step 2.

## Managed Harness Agent Workflow with azd

### Step 1: Verify the Managed Harness Agent

Inside the azd project, confirm the selected service is `kind: prompt` with either recognized Copilot harness discriminator, then run:

```bash
azd ai agent show --output json
```

Verify the deployed version is active and still contains the harness.

### Step 2: Invoke

Single-Agent project:

```bash
azd ai agent invoke "hello"
```

Multi-Agent project:

```bash
azd ai agent invoke <service-name> "hello"
```

Invoke supports `default` and `raw` output; do not pass `--output json`.

The managed harness uses its Agent-specific Responses endpoint. azd persists response history as supported by the installed extension. Use its invoke help for reset/select flags when needed.

Do not use:

- `azd ai agent run`
- Hosted `sessions` commands
- Hosted `files` commands
- `azd ai agent monitor`
- Foundry MCP `agent_invoke` as the default Managed Harness Agent path

Remote invocation can incur model usage charges. Run it only within the user's request.

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

For invocations, inspect the agent source or OpenAPI contract before preparing the request body. See [Invocations Protocol Guide](references/invocations-protocol.md) for request schema discovery and examples.

Outside an azd project, use a full protocol endpoint supplied by the user or previously returned by `azd ai agent show`:

```bash
azd ai agent invoke --agent-endpoint "<full-agent-protocol-endpoint>" "Hello!"
```

Invoke supports `default` and `raw` output. Do not pass `--output json`.

Remote invocation can incur model usage charges. Run it only when it is within the user's request.

#### Activity protocol

`azd ai agent invoke` does not support the Activity protocol. For local invocation, use `azd ai agent run` and Microsoft 365 Agents Playground. For a deployed service, follow its generated `TEAMS_APP_SETUP.md` and invoke through Teams or the configured channel.

If Activity coexists with Responses or Invocations, pass `--protocol responses` or `--protocol invocations` explicitly to test that non-Activity protocol. A successful CLI response does not validate the Activity protocol path.

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

Ordinary Prompt Agents do not use hosted sessions or hosted file operations.

## Error Handling

| Error | Resolution |
|-------|------------|
| Agent service cannot be resolved | Use the `azure.yaml` service name, correct the service block, or use `--agent-endpoint` outside the project |
| Managed Harness Agent is routed to Hosted session/file commands | Reclassify from `kind: prompt` plus either recognized Copilot harness discriminator and use the Managed Harness Agent workflow |
| Managed Harness Agent published definition lacks harness | Fix `azure.yaml`, verify the extension version, and redeploy |
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
