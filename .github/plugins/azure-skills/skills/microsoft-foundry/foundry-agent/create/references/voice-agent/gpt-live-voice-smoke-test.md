# GPT-Live Voice Smoke Test

Verify GPT-Live Voice over its dedicated native Live endpoint. Do not use `azd ai agent invoke`, the ordinary [Prompt and Hosted Voice helper](prompt-and-hosted-voice-smoke-test.md), `/protocols/voice`, or a microphone/playback/UI client.

## Basic Technical Gate

The smoke is intentionally simple:

1. Read the deployed GPT-Live Voice agent and latest version.
2. Connect to:

   ```text
   wss://<project-host>/api/projects/<project>/agents/<agent>/endpoint/protocols/voice/live/sessions?api-version=v1
   ```

3. Wait for `session.started`.
4. Request a normal close and wait for `session.closed`.

Report deployed/active status and the smoke result, then provide the Foundry Portal or Agent Playground URL for real microphone, full-duplex, interruption, voice-quality, and latency validation.

## Run the Helper

The helper requires Python 3.11 or later and the verified OpenAI Live SDK:

```bash
python -m pip install "openai[realtime]==3.19.2"
```

```bash
../../scripts/smoke-test-gpt-live.sh \
  --endpoint "$AZURE_AI_PROJECT_ENDPOINT" \
  --agent-name "<gpt-live-agent-name>" \
  --timeout 180
```

```powershell
..\..\scripts\smoke-test-gpt-live.ps1 `
  -Endpoint $env:AZURE_AI_PROJECT_ENDPOINT `
  -AgentName "<gpt-live-agent-name>" `
  -Timeout 180
```

The wrappers run [smoke_test_gpt_live.py](../../scripts/smoke_test_gpt_live.py). Use [smoke-test-gpt-live.sh](../../scripts/smoke-test-gpt-live.sh) or [smoke-test-gpt-live.ps1](../../scripts/smoke-test-gpt-live.ps1). Use `--dry-run` / `-DryRun` to preview without authentication.

Exit codes: `0` pass/help/dry-run, `1` runtime or validation failure, `2` usage error.
