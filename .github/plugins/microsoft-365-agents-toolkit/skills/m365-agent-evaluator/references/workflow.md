# M365 Copilot eval workflow

Use this workflow when the user wants to set up, author, run, or analyze evaluations with the public preview `@microsoft/m365-copilot-eval` CLI.

## Canonical command

Always invoke the CLI through the public npm package:

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals
```

Do not use private-preview installers, global installs, bare `runevals`, bare `npx runevals`, or retired flags such as `--input` and `--html`.

## 1. Detect project shape

Default to the Agents Toolkit path, but support explicit agent IDs for non-ATK projects.

| Project shape | Signals | Agent ID source |
|---|---|---|
| ATK / Teams Toolkit | `.env.local`, `.env.local.user`, `env\.env.local.user`, `m365agents.yml`, `appPackage\declarativeAgent.json` | `M365_TITLE_ID` from `.env.local`, or `M365_AGENT_ID` |
| Non-ATK | Eval dataset plus named env files or explicit CLI args | `M365_AGENT_ID` or `--m365-agent-id` |

If no agent ID can be found, ask the user for the deployed M365 Copilot agent ID or tell them to add it to a local env file.

## 2. Verify local prerequisites

Run safe checks that do not reveal secret values:

```powershell
node --version
npx -y --package @microsoft/m365-copilot-eval@latest runevals --version
npx -y --package @microsoft/m365-copilot-eval@latest runevals --help
```

Current public docs require Node.js 24.12.0 or newer and describe authentication support as Windows-first. The user also needs a Microsoft 365 Copilot license, a deployed M365 Copilot agent, tenant admin consent for the WorkIQ Client App, and Azure OpenAI in Foundry Models configuration.

Also check for stale global/PATH installs before troubleshooting the agent:

```powershell
Get-Command runevals -All
npm list -g @microsoft/m365-copilot-eval --depth=0
npm view @microsoft/m365-copilot-eval version
npx -y --package @microsoft/m365-copilot-eval@latest where runevals
```

If bare `runevals` reports `This version of the M365 Evals CLI has stopped working and must be updated`, the shell is resolving an outdated global shim. Use the package-scoped `npx --package @microsoft/m365-copilot-eval@latest` command, and only remove the global package after user confirmation.

## 3. Accept the EULA and initialize

Use these commands for first-time setup:

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals accept-eula
npx -y --package @microsoft/m365-copilot-eval@latest runevals --init-only
```

`--init-only` validates setup and can create starter files without running a full tenant-dependent evaluation.

## 4. Prepare env files

Use `references\azure-setup.md` for full setup details. Keep secrets out of `.env.local`.

Minimal ATK layout:

```text
.env.local              # non-secret ATK values, for example M365_TITLE_ID
.env.local.user         # local secrets
env\.env.local.user     # alternate local secrets path
```

Minimal non-ATK layout:

```text
env\.env.dev            # named environment selected with --env dev
evals\evals.json        # evaluation dataset
```

Required values are:

```text
TENANT_ID=<tenant-guid>
AZURE_AI_OPENAI_ENDPOINT=<foundry-models-endpoint>
AZURE_AI_API_KEY=<secret>
```

Recommended/default model values:

```text
AZURE_AI_API_VERSION=2024-12-01-preview
AZURE_AI_MODEL_NAME=gpt-4o-mini
```

Set one of:

```text
M365_TITLE_ID=<atk-title-id>
M365_AGENT_ID=<deployed-agent-id>
```

## 5. Create or validate the dataset

The CLI auto-discovers `prompts.json`, `evals.json`, or `tests.json` in the current directory or in `evals\`. Prefer `evals\evals.json` for new work.

Use schema version `1.2.0` with root `items`:

```json
{
  "schemaVersion": "1.2.0",
  "metadata": {
    "name": "Agent regression suite",
    "tags": ["regression"]
  },
  "default_evaluators": {
    "Relevance": {},
    "Coherence": {}
  },
  "items": [
    {
      "prompt": "What can this agent help me with?",
      "expected_response": "The agent describes only supported capabilities."
    }
  ]
}
```

Use `references\eval-templates.md` for copyable single-turn, multi-turn, and evaluator-threshold examples.

## 6. Run evaluations

Batch run with explicit output:

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --output .evals\results.json
```

Human-review HTML:

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --output .evals\results.html
```

Spreadsheet-friendly CSV:

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --output .evals\results.csv
```

Inline smoke test:

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts "What can you help me with?" --expected "The agent explains its supported scope."
```

Interactive exploration:

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --interactive
```

Named environment:

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --env dev
```

Explicit non-ATK agent:

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --m365-agent-id <agent-id> --env dev
```

Controlled concurrency:

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --concurrency 1 --output .evals\debug.json
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --concurrency 5 --output .evals\batch.json
```

Use values from 1 to 5 only. Start with 1 while debugging auth, schema, or agent behavior.

## 7. Manage local state

Use these only when needed, and warn the user first because they affect local state:

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --cache-info
npx -y --package @microsoft/m365-copilot-eval@latest runevals --cache-dir
npx -y --package @microsoft/m365-copilot-eval@latest runevals --cache-clear
npx -y --package @microsoft/m365-copilot-eval@latest runevals --signout
```

`--cache-clear` can remove cached run data. `--signout` resets the local authentication session.

## 8. Analyze and iterate

Load `references\result-analysis.md` after a run. Treat setup/auth/schema failures separately from agent-quality failures. For regression comparisons, keep the same dataset, expected responses, evaluator set, thresholds, model deployment, and concurrency where possible.

Do not run real evaluations unless the user has provided or approved the tenant, deployed agent, and Azure OpenAI configuration.
