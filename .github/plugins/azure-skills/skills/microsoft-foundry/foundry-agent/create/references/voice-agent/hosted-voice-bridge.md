# Voice Live Bridge `1.0` for Hosted Voice

A Hosted Voice configuration is a voice-based agent using a hosted text agent as its conversation engine. It pairs a managed **Voice wrapper** (`kind: voice`) with a **hosted target** (`kind: hosted`). The hosted target implements Voice Live Bridge Protocol `1.0` over `invocations_ws`.

## Two-Agent Ownership Model

| Concern | Hosted target (`kind: hosted`) | Managed Voice wrapper (`kind: voice`) |
|---|---|---|
| **Role** | Reasoning, tools, bounded conversation history, model calls (e.g., Foundry Responses API with `store=false`) | Audio pipeline (VAD, STT, TTS, barge-in interruption, proactive admission), greeting, managed `voice` WebSocket endpoint |
| **Protocol & Route** | `invocations_ws` (`version: 1.0.0`) on `/invocations_ws` (port `8088` + `GET /readiness`) speaking Voice Live Bridge Protocol `1.0` | Foundry `voice` protocol (`?api-version=v1`) |
| **Required metadata / link** | `metadata: { voiceLiveCompatible: "true", bridgeProtocolVersion: "1.0" }` directly on the service block | `uses: [ai-project, <target-service>]` and `conversationEngine: { type: hosted_agent, name: <target-service> }` directly on the service block |
| **Model & instructions** | Configured in target (`env: { AZURE_AI_MODEL_DEPLOYMENT_NAME: ... }` + container code) | **Forbidden** on wrapper (`model`, `modelType`, `instructions`, `tools`, `protocols`, `codeConfiguration` must be omitted) |
| **Agent name** | Distinct `<target-name>` | Distinct `<wrapper-name>` |

---

## Voice Live Bridge Protocol `1.0` Event Flow

The Voice wrapper's Voice Live layer connects to the hosted target over `/invocations_ws` (`ws://127.0.0.1:8088/invocations_ws` locally) and exchanges lowercase dotted JSON events conforming to `protocol_version: "1.0"`. The hosted target **never** processes raw audio frames—Voice Live handles audio input, speech recognition, turn detection, synthesis, playback interruption, and proactive-response admission.

```text
Voice wrapper / Voice Live layer                Hosted target (`/invocations_ws`)
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

## Local Protocol Smoke Test (`/help` Sequence)

The official `voice-live-bridge-basic-python` sample includes `scripts/smoke_test.py`, which sends `/help` over `ws://127.0.0.1:8088/invocations_ws` to validate the Bridge `1.0` wire flow without calling a model:

1. Start the target server locally on port `8088` (`uv run --no-sync python main.py` or `azd ai agent run`), which exposes `GET /readiness` and `/invocations_ws`.
2. Run the local protocol smoke client (`uv run --no-sync python scripts/smoke_test.py`), which sends:
   - `session.start` (`protocol_version: "1.0"`) -> expects `session.ready`
   - `user.message` (`item_id: "in_smoke_user"`, `content: [{"type": "input_text", "text": "/help"}]`)
   - Expects exact frame sequence: `response.created` -> `response.output_text.done` -> `response.done`
   - Sends `session.end` (`reason: "validation_complete"`)

> **Important**: Testing the hosted target directly over `/invocations_ws` validates only its Voice Live Bridge `1.0` handler. End-to-end validation must also smoke-test the Voice wrapper over its managed `voice` endpoint (see [Prompt and Hosted Voice smoke testing](prompt-and-hosted-voice-smoke-test.md)).

---

## Common Hosted Voice Failure Modes

| Symptom / Error | Cause | Fix |
|---|---|---|
| `session.rejected` with `protocol_mismatch` | `session.start` did not declare `protocol_version: "1.0"`, or target `azure.yaml` is missing `protocols: [{ protocol: invocations_ws, version: 1.0.0 }]` / `metadata: { voiceLiveCompatible: "true", bridgeProtocolVersion: "1.0" }`. | Ensure `session.start` sends `protocol_version: "1.0"`, verify target `azure.yaml` metadata/protocols, and verify the target replies with `session.ready`. |
| Wrapper deploys, but connecting to `voice` endpoint fails immediately | `conversationEngine.name` in the `kind: voice` wrapper does not match the `kind: hosted` target service name, or the target container is not running / missing model RBAC (**Cognitive Services OpenAI User**). | Match `conversationEngine.name` to the target service name, deploy the target first, verify RBAC on the parent AI Services account, and check target logs with `azd ai agent monitor`. |
| Wrapper and target overwrite each other in Foundry | Both services share the same `name` in `azure.yaml`. | Give the `kind: hosted` target and `kind: voice` wrapper distinct service keys and distinct `name` values. |
