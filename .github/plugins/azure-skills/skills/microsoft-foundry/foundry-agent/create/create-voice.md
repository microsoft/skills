# Create a Microsoft Foundry Voice Agent

Create, configure, or extend a Microsoft Foundry Voice Agent:

- **GPT-Live Voice**: one native Live Voice Agent using `subProtocol: live` and a self-deployed model deployment.
- **Prompt Voice**: one managed Voice Agent using `modelType: managed` or `self_deployed`.
- **Hosted Voice**: a voice-based agent using a hosted text agent as its conversation engine, with a managed **Voice wrapper** (`kind: voice`) and **hosted target** (`kind: hosted`).

For a custom Hosted WebSocket agent with developer-defined frames and no managed Voice wrapper, use [invocations-ws](../invocations-ws/invocations-ws.md), not this workflow.

## Quick Reference

| Decision | GPT-Live Voice | Prompt Voice | Hosted Voice |
|---|---|---|---|
| Foundry agents | One `kind: voice` service | One `kind: voice` service | One hosted target plus one Voice wrapper |
| Reasoning and tools | Native Live service or configured delegation | Voice service | Hosted target |
| Audio and greeting | Native Live service | Voice service | Voice wrapper |
| Local runtime | None | None | Target-only Bridge validation |
| End-to-end invocation | Dedicated `voice/live/sessions` WebSocket | Managed `voice` WebSocket | Managed `voice` WebSocket on the wrapper |

## Step 1: Prerequisite and Context Resolution

Before authoring files or running azd:

1. From the `foundry-agent/create` directory, run the paired preflight scripts:

   ```bash
   ./scripts/check-copilot-app-entry.sh
   ./scripts/verify-environment.sh
   ```

   ```powershell
   .\scripts\check-copilot-app-entry.ps1
   .\scripts\verify-environment.ps1
   ```

   Resolve every `[ACTION]` before continuing. Never run `az login` or `azd auth login` for the user.

2. Set the process-only `agents.voice` preview flag. This is required for Voice Agents:

   ```bash
   export AZD_ALPHA_ENABLE_AGENTS_VOICE=true
   ```

   ```powershell
   $env:AZD_ALPHA_ENABLE_AGENTS_VOICE = "true"
   ```

3. Read [Foundry azd guidance](../azd-guidance/azd-guidance.md) before any azd command.

   Commands below use the repository's neutral `azd ...` form. Execute every azd invocation with the user agent set inline:

   ```bash
   AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd <arguments>
   ```

   ```powershell
   $env:AZURE_DEV_USER_AGENT = "microsoft_foundry_skill"
   azd <arguments>
   ```

   Do not persist `AZURE_DEV_USER_AGENT` with `azd env set`, `.env`, or `azure.yaml`.

4. Follow [Common Project Context Resolution](../../SKILL.md#agent-common-project-context-resolution):
   - Inspect `azure.yaml` and `azd env get-values` when an azd project exists.
   - Classify existing Voice services with [Voice Agent subtypes](references/voice-agent/subtypes.md) before selecting a target. Do not convert an existing Prompt, Hosted, Managed Harness, or Voice Agent into another type.
   - If multiple services exist, ask which GPT-Live Voice, Voice wrapper, or Prompt Voice service to modify. Selecting a Hosted Voice wrapper also selects its named hosted target as a deployment dependency.
   - Resolve an existing project endpoint to its ARM ID with `scripts/resolve-project-id.sh` or `scripts/resolve-project-id.ps1`; never construct the ARM ID from the endpoint.

## Step 2: Model-First Decision and Collected-Values Checkpoint

Before generating `azure.yaml`, scaffolding code, or running init, determine the conversation engine and model strategy from the request and existing project context.

For a generic greenfield request to create a Voice Agent, proceed with **Prompt Voice using the managed real-time model** without requiring a subtype question. State these defaults before authoring:

- `modelType: managed`
- `model.id: gpt-realtime`
- canonical authored `kind: voice`

Classify existing or requested Voice services with [Voice Agent subtypes](references/voice-agent/subtypes.md) before resolving subtype-specific model strategy.

Resolve model strategy from deployment intent, not from the presence of a model name:

- Explicit GPT-Live Voice intent selects `modelType: self_deployed` and the self-deployed model Golden Path. A request for `gpt-live-1` is GPT-Live Voice intent, not the managed Prompt Voice model-name-only case.
- A model name alone, including a model name plus a project endpoint or name, uses managed Prompt Voice (`modelType: managed`) and does not create a project model deployment, unless the request explicitly identifies GPT-Live Voice or `gpt-live-1`.
- Explicit lifecycle wording selects self-deployed Prompt Voice: BYOM, self-deployed, project model deployment, existing deployment, deployment name, create/deploy/provision the model, create if missing/not found, ensure the deployment exists, or inspect/select its version, SKU, capacity, or quota. For example, "Use `gpt-realtime`; create it if it does not exist" is sufficient self-deployed intent.
- Explicit user choice overrides inference. Ask one focused clarification only when signals conflict, such as requesting both managed/service-hosted behavior and creation or provisioning of a deployment.

Before authoring, state the resolved interpretation. For managed Prompt Voice intent, state that no project deployment will be created. For GPT-Live Voice or self-deployed Prompt Voice provisioning intent, state that the workflow will verify the deployment, add it to `services.<ai-project-service>.deployments[]` if missing, provision it through azd, and use `modelType: self_deployed`.

Ask only when another unresolved requirement materially changes the architecture:

- custom code, an existing hosted text agent, or explicit Hosted Voice intent;
- an existing project or codebase whose services imply a subtype but do not identify the target clearly;
- a planning, explanation, or comparison request that explicitly asks to evaluate the available approaches.

For planning or comparison, explain GPT-Live Voice, Prompt Voice managed, Prompt Voice self-deployed, Hosted Voice, and custom raw `invocations_ws` without creating files or running azd.

For GPT-Live Voice, detect requested optional settings or existing settings that must be preserved. Do not apply ordinary Voice Live or Hosted Voice settings.

For Prompt Voice and Hosted Voice, detect requested Voice Agent settings or existing settings that must be preserved, including structured inputs, audio, transcription, turn detection, voice, greeting/avatar, tools, handoff, response options, storage, or telephony. Do not ask about settings the user did not request.

When Twilio telephony is explicitly requested, follow the remote connection and binding flow in [Voice Agent YAML settings](references/voice-agent/prompt-and-hosted-voice-settings.md). Ask only for a missing connection name, Account SID, Auth Token availability, or Twilio number; never ask for the token in chat.

For explicit ACS or Teams Phone extensibility (TPE) requests, follow the TPE/ACS section in [Voice Agent YAML settings](references/voice-agent/prompt-and-hosted-voice-settings.md); do not automate infrastructure, RBAC, webhooks, or Event Grid.

Resolve values from the request, workspace, `azure.yaml`, and active azd environment before asking. Do not author files until this checkpoint is complete:

| Value | Resolution rule |
|---|---|
| Voice subtype | Default a generic greenfield request to managed Prompt Voice; ask only for the architecture-changing cases above |
| Agent name | Reuse the selected service name; otherwise collect or derive a concise name |
| Foundry project | Confirm new versus existing; never provision implicitly |
| Existing project identity | Resolve both endpoint and ARM ID; pass the ARM ID to `--project-id` |
| azd environment | Reuse the selected environment or collect the intended environment |
| Model strategy | GPT-Live Voice is always self-deployed; otherwise use managed for a model name alone and self-deployed for explicit deployment lifecycle intent |
| Model/deployment name | For GPT-Live Voice, inspect for the exact compatible deployment and default the canonical new example to `gpt-live-1`; default managed Prompt Voice to `gpt-realtime` |
| Delegation | For GPT-Live Voice, preserve or collect `client`, `responses`, or `foundry_managed_agent` and only its discriminator-compatible nested fields |
| Instructions | Preserve existing instructions or collect the requested behavior |
| Output voice | Preserve an existing value or use the user's requested voice; otherwise omit it and use the azd default |

State every applied default clearly before authoring.

## Step 3: Load Only the Selected Authoring Reference

Always read [Voice Agent subtypes](references/voice-agent/subtypes.md) and [Voice Agent common invariants](references/voice-agent/common.md).

- For **GPT-Live Voice**, read [GPT-Live Voice YAML](references/voice-agent/gpt-live-voice-yaml.md).
- For **Prompt Voice**, read [Prompt Voice YAML](references/voice-agent/prompt-voice-yaml.md).
- For **Hosted Voice**, read [Hosted Voice YAML](references/voice-agent/hosted-voice-yaml.md) and [Hosted Voice Bridge `1.0`](references/voice-agent/hosted-voice-bridge.md).
- For Prompt Voice or Hosted Voice settings, read [Voice Agent YAML settings](references/voice-agent/prompt-and-hosted-voice-settings.md).

Do not load the other subtype's YAML reference unless the user asks for a comparison or migration.

Before editing settings, map every requested field to the GPT-Live Voice service, Prompt Voice service, Voice wrapper, or hosted target using the selected reference. Preserve unrelated existing fields and edit only the requested YAML paths.

## Step 4: Initialize or Update

### GPT-Live Voice

For a new project:

```bash
azd ai agent init --no-prompt \
  --kind prompt-voice \
  --agent-name "<agent-name>" \
  --model gpt-live-1
```

For an existing Foundry project:

```bash
azd ai agent init --no-prompt \
  --kind prompt-voice \
  --agent-name "<agent-name>" \
  --project-id "<project-arm-id>" \
  --model gpt-live-1
```

Enter the generated project directory. The generated service is a small declarative Prompt Voice shape with `kind: prompt-voice`, `modelType: managed`, `model.id`, and project/description metadata. Follow [GPT-Live Voice YAML](references/voice-agent/gpt-live-voice-yaml.md): normalize `kind: prompt-voice` to `kind: voice`, add `subProtocol: live`, set `modelType: self_deployed`, set `model.id` to the exact deployment name, and apply requested instructions, settings, and delegation.

For an existing azd project or service, edit it in place instead of rerunning init and creating a duplicate.

Before deploy:

1. Keep `subProtocol: live` and `modelType: self_deployed`.
2. Follow the GPT-Live Voice reference's self-deployed model Golden Path for `model.id` and any Responses delegation backend.
3. Preserve requested or existing optional configuration using the selected GPT-Live Voice YAML reference.

### Prompt Voice

For a new project:

```bash
azd ai agent init --no-prompt \
  --kind prompt-voice \
  --agent-name "<agent-name>" \
  --model "<model-name>"
```

For an existing Foundry project:

```bash
azd ai agent init --no-prompt \
  --kind prompt-voice \
  --agent-name "<agent-name>" \
  --project-id "<project-arm-id>" \
  --model "<model-name>"
```

Add `--voice "<voice-name>"` only when the user explicitly requests a voice. Otherwise allow azd to apply its default. `--kind prompt-voice` does not accept Hosted/runtime flags or `--model-deployment`. For a new self-deployed Prompt Voice service, initialize once, then follow the Golden Path below and [Prompt Voice YAML](references/voice-agent/prompt-voice-yaml.md).

Immediately after init, normalize the generated service to canonical `kind: voice` if azd wrote `kind: prompt-voice`, alongside the other generated-YAML edits.

For `modelType: self_deployed`, follow this Golden Path:

1. Inspect the selected Foundry account for the exact deployment name. If a compatible deployment exists, set `model.id` to that exact name and do not add a duplicate deployment entry.
2. If it is missing and the user intends creation, read [Foundry Model Reference](references/foundry-model.md), resolve the exact model version, format, supported SKU/capacity, lifecycle, and quota, and state the planned billable/quota-consuming deployment. If creation was not explicit, obtain confirmation.
3. Preserve existing project infrastructure and deployment entries, append the deployment under `services.<ai-project-service>.deployments[]`, and set `model.id` to the exact `deployments[].name`. Use this path for both realtime and cascaded/text-model BYOM; Foundry infers the pipeline from `model.id`.
4. Run `azd provision --preview --no-prompt`, confirm the preview changes only the intended model infrastructure, then run `azd provision --no-prompt`. Deploy the Voice service only after provisioning succeeds.

For an existing Prompt Voice service or an added model in an existing azd project, edit `azure.yaml` in place. Do not rerun init and create a suffixed duplicate. Do not use `az cognitiveservices account deployment create`; `azure.yaml` is the source of truth for azd-managed model infrastructure.

### Hosted Voice

Use the official Hosted Voice manifest when starting from the sample:

```bash
azd ai agent init --no-prompt \
  -m "https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/bring-your-own/voice-agent-target-agent/basic/azure.yaml"
```

Add `--project-id "<project-arm-id>"` when using an existing project. For existing target code, preserve the target service and add or update the wrapper using [Hosted Voice YAML](references/voice-agent/hosted-voice-yaml.md); do not replace it with a Prompt Voice definition.

After init, enter the generated project directory before setting subscription, region, project name, endpoint, or model values. Do not chain `azd env set` to the init command.

## Step 5: Local Validation

- **GPT-Live Voice** has no local container. Continue to deploy.
- **Prompt Voice** has no local container. Continue to deploy.
- **Hosted Voice** must validate the target's Bridge handler locally before deployment. Follow [local run](references/local-run.md) and [Hosted Voice Bridge `1.0`](references/voice-agent/hosted-voice-bridge.md). Target-only validation does not replace an end-to-end wrapper smoke test.

## Step 6: Deploy and Verify

Follow [deploy](../deploy/deploy.md), then [invoke](../invoke/invoke.md).

Voice services do not support `azd ai agent invoke`.

- For **GPT-Live Voice**, run the dedicated helper in [GPT-Live Voice smoke testing](references/voice-agent/gpt-live-voice-smoke-test.md). The gate verifies the deployed version and clean Live session lifecycle. Never use the ordinary Voice helper or `/protocols/voice`.
- For **Prompt Voice** and **Hosted Voice**, use the two-stage process in [Voice smoke testing](references/voice-agent/prompt-and-hosted-voice-smoke-test.md): run the managed Voice WebSocket helper, then provide the Playground URL for manual acceptance.

For Prompt Voice and Hosted Voice, run the helper from the `microsoft-foundry` skill root:

```bash
./foundry-agent/create/scripts/smoke-test-voice.sh \
  --endpoint "$AZURE_AI_PROJECT_ENDPOINT" \
  --agent-name "<voice-agent-name>" \
  --text "Hello, briefly introduce yourself." \
  --timeout 180
```

```powershell
.\foundry-agent\create\scripts\smoke-test-voice.ps1 `
  -Endpoint $env:AZURE_AI_PROJECT_ENDPOINT `
  -AgentName "<voice-agent-name>" `
  -Text "Hello, briefly introduce yourself." `
  -Timeout 180
```

The final handoff must distinguish the results: report deployed/active status and whether automated technical verification passed, provide the Foundry Portal or Agent Playground URL, and recommend the subtype-appropriate manual acceptance. For GPT-Live Voice, test microphone, full-duplex behavior, interruption, voice quality, and latency. For Prompt Voice and Hosted Voice, also test STT and VAD/turn-taking. Do not claim that manual validation was completed automatically.

## Error Handling

| Error | Resolution |
|---|---|
| Project choice is unresolved | Stop and ask for a new or existing project before init or provision |
| Existing endpoint has no ARM ID | Resolve it with the paired `resolve-project-id` script |
| Init would duplicate an existing service | Edit the existing Voice service in place |
| GPT-Live Voice model or Responses backend deployment is missing | Reuse an existing compatible deployment or, when creation is intended, follow the self-deployed model Golden Path and provision through `azure.yaml` |
| GPT-Live Voice is sent to `/protocols/voice` or the ordinary helper | Use `/protocols/voice/live/sessions?api-version=v1` and the GPT-Live Voice session smoke helper |
| Prompt Voice model deployment is missing | Do not author `model.id` alone. Reuse a compatible existing deployment, or confirm creation and follow the `deployments[]` preview/provision Golden Path |
| Hosted target fails locally | Fix the hosted target's Bridge handler before deploying the Voice wrapper |
| `azd ai agent invoke` rejects Voice | Use the subtype-specific WebSocket verification path or Foundry Voice playground |
