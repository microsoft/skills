# Example: create a starter eval dataset

User intent: "Create eval prompts for my M365 Copilot agent."

## Steps

1. Confirm the target agent scenario and whether the repo already has `evals\evals.json`.
2. Load `references\eval-templates.md` and `references\pra-framework.md`.
3. Create a schema `1.2.0` dataset with root `items`.
4. Save it under `evals\evals.json` unless the user asks for another path.

## Starter file

```json
{
  "schemaVersion": "1.2.0",
  "metadata": {
    "name": "Starter M365 Copilot agent evals",
    "description": "Core smoke tests for agent scope, grounding, and response quality.",
    "tags": ["starter", "regression"]
  },
  "default_evaluators": {
    "Relevance": {},
    "Coherence": {}
  },
  "items": [
    {
      "prompt": "What can this agent help me with?",
      "expected_response": "The agent explains its supported scope without claiming unsupported capabilities."
    },
    {
      "prompt": "Summarize the latest status for the project using available sources.",
      "expected_response": "The agent summarizes available status, distinguishes known facts from missing data, and avoids unsupported claims.",
      "evaluators": {
        "Groundedness": {
          "threshold": 3
        }
      },
      "evaluators_mode": "extend"
    },
    {
      "prompt": "List the open action items with owners.",
      "expected_response": "The agent lists action items and owners only when source data supports them.",
      "evaluators": {
        "Citations": {
          "threshold": 1
        }
      },
      "evaluators_mode": "extend"
    }
  ]
}
```

## First safe command

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --init-only
```

Run real evals only after the user confirms tenant, agent, and Azure OpenAI configuration is ready.
