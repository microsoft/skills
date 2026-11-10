# Hosted Voice YAML

Author a voice-based agent that uses a hosted text agent as its conversation engine. Apply [common invariants](common.md) and the [Voice Live Bridge `1.0` contract](hosted-voice-bridge.md).

## Ownership

| Service | Owns |
|---|---|
| Hosted target (`kind: hosted`) | Model calls, instructions, tools, bounded history, Voice Live Bridge handler |
| Managed Voice wrapper (`kind: voice`) | Audio, VAD, transcription, synthesis, greeting, managed Voice endpoint |

## Minimal Shape

```yaml
services:
  travel-target:
    project: src/travel-target
    host: azure.ai.agent
    uses: [ai-project]
    kind: hosted
    name: travel-target
    language: python
    codeConfiguration:
      entryPoint: main.py
      runtime: python_3_13
    env:
      AZURE_AI_MODEL_DEPLOYMENT_NAME: ${AZURE_AI_MODEL_DEPLOYMENT_NAME}
    protocols:
      - protocol: invocations_ws
        version: 1.0.0
    metadata:
      voiceLiveCompatible: "true"
      bridgeProtocolVersion: "1.0"

  travel-voice:
    host: azure.ai.agent
    uses: [ai-project, travel-target]
    kind: voice
    name: travel-voice
    conversationEngine:
      type: hosted_agent
      name: travel-target
    greeting:
      type: template
      text: Hello! How can I help?
    outputModalities: [audio]
```

`conversationEngine.version` is optional; the only supported value is `deployed`, which is also the default when omitted.

The wrapper must omit target-owned fields such as `model`, `modelType`, `instructions`, `tools`, `protocols`, `codeConfiguration`, environment settings, and session policies.

When requested wrapper settings require YAML edits, load [Voice Agent YAML settings](prompt-and-hosted-voice-settings.md). Preserve unrelated existing wrapper fields, keep target and wrapper names distinct, and deploy the target before or together with the wrapper.
