# Environment and Azure setup

Use this reference when the user needs prerequisites, env files, admin consent, authentication, or Azure OpenAI configuration for `@microsoft/m365-copilot-eval`.

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js | Node.js 24.12.0 or newer. |
| Operating system | Public docs describe authentication as Windows-first. If another OS fails during auth, validate on Windows before diagnosing the agent. |
| Microsoft 365 Copilot | The signed-in user needs a Microsoft 365 Copilot license. |
| Deployed agent | Evaluate a deployed Microsoft 365 Copilot declarative agent, not only a local manifest. |
| Tenant admin consent | Tenant admin consent is required for the WorkIQ Client App before first use. |
| Azure OpenAI in Foundry Models | The evaluator model endpoint and key are required for LLM-based metrics. |

## Recommended CLI checks

```powershell
node --version
npx -y --package @microsoft/m365-copilot-eval@latest runevals --version
npx -y --package @microsoft/m365-copilot-eval@latest runevals --help
npx -y --package @microsoft/m365-copilot-eval@latest runevals accept-eula
npx -y --package @microsoft/m365-copilot-eval@latest runevals --init-only
```

Do not print environment variable values while checking setup.

## Version and PATH checks

The public preview CLI can retire older versions. Check both the package-scoped version and any bare `runevals` shim before troubleshooting:

```powershell
Get-Command runevals -All
npm list -g @microsoft/m365-copilot-eval --depth=0
npm view @microsoft/m365-copilot-eval version
npx -y --package @microsoft/m365-copilot-eval@latest runevals --version
npx -y --package @microsoft/m365-copilot-eval@latest where runevals
```

If `runevals` without `npx --package` fails with `This version of the M365 Evals CLI has stopped working and must be updated`, a stale global install is being resolved from PATH. Continue with the package-scoped `@latest` command and ask before removing global installs.

## Required configuration values

| Variable | Required | Secret | Purpose |
|---|---:|---:|---|
| `TENANT_ID` | Yes | No | Microsoft Entra tenant ID for the evaluation run. |
| `AZURE_AI_OPENAI_ENDPOINT` | Yes | No | Azure OpenAI in Foundry Models endpoint. |
| `AZURE_AI_API_KEY` | Yes | Yes | Key used by the evaluator model client. |
| `M365_TITLE_ID` | ATK path | No | Agents Toolkit title ID auto-detected from `.env.local`. |
| `M365_AGENT_ID` | Non-ATK or override | No | Deployed M365 Copilot agent ID. |
| `AZURE_AI_API_VERSION` | No | No | Defaults to `2024-12-01-preview`. |
| `AZURE_AI_MODEL_NAME` | No | No | Defaults/recommended value: `gpt-4o-mini`. |

## File placement

### Agents Toolkit project

Use `.env.local` for non-secret project configuration:

```text
M365_TITLE_ID=<atk-title-id>
AZURE_AI_API_VERSION=2024-12-01-preview
AZURE_AI_MODEL_NAME=gpt-4o-mini
```

Use `.env.local.user` or `env\.env.local.user` for local secrets:

```text
TENANT_ID=<tenant-guid>
AZURE_AI_OPENAI_ENDPOINT=<foundry-models-endpoint>
AZURE_AI_API_KEY=<secret>
```

### Non-ATK or named environment

Use a named environment file and select it with `--env`:

```text
env\.env.dev
```

Example:

```text
TENANT_ID=<tenant-guid>
M365_AGENT_ID=<deployed-agent-id>
AZURE_AI_OPENAI_ENDPOINT=<foundry-models-endpoint>
AZURE_AI_API_KEY=<secret>
AZURE_AI_API_VERSION=2024-12-01-preview
AZURE_AI_MODEL_NAME=gpt-4o-mini
```

Run with:

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --env dev
```

Or override the agent ID directly:

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --m365-agent-id <agent-id> --env dev
```

## Environment precedence

When diagnosing surprising values, check likely sources in this order:

1. Project local files such as `.env.local`.
2. Local user secret files such as `.env.local.user` or `env\.env.local.user`.
3. Named environment files such as `env\.env.dev` when selected with `--env dev`.
4. System environment variables.

Live CLI help has shown `--env` defaulting to `local`; some docs have used `dev`. Prefer passing `--env <name>` explicitly when relying on a named file.

## Gitignore checklist

Ensure local secrets and generated run artifacts are not committed unless the user explicitly chooses to commit sanitized outputs:

```text
.env.local.user
env\.env.local.user
env\.env.*.user
.evals\
*.log
```

`env\.env.<environment>` files can contain secrets in non-ATK projects. Treat them as local-only unless the repo has an established convention for checked-in, non-secret environment templates.

## Troubleshooting setup

| Symptom | Likely cause | Action |
|---|---|---|
| CLI prompts for EULA | EULA has not been accepted | Run `npx -y --package @microsoft/m365-copilot-eval@latest runevals accept-eula`. |
| `This version of the M365 Evals CLI has stopped working and must be updated` | Bare `runevals` is resolving a stale global/PATH install | Use `npx -y --package @microsoft/m365-copilot-eval@latest runevals --version`; ask before removing the global package. |
| Auth fails before agent response | Missing consent, license, or sign-in session | Confirm tenant admin consent and signed-in M365 Copilot user. |
| Model/evaluator errors | Missing endpoint, key, deployment, or API version | Validate Azure OpenAI in Foundry Models values without printing secrets. |
| Agent not found | Wrong `M365_TITLE_ID`, `M365_AGENT_ID`, or environment | Use explicit `--m365-agent-id` and `--env`. |
| Schema validation fails | Dataset uses old format or invalid evaluator names | Validate against `references\prompts-schema.json`. |
| Node error | Node version below public requirement | Upgrade Node.js to 24.12.0 or newer. |

Never paste keys, tenant data, raw prompts, retrieved grounding data, or debug logs into chat unless the user confirms the content is safe to share.
