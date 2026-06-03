---
name: m365-agent-evaluator
description: >
  Use this skill when a user wants to create, run, or analyze evaluation suites for Microsoft 365 Copilot declarative agents with the public @microsoft/m365-copilot-eval CLI. Trigger on intents such as "evaluate my agent", "test my agent", "run my evals", "create eval prompts", "add multi-turn tests", "tune evaluator thresholds", "why is my agent failing", or "set up eval environment variables".
---

# M365 Agent Evaluator

Use this skill to help users evaluate Microsoft 365 Copilot declarative agents with `@microsoft/m365-copilot-eval`. The skill designs schema-compatible eval datasets, runs the public preview CLI, analyzes results, and recommends targeted fixes.

Default to Microsoft 365 Agents Toolkit (ATK) projects when detected, but do not hard-stop solely because the current directory is not ATK. The CLI can also evaluate deployed agents with an explicit `M365_AGENT_ID` or `--m365-agent-id`.

## Always use this CLI invocation

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals
```

Do not recommend the old private `aka.ms` installer, global installs, bare `runevals`, bare `npx runevals`, `--input`, or `--html`.

## Activation workflow

1. Identify the user goal: setup, dataset authoring, running evals, analyzing results, or updating an existing eval suite.
2. Load only the reference needed for the current goal:
   - `references/workflow.md` for the end-to-end operator workflow and CLI commands.
   - `references/azure-setup.md` for prerequisites, env files, and secret handling.
   - `references/eval-templates.md` when creating or editing eval datasets.
   - `references/pra-framework.md` when deciding what scenarios to generate.
   - `references/result-analysis.md` after JSON/CSV/HTML results exist.
   - `references/guardrails.md` before writing files, handling secrets, clearing cache, signing out, or troubleshooting.
3. Detect project shape:
   - ATK: `.env.local`, `.env.local.user`, `env\.env.local.user`, `m365agents.yml`, or `appPackage\declarativeAgent.json`.
   - Non-ATK: an eval dataset plus `M365_AGENT_ID`, `--m365-agent-id`, or a named environment file such as `env\.env.dev`.
4. Verify prerequisites without exposing values:
   - Node.js 24.12.0 or newer.
   - Microsoft 365 Copilot license and a deployed M365 Copilot agent.
   - Tenant admin consent for the WorkIQ Client App.
   - `TENANT_ID`, Azure OpenAI in Foundry Models endpoint/key, and recommended/default `gpt-4o-mini` deployment.
5. Choose the workflow:
   - No dataset: create `evals\evals.json`.
   - Existing dataset: run, analyze prior results, or propose changes.
   - Quick check: use inline prompts.
   - Exploration: use interactive mode.

## Current dataset contract

Generate schema version `1.2.0` documents with a root `items` array. Do not generate the old `PromptsObject` or root `prompts` format.

Minimum shape:

```json
{
  "schemaVersion": "1.2.0",
  "metadata": {
    "name": "Agent evaluation suite",
    "tags": ["starter"]
  },
  "default_evaluators": {
    "Relevance": {},
    "Coherence": {}
  },
  "items": [
    {
      "prompt": "What can this agent help me with?",
      "expected_response": "The agent explains its supported scope without inventing unsupported capabilities."
    }
  ]
}
```

Use `references\prompts-schema.json` as the local schema source and `references\eval-templates.md` for copyable single-turn, multi-turn, evaluator, and threshold examples.

## Public evaluator names

Evaluator names are case-sensitive. Use only the public configurable evaluator names unless a newer authoritative source proves otherwise.

| Evaluator | Semantics |
|---|---|
| `Relevance` | LLM score from 1-5; default threshold 3. |
| `Coherence` | LLM score from 1-5; default threshold 3. |
| `Groundedness` | LLM score from 1-5 against `context`/expected evidence; default threshold 3. |
| `Similarity` | LLM score from 1-5 against `expected_response`; default threshold 3. |
| `Citations` | Count-based citation check; default threshold 1. |
| `ExactMatch` | Boolean exact string match. |
| `PartialMatch` | String similarity from 0.0-1.0; default threshold 0.5. |

Treat `ToolCallAccuracy` as legacy/private for authoring. Do not add it to generated datasets unless current public CLI/schema documentation explicitly reintroduces it.

## Common commands

```powershell
# Version/help checks
npx -y --package @microsoft/m365-copilot-eval@latest runevals --version
npx -y --package @microsoft/m365-copilot-eval@latest runevals --help

# First-time setup / EULA
npx -y --package @microsoft/m365-copilot-eval@latest runevals accept-eula
npx -y --package @microsoft/m365-copilot-eval@latest runevals --init-only

# Batch run with explicit JSON output
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --output .evals\results.json

# Human-review HTML or spreadsheet-friendly CSV
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --output .evals\results.html
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --output .evals\results.csv

# Quick checks
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts "What can you help me with?" --expected "The agent describes its supported scope."

# Non-ATK or named environment
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --m365-agent-id <agent-id> --env dev
```

Use `--concurrency` only with values 1-5. Start with `1` for debugging and increase only after setup is stable.

## Version and PATH safety

Before diagnosing agent behavior, confirm which executable is running:

```powershell
Get-Command runevals -All
npm list -g @microsoft/m365-copilot-eval --depth=0
npm view @microsoft/m365-copilot-eval version
npx -y --package @microsoft/m365-copilot-eval@latest runevals --version
npx -y --package @microsoft/m365-copilot-eval@latest where runevals
```

If bare `runevals` prints `This version of the M365 Evals CLI has stopped working and must be updated`, treat it as a stale PATH/global install. Re-run with the `npx --package ...@latest` command above, then ask before removing global shims with `npm uninstall -g @microsoft/m365-copilot-eval`.

## File conventions

| Path | Purpose |
|---|---|
| `.env.local` | Non-secret ATK config such as `M365_TITLE_ID`. |
| `.env.local.user` or `env\.env.local.user` | Local secrets such as tenant ID and Azure OpenAI key. |
| `env\.env.<environment>` | Named environment config for non-ATK or explicit `--env` workflows. |
| `evals\evals.json` | Source-controlled eval dataset if the user wants it committed. |
| `.evals\` | Local run outputs; usually gitignored. |

Never print or commit secrets, prompts containing sensitive data, retrieved content, debug logs, or raw result files unless the user explicitly asks and confirms the data is safe to share.

## Generation guidance

Use PRA as a scenario-design framework:

- Perceive: retrieval, grounding, and source coverage.
- Reason: instruction adherence, synthesis, ambiguity handling, and refusal behavior.
- Act: declared capability/action behavior. Score with public evaluators such as `Relevance`, `Coherence`, `Similarity`, `ExactMatch`, or `PartialMatch`; do not use legacy `ToolCallAccuracy`.

Ask before overwriting an existing dataset. When writing generated evals, write to a temporary file first and rename on success.

## Result analysis guidance

Analyze only evaluator keys that are present. Missing score keys usually mean the evaluator was not configured for that item, not that it failed.

Use current score keys when present: `relevance`, `coherence`, `groundedness`, `similarity`, `citations`, `exactMatch`, and `partialMatch`. Group failures into likely root causes: instruction issue, grounding issue, citation issue, expected-answer mismatch, capability gap, auth/environment issue, or eval-quality issue.

Do not run real tenant-dependent evals unless the user has provided or approved the necessary tenant, agent, and Azure OpenAI configuration.
