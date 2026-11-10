# Voice Agent YAML Settings

For requested/preserved Prompt Voice and Hosted Voice settings. Use `kind: voice`; preserve unrelated fields. Do not apply this reference to GPT-Live Voice; use [GPT-Live Voice YAML](gpt-live-voice-yaml.md), whose native Live authoring surface is intentionally separate.

| Owner | Settings |
|---|---|
| Prompt Voice | Model, instructions, inputs, audio, tools, behavior, data, telephony |
| Hosted wrapper | Audio/voice, `structuredInputs`, greeting, `outputModalities`/avatar, `store`, `parallelToolCalls`, `maxOutputTokens`, `include` |
| Hosted target | Model, instructions, tools, logic |

Hosted wrappers must omit target/runtime-owned `model`, `modelType`, `instructions`, `tools`, `toolChoice`, `policies`, `protocols`, `codeConfiguration`, `sessionConfiguration`, and environment fields.

## Advanced Settings

```yaml
structuredInputs: { persona: { description: Persona, defaultValue: Ada } }

audio:
  input:
    format: { type: audio/pcm, rate: 24000 }
    noiseReduction: { type: near_field }
    echoCancellation: { type: server_echo_cancellation, channels: 1 }
    transcription: { model: azure-speech, language: en-US, prompt: Terms }
    turnDetection: { type: server_vad, threshold: 0.6, prefixPaddingMs: 300,
      silenceDurationMs: 500, createResponse: true, eagerness: <value>,
      speechDurationMs: 120, removeFillerWords: true, interruptResponse: true,
      languages: [en-US], autoTruncate: true }
  output:
    format: { type: audio/pcm, rate: 24000 }
    voice: { type: azure-standard, name: <voice-name>,
             style: cheerful, pitch: "+0Hz", locale: en-US, volume: "+0%" }
    speed: 1.1
```

`defaultValue` maps to wire `default_value`. Defaults: PCM/24000, `server_vad`, `azure-speech`, `[audio]`, azd voice.

### Known Authoring Values and Constraints

| Setting | Values / constraints |
|---|---|
| `audio.*.format` | `audio/pcm` requires `rate: 24000`; `audio/pcmu` and `audio/pcma` must omit `rate`. |
| `audio.input.turnDetection` | Known `type` values: `server_vad`, `semantic_vad`, `azure_semantic_vad` (schema is open, not an enum). `threshold`: >0 and <=1. `prefixPaddingMs`, `silenceDurationMs`, `speechDurationMs`: nonnegative integers. `createResponse`, `removeFillerWords`, `interruptResponse`, `autoTruncate`: booleans. `languages`: string array. Known service `eagerness`: `auto`, `low`, `medium`, `high` (schema is open). |
| `audio.input.noiseReduction` | Nonblank `type`; known values: `near_field`, `far_field`, `azure_deep_noise_suppression` (schema is open). |
| `audio.input.transcription` | `model`, `language`, `prompt`: strings. Known phrase-compatible models: `azure-speech`, `azure-fast-transcription`; `include: [item.input_audio_transcription.phrases]` requires one. Do not author `phraseList`; azd doesn't support it. |
| `audio.output.voice` | Nested shape requires nonblank `type` and `name`; source-known types: `azure-standard` / `azure_standard`, `openai`. Nonempty legacy `voice.rate` is rejected; use `audio.output.speed`. |
| `audio.output.speed` | 0.25-1.5. |
| Responses | `outputModalities` must be nonempty; known values: `audio`, `text`, `animation`, `avatar`. `maxOutputTokens`: integer 1-2147483647 or `inf`. `parallelToolCalls` is a boolean for Prompt Voice and Hosted Voice wrappers. GPT-Live Voice root definitions reject it; GPT-Live Responses delegation is documented separately. |
| Telephony | Prompt Voice providers: `twilio`, `acs`; each binding requires provider, identifier, connection. Twilio identifier: `+<E.164>`; ACS/TPE identifier: `28:orgid:<guid>`. |

### Behavior and Responses

```yaml
greeting: { type: template, text: "Hello {{persona}}" }
outputModalities: [audio, text]
avatar: { type: video_avatar, character: lisa, output_protocol: webrtc }
tools: [{ type: system, name: end_conversation }]
toolChoice: auto
parallelToolCalls: true
maxOutputTokens: inf # or integer 1-2147483647
include: [item.input_audio_transcription.phrases]
```

Preserve opaque maps.

## Data Persistence

`store` defaults false; true persists transcript, events, audio. Preserve explicit values.

## Telephony Bindings

**Twilio:** If a connection is supplied, show/list without credentials and verify kind `Twilio`, auth `ApiKey`, and known SID target. Otherwise resolve name (default `telephony-twilio`), SID, token availability, and owned voice-capable E.164 number; create before deployment:

```bash
AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd ai connection create "$CONNECTION_NAME" \
  --kind Twilio --target "$TWILIO_ACCOUNT_SID" --auth-type api-key \
  --key "$TWILIO_AUTH_TOKEN" --project-endpoint "$AZURE_AI_PROJECT_ENDPOINT" --no-prompt
```

```powershell
$env:AZURE_DEV_USER_AGENT = "microsoft_foundry_skill"
azd ai connection create $ConnectionName `
  --kind Twilio --target $env:TWILIO_ACCOUNT_SID --auth-type api-key `
  --key $env:TWILIO_AUTH_TOKEN --project-endpoint $env:AZURE_AI_PROJECT_ENDPOINT --no-prompt
```

Arguments can be locally visible; use the portal if concerned. Verify via `connection show ... --output json`, never `--show-credentials`. Bind:

```yaml
telephony:
  bindings:
    - provider: twilio
      identifier: "+14255550123"
      connection: telephony-twilio
      transferTargets:
        - name: support
          description: Transfer the caller to support.
          destination: { kind: pstn, value: "+14255550124" }
```

Token: process environment only, never YAML/chat/summaries. Connection must preexist deploy. azd doesn't create accounts, buy/discover numbers, or prove routing; test a call.

Bindings require `provider`, `identifier`, and `connection`; `transferTargets` is optional. Omit it to leave the existing singleton transfer targets unmanaged, or set `transferTargets: []` to manage the set as empty. When present, each item requires `name`, a nonblank `description`, and `destination`. Destination kinds:

- `pstn`: `value` is `+<E.164>`.
- `teams`: `value` is a canonical GUID or `28:orgid:<guid>`.
- `sip`: `value` is a valid `sip:` or `sips:` URI with `user@host`.

Names in the effective target set must be unique case-insensitively. Descriptions are limited to 1024 UTF-16 code units; destination values, including SIP URIs, are limited to 2048.

### Teams Phone extensibility (TPE) / ACS

For an explicit [Teams Phone extensibility (TPE)](https://learn.microsoft.com/en-us/azure/communication-services/concepts/interop/tpe/teams-phone-extensibility-overview) or ACS request, reuse a supplied TPE/ACS connection only after checking category `AzureCommunicationServices`, ACS endpoint, and available `metadata.ResourceId`. The azd compatibility authoring value is `provider: acs`; bind a TPE resource account:

```yaml
telephony:
  bindings:
    - provider: acs
      identifier: "28:orgid:<resource-account-object-id>"
      connection: <acs-connection-name>
```

Legacy ACS purchased-number identifiers such as `4:+<E.164>` are rejected by authoring validation. If no compatible TPE/ACS connection exists, don't create it with azd or automate RBAC/Event Grid/TPE setup. Use the [guide](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/voice-agent-telephony-channels) and **Foundry portal → Voice Agent → Channels → Phone numbers → Add a number → Microsoft Teams**; the portal coordinates the ACS connection, project identity, TPE resource account, secure webhook/Event Grid, and TPE telephony binding. Test a real call; WebSocket smoke doesn't validate telephony.
