# Voice Agent WebSocket Smoke-Test Reference

How to verify a deployed Microsoft Foundry Voice Agent — either a **Prompt Voice Agent** or a **Hosted Voice wrapper** — over the managed Foundry `voice` WebSocket endpoint.

This helper does not support GPT-Live Voice. For that subtype, use [GPT-Live Voice smoke testing](gpt-live-voice-smoke-test.md).

> **Why not `azd ai agent invoke`?**
> `azd ai agent invoke` does not support Voice Agents. Always verify them over the managed `voice` WebSocket endpoint or in the Microsoft Foundry portal (`https://ai.azure.com`). You can inspect the deployed endpoint URL with `azd ai agent endpoint show <voice-service>`.

---

## Two-Stage Verification Boundary

### 1. Automated Smoke Test — Technical Deployment Gate

The bundled text-driven managed Voice WebSocket client validates:

- Entra authentication and WebSocket endpoint/session establishment.
- The requested user turn, not only an optional greeting.
- Prompt Voice reasoning, or the Hosted Voice wrapper-to-target Bridge path where applicable.
- A completed response with non-empty transcript and synthesized audio payload.
- An optional deterministic transcript marker.

It does **not** validate microphone capture, real spoken-input STT quality, VAD/turn-taking behavior, barge-in/interruption, playback or voice quality, browser/device behavior, or perceived latency.

### 2. Foundry Portal — Manual Audio-to-Audio Experience Acceptance

After the automated gate passes, use the Voice Agent Playground URL from `azd ai agent show --output json` and recommend a manual session in the Foundry portal. The user should test microphone input, STT, VAD and turn-taking, interruption, audio playback and voice quality, browser/device behavior, and perceived latency.

Report automated verification and manual acceptance separately. Never claim the portal-only properties were validated by the smoke helper or that the manual step was completed unless the user actually performed it.

---

## Managed `voice` WebSocket Endpoint Contract

- **URL format**:
  ```text
  wss://<project-host>/api/projects/<project>/agents/<voice-agent-name>/endpoint/protocols/voice?api-version=v1&agent_session_id=<session-id>
  ```
  Derived from `AZURE_AI_PROJECT_ENDPOINT` / `FOUNDRY_PROJECT_ENDPOINT` (`https://<project-host>/api/projects/<project>`).
- **Headers**:
  - `Authorization`: Entra access token for resource `https://ai.azure.com` (`az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv`), formatted dynamically as `"{} {}".format("Bearer", token)`. Never hard-code tokens or API keys in scripts or commits.
  - `Foundry-Features: VoiceAgents=V1Preview`
- **Target agent name**:
  - For **Prompt Voice**: pass the Voice Agent's `name`.
  - For **Hosted Voice**: pass the **`kind: voice` wrapper's** `name` (not the `kind: hosted` target's name) to test the full end-to-end Voice pipeline.

---

## Prerequisites

Install `websockets` in your Python environment and ensure Azure credentials are already available. The helper tries Azure CLI first and optionally falls back to `DefaultAzureCredential` when `azure-identity` is installed.

```bash
python -m pip install websockets
```

---

## Running the Smoke-Test Helper Scripts

Run the paired helper scripts from the `microsoft-foundry` skill root (`plugins/azure-skills/skills/microsoft-foundry`):
- Bash: [../../scripts/smoke-test-voice.sh](../../scripts/smoke-test-voice.sh)
- PowerShell: [../../scripts/smoke-test-voice.ps1](../../scripts/smoke-test-voice.ps1)

Both wrappers launch the shared [Python client](../../scripts/smoke_test_voice.py), which owns authentication, protocol handling, response validation, and JSON output.

Note that PowerShell uses PascalCase parameter names (`-Endpoint`, `-AgentName`, `-Text`, `-ExpectedMarker`, `-Timeout`, `-OutputAudio`, `-DryRun`, `-Help`), whereas Bash uses kebab-case flags (`--endpoint`, `--agent-name`, `--text`, `--expected-marker`, `--timeout`, `--output-audio`, `--dry-run`, `--help`).

### 1. Preview / Dry Run (no network connection)

**Bash**
```bash
./foundry-agent/create/scripts/smoke-test-voice.sh \
  --endpoint "https://<account>.services.ai.azure.com/api/projects/<project>" \
  --agent-name "<voice-agent-name>" \
  --dry-run
```

**PowerShell**
```powershell
.\foundry-agent\create\scripts\smoke-test-voice.ps1 `
  -Endpoint "https://<account>.services.ai.azure.com/api/projects/<project>" `
  -AgentName "<voice-agent-name>" `
  -DryRun
```

### 2. Live Smoke Test (connect, drain optional greeting, send typed turn, verify completed transcript + base64 audio)

**Bash**
```bash
./foundry-agent/create/scripts/smoke-test-voice.sh \
  --endpoint "$AZURE_AI_PROJECT_ENDPOINT" \
  --agent-name "<voice-agent-name>" \
  --text "In one short sentence, introduce yourself." \
  --timeout 180
```

**PowerShell**
```powershell
.\foundry-agent\create\scripts\smoke-test-voice.ps1 `
  -Endpoint $env:AZURE_AI_PROJECT_ENDPOINT `
  -AgentName "<voice-agent-name>" `
  -Text "In one short sentence, introduce yourself." `
  -Timeout 180
```

When testing a Hosted Voice Agent running the official `voice-live-bridge-basic-python` target (or any agent with a deterministic response), pass `--expected-marker` / `-ExpectedMarker` (for example, `--text "/help" --expected-marker "Commands:"`) to assert that the returned transcript matches the requested turn rather than a greeting.

### Exit Codes

| Exit Code | Meaning |
|---|---|
| `0` | Smoke test passed (`response.done` for the uniquely tagged requested response with `response.status == "completed"`, non-empty matching `response.output_audio_transcript.delta`/`done`, non-empty matching base64 `response.output_audio.delta`, and optional `--expected-marker` / `-ExpectedMarker` matched) or `--dry-run` / `--help` succeeded |
| `1` | Smoke test failed (authentication error, WebSocket `error` frame, non-`completed` status, empty transcript, missing expected marker, zero audio deltas, timeout, or missing `websockets` package) |
| `2` | Usage or argument validation error (missing `--endpoint`/`-Endpoint`, missing `--agent-name`/`-AgentName`, invalid `--timeout`/`-Timeout`, or unknown option) |

---

## Verified Wire Event Sequence

1. **Connect & Authenticate**: Connects to `.../agents/<agent>/endpoint/protocols/voice?api-version=v1&agent_session_id=<id>` with `Foundry-Features: VoiceAgents=V1Preview` and an Entra token for `https://ai.azure.com` (resolved via `shutil.which("az.cmd" if os.name == "nt" else "az") or "az"` with `DefaultAzureCredential` fallback).
2. **Wait for `session.updated` and Optional Greeting**:
   - Waits for `session.updated`, then applies a short `1.0s` greeting-detection grace interval.
   - If a greeting response (`response.created` / `response.output_*`) starts before or during the grace window, drains the entire greeting through its `response.done` without recording greeting transcript/audio as the requested turn.
   - If no greeting begins during the grace window (such as on a no-greeting Prompt Voice agent), proceeds immediately after the grace timeout.
3. **Send Typed Turn**:
   - Sends `{"type": "conversation.item.create", "item": {"type": "message", "role": "user", "content": [{"type": "input_text", "text": "<prompt>"}]}}`
   - Sends `response.create` with a unique metadata marker for the smoke-test turn.
4. **Consume & Verify Requested Turn Output**:
   - Captures the marked `response.created` ID and ignores greeting or unrelated response events.
   - Collects transcript text only from matching `response.output_audio_transcript.delta` (`delta`) and `response.output_audio_transcript.done` (`transcript`).
   - Counts base64 audio payload characters only from matching `response.output_audio.delta` (`delta`).
   - Fails immediately on any `error` event, if `response.done` reports `response.status != "completed"`, if transcript/audio is empty, or if `--expected-marker` / `-ExpectedMarker` is absent from the transcript.
   - Emits JSON containing `agent`, `prompt_text`, `response_id`, `status`, `transcript`, `audio_base64_characters`, `event_types`, and optional `expected_marker`.
