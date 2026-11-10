# Prompt Voice YAML

Author a single managed Voice Agent after applying [common invariants](common.md).

## Managed Real-Time Model

`modelType: managed` uses the service-hosted model and does not require a project deployment:

```yaml
services:
  support-voice:
    host: azure.ai.agent
    uses: [ai-project]
    kind: voice
    name: support-voice
    modelType: managed
    model:
      id: gpt-realtime
    instructions: Respond naturally and concisely.
```

## Self-Deployed Model Deployment

For an azd-managed project, `services.<ai-project-service>.deployments[]` is the source of truth and `azd provision` creates or updates the model infrastructure. Prompt Voice references the exact deployment name through `modelType: self_deployed` and `model.id`.

Foundry infers native speech-to-speech versus cascaded STT -> LLM -> TTS from `model.id`; apply the same flow to realtime and text-model BYOM.

First inspect the resolved subscription, resource group, and Foundry account for the exact requested deployment name:

```bash
az cognitiveservices account deployment list --resource-group "<resource-group>" --name "<foundry-account>" --query "[?name=='<deployment-name>'].{name:name,model:properties.model.name,version:properties.model.version,format:properties.model.format,sku:sku.name,capacity:sku.capacity}" --output json
```

Verify that the returned model is compatible with the requested Voice architecture. If it exists, preserve `services.<ai-project-service>.deployments[]`, do not add a duplicate, and reference the exact name:

```yaml
services:
  advisor-voice:
    host: azure.ai.agent
    uses: [ai-project]
    kind: voice
    name: advisor-voice
    modelType: self_deployed
    model:
      id: <existing-deployment-name>
    instructions: Respond naturally and concisely.
```

If the deployment is missing and the user intends creation:

1. Read [Foundry Model Reference](../foundry-model.md) and resolve the exact model version, format, supported SKU/capacity, lifecycle, and available quota. Never guess these values.
2. State the billable/quota-consuming deployment plan and obtain confirmation unless creation was explicit.
3. Preserve existing deployment entries and unrelated infrastructure, then append the resolved deployment to the existing `ai-project` service. Set `model.id` to the exact `deployments[].name`.

```yaml
services:
  ai-project:
    host: azure.ai.project
    deployments:
      - name: <exact-deployment-name>
        model:
          format: <catalog-format>
          name: <catalog-model-name>
          version: "<catalog-model-version>"
        sku:
          name: <supported-sku>
          capacity: <confirmed-capacity>

  advisor-voice:
    host: azure.ai.agent
    uses: [ai-project]
    kind: voice
    name: advisor-voice
    modelType: self_deployed
    model:
      id: <exact-deployment-name>
    instructions: Respond naturally and concisely.
```

> **Illustrative only:** A verified realtime deployment used `gpt-realtime` version `2025-08-28`, `GlobalStandard`, capacity `1`. Re-query the catalog, lifecycle, regional support, and quota before authoring; these values are not universal defaults.

For an existing azd project, edit `deployments[]` in place; do not rerun `azd ai agent init`. Do not use `az cognitiveservices account deployment create`, because it creates infrastructure outside the azd lifecycle. Run `azd provision --preview --no-prompt`, review that only intended model infrastructure changes, then run `azd provision --no-prompt` and deploy the Voice service.

## Optional Configuration

When requested settings require YAML edits, load [Voice Agent YAML settings](prompt-and-hosted-voice-settings.md). Preserve unrelated existing fields and edit only requested paths.

Common defaults include PCM at 24 kHz, Azure Speech transcription, server VAD, and audio output. Omit `voice` unless requested or required by an existing definition so azd applies its default.
