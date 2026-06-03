# Guardrails and troubleshooting

Use this reference before writing files, handling secrets, running state-changing commands, or diagnosing failures.

## Safety rules

1. Never print, commit, or summarize secret values from `.env.local.user`, `env\.env.local.user`, `env\.env.<environment>`, system environment variables, or terminal output.
2. Treat prompts, agent responses, retrieved grounding data, HTML reports, CSV files, JSON results, and debug logs as potentially sensitive.
3. Ask before overwriting an existing dataset or report.
4. Prefer source datasets under `evals\` and local run outputs under `.evals\`.
5. Keep generated run outputs out of commits unless the user explicitly confirms they are sanitized and should be committed.
6. Do not run real tenant-dependent evaluations without user-approved tenant, deployed-agent, and Azure OpenAI configuration.

## File writes

Safe defaults:

| File | Default behavior |
|---|---|
| `evals\evals.json` | Ask before overwrite; this may be committed as a regression suite. |
| `.evals\*.json` | Generated result output; usually local-only. |
| `.evals\*.csv` | Generated result output; usually local-only. |
| `.evals\*.html` | Generated result output; usually local-only and may contain response content. |
| `.env.local` | Non-secret ATK config only. |
| `.env.local.user`, `env\.env.local.user`, `env\.env.<environment>` | Secrets/local config; never commit or display values. |

When generating a dataset, write to a new file or a temporary file first, then rename after validation.

## Commands that change local state

Warn the user before running:

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --cache-clear
npx -y --package @microsoft/m365-copilot-eval@latest runevals --signout
```

`--cache-clear` removes local cache data. `--signout` clears the local auth session and may require the user to sign in again.

## Setup troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| EULA prompt or refusal | EULA not accepted | Run `npx -y --package @microsoft/m365-copilot-eval@latest runevals accept-eula`. |
| `This version of the M365 Evals CLI has stopped working and must be updated` | The shell resolved an outdated bare/global `runevals` shim | Use `npx -y --package @microsoft/m365-copilot-eval@latest runevals --version`; ask before uninstalling global packages or deleting shims. |
| `node` or package startup error | Node version too old | Upgrade to Node.js 24.12.0 or newer. |
| Agent cannot be resolved | Missing or wrong `M365_TITLE_ID`, `M365_AGENT_ID`, `--m365-agent-id`, or `--env` | Pass `--m365-agent-id` explicitly and verify the selected env file. |
| Authentication failure | Not signed in, unsupported OS auth path, missing M365 Copilot license, or tenant admin consent missing | Validate signed-in account, license, and consent. |
| Azure evaluator failure | Missing endpoint/key/model/API version | Check env keys exist without printing values; prefer `gpt-4o-mini`. |
| Schema validation error | Old dataset format or unsupported evaluator | Use root `items` and public evaluator names only. |
| Network/proxy errors | Enterprise network blocks auth/model calls | Ask the user to validate network/proxy access; do not retry with exposed secrets. |

## Quality troubleshooting

Do not treat every failed run as an agent bug.

| Failure type | Category |
|---|---|
| Missing env, auth, consent, EULA, schema, or network | Setup failure |
| Low relevance, coherence, groundedness, similarity, citations, exact match, or partial match | Agent/eval quality signal |
| Ambiguous prompt or overly strict expected response | Eval dataset issue |
| Missing source data or inaccessible connector | Capability/data issue |

Fix setup failures first. Then analyze quality signals with `references\result-analysis.md`.

## Debug logging

Use debug logging only when needed:

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --log-level debug --prompts-file evals\evals.json --output .evals\debug.json
```

Debug output may expose prompts, responses, URLs, identifiers, or retrieved content. Do not paste logs into chat or commit them unless the user confirms they are safe.
