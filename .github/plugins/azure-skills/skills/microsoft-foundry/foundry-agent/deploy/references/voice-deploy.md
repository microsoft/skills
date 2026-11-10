# Voice Agent Deployment

Voice Agents are deployed through `azd`. First read [Voice Agent subtypes](../../create/references/voice-agent/subtypes.md), [create-voice](../../create/create-voice.md), [common Voice invariants](../../create/references/voice-agent/common.md), and the selected subtype reference linked from the creation workflow.

## 1. Resolve and Validate

Use the selected subtype. For Hosted Voice, include both the Voice wrapper and its named hosted target in scope.

```bash
azd env get-values
azd ai project show --output json
azd ai agent show --output json
```

## 2. Provision When Required

Respect the project-selection gate: if no Foundry project endpoint is configured and the user has not asked to create one, stop and ask. Run `azd provision --no-prompt` when creating a project or provisioning Voice model deployments, Responses delegation backend deployments, or ACR infrastructure. For GPT-Live Voice, follow the selected YAML reference's self-deployed model Golden Path before deployment.

## 3. Deploy

GPT-Live Voice or Prompt Voice:

```bash
azd deploy <voice-service-name> --no-prompt
```

Hosted Voice: deploy the `kind: hosted` target before or together with the `kind: voice` wrapper:

```bash
azd deploy <target-service-name> --no-prompt
azd deploy <wrapper-service-name> --no-prompt
```

Alternatively, run `azd deploy --no-prompt` to deploy all services in dependency order.

## 4. Verify in Two Stages

1. Use the selected local `azure.yaml` service key for deployment readback:

   ```bash
   azd ai agent show "<voice-service-key>" --output json
   azd ai agent endpoint show "<voice-service-key>" --output json
   ```

   Verify `agent show` reports `active` or `deployed` and the expected subtype definition. Verify `endpoint show` uses `api-version=v1` and the subtype path:
   - GPT-Live Voice: `/endpoint/protocols/voice/live/sessions`
   - Prompt Voice or Hosted Voice wrapper: `/endpoint/protocols/voice`

   For Hosted Voice, report target and wrapper status separately; run endpoint verification against the wrapper service key. These `show` commands use the local service key. The smoke helper uses the resolved remote agent name returned by deployment/readback when it differs.
2. Do not run `azd ai agent invoke`; it does not support the `voice` protocol. Do not use generic `azd ai agent eval generate` as a Voice smoke test; transcript evaluation has separate limits in [observe](../../observe/observe.md).
3. **Automated technical gate:** for GPT-Live Voice, run the dedicated helper from [GPT-Live Voice smoke testing](../../create/references/voice-agent/gpt-live-voice-smoke-test.md) over `/protocols/voice/live/sessions`; the default gate verifies session startup and clean closure. For Prompt Voice and Hosted Voice, run [smoke-test-voice.sh](../../create/scripts/smoke-test-voice.sh) or [smoke-test-voice.ps1](../../create/scripts/smoke-test-voice.ps1). Deployment is technically verified only when the service version(s) are active and the selected gate succeeds.
4. **Manual experience acceptance:** provide the Voice Agent Playground URL from the service-specific readback and recommend a complete microphone/audio-to-audio test in the Foundry portal.

Follow [Prompt and Hosted Voice smoke testing](../../create/references/voice-agent/prompt-and-hosted-voice-smoke-test.md); do not attribute portal-only experience properties to the automated smoke test.
