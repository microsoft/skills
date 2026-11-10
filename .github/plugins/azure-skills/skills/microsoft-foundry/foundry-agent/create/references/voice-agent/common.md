# Voice Agent Common Invariants

Rules shared by GPT-Live Voice, Prompt Voice, and Hosted Voice services in `azure.yaml`. Determine the subtype first with [Voice Agent subtypes](subtypes.md).

## Required Rules

1. Place Voice fields directly under `services.<service-key>`; never use a nested `config:` block.
2. Follow the selected subtype's YAML reference; stop instead of combining subtype-specific shapes.
3. Never use obsolete `modelType: hosted_agent` or `targetAgent`.
4. Keep hosted target and Voice wrapper service keys and `name` values distinct.
5. Preserve existing optional settings and omit optional fields the user did not request. Do not write unused optional fields as `null`.

## Lifecycle Boundaries

- Deploy Voice services with azd.
- Do not invoke a Voice service with `azd ai agent invoke`.
- GPT-Live Voice uses `/protocols/voice/live/sessions?api-version=v1`; never send it through the ordinary `/protocols/voice` helper.
- Prompt Voice has no local container.
- Hosted target testing validates only its Voice Live Bridge handler; the Voice wrapper still requires end-to-end testing over the managed `voice` WebSocket.

Load only the selected subtype reference:

- [GPT-Live Voice YAML](gpt-live-voice-yaml.md)
- [Prompt Voice YAML](prompt-voice-yaml.md)
- [Hosted Voice YAML](hosted-voice-yaml.md)
