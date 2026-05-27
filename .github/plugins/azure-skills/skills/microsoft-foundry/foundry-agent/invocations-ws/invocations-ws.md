# Invocations WebSocket (`invocations_ws`) Protocol

Build, deploy, and connect to Foundry hosted agents that expose a **duplex WebSocket** endpoint instead of an HTTP request/response surface. Use this for real-time, bidirectional workloads — voice agents, live transcripts, custom streaming protocols, and signaling for out-of-band media transports.

> ℹ️ **Preview.** `invocations_ws` is in public preview. For current region availability see [Foundry Hosted Agents — region availability](https://learn.microsoft.com/azure/foundry/agents/concepts/hosted-agents#region-availability). Every upgrade must carry the preview flag — either the `foundry_features=HostedAgents=V1Preview` query parameter or the `Foundry-Features: HostedAgents=V1Preview` request header.

## Quick Reference

| Property | Value |
|----------|-------|
| Agent type | Hosted (Bring Your Own container) only |
| Protocol id (`agent.yaml`) | `invocations_ws` |
| Recommended version | `1.0.0` |
| Container route | `WS /invocations_ws` (served by `azure-ai-agentserver-invocations`; the host binds the port and probes for you) |
| Foundry-side URL | `wss://{account}.services.ai.azure.com/api/projects/agents/endpoint/protocols/invocations_ws?project_name={project}&agent_name={agentName}&agent_session_id={sessionId}&foundry_features=HostedAgents=V1Preview` |
| Auth | `Authorization: Bearer <Entra token>` for scope `https://ai.azure.com/.default` |
| Wire format | Developer-defined (binary frames, JSON text frames, protobuf, raw PCM — anything) |
| Session affinity | Per-connection, keyed by the `agent_session_id` query parameter (optional — auto-generated if omitted) |
| Multi-turn / state | Agent-managed inside the container; platform does **not** store history |

## When to Use This Skill

- Build or operate a hosted real-time voice agent (audio in / audio out, control frames)
- Bridge an out-of-band media transport (WebRTC, SFU, telephony) to a Foundry-hosted bot via WebSocket signaling
- Stream events bidirectionally that don't fit `responses` (OpenAI-compatible) or `invocations` (single bytes-in/bytes-out HTTP)
- Connect a browser or native client to an already-deployed `invocations_ws` agent

> ℹ️ For HTTP-based invocation (single request/response, OpenAI `responses` API, or custom HTTP `invocations`), use the [`invoke`](../invoke/invoke.md) skill instead.

## Protocol Comparison

| Aspect | `responses` | `invocations` | `invocations_ws` |
|--------|-------------|---------------|------------------|
| Transport | HTTPS | HTTPS | WebSocket (`wss://`) |
| Lifetime | Per request | Per request | Long-lived duplex |
| Wire format | OpenAI-compatible JSON | Raw bytes (developer-defined) | Frames, developer-defined |
| History | Platform via `conversationId` | Agent-managed | Agent-managed via `agent_session_id` |
| Streaming | `stream: true` (SSE) | Agent-controlled | Native duplex |
| Best for | Chat | Webhooks / classifiers / protocol bridges | Voice, signaling, real-time |

## Workflow

### Step 1: Author the Container

Use the `azure-ai-agentserver-invocations` host — the same package that serves HTTP `/invocations` — and register a WebSocket handler with `@app.ws_handler`. The host runs the server, binds the port, exposes `/readiness`, handles `await websocket.accept()`, runs Ping/Pong keep-alive (default 30s), maps uncaught handler exceptions to close code `1011`, and emits the structured close event used by `azd ai agent monitor`. You can register `@app.invocation_handler` (HTTP `POST /invocations`) and `@app.ws_handler` (WebSocket `GET /invocations_ws`) on the same `app`.

```python
from azure.ai.agentserver.invocations import InvocationAgentServerHost
from starlette.websockets import WebSocket

app = InvocationAgentServerHost()

@app.ws_handler                    # GET /invocations_ws (WebSocket upgrade)
async def ws(websocket: WebSocket) -> None:
    await run_bot(websocket)       # your duplex protocol lives here

app.run()
```

Inside the handler, read the session id from `FOUNDRY_AGENT_SESSION_ID` (env var set by the host), or fall back to the `agent_session_id` query parameter. The container does **not** see the `Authorization` header — APIM and the Agents service strip it after validation, so don't depend on it and don't accept an `authorization` query parameter.

> ⚠️ **You define the wire format.** The platform forwards frames as-is in both directions. There is no schema validation, no OpenAPI registration, no platform-managed history. Document your protocol for callers.

See [Invocations WebSocket Protocol Guide](references/invocations-ws-protocol.md) for the framing model, the `agent_session_id` query parameter, control-vs-data frame patterns, and discovery guidance.

### Step 2: Declare the Protocol in `agent.yaml`

```yaml
kind: hosted
name: my-ws-agent
protocols:
  - protocol: invocations_ws
    version: 1.0.0
resources:
  cpu: "1"          # voice/media: at least 1 vCPU / 2 GiB; up to 2 vCPU / 4 GiB
  memory: 2Gi
environment_variables:
  - name: SOME_SECRET
    value: ${SOME_SECRET}
  # Resolve every secret from the azd environment; do not bake values into the image.
```

The matching `agent.manifest.yaml` declares the same `protocol: invocations_ws` under `template.protocols`.

> ⚠️ The default `azd` scaffold uses `0.25 cpu / 0.5Gi`, which is too small for most real-time workloads. Bump `resources` before deploying.

### Step 3: Deploy via `azd`

Use the standard hosted-agent flow from the [`deploy`](../deploy/deploy.md) skill:

```bash
mkdir ~/azd-deploys/my-ws-agent && cd ~/azd-deploys/my-ws-agent
azd ai agent init -m <path>/agent.manifest.yaml -p <project-resource-id> --no-prompt
# azd env set ... for every variable referenced in agent.yaml
azd deploy my-ws-agent
```

Once `Running`, the Foundry endpoint is reachable at the URL pattern in the Quick Reference table above.

### Step 4: Connect a Client

Connect to the Foundry-side WebSocket directly:

1. **Mint an Entra token** for the audience `https://ai.azure.com`:

   ```bash
   az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv
   ```

2. **Build the upstream URL.** The `agent_session_id` query parameter is **optional** — if you omit it the platform generates one; supply your own (URL-safe; see [Session Management](../invoke/references/session-management.md) for ID format) only when you need to resume an existing session. The preview flag is required:

   ```
   wss://{account}.services.ai.azure.com/api/projects/agents/endpoint/protocols/invocations_ws
     ?project_name={project}
     &agent_name={agentName}
     &agent_session_id={your-id}        # optional
     &foundry_features=HostedAgents=V1Preview
   ```

   You can alternatively pass the preview flag as the `Foundry-Features: HostedAgents=V1Preview` request header on the upgrade.

3. **Open the WebSocket** with header `Authorization: Bearer <token>`. Browser code typically needs a small server-side proxy because the browser `WebSocket` constructor cannot set headers.

4. **Speak your protocol.** Send and receive whatever your container expects.

### Step 5: Multi-turn / Session State

There is no platform-managed history. To correlate frames across reconnects or keep per-user state, reuse the same `agent_session_id` and key your state off it inside the container. See [Session Management](../invoke/references/session-management.md).

### Step 6: Observe and Troubleshoot

Stream container logs while testing:

```bash
azd ai agent monitor my-ws-agent --follow
# scope to a single connection
azd ai agent monitor my-ws-agent --session-id <agent_session_id> --follow
```

The same `agent_session_id` can be used to stream container logs (see the [`troubleshoot`](../troubleshoot/troubleshoot.md) skill for deeper diagnostics).

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| HTTP 401 / 403 on WS upgrade | Missing or stale Entra token | Re-run `az account get-access-token --resource https://ai.azure.com`; ensure the caller has Foundry data-plane RBAC |
| HTTP 404 on upgrade | Wrong `agent_name` / `project_name`, missing preview flag, or unsupported region | Verify with `agent_get`; ensure `foundry_features=HostedAgents=V1Preview` is on the URL (or `Foundry-Features` header); confirm region per [Hosted Agents region availability](https://learn.microsoft.com/azure/foundry/agents/concepts/hosted-agents#region-availability) |
| WS closes immediately after accept | Container handler raised inside the request | Check logs via `azd ai agent monitor`; typical causes are missing env vars or unreachable backend services |
| Browser cannot connect directly | Browser `WebSocket` cannot set `Authorization` | Run a thin server-side proxy that injects the token before forwarding |
| Frames received but no response | Wire-format mismatch | Confirm both ends use the same framing (binary vs text, codec, sample rate, schema). The platform does **not** validate or transcode frames |
| Cold-start delay on first connect | Container initialising (VAD, model load, etc.) | Expected; subsequent connections to the same container are fast |
| State lost across reconnect | Different `agent_session_id` used | Reuse the same `agent_session_id` query parameter to preserve agent-managed state |

## Reference Samples

End-to-end working samples (server container + browser portal) live in the [`foundry-samples`](https://github.com/microsoft-foundry/foundry-samples) repo under:

```
samples/python/hosted-agents/bring-your-own/invocations_ws/
```

Each sub-folder shows a different media-path strategy (audio entirely over the WebSocket vs. WebSocket as signaling-only for an out-of-band media transport). Pick the one whose architecture matches your latency, NAT-traversal, and operational constraints.

## Additional Resources

- [Invocations WebSocket Protocol Guide](references/invocations-ws-protocol.md)
- [Session Management](../invoke/references/session-management.md)
- [Foundry Hosted Agents](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [`invoke` skill](../invoke/invoke.md) — HTTP-based `responses` and `invocations` protocols
- [`deploy` skill](../deploy/deploy.md) — package and deploy hosted-agent containers
- [`troubleshoot` skill](../troubleshoot/troubleshoot.md) — diagnose hosted-agent runtime failures
