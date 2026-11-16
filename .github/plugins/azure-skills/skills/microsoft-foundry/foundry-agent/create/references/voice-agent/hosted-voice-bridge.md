# Voice Live Bridge `1.0` for Hosted Voice

A Hosted Voice configuration is a voice-based agent using a hosted text agent as its conversation engine. It pairs a managed **Voice wrapper** (`kind: voice`) with a **hosted target** (`kind: hosted`). Route the target through `voice_conversation_engine/1.0.0` unless the user explicitly selects `invocations_ws` or the manifest already declares the complete legacy shape.

## Two-Agent Ownership Model

| Concern | Hosted target (`kind: hosted`) | Managed Voice wrapper (`kind: voice`) |
|---|---|---|
| **Role** | Reasoning, tools, bounded conversation history, model calls (e.g., Foundry Responses API with `store=false`) | Audio pipeline (VAD, STT, TTS, barge-in interruption, proactive admission), greeting, managed `voice` WebSocket endpoint |
| **Protocol & Route** | `voice_conversation_engine/1.0.0` on `/voice_conversation_engine` (port `8088` + `GET /readiness`) speaking Voice Live Bridge Protocol `1.0` | Foundry `voice` protocol (`?api-version=v1`) |
| **Link** | Active `kind: hosted` target in the same Foundry project | `uses: [ai-project, <target-service>]` and `conversationEngine: { type: hosted_agent, name: <target-service> }` directly on the service block |
| **Model & instructions** | Configured in target (`env: { AZURE_AI_MODEL_DEPLOYMENT_NAME: ... }` + container code) | **Forbidden** on wrapper (`model`, `modelType`, `instructions`, `tools`, `protocols`, `codeConfiguration` must be omitted) |
| **Agent name** | Distinct `<target-name>` | Distinct `<wrapper-name>` |

---

## Voice Live Bridge Protocol `1.0` Event Flow

The Voice wrapper's Voice Live layer connects to the hosted target through the selected transport. `voice_conversation_engine` uses `/voice_conversation_engine` (`ws://127.0.0.1:8088/voice_conversation_engine` locally). Bridge messages still use `session.start.protocol_version: "1.0"`; transport version `1.0.0` and Bridge protocol version `"1.0"` are distinct. The hosted target **never** processes raw audio frames—Voice Live handles audio input, speech recognition, turn detection, synthesis, playback interruption, and proactive-response admission.

The typed Voice SDK keeps the same callbacks and Bridge events on the dedicated route. After deployment, the target endpoint is `wss://<project-host>/api/projects/<project>/agents/<target>/endpoint/protocols/voice_conversation_engine?api-version=v1`.

```text
Voice wrapper / Voice Live layer                Hosted target (selected route)
            |                                                  |
            |--- 1. session.start (protocol_version: "1.0") -->|
            |<-- 2. session.ready (or session.rejected) -------|
            |--- 3. user.message (item_id, input_text) ------->|
            |<-- 4. response.created (response_id) ------------|
            |<-- 5. response.output_text.delta (optional) -----|
            |<-- 6. response.output_text.done (text) ----------|
            |<-- 7. response.done (response_id) ---------------|
            |--- (caller interruption) barge_in -------------->|
            |--- (session end) session.end ------------------->|
```

### Inbound Events (Voice wrapper / Voice Live -> Hosted target)

1. **`session.start`**:
   Sent once after WebSocket upgrade to initialize session state and declare `protocol_version: "1.0"`.
   ```json
   {
     "type": "session.start",
     "id": "m_smoke_start",
     "ts": "2026-10-15T00:00:00Z",
     "protocol_version": "1.0",
     "reconnect": false,
     "response_timeouts": {
       "first_output_ms": 30000,
       "idle_ms": 30000,
       "max_duration_ms": 120000
     }
   }
   ```
   *(Target validates `protocol_version == "1.0"` and replies with `session.ready`, or rejects with `session.rejected` such as `{"type": "session.rejected", "code": "protocol_mismatch", "retriable": false}`.)*

2. **`user.message`**:
   Delivers a finalized caller transcript turn (`item_id` and `content` array of `input_text` parts).
   ```json
   {
     "type": "user.message",
     "id": "m_smoke_user",
     "ts": "2026-10-15T00:00:01Z",
     "item_id": "in_smoke_user",
     "content": [
       { "type": "input_text", "text": "What flights are available to Seattle tomorrow?" }
     ]
   }
   ```

3. **Additional Inbound Control Events (`azure.ai.agentserver.invocations.voice`)**:
   - **`user.no_input`**: Caller silence timeout (`item_id`, `count`).
   - **`user.speech_started`**: Notification that caller speech has started.
   - **`barge_in`**: Caller interrupted playback (`response_id`, `heard_text`); target cancels active generation and reconciles assistant history to `heard_text`.
   - **`response.accepted`** / **`response.dropped`**: Voice Live admission decision (`response_id`) for a proactive response requested by the target.
   - **`response.cancelled`**: Confirms cancellation of a response (`response_id`, `heard_text`).
   - **`response.timeout`**: Response timed out (`response_id`, `item_ids`); target cancels the timed-out operation.
   - **`session.end`**: Ends the Bridge session (`id`, `ts`, `reason`).

### Outbound Events (Hosted target -> Voice wrapper / Voice Live)

1. **`session.ready`** / **`session.rejected`**:
   `session.ready` activates the session after `session.start`. `session.rejected` rejects startup (`code: "protocol_mismatch"` or `"startup_failed"`, `retriable`).

2. **`response.created`**:
   Opens a response (`response_id`, `in_reply_to: [<item_id>]`, or proactive admission fields `admission_timeout_ms`, `supersede_key`).

3. **`response.output_text.delta`** & **`response.output_text.done`**:
   Streams text chunks (`response_id`, `item_id`, `delta`, optional `voice`) and sends the completed item text (`response_id`, `item_id`, `text`, optional `voice`).

4. **`response.done`**:
   Signals that the response (`response_id`) is complete after `response.output_text.done`.

5. **Other Terminal / Control Outbound Events**:
   - **`response.none`**: Declines to reply (`in_reply_to`, `reason` such as `"no_reply_needed"`, `"input_too_large"`, or `"capacity_exceeded"`).
   - **`response.cancel`**: Target requests self-cancellation of an open response (`response_id`, `reason`).
   - **`error`**: Emits an agent/session error (`code`, `message`, optional `response_id`).
   - **`end_call`**: Instructs Voice Live to end the call (`reason`, `mode: "drain"` or `"immediate"`).

---

## Local Protocol Smoke Test

Use the protocol-aware smoke client shipped by the selected conversation-engine sample:

1. Start the selected target with `azd ai agent run <target-service> --no-client`, which exposes `GET /readiness` and the target's local route.
2. Run its smoke client (for example, `uv run --frozen python scripts/smoke_test.py`). It must send:
   - `session.start` (`protocol_version: "1.0"`) -> expects `session.ready`
   - a sample-defined `user.message`
   - the sample's expected `response.created` -> output -> `response.done` sequence
   - Sends `session.end` (`reason: "validation_complete"`)

`azd ai agent invoke` and Agent Inspector do not produce conversation-engine messages. Testing the target directly validates only its Voice Live Bridge `1.0` handler. End-to-end validation must also smoke-test the Voice wrapper over its managed `voice` endpoint (see [Prompt and Hosted Voice smoke testing](prompt-and-hosted-voice-smoke-test.md)).

## Legacy Transport

Use `invocations_ws/1.0.0` only when the user explicitly selects it or the manifest already contains `voiceLiveCompatible: "true"` and `bridgeProtocolVersion: "1.0"`. It uses `/invocations_ws`; preserve that route and metadata on ordinary edits. Migrating legacy code requires an SDK that exposes `/voice_conversation_engine`; changing YAML alone is not universally safe.

---

## Common Hosted Voice Failure Modes

| Symptom / Error | Cause | Fix |
|---|---|---|
| `session.rejected` with `protocol_mismatch` | `session.start` did not declare `protocol_version: "1.0"`, or the target transport declaration is incompatible. | Ensure Bridge messages use `"1.0"` and the target declares exact `voice_conversation_engine/1.0.0`, or the complete legacy protocol plus metadata shape. |
| Wrapper deploys, but connecting to `voice` endpoint fails immediately | `conversationEngine.name` in the `kind: voice` wrapper does not match the `kind: hosted` target service name, or the target container is not running / missing model RBAC (**Cognitive Services OpenAI User**). | Match `conversationEngine.name` to the target service name, deploy the target first, verify RBAC on the parent AI Services account, and check target logs with `azd ai agent monitor`. |
| Wrapper and target overwrite each other in Foundry | Both services share the same `name` in `azure.yaml`. | Give the `kind: hosted` target and `kind: voice` wrapper distinct service keys and distinct `name` values. |
