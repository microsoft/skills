# Example: evaluate a non-ATK project

User intent: "I do not have an Agents Toolkit project. Can I still evaluate a deployed agent?"

Yes. Use an explicit deployed agent ID through `M365_AGENT_ID` or `--m365-agent-id`.

## Suggested layout

```text
evals\evals.json
env\.env.dev
.evals\
```

Example `env\.env.dev` values:

```text
TENANT_ID=<tenant-guid>
M365_AGENT_ID=<deployed-agent-id>
AZURE_AI_OPENAI_ENDPOINT=<foundry-models-endpoint>
AZURE_AI_API_KEY=<secret>
AZURE_AI_API_VERSION=2024-12-01-preview
AZURE_AI_MODEL_NAME=gpt-4o-mini
```

Do not print or commit this file if it contains secrets.

## Commands

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --init-only --env dev
```

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --env dev --output .evals\non-atk.json
```

Explicit override:

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --m365-agent-id <agent-id> --env dev --output .evals\non-atk.json
```

## Minimal dataset

```json
{
  "schemaVersion": "1.2.0",
  "default_evaluators": {
    "Relevance": {},
    "Coherence": {}
  },
  "items": [
    {
      "prompt": "What can this agent help me with?",
      "expected_response": "The agent describes its supported scope."
    }
  ]
}
```

If auth, tenant consent, or model setup fails, resolve that before evaluating agent quality.
